/**
 * Young Jedi TCG — Server entry.
 * HTTP/HTTPS server + WebSocket/WSS. All game logic is server-authoritative.
 * Security: connection limits, idle timeout, login throttling.
 * TLS: set TLS_CERT_PATH and TLS_KEY_PATH to enable HTTPS + WSS.
 * Optional: create a .env file (see .env.example) so you don't need to set env in the shell.
 */
import "dotenv/config";

import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";
import { initCards } from "./cards/loader";
import * as lobby from "./lobby/lobby";
import * as lobbyHandlers from "./lobby/handlers";
import * as gameEngine from "./game/engine";
import * as gameState from "./game/state";
import * as gameHandlers from "./game/handlers";
import * as bot from "./game/bot";
import * as botMemory from "./game/bot-memory";
import * as security from "./security";
import * as visitorStats from "./visitor-stats";
import type { ClientMessage, Side } from "./types";

const VISITOR_STATS_LOG_MS = 60_000;

// Use high port (49152) locally. PaaS (Render) sets PORT and we must bind 0.0.0.0.
const PORT = Number(process.env.PORT) || 49152;
const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const WS_PING_MS = 30_000;
const TLS_CERT_PATH = process.env.TLS_CERT_PATH ?? "";
const TLS_KEY_PATH = process.env.TLS_KEY_PATH ?? "";
const GAME_START_DELAY_MS = 2500;  // brief wait before drawing destiny cards
const DESTINY_COMPARE_DELAY_MS = 6000;  // time between destiny draws (faster)
const GAME_END_AUTO_CLOSE_MS = 2 * 60 * 1000;  // 2 minutes after game end, close if not both returned
const BOT_DELAY_MS = 1800;  // delay before each bot action so the player can see what the bot is doing
const BOT_DELAY_LOCATION_MS = 4000;  // choose_starting_location / choose_next_planet — player needs to see the choice
const BOT_DELAY_DEPLOY_MS = 3200;    // deploy phase — time to see cards placed
const BOT_DELAY_PHASE_PASS_MS = 2800; // pass_phase — phase changed, give time to read

const gameEndTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleGameEndCleanup(gameId: string): void {
  const existing = gameEndTimers.get(gameId);
  if (existing) clearTimeout(existing);
  const botSched = botScheduled.get(gameId);
  if (botSched) {
    clearTimeout(botSched);
    botScheduled.delete(gameId);
  }
  const handle = setTimeout(() => {
    gameEndTimers.delete(gameId);
    gameEngine.unregisterGame(gameId);
  }, GAME_END_AUTO_CLOSE_MS);
  gameEndTimers.set(gameId, handle);
}

function clearGameEndCleanup(gameId: string): void {
  const handle = gameEndTimers.get(gameId);
  if (handle) {
    clearTimeout(handle);
    gameEndTimers.delete(gameId);
  }
}

// --- Card data & bot memory ---
initCards();
botMemory.ensureLoaded();

/** If headless training wrote server/data/headless-base-config.json, the client's bot uses those thresholds (and still uses bot-memory). No copy needed. */
let headlessBotConfig: bot.BotConfig | undefined;
function loadHeadlessBotConfig(): void {
  try {
    const configPath = path.join(__dirname, "..", "data", "headless-base-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const data = JSON.parse(raw);
      headlessBotConfig = {
        battleThresholdWithWeapons: typeof data.battleThresholdWithWeapons === "number" ? data.battleThresholdWithWeapons : bot.DEFAULT_BOT_CONFIG.battleThresholdWithWeapons,
        battleThresholdNoWeapons: typeof data.battleThresholdNoWeapons === "number" ? data.battleThresholdNoWeapons : bot.DEFAULT_BOT_CONFIG.battleThresholdNoWeapons,
        battleThresholdMoreCharsCap: typeof data.battleThresholdMoreCharsCap === "number" ? data.battleThresholdMoreCharsCap : bot.DEFAULT_BOT_CONFIG.battleThresholdMoreCharsCap,
        useMemoryAdjustment: true,
        surrenderPowerRatio: typeof data.surrenderPowerRatio === "number" ? data.surrenderPowerRatio : bot.DEFAULT_BOT_CONFIG.surrenderPowerRatio,
        discardHandUnplayableThreshold: typeof data.discardHandUnplayableThreshold === "number" ? data.discardHandUnplayableThreshold : bot.DEFAULT_BOT_CONFIG.discardHandUnplayableThreshold,
        discardHandMinDeck: typeof data.discardHandMinDeck === "number" ? data.discardHandMinDeck : bot.DEFAULT_BOT_CONFIG.discardHandMinDeck,
      };
      console.log("[bot] Using trained config from data/headless-base-config.json");
    }
  } catch {
    // no file or invalid — use default bot behavior
  }
}
loadHeadlessBotConfig();

const DATA_DIR = path.join(__dirname, "..", "data");

const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "young-jedi-server" }));
    return;
  }
  if (req.url === "/updates/version.json" && req.method === "GET") {
    const versionPath = path.join(DATA_DIR, "version.json");
    const pckPath = path.join(DATA_DIR, "game_data.pck");
    try {
      const raw = fs.readFileSync(versionPath, "utf-8");
      const ver = JSON.parse(raw) as Record<string, unknown>;
      if (fs.existsSync(pckPath)) {
        ver.pck_bytes = fs.statSync(pckPath).size;
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      });
      res.end(JSON.stringify(ver));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "version not available" }));
    }
    return;
  }
  if (req.url === "/updates/game_data.pck" && req.method === "GET") {
    const pckPath = path.join(DATA_DIR, "game_data.pck");
    try {
      if (!fs.existsSync(pckPath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const buf = fs.readFileSync(pckPath);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      });
      res.end(buf);
    } catch {
      res.writeHead(500);
      res.end();
    }
    return;
  }
  res.writeHead(404);
  res.end();
};

const useTls = TLS_CERT_PATH && TLS_KEY_PATH && fs.existsSync(TLS_CERT_PATH) && fs.existsSync(TLS_KEY_PATH);
const server = useTls
  ? https.createServer(
      {
        cert: fs.readFileSync(TLS_CERT_PATH),
        key: fs.readFileSync(TLS_KEY_PATH),
      },
      requestHandler
    )
  : http.createServer(requestHandler);

function applyConcedeAndBroadcast(gameId: string, playerId: string, reason: string): boolean {
  const g = gameEngine.getGame(gameId);
  if (!g || g.phase === "game_over") return false;
  const result = gameHandlers.handleGameConcede(gameId, playerId);
  if (!result) return false;
  gameEngine.stopPhaseTimer(g.id);
  g.phase = "game_over";
  g.lightReturnedToLobby = false;
  g.darkReturnedToLobby = false;
  broadcastToGame(g.id, { type: "game_ended", winner: result.winner, reason });
  if (bot.isBotGame(g)) {
    const bs = bot.getBotSide(g);
    if (bs) botMemory.runPostGameAnalysis(g.id, g, bs, result.winner, reason);
  }
  removeTableAndBroadcastLobby(g.id);
  scheduleGameEndCleanup(g.id);
  return true;
}

const wss = new WebSocketServer({ server });

function send(ws: import("ws").WebSocket, msg: object): void {
  if (ws.readyState !== 1) return;
  ws.send(JSON.stringify(msg));
}

function broadcastToTable(tableId: string, msg: object, excludePlayerId?: string): void {
  const players = lobby.getPlayersInTable(tableId);
  for (const p of players) {
    if (p.id !== excludePlayerId) send(p.ws, msg);
  }
}

function broadcastToGame(gameId: string, msg: object): void {
  const g = gameEngine.getGame(gameId);
  if (!g) return;
  const light = lobby.getPlayer(g.lightPlayerId);
  const dark = lobby.getPlayer(g.darkPlayerId);
  if (light) send(light.ws, msg);
  if (dark) send(dark.ws, msg);
}

/** Remove the game's table from lobby (Playing tables) and broadcast updated tables to all clients. */
function removeTableAndBroadcastLobby(gameId: string): void {
  const g = gameEngine.getGame(gameId);
  if (!g?.tableId) return;
  lobby.removeTableWhenGameEnds(g.tableId);
  const snapshot = lobbyHandlers.buildLobbySnapshot();
  wss.clients.forEach((client) => {
    if (client.readyState === 1) send(client, snapshot);
  });
}

const botScheduled = new Map<string, ReturnType<typeof setTimeout>>();

function botDelayForPhase(phase: string, lastActionKind: string): number {
  if (lastActionKind === "choose_starting_location" || lastActionKind === "choose_next_planet") return BOT_DELAY_LOCATION_MS;
  if (lastActionKind === "play_card" && phase === "deploy") return BOT_DELAY_DEPLOY_MS;
  if (lastActionKind === "pass_phase") return BOT_DELAY_PHASE_PASS_MS;
  return BOT_DELAY_MS;
}

function scheduleBotTurn(gameId: string, delayMs: number = BOT_DELAY_MS): void {
  const existing = botScheduled.get(gameId);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    botScheduled.delete(gameId);
    runBotTurn(gameId);
  }, delayMs);
  botScheduled.set(gameId, handle);
}

/** Call after broadcasting game_state; schedules bot turn if it's a bot game and bot must act. */
function afterGameStateBroadcast(gameId: string): void {
  const g = gameEngine.getGame(gameId);
  if (g && bot.isBotGame(g) && bot.isBotActionRequired(g)) scheduleBotTurn(gameId);
}

function runBotTurn(gameId: string): void {
  const g = gameEngine.getGame(gameId);
  if (!g || !bot.isBotGame(g) || !bot.isBotActionRequired(g)) {
    if (g && !bot.isBotGame(g) && !bot.isBotActionRequired(g)) gameEngine.startPhaseTimer(gameId, createPhaseTimerCallback(gameId));
    return;
  }
  const botSide = bot.getBotSide(g)!;
  let action = bot.getNextAction(g, botSide, headlessBotConfig);
  const battleSubPhaseActive = !!(g.battleCardDeclareSide || g.battlePlanPhase);
  if (action === null && (g.phase === "deploy" || (g.phase === "battle" && !battleSubPhaseActive))) action = { kind: "pass_phase" };
  if (action === null) return;
  const wasBattlePlan = !!g.battlePlanPhase;
  if (action.kind === "initiate_battle") botMemory.captureBattleStart(gameId, g, botSide);
  botMemory.recordBotTurn(gameId, g, botSide, action);
  if (action.kind === "choose_starting_location" && action.instanceId) {
    const choice = g.startingLocationChoices?.find((c) => c.instanceId === action.instanceId);
    if (choice) botMemory.recordStartingLocationChoice(gameId, choice.cardId);
  }
  if (action.kind === "choose_next_planet" && action.instanceId) {
    const choice = g.nextPlanetChoices?.find((c) => c.instanceId === action.instanceId);
    if (choice) botMemory.recordNextPlanetChoice(gameId, choice.cardId);
  }
  const result = gameHandlers.handleGameAction(g.id, lobby.BOT_PLAYER_ID, action);
  if (!result.applied) return;
  let updated = gameEngine.getGame(gameId);
  if (!updated) return;
  if (wasBattlePlan && !updated.battlePlanPhase) botMemory.captureBattleResult(gameId, updated);
  if (result.gameOver) {
    gameEngine.stopPhaseTimer(gameId);
    updated.phase = "game_over";
    updated.lightReturnedToLobby = false;
    updated.darkReturnedToLobby = false;
    const reason = result.gameOver.reason ?? "battle";
    broadcastToGame(gameId, { type: "game_ended", winner: result.gameOver.winner, reason });
    botMemory.runPostGameAnalysis(gameId, updated, botSide, result.gameOver.winner as Side, reason);
    removeTableAndBroadcastLobby(gameId);
    scheduleGameEndCleanup(gameId);
    return;
  }
  updated = gameEngine.getGame(gameId)!;
  const snap = gameState.toSnapshot(updated);
  broadcastToGame(gameId, { type: "game_state", gameId, state: snap });
  if (updated.battleRevealSequence) updated.battleRevealSequence = undefined;
  const lightP = lobby.getPlayer(updated.lightPlayerId);
  const darkP = lobby.getPlayer(updated.darkPlayerId);
  if (lightP) send(lightP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(updated, "light") });
  if (darkP) send(darkP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(updated, "dark") });
  if (bot.isBotActionRequired(updated)) {
    const delayMs = botDelayForPhase(updated.phase, action.kind);
    scheduleBotTurn(gameId, delayMs);
  } else if (!bot.isBotGame(updated)) {
    gameEngine.startPhaseTimer(gameId, createPhaseTimerCallback(gameId));
  }
}

function createPhaseTimerCallback(_gameId: string): (game: import("./game/state").GameStateData) => void {
  return (game) => {
    if (game.phase === "game_over") {
      gameEngine.stopPhaseTimer(game.id);
      game.lightReturnedToLobby = false;
      game.darkReturnedToLobby = false;
      const winner: Side = (game.lightPlanetsWon ?? 0) >= 2 ? "light" : "dark";
      broadcastToGame(game.id, { type: "game_ended", winner, reason: "planet_victory" });
      if (bot.isBotGame(game)) {
        const bs = bot.getBotSide(game);
        if (bs) botMemory.runPostGameAnalysis(game.id, game, bs, winner, "planet_victory");
      }
      removeTableAndBroadcastLobby(game.id);
      scheduleGameEndCleanup(game.id);
      return;
    }
    const snap = gameState.toSnapshot(game);
    broadcastToGame(game.id, { type: "game_state", gameId: game.id, state: snap });
    const lp = lobby.getPlayer(game.lightPlayerId);
    const dp = lobby.getPlayer(game.darkPlayerId);
    if (lp) send(lp.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(game, "light") });
    if (dp) send(dp.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(game, "dark") });
    afterGameStateBroadcast(game.id);
  };
}

function scheduleDestinyCompareResolve(gameId: string): void {
  setTimeout(() => {
    const g = gameEngine.getGame(gameId);
    if (!g || g.phase !== "determine_first") return;
    const result = gameState.resolveDestinyCompare(g);
    const snap = gameState.toSnapshot(g);
    broadcastToGame(gameId, { type: "game_state", gameId, state: snap });
    afterGameStateBroadcast(gameId);
    if (result.done) {
      const lightP = lobby.getPlayer(g.lightPlayerId);
      const darkP = lobby.getPlayer(g.darkPlayerId);
      const phaseNow = g.phase as string;
      if (phaseNow === "draw") {
        if (lightP) send(lightP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, "light") });
        if (darkP) send(darkP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, "dark") });
        if (!bot.isBotGame(g)) gameEngine.startPhaseTimer(gameId, createPhaseTimerCallback(gameId));
      }
    } else {
      scheduleDestinyCompareResolve(gameId);
    }
  }, DESTINY_COMPARE_DELAY_MS);
}

wss.on("connection", (ws, req) => {
  // --- Security: connection limit per IP (1 for external, unlimited for localhost) ---
  const limitErr = security.checkConnectionLimit(req);
  if (limitErr) {
    send(ws, { type: "error", error: limitErr });
    ws.close();
    return;
  }
  security.registerConnection(req, ws);
  visitorStats.recordConnectionOpen(security.getClientIp(req));

  let playerId: string | null = null;

  const refreshIdle = () => {
    security.refreshIdleTimer(ws, req, () => {
      ws.close();
    });
  };
  refreshIdle();

  ws.on("message", (data: Buffer) => {
    refreshIdle();
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString()) as ClientMessage;
    } catch {
      send(ws, { type: "error", error: "Invalid JSON" });
      return;
    }

    // --- Login required for everything except login and heartbeat ---
    if (msg.type !== "login" && msg.type !== "heartbeat") {
      if (!playerId) {
        send(ws, { type: "error", error: "Login first" });
        return;
      }
    }

    switch (msg.type) {
      case "heartbeat":
        break;

      case "login": {
        const throttleErr = security.checkLoginThrottle(req);
        if (throttleErr) {
          send(ws, { type: "login_result", ok: false, error: throttleErr });
          break;
        }
        const result = lobbyHandlers.handleLogin(ws, msg.name);
        security.recordLoginAttempt(req, result.ok);
        send(ws, result);
        if (result.ok && result.playerId) {
          playerId = result.playerId;
          const snapshot = lobbyHandlers.buildLobbySnapshot();
          send(ws, snapshot);
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) send(client, snapshot);
          });
        }
        break;
      }

      case "lobby_chat": {
        const out = lobbyHandlers.handleLobbyChat(playerId!, msg.text);
        if (out) {
          wss.clients.forEach((client) => {
            if (client.readyState === 1) send(client, out);
          });
        }
        break;
      }

      case "table_create": {
        const out = lobbyHandlers.handleTableCreate(playerId!, msg.side);
        if (out) {
          send(ws, out);
          if (out.type === "table_update") {
            broadcastToTable(out.table.id, out, playerId!);
          }
          const snapshot = lobbyHandlers.buildLobbySnapshot();
          wss.clients.forEach((client) => {
            if (client.readyState === 1) send(client, snapshot);
          });
        }
        break;
      }

      case "table_join": {
        const out = lobbyHandlers.handleTableJoin(playerId!, msg.tableId, msg.side);
        if (out) {
          send(ws, out);
          if (out.type === "table_update") {
            broadcastToTable(out.table.id, out, playerId!);
          }
          const snapshot = lobbyHandlers.buildLobbySnapshot();
          wss.clients.forEach((client) => {
            if (client.readyState === 1) send(client, snapshot);
          });
        }
        break;
      }

      case "table_leave": {
        const tableId = lobby.getPlayer(playerId!)?.tableId;
        const out = lobbyHandlers.handleTableLeave(playerId!);
        if (out) {
          send(ws, out);
          if (tableId && out.type === "table_update" && out.table) {
            broadcastToTable(tableId, out);
          }
          const snapshot = lobbyHandlers.buildLobbySnapshot();
          wss.clients.forEach((client) => {
            if (client.readyState === 1) send(client, snapshot);
          });
        }
        break;
      }

      case "table_ready": {
        const out = lobbyHandlers.handleTableReady(playerId!, msg.ready);
        if (out) {
          send(ws, out);
          broadcastToTable(out.table.id, out);
          const snapshot = lobbyHandlers.buildLobbySnapshot();
          wss.clients.forEach((client) => {
            if (client.readyState === 1) send(client, snapshot);
          });
        }
        break;
      }

      case "table_deck_select": {
        const out = lobbyHandlers.handleTableDeckSelect(playerId!, msg.deckId);
        if (out) {
          if (out.type === "error") {
            send(ws, out);
          } else {
            send(ws, out);
            broadcastToTable(out.table.id, out, playerId!);
            const snapshot = lobbyHandlers.buildLobbySnapshot();
            wss.clients.forEach((client) => {
              if (client.readyState === 1) send(client, snapshot);
            });
          }
        }
        break;
      }

      case "table_deck_select_custom": {
        const out = lobbyHandlers.handleTableDeckSelectCustom(playerId!, msg.cards);
        if (out) {
          if (out.type === "error") {
            send(ws, out);
          } else {
            send(ws, out);
            broadcastToTable(out.table.id, out, playerId!);
            const snapshot = lobbyHandlers.buildLobbySnapshot();
            wss.clients.forEach((client) => {
              if (client.readyState === 1) send(client, snapshot);
            });
          }
        }
        break;
      }

      case "start_bot_game": {
        const playerSide = msg.playerSide as Side | undefined;
        if (playerSide !== "light" && playerSide !== "dark") {
          send(ws, { type: "error", error: "Invalid player side" });
          break;
        }
        const botResult = lobbyHandlers.handleStartBotGame(
          playerId!,
          playerSide,
          (msg.playerDeckId as string) || "",
          msg.playerDeckCustom as { id: string; count: number }[] | undefined,
          (msg.botDeckId as string) || "",
          msg.botDeckCustom as { id: string; count: number }[] | undefined
        );
        if ("error" in botResult) {
          send(ws, { type: "error", error: botResult.error });
          break;
        }
        const table = lobby.getTableForBroadcast(botResult.tableId);
        if (!table?.lightPlayerId || !table.darkPlayerId) break;
        const gameId = "game_" + table.id;
        lobby.setTableGameId(table.id, gameId);
        const lightP = lobby.getPlayer(table.lightPlayerId);
        const darkP = lobby.getPlayer(table.darkPlayerId);
        const lightName = lightP?.name ?? (table.lightPlayerId === lobby.BOT_PLAYER_ID ? "R1-V4L" : "Light");
        const darkName = darkP?.name ?? (table.darkPlayerId === lobby.BOT_PLAYER_ID ? "R1-V4L" : "Dark");
        gameEngine.startGame(
          gameId,
          table.id,
          table.lightPlayerId,
          table.darkPlayerId,
          lightName,
          darkName,
          90_000,
          table.lightDeckId,
          table.darkDeckId,
          table.lightCustomCards,
          table.darkCustomCards
        );
        const g = gameEngine.getGame(gameId)!;
        const snapshot = gameState.toSnapshot(g);
        const phaseEndsAt = g.phaseStartedAt + g.phaseDurationMs;
        const startedMsg = {
          type: "game_started" as const,
          tableId: table.id,
          gameId,
          side: undefined as Side | undefined,
          state: { ...snapshot, phaseEndsAt },
        };
        const humanWs = lightP?.ws ?? darkP?.ws;
        if (humanWs) {
          const tableSummary = lobby.getTableSummary(table.id);
          if (tableSummary) send(humanWs, { type: "table_update", table: tableSummary });
          send(humanWs, { ...startedMsg, side: playerSide });
          send(humanWs, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, playerSide) });
        }
        const lobbySnapshot = lobbyHandlers.buildLobbySnapshot();
        wss.clients.forEach((client) => {
          if (client.readyState === 1) send(client, lobbySnapshot);
        });
        gameEngine.stopPhaseTimer(gameId);
        if (g.phase === "determine_first") {
          setTimeout(() => {
            const game = gameEngine.getGame(gameId);
            if (!game || game.phase !== "determine_first") return;
            gameState.runDestinyCompareRound(game);
            const snap = gameState.toSnapshot(game);
            broadcastToGame(gameId, { type: "game_state", gameId, state: snap });
            scheduleDestinyCompareResolve(gameId);
          }, GAME_START_DELAY_MS);
        } else if (!bot.isBotGame(g)) {
          gameEngine.startPhaseTimer(gameId, createPhaseTimerCallback(gameId));
        }
        break;
      }

      case "table_start": {
        const result = lobbyHandlers.handleTableStart(playerId!);
        if (!result.canStart) {
          send(ws, { type: "error", error: result.error || "Cannot start" });
          break;
        }
        const table = lobby.getTableForBroadcast(result.tableId!);
        if (!table?.lightPlayerId || !table.darkPlayerId) break;
        const gameId = "game_" + table.id;
        lobby.setTableGameId(table.id, gameId);
        const lightP = lobby.getPlayer(table.lightPlayerId);
        const darkP = lobby.getPlayer(table.darkPlayerId);
        gameEngine.startGame(
          gameId,
          table.id,
          table.lightPlayerId,
          table.darkPlayerId,
          lightP?.name ?? "Light",
          darkP?.name ?? "Dark",
          90_000,
          table.lightDeckId,
          table.darkDeckId,
          table.lightCustomCards,
          table.darkCustomCards
        );
        const g = gameEngine.getGame(gameId)!;
        const snapshot = gameState.toSnapshot(g);
        const phaseEndsAt = g.phaseStartedAt + g.phaseDurationMs;
        const startedMsg = {
          type: "game_started" as const,
          tableId: table.id,
          gameId,
          side: undefined as Side | undefined,
          state: { ...snapshot, phaseEndsAt },
        };
        if (lightP) {
          send(lightP.ws, { ...startedMsg, side: "light" as Side });
          send(lightP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, "light") });
        }
        if (darkP) {
          send(darkP.ws, { ...startedMsg, side: "dark" as Side });
          send(darkP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, "dark") });
        }
        const lobbySnapshot = lobbyHandlers.buildLobbySnapshot();
        wss.clients.forEach((client) => {
          if (client.readyState === 1) send(client, lobbySnapshot);
        });
        if (g.phase === "determine_first") {
          setTimeout(() => {
            const game = gameEngine.getGame(gameId);
            if (!game || game.phase !== "determine_first") return;
            gameState.runDestinyCompareRound(game);
            const snap = gameState.toSnapshot(game);
            broadcastToGame(gameId, { type: "game_state", gameId, state: snap });
            scheduleDestinyCompareResolve(gameId);
          }, GAME_START_DELAY_MS);
        } else {
          gameEngine.startPhaseTimer(gameId, createPhaseTimerCallback(gameId));
        }
        break;
      }

      case "game_chat": {
        const p = lobby.getPlayer(playerId!);
        const tableId = p?.tableId;
        const g = tableId ? gameEngine.getGameByTableId(tableId) : undefined;
        if (!g) break;
        const text = (msg.text || "").trim();
        if (!text) break;
        const name = p?.name ?? "?";
        const chatMsg = { type: "game_chat" as const, from: name, text, at: Date.now() };
        broadcastToGame(g.id, chatMsg);
        break;
      }

      case "game_action": {
        const p = lobby.getPlayer(playerId!);
        const tableId = p?.tableId;
        let g = tableId ? gameEngine.getGameByTableId(tableId) : undefined;
        if (!g) {
          send(ws, { type: "error", error: "Not in a game" });
          break;
        }
        const wasBattlePlanHuman = !!g.battlePlanPhase;
        const isBotGameHuman = bot.isBotGame(g);
        const botSideHuman = bot.getBotSide(g);
        if (isBotGameHuman && botSideHuman && msg.action.kind === "initiate_battle") {
          botMemory.captureBattleStart(g.id, g, botSideHuman);
        }
        if (isBotGameHuman && botSideHuman) {
          botMemory.recordBotTurn(g.id, g, botSideHuman, msg.action);
        }
        const result = gameHandlers.handleGameAction(g.id, playerId!, msg.action);
        if (!result.applied) {
          send(ws, { type: "error", error: result.error });
          break;
        }
        if (isBotGameHuman && wasBattlePlanHuman) {
          const gAfter = gameEngine.getGame(g.id);
          if (gAfter && !gAfter.battlePlanPhase) botMemory.captureBattleResult(g.id, gAfter);
        }
        if (result.gameOver) {
          gameEngine.stopPhaseTimer(g.id);
          g.phase = "game_over";
          g.lightReturnedToLobby = false;
          g.darkReturnedToLobby = false;
          const reason = result.gameOver.reason ?? "battle";
          broadcastToGame(g.id, { type: "game_ended", winner: result.gameOver.winner, reason });
          if (isBotGameHuman && botSideHuman) {
            botMemory.runPostGameAnalysis(g.id, g, botSideHuman, result.gameOver.winner as Side, reason);
          }
          removeTableAndBroadcastLobby(g.id);
          scheduleGameEndCleanup(g.id);
        } else {
          g = gameEngine.getGame(g.id);
          if (g) {
            broadcastToGame(g.id, { type: "game_state", gameId: g.id, state: gameState.toSnapshot(g) });
            if (g.battleRevealSequence) {
              g.battleRevealSequence = undefined;
            }
            const lightP = lobby.getPlayer(g.lightPlayerId);
            const darkP = lobby.getPlayer(g.darkPlayerId);
            if (lightP) send(lightP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, "light") });
            if (darkP) send(darkP.ws, { type: "game_hand", hand: gameState.getHandWithInstanceIds(g, "dark") });
            afterGameStateBroadcast(g.id);
            const startTimer = msg.action.kind === "choose_starting_location" || msg.action.kind === "choose_next_planet" || (msg.action.kind === "even_up" && g.phase === "choose_next_planet") || msg.action.kind === "dismiss_evacuation_result" || msg.action.kind === "initiate_battle" || msg.action.kind === "declare_battle_cards";
            if (startTimer && !bot.isBotGame(g)) {
              gameEngine.startPhaseTimer(g.id, createPhaseTimerCallback(g.id));
            }
          }
        }
        break;
      }

      case "game_concede": {
        const p = lobby.getPlayer(playerId!);
        const tableId = p?.tableId;
        const g = tableId ? gameEngine.getGameByTableId(tableId) : undefined;
        if (!g) break;
        applyConcedeAndBroadcast(g.id, playerId!, "concede");
        break;
      }

      case "return_to_lobby": {
        const p = lobby.getPlayer(playerId!);
        const tableId = p?.tableId;
        const gameIdParam = (msg as { gameId?: string }).gameId;
        const g = gameIdParam ? gameEngine.getGame(gameIdParam) : (tableId ? gameEngine.getGameByTableId(tableId) : undefined);
        if (!g || g.phase !== "game_over") break;
        if (g.lightPlayerId === playerId) g.lightReturnedToLobby = true;
        else if (g.darkPlayerId === playerId) g.darkReturnedToLobby = true;
        if (g.lightReturnedToLobby && g.darkReturnedToLobby) {
          clearGameEndCleanup(g.id);
          gameEngine.unregisterGame(g.id);
        }
        break;
      }

      default:
        send(ws, { type: "error", error: "Unknown message type" });
    }
  });

  ws.on("close", () => {
    security.clearIdleTimer(ws);
    security.unregisterConnection(ws);
    if (playerId) {
      const p = lobby.getPlayer(playerId);
      const tableId = p?.tableId;
      const g = tableId ? gameEngine.getGameByTableId(tableId) : undefined;
      if (g && g.phase !== "game_over") {
        applyConcedeAndBroadcast(g.id, playerId, "disconnect");
      }
      lobby.removePlayer(playerId);
      const snapshot = lobbyHandlers.buildLobbySnapshot();
      wss.clients.forEach((client) => {
        if (client.readyState === 1) send(client, snapshot);
      });
    }
  });
});

const pingInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.ping();
  });
}, WS_PING_MS);

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down (" + signal + ")...");
  clearInterval(pingInterval);
  wss.clients.forEach((client) => {
    try {
      client.close(1001, "server shutting down");
    } catch {
      // ignore
    }
  });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, HOST, () => {
  const wsProtocol = useTls ? "wss" : "ws";
  console.log("Young Jedi TCG server listening on", HOST + ":" + PORT, useTls ? "(TLS)" : "");
  console.log("WebSocket: " + wsProtocol + "://" + HOST + ":" + PORT);
  console.log("[visitors]", visitorStats.formatStatsLine());
  setInterval(() => {
    console.log("[visitors]", visitorStats.formatStatsLine());
  }, VISITOR_STATS_LOG_MS);
});
