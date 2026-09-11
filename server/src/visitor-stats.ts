/**
 * Rolling-window counts of distinct client IPs that opened a WebSocket connection.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

const ipLastConnect = new Map<string, number>();

export function recordConnectionOpen(ip: string, now: number = Date.now()): void {
  ipLastConnect.set(ip, now);
  if (ipLastConnect.size % 250 === 0) pruneOlderThan(now - THIRTY_DAYS_MS);
}

function pruneOlderThan(cutoff: number): void {
  for (const [ip, t] of ipLastConnect) {
    if (t < cutoff) ipLastConnect.delete(ip);
  }
}

export function getDistinctIpCounts(now: number = Date.now()): { last24h: number; last30d: number } {
  const dayCutoff = now - ONE_DAY_MS;
  const monthCutoff = now - THIRTY_DAYS_MS;
  let last24h = 0;
  let last30d = 0;
  for (const t of ipLastConnect.values()) {
    if (t < monthCutoff) continue;
    last30d++;
    if (t >= dayCutoff) last24h++;
  }
  return { last24h, last30d };
}

export function formatStatsLine(now: number = Date.now()): string {
  const { last24h, last30d } = getDistinctIpCounts(now);
  return `Unique IPs (by connection) — last 24h: ${last24h} — last 30 days: ${last30d}`;
}
