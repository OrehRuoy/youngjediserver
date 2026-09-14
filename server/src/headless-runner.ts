/**
 * Headless Bot Self-Play Training — runs bot-vs-bot games without server or clients.
 * Uses game engine, state, handlers, and bot; does not start HTTP/WebSocket or lobby.
 * Writes to bot-memory.json (battle/game/pattern records + replay buffer). Run: node dist/headless-runner.js or npx ts-node src/headless-runner.ts
 *
 * Full game is simulated: opening destiny draw (first player), choose starting location
 * (by deck copies per planet), choose next planet after control, deploy (scores cards:
 * character/weapon/effect/location bonus, plays best or passes), battle (declares up to 3
 * battle cards, builds plan with weapon assignment and character order, initiates when
 * power ratio meets threshold or passes), even-up (discards to 6, prefers wrong-planet/
 * unplayable battle; can discard entire hand when 4+ unplayable and deck >= 20; can
 * surrender planet when badly behind via surrenderPowerRatio), evacuation (intercept
 * with starfighter or decline). Wins by 2 planet controls or battle/life/deck.
 */

import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";
import { initCards, getDecksForSide, getDeck } from "./cards/loader";
import * as gameEngine from "./game/engine";
import * as gameState from "./game/state";
import * as gameHandlers from "./game/handlers";
import * as bot from "./game/bot";
import * as botMemory from "./game/bot-memory";
import type { GameStateData } from "./game/state";
import type { Side } from "./types";
type BotConfig = bot.BotConfig;

const HEADLESS_BASE_ID = "headless_base";
const HEADLESS_VARIANT_ID = "headless_variant";
const MAX_STEPS_PER_GAME = 5000;
const DEFAULT_DECK_LIGHT = "starter_deck";
const DEFAULT_DECK_DARK = "starter_dark_deck";

const DATA_DIR = path.join(__dirname, "..", "data");
const TRAINING_LOG_PATH = path.join(DATA_DIR, "headless-training-log.json");
const BASE_CONFIG_PATH = path.join(DATA_DIR, "headless-base-config.json");

export interface GameRecord {
  gameIndex: number;
  batchIndex: number;
  winner: Side;
  winnerPlayerId: string;
  reason: string;
  turnCount: number;
  lightPlanetsWon: number;
  darkPlanetsWon: number;
  lightDeckCount: number;
  darkDeckCount: number;
  lightHandCount: number;
  darkHandCount: number;
  steps: number;
}

export interface BatchSummary {
  batchIndex: number;
  baseWins: number;
  variantWins: number;
  totalGames: number;
  variantWinRate: number;
  promoted: boolean;
}

/** Who must act next (playerId and side), or null if game over or no action needed (e.g. draw phase). */
function getActor(
  g: GameStateData,
  lightPlayerId: string,
  darkPlayerId: string
): { playerId: string; side: Side } | null {
  if (g.phase === "game_over") return null;
  const lightSide: Side = "light";
  const darkSide: Side = "dark";
  const botSideFor = (playerId: string): Side | null =>
    g.lightPlayerId === playerId ? lightSide : g.darkPlayerId === playerId ? darkSide : null;
  const mustAct = (playerId: string): boolean => {
    const side = botSideFor(playerId);
    if (!side) return false;
    if (g.evacuationState?.awaitingInterception && g.evacuationState.evacuatingSide !== side) return true;
    if (g.evacuationResult) return true;
    if (g.planetEffectFetch?.chooserSide === side) return true;
    if (g.planetEffectFetch && g.planetEffectFetch.chooserSide !== side) return false;
    if (g.deployFromDeckPending?.side === side) return true;
    if (g.deployFromDeckPending && g.deployFromDeckPending.side !== side) return false;
    if (g.duelState) {
      const d = g.duelState;
      if (d.step === "choose_target" && d.initiator === side) return true;
      if (d.step === "defender_respond" && d.initiator !== side) return true;
      if (d.step === "play") {
        if (!d.pendingAttack && d.currentAttacker === side) return true;
        if (d.pendingAttack && d.pendingAttack.side !== side) return true;
      }
      return false;
    }
    if (g.battleCardDeclareSide === side) return true;
    if (g.battlePlanPhase && (side === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) return true;
    const other: Side = side === "light" ? "dark" : "light";
    if (g.battleCardDeclareSide === other) return false;
    if (g.battlePlanPhase && (other === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) return false;
    if (g.turnSide === side) return true;
    if (g.phase === "choose_starting_location" && g.turnSide === side) return true;
    if (g.phase === "choose_next_planet" && g.nextPlanetChooserSide === side) return true;
    return false;
  };
  if (mustAct(lightPlayerId)) return { playerId: lightPlayerId, side: lightSide };
  if (mustAct(darkPlayerId)) return { playerId: darkPlayerId, side: darkSide };
  return null;
}

/** Run destiny compare to completion (synchronous). */
function runDestinyToCompletion(g: GameStateData): void {
  gameState.runDestinyCompareRound(g);
  while (true) {
    const result = gameState.resolveDestinyCompare(g);
    if (result.done) break;
    if (g.light.deck.length === 0 || g.dark.deck.length === 0) {
      g.turnSide = Math.random() < 0.5 ? "light" : "dark";
      g.phase = "choose_starting_location";
      g.phaseStartedAt = Date.now();
      gameState.extractStartingLocationChoices(g);
      break;
    }
  }
}

/** Run a single headless game. Records variant's battles and game result to bot-memory so the variant improves. */
function runOneGame(
  gameIndex: number,
  batchIndex: number,
  lightPlayerId: string,
  darkPlayerId: string,
  baseConfig: BotConfig,
  variantConfig: BotConfig,
  lightDeckId?: string,
  darkDeckId?: string
): GameRecord {
  const gameId = "headless_" + batchIndex + "_" + gameIndex;
  const tableId = "table_headless_" + batchIndex + "_" + gameIndex;
  gameEngine.startGame(
    gameId,
    tableId,
    lightPlayerId,
    darkPlayerId,
    "Base",
    "Variant",
    60_000,
    lightDeckId ?? DEFAULT_DECK_LIGHT,
    darkDeckId ?? DEFAULT_DECK_DARK
  );
  const g = gameEngine.getGame(gameId);
  if (!g) throw new Error("startGame did not register game " + gameId);
  runDestinyToCompletion(g);
  let steps = 0;
  let lastWinner: Side | null = null;
  let lastReason = "";

  while (g.phase !== "game_over" && steps < MAX_STEPS_PER_GAME) {
    steps++;
    const updated = gameEngine.getGame(gameId);
    if (!updated) break;
    if (updated.phase === "draw") {
      const adv = gameEngine.advancePhase(gameId, () => {});
      if (adv?.gameOver) {
        lastWinner = adv.winner ?? null;
        lastReason = adv.reason ?? "planet_victory";
        break;
      }
      continue;
    }
    const actor = getActor(updated, lightPlayerId, darkPlayerId);
    if (!actor) break;
    const config = actor.playerId === HEADLESS_BASE_ID ? baseConfig : variantConfig;
    let action = bot.getNextAction(updated, actor.side, config);
    const battleSubPhase = !!(updated.battleCardDeclareSide || updated.battlePlanPhase);
    if (action === null && (updated.phase === "deploy" || (updated.phase === "battle" && !battleSubPhase))) {
      action = { kind: "pass_phase" };
    }
    if (action === null) continue;
    const wasBattlePlan = !!updated.battlePlanPhase;
    // Only the variant writes to memory (battle capture, turns, location choices).
    if (actor.playerId === HEADLESS_VARIANT_ID) {
      if (action.kind === "initiate_battle") botMemory.captureBattleStart(gameId, updated, actor.side);
      botMemory.recordBotTurn(gameId, updated, actor.side, action);
      if (action.kind === "choose_starting_location" && action.instanceId) {
        const choice = updated.startingLocationChoices?.find((c) => c.instanceId === action.instanceId);
        if (choice) botMemory.recordStartingLocationChoice(gameId, choice.cardId);
      }
      if (action.kind === "choose_next_planet" && action.instanceId) {
        const choice = updated.nextPlanetChoices?.find((c) => c.instanceId === action.instanceId);
        if (choice) botMemory.recordNextPlanetChoice(gameId, choice.cardId);
      }
    }
    const result = gameHandlers.handleGameAction(gameId, actor.playerId, action);
    if (!result.applied) continue;
    const after = gameEngine.getGame(gameId);
    if (after && wasBattlePlan && !after.battlePlanPhase) {
      botMemory.captureBattleResult(gameId, after);
    }
    if (result.gameOver) {
      lastWinner = result.gameOver.winner;
      lastReason = result.gameOver.reason ?? "battle";
      break;
    }
  }

  const final = gameEngine.getGame(gameId);
  const variantSide: Side = lightPlayerId === HEADLESS_VARIANT_ID ? "light" : "dark";
  if (final) {
    const winnerForMemory: Side = lastWinner ?? ((final.lightPlanetsWon ?? 0) >= 2 ? "light" : (final.darkPlanetsWon ?? 0) >= 2 ? "dark" : "light");
    botMemory.runPostGameAnalysis(gameId, final, variantSide, winnerForMemory, lastReason || "steps_cap");
  }
  gameEngine.unregisterGame(gameId);

  const winner: Side = lastWinner ?? (final && (final.lightPlanetsWon ?? 0) >= 2 ? "light" : (final?.darkPlanetsWon ?? 0) >= 2 ? "dark" : "light");
  const winnerPlayerId = winner === "light" ? lightPlayerId : darkPlayerId;
  const turnCount = final?.turnNumber ?? 0;
  const lightPlanetsWon = final?.lightPlanetsWon ?? 0;
  const darkPlanetsWon = final?.darkPlanetsWon ?? 0;
  const lightDeckCount = final?.light.deck.length ?? 0;
  const darkDeckCount = final?.dark.deck.length ?? 0;
  const lightHandCount = final?.light.hand.length ?? 0;
  const darkHandCount = final?.dark.hand.length ?? 0;

  return {
    gameIndex,
    batchIndex,
    winner,
    winnerPlayerId,
    reason: lastReason || "steps_cap",
    turnCount,
    lightPlanetsWon,
    darkPlanetsWon,
    lightDeckCount,
    darkDeckCount,
    lightHandCount,
    darkHandCount,
    steps,
  };
}

/** Clone config and add small random deltas. Keeps values in sane bounds. */
function mutateConfig(base: BotConfig, delta = 0.05): BotConfig {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const r = () => (Math.random() - 0.5) * 2 * delta;
  return {
    battleThresholdWithWeapons: clamp(base.battleThresholdWithWeapons + r(), 0.5, 1),
    battleThresholdNoWeapons: clamp(base.battleThresholdNoWeapons + r(), 0.5, 1),
    battleThresholdMoreCharsCap: clamp(base.battleThresholdMoreCharsCap + r(), 0.5, 1),
    useMemoryAdjustment: base.useMemoryAdjustment,
    surrenderPowerRatio: clamp(base.surrenderPowerRatio + r() * 0.3, 1, 2.5),
    discardHandUnplayableThreshold: Math.max(2, Math.min(7, Math.round(base.discardHandUnplayableThreshold + (Math.random() - 0.5) * 2))),
    discardHandMinDeck: Math.max(10, Math.min(35, Math.round(base.discardHandMinDeck + (Math.random() - 0.5) * 6))),
  };
}

function loadBaseConfig(): BotConfig {
  try {
    if (fs.existsSync(BASE_CONFIG_PATH)) {
      const raw = fs.readFileSync(BASE_CONFIG_PATH, "utf-8");
      const data = JSON.parse(raw);
      return {
        battleThresholdWithWeapons: data.battleThresholdWithWeapons ?? bot.DEFAULT_BOT_CONFIG.battleThresholdWithWeapons,
        battleThresholdNoWeapons: data.battleThresholdNoWeapons ?? bot.DEFAULT_BOT_CONFIG.battleThresholdNoWeapons,
        battleThresholdMoreCharsCap: data.battleThresholdMoreCharsCap ?? bot.DEFAULT_BOT_CONFIG.battleThresholdMoreCharsCap,
        useMemoryAdjustment: false,
        surrenderPowerRatio: data.surrenderPowerRatio ?? bot.DEFAULT_BOT_CONFIG.surrenderPowerRatio,
        discardHandUnplayableThreshold: data.discardHandUnplayableThreshold ?? bot.DEFAULT_BOT_CONFIG.discardHandUnplayableThreshold,
        discardHandMinDeck: data.discardHandMinDeck ?? bot.DEFAULT_BOT_CONFIG.discardHandMinDeck,
      };
    }
  } catch {
    // use default
  }
  return { ...bot.DEFAULT_BOT_CONFIG, useMemoryAdjustment: false };
}

function saveBaseConfig(config: BotConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BASE_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write base config:", e);
  }
}

function loadTrainingLog(): GameRecord[] {
  try {
    if (fs.existsSync(TRAINING_LOG_PATH)) {
      const raw = fs.readFileSync(TRAINING_LOG_PATH, "utf-8");
      const data = JSON.parse(raw);
      return Array.isArray(data.games) ? data.games : [];
    }
  } catch {
    // start fresh
  }
  return [];
}

function appendTrainingLog(records: GameRecord[], batchSummary?: BatchSummary): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const existing = loadTrainingLog();
    const games = [...existing, ...records];
    const summary = batchSummary ? { lastBatch: batchSummary } : {};
    fs.writeFileSync(
      TRAINING_LOG_PATH,
      JSON.stringify({ games, ...summary, updatedAt: new Date().toISOString() }, null, 2),
      "utf-8"
    );
  } catch (e) {
    console.error("Failed to write training log:", e);
  }
}

function parseEnvInt(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = parseInt(v, 10);
  return isNaN(n) ? defaultVal : n;
}

function parseEnvFloat(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = parseFloat(v);
  return isNaN(n) ? defaultVal : n;
}

function parseEnvStr(key: string, defaultVal: string): string {
  const v = process.env[key];
  return v !== undefined && v !== "" ? v : defaultVal;
}

/** Prompt one line from stdin. Resolves with trimmed string. */
function question(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve((answer || "").trim());
    });
  });
}

/** Interactive: show deck list and return chosen deck id. */
async function chooseDeck(side: "light" | "dark"): Promise<string> {
  const decks = getDecksForSide(side);
  if (decks.length === 0) return side === "light" ? DEFAULT_DECK_LIGHT : DEFAULT_DECK_DARK;
  console.log("\n  " + side.charAt(0).toUpperCase() + side.slice(1) + " decks:");
  decks.forEach((d, i) => {
    console.log("    " + (i + 1) + ". " + d.id + " - " + (d.name || ""));
  });
  const raw = await question("  Choose " + side + " deck (number or id, Enter = default): ");
  if (!raw) return side === "light" ? DEFAULT_DECK_LIGHT : DEFAULT_DECK_DARK;
  const n = parseInt(raw, 10);
  if (!isNaN(n) && n >= 1 && n <= decks.length) return decks[n - 1].id;
  const byId = decks.find((d) => d.id.toLowerCase() === raw.toLowerCase());
  if (byId) return byId.id;
  console.warn("  Unknown choice, using default.");
  return side === "light" ? DEFAULT_DECK_LIGHT : DEFAULT_DECK_DARK;
}

/** Run interactive prompts, then run training. Skip prompts if all 5 args provided (games, batches, promoteRate, lightDeckId, darkDeckId). */
async function main(): Promise<void> {
  initCards();
  botMemory.ensureLoaded();
  const argv = process.argv.slice(2);
  const nonInteractive = argv.length >= 5;

  let gamesPerBatch: number;
  let batches: number;
  let promoteRate: number;
  let lightDeckId: string;
  let darkDeckId: string;

  if (nonInteractive) {
    gamesPerBatch = parseInt(argv[0], 10) || parseEnvInt("HEADLESS_GAMES", 500);
    batches = parseInt(argv[1], 10) || parseEnvInt("HEADLESS_BATCHES", 20);
    promoteRate = parseFloat(argv[2]) || parseEnvFloat("HEADLESS_PROMOTE_RATE", 0.55);
    lightDeckId = argv[3] || parseEnvStr("HEADLESS_LIGHT_DECK", DEFAULT_DECK_LIGHT);
    darkDeckId = argv[4] || parseEnvStr("HEADLESS_DARK_DECK", DEFAULT_DECK_DARK);
    if (!getDeck(lightDeckId)) lightDeckId = DEFAULT_DECK_LIGHT;
    if (!getDeck(darkDeckId)) darkDeckId = DEFAULT_DECK_DARK;
    console.log("Using light deck:", lightDeckId, " dark deck:", darkDeckId, " | batches:", batches, " x games:", gamesPerBatch);
  } else {
    console.log("--- Headless Bot Training ---");
    lightDeckId = await chooseDeck("light");
    darkDeckId = await chooseDeck("dark");
    console.log("\n  Using light:", lightDeckId, " dark:", darkDeckId);

    const gamesStr = await question("\n  How many games per batch? (default 500): ");
    gamesPerBatch = parseInt(gamesStr, 10) || 500;
    const batchesStr = await question("  How many batches? (default 20): ");
    batches = parseInt(batchesStr, 10) || 20;
    const rateStr = await question("  Promote variant if win rate above? (default 0.55): ");
    promoteRate = parseFloat(rateStr) || 0.55;

    const go = await question("\n  Start training? (y/n): ");
    if (go.toLowerCase() !== "y" && go.toLowerCase() !== "yes") {
      console.log("Cancelled.");
      process.exit(0);
    }
    console.log("");
  }

  let baseConfig = loadBaseConfig();
  baseConfig = { ...baseConfig, useMemoryAdjustment: false };
  const initialBaseConfig = { ...baseConfig };
  let variantConfig = mutateConfig(baseConfig);
  variantConfig = { ...variantConfig, useMemoryAdjustment: true };

  console.log("Headless training: " + batches + " batches x " + gamesPerBatch + " games, promote if variant win rate > " + promoteRate);
  console.log("Each batch uses a slightly different variant (same variant for all " + gamesPerBatch + " games in the batch) so we can see if that variant is better or not.");
  console.log("Tuned by evolution (promoted when variant wins): battle thresholds, surrender ratio, even-up discard-hand threshold & min deck.");
  console.log("Learned from memory (variant only): which cards to play (card_play), which battle cards to declare first (battle_card_used), when to avoid/initiate battle.");
  console.log("Base (fixed, no memory):", baseConfig);
  console.log("Variant (uses bot-memory to improve):", variantConfig);

  let totalBaseWins = 0;
  let totalVariantWins = 0;
  let promotionCount = 0;

  try {
  for (let batch = 0; batch < batches; batch++) {
    const batchRecords: GameRecord[] = [];
    let baseWins = 0;
    let variantWins = 0;
    for (let i = 0; i < gamesPerBatch; i++) {
      const lightId = i % 2 === 0 ? HEADLESS_BASE_ID : HEADLESS_VARIANT_ID;
      const darkId = i % 2 === 0 ? HEADLESS_VARIANT_ID : HEADLESS_BASE_ID;
      const rec = runOneGame(i, batch, lightId, darkId, baseConfig, variantConfig, lightDeckId, darkDeckId);
      batchRecords.push(rec);
      if (rec.winnerPlayerId === HEADLESS_BASE_ID) {
        baseWins++;
        totalBaseWins++;
      } else {
        variantWins++;
        totalVariantWins++;
      }
    }
    const variantWinRate = variantWins / gamesPerBatch;
    const promoted = variantWinRate >= promoteRate;
    if (promoted) promotionCount++;
    const summary: BatchSummary = {
      batchIndex: batch,
      baseWins,
      variantWins,
      totalGames: gamesPerBatch,
      variantWinRate,
      promoted,
    };
    if (promoted) {
      baseConfig = { ...variantConfig, useMemoryAdjustment: false };
      variantConfig = mutateConfig(baseConfig);
      variantConfig = { ...variantConfig, useMemoryAdjustment: true };
      saveBaseConfig(baseConfig);
      console.log("Batch " + batch + ": variant " + variantWins + " / " + gamesPerBatch + " (promoted)");
    } else {
      variantConfig = mutateConfig(baseConfig);
      console.log("Batch " + batch + ": variant " + variantWins + " / " + gamesPerBatch);
    }
    appendTrainingLog(batchRecords, summary);
  }

  } catch (err) {
    console.error("\nTraining error:", err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    if (!nonInteractive) {
      await question("\nPress Enter to close...");
    }
    process.exit(1);
  }

  const totalGames = batches * gamesPerBatch;
  const variantOverallRate = totalGames > 0 ? totalVariantWins / totalGames : 0;

  console.log("\n" + "=".repeat(60));
  console.log("TRAINING COMPLETE – SUMMARY");
  console.log("=".repeat(60));
  console.log("Total games: " + totalGames + "  (Base: " + totalBaseWins + " wins  |  Variant: " + totalVariantWins + " wins)");
  console.log("Variant overall win rate: " + (variantOverallRate * 100).toFixed(1) + "%");
  console.log("Promotions (variant became new base): " + promotionCount + " / " + batches + " batches");

  if (promotionCount > 0) {
    console.log("\n--- Tuned config (promoted from variant) ---");
    console.log("  Battle threshold (with weapons):  " + baseConfig.battleThresholdWithWeapons.toFixed(3) + (initialBaseConfig.battleThresholdWithWeapons !== baseConfig.battleThresholdWithWeapons ? "  (was " + initialBaseConfig.battleThresholdWithWeapons.toFixed(3) + ")" : ""));
    console.log("  Battle threshold (no weapons):   " + baseConfig.battleThresholdNoWeapons.toFixed(3) + (initialBaseConfig.battleThresholdNoWeapons !== baseConfig.battleThresholdNoWeapons ? "  (was " + initialBaseConfig.battleThresholdNoWeapons.toFixed(3) + ")" : ""));
    console.log("  Battle threshold (more chars):   " + baseConfig.battleThresholdMoreCharsCap.toFixed(3) + (initialBaseConfig.battleThresholdMoreCharsCap !== baseConfig.battleThresholdMoreCharsCap ? "  (was " + initialBaseConfig.battleThresholdMoreCharsCap.toFixed(3) + ")" : ""));
    console.log("  Surrender power ratio:           " + baseConfig.surrenderPowerRatio.toFixed(3) + (initialBaseConfig.surrenderPowerRatio !== baseConfig.surrenderPowerRatio ? "  (was " + initialBaseConfig.surrenderPowerRatio.toFixed(3) + ")" : ""));
    console.log("  Even-up: discard hand when unplayable >= " + baseConfig.discardHandUnplayableThreshold + (initialBaseConfig.discardHandUnplayableThreshold !== baseConfig.discardHandUnplayableThreshold ? "  (was " + initialBaseConfig.discardHandUnplayableThreshold + ")" : ""));
    console.log("  Even-up: min deck for discard hand: " + baseConfig.discardHandMinDeck + (initialBaseConfig.discardHandMinDeck !== baseConfig.discardHandMinDeck ? "  (was " + initialBaseConfig.discardHandMinDeck + ")" : ""));
    console.log("  Saved to: " + BASE_CONFIG_PATH);
  } else {
    console.log("\nNo promotions this run; base config unchanged.");
  }

  try {
    const mem = botMemory.getMemoryStats();
    console.log("\n--- Bot memory (variant learns from games) ---");
    console.log("  Battles recorded: " + mem.battleCount + "  |  Games: " + mem.gameCount + "  |  Replay turns: " + mem.replayBufferSize);
    console.log("  Patterns: card_play (deploy), battle_card_used (declare order), battle situation tags → used to prefer better cards and adjust battle initiation.");
    console.log("  Overall win rate in memory: " + (mem.overallWinRate * 100).toFixed(1) + "%");
  } catch {
    // ignore
  }

  console.log("\nTraining log: " + TRAINING_LOG_PATH);
  console.log("=".repeat(60));
  if (!nonInteractive) {
    await question("\nPress Enter to exit...");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  if (e instanceof Error && e.stack) console.error(e.stack);
  const isInteractive = process.argv.length < 5;
  if (isInteractive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\nPress Enter to close...", () => {
      rl.close();
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});
