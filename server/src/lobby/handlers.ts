/**
 * Lobby message handlers: login, lobby chat, table create/join/leave/ready/start.
 * Handlers receive parsed ClientMessage and return ServerMessage(s) to send (or null).
 */

import fs from "fs";
import path from "path";
import type { WebSocket } from "ws";
import type { ClientMessage, Side } from "../types";
import * as lobby from "./lobby";
import { getTableSummaries, getLobbyPlayers, getLobbyChat, addLobbyChat } from "./lobby";
import { createTable, joinTable, leaveTable, setReady, setDeck, setCustomDeck, getTableForBroadcast, getPlayersInTable, getTableSummary, createBotTable, parseCoverCard } from "./lobby";
import { getDecksForSide, getDeck } from "../cards/loader";

const PLAYER_ID_PREFIX = "p_";
let playerIdCounter = 0;

function nextPlayerId(): string {
  return PLAYER_ID_PREFIX + String(++playerIdCounter);
}

export function handleLogin(ws: WebSocket, name: string): { type: "login_result"; ok: boolean; playerId?: string; name?: string; error?: string } {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return { type: "login_result", ok: false, error: "Name required" };
  }
  const existing = lobby.getPlayerByName(trimmed);
  if (existing && existing.ws !== ws) {
    return { type: "login_result", ok: false, error: "That username is already taken." };
  }
  const playerId = nextPlayerId();
  const player: import("../types").Player = {
    id: playerId,
    name: trimmed,
    ws,
    lastPingAt: Date.now(),
  };
  lobby.addPlayer(player);
  return { type: "login_result", ok: true, playerId, name: trimmed };
}

export function handleLobbyChat(playerId: string, text: string): { type: "lobby_chat"; from: string; text: string; at: number } | null {
  const player = lobby.getPlayer(playerId);
  if (!player) return null;
  const t = (text || "").trim();
  if (!t) return null;
  const entry = addLobbyChat(player.name, t);
  return { type: "lobby_chat", from: entry.from, text: entry.text, at: entry.at };
}

export function handleTableCreate(playerId: string, side: Side): { type: "table_update"; table: import("../types").TableSummary } | { type: "error"; error: string } | null {
  const table = createTable(playerId, side);
  if (!table) return { type: "error", error: "Could not create table" };
  return { type: "table_update", table: getTableSummary(table.id)! };
}

export function handleTableJoin(playerId: string, tableId: string, side: Side): { type: "table_update"; table: import("../types").TableSummary } | { type: "error"; error: string } | null {
  const table = joinTable(playerId, tableId, side);
  if (!table) return { type: "error", error: "Could not join table" };
  return { type: "table_update", table: getTableSummary(table.id)! };
}

export function handleTableLeave(playerId: string): { type: "table_update"; table?: import("../types").TableSummary } | { type: "lobby_snapshot"; players: import("../types").LobbyPlayer[]; tables: import("../types").TableSummary[] } | null {
  const player = lobby.getPlayer(playerId);
  const table = leaveTable(playerId, player?.tableId);
  if (!player) return null;
  if (table) {
    const others = getPlayersInTable(table.id);
    return { type: "table_update", table: getTableSummary(table.id) };
  }
  return {
    type: "lobby_snapshot",
    players: getLobbyPlayers(),
    tables: getTableSummaries(),
  };
}

export function handleTableReady(playerId: string, ready: boolean): { type: "table_update"; table: import("../types").TableSummary } | null {
  const table = setReady(playerId, ready);
  if (!table) return null;
  return { type: "table_update", table: getTableSummary(table.id)! };
}

export function handleTableDeckSelect(playerId: string, deckId: string): { type: "table_update"; table: import("../types").TableSummary } | { type: "error"; error: string } | null {
  const player = lobby.getPlayer(playerId);
  const table = player?.tableId ? lobby.getTableForBroadcast(player.tableId) : undefined;
  if (!player || !table) return null;
  const side = player.side;
  if (!side) return null;
  const deck = getDeck(deckId);
  if (!deck) return { type: "error", error: "Unknown deck" };
  if (deck.side !== side) return { type: "error", error: "Deck must match your side (light/dark)" };
  const t = setDeck(playerId, deckId);
  if (!t) return null;
  return { type: "table_update", table: getTableSummary(t.id)! };
}

export function handleTableDeckSelectCustom(
  playerId: string,
  cards: { id: string; set?: string; count: number }[],
  coverCardRaw?: unknown
): { type: "table_update"; table: import("../types").TableSummary } | { type: "error"; error: string } | null {
  const player = lobby.getPlayer(playerId);
  if (!player || !player.tableId) return null;
  if (!cards || !Array.isArray(cards) || cards.length === 0) return { type: "error", error: "No cards in custom deck" };
  const t = setCustomDeck(playerId, cards, parseCoverCard(coverCardRaw));
  if (!t) return null;
  return { type: "table_update", table: getTableSummary(t.id)! };
}

/**
 * Start a bot game: create a table with human on playerSide and bot on the other, return table for game start.
 * Resolves "random" deck to a random deck from that side.
 */
export function handleStartBotGame(
  playerId: string,
  playerSide: Side,
  playerDeckId: string,
  playerDeckCustom: { id: string; set?: string; count: number }[] | undefined,
  botDeckId: string,
  botDeckCustom: { id: string; set?: string; count: number }[] | undefined
): { tableId: string; table: import("../types").TableSummary } | { error: string } {
  const player = lobby.getPlayer(playerId);
  if (!player) return { error: "Not logged in" };
  if (player.tableId) return { error: "Already at a table" };

  const botSide: Side = playerSide === "light" ? "dark" : "light";

  function resolveDeck(side: Side, deckId: string, custom: { id: string; set?: string; count: number }[] | undefined): { deckId: string; custom?: { id: string; set?: string; count: number }[] } {
    if (custom && custom.length > 0) return { deckId: "custom", custom };
    if (deckId === "random") {
      const decks = getDecksForSide(side);
      if (decks.length === 0) return { deckId: side === "light" ? "starter_deck" : "starter_dark_deck" };
      const d = decks[Math.floor(Math.random() * decks.length)];
      return { deckId: d.id };
    }
    const deck = getDeck(deckId);
    if (!deck || deck.side !== side) return { deckId: side === "light" ? "starter_deck" : "starter_dark_deck" };
    return { deckId };
  }

  const playerRes = resolveDeck(playerSide, playerDeckId || "starter_deck", playerDeckCustom);
  const botRes = resolveDeck(botSide, botDeckId || (botSide === "light" ? "starter_deck" : "starter_dark_deck"), botDeckCustom);

  const table = createBotTable(
    playerId,
    playerSide,
    playerRes.deckId,
    playerRes.custom,
    botRes.deckId,
    botRes.custom
  );
  if (!table) return { error: "Could not create bot game" };

  const summary = getTableSummary(table.id);
  if (!summary) return { error: "Could not get table summary" };
  return { tableId: table.id, table: summary };
}

/** Caller must start game and broadcast game_started to both players. */
export function handleTableStart(playerId: string): { canStart: boolean; tableId?: string; error?: string } {
  const player = lobby.getPlayer(playerId);
  const table = player?.tableId ? getTableForBroadcast(player.tableId) : undefined;
  if (!table) return { canStart: false, error: "Not at a table" };
  if (table.hostId !== playerId) return { canStart: false, error: "Only host can start" };
  if (!table.lightPlayerId || !table.darkPlayerId) return { canStart: false, error: "Need both sides" };
  if (!table.lightReady || !table.darkReady) return { canStart: false, error: "Both players must be ready" };
  if (table.gameId) return { canStart: false, error: "Game already started" };
  return { canStart: true, tableId: table.id };
}

const NEWS_PATH = path.join(__dirname, "..", "..", "data", "news.json");

function loadNews(): string {
  try {
    const raw = fs.readFileSync(NEWS_PATH, "utf-8");
    const data = JSON.parse(raw) as { text?: string };
    return typeof data.text === "string" ? data.text : "";
  } catch {
    return "";
  }
}

/** Build full lobby snapshot for a client (e.g. after login or leave table). */
export function buildLobbySnapshot(): { type: "lobby_snapshot"; players: import("../types").LobbyPlayer[]; tables: import("../types").TableSummary[]; chat?: import("../types").ChatEntry[]; news?: string } {
  return {
    type: "lobby_snapshot",
    players: getLobbyPlayers(),
    tables: getTableSummaries(),
    chat: getLobbyChat(),
    news: loadNews(),
  };
}
