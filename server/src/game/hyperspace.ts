/**
 * Duel of the Fates Hyperspace: face-up starship zone, full-pile evacuate/intercept,
 * and starship battles (no breakthrough). Classic 1v1 evacuate stays in state.ts.
 */

import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
import { getCard } from "../cards/loader";
import type { EvacuationResult, GameStateData } from "./state";
import {
  drawDestinyCards,
  getCurrentLocationCard,
  getDeckEmptyWinner,
  getEvacuatableCards,
  getLocationPlanet,
  getOpposingStarshipDamageBonus,
  getStarfighterSupportBonus,
  getTransportDamageReductionFromCharacters,
  getTransportSupportBonus,
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

function starshipPrintedPower(cardId: string, set?: string): number | "?" {
  const def = getCard(cardId, set);
  const p = def ? (def as { power?: number | string }).power : 0;
  if (p === "?") return "?";
  return typeof p === "number" ? p : 0;
}

function starshipPower(cardId: string, set?: string): number {
  const p = starshipPrintedPower(cardId, set);
  return p === "?" ? 0 : p;
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
  ship2?: CardInstance;
  battleCard?: CardInstance;
  power: number;
  battleCardBonus?: number;
  supportBonus?: number;
  destinyDraws?: { cardId: string; destiny: number }[];
}

function battleCardText(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (!def) return "";
  const d = def as { gametextbonus?: string; grayboxbonus?: string };
  return `${d.gametextbonus ?? ""};${d.grayboxbonus ?? ""}`.toLowerCase();
}

function battleCardShipPairKinds(cardId: string, set?: string): string[] {
  const m = battleCardText(cardId, set).match(/ships:([^;]+)/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function shipMatchesKind(ship: CardInstance, kind: string): boolean {
  const k = kind.toLowerCase();
  const trait = starshipTrait(ship.cardId, ship.cardSet);
  const id = ship.cardId.toLowerCase();
  const name = cardName(ship.cardId, ship.cardSet).toLowerCase().replace(/[^a-z0-9]/g, "");
  return trait === k || id.includes(k) || name.includes(k) || k === "starship";
}

function twoShipsCoverKinds(ship1: CardInstance, ship2: CardInstance, kinds: string[]): boolean {
  if (kinds.length < 2) return false;
  const a = kinds.map((k) => shipMatchesKind(ship1, k));
  const b = kinds.map((k) => shipMatchesKind(ship2, k));
  return kinds.every((_, i) => a[i] || b[i]);
}

function buildShipFighters(pile: CardInstance[]): { fighters: ShipFighter[]; unused: CardInstance[] } {
  const fighters: ShipFighter[] = [];
  const unused: CardInstance[] = [];
  let i = 0;
  while (i < pile.length) {
    const c = pile[i];
    const t = cardType(c.cardId, c.cardSet);
    if (t === "battle") {
      const kinds = battleCardShipPairKinds(c.cardId, c.cardSet);
      if (kinds.length >= 2) {
        const ships: { j: number; card: CardInstance }[] = [];
        for (let j = i + 1; j < pile.length && ships.length < 2; j++) {
          if (cardType(pile[j].cardId, pile[j].cardSet) === "starship") {
            ships.push({ j, card: pile[j] });
          }
        }
        if (ships.length >= 2 && twoShipsCoverKinds(ships[0].card, ships[1].card, kinds)) {
          for (let k = i + 1; k < ships[1].j; k++) {
            if (pile[k].instanceId !== ships[0].card.instanceId) unused.push(pile[k]);
          }
          fighters.push({
            ship: ships[0].card,
            ship2: ships[1].card,
            battleCard: c,
            power: starshipPower(ships[0].card.cardId, ships[0].card.cardSet) + starshipPower(ships[1].card.cardId, ships[1].card.cardSet),
          });
          i = ships[1].j + 1;
          continue;
        }
      }
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

function battleCardPowerAdd(cardId: string, ship: CardInstance, ship2?: CardInstance): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "battle") return 0;
  const add = (def as { powerAdd?: number }).powerAdd;
  const powerAdd = typeof add === "number" ? add : 0;
  const kinds = battleCardShipPairKinds(cardId);
  if (kinds.length >= 2) {
    if (!ship2 || !twoShipsCoverKinds(ship, ship2, kinds)) return 0;
    return powerAdd;
  }
  const canUse = ((def as { canUse?: string }).canUse ?? "").toLowerCase().trim();
  const trait = starshipTrait(ship.cardId, ship.cardSet);
  const type = cardType(ship.cardId, ship.cardSet);
  if (canUse && canUse !== "any") {
    const parts = canUse.split(",").map((s) => s.trim()).filter(Boolean);
    const shipName = cardName(ship.cardId, ship.cardSet).toLowerCase().replace(/[^a-z0-9]/g, "");
    const ok = parts.some((p) => {
      const token = p.replace(/^◆\s*/, "").replace(/[^a-z0-9]/g, "");
      return p === "any" || p === trait || p === type || ship.cardId.toLowerCase().includes(p) || (token.length > 0 && shipName.includes(token));
    });
    if (!ok) return 0;
  }
  return powerAdd;
}

function shipPlanetPower(cardId: string, set: string | undefined, planet: string): number {
  const def = getCard(cardId, set) as { gametextbonus?: string } | undefined;
  const bonus = def?.gametextbonus ?? "";
  const match = bonus.match(/(\d+)\s*,\s*power\s*,\s*on:([a-z0-9]+)/i);
  if (!match) return 0;
  if (planet.toLowerCase() !== match[2].toLowerCase()) return 0;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : 0;
}

/** Starfighters add destiny to power (like character battles). Power "?" draws destiny for base power. */
function applyStarshipBattleDestiny(state: GameStateData, side: Side, fighter: ShipFighter): void {
  const ships = fighter.ship2 ? [fighter.ship, fighter.ship2] : [fighter.ship];
  const draws: { cardId: string; destiny: number }[] = [];
  let power = fighter.battleCardBonus ?? 0;
  let supportTotal = 0;
  const loc = getCurrentLocationCard(state);
  const planet = loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet) : "";
  for (const ship of ships) {
    const printed = starshipPrintedPower(ship.cardId, ship.cardSet);
    if (printed === "?") {
      const powerDraws = drawDestinyCards(state, side, 1);
      draws.push(...powerDraws);
      power += powerDraws[0]?.destiny ?? 0;
    } else {
      power += printed;
    }
    power += shipPlanetPower(ship.cardId, ship.cardSet, planet);
    if (isStarfighter(ship.cardId, ship.cardSet)) {
      const extra = starshipDestinyAdd(ship.cardId, ship.cardSet);
      const count = printed === "?" ? extra : Math.max(1, extra);
      if (count > 0) {
        const extraDraws = drawDestinyCards(state, side, count);
        draws.push(...extraDraws);
        for (const d of extraDraws) power += d.destiny;
      }
      const support = getStarfighterSupportBonus(state, side);
      if (support > 0) {
        power += support;
        supportTotal += support;
      }
    } else if (isTransport(ship.cardId, ship.cardSet)) {
      const support = getTransportSupportBonus(state, side);
      if (support > 0) {
        power += support;
        supportTotal += support;
      }
    }
  }
  fighter.power = power;
  fighter.destinyDraws = draws;
  if (supportTotal > 0) fighter.supportBonus = supportTotal;
}

function millDamageForStarship(state: GameStateData, side: Side, cardId: string, set?: string): number {
  let dmg = starshipDamage(cardId, set);
  if (isTransport(cardId, set)) {
    dmg -= getTransportDamageReductionFromCharacters(state, side);
  }
  dmg += getOpposingStarshipDamageBonus(state, side);
  return Math.max(0, dmg);
}

function shipSupportLabel(fighter: ShipFighter): string | undefined {
  if (!fighter.supportBonus || fighter.supportBonus <= 0) return undefined;
  if (isTransport(fighter.ship.cardId, fighter.ship.cardSet)) return "transports +" + fighter.supportBonus;
  return "starfighters +" + fighter.supportBonus;
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
    f.battleCardBonus = f.battleCard ? battleCardPowerAdd(f.battleCard.cardId, f.ship, f.ship2) : 0;
  }
  for (const f of darkBuilt.fighters) {
    f.battleCardBonus = f.battleCard ? battleCardPowerAdd(f.battleCard.cardId, f.ship, f.ship2) : 0;
  }

  const pairs = Math.min(lightBuilt.fighters.length, darkBuilt.fighters.length);
  const lightSurvivors: CardInstance[] = [];
  const darkSurvivors: CardInstance[] = [];
  const sequence: NonNullable<GameStateData["battleRevealSequence"]> = [];

  for (let i = 0; i < pairs; i++) {
    const lf = lightBuilt.fighters[i];
    const df = darkBuilt.fighters[i];
    applyStarshipBattleDestiny(state, "light", lf);
    applyStarshipBattleDestiny(state, "dark", df);
    const winner: "light" | "dark" | "tie" = lf.power > df.power ? "light" : df.power > lf.power ? "dark" : "tie";
    let lightMill = 0;
    let darkMill = 0;
    let lightMilled: string[] | undefined;
    let darkMilled: string[] | undefined;
    if (winner === "light") {
      discardCard(state, "dark", df.ship);
      if (df.ship2) discardCard(state, "dark", df.ship2);
      if (df.battleCard) discardCard(state, "dark", df.battleCard);
      lightSurvivors.push(lf.ship);
      if (lf.ship2) lightSurvivors.push(lf.ship2);
      darkMill = millDamageForStarship(state, "dark", df.ship.cardId, df.ship.cardSet);
      if (df.ship2) darkMill += millDamageForStarship(state, "dark", df.ship2.cardId, df.ship2.cardSet);
      if (darkMill > 0) darkMilled = millFromDeck(state, "dark", darkMill);
    } else if (winner === "dark") {
      discardCard(state, "light", lf.ship);
      if (lf.ship2) discardCard(state, "light", lf.ship2);
      if (lf.battleCard) discardCard(state, "light", lf.battleCard);
      darkSurvivors.push(df.ship);
      if (df.ship2) darkSurvivors.push(df.ship2);
      lightMill = millDamageForStarship(state, "light", lf.ship.cardId, lf.ship.cardSet);
      if (lf.ship2) lightMill += millDamageForStarship(state, "light", lf.ship2.cardId, lf.ship2.cardSet);
      if (lightMill > 0) lightMilled = millFromDeck(state, "light", lightMill);
    } else {
      lightSurvivors.push(lf.ship);
      if (lf.ship2) lightSurvivors.push(lf.ship2);
      darkSurvivors.push(df.ship);
      if (df.ship2) darkSurvivors.push(df.ship2);
      if (lf.battleCard) discardCard(state, "light", lf.battleCard);
      if (df.battleCard) discardCard(state, "dark", df.battleCard);
    }
    sequence.push({
      type: "paired",
      lightCardId: lf.ship.cardId,
      darkCardId: df.ship.cardId,
      lightCardName: cardName(lf.ship.cardId, lf.ship.cardSet),
      darkCardName: cardName(df.ship.cardId, df.ship.cardSet),
      lightBasePower: starshipPrintedPower(lf.ship.cardId, lf.ship.cardSet) === "?" ? 0 : starshipPower(lf.ship.cardId, lf.ship.cardSet),
      lightBonus: 0,
      darkBasePower: starshipPrintedPower(df.ship.cardId, df.ship.cardSet) === "?" ? 0 : starshipPower(df.ship.cardId, df.ship.cardSet),
      darkBonus: 0,
      lightPower: lf.power,
      darkPower: df.power,
      winner,
      lightMill: lightMill || undefined,
      darkMill: darkMill || undefined,
      lightMilledCardIds: lightMilled,
      darkMilledCardIds: darkMilled,
      lightDestinyDraws: lf.destinyDraws && lf.destinyDraws.length > 0 ? lf.destinyDraws : undefined,
      darkDestinyDraws: df.destinyDraws && df.destinyDraws.length > 0 ? df.destinyDraws : undefined,
      lightBattleCardId: lf.battleCard?.cardId,
      lightBattleCardName: lf.battleCard ? cardName(lf.battleCard.cardId, lf.battleCard.cardSet) : undefined,
      lightBattleCardBonus: lf.battleCardBonus && lf.battleCardBonus > 0 ? lf.battleCardBonus : undefined,
      darkBattleCardId: df.battleCard?.cardId,
      darkBattleCardName: df.battleCard ? cardName(df.battleCard.cardId, df.battleCard.cardSet) : undefined,
      darkBattleCardBonus: df.battleCardBonus && df.battleCardBonus > 0 ? df.battleCardBonus : undefined,
      lightGametextBonusLabel: shipSupportLabel(lf),
      darkGametextBonusLabel: shipSupportLabel(df),
      lightCardId2: lf.ship2?.cardId,
      lightCardName2: lf.ship2 ? cardName(lf.ship2.cardId, lf.ship2.cardSet) : undefined,
      lightBasePower2: lf.ship2
        ? (starshipPrintedPower(lf.ship2.cardId, lf.ship2.cardSet) === "?" ? 0 : starshipPower(lf.ship2.cardId, lf.ship2.cardSet))
        : undefined,
      darkCardId2: df.ship2?.cardId,
      darkCardName2: df.ship2 ? cardName(df.ship2.cardId, df.ship2.cardSet) : undefined,
      darkBasePower2: df.ship2
        ? (starshipPrintedPower(df.ship2.cardId, df.ship2.cardSet) === "?" ? 0 : starshipPower(df.ship2.cardId, df.ship2.cardSet))
        : undefined,
    });
  }

  for (let i = pairs; i < lightBuilt.fighters.length; i++) {
    lightSurvivors.push(lightBuilt.fighters[i].ship);
    if (lightBuilt.fighters[i].ship2) lightSurvivors.push(lightBuilt.fighters[i].ship2!);
    if (lightBuilt.fighters[i].battleCard) discardCard(state, "light", lightBuilt.fighters[i].battleCard!);
  }
  for (let i = pairs; i < darkBuilt.fighters.length; i++) {
    darkSurvivors.push(darkBuilt.fighters[i].ship);
    if (darkBuilt.fighters[i].ship2) darkSurvivors.push(darkBuilt.fighters[i].ship2!);
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
