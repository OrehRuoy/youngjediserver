/**
 * Aurra Sing, Formidable Adversary: +2 vs Jedi, optional draw after a defeat.
 * Run: npx ts-node --transpile-only src/aurra-formidable.test.ts
 */
import { initCards } from "./cards/loader";
import type { CardInstance } from "./cards/types";
import * as engine from "./game/engine";
import * as handlers from "./game/handlers";
import * as state from "./game/state";
import type { GameStateData } from "./game/state";
import type { Side } from "./types";

initCards();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed++;
    return;
  }
  failed++;
  failures.push(detail ? `${name} — ${detail}` : name);
}

type Entry = { id: string; set?: string; count: number };

let gameN = 0;
function makeGame(light: Entry[], dark: Entry[]): GameStateData {
  gameN++;
  const g = engine.startGame(
    "aurra_" + gameN,
    "table_" + gameN,
    "L",
    "D",
    "Light",
    "Dark",
    60_000,
    undefined,
    undefined,
    light,
    dark
  );
  g.phase = "deploy";
  g.turnSide = "light";
  g.ruleset = "dotf";
  state.setForce(g, "light", 30);
  state.setForce(g, "dark", 30);
  return g;
}

function pile(g: GameStateData, side: Side) {
  return side === "light" ? g.light : g.dark;
}

function pull(g: GameStateData, side: Side, cardId: string): CardInstance {
  const p = pile(g, side);
  const idx = p.deck.findIndex((c) => c.cardId === cardId);
  if (idx < 0) throw new Error(`missing ${cardId} on ${side}`);
  return p.deck.splice(idx, 1)[0];
}

function toPlay(g: GameStateData, side: Side, card: CardInstance): CardInstance {
  card.zone = "in_play";
  card.faceDown = false;
  pile(g, side).inPlay.push(card);
  return card;
}

function setLocation(g: GameStateData, cardId: string): void {
  const card = pull(g, "light", cardId);
  toPlay(g, "light", card);
  g.startingLocationInstanceId = card.instanceId;
}

function fight(g: GameStateData, lightIds: string[], darkIds: string[]) {
  g.phase = "battle";
  g.turnSide = "light";
  g.battlePlanPhase = true;
  g.lightBattlePlanReady = true;
  g.darkBattlePlanReady = true;
  g.lightBattlePlanOrder = lightIds;
  g.darkBattlePlanOrder = darkIds;
  state.resolveBattlePlan(g);
  return g.battleRevealSequence ?? [];
}

const lightDeck = [
  { id: "tatooinemosespa", count: 1 },
  { id: "tatooinedesertlandingsite", count: 1 },
  { id: "tatooinepodracearena", count: 1 },
  { id: "waldboonta", set: "reflections", count: 1 },
  { id: "yodaboonta", set: "reflections", count: 1 },
];
const darkDeck = [{ id: "aurrasingboonta", set: "reflections", count: 4 }];

check("Mos Espa bonus is 0", state.getLocationBonusForCharacter("aurrasingboonta", "tatooinemosespa") === 0);
check("Desert Landing Site bonus is 2", state.getLocationBonusForCharacter("aurrasingboonta", "tatooinedesertlandingsite") === 2);
check("Podrace Arena bonus is 0", state.getLocationBonusForCharacter("aurrasingboonta", "tatooinepodracearena") === 0);
check(
  "Armed Aurra has no extra Jedi power",
  state.getGametextBonusForCharacter("aurrasingarmed", "reflections", undefined, "yodaboonta").bonus === 0
);
check(
  "Formidable Aurra is +2 against a Jedi",
  state.getGametextBonusForCharacter("aurrasingboonta", "reflections", undefined, "yodaboonta").bonus === 2
);
check(
  "Formidable Aurra is +0 against Wald",
  state.getGametextBonusForCharacter("aurrasingboonta", "reflections", undefined, "waldboonta").bonus === 0
);

{
  const g = makeGame(lightDeck, darkDeck);
  setLocation(g, "tatooinemosespa");
  const wald = toPlay(g, "light", pull(g, "light", "waldboonta"));
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingboonta"));
  const before = g.dark.deck.length;
  const steps = fight(g, [wald.instanceId], [aurra.instanceId]);
  check("She defeats Wald", steps[0]?.winner === "dark", `winner ${steps[0]?.winner}`);
  check("No Jedi bonus against Wald", steps[0]?.darkPower === 5, `power ${steps[0]?.darkPower}`);
  check("A draw is offered", g.deployDrawPending?.side === "dark" && g.deployDrawPending.count === 1, JSON.stringify(g.deployDrawPending));
  const declined = handlers.handleGameAction(g.id, "D", { kind: "decline_deploy_draw" });
  check("Skipping the draw is allowed", declined.applied === true && !g.deployDrawPending);
  check("Skipping does not draw", g.dark.deck.length === before && g.dark.hand.length === 0, `deck ${g.dark.deck.length} hand ${g.dark.hand.length}`);
}

{
  const g = makeGame(lightDeck, darkDeck);
  setLocation(g, "tatooinemosespa");
  const wald = toPlay(g, "light", pull(g, "light", "waldboonta"));
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingboonta"));
  const before = g.dark.deck.length;
  fight(g, [wald.instanceId], [aurra.instanceId]);
  const confirmed = handlers.handleGameAction(g.id, "D", { kind: "confirm_deploy_draw" });
  check("Confirming the draw works", confirmed.applied === true && !g.deployDrawPending);
  check("She draws one card", g.dark.hand.length === 1 && g.dark.deck.length === before - 1, `deck ${g.dark.deck.length} hand ${g.dark.hand.length}`);
}

{
  const g = makeGame(lightDeck, darkDeck);
  setLocation(g, "tatooinedesertlandingsite");
  const yoda = toPlay(g, "light", pull(g, "light", "yodaboonta"));
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingboonta"));
  const steps = fight(g, [yoda.instanceId], [aurra.instanceId]);
  check("Desert bonus and Jedi bonus are both added", steps[0]?.darkPower === 9, `power ${steps[0]?.darkPower}`);
  check("The Jedi bonus is labeled", steps[0]?.darkGametextBonusLabel === "vs Jedi +2", steps[0]?.darkGametextBonusLabel);
  check("Defeating Yoda also offers a draw", g.deployDrawPending?.count === 1);
}

{
  const g = makeGame(lightDeck, darkDeck);
  setLocation(g, "tatooinemosespa");
  const wald = toPlay(g, "light", pull(g, "light", "waldboonta"));
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingboonta"));
  aurra.faceDown = true;
  fight(g, [wald.instanceId], [aurra.instanceId]);
  check("A face-down Aurra does not offer the draw", !g.deployDrawPending);
}

console.log(`${passed} passed, ${failed} failed`);
for (const f of failures) console.log("FAIL " + f);
if (failed > 0) process.exit(1);
