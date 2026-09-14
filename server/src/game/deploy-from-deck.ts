import type { Side } from "../types";
import { getCard } from "../cards/loader";
import type { GameStateData } from "./state";
import { millFromDeck, shuffleDeck, spendForce } from "./state";
import { usesDeployFromDeck } from "./ruleset";

export type DeployFromDeckCost = "normal" | "free" | number;

export interface DeployFromDeckClause {
  targetId: string;
  cost: DeployFromDeckCost;
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
  const m = source.match(/deployfromdeck\s*,\s*([a-z0-9]+)\s*,\s*(cost:[a-z0-9]+|[a-z0-9]+)/i);
  if (!m) return null;
  return { targetId: m[1].toLowerCase(), cost: parseCost(m[2]) };
}

function matchesTarget(cardId: string, targetId: string, set?: string): boolean {
  const id = cardId.toLowerCase();
  const t = targetId.toLowerCase();
  if (id === t || id.includes(t)) return true;
  const def = getCard(cardId, set);
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
  if (!clause) return false;
  const p = side === "light" ? state.light : state.dark;
  const found = p.deck.find((c) => matchesTarget(c.cardId, clause.targetId, c.cardSet));
  state.deployFromDeckPending = {
    side,
    searcherInstanceId: instanceId,
    searcherCardId: cardId,
    targetId: clause.targetId,
    cost: clause.cost,
    foundInstanceId: found?.instanceId,
    foundCardId: found?.cardId,
    foundSet: found?.cardSet,
  };
  return true;
}

export function confirmDeployFromDeck(state: GameStateData, side: Side): boolean {
  const pending = state.deployFromDeckPending;
  if (!pending || pending.side !== side || !pending.foundInstanceId) return false;
  const p = side === "light" ? state.light : state.dark;
  const idx = p.deck.findIndex((c) => c.instanceId === pending.foundInstanceId);
  if (idx < 0) return false;
  const cost = deployCostOf(pending.foundCardId ?? "", pending.foundSet, pending.cost);
  if (cost > 0 && !spendForce(state, side, cost)) return false;
  const [card] = p.deck.splice(idx, 1);
  card.zone = "in_play";
  card.faceDown = false;
  card.position = p.inPlay.length;
  p.inPlay.push(card);
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
  const p = side === "light" ? state.light : state.dark;
  shuffleDeck(p.deck);
  state.deployFromDeckPending = undefined;
  return true;
}
