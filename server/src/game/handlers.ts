/**
 * In-game message handlers: play_card, pass_phase, initiate_battle, concede.
 * First-game rules: deploy in deploy phase, battle in battle phase (power + destiny, life loss).
 */

import type { GameAction } from "../types";
import type { GameStateData } from "./state";
import type { Side } from "../types";
import * as engine from "./engine";
import * as state from "./state";
import { getCard } from "../cards/loader";

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
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (g.evacuationState) return { applied: false, error: "Cannot play cards during an evacuation" };
    if (g.effectActivationPending?.side === side) {
      return {
        applied: false,
        error: "Finish your effect ability first: discard a card from hand, or click Cancel effect",
      };
    }
    const card = state.findInHand(g, side, instanceId);
    if (!card) return { applied: false, error: "Card not in hand" };
    let def = getCard(card.cardId);
    if (!def) {
      const sideSuffixed = getCard(card.cardId + "_" + side);
      if (sideSuffixed && sideSuffixed.side === side) def = sideSuffixed;
    }
    if (!def) return { applied: false, error: "Unknown card" };
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
    if ((def as { type?: string }).type === "starship") {
      return { applied: false, error: "Starship cards are played via evacuation or interception" };
    }
    if (def.side !== side) {
      const sideSuffixed = getCard(card.cardId + "_" + side);
      if (sideSuffixed && sideSuffixed.side === side) def = sideSuffixed;
      else return { applied: false, error: "Wrong side" };
    }
    const cardType = (def as { type?: string }).type;
    const cost = cardType === "character"
      ? state.getDeployCostWithGametextBonus(g, side, card.cardId, card.cardSet)
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
    const atLocWeaponViolation = cardType === "weapon" ? state.wouldViolateUniquenessAtLocationWeapon(g, side, card.cardId) : null;
    if (atLocWeaponViolation) {
      return { applied: false, error: `Only 1 "${atLocWeaponViolation.cardTitle}" allowed at this location` };
    }
    if (!state.spendForce(g, side, cost)) return { applied: false, error: "Not enough counters to play this card" };
    const ok = state.playCardToTable(g, side, instanceId);
    if (!ok) {
      state.addForce(g, side, cost);
      return { applied: false, error: "Could not play card" };
    }
    return { applied: true };
  }

  if (action.kind === "pass_phase") {
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (g.effectActivationPending?.side === side) {
      return { applied: false, error: "Cancel the effect ability or discard a card for it before passing" };
    }
    if (g.evacuationState) return { applied: false, error: "Cannot pass phase during an evacuation" };
    if (g.evacuationResult) g.evacuationResult = undefined;
    const advResult = engine.advancePhase(gameId, () => {});
    if (advResult?.gameOver) return { applied: true, gameOver: { winner: advResult.winner!, reason: advResult.reason } };
    return { applied: true };
  }

  if (action.kind === "initiate_battle") {
    if (g.phase !== "battle") return { applied: false, error: "Can only battle in battle phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
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
    if (g.phase !== "battle" || !g.battleCardDeclareSide) {
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
    if (g.phase !== "battle" || !g.battlePlanPhase) {
      return { applied: false, error: "Not in battle plan phase" };
    }
    const instanceIds = action.instanceIds as string[] | undefined;
    if (!Array.isArray(instanceIds)) return { applied: false, error: "Missing instanceIds" };

    const declaredBattleCards = (side === "light" ? g.lightDeclaredBattleCards : g.darkDeclaredBattleCards) ?? [];
    const inPlayCards = state.getCharactersAtLocation(g, side, true);
    const inPlayIdSet = new Set(inPlayCards.map((c) => c.instanceId));
    const declaredSet = new Set(declaredBattleCards);

    for (const id of instanceIds) {
      if (!inPlayIdSet.has(id) && !declaredSet.has(id)) {
        return { applied: false, error: "Invalid instance in battle plan: " + id };
      }
    }
    const inPlayInOrder = instanceIds.filter((id) => inPlayIdSet.has(id));
    if (inPlayInOrder.length !== inPlayIdSet.size) {
      return { applied: false, error: "Battle plan must include all your face-up characters/weapons at the location" };
    }

    if (side === "light") {
      g.lightBattlePlanOrder = [...instanceIds];
      g.lightBattlePlanReady = true;
    } else {
      g.darkBattlePlanOrder = [...instanceIds];
      g.darkBattlePlanReady = true;
    }
    if (g.lightBattlePlanReady && g.darkBattlePlanReady) {
      state.resolveBattlePlan(g);
      const advResultBattle = engine.advancePhase(g.id, () => {});
      if (advResultBattle?.gameOver) return { applied: true, gameOver: { winner: advResultBattle.winner!, reason: advResultBattle.reason } };
    }
    return { applied: true };
  }

  if (action.kind === "choose_next_planet") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "choose_next_planet") return { applied: false, error: "Not choosing next planet" };
    if (g.nextPlanetChooserSide !== side) return { applied: false, error: "Only the losing player chooses" };
    const ok = state.applyNextPlanetChoice(g, side, instanceId);
    return ok ? { applied: true } : { applied: false, error: "Invalid choice" };
  }

  if (action.kind === "choose_starting_location") {
    const instanceId = action.instanceId as string | undefined;
    if (!instanceId) return { applied: false, error: "Missing instanceId" };
    if (g.phase !== "choose_starting_location") return { applied: false, error: "Not choosing starting location" };
    if (g.turnSide !== side) return { applied: false, error: "Only the first player chooses" };
    const ok = state.applyStartingLocationChoice(g, side, instanceId);
    return ok ? { applied: true } : { applied: false, error: "Invalid choice" };
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
    const def = getCard(handCard.cardId);
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
    if (!transportInstanceId || targetPlanetIndex === undefined)
      return { applied: false, error: "Missing transportInstanceId or targetPlanetIndex" };
    if (g.phase !== "deploy") return { applied: false, error: "Can only evacuate during deploy phase" };
    if (g.turnSide !== side) return { applied: false, error: "Not your turn" };
    if (g.evacuationState) return { applied: false, error: "Evacuation already in progress" };
    const card = state.findInHand(g, side, transportInstanceId);
    if (!card) return { applied: false, error: "Transport not in hand" };
    const ok = state.startEvacuation(g, side, transportInstanceId, targetPlanetIndex);
    if (!ok) return { applied: false, error: "Cannot evacuate: invalid transport or no cards at target planet" };
    return { applied: true };
  }

  if (action.kind === "intercept_transport") {
    const starfighterInstanceId = action.starfighterInstanceId as string | undefined;
    if (!starfighterInstanceId) return { applied: false, error: "Missing starfighterInstanceId" };
    if (!g.evacuationState || !g.evacuationState.awaitingInterception)
      return { applied: false, error: "No evacuation awaiting interception" };
    if (g.evacuationState.evacuatingSide === side)
      return { applied: false, error: "Cannot intercept your own evacuation" };
    const result = state.interceptTransport(g, side, starfighterInstanceId);
    if (!result) return { applied: false, error: "Invalid starfighter or interception failed" };
    return { applied: true };
  }

  if (action.kind === "decline_intercept") {
    if (!g.evacuationState || !g.evacuationState.awaitingInterception)
      return { applied: false, error: "No evacuation awaiting interception" };
    if (g.evacuationState.evacuatingSide === side)
      return { applied: false, error: "Cannot decline your own evacuation" };
    const result = state.declineIntercept(g);
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
    const result = state.startEffectActivation(g, side, effectInstanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
  }

  if (action.kind === "effect_decline") {
    if (!g.effectActivationPending || g.effectActivationPending.side !== side) return { applied: false, error: "No effect activation to decline" };
    state.clearEffectActivation(g);
    return { applied: true };
  }

  if (action.kind === "effect_discard_for_ability") {
    const cardInstanceId = action.cardInstanceId as string | undefined;
    if (!cardInstanceId) return { applied: false, error: "Missing cardInstanceId" };
    const result = state.applyEffectDiscardAndAddCounters(g, side, cardInstanceId);
    return result.ok ? { applied: true } : { applied: false, error: result.error };
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
