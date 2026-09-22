/**
 * In-game message handlers: play_card, pass_phase, initiate_battle, concede.
 * First-game rules: deploy in deploy phase, battle in battle phase (power + destiny, life loss).
 */

import type { GameAction } from "../types";
import type { Side } from "../types";
import * as engine from "./engine";
import * as state from "./state";
import { getCard } from "../cards/loader";
import { usesHyperspace, usesPlanetEffectFetch, usesDueling, usesDeployFromDeck } from "./ruleset";
import * as hyperspace from "./hyperspace";
import * as planetEffect from "./planet-effect";
import * as deployFromDeck from "./deploy-from-deck";
import * as deployDraw from "./deploy-draw";
import * as duel from "./duel";
import * as winControl from "./win-control";
import * as jediTraining from "./jedi-training";
import * as pounded from "./pounded";

export interface GameActionResult {
  applied: boolean;
  error?: string;
  gameOver?: { winner: Side; reason?: string };
}

export function handleGameAction(
  gameId: string,
  playerId: string,
  action: GameAction
): GameActionResult {
  const g = engine.getGame(gameId);
  if (!g) return { applied: false, error: "Game not found" };
  const side: Side | undefined =
    g.lightPlayerId === playerId ? "light" : g.darkPlayerId === playerId ? "dark" : undefined;
  if (!side) return { applied: false, error: "Not in this game" };

  if (action.kind === "play_card") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "deploy") return { applied: false, error: "Can only play cards in deploy phase" };
    if (g.planetEffectFetch) return { applied: false, error: "Finish taking or skipping an Effect from deck first" };
    if (g.deployFromDeckPending?.side === side) return { applied: false, error: "Finish your deploy-from-deck search first" };
    if (g.winControlPending?.side === side) return { applied: false, error: "Finish selecting cards for that ability first" };
    if (g.duelState) return { applied: false, error: "Finish the duel first" };
    if (g.starshipBattlePhase) return { applied: false, error: "Cannot play cards during a starship battle" };
    if (g.effectActivationPending?.side === side) {
      return {
        applied: false,
        error: "Finish your effect ability first: discard a card from hand, or click Cancel effect",
      };
    }
    if (g.jediTrainingPending?.side === side) return { applied: false, error: "Finish choosing a lightsaber first" };
    if (g.poundedPending?.side === side) return { applied: false, error: "Finish choosing a card to discard" };
    if (g.deployDrawPending?.side === side) return { applied: false, error: "Choose whether to draw a card" };
    const card = state.findInHand(g, side, instanceId);
    if (!card) return { applied: false, error: "Card not in hand" };
    let def = getCard(card.cardId);
    if (!def) {
      const sideSuffixed = getCard(card.cardId + "_" + side);
      if (sideSuffixed && sideSuffixed.side === side) def = sideSuffixed;
    }
    if (!def) return { applied: false, error: "Unknown card" };
    const cardType = (def as { type?: string }).type;
    const interceptWindow =
      usesHyperspace(g) &&
      !!g.evacuationState?.awaitingInterception &&
      g.evacuationState.evacuatingSide !== side &&
      cardType === "starship";
    if (g.turnSide !== side && !interceptWindow) return { applied: false, error: "Not your turn" };
    if (g.evacuationState && !interceptWindow) return { applied: false, error: "Cannot play cards during an evacuation" };
    if ((def as { type?: string }).type === "location") {
      const currentLoc = state.getCurrentLocationCard(g);
      const newPlanet = state.getLocationPlanet(card.cardId);
      if (
        currentLoc &&
        newPlanet &&
        newPlanet === state.getLocationPlanet(currentLoc.card.cardId) &&
        currentLoc.card.cardId !== card.cardId
      ) {
        const ok = state.replaceLocationWithCard(g, side, instanceId);
        return ok ? { applied: true } : { applied: false, error: "Could not replace location" };
      }
      return { applied: false, error: "Location cards cannot be played during deploy" };
    }
    if (cardType === "starship") {
      if (!usesHyperspace(g)) {
        return { applied: false, error: "Starship cards are played via evacuation or interception" };
      }
      if (def.side !== side) return { applied: false, error: "Wrong side" };
      if (hyperspace.wouldViolateStarshipUniqueness(g, side, card.cardId, card.cardSet)) {
        return { applied: false, error: "This unique starship is already in Hyperspace" };
      }
      const ok = hyperspace.playCardToHyperspace(g, side, instanceId);
      return ok ? { applied: true } : { applied: false, error: "Could not deploy starship to Hyperspace" };
    }
    if (def.side !== side) {
      const sideSuffixed = getCard(card.cardId + "_" + side);
      if (sideSuffixed && sideSuffixed.side === side) def = sideSuffixed;
      else return { applied: false, error: "Wrong side" };
    }
    const cost = cardType === "character"
      ? state.getDeployCostWithGametextBonus(g, side, card.cardId, card.cardSet)
      : cardType === "weapon"
        ? state.getWeaponDeployCost(g, side, card.cardId, card.cardSet)
        : (Math.floor(Number((def as { cost?: number }).cost)) || 0);
    const force = Math.floor(Number(state.getForce(g, side)));
    if (force < cost) return { applied: false, error: "Not enough counters to play this card" };
    if (cardType === "effect") {
      if (!g.startingLocationInstanceId) return { applied: false, error: "No location to deploy effect to" };
      if (state.hasEffectAtLocation(g, side)) return { applied: false, error: "Only 1 effect per player at this location" };
    }
    if (cardType === "character" && state.wouldViolateUniqueness(g, side, card.cardId, card.cardSet)) {
      return {
        applied: false,
        error: "This unique character is already stranded on a planet; you cannot deploy another copy",
      };
    }
    const atLocViolation = cardType === "character" ? state.wouldViolateUniquenessAtLocation(g, side, card.cardId) : null;
    if (atLocViolation) {
      return { applied: false, error: `Only 1 "${atLocViolation.cardTitle}" allowed at this location` };
    }
    if (cardType === "weapon" && state.wouldViolateUniquenessWeapon(g, side, card.cardId, card.cardSet)) {
      return {
        applied: false,
        error: "This unique weapon is already stranded on a planet; you cannot deploy another copy",
      };
    }
    const atLocWeaponViolation = cardType === "weapon" ? state.wouldViolateUniquenessAtLocationWeapon(g, side, card.cardId, card.cardSet) : null;
    if (atLocWeaponViolation) {
      return { applied: false, error: `Only 1 "${atLocWeaponViolation.cardTitle}" allowed at this location` };
    }
    if (!state.spendForce(g, side, cost)) return { applied: false, error: "Not enough counters to play this card" };
    const ok = state.playCardToTable(g, side, instanceId);
    if (!ok) {
      state.addForce(g, side, cost);
      return { applied: false, error: "Could not play card" };
    }
    const played = (side === "light" ? g.light : g.dark).inPlay.find((c) => c.instanceId === instanceId);
    let startedSearch = false;
    if (usesDeployFromDeck(g) && played && !played.faceDown) {
      startedSearch = deployFromDeck.maybeBeginDeployFromDeck(g, side, instanceId, card.cardId, card.cardSet, played.faceDown);
    }
    if (played && !played.faceDown && cardType === "character" && !startedSearch) {
      const drew = deployDraw.maybeBeginDeployDraw(g, side, card.cardId, card.cardSet, played.faceDown);
      if (!drew) jediTraining.maybeBeginJediTraining(g, side, played);
    }
    return { applied: true };
  }

  if (action.kind === "pass_phase") {
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (g.planetEffectFetch) return { applied: false, error: "Finish taking or skipping an Effect from deck first" };
    if (g.deployFromDeckPending?.side === side) return { applied: false, error: "Finish your deploy-from-deck search first" };
    if (g.winControlPending?.side === side) return { applied: false, error: "Finish selecting cards for that ability first" };
    if (g.duelState) return { applied: false, error: "Finish the duel first" };
    if (g.starshipBattlePhase) return { applied: false, error: "Cannot pass during a starship battle" };
    if (g.effectActivationPending?.side === side) {
      return { applied: false, error: "Cancel the effect ability or discard a card for it before passing" };
    }
    if (g.jediTrainingPending?.side === side) return { applied: false, error: "Finish choosing a lightsaber first" };
    if (g.poundedPending?.side === side) return { applied: false, error: "Finish choosing a card to discard" };
    if (g.deployDrawPending?.side === side) return { applied: false, error: "Choose whether to draw a card" };
    if (g.evacuationState) return { applied: false, error: "Cannot pass phase during an evacuation" };
    if (g.evacuationResult) g.evacuationResult = undefined;
    const advResult = engine.advancePhase(gameId, () => {});
    if (advResult?.gameOver) return { applied: true, gameOver: { winner: advResult.winner!, reason: advResult.reason } };
    return { applied: true };
  }

  if (action.kind === "initiate_battle") {
    if (g.phase !== "battle") return { applied: false, error: "Can only battle in battle phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (g.duelState) return { applied: false, error: "Finish the duel first" };
    if (g.battlePlanPhase || g.battleCardDeclareSide) return { applied: false, error: "Battle plan already in progress" };
    const lightChars = state.getCharactersAtLocation(g, "light", true);
    const darkChars = state.getCharactersAtLocation(g, "dark", true);
    if (lightChars.length === 0 || darkChars.length === 0) {
      return { applied: false, error: "Both players need at least one face-up character at the location to battle" };
    }
    const anyFaceDown =
      g.light.inPlay.some((c) => c.faceDown) || g.dark.inPlay.some((c) => c.faceDown);
    if (anyFaceDown) {
      return { applied: false, error: "Cannot battle while either player has face-down cards at the location" };
    }
    g.battleCardDeclareSide = side;
    g.lightDeclaredBattleCards = undefined;
    g.darkDeclaredBattleCards = undefined;
    g.lightBattlePlanOrder = undefined;
    g.darkBattlePlanOrder = undefined;
    g.lightBattlePlanReady = false;
    g.darkBattlePlanReady = false;
    g.phaseStartedAt = Date.now(); // give attacker full time to declare battle cards
    return { applied: true };
  }

  if (action.kind === "declare_battle_cards") {
    const inStarship = !!g.starshipBattlePhase;
    if ((!inStarship && g.phase !== "battle") || !g.battleCardDeclareSide) {
      return { applied: false, error: "Not in battle card declaration phase" };
    }
    if (g.battleCardDeclareSide !== side) {
      return { applied: false, error: "Not your turn to declare battle cards" };
    }
    const cardIds = (action.battleCardInstanceIds as string[] | undefined) ?? [];
    const p = side === "light" ? g.light : g.dark;
    for (const bc of cardIds) {
      const handCard = p.hand.find((c) => c.instanceId === bc);
      if (!handCard) return { applied: false, error: "Battle card not in hand: " + bc };
      const def = getCard(handCard.cardId);
      if (!def || (def as { type?: string }).type !== "battle") {
        return { applied: false, error: "Card is not a battle card: " + bc };
      }
    }
    if (side === "light") {
      g.lightDeclaredBattleCards = [...cardIds];
    } else {
      g.darkDeclaredBattleCards = [...cardIds];
    }
    const defenderSide: Side = side === "light" ? "dark" : "light";
    const defenderAlreadyDeclared = defenderSide === "light"
      ? g.lightDeclaredBattleCards !== undefined
      : g.darkDeclaredBattleCards !== undefined;
    if (defenderAlreadyDeclared) {
      g.battleCardDeclareSide = undefined;
      g.battlePlanPhase = true;
      g.phaseStartedAt = Date.now(); // give both players full time to submit battle plan
    } else {
      g.battleCardDeclareSide = defenderSide;
      g.phaseStartedAt = Date.now(); // give defender full time to declare battle cards
    }
    return { applied: true };
  }

  if (action.kind === "battle_plan_ready") {
    const inStarship = !!g.starshipBattlePhase;
    if ((!inStarship && g.phase !== "battle") || !g.battlePlanPhase) {
      return { applied: false, error: "Not in battle plan phase" };
    }
    const instanceIds = action.instanceIds as string[] | undefined;
    if (!Array.isArray(instanceIds)) return { applied: false, error: "Missing instanceIds" };

    const declaredBattleCards = (side === "light" ? g.lightDeclaredBattleCards : g.darkDeclaredBattleCards) ?? [];
    const inPlayCards = inStarship
      ? hyperspace.getHyperspace(g, side)
      : state.getCharactersAtLocation(g, side, true);
    const inPlayIdSet = new Set(inPlayCards.map((c) => c.instanceId));
    const declaredSet = new Set(declaredBattleCards);

    for (const id of instanceIds) {
      if (!inPlayIdSet.has(id) && !declaredSet.has(id)) {
        return { applied: false, error: "Invalid instance in battle plan: " + id };
      }
    }
    const inPlayInOrder = instanceIds.filter((id) => inPlayIdSet.has(id));
    if (inPlayInOrder.length !== inPlayIdSet.size) {
      return {
        applied: false,
        error: inStarship
          ? "Battle plan must include all of your Hyperspace ships"
          : "Battle plan must include all your face-up characters/weapons at the location",
      };
    }

    if (side === "light") {
      g.lightBattlePlanOrder = [...instanceIds];
      g.lightBattlePlanReady = true;
    } else {
      g.darkBattlePlanOrder = [...instanceIds];
      g.darkBattlePlanReady = true;
    }
    if (g.lightBattlePlanReady && g.darkBattlePlanReady) {
      if (inStarship) {
        hyperspace.resolveStarshipBattle(g);
        const deckWinner = state.getDeckEmptyWinner(g);
        if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
      } else {
        state.resolveBattlePlan(g);
        const advResultBattle = engine.advancePhase(g.id, () => {});
        if (advResultBattle?.gameOver) return { applied: true, gameOver: { winner: advResultBattle.winner!, reason: advResultBattle.reason } };
      }
    }
    return { applied: true };
  }

  if (action.kind === "choose_next_planet") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "choose_next_planet") return { applied: false, error: "Not choosing next planet" };
    if (g.nextPlanetChooserSide !== side) return { applied: false, error: "Only the losing player chooses" };
    const ok = state.applyNextPlanetChoice(g, side, instanceId);
    if (!ok) return { applied: false, error: "Invalid choice" };
    if (usesPlanetEffectFetch(g)) planetEffect.beginPlanetEffectFetch(g, side);
    return { applied: true };
  }

  if (action.kind === "choose_starting_location") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "choose_starting_location") return { applied: false, error: "Not choosing starting location" };
    if (g.turnSide !== side) return { applied: false, error: "Only the first player chooses" };
    const ok = state.applyStartingLocationChoice(g, side, instanceId);
    if (!ok) return { applied: false, error: "Invalid choice" };
    if (usesPlanetEffectFetch(g)) planetEffect.beginPlanetEffectFetch(g, side);
    return { applied: true };
  }

  if (action.kind === "discard_hand") {
    if (g.phase !== "even_up") return { applied: false, error: "Can only discard hand in Even Up phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    const evenUpTarget = state.getEffectEvenUpTarget(g, side);
    state.discardHandAndDraw(g, side, evenUpTarget);
    const deckWinnerDiscard = state.getDeckEmptyWinner(g);
    if (deckWinnerDiscard) return { applied: true, gameOver: { winner: deckWinnerDiscard, reason: "deck_empty" } };
    if (g.surrenderPending === side) {
      g.surrenderPending = undefined;
      const result = state.surrenderPlanet(g, side);
      if (!result) {
        const advFallback = engine.advancePhase(gameId, () => {});
        if (advFallback?.gameOver) return { applied: true, gameOver: { winner: advFallback.winner!, reason: advFallback.reason } };
        return { applied: true };
      }
      if (result.gameOver) return { applied: true, gameOver: { winner: result.winner!, reason: "planet_victory" } };
      state.enterChooseNextPlanet(g, side);
      return { applied: true };
    }
    const advResultDiscard = engine.advancePhase(gameId, () => {});
    if (advResultDiscard?.gameOver) return { applied: true, gameOver: { winner: advResultDiscard.winner!, reason: advResultDiscard.reason } };
    return { applied: true };
  }

  if (action.kind === "discard_from_hand") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "even_up") return { applied: false, error: "Can only discard in Even Up phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    const handSize = (side === "light" ? g.light.hand : g.dark.hand).length;
    const evenUpTarget = state.getEffectEvenUpTarget(g, side);
    if (handSize <= evenUpTarget) return { applied: false, error: `You have ${evenUpTarget} or fewer cards; use Even Up to continue` };
    const ok = state.discardFromHand(g, side, instanceId);
    return ok ? { applied: true } : { applied: false, error: "Card not in hand" };
  }

  if (action.kind === "discard_location") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "even_up") return { applied: false, error: "Can only discard location in Even Up phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    const p = side === "light" ? g.light : g.dark;
    const handCard = p.hand.find((c) => c.instanceId === instanceId);
    if (!handCard) return { applied: false, error: "Card not in hand" };
    const def = getCard(handCard.cardId, handCard.cardSet);
    if (!def || (def as { type?: string }).type !== "location") {
      return { applied: false, error: "Only location cards in your hand can be discarded with Discard Location" };
    }
    const ok = state.discardFromHand(g, side, instanceId);
    return ok ? { applied: true } : { applied: false, error: "Could not discard card" };
  }

  if (action.kind === "even_up") {
    if (g.phase !== "even_up") return { applied: false, error: "Can only Even Up in Even Up phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    const p = side === "light" ? g.light : g.dark;
    const handSize = p.hand.length;
    const evenUpTarget = state.getEffectEvenUpTarget(g, side);
    if (handSize > evenUpTarget) {
      return { applied: false, error: `You must discard down to ${evenUpTarget} cards first` };
    }
    if (handSize < evenUpTarget) {
      state.drawCards(g, side, evenUpTarget - handSize);
    }
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    if (g.surrenderPending === side) {
      g.surrenderPending = undefined;
      const result = state.surrenderPlanet(g, side);
      if (!result) {
        const advFallback = engine.advancePhase(gameId, () => {});
        if (advFallback?.gameOver) return { applied: true, gameOver: { winner: advFallback.winner!, reason: advFallback.reason } };
        return { applied: true };
      }
      if (result.gameOver) return { applied: true, gameOver: { winner: result.winner!, reason: "planet_victory" } };
      state.enterChooseNextPlanet(g, side);
      return { applied: true };
    }
    const advResultEvenUp = engine.advancePhase(gameId, () => {});
    if (advResultEvenUp?.gameOver) return { applied: true, gameOver: { winner: advResultEvenUp.winner!, reason: advResultEvenUp.reason } };
    return { applied: true };
  }

  // --- Evacuation actions ---

  if (action.kind === "evacuate_start") {
    const transportInstanceId = action.transportInstanceId as string | undefined;
    const targetPlanetIndex = action.targetPlanetIndex as number | undefined;
    if (targetPlanetIndex === undefined)
      return { applied: false, error: "Missing targetPlanetIndex" };
    if (g.phase !== "deploy") return { applied: false, error: "Can only evacuate during deploy phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (g.evacuationState) return { applied: false, error: "Evacuation already in progress" };
    if (usesHyperspace(g)) {
      const ok = hyperspace.startHyperspaceEvacuation(g, side, targetPlanetIndex);
      if (!ok) return { applied: false, error: "Need a transport in Hyperspace and characters or weapons to evacuate (all of them)" };
      return { applied: true };
    }
    if (!transportInstanceId) return { applied: false, error: "Missing transportInstanceId" };
    const card = state.findInHand(g, side, transportInstanceId);
    if (!card) return { applied: false, error: "Transport not in hand" };
    const ok = state.startEvacuation(g, side, transportInstanceId, targetPlanetIndex);
    if (!ok) return { applied: false, error: "Cannot evacuate: invalid transport or no cards at target planet" };
    return { applied: true };
  }

  if (action.kind === "intercept_transport") {
    if (!g.evacuationState || !g.evacuationState.awaitingInterception)
      return { applied: false, error: "No evacuation awaiting interception" };
    if (g.evacuationState.evacuatingSide === side)
      return { applied: false, error: "Cannot intercept your own evacuation" };
    if (usesHyperspace(g)) {
      const ok = hyperspace.beginHyperspaceIntercept(g, side);
      if (!ok) return { applied: false, error: "Deploy at least one starship to Hyperspace to intercept" };
      return { applied: true };
    }
    const starfighterInstanceId = action.starfighterInstanceId as string | undefined;
    if (!starfighterInstanceId) return { applied: false, error: "Missing starfighterInstanceId" };
    const result = state.interceptTransport(g, side, starfighterInstanceId);
    if (!result) return { applied: false, error: "Invalid starfighter or interception failed" };
    return { applied: true };
  }

  if (action.kind === "decline_intercept") {
    if (!g.evacuationState || !g.evacuationState.awaitingInterception)
      return { applied: false, error: "No evacuation awaiting interception" };
    if (g.evacuationState.evacuatingSide === side)
      return { applied: false, error: "Cannot decline your own evacuation" };
    const result = usesHyperspace(g) ? hyperspace.declineHyperspaceIntercept(g) : state.declineIntercept(g);
    if (!result) return { applied: false, error: "Failed to decline interception" };
    return { applied: true };
  }

  if (action.kind === "dismiss_evacuation_result") {
    if (g.evacuationResult) {
      g.evacuationResult = undefined;
      if (g.phase === "deploy") {
        g.phaseStartedAt = Date.now();
      }
    }
    return { applied: true };
  }

  if (action.kind === "surrender_planet") {
    if (g.phase !== "even_up") return { applied: false, error: "Can only surrender during Even Up phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (!state.getCurrentLocationCard(g)) return { applied: false, error: "No planet to surrender" };
    g.surrenderPending = side;
    return { applied: true };
  }

  if (action.kind === "cancel_surrender") {
    if (g.surrenderPending !== side) return { applied: false, error: "No surrender pending for you" };
    g.surrenderPending = undefined;
    return { applied: true };
  }

  if (action.kind === "effect_offer") {
    const effectInstanceId = action.effectInstanceId as string | undefined;
    if (!effectInstanceId) return { applied: false, error: "Missing effectInstanceId" };
    if (g.phase === "even_up") {
      const result = pounded.beginPoundedUntoDeath(g, side, effectInstanceId);
      return result.ok ? { applied: true } : { applied: false, error: result.error };
    }
    const result = state.startEffectActivation(g, side, effectInstanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "effect_decline") {
    if (!g.effectActivationPending || g.effectActivationPending.side !== side) return { applied: false, error: "No effect activation to decline" };
    if (g.effectActivationPending.kind === "peek_opp_deck") return { applied: false, error: "Choose to leave that card on top or put it under the deck" };
    state.clearEffectActivation(g);
    return { applied: true };
  }

  if (action.kind === "peek_deck_choice") {
    const place = action.place === "bottom" ? "bottom" : action.place === "top" ? "top" : undefined;
    if (!place) return { applied: false, error: "Choose top or bottom" };
    const result = state.resolveOppDeckPeek(g, side, place);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "bottom_hand_card") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const result = state.placeHandCardUnderDeck(g, side, instanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "confirm_jedi_training") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const result = jediTraining.confirmJediTraining(g, side, instanceId);
    if (!result.ok) return { applied: false, error: result.error };
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "decline_jedi_training") {
    const ok = jediTraining.declineJediTraining(g, side);
    return ok ? { applied: true } : { applied: false, error: "No lightsaber choice to skip" };
  }

  if (action.kind === "confirm_pounded") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const result = pounded.confirmPoundedUntoDeath(g, side, instanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "decline_pounded") {
    const ok = pounded.declinePoundedUntoDeath(g, side);
    return ok ? { applied: true } : { applied: false, error: "No card choice to cancel" };
  }

  if (action.kind === "effect_discard_for_ability") {
    const cardInstanceId = action.cardInstanceId as string | undefined;
    if (!cardInstanceId) return { applied: false, error: "Missing cardInstanceId" };
    const result = state.applyEffectDiscardAndAddCounters(g, side, cardInstanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "fetch_planet_effect") {
    if (!usesPlanetEffectFetch(g)) return { applied: false, error: "Planet Effect fetch is not used in this game" };
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const ok = planetEffect.fetchPlanetEffect(g, side, instanceId);
    return ok ? { applied: true } : { applied: false, error: "Could not take that Effect" };
  }

  if (action.kind === "skip_planet_effect") {
    if (!usesPlanetEffectFetch(g)) return { applied: false, error: "Planet Effect fetch is not used in this game" };
    const ok = planetEffect.skipPlanetEffect(g, side);
    return ok ? { applied: true } : { applied: false, error: "Not your turn to skip" };
  }

  if (action.kind === "start_in_play_deploy") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const result = deployFromDeck.beginInPlayDeployFromDeck(g, side, instanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "confirm_deploy_draw") {
    const result = deployDraw.confirmDeployDraw(g, side);
    if (!result.ok) return { applied: false, error: "No draw to confirm" };
    if (result.gameOverWinner) return { applied: true, gameOver: { winner: result.gameOverWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "decline_deploy_draw") {
    const ok = deployDraw.declineDeployDraw(g, side);
    return ok ? { applied: true } : { applied: false, error: "No draw to skip" };
  }

  if (action.kind === "confirm_deploy_from_deck") {
    if (!usesDeployFromDeck(g)) return { applied: false, error: "Deploy from deck is not used in this game" };
    const searcherId = g.deployFromDeckPending?.searcherInstanceId;
    const ok = deployFromDeck.confirmDeployFromDeck(g, side);
    if (!ok) return { applied: false, error: "Could not deploy the searched card (check Force cost)" };
    const searcher = searcherId ? (side === "light" ? g.light : g.dark).inPlay.find((c) => c.instanceId === searcherId) : undefined;
    jediTraining.maybeBeginJediTraining(g, side, searcher);
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "decline_deploy_from_deck") {
    if (!usesDeployFromDeck(g)) return { applied: false, error: "Deploy from deck is not used in this game" };
    const searcherId = g.deployFromDeckPending?.searcherInstanceId;
    const ok = deployFromDeck.declineDeployFromDeck(g, side);
    if (!ok) return { applied: false, error: "No deploy-from-deck search to decline" };
    const searcher = searcherId ? (side === "light" ? g.light : g.dark).inPlay.find((c) => c.instanceId === searcherId) : undefined;
    jediTraining.maybeBeginJediTraining(g, side, searcher);
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "activate_win_control") {
    const instanceId = action.instanceId as string | undefined;
    const planetIndex = Number(action.planetIndex);
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (!Number.isFinite(planetIndex)) return { applied: false, error: "Missing planetIndex" };
    const result = winControl.beginWinControl(g, side, instanceId, Math.trunc(planetIndex));
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "cancel_win_control") {
    const ok = winControl.cancelWinControl(g, side);
    return ok ? { applied: true } : { applied: false, error: "No won-planet ability to cancel" };
  }

  if (action.kind === "confirm_win_control") {
    const raw = action.instanceIds;
    const instanceIds = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
    const result = winControl.confirmWinControl(g, side, instanceIds);
    if (!result.ok) return { applied: false, error: result.error };
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "initiate_duel") {
    if (!usesDueling(g)) return { applied: false, error: "Dueling is not used in this game" };
    const charInstanceId = action.charInstanceId as string | undefined;
    const weaponInstanceId = action.weaponInstanceId as string | undefined;
    if (!charInstanceId || !weaponInstanceId) return { applied: false, error: "Missing duelist or lightsaber" };
    const ok = duel.initiateDuel(g, side, charInstanceId, weaponInstanceId);
    return ok ? { applied: true } : { applied: false, error: "Cannot start a duel with those cards" };
  }

  if (action.kind === "choose_duel_target") {
    const defenderCharInstanceId = action.defenderCharInstanceId as string | undefined;
    if (!defenderCharInstanceId) return { applied: false, error: "Missing defender" };
    const ok = duel.chooseDuelTarget(g, side, defenderCharInstanceId);
    return ok ? { applied: true } : { applied: false, error: "Invalid duel target" };
  }

  if (action.kind === "duel_defender_ready") {
    const ok = duel.defenderReadyDuel(g, side, {
      swapCharInstanceId: action.swapCharInstanceId as string | undefined,
      weaponInstanceId: action.weaponInstanceId as string | undefined,
    });
    return ok ? { applied: true } : { applied: false, error: "Cannot accept the duel that way" };
  }

  if (action.kind === "duel_play_card") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const ok = duel.playDuelCard(g, side, instanceId, {
      discardForExtraHits: action.discardForExtraHits === true,
    });
    if (!ok) return { applied: false, error: "Cannot play that duel card" };
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "duel_discard_draw") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const ok = duel.discardDuelCardForDraw(g, side, instanceId);
    if (!ok) return { applied: false, error: "Cannot discard that card to draw" };
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  if (action.kind === "duel_remove_hit") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    const ok = duel.removeDuelHit(g, side, instanceId);
    return ok ? { applied: true } : { applied: false, error: "Cannot remove a hit with that card" };
  }

  if (action.kind === "confirm_destiny_swap") {
    const yourKey = action.yourKey as string | undefined;
    const oppKey = action.oppKey as string | undefined;
    if (!yourKey || !oppKey) return { applied: false, error: "Pick one of your destiny numbers and one of theirs" };
    const ok = state.confirmDestinySwap(g, side, yourKey, oppKey);
    if (!ok) return { applied: false, error: "Those destiny numbers cannot be switched" };
    const deckWinner = state.getDeckEmptyWinner(g);
    if (deckWinner) return { applied: true, gameOver: { winner: deckWinner, reason: "deck_empty" } };
    return { applied: true };
  }

  return { applied: false, error: "Unknown action" };
}

export function handleGameConcede(gameId: string, playerId: string): { winner: Side } | null {
  const g = engine.getGame(gameId);
  if (!g) return null;
  const winner: Side | undefined =
    g.lightPlayerId === playerId ? "dark" : g.darkPlayerId === playerId ? "light" : undefined;
  if (!winner) return null;
  return { winner };
}
