/**
 * Game engine: turn progression, phases, timers.
 * Server advances phase when timer expires or when both players signal ready (optional).
 */

import type { Side } from "../types";
import type { GameStateData, Phase } from "./state";
import * as state from "./state";

export interface AdvancePhaseResult {
  planetControlled?: boolean;
  controlledBy?: Side;
  gameOver?: boolean;
  winner?: Side;
  reason?: string;
}

const games = new Map<string, GameStateData>();
const phaseTimers = new Map<string, ReturnType<typeof setInterval>>();

const DEFAULT_PHASE_MS = 60 * 1000; // 60 seconds per phase

export function registerGame(g: GameStateData): void {
  games.set(g.id, g);
}

export function unregisterGame(gameId: string): void {
  stopPhaseTimer(gameId);
  games.delete(gameId);
}

export function getGame(gameId: string): GameStateData | undefined {
  return games.get(gameId);
}

export function getGameByTableId(tableId: string): GameStateData | undefined {
  for (const g of games.values()) {
    if (g.tableId === tableId) return g;
  }
  return undefined;
}

/**
 * Start a new game in "determine_first" phase: no hand draw yet.
 * First destiny compare round is run so clients can show the two cards.
 */
export function startGame(
  gameId: string,
  tableId: string,
  lightPlayerId: string,
  darkPlayerId: string,
  lightName: string,
  darkName: string,
  phaseDurationMs: number = DEFAULT_PHASE_MS,
  lightDeckId?: string,
  darkDeckId?: string,
  lightCustomCards?: { id: string; set?: string; count: number }[],
  darkCustomCards?: { id: string; set?: string; count: number }[]
): GameStateData {
  const g = state.createGameState(
    gameId,
    tableId,
    lightPlayerId,
    darkPlayerId,
    lightName,
    darkName,
    phaseDurationMs,
    lightDeckId,
    darkDeckId,
    lightCustomCards,
    darkCustomCards
  );
  g.phaseStartedAt = Date.now();
  g.ruleset = "dotf";
  registerGame(g);
  return g;
}

/**
 * Advance to next phase (or next turn).
 * Order: deploy -> battle -> even_up (even up is end of turn; no separate End phase).
 */
export function advancePhase(gameId: string, onPhaseChange: (game: GameStateData) => void): AdvancePhaseResult | undefined {
  const g = games.get(gameId);
  if (!g) return undefined;

  // Declare deck victory only when advancing phase (after battle resolution, etc.) so the client sees the full sequence (battle, mill, damage) before game over.
  const deckWinner = state.getDeckEmptyWinner(g);
  if (deckWinner) {
    g.phase = "game_over";
    g.phaseStartedAt = Date.now();
    onPhaseChange(g);
    return { gameOver: true, winner: deckWinner, reason: "deck_empty" };
  }

  const phases: Phase[] = ["determine_first", "choose_starting_location", "choose_next_planet", "draw", "deploy", "battle", "even_up"];
  const idx = phases.indexOf(g.phase);
  if (g.phase === "determine_first" || g.phase === "choose_starting_location" || g.phase === "choose_next_planet") {
    return undefined;
  }
  let nextPhase: Phase;
  let nextTurn = g.turnSide;
  let nextTurnNum = g.turnNumber;

  const wasEndOfTurn = idx === phases.length - 1;  // even_up is last; then next turn deploy
  if (idx < 0 || wasEndOfTurn) {
    const planetCheck = state.checkPlanetControl(g);
    if (planetCheck.controlled && planetCheck.controlledBy) {
      const result = state.controlPlanet(g);
      if (result?.gameOver) {
        g.phase = "game_over";
        g.phaseStartedAt = Date.now();
        onPhaseChange(g);
        return { planetControlled: true, controlledBy: result.controlledBy, gameOver: true, winner: result.winner, reason: "planet_victory" };
      }
      const loserSide: Side = planetCheck.controlledBy === "light" ? "dark" : "light";
      state.enterChooseNextPlanet(g, loserSide);
      onPhaseChange(g);
      return { planetControlled: true, controlledBy: planetCheck.controlledBy };
    }
    nextPhase = "deploy";
    nextTurn = g.turnSide === "light" ? "dark" : "light";
    nextTurnNum = g.turnNumber + 1;
  } else {
    nextPhase = phases[idx + 1];
  }

  g.phase = nextPhase;
  g.turnSide = nextTurn;
  g.turnNumber = nextTurnNum;
  g.phaseStartedAt = Date.now();

  state.clearEffectActivation(g);

  // Clear battle declaration state when leaving battle phase so UI and validation don't get stuck
  if (nextPhase !== "battle") {
    g.battleCardDeclareSide = undefined;
    g.battlePlanPhase = false;
    g.lightDeclaredBattleCards = undefined;
    g.darkDeclaredBattleCards = undefined;
    g.lightBattlePlanOrder = undefined;
    g.darkBattlePlanOrder = undefined;
    g.lightBattlePlanReady = false;
    g.darkBattlePlanReady = false;
    g.duelState = undefined;
  }

  if (nextPhase === "battle") {
    g.duelUsedThisTurn = false;
    g.foughtThisTurn = undefined;
    g.destinyRedrawUsed = undefined;
  }

  if (nextPhase === "deploy") {
    g.usedEffectsThisTurn = undefined;
    state.onEnterDeploy(g, nextTurn);
    const deployForce = 6 + state.getEffectYourDeployCountersBonus(g, nextTurn);
    state.setForce(g, nextTurn, deployForce);
  }

  onPhaseChange(g);
  return undefined;
}

/**
 * Start phase timer for this game; when it fires, advance phase and notify.
 */
export function startPhaseTimer(
  gameId: string,
  onPhaseChange: (game: GameStateData) => void
): void {
  stopPhaseTimer(gameId);
  const handle = setInterval(() => {
    const g = games.get(gameId);
    if (!g) {
      stopPhaseTimer(gameId);
      return;
    }
    if (g.battlePlanPhase || g.battleCardDeclareSide || g.starshipBattlePhase) {
      return;
    }
    if (g.evacuationState || g.evacuationResult) {
      return;
    }
    if (g.effectActivationPending || g.planetEffectFetch || g.deployFromDeckPending || g.deployDrawPending || g.duelState || g.winControlPending || g.destinySwapPending || g.damageReplacePending || g.destinyChoosePending || g.jediTrainingPending || g.poundedPending) {
      return;
    }
    const elapsed = Date.now() - g.phaseStartedAt;
    if (elapsed >= g.phaseDurationMs) {
      advancePhase(gameId, onPhaseChange);
    }
  }, 2000);
  phaseTimers.set(gameId, handle);
}

export function stopPhaseTimer(gameId?: string): void {
  if (gameId) {
    const handle = phaseTimers.get(gameId);
    if (handle) {
      clearInterval(handle);
      phaseTimers.delete(gameId);
    }
  } else {
    phaseTimers.forEach((h) => clearInterval(h));
    phaseTimers.clear();
  }
}
