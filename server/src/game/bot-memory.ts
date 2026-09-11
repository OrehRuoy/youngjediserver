/**
 * Bot learning system — persistent memory that improves the AI across games.
 *
 * Four memory types:
 *   1. Battle records   – power ratios, weapons, character counts, outcomes
 *   2. Game records     – overall win/loss, planets, turn count
 *   3. Pattern records  – win/loss tallies with EMA for tagged situations
 *   4. Replay buffer    – individual turn experiences with rewards, sampled for learning
 *
 * All data lives in a single JSON file loaded once at startup.
 * Writes happen only at game end so gameplay is never slowed.
 *
 * Who writes: Only the "learning" agent should trigger writes. In headless training that is
 * the variant; the server bot is the only agent and thus the only writer in live games.
 * Call recordBotTurn, captureBattleStart, recordStartingLocationChoice, recordNextPlanetChoice,
 * and runPostGameAnalysis only for that agent's turns/game outcome so replay and patterns
 * stay consistent.
 */

import * as fs from "fs";
import * as path from "path";
import type { Side } from "../types";
import type { GameStateData } from "./state";
import * as state from "./state";
import { getCard } from "../cards/loader";

const MEMORY_PATH = path.join(__dirname, "..", "..", "data", "bot-memory.json");
const MAX_BATTLES = 2000;
const MAX_GAMES = 1000;
/** EMA blending factor: higher = faster adaptation to recent outcomes, lower = more stable. */
const EMA_ALPHA = 0.1;
/** Min samples before EMA is preferred over raw win rate. */
const EMA_MIN_SAMPLES = 10;
const MAX_REPLAY_BUFFER = 5000;
const REPLAY_BATCH_SIZE = 128;

/** Reward magnitudes for experience replay. Winning the game is weighted highest. */
export const REWARDS = {
  GAME_WIN: 15,
  GAME_LOSS: -15,
  PLANET_WON: 5,
  PLANET_LOST: -3,
  OPP_CHAR_KO: 3,
  MY_CHAR_KO: -2,
  EVACUATE: 2,
  PLAY_CARD: 0.5,
  SURRENDER_PLANET: -1,
} as const;

// ─── Types ───────────────────────────────────────────────

export interface BattleRecord {
  planet: string;
  powerRatio: number;
  myCharCount: number;
  oppCharCount: number;
  hadWeapons: boolean;
  hadBattleCards: boolean;
  botInitiated: boolean;
  result: "win" | "loss";
  turnNumber: number;
  timestamp: number;
}

export interface GameRecord {
  botSide: Side;
  won: boolean;
  turnCount: number;
  planetsWon: number;
  planetsLost: number;
  reason: string;
  timestamp: number;
}

export interface PatternRecord {
  key: string;
  wins: number;
  losses: number;
  /** Exponential moving average win rate — weights recent outcomes more heavily. */
  emaRate: number;
  lastUpdated: number;
}

export interface TurnExperience {
  gameId: string;
  turnNumber: number;
  side: Side;
  phase: string;
  actionKind: string;
  powerRatio: number;
  myCharCount: number;
  oppCharCount: number;
  handSize: number;
  deckSize: number;
  force: number;
  cardId?: string;
  reward: number;
  timestamp: number;
}

interface MemoryStore {
  battles: BattleRecord[];
  games: GameRecord[];
  patterns: PatternRecord[];
  replayBuffer: TurnExperience[];
}

// ─── In-memory state ─────────────────────────────────────

let store: MemoryStore = { battles: [], games: [], patterns: [], replayBuffer: [] };
let loaded = false;

interface PreBattleSnapshot {
  planet: string;
  myPower: number;
  oppPower: number;
  myCharCount: number;
  oppCharCount: number;
  hadWeapons: boolean;
  hadBattleCards: boolean;
  botInitiated: boolean;
  turnNumber: number;
  botSide: Side;
  myCharInstanceIds: string[];
  /** Card IDs of battle cards the bot declared this battle (for per-card battle win rate). */
  declaredBattleCardIds: string[];
}

const preBattleSnapshots = new Map<string, PreBattleSnapshot>();

/** Turns recorded during a game, flushed to replay buffer at game end (variant only in headless). */
const pendingTurns = new Map<string, TurnExperience[]>();

/** Per-game meta for the learning agent: location choices to tag with game outcome. */
interface PendingGameMeta {
  startingLocationCardId?: string;
  nextPlanetCardIds: string[];
}
const pendingGameMeta = new Map<string, PendingGameMeta>();

// ─── Load / Save ─────────────────────────────────────────

export function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      const raw = fs.readFileSync(MEMORY_PATH, "utf-8");
      const data = JSON.parse(raw);
      const patterns: PatternRecord[] = Array.isArray(data.patterns)
        ? data.patterns.map((p: Record<string, unknown>) => {
            const wins = typeof p.wins === "number" ? p.wins : 0;
            const losses = typeof p.losses === "number" ? p.losses : 0;
            const total = wins + losses;
            return {
              key: p.key as string,
              wins,
              losses,
              emaRate: typeof p.emaRate === "number" ? p.emaRate : (total > 0 ? wins / total : 0.5),
              lastUpdated: typeof p.lastUpdated === "number" ? p.lastUpdated : Date.now(),
            };
          })
        : [];
      store = {
        battles: Array.isArray(data.battles) ? data.battles.slice(-MAX_BATTLES) : [],
        games: Array.isArray(data.games) ? data.games.slice(-MAX_GAMES) : [],
        patterns,
        replayBuffer: Array.isArray(data.replayBuffer) ? data.replayBuffer.slice(-MAX_REPLAY_BUFFER) : [],
      };
    }
  } catch {
    store = { battles: [], games: [], patterns: [], replayBuffer: [] };
  }
}

function save(): void {
  try {
    store.battles = store.battles.slice(-MAX_BATTLES);
    store.games = store.games.slice(-MAX_GAMES);
    store.replayBuffer = store.replayBuffer.slice(-MAX_REPLAY_BUFFER);
    const dir = path.dirname(MEMORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // non-critical
  }
}

// ─── Battle capture ──────────────────────────────────────

export function captureBattleStart(gameId: string, g: GameStateData, botSide: Side): void {
  const oppSide: Side = botSide === "light" ? "dark" : "light";
  const loc = state.getCurrentLocationCard(g);
  const planet = loc ? state.getLocationPlanet(loc.card.cardId) ?? "" : "";
  const myPower = state.totalPowerInPlay(g, botSide);
  const oppPower = state.totalPowerInPlay(g, oppSide);
  const myChars = state.getCharactersAtLocation(g, botSide, true);
  const oppChars = state.getCharactersAtLocation(g, oppSide, true);

  const myCharOnly = myChars.filter((c) => {
    const def = getCard(c.cardId);
    return def && (def as { type?: string }).type === "character";
  });
  const oppCharOnly = oppChars.filter((c) => {
    const def = getCard(c.cardId);
    return def && (def as { type?: string }).type === "character";
  });

  const hadWeapons = myChars.some((ch) => {
    const chDef = getCard(ch.cardId);
    if (!chDef || (chDef as { type?: string }).type !== "character") return false;
    return myChars.some((w) => {
      const wDef = getCard(w.cardId);
      return wDef && (wDef as { type?: string }).type === "weapon";
    });
  });

  const p = botSide === "light" ? g.light : g.dark;
  const hadBattleCards = p.hand.some((c) => {
    const def = getCard(c.cardId);
    return def && (def as { type?: string }).type === "battle";
  });

  const declaredInstanceIds = (botSide === "light" ? g.lightDeclaredBattleCards : g.darkDeclaredBattleCards) ?? [];
  const declaredBattleCardIds: string[] = [];
  for (const instId of declaredInstanceIds) {
    const inHand = p.hand.find((c) => c.instanceId === instId);
    if (inHand) declaredBattleCardIds.push(inHand.cardId);
  }

  preBattleSnapshots.set(gameId, {
    planet,
    myPower,
    oppPower,
    myCharCount: myCharOnly.length,
    oppCharCount: oppCharOnly.length,
    hadWeapons,
    hadBattleCards,
    botInitiated: g.turnSide === botSide,
    turnNumber: g.turnNumber,
    botSide,
    myCharInstanceIds: myCharOnly.map((c) => c.instanceId),
    declaredBattleCardIds,
  });
}

export function captureBattleResult(gameId: string, g: GameStateData): void {
  const snap = preBattleSnapshots.get(gameId);
  if (!snap) return;
  preBattleSnapshots.delete(gameId);

  const botCharsNow = state.getCharactersAtLocation(g, snap.botSide, true);
  const botCharNowIds = new Set(botCharsNow.map((c) => c.instanceId));
  const survivorCount = snap.myCharInstanceIds.filter((id) => botCharNowIds.has(id)).length;
  const result: "win" | "loss" = survivorCount > 0 ? "win" : "loss";

  const ratio = snap.oppPower > 0 ? snap.myPower / snap.oppPower : 2.0;

  const record: BattleRecord = {
    planet: snap.planet,
    powerRatio: Math.round(ratio * 100) / 100,
    myCharCount: snap.myCharCount,
    oppCharCount: snap.oppCharCount,
    hadWeapons: snap.hadWeapons,
    hadBattleCards: snap.hadBattleCards,
    botInitiated: snap.botInitiated,
    result,
    turnNumber: snap.turnNumber,
    timestamp: Date.now(),
  };

  store.battles.push(record);

  updatePattern(snap.hadWeapons ? "battle_with_weapons" : "battle_without_weapons", result === "win");
  updatePattern(snap.botInitiated ? "battle_bot_initiated" : "battle_human_initiated", result === "win");
  if (snap.myCharCount > snap.oppCharCount) updatePattern("battle_more_chars", result === "win");
  if (snap.myCharCount < snap.oppCharCount) updatePattern("battle_fewer_chars", result === "win");
  if (snap.myCharCount === snap.oppCharCount) updatePattern("battle_equal_chars", result === "win");
  if (snap.turnNumber <= 3) updatePattern("early_battle", result === "win");
  else updatePattern("late_battle", result === "win");
  if (snap.hadBattleCards) updatePattern("battle_with_battle_cards", result === "win");
  else updatePattern("battle_no_battle_cards", result === "win");
  for (const cardId of snap.declaredBattleCardIds ?? []) {
    updatePattern("battle_card_used:" + cardId, result === "win");
  }

  // Replay rewards: character KOs
  const oppSide: Side = snap.botSide === "light" ? "dark" : "light";
  const oppCharsAfter = state.getCharactersAtLocation(g, oppSide, true).filter((c) => {
    const def = getCard(c.cardId);
    return def && (def as { type?: string }).type === "character";
  });
  const oppKOd = Math.max(0, snap.oppCharCount - oppCharsAfter.length);
  const myKOd = Math.max(0, snap.myCharCount - survivorCount);
  for (let i = 0; i < oppKOd; i++) addEventReward(gameId, snap.botSide, "OPP_CHAR_KO");
  for (let i = 0; i < myKOd; i++) addEventReward(gameId, snap.botSide, "MY_CHAR_KO");
}

// ─── Pattern helpers ─────────────────────────────────────

function updatePattern(key: string, won: boolean): void {
  let p = store.patterns.find((r) => r.key === key);
  if (!p) {
    p = { key, wins: 0, losses: 0, emaRate: 0.5, lastUpdated: Date.now() };
    store.patterns.push(p);
  }
  if (won) p.wins++;
  else p.losses++;
  p.emaRate = (1 - EMA_ALPHA) * p.emaRate + EMA_ALPHA * (won ? 1 : 0);
  p.lastUpdated = Date.now();
}

function getPatternWinRateInternal(key: string): { rate: number; samples: number } {
  const p = store.patterns.find((r) => r.key === key);
  if (!p) return { rate: 0.5, samples: 0 };
  const total = p.wins + p.losses;
  if (total < EMA_MIN_SAMPLES) {
    return { rate: total > 0 ? p.wins / total : 0.5, samples: total };
  }
  return { rate: p.emaRate, samples: total };
}

/** Win rate when this card was in play at game end (deploy decisions). Returns 0.5 if no data. */
export function getCardPlayWinRate(cardId: string): { rate: number; samples: number } {
  ensureLoaded();
  return getPatternWinRateInternal("card_play:" + cardId);
}

/** Win rate when this battle card was declared in a battle. Returns 0.5 if no data. */
export function getBattleCardWinRate(cardId: string): { rate: number; samples: number } {
  ensureLoaded();
  return getPatternWinRateInternal("battle_card_used:" + cardId);
}

/** Win rate for an arbitrary pattern key (even-up decisions, location choices). Returns 0.5 if no data. */
export function getPatternWinRate(key: string): { rate: number; samples: number } {
  ensureLoaded();
  return getPatternWinRateInternal(key);
}

/** Record that the learning agent chose this location as starting. Call only for the agent that writes memory. */
export function recordStartingLocationChoice(gameId: string, locationCardId: string): void {
  let meta = pendingGameMeta.get(gameId);
  if (!meta) {
    meta = { nextPlanetCardIds: [] };
    pendingGameMeta.set(gameId, meta);
  }
  meta.startingLocationCardId = locationCardId;
}

/** Record that the learning agent chose this location for next planet. Call only for the agent that writes memory. */
export function recordNextPlanetChoice(gameId: string, locationCardId: string): void {
  let meta = pendingGameMeta.get(gameId);
  if (!meta) {
    meta = { nextPlanetCardIds: [] };
    pendingGameMeta.set(gameId, meta);
  }
  meta.nextPlanetCardIds.push(locationCardId);
}

// ─── Experience Replay ───────────────────────────────────

/**
 * Record a bot turn for replay learning. Call before applying the action.
 * Call only for the learning agent (e.g. variant in headless) so only its turns are stored.
 */
export function recordBotTurn(
  gameId: string,
  g: GameStateData,
  botSide: Side,
  action: { kind: string; [key: string]: unknown }
): void {
  ensureLoaded();
  const oppSide: Side = botSide === "light" ? "dark" : "light";
  const p = botSide === "light" ? g.light : g.dark;
  const myPower = state.totalPowerInPlay(g, botSide);
  const oppPower = state.totalPowerInPlay(g, oppSide);
  const myChars = state.getCharactersAtLocation(g, botSide, true).filter((c) => {
    const def = getCard(c.cardId);
    return def && (def as { type?: string }).type === "character";
  });
  const oppChars = state.getCharactersAtLocation(g, oppSide, true).filter((c) => {
    const def = getCard(c.cardId);
    return def && (def as { type?: string }).type === "character";
  });

  let immediateReward = 0;
  if (action.kind === "play_card") immediateReward = REWARDS.PLAY_CARD;
  else if (action.kind === "evacuate_start") immediateReward = REWARDS.EVACUATE;
  else if (action.kind === "surrender_planet") immediateReward = REWARDS.SURRENDER_PLANET;

  let cardId: string | undefined;
  if (action.instanceId) {
    const card = p.hand.find((c) => c.instanceId === action.instanceId);
    if (card) cardId = card.cardId;
  }

  const turn: TurnExperience = {
    gameId,
    turnNumber: g.turnNumber,
    side: botSide,
    phase: g.phase,
    actionKind: action.kind,
    powerRatio: oppPower > 0 ? Math.round((myPower / oppPower) * 100) / 100 : 2.0,
    myCharCount: myChars.length,
    oppCharCount: oppChars.length,
    handSize: p.hand.length,
    deckSize: p.deck.length,
    force: state.getForce(g, botSide),
    cardId,
    reward: immediateReward,
    timestamp: Date.now(),
  };

  if (!pendingTurns.has(gameId)) pendingTurns.set(gameId, []);
  pendingTurns.get(gameId)!.push(turn);
}

/**
 * Add reward to the most recent pending turn for a given game and side.
 * Used for deferred events like character KOs during battle resolution.
 */
export function addEventReward(gameId: string, botSide: Side, rewardType: keyof typeof REWARDS): void {
  const turns = pendingTurns.get(gameId);
  if (!turns || turns.length === 0) return;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].side === botSide) {
      turns[i].reward += REWARDS[rewardType];
      return;
    }
  }
}

/** Sample a random batch from the replay buffer (Fisher-Yates partial shuffle). */
function sampleReplayBatch(size: number): TurnExperience[] {
  if (store.replayBuffer.length <= size) return [...store.replayBuffer];
  const indices = Array.from({ length: store.replayBuffer.length }, (_, i) => i);
  for (let i = indices.length - 1; i > indices.length - 1 - size && i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(-size).map((i) => store.replayBuffer[i]);
}

/**
 * Sample a batch of random turns from the replay buffer and use their
 * rewards to update pattern win rates. This feeds the same patterns the
 * bot already reads (card_play, battle_card_used, battle situation tags),
 * amplifying recent reward signals via the EMA.
 */
export function learnFromReplayBatch(): void {
  ensureLoaded();
  if (store.replayBuffer.length < REPLAY_BATCH_SIZE) return;

  const batch = sampleReplayBatch(REPLAY_BATCH_SIZE);

  for (const turn of batch) {
    const won = turn.reward > 0;

    updatePattern("action:" + turn.actionKind, won);

    if (turn.cardId && turn.actionKind === "play_card") {
      updatePattern("card_play:" + turn.cardId, won);
    }

    if (turn.actionKind === "initiate_battle") {
      updatePattern("battle_bot_initiated", won);
      if (turn.myCharCount > turn.oppCharCount) updatePattern("battle_more_chars", won);
      else if (turn.myCharCount < turn.oppCharCount) updatePattern("battle_fewer_chars", won);
      else updatePattern("battle_equal_chars", won);
    }

    if (turn.actionKind === "declare_battle_cards" && turn.cardId) {
      updatePattern("battle_card_used:" + turn.cardId, won);
    }

    if (turn.actionKind === "discard_hand") {
      updatePattern("even_up_discard_hand", won);
    }
    if (turn.actionKind === "surrender_planet") {
      updatePattern("even_up_surrender_planet", won);
    }

    // Strong signals (big win or big loss) get an extra update for emphasis
    if (Math.abs(turn.reward) >= 8) {
      updatePattern("action:" + turn.actionKind, won);
      if (turn.cardId) {
        updatePattern("card_play:" + turn.cardId, won);
      }
    }
  }
}

// ─── Decision adjustment ─────────────────────────────────

/**
 * Returns a threshold adjustment for the battle initiation decision.
 * Positive = more conservative (less likely to battle).
 * Negative = more aggressive (more likely to battle).
 * Magnitude capped to ±0.15 so memory never overrides fundamentals.
 */
export function getBattleThresholdAdjustment(
  powerRatio: number,
  hasWeapons: boolean,
  myCharCount: number,
  oppCharCount: number
): number {
  ensureLoaded();
  if (store.battles.length < 3) return 0;

  const similar = store.battles.filter(
    (b) => Math.abs(b.powerRatio - powerRatio) < 0.3
  );

  let adj = 0;

  if (similar.length >= 3) {
    const winRate = similar.filter((b) => b.result === "win").length / similar.length;
    if (winRate < 0.35 && similar.length >= 5) adj += 0.12;
    else if (winRate < 0.45) adj += 0.06;
    else if (winRate > 0.75 && similar.length >= 5) adj -= 0.06;
    else if (winRate > 0.65) adj -= 0.03;
  }

  const weaponKey = hasWeapons ? "battle_with_weapons" : "battle_without_weapons";
  const wp = getPatternWinRateInternal(weaponKey);
  if (wp.samples >= 3) {
    if (wp.rate < 0.35) adj += 0.05;
    else if (wp.rate > 0.7) adj -= 0.05;
  }

  const charKey =
    myCharCount > oppCharCount
      ? "battle_more_chars"
      : myCharCount < oppCharCount
      ? "battle_fewer_chars"
      : "battle_equal_chars";
  const cp = getPatternWinRateInternal(charKey);
  if (cp.samples >= 3) {
    if (cp.rate < 0.3 && myCharCount <= oppCharCount) adj += 0.05;
    else if (cp.rate > 0.7 && myCharCount >= oppCharCount) adj -= 0.01;
  }

  return Math.max(-0.15, Math.min(0.15, adj));
}

/**
 * Returns true if memory strongly advises against initiating battle
 * (confidence >= 80% that this situation leads to loss, sample >= 5).
 */
export function shouldAvoidBattle(powerRatio: number, hasWeapons: boolean): boolean {
  ensureLoaded();
  const similar = store.battles.filter(
    (b) => Math.abs(b.powerRatio - powerRatio) < 0.25 && b.hadWeapons === hasWeapons && b.botInitiated
  );
  if (similar.length < 5) return false;
  const lossRate = similar.filter((b) => b.result === "loss").length / similar.length;
  return lossRate >= 0.8;
}

// ─── Post-game analysis ──────────────────────────────────

export function runPostGameAnalysis(
  gameId: string,
  g: GameStateData,
  botSide: Side,
  winner: Side,
  reason: string
): void {
  ensureLoaded();

  const won = winner === botSide;
  const planetsWon = botSide === "light" ? (g.lightPlanetsWon ?? 0) : (g.darkPlanetsWon ?? 0);
  const planetsLost = botSide === "light" ? (g.darkPlanetsWon ?? 0) : (g.lightPlanetsWon ?? 0);

  store.games.push({
    botSide,
    won,
    turnCount: g.turnNumber,
    planetsWon,
    planetsLost,
    reason,
    timestamp: Date.now(),
  });

  updatePattern(won ? "game_won" : "game_lost", won);
  if (reason === "deck_empty") updatePattern("loss_by_deck_empty", won);
  if (reason === "planet_victory") updatePattern("loss_by_planet", won);
  if (reason === "concede") updatePattern("opponent_conceded", won);

  const p = botSide === "light" ? g.light : g.dark;
  const seenCardIds = new Set<string>();
  for (const c of p.inPlay) {
    if (seenCardIds.has(c.cardId)) continue;
    seenCardIds.add(c.cardId);
    updatePattern("card_play:" + c.cardId, won);
  }

  // ── Location choices (opening / next planet) ──
  const meta = pendingGameMeta.get(gameId);
  if (meta) {
    if (meta.startingLocationCardId) {
      const planet = state.getLocationPlanet(meta.startingLocationCardId);
      if (planet) updatePattern("starting_planet:" + planet, won);
    }
    for (const cardId of meta.nextPlanetCardIds) {
      const planet = state.getLocationPlanet(cardId);
      if (planet) updatePattern("next_planet:" + planet, won);
    }
    pendingGameMeta.delete(gameId);
  }

  // ── Flush pending turns to replay buffer with game-end rewards ──
  const turns = pendingTurns.get(gameId) ?? [];
  const gameEndReward = won ? REWARDS.GAME_WIN : REWARDS.GAME_LOSS;
  const planetReward = planetsWon * REWARDS.PLANET_WON + planetsLost * REWARDS.PLANET_LOST;
  const turnCount = turns.length || 1;
  for (const t of turns) {
    t.reward += gameEndReward;
    t.reward += planetReward / turnCount;
  }
  store.replayBuffer.push(...turns);
  if (store.replayBuffer.length > MAX_REPLAY_BUFFER) {
    store.replayBuffer = store.replayBuffer.slice(-MAX_REPLAY_BUFFER);
  }
  pendingTurns.delete(gameId);

  if (store.replayBuffer.length >= REPLAY_BATCH_SIZE * 2) {
    learnFromReplayBatch();
  }

  preBattleSnapshots.delete(gameId);
  save();
}

// ─── Diagnostics ─────────────────────────────────────────

export function getMemoryStats(): {
  battleCount: number;
  gameCount: number;
  patternCount: number;
  overallWinRate: number;
  replayBufferSize: number;
  patterns: PatternRecord[];
} {
  ensureLoaded();
  const gameCount = store.games.length;
  const wins = store.games.filter((g) => g.won).length;
  return {
    battleCount: store.battles.length,
    gameCount,
    patternCount: store.patterns.length,
    overallWinRate: gameCount > 0 ? Math.round((wins / gameCount) * 100) / 100 : 0.5,
    replayBufferSize: store.replayBuffer.length,
    patterns: store.patterns,
  };
}
