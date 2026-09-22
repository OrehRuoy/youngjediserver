/**
 * Stranded "when you have won this planet" abilities (Yoda Jedi Philosopher).
 * Click the character on a planet you control, discard him plus N hand cards, then draw.
 */

import type { Side } from "../types";
import { getCard } from "../cards/loader";
import type { CardInstance } from "../cards/types";
import type { GameStateData } from "./state";
import { drawCards } from "./state";

export interface WinControlAbility {
  discardSelf: boolean;
  discardHand: number;
  draw: number;
}

export function parseWinControlAbility(cardId: string, set?: string): WinControlAbility | null {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "character") return null;
  const bonus = ((def as { gametextbonus?: string }).gametextbonus ?? "").toLowerCase();
  if (!bonus.includes("wincontrol")) return null;
  const handM = bonus.match(/discardhand:(\d+)/);
  const drawM = bonus.match(/draw:(\d+)/);
  return {
    discardSelf: bonus.includes("discardself"),
    discardHand: handM ? Math.max(0, parseInt(handM[1], 10)) : 0,
    draw: drawM ? Math.max(0, parseInt(drawM[1], 10)) : 0,
  };
}

export function findWinControlTargets(
  state: GameStateData,
  side: Side
): { instanceId: string; planetIndex: number }[] {
  const out: { instanceId: string; planetIndex: number }[] = [];
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  const planets = state.controlledPlanets ?? [];
  for (let i = 0; i < planets.length; i++) {
    const cp = planets[i];
    if (cp.controlledBy !== side) continue;
    const list = (cp[strandedKey] ?? []) as { instanceId: string; cardId: string; faceDown?: boolean }[];
    for (const c of list) {
      if (c.faceDown) continue;
      if (parseWinControlAbility(c.cardId)) out.push({ instanceId: c.instanceId, planetIndex: i });
    }
  }
  return out;
}

export function beginWinControl(
  state: GameStateData,
  side: Side,
  instanceId: string,
  planetIndex: number
): { ok: boolean; error?: string } {
  if (state.winControlPending) return { ok: false, error: "Finish selecting cards for that ability first" };
  if (state.phase !== "deploy") return { ok: false, error: "Can only use this ability during deploy" };
  if (state.turnSide !== side) return { ok: false, error: "Not your turn" };
  if (state.deployFromDeckPending || state.effectActivationPending || state.duelState || state.evacuationState) {
    return { ok: false, error: "Finish your other action first" };
  }
  const planets = state.controlledPlanets ?? [];
  if (planetIndex < 0 || planetIndex >= planets.length) return { ok: false, error: "Invalid planet" };
  const cp = planets[planetIndex];
  if (cp.controlledBy !== side) return { ok: false, error: "You do not control that planet" };
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  const list = (cp[strandedKey] ?? []) as { instanceId: string; cardId: string; faceDown?: boolean }[];
  const card = list.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: "That character is not stranded there" };
  if (card.faceDown) return { ok: false, error: "Cannot use a face-down character" };
  const ability = parseWinControlAbility(card.cardId);
  if (!ability) return { ok: false, error: "That character has no won-planet ability" };
  const p = side === "light" ? state.light : state.dark;
  if (p.hand.length < ability.discardHand) {
    return { ok: false, error: `You need at least ${ability.discardHand} cards in hand to use this ability` };
  }
  state.winControlPending = {
    side,
    characterInstanceId: instanceId,
    characterCardId: card.cardId,
    planetIndex,
    discardHand: ability.discardHand,
    draw: ability.draw,
  };
  return { ok: true };
}

export function cancelWinControl(state: GameStateData, side: Side): boolean {
  if (!state.winControlPending || state.winControlPending.side !== side) return false;
  state.winControlPending = undefined;
  return true;
}

export function confirmWinControl(
  state: GameStateData,
  side: Side,
  instanceIds: string[]
): { ok: boolean; error?: string } {
  const pending = state.winControlPending;
  if (!pending || pending.side !== side) return { ok: false, error: "No won-planet ability to finish" };
  const ability = parseWinControlAbility(pending.characterCardId);
  if (!ability) {
    state.winControlPending = undefined;
    return { ok: false, error: "That ability is no longer valid" };
  }
  const unique = [...new Set(instanceIds.filter(Boolean))];
  if (unique.length !== ability.discardHand) {
    return { ok: false, error: `Select exactly ${ability.discardHand} cards from your hand` };
  }
  const p = side === "light" ? state.light : state.dark;
  const chosen: CardInstance[] = [];
  for (const id of unique) {
    const card = p.hand.find((c) => c.instanceId === id);
    if (!card) return { ok: false, error: "A selected card is not in your hand" };
    chosen.push(card);
  }
  const planets = state.controlledPlanets ?? [];
  const cp = planets[pending.planetIndex];
  if (!cp || cp.controlledBy !== side) {
    state.winControlPending = undefined;
    return { ok: false, error: "That planet is no longer yours" };
  }
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  const list = (cp[strandedKey] ?? []) as { instanceId: string; cardId: string; faceDown?: boolean }[];
  const stranded = list.find((c) => c.instanceId === pending.characterInstanceId);
  if (!stranded) {
    state.winControlPending = undefined;
    return { ok: false, error: "That character is no longer stranded there" };
  }

  if (ability.discardSelf) {
    cp[strandedKey] = list.filter((c) => c.instanceId !== pending.characterInstanceId);
    p.discard.push({
      instanceId: stranded.instanceId,
      cardId: stranded.cardId,
      ownerSide: side,
      zone: "discard",
      faceDown: false,
    });
  }

  const chosenIds = new Set(unique);
  p.hand = p.hand.filter((c) => !chosenIds.has(c.instanceId));
  for (const c of chosen) {
    c.zone = "discard";
    c.faceDown = false;
    p.discard.push(c);
  }

  if (ability.draw > 0) drawCards(state, side, ability.draw);
  state.winControlPending = undefined;
  return { ok: true };
}
