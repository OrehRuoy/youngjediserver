import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";
import { shuffleDeck, spendForce, wouldViolateUniquenessAtLocationWeapon, wouldViolateUniquenessWeapon } from "./state";

function isJedi(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "character") return false;
  const traits = ((def as { trait?: string }).trait ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return traits.includes("jedi");
}

function isLightsaber(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "weapon") return false;
  const id = cardId.toLowerCase();
  const name = ((def as { name?: string }).name ?? "").toLowerCase();
  const trait = ((def as { trait?: string }).trait ?? "").toLowerCase();
  return id.includes("lightsaber") || name.includes("lightsaber") || trait.includes("lightsaber");
}

function weaponCost(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  return Math.floor(Number((def as { cost?: number } | undefined)?.cost)) || 0;
}

function onDeployWho(effects: string): string | null {
  const match = effects.toLowerCase().match(/ondeploy:([^:]+):lightsaber/);
  return match ? match[1] : null;
}

function matchesOnDeployWho(cardId: string, set: string | undefined, who: string): boolean {
  if (who === "jedi") return isJedi(cardId, set);
  const def = getCard(cardId, set);
  const persona = ((def as { persona?: string } | undefined)?.persona ?? "").toLowerCase();
  const id = cardId.toLowerCase();
  return who
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .some((token) => persona === token || id.includes(token));
}

function trainingEffect(state: GameStateData, side: Side, deployed: CardInstance): CardInstance | undefined {
  const p = side === "light" ? state.light : state.dark;
  return p.inPlay.find((c) => {
    if (c.faceDown) return false;
    const def = getCard(c.cardId, c.cardSet) as { type?: string; effects?: string } | undefined;
    if (def?.type !== "effect") return false;
    const who = onDeployWho(def.effects ?? "");
    return !!who && matchesOnDeployWho(deployed.cardId, deployed.cardSet, who);
  });
}

/** Offer a lightsaber deploy after a face-up matching character deploys. Face-down deploys do not trigger it. */
export function maybeBeginJediTraining(state: GameStateData, side: Side, jedi: CardInstance | undefined): boolean {
  if (!jedi || jedi.faceDown) return false;
  if (state.jediTrainingPending || state.deployFromDeckPending || state.effectActivationPending) return false;
  const effect = trainingEffect(state, side, jedi);
  if (!effect) return false;
  const p = side === "light" ? state.light : state.dark;
  const choices = p.deck
    .filter((c) => isLightsaber(c.cardId, c.cardSet))
    .filter((c) => !wouldViolateUniquenessWeapon(state, side, c.cardId, c.cardSet))
    .filter((c) => !wouldViolateUniquenessAtLocationWeapon(state, side, c.cardId, c.cardSet))
    .map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      set: c.cardSet,
      cost: weaponCost(c.cardId, c.cardSet),
    }));
  if (choices.length === 0) return false;
  state.jediTrainingPending = {
    side,
    effectInstanceId: effect.instanceId,
    jediInstanceId: jedi.instanceId,
    jediCardId: jedi.cardId,
    choices,
  };
  return true;
}

export function confirmJediTraining(state: GameStateData, side: Side, instanceId: string): { ok: boolean; error?: string } {
  const pending = state.jediTrainingPending;
  if (!pending || pending.side !== side) return { ok: false, error: "No lightsaber to deploy" };
  const choice = pending.choices.find((c) => c.instanceId === instanceId);
  if (!choice) return { ok: false, error: "That card is not one of the lightsabers" };
  const p = side === "light" ? state.light : state.dark;
  const idx = p.deck.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return { ok: false, error: "Lightsaber is no longer in your deck" };
  const effectIdx = p.inPlay.findIndex((c) => c.instanceId === pending.effectInstanceId);
  if (effectIdx < 0) {
    state.jediTrainingPending = undefined;
    return { ok: false, error: "Jedi Training is no longer in play" };
  }
  if (choice.cost > 0 && !spendForce(state, side, choice.cost)) {
    return { ok: false, error: "Not enough counters to deploy that lightsaber" };
  }
  const [saber] = p.deck.splice(idx, 1);
  saber.zone = "in_play";
  saber.faceDown = false;
  saber.position = p.inPlay.length;
  p.inPlay.push(saber);
  const [effect] = p.inPlay.splice(effectIdx, 1);
  effect.zone = "discard";
  effect.faceDown = false;
  p.discard.push(effect);
  shuffleDeck(p.deck);
  state.jediTrainingPending = undefined;
  return { ok: true };
}

export function declineJediTraining(state: GameStateData, side: Side): boolean {
  const pending = state.jediTrainingPending;
  if (!pending || pending.side !== side) return false;
  const p = side === "light" ? state.light : state.dark;
  shuffleDeck(p.deck);
  state.jediTrainingPending = undefined;
  return true;
}
