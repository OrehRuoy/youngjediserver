import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
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

function advanceDeployDraw(state: GameStateData): void {
  const next = state.deployDrawQueue?.shift();
  if (state.deployDrawQueue && state.deployDrawQueue.length === 0) state.deployDrawQueue = undefined;
  state.deployDrawPending = next;
}

export function confirmDeployDraw(state: GameStateData, side: Side): { ok: boolean; gameOverWinner?: Side } {
  const pending = state.deployDrawPending;
  if (!pending || pending.side !== side) return { ok: false };
  drawCards(state, side, pending.count);
  const winner = getDeckEmptyWinner(state);
  if (winner) {
    state.deployDrawPending = undefined;
    state.deployDrawQueue = undefined;
    return { ok: true, gameOverWinner: winner };
  }
  advanceDeployDraw(state);
  return { ok: true };
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
  advanceDeployDraw(state);
  return true;
}

function personaOf(cardId: string, set?: string): string {
  return ((getCard(cardId, set) as { persona?: string } | undefined)?.persona ?? "").toLowerCase();
}

function allyNames(bonus: string): string[] {
  const named = bonus.match(/ondeployhere:([a-z0-9|]+)/);
  return named ? named[1].split("|").filter(Boolean) : [];
}

function matchesAlly(cardId: string, set: string | undefined, names: string[]): boolean {
  if (names.length === 0) return false;
  const who = personaOf(cardId, set);
  const id = cardId.toLowerCase();
  return names.some((token) => token === who || id.includes(token));
}

/** When Anakin or Shmi deploys here, C-3PO draws. Shmi still offers her own choice. */
export function maybeBeginAllyDeployHere(state: GameStateData, side: Side, deployed: CardInstance | undefined): boolean {
  if (!deployed || deployed.faceDown) return false;
  if (state.effectActivationPending || state.deployFromDeckPending || state.deployDrawPending || state.jediTrainingPending) return false;
  const p = side === "light" ? state.light : state.dark;
  let choice: CardInstance | undefined;
  for (const other of p.inPlay) {
    if (other.instanceId === deployed.instanceId || other.faceDown) continue;
    const bonus = ((getCard(other.cardId, other.cardSet) as { gametextbonus?: string } | undefined)?.gametextbonus ?? "").toLowerCase();
    const names = allyNames(bonus);
    if (!matchesAlly(deployed.cardId, deployed.cardSet, names)) continue;
    const draw = bonus.match(/(?:^|[,;])\s*draw:(\d+)/);
    if (draw && !bonus.includes("choice:")) {
      const count = parseInt(draw[1], 10);
      if (Number.isFinite(count) && count > 0) drawCards(state, side, count);
    } else if (!choice && bonus.includes("choice:bottom|draw")) {
      choice = other;
    }
  }
  if (getDeckEmptyWinner(state) || !choice) return false;
  const def = getCard(choice.cardId, choice.cardSet) as { name?: string } | undefined;
  state.effectActivationPending = {
    side,
    effectInstanceId: choice.instanceId,
    effectCardId: choice.cardId,
    effectCardName: def?.name ?? choice.cardId,
    countersToAdd: 0,
    kind: "bottom_or_draw",
  };
  return true;
}

export function drawForAllyDeployHere(state: GameStateData, side: Side): { ok: boolean; gameOverWinner?: Side } {
  const pending = state.effectActivationPending;
  if (!pending || pending.side !== side || pending.kind !== "bottom_or_draw") return { ok: false };
  drawCards(state, side, 1);
  state.effectActivationPending = undefined;
  return { ok: true, gameOverWinner: getDeckEmptyWinner(state) };
}
