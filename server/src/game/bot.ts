/**
 * Young Jedi CCG — Bot AI for single-player vs computer.
 * Implements deploy, battle, even up, and choice phases per game rules and AI priorities.
 */

import type { GameAction } from "../types";
import type { GameStateData } from "./state";
import type { Side } from "../types";
import * as state from "./state";
import { getCard } from "../cards/loader";
import { BOT_PLAYER_ID } from "../lobby/lobby";
import * as memory from "./bot-memory";

/** Optional config for headless training: battle thresholds, surrender ratio, even-up thresholds, and whether to use bot-memory. When omitted, server uses current hardcoded values + memory. */
export interface BotConfig {
  battleThresholdWithWeapons: number;
  battleThresholdNoWeapons: number;
  battleThresholdMoreCharsCap: number;
  useMemoryAdjustment: boolean;
  /** Even-up: surrender planet when opponent power > myPower * this (default 1.5). */
  surrenderPowerRatio: number;
  /** Even-up: discard entire hand when unplayable count >= this (default 4). */
  discardHandUnplayableThreshold: number;
  /** Even-up: only allow discard_hand when deck size >= this (default 20). */
  discardHandMinDeck: number;
}

/** Battle initiation: lower = more willing to fight. Weapons/battle cards greatly increase win chance so we favor fighting when we have them. */
export const DEFAULT_BOT_CONFIG: BotConfig = {
  battleThresholdWithWeapons: 0.68,
  battleThresholdNoWeapons: 0.8,
  /** When we have more chars than opponent we cap threshold here; higher = less overrun-focused (default 0.78). */
  battleThresholdMoreCharsCap: 0.78,
  useMemoryAdjustment: true,
  surrenderPowerRatio: 1.5,
  discardHandUnplayableThreshold: 4,
  discardHandMinDeck: 20,
};

const CARD_TYPES = ["character", "weapon", "effect", "location", "battle", "starship"] as const;

function getCardType(cardId: string): string {
  const def = getCard(cardId);
  return (def as { type?: string })?.type ?? "";
}

function getCost(cardId: string): number {
  const def = getCard(cardId);
  const c = (def as { cost?: number }).cost;
  return typeof c === "number" ? c : 0;
}

function getPower(cardId: string): number {
  const def = getCard(cardId);
  const p = (def as { power?: number | string }).power;
  return typeof p === "number" ? p : 0;
}

/** True if this character or weapon card is unique (•). Unique cards stuck on won/lost planets block deploying more at current location. */
function isUniqueCard(cardId: string): boolean {
  const def = getCard(cardId);
  if (!def) return false;
  const d = def as { type?: string; uniqueness?: boolean };
  return d.uniqueness === true;
}

/** Simple canUse match: "any", or character persona/trait/name matches segment. */
function characterMatchesCanUse(characterCardId: string, canUse: string | undefined): boolean {
  if (!canUse || !canUse.trim()) return false;
  const seg = canUse.trim().toLowerCase();
  if (seg === "any") return true;
  const def = getCard(characterCardId);
  if (!def) return false;
  const d = def as { persona?: string; trait?: string; name?: string };
  const persona = (d.persona ?? "").toLowerCase();
  const trait = (d.trait ?? "").toLowerCase();
  const name = (d.name ?? "").toLowerCase();
  return persona.includes(seg) || trait.includes(seg) || name.includes(seg);
}

function canWeaponBeUsedBy(weaponCardId: string, characterCardId: string): boolean {
  const def = getCard(weaponCardId);
  if (!def || (def as { type?: string }).type !== "weapon") return false;
  const d = def as { canUse?: string; canUse2?: string };
  return characterMatchesCanUse(characterCardId, d.canUse) || characterMatchesCanUse(characterCardId, d.canUse2);
}

function canBattleCardBeUsedBy(battleCardId: string, characterCardId: string): boolean {
  const def = getCard(battleCardId);
  if (!def || (def as { type?: string }).type !== "battle") return false;
  const canUse = (def as { canUse?: string }).canUse ?? "";
  const segments = canUse.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (characterMatchesCanUse(characterCardId, seg)) return true;
  }
  return characterMatchesCanUse(characterCardId, canUse);
}

export function isBotGame(g: GameStateData): boolean {
  return g.lightPlayerId === BOT_PLAYER_ID || g.darkPlayerId === BOT_PLAYER_ID;
}

export function getBotSide(g: GameStateData): Side | null {
  if (g.lightPlayerId === BOT_PLAYER_ID) return "light";
  if (g.darkPlayerId === BOT_PLAYER_ID) return "dark";
  return null;
}

export function isBotTurn(g: GameStateData): boolean {
  const botSide = getBotSide(g);
  if (!botSide) return false;
  return g.turnSide === botSide;
}

/** True if the bot should take an action (turn, or battle declare/plan). */
export function isBotActionRequired(g: GameStateData): boolean {
  const botSide = getBotSide(g);
  if (!botSide) return false;
  if (g.phase === "game_over") return false;
  if (g.evacuationState?.awaitingInterception && g.evacuationState.evacuatingSide !== botSide) return true;
  if (g.evacuationResult) return true;
  if (g.battleCardDeclareSide === botSide) return true;
  if (g.battlePlanPhase && (botSide === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) return true;
  const humanSide: Side = botSide === "light" ? "dark" : "light";
  if (g.battleCardDeclareSide === humanSide) return false;
  if (g.battlePlanPhase && (humanSide === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) return false;
  if (g.turnSide === botSide) return true;
  return false;
}

/** Returns one action for the bot to perform, or null to pass phase (when applicable). Pass optional config for headless training; when omitted, server behavior is unchanged. */
export function getNextAction(g: GameStateData, botSide: Side, config?: BotConfig): GameAction | null {
  const cfg = config ?? DEFAULT_BOT_CONFIG;
  const phase = g.phase;
  const p = botSide === "light" ? g.light : g.dark;
  const oppSide: Side = botSide === "light" ? "dark" : "light";
  const opp = oppSide === "light" ? g.light : g.dark;
  const force = state.getForce(g, botSide);
  const loc = state.getCurrentLocationCard(g);
  const locId = loc?.card?.cardId ?? "";
  const myChars = state.getCharactersAtLocation(g, botSide, true);
  const oppChars = state.getCharactersAtLocation(g, oppSide, true);

  // --- Choice phases ---
  if (phase === "choose_starting_location") {
    const choices = g.startingLocationChoices ?? [];
    if (choices.length === 0) return null;
    const planetCount: Record<string, number> = {};
    for (const c of p.deck) {
      const planet = state.getLocationPlanet(c.cardId);
      if (planet) planetCount[planet] = (planetCount[planet] ?? 0) + 1;
    }
    let best = choices[0];
    let bestScore = planetCount[state.getLocationPlanet(best.cardId) ?? ""] ?? 0;
    if (cfg.useMemoryAdjustment) {
      const { rate, samples } = memory.getPatternWinRate("starting_planet:" + (state.getLocationPlanet(best.cardId) ?? ""));
      if (samples >= 3) bestScore += (rate - 0.5) * 4;
    }
    for (let i = 1; i < choices.length; i++) {
      const c = choices[i];
      const planet = state.getLocationPlanet(c.cardId) ?? "";
      let score = planetCount[planet] ?? 0;
      if (cfg.useMemoryAdjustment) {
        const { rate, samples } = memory.getPatternWinRate("starting_planet:" + planet);
        if (samples >= 3) score += (rate - 0.5) * 4;
      }
      if (score > bestScore || (score === bestScore && Math.random() < 0.5)) {
        best = c;
        bestScore = score;
      }
    }
    return { kind: "choose_starting_location", instanceId: best.instanceId };
  }

  if (phase === "choose_next_planet") {
    if (g.nextPlanetChooserSide !== botSide) return null;
    const choices = g.nextPlanetChoices ?? [];
    if (choices.length === 0) return null;
    if (cfg.useMemoryAdjustment && choices.length > 1) {
      let best = choices[0];
      let bestScore = 0.5;
      const p0 = state.getLocationPlanet(best.cardId) ?? "";
      const r0 = memory.getPatternWinRate("next_planet:" + p0);
      if (r0.samples >= 2) bestScore = r0.rate;
      for (let i = 1; i < choices.length; i++) {
        const planet = state.getLocationPlanet(choices[i].cardId) ?? "";
        const { rate, samples } = memory.getPatternWinRate("next_planet:" + planet);
        const score = samples >= 2 ? rate : 0.5;
        if (score > bestScore || (score === bestScore && Math.random() < 0.5)) {
          best = choices[i];
          bestScore = score;
        }
      }
      return { kind: "choose_next_planet", instanceId: best.instanceId };
    }
    const pick = choices[Math.floor(Math.random() * choices.length)];
    return { kind: "choose_next_planet", instanceId: pick.instanceId };
  }

  // --- Evacuation: intercept if we have starfighter and opponent is evacuating ---
  if (g.evacuationState?.awaitingInterception && g.evacuationState.evacuatingSide === oppSide) {
    if (state.hasStarfighterInHand(g, botSide)) {
      const starfighter = p.hand.find((c) => getCardType(c.cardId) === "starship" && ((getCard(c.cardId) as { trait?: string } | undefined)?.trait ?? "").toLowerCase() === "starfighter");
      if (starfighter) return { kind: "intercept_transport", starfighterInstanceId: starfighter.instanceId };
    }
    return { kind: "decline_intercept" };
  }

  if (g.evacuationResult) {
    return { kind: "dismiss_evacuation_result" };
  }

  // --- Deploy phase ---
  if (phase === "deploy") {
    if (force <= 0) return { kind: "pass_phase" };
    if (!g.evacuationState && state.hasTransportInHand(g, botSide)) {
      const transport = p.hand.find(
        (c) => getCardType(c.cardId) === "starship" && ((getCard(c.cardId) as { trait?: string } | undefined)?.trait ?? "").toLowerCase() === "transport"
      );
      if (transport) {
        const myPower = state.totalPowerInPlay(g, botSide);
        const oppPower = state.totalPowerInPlay(g, oppSide);
        const controlledCount = g.controlledPlanets?.length ?? 0;
        const myPlanetsWon = botSide === "light" ? (g.lightPlanetsWon ?? 0) : (g.darkPlanetsWon ?? 0);
        /** Only evacuate current location if first planet and outpowered by a lot, or second planet with 1 win and outpowered by a lot. */
        const EVAC_CURRENT_POWER_RATIO = 1.8;
        const mayEvacuateCurrent =
          (controlledCount === 0 || (controlledCount === 1 && myPlanetsWon === 1)) &&
          oppPower > myPower * EVAC_CURRENT_POWER_RATIO;

        const candidates: { planetIndex: number; priority: number }[] = [];
        const allPlanets = state.getEvacuatablePlanets(g, botSide);
        for (const planetIndex of allPlanets) {
          if (planetIndex === -1) {
            if (!mayEvacuateCurrent) continue;
            candidates.push({ planetIndex: -1, priority: 0 });
            continue;
          }
          const cards = state.getEvacuatableCards(g, botSide, planetIndex);
          const hasUnique = cards.some((c) => isUniqueCard(c.cardId));
          candidates.push({ planetIndex, priority: hasUnique ? 2 : 1 });
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.priority - a.priority);
          const best = candidates[0];
          return { kind: "evacuate_start", transportInstanceId: transport.instanceId, targetPlanetIndex: best.planetIndex };
        }
      }
    }
    const charsOnTableDeploy = myChars.filter((ch) => getCardType(ch.cardId) === "character").length;
    const playable: { instanceId: string; cardId: string; cost: number; type: string; score: number }[] = [];
    for (const c of p.hand) {
      const type = getCardType(c.cardId);
      if (type === "starship") continue; // played via evacuate
      if (type === "location") {
        if (!loc || loc.card.cardId === c.cardId) continue;
        const planet = state.getLocationPlanet(c.cardId);
        const currentPlanet = state.getLocationPlanet(loc.card.cardId);
        if (!planet || planet !== currentPlanet) continue;
        const locCost = getCost(c.cardId);
        if (locCost > force) continue;
        const currentLocId = loc.card.cardId;
        const newLocId = c.cardId;
        let currentBonus = 0;
        let newBonus = 0;
        for (const ch of myChars) {
          if (getCardType(ch.cardId) === "weapon") continue;
          currentBonus += state.getLocationBonusForCharacter(ch.cardId, currentLocId);
          newBonus += state.getLocationBonusForCharacter(ch.cardId, newLocId);
        }
        for (const h of p.hand) {
          if (getCardType(h.cardId) !== "character") continue;
          currentBonus += state.getLocationBonusForCharacter(h.cardId, currentLocId);
          newBonus += state.getLocationBonusForCharacter(h.cardId, newLocId);
        }
        if (newBonus <= currentBonus) continue;
        let locScore = 2;
        if (cfg.useMemoryAdjustment) {
          const { rate, samples } = memory.getCardPlayWinRate(c.cardId);
          if (samples >= 3) locScore += Math.max(-1.5, Math.min(1.5, (rate - 0.5) * 3));
        }
        playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost: locCost, type, score: locScore });
        continue;
      }
      if (type !== "character" && type !== "weapon" && type !== "effect") continue;
      const cost = type === "character" ? state.getDeployCostWithGametextBonus(g, botSide, c.cardId, c.cardSet) : getCost(c.cardId);
      if (cost > force) continue;
      const def = getCard(c.cardId) as { side?: string };
      if (def?.side && def.side !== botSide) continue;
      if (type === "character" && (state.wouldViolateUniqueness(g, botSide, c.cardId, c.cardSet) || state.wouldViolateUniquenessAtLocation(g, botSide, c.cardId))) continue;
      if (type === "weapon" && (state.wouldViolateUniquenessWeapon(g, botSide, c.cardId, c.cardSet) || state.wouldViolateUniquenessAtLocationWeapon(g, botSide, c.cardId, c.cardSet))) continue;
      let score = 2;
      if (type === "character") {
        if (locId) score += state.getLocationBonusForCharacter(c.cardId, locId);
        for (const b of p.hand) {
          if (getCardType(b.cardId) === "battle" && canBattleCardBeUsedBy(b.cardId, c.cardId)) score += 2;
        }
        for (const w of p.hand) {
          if (getCardType(w.cardId) === "weapon" && canWeaponBeUsedBy(w.cardId, c.cardId)) score += 1;
        }
        for (const ch of myChars) {
          if (getCardType(ch.cardId) === "weapon") continue;
          for (const w of p.hand) {
            if (getCardType(w.cardId) === "weapon" && canWeaponBeUsedBy(w.cardId, ch.cardId)) score += 0.5;
          }
        }
        // Characters are top priority; without any on table, weapons/battle do nothing — strongly prefer deploying a character first.
        if (charsOnTableDeploy === 0) score += 5;
      }
      if (type === "weapon") {
        for (const ch of myChars) {
          if (canWeaponBeUsedBy(c.cardId, ch.cardId)) { score += 2; break; }
        }
        if (myChars.length === 0) score -= 1;
        // Without a character on table, weapons are useless — never prefer weapon over character.
        if (charsOnTableDeploy === 0) score -= 4;
      }
      if (type === "effect") {
        if (charsOnTableDeploy === 0) score -= 3;
      }
      if (cfg.useMemoryAdjustment) {
        const { rate, samples } = memory.getCardPlayWinRate(c.cardId);
        if (samples >= 3) score += Math.max(-1.5, Math.min(1.5, (rate - 0.5) * 3));
      }
      playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost, type, score });
    }
    playable.sort((a, b) => b.score - a.score);
    const bestPlay = playable[0];
    if (bestPlay) return { kind: "play_card", instanceId: bestPlay.instanceId };
    return { kind: "pass_phase" };
  }

  // --- Battle phase ---
  if (phase === "battle") {
    if (g.battleCardDeclareSide === botSide) {
      const battleCards = p.hand.filter((c) => getCardType(c.cardId) === "battle");
      let usable = battleCards.filter((bc) => myChars.some((ch) => canBattleCardBeUsedBy(bc.cardId, ch.cardId)));
      if (cfg.useMemoryAdjustment && usable.length > 1) {
        usable = [...usable].sort((a, b) => {
          const ra = memory.getBattleCardWinRate(a.cardId);
          const rb = memory.getBattleCardWinRate(b.cardId);
          if (rb.samples >= 2 || ra.samples >= 2) return rb.rate - ra.rate;
          return 0;
        });
      }
      const instanceIds = usable.slice(0, 3).map((c) => c.instanceId);
      return { kind: "declare_battle_cards", battleCardInstanceIds: instanceIds };
    }
    if (g.battlePlanPhase) {
      const myOrder = (botSide === "light" ? g.lightBattlePlanOrder : g.darkBattlePlanOrder);
      if (!myOrder || myOrder.length === 0) {
        const inPlay = state.getCharactersAtLocation(g, botSide, true);
        const declared = (botSide === "light" ? g.lightDeclaredBattleCards : g.darkDeclaredBattleCards) ?? [];
        const characters = inPlay.filter((c) => getCardType(c.cardId) === "character");
        const weapons = inPlay.filter((c) => getCardType(c.cardId) === "weapon");
        const botIsAttacker = g.turnSide === botSide;
        const myPower = state.totalPowerInPlay(g, botSide);
        const oppPower = state.totalPowerInPlay(g, oppSide);
        const likelyLosing = !botIsAttacker && (myPower < oppPower || characters.length < oppChars.length);
        const weaponPowerAdd = (w: { instanceId: string; cardId: string; cardSet?: string }, ch: { instanceId: string; cardId: string }) =>
          state.getWeaponPowerAddForCharacter(w.cardId, ch.cardId, w.cardSet);
        const pairs: { weapon: typeof weapons[0]; char: typeof characters[0]; add: number }[] = [];
        for (const w of weapons) {
          for (const ch of characters) {
            if (!canWeaponBeUsedBy(w.cardId, ch.cardId)) continue;
            const add = state.getWeaponPowerAddForCharacter(w.cardId, ch.cardId, w.cardSet);
            pairs.push({ weapon: w, char: ch, add });
          }
        }
        pairs.sort((a, b) => b.add - a.add);
        const assignedWeapon = new Map<string, typeof weapons[0]>();
        const usedWeaponIds = new Set<string>();
        for (const { weapon, char } of pairs) {
          if (assignedWeapon.has(char.instanceId) || usedWeaponIds.has(weapon.instanceId)) continue;
          assignedWeapon.set(char.instanceId, weapon);
          usedWeaponIds.add(weapon.instanceId);
        }
        const sortedChars = [...characters].sort((a, b) => {
          if (likelyLosing) {
            return getPower(a.cardId) - getPower(b.cardId);
          }
          const addA = assignedWeapon.get(a.instanceId) ? weaponPowerAdd(assignedWeapon.get(a.instanceId)!, a) : 0;
          const addB = assignedWeapon.get(b.instanceId) ? weaponPowerAdd(assignedWeapon.get(b.instanceId)!, b) : 0;
          if (addA !== addB) return addB - addA;
          const hasWepA = assignedWeapon.has(a.instanceId);
          const hasWepB = assignedWeapon.has(b.instanceId);
          if (hasWepA !== hasWepB) return hasWepB ? 1 : -1;
          return getPower(b.cardId) - getPower(a.cardId);
        });
        const order: string[] = [];
        for (const id of declared) order.push(id);
        for (const ch of sortedChars) {
          const weapon = assignedWeapon.get(ch.instanceId);
          if (weapon) {
            order.push(weapon.instanceId);
          }
          order.push(ch.instanceId);
        }
        const orderSet = new Set(order);
        for (const c of inPlay) {
          if (!orderSet.has(c.instanceId)) order.push(c.instanceId);
        }
        return { kind: "battle_plan_ready", instanceIds: order };
      }
      return null;
    }
    if (g.battleCardDeclareSide && g.battleCardDeclareSide !== botSide) return null;
    if (g.battlePlanPhase && (botSide === "light" ? g.lightBattlePlanReady : g.darkBattlePlanReady)) return null;
    if (myChars.length > 0 && oppChars.length > 0 && !g.battleCardDeclareSide && !g.battlePlanPhase) {
      const myPower = state.totalPowerInPlay(g, botSide);
      const oppPower = state.totalPowerInPlay(g, oppSide);
      const myCharCount = myChars.filter((c) => getCardType(c.cardId) === "character").length;
      const oppCharCount = oppChars.filter((c) => getCardType(c.cardId) === "character").length;
      const hasMatchingWeapons = myChars.some((ch) => {
        if (getCardType(ch.cardId) === "weapon") return false;
        return p.inPlay.some((c) => getCardType(c.cardId) === "weapon" && canWeaponBeUsedBy(c.cardId, ch.cardId));
      });
      const hasUsableBattleCards = p.hand.some(
        (c) => getCardType(c.cardId) === "battle" && myChars.some((ch) => getCardType(ch.cardId) === "character" && canBattleCardBeUsedBy(c.cardId, ch.cardId))
      );
      const hasBattleBoost = hasMatchingWeapons || hasUsableBattleCards;
      /** Without weapons or battle cards, raw power trades are risky — avoid initiating when outgunned or when extra bodies don't buy a real power edge. */
      if (!hasBattleBoost && oppPower > 0) {
        if (myPower < oppPower) return { kind: "pass_phase" };
        if (myCharCount > oppCharCount && myPower < oppPower * 1.12) return { kind: "pass_phase" };
      }
      let threshold = hasMatchingWeapons ? cfg.battleThresholdWithWeapons : cfg.battleThresholdNoWeapons;
      if (hasUsableBattleCards) threshold -= 0.02;
      if (hasMatchingWeapons && hasUsableBattleCards) threshold -= 0.05;
      if (myCharCount > oppCharCount) threshold = Math.min(threshold, cfg.battleThresholdMoreCharsCap);
      const powerRatio = oppPower > 0 ? myPower / oppPower : 2.0;
      if (cfg.useMemoryAdjustment && memory.shouldAvoidBattle(powerRatio, hasMatchingWeapons)) {
        return { kind: "pass_phase" };
      }
      const memAdj = cfg.useMemoryAdjustment
        ? memory.getBattleThresholdAdjustment(powerRatio, hasMatchingWeapons, myCharCount, oppCharCount)
        : 0;
      threshold += memAdj;
      if (myPower >= oppPower * threshold) return { kind: "initiate_battle" };
    }
    return { kind: "pass_phase" };
  }

  // --- Even up phase ---
  if (phase === "even_up") {
    const handSize = p.hand.length;
    const evenUpTarget = state.getEffectEvenUpTarget(g, botSide);
    const deckSize = p.deck.length;
    const currentPlanet = loc ? state.getLocationPlanet(loc.card.cardId) ?? "" : "";
    const evacuatablePlanets = state.getEvacuatablePlanets(g, botSide);
    const charsOnTable = myChars.filter((ch) => getCardType(ch.cardId) === "character").length;
    const charsInHand = p.hand.filter((c) => getCardType(c.cardId) === "character").length;
    const locationInHand = p.hand.find((c) => getCardType(c.cardId) === "location");

    // If bot has 0 characters anywhere, entire hand is useless — always discard hand to draw (at any hand size).
    if (charsOnTable === 0 && charsInHand === 0 && deckSize >= cfg.discardHandMinDeck) {
      return { kind: "discard_hand" };
    }
    // Every even-up, if bot has a location in hand, discard just that location (Discard Location action).
    if (locationInHand) {
      return { kind: "discard_location", instanceId: locationInHand.instanceId };
    }

    let unplayableCount = 0;
    const toDiscard: {
      instanceId: string;
      cardId: string;
      type: string;
      isWrongPlanet: boolean;
      isUnplayableBattle: boolean;
      isUselessStarship: boolean;
      isLocation: boolean;
      isUselessWithoutCharacter: boolean;
    }[] = [];
    for (const c of p.hand) {
      const type = getCardType(c.cardId);
      const isLoc = type === "location";
      const wrongPlanet = isLoc && currentPlanet && state.getLocationPlanet(c.cardId) !== currentPlanet;
      const isUnplayableBattle = type === "battle" && !myChars.some((ch) => canBattleCardBeUsedBy(c.cardId, ch.cardId));
      const trait = ((getCard(c.cardId) as { trait?: string } | undefined)?.trait ?? "").toLowerCase();
      const isTransport = type === "starship" && trait === "transport";
      const isStarfighter = type === "starship" && trait === "starfighter";
      const isUselessStarship =
        (isTransport && evacuatablePlanets.length === 0) ||
        (isStarfighter && !g.evacuationState);
      // Weapons and battle cards are useless without a character on table to use them.
      const isUselessWithoutCharacter = charsOnTable === 0 && (type === "weapon" || type === "battle");
      if (wrongPlanet || isUnplayableBattle || isUselessStarship || isUselessWithoutCharacter) unplayableCount++;
      toDiscard.push({
        instanceId: c.instanceId,
        cardId: c.cardId,
        type,
        isWrongPlanet: !!wrongPlanet,
        isUnplayableBattle,
        isUselessStarship: !!isUselessStarship,
        isLocation: isLoc,
        isUselessWithoutCharacter,
      });
    }
    if (handSize > evenUpTarget) {
      const shouldDiscardHand =
        unplayableCount >= cfg.discardHandUnplayableThreshold && deckSize >= cfg.discardHandMinDeck;
      if (shouldDiscardHand) {
        if (!cfg.useMemoryAdjustment) return { kind: "discard_hand" };
        const { rate, samples } = memory.getPatternWinRate("even_up_discard_hand");
        if (samples < 5 || rate >= 0.4) return { kind: "discard_hand" };
        // Memory says discard_hand tends to lose; prefer single-card discards instead
      }
      // Prefer discarding: wrong planet location > location (cycle for cards) > unplayable battle > useless starship > weapon/battle without char > rest.
      toDiscard.sort((a, b) => {
        if (a.isWrongPlanet && !b.isWrongPlanet) return -1;
        if (!a.isWrongPlanet && b.isWrongPlanet) return 1;
        if (a.isLocation && !b.isLocation) return -1;
        if (!a.isLocation && b.isLocation) return 1;
        if (a.isUnplayableBattle && !b.isUnplayableBattle) return -1;
        if (!a.isUnplayableBattle && b.isUnplayableBattle) return 1;
        if (a.isUselessStarship && !b.isUselessStarship) return -1;
        if (!a.isUselessStarship && b.isUselessStarship) return 1;
        if (a.isUselessWithoutCharacter && !b.isUselessWithoutCharacter) return -1;
        if (!a.isUselessWithoutCharacter && b.isUselessWithoutCharacter) return 1;
        const low = (t: string) => (t === "battle" || t === "weapon" ? 0 : 1);
        return low(a.type) - low(b.type);
      });
      const discard = toDiscard[0];
      if (discard) return { kind: "discard_from_hand", instanceId: discard.instanceId };
    }
    if (handSize < evenUpTarget) return { kind: "even_up" };
    if (handSize === evenUpTarget) {
      if (myChars.length <= 1 && oppChars.length >= 2) {
        const myP = myChars.reduce((s, c) => s + getPower(c.cardId), 0);
        const oppP = oppChars.reduce((s, c) => s + getPower(c.cardId), 0);
        let surrenderThreshold = cfg.surrenderPowerRatio;
        if (cfg.useMemoryAdjustment) {
          const { rate, samples } = memory.getPatternWinRate("even_up_surrender_planet");
          if (samples >= 5) {
            if (rate < 0.35) return { kind: "even_up" }; // Memory says surrendering tends to lose
            if (rate > 0.6) surrenderThreshold = Math.max(1.2, surrenderThreshold - 0.15); // Slightly more willing to surrender
          }
        }
        if (oppP > myP * surrenderThreshold) return { kind: "surrender_planet" };
      }
      return { kind: "even_up" };
    }
    return null;
  }

  return null;
}
