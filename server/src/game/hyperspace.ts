/**
 * Duel of the Fates Hyperspace: face-up starship zone, full-pile evacuate/intercept,
 * and starship battles (no breakthrough). Classic 1v1 evacuate stays in state.ts.
 */

import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
import { getCard } from "../cards/loader";
import type { EvacuationResult, GameStateData } from "./state";
import {
  drawDestiny,
  getCurrentLocationCard,
  getDeckEmptyWinner,
  getEvacuatableCards,
  getLocationPlanet,
  millFromDeck,
  shuffleDeck,
} from "./state";

function cardType(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  return def ? ((def as { type?: string }).type ?? "") : "";
}

function cardName(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (def && typeof (def as { name?: string }).name === "string") return (def as { name: string }).name;
  return cardId;
}

function starshipTrait(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "starship") return "";
  return ((def as { trait?: string }).trait ?? "").toLowerCase();
}

export function isStarship(cardId: string, set?: string): boolean {
  return cardType(cardId, set) === "starship";
}

export function isTransport(cardId: string, set?: string): boolean {
  return starshipTrait(cardId, set) === "transport";
}

export function isStarfighter(cardId: string, set?: string): boolean {
  return starshipTrait(cardId, set) === "starfighter";
}

function starshipPower(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  const p = def ? (def as { power?: number }).power : 0;
  return typeof p === "number" ? p : 0;
}

function starshipDamage(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  const d = def ? (def as { damage?: number }).damage : 0;
  return typeof d === "number" ? d : 0;
}

function starshipDestinyAdd(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  const v = def ? (def as { destinyAdd?: number }).destinyAdd : 0;
  return typeof v === "number" ? Math.max(0, v) : 0;
}

function isUniqueStarship(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def) return false;
  const d = def as { unique?: boolean; uniqueness?: boolean };
  return d.unique === true || d.uniqueness === true;
}

export function getHyperspace(state: GameStateData, side: Side): CardInstance[] {
  const p = side === "light" ? state.light : state.dark;
  if (!p.hyperspace) p.hyperspace = [];
  return p.hyperspace;
}

export function hasTransportInHyperspace(state: GameStateData, side: Side): boolean {
  return getHyperspace(state, side).some((c) => isTransport(c.cardId, c.cardSet));
}

export function hasStarshipInHyperspace(state: GameStateData, side: Side): boolean {
  return getHyperspace(state, side).length > 0;
}

export function wouldViolateStarshipUniqueness(state: GameStateData, side: Side, cardId: string, cardSet?: string): boolean {
  if (!isUniqueStarship(cardId, cardSet)) return false;
  return getHyperspace(state, side).some((c) => c.cardId === cardId);
}

export function playCardToHyperspace(state: GameStateData, side: Side, instanceId: string): boolean {
  const p = side === "light" ? state.light : state.dark;
  if (!p.hyperspace) p.hyperspace = [];
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const [card] = p.hand.splice(idx, 1);
  if (!isStarship(card.cardId, card.cardSet)) {
    p.hand.splice(idx, 0, card);
    return false;
  }
  card.zone = "hyperspace";
  card.faceDown = false;
  card.position = p.hyperspace.length;
  p.hyperspace.push(card);
  return true;
}

function planetLabel(state: GameStateData, planetIndex: number): string {
  if (planetIndex === -1) {
    const loc = getCurrentLocationCard(state);
    return loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet) : "Current";
  }
  const controlled = state.controlledPlanets ?? [];
  if (planetIndex >= 0 && planetIndex < controlled.length) return controlled[planetIndex].planet;
  return "Planet";
}

function removeStackedFromLocation(state: GameStateData, side: Side, planetIndex: number, cards: { instanceId: string; cardId: string }[]): void {
  const p = side === "light" ? state.light : state.dark;
  if (planetIndex === -1) {
    const ids = new Set(cards.map((c) => c.instanceId));
    p.inPlay = p.inPlay.filter((c) => !ids.has(c.instanceId));
    return;
  }
  const controlled = state.controlledPlanets ?? [];
  const cp = controlled[planetIndex];
  if (!cp) return;
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  const ids = new Set(cards.map((c) => c.instanceId));
  const list = (cp[strandedKey] ?? []) as { instanceId: string; cardId: string }[];
  cp[strandedKey] = list.filter((c) => !ids.has(c.instanceId));
}

export function startHyperspaceEvacuation(state: GameStateData, side: Side, targetPlanetIndex: number): boolean {
  if (!hasTransportInHyperspace(state, side)) return false;
  const cards = getEvacuatableCards(state, side, targetPlanetIndex);
  if (cards.length === 0) return false;

  removeStackedFromLocation(state, side, targetPlanetIndex, cards);
  const firstTransport = getHyperspace(state, side).find((c) => isTransport(c.cardId, c.cardSet));
  state.evacuationState = {
    evacuatingSide: side,
    transportInstanceId: firstTransport?.instanceId ?? "",
    transportCardId: firstTransport?.cardId ?? "",
    targetPlanetIndex,
    stackedCards: [...cards],
    awaitingInterception: true,
  };
  return true;
}

function finishEvacuationWithoutBattle(state: GameStateData, success: boolean): EvacuationResult {
  const evac = state.evacuationState!;
  const evacuatingSide = evac.evacuatingSide;
  const ep = evacuatingSide === "light" ? state.light : state.dark;
  const result: EvacuationResult = {
    evacuatingSide,
    transportCardId: evac.transportCardId,
    transportName: cardName(evac.transportCardId),
    targetPlanet: planetLabel(state, evac.targetPlanetIndex),
    stackedCardIds: evac.stackedCards.map((c) => c.cardId),
    intercepted: false,
    transportPower: 0,
    outcome: success ? "success" : "transport_destroyed",
  };
  if (success) {
    const evacuatedIds: string[] = [];
    for (const sc of evac.stackedCards) {
      ep.deck.push({
        instanceId: sc.instanceId,
        cardId: sc.cardId,
        ownerSide: evacuatingSide,
        zone: "deck",
      });
      evacuatedIds.push(sc.cardId);
    }
    shuffleDeck(ep.deck);
    result.evacuatedCardIds = evacuatedIds;
  } else {
    const discardedIds: string[] = [];
    for (const sc of evac.stackedCards) {
      ep.discard.push({
        instanceId: sc.instanceId,
        cardId: sc.cardId,
        ownerSide: evacuatingSide,
        zone: "discard",
        faceDown: false,
      });
      discardedIds.push(sc.cardId);
    }
    result.discardedCardIds = discardedIds;
  }
  state.evacuationState = undefined;
  state.evacuationResult = result;
  return result;
}

export function declineHyperspaceIntercept(state: GameStateData): EvacuationResult | null {
  const evac = state.evacuationState;
  if (!evac || !evac.awaitingInterception) return null;
  evac.awaitingInterception = false;
  return finishEvacuationWithoutBattle(state, true);
}

export function beginHyperspaceIntercept(state: GameStateData, interceptorSide: Side): boolean {
  const evac = state.evacuationState;
  if (!evac || !evac.awaitingInterception) return false;
  if (evac.evacuatingSide === interceptorSide) return false;
  if (!hasStarshipInHyperspace(state, interceptorSide)) return false;
  evac.awaitingInterception = false;
  evac.interceptorInstanceId = "hyperspace";
  evac.interceptorCardId = getHyperspace(state, interceptorSide)[0]?.cardId;
  state.starshipBattlePhase = true;
  state.starshipBattleAttacker = interceptorSide;
  state.battleCardDeclareSide = interceptorSide;
  state.lightDeclaredBattleCards = undefined;
  state.darkDeclaredBattleCards = undefined;
  state.lightBattlePlanOrder = undefined;
  state.darkBattlePlanOrder = undefined;
  state.lightBattlePlanReady = false;
  state.darkBattlePlanReady = false;
  state.battlePlanPhase = false;
  state.phaseStartedAt = Date.now();
  return true;
}

interface ShipFighter {
  ship: CardInstance;
  battleCard?: CardInstance;
  power: number;
  destinyDraws?: { cardId: string; destiny: number }[];
}

function buildShipFighters(pile: CardInstance[]): { fighters: ShipFighter[]; unused: CardInstance[] } {
  const fighters: ShipFighter[] = [];
  const unused: CardInstance[] = [];
  let i = 0;
  while (i < pile.length) {
    const c = pile[i];
    const t = cardType(c.cardId, c.cardSet);
    if (t === "battle") {
      let ship: CardInstance | undefined;
      let j = i + 1;
      while (j < pile.length) {
        if (cardType(pile[j].cardId, pile[j].cardSet) === "starship") {
          ship = pile[j];
          break;
        }
        unused.push(pile[j]);
        j++;
      }
      if (ship) {
        fighters.push({ ship, battleCard: c, power: starshipPower(ship.cardId, ship.cardSet) });
        i = j + 1;
      } else {
        unused.push(c);
        i++;
      }
      continue;
    }
    if (t === "starship") {
      fighters.push({ ship: c, power: starshipPower(c.cardId, c.cardSet) });
      i++;
      continue;
    }
    unused.push(c);
    i++;
  }
  return { fighters, unused };
}

function battleCardPowerAdd(cardId: string, shipCardId: string, set?: string): number {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "battle") return 0;
  const canUse = ((def as { canUse?: string }).canUse ?? "").toLowerCase().trim();
  const trait = starshipTrait(shipCardId);
  const type = cardType(shipCardId);
  if (canUse && canUse !== "any") {
    const parts = canUse.split(",").map((s) => s.trim()).filter(Boolean);
    const ok = parts.some((p) => p === "any" || p === trait || p === type || shipCardId.toLowerCase().includes(p));
    if (!ok) return 0;
  }
  const add = (def as { powerAdd?: number }).powerAdd;
  return typeof add === "number" ? add : 0;
}

function applyStarfighterDestiny(state: GameStateData, side: Side, fighter: ShipFighter): void {
  if (!isStarfighter(fighter.ship.cardId, fighter.ship.cardSet)) return;
  const extra = starshipDestinyAdd(fighter.ship.cardId, fighter.ship.cardSet);
  const draws = 1 + extra;
  fighter.destinyDraws = [];
  for (let i = 0; i < draws; i++) {
    const dest = drawDestiny(state, side);
    const p = side === "light" ? state.light : state.dark;
    const top = p.discard[p.discard.length - 1];
    fighter.destinyDraws.push({ cardId: top?.cardId ?? "", destiny: dest });
    fighter.power += dest;
  }
}

function discardCard(state: GameStateData, side: Side, card: CardInstance): void {
  const p = side === "light" ? state.light : state.dark;
  card.zone = "discard";
  card.faceDown = false;
  p.discard.push(card);
}

function returnToHyperspace(state: GameStateData, side: Side, card: CardInstance): void {
  const p = side === "light" ? state.light : state.dark;
  if (!p.hyperspace) p.hyperspace = [];
  card.zone = "hyperspace";
  card.faceDown = false;
  card.position = p.hyperspace.length;
  p.hyperspace.push(card);
}

function orderToPile(state: GameStateData, side: Side, order: string[]): CardInstance[] {
  const p = side === "light" ? state.light : state.dark;
  const hs = p.hyperspace ?? [];
  const declared = (side === "light" ? state.lightDeclaredBattleCards : state.darkDeclaredBattleCards) ?? [];
  const byId = new Map<string, CardInstance>();
  for (const c of hs) byId.set(c.instanceId, c);
  for (const id of declared) {
    const handCard = p.hand.find((c) => c.instanceId === id);
    if (handCard) byId.set(id, handCard);
  }
  const pile: CardInstance[] = [];
  for (const id of order) {
    const c = byId.get(id);
    if (c) pile.push(c);
  }
  return pile;
}

function takeShipsAndBattleCardsOffBoard(state: GameStateData, side: Side, pile: CardInstance[]): void {
  const p = side === "light" ? state.light : state.dark;
  const ids = new Set(pile.map((c) => c.instanceId));
  p.hyperspace = (p.hyperspace ?? []).filter((c) => !ids.has(c.instanceId));
  p.hand = p.hand.filter((c) => !ids.has(c.instanceId));
}

/**
 * Resolve a Hyperspace starship battle, then complete the evacuation.
 * Survivors return to Hyperspace. No breakthrough mill.
 */
export function resolveStarshipBattle(state: GameStateData): void {
  const evac = state.evacuationState;
  const attacker: Side = state.starshipBattleAttacker ?? "light";
  const defender: Side = attacker === "light" ? "dark" : "light";
  const lightOrder = state.lightBattlePlanOrder ?? (state.light.hyperspace ?? []).map((c) => c.instanceId);
  const darkOrder = state.darkBattlePlanOrder ?? (state.dark.hyperspace ?? []).map((c) => c.instanceId);
  const lightPile = orderToPile(state, "light", lightOrder);
  const darkPile = orderToPile(state, "dark", darkOrder);
  takeShipsAndBattleCardsOffBoard(state, "light", lightPile);
  takeShipsAndBattleCardsOffBoard(state, "dark", darkPile);

  const lightBuilt = buildShipFighters(lightPile);
  const darkBuilt = buildShipFighters(darkPile);
  for (const f of lightBuilt.fighters) {
    f.power += f.battleCard ? battleCardPowerAdd(f.battleCard.cardId, f.ship.cardId, f.battleCard.cardSet) : 0;
    applyStarfighterDestiny(state, "light", f);
  }
  for (const f of darkBuilt.fighters) {
    f.power += f.battleCard ? battleCardPowerAdd(f.battleCard.cardId, f.ship.cardId, f.battleCard.cardSet) : 0;
    applyStarfighterDestiny(state, "dark", f);
  }

  const pairs = Math.min(lightBuilt.fighters.length, darkBuilt.fighters.length);
  const lightSurvivors: CardInstance[] = [];
  const darkSurvivors: CardInstance[] = [];
  const sequence: NonNullable<GameStateData["battleRevealSequence"]> = [];

  for (let i = 0; i < pairs; i++) {
    const lf = lightBuilt.fighters[i];
    const df = darkBuilt.fighters[i];
    const winner: "light" | "dark" | "tie" = lf.power > df.power ? "light" : df.power > lf.power ? "dark" : "tie";
    let lightMill = 0;
    let darkMill = 0;
    let lightMilled: string[] | undefined;
    let darkMilled: string[] | undefined;
    if (winner === "light") {
      discardCard(state, "dark", df.ship);
      if (df.battleCard) discardCard(state, "dark", df.battleCard);
      lightSurvivors.push(lf.ship);
      darkMill = starshipDamage(df.ship.cardId, df.ship.cardSet);
      if (darkMill > 0) darkMilled = millFromDeck(state, "dark", darkMill);
    } else if (winner === "dark") {
      discardCard(state, "light", lf.ship);
      if (lf.battleCard) discardCard(state, "light", lf.battleCard);
      darkSurvivors.push(df.ship);
      lightMill = starshipDamage(lf.ship.cardId, lf.ship.cardSet);
      if (lightMill > 0) lightMilled = millFromDeck(state, "light", lightMill);
    } else {
      lightSurvivors.push(lf.ship);
      darkSurvivors.push(df.ship);
      if (lf.battleCard) discardCard(state, "light", lf.battleCard);
      if (df.battleCard) discardCard(state, "dark", df.battleCard);
    }
    sequence.push({
      type: "paired",
      lightCardId: lf.ship.cardId,
      darkCardId: df.ship.cardId,
      lightCardName: cardName(lf.ship.cardId, lf.ship.cardSet),
      darkCardName: cardName(df.ship.cardId, df.ship.cardSet),
      lightBasePower: starshipPower(lf.ship.cardId, lf.ship.cardSet),
      lightBonus: lf.power - starshipPower(lf.ship.cardId, lf.ship.cardSet),
      darkBasePower: starshipPower(df.ship.cardId, df.ship.cardSet),
      darkBonus: df.power - starshipPower(df.ship.cardId, df.ship.cardSet),
      lightPower: lf.power,
      darkPower: df.power,
      winner,
      lightMill: lightMill || undefined,
      darkMill: darkMill || undefined,
      lightMilledCardIds: lightMilled,
      darkMilledCardIds: darkMilled,
    });
  }

  for (let i = pairs; i < lightBuilt.fighters.length; i++) {
    lightSurvivors.push(lightBuilt.fighters[i].ship);
    if (lightBuilt.fighters[i].battleCard) discardCard(state, "light", lightBuilt.fighters[i].battleCard!);
  }
  for (let i = pairs; i < darkBuilt.fighters.length; i++) {
    darkSurvivors.push(darkBuilt.fighters[i].ship);
    if (darkBuilt.fighters[i].battleCard) discardCard(state, "dark", darkBuilt.fighters[i].battleCard!);
  }
  for (const c of lightBuilt.unused) discardCard(state, "light", c);
  for (const c of darkBuilt.unused) discardCard(state, "dark", c);

  for (const c of lightSurvivors) returnToHyperspace(state, "light", c);
  for (const c of darkSurvivors) returnToHyperspace(state, "dark", c);

  if (sequence.length > 0) state.battleRevealSequence = sequence;

  state.starshipBattlePhase = undefined;
  state.starshipBattleAttacker = undefined;
  state.battleCardDeclareSide = undefined;
  state.battlePlanPhase = false;
  state.lightDeclaredBattleCards = undefined;
  state.darkDeclaredBattleCards = undefined;
  state.lightBattlePlanOrder = undefined;
  state.darkBattlePlanOrder = undefined;
  state.lightBattlePlanReady = false;
  state.darkBattlePlanReady = false;

  if (!evac) return;
  const evacuatingSide = evac.evacuatingSide;
  const defenderShips = getHyperspace(state, evacuatingSide);
  const transportSurvived = defenderShips.some((c) => isTransport(c.cardId, c.cardSet));
  const ep = evacuatingSide === "light" ? state.light : state.dark;
  const result: EvacuationResult = {
    evacuatingSide,
    transportCardId: evac.transportCardId,
    transportName: cardName(evac.transportCardId),
    targetPlanet: planetLabel(state, evac.targetPlanetIndex),
    stackedCardIds: evac.stackedCards.map((c) => c.cardId),
    intercepted: true,
    interceptorCardId: evac.interceptorCardId,
    transportPower: 0,
    outcome: transportSurvived ? "success" : "transport_destroyed",
  };
  if (transportSurvived) {
    const evacuatedIds: string[] = [];
    for (const sc of evac.stackedCards) {
      ep.deck.push({
        instanceId: sc.instanceId,
        cardId: sc.cardId,
        ownerSide: evacuatingSide,
        zone: "deck",
      });
      evacuatedIds.push(sc.cardId);
    }
    shuffleDeck(ep.deck);
    result.evacuatedCardIds = evacuatedIds;
  } else {
    const discardedIds: string[] = [];
    for (const sc of evac.stackedCards) {
      ep.discard.push({
        instanceId: sc.instanceId,
        cardId: sc.cardId,
        ownerSide: evacuatingSide,
        zone: "discard",
        faceDown: false,
      });
      discardedIds.push(sc.cardId);
    }
    result.discardedCardIds = discardedIds;
  }
  state.evacuationState = undefined;
  state.evacuationResult = result;
  void getDeckEmptyWinner(state);
}
