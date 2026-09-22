/**
 * Young Jedi CCG — Bot AI for single-player vs computer.
 * Heuristic policy with Neutral / Aggressive / Passive styles.
 */

import type { GameAction } from "../types";
import type { GameStateData } from "./state";
import type { Side } from "../types";
import * as state from "./state";
import { getCard } from "../cards/loader";
import { BOT_PLAYER_ID } from "../lobby/lobby";
import * as memory from "./bot-memory";
import { usesHyperspace, usesDueling, usesPlanetEffectFetch, usesDeployFromDeck } from "./ruleset";
import * as hyperspace from "./hyperspace";
import * as duel from "./duel";
import * as winControl from "./win-control";
import * as deployFromDeck from "./deploy-from-deck";

export type BotStyle = "balanced" | "aggressive" | "passive";

/** Optional config for headless training and live bot games. */
export interface BotConfig {
  battleThresholdWithWeapons: number;
  battleThresholdNoWeapons: number;
  battleThresholdMoreCharsCap: number;
  useMemoryAdjustment: boolean;
  surrenderPowerRatio: number;
  discardHandUnplayableThreshold: number;
  discardHandMinDeck: number;
  style?: BotStyle;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  battleThresholdWithWeapons: 0.68,
  battleThresholdNoWeapons: 0.8,
  battleThresholdMoreCharsCap: 0.78,
  useMemoryAdjustment: true,
  surrenderPowerRatio: 1.5,
  discardHandUnplayableThreshold: 4,
  discardHandMinDeck: 20,
  style: "balanced",
};

const STYLES: BotStyle[] = ["balanced", "aggressive", "passive"];

export function parseBotStyleRequest(raw: unknown): "random" | "auto" | BotStyle {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "random" || s === "auto" || s === "balanced" || s === "aggressive" || s === "passive") return s;
  if (s === "neutral") return "balanced";
  return "auto";
}

/** Infer a style from deck makeup: battle/weapon-heavy → aggressive, location/destiny → passive. */
export function inferBotStyle(cardIds: string[]): BotStyle {
  let battle = 0;
  let weapons = 0;
  let chars = 0;
  let locations = 0;
  let power = 0;
  let destiny = 0;
  let n = 0;
  for (const id of cardIds) {
    const def = getCard(id) as { type?: string; power?: number; destiny?: number } | undefined;
    if (!def) continue;
    n++;
    const t = (def.type ?? "").toLowerCase();
    if (t === "battle") battle++;
    else if (t === "weapon") weapons++;
    else if (t === "character") {
      chars++;
      if (typeof def.power === "number") power += def.power;
    } else if (t === "location") locations++;
    if (typeof def.destiny === "number") destiny += def.destiny;
  }
  if (n === 0) return "balanced";
  const battleShare = battle / n;
  const weaponShare = weapons / n;
  const locShare = locations / n;
  const avgPower = chars > 0 ? power / chars : 0;
  const avgDest = destiny / n;
  if (battleShare >= 0.12 || weaponShare >= 0.14 || avgPower >= 4.2) return "aggressive";
  if (locShare >= 0.12 || avgDest >= 3.4) return "passive";
  return "balanced";
}

export function resolveBotStyle(request: unknown, cardIds: string[]): BotStyle {
  const req = parseBotStyleRequest(request);
  if (req === "random") return STYLES[Math.floor(Math.random() * STYLES.length)];
  if (req === "auto") return inferBotStyle(cardIds);
  return req;
}

export function applyBotStyle(base: BotConfig, style: BotStyle): BotConfig {
  const cfg: BotConfig = { ...base, style };
  if (style === "aggressive") {
    cfg.battleThresholdWithWeapons *= 0.86;
    cfg.battleThresholdNoWeapons *= 0.88;
    cfg.battleThresholdMoreCharsCap *= 0.9;
    cfg.surrenderPowerRatio += 0.25;
    cfg.discardHandUnplayableThreshold += 1;
  } else if (style === "passive") {
    cfg.battleThresholdWithWeapons *= 1.12;
    cfg.battleThresholdNoWeapons *= 1.1;
    cfg.battleThresholdMoreCharsCap *= 1.08;
    cfg.surrenderPowerRatio -= 0.2;
    cfg.discardHandUnplayableThreshold = Math.max(3, cfg.discardHandUnplayableThreshold - 1);
  }
  return cfg;
}

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

function getDestiny(cardId: string): number {
  const def = getCard(cardId);
  const d = (def as { destiny?: number }).destiny;
  return typeof d === "number" ? d : 0;
}

function isUniqueCard(cardId: string): boolean {
  const def = getCard(cardId);
  if (!def) return false;
  return (def as { uniqueness?: boolean }).uniqueness === true;
}

function isCharacter(cardId: string): boolean {
  return getCardType(cardId) === "character";
}

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
  return (
    characterMatchesCanUse(characterCardId, d.canUse) ||
    characterMatchesCanUse(characterCardId, d.canUse2) ||
    state.characterGrantsWeaponUse(characterCardId, weaponCardId)
  );
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

function charsOnly(cards: { cardId: string }[]): typeof cards {
  return cards.filter((c) => isCharacter(c.cardId));
}

function anyFaceDown(g: GameStateData): boolean {
  return g.light.inPlay.some((c) => c.faceDown) || g.dark.inPlay.some((c) => c.faceDown);
}

/** Planet already ours: we have a character, they have none, nothing is hidden. Extra deploys just strand cards. */
function planetAlreadyWon(myCharCount: number, oppCharCount: number, hidden: boolean): boolean {
  return !hidden && myCharCount > 0 && oppCharCount === 0;
}

function planetAlreadyLost(myCharCount: number, oppCharCount: number, hidden: boolean): boolean {
  return !hidden && myCharCount === 0 && oppCharCount > 0;
}

function weaponMatchesAny(weaponId: string, characters: { cardId: string }[]): boolean {
  return characters.some((ch) => isCharacter(ch.cardId) && canWeaponBeUsedBy(weaponId, ch.cardId));
}

function battleMatchesAny(battleId: string, characters: { cardId: string }[]): boolean {
  return characters.some((ch) => isCharacter(ch.cardId) && canBattleCardBeUsedBy(battleId, ch.cardId));
}

function bestWeaponAdd(weaponId: string, weaponSet: string | undefined, characters: { cardId: string }[]): number {
  let best = 0;
  for (const ch of characters) {
    if (!isCharacter(ch.cardId) || !canWeaponBeUsedBy(weaponId, ch.cardId)) continue;
    const add = state.getWeaponPowerAddForCharacter(weaponId, ch.cardId, weaponSet);
    if (add > best) best = add;
  }
  return best;
}

function scorePlanetCard(
  g: GameStateData,
  botSide: Side,
  locationCardId: string,
  cfg: BotConfig
): number {
  const planet = state.getLocationPlanet(locationCardId) ?? "";
  const p = botSide === "light" ? g.light : g.dark;
  let score = 0;
  for (const c of [...p.deck, ...p.hand, ...p.discard]) {
    if (state.getLocationPlanet(c.cardId) === planet) score += 2.5;
    if (isCharacter(c.cardId)) score += state.getLocationBonusForCharacter(c.cardId, locationCardId) * 0.6;
  }
  if (cfg.useMemoryAdjustment) {
    const { rate, samples } = memory.getPatternWinRate("starting_planet:" + planet);
    if (samples >= 3) score += (rate - 0.5) * 4;
    const n = memory.getPatternWinRate("next_planet:" + planet);
    if (n.samples >= 2) score += (n.rate - 0.5) * 3;
  }
  return score;
}

function pickBestLocationChoice<T extends { cardId: string }>(
  g: GameStateData,
  botSide: Side,
  choices: T[],
  cfg: BotConfig
): T {
  let best = choices[0];
  let bestScore = scorePlanetCard(g, botSide, best.cardId, cfg);
  for (let i = 1; i < choices.length; i++) {
    const s = scorePlanetCard(g, botSide, choices[i].cardId, cfg);
    if (s > bestScore || (s === bestScore && Math.random() < 0.5)) {
      best = choices[i];
      bestScore = s;
    }
  }
  return best;
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

export function isBotActionRequired(g: GameStateData): boolean {
  const botSide = getBotSide(g);
  if (!botSide) return false;
  if (g.phase === "game_over") return false;
  if (g.evacuationState?.awaitingInterception && g.evacuationState.evacuatingSide !== botSide) return true;
  if (g.evacuationResult) return true;
  if (g.planetEffectFetch?.chooserSide === botSide) return true;
  if (g.planetEffectFetch && g.planetEffectFetch.chooserSide !== botSide) return false;
  if (g.deployFromDeckPending?.side === botSide) return true;
  if (g.deployFromDeckPending && g.deployFromDeckPending.side !== botSide) return false;
  if (g.jediTrainingPending?.side === botSide) return true;
  if (g.jediTrainingPending && g.jediTrainingPending.side !== botSide) return false;
  if (g.poundedPending?.side === botSide) return true;
  if (g.poundedPending && g.poundedPending.side !== botSide) return false;
  if (g.deployDrawPending?.side === botSide) return true;
  if (g.deployDrawPending && g.deployDrawPending.side !== botSide) return false;
  if (g.effectActivationPending?.side === botSide) return true;
  if (g.effectActivationPending && g.effectActivationPending.side !== botSide) return false;
  if (g.winControlPending?.side === botSide) return true;
  if (g.winControlPending && g.winControlPending.side !== botSide) return false;
  if (g.duelState) {
    const d = g.duelState;
    if (d.step === "choose_target" && d.initiator === botSide) return true;
    if (d.step === "defender_respond" && d.initiator !== botSide) return true;
    if (d.step === "play") {
      if (!d.pendingAttack && d.currentAttacker === botSide) return true;
      if (d.pendingAttack && d.pendingAttack.side !== botSide) return true;
    }
    return false;
  }
  if (g.battleCardDeclareSide === botSide) return true;
  if ((g.battlePlanPhase || g.starshipBattlePhase) && (botSide === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) {
    if (g.battlePlanPhase) return true;
  }
  const humanSide: Side = botSide === "light" ? "dark" : "light";
  if (g.battleCardDeclareSide === humanSide) return false;
  if (g.battlePlanPhase && (humanSide === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) return false;
  if (g.turnSide === botSide) return true;
  return false;
}

export function getNextAction(g: GameStateData, botSide: Side, config?: BotConfig): GameAction | null {
  const cfg = config ?? DEFAULT_BOT_CONFIG;
  const style: BotStyle = cfg.style ?? g.botStyle ?? "balanced";
  const phase = g.phase;
  const p = botSide === "light" ? g.light : g.dark;
  const oppSide: Side = botSide === "light" ? "dark" : "light";
  const force = state.getForce(g, botSide);
  const loc = state.getCurrentLocationCard(g);
  const locId = loc?.card?.cardId ?? "";
  const myBoard = state.getCharactersAtLocation(g, botSide, false);
  const myCharsUp = state.getCharactersAtLocation(g, botSide, true);
  const oppCharsUp = state.getCharactersAtLocation(g, oppSide, true);
  const myCharCount = charsOnly(myBoard).length;
  const oppCharCount = charsOnly(oppCharsUp).length;
  const hidden = anyFaceDown(g);
  const won = planetAlreadyWon(myCharCount, oppCharCount, hidden);
  const lost = planetAlreadyLost(myCharCount, oppCharCount, hidden);
  const aggressive = style === "aggressive";
  const passive = style === "passive";

  if (g.planetEffectFetch?.chooserSide === botSide && usesPlanetEffectFetch(g)) {
    return { kind: "skip_planet_effect" };
  }

  if (g.deployFromDeckPending?.side === botSide && usesDeployFromDeck(g)) {
    const pending = g.deployFromDeckPending;
    if (pending.foundInstanceId) {
      const cost =
        pending.cost === "free" ? 0 : typeof pending.cost === "number" ? pending.cost : getCost(pending.foundCardId ?? "");
      if (cost <= force) return { kind: "confirm_deploy_from_deck" };
    }
    return { kind: "decline_deploy_from_deck" };
  }

  if (g.effectActivationPending?.side === botSide && g.effectActivationPending.kind === "peek_opp_deck") {
    const peeked = g.effectActivationPending.peekedCardId ?? "";
    const bury = getDestiny(peeked) >= 3 || getCardType(peeked) === "character";
    return { kind: "peek_deck_choice", place: bury ? "bottom" : "top" };
  }

  if (g.effectActivationPending?.side === botSide && g.effectActivationPending.kind === "bottom_hand") {
    const ranked = [...p.hand].sort((a, b) => {
      const aChar = getCardType(a.cardId) === "character" ? 1 : 0;
      const bChar = getCardType(b.cardId) === "character" ? 1 : 0;
      if (aChar !== bChar) return aChar - bChar;
      return getDestiny(a.cardId) - getDestiny(b.cardId);
    });
    if (ranked.length === 0) return { kind: "effect_decline" };
    return { kind: "bottom_hand_card", instanceId: ranked[0].instanceId };
  }

  if (g.deployDrawPending?.side === botSide) {
    const deck = (botSide === "light" ? g.light : g.dark).deck;
    return deck.length > 0 ? { kind: "confirm_deploy_draw" } : { kind: "decline_deploy_draw" };
  }

  if (g.jediTrainingPending?.side === botSide) {
    const affordable = g.jediTrainingPending.choices.filter((c) => c.cost <= force);
    if (affordable.length === 0) return { kind: "decline_jedi_training" };
    affordable.sort((a, b) => {
      const ap = Math.floor(Number((getCard(a.cardId, a.set) as { powerAdd?: number } | undefined)?.powerAdd)) || 0;
      const bp = Math.floor(Number((getCard(b.cardId, b.set) as { powerAdd?: number } | undefined)?.powerAdd)) || 0;
      return bp - ap;
    });
    return { kind: "confirm_jedi_training", instanceId: affordable[0].instanceId };
  }

  if (phase === "deploy" && g.turnSide === botSide && !g.effectActivationPending && !g.jediTrainingPending) {
    const used = g.usedEffectsThisTurn ?? [];
    const oppDeck = (botSide === "light" ? g.dark : g.light).deck;
    const peek = p.inPlay.find((c) => {
      if (c.faceDown || used.includes(c.instanceId)) return false;
      const def = getCard(c.cardId, c.cardSet) as { type?: string; effects?: string } | undefined;
      return def?.type === "effect" && (def.effects ?? "").toLowerCase().includes("peekopp:top");
    });
    if (peek && oppDeck.length > 0) return { kind: "effect_offer", effectInstanceId: peek.instanceId };
    const meditation = p.inPlay.find((c) => {
      if (c.faceDown || used.includes(c.instanceId)) return false;
      const def = getCard(c.cardId, c.cardSet) as { type?: string; effects?: string } | undefined;
      return def?.type === "effect" && (def.effects ?? "").toLowerCase().includes("bottomhand:");
    });
    if (meditation && p.hand.length > 0) return { kind: "effect_offer", effectInstanceId: meditation.instanceId };
    const usedDeploy = g.usedEffectsThisTurn ?? [];
    const discardCandidates = [
      ...p.inPlay.filter((c) => !c.faceDown),
      ...(p.hyperspace ?? []),
    ];
    const discardDeploy = discardCandidates.find((c) => {
      if (usedDeploy.includes(c.instanceId)) return false;
      const bonus = ((getCard(c.cardId, c.cardSet) as { gametextbonus?: string } | undefined)?.gametextbonus ?? "").toLowerCase();
      return bonus.includes("discardsearcher");
    });
    if (discardDeploy) {
      const clause = deployFromDeck.parseDeployFromDeck(discardDeploy.cardId, discardDeploy.cardSet);
      const hasTarget = !!clause && p.deck.some((c) =>
        deployFromDeck.cardMatchesDeployTarget(c.cardId, clause.targetId, c.cardSet, clause.nonUnique)
      );
      if (hasTarget) return { kind: "start_in_play_deploy", instanceId: discardDeploy.instanceId };
    }
  }

  if (g.winControlPending?.side === botSide) {
    const n = g.winControlPending.discardHand;
    const hand = (botSide === "light" ? g.light : g.dark).hand;
    if (hand.length < n) return { kind: "cancel_win_control" };
    return { kind: "confirm_win_control", instanceIds: hand.slice(0, n).map((c) => c.instanceId) };
  }

  if (phase === "deploy" && g.turnSide === botSide && !g.winControlPending) {
    const handSize = (botSide === "light" ? g.light : g.dark).hand.length;
    for (const t of winControl.findWinControlTargets(g, botSide)) {
      const planets = g.controlledPlanets ?? [];
      const cp = planets[t.planetIndex];
      const strandedKey = botSide === "light" ? "strandedLight" : "strandedDark";
      const card = ((cp?.[strandedKey] ?? []) as { instanceId: string; cardId: string }[]).find(
        (c) => c.instanceId === t.instanceId
      );
      const ability = card ? winControl.parseWinControlAbility(card.cardId) : null;
      if (ability && handSize >= ability.discardHand) {
        return { kind: "activate_win_control", instanceId: t.instanceId, planetIndex: t.planetIndex };
      }
    }
  }

  if (g.duelState && usesDueling(g)) {
    const d = g.duelState;
    if (d.step === "choose_target" && d.initiator === botSide) {
      const oppChars = oppCharsUp.filter((c) => getCardType(c.cardId) === "character");
      const weakest = [...oppChars].sort((a, b) => getPower(a.cardId) - getPower(b.cardId))[0];
      if (weakest) return { kind: "choose_duel_target", defenderCharInstanceId: weakest.instanceId };
      return null;
    }
    if (d.step === "defender_respond" && d.initiator !== botSide) {
      return { kind: "duel_defender_ready" };
    }
    if (d.step === "play") {
      const hand = (botSide === "light" ? d.lightDuelHand : d.darkDuelHand) ?? [];
      if (hand.length === 0) return null;
      const hitsOnBot = botSide === "light" ? d.lightHits : d.darkHits;
      const used = d.hitRemovalUsed ?? [];
      const remover = hand.find((c) => {
        if (used.includes(c.instanceId)) return false;
        const def = getCard(c.cardId, c.cardSet) as { grayboxbonus?: string; gametextbonus?: string } | undefined;
        const text = `${def?.gametextbonus ?? ""};${def?.grayboxbonus ?? ""}`.toLowerCase();
        return text.includes("duel:removehit");
      });
      if (hitsOnBot > 0 && remover) return { kind: "duel_remove_hit", instanceId: remover.instanceId };
      const extraHits = (c: { cardId: string; cardSet?: string }) => {
        const def = getCard(c.cardId, c.cardSet) as { grayboxbonus?: string; gametextbonus?: string } | undefined;
        const text = `${def?.gametextbonus ?? ""};${def?.grayboxbonus ?? ""}`.toLowerCase();
        return text.includes("duel:discard:extrahit2");
      };
      if (d.pendingAttack && d.pendingAttack.side !== botSide) {
        const match = hand.find((c) => {
          const def = getCard(c.cardId, c.cardSet) as { destiny?: number } | undefined;
          return typeof def?.destiny === "number" && def.destiny === d.pendingAttack!.destiny;
        });
        const play = match ?? hand[0];
        return { kind: "duel_play_card", instanceId: play.instanceId, discardForExtraHits: !!match && extraHits(play) };
      }
      if (!d.pendingAttack && d.currentAttacker === botSide) {
        const play = hand[0];
        return { kind: "duel_play_card", instanceId: play.instanceId, discardForExtraHits: extraHits(play) };
      }
    }
    return null;
  }

  if (g.starshipBattlePhase && g.battleCardDeclareSide === botSide) {
    return { kind: "declare_battle_cards", battleCardInstanceIds: [] };
  }
  if (g.starshipBattlePhase && g.battlePlanPhase && (botSide === "light" ? !g.lightBattlePlanReady : !g.darkBattlePlanReady)) {
    const ships = hyperspace.getHyperspace(g, botSide);
    const declared = (botSide === "light" ? g.lightDeclaredBattleCards : g.darkDeclaredBattleCards) ?? [];
    return { kind: "battle_plan_ready", instanceIds: [...declared, ...ships.map((c) => c.instanceId)] };
  }

  if (phase === "choose_starting_location") {
    const choices = g.startingLocationChoices ?? [];
    if (choices.length === 0) return null;
    const best = pickBestLocationChoice(g, botSide, choices, cfg);
    return { kind: "choose_starting_location", instanceId: best.instanceId };
  }

  if (phase === "choose_next_planet") {
    if (g.nextPlanetChooserSide !== botSide) return null;
    const choices = g.nextPlanetChoices ?? [];
    if (choices.length === 0) return null;
    const best = pickBestLocationChoice(g, botSide, choices, cfg);
    return { kind: "choose_next_planet", instanceId: best.instanceId };
  }

  if (g.evacuationState?.awaitingInterception && g.evacuationState.evacuatingSide === oppSide) {
    if (usesHyperspace(g)) {
      const stacked = g.evacuationState.stackedCards ?? [];
      const pullingUnique = stacked.some((c) => isUniqueCard(c.cardId) && isCharacter(c.cardId));
      const cheapShip = p.hand.find((c) => getCardType(c.cardId) === "starship");
      if (cheapShip && (pullingUnique || aggressive) && !hyperspace.wouldViolateStarshipUniqueness(g, botSide, cheapShip.cardId, cheapShip.cardSet)) {
        return { kind: "play_card", instanceId: cheapShip.instanceId };
      }
      if (!hyperspace.hasStarshipInHyperspace(g, botSide)) return { kind: "decline_intercept" };
      if (passive && !pullingUnique) return { kind: "decline_intercept" };
      if (!aggressive && !pullingUnique && stacked.length < 3) return { kind: "decline_intercept" };
      return { kind: "intercept_transport" };
    }
    const starfighter = p.hand.find(
      (c) =>
        getCardType(c.cardId) === "starship" &&
        ((getCard(c.cardId) as { trait?: string } | undefined)?.trait ?? "").toLowerCase() === "starfighter"
    );
    if (!starfighter || !state.hasStarfighterInHand(g, botSide)) return { kind: "decline_intercept" };
    const stacked = g.evacuationState.stackedCards ?? [];
    const pullingUnique = stacked.some((c) => isUniqueCard(c.cardId) && isCharacter(c.cardId));
    if (passive && !pullingUnique) return { kind: "decline_intercept" };
    if (!aggressive && !pullingUnique && stacked.length < 3) return { kind: "decline_intercept" };
    return { kind: "intercept_transport", starfighterInstanceId: starfighter.instanceId };
  }

  if (g.evacuationResult) {
    return { kind: "dismiss_evacuation_result" };
  }

  if (phase === "deploy") {
    if (force <= 0 && usesHyperspace(g)) {
      const ship = p.hand.find((c) => getCardType(c.cardId) === "starship" && !hyperspace.wouldViolateStarshipUniqueness(g, botSide, c.cardId, c.cardSet));
      if (ship) return { kind: "play_card", instanceId: ship.instanceId };
    }
    if (force <= 0) return { kind: "pass_phase" };
    if (!g.evacuationState && usesHyperspace(g) && hyperspace.hasTransportInHyperspace(g, botSide)) {
      const myPower = state.totalPowerInPlay(g, botSide);
      const oppPower = state.totalPowerInPlay(g, oppSide);
      const controlledCount = g.controlledPlanets?.length ?? 0;
      const myPlanetsWon = botSide === "light" ? (g.lightPlanetsWon ?? 0) : (g.darkPlanetsWon ?? 0);
      const evacRatio = aggressive ? 2.1 : passive ? 1.45 : 1.8;
      const mayEvacuateCurrent =
        lost ||
        ((controlledCount === 0 || (controlledCount === 1 && myPlanetsWon === 1)) && oppPower > myPower * evacRatio);
      const candidates: { planetIndex: number; priority: number }[] = [];
      for (const planetIndex of state.getEvacuatablePlanets(g, botSide)) {
        if (planetIndex === -1) {
          if (!mayEvacuateCurrent) continue;
          candidates.push({ planetIndex: -1, priority: lost ? 3 : 0 });
          continue;
        }
        const cards = state.getEvacuatableCards(g, botSide, planetIndex);
        const hasUnique = cards.some((c) => isUniqueCard(c.cardId));
        candidates.push({ planetIndex, priority: hasUnique ? 2 : 1 });
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.priority - a.priority);
        return { kind: "evacuate_start", targetPlanetIndex: candidates[0].planetIndex };
      }
    }
    if (!g.evacuationState && !usesHyperspace(g) && state.hasTransportInHand(g, botSide)) {
      const transport = p.hand.find(
        (c) =>
          getCardType(c.cardId) === "starship" &&
          ((getCard(c.cardId) as { trait?: string } | undefined)?.trait ?? "").toLowerCase() === "transport"
      );
      if (transport) {
        const myPower = state.totalPowerInPlay(g, botSide);
        const oppPower = state.totalPowerInPlay(g, oppSide);
        const controlledCount = g.controlledPlanets?.length ?? 0;
        const myPlanetsWon = botSide === "light" ? (g.lightPlanetsWon ?? 0) : (g.darkPlanetsWon ?? 0);
        const evacRatio = aggressive ? 2.1 : passive ? 1.45 : 1.8;
        const mayEvacuateCurrent =
          lost ||
          ((controlledCount === 0 || (controlledCount === 1 && myPlanetsWon === 1)) && oppPower > myPower * evacRatio);

        const candidates: { planetIndex: number; priority: number }[] = [];
        for (const planetIndex of state.getEvacuatablePlanets(g, botSide)) {
          if (planetIndex === -1) {
            if (!mayEvacuateCurrent) continue;
            candidates.push({ planetIndex: -1, priority: lost ? 3 : 0 });
            continue;
          }
          const cards = state.getEvacuatableCards(g, botSide, planetIndex);
          const hasUnique = cards.some((c) => isUniqueCard(c.cardId));
          candidates.push({ planetIndex, priority: hasUnique ? 2 : 1 });
        }
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.priority - a.priority);
          return { kind: "evacuate_start", transportInstanceId: transport.instanceId, targetPlanetIndex: candidates[0].planetIndex };
        }
      }
    }

    if (won && !aggressive) return { kind: "pass_phase" };
    if (won && aggressive && myCharCount >= 2) return { kind: "pass_phase" };

    const playable: { instanceId: string; cardId: string; cost: number; type: string; score: number }[] = [];
    for (const c of p.hand) {
      const type = getCardType(c.cardId);
      if (type === "starship") {
        if (!usesHyperspace(g)) continue;
        if (hyperspace.wouldViolateStarshipUniqueness(g, botSide, c.cardId, c.cardSet)) continue;
        const def = getCard(c.cardId) as { side?: string; trait?: string };
        if (def?.side && def.side !== botSide) continue;
        const trait = (def?.trait ?? "").toLowerCase();
        let score = trait === "transport" ? 2.4 : 2.0;
        if (aggressive) score += 0.2;
        playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost: 0, type, score });
        continue;
      }
      if (type === "battle") continue;

      if (type === "location") {
        if (won || !loc || loc.card.cardId === c.cardId) continue;
        const planet = state.getLocationPlanet(c.cardId);
        const currentPlanet = state.getLocationPlanet(loc.card.cardId);
        if (!planet || planet !== currentPlanet) continue;
        const locCost = getCost(c.cardId);
        if (locCost > force) continue;
        let currentBonus = 0;
        let newBonus = 0;
        for (const ch of myBoard) {
          if (!isCharacter(ch.cardId)) continue;
          currentBonus += state.getLocationBonusForCharacter(ch.cardId, loc.card.cardId);
          newBonus += state.getLocationBonusForCharacter(ch.cardId, c.cardId);
        }
        if (newBonus <= currentBonus) continue;
        playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost: locCost, type, score: 2 + (newBonus - currentBonus) });
        continue;
      }

      if (type !== "character" && type !== "weapon" && type !== "effect") continue;
      const cost =
        type === "character" ? state.getDeployCostWithGametextBonus(g, botSide, c.cardId, c.cardSet) : getCost(c.cardId);
      if (cost > force) continue;
      const def = getCard(c.cardId) as { side?: string };
      if (def?.side && def.side !== botSide) continue;

      if (type === "character") {
        if (state.wouldViolateUniqueness(g, botSide, c.cardId, c.cardSet) || state.wouldViolateUniquenessAtLocation(g, botSide, c.cardId))
          continue;
        if (won && isUniqueCard(c.cardId)) continue;
        let score = 3 + getPower(c.cardId);
        if (locId) score += state.getLocationBonusForCharacter(c.cardId, locId) * 1.2;
        if (myCharCount === 0) score += 8;
        if (lost) score += 6;
        for (const b of p.hand) {
          if (getCardType(b.cardId) === "battle" && canBattleCardBeUsedBy(b.cardId, c.cardId)) score += 1.5;
        }
        for (const w of p.hand) {
          if (getCardType(w.cardId) === "weapon" && canWeaponBeUsedBy(w.cardId, c.cardId)) score += 1.8;
        }
        score -= cost * 0.15;
        if (passive) score += getDestiny(c.cardId) * 0.15;
        playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost, type, score });
        continue;
      }

      if (type === "weapon") {
        if (won) continue;
        if (
          state.wouldViolateUniquenessWeapon(g, botSide, c.cardId, c.cardSet) ||
          state.wouldViolateUniquenessAtLocationWeapon(g, botSide, c.cardId, c.cardSet)
        )
          continue;
        const boardChars = charsOnly(myBoard);
        if (!weaponMatchesAny(c.cardId, boardChars)) continue;
        const add = bestWeaponAdd(c.cardId, c.cardSet, boardChars);
        if (add <= 0) continue;
        let score = 2.5 + add * 1.4;
        if (myCharCount === 0) continue;
        if (passive) score -= 0.4;
        playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost, type, score });
        continue;
      }

      if (type === "effect") {
        if (won || lost || myCharCount === 0) continue;
        if (state.hasEffectAtLocation(g, botSide)) continue;
        let score = 1.8;
        const evenBonus = state.getEffectEvenUpBonus(c.cardId, c.cardSet);
        const deployBonus = state.getEffectYourDeployCounters(c.cardId, c.cardSet);
        score += evenBonus * 1.2 + deployBonus * 0.8;
        if (aggressive) score -= 0.5;
        playable.push({ instanceId: c.instanceId, cardId: c.cardId, cost, type, score });
      }
    }

    if (cfg.useMemoryAdjustment) {
      for (const item of playable) {
        const { rate, samples } = memory.getCardPlayWinRate(item.cardId);
        if (samples >= 3) item.score += Math.max(-1.2, Math.min(1.2, (rate - 0.5) * 2.5));
      }
    }

    playable.sort((a, b) => b.score - a.score);
    const bestPlay = playable[0];
    if (bestPlay && bestPlay.score >= 1.5) return { kind: "play_card", instanceId: bestPlay.instanceId };
    return { kind: "pass_phase" };
  }

  if (phase === "battle") {
    if (g.battleCardDeclareSide === botSide) {
      const battleCards = p.hand.filter((c) => getCardType(c.cardId) === "battle");
      let usable = battleCards.filter((bc) => battleMatchesAny(bc.cardId, myCharsUp));
      if (cfg.useMemoryAdjustment && usable.length > 1) {
        usable = [...usable].sort((a, b) => memory.getBattleCardWinRate(b.cardId).rate - memory.getBattleCardWinRate(a.cardId).rate);
      }
      const myPower = state.totalPowerInPlay(g, botSide);
      const oppPower = state.totalPowerInPlay(g, oppSide);
      const ratio = oppPower > 0 ? myPower / oppPower : 2;
      let maxCards = 2;
      if (ratio >= 1.45) maxCards = aggressive ? 1 : 0;
      else if (ratio >= 1.15) maxCards = aggressive ? 2 : 1;
      else if (ratio >= 0.85) maxCards = aggressive ? 3 : 2;
      else maxCards = passive ? 1 : 2;
      if (usable.length === 0) maxCards = 0;
      const instanceIds = usable.slice(0, Math.min(3, maxCards)).map((c) => c.instanceId);
      return { kind: "declare_battle_cards", battleCardInstanceIds: instanceIds };
    }
    if (g.battlePlanPhase) {
      const myOrder = botSide === "light" ? g.lightBattlePlanOrder : g.darkBattlePlanOrder;
      if (!myOrder || myOrder.length === 0) {
        const inPlay = state.getCharactersAtLocation(g, botSide, true);
        const declared = (botSide === "light" ? g.lightDeclaredBattleCards : g.darkDeclaredBattleCards) ?? [];
        const characters = inPlay.filter((c) => isCharacter(c.cardId));
        const weapons = inPlay.filter((c) => getCardType(c.cardId) === "weapon");
        const botIsAttacker = g.turnSide === botSide;
        const myPower = state.totalPowerInPlay(g, botSide);
        const oppPower = state.totalPowerInPlay(g, oppSide);
        const likelyLosing = !botIsAttacker && (myPower < oppPower || characters.length < oppCharCount);
        const pairs: { weapon: (typeof weapons)[0]; char: (typeof characters)[0]; add: number }[] = [];
        for (const w of weapons) {
          for (const ch of characters) {
            if (!canWeaponBeUsedBy(w.cardId, ch.cardId)) continue;
            pairs.push({ weapon: w, char: ch, add: state.getWeaponPowerAddForCharacter(w.cardId, ch.cardId, w.cardSet) });
          }
        }
        pairs.sort((a, b) => b.add - a.add);
        const assignedWeapon = new Map<string, (typeof weapons)[0]>();
        const usedWeaponIds = new Set<string>();
        for (const { weapon, char } of pairs) {
          if (assignedWeapon.has(char.instanceId) || usedWeaponIds.has(weapon.instanceId)) continue;
          assignedWeapon.set(char.instanceId, weapon);
          usedWeaponIds.add(weapon.instanceId);
        }
        const weaponPowerAdd = (w: (typeof weapons)[0], ch: (typeof characters)[0]) =>
          state.getWeaponPowerAddForCharacter(w.cardId, ch.cardId, w.cardSet);
        const sortedChars = [...characters].sort((a, b) => {
          if (likelyLosing) return getPower(a.cardId) - getPower(b.cardId);
          const addA = assignedWeapon.get(a.instanceId) ? weaponPowerAdd(assignedWeapon.get(a.instanceId)!, a) : 0;
          const addB = assignedWeapon.get(b.instanceId) ? weaponPowerAdd(assignedWeapon.get(b.instanceId)!, b) : 0;
          if (addA !== addB) return addB - addA;
          return getPower(b.cardId) - getPower(a.cardId);
        });
        const order: string[] = [...declared];
        const orderSet = new Set(order);
        for (const ch of sortedChars) {
          const weapon = assignedWeapon.get(ch.instanceId);
          if (weapon && !orderSet.has(weapon.instanceId)) {
            order.push(weapon.instanceId);
            orderSet.add(weapon.instanceId);
          }
          if (!orderSet.has(ch.instanceId)) {
            order.push(ch.instanceId);
            orderSet.add(ch.instanceId);
          }
        }
        for (const c of inPlay) {
          if (!orderSet.has(c.instanceId)) order.push(c.instanceId);
        }
        return { kind: "battle_plan_ready", instanceIds: order };
      }
      return null;
    }
    if (g.battleCardDeclareSide && g.battleCardDeclareSide !== botSide) return null;
    if (g.battlePlanPhase && (botSide === "light" ? g.lightBattlePlanReady : g.darkBattlePlanReady)) return null;
    if (myCharsUp.length > 0 && oppCharsUp.length > 0 && !g.battleCardDeclareSide && !g.battlePlanPhase) {
      if (usesDueling(g) && !g.duelUsedThisTurn && duel.canInitiateDuel(g, botSide) && !passive) {
        const mine = state.getCharactersAtLocation(g, botSide, true);
        const duelist = mine.find((c) => duel.isDuelist(c.cardId, botSide, c.cardSet));
        const saber = mine.find((c) => {
          const id = c.cardId.toLowerCase();
          const name = ((getCard(c.cardId) as { name?: string } | undefined)?.name ?? "").toLowerCase();
          return id.includes("lightsaber") || name.includes("lightsaber");
        });
        if (duelist && saber && (aggressive || oppCharCount <= myCharCount)) {
          return { kind: "initiate_duel", charInstanceId: duelist.instanceId, weaponInstanceId: saber.instanceId };
        }
      }
      const myPower = state.totalPowerInPlay(g, botSide);
      const oppPower = state.totalPowerInPlay(g, oppSide);
      const myC = charsOnly(myCharsUp).length;
      const oppC = oppCharCount;
      const hasMatchingWeapons = myCharsUp.some(
        (ch) => isCharacter(ch.cardId) && p.inPlay.some((c) => getCardType(c.cardId) === "weapon" && canWeaponBeUsedBy(c.cardId, ch.cardId))
      );
      const hasUsableBattleCards = p.hand.some((c) => getCardType(c.cardId) === "battle" && battleMatchesAny(c.cardId, myCharsUp));
      const hasBattleBoost = hasMatchingWeapons || hasUsableBattleCards;
      if (!hasBattleBoost && oppPower > 0 && myPower < oppPower) return { kind: "pass_phase" };
      if (passive && myPower < oppPower * 1.05 && !hasUsableBattleCards) return { kind: "pass_phase" };
      let threshold = hasMatchingWeapons ? cfg.battleThresholdWithWeapons : cfg.battleThresholdNoWeapons;
      if (hasUsableBattleCards) threshold -= 0.03;
      if (hasMatchingWeapons && hasUsableBattleCards) threshold -= 0.04;
      if (myC > oppC) threshold = Math.min(threshold, cfg.battleThresholdMoreCharsCap);
      const powerRatio = oppPower > 0 ? myPower / oppPower : 2.0;
      if (cfg.useMemoryAdjustment && memory.shouldAvoidBattle(powerRatio, hasMatchingWeapons)) {
        return { kind: "pass_phase" };
      }
      const memAdj = cfg.useMemoryAdjustment
        ? memory.getBattleThresholdAdjustment(powerRatio, hasMatchingWeapons, myC, oppC)
        : 0;
      threshold += memAdj;
      if (myPower >= oppPower * threshold) return { kind: "initiate_battle" };
    }
    return { kind: "pass_phase" };
  }

  if (phase === "even_up") {
    if (g.poundedPending?.side === botSide) {
      const targets = g.poundedPending.targets;
      if (targets.length === 0) return { kind: "decline_pounded" };
      const best = [...targets].sort((a, b) => getPower(b.cardId) - getPower(a.cardId))[0];
      return { kind: "confirm_pounded", instanceId: best.instanceId };
    }
    const poundedEffect = p.inPlay.find((c) => {
      if (c.faceDown) return false;
      const def = getCard(c.cardId, c.cardSet) as { type?: string; effects?: string } | undefined;
      return def?.type === "effect" && (def.effects ?? "").toLowerCase().includes("discardopp:nonunique");
    });
    if (poundedEffect) {
      const oppPlay = (botSide === "light" ? g.dark : g.light).inPlay;
      const locId = g.startingLocationInstanceId;
      const hasTarget = oppPlay.some((c) => {
        if (c.instanceId === locId || c.faceDown) return false;
        const def = getCard(c.cardId, c.cardSet) as { uniqueness?: boolean; unique?: boolean; type?: string } | undefined;
        return !!def && def.type !== "location" && (def.uniqueness === false || def.unique === false);
      });
      if (hasTarget) return { kind: "effect_offer", effectInstanceId: poundedEffect.instanceId };
    }
    const handSize = p.hand.length;
    const evenUpTarget = state.getEffectEvenUpTarget(g, botSide);
    const deckSize = p.deck.length;
    const currentPlanet = loc ? state.getLocationPlanet(loc.card.cardId) ?? "" : "";
    const evacuatablePlanets = state.getEvacuatablePlanets(g, botSide);
    const charsInHand = p.hand.filter((c) => isCharacter(c.cardId)).length;
    const keepChars = charsOnly(myBoard);

    if (myCharCount === 0 && charsInHand === 0 && deckSize >= cfg.discardHandMinDeck) {
      return { kind: "discard_hand" };
    }

    const wrongPlanetLoc = p.hand.find((c) => {
      if (getCardType(c.cardId) !== "location") return false;
      return !!currentPlanet && state.getLocationPlanet(c.cardId) !== currentPlanet;
    });
    if (wrongPlanetLoc) {
      return { kind: "discard_location", instanceId: wrongPlanetLoc.instanceId };
    }

    type DiscardScore = { instanceId: string; cardId: string; keep: number; dead: boolean };
    const scored: DiscardScore[] = [];
    let deadCount = 0;
    for (const c of p.hand) {
      const type = getCardType(c.cardId);
      const dest = getDestiny(c.cardId);
      let keep = dest * 0.35;
      let dead = false;
      if (type === "character") {
        keep += 5 + getPower(c.cardId);
        if (myCharCount === 0) keep += 4;
      } else if (type === "weapon") {
        const matchBoard = weaponMatchesAny(c.cardId, keepChars);
        const matchHand = weaponMatchesAny(c.cardId, p.hand.filter((h) => isCharacter(h.cardId)));
        if (matchBoard) keep += 4 + bestWeaponAdd(c.cardId, c.cardSet, keepChars);
        else if (matchHand) keep += 2.5;
        else {
          keep -= 3;
          dead = true;
        }
      } else if (type === "battle") {
        const matchBoard = battleMatchesAny(c.cardId, keepChars);
        const matchHand = battleMatchesAny(c.cardId, p.hand.filter((h) => isCharacter(h.cardId)));
        if (matchBoard) keep += 3.2;
        else if (matchHand) keep += 2;
        else {
          keep -= 2;
          dead = true;
        }
      } else if (type === "location") {
        const planet = state.getLocationPlanet(c.cardId);
        if (planet && planet === currentPlanet) keep += 1.5;
        else {
          keep -= 4;
          dead = true;
        }
      } else if (type === "starship") {
        const trait = ((getCard(c.cardId) as { trait?: string } | undefined)?.trait ?? "").toLowerCase();
        if (trait === "transport" && evacuatablePlanets.length > 0) keep += 3;
        else if (trait === "starfighter") keep += aggressive ? 1.2 : 0.4;
        else {
          keep -= 2;
          dead = true;
        }
      } else if (type === "effect") {
        keep += myCharCount > 0 ? 1.5 : -1;
        if (myCharCount === 0) dead = true;
      }
      if (dead) deadCount++;
      scored.push({ instanceId: c.instanceId, cardId: c.cardId, keep, dead });
    }

    if (handSize > evenUpTarget) {
      const shouldDiscardHand = deadCount >= cfg.discardHandUnplayableThreshold && deckSize >= cfg.discardHandMinDeck;
      if (shouldDiscardHand) {
        if (!cfg.useMemoryAdjustment) return { kind: "discard_hand" };
        const { rate, samples } = memory.getPatternWinRate("even_up_discard_hand");
        if (samples < 5 || rate >= 0.4) return { kind: "discard_hand" };
      }
      scored.sort((a, b) => a.keep - b.keep);
      const discard = scored[0];
      if (discard) return { kind: "discard_from_hand", instanceId: discard.instanceId };
    }
    if (handSize < evenUpTarget) return { kind: "even_up" };
    if (handSize === evenUpTarget) {
      if (myCharCount <= 1 && oppCharCount >= 2) {
        const myP = charsOnly(myCharsUp).reduce((s, c) => s + getPower(c.cardId), 0);
        const oppP = charsOnly(oppCharsUp).reduce((s, c) => s + getPower(c.cardId), 0);
        let surrenderThreshold = cfg.surrenderPowerRatio;
        if (cfg.useMemoryAdjustment) {
          const { rate, samples } = memory.getPatternWinRate("even_up_surrender_planet");
          if (samples >= 5) {
            if (rate < 0.35) return { kind: "even_up" };
            if (rate > 0.6) surrenderThreshold = Math.max(1.2, surrenderThreshold - 0.15);
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
