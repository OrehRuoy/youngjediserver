import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";

function isNonUniqueCard(card: CardInstance): boolean {
  const def = getCard(card.cardId, card.cardSet);
  if (!def) return false;
  const d = def as { type?: string; uniqueness?: boolean; unique?: boolean };
  if (d.type === "location") return false;
  return d.uniqueness === false || d.unique === false;
}

function opponentTargets(state: GameStateData, side: Side): CardInstance[] {
  const opp: Side = side === "light" ? "dark" : "light";
  const locId = state.startingLocationInstanceId;
  const p = opp === "light" ? state.light : state.dark;
  return p.inPlay.filter((c) => c.instanceId !== locId && !c.faceDown && isNonUniqueCard(c));
}

export function beginPoundedUntoDeath(state: GameStateData, side: Side, effectInstanceId: string): { ok: boolean; error?: string } {
  if (state.phase !== "even_up") return { ok: false, error: "Can only use this during Even Up" };
  if (state.turnSide !== side) return { ok: false, error: "Not your turn" };
  if (state.poundedPending) return { ok: false, error: "Already choosing a card" };
  const p = side === "light" ? state.light : state.dark;
  const effect = p.inPlay.find((c) => c.instanceId === effectInstanceId);
  if (!effect || effect.faceDown) return { ok: false, error: "Effect must be face up" };
  const def = getCard(effect.cardId, effect.cardSet) as { type?: string; effects?: string } | undefined;
  if (!def || def.type !== "effect" || !(def.effects ?? "").toLowerCase().includes("discardopp:nonunique")) {
    return { ok: false, error: "That effect cannot discard an opponent's card" };
  }
  const targets = opponentTargets(state, side);
  if (targets.length === 0) return { ok: false, error: "No face-up non-unique cards to discard" };
  state.poundedPending = {
    side,
    effectInstanceId,
    targets: targets.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, set: c.cardSet })),
  };
  return { ok: true };
}

function discardFromPlay(state: GameStateData, owner: Side, instanceId: string): boolean {
  const p = owner === "light" ? state.light : state.dark;
  const idx = p.inPlay.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const [card] = p.inPlay.splice(idx, 1);
  card.zone = "discard";
  card.faceDown = false;
  p.discard.push(card);
  return true;
}

/** Discard the Effect and the chosen card. The chosen card is not milled for damage. */
export function confirmPoundedUntoDeath(state: GameStateData, side: Side, instanceId: string): { ok: boolean; error?: string } {
  const pending = state.poundedPending;
  if (!pending || pending.side !== side) return { ok: false, error: "No card to discard" };
  if (!pending.targets.some((t) => t.instanceId === instanceId)) return { ok: false, error: "That card cannot be discarded" };
  const opp: Side = side === "light" ? "dark" : "light";
  if (!discardFromPlay(state, opp, instanceId)) return { ok: false, error: "That card is no longer in play" };
  discardFromPlay(state, side, pending.effectInstanceId);
  state.poundedPending = undefined;
  return { ok: true };
}

export function declinePoundedUntoDeath(state: GameStateData, side: Side): boolean {
  if (!state.poundedPending || state.poundedPending.side !== side) return false;
  state.poundedPending = undefined;
  return true;
}
