/**
 * Lobby state: connected players and tables.
 * Single process, in-memory. No persistence.
 */

import type { Player, TableState, ChatEntry } from "../types";
import type { TableSummary, LobbyPlayer } from "../types";

const players = new Map<string, Player>();
const tables = new Map<string, TableState>();
const lobbyChat: ChatEntry[] = [];
const MAX_LOBBY_CHAT = 100;

let tableIdCounter = 0;

function nextTableId(): string {
  return "table_" + String(++tableIdCounter);
}

export function addPlayer(player: Player): void {
  players.set(player.id, player);
}

export function removePlayer(playerId: string): void {
  const p = players.get(playerId);
  if (p?.tableId) {
    const t = tables.get(p.tableId);
    if (t) leaveTable(playerId, t.id);
  }
  players.delete(playerId);
}

export function getPlayer(playerId: string): Player | undefined {
  return players.get(playerId);
}

export function getPlayerByName(name: string): Player | undefined {
  const lower = name.trim().toLowerCase();
  for (const p of players.values()) {
    if (p.name.toLowerCase() === lower) return p;
  }
  return undefined;
}

export function getLobbyPlayers(): LobbyPlayer[] {
  return Array.from(players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    tableId: p.tableId,
  }));
}

export function getTableSummaries(): TableSummary[] {
  return Array.from(tables.values()).map(tableToSummary);
}

const DEFAULT_LIGHT_DECK = "starter_deck";
const DEFAULT_DARK_DECK = "starter_dark_deck";

/** Id used for the bot player in bot games. Not added to players map. */
export const BOT_PLAYER_ID = "bot_1";

function tableToSummary(t: TableState): TableSummary {
  return {
    id: t.id,
    hostId: t.hostId,
    lightPlayerId: t.lightPlayerId,
    darkPlayerId: t.darkPlayerId,
    lightReady: t.lightReady,
    darkReady: t.darkReady,
    lightDeckId: t.lightDeckId ?? DEFAULT_LIGHT_DECK,
    darkDeckId: t.darkDeckId ?? DEFAULT_DARK_DECK,
    gameStarted: !!t.gameId,
  };
}

export function getLobbyChat(limit = 50): ChatEntry[] {
  const from = Math.max(0, lobbyChat.length - limit);
  return lobbyChat.slice(from);
}

export function addLobbyChat(from: string, text: string): ChatEntry {
  const entry: ChatEntry = { from, text, at: Date.now() };
  lobbyChat.push(entry);
  if (lobbyChat.length > MAX_LOBBY_CHAT) lobbyChat.shift();
  return entry;
}

// --- Tables ---

export function createTable(hostId: string, side: import("../types").Side): TableState | null {
  const host = players.get(hostId);
  if (!host || host.tableId) return null;

  const id = nextTableId();
  const table: TableState = {
    id,
    hostId,
    lightReady: false,
    darkReady: false,
    chat: [],
  };
  if (side === "light") {
    table.lightPlayerId = hostId;
    table.lightDeckId = DEFAULT_LIGHT_DECK;
  } else {
    table.darkPlayerId = hostId;
    table.darkDeckId = DEFAULT_DARK_DECK;
  }
  tables.set(id, table);
  host.tableId = id;
  host.side = side;
  return table;
}

export function joinTable(playerId: string, tableId: string, side: import("../types").Side): TableState | null {
  const player = players.get(playerId);
  const table = tables.get(tableId);
  if (!player || !table || player.tableId) return null;
  if (side === "light" && table.lightPlayerId) return null;
  if (side === "dark" && table.darkPlayerId) return null;

  if (side === "light") {
    table.lightPlayerId = playerId;
    table.lightReady = false;
    table.lightDeckId = table.lightDeckId ?? DEFAULT_LIGHT_DECK;
  } else {
    table.darkPlayerId = playerId;
    table.darkReady = false;
    table.darkDeckId = table.darkDeckId ?? DEFAULT_DARK_DECK;
  }
  player.tableId = tableId;
  player.side = side;
  return table;
}

export function leaveTable(playerId: string, tableId?: string): TableState | null {
  const player = players.get(playerId);
  const tid = tableId ?? player?.tableId;
  const table = tid ? tables.get(tid) : undefined;
  if (!table) return null;

  const wasHost = table.hostId === playerId;
  if (table.lightPlayerId === playerId) {
    table.lightPlayerId = undefined;
    table.lightReady = false;
  }
  if (table.darkPlayerId === playerId) {
    table.darkPlayerId = undefined;
    table.darkReady = false;
  }
  if (player) {
    player.tableId = undefined;
    player.side = undefined;
  }

  if (wasHost) {
    // When host leaves, disband the table so everyone goes back to lobby (don't promote the other player).
    const otherId = table.lightPlayerId ?? table.darkPlayerId;
    if (otherId) {
      const other = players.get(otherId);
      if (other) {
        other.tableId = undefined;
        other.side = undefined;
      }
    }
    tables.delete(table.id);
    return null;
  }
  return table;
}

export function setReady(playerId: string, ready: boolean): TableState | null {
  const player = players.get(playerId);
  const table = player?.tableId ? tables.get(player.tableId) : undefined;
  if (!table) return null;
  if (table.lightPlayerId === playerId) table.lightReady = ready;
  else if (table.darkPlayerId === playerId) table.darkReady = ready;
  else return null;
  return table;
}

export function setDeck(playerId: string, deckId: string): TableState | null {
  const player = players.get(playerId);
  const table = player?.tableId ? tables.get(player.tableId) : undefined;
  if (!player || !table) return null;
  if (table.lightPlayerId === playerId) table.lightDeckId = deckId;
  else if (table.darkPlayerId === playerId) table.darkDeckId = deckId;
  else return null;
  return table;
}

export function setCustomDeck(playerId: string, cards: { id: string; set?: string; count: number }[]): TableState | null {
  const player = players.get(playerId);
  const table = player?.tableId ? tables.get(player.tableId) : undefined;
  if (!player || !table) return null;
  if (table.lightPlayerId === playerId) {
    table.lightDeckId = "custom";
    table.lightCustomCards = cards;
  } else if (table.darkPlayerId === playerId) {
    table.darkDeckId = "custom";
    table.darkCustomCards = cards;
  } else {
    return null;
  }
  return table;
}

export function getTable(tableId: string): TableState | undefined {
  return tables.get(tableId);
}

export function setTableGameId(tableId: string, gameId: string): void {
  const t = tables.get(tableId);
  if (t) t.gameId = gameId;
}

/** Remove table from lobby when its game has ended (so it no longer appears in Playing tables). Clears tableId for players in that table. */
export function removeTableWhenGameEnds(tableId: string): void {
  const table = tables.get(tableId);
  if (!table) return;
  const lightId = table.lightPlayerId;
  const darkId = table.darkPlayerId;
  if (lightId) {
    const p = players.get(lightId);
    if (p) {
      p.tableId = undefined;
      p.side = undefined;
    }
  }
  if (darkId) {
    const p = players.get(darkId);
    if (p) {
      p.tableId = undefined;
      p.side = undefined;
    }
  }
  tables.delete(tableId);
}

export function getTableSummary(tableId: string): TableSummary | undefined {
  const t = tables.get(tableId);
  return t ? tableToSummary(t) : undefined;
}

export function getTableForBroadcast(tableId: string): TableState | undefined {
  return tables.get(tableId);
}

export function getPlayersInTable(tableId: string): Player[] {
  const table = tables.get(tableId);
  if (!table) return [];
  const out: Player[] = [];
  if (table.lightPlayerId && table.lightPlayerId !== BOT_PLAYER_ID) {
    const p = players.get(table.lightPlayerId);
    if (p) out.push(p);
  }
  if (table.darkPlayerId && table.darkPlayerId !== BOT_PLAYER_ID) {
    const p = players.get(table.darkPlayerId);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Create a table for a bot game: one human on playerSide, bot on the other.
 * Does not add the bot to players. Returns the table or null.
 */
export function createBotTable(
  hostId: string,
  playerSide: import("../types").Side,
  playerDeckId: string,
  playerCustomCards: { id: string; set?: string; count: number }[] | undefined,
  botDeckId: string,
  botCustomCards: { id: string; set?: string; count: number }[] | undefined
): TableState | null {
  const host = players.get(hostId);
  if (!host || host.tableId) return null;

  const id = nextTableId();
  const table: TableState = {
    id,
    hostId,
    lightReady: true,
    darkReady: true,
    chat: [],
  };
  if (playerSide === "light") {
    table.lightPlayerId = hostId;
    table.darkPlayerId = BOT_PLAYER_ID;
    table.lightDeckId = playerDeckId;
    table.lightCustomCards = playerCustomCards;
    table.darkDeckId = botDeckId;
    table.darkCustomCards = botCustomCards;
  } else {
    table.lightPlayerId = BOT_PLAYER_ID;
    table.darkPlayerId = hostId;
    table.lightDeckId = botDeckId;
    table.lightCustomCards = botCustomCards;
    table.darkDeckId = playerDeckId;
    table.darkCustomCards = playerCustomCards;
  }
  tables.set(id, table);
  host.tableId = id;
  host.side = playerSide;
  return table;
}
