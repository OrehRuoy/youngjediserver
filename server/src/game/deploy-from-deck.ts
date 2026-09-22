import type { Side } from "../types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";
import { getCurrentLocationCard, getLocationPlanet, millFromDeck, shuffleDeck, spendForce } from "./state";
import { isStarship, wouldViolateStarshipUniqueness } from "./hyperspace";
import { usesDeployFromDeck } from "./ruleset";

export type DeployFromDeckCost = "normal" | "free" | number;

export interface DeployFromDeckClause {
  targetId: string;
  cost: DeployFromDeckCost;
  planet?: string;
  /** Only a non-unique (diamond) card matches. */
  nonUnique?: boolean;
  /** Confirming the deploy also discards the card that started the search. */
  discardSearcher?: boolean;
}

export interface DeployFromDeckPending {
  side: Side;
  searcherInstanceId: string;
  searcherCardId: string;
  targetId: string;
  cost: DeployFromDeckCost;
  foundInstanceId?: string;
  foundCardId?: string;
  foundSet?: string;
  nonUnique?: boolean;
  discardSearcher?: boolean;
}

function parseCost(raw: string): DeployFromDeckCost {
  const s = raw.trim().toLowerCase().replace(/^cost:/, "");
  if (s === "free") return "free";
  if (s === "normal") return "normal";
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : "normal";
}

export function parseDeployFromDeck(cardId: string, set?: string): DeployFromDeckClause | null {
  const def = getCard(cardId, set);
  if (!def) return null;
  const bonus = (def as { gametextbonus?: string }).gametextbonus ?? "";
  const text = (def as { gametext?: string }).gametext ?? "";
  const source = `${bonus};${text}`;
  const m = source.match(/deployfromdeck\s*,\s*([a-z0-9]+)\s*,\s*(cost:[a-z0-9]+|[a-z0-9]+)((?:\s*,\s*[a-z0-9:]+)*)/i);
  if (!m) return null;
  const flags = (m[3] ?? "").toLowerCase();
  const planet = flags.match(/planet:([a-z0-9]+)/);
  return {
    targetId: m[1].toLowerCase(),
    cost: parseCost(m[2]),
    planet: planet ? planet[1] : undefined,
    nonUnique: flags.includes("nonunique"),
    discardSearcher: flags.includes("discardsearcher"),
  };
}

function normalizedName(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  return ((def as { name?: string } | undefined)?.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cardTypeOf(cardId: string, set?: string): string {
  const def = getCard(cardId, set);
  return ((def as { type?: string } | undefined)?.type ?? "").toLowerCase();
}

/** Starship named Droid Starfighter. Not a Starfighter Droid character. */
function isDroidStarfighterShip(cardId: string, set?: string): boolean {
  if (cardTypeOf(cardId, set) !== "starship") return false;
  const id = cardId.toLowerCase();
  const name = normalizedName(cardId, set);
  return id.includes("droidstarfighter") || name.includes("droidstarfighter");
}

/** Character named Starfighter Droid. Not a Droid Starfighter starship. */
function isStarfighterDroidCharacter(cardId: string, set?: string): boolean {
  if (cardTypeOf(cardId, set) !== "character") return false;
  const id = cardId.toLowerCase();
  const name = normalizedName(cardId, set);
  return id.includes("starfighterdroid") || name.includes("starfighterdroid");
}

function cardHasTrait(def: unknown, trait: string): boolean {
  const raw = ((def as { trait?: string } | undefined)?.trait ?? "").toLowerCase();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(trait.toLowerCase());
}

function isNonUniqueCard(def: unknown): boolean {
  const d = def as { uniqueness?: boolean; unique?: boolean } | undefined;
  return d?.uniqueness === false || d?.unique === false;
}

export function cardMatchesDeployTarget(cardId: string, targetId: string, set: string | undefined, nonUnique?: boolean): boolean {
  return matchesTarget(cardId, targetId, set, nonUnique);
}

function matchesTarget(cardId: string, targetId: string, set: string | undefined, nonUnique?: boolean): boolean {
  const id = cardId.toLowerCase();
  const t = targetId.toLowerCase();
  const def = getCard(cardId, set);
  if (nonUnique && !isNonUniqueCard(def)) return false;
  if (t === "droidstarfighter") return isDroidStarfighterShip(cardId, set);
  if (t === "starfighterdroid") return isStarfighterDroidCharacter(cardId, set);
  if (cardHasTrait(def, t)) return true;
  if (id === t) return true;
  const type = ((def as { type?: string } | undefined)?.type ?? "").toLowerCase();
  if (type !== "character" && type !== "weapon") return false;
  if (id.includes(t)) return true;
  const name = ((def as { name?: string } | undefined)?.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return name.includes(t.replace(/[^a-z0-9]/g, ""));
}

function deployCostOf(cardId: string, set?: string, mode: DeployFromDeckCost = "normal"): number {
  if (mode === "free") return 0;
  if (typeof mode === "number") return Math.max(0, mode);
  const def = getCard(cardId, set);
  return Math.floor(Number((def as { cost?: number } | undefined)?.cost)) || 0;
}

export function maybeBeginDeployFromDeck(
  state: GameStateData,
  side: Side,
  instanceId: string,
  cardId: string,
  cardSet?: string,
  faceDown?: boolean
): boolean {
  if (!usesDeployFromDeck(state) || faceDown) return false;
  const clause = parseDeployFromDeck(cardId, cardSet);
  if (!clause || clause.discardSearcher) return false;
  if (clause.planet) {
    const loc = getCurrentLocationCard(state);
    const planet = loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet).toLowerCase() : "";
    if (planet !== clause.planet) return false;
  }
  const p = side === "light" ? state.light : state.dark;
  const found = p.deck.find((c) => matchesTarget(c.cardId, clause.targetId, c.cardSet, clause.nonUnique));
  state.deployFromDeckPending = {
    side,
    searcherInstanceId: instanceId,
    searcherCardId: cardId,
    targetId: clause.targetId,
    cost: clause.cost,
    foundInstanceId: found?.instanceId,
    foundCardId: found?.cardId,
    foundSet: found?.cardSet,
    nonUnique: clause.nonUnique,
    discardSearcher: clause.discardSearcher,
  };
  return true;
}

/** Click a face-up card during your Deploy step to search (Starfighter Droid discards itself if you deploy). */
export function beginInPlayDeployFromDeck(
  state: GameStateData,
  side: Side,
  instanceId: string
): { ok: boolean; error?: string } {
  if (!usesDeployFromDeck(state) || state.phase !== "deploy") return { ok: false, error: "Can only do this during Deploy" };
  if (state.turnSide !== side) return { ok: false, error: "Not your turn" };
  if (state.deployFromDeckPending) return { ok: false, error: "Already searching your deck" };
  const p = side === "light" ? state.light : state.dark;
  const card =
    p.inPlay.find((c) => c.instanceId === instanceId) ??
    (p.hyperspace ?? []).find((c) => c.instanceId === instanceId);
  if (!card || card.faceDown) return { ok: false, error: "That card must be face up" };
  const clause = parseDeployFromDeck(card.cardId, card.cardSet);
  if (!clause?.discardSearcher) return { ok: false, error: "That card cannot deploy from your deck" };
  if ((state.usedEffectsThisTurn ?? []).includes(instanceId)) return { ok: false, error: "Already used that ability this turn" };
  if (clause.planet) {
    const loc = getCurrentLocationCard(state);
    const planet = loc ? getLocationPlanet(loc.card.cardId, loc.card.cardSet).toLowerCase() : "";
    if (planet !== clause.planet) return { ok: false, error: "Wrong planet" };
  }
  const found = p.deck.find((c) => matchesTarget(c.cardId, clause.targetId, c.cardSet, clause.nonUnique));
  state.deployFromDeckPending = {
    side,
    searcherInstanceId: instanceId,
    searcherCardId: card.cardId,
    targetId: clause.targetId,
    cost: clause.cost,
    foundInstanceId: found?.instanceId,
    foundCardId: found?.cardId,
    foundSet: found?.cardSet,
    nonUnique: clause.nonUnique,
    discardSearcher: true,
  };
  return { ok: true };
}

export function confirmDeployFromDeck(state: GameStateData, side: Side): boolean {
  const pending = state.deployFromDeckPending;
  if (!pending || pending.side !== side || !pending.foundInstanceId) return false;
  const p = side === "light" ? state.light : state.dark;
  const idx = p.deck.findIndex((c) => c.instanceId === pending.foundInstanceId);
  if (idx < 0) return false;
  const ship = isStarship(pending.foundCardId ?? "", pending.foundSet);
  if (ship && wouldViolateStarshipUniqueness(state, side, pending.foundCardId ?? "", pending.foundSet)) return false;
  const cost = deployCostOf(pending.foundCardId ?? "", pending.foundSet, pending.cost);
  if (cost > 0 && !spendForce(state, side, cost)) return false;
  const [card] = p.deck.splice(idx, 1);
  card.faceDown = false;
  if (ship) {
    if (!p.hyperspace) p.hyperspace = [];
    card.zone = "hyperspace";
    card.position = p.hyperspace.length;
    p.hyperspace.push(card);
  } else {
    card.zone = "in_play";
    card.position = p.inPlay.length;
    p.inPlay.push(card);
  }
  if (pending.discardSearcher) {
    const sidx = p.inPlay.findIndex((c) => c.instanceId === pending.searcherInstanceId);
    const hidx = (p.hyperspace ?? []).findIndex((c) => c.instanceId === pending.searcherInstanceId);
    if (sidx >= 0) {
      const [searcher] = p.inPlay.splice(sidx, 1);
      searcher.zone = "discard";
      searcher.faceDown = false;
      p.discard.push(searcher);
    } else if (hidx >= 0 && p.hyperspace) {
      const [searcher] = p.hyperspace.splice(hidx, 1);
      searcher.zone = "discard";
      searcher.faceDown = false;
      p.discard.push(searcher);
    }
    if (!state.usedEffectsThisTurn) state.usedEffectsThisTurn = [];
    if (!state.usedEffectsThisTurn.includes(pending.searcherInstanceId)) state.usedEffectsThisTurn.push(pending.searcherInstanceId);
  }
  shuffleDeck(p.deck);
  state.deployFromDeckPending = undefined;
  return true;
}

export function declineDeployFromDeck(state: GameStateData, side: Side): boolean {
  const pending = state.deployFromDeckPending;
  if (!pending || pending.side !== side) return false;
  if (pending.foundInstanceId) {
    millFromDeck(state, side, 1);
  }
  if (pending.discardSearcher) {
    if (!state.usedEffectsThisTurn) state.usedEffectsThisTurn = [];
    if (!state.usedEffectsThisTurn.includes(pending.searcherInstanceId)) state.usedEffectsThisTurn.push(pending.searcherInstanceId);
  }
  const p = side === "light" ? state.light : state.dark;
  shuffleDeck(p.deck);
  state.deployFromDeckPending = undefined;
  return true;
}
