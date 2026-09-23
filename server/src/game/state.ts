/**
 * Game state types and helpers.
 * Server holds full state; clients receive snapshots (hand counts, phase, etc.).
 */

import type { Side } from "../types";
import type { CardInstance } from "../cards/types";
import { getStarterDeckCardList, getCard } from "../cards/loader";

function getDestinyValue(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  if (!def || typeof (def as { destiny?: number }).destiny !== "number") return 0;
  return (def as { destiny: number }).destiny;
}

function isLocationCard(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  return def != null && (def as { type?: string }).type === "location";
}

function isCharacterOrWeapon(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def) return false;
  const t = (def as { type?: string }).type;
  return t === "character" || t === "weapon";
}

function isCharacterOnly(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def) return false;
  return (def as { type?: string }).type === "character";
}

function isWeaponOnly(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def) return false;
  return (def as { type?: string }).type === "weapon";
}

function isEffectCard(cardId: string, set?: string): boolean {
  const def = getCard(cardId, set);
  if (!def) return false;
  return (def as { type?: string }).type === "effect";
}

function getCardType(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (!def) return "";
  return (def as { type?: string }).type ?? "";
}

function getCardName(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (def && typeof (def as { name?: string }).name === "string") return (def as { name: string }).name;
  return cardId;
}

/**
 * Check if a character matches a single canUse string.
 * - "any" = any character.
 * - "◆trait" = character must have uniqueness false AND match trait (or persona, name, id).
 * - "name1,name2" = two (or more) allowed: check persona, trait, name, or card id.
 *   If any segment matches, canUse is considered to match and primary benefits apply.
 */
function characterMatchesWeaponCanUse(
  characterCardId: string,
  canUse: string | undefined,
  opponentCharacterCardId?: string
): boolean {
  if (typeof canUse !== "string" || !canUse.trim()) return false;
  const trimmed = canUse.trim();
  const trimmedLower = trimmed.toLowerCase();
  if (trimmedLower === "any") return true;
  const parts = trimmed.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (parts.includes("any")) return true;
  const charDef = getCard(characterCardId);
  if (!charDef) return false;
  const charName = ((charDef as { name?: string }).name ?? "").toLowerCase();
  const charNameNoSpaces = charName.replace(/\s/g, "");
  const charId = characterCardId.toLowerCase();
  const charType = ((charDef as { type?: string }).type ?? "").toLowerCase();
  const charPersona = ((charDef as { persona?: string }).persona ?? "").toLowerCase();
  const charTraits = (((charDef as { trait?: string }).trait ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean));
  const segments = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    let segLower = seg.toLowerCase();
    let requireNonUnique = false;
    if (segLower.startsWith("◆") || seg.startsWith("◆")) {
      requireNonUnique = true;
      segLower = segLower.replace(/^◆\s*/, "");
    }
    if (requireNonUnique && (charDef as { uniqueness?: boolean }).uniqueness === true) continue;
    if (segLower.startsWith("vs:") || segLower.startsWith("fighting:")) {
      const kind = segLower.replace(/^(vs|fighting):/, "").trim();
      if (kind && opponentCharacterCardId && opponentMatchesGametextCondition(opponentCharacterCardId, kind)) {
        return true;
      }
      continue;
    }
    if (
      charPersona === segLower ||
      charTraits.includes(segLower) ||
      charName.includes(segLower) ||
      charNameNoSpaces.includes(segLower) ||
      charId.includes(segLower) ||
      charType === segLower
    )
      return true;
  }
  let trimmedMatch = trimmedLower;
  let requireNonUniqueFinal = false;
  if (trimmedMatch.startsWith("◆") || trimmed.startsWith("◆")) {
    requireNonUniqueFinal = true;
    trimmedMatch = trimmedMatch.replace(/^◆\s*/, "");
  }
  if (requireNonUniqueFinal && (charDef as { uniqueness?: boolean }).uniqueness === true) return false;
  return (
    charPersona === trimmedMatch ||
    charTraits.includes(trimmedMatch) ||
    charName.includes(trimmedMatch) ||
    charNameNoSpaces.includes(trimmedMatch) ||
    charId.includes(trimmedMatch) ||
    charType === trimmedMatch
  );
}

/** Character gametext "may use any ◆ X" grants that weapon even when the weapon's canUse omits them. */
export function characterGrantsWeaponUse(characterCardId: string, weaponCardId: string, weaponSet?: string): boolean {
  const charDef = getCard(characterCardId);
  const bonus = ((charDef as { gametextbonus?: string } | undefined)?.gametextbonus ?? "").toLowerCase();
  if (!bonus.includes("mayuse:")) return false;
  const weaponDef = getCard(weaponCardId, weaponSet);
  if (!weaponDef || (weaponDef as { type?: string }).type !== "weapon") return false;
  const weaponId = weaponCardId.toLowerCase();
  const weaponName = ((weaponDef as { name?: string }).name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const clause of bonus.split(";")) {
    const text = clause.trim();
    if (!text.startsWith("mayuse:")) continue;
    let spec = text.slice("mayuse:".length).trim();
    let requireNonUnique = false;
    if (spec.startsWith("◆")) {
      requireNonUnique = true;
      spec = spec.replace(/^◆\s*/, "");
    }
    if (!spec) continue;
    if (requireNonUnique && (weaponDef as { uniqueness?: boolean }).uniqueness !== false) continue;
    if (weaponId.includes(spec) || weaponName === spec || weaponName.includes(spec)) return true;
  }
  return false;
}

function canWeaponBeUsedBy(weaponCardId: string, characterCardId: string, weaponSet?: string): boolean {
  const weaponDef = getCard(weaponCardId, weaponSet);
  if (!weaponDef || (weaponDef as { type?: string }).type !== "weapon") return false;
  const canUse = (weaponDef as { canUse?: string }).canUse;
  const canUse2 = (weaponDef as { canUse2?: string }).canUse2;
  return (
    characterMatchesWeaponCanUse(characterCardId, canUse) ||
    characterMatchesWeaponCanUse(characterCardId, canUse2) ||
    characterGrantsWeaponUse(characterCardId, weaponCardId, weaponSet)
  );
}

function getWeaponPowerAddRawForCharacter(
  weaponCardId: string,
  characterCardId: string,
  weaponSet?: string,
  opponentCharacterCardId?: string
): number | "?" {
  const def = getCard(weaponCardId, weaponSet);
  if (!def || (def as { type?: string }).type !== "weapon") return 0;
  const canUse = (def as { canUse?: string }).canUse;
  const canUse2 = (def as { canUse2?: string }).canUse2;
  if (characterMatchesWeaponCanUse(characterCardId, canUse, opponentCharacterCardId)) {
    const v = (def as { powerAdd?: number | string }).powerAdd;
    if (v === "?") return "?";
    return typeof v === "number" ? v : 0;
  }
  if (characterMatchesWeaponCanUse(characterCardId, canUse2, opponentCharacterCardId)) {
    const v = (def as { powerAdd2?: number | string }).powerAdd2;
    if (v === "?") return "?";
    return typeof v === "number" ? v : 0;
  }
  if (characterGrantsWeaponUse(characterCardId, weaponCardId, weaponSet)) {
    const v = (def as { powerAdd?: number | string }).powerAdd;
    if (v === "?") return "?";
    return typeof v === "number" ? v : 0;
  }
  return 0;
}

/** Get powerAdd to apply for this weapon on this character: canUse first, then canUse2, else 0. */
export function getWeaponPowerAddForCharacter(
  weaponCardId: string,
  characterCardId: string,
  weaponSet?: string,
  opponentCharacterCardId?: string
): number {
  const v = getWeaponPowerAddRawForCharacter(weaponCardId, characterCardId, weaponSet, opponentCharacterCardId);
  return v === "?" ? 0 : v;
}

/** Get destinyAdd to apply for this weapon on this character: canUse first, then canUse2, else 0. */
function getWeaponDestinyAddForCharacter(
  weaponCardId: string,
  characterCardId: string,
  weaponSet?: string,
  opponentCharacterCardId?: string
): number {
  const def = getCard(weaponCardId, weaponSet);
  if (!def || (def as { type?: string }).type !== "weapon") return 0;
  const canUse = (def as { canUse?: string }).canUse;
  const canUse2 = (def as { canUse2?: string }).canUse2;
  if (characterMatchesWeaponCanUse(characterCardId, canUse, opponentCharacterCardId)) {
    const v = (def as { destinyAdd?: number }).destinyAdd;
    return typeof v === "number" ? v : 0;
  }
  if (characterMatchesWeaponCanUse(characterCardId, canUse2, opponentCharacterCardId)) {
    const v = (def as { destinyAdd2?: number }).destinyAdd2;
    return typeof v === "number" ? v : 0;
  }
  if (characterGrantsWeaponUse(characterCardId, weaponCardId, weaponSet)) {
    const v = (def as { destinyAdd?: number }).destinyAdd;
    return typeof v === "number" ? v : 0;
  }
  return 0;
}

function getWeaponPowerAdd(cardId: string): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "weapon") return 0;
  const v = (def as { powerAdd?: number }).powerAdd;
  return typeof v === "number" ? v : 0;
}

function getWeaponDestinyAdd(cardId: string): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "weapon") return 0;
  const v = (def as { destinyAdd?: number }).destinyAdd;
  return typeof v === "number" ? v : 0;
}

/** Check if a character matches a single battle canUse segment (e.g. "jabba", "◆battledroid", "amidala:padme"). Colon within a segment means OR — match any of the parts. */
function characterMatchesBattleCanUseSegment(characterCardId: string, segment: string): boolean {
  if (!segment || !segment.trim()) return false;
  const trimmed = segment.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((s) => s.trim()).filter(Boolean);
    return parts.some((part) => characterMatchesBattleCanUseSegment(characterCardId, part));
  }
  let seg = trimmed.toLowerCase();
  let requireNonUnique = false;
  if (seg.startsWith("◆")) {
    requireNonUnique = true;
    seg = seg.substring(1);
  }
  if (seg === "any") return true;
  const charDef = getCard(characterCardId);
  if (!charDef) return false;
  const charName = ((charDef as { name?: string }).name ?? "").toLowerCase();
  const charNameNoSpaces = charName.replace(/\s/g, "");
  const charId = characterCardId.toLowerCase();
  const charPersona = ((charDef as { persona?: string }).persona ?? "").toLowerCase();
  const charTraits = (((charDef as { trait?: string }).trait ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean));
  if (requireNonUnique && (charDef as { uniqueness?: boolean }).uniqueness === true) return false;
  return (
    charPersona === seg ||
    charTraits.includes(seg) ||
    charName.includes(seg) ||
    charNameNoSpaces.includes(seg) ||
    charId.includes(seg)
  );
}

/**
 * Check if a battle card can be used by a character.
 * canUse format: "◆battledroid" or "jabba,bibfortuna" (comma-separated: check each, first match wins).
 * "any" means any character.
 */
function canBattleCardBeUsedBy(battleCardId: string, characterCardId: string): boolean {
  const bDef = getCard(battleCardId);
  if (!bDef || (bDef as { type?: string }).type !== "battle") return false;
  const canUse = (bDef as { canUse?: string }).canUse;
  if (!canUse || canUse.trim().toLowerCase() === "any") return true;
  const segments = canUse.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (characterMatchesBattleCanUseSegment(characterCardId, seg)) return true;
  }
  return false;
}

/** Check if two characters together cover all canUse segments (for "both:fighttogether"). */
function twoCharactersCoverBattleCanUse(battleCardId: string, char1CardId: string, char2CardId: string): boolean {
  const bDef = getCard(battleCardId);
  if (!bDef || (bDef as { type?: string }).type !== "battle") return false;
  const canUse = (bDef as { canUse?: string }).canUse;
  if (!canUse || !canUse.trim()) return false;
  const segments = canUse.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return false;
  const matchedByChar1: boolean[] = segments.map((seg) => characterMatchesBattleCanUseSegment(char1CardId, seg));
  const matchedByChar2: boolean[] = segments.map((seg) => characterMatchesBattleCanUseSegment(char2CardId, seg));
  for (let i = 0; i < segments.length; i++) {
    if (!matchedByChar1[i] && !matchedByChar2[i]) return false;
  }
  return true;
}

/** For conditions like "both:fighttogether:diffnosebulba": two characters must have different names and neither can be Sebulba. */
function twoCharactersDifferentNamesNoSebulba(char1CardId: string, char2CardId: string): boolean {
  const persona1 = getCharacterPersona(char1CardId).toLowerCase();
  const persona2 = getCharacterPersona(char2CardId).toLowerCase();
  const name1 = (persona1 || getCardName(char1CardId).toLowerCase() || char1CardId.toLowerCase()).trim();
  const name2 = (persona2 || getCardName(char2CardId).toLowerCase() || char2CardId.toLowerCase()).trim();
  if (name1 === "sebulba" || name2 === "sebulba") return false;
  if (char1CardId.toLowerCase().includes("sebulba") || char2CardId.toLowerCase().includes("sebulba")) return false;
  return name1 !== name2;
}

function getCharacterTrait(characterCardId: string): string {
  const def = getCard(characterCardId);
  if (!def || (def as { type?: string }).type !== "character") return "";
  const t = (def as { trait?: string }).trait;
  return typeof t === "string" ? t.trim() : "";
}

function getCharacterPersona(characterCardId: string, cardSet?: string): string {
  const def = getCard(characterCardId, cardSet);
  if (!def || (def as { type?: string }).type !== "character") return "";
  const p = (def as { persona?: string }).persona;
  return typeof p === "string" ? p.trim() : "";
}

/**
 * Returns true if this side cannot play this unique character because the same unique
 * is already stranded on any controlled planet (yours or your opponent's). Stranded
 * copies still count toward uniqueness until evacuated or otherwise moved.
 */
export function wouldViolateUniqueness(
  state: GameStateData,
  side: Side,
  characterCardId: string,
  characterSet?: string
): boolean {
  const def = getCard(characterCardId, characterSet);
  if (!def || (def as { type?: string }).type !== "character") return false;
  const uniqueness = (def as { uniqueness?: boolean }).uniqueness;
  if (!uniqueness) return false;
  const persona = getCharacterPersona(characterCardId, characterSet).toLowerCase();
  const matchKey = persona ? persona : characterCardId.toLowerCase();
  const controlled = state.controlledPlanets ?? [];
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  for (const cp of controlled) {
    const list = cp[strandedKey] as { instanceId: string; cardId: string }[];
    if (!list) continue;
    for (const { cardId } of list) {
      if (!isCharacterOnly(cardId)) continue;
      const existingPersona = getCharacterPersona(cardId).toLowerCase();
      const existingKey = existingPersona ? existingPersona : cardId.toLowerCase();
      if (matchKey === existingKey) return true;
    }
  }
  return false;
}

/**
 * For a unique character being deployed: if the same character title is already at the current
 * location and this character is not stackable, returns the card title for an error message.
 * Otherwise returns null (deployment allowed).
 */
export function wouldViolateUniquenessAtLocation(
  state: GameStateData,
  side: Side,
  characterCardId: string
): { cardTitle: string } | null {
  const def = getCard(characterCardId);
  if (!def || (def as { type?: string }).type !== "character") return null;
  const uniqueness = (def as { uniqueness?: boolean }).uniqueness;
  if (!uniqueness) return null;
  const stackable = (def as { stackable?: boolean }).stackable === true;
  const persona = getCharacterPersona(characterCardId).toLowerCase();
  const matchKey = persona ? persona : characterCardId.toLowerCase();
  const atLocation = getCharactersAtLocation(state, side, false);
  for (const c of atLocation) {
    if (!isCharacterOnly(c.cardId, c.cardSet)) continue;
    const existingPersona = getCharacterPersona(c.cardId).toLowerCase();
    const existingKey = existingPersona ? existingPersona : c.cardId.toLowerCase();
    if (matchKey === existingKey) {
      if (stackable) return null;
      return { cardTitle: getCardName(characterCardId) };
    }
  }
  return null;
}

/** Normalize card id to base form for uniqueness comparison (strip _light/_dark suffix). */
function baseCardId(cardId: string): string {
  return cardId.toLowerCase().replace(/_light$|_dark$/, "") || cardId.toLowerCase();
}

/**
 * Returns true if this unique weapon is already stranded on any controlled planet.
 */
export function wouldViolateUniquenessWeapon(
  state: GameStateData,
  side: Side,
  weaponCardId: string,
  weaponSet?: string
): boolean {
  const def = getCard(weaponCardId, weaponSet);
  if (!def || (def as { type?: string }).type !== "weapon") return false;
  const uniqueness = (def as { uniqueness?: boolean }).uniqueness;
  if (!uniqueness) return false;
  const matchKey = baseCardId(weaponCardId);
  const controlled = state.controlledPlanets ?? [];
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  for (const cp of controlled) {
    const list = cp[strandedKey] as { instanceId: string; cardId: string; cardSet?: string }[];
    if (!list) continue;
    for (const { cardId, cardSet } of list) {
      if (!isWeaponOnly(cardId, cardSet)) continue;
      const strandedDef = getCard(cardId, cardSet);
      if ((strandedDef as { uniqueness?: boolean } | undefined)?.uniqueness !== true) continue;
      if (baseCardId(cardId) === matchKey) return true;
    }
  }
  return false;
}

/**
 * For a unique weapon being deployed: if the same weapon title is already at the current
 * location and this weapon is not stackable, returns the card title for an error message.
 * Otherwise returns null (deployment allowed).
 */
export function wouldViolateUniquenessAtLocationWeapon(
  state: GameStateData,
  side: Side,
  weaponCardId: string,
  weaponSet?: string
): { cardTitle: string } | null {
  const def = getCard(weaponCardId, weaponSet);
  if (!def || (def as { type?: string }).type !== "weapon") return null;
  const uniqueness = (def as { uniqueness?: boolean }).uniqueness;
  if (!uniqueness) return null;
  const stackable = (def as { stackable?: boolean }).stackable === true;
  const matchKey = weaponCardId.toLowerCase();
  const atLocation = getCharactersAtLocation(state, side, false);
  for (const c of atLocation) {
    if (!isWeaponOnly(c.cardId, c.cardSet)) continue;
    if (c.cardId.toLowerCase() === matchKey) {
      if (stackable) return null;
      return { cardTitle: getCardName(weaponCardId, weaponSet) };
    }
  }
  return null;
}

function twoCharactersSamePersona(char1CardId: string, char2CardId: string): boolean {
  const p1 = getCharacterPersona(char1CardId).toLowerCase();
  const p2 = getCharacterPersona(char2CardId).toLowerCase();
  return p1.length > 0 && p1 === p2;
}

/**
 * Condition format: "against:trait", "first:", "on:planet", "using:weaponid", etc.
 * Empty condition = always pass. "on:tatooine" = current location must be on that planet.
 * "using:weaponid" = this fighter must be using the specified weapon (e.g. using:tradefederationtanklasercannon).
 */
function battleCardConditionMet(
  battleCardId: string,
  _myCharacterCardId: string,
  opponentCharacterCardId: string,
  fighterIndex: number,
  locationCardId: string,
  weaponCardId?: string
): boolean {
  const bDef = getCard(battleCardId);
  if (!bDef || (bDef as { type?: string }).type !== "battle") return false;
  const condition = (bDef as { condition?: string }).condition;
  if (!condition || !condition.trim()) return true;
  const parts = condition.includes(":") ? condition.split(":") : condition.split(",");
  const op = (parts[0] ?? "").trim().toLowerCase();
  const value = (parts[1] ?? "").trim().toLowerCase();
  if (op === "first") {
    return fighterIndex === 0;
  }
  if (op === "on" && value) {
    const planet = getLocationPlanet(locationCardId).toLowerCase();
    return planet === value || planet.includes(value);
  }
  if (op === "at" && value) {
    const locId = locationCardId.toLowerCase();
    return locId.includes(value) || locId.endsWith(value) || locId === value;
  }
  if (op === "using" && value) {
    if (!weaponCardId || !weaponCardId.trim()) return false;
    const weaponId = weaponCardId.trim().toLowerCase();
    return weaponId === value || weaponId.includes(value) || weaponId.endsWith(value);
  }
  if (!value && op !== "first") return true;
  if (op === "against") {
    const opponentTrait = getCharacterTrait(opponentCharacterCardId).toLowerCase();
    return opponentTrait.includes(value) || opponentTrait === value;
  }
  if (op === "fight" && value) {
    const names = value.split(",").map((s) => s.trim()).filter(Boolean);
    return names.some((name) => characterMatchesBattleCanUseSegment(opponentCharacterCardId, name));
  }
  return true;
}

function getBattleCardConditionString(battleCardId: string): string {
  const def = getCard(battleCardId);
  if (!def || (def as { type?: string }).type !== "battle") return "";
  const c = (def as { condition?: string }).condition;
  return typeof c === "string" ? c.trim() : "";
}

/** True if battle card condition contains ":noweapon" — no weapon may add power for this fight. */
function battleCardConditionNoWeapon(battleCardId: string): boolean {
  const conditionStr = getBattleCardConditionString(battleCardId).toLowerCase();
  return conditionStr.includes(":noweapon");
}

/** True if battle card condition contains "oppnoweapon" — when this fighter has no weapon, the opponent cannot use a weapon (no weapon bonus, and if opponent loses their weapon is not lost). */
function battleCardConditionOppNoWeapon(battleCardId: string): boolean {
  const conditionStr = getBattleCardConditionString(battleCardId).toLowerCase();
  return conditionStr.includes("oppnoweapon");
}

/** True if battle card condition contains "returnhand" — loser returns character(s) and weapon(s) to hand. */
function battleCardConditionReturnHand(battleCardId: string): boolean {
  const conditionStr = getBattleCardConditionString(battleCardId).toLowerCase();
  return conditionStr.includes("returnhand");
}

/** True if battle card condition contains "nodamage" — no milling from loser's deck for damage this fight. */
function battleCardConditionNoDamage(battleCardId: string): boolean {
  const conditionStr = getBattleCardConditionString(battleCardId).toLowerCase();
  return conditionStr.includes("nodamage");
}

/** True if battle card condition is "defeat◆:fightagain" (or defeat + fightagain): when attacker defeats a uniqueness:false character, they fight the next defender too (same character + weapon, no battle card). */
function battleCardHasDefeatFightAgain(battleCardId: string): boolean {
  const conditionStr = getBattleCardConditionString(battleCardId).toLowerCase();
  return conditionStr.includes("defeat") && conditionStr.includes("fightagain");
}

/** If battle card condition contains "lose X" (e.g. "lose ◆gungan"), return the segment X so that when this side loses, only characters matching X are discarded. Otherwise null. */
function getBattleCardConditionLoseSegment(battleCardId: string): string | null {
  const conditionStr = getBattleCardConditionString(battleCardId);
  const parts = conditionStr.split(":");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.toLowerCase().startsWith("lose ")) {
      const segment = trimmed.slice(5).trim(); // "lose ".length === 5
      if (segment) return segment;
    }
  }
  return null;
}

/** True if the character card has uniqueness === false (non-unique). */
function isCharacterUniquenessFalse(cardId: string): boolean {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "character") return false;
  return (def as { uniqueness?: boolean }).uniqueness === false;
}

function getBattleCardPowerAdd(cardId: string): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "battle") return 0;
  const v = (def as { powerAdd?: number }).powerAdd;
  return typeof v === "number" ? v : 0;
}

function getBattleCardDestinyAdd(cardId: string): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "battle") return 0;
  const v = (def as { destinyAdd?: number }).destinyAdd;
  return typeof v === "number" ? v : 0;
}

/** Draw N destiny cards from a side's deck. Each goes to discard after drawing. Returns drawn card info. */
export function drawDestinyCards(state: GameStateData, side: Side, count: number): { cardId: string; destiny: number }[] {
  const p = side === "light" ? state.light : state.dark;
  const draws: { cardId: string; destiny: number }[] = [];
  for (let i = 0; i < count && p.deck.length > 0; i++) {
    const c = p.deck.pop()!;
    draws.push({ cardId: c.cardId, destiny: getDestinyValue(c.cardId, c.cardSet) });
    c.zone = "discard";
    c.faceDown = false;
    p.discard.push(c);
  }
  return draws;
}

/** Get planet name for a location card, or empty string if not a location. */
export function getLocationPlanet(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "location") return "";
  return String((def as { planet?: string }).planet ?? "");
}

/** Find the current location card (by startingLocationInstanceId) and return it with the side that owns it. */
export function getCurrentLocationCard(
  state: GameStateData
): { card: CardInstance; side: Side } | null {
  const id = state.startingLocationInstanceId;
  if (!id) return null;
  for (const side of ["light", "dark"] as Side[]) {
    const p = side === "light" ? state.light : state.dark;
    const card = p.inPlay.find((c) => c.instanceId === id);
    if (card && isLocationCard(card.cardId, card.cardSet)) return { card, side };
  }
  return null;
}

/** Play a location from hand on top of the current location (same planet, different card). Old location stays in play underneath. No force cost. */
export function replaceLocationWithCard(
  state: GameStateData,
  side: Side,
  instanceId: string
): boolean {
  const current = getCurrentLocationCard(state);
  if (!current) return false;
  const p = side === "light" ? state.light : state.dark;
  const handIdx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (handIdx < 0) return false;
  const [newCard] = p.hand.splice(handIdx, 1);
  if (!isLocationCard(newCard.cardId, newCard.cardSet)) return false;
  newCard.zone = "in_play";
  newCard.position = p.inPlay.length;
  p.inPlay.push(newCard);
  state.startingLocationInstanceId = newCard.instanceId;
  return true;
}

export const PHASES = [
  "determine_first",
  "choose_starting_location",
  "choose_next_planet",
  "draw",
  "deploy",
  "battle",
  "even_up",
  "game_over",
] as const;
export type Phase = (typeof PHASES)[number];

export interface PlayerGameState {
  playerId: string;
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  inPlay: CardInstance[];
  discard: CardInstance[];
  /** Face-up starships (Duel of the Fates Hyperspace). */
  hyperspace: CardInstance[];
  life: number;
  /** Force (counters) remaining this deploy turn; 6 at start of deploy. */
  force: number;
}

export interface ControlledPlanet {
  locationCardId: string;
  locationInstanceId: string;
  planet: string;
  controlledBy: Side;
  strandedLight: { instanceId: string; cardId: string; faceDown?: boolean }[];
  strandedDark: { instanceId: string; cardId: string; faceDown?: boolean }[];
}

/** Tracks an in-progress evacuation attempt during the deploy phase. */
export interface EvacuationState {
  evacuatingSide: Side;
  transportInstanceId: string;
  transportCardId: string;
  /** Index into controlledPlanets, or -1 for the current active planet. */
  targetPlanetIndex: number;
  /** Characters and weapons being evacuated (removed from their location). */
  stackedCards: { instanceId: string; cardId: string }[];
  /** True while waiting for the opponent to intercept or decline. */
  awaitingInterception: boolean;
  /** Set if opponent played a starfighter to intercept. */
  interceptorInstanceId?: string;
  interceptorCardId?: string;
}

/** Result of an evacuation (sent to clients for display). */
export interface EvacuationResult {
  evacuatingSide: Side;
  transportCardId: string;
  transportName: string;
  targetPlanet: string;
  stackedCardIds: string[];
  intercepted: boolean;
  interceptorCardId?: string;
  interceptorName?: string;
  transportPower: number;
  interceptorPower?: number;
  interceptorDestinyDraw?: { cardId: string; destiny: number };
  interceptorTotalPower?: number;
  outcome: "success" | "transport_destroyed" | "tie";
  evacuatedCardIds?: string[];
  discardedCardIds?: string[];
  transportDamageMill?: number;
  transportMilledCardIds?: string[];
  interceptorDamageMill?: number;
  interceptorMilledCardIds?: string[];
}

/** Cards drawn for destiny compare (who goes first); held off deck until resolved. */
export interface DestinyCompareView {
  light: { cardId: string; destiny: number };
  dark: { cardId: string; destiny: number };
}

export interface GameStateData {
  id: string;
  tableId: string;
  lightPlayerId: string;
  darkPlayerId: string;
  phase: Phase;
  turnSide: Side;
  turnNumber: number;
  phaseStartedAt: number;
  phaseDurationMs: number;
  light: PlayerGameState;
  dark: PlayerGameState;
  /** Cards currently drawn for destiny compare (removed from deck). */
  destinyLightCard?: CardInstance | null;
  destinyDarkCard?: CardInstance | null;
  /** All destiny compare rounds so far (each pair shown for ties). */
  destinyCompareRounds?: { light: { cardId: string; destiny: number }; dark: { cardId: string; destiny: number } }[];
  /** Light/dark cards drawn during destiny compare (tie rounds); put back only when winner is determined. */
  destinyDrawnLight?: CardInstance[];
  destinyDrawnDark?: CardInstance[];
  /** Location cards removed from first player's deck for starting location choice. */
  startingLocationChoices?: CardInstance[];
  /** The chosen starting location (in first player's inPlay); for client to show in center. */
  startingLocationInstanceId?: string | null;
  /** How many times each side has had a deploy phase (cards deploy face down on count 1, flip at start of count 2). */
  lightTurnCount: number;
  darkTurnCount: number;
  /** Battle card declaration: which side is currently declaring battle cards (attacker first, then defender). */
  battleCardDeclareSide?: Side;
  lightDeclaredBattleCards?: string[];
  darkDeclaredBattleCards?: string[];
  /** Battle plan: when true, both players submit order and ready; then resolution runs. */
  battlePlanPhase?: boolean;
  lightBattlePlanOrder?: string[];
  darkBattlePlanOrder?: string[];
  lightBattlePlanReady?: boolean;
  darkBattlePlanReady?: boolean;
  /** Controlled planets (planet victories). */
  controlledPlanets?: ControlledPlanet[];
  lightPlanetsWon?: number;
  darkPlanetsWon?: number;
  /** Planet names that have been in play (cannot be reused). */
  usedPlanets?: string[];
  /** Location cards available for next planet choice (from hand, discard, deck). */
  nextPlanetChoices?: { instanceId: string; cardId: string; fromZone: string; cardSet?: string }[];
  /** Which side is choosing the next planet. */
  nextPlanetChooserSide?: Side;
  /** Side that has declared surrender; executed after even-up completes. */
  surrenderPending?: Side;
  /** Evacuation in progress (during deploy phase). */
  evacuationState?: EvacuationState;
  /** Evacuation result for client display (cleared after sent). */
  evacuationResult?: EvacuationResult;
  /** When a player clicks an effect, we wait for the follow-up (discard a card, or choose where the peeked card goes). */
  effectActivationPending?: {
    side: Side;
    effectInstanceId: string;
    effectCardId: string;
    effectCardName: string;
    countersToAdd: number;
    kind?: "discard_counters" | "peek_opp_deck" | "bottom_hand";
    peekedInstanceId?: string;
    peekedCardId?: string;
    peekedSet?: string;
  };
  /** Instance IDs of effects already activated this deploy phase (each effect usable once per turn). */
  usedEffectsThisTurn?: string[];
  /** Official Duel of the Fates rules are the default; classic is 1v1 evacuate without Hyperspace/dueling. */
  ruleset?: "dotf" | "classic";
  /** Starship battle (Hyperspace intercept) uses battle-plan UI during deploy. */
  starshipBattlePhase?: boolean;
  starshipBattleAttacker?: Side;
  /** After the first location of a new planet, each player may fetch one Effect from deck. */
  planetEffectFetch?: {
    chooserSide: Side;
    locationChooser: Side;
    lightDone: boolean;
    darkDone: boolean;
    lastFetched?: { side: Side; cardId: string; name: string };
  };
  /** Face-up deploy may draw (Baskol Yeesrim on Coruscant). */
  deployDrawPending?: { side: Side; count: number };
  /** On-deploy search for a related card (deployfromdeck gametext). */
  deployFromDeckPending?: {
    side: Side;
    searcherInstanceId: string;
    searcherCardId: string;
    targetId: string;
    cost: "normal" | "free" | number;
    foundInstanceId?: string;
    foundCardId?: string;
    foundSet?: string;
    nonUnique?: boolean;
    discardSearcher?: boolean;
  };
  /** Jedi Training: after a face-up Jedi deploys, optionally discard the Effect and deploy a lightsaber from deck. */
  jediTrainingPending?: {
    side: Side;
    effectInstanceId: string;
    jediInstanceId: string;
    jediCardId: string;
    choices: { instanceId: string; cardId: string; set?: string; cost: number }[];
  };
  /** Pounded Unto Death: during Even Up, discard the Effect and one opponent non-unique card. No damage. */
  poundedPending?: {
    side: Side;
    effectInstanceId: string;
    targets: { instanceId: string; cardId: string; set?: string }[];
  };
  /** Click a stranded character on a planet you control (e.g. Yoda: discard self + 3 hand, draw 3). */
  winControlPending?: {
    side: Side;
    characterInstanceId: string;
    characterCardId: string;
    planetIndex: number;
    discardHand: number;
    draw: number;
  };
  /** Twist of Fate: pick one of your destiny draws and a higher opposing draw to switch. */
  destinySwapPending?: {
    side: Side;
    yours: { key: string; cardId: string; destiny: number }[];
    opps: { key: string; cardId: string; destiny: number }[];
  };
  /** A Powerful Opponent: one drawn destiny at a time, then the player may replace it with damage. */
  damageReplacePending?: {
    side: Side;
    damage: number;
    draw: { key: string; cardId: string; destiny: number };
  };
  /** Lightsaber duel in progress. */
  duelState?: import("./duel").DuelState;
  duelUsedThisTurn?: boolean;
  /** Card IDs of characters that already completed a duel or battle pair this turn. */
  foughtThisTurn?: string[];
  /** Bot personality for vs-computer games. */
  botStyle?: "balanced" | "aggressive" | "passive";
  /** Set when game has ended; players can return to lobby. */
  lightReturnedToLobby?: boolean;
  darkReturnedToLobby?: boolean;
  /** After resolution: sequence of reveals for client to animate. Cleared after sent. */
  battleRevealSequence?: {
    type?: "paired" | "unopposed";
    lightCardId: string;
    darkCardId: string;
    lightCardName: string;
    darkCardName: string;
    lightBasePower: number;
    lightBonus: number;
    darkBasePower: number;
    darkBonus: number;
    lightPower: number;
    darkPower: number;
    winner: "light" | "dark" | "tie";
    lightMill?: number;
    darkMill?: number;
    lightMilledCardIds?: string[];
    darkMilledCardIds?: string[];
    lightWeaponCardId?: string;
    lightWeaponName?: string;
    lightWeaponBonus?: number;
    lightDestinyDraws?: { cardId: string; destiny: number }[];
    darkWeaponCardId?: string;
    darkWeaponName?: string;
    darkWeaponBonus?: number;
    darkDestinyDraws?: { cardId: string; destiny: number }[];
    lightBattleCardId?: string;
    lightBattleCardName?: string;
    lightBattleCardBonus?: number;
    lightBattleDestinyDraws?: { cardId: string; destiny: number }[];
    darkBattleCardId?: string;
    darkBattleCardName?: string;
    darkBattleCardBonus?: number;
    darkBattleDestinyDraws?: { cardId: string; destiny: number }[];
    lightCardId2?: string;
    lightCardName2?: string;
    lightBasePower2?: number;
    lightBonus2?: number;
    lightWeaponCardId2?: string;
    lightWeaponName2?: string;
    lightWeaponBonus2?: number;
    lightDestinyDraws2?: { cardId: string; destiny: number }[];
    darkCardId2?: string;
    darkCardName2?: string;
    darkBasePower2?: number;
    darkBonus2?: number;
    darkWeaponCardId2?: string;
    darkWeaponName2?: string;
    darkWeaponBonus2?: number;
    darkDestinyDraws2?: { cardId: string; destiny: number }[];
    lightCardId3?: string;
    lightCardName3?: string;
    lightBasePower3?: number;
    lightBonus3?: number;
    lightWeaponCardId3?: string;
    lightWeaponName3?: string;
    lightWeaponBonus3?: number;
    lightDestinyDraws3?: { cardId: string; destiny: number }[];
    darkCardId3?: string;
    darkCardName3?: string;
    darkBasePower3?: number;
    darkBonus3?: number;
    darkWeaponCardId3?: string;
    darkWeaponName3?: string;
    darkWeaponBonus3?: number;
    darkDestinyDraws3?: { cardId: string; destiny: number }[];
    lightGametextBonusLabel?: string;
    darkGametextBonusLabel?: string;
  }[];
}

let instanceIdCounter = 0;
function nextInstanceId(): string {
  return "inst_" + String(++instanceIdCounter);
}

const DEFAULT_LIGHT_DECK = "starter_deck";
const DEFAULT_DARK_DECK = "starter_dark_deck";

/**
 * Build initial deck from deck definition or custom card list.
 * Each entry may include set for correct lookup when same id exists in multiple sets.
 * Returns array of CardInstance in deck zone.
 */
function buildDeck(
  side: Side,
  playerId: string,
  deckId: string,
  customCards?: { id: string; set?: string; count: number }[]
): CardInstance[] {
  const list = customCards && customCards.length > 0 ? customCards : getStarterDeckCardList(deckId);
  const deck: CardInstance[] = [];
  for (const entry of list) {
    const { id, set: cardSet, count } = entry;
    for (let i = 0; i < count; i++) {
      deck.push({
        instanceId: nextInstanceId(),
        cardId: id,
        cardSet,
        ownerSide: side,
        zone: "deck",
        position: deck.length,
      });
    }
  }
  shuffleDeck(deck);
  return deck;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Shuffle deck and update each card's position to match its index (game knows order, player does not). */
export function shuffleDeck(deck: CardInstance[]): void {
  shuffle(deck);
  for (let i = 0; i < deck.length; i++) {
    deck[i].position = i;
  }
}

/** Update position of every card in deck to match its current index. */
function updateDeckPositions(deck: CardInstance[]): void {
  for (let i = 0; i < deck.length; i++) {
    deck[i].position = i;
  }
}

export function createGameState(
  gameId: string,
  tableId: string,
  lightPlayerId: string,
  darkPlayerId: string,
  lightName: string,
  darkName: string,
  phaseDurationMs: number,
  lightDeckId?: string,
  darkDeckId?: string,
  lightCustomCards?: { id: string; set?: string; count: number }[],
  darkCustomCards?: { id: string; set?: string; count: number }[]
): GameStateData {
  const light: PlayerGameState = {
    playerId: lightPlayerId,
    name: lightName,
    deck: buildDeck("light", lightPlayerId, lightDeckId ?? DEFAULT_LIGHT_DECK, lightCustomCards),
    hand: [],
    inPlay: [],
    discard: [],
    hyperspace: [],
    life: 20,
    force: 0,
  };
  const dark: PlayerGameState = {
    playerId: darkPlayerId,
    name: darkName,
    deck: buildDeck("dark", darkPlayerId, darkDeckId ?? DEFAULT_DARK_DECK, darkCustomCards),
    hand: [],
    inPlay: [],
    discard: [],
    hyperspace: [],
    life: 20,
    force: 0,
  };
  const now = Date.now();
  return {
    id: gameId,
    tableId,
    lightPlayerId,
    darkPlayerId,
    phase: "determine_first",
    turnSide: "light",
    turnNumber: 1,
    phaseStartedAt: now,
    phaseDurationMs,
    light,
    dark,
    lightTurnCount: 0,
    darkTurnCount: 0,
    ruleset: "dotf",
  };
}

export function drawCards(state: GameStateData, side: Side, count: number): void {
  const p = side === "light" ? state.light : state.dark;
  for (let i = 0; i < count && p.deck.length > 0; i++) {
    const card = p.deck.pop()!;
    card.zone = "hand";
    card.position = p.hand.length;
    p.hand.push(card);
  }
}

/**
 * Draw top card from each deck for destiny compare (who goes first).
 * Cards are held in state.destinyLightCard / destinyDarkCard until put back.
 * Appends this round to state.destinyCompareRounds for display (all pairs when ties occur).
 */
export function runDestinyCompareRound(state: GameStateData): void {
  if (!state.destinyCompareRounds) state.destinyCompareRounds = [];
  state.destinyLightCard = state.light.deck.length > 0 ? state.light.deck.pop()! : null;
  state.destinyDarkCard = state.dark.deck.length > 0 ? state.dark.deck.pop()! : null;
  if (state.destinyLightCard && state.destinyDarkCard) {
    state.destinyCompareRounds.push({
      light: {
        cardId: state.destinyLightCard.cardId,
        destiny: getDestinyValue(state.destinyLightCard.cardId, state.destinyLightCard.cardSet),
      },
      dark: {
        cardId: state.destinyDarkCard.cardId,
        destiny: getDestinyValue(state.destinyDarkCard.cardId, state.destinyDarkCard.cardSet),
      },
    });
  }
}

/**
 * Put current destiny compare cards back on top of their decks and clear them.
 * Also puts back any previously drawn destiny cards (from tie rounds) and updates deck positions.
 */
export function putDestinyCardsBack(state: GameStateData): void {
  if (state.destinyLightCard) {
    state.destinyLightCard.zone = "deck";
    state.light.deck.push(state.destinyLightCard);
    state.destinyLightCard = null;
  }
  if (state.destinyDarkCard) {
    state.destinyDarkCard.zone = "deck";
    state.dark.deck.push(state.destinyDarkCard);
    state.destinyDarkCard = null;
  }
  if (state.destinyDrawnLight?.length) {
    for (let i = state.destinyDrawnLight.length - 1; i >= 0; i--) {
      const c = state.destinyDrawnLight[i];
      c.zone = "deck";
      state.light.deck.push(c);
    }
    state.destinyDrawnLight = [];
  }
  if (state.destinyDrawnDark?.length) {
    for (let i = state.destinyDrawnDark.length - 1; i >= 0; i--) {
      const c = state.destinyDrawnDark[i];
      c.zone = "deck";
      state.dark.deck.push(c);
    }
    state.destinyDrawnDark = [];
  }
  updateDeckPositions(state.light.deck);
  updateDeckPositions(state.dark.deck);
}

/**
 * Get destiny numbers for the current destiny compare cards (0 if none).
 */
export function getDestinyCompareValues(state: GameStateData): { light: number; dark: number } {
  const light = state.destinyLightCard ? getDestinyValue(state.destinyLightCard.cardId, state.destinyLightCard.cardSet) : 0;
  const dark = state.destinyDarkCard ? getDestinyValue(state.destinyDarkCard.cardId, state.destinyDarkCard.cardSet) : 0;
  return { light, dark };
}

/**
 * Resolve destiny compare when timer fires: compare values.
 * If winner: put all drawn destiny cards back (current + any from tie rounds), set turnSide and phase.
 * If tie: do not put cards back; draw the next card from each deck and add to rounds.
 */
export function resolveDestinyCompare(state: GameStateData): { done: boolean; winner?: Side } {
  const { light: lightDestiny, dark: darkDestiny } = getDestinyCompareValues(state);
  if (lightDestiny > darkDestiny) {
    putDestinyCardsBack(state);
    state.turnSide = "light";
    state.phase = "choose_starting_location";
    state.phaseStartedAt = Date.now();
    extractStartingLocationChoices(state);
    return { done: true, winner: "light" };
  }
  if (darkDestiny > lightDestiny) {
    putDestinyCardsBack(state);
    state.turnSide = "dark";
    state.phase = "choose_starting_location";
    state.phaseStartedAt = Date.now();
    extractStartingLocationChoices(state);
    return { done: true, winner: "dark" };
  }
  if (!state.destinyDrawnLight) state.destinyDrawnLight = [];
  if (!state.destinyDrawnDark) state.destinyDrawnDark = [];
  if (state.destinyLightCard) state.destinyDrawnLight.push(state.destinyLightCard);
  if (state.destinyDarkCard) state.destinyDrawnDark.push(state.destinyDarkCard);
  state.destinyLightCard = state.light.deck.length > 0 ? state.light.deck.pop()! : null;
  state.destinyDarkCard = state.dark.deck.length > 0 ? state.dark.deck.pop()! : null;
  if (state.destinyLightCard && state.destinyDarkCard) {
    state.destinyCompareRounds!.push({
      light: {
        cardId: state.destinyLightCard.cardId,
        destiny: getDestinyValue(state.destinyLightCard.cardId, state.destinyLightCard.cardSet),
      },
      dark: {
        cardId: state.destinyDarkCard.cardId,
        destiny: getDestinyValue(state.destinyDarkCard.cardId, state.destinyDarkCard.cardSet),
      },
    });
  }
  return { done: false };
}

/**
 * Remove all location cards from the first player's deck into startingLocationChoices.
 * If there are no location cards, skip to draw phase and draw 6 each.
 */
export function extractStartingLocationChoices(state: GameStateData): void {
  const side = state.turnSide;
  const p = side === "light" ? state.light : state.dark;
  const locations: CardInstance[] = [];
  const rest: CardInstance[] = [];
  for (const c of p.deck) {
    if (isLocationCard(c.cardId, c.cardSet)) locations.push(c);
    else rest.push(c);
  }
  p.deck = rest;
  if (locations.length === 0) {
    state.phase = "draw";
    state.phaseStartedAt = Date.now();
    drawCards(state, "light", 6);
    drawCards(state, "dark", 6);
    return;
  }
  state.startingLocationChoices = locations;
}

/**
 * Apply starting location choice: chosen card to inPlay, rest shuffled back into deck.
 * Then shuffle both decks and draw 6 each.
 */
export function applyStartingLocationChoice(
  state: GameStateData,
  side: Side,
  instanceId: string
): boolean {
  if (state.phase !== "choose_starting_location" || state.turnSide !== side) return false;
  const choices = state.startingLocationChoices;
  if (!choices || choices.length === 0) return false;
  const idx = choices.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const [chosen] = choices.splice(idx, 1);
  const p = side === "light" ? state.light : state.dark;
  chosen.zone = "in_play";
  chosen.position = p.inPlay.length;
  p.inPlay.push(chosen);
  state.startingLocationInstanceId = chosen.instanceId;
  const planet = getLocationPlanet(chosen.cardId, chosen.cardSet);
  if (planet) {
    if (!state.usedPlanets) state.usedPlanets = [];
    if (!state.usedPlanets.includes(planet)) state.usedPlanets.push(planet);
  }
  for (const c of choices) {
    c.zone = "deck";
    p.deck.push(c);
  }
  state.startingLocationChoices = undefined;
  shuffleDeck(p.deck);
  const other = side === "light" ? state.dark : state.light;
  shuffleDeck(other.deck);
  // Go straight to deploy (skip draw phase) so the first player can play cards immediately
  state.phase = "deploy";
  state.phaseStartedAt = Date.now();
  state.turnSide = side;
  onEnterDeploy(state, side);
  setForce(state, side, 6);
  drawCards(state, "light", 6);
  drawCards(state, "dark", 6);
  return true;
}

/** Build client-safe snapshot (no card identities in hand for opponent). */
export function toSnapshot(state: GameStateData, forSide?: Side): import("../types").GameStateSnapshot {
  const lightView: import("../types").PlayerGameView = {
    playerId: state.light.playerId,
    name: state.light.name,
    handCount: state.light.hand.length,
    deckCount: state.light.deck.length,
    discardCount: state.light.discard.length,
    topDiscardCardId:
      state.light.discard.length > 0
        ? state.light.discard[state.light.discard.length - 1].cardId
        : undefined,
    life: state.light.life,
    force: state.light.force,
  };
  const darkView: import("../types").PlayerGameView = {
    playerId: state.dark.playerId,
    name: state.dark.name,
    handCount: state.dark.hand.length,
    deckCount: state.dark.deck.length,
    discardCount: state.dark.discard.length,
    topDiscardCardId:
      state.dark.discard.length > 0
        ? state.dark.discard[state.dark.discard.length - 1].cardId
        : undefined,
    life: state.dark.life,
    force: state.dark.force,
  };
  const phaseEndsAt = state.phaseStartedAt + state.phaseDurationMs;
  const publicState: Record<string, unknown> = {
    ruleset: state.ruleset ?? "dotf",
    lightInPlay: state.light.inPlay.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
      faceDown: c.faceDown === true,
    })),
    darkInPlay: state.dark.inPlay.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
      faceDown: c.faceDown === true,
    })),
    lightHyperspace: (state.light.hyperspace ?? []).map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
    })),
    darkHyperspace: (state.dark.hyperspace ?? []).map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
    })),
  };
  if (state.phase === "determine_first" && (state.destinyCompareRounds?.length ?? 0) > 0) {
    publicState.destinyCompare = {
      rounds: state.destinyCompareRounds ?? [],
      light: state.destinyLightCard
        ? { cardId: state.destinyLightCard.cardId, destiny: getDestinyValue(state.destinyLightCard.cardId, state.destinyLightCard.cardSet) }
        : undefined,
      dark: state.destinyDarkCard
        ? { cardId: state.destinyDarkCard.cardId, destiny: getDestinyValue(state.destinyDarkCard.cardId, state.destinyDarkCard.cardSet) }
        : undefined,
    };
  }
  if (state.phase === "choose_starting_location" && state.startingLocationChoices?.length) {
    publicState.startingLocationChoices = state.startingLocationChoices.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
    }));
  }
  if (state.phase === "choose_next_planet" && state.nextPlanetChoices?.length) {
    publicState.nextPlanetChoices = state.nextPlanetChoices.map((c) => ({
      instanceId: c.instanceId,
      cardId: c.cardId,
      ...(c.cardSet ? { set: c.cardSet } : {}),
    }));
    publicState.nextPlanetChooserSide = state.nextPlanetChooserSide;
  }
  if (state.controlledPlanets && state.controlledPlanets.length > 0) {
    publicState.controlledPlanets = state.controlledPlanets;
  }
  publicState.lightPlanetsWon = state.lightPlanetsWon ?? 0;
  publicState.darkPlanetsWon = state.darkPlanetsWon ?? 0;
  if (state.startingLocationInstanceId) {
    publicState.startingLocationInstanceId = state.startingLocationInstanceId;
  }
  publicState.lightTurnCount = state.lightTurnCount;
  publicState.darkTurnCount = state.darkTurnCount;
  if (state.battleCardDeclareSide) {
    publicState.battleCardDeclareSide = state.battleCardDeclareSide;
    publicState.lightBattleCardCount = state.lightDeclaredBattleCards?.length ?? 0;
    publicState.darkBattleCardCount = state.darkDeclaredBattleCards?.length ?? 0;
    publicState.lightBattleCardsDeclared = state.lightDeclaredBattleCards !== undefined;
    publicState.darkBattleCardsDeclared = state.darkDeclaredBattleCards !== undefined;
  }
  if (state.battlePlanPhase) {
    publicState.battlePlanPhase = true;
    publicState.lightBattlePlanReady = state.lightBattlePlanReady === true;
    publicState.darkBattlePlanReady = state.darkBattlePlanReady === true;
    publicState.lightBattleCardCount = state.lightDeclaredBattleCards?.length ?? 0;
    publicState.darkBattleCardCount = state.darkDeclaredBattleCards?.length ?? 0;
    publicState.lightBattleCardsDeclared = state.lightDeclaredBattleCards !== undefined;
    publicState.darkBattleCardsDeclared = state.darkDeclaredBattleCards !== undefined;
  }
  if (state.battleRevealSequence && state.battleRevealSequence.length > 0) {
    publicState.battleRevealSequence = state.battleRevealSequence;
  }
  if (state.surrenderPending) {
    publicState.surrenderPending = state.surrenderPending;
  }
  if (state.evacuationState) {
    const evac = state.evacuationState;
    publicState.evacuationState = {
      evacuatingSide: evac.evacuatingSide,
      transportCardId: evac.transportCardId,
      targetPlanetIndex: evac.targetPlanetIndex,
      stackedCardIds: evac.stackedCards.map((c) => c.cardId),
      awaitingInterception: evac.awaitingInterception,
      hyperspace: (state.ruleset ?? "dotf") !== "classic",
    };
  }
  if (state.evacuationResult) {
    publicState.evacuationResult = state.evacuationResult;
  }
  if (state.effectActivationPending) {
    const pending = state.effectActivationPending;
    if (pending.kind === "peek_opp_deck") {
      publicState.effectActivationPending = {
        side: pending.side,
        effectInstanceId: pending.effectInstanceId,
        effectCardId: pending.effectCardId,
        effectCardName: pending.effectCardName,
        countersToAdd: 0,
        kind: "peek_opp_deck",
        ...(forSide === pending.side
          ? {
              peekedInstanceId: pending.peekedInstanceId,
              peekedCardId: pending.peekedCardId,
              peekedSet: pending.peekedSet,
            }
          : {}),
      };
    } else {
      publicState.effectActivationPending = pending;
    }
  }
  if (state.usedEffectsThisTurn && state.usedEffectsThisTurn.length > 0) {
    publicState.usedEffectsThisTurn = state.usedEffectsThisTurn;
  }
  if (state.starshipBattlePhase) {
    publicState.starshipBattlePhase = true;
    publicState.starshipBattleAttacker = state.starshipBattleAttacker;
  }
  if (state.planetEffectFetch) {
    publicState.planetEffectFetch = {
      chooserSide: state.planetEffectFetch.chooserSide,
      locationChooser: state.planetEffectFetch.locationChooser,
      lightDone: state.planetEffectFetch.lightDone,
      darkDone: state.planetEffectFetch.darkDone,
      lastFetched: state.planetEffectFetch.lastFetched,
      effectChoices:
        forSide && state.planetEffectFetch.chooserSide === forSide
          ? state[forSide].deck
              .filter((c) => isEffectCard(c.cardId, c.cardSet))
              .map((c) => ({
                instanceId: c.instanceId,
                cardId: c.cardId,
                ...(c.cardSet ? { set: c.cardSet } : {}),
              }))
          : [],
    };
  }
  if (state.deployFromDeckPending) {
    const p = state.deployFromDeckPending;
    publicState.deployFromDeckPending = {
      side: p.side,
      searcherCardId: p.searcherCardId,
      targetId: p.targetId,
      cost: p.cost,
      foundCardId: p.foundCardId,
      foundSet: p.foundSet,
      found: !!p.foundInstanceId,
    discardSearcher: !!p.discardSearcher,
    };
  }
  if (state.deployDrawPending) {
    publicState.deployDrawPending = { side: state.deployDrawPending.side, count: state.deployDrawPending.count };
  }
  if (state.jediTrainingPending) {
    const p = state.jediTrainingPending;
    publicState.jediTrainingPending = {
      side: p.side,
      jediCardId: p.jediCardId,
      choices: forSide === p.side ? p.choices : [],
    };
  }
  if (state.poundedPending) {
    const p = state.poundedPending;
    publicState.poundedPending = {
      side: p.side,
      targets: forSide === p.side ? p.targets : [],
    };
  }
  if (state.winControlPending) {
    const p = state.winControlPending;
    publicState.winControlPending = {
      side: p.side,
      characterInstanceId: p.characterInstanceId,
      characterCardId: p.characterCardId,
      characterName: getCardName(p.characterCardId),
      planetIndex: p.planetIndex,
      discardHand: p.discardHand,
      draw: p.draw,
    };
  }
  if (state.destinySwapPending) {
    publicState.destinySwapPending = state.destinySwapPending;
  }
  if (state.damageReplacePending) {
    publicState.damageReplacePending = state.damageReplacePending;
  }
  if (state.duelState) {
    const d = state.duelState;
    publicState.duelState = {
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
        ? {
            cardId: d.pendingAttack.cardId,
            destiny: d.pendingAttack.destiny,
            side: d.pendingAttack.side,
            ...(d.pendingAttack.cardSet ? { set: d.pendingAttack.cardSet } : {}),
          }
        : undefined,
      yourDuelHand: (() => {
        const mine = forSide === "light" ? d.lightDuelHand : forSide === "dark" ? d.darkDuelHand : [];
        const hide =
          d.pendingAttack && d.pendingAttack.side === forSide && !d.pendingAttack.discarded
            ? d.pendingAttack.instanceId
            : "";
        return mine
          .filter((c) => c.instanceId !== hide)
          .map((c) => ({
            instanceId: c.instanceId,
            cardId: c.cardId,
            ...(c.cardSet ? { set: c.cardSet } : {}),
          }));
      })(),
    };
  }
  publicState.duelUsedThisTurn = state.duelUsedThisTurn === true;
  return {
    phase: state.phase,
    turnSide: state.turnSide,
    turnNumber: state.turnNumber,
    phaseEndsAt,
    light: lightView,
    dark: darkView,
    publicState,
  };
}

/** Get full hand for the given side (for that player's view only). */
export function getHandCardIds(state: GameStateData, side: Side): string[] {
  const p = side === "light" ? state.light : state.dark;
  return p.hand.map((c) => c.cardId);
}

/** Get hand with instanceId (and set for same-name cards) for play_card actions. */
export function getHandWithInstanceIds(state: GameStateData, side: Side): { instanceId: string; cardId: string; set?: string }[] {
  const p = side === "light" ? state.light : state.dark;
  return p.hand.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, ...(c.cardSet ? { set: c.cardSet } : {}) }));
}

/** Find a card instance in hand by instanceId. */
export function findInHand(state: GameStateData, side: Side, instanceId: string): CardInstance | undefined {
  const p = side === "light" ? state.light : state.dark;
  return p.hand.find((c) => c.instanceId === instanceId);
}

/** Move all cards from hand to discard, then draw count cards. Discard pile is always face up. */
export function discardHandAndDraw(state: GameStateData, side: Side, drawCount: number): void {
  const p = side === "light" ? state.light : state.dark;
  for (const c of p.hand) {
    c.faceDown = false;
    c.zone = "discard";
    p.discard.push(c);
  }
  p.hand = [];
  drawCards(state, side, drawCount);
}

/** Move one card from hand to discard by instanceId. Returns true if found and moved. */
export function discardFromHand(state: GameStateData, side: Side, instanceId: string): boolean {
  const p = side === "light" ? state.light : state.dark;
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const [card] = p.hand.splice(idx, 1);
  card.zone = "discard";
  p.discard.push(card);
  return true;
}

/** Move a location card from in_play to discard. Returns true if found and moved (must be location type). Discard is face up. */
export function discardLocationFromInPlay(state: GameStateData, side: Side, instanceId: string): boolean {
  const p = side === "light" ? state.light : state.dark;
  const idx = p.inPlay.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const card = p.inPlay[idx];
  if (!isLocationCard(card.cardId, card.cardSet)) return false;
  p.inPlay.splice(idx, 1);
  card.faceDown = false;
  card.zone = "discard";
  p.discard.push(card);
  if (state.startingLocationInstanceId === instanceId) state.startingLocationInstanceId = null;
  return true;
}

export function getForce(state: GameStateData, side: Side): number {
  const p = side === "light" ? state.light : state.dark;
  return p.force;
}

export function setForce(state: GameStateData, side: Side, value: number): void {
  const p = side === "light" ? state.light : state.dark;
  p.force = value;
}

/** Add to current force (e.g. from effect "yourDeployDiscard:counters+N"). */
export function addForce(state: GameStateData, side: Side, amount: number): void {
  const p = side === "light" ? state.light : state.dark;
  p.force = Math.max(0, (p.force ?? 0) + amount);
}

/** Subtract cost from force. Returns false if not enough force. */
export function spendForce(state: GameStateData, side: Side, cost: number): boolean {
  const p = side === "light" ? state.light : state.dark;
  const costNum = Math.floor(Number(cost)) || 0;
  const forceNum = Math.floor(Number(p.force)) || 0;
  if (forceNum < costNum) return false;
  p.force = forceNum - costNum;
  return true;
}

/**
 * Effective deploy cost for a character card, applying gametextbonus "N, cost, conditionCardId".
 * If the condition card (cardId containing conditionCardId) is at the current location (in play), returns N; otherwise returns the card's base cost.
 */
export function getDeployCostWithGametextBonus(state: GameStateData, side: Side, cardId: string, cardSet?: string): number {
  const def = getCard(cardId, cardSet);
  if (!def || (def as { type?: string }).type !== "character") {
    const base = (def as { cost?: number }).cost;
    return typeof base === "number" ? Math.floor(base) : 0;
  }
  const baseCost = Math.floor(Number((def as { cost?: number }).cost)) || 0;
  const gametextbonus = (def as { gametextbonus?: string }).gametextbonus;
  if (!gametextbonus || typeof gametextbonus !== "string") return baseCost;
  const costClause = parseGametextBonusClauses(gametextbonus).find((c) => c.what === "cost");
  if (!costClause) return baseCost;
  const reducedCost = costClause.num;
  const conditionId = costClause.condition;
  if (!conditionId) return baseCost;
  const inPlay = [...state.light.inPlay, ...state.dark.inPlay];
  const conditionAtLocation = inPlay.some((c) => c.cardId.toLowerCase().includes(conditionId));
  return conditionAtLocation ? reducedCost : baseCost;
}

/** Printed weapon cost, unless a face-up effect here says that weapon deploys for free. */
export function getWeaponDeployCost(state: GameStateData, side: Side, cardId: string, cardSet?: string): number {
  const def = getCard(cardId, cardSet);
  const base = Math.floor(Number((def as { cost?: number } | undefined)?.cost)) || 0;
  if (base <= 0) return 0;
  const id = cardId.toLowerCase();
  const name = ((def as { name?: string } | undefined)?.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const eff of getEffectsAtLocation(state, side)) {
    if (eff.faceDown) continue;
    const effects = ((getCard(eff.cardId, eff.cardSet) as { effects?: string } | undefined)?.effects ?? "").toLowerCase();
    const match = effects.match(/deployfree:([a-z0-9]+)/);
    if (!match) continue;
    const token = match[1];
    if (id.includes(token) || name.includes(token)) return 0;
  }
  return base;
}

/** Call when a side's deploy phase starts: flip their face-down cards if starting their second turn, then increment their turn count.
 * Also flips face-down stranded cards at controlled planets (e.g. after surrender on first turn). */
export function onEnterDeploy(state: GameStateData, turnSide: Side): void {
  const count = turnSide === "light" ? state.lightTurnCount : state.darkTurnCount;
  if (count === 1) {
    const inPlay = turnSide === "light" ? state.light.inPlay : state.dark.inPlay;
    for (const c of inPlay) c.faceDown = false;
  }
  const strandedKey = turnSide === "light" ? "strandedLight" : "strandedDark";
  for (const cp of state.controlledPlanets ?? []) {
    const list = cp[strandedKey] as { instanceId: string; cardId: string; faceDown?: boolean }[];
    if (list) {
      for (const c of list) {
        if (c.faceDown) c.faceDown = false;
      }
    }
  }
  if (turnSide === "light") state.lightTurnCount += 1;
  else state.darkTurnCount += 1;
}

/** Move one card from hand to in_play. Returns true if moved. Cards deployed on a side's first turn are face down. */
export function playCardToTable(state: GameStateData, side: Side, instanceId: string): boolean {
  const p = side === "light" ? state.light : state.dark;
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return false;
  const [card] = p.hand.splice(idx, 1);
  card.zone = "in_play";
  card.position = p.inPlay.length;
  const turnCount = side === "light" ? state.lightTurnCount : state.darkTurnCount;
  if (turnCount === 1) card.faceDown = true;
  p.inPlay.push(card);
  return true;
}

/** Take a face-down character deployed this turn back to hand and refund what it cost. */
export function returnFaceDownCharacter(
  state: GameStateData,
  side: Side,
  instanceId: string
): { ok: boolean; error?: string } {
  if (state.phase !== "deploy") return { ok: false, error: "Can only take a card back during deploy" };
  if (state.turnSide !== side) return { ok: false, error: "Not your turn" };
  if (
    state.planetEffectFetch ||
    state.deployFromDeckPending ||
    state.effectActivationPending ||
    state.jediTrainingPending ||
    state.deployDrawPending ||
    state.winControlPending ||
    state.duelState ||
    state.poundedPending
  ) {
    return { ok: false, error: "Finish the current choice before taking a card back" };
  }
  const p = side === "light" ? state.light : state.dark;
  const idx = p.inPlay.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return { ok: false, error: "That card is not in play" };
  const card = p.inPlay[idx];
  if (!card.faceDown) return { ok: false, error: "Only a face-down character can be taken back" };
  const def = getCard(card.cardId, card.cardSet);
  if (!def || (def as { type?: string }).type !== "character") {
    return { ok: false, error: "Only a character can be taken back" };
  }
  const cost = getDeployCostWithGametextBonus(state, side, card.cardId, card.cardSet);
  p.inPlay.splice(idx, 1);
  card.zone = "hand";
  card.faceDown = false;
  p.hand.push(card);
  addForce(state, side, cost);
  return { ok: true };
}

/** Draw top card of deck for destiny; return destiny number (0 if no card or no destiny). Card goes to discard face up. */
export function drawDestiny(state: GameStateData, side: Side): number {
  const p = side === "light" ? state.light : state.dark;
  if (p.deck.length === 0) return 0;
  const card = p.deck.pop()!;
  card.faceDown = false;
  card.zone = "discard";
  p.discard.push(card);
  const def = getCard(card.cardId, card.cardSet);
  if (!def || typeof (def as { destiny?: number }).destiny !== "number") return 0;
  return (def as { destiny: number }).destiny;
}

/** Total power of characters + weapons in play for one side (simple sum). */
export function totalPowerInPlay(state: GameStateData, side: Side): number {
  const p = side === "light" ? state.light : state.dark;
  let total = 0;
  for (const c of p.inPlay) {
    const def = getCard(c.cardId, c.cardSet);
    if (!def) continue;
    const d = def as { type: string; power?: number };
    if (d.type === "character" || d.type === "weapon" || d.type === "starship") {
      total += typeof d.power === "number" ? d.power : 0;
    }
  }
  return total;
}

/** Get character/weapon cards at location (in-play, excluding the location card itself). Face-down cards are excluded for battle. */
export function getCharactersAtLocation(
  state: GameStateData,
  side: Side,
  faceUpOnly: boolean
): CardInstance[] {
  const locId = state.startingLocationInstanceId;
  const p = side === "light" ? state.light : state.dark;
  return p.inPlay.filter((c) => {
    if (c.instanceId === locId) return false;
    if (!isCharacterOrWeapon(c.cardId)) return false;
    if (faceUpOnly && c.faceDown) return false;
    return true;
  });
}

/** Get effect cards at current location for a side (effects are in inPlay, one per player max). */
function getEffectsAtLocation(state: GameStateData, side: Side): CardInstance[] {
  const p = side === "light" ? state.light : state.dark;
  return p.inPlay.filter((c) => isEffectCard(c.cardId, c.cardSet));
}

/** When a planet is won/lost or surrendered, discard any effect cards at that location to discard (they do not go to stranded). */
function discardEffectsAtLocation(state: GameStateData): void {
  for (const side of ["light", "dark"] as Side[]) {
    const p = side === "light" ? state.light : state.dark;
    const effects = p.inPlay.filter((c) => isEffectCard(c.cardId, c.cardSet));
    p.inPlay = p.inPlay.filter((c) => !isEffectCard(c.cardId, c.cardSet));
    for (const c of effects) {
      c.zone = "discard";
      c.faceDown = false;
      p.discard.push(c);
    }
  }
}

/** True if this side already has an effect at the current location (only 1 effect per player at location). */
export function hasEffectAtLocation(state: GameStateData, side: Side): boolean {
  return getEffectsAtLocation(state, side).length > 0;
}

/** Parse effect "effects" for "yourDeploy:counters+N". Returns N or 0 if not present (static bonus at start of your deploy). */
export function getEffectYourDeployCounters(effectCardId: string, effectSet?: string): number {
  const def = getCard(effectCardId, effectSet);
  if (!def || (def as { type?: string }).type !== "effect") return 0;
  const effectsStr = (def as { effects?: string }).effects;
  if (!effectsStr || typeof effectsStr !== "string") return 0;
  const m = effectsStr.match(/yourDeploy:counters\+(\d+)/i);
  return m ? Math.max(0, parseInt(m[1], 10)) : 0;
}

/** Total extra force from effects with "yourDeploy:counters+N" at this side's location (for start of deploy). */
export function getEffectYourDeployCountersBonus(state: GameStateData, side: Side): number {
  const effects = getEffectsAtLocation(state, side);
  let total = 0;
  for (const eff of effects) {
    total += getEffectYourDeployCounters(eff.cardId, eff.cardSet);
  }
  return total;
}

/** Parse effect "effects" for "evenup:evenup+N". Returns N or 0 if not present (draw up to 6+N cards when evening up). */
export function getEffectEvenUpBonus(effectCardId: string, effectSet?: string): number {
  const def = getCard(effectCardId, effectSet);
  if (!def || (def as { type?: string }).type !== "effect") return 0;
  const effectsStr = (def as { effects?: string }).effects;
  if (!effectsStr || typeof effectsStr !== "string") return 0;
  const m = effectsStr.match(/evenup:evenup\+(\d+)/i);
  return m ? Math.max(0, parseInt(m[1], 10)) : 0;
}

/** Total even-up bonus from effects at this side's location: target hand size is 6 + this (e.g. 7 with "evenup:evenup+1"). */
export function getEffectEvenUpTarget(state: GameStateData, side: Side): number {
  const effects = getEffectsAtLocation(state, side);
  let bonus = 0;
  for (const eff of effects) {
    bonus += getEffectEvenUpBonus(eff.cardId, eff.cardSet);
  }
  return 6 + bonus;
}

/** Parse effect "effects" for "yourDeployDiscard:counters+N". Returns N or 0 if not present. */
export function getEffectYourDeployDiscardCounters(effectCardId: string, effectSet?: string): number {
  const def = getCard(effectCardId, effectSet);
  if (!def || (def as { type?: string }).type !== "effect") return 0;
  const effectsStr = (def as { effects?: string }).effects;
  if (!effectsStr || typeof effectsStr !== "string") return 0;
  const m = effectsStr.match(/yourDeployDiscard:counters\+(\d+)/i);
  return m ? Math.max(0, parseInt(m[1], 10)) : 0;
}

/** Start waiting for player to discard a card for this effect (or decline). Returns true if effect is valid and pending set. */
export function startEffectActivation(
  state: GameStateData,
  side: Side,
  effectInstanceId: string
): { ok: boolean; error?: string } {
  if (state.phase !== "deploy") return { ok: false, error: "Can only use this effect during deploy phase" };
  if (state.turnSide !== side) return { ok: false, error: "Not your turn" };
  if (state.effectActivationPending) return { ok: false, error: "Another effect activation is pending" };
  const p = side === "light" ? state.light : state.dark;
  const effectCard = p.inPlay.find((c) => c.instanceId === effectInstanceId && isEffectCard(c.cardId, c.cardSet));
  if (!effectCard) return { ok: false, error: "Effect not found in play" };
  if (effectCard.faceDown) return { ok: false, error: "Effect must be face up to use this ability" };
  if (state.usedEffectsThisTurn?.includes(effectInstanceId)) return { ok: false, error: "This effect was already used this turn" };
  const effectsStr = ((getCard(effectCard.cardId, effectCard.cardSet) as { effects?: string } | undefined)?.effects ?? "").toLowerCase();
  if (effectsStr.includes("bottomhand:")) {
    const owner = side === "light" ? state.light : state.dark;
    if (owner.hand.length === 0) return { ok: false, error: "No cards in hand to put under your deck" };
    state.effectActivationPending = {
      side,
      effectInstanceId,
      effectCardId: effectCard.cardId,
      effectCardName: getCardName(effectCard.cardId),
      countersToAdd: 0,
      kind: "bottom_hand",
    };
    return { ok: true };
  }
  if (effectsStr.includes("peekopp:top")) {
    const opp = side === "light" ? state.dark : state.light;
    const top = opp.deck[opp.deck.length - 1];
    if (!top) return { ok: false, error: "Opponent's deck is empty" };
    state.effectActivationPending = {
      side,
      effectInstanceId,
      effectCardId: effectCard.cardId,
      effectCardName: getCardName(effectCard.cardId),
      countersToAdd: 0,
      kind: "peek_opp_deck",
      peekedInstanceId: top.instanceId,
      peekedCardId: top.cardId,
      peekedSet: top.cardSet,
    };
    return { ok: true };
  }
  const countersToAdd = getEffectYourDeployDiscardCounters(effectCard.cardId, effectCard.cardSet);
  if (countersToAdd <= 0) return { ok: false, error: "This effect has no deploy ability" };
  state.effectActivationPending = {
    side,
    effectInstanceId,
    effectCardId: effectCard.cardId,
    effectCardName: getCardName(effectCard.cardId),
    countersToAdd,
    kind: "discard_counters",
  };
  return { ok: true };
}

/** Put the peeked card back on top, or under the opponent's deck. */
export function resolveOppDeckPeek(state: GameStateData, side: Side, place: "top" | "bottom"): { ok: boolean; error?: string } {
  const pending = state.effectActivationPending;
  if (!pending || pending.side !== side || pending.kind !== "peek_opp_deck") {
    return { ok: false, error: "No deck peek to resolve" };
  }
  const opp = side === "light" ? state.dark : state.light;
  if (place === "bottom" && pending.peekedInstanceId) {
    const idx = opp.deck.findIndex((c) => c.instanceId === pending.peekedInstanceId);
    if (idx >= 0) {
      const [card] = opp.deck.splice(idx, 1);
      opp.deck.unshift(card);
    }
  }
  if (!state.usedEffectsThisTurn) state.usedEffectsThisTurn = [];
  state.usedEffectsThisTurn.push(pending.effectInstanceId);
  state.effectActivationPending = undefined;
  return { ok: true };
}

/** Jedi Meditation: move one hand card under this side's deck. */
export function placeHandCardUnderDeck(state: GameStateData, side: Side, instanceId: string): { ok: boolean; error?: string } {
  const pending = state.effectActivationPending;
  if (!pending || pending.side !== side || pending.kind !== "bottom_hand") {
    return { ok: false, error: "No card to put under your deck" };
  }
  const p = side === "light" ? state.light : state.dark;
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx < 0) return { ok: false, error: "Card not in hand" };
  const [card] = p.hand.splice(idx, 1);
  card.zone = "deck";
  card.faceDown = undefined;
  p.deck.unshift(card);
  if (!state.usedEffectsThisTurn) state.usedEffectsThisTurn = [];
  state.usedEffectsThisTurn.push(pending.effectInstanceId);
  state.effectActivationPending = undefined;
  return { ok: true };
}

/** Clear effect activation pending (player declined). */
export function clearEffectActivation(state: GameStateData): void {
  state.effectActivationPending = undefined;
}

/** If player discards a card from hand to complete the effect, add counters and clear pending. Returns true if valid. */
export function applyEffectDiscardAndAddCounters(
  state: GameStateData,
  side: Side,
  cardInstanceIdToDiscard: string
): { ok: boolean; error?: string } {
  const pending = state.effectActivationPending;
  if (!pending || pending.side !== side || pending.kind === "peek_opp_deck" || pending.kind === "bottom_hand") return { ok: false, error: "No effect activation pending" };
  const p = side === "light" ? state.light : state.dark;
  const idx = p.hand.findIndex((c) => c.instanceId === cardInstanceIdToDiscard);
  if (idx < 0) return { ok: false, error: "Card not in hand" };
  const [card] = p.hand.splice(idx, 1);
  card.zone = "discard";
  card.faceDown = false;
  p.discard.push(card);
  addForce(state, side, pending.countersToAdd);
  if (!state.usedEffectsThisTurn) state.usedEffectsThisTurn = [];
  state.usedEffectsThisTurn.push(pending.effectInstanceId);
  state.effectActivationPending = undefined;
  return { ok: true };
}

/** True if location matches the bonus-loc (exact or one id starts with the other, e.g. tatooinedesertlandingsite vs tatooinedesertlanding). */
function locationMatchesBonusLoc(locationCardId: string, bonusLoc: string): boolean {
  if (!locationCardId || !bonusLoc) return false;
  if (locationCardId === bonusLoc) return true;
  return locationCardId.startsWith(bonusLoc) || bonusLoc.startsWith(locationCardId);
}

/** Location bonus for a character at a given location (bonus1/2/3 if location matches bonus1loc/2loc/3loc). */
export function getLocationBonusForCharacter(characterCardId: string, locationCardId: string): number {
  const def = getCard(characterCardId);
  if (!def || (def as { type?: string }).type !== "character") return 0;
  const d = def as {
    bonus1?: number;
    bonus2?: number;
    bonus3?: number;
    bonus1loc?: string;
    bonus2loc?: string;
    bonus3loc?: string;
  };
  if (locationMatchesBonusLoc(locationCardId, d.bonus1loc ?? "") && typeof d.bonus1 === "number") return d.bonus1;
  if (locationMatchesBonusLoc(locationCardId, d.bonus2loc ?? "") && typeof d.bonus2 === "number") return d.bonus2;
  if (locationMatchesBonusLoc(locationCardId, d.bonus3loc ?? "") && typeof d.bonus3 === "number") return d.bonus3;
  return 0;
}

/**
 * Parse character's gametextbonus ("number, whatItAffects, condition[; more clauses]").
 * - "1, power, obiwanslightsaber" -> when using that weapon, add 1 to power.
 * - "1, power, sithlightsaber; 1, damage, sithlightsaber" -> +1 power and -1 mill damage when using a Sith Lightsaber.
 * - "4, power, tank" -> when opposing character's card id contains "tank", add 4 to power and label "vs Tank +4".
 */
function parseGametextBonusClauses(gametextbonus: string): { num: number; what: string; condition: string }[] {
  const out: { num: number; what: string; condition: string }[] = [];
  for (const clause of gametextbonus.split(";")) {
    const parts = clause.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const num = parseInt(parts[0], 10);
    if (isNaN(num) || num <= 0) continue;
    out.push({ num, what: parts[1].toLowerCase(), condition: parts.slice(2).join(",").toLowerCase() });
  }
  return out;
}

export function markFoughtThisTurn(state: GameStateData, ...cardIds: (string | undefined)[]): void {
  if (!state.foughtThisTurn) state.foughtThisTurn = [];
  for (const id of cardIds) {
    if (id && !state.foughtThisTurn.includes(id)) state.foughtThisTurn.push(id);
  }
}

function namedListFromCondition(condition: string, prefix: string): string[] {
  if (!condition.startsWith(prefix)) return [];
  return condition.slice(prefix.length).split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function characterMatchesNamedList(cardId: string | undefined, names: string[]): boolean {
  if (!cardId || names.length === 0) return false;
  const def = getCard(cardId);
  const persona = ((def as { persona?: string } | undefined)?.persona ?? "").toLowerCase();
  const id = cardId.toLowerCase();
  const traits = ((def as { trait?: string } | undefined)?.trait ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return names.some((n) => persona === n || id.startsWith(n) || traits.includes(n));
}

function sideHasControlledPlanet(state: GameStateData | undefined, side: Side | "", planet: string): boolean {
  if (!state || (side !== "light" && side !== "dark") || !planet) return false;
  const want = planet.toLowerCase();
  return (state.controlledPlanets ?? []).some(
    (cp) => cp.controlledBy === side && (cp.planet ?? "").toLowerCase() === want
  );
}

function foughtThisTurnMatches(state: GameStateData | undefined, condition: string): boolean {
  const names = namedListFromCondition(condition, "fought:");
  if (!state || names.length === 0) return false;
  return (state.foughtThisTurn ?? []).some((id) => characterMatchesNamedList(id, names));
}

function opponentMatchesGametextCondition(opponentCharacterCardId: string | undefined, condition: string): boolean {
  if (!opponentCharacterCardId || !condition) return false;
  if (condition === "tank") {
    if (opponentCharacterCardId.toLowerCase().includes("tank")) return true;
    const tankDef = getCard(opponentCharacterCardId);
    if (!tankDef) return false;
    const tankName = ((tankDef as { name?: string }).name ?? "").toLowerCase();
    const tankTraits = ((tankDef as { trait?: string }).trait ?? "").toLowerCase().split(",").map((s) => s.trim());
    return tankName.includes("tank") || tankTraits.includes("tank");
  }
  const oppDef = getCard(opponentCharacterCardId);
  if (!oppDef || (oppDef as { type?: string }).type !== "character") return false;
  if (condition === "amidala") {
    return ((oppDef as { persona?: string }).persona ?? "").toLowerCase() === "amidala";
  }
  if (condition === "handmaiden") {
    const traits = ((oppDef as { trait?: string }).trait ?? "").toLowerCase().split(",").map((s) => s.trim());
    return traits.includes("handmaiden");
  }
  if (condition === "jedi") {
    const traits = ((oppDef as { trait?: string }).trait ?? "").toLowerCase().split(",").map((s) => s.trim());
    return traits.includes("jedi");
  }
  return false;
}

function weaponMatchesGametextCondition(
  weaponCardId: string | undefined,
  condition: string,
  weaponSet?: string
): boolean {
  if (!weaponCardId || !condition) return false;
  const weaponId = weaponCardId.toLowerCase();
  const weaponDef = getCard(weaponCardId, weaponSet);
  const weaponName = ((weaponDef as { name?: string } | undefined)?.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (condition === "sithlightsaber") {
    return weaponId.includes("sithlightsaber") || weaponName === "sithlightsaber";
  }
  return weaponId === condition || weaponId.includes(condition);
}

export function getGametextBonusForCharacter(
  characterCardId: string,
  characterSet: string | undefined,
  weaponCardId: string | undefined,
  opponentCharacterCardId?: string,
  weaponSet?: string,
  battleCardId?: string,
  battleCardSet?: string,
  state?: GameStateData,
  inDuel?: boolean
): { bonus: number; label?: string } {
  const def = getCard(characterCardId, characterSet);
  if (!def || (def as { type?: string }).type !== "character") return { bonus: 0 };
  const gametextbonus = (def as { gametextbonus?: string }).gametextbonus;
  if (!gametextbonus || typeof gametextbonus !== "string") return { bonus: 0 };
  let bonus = 0;
  let label: string | undefined;
  for (const clause of parseGametextBonusClauses(gametextbonus)) {
    if (clause.what !== "power") continue;
    if (
      clause.condition === "yourstarfighters" ||
      clause.condition === "yourtransports" ||
      clause.condition === "opponentstarships"
    ) {
      continue;
    }
    if (clause.condition.startsWith("dueling:")) {
      if (!inDuel) continue;
      const names = namedListFromCondition(clause.condition, "dueling:");
      if (!characterMatchesNamedList(opponentCharacterCardId, names)) continue;
      bonus += clause.num;
      label = "dueling +" + clause.num;
      continue;
    }
    if (clause.condition.startsWith("fought:")) {
      if (!foughtThisTurnMatches(state, clause.condition)) continue;
      bonus += clause.num;
      label = "already fought +" + clause.num;
      continue;
    }
    if (clause.condition.startsWith("controlled:")) {
      const planet = clause.condition.slice("controlled:".length).trim();
      if (!sideHasControlledPlanet(state, getCardSide(characterCardId), planet)) continue;
      bonus += clause.num;
      label = "controlled " + planet + " +" + clause.num;
      continue;
    }
    if (opponentMatchesGametextCondition(opponentCharacterCardId, clause.condition)) {
      bonus += clause.num;
      if (clause.condition === "tank") label = "vs Tank +" + clause.num;
      else if (clause.condition === "amidala") label = "vs Amidala +" + clause.num;
      else if (clause.condition === "handmaiden") label = "vs Handmaiden +" + clause.num;
      continue;
    }
    const usingWeapon = weaponMatchesGametextCondition(weaponCardId, clause.condition, weaponSet);
    const usingBattleCard = weaponMatchesGametextCondition(battleCardId, clause.condition, battleCardSet);
    if (usingWeapon || usingBattleCard) bonus += clause.num;
  }
  return { bonus, label };
}

/** +power to each of your starfighters from face-up characters at the current planet (not stranded). */
export function getStarfighterSupportBonus(state: GameStateData, side: Side): number {
  return getShipSupportFromCharacters(state, side, "yourstarfighters", "power");
}

/** +power to each of your transports from face-up characters at the current planet (not stranded). */
export function getTransportSupportBonus(state: GameStateData, side: Side): number {
  return getShipSupportFromCharacters(state, side, "yourtransports", "power");
}

/** −damage to each of your transports from face-up characters at the current planet (not stranded). */
export function getTransportDamageReductionFromCharacters(state: GameStateData, side: Side): number {
  return getShipSupportFromCharacters(state, side, "yourtransports", "damage");
}

/** +damage to each of this side's starships from face-up opposing characters at the current planet (e.g. Bravo Pilot). */
export function getOpposingStarshipDamageBonus(state: GameStateData, shipOwnerSide: Side): number {
  const opp: Side = shipOwnerSide === "light" ? "dark" : "light";
  return getShipSupportFromCharacters(state, opp, "opponentstarships", "damage");
}

function getShipSupportFromCharacters(
  state: GameStateData,
  side: Side,
  condition: string,
  what: "power" | "damage"
): number {
  let bonus = 0;
  for (const c of getCharactersAtLocation(state, side, true)) {
    if (!isCharacterOnly(c.cardId, c.cardSet)) continue;
    const def = getCard(c.cardId, c.cardSet);
    const gametextbonus = (def as { gametextbonus?: string } | undefined)?.gametextbonus;
    if (!gametextbonus || typeof gametextbonus !== "string") continue;
    for (const clause of parseGametextBonusClauses(gametextbonus)) {
      if (clause.what === what && clause.condition === condition) bonus += clause.num;
    }
  }
  return bonus;
}

function getGametextDamageReduction(
  characterCardId: string,
  characterSet: string | undefined,
  weaponCardId: string | undefined,
  weaponSet?: string
): number {
  const def = getCard(characterCardId, characterSet);
  if (!def || (def as { type?: string }).type !== "character") return 0;
  const gametextbonus = (def as { gametextbonus?: string }).gametextbonus;
  if (!gametextbonus || typeof gametextbonus !== "string") return 0;
  let reduction = 0;
  for (const clause of parseGametextBonusClauses(gametextbonus)) {
    if (clause.what !== "damage") continue;
    if (
      clause.condition === "yourtransports" ||
      clause.condition === "opponentstarships" ||
      clause.condition === "yourstarfighters"
    ) {
      continue;
    }
    if (weaponMatchesGametextCondition(weaponCardId, clause.condition, weaponSet)) reduction += clause.num;
  }
  return reduction;
}

/** True if character has power "?" (draw destiny to determine power). */
function isCharacterPowerDestiny(cardId: string): boolean {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "character") return false;
  const p = (def as { power?: number | string }).power;
  return p === "?";
}

/** Get power of a character/weapon card (for battle). Returns 0 if power is "?" (use resolveCharacterPowerForBattle when drawing destiny). */
export function getPowerForBattle(cardId: string): number {
  const def = getCard(cardId);
  if (!def) return 0;
  const d = def as { type: string; power?: number | string };
  if (d.type === "character" || d.type === "weapon") return typeof d.power === "number" ? d.power : 0;
  return 0;
}

function getCardSide(characterCardId: string): Side | "" {
  const def = getCard(characterCardId);
  const s = (def as { side?: string } | undefined)?.side;
  return s === "light" || s === "dark" ? s : "";
}

function effectAffectsCharacter(effectDef: { affectsSide?: string }, characterCardId: string): boolean {
  const required = (effectDef.affectsSide ?? "").toLowerCase();
  if (required !== "light" && required !== "dark") return true;
  return getCardSide(characterCardId) === required;
}

/** Power bonus from effect cards at location: characters matching an effect's canUse get that effect's powerAdd in battle. */
function getEffectPowerBonusForCharacter(state: GameStateData, side: Side, characterCardId: string): number {
  let total = 0;
  const effects = getEffectsAtLocation(state, side);
  for (const eff of effects) {
    const def = getCard(eff.cardId, eff.cardSet);
    if (!def || (def as { type?: string }).type !== "effect") continue;
    if (!effectAffectsCharacter(def as { affectsSide?: string }, characterCardId)) continue;
    const powerAdd = (def as { powerAdd?: number }).powerAdd;
    if (typeof powerAdd !== "number" || powerAdd <= 0) continue;
    const canUse = (def as { canUse?: string }).canUse;
    if (!canUse || !canUse.trim()) continue;
    const segments = canUse.split(",").map((s) => s.trim()).filter(Boolean);
    const matches = segments.some((seg) => characterMatchesBattleCanUseSegment(characterCardId, seg));
    if (matches) total += powerAdd;
  }
  return total;
}

/** Resolve character base power for battle. If power is "?", draws one destiny and returns that value plus the draw for client display. Includes effect power bonus. */
function resolveCharacterPowerForBattle(
  state: GameStateData,
  side: Side,
  characterCardId: string
): { power: number; powerDestinyDraw?: { cardId: string; destiny: number } } {
  const effectBonus = getEffectPowerBonusForCharacter(state, side, characterCardId);
  if (!isCharacterPowerDestiny(characterCardId)) {
    return { power: getPowerForBattle(characterCardId) + effectBonus };
  }
  const draws = drawDestinyCards(state, side, 1);
  const power = (draws.length > 0 ? draws[0].destiny : 0) + effectBonus;
  return { power, powerDestinyDraw: draws[0] };
}

/** Combine optional power-destiny draw (shown first) with weapon/battle destiny draws for step. */
function _withPowerDestinyDraws(
  powerDraw: { cardId: string; destiny: number } | undefined,
  otherDraws: { cardId: string; destiny: number }[]
): { cardId: string; destiny: number }[] | undefined {
  const combined = powerDraw ? [powerDraw, ...otherDraws] : otherDraws;
  return combined.length > 0 ? combined : undefined;
}

/** Get damage value of a character (for milling loser's deck). */
export function getDamageValue(cardId: string, set?: string): number {
  const def = getCard(cardId, set);
  if (!def || (def as { type?: string }).type !== "character") return 0;
  const d = def as { damage?: number };
  return typeof d.damage === "number" ? d.damage : 0;
}

/** Damage reduction from effect cards at location. Effect "effects" field format: "damage-N:name1,name2,..." — when this character loses, reduce milling damage by N. */
function getEffectDamageReduction(state: GameStateData, side: Side, characterCardId: string): number {
  let total = 0;
  const effects = getEffectsAtLocation(state, side);
  for (const eff of effects) {
    const def = getCard(eff.cardId, eff.cardSet);
    if (!def || (def as { type?: string }).type !== "effect") continue;
    if (!effectAffectsCharacter(def as { affectsSide?: string }, characterCardId)) continue;
    const effectsStr = (def as { effects?: string }).effects;
    if (!effectsStr || typeof effectsStr !== "string") continue;
    const regex = /damage-(\d+):([^:\s]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(effectsStr)) !== null) {
      const n = parseInt(m[1], 10);
      if (isNaN(n) || n < 0) continue;
      const names = m[2].split(",").map((s) => s.trim()).filter(Boolean);
      if (names.some((name) => characterMatchesBattleCanUseSegment(characterCardId, name))) total += n;
    }
  }
  return total;
}

/** Damage bonus from effect cards at location. Effect "effects" format: "damage:damage+N" with canUse — when this character loses, add N to milling damage (e.g. battledroid +2). */
function getEffectDamageBonus(state: GameStateData, side: Side, characterCardId: string): number {
  let total = 0;
  const effects = getEffectsAtLocation(state, side);
  for (const eff of effects) {
    const def = getCard(eff.cardId, eff.cardSet);
    if (!def || (def as { type?: string }).type !== "effect") continue;
    if (!effectAffectsCharacter(def as { affectsSide?: string }, characterCardId)) continue;
    const canUse = (def as { canUse?: string }).canUse;
    if (!canUse || !canUse.trim()) continue;
    const segments = canUse.split(",").map((s) => s.trim()).filter(Boolean);
    const characterMatches = segments.some((seg) => characterMatchesBattleCanUseSegment(characterCardId, seg));
    if (!characterMatches) continue;
    const effectsStr = (def as { effects?: string }).effects;
    if (!effectsStr || typeof effectsStr !== "string") continue;
    const m = effectsStr.match(/damage:damage\+(\d+)/i);
    if (m) total += Math.max(0, parseInt(m[1], 10));
  }
  return total;
}

/** Effective damage for milling (character's damage minus effect reduction, plus effect damage bonus; base-reduction min 0). */
function getEffectiveDamageForMilling(
  state: GameStateData,
  side: Side,
  characterCardId: string,
  weaponCardId?: string,
  characterSet?: string,
  weaponSet?: string
): number {
  const base = getDamageValue(characterCardId, characterSet);
  const reduction =
    getEffectDamageReduction(state, side, characterCardId) +
    getGametextDamageReduction(characterCardId, characterSet, weaponCardId, weaponSet);
  const bonus = getEffectDamageBonus(state, side, characterCardId);
  return Math.max(0, base - reduction) + bonus;
}

function getBattleCardTextBonus(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  if (!def) return "";
  const d = def as { gametextbonus?: string; grayboxbonus?: string };
  return `${d.gametextbonus ?? ""};${d.grayboxbonus ?? ""}`.toLowerCase();
}

function battleCardAllowsTwoWeapons(cardId: string, set?: string): boolean {
  return getBattleCardTextBonus(cardId, set).includes("twoweapons");
}

function battleCardTwoWeaponKinds(cardId: string, set?: string): string[] {
  const text = getBattleCardTextBonus(cardId, set);
  const m = text.match(/twoweapons(?::([^;]+))?/);
  if (!m) return [];
  if (!m[1] || !m[1].trim()) return ["speeder", "nabooblaster"];
  return m[1].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function weaponMatchesTwoWeaponKind(cardId: string, set: string | undefined, kind: string): boolean {
  const id = cardId.toLowerCase();
  const name = getCardName(cardId, set).toLowerCase().replace(/[^a-z0-9]/g, "");
  const k = kind.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!k) return false;
  return id.includes(k) || name.includes(k);
}

function fighterHasTwoWeaponSupport(weapons: CardInstance[], battleCardId: string, battleSet?: string): boolean {
  const kinds = battleCardTwoWeaponKinds(battleCardId, battleSet);
  if (kinds.length === 0) return false;
  return weapons.some((w) => kinds.some((k) => weaponMatchesTwoWeaponKind(w.cardId, w.cardSet, k)));
}

function battleCardReplacesDestinyWithDamage(cardId: string, set?: string): boolean {
  return getBattleCardTextBonus(cardId, set).includes("replacedestiny:damage");
}

function battleCardExtraDamage(cardId: string, set: string | undefined, outcome: "win" | "lose"): number {
  const text = getBattleCardTextBonus(cardId, set);
  const m = text.match(/extradamage:([^;]+)/);
  if (!m) return 0;
  for (const part of m[1].split(",").map((s) => s.trim())) {
    if (outcome === "win" && part.startsWith("win")) {
      const n = parseInt(part.slice(3), 10);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    if (outcome === "lose" && part.startsWith("lose")) {
      const n = parseInt(part.slice(4), 10);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }
  }
  return 0;
}

interface DestinyDrawRef {
  key: string;
  cardId: string;
  draw: { cardId: string; destiny: number };
  applyDelta: (delta: number) => void;
}

const battleResume = new Map<string, (yourKey: string, oppKey: string) => void>();
const damageReplaceResume = new Map<string, (key: string | null) => void>();

function battleCardSwitchesDestiny(cardId: string, set?: string): boolean {
  return getBattleCardTextBonus(cardId, set).includes("switchdestiny");
}

function battleCardSkipsBreakthrough(cardId: string, set?: string): boolean {
  return getBattleCardTextBonus(cardId, set).includes("nobreakthrough:last");
}

function fighterBattleCards(f: BattleFighter): CardInstance[] {
  const cards: CardInstance[] = [];
  if (f.battleCard && f.battleCardValid) cards.push(f.battleCard);
  for (const extra of f.extraBattleCards ?? []) cards.push(extra);
  return cards;
}

/** The character with this battle card must be the last card in the plan, not merely the last character. */
function sideSkipsBreakthrough(fighters: BattleFighter[], pile: CardInstance[]): boolean {
  const last = pile[pile.length - 1];
  if (!last) return false;
  return fighters.some((f) => {
    if (!fighterBattleCards(f).some((c) => battleCardSkipsBreakthrough(c.cardId, c.cardSet))) return false;
    return [f.character, f.character2, f.character3].some((c) => c?.instanceId === last.instanceId);
  });
}

function isHumanSide(state: GameStateData, side: Side): boolean {
  const id = side === "light" ? state.lightPlayerId : state.darkPlayerId;
  return id !== "bot_1";
}

export function confirmDestinySwap(state: GameStateData, side: Side, yourKey: string, oppKey: string): boolean {
  const pending = state.destinySwapPending;
  if (!pending || pending.side !== side) return false;
  const yours = pending.yours.find((d) => d.key === yourKey);
  const opp = pending.opps.find((d) => d.key === oppKey);
  if (!yours || !opp || yours.destiny >= opp.destiny) return false;
  const resume = battleResume.get(state.id);
  if (!resume) return false;
  resume(yourKey, oppKey);
  return true;
}

export function confirmDamageReplace(state: GameStateData, side: Side, key?: string): boolean {
  const pending = state.damageReplacePending;
  if (!pending || pending.side !== side || !pending.draw) return false;
  if (key && key !== pending.draw.key) return false;
  const resume = damageReplaceResume.get(state.id);
  if (!resume) return false;
  resume(pending.draw.key);
  return true;
}

export function declineDamageReplace(state: GameStateData, side: Side): boolean {
  const pending = state.damageReplacePending;
  if (!pending || pending.side !== side) return false;
  const resume = damageReplaceResume.get(state.id);
  if (!resume) return false;
  resume(null);
  return true;
}

function applyDamageDestinyReplace(
  characterCardId: string,
  parts: { bonus: number; destinyDraws: { cardId: string; destiny: number }[] }[]
): void {
  const dmg = getDamageValue(characterCardId);
  const draws = parts.flatMap((p) => p.destinyDraws);
  if (draws.length === 0) return;
  let idx = 0;
  for (let i = 1; i < draws.length; i++) {
    if (draws[i].destiny < draws[idx].destiny) idx = i;
  }
  if (dmg <= draws[idx].destiny) return;
  const delta = dmg - draws[idx].destiny;
  draws[idx].destiny = dmg;
  let remaining = idx;
  for (const p of parts) {
    if (remaining < p.destinyDraws.length) {
      p.bonus += delta;
      return;
    }
    remaining -= p.destinyDraws.length;
  }
}

function millDamageForFighter(
  state: GameStateData,
  side: Side,
  character: { cardId: string; cardSet?: string } | undefined,
  weapon: { cardId: string; cardSet?: string } | undefined
): number {
  if (!character) return 0;
  return getEffectiveDamageForMilling(
    state,
    side,
    character.cardId,
    weapon?.cardId,
    character.cardSet,
    weapon?.cardSet
  );
}

/** Cards drawn for a duel are set aside and shuffled back when the duel ends. */
function duelCardsReturningToDeck(state: GameStateData, side: Side): number {
  const d = state.duelState;
  if (!d) return 0;
  if (side === "light") return d.lightDuelHand.length + d.lightPlayed.length;
  return d.darkDuelHand.length + d.darkPlayed.length;
}

/** If either deck is empty, that side loses; return the winning side.
 * Cards sitting in a dueling hand still belong to the deck, so they do not count as a loss. */
export function getDeckEmptyWinner(state: GameStateData): Side | undefined {
  if (state.light.deck.length + duelCardsReturningToDeck(state, "light") === 0) return "dark";
  if (state.dark.deck.length + duelCardsReturningToDeck(state, "dark") === 0) return "light";
  return undefined;
}

/** Discard N cards from the top of a side's deck (to discard pile). Returns milled cardIds. */
export function millFromDeck(state: GameStateData, side: Side, count: number): string[] {
  const p = side === "light" ? state.light : state.dark;
  const n = Math.min(count, p.deck.length);
  const milledIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = p.deck.pop()!;
    c.zone = "discard";
    c.faceDown = false;
    p.discard.push(c);
    milledIds.push(c.cardId);
  }
  return milledIds;
}

interface BattleFighter {
  character: CardInstance;
  weapon?: CardInstance;
  weaponValid?: boolean;
  extraWeapon?: CardInstance;
  extraWeaponValid?: boolean;
  battleCard?: CardInstance;
  battleCardValid?: boolean;
  /** Other battle cards played on this same character, already checked against canUse. */
  extraBattleCards?: CardInstance[];
  character2?: CardInstance;
  weapon2?: CardInstance;
  weapon2Valid?: boolean;
  character3?: CardInstance;
  weapon3?: CardInstance;
  weapon3Valid?: boolean;
}

function pushFighterWeapons(into: CardInstance[], f: BattleFighter): void {
  if (f.weapon) into.push(f.weapon);
  if (f.extraWeapon) into.push(f.extraWeapon);
  if (f.weapon2) into.push(f.weapon2);
  if (f.weapon3) into.push(f.weapon3);
}

function forEachMainWeapon(f: BattleFighter, fn: (w: CardInstance) => void): void {
  if (f.weapon) fn(f.weapon);
  if (f.extraWeapon) fn(f.extraWeapon);
}

/**
 * Process a battle plan pile into fighters.
 * Order left-to-right: [battle card] [weapon] character.
 * Normally one weapon per fight, immediately after the Battle card.
 * Battle cards with twoweapons may take two usable weapons between the battle card and character.
 * Weapons before other characters (in fight-together) stay on the fighter but do not add to that character's power.
 * Battle cards and weapons at the end with no character after them are unused.
 */
function buildFighters(pile: CardInstance[]): { fighters: BattleFighter[]; unusedWeapons: CardInstance[]; unusedBattleCards: CardInstance[] } {
  const fighters: BattleFighter[] = [];
  const unusedWeapons: CardInstance[] = [];
  const unusedBattleCards: CardInstance[] = [];
  let i = 0;
  while (i < pile.length) {
    const ct = getCardType(pile[i].cardId, pile[i].cardSet);
    if (ct === "battle") {
      const conditionStr = getBattleCardConditionString(pile[i].cardId);
      const condLower = conditionStr.toLowerCase();
      const isFightTogether = condLower.includes("fighttogether");
      const isBothFightTogether = condLower.startsWith("both:");
      const isSamePersonaFightTogether = condLower.startsWith("samepersona:");
      const nMatch = condLower.match(/^(\d+):fighttogether/);
      const fightTogetherN = nMatch ? parseInt(nMatch[1], 10) : (isBothFightTogether || isSamePersonaFightTogether ? 2 : 0);

      if (isFightTogether) {
        const afterBattle = pile.slice(i + 1);
        const charRelIndices: number[] = [];
        const targetCount = fightTogetherN >= 3 ? 3 : 2;
        for (let j = 0; j < afterBattle.length && charRelIndices.length < targetCount; j++) {
          if (getCardType(afterBattle[j].cardId, afterBattle[j].cardSet) === "character") {
            charRelIndices.push(j);
          }
        }
        const hasEnoughChars = (fightTogetherN === 3 && charRelIndices.length === 3) ||
          ((fightTogetherN === 2 || isBothFightTogether || isSamePersonaFightTogether) && charRelIndices.length === 2);
        if (hasEnoughChars) {
          const char1Idx = i + 1 + charRelIndices[0];
          const char2Idx = i + 1 + charRelIndices[1];
          const char1Card = pile[char1Idx];
          const char2Card = pile[char2Idx];
          let bValid = false;
          if (fightTogetherN === 3) {
            const char3Idx = i + 1 + charRelIndices[2];
            const char3Card = pile[char3Idx];
            bValid = canBattleCardBeUsedBy(pile[i].cardId, char1Card.cardId) &&
              canBattleCardBeUsedBy(pile[i].cardId, char2Card.cardId) &&
              canBattleCardBeUsedBy(pile[i].cardId, char3Card.cardId);
            if (bValid) {
              // Only one weapon per fight: must immediately follow Battle card; only first character gets its power.
              let weapon1: CardInstance | undefined;
              let weapon1Valid: boolean | undefined;
              if (i + 1 < pile.length && getCardType(pile[i + 1].cardId, pile[i + 1].cardSet) === "weapon") {
                weapon1 = pile[i + 1];
                weapon1Valid = canWeaponBeUsedBy(weapon1.cardId, char1Card.cardId, weapon1.cardSet);
              }
              for (let j = i + 1; j < char1Idx; j++) {
                const jt = getCardType(pile[j].cardId, pile[j].cardSet);
                if (jt === "weapon" && pile[j].instanceId !== weapon1?.instanceId) unusedWeapons.push(pile[j]);
                else if (jt === "battle") unusedBattleCards.push(pile[j]);
              }
              // Weapons before char2/char3 stay on fighter but do not add power (weapon2Valid/weapon3Valid = false).
              let weapon2: CardInstance | undefined;
              for (let j = char1Idx + 1; j < char2Idx; j++) {
                const jt = getCardType(pile[j].cardId, pile[j].cardSet);
                if (jt === "weapon" && !weapon2) weapon2 = pile[j];
                else if (jt === "weapon") unusedWeapons.push(pile[j]);
                else if (jt === "battle") unusedBattleCards.push(pile[j]);
              }
              let weapon3: CardInstance | undefined;
              for (let j = char2Idx + 1; j < char3Idx; j++) {
                const jt = getCardType(pile[j].cardId, pile[j].cardSet);
                if (jt === "weapon" && !weapon3) weapon3 = pile[j];
                else if (jt === "weapon") unusedWeapons.push(pile[j]);
                else if (jt === "battle") unusedBattleCards.push(pile[j]);
              }
              fighters.push({
                character: char1Card, weapon: weapon1, weaponValid: weapon1Valid,
                battleCard: pile[i], battleCardValid: true,
                character2: char2Card, weapon2, weapon2Valid: false,
                character3: char3Card, weapon3, weapon3Valid: false,
              });
              i = char3Idx + 1;
              continue;
            }
          } else {
            if (isSamePersonaFightTogether) {
              bValid = twoCharactersSamePersona(char1Card.cardId, char2Card.cardId);
            } else {
              bValid = isBothFightTogether
                ? twoCharactersCoverBattleCanUse(pile[i].cardId, char1Card.cardId, char2Card.cardId)
                : (canBattleCardBeUsedBy(pile[i].cardId, char1Card.cardId) && canBattleCardBeUsedBy(pile[i].cardId, char2Card.cardId));
            }
            if (bValid && condLower.includes("diffnosebulba")) {
              bValid = twoCharactersDifferentNamesNoSebulba(char1Card.cardId, char2Card.cardId);
            }
            if (bValid) {
              // Only one weapon per fight: must immediately follow Battle card; only first character gets its power.
              let weapon1: CardInstance | undefined;
              let weapon1Valid: boolean | undefined;
              if (i + 1 < pile.length && getCardType(pile[i + 1].cardId, pile[i + 1].cardSet) === "weapon") {
                weapon1 = pile[i + 1];
                weapon1Valid = canWeaponBeUsedBy(weapon1.cardId, char1Card.cardId, weapon1.cardSet);
              }
              for (let j = i + 1; j < char1Idx; j++) {
                const jt = getCardType(pile[j].cardId, pile[j].cardSet);
                if (jt === "weapon" && pile[j].instanceId !== weapon1?.instanceId) unusedWeapons.push(pile[j]);
                else if (jt === "battle") unusedBattleCards.push(pile[j]);
              }
              // Weapon before char2 stays on fighter but does not add power (weapon2Valid = false).
              let weapon2: CardInstance | undefined;
              for (let j = char1Idx + 1; j < char2Idx; j++) {
                const jt = getCardType(pile[j].cardId, pile[j].cardSet);
                if (jt === "weapon" && !weapon2) weapon2 = pile[j];
                else if (jt === "weapon") unusedWeapons.push(pile[j]);
                else if (jt === "battle") unusedBattleCards.push(pile[j]);
              }
              fighters.push({
                character: char1Card, weapon: weapon1, weaponValid: weapon1Valid,
                battleCard: pile[i], battleCardValid: true,
                character2: char2Card, weapon2, weapon2Valid: false,
              });
              i = char2Idx + 1;
              continue;
            }
          }
        }
      }

      if (isBothFightTogether) {
        unusedBattleCards.push(pile[i]);
        i++;
        continue;
      }

      const remaining = pile.slice(i + 1);
      const nextCharIdx = remaining.findIndex((c) => getCardType(c.cardId, c.cardSet) === "character");
      if (nextCharIdx < 0) {
        unusedBattleCards.push(pile[i]);
        i++;
        continue;
      }
      const actualCharIdx = i + 1 + nextCharIdx;
      const charCard = pile[actualCharIdx];
      const bValid = canBattleCardBeUsedBy(pile[i].cardId, charCard.cardId);
      const weaponsBetween: CardInstance[] = [];
      const extraBattleCards: CardInstance[] = [];
      for (let j = i + 1; j < actualCharIdx; j++) {
        const jt = getCardType(pile[j].cardId, pile[j].cardSet);
        if (jt === "weapon") weaponsBetween.push(pile[j]);
        else if (jt === "battle") {
          if (canBattleCardBeUsedBy(pile[j].cardId, charCard.cardId)) extraBattleCards.push(pile[j]);
          else unusedBattleCards.push(pile[j]);
        }
      }
      const primaryAllowsTwo = bValid && battleCardAllowsTwoWeapons(pile[i].cardId, pile[i].cardSet);
      const extraAllowsTwo = extraBattleCards.some((b) => battleCardAllowsTwoWeapons(b.cardId, b.cardSet));
      const allowsTwo = primaryAllowsTwo || extraAllowsTwo;
      const usableWeapons = weaponsBetween.filter((w) => canWeaponBeUsedBy(w.cardId, charCard.cardId, w.cardSet));
      const twoWeaponCard = primaryAllowsTwo
        ? pile[i]
        : extraBattleCards.find((b) => battleCardAllowsTwoWeapons(b.cardId, b.cardSet));
      const hasSupportWeapon = twoWeaponCard
        ? fighterHasTwoWeaponSupport(usableWeapons, twoWeaponCard.cardId, twoWeaponCard.cardSet)
        : false;
      const twoWeaponKit = allowsTwo && hasSupportWeapon;
      const keptExtraBattleCards = extraBattleCards.filter(
        (b) => !battleCardAllowsTwoWeapons(b.cardId, b.cardSet) || twoWeaponKit
      );
      for (const dropped of extraBattleCards) {
        if (!keptExtraBattleCards.includes(dropped)) unusedBattleCards.push(dropped);
      }
      let weapon: CardInstance | undefined;
      let weaponValid: boolean | undefined;
      let extraWeapon: CardInstance | undefined;
      let extraWeaponValid: boolean | undefined;
      if (twoWeaponKit && usableWeapons.length > 0) {
        weapon = usableWeapons[0];
        weaponValid = true;
        if (usableWeapons[1]) {
          extraWeapon = usableWeapons[1];
          extraWeaponValid = true;
        }
        for (const w of weaponsBetween) {
          if (w.instanceId !== weapon?.instanceId && w.instanceId !== extraWeapon?.instanceId) unusedWeapons.push(w);
        }
      } else {
        if (actualCharIdx === i + 2 && getCardType(pile[i + 1].cardId, pile[i + 1].cardSet) === "weapon") {
          weapon = pile[i + 1];
          weaponValid = canWeaponBeUsedBy(weapon.cardId, charCard.cardId, weapon.cardSet);
        }
        for (const w of weaponsBetween) {
          if (w.instanceId !== weapon?.instanceId) unusedWeapons.push(w);
        }
      }
      fighters.push({
        character: charCard,
        weapon,
        weaponValid,
        extraWeapon,
        extraWeaponValid,
        battleCard: pile[i],
        battleCardValid: primaryAllowsTwo ? twoWeaponKit : bValid,
        extraBattleCards: keptExtraBattleCards,
      });
      i = actualCharIdx + 1;
    } else if (ct === "weapon") {
      if (i + 1 < pile.length && getCardType(pile[i + 1].cardId, pile[i + 1].cardSet) === "character") {
        const valid = canWeaponBeUsedBy(pile[i].cardId, pile[i + 1].cardId, pile[i].cardSet);
        fighters.push({ character: pile[i + 1], weapon: pile[i], weaponValid: valid });
        i += 2;
      } else {
        unusedWeapons.push(pile[i]);
        i++;
      }
    } else if (ct === "character") {
      fighters.push({ character: pile[i] });
      i++;
    } else {
      i++;
    }
  }
  return { fighters, unusedWeapons, unusedBattleCards };
}

function locationEffectTexts(state: GameStateData): { text: string; powerAdd: number }[] {
  const out: { text: string; powerAdd: number }[] = [];
  for (const side of ["light", "dark"] as Side[]) {
    for (const eff of getEffectsAtLocation(state, side)) {
      const def = getCard(eff.cardId, eff.cardSet) as { effects?: string; powerAdd?: number } | undefined;
      if (!def) continue;
      out.push({
        text: (def.effects ?? "").toLowerCase(),
        powerAdd: typeof def.powerAdd === "number" ? def.powerAdd : 0,
      });
    }
  }
  return out;
}

/** Gungan Energy Shield: tanks at this location get no weapon power. */
function effectDeniesCharacterWeapons(state: GameStateData, characterCardId: string): boolean {
  if (!opponentMatchesGametextCondition(characterCardId, "tank")) return false;
  return locationEffectTexts(state).some((e) => e.text.includes("noweapon:tank"));
}

/** Gungan Energy Shield: +powerAdd for a character whose weapon is a fambaa. */
function fambaaShieldPower(state: GameStateData, weaponCardId: string, weaponSet?: string): number {
  const id = weaponCardId.toLowerCase();
  const name = getCardName(weaponCardId, weaponSet).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!id.includes("fambaa") && !name.includes("fambaa")) return 0;
  let total = 0;
  for (const e of locationEffectTexts(state)) {
    if (e.text.includes("power:using:fambaa")) total += e.powerAdd;
  }
  return total;
}

/** Resolve weapon bonus for a specific weapon + character pair. */
function resolveWeaponBonusForPair(
  state: GameStateData,
  side: Side,
  weapon: CardInstance | undefined,
  weaponValid: boolean | undefined,
  characterCardId: string,
  opponentCharacterCardId?: string
): { bonus: number; destinyDraws: { cardId: string; destiny: number }[] } {
  if (!weapon || !weaponValid) return { bonus: 0, destinyDraws: [] };
  const powerAdd = getWeaponPowerAddRawForCharacter(
    weapon.cardId,
    characterCardId,
    weapon.cardSet,
    opponentCharacterCardId
  );
  const destinyCount = getWeaponDestinyAddForCharacter(
    weapon.cardId,
    characterCardId,
    weapon.cardSet,
    opponentCharacterCardId
  );
  const destinyDraws: { cardId: string; destiny: number }[] = [];
  let totalBonus = 0;
  if (powerAdd === "?") {
    const powerDraws = drawDestinyCards(state, side, 1);
    destinyDraws.push(...powerDraws);
    totalBonus += powerDraws[0]?.destiny ?? 0;
  } else {
    totalBonus += powerAdd;
  }
  if (destinyCount > 0) {
    const extra = drawDestinyCards(state, side, destinyCount);
    destinyDraws.push(...extra);
    for (const d of extra) totalBonus += d.destiny;
  }
  totalBonus += fambaaShieldPower(state, weapon.cardId, weapon.cardSet);
  return { bonus: totalBonus, destinyDraws };
}

function resolveWeaponBonus(
  state: GameStateData,
  side: Side,
  fighter: BattleFighter,
  opponentCharacterCardId?: string
): { bonus: number; destinyDraws: { cardId: string; destiny: number }[] } {
  const primary = resolveWeaponBonusForPair(
    state,
    side,
    fighter.weapon,
    fighter.weaponValid,
    fighter.character.cardId,
    opponentCharacterCardId
  );
  const extra = resolveWeaponBonusForPair(
    state,
    side,
    fighter.extraWeapon,
    fighter.extraWeaponValid,
    fighter.character.cardId,
    opponentCharacterCardId
  );
  return { bonus: primary.bonus + extra.bonus, destinyDraws: [...primary.destinyDraws, ...extra.destinyDraws] };
}

/**
 * Calculate battle card bonus for a fighter.
 * canUse must match (battleCardValid), OR condition "at:locationId" allows any character when at that location.
 * Then condition is checked:
 * - "against:trait" → opponent must have that trait.
 * - "first:" → this fighter's main character must be the first character in the battle plan (index 0 in pile character order).
 * - "on:planet" → current location must be on that planet (e.g. tatooine).
 * - "at:locationId" → current location must match (e.g. desertlandingsite); when at location, any character can use.
 * - "N:fighttogether" → fighter must have character2 (structural check done in buildFighters).
 * - empty → always applies.
 * When destinyAdd >= 1, draws that many destiny cards and adds their destiny values to power.
 */
function resolveBattleCardBonus(
  state: GameStateData,
  side: Side,
  fighter: BattleFighter,
  opponentCharacterCardId: string,
  fighterIndex: number,
  locationCardId: string,
  weaponsCancelled = false
): { bonus: number; destinyDraws: { cardId: string; destiny: number }[] } {
  const empty = { bonus: 0, destinyDraws: [] as { cardId: string; destiny: number }[] };
  if (!fighter.battleCard) return empty;
  const conditionStr = getBattleCardConditionString(fighter.battleCard.cardId);
  const isAtCondition = conditionStr.toLowerCase().startsWith("at:");
  const atValue = isAtCondition ? (conditionStr.split(":")[1] ?? "").trim().toLowerCase() : "";
  const atLocationMatch = isAtCondition && atValue && (locationCardId.toLowerCase().includes(atValue) || locationCardId.toLowerCase().endsWith(atValue));
  const validByCanUse = !!fighter.battleCardValid;
  const validByLocation = isAtCondition && atLocationMatch;
  if (!validByCanUse && !validByLocation) return empty;
  const weaponForCondition = weaponsCancelled ? undefined : fighter.weapon?.cardId;
  let powerAdd = 0;
  if (conditionStr.toLowerCase().includes("fighttogether")) {
    const nMatch = conditionStr.toLowerCase().match(/^(\d+):fighttogether/);
    const n = nMatch ? parseInt(nMatch[1], 10) : 2;
    if (n >= 3 && !fighter.character3) return empty;
    if (!fighter.character2) return empty;
    powerAdd = getBattleCardPowerAdd(fighter.battleCard.cardId);
  } else if (isAtCondition && (validByCanUse || validByLocation)) {
    powerAdd = getBattleCardPowerAdd(fighter.battleCard.cardId);
  } else if (!battleCardConditionMet(fighter.battleCard.cardId, fighter.character.cardId, opponentCharacterCardId, fighterIndex, locationCardId, weaponForCondition)) {
    return empty;
  } else {
    powerAdd = getBattleCardPowerAdd(fighter.battleCard.cardId);
  }
  const destinyCount = getBattleCardDestinyAdd(fighter.battleCard.cardId);
  const destinyDraws = destinyCount > 0 ? drawDestinyCards(state, side, destinyCount) : [];
  let totalBonus = powerAdd;
  for (const d of destinyDraws) totalBonus += d.destiny;
  if (fighter.battleCard && getBattleCardTextBonus(fighter.battleCard.cardId, fighter.battleCard.cardSet).includes("destinydiff")) {
    const mine = getDestinyValue(fighter.character.cardId, fighter.character.cardSet);
    const theirs = getDestinyValue(opponentCharacterCardId);
    if (mine < theirs) totalBonus += theirs - mine;
  }
  return { bonus: totalBonus, destinyDraws };
}

function resolveFighterBattleBonuses(
  state: GameStateData,
  side: Side,
  fighter: BattleFighter,
  opponentCharacterCardId: string,
  fighterIndex: number,
  locationCardId: string,
  weaponsCancelled = false
): { bonus: number; destinyDraws: { cardId: string; destiny: number }[] } {
  const cards: { card: CardInstance; valid: boolean }[] = [];
  if (fighter.battleCard) cards.push({ card: fighter.battleCard, valid: !!fighter.battleCardValid });
  for (const extra of fighter.extraBattleCards ?? []) cards.push({ card: extra, valid: true });
  let bonus = 0;
  const destinyDraws: { cardId: string; destiny: number }[] = [];
  for (const entry of cards) {
    const part = resolveBattleCardBonus(
      state,
      side,
      { ...fighter, battleCard: entry.card, battleCardValid: entry.valid, extraBattleCards: undefined },
      opponentCharacterCardId,
      fighterIndex,
      locationCardId,
      weaponsCancelled
    );
    bonus += part.bonus;
    destinyDraws.push(...part.destinyDraws);
  }
  return { bonus, destinyDraws };
}

/**
 * Resolve battle: both sides have submitted order (left-to-right = first to battle on left).
 * Weapons placed before a character pair with that character for the fight.
 * Build fighters, pair them, resolve each fight with power + location + weapon bonuses.
 * Winner stays; loser + their weapon go to discard and mill damage from that deck.
 * Attacker's unopposed fighters each mill 1 card from defender's deck.
 */
export function resolveBattlePlan(state: GameStateData): void {
  const loc = getCurrentLocationCard(state);
  const locationCardId = loc?.card.cardId ?? "";
  const lightOrder = state.lightBattlePlanOrder ?? [];
  const darkOrder = state.darkBattlePlanOrder ?? [];
  if (lightOrder.length === 0 && darkOrder.length === 0) {
    state.battlePlanPhase = false;
    state.lightBattlePlanOrder = undefined;
    state.darkBattlePlanOrder = undefined;
    state.lightBattlePlanReady = false;
    state.darkBattlePlanReady = false;
    state.battleCardDeclareSide = undefined;
    state.lightDeclaredBattleCards = undefined;
    state.darkDeclaredBattleCards = undefined;
    return;
  }

  const lightSurvivors: CardInstance[] = [];
  const darkSurvivors: CardInstance[] = [];

  const removeFromInPlay = (side: Side, instanceId: string): CardInstance | undefined => {
    const p = side === "light" ? state.light : state.dark;
    const idx = p.inPlay.findIndex((c) => c.instanceId === instanceId);
    if (idx < 0) return undefined;
    const [card] = p.inPlay.splice(idx, 1);
    return card;
  };
  const toDiscard = (side: Side, card: CardInstance): void => {
    const p = side === "light" ? state.light : state.dark;
    if (p.discard.some((c) => c.instanceId === card.instanceId)) return;
    card.zone = "discard";
    card.faceDown = false;
    p.discard.push(card);
  };

  const toHand = (side: Side, card: CardInstance): void => {
    const p = side === "light" ? state.light : state.dark;
    card.zone = "hand";
    p.hand.push(card);
  };

  const removeFromHand = (side: Side, instanceId: string): CardInstance | undefined => {
    const p = side === "light" ? state.light : state.dark;
    const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
    if (idx < 0) return undefined;
    const [card] = p.hand.splice(idx, 1);
    return card;
  };

  const lightPile: CardInstance[] = [];
  const darkPile: CardInstance[] = [];
  for (const id of lightOrder) {
    let c = removeFromInPlay("light", id);
    if (!c) c = removeFromHand("light", id);
    if (c) lightPile.push(c);
  }
  for (const id of darkOrder) {
    let c = removeFromInPlay("dark", id);
    if (!c) c = removeFromHand("dark", id);
    if (c) darkPile.push(c);
  }

  const { fighters: lightFighters, unusedWeapons: lightUnused, unusedBattleCards: lightUnusedBattle } = buildFighters(lightPile);
  const { fighters: darkFighters, unusedWeapons: darkUnused, unusedBattleCards: darkUnusedBattle } = buildFighters(darkPile);

  /** Index of each character (by instanceId) in pile order – "first character" = index 0. */
  const lightCharOrderMap = new Map<string, number>();
  const darkCharOrderMap = new Map<string, number>();
  let lCharIdx = 0;
  let dCharIdx = 0;
  for (const c of lightPile) {
    if (getCardType(c.cardId, c.cardSet) === "character") lightCharOrderMap.set(c.instanceId, lCharIdx++);
  }
  for (const c of darkPile) {
    if (getCardType(c.cardId, c.cardSet) === "character") darkCharOrderMap.set(c.instanceId, dCharIdx++);
  }

  for (const w of lightUnused) lightSurvivors.push(w);
  for (const w of darkUnused) darkSurvivors.push(w);
  for (const b of lightUnusedBattle) toDiscard("light", b);
  for (const b of darkUnusedBattle) toDiscard("dark", b);

  type RevealStep = NonNullable<GameStateData["battleRevealSequence"]>[number];
  const revealSequence: RevealStep[] = [];

  let li = 0;
  let di = 0;
  const runPairs = (): void => {
  while (li < lightFighters.length && di < darkFighters.length) {
    const lf = lightFighters[li++];
    const df = darkFighters[di++];

    const lightResolved = resolveCharacterPowerForBattle(state, "light", lf.character.cardId);
    let lightBasePower = lightResolved.power;
    const lightBonus = getLocationBonusForCharacter(lf.character.cardId, locationCardId);
    const darkResolved = resolveCharacterPowerForBattle(state, "dark", df.character.cardId);
    let darkBasePower = darkResolved.power;
    const darkBonus = getLocationBonusForCharacter(df.character.cardId, locationCardId);

    const lightFirstCharIndex = lightCharOrderMap.get(lf.character.instanceId) ?? li - 1;
    const darkFirstCharIndex = darkCharOrderMap.get(df.character.instanceId) ?? di - 1;
    const lightNoWeapon = lf.battleCard ? battleCardConditionNoWeapon(lf.battleCard.cardId) : false;
    const darkNoWeapon = df.battleCard ? battleCardConditionNoWeapon(df.battleCard.cardId) : false;
    const lightOppNoWeapon = !!(lf.battleCard && battleCardConditionOppNoWeapon(lf.battleCard.cardId) && !lf.weapon);
    const darkOppNoWeapon = !!(df.battleCard && battleCardConditionOppNoWeapon(df.battleCard.cardId) && !df.weapon);
    const lightWeaponsCancelled = lightNoWeapon || darkOppNoWeapon;
    const darkWeaponsCancelled = darkNoWeapon || lightOppNoWeapon;
    const lightMainOff = lightWeaponsCancelled || effectDeniesCharacterWeapons(state, lf.character.cardId);
    const darkMainOff = darkWeaponsCancelled || effectDeniesCharacterWeapons(state, df.character.cardId);
    const lb = resolveFighterBattleBonuses(state, "light", lf, df.character.cardId, lightFirstCharIndex, locationCardId, lightMainOff);
    const db = resolveFighterBattleBonuses(state, "dark", df, lf.character.cardId, darkFirstCharIndex, locationCardId, darkMainOff);
    const emptyWeaponResult = { bonus: 0, destinyDraws: [] as { cardId: string; destiny: number }[] };
    const lw = lightMainOff ? emptyWeaponResult : resolveWeaponBonus(state, "light", lf, df.character.cardId);
    const dw = darkMainOff ? emptyWeaponResult : resolveWeaponBonus(state, "dark", df, lf.character.cardId);

    let lightBasePower2 = 0, lightBonus2 = 0, darkBasePower2 = 0, darkBonus2 = 0;
    let lightBasePower3 = 0, lightBonus3 = 0, darkBasePower3 = 0, darkBonus3 = 0;
    let lightPowerDraw2: { cardId: string; destiny: number } | undefined;
    let darkPowerDraw2: { cardId: string; destiny: number } | undefined;
    let lightPowerDraw3: { cardId: string; destiny: number } | undefined;
    let darkPowerDraw3: { cardId: string; destiny: number } | undefined;
    let lw2 = { bonus: 0, destinyDraws: [] as { cardId: string; destiny: number }[] };
    let dw2 = { bonus: 0, destinyDraws: [] as { cardId: string; destiny: number }[] };
    let lw3 = { bonus: 0, destinyDraws: [] as { cardId: string; destiny: number }[] };
    let dw3 = { bonus: 0, destinyDraws: [] as { cardId: string; destiny: number }[] };
    if (lf.character2) {
      const r2 = resolveCharacterPowerForBattle(state, "light", lf.character2.cardId);
      lightBasePower2 = r2.power;
      lightPowerDraw2 = r2.powerDestinyDraw;
      lightBonus2 = getLocationBonusForCharacter(lf.character2.cardId, locationCardId);
      lw2 = (lightWeaponsCancelled || effectDeniesCharacterWeapons(state, lf.character2.cardId)) ? emptyWeaponResult : resolveWeaponBonusForPair(state, "light", lf.weapon2, lf.weapon2Valid, lf.character2.cardId, df.character2?.cardId ?? df.character.cardId);
    }
    if (df.character2) {
      const r2 = resolveCharacterPowerForBattle(state, "dark", df.character2.cardId);
      darkBasePower2 = r2.power;
      darkPowerDraw2 = r2.powerDestinyDraw;
      darkBonus2 = getLocationBonusForCharacter(df.character2.cardId, locationCardId);
      dw2 = (darkWeaponsCancelled || effectDeniesCharacterWeapons(state, df.character2.cardId)) ? emptyWeaponResult : resolveWeaponBonusForPair(state, "dark", df.weapon2, df.weapon2Valid, df.character2.cardId, lf.character2?.cardId ?? lf.character.cardId);
    }
    if (lf.character3) {
      const r3 = resolveCharacterPowerForBattle(state, "light", lf.character3.cardId);
      lightBasePower3 = r3.power;
      lightPowerDraw3 = r3.powerDestinyDraw;
      lightBonus3 = getLocationBonusForCharacter(lf.character3.cardId, locationCardId);
      lw3 = (lightWeaponsCancelled || effectDeniesCharacterWeapons(state, lf.character3.cardId)) ? emptyWeaponResult : resolveWeaponBonusForPair(state, "light", lf.weapon3, lf.weapon3Valid, lf.character3.cardId, df.character3?.cardId ?? df.character.cardId);
    }
    if (df.character3) {
      const r3 = resolveCharacterPowerForBattle(state, "dark", df.character3.cardId);
      darkBasePower3 = r3.power;
      darkPowerDraw3 = r3.powerDestinyDraw;
      darkBonus3 = getLocationBonusForCharacter(df.character3.cardId, locationCardId);
      dw3 = (darkWeaponsCancelled || effectDeniesCharacterWeapons(state, df.character3.cardId)) ? emptyWeaponResult : resolveWeaponBonusForPair(state, "dark", df.weapon3, df.weapon3Valid, df.character3.cardId, lf.character3?.cardId ?? lf.character.cardId);
    }

    const lightHasReplace = fighterBattleCards(lf).some((c) => battleCardReplacesDestinyWithDamage(c.cardId, c.cardSet));
    const darkHasReplace = fighterBattleCards(df).some((c) => battleCardReplacesDestinyWithDamage(c.cardId, c.cardSet));

    const light2Off = lightWeaponsCancelled || !!(lf.character2 && effectDeniesCharacterWeapons(state, lf.character2.cardId));
    const light3Off = lightWeaponsCancelled || !!(lf.character3 && effectDeniesCharacterWeapons(state, lf.character3.cardId));
    const lgb1 = getGametextBonusForCharacter(lf.character.cardId, lf.character.cardSet, lightMainOff ? undefined : lf.weapon?.cardId, df.character.cardId, lightMainOff ? undefined : lf.weapon?.cardSet, lf.battleCard?.cardId, lf.battleCard?.cardSet, state);
    const lgb2 = lf.character2 ? getGametextBonusForCharacter(lf.character2.cardId, lf.character2.cardSet, light2Off ? undefined : lf.weapon2?.cardId, df.character2?.cardId ?? df.character.cardId, light2Off ? undefined : lf.weapon2?.cardSet, lf.battleCard?.cardId, lf.battleCard?.cardSet, state) : { bonus: 0 };
    const lgb3 = lf.character3 ? getGametextBonusForCharacter(lf.character3.cardId, lf.character3.cardSet, light3Off ? undefined : lf.weapon3?.cardId, df.character3?.cardId ?? df.character.cardId, light3Off ? undefined : lf.weapon3?.cardSet, lf.battleCard?.cardId, lf.battleCard?.cardSet, state) : { bonus: 0 };
    const lightGametextBonus = lgb1.bonus + lgb2.bonus + lgb3.bonus;
    const lightGametextBonusLabel = lgb1.label ?? lgb2.label ?? lgb3.label;
    const dark2Off = darkWeaponsCancelled || !!(df.character2 && effectDeniesCharacterWeapons(state, df.character2.cardId));
    const dark3Off = darkWeaponsCancelled || !!(df.character3 && effectDeniesCharacterWeapons(state, df.character3.cardId));
    const dgb1 = getGametextBonusForCharacter(df.character.cardId, df.character.cardSet, darkMainOff ? undefined : df.weapon?.cardId, lf.character.cardId, darkMainOff ? undefined : df.weapon?.cardSet, df.battleCard?.cardId, df.battleCard?.cardSet, state);
    const dgb2 = df.character2 ? getGametextBonusForCharacter(df.character2.cardId, df.character2.cardSet, dark2Off ? undefined : df.weapon2?.cardId, lf.character2?.cardId ?? lf.character.cardId, dark2Off ? undefined : df.weapon2?.cardSet, df.battleCard?.cardId, df.battleCard?.cardSet, state) : { bonus: 0 };
    const dgb3 = df.character3 ? getGametextBonusForCharacter(df.character3.cardId, df.character3.cardSet, dark3Off ? undefined : df.weapon3?.cardId, lf.character3?.cardId ?? lf.character.cardId, dark3Off ? undefined : df.weapon3?.cardSet, df.battleCard?.cardId, df.battleCard?.cardSet, state) : { bonus: 0 };
    const darkGametextBonus = dgb1.bonus + dgb2.bonus + dgb3.bonus;
    const darkGametextBonusLabel = dgb1.label ?? dgb2.label ?? dgb3.label;
    let lightPower = lightBasePower + lightBonus + lightBasePower2 + lightBonus2 + lightBasePower3 + lightBonus3 + lb.bonus + lw.bonus + lw2.bonus + lw3.bonus + lightGametextBonus;
    let darkPower = darkBasePower + darkBonus + darkBasePower2 + darkBonus2 + darkBasePower3 + darkBonus3 + db.bonus + dw.bonus + dw2.bonus + dw3.bonus + darkGametextBonus;
    const sumLight = () => lightBasePower + lightBonus + lightBasePower2 + lightBonus2 + lightBasePower3 + lightBonus3 + lb.bonus + lw.bonus + lw2.bonus + lw3.bonus + lightGametextBonus;
    const sumDark = () => darkBasePower + darkBonus + darkBasePower2 + darkBonus2 + darkBasePower3 + darkBonus3 + db.bonus + dw.bonus + dw2.bonus + dw3.bonus + darkGametextBonus;

    const commitPair = () => {
    let winner: "light" | "dark" | "tie" = "tie";
    let lightMill = 0;
    let darkMill = 0;
    let lightMilledCardIds: string[] | undefined;
    let darkMilledCardIds: string[] | undefined;

    if (lightPower > darkPower) {
      winner = "light";
      lightSurvivors.push(lf.character);
      if (lf.character2) lightSurvivors.push(lf.character2);
      if (lf.character3) lightSurvivors.push(lf.character3);
      pushFighterWeapons(lightSurvivors, lf);
      const darkReturnHand = df.battleCard ? battleCardConditionReturnHand(df.battleCard.cardId) : false;
      const darkLoseSegment = df.battleCard ? getBattleCardConditionLoseSegment(df.battleCard.cardId) : null;
      if (darkReturnHand) {
        toHand("dark", df.character);
        if (df.character2) toHand("dark", df.character2);
        if (df.character3) toHand("dark", df.character3);
        forEachMainWeapon(df, (w) => toHand("dark", w));
        if (df.weapon2) toHand("dark", df.weapon2);
        if (df.weapon3) toHand("dark", df.weapon3);
      } else if (darkLoseSegment) {
        // Only characters matching the "lose X" segment are discarded; others survive.
        if (characterMatchesBattleCanUseSegment(df.character.cardId, darkLoseSegment)) {
          toDiscard("dark", df.character);
          if (df.weapon) (lightOppNoWeapon ? darkSurvivors.push(df.weapon) : toDiscard("dark", df.weapon));
          if (df.extraWeapon) (lightOppNoWeapon ? darkSurvivors.push(df.extraWeapon) : toDiscard("dark", df.extraWeapon));
          darkMill += millDamageForFighter(state, "dark", df.character, darkMainOff ? undefined : df.weapon);
        } else {
          darkSurvivors.push(df.character);
          if (df.weapon) darkSurvivors.push(df.weapon);
          if (df.extraWeapon) darkSurvivors.push(df.extraWeapon);
        }
        if (df.character2) {
          if (characterMatchesBattleCanUseSegment(df.character2.cardId, darkLoseSegment)) {
            toDiscard("dark", df.character2);
            if (df.weapon2) (lightOppNoWeapon ? darkSurvivors.push(df.weapon2) : toDiscard("dark", df.weapon2));
            darkMill += millDamageForFighter(state, "dark", df.character2, dark2Off ? undefined : df.weapon2);
          } else {
            darkSurvivors.push(df.character2);
            if (df.weapon2) darkSurvivors.push(df.weapon2);
          }
        }
        if (df.character3) {
          if (characterMatchesBattleCanUseSegment(df.character3.cardId, darkLoseSegment)) {
            toDiscard("dark", df.character3);
            if (df.weapon3) (lightOppNoWeapon ? darkSurvivors.push(df.weapon3) : toDiscard("dark", df.weapon3));
            darkMill += millDamageForFighter(state, "dark", df.character3, dark3Off ? undefined : df.weapon3);
          } else {
            darkSurvivors.push(df.character3);
            if (df.weapon3) darkSurvivors.push(df.weapon3);
          }
        }
        if (df.battleCard && battleCardConditionNoDamage(df.battleCard.cardId)) darkMill = 0;
        if (darkMill > 0) darkMilledCardIds = millFromDeck(state, "dark", darkMill);
      } else {
        toDiscard("dark", df.character);
        if (df.character2) toDiscard("dark", df.character2);
        if (df.character3) toDiscard("dark", df.character3);
        if (df.weapon) (lightOppNoWeapon ? darkSurvivors.push(df.weapon) : toDiscard("dark", df.weapon));
        if (df.extraWeapon) (lightOppNoWeapon ? darkSurvivors.push(df.extraWeapon) : toDiscard("dark", df.extraWeapon));
        if (df.weapon2) (lightOppNoWeapon ? darkSurvivors.push(df.weapon2) : toDiscard("dark", df.weapon2));
        if (df.weapon3) (lightOppNoWeapon ? darkSurvivors.push(df.weapon3) : toDiscard("dark", df.weapon3));
      }
      if (!darkReturnHand && !darkLoseSegment) {
        if (df.battleCard && battleCardConditionNoDamage(df.battleCard.cardId)) {
          darkMill = 0;
        } else {
          darkMill = millDamageForFighter(state, "dark", df.character, darkMainOff ? undefined : df.weapon);
          if (df.character2) darkMill += millDamageForFighter(state, "dark", df.character2, dark2Off ? undefined : df.weapon2);
          if (df.character3) darkMill += millDamageForFighter(state, "dark", df.character3, dark3Off ? undefined : df.weapon3);
          if (darkMill > 0) darkMilledCardIds = millFromDeck(state, "dark", darkMill);
        }
      }
    } else if (darkPower > lightPower) {
      winner = "dark";
      darkSurvivors.push(df.character);
      if (df.character2) darkSurvivors.push(df.character2);
      if (df.character3) darkSurvivors.push(df.character3);
      pushFighterWeapons(darkSurvivors, df);
      const lightReturnHand = lf.battleCard ? battleCardConditionReturnHand(lf.battleCard.cardId) : false;
      const lightLoseSegment = lf.battleCard ? getBattleCardConditionLoseSegment(lf.battleCard.cardId) : null;
      if (lightReturnHand) {
        toHand("light", lf.character);
        if (lf.character2) toHand("light", lf.character2);
        if (lf.character3) toHand("light", lf.character3);
        forEachMainWeapon(lf, (w) => toHand("light", w));
        if (lf.weapon2) toHand("light", lf.weapon2);
        if (lf.weapon3) toHand("light", lf.weapon3);
      } else if (lightLoseSegment) {
        // Only characters matching the "lose X" segment are discarded; others survive.
        if (characterMatchesBattleCanUseSegment(lf.character.cardId, lightLoseSegment)) {
          toDiscard("light", lf.character);
          if (lf.weapon) (darkOppNoWeapon ? lightSurvivors.push(lf.weapon) : toDiscard("light", lf.weapon));
          if (lf.extraWeapon) (darkOppNoWeapon ? lightSurvivors.push(lf.extraWeapon) : toDiscard("light", lf.extraWeapon));
          lightMill += millDamageForFighter(state, "light", lf.character, lightMainOff ? undefined : lf.weapon);
        } else {
          lightSurvivors.push(lf.character);
          if (lf.weapon) lightSurvivors.push(lf.weapon);
          if (lf.extraWeapon) lightSurvivors.push(lf.extraWeapon);
        }
        if (lf.character2) {
          if (characterMatchesBattleCanUseSegment(lf.character2.cardId, lightLoseSegment)) {
            toDiscard("light", lf.character2);
            if (lf.weapon2) (darkOppNoWeapon ? lightSurvivors.push(lf.weapon2) : toDiscard("light", lf.weapon2));
            lightMill += millDamageForFighter(state, "light", lf.character2, light2Off ? undefined : lf.weapon2);
          } else {
            lightSurvivors.push(lf.character2);
            if (lf.weapon2) lightSurvivors.push(lf.weapon2);
          }
        }
        if (lf.character3) {
          if (characterMatchesBattleCanUseSegment(lf.character3.cardId, lightLoseSegment)) {
            toDiscard("light", lf.character3);
            if (lf.weapon3) (darkOppNoWeapon ? lightSurvivors.push(lf.weapon3) : toDiscard("light", lf.weapon3));
            lightMill += millDamageForFighter(state, "light", lf.character3, light3Off ? undefined : lf.weapon3);
          } else {
            lightSurvivors.push(lf.character3);
            if (lf.weapon3) lightSurvivors.push(lf.weapon3);
          }
        }
        if (lf.battleCard && battleCardConditionNoDamage(lf.battleCard.cardId)) lightMill = 0;
        if (lightMill > 0) lightMilledCardIds = millFromDeck(state, "light", lightMill);
      } else {
        toDiscard("light", lf.character);
        if (lf.character2) toDiscard("light", lf.character2);
        if (lf.character3) toDiscard("light", lf.character3);
        if (lf.weapon) (darkOppNoWeapon ? lightSurvivors.push(lf.weapon) : toDiscard("light", lf.weapon));
        if (lf.extraWeapon) (darkOppNoWeapon ? lightSurvivors.push(lf.extraWeapon) : toDiscard("light", lf.extraWeapon));
        if (lf.weapon2) (darkOppNoWeapon ? lightSurvivors.push(lf.weapon2) : toDiscard("light", lf.weapon2));
        if (lf.weapon3) (darkOppNoWeapon ? lightSurvivors.push(lf.weapon3) : toDiscard("light", lf.weapon3));
      }
      if (!lightReturnHand && !lightLoseSegment) {
        if (lf.battleCard && battleCardConditionNoDamage(lf.battleCard.cardId)) {
          lightMill = 0;
        } else {
          lightMill = millDamageForFighter(state, "light", lf.character, lightMainOff ? undefined : lf.weapon);
          if (lf.character2) lightMill += millDamageForFighter(state, "light", lf.character2, light2Off ? undefined : lf.weapon2);
          if (lf.character3) lightMill += millDamageForFighter(state, "light", lf.character3, light3Off ? undefined : lf.weapon3);
          if (lightMill > 0) lightMilledCardIds = millFromDeck(state, "light", lightMill);
        }
      }
    } else {
      lightSurvivors.push(lf.character);
      if (lf.character2) lightSurvivors.push(lf.character2);
      if (lf.character3) lightSurvivors.push(lf.character3);
      pushFighterWeapons(lightSurvivors, lf);
      darkSurvivors.push(df.character);
      if (df.character2) darkSurvivors.push(df.character2);
      if (df.character3) darkSurvivors.push(df.character3);
      pushFighterWeapons(darkSurvivors, df);
    }

      if (winner !== "tie") {
      const lightWon = winner === "light";
      let lightExtra = 0;
      let darkExtra = 0;
      for (const card of fighterBattleCards(lf)) {
        if (lightWon) darkExtra += battleCardExtraDamage(card.cardId, card.cardSet, "win");
        else lightExtra += battleCardExtraDamage(card.cardId, card.cardSet, "lose");
      }
      for (const card of fighterBattleCards(df)) {
        if (lightWon) darkExtra += battleCardExtraDamage(card.cardId, card.cardSet, "lose");
        else lightExtra += battleCardExtraDamage(card.cardId, card.cardSet, "win");
      }
      if (lightExtra > 0) {
        lightMill += lightExtra;
        const extraIds = millFromDeck(state, "light", lightExtra);
        lightMilledCardIds = [...(lightMilledCardIds ?? []), ...extraIds];
      }
      if (darkExtra > 0) {
        darkMill += darkExtra;
        const extraIds = millFromDeck(state, "dark", darkExtra);
        darkMilledCardIds = [...(darkMilledCardIds ?? []), ...extraIds];
      }
    }

    if (lf.battleCard) toDiscard("light", lf.battleCard);
    for (const extra of lf.extraBattleCards ?? []) toDiscard("light", extra);
    if (df.battleCard) toDiscard("dark", df.battleCard);
    for (const extra of df.extraBattleCards ?? []) toDiscard("dark", extra);

    const step: RevealStep = {
      type: "paired",
      lightCardId: lf.character.cardId,
      darkCardId: df.character.cardId,
      lightCardName: getCardName(lf.character.cardId),
      darkCardName: getCardName(df.character.cardId),
      lightBasePower,
      lightBonus,
      darkBasePower,
      darkBonus,
      lightPower,
      darkPower,
      winner,
      lightMill: lightMill > 0 ? lightMill : undefined,
      darkMill: darkMill > 0 ? darkMill : undefined,
      lightMilledCardIds,
      darkMilledCardIds,
      lightWeaponCardId: lf.weapon ? lf.weapon.cardId : undefined,
      lightWeaponName: lf.weapon ? getCardName(lf.weapon.cardId) : undefined,
      lightWeaponBonus: lw.bonus > 0 ? lw.bonus : undefined,
      lightDestinyDraws: _withPowerDestinyDraws(lightResolved.powerDestinyDraw, lw.destinyDraws),
      darkWeaponCardId: df.weapon ? df.weapon.cardId : undefined,
      darkWeaponName: df.weapon ? getCardName(df.weapon.cardId) : undefined,
      darkWeaponBonus: dw.bonus > 0 ? dw.bonus : undefined,
      darkDestinyDraws: _withPowerDestinyDraws(darkResolved.powerDestinyDraw, dw.destinyDraws),
      lightBattleCardId: lf.battleCard ? lf.battleCard.cardId : undefined,
      lightBattleCardName: lf.battleCard ? getCardName(lf.battleCard.cardId) : undefined,
      lightBattleCardBonus: lb.bonus > 0 ? lb.bonus : undefined,
      lightBattleDestinyDraws: lb.destinyDraws.length > 0 ? lb.destinyDraws : undefined,
      darkBattleCardId: df.battleCard ? df.battleCard.cardId : undefined,
      darkBattleCardName: df.battleCard ? getCardName(df.battleCard.cardId) : undefined,
      darkBattleCardBonus: db.bonus > 0 ? db.bonus : undefined,
      darkBattleDestinyDraws: db.destinyDraws.length > 0 ? db.destinyDraws : undefined,
      lightGametextBonusLabel: lightGametextBonusLabel,
      darkGametextBonusLabel: darkGametextBonusLabel,
    };
    if (lf.character2) {
      step.lightCardId2 = lf.character2.cardId;
      step.lightCardName2 = getCardName(lf.character2.cardId);
      step.lightBasePower2 = lightBasePower2;
      step.lightBonus2 = lightBonus2;
      step.lightDestinyDraws2 = _withPowerDestinyDraws(lightPowerDraw2, lw2.destinyDraws);
      if (lf.weapon2) {
        step.lightWeaponCardId2 = lf.weapon2.cardId;
        step.lightWeaponName2 = getCardName(lf.weapon2.cardId);
        step.lightWeaponBonus2 = lw2.bonus > 0 ? lw2.bonus : undefined;
      }
    }
    if (df.character2) {
      step.darkCardId2 = df.character2.cardId;
      step.darkCardName2 = getCardName(df.character2.cardId);
      step.darkBasePower2 = darkBasePower2;
      step.darkBonus2 = darkBonus2;
      step.darkDestinyDraws2 = _withPowerDestinyDraws(darkPowerDraw2, dw2.destinyDraws);
      if (df.weapon2) {
        step.darkWeaponCardId2 = df.weapon2.cardId;
        step.darkWeaponName2 = getCardName(df.weapon2.cardId);
        step.darkWeaponBonus2 = dw2.bonus > 0 ? dw2.bonus : undefined;
      }
    }
    if (lf.character3) {
      step.lightCardId3 = lf.character3.cardId;
      step.lightCardName3 = getCardName(lf.character3.cardId);
      step.lightBasePower3 = lightBasePower3;
      step.lightBonus3 = lightBonus3;
      step.lightDestinyDraws3 = _withPowerDestinyDraws(lightPowerDraw3, lw3.destinyDraws);
      if (lf.weapon3) {
        step.lightWeaponCardId3 = lf.weapon3.cardId;
        step.lightWeaponName3 = getCardName(lf.weapon3.cardId);
        step.lightWeaponBonus3 = lw3.bonus > 0 ? lw3.bonus : undefined;
      }
    }
    if (df.character3) {
      step.darkCardId3 = df.character3.cardId;
      step.darkCardName3 = getCardName(df.character3.cardId);
      step.darkBasePower3 = darkBasePower3;
      step.darkBonus3 = darkBonus3;
      step.darkDestinyDraws3 = _withPowerDestinyDraws(darkPowerDraw3, dw3.destinyDraws);
      if (df.weapon3) {
        step.darkWeaponCardId3 = df.weapon3.cardId;
        step.darkWeaponName3 = getCardName(df.weapon3.cardId);
        step.darkWeaponBonus3 = dw3.bonus > 0 ? dw3.bonus : undefined;
      }
    }
    revealSequence.push(step);
    markFoughtThisTurn(
      state,
      lf.character.cardId,
      lf.character2?.cardId,
      lf.character3?.cardId,
      df.character.cardId,
      df.character2?.cardId,
      df.character3?.cardId
    );

    // Fight again (defeat◆:fightagain): if attacker won and defeated a uniqueness:false character, they fight the next defender with same character+weapon (no battle card); weapon can be used again.
    const attackerSideLoop = state.turnSide;
    const attackerFighter = attackerSideLoop === "light" ? lf : df;
    const defenderFighter = attackerSideLoop === "light" ? df : lf;
    if (
      winner === attackerSideLoop &&
      attackerFighter.battleCard &&
      battleCardHasDefeatFightAgain(attackerFighter.battleCard.cardId) &&
      isCharacterUniquenessFalse(defenderFighter.character.cardId)
    ) {
      const nextDefenderIdx = attackerSideLoop === "light" ? di : li;
      const nextDefenderFighters = attackerSideLoop === "light" ? darkFighters : lightFighters;
      if (nextDefenderIdx < nextDefenderFighters.length) {
        const nextDefender = nextDefenderFighters[nextDefenderIdx];
        const attackerNoBC: BattleFighter = {
          ...attackerFighter,
          battleCard: undefined,
          battleCardValid: false,
          extraBattleCards: undefined,
        };
        const lf2 = attackerSideLoop === "light" ? attackerNoBC : nextDefender;
        const df2 = attackerSideLoop === "light" ? nextDefender : attackerNoBC;

        const lightRes2 = resolveCharacterPowerForBattle(state, "light", lf2.character.cardId);
        const lightBase2 = lightRes2.power;
        const lightBonus2a = getLocationBonusForCharacter(lf2.character.cardId, locationCardId);
        const darkRes2 = resolveCharacterPowerForBattle(state, "dark", df2.character.cardId);
        const darkBase2 = darkRes2.power;
        const darkBonus2a = getLocationBonusForCharacter(df2.character.cardId, locationCardId);
        const lightFirstIdx2 = lightCharOrderMap.get(lf2.character.instanceId) ?? 0;
        const darkFirstIdx2 = darkCharOrderMap.get(df2.character.instanceId) ?? 0;
        const lb2 = resolveBattleCardBonus(state, "light", lf2, df2.character.cardId, lightFirstIdx2, locationCardId);
        const db2 = resolveBattleCardBonus(state, "dark", df2, lf2.character.cardId, darkFirstIdx2, locationCardId);
        const lightBattleNoW2 = lf2.battleCard ? battleCardConditionNoWeapon(lf2.battleCard.cardId) : false;
        const darkBattleNoW2 = df2.battleCard ? battleCardConditionNoWeapon(df2.battleCard.cardId) : false;
        const lightNoW2 = lightBattleNoW2 || effectDeniesCharacterWeapons(state, lf2.character.cardId);
        const darkNoW2 = darkBattleNoW2 || effectDeniesCharacterWeapons(state, df2.character.cardId);
        const lw2a = lightNoW2 ? emptyWeaponResult : resolveWeaponBonus(state, "light", lf2, df2.character.cardId);
        const dw2a = darkNoW2 ? emptyWeaponResult : resolveWeaponBonus(state, "dark", df2, lf2.character.cardId);
        if (lf2.battleCard && lf2.battleCardValid && battleCardReplacesDestinyWithDamage(lf2.battleCard.cardId, lf2.battleCard.cardSet)) {
          applyDamageDestinyReplace(lf2.character.cardId, [lw2a, lb2]);
        }
        if (df2.battleCard && df2.battleCardValid && battleCardReplacesDestinyWithDamage(df2.battleCard.cardId, df2.battleCard.cardSet)) {
          applyDamageDestinyReplace(df2.character.cardId, [dw2a, db2]);
        }
        let lightBase2b = 0, lightBonus2b = 0, darkBase2b = 0, darkBonus2b = 0;
        let lw2b = emptyWeaponResult, dw2b = emptyWeaponResult;
        if (lf2.character2) {
          const r2 = resolveCharacterPowerForBattle(state, "light", lf2.character2.cardId);
          lightBase2b = r2.power;
          lightBonus2b = getLocationBonusForCharacter(lf2.character2.cardId, locationCardId);
          lw2b = (lightBattleNoW2 || effectDeniesCharacterWeapons(state, lf2.character2.cardId)) ? emptyWeaponResult : resolveWeaponBonusForPair(state, "light", lf2.weapon2, lf2.weapon2Valid, lf2.character2.cardId);
        }
        if (df2.character2) {
          const r2 = resolveCharacterPowerForBattle(state, "dark", df2.character2.cardId);
          darkBase2b = r2.power;
          darkBonus2b = getLocationBonusForCharacter(df2.character2.cardId, locationCardId);
          dw2b = (darkBattleNoW2 || effectDeniesCharacterWeapons(state, df2.character2.cardId)) ? emptyWeaponResult : resolveWeaponBonusForPair(state, "dark", df2.weapon2, df2.weapon2Valid, df2.character2.cardId);
        }
        const lightPower2 = lightBase2 + lightBonus2a + lightBase2b + lightBonus2b + lb2.bonus + lw2a.bonus + lw2b.bonus +
          getGametextBonusForCharacter(lf2.character.cardId, lf2.character.cardSet, lightNoW2 ? undefined : lf2.weapon?.cardId, df2.character.cardId, lightNoW2 ? undefined : lf2.weapon?.cardSet, lf2.battleCard?.cardId, lf2.battleCard?.cardSet, state).bonus +
          (lf2.character2 ? getGametextBonusForCharacter(lf2.character2.cardId, lf2.character2.cardSet, (lightBattleNoW2 || effectDeniesCharacterWeapons(state, lf2.character2.cardId)) ? undefined : lf2.weapon2?.cardId, df2.character2?.cardId ?? df2.character.cardId, (lightBattleNoW2 || effectDeniesCharacterWeapons(state, lf2.character2.cardId)) ? undefined : lf2.weapon2?.cardSet, lf2.battleCard?.cardId, lf2.battleCard?.cardSet, state).bonus : 0);
        const darkPower2 = darkBase2 + darkBonus2a + darkBase2b + darkBonus2b + db2.bonus + dw2a.bonus + dw2b.bonus +
          getGametextBonusForCharacter(df2.character.cardId, df2.character.cardSet, darkNoW2 ? undefined : df2.weapon?.cardId, lf2.character.cardId, darkNoW2 ? undefined : df2.weapon?.cardSet, df2.battleCard?.cardId, df2.battleCard?.cardSet, state).bonus +
          (df2.character2 ? getGametextBonusForCharacter(df2.character2.cardId, df2.character2.cardSet, (darkBattleNoW2 || effectDeniesCharacterWeapons(state, df2.character2.cardId)) ? undefined : df2.weapon2?.cardId, lf2.character2?.cardId ?? lf2.character.cardId, (darkBattleNoW2 || effectDeniesCharacterWeapons(state, df2.character2.cardId)) ? undefined : df2.weapon2?.cardSet, df2.battleCard?.cardId, df2.battleCard?.cardSet, state).bonus : 0);

        const winner2: "light" | "dark" | "tie" = lightPower2 > darkPower2 ? "light" : darkPower2 > lightPower2 ? "dark" : "tie";
        let lightMill2 = 0;
        let darkMill2 = 0;
        let lightMilled2: string[] | undefined;
        let darkMilled2: string[] | undefined;

        if (winner2 === "light") {
          toDiscard("dark", df2.character);
          if (df2.character2) toDiscard("dark", df2.character2);
          if (df2.weapon) toDiscard("dark", df2.weapon);
          if (df2.extraWeapon) toDiscard("dark", df2.extraWeapon);
          if (df2.weapon2) toDiscard("dark", df2.weapon2);
          if (attackerSideLoop !== "light") {
            lightSurvivors.push(lf2.character);
            if (lf2.character2) lightSurvivors.push(lf2.character2);
            if (lf2.weapon) lightSurvivors.push(lf2.weapon);
            if (lf2.extraWeapon) lightSurvivors.push(lf2.extraWeapon);
            if (lf2.weapon2) lightSurvivors.push(lf2.weapon2);
          }
          if (!(df2.battleCard && battleCardConditionNoDamage(df2.battleCard.cardId))) {
            darkMill2 = millDamageForFighter(state, "dark", df2.character, darkNoW2 ? undefined : df2.weapon) + millDamageForFighter(state, "dark", df2.character2, darkNoW2 ? undefined : df2.weapon2);
            if (darkMill2 > 0) darkMilled2 = millFromDeck(state, "dark", darkMill2);
          }
        } else if (winner2 === "dark") {
          toDiscard("light", lf2.character);
          if (lf2.character2) toDiscard("light", lf2.character2);
          if (lf2.weapon) toDiscard("light", lf2.weapon);
          if (lf2.extraWeapon) toDiscard("light", lf2.extraWeapon);
          if (lf2.weapon2) toDiscard("light", lf2.weapon2);
          if (attackerSideLoop !== "dark") {
            darkSurvivors.push(df2.character);
            if (df2.character2) darkSurvivors.push(df2.character2);
            if (df2.weapon) darkSurvivors.push(df2.weapon);
            if (df2.extraWeapon) darkSurvivors.push(df2.extraWeapon);
            if (df2.weapon2) darkSurvivors.push(df2.weapon2);
          }
          if (attackerSideLoop === "light") {
            const toRemove = new Set([lf2.character.instanceId, lf2.weapon?.instanceId, lf2.extraWeapon?.instanceId, lf2.character2?.instanceId, lf2.weapon2?.instanceId].filter(Boolean) as string[]);
            for (const id of toRemove) {
              const idx = lightSurvivors.findIndex((c) => c.instanceId === id);
              if (idx >= 0) {
                const [card] = lightSurvivors.splice(idx, 1);
                toDiscard("light", card);
              }
            }
          }
          if (!(lf2.battleCard && battleCardConditionNoDamage(lf2.battleCard?.cardId ?? ""))) {
            lightMill2 = millDamageForFighter(state, "light", lf2.character, lightNoW2 ? undefined : lf2.weapon) + millDamageForFighter(state, "light", lf2.character2, lightNoW2 ? undefined : lf2.weapon2);
            if (lightMill2 > 0) lightMilled2 = millFromDeck(state, "light", lightMill2);
          }
        } else {
          if (attackerSideLoop === "light") {
            darkSurvivors.push(df2.character);
            if (df2.character2) darkSurvivors.push(df2.character2);
            if (df2.weapon) darkSurvivors.push(df2.weapon);
            if (df2.extraWeapon) darkSurvivors.push(df2.extraWeapon);
            if (df2.weapon2) darkSurvivors.push(df2.weapon2);
          } else {
            lightSurvivors.push(lf2.character);
            if (lf2.character2) lightSurvivors.push(lf2.character2);
            if (lf2.weapon) lightSurvivors.push(lf2.weapon);
            if (lf2.extraWeapon) lightSurvivors.push(lf2.extraWeapon);
            if (lf2.weapon2) lightSurvivors.push(lf2.weapon2);
          }
        }

        if (df2.battleCard) toDiscard("dark", df2.battleCard);
        if (lf2.battleCard) toDiscard("light", lf2.battleCard);

        const step2: RevealStep = {
          type: "paired",
          lightCardId: lf2.character.cardId,
          darkCardId: df2.character.cardId,
          lightCardName: getCardName(lf2.character.cardId),
          darkCardName: getCardName(df2.character.cardId),
          lightBasePower: lightBase2,
          lightBonus: lightBonus2a,
          darkBasePower: darkBase2,
          darkBonus: darkBonus2a,
          lightPower: lightPower2,
          darkPower: darkPower2,
          winner: winner2,
          lightMill: lightMill2 > 0 ? lightMill2 : undefined,
          darkMill: darkMill2 > 0 ? darkMill2 : undefined,
          lightMilledCardIds: lightMilled2,
          darkMilledCardIds: darkMilled2,
          lightWeaponCardId: lf2.weapon ? lf2.weapon.cardId : undefined,
          lightWeaponName: lf2.weapon ? getCardName(lf2.weapon.cardId) : undefined,
          lightWeaponBonus: lw2a.bonus > 0 ? lw2a.bonus : undefined,
          darkWeaponCardId: df2.weapon ? df2.weapon.cardId : undefined,
          darkWeaponName: df2.weapon ? getCardName(df2.weapon.cardId) : undefined,
          darkWeaponBonus: dw2a.bonus > 0 ? dw2a.bonus : undefined,
        };
        revealSequence.push(step2);
        markFoughtThisTurn(
          state,
          nextDefender.character.cardId,
          nextDefender.character2?.cardId,
          nextDefender.character3?.cardId
        );

        if (attackerSideLoop === "light") di++;
        else li++;
      }
    }
    };

    const lightHasTwist = fighterBattleCards(lf).some((c) => battleCardSwitchesDestiny(c.cardId, c.cardSet));
    const darkHasTwist = fighterBattleCards(df).some((c) => battleCardSwitchesDestiny(c.cardId, c.cardSet));
    const switchedDestiny = new Set<Side>();
    let drawSeq = 0;
    const makeRefs = (
      prefix: string,
      buckets: { bonus: number; destinyDraws: { cardId: string; destiny: number }[] }[],
      powerDraws: ({ cardId: string; destiny: number } | undefined)[],
      addPowerDelta: (delta: number) => void
    ): DestinyDrawRef[] => {
      const refs: DestinyDrawRef[] = [];
      for (const draw of powerDraws) {
        if (!draw) continue;
        refs.push({
          key: prefix + drawSeq++,
          cardId: draw.cardId,
          draw,
          applyDelta: addPowerDelta,
        });
      }
      for (const bucket of buckets) {
        for (const draw of bucket.destinyDraws) {
          refs.push({
            key: prefix + drawSeq++,
            cardId: draw.cardId,
            draw,
            applyDelta: (delta) => { bucket.bonus += delta; },
          });
        }
      }
      return refs;
    };
    const lightRefs = makeRefs("L", [lw, lb, lw2, lw3], [lightResolved.powerDestinyDraw, lightPowerDraw2, lightPowerDraw3], (delta) => { lightBasePower += delta; });
    const darkRefs = makeRefs("D", [dw, db, dw2, dw3], [darkResolved.powerDestinyDraw, darkPowerDraw2, darkPowerDraw3], (delta) => { darkBasePower += delta; });
    const legalPairs = (yours: DestinyDrawRef[], opps: DestinyDrawRef[]) => {
      const pairs: [DestinyDrawRef, DestinyDrawRef][] = [];
      for (const y of yours) for (const o of opps) if (y.draw.destiny < o.draw.destiny) pairs.push([y, o]);
      return pairs;
    };
    const applyPair = (y: DestinyDrawRef, o: DestinyDrawRef) => {
      const av = y.draw.destiny;
      const bv = o.draw.destiny;
      y.draw.destiny = bv;
      o.draw.destiny = av;
      y.applyDelta(bv - av);
      o.applyDelta(av - bv);
      lightPower = sumLight();
      darkPower = sumDark();
    };
    const considerTwist = (): boolean => {
      for (const twistSide of ["light", "dark"] as Side[]) {
        if (switchedDestiny.has(twistSide)) continue;
        const hasCard = twistSide === "light" ? lightHasTwist : darkHasTwist;
        if (!hasCard) {
          switchedDestiny.add(twistSide);
          continue;
        }
        const yours = twistSide === "light" ? lightRefs : darkRefs;
        const opps = twistSide === "light" ? darkRefs : lightRefs;
        const pairs = legalPairs(yours, opps);
        if (pairs.length === 0) {
          switchedDestiny.add(twistSide);
          continue;
        }
        if (pairs.length === 1 || !isHumanSide(state, twistSide)) {
          const best = pairs.reduce((a, b) => (b[1].draw.destiny - b[0].draw.destiny) > (a[1].draw.destiny - a[0].draw.destiny) ? b : a);
          applyPair(best[0], best[1]);
          switchedDestiny.add(twistSide);
          continue;
        }
        state.destinySwapPending = {
          side: twistSide,
          yours: yours.map((d) => ({ key: d.key, cardId: d.cardId, destiny: d.draw.destiny })),
          opps: opps.map((d) => ({ key: d.key, cardId: d.cardId, destiny: d.draw.destiny })),
        };
        battleResume.set(state.id, (yourKey, oppKey) => {
          const y = yours.find((d) => d.key === yourKey);
          const o = opps.find((d) => d.key === oppKey);
          if (y && o && y.draw.destiny < o.draw.destiny) applyPair(y, o);
          switchedDestiny.add(twistSide);
          state.destinySwapPending = undefined;
          battleResume.delete(state.id);
          if (considerTwist()) return;
          commitPair();
          runPairs();
        });
        return true;
      }
      return false;
    };
    const applyDamageToDraw = (ref: DestinyDrawRef, damage: number) => {
      const delta = damage - ref.draw.destiny;
      ref.draw.destiny = damage;
      ref.applyDelta(delta);
      lightPower = sumLight();
      darkPower = sumDark();
    };
    const replacedDamage = new Set<Side>();
    let lightReplaceAt = 0;
    let darkReplaceAt = 0;
    const considerDamageReplace = (): boolean => {
      for (const replaceSide of ["light", "dark"] as Side[]) {
        if (replacedDamage.has(replaceSide)) continue;
        const hasCard = replaceSide === "light" ? lightHasReplace : darkHasReplace;
        const refs = replaceSide === "light" ? lightRefs : darkRefs;
        const character = replaceSide === "light" ? lf.character : df.character;
        if (!hasCard || refs.length === 0) {
          replacedDamage.add(replaceSide);
          continue;
        }
        const damage = getDamageValue(character.cardId, character.cardSet);
        if (!isHumanSide(state, replaceSide)) {
          let best = refs[0];
          for (const ref of refs) if (ref.draw.destiny < best.draw.destiny) best = ref;
          if (damage > best.draw.destiny) applyDamageToDraw(best, damage);
          replacedDamage.add(replaceSide);
          continue;
        }
        const at = replaceSide === "light" ? lightReplaceAt : darkReplaceAt;
        if (at >= refs.length) {
          replacedDamage.add(replaceSide);
          continue;
        }
        const shown = refs[at];
        state.damageReplacePending = {
          side: replaceSide,
          damage,
          draw: { key: shown.key, cardId: shown.cardId, destiny: shown.draw.destiny },
        };
        damageReplaceResume.set(state.id, (key) => {
          if (key) {
            const ref = refs.find((d) => d.key === key);
            if (ref) applyDamageToDraw(ref, damage);
            replacedDamage.add(replaceSide);
          } else if (replaceSide === "light") {
            lightReplaceAt += 1;
            if (lightReplaceAt >= refs.length) replacedDamage.add(replaceSide);
          } else {
            darkReplaceAt += 1;
            if (darkReplaceAt >= refs.length) replacedDamage.add(replaceSide);
          }
          state.damageReplacePending = undefined;
          damageReplaceResume.delete(state.id);
          if (considerDamageReplace()) return;
          if (considerTwist()) return;
          commitPair();
          runPairs();
        });
        return true;
      }
      return false;
    };
    if (lightHasReplace || darkHasReplace) {
      if (considerDamageReplace()) return;
    }
    if (lightHasTwist || darkHasTwist) {
      if (considerTwist()) return;
    }
    commitPair();
  }
  const attackerSide: Side = state.turnSide;
  const defenderSide: Side = attackerSide === "light" ? "dark" : "light";
  const remainingAttacker = attackerSide === "light" ? lightFighters.slice(li) : darkFighters.slice(di);
  const remainingDefender = attackerSide === "light" ? darkFighters.slice(di) : lightFighters.slice(li);

  const defenderSkipsBreakthrough = sideSkipsBreakthrough(
    defenderSide === "light" ? lightFighters : darkFighters,
    defenderSide === "light" ? lightPile : darkPile
  );
  for (const fighter of remainingAttacker) {
    const milledIds = defenderSkipsBreakthrough ? [] : millFromDeck(state, defenderSide, 1);
    if (!defenderSkipsBreakthrough) {
      const step: RevealStep = {
        type: "unopposed",
        lightCardId: attackerSide === "light" ? fighter.character.cardId : "",
        darkCardId: attackerSide === "dark" ? fighter.character.cardId : "",
        lightCardName: attackerSide === "light" ? getCardName(fighter.character.cardId) : "",
        darkCardName: attackerSide === "dark" ? getCardName(fighter.character.cardId) : "",
        lightBasePower: 0,
        lightBonus: 0,
        darkBasePower: 0,
        darkBonus: 0,
        lightPower: 0,
        darkPower: 0,
        winner: attackerSide,
      };
      if (defenderSide === "light") {
        step.lightMill = 1;
        step.lightMilledCardIds = milledIds;
      } else {
        step.darkMill = 1;
        step.darkMilledCardIds = milledIds;
      }
      revealSequence.push(step);
    }
    if (fighter.battleCard) toDiscard(attackerSide, fighter.battleCard);
    for (const extra of fighter.extraBattleCards ?? []) toDiscard(attackerSide, extra);
    if (attackerSide === "light") {
      lightSurvivors.push(fighter.character);
      if (fighter.character2) lightSurvivors.push(fighter.character2);
      if (fighter.character3) lightSurvivors.push(fighter.character3);
      pushFighterWeapons(lightSurvivors, fighter);
    } else {
      darkSurvivors.push(fighter.character);
      if (fighter.character2) darkSurvivors.push(fighter.character2);
      if (fighter.character3) darkSurvivors.push(fighter.character3);
      pushFighterWeapons(darkSurvivors, fighter);
    }
  }

  for (const fighter of remainingDefender) {
    if (fighter.battleCard) toDiscard(defenderSide, fighter.battleCard);
    for (const extra of fighter.extraBattleCards ?? []) toDiscard(defenderSide, extra);
    if (defenderSide === "light") {
      lightSurvivors.push(fighter.character);
      if (fighter.character2) lightSurvivors.push(fighter.character2);
      if (fighter.character3) lightSurvivors.push(fighter.character3);
      pushFighterWeapons(lightSurvivors, fighter);
    } else {
      darkSurvivors.push(fighter.character);
      if (fighter.character2) darkSurvivors.push(fighter.character2);
      if (fighter.character3) darkSurvivors.push(fighter.character3);
      pushFighterWeapons(darkSurvivors, fighter);
    }
  }

  state.battleRevealSequence = revealSequence;

  for (const c of lightSurvivors) {
    c.zone = "in_play";
    c.position = state.light.inPlay.length;
    state.light.inPlay.push(c);
  }
  for (const c of darkSurvivors) {
    c.zone = "in_play";
    c.position = state.dark.inPlay.length;
    state.dark.inPlay.push(c);
  }

  state.battlePlanPhase = false;
  state.lightBattlePlanOrder = undefined;
  state.darkBattlePlanOrder = undefined;
  state.lightBattlePlanReady = false;
  state.darkBattlePlanReady = false;
  state.battleCardDeclareSide = undefined;
  state.lightDeclaredBattleCards = undefined;
  state.darkDeclaredBattleCards = undefined;
  };
  runPairs();
}

/**
 * Check if one side controls the current planet.
 * Control = one side has ≥1 face-up character, the other has 0.
 * Skipped if any face-down cards remain (hidden cards not yet revealed).
 */
export function checkPlanetControl(s: GameStateData): { controlled: boolean; controlledBy?: Side } {
  if (s.light.inPlay.some((c) => c.faceDown) || s.dark.inPlay.some((c) => c.faceDown)) {
    return { controlled: false };
  }
  const locId = s.startingLocationInstanceId;
  const lightChars = s.light.inPlay.filter(
    (c) => c.instanceId !== locId && !isLocationCard(c.cardId, c.cardSet) && isCharacterOnly(c.cardId, c.cardSet)
  );
  const darkChars = s.dark.inPlay.filter(
    (c) => c.instanceId !== locId && !isLocationCard(c.cardId, c.cardSet) && isCharacterOnly(c.cardId, c.cardSet)
  );
  if (lightChars.length > 0 && darkChars.length === 0) return { controlled: true, controlledBy: "light" };
  if (darkChars.length > 0 && lightChars.length === 0) return { controlled: true, controlledBy: "dark" };
  return { controlled: false };
}

/**
 * Record planet control: move all in-play cards to controlled planet record,
 * increment planet wins, and clear the active location.
 * Returns game-over info if a player reaches 2 planet wins.
 */
export function controlPlanet(
  s: GameStateData
): { controlledBy: Side; gameOver?: boolean; winner?: Side } | null {
  const check = checkPlanetControl(s);
  if (!check.controlled || !check.controlledBy) return null;
  const controlledBy = check.controlledBy;
  discardEffectsAtLocation(s);
  const currentLoc = getCurrentLocationCard(s);
  const planet = currentLoc ? getLocationPlanet(currentLoc.card.cardId, currentLoc.card.cardSet) : "";
  if (!s.controlledPlanets) s.controlledPlanets = [];
  const strandedLight = s.light.inPlay.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, faceDown: c.faceDown }));
  const strandedDark = s.dark.inPlay.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, faceDown: c.faceDown }));
  s.controlledPlanets.push({
    locationCardId: currentLoc?.card.cardId ?? "",
    locationInstanceId: currentLoc?.card.instanceId ?? "",
    planet,
    controlledBy,
    strandedLight,
    strandedDark,
  });
  s.light.inPlay = [];
  s.dark.inPlay = [];
  s.startingLocationInstanceId = null;
  if (controlledBy === "light") s.lightPlanetsWon = (s.lightPlanetsWon ?? 0) + 1;
  else s.darkPlanetsWon = (s.darkPlanetsWon ?? 0) + 1;
  if ((s.lightPlanetsWon ?? 0) >= 2) return { controlledBy, gameOver: true, winner: "light" };
  if ((s.darkPlanetsWon ?? 0) >= 2) return { controlledBy, gameOver: true, winner: "dark" };
  return { controlledBy };
}

/**
 * Surrender the current planet: opponent wins control, all cards (both sides) stranded.
 * Same effect as controlPlanet but triggered voluntarily by surrenderingSide.
 */
export function surrenderPlanet(
  s: GameStateData,
  surrenderingSide: Side
): { controlledBy: Side; gameOver?: boolean; winner?: Side } | null {
  const currentLoc = getCurrentLocationCard(s);
  if (!currentLoc) return null;
  discardEffectsAtLocation(s);
  const controlledBy: Side = surrenderingSide === "light" ? "dark" : "light";
  const planet = getLocationPlanet(currentLoc.card.cardId, currentLoc.card.cardSet);
  if (!s.controlledPlanets) s.controlledPlanets = [];
  const strandedLight = s.light.inPlay.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, faceDown: c.faceDown }));
  const strandedDark = s.dark.inPlay.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId, faceDown: c.faceDown }));
  s.controlledPlanets.push({
    locationCardId: currentLoc.card.cardId,
    locationInstanceId: currentLoc.card.instanceId,
    planet,
    controlledBy,
    strandedLight,
    strandedDark,
  });
  s.light.inPlay = [];
  s.dark.inPlay = [];
  s.startingLocationInstanceId = null;
  if (controlledBy === "light") s.lightPlanetsWon = (s.lightPlanetsWon ?? 0) + 1;
  else s.darkPlanetsWon = (s.darkPlanetsWon ?? 0) + 1;
  if ((s.lightPlanetsWon ?? 0) >= 2) return { controlledBy, gameOver: true, winner: "light" };
  if ((s.darkPlanetsWon ?? 0) >= 2) return { controlledBy, gameOver: true, winner: "dark" };
  return { controlledBy };
}

/**
 * Enter the choose_next_planet phase for the losing side.
 * Extracts location cards from their hand, discard, and deck
 * that belong to planets not yet used in the game.
 */
export function enterChooseNextPlanet(s: GameStateData, loserSide: Side): void {
  const p = loserSide === "light" ? s.light : s.dark;
  const usedPlanets = s.usedPlanets ?? [];
  const choices: { instanceId: string; cardId: string; fromZone: string }[] = [];
  for (const c of p.hand) {
    if (isLocationCard(c.cardId, c.cardSet)) {
      const planet = getLocationPlanet(c.cardId, c.cardSet);
      if (planet && !usedPlanets.includes(planet)) {
        choices.push({ instanceId: c.instanceId, cardId: c.cardId, fromZone: "hand", ...(c.cardSet ? { cardSet: c.cardSet } : {}) });
      }
    }
  }
  for (const c of p.discard) {
    if (isLocationCard(c.cardId, c.cardSet)) {
      const planet = getLocationPlanet(c.cardId, c.cardSet);
      if (planet && !usedPlanets.includes(planet)) {
        choices.push({ instanceId: c.instanceId, cardId: c.cardId, fromZone: "discard", ...(c.cardSet ? { cardSet: c.cardSet } : {}) });
      }
    }
  }
  for (const c of p.deck) {
    if (isLocationCard(c.cardId, c.cardSet)) {
      const planet = getLocationPlanet(c.cardId, c.cardSet);
      if (planet && !usedPlanets.includes(planet)) {
        choices.push({ instanceId: c.instanceId, cardId: c.cardId, fromZone: "deck", ...(c.cardSet ? { cardSet: c.cardSet } : {}) });
      }
    }
  }
  if (choices.length === 0) {
    s.phase = "deploy";
    s.turnSide = loserSide;
    s.phaseStartedAt = Date.now();
    s.lightTurnCount = 0;
    s.darkTurnCount = 0;
    onEnterDeploy(s, loserSide);
    setForce(s, loserSide, 6);
    return;
  }
  s.phase = "choose_next_planet";
  s.turnSide = loserSide;
  s.phaseStartedAt = Date.now();
  s.nextPlanetChooserSide = loserSide;
  s.nextPlanetChoices = choices;
}

/**
 * Apply the chosen next planet location.
 * Moves the chosen card to inPlay as the new location.
 * Shuffles the deck (since we searched through it).
 * Resets hidden-card turn counts for both sides.
 * Sets the losing player to take the first turn.
 */
export function applyNextPlanetChoice(
  s: GameStateData,
  side: Side,
  instanceId: string
): boolean {
  if (s.phase !== "choose_next_planet" || s.nextPlanetChooserSide !== side) return false;
  const choices = s.nextPlanetChoices;
  if (!choices || choices.length === 0) return false;
  const choiceIdx = choices.findIndex((c) => c.instanceId === instanceId);
  if (choiceIdx < 0) return false;
  const p = side === "light" ? s.light : s.dark;
  let chosenCard: CardInstance | undefined;
  let idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx >= 0) [chosenCard] = p.hand.splice(idx, 1);
  if (!chosenCard) {
    idx = p.discard.findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) [chosenCard] = p.discard.splice(idx, 1);
  }
  if (!chosenCard) {
    idx = p.deck.findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) [chosenCard] = p.deck.splice(idx, 1);
  }
  if (!chosenCard) return false;
  chosenCard.zone = "in_play";
  chosenCard.position = 0;
  chosenCard.faceDown = false;
  p.inPlay.push(chosenCard);
  s.startingLocationInstanceId = chosenCard.instanceId;
  const planet = getLocationPlanet(chosenCard.cardId, chosenCard.cardSet);
  if (planet) {
    if (!s.usedPlanets) s.usedPlanets = [];
    if (!s.usedPlanets.includes(planet)) s.usedPlanets.push(planet);
  }
  s.nextPlanetChoices = undefined;
  s.nextPlanetChooserSide = undefined;
  shuffleDeck(p.deck);
  s.lightTurnCount = 0;
  s.darkTurnCount = 0;
  s.phase = "deploy";
  s.phaseStartedAt = Date.now();
  s.turnSide = side;
  onEnterDeploy(s, side);
  setForce(s, side, 6);
  return true;
}

// ---------------------------------------------------------------------------
// Evacuation (starship transport)
// ---------------------------------------------------------------------------

function isTransport(cardId: string): boolean {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "starship") return false;
  return ((def as { trait?: string }).trait ?? "").toLowerCase() === "transport";
}

function isStarfighter(cardId: string): boolean {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "starship") return false;
  return ((def as { trait?: string }).trait ?? "").toLowerCase() === "starfighter";
}

function getStarshipPower(cardId: string): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "starship") return 0;
  const p = (def as { power?: number }).power;
  return typeof p === "number" ? p : 0;
}

function getStarshipDamage(cardId: string): number {
  const def = getCard(cardId);
  if (!def || (def as { type?: string }).type !== "starship") return 0;
  const d = (def as { damage?: number }).damage;
  return typeof d === "number" ? d : 0;
}

/**
 * Get the evacuatable cards at a given planet for a given side.
 * For the current planet (index -1): face-up characters and weapons in play.
 * For controlled planets (index >= 0): stranded characters and weapons.
 */
export function getEvacuatableCards(
  state: GameStateData,
  side: Side,
  planetIndex: number
): { instanceId: string; cardId: string }[] {
  if (planetIndex === -1) {
    const locId = state.startingLocationInstanceId;
    const p = side === "light" ? state.light : state.dark;
    return p.inPlay
      .filter((c) => {
        if (c.instanceId === locId) return false;
        if (c.faceDown) return false;
        return isCharacterOrWeapon(c.cardId);
      })
      .map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }));
  }
  const controlled = state.controlledPlanets ?? [];
  if (planetIndex < 0 || planetIndex >= controlled.length) return [];
  const cp = controlled[planetIndex];
  const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
  const list = cp[strandedKey] ?? [];
  return list.filter((c) => isCharacterOrWeapon(c.cardId));
}

/**
 * Get planets where this side has evacuatable cards (returns indices).
 * -1 = current planet, 0..N = controlledPlanets indices.
 */
export function getEvacuatablePlanets(state: GameStateData, side: Side): number[] {
  const result: number[] = [];
  if (getEvacuatableCards(state, side, -1).length > 0) result.push(-1);
  const controlled = state.controlledPlanets ?? [];
  for (let i = 0; i < controlled.length; i++) {
    if (getEvacuatableCards(state, side, i).length > 0) result.push(i);
  }
  return result;
}

/** Check if side has a transport starship in hand. */
export function hasTransportInHand(state: GameStateData, side: Side): boolean {
  const p = side === "light" ? state.light : state.dark;
  return p.hand.some((c) => isTransport(c.cardId));
}

/** Check if opposing side has a starfighter in hand. */
export function hasStarfighterInHand(state: GameStateData, side: Side): boolean {
  const p = side === "light" ? state.light : state.dark;
  return p.hand.some((c) => isStarfighter(c.cardId));
}

/**
 * Start an evacuation: remove transport from hand, gather stacked cards from the target planet.
 * Sets evacuationState on the game and enters the interception window.
 */
export function startEvacuation(
  state: GameStateData,
  side: Side,
  transportInstanceId: string,
  targetPlanetIndex: number
): boolean {
  const p = side === "light" ? state.light : state.dark;
  const tIdx = p.hand.findIndex((c) => c.instanceId === transportInstanceId);
  if (tIdx < 0) return false;
  const transportCard = p.hand[tIdx];
  if (!isTransport(transportCard.cardId)) return false;

  const cards = getEvacuatableCards(state, side, targetPlanetIndex);
  if (cards.length === 0) return false;

  // Remove transport from hand
  p.hand.splice(tIdx, 1);

  // Remove cards from their location
  if (targetPlanetIndex === -1) {
    // Current planet: remove from inPlay
    for (const ec of cards) {
      const idx = p.inPlay.findIndex((c) => c.instanceId === ec.instanceId);
      if (idx >= 0) p.inPlay.splice(idx, 1);
    }
  } else {
    // Controlled planet: remove from stranded list
    const controlled = state.controlledPlanets ?? [];
    const cp = controlled[targetPlanetIndex];
    if (cp) {
      const strandedKey = side === "light" ? "strandedLight" : "strandedDark";
      const strandedList = cp[strandedKey] as { instanceId: string; cardId: string }[];
      const evacuatingIds = new Set(cards.map((c) => c.instanceId));
      cp[strandedKey] = strandedList.filter((c) => !evacuatingIds.has(c.instanceId));
    }
  }

  state.evacuationState = {
    evacuatingSide: side,
    transportInstanceId,
    transportCardId: transportCard.cardId,
    targetPlanetIndex,
    stackedCards: [...cards],
    awaitingInterception: true,
  };

  return true;
}

/**
 * Opponent intercepts with a starfighter. Resolves the starship battle immediately.
 */
export function interceptTransport(
  state: GameStateData,
  interceptorSide: Side,
  starfighterInstanceId: string
): EvacuationResult | null {
  const evac = state.evacuationState;
  if (!evac || !evac.awaitingInterception) return null;
  if (evac.evacuatingSide === interceptorSide) return null;

  const p = interceptorSide === "light" ? state.light : state.dark;
  const sfIdx = p.hand.findIndex((c) => c.instanceId === starfighterInstanceId);
  if (sfIdx < 0) return null;
  const sfCard = p.hand[sfIdx];
  if (!isStarfighter(sfCard.cardId)) return null;

  // Remove starfighter from hand
  p.hand.splice(sfIdx, 1);

  evac.awaitingInterception = false;
  evac.interceptorInstanceId = starfighterInstanceId;
  evac.interceptorCardId = sfCard.cardId;

  return resolveEvacuation(state, true);
}

/**
 * Opponent declines to intercept. Evacuation succeeds automatically.
 */
export function declineIntercept(state: GameStateData): EvacuationResult | null {
  const evac = state.evacuationState;
  if (!evac || !evac.awaitingInterception) return null;
  evac.awaitingInterception = false;
  return resolveEvacuation(state, false);
}

/**
 * Resolve evacuation: starship battle (if intercepted), then shuffle/discard cards.
 * Clears evacuationState and sets evacuationResult.
 */
function resolveEvacuation(state: GameStateData, intercepted: boolean): EvacuationResult {
  const evac = state.evacuationState!;
  const evacuatingSide = evac.evacuatingSide;
  const ep = evacuatingSide === "light" ? state.light : state.dark;
  const opponentSide: Side = evacuatingSide === "light" ? "dark" : "light";
  const op = opponentSide === "light" ? state.light : state.dark;

  const transportPower = getStarshipPower(evac.transportCardId) + getTransportSupportBonus(state, evacuatingSide);
  const transportDamage = Math.max(
    0,
    getStarshipDamage(evac.transportCardId) -
      getTransportDamageReductionFromCharacters(state, evacuatingSide) +
      getOpposingStarshipDamageBonus(state, evacuatingSide)
  );
  const transportName = getCardName(evac.transportCardId);

  const controlled = state.controlledPlanets ?? [];
  let targetPlanet = "";
  if (evac.targetPlanetIndex === -1) {
    const loc = getCurrentLocationCard(state);
    targetPlanet = loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet) : "Current";
  } else if (evac.targetPlanetIndex >= 0 && evac.targetPlanetIndex < controlled.length) {
    targetPlanet = controlled[evac.targetPlanetIndex].planet;
  }

  const result: EvacuationResult = {
    evacuatingSide,
    transportCardId: evac.transportCardId,
    transportName,
    targetPlanet,
    stackedCardIds: evac.stackedCards.map((c) => c.cardId),
    intercepted,
    transportPower,
    outcome: "success",
  };

  if (intercepted && evac.interceptorCardId) {
    const sfCardId = evac.interceptorCardId;
    const support = isStarfighter(sfCardId) ? getStarfighterSupportBonus(state, opponentSide) : 0;
    const sfPower = getStarshipPower(sfCardId) + support;
    const sfDamage = getStarshipDamage(sfCardId) + getOpposingStarshipDamageBonus(state, opponentSide);
    result.interceptorCardId = sfCardId;
    result.interceptorName = getCardName(sfCardId);
    result.interceptorPower = sfPower;

    // Starfighter draws destiny
    const destinyResult = drawDestiny(state, opponentSide);
    const topDiscard = op.discard.length > 0 ? op.discard[op.discard.length - 1] : null;
    result.interceptorDestinyDraw = topDiscard
      ? { cardId: topDiscard.cardId, destiny: destinyResult }
      : { cardId: "", destiny: destinyResult };
    const sfTotal = sfPower + destinyResult;
    result.interceptorTotalPower = sfTotal;

    if (sfTotal > transportPower) {
      // Transport destroyed
      result.outcome = "transport_destroyed";
      // Discard transport
      const tDiscard: CardInstance = {
        instanceId: evac.transportInstanceId,
        cardId: evac.transportCardId,
        ownerSide: evacuatingSide,
        zone: "discard",
        faceDown: false,
      };
      ep.discard.push(tDiscard);
      // Discard stacked cards
      const discardedIds: string[] = [];
      for (const sc of evac.stackedCards) {
        const inst: CardInstance = {
          instanceId: sc.instanceId,
          cardId: sc.cardId,
          ownerSide: evacuatingSide,
          zone: "discard",
          faceDown: false,
        };
        ep.discard.push(inst);
        discardedIds.push(sc.cardId);
      }
      result.discardedCardIds = discardedIds;
      // Mill from evacuating side's deck equal to Transport's damage (characters' damage ignored)
      if (transportDamage > 0) {
        const milled = millFromDeck(state, evacuatingSide, transportDamage);
        result.transportDamageMill = transportDamage;
        result.transportMilledCardIds = milled;
      }
      // Starfighter flies away (discarded, no damage)
      const sfDiscard: CardInstance = {
        instanceId: evac.interceptorInstanceId!,
        cardId: sfCardId,
        ownerSide: opponentSide,
        zone: "discard",
        faceDown: false,
      };
      op.discard.push(sfDiscard);
    } else if (transportPower > sfTotal) {
      // Transport wins, starfighter destroyed
      result.outcome = "success";
      // Starfighter destroyed: discard + mill damage from opponent's deck
      const sfDiscard: CardInstance = {
        instanceId: evac.interceptorInstanceId!,
        cardId: sfCardId,
        ownerSide: opponentSide,
        zone: "discard",
        faceDown: false,
      };
      op.discard.push(sfDiscard);
      if (sfDamage > 0) {
        const milled = millFromDeck(state, opponentSide, sfDamage);
        result.interceptorDamageMill = sfDamage;
        result.interceptorMilledCardIds = milled;
      }
      // Evacuation succeeds: stacked cards → draw deck
      const evacuatedIds: string[] = [];
      for (const sc of evac.stackedCards) {
        const inst: CardInstance = {
          instanceId: sc.instanceId,
          cardId: sc.cardId,
          ownerSide: evacuatingSide,
          zone: "deck",
        };
        ep.deck.push(inst);
        evacuatedIds.push(sc.cardId);
      }
      shuffleDeck(ep.deck);
      result.evacuatedCardIds = evacuatedIds;
      // Transport flies away (discarded, no damage)
      const tDiscard: CardInstance = {
        instanceId: evac.transportInstanceId,
        cardId: evac.transportCardId,
        ownerSide: evacuatingSide,
        zone: "discard",
        faceDown: false,
      };
      ep.discard.push(tDiscard);
    } else {
      // Tie: both survive → evacuation succeeds, both fly away
      result.outcome = "tie";
      const evacuatedIds: string[] = [];
      for (const sc of evac.stackedCards) {
        const inst: CardInstance = {
          instanceId: sc.instanceId,
          cardId: sc.cardId,
          ownerSide: evacuatingSide,
          zone: "deck",
        };
        ep.deck.push(inst);
        evacuatedIds.push(sc.cardId);
      }
      shuffleDeck(ep.deck);
      result.evacuatedCardIds = evacuatedIds;
      // Both ships fly away (discarded, no damage)
      const tDiscard: CardInstance = {
        instanceId: evac.transportInstanceId,
        cardId: evac.transportCardId,
        ownerSide: evacuatingSide,
        zone: "discard",
        faceDown: false,
      };
      ep.discard.push(tDiscard);
      const sfDiscard: CardInstance = {
        instanceId: evac.interceptorInstanceId!,
        cardId: sfCardId,
        ownerSide: opponentSide,
        zone: "discard",
        faceDown: false,
      };
      op.discard.push(sfDiscard);
    }
  } else {
    // No interception: evacuation succeeds
    result.outcome = "success";
    const evacuatedIds: string[] = [];
    for (const sc of evac.stackedCards) {
      const inst: CardInstance = {
        instanceId: sc.instanceId,
        cardId: sc.cardId,
        ownerSide: evacuatingSide,
        zone: "deck",
      };
      ep.deck.push(inst);
      evacuatedIds.push(sc.cardId);
    }
    shuffleDeck(ep.deck);
    result.evacuatedCardIds = evacuatedIds;
    // Transport flies away (discarded, no damage)
    const tDiscard: CardInstance = {
      instanceId: evac.transportInstanceId,
      cardId: evac.transportCardId,
      ownerSide: evacuatingSide,
      zone: "discard",
      faceDown: false,
    };
    ep.discard.push(tDiscard);
  }

  state.evacuationState = undefined;
  state.evacuationResult = result;
  return result;
}
