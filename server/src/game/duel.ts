/**
 * Lightsaber dueling: once per your Battle step, before the planet battle.
 */

import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";
import {
  getCharactersAtLocation,
  getCurrentLocationCard,
  getGametextBonusForCharacter,
  getLocationBonusForCharacter,
  characterGrantsWeaponUse,
  getWeaponPowerAddForCharacter,
  markFoughtThisTurn,
  millFromDeck,
  shuffleDeck,
} from "./state";
import { usesDueling } from "./ruleset";

export type DuelStep = "choose_target" | "defender_respond" | "play";

export interface DuelState {
  step: DuelStep;
  initiator: Side;
  attackerCharInstanceId: string;
  attackerWeaponInstanceId: string;
  defenderCharInstanceId?: string;
  defenderWeaponInstanceId?: string;
  lightPower: number;
  darkPower: number;
  lightHits: number;
  darkHits: number;
  lightDuelHand: CardInstance[];
  darkDuelHand: CardInstance[];
  lightSetAside: CardInstance[];
  darkSetAside: CardInstance[];
  lightPlayed: CardInstance[];
  darkPlayed: CardInstance[];
  currentAttacker: Side;
  pendingAttack?: { instanceId: string; cardId: string; destiny: number; side: Side; cardSet?: string; bonusHits?: number; discarded?: boolean };
  anakinDestinyCardId?: string;
  /** Duel-hand cards that already removed one hit. */
  hitRemovalUsed?: string[];
}

function destValue(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  if (!def || typeof (def as { destiny?: number }).destiny !== "number") return 0;
  return (def as { destiny: number }).destiny;
}

function duelCardText(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (!def) return "";
  const d = def as { gametextbonus?: string; grayboxbonus?: string };
  return `${d.gametextbonus ?? ""};${d.grayboxbonus ?? ""}`.toLowerCase();
}

function duelHitsForAttack(cardId: string, set?: string): number {
  return duelCardText(cardId, set).includes("duel:extrahit") ? 2 : 1;
}

function hitsForPending(pending: { cardId: string; cardSet?: string; bonusHits?: number }): number {
  if ((pending.bonusHits ?? 0) > 0) return 1 + (pending.bonusHits ?? 0);
  return duelHitsForAttack(pending.cardId, pending.cardSet);
}

function cardAllowsDiscardExtraHits(cardId: string, set?: string): boolean {
  return duelCardText(cardId, set).includes("duel:discard:extrahit2");
}

function cardAllowsRemoveHit(cardId: string, set?: string): boolean {
  return duelCardText(cardId, set).includes("duel:removehit");
}

function printedPower(cardId: string, set?: string): number | "?" {
  const def = getCard(cardId, set);
  const p = def ? (def as { power?: number | string }).power : 0;
  if (p === "?") return "?";
  return typeof p === "number" ? p : 0;
}

function printedDamage(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  const d = def ? (def as { damage?: number }).damage : 0;
  return typeof d === "number" ? d : 0;
}

function isCharacter(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  return !!def && (def as { type?: string }).type === "character";
}

function isWeapon(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  return !!def && (def as { type?: string }).type === "weapon";
}

function isLightsaber(cardId: string, set?: string): boolean {
  if (!isWeapon(cardId, set)) return false;
  const def = getCard(cardId, set);
  const id = cardId.toLowerCase();
  const name = ((def as { name?: string } | undefined)?.name ?? "").toLowerCase();
  const trait = ((def as { trait?: string } | undefined)?.trait ?? "").toLowerCase();
  return id.includes("lightsaber") || name.includes("lightsaber") || trait.includes("lightsaber");
}

function characterMatchesCanUse(characterCardId: string, canUse: string | undefined): boolean {
  if (typeof canUse !== "string" || !canUse.trim()) return false;
  const trimmed = canUse.trim();
  if (trimmed.toLowerCase() === "any") return true;
  const charDef = getCard(characterCardId);
  if (!charDef) return false;
  const charName = ((charDef as { name?: string }).name ?? "").toLowerCase();
  const charId = characterCardId.toLowerCase();
  const charPersona = ((charDef as { persona?: string }).persona ?? "").toLowerCase();
  const charTraits = ((charDef as { trait?: string }).trait ?? "").toLowerCase().split(",").map((s) => s.trim());
  return trimmed.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((part) => {
    const p = part.replace(/^◆\s*/, "");
    return charPersona === p || charTraits.includes(p) || charName.includes(p) || charId.includes(p) || p === "any";
  });
}

function weaponUsableBy(weaponCardId: string, characterCardId: string, weaponSet?: string): boolean {
  const def = getCard(weaponCardId, weaponSet);
  if (!def || (def as { type?: string }).type !== "weapon") return false;
  const canUse = (def as { canUse?: string }).canUse;
  const canUse2 = (def as { canUse2?: string }).canUse2;
  return (
    characterMatchesCanUse(characterCardId, canUse) ||
    characterMatchesCanUse(characterCardId, canUse2) ||
    characterGrantsWeaponUse(characterCardId, weaponCardId, weaponSet)
  );
}

export function isLightDuelist(cardId: string, set?: string): boolean {
  if (!isCharacter(cardId, set)) return false;
  const def = getCard(cardId, set);
  const id = cardId.toLowerCase();
  const persona = ((def as { persona?: string } | undefined)?.persona ?? "").toLowerCase();
  if (id.includes("anakinskywalker") || persona === "anakin") return false;
  if (persona === "obiwan" || persona === "quigon") return true;
  const trait = ((def as { trait?: string } | undefined)?.trait ?? "").toLowerCase();
  return trait.split(",").map((s) => s.trim()).includes("jedi");
}

export function isDarkDuelist(cardId: string, set?: string): boolean {
  if (!isCharacter(cardId, set)) return false;
  const id = cardId.toLowerCase();
  return id.startsWith("darthmaul") || id.startsWith("darthsidious") || id.startsWith("aurrasing");
}

export function isDuelist(cardId: string, side: Side, set?: string): boolean {
  return side === "light" ? isLightDuelist(cardId, set) : isDarkDuelist(cardId, set);
}

function findAtLocation(state: GameStateData, side: Side, instanceId: string): CardInstance | undefined {
  return getCharactersAtLocation(state, side, true).find((c) => c.instanceId === instanceId);
}

function duelPower(
  state: GameStateData,
  side: Side,
  char: CardInstance,
  weapon?: CardInstance,
  anakinPower?: number,
  opponent?: CardInstance
): number {
  const printed = printedPower(char.cardId, char.cardSet);
  let power = printed === "?" ? (anakinPower ?? 0) : printed;
  const loc = getCurrentLocationCard(state);
  if (loc) power += getLocationBonusForCharacter(char.cardId, loc.card.cardId);
  if (weapon) power += getWeaponPowerAddForCharacter(weapon.cardId, char.cardId, weapon.cardSet, opponent?.cardId);
  power += getGametextBonusForCharacter(
    char.cardId,
    char.cardSet,
    weapon?.cardId,
    opponent?.cardId,
    weapon?.cardSet,
    undefined,
    undefined,
    state,
    true
  ).bonus;
  return Math.max(0, power);
}

function moveHandAside(p: { hand: CardInstance[] }): CardInstance[] {
  const aside = [...p.hand];
  p.hand = [];
  for (const c of aside) c.zone = "hand";
  return aside;
}

function drawDuelHand(p: { deck: CardInstance[]; }, count: number): CardInstance[] {
  const n = Math.min(count, p.deck.length);
  const hand: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    const card = p.deck.pop()!;
    card.zone = "hand";
    card.faceDown = false;
    hand.push(card);
  }
  return hand;
}

function duelBonusDrawsForCard(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  if (!def) return 0;
  const d = def as { gametextbonus?: string; grayboxbonus?: string };
  const text = `${d.gametextbonus ?? ""};${d.grayboxbonus ?? ""}`.toLowerCase();
  const m = text.match(/duel:draw(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function applyDuelHandBonusDraws(state: GameStateData, d: DuelState): void {
  const extraLight = d.lightDuelHand.reduce((sum, c) => sum + duelBonusDrawsForCard(c.cardId, c.cardSet), 0);
  const extraDark = d.darkDuelHand.reduce((sum, c) => sum + duelBonusDrawsForCard(c.cardId, c.cardSet), 0);
  if (extraLight > 0) d.lightDuelHand.push(...drawDuelHand(state.light, extraLight));
  if (extraDark > 0) d.darkDuelHand.push(...drawDuelHand(state.dark, extraDark));
}

function restoreHands(state: GameStateData): void {
  const d = state.duelState;
  if (!d) return;
  state.light.hand = [...d.lightSetAside];
  state.dark.hand = [...d.darkSetAside];
  for (const c of state.light.hand) c.zone = "hand";
  for (const c of state.dark.hand) c.zone = "hand";
}

function collectDuelCards(d: DuelState, side: Side): CardInstance[] {
  if (side === "light") return [...d.lightDuelHand, ...d.lightPlayed];
  return [...d.darkDuelHand, ...d.darkPlayed];
}

function reshuffleDuelCards(state: GameStateData): void {
  const d = state.duelState;
  if (!d) return;
  for (const side of ["light", "dark"] as Side[]) {
    const p = side === "light" ? state.light : state.dark;
    for (const c of collectDuelCards(d, side)) {
      c.zone = "deck";
      c.faceDown = undefined;
      p.deck.push(c);
    }
    shuffleDeck(p.deck);
  }
}

function discardInPlay(state: GameStateData, side: Side, instanceId?: string): void {
  if (!instanceId) return;
  const p = side === "light" ? state.light : state.dark;
  const idx = p.inPlay.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return;
  const [card] = p.inPlay.splice(idx, 1);
  card.zone = "discard";
  card.faceDown = false;
  p.discard.push(card);
}

function cardIdForInstance(state: GameStateData, instanceId?: string): string | undefined {
  if (!instanceId) return undefined;
  for (const p of [state.light, state.dark]) {
    const zones = [p.inPlay, p.discard, p.hand, p.deck, p.hyperspace ?? []];
    for (const z of zones) {
      const c = z.find((x) => x.instanceId === instanceId);
      if (c) return c.cardId;
    }
  }
  return undefined;
}

function endDuel(state: GameStateData, koSide?: Side): void {
  const d = state.duelState;
  if (!d) return;
  const attackerCharId = cardIdForInstance(state, d.attackerCharInstanceId);
  const defenderCharId = cardIdForInstance(state, d.defenderCharInstanceId);
  const attackerSide = d.initiator;
  const defenderSide: Side = attackerSide === "light" ? "dark" : "light";
  if (koSide) {
    if (koSide === attackerSide) {
      discardInPlay(state, attackerSide, d.attackerCharInstanceId);
      discardInPlay(state, attackerSide, d.attackerWeaponInstanceId);
    } else {
      discardInPlay(state, defenderSide, d.defenderCharInstanceId);
      discardInPlay(state, defenderSide, d.defenderWeaponInstanceId);
    }
    reshuffleDuelCards(state);
    restoreHands(state);
    const loserCharId = koSide === attackerSide ? d.attackerCharInstanceId : d.defenderCharInstanceId;
    const p = koSide === "light" ? state.light : state.dark;
    const card = [...p.discard].reverse().find((c) => c.instanceId === loserCharId);
    const dmg = card ? printedDamage(card.cardId, card.cardSet) : 0;
    if (dmg > 0) millFromDeck(state, koSide, dmg);
  } else {
    const lightHits = d.lightHits;
    const darkHits = d.darkHits;
    reshuffleDuelCards(state);
    restoreHands(state);
    if (lightHits > darkHits) millFromDeck(state, "dark", lightHits - darkHits);
    else if (darkHits > lightHits) millFromDeck(state, "light", darkHits - lightHits);
  }
  markFoughtThisTurn(state, attackerCharId, defenderCharId);
  state.duelUsedThisTurn = true;
  state.duelState = undefined;
}

export function canInitiateDuel(state: GameStateData, side: Side): boolean {
  if (!usesDueling(state)) return false;
  if (state.phase !== "battle") return false;
  if (state.turnSide !== side) return false;
  if (state.duelUsedThisTurn) return false;
  if (state.duelState) return false;
  if (state.battlePlanPhase || state.battleCardDeclareSide) return false;
  const mine = getCharactersAtLocation(state, side, true);
  const opp: Side = side === "light" ? "dark" : "light";
  const theirs = getCharactersAtLocation(state, opp, true);
  if (theirs.filter((c) => isCharacter(c.cardId, c.cardSet)).length === 0) return false;
  const duelists = mine.filter((c) => isDuelist(c.cardId, side, c.cardSet));
  const sabers = mine.filter((c) => isLightsaber(c.cardId, c.cardSet));
  return duelists.some((ch) => sabers.some((w) => weaponUsableBy(w.cardId, ch.cardId, w.cardSet)));
}

export function initiateDuel(
  state: GameStateData,
  side: Side,
  charInstanceId: string,
  weaponInstanceId: string
): boolean {
  if (!canInitiateDuel(state, side)) return false;
  const char = findAtLocation(state, side, charInstanceId);
  const weapon = findAtLocation(state, side, weaponInstanceId);
  if (!char || !weapon) return false;
  if (!isDuelist(char.cardId, side, char.cardSet)) return false;
  if (!isLightsaber(weapon.cardId, weapon.cardSet)) return false;
  if (!weaponUsableBy(weapon.cardId, char.cardId, weapon.cardSet)) return false;
  state.duelState = {
    step: "choose_target",
    initiator: side,
    attackerCharInstanceId: charInstanceId,
    attackerWeaponInstanceId: weaponInstanceId,
    lightHits: 0,
    darkHits: 0,
    lightPower: 0,
    darkPower: 0,
    lightDuelHand: [],
    darkDuelHand: [],
    lightSetAside: [],
    darkSetAside: [],
    lightPlayed: [],
    darkPlayed: [],
    currentAttacker: side,
  };
  return true;
}

export function chooseDuelTarget(state: GameStateData, side: Side, defenderCharInstanceId: string): boolean {
  const d = state.duelState;
  if (!d || d.step !== "choose_target" || d.initiator !== side) return false;
  const opp: Side = side === "light" ? "dark" : "light";
  const char = findAtLocation(state, opp, defenderCharInstanceId);
  if (!char || !isCharacter(char.cardId, char.cardSet)) return false;
  d.defenderCharInstanceId = defenderCharInstanceId;
  d.step = "defender_respond";
  return true;
}

function beginDuelHands(state: GameStateData, anakinPower?: number): void {
  const d = state.duelState;
  if (!d || !d.defenderCharInstanceId) return;
  const attackerSide = d.initiator;
  const defenderSide: Side = attackerSide === "light" ? "dark" : "light";
  const atkChar = findAtLocation(state, attackerSide, d.attackerCharInstanceId)!;
  const atkWep = findAtLocation(state, attackerSide, d.attackerWeaponInstanceId);
  const defChar = findAtLocation(state, defenderSide, d.defenderCharInstanceId)!;
  const defWep = d.defenderWeaponInstanceId
    ? findAtLocation(state, defenderSide, d.defenderWeaponInstanceId)
    : undefined;
  const atkPower = duelPower(state, attackerSide, atkChar, atkWep, undefined, defChar);
  const defPower = duelPower(state, defenderSide, defChar, defWep, anakinPower, atkChar);
  if (attackerSide === "light") {
    d.lightPower = atkPower;
    d.darkPower = defPower;
  } else {
    d.darkPower = atkPower;
    d.lightPower = defPower;
  }
  const atkDmg = printedDamage(atkChar.cardId, atkChar.cardSet);
  const defDmg = printedDamage(defChar.cardId, defChar.cardSet);
  if (atkDmg <= 0 || defDmg <= 0) {
    d.lightSetAside = [...state.light.hand];
    d.darkSetAside = [...state.dark.hand];
    if (atkDmg <= 0) endDuel(state, attackerSide);
    else endDuel(state, defenderSide);
    return;
  }
  d.lightSetAside = moveHandAside(state.light);
  d.darkSetAside = moveHandAside(state.dark);
  const lightDraw = attackerSide === "light" ? atkPower : defPower;
  const darkDraw = attackerSide === "dark" ? atkPower : defPower;
  d.lightDuelHand = drawDuelHand(state.light, lightDraw);
  d.darkDuelHand = drawDuelHand(state.dark, darkDraw);
  applyDuelHandBonusDraws(state, d);
  d.step = "play";
  d.currentAttacker = attackerSide;
}

export function defenderReadyDuel(
  state: GameStateData,
  side: Side,
  opts?: { swapCharInstanceId?: string; weaponInstanceId?: string }
): boolean {
  const d = state.duelState;
  if (!d || d.step !== "defender_respond") return false;
  const defenderSide: Side = d.initiator === "light" ? "dark" : "light";
  if (side !== defenderSide) return false;
  if (opts?.swapCharInstanceId) {
    const swap = findAtLocation(state, side, opts.swapCharInstanceId);
    if (!swap || !isDuelist(swap.cardId, side, swap.cardSet)) return false;
    d.defenderCharInstanceId = opts.swapCharInstanceId;
  }
  if (opts?.weaponInstanceId) {
    const defChar = findAtLocation(state, side, d.defenderCharInstanceId!);
    const wep = findAtLocation(state, side, opts.weaponInstanceId);
    if (!defChar || !wep || !isWeapon(wep.cardId, wep.cardSet)) return false;
    if (!weaponUsableBy(wep.cardId, defChar.cardId, wep.cardSet)) return false;
    d.defenderWeaponInstanceId = opts.weaponInstanceId;
  }
  const defChar = findAtLocation(state, side, d.defenderCharInstanceId!);
  let anakinPower: number | undefined;
  if (defChar && printedPower(defChar.cardId, defChar.cardSet) === "?") {
    const p = side === "light" ? state.light : state.dark;
    if (p.deck.length > 0) {
      const card = p.deck.pop()!;
      card.zone = "hand";
      card.faceDown = false;
      p.hand.push(card);
      anakinPower = destValue(card.cardId, card.cardSet);
      d.anakinDestinyCardId = card.cardId;
    } else {
      anakinPower = 0;
    }
  }
  beginDuelHands(state, anakinPower);
  return true;
}

function checkKo(state: GameStateData): boolean {
  const d = state.duelState;
  if (!d) return false;
  const attackerSide = d.initiator;
  const defenderSide: Side = attackerSide === "light" ? "dark" : "light";
  const atkChar = findAtLocation(state, attackerSide, d.attackerCharInstanceId);
  const defChar = d.defenderCharInstanceId ? findAtLocation(state, defenderSide, d.defenderCharInstanceId) : undefined;
  const lightDmg = attackerSide === "light" ? (atkChar ? printedDamage(atkChar.cardId, atkChar.cardSet) : 99) : (defChar ? printedDamage(defChar.cardId, defChar.cardSet) : 99);
  const darkDmg = attackerSide === "dark" ? (atkChar ? printedDamage(atkChar.cardId, atkChar.cardSet) : 99) : (defChar ? printedDamage(defChar.cardId, defChar.cardSet) : 99);
  if (d.lightHits >= lightDmg) {
    endDuel(state, "light");
    return true;
  }
  if (d.darkHits >= darkDmg) {
    endDuel(state, "dark");
    return true;
  }
  return false;
}

function maybeFinishEmpty(state: GameStateData): boolean {
  const d = state.duelState;
  if (!d || d.step !== "play") return false;
  if (d.lightDuelHand.length > 0 || d.darkDuelHand.length > 0) return false;
  if (d.pendingAttack) {
    const hitSide: Side = d.pendingAttack.side === "light" ? "dark" : "light";
    const hits = hitsForPending(d.pendingAttack);
    if (hitSide === "light") d.lightHits += hits;
    else d.darkHits += hits;
    const atkP = d.pendingAttack.side === "light" ? d.lightPlayed : d.darkPlayed;
    const atkH = d.pendingAttack.side === "light" ? d.lightDuelHand : d.darkDuelHand;
    if (!d.pendingAttack.discarded) {
      const idx = atkH.findIndex((c) => c.instanceId === d.pendingAttack!.instanceId);
      if (idx >= 0) atkP.push(atkH.splice(idx, 1)[0]);
    }
    d.pendingAttack = undefined;
    if (checkKo(state)) return true;
  }
  endDuel(state);
  return true;
}

export function playDuelCard(
  state: GameStateData,
  side: Side,
  instanceId: string,
  opts?: { discardForExtraHits?: boolean }
): boolean {
  const d = state.duelState;
  if (!d || d.step !== "play") return false;
  const hand = side === "light" ? d.lightDuelHand : d.darkDuelHand;
  const played = side === "light" ? d.lightPlayed : d.darkPlayed;
  const idx = hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const card = hand[idx];
  const destiny = destValue(card.cardId, card.cardSet);

  if (!d.pendingAttack) {
    if (d.currentAttacker !== side) return false;
    const useExtra = !!opts?.discardForExtraHits && cardAllowsDiscardExtraHits(card.cardId, card.cardSet);
    if (useExtra) {
      hand.splice(idx, 1);
      const p = side === "light" ? state.light : state.dark;
      card.zone = "discard";
      card.faceDown = false;
      p.discard.push(card);
    }
    d.pendingAttack = {
      instanceId: card.instanceId,
      cardId: card.cardId,
      destiny,
      side,
      cardSet: card.cardSet,
      bonusHits: useExtra ? 2 : undefined,
      discarded: useExtra,
    };
    const oppHand = side === "light" ? d.darkDuelHand : d.lightDuelHand;
    if (oppHand.length === 0) {
      maybeFinishEmpty(state);
    }
    return true;
  }

  if (d.pendingAttack.side === side) return false;
  if (destiny === d.pendingAttack.destiny) {
    const atkSide = d.pendingAttack.side;
    const atkHand = atkSide === "light" ? d.lightDuelHand : d.darkDuelHand;
    const atkPlayed = atkSide === "light" ? d.lightPlayed : d.darkPlayed;
    const atkIdx = atkHand.findIndex((c) => c.instanceId === d.pendingAttack!.instanceId);
    if (atkIdx >= 0) atkPlayed.push(atkHand.splice(atkIdx, 1)[0]);
    const useExtra = !!opts?.discardForExtraHits && cardAllowsDiscardExtraHits(card.cardId, card.cardSet);
    if (useExtra) {
      hand.splice(idx, 1);
      const p = side === "light" ? state.light : state.dark;
      card.zone = "discard";
      card.faceDown = false;
      p.discard.push(card);
    }
    d.pendingAttack = {
      instanceId: card.instanceId,
      cardId: card.cardId,
      destiny,
      side,
      cardSet: card.cardSet,
      bonusHits: useExtra ? 2 : undefined,
      discarded: useExtra,
    };
    d.currentAttacker = side;
    return true;
  }

  const hitSide = side;
  const hits = hitsForPending(d.pendingAttack);
  if (hitSide === "light") d.lightHits += hits;
  else d.darkHits += hits;
  const atkSide = d.pendingAttack.side;
  const atkHand = atkSide === "light" ? d.lightDuelHand : d.darkDuelHand;
  const atkPlayed = atkSide === "light" ? d.lightPlayed : d.darkPlayed;
  const atkIdx = atkHand.findIndex((c) => c.instanceId === d.pendingAttack!.instanceId);
  if (atkIdx >= 0 && !d.pendingAttack.discarded) atkPlayed.push(atkHand.splice(atkIdx, 1)[0]);
  played.push(hand.splice(idx, 1)[0]);
  d.pendingAttack = undefined;
  d.currentAttacker = side;
  if (checkKo(state)) return true;
  maybeFinishEmpty(state);
  return true;
}

export function discardDuelCardForDraw(state: GameStateData, side: Side, instanceId: string): boolean {
  const d = state.duelState;
  if (!d || d.step !== "play") return false;
  if (d.pendingAttack?.instanceId === instanceId && d.pendingAttack.side === side) return false;
  const hand = side === "light" ? d.lightDuelHand : d.darkDuelHand;
  const idx = hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const card = hand[idx];
  if (!duelCardText(card.cardId, card.cardSet).includes("duel:discard:draw2")) return false;
  hand.splice(idx, 1);
  const p = side === "light" ? state.light : state.dark;
  card.zone = "discard";
  card.faceDown = false;
  p.discard.push(card);
  hand.push(...drawDuelHand(p, 2));
  return true;
}

export function removeDuelHit(state: GameStateData, side: Side, instanceId: string): boolean {
  const d = state.duelState;
  if (!d || d.step !== "play") return false;
  const hand = side === "light" ? d.lightDuelHand : d.darkDuelHand;
  const card = hand.find((c) => c.instanceId === instanceId);
  if (!card || !cardAllowsRemoveHit(card.cardId, card.cardSet)) return false;
  if ((d.hitRemovalUsed ?? []).includes(instanceId)) return false;
  const hits = side === "light" ? d.lightHits : d.darkHits;
  if (hits <= 0) return false;
  if (side === "light") d.lightHits -= 1;
  else d.darkHits -= 1;
  d.hitRemovalUsed = [...(d.hitRemovalUsed ?? []), instanceId];
  return true;
}

export function snapshotDuel(state: GameStateData, forSide?: Side): Record<string, unknown> | undefined {
  const d = state.duelState;
  if (!d) return undefined;
  const view: Record<string, unknown> = {
    step: d.step,
    initiator: d.initiator,
    currentAttacker: d.currentAttacker,
    attackerCharInstanceId: d.attackerCharInstanceId,
    attackerWeaponInstanceId: d.attackerWeaponInstanceId,
    defenderCharInstanceId: d.defenderCharInstanceId,
    defenderWeaponInstanceId: d.defenderWeaponInstanceId,
    lightPower: d.lightPower,
    darkPower: d.darkPower,
    lightHits: d.lightHits,
    darkHits: d.darkHits,
    lightHandCount: d.lightDuelHand.length,
    darkHandCount: d.darkDuelHand.length,
    pendingAttack: d.pendingAttack
      ? { cardId: d.pendingAttack.cardId, destiny: d.pendingAttack.destiny, side: d.pendingAttack.side }
      : undefined,
    anakinDestinyCardId: d.anakinDestinyCardId,
    hitRemovalUsed: d.hitRemovalUsed ?? [],
  };
  if (forSide === "light") {
    view.yourDuelHand = d.lightDuelHand.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
    }));
  } else if (forSide === "dark") {
    view.yourDuelHand = d.darkDuelHand.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
    }));
  }
  return view;
}
