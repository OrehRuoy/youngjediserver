import type { Side } from "../types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";
import { drawCards, getCurrentLocationCard, getDeckEmptyWinner, getLocationPlanet, millFromDeck } from "./state";

function drawClause(cardId: string, set?: string): { count: number; planet?: string } | null {
  const def = getCard(cardId, set);
  const bonus = ((def as { gametextbonus?: string } | undefined)?.gametextbonus ?? "").toLowerCase();
  const m = bonus.match(/drawondeploy:(\d+)(?:\s*,\s*planet:([a-z0-9]+))?/);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  return { count, planet: m[2] };
}

/** Face-up deploy only. Asks whether to draw. */
export function maybeBeginDeployDraw(state: GameStateData, side: Side, cardId: string, set?: string, faceDown?: boolean): boolean {
  if (faceDown || state.deployDrawPending || state.deployFromDeckPending) return false;
  const clause = drawClause(cardId, set);
  if (!clause) return false;
  if (clause.planet) {
    const loc = getCurrentLocationCard(state);
    const planet = loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet).toLowerCase() : "";
    if (planet !== clause.planet) return false;
  }
  state.deployDrawPending = { side, count: clause.count };
  return true;
}

export function confirmDeployDraw(state: GameStateData, side: Side): { ok: boolean; gameOverWinner?: Side } {
  const pending = state.deployDrawPending;
  if (!pending || pending.side !== side) return { ok: false };
  drawCards(state, side, pending.count);
  state.deployDrawPending = undefined;
  return { ok: true, gameOverWinner: getDeckEmptyWinner(state) };
}

/** Face-up deploy only. Opponent mills when the card says they take damage on deploy. */
export function maybeApplyDeployDamage(
  state: GameStateData,
  side: Side,
  cardId: string,
  set?: string,
  faceDown?: boolean
): Side | undefined {
  if (faceDown) return undefined;
  const bonus = ((getCard(cardId, set) as { gametextbonus?: string } | undefined)?.gametextbonus ?? "").toLowerCase();
  const m = bonus.match(/damageondeploy:(\d+)(?:\s*,\s*planet:([a-z0-9]+))?/);
  if (!m) return undefined;
  const amount = parseInt(m[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  if (m[2]) {
    const loc = getCurrentLocationCard(state);
    const planet = loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet).toLowerCase() : "";
    if (planet !== m[2]) return undefined;
  }
  const opponent: Side = side === "light" ? "dark" : "light";
  millFromDeck(state, opponent, amount);
  return getDeckEmptyWinner(state);
}

export function declineDeployDraw(state: GameStateData, side: Side): boolean {
  if (!state.deployDrawPending || state.deployDrawPending.side !== side) return false;
  state.deployDrawPending = undefined;
  return true;
}
