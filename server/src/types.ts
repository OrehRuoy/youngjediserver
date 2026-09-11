/**
 * Shared types for Young Jedi TCG server.
 * All client↔server messages are JSON with a `type` field.
 */

// --- Sides (game constraint) ---
export type Side = "light" | "dark";

// --- Client → Server message types ---
export type ClientMessage =
  | { type: "login"; name: string }
  | { type: "lobby_chat"; text: string }
  | { type: "table_create"; side: Side }
  | { type: "table_join"; tableId: string; side: Side }
  | { type: "table_leave" }
  | { type: "table_ready"; ready: boolean }
  | { type: "table_deck_select"; deckId: string }
  | { type: "table_deck_select_custom"; name: string; cards: { id: string; set?: string; count: number }[] }
  | { type: "table_start" }  // host only, when all ready
  | { type: "start_bot_game"; playerSide: Side; playerDeckId?: string; playerDeckCustom?: { id: string; count: number }[]; botDeckId?: string; botDeckCustom?: { id: string; count: number }[] }
  | { type: "game_chat"; text: string }
  | { type: "game_action"; action: GameAction }
  | { type: "game_concede" }
  | { type: "return_to_lobby"; gameId?: string }
  | { type: "heartbeat" };

// Placeholder for expandable in-game actions (play card, attack, etc.)
export interface GameAction {
  kind: string;
  [key: string]: unknown;
}

// --- Server → Client message types ---
export interface ServerMessageBase {
  type: string;
  error?: string;
}

export interface LoginResult extends ServerMessageBase {
  type: "login_result";
  ok: boolean;
  playerId?: string;
  name?: string;
}

export interface LobbySnapshot extends ServerMessageBase {
  type: "lobby_snapshot";
  players: LobbyPlayer[];
  tables: TableSummary[];
  chat?: ChatEntry[];
  /** News text for the lobby (plain or BBCode). Loaded from server data/news.json. */
  news?: string;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  tableId?: string;  // if in a table
}

export interface TableSummary {
  id: string;
  hostId: string;
  lightPlayerId?: string;
  darkPlayerId?: string;
  lightReady: boolean;
  darkReady: boolean;
  lightDeckId?: string;
  darkDeckId?: string;
  gameStarted: boolean;
}

export interface ChatEntry {
  from: string;   // player name or "system"
  text: string;
  at: number;
}

export interface TableUpdate extends ServerMessageBase {
  type: "table_update";
  table: TableSummary;
  chat?: ChatEntry[];
}

export interface GameStarted extends ServerMessageBase {
  type: "game_started";
  tableId: string;
  gameId: string;
  side: Side;
  state: GameStateSnapshot;
}

export interface GameStateUpdate extends ServerMessageBase {
  type: "game_state";
  gameId: string;
  state: GameStateSnapshot;
}

export interface GameStateSnapshot {
  phase: string;
  turnSide: Side;
  turnNumber: number;
  phaseEndsAt?: number;  // timestamp when phase timer ends
  light: PlayerGameView;
  dark: PlayerGameView;
  publicState?: Record<string, unknown>;  // board, etc.
}

export interface PlayerGameView {
  playerId: string;
  name: string;
  handCount: number;
  deckCount: number;
  discardCount: number;
  /** Card ID of the top (last discarded) card for face-up discard display. */
  topDiscardCardId?: string;
  life?: number;
  /** Force (counters) remaining this deploy turn. */
  force?: number;
  // Client receives only counts/censored data; full hand in own view only
}

export type ServerMessage =
  | LoginResult
  | LobbySnapshot
  | { type: "lobby_chat"; from: string; text: string; at: number }
  | TableUpdate
  | GameStarted
  | GameStateUpdate
  | { type: "game_chat"; from: string; text: string; at: number }
  | { type: "game_ended"; winner?: Side; reason?: string }
  | { type: "error"; error: string };

// --- Internal server state (not sent verbatim) ---
export interface Player {
  id: string;
  name: string;
  ws: import("ws").WebSocket;
  tableId?: string;
  side?: Side;
  lastPingAt: number;
}

export interface TableState {
  id: string;
  hostId: string;
  lightPlayerId?: string;
  darkPlayerId?: string;
  lightReady: boolean;
  darkReady: boolean;
  lightDeckId?: string;
  darkDeckId?: string;
  lightCustomCards?: { id: string; set?: string; count: number }[];
  darkCustomCards?: { id: string; set?: string; count: number }[];
  gameId?: string;
  chat: ChatEntry[];
}
