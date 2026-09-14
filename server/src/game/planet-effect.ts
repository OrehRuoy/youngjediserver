import type { Side } from "../types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";
import { shuffleDeck } from "./state";
import { usesPlanetEffectFetch } from "./ruleset";

function isEffect(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  return !!def && (def as { type?: string }).type === "effect";
}

function cardName(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (def && typeof (def as { name?: string }).name === "string") return (def as { name: string }).name;
  return cardId;
}

export function beginPlanetEffectFetch(state: GameStateData, locationChooser: Side): void {
  if (!usesPlanetEffectFetch(state)) return;
  state.planetEffectFetch = {
    chooserSide: locationChooser,
    locationChooser,
    lightDone: false,
    darkDone: false,
  };
}

export function listFetchableEffects(state: GameStateData, side: Side): { instanceId: string; cardId: string; set?: string }[] {
  const p = side === "light" ? state.light : state.dark;
  return p.deck
    .filter((c) => isEffect(c.cardId, c.cardSet))
    .map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, ...(c.cardSet ? { set: c.cardSet } : {}) }));
}

function finishChooser(state: GameStateData, side: Side): void {
  const fetch = state.planetEffectFetch;
  if (!fetch) return;
  if (side === "light") fetch.lightDone = true;
  else fetch.darkDone = true;
  if (fetch.lightDone && fetch.darkDone) {
    state.planetEffectFetch = undefined;
    return;
  }
  const other: Side = side === "light" ? "dark" : "light";
  fetch.chooserSide = other;
}

export function fetchPlanetEffect(state: GameStateData, side: Side, instanceId: string): boolean {
  const fetch = state.planetEffectFetch;
  if (!fetch || fetch.chooserSide !== side) return false;
  const p = side === "light" ? state.light : state.dark;
  const idx = p.deck.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const card = p.deck[idx];
  if (!isEffect(card.cardId, card.cardSet)) return false;
  p.deck.splice(idx, 1);
  card.zone = "hand";
  card.faceDown = false;
  card.position = p.hand.length;
  p.hand.push(card);
  shuffleDeck(p.deck);
  fetch.lastFetched = { side, cardId: card.cardId, name: cardName(card.cardId, card.cardSet) };
  finishChooser(state, side);
  return true;
}

export function skipPlanetEffect(state: GameStateData, side: Side): boolean {
  const fetch = state.planetEffectFetch;
  if (!fetch || fetch.chooserSide !== side) return false;
  fetch.lastFetched = undefined;
  finishChooser(state, side);
  return true;
}

export function snapshotPlanetEffectFetch(
  state: GameStateData,
  forSide?: Side
): Record<string, unknown> | undefined {
  const fetch = state.planetEffectFetch;
  if (!fetch) return undefined;
  const view: Record<string, unknown> = {
    chooserSide: fetch.chooserSide,
    locationChooser: fetch.locationChooser,
    lightDone: fetch.lightDone,
    darkDone: fetch.darkDone,
  };
  if (fetch.lastFetched) view.lastFetched = fetch.lastFetched;
  if (forSide && fetch.chooserSide === forSide) {
    view.effectChoices = listFetchableEffects(state, forSide);
  }
  return view;
}

export type PlanetEffectFetchState = {
  chooserSide: Side;
  locationChooser: Side;
  lightDone: boolean;
  darkDone: boolean;
  lastFetched?: { side: Side; cardId: string; name: string };
};
