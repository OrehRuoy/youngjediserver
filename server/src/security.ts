/**
 * Security: connection limits, idle timeout, login throttling.
 * Protects against spam, DoS, and brute-force login attempts.
 */

import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_CONNECTIONS_PER_IP = Math.max(1, Number(process.env.MAX_CONNECTIONS_PER_IP) || 4);
const MAX_CONNECTIONS = Math.max(1, Number(process.env.MAX_CONNECTIONS) || 32);
/**
 * Trust X-Forwarded-For / X-Real-IP only behind a proxy (Render, Fly, Localtonet).
 * Default on when PORT is set (typical PaaS); set TRUST_PROXY=0 to disable.
 */
const TRUST_PROXY =
  process.env.TRUST_PROXY === "1" ||
  process.env.TRUST_PROXY === "true" ||
  (process.env.TRUST_PROXY !== "0" &&
    process.env.TRUST_PROXY !== "false" &&
    Boolean(process.env.PORT));

/** IPs allowed multiple connections. Set ALLOW_MULTI_IP in .env (comma-separated). */
const ALLOW_MULTI_IPS = new Set<string>([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  ...(process.env.ALLOW_MULTI_IP ?? "").split(",").map((s) => s.trim()).filter(Boolean),
]);
const LOGIN_ATTEMPTS_MAX = 5;
const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes

const localhostPatterns = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
];

function isLocalhost(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  return localhostPatterns.some((p) => normalized === p || normalized.endsWith(p));
}

/**
 * Client IP for connection limits and throttling. When TRUST_PROXY is on (Render, tunnels),
 * use X-Forwarded-For / X-Real-IP / Forwarded so each client is identified by their real IP.
 */
export function getClientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") {
      const first = xff.split(",")[0].trim();
      if (first) return normalizeIp(first);
    }
    const xri = req.headers["x-real-ip"];
    if (typeof xri === "string") {
      const ip = xri.trim();
      if (ip) return normalizeIp(ip);
    }
    const forwarded = req.headers["forwarded"];
    if (typeof forwarded === "string") {
      const forMatch = forwarded.match(/\bfor=(?:"([^"]+)"|([^";,\s]+))/i);
      if (forMatch) {
        const ip = (forMatch[1] ?? forMatch[2] ?? "").trim();
        if (ip) return normalizeIp(ip);
      }
    }
  }
  const raw = req.socket?.remoteAddress ?? "unknown";
  return normalizeIp(raw);
}

function normalizeIp(ip: string): string {
  const s = ip.trim();
  if (s.toLowerCase().startsWith("::ffff:")) return s.slice(7);
  return s;
}

// --- Connection limit per IP + global cap ---
const connectionsByIp = new Map<string, Set<WebSocket>>();
const wsToIp = new WeakMap<WebSocket, string>();
let totalConnections = 0;

function isAllowedMultiConnection(ip: string): boolean {
  const trimmed = ip.trim();
  if (ALLOW_MULTI_IPS.has(trimmed)) return true;
  const v4 = trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
  return ALLOW_MULTI_IPS.has(v4);
}

export function checkConnectionLimit(req: IncomingMessage): string | null {
  if (totalConnections >= MAX_CONNECTIONS) {
    return "Server is full. Try again later.";
  }
  const ip = getClientIp(req);
  if (isLocalhost(ip)) return null;
  if (isAllowedMultiConnection(ip)) return null;

  const existing = connectionsByIp.get(ip) ?? new Set();
  if (existing.size >= MAX_CONNECTIONS_PER_IP) {
    console.warn("[security] Rejected connection – too many from IP:", ip, "existing:", existing.size);
    return `Too many connections from your IP. Maximum ${MAX_CONNECTIONS_PER_IP} connection(s) allowed.`;
  }
  return null;
}

export function registerConnection(req: IncomingMessage, ws: WebSocket): void {
  const ip = getClientIp(req);
  wsToIp.set(ws, ip);
  totalConnections++;
  if (isLocalhost(ip)) return;

  let set = connectionsByIp.get(ip);
  if (!set) {
    set = new Set();
    connectionsByIp.set(ip, set);
  }
  set.add(ws);
}

export function unregisterConnection(ws: WebSocket): void {
  const ip = wsToIp.get(ws);
  wsToIp.delete(ws);
  if (totalConnections > 0) totalConnections--;
  if (!ip || isLocalhost(ip)) return;

  const set = connectionsByIp.get(ip);
  if (set) {
    set.delete(ws);
    if (set.size === 0) connectionsByIp.delete(ip);
  }
}

// --- Idle timeout ---
const idleTimers = new WeakMap<WebSocket, ReturnType<typeof setTimeout>>();

export function refreshIdleTimer(ws: WebSocket, _req: IncomingMessage, onTimeout: () => void): void {
  const existing = idleTimers.get(ws);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    idleTimers.delete(ws);
    onTimeout();
  }, IDLE_TIMEOUT_MS);
  idleTimers.set(ws, timer);
}

export function clearIdleTimer(ws: WebSocket): void {
  const timer = idleTimers.get(ws);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(ws);
  }
}

// --- Login throttle ---
interface ThrottleEntry {
  attempts: number;
  windowStart: number;
}

const loginThrottleByIp = new Map<string, ThrottleEntry>();

export function checkLoginThrottle(req: IncomingMessage): string | null {
  const ip = getClientIp(req);
  if (isLocalhost(ip)) return null;

  const now = Date.now();
  let entry = loginThrottleByIp.get(ip);

  if (!entry) {
    entry = { attempts: 0, windowStart: now };
    loginThrottleByIp.set(ip, entry);
  }

  if (now - entry.windowStart > LOGIN_THROTTLE_WINDOW_MS) {
    entry.attempts = 0;
    entry.windowStart = now;
  }

  if (entry.attempts >= LOGIN_ATTEMPTS_MAX) {
    const remaining = Math.ceil((entry.windowStart + LOGIN_THROTTLE_WINDOW_MS - now) / 60000);
    return `Too many login attempts. Try again in ${remaining} minute(s).`;
  }

  return null;
}

export function recordLoginAttempt(req: IncomingMessage, success: boolean): void {
  const ip = getClientIp(req);
  if (isLocalhost(ip)) return;

  const entry = loginThrottleByIp.get(ip);
  if (!entry) return;

  if (success) {
    entry.attempts = 0;
    entry.windowStart = Date.now();
  } else {
    entry.attempts++;
  }
}
