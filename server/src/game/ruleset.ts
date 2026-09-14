import type { GameStateData } from "./state";

export type Ruleset = "dotf" | "classic";

export function getRuleset(state: GameStateData): Ruleset {
  return state.ruleset === "classic" ? "classic" : "dotf";
}

export function usesHyperspace(state: GameStateData): boolean {
  return getRuleset(state) === "dotf";
}

export function usesDueling(state: GameStateData): boolean {
  return getRuleset(state) === "dotf";
}

export function usesPlanetEffectFetch(state: GameStateData): boolean {
  return getRuleset(state) === "dotf";
}

export function usesDeployFromDeck(state: GameStateData): boolean {
  return getRuleset(state) === "dotf";
}
