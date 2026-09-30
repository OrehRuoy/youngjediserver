/**
 * Plays every filled-in Reflections light card through the game engine.
 * Run: npm run test:reflections-light
 */
import * as fs from "fs";
import * as path from "path";
import { initCards, getCard, customDeckCopyError, deckTitleKey } from "./cards/loader";
import type { CardInstance } from "./cards/types";
import * as engine from "./game/engine";
import * as handlers from "./game/handlers";
import * as state from "./game/state";
import type { GameStateData } from "./game/state";
import * as deployFromDeck from "./game/deploy-from-deck";
import * as duel from "./game/duel";
import * as jediTraining from "./game/jedi-training";
import * as pounded from "./game/pounded";
import * as winControl from "./game/win-control";
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
function makeGame(light: Entry[], dark: Entry[], lightPlayerId = "L"): GameStateData {
  gameN++;
  const g = engine.startGame(
    "ref_light_" + gameN,
    "table_" + gameN,
    lightPlayerId,
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

function toHand(g: GameStateData, side: Side, card: CardInstance): CardInstance {
  card.zone = "hand";
  card.faceDown = false;
  pile(g, side).hand.push(card);
  return card;
}

function toPlay(g: GameStateData, side: Side, card: CardInstance): CardInstance {
  card.zone = "in_play";
  card.faceDown = false;
  pile(g, side).inPlay.push(card);
  return card;
}

function stackTop(g: GameStateData, side: Side, cardId: string): void {
  const card = pull(g, side, cardId);
  card.zone = "deck";
  pile(g, side).deck.push(card);
}

function setLocation(g: GameStateData, cardId: string, set?: string): void {
  const card = pull(g, "light", cardId);
  toPlay(g, "light", card);
  if (set) card.cardSet = set;
  g.startingLocationInstanceId = card.instanceId;
}

function playCard(g: GameStateData, instanceId: string, playerId = "L") {
  return handlers.handleGameAction(g.id, playerId, { kind: "play_card", instanceId });
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

const R = "reflections";
const lightJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/cards/reflections.json"), "utf8")) as {
  cards: Record<string, unknown>[];
};
const clientJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../client/data/cards/reflections.json"), "utf8")
) as { cards: Record<string, unknown>[] };
const lightCards = lightJson.cards.filter((c) => c.side === "light");
const clientById = new Map(clientJson.cards.map((c) => [String(c.id), c]));

for (const card of lightCards) {
  const id = String(card.id);
  const client = clientById.get(id);
  check(`${id} matches the client copy`, !!client && JSON.stringify(client) === JSON.stringify(card));
  check(`${id} image is a png`, String(card.image ?? "").endsWith(".png"), String(card.image));
  check(`${id} set is reflections`, card.set === R);
  const loaded = getCard(id, R) as Record<string, unknown> | undefined;
  check(`${id} loads from reflections`, !!loaded && loaded.name === card.name);
  if (card.type === "character") {
    const locs = [card.bonus1loc, card.bonus2loc, card.bonus3loc] as string[];
    const bonuses = [card.bonus1, card.bonus2, card.bonus3] as number[];
    locs.forEach((loc, i) => {
      if (!loc) return;
      const got = state.getLocationBonusForCharacter(id, loc);
      check(
        `${id} location ${loc} is +${bonuses[i]}`,
        got === bonuses[i],
        `engine returned ${got}`
      );
    });
  }
}

check(
  "reprint deck limit counts the same printed name",
  customDeckCopyError([
    { id: "p08obiwankenobi", set: "enhancedbattleofnaboo", count: 3 },
    { id: "p08obiwankenobi", set: R, count: 3 },
  ]) !== null &&
    deckTitleKey("Obi-Wan Kenobi, Jedi Avenger") === deckTitleKey("Obi-Wan Kenobi Jedi Avenger")
);
check(
  "five copies of one printing are allowed",
  customDeckCopyError([{ id: "waldboonta", set: R, count: 5 }]) === null
);

function stepPower(steps: ReturnType<typeof fight>, index = 0) {
  return steps[index];
}

// Wald: Mos Espa +2 in a real battle, and reveal a Character into hand.
{
  const g = makeGame(
    [
      { id: "waldboonta", set: R, count: 1 },
      { id: "tatooinemosespa", set: "battleofnaboo", count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  const wald = toPlay(g, "light", pull(g, "light", "waldboonta"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [wald.instanceId], [foe.instanceId]);
  const s = stepPower(steps);
  check("Wald battle power includes Mos Espa +2", s?.lightPower === 3 && s.lightBonus === 2, JSON.stringify(s));
}
{
  const g = makeGame(
    [
      { id: "waldboonta", set: R, count: 1 },
      { id: "p3queenamidala", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const wald = toHand(g, "light", pull(g, "light", "waldboonta"));
  const result = playCard(g, wald.instanceId);
  check("Wald deploy starts a Character search", result.applied === true && g.deployFromDeckPending?.toHand === true && g.deployFromDeckPending.targetId === "character");
  check("Wald search finds a Character", g.deployFromDeckPending?.foundCardId === "p3queenamidala");
  const before = g.light.deck.length;
  check("Wald confirm puts that Character in hand", deployFromDeck.confirmDeployFromDeck(g, "light") && g.light.hand.some((c) => c.cardId === "p3queenamidala"));
  check("Wald confirm reshuffles and does not leave the card in the deck", !g.light.deck.some((c) => c.cardId === "p3queenamidala") && g.light.deck.length === before - 1);
}
{
  const g = makeGame(
    [
      { id: "waldboonta", set: R, count: 1 },
      { id: "p3queenamidala", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const wald = toHand(g, "light", pull(g, "light", "waldboonta"));
  playCard(g, wald.instanceId);
  const deckSize = g.light.deck.length;
  check("Skipping Wald's search does not mill", deployFromDeck.declineDeployFromDeck(g, "light") && g.light.discard.length === 0 && g.light.deck.length === deckSize);
}
{
  const g = makeGame(
    [
      { id: "waldboonta", set: R, count: 1 },
      { id: "p3queenamidala", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  g.lightTurnCount = 1;
  const wald = toHand(g, "light", pull(g, "light", "waldboonta"));
  playCard(g, wald.instanceId);
  const played = g.light.inPlay.find((c) => c.cardId === "waldboonta");
  check("Face-down Wald does not search", played?.faceDown === true && !g.deployFromDeckPending);
}

// Kitster reveals a Weapon into hand. Jira deploys an Anakin's Friend and pays its cost.
{
  const g = makeGame(
    [
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const kit = toHand(g, "light", pull(g, "light", "kitsterboonta"));
  playCard(g, kit.instanceId);
  check("Kitster finds a Weapon for hand", g.deployFromDeckPending?.toHand === true && g.deployFromDeckPending.foundCardId === "quigonjinnslightsaber");
  deployFromDeck.confirmDeployFromDeck(g, "light");
  check("Kitster's Weapon is in hand, not in play", g.light.hand.some((c) => c.cardId === "quigonjinnslightsaber") && !g.light.inPlay.some((c) => c.cardId === "quigonjinnslightsaber"));
}
{
  const g = makeGame(
    [
      { id: "jiraboonta", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const jira = toHand(g, "light", pull(g, "light", "jiraboonta"));
  playCard(g, jira.instanceId);
  check("Jira finds Anakin's Friend", g.deployFromDeckPending?.foundCardId === "waldboonta" && g.deployFromDeckPending.toHand !== true);
  const force = state.getForce(g, "light");
  deployFromDeck.confirmDeployFromDeck(g, "light");
  check("Jira pays Wald's deploy cost and puts him in play", state.getForce(g, "light") === force - 1 && g.light.inPlay.some((c) => c.cardId === "waldboonta"));
}
{
  const g = makeGame(
    [
      { id: "04captainpanaka", set: R, count: 1 },
      { id: "captainpanakasblaster", set: "menaceofdarthmaul", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const panaka = toHand(g, "light", pull(g, "light", "04captainpanaka"));
  const force = state.getForce(g, "light");
  playCard(g, panaka.instanceId);
  deployFromDeck.confirmDeployFromDeck(g, "light");
  check(
    "Panaka deploys his blaster for free",
    state.getForce(g, "light") === force - 3 && g.light.inPlay.some((c) => c.cardId === "captainpanakasblaster")
  );
}

// Shmi: Anakin deploying here forces bottom-a-card or draw.
{
  const g = makeGame(
    [
      { id: "p7shmiskywalker", set: R, count: 1 },
      { id: "p09anakinskywalker", set: R, count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 2 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "p7shmiskywalker"));
  const anakin = toHand(g, "light", pull(g, "light", "p09anakinskywalker"));
  const extra = toHand(g, "light", pull(g, "light", "kitsterboonta"));
  playCard(g, anakin.instanceId);
  check("Shmi asks to bottom a card or draw when Anakin deploys", g.effectActivationPending?.kind === "bottom_or_draw");
  const deckBefore = g.light.deck.length;
  handlers.handleGameAction(g.id, "L", { kind: "bottom_hand_card", instanceId: extra.instanceId });
  check("Shmi bottoms the chosen hand card", g.light.deck[0]?.instanceId === extra.instanceId && g.light.hand.every((c) => c.instanceId !== extra.instanceId) && g.light.deck.length === deckBefore + 1);
}
{
  const g = makeGame(
    [
      { id: "p7shmiskywalker", set: R, count: 1 },
      { id: "03anakinskywalker", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "p7shmiskywalker"));
  const anakin = toHand(g, "light", pull(g, "light", "03anakinskywalker"));
  playCard(g, anakin.instanceId);
  const handBefore = g.light.hand.length;
  handlers.handleGameAction(g.id, "L", { kind: "deploy_here_draw" });
  check("Shmi can draw instead", g.light.hand.length === handBefore + 1 && !g.effectActivationPending);
}

// C-3PO draws when Anakin or Shmi deploys here. Mos Espa +2.
{
  const g = makeGame(
    [
      { id: "c3poboonta", set: R, count: 1 },
      { id: "p09anakinskywalker", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
      { id: "tatooinemosespa", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  const c3po = toPlay(g, "light", pull(g, "light", "c3poboonta"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [c3po.instanceId], [foe.instanceId]);
  check("C-3PO battle power includes Mos Espa +2", steps[0]?.lightPower === 3 && steps[0]?.lightBonus === 2, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [
      { id: "c3poboonta", set: R, count: 1 },
      { id: "p09anakinskywalker", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "c3poboonta"));
  const anakin = toHand(g, "light", pull(g, "light", "p09anakinskywalker"));
  const deckBefore = g.light.deck.length;
  playCard(g, anakin.instanceId);
  check("C-3PO draws one card when Anakin deploys here", g.light.hand.length === 1 && g.light.deck.length === deckBefore - 1 && !g.effectActivationPending);
}
{
  const g = makeGame(
    [
      { id: "c3poboonta", set: R, count: 1 },
      { id: "p7shmiskywalker", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "c3poboonta"));
  const shmi = toHand(g, "light", pull(g, "light", "p7shmiskywalker"));
  const deckBefore = g.light.deck.length;
  playCard(g, shmi.instanceId);
  check("C-3PO draws one card when Shmi deploys here", g.light.hand.length === 1 && g.light.deck.length === deckBefore - 1);
}
{
  const g = makeGame(
    [
      { id: "c3poboonta", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "c3poboonta"));
  const wald = toHand(g, "light", pull(g, "light", "waldboonta"));
  const deckBefore = g.light.deck.length;
  playCard(g, wald.instanceId);
  check("C-3PO does not draw when another character deploys", g.light.hand.length === 0 && g.light.deck.length === deckBefore);
}
{
  const g = makeGame(
    [
      { id: "c3poboonta", set: R, count: 1 },
      { id: "p09anakinskywalker", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "c3poboonta")).faceDown = true;
  const anakin = toHand(g, "light", pull(g, "light", "p09anakinskywalker"));
  const deckBefore = g.light.deck.length;
  playCard(g, anakin.instanceId);
  check("Face-down C-3PO does not draw", g.light.deck.length === deckBefore && g.light.hand.length === 0);
}
{
  const g = makeGame(
    [
      { id: "c3poboonta", set: R, count: 1 },
      { id: "p7shmiskywalker", set: R, count: 1 },
      { id: "p09anakinskywalker", set: R, count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 2 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "c3poboonta"));
  toPlay(g, "light", pull(g, "light", "p7shmiskywalker"));
  const anakin = toHand(g, "light", pull(g, "light", "p09anakinskywalker"));
  toHand(g, "light", pull(g, "light", "kitsterboonta"));
  const deckBefore = g.light.deck.length;
  playCard(g, anakin.instanceId);
  check(
    "C-3PO still draws when Shmi also asks for her choice",
    g.effectActivationPending?.kind === "bottom_or_draw" && g.light.hand.length === 2 && g.light.deck.length === deckBefore - 1
  );
}

// Yoda, Jedi Instructor: +2 to any other Jedi in a duel here, not to himself. Senate +2.
{
  const g = makeGame(
    [
      { id: "yodaboonta", set: R, count: 1 },
      { id: "p08obiwankenobi", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
      { id: "coruscantgalacticsenate", set: "thejedicouncil", count: 1 },
      { id: "waldboonta", set: R, count: 12 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 12 }]
  );
  setLocation(g, "coruscantgalacticsenate", "thejedicouncil");
  const yoda = toPlay(g, "light", pull(g, "light", "yodaboonta"));
  const obi = toPlay(g, "light", pull(g, "light", "p08obiwankenobi"));
  const saber = toPlay(g, "light", pull(g, "light", "quigonjinnslightsaber"));
  check("Yoda does not grant the duel bonus to himself", state.duelOtherPowerBonus(g, yoda) === 0);
  check("Yoda grants +2 to another Jedi here", state.duelOtherPowerBonus(g, obi) === 2);
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  g.phase = "battle";
  g.duelUsedThisTurn = false;
  check("Obi-Wan can start a duel", duel.initiateDuel(g, "light", obi.instanceId, saber.instanceId));
  duel.chooseDuelTarget(g, "light", foe.instanceId);
  check(
    "Duel power includes Obi-Wan's 5 and Yoda's +2",
    g.duelState?.lightPower === 7,
    `lightPower ${g.duelState?.lightPower}`
  );
}
{
  const g = makeGame(
    [
      { id: "yodaboonta", set: R, count: 1 },
      { id: "coruscantgalacticsenate", set: "thejedicouncil", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "coruscantgalacticsenate", "thejedicouncil");
  const yoda = toPlay(g, "light", pull(g, "light", "yodaboonta"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [yoda.instanceId], [foe.instanceId]);
  check("Yoda Senate bonus is +2 in battle", steps[0]?.lightBonus === 2 && steps[0]?.lightPower === 6, JSON.stringify(steps[0]));
}

// Jedi Training deploys a lightsaber and skips Armed & Dangerous.
{
  const g = makeGame(
    [
      { id: "wisdomofthecouncildoubleimpact", set: R, count: 1 },
      { id: "yodaboonta", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
      { id: "tatooinemosespa", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  const training = toHand(g, "light", pull(g, "light", "wisdomofthecouncildoubleimpact"));
  check("Jedi Training deploys as an Effect", playCard(g, training.instanceId).applied === true && g.light.inPlay.some((c) => c.cardId === training.cardId));
  const yoda = toHand(g, "light", pull(g, "light", "yodaboonta"));
  playCard(g, yoda.instanceId);
  check("Deploying a Jedi offers the lightsaber", (g.jediTrainingPending?.choices.length ?? 0) === 1);
  const saberId = g.jediTrainingPending?.choices[0]?.instanceId ?? "";
  const confirmed = handlers.handleGameAction(g.id, "L", { kind: "confirm_jedi_training", instanceId: saberId });
  check(
    "Confirming Jedi Training deploys the lightsaber and discards the Effect",
    confirmed.applied === true &&
      g.light.inPlay.some((c) => c.cardId === "quigonjinnslightsaber") &&
      g.light.discard.some((c) => c.cardId === "wisdomofthecouncildoubleimpact")
  );
}
{
  const g = makeGame(
    [
      { id: "wisdomofthecouncildoubleimpact", set: R, count: 1 },
      { id: "adigalliaarmed", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
      { id: "tatooinemosespa", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  const training = toPlay(g, "light", pull(g, "light", "wisdomofthecouncildoubleimpact"));
  const adi = toPlay(g, "light", pull(g, "light", "adigalliaarmed"));
  check("Armed & Dangerous does not use Jedi Training", jediTraining.maybeBeginJediTraining(g, "light", adi) === false && training.zone === "in_play");
}

// Wisdom fight-again, Mace's +2 with that battle card, Uh-Oh damage, Yousa same stack.
{
  const g = makeGame(
    [
      { id: "p2macewindu", set: R, count: 1 },
      { id: "wisdomofthecouncildoubleimpact", set: R, count: 1 },
    ],
    [
      { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 },
      { id: "sithprobedroidspydrone", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const mace = toPlay(g, "light", pull(g, "light", "p2macewindu"));
  const wisdom = toHand(g, "light", pull(g, "light", "wisdomofthecouncildoubleimpact"));
  const a = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  const b = toPlay(g, "dark", pull(g, "dark", "sithprobedroidspydrone"));
  const steps = fight(g, [wisdom.instanceId, mace.instanceId], [a.instanceId, b.instanceId]);
  check("Wisdom lets a Jedi fight the next character after defeating a unique character", steps.length === 2 && steps[0]?.winner === "light" && steps[1]?.winner === "light" && !steps[1]?.lightBattleCardId, `steps ${steps.length}`);
  check("Mace gains +2 while using Wisdom Of The Council", steps[0]?.lightPower === 8, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "yousaguysbombaddoubleimpact", set: R, count: 1 },
      { id: "p2macewindu", set: R, count: 1 },
    ],
    [{ id: "battledroidinfantrypatroldivision", set: "battleofnaboo", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "yousaguysbombaddoubleimpact"));
  const mace = toPlay(g, "light", pull(g, "light", "p2macewindu"));
  const droid = toPlay(g, "dark", pull(g, "dark", "battledroidinfantrypatroldivision"));
  const steps = fight(g, [mace.instanceId], [droid.instanceId]);
  check("Uh-Oh adds 2 damage to a defeated battle droid", steps[0]?.darkMill === 3, `mill ${steps[0]?.darkMill}`);
}
{
  const g = makeGame(
    [
      { id: "yousaguysbombaddoubleimpact", set: R, count: 1 },
      { id: "kitsterboonta", set: R, count: 2 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "yousaguysbombaddoubleimpact"));
  const a = toPlay(g, "light", pull(g, "light", "kitsterboonta"));
  const b = toPlay(g, "light", pull(g, "light", "kitsterboonta"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, a.instanceId, b.instanceId], [foe.instanceId]);
  check(
    "Yousa Guys Bombad adds two cards from the same character",
    steps.length === 1 && steps[0]?.lightCardId2 === "kitsterboonta" && steps[0]?.lightPower === 2,
    JSON.stringify(steps[0])
  );
}

// Split card: choose one side. Final Stand's extra duel hits stay on that side.
{
  const g = makeGame(
    [
      { id: "thenegotiationswereshortdoubleimpact", set: R, count: 1 },
      { id: "p1quigonjinn", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  g.phase = "battle";
  g.battleCardDeclareSide = "light";
  g.battlePlanPhase = false;
  const battle = toHand(g, "light", pull(g, "light", "thenegotiationswereshortdoubleimpact"));
  const qui = toPlay(g, "light", pull(g, "light", "p1quigonjinn"));
  handlers.handleGameAction(g.id, "L", { kind: "declare_battle_cards", battleCardInstanceIds: [battle.instanceId] });
  handlers.handleGameAction(g.id, "D", { kind: "declare_battle_cards", battleCardInstanceIds: [] });
  const missing = handlers.handleGameAction(g.id, "L", { kind: "battle_plan_ready", instanceIds: [battle.instanceId, qui.instanceId] });
  check("A split Battle card requires a chosen side", missing.applied === false);
  battle.doubleImpactChoice = "primary";
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const primary = fight(g, [battle.instanceId, qui.instanceId], [foe.instanceId]);
  check("Negotiations primary half is +3 and does not add the other half", primary[0]?.lightBattleCardBonus === 3, `bonus ${primary[0]?.lightBattleCardBonus}`);
}
{
  const g = makeGame(
    [
      { id: "thenegotiationswereshortdoubleimpact", set: R, count: 1 },
      { id: "p1quigonjinn", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "thenegotiationswereshortdoubleimpact"));
  battle.doubleImpactChoice = "second";
  const qui = toPlay(g, "light", pull(g, "light", "p1quigonjinn"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const second = fight(g, [battle.instanceId, qui.instanceId], [foe.instanceId]);
  check("Qui-Gon's Final Stand half adds no battle power", (second[0]?.lightBattleCardBonus ?? 0) === 0, `bonus ${second[0]?.lightBattleCardBonus}`);
  check(
    "Final Stand is the half with extra duel hits",
    state.splitBattleBonusText(battle.cardId, R, "second").includes("duel:discard:extrahit2") &&
      !state.splitBattleBonusText(battle.cardId, R, "primary").includes("duel:discard:extrahit2")
  );
}
{
  function duelHits(half: "primary" | "second"): number {
    const g = makeGame(
      [
        { id: "thenegotiationswereshortdoubleimpact", set: R, count: 1 },
        { id: "p08obiwankenobi", set: R, count: 1 },
        { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
      ],
      [
        { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 },
        { id: "yousaguysbombaddoubleimpact", set: R, count: 1 },
      ]
    );
    const obi = toPlay(g, "light", pull(g, "light", "p08obiwankenobi"));
    const saber = toPlay(g, "light", pull(g, "light", "quigonjinnslightsaber"));
    const maul = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
    const attack = toHand(g, "light", pull(g, "light", "thenegotiationswereshortdoubleimpact"));
    const answer = toHand(g, "dark", pull(g, "dark", "yousaguysbombaddoubleimpact"));
    g.duelState = {
      step: "play",
      initiator: "light",
      attackerCharInstanceId: obi.instanceId,
      attackerWeaponInstanceId: saber.instanceId,
      defenderCharInstanceId: maul.instanceId,
      lightPower: 1,
      darkPower: 1,
      lightHits: 0,
      darkHits: 0,
      lightDuelHand: [attack],
      darkDuelHand: [answer],
      lightSetAside: [],
      darkSetAside: [],
      lightPlayed: [],
      darkPlayed: [],
      currentAttacker: "light",
    };
    duel.playDuelCard(g, "light", attack.instanceId, { discardForExtraHits: true, doubleImpactHalf: half });
    duel.playDuelCard(g, "dark", answer.instanceId, { destinyPick: 1 });
    const result = g.lastDuelResult as { darkHits?: number } | undefined;
    return result?.darkHits ?? g.duelState?.darkHits ?? -1;
  }
  check("Final Stand discard adds two extra duel hits", duelHits("second") === 3, `hits ${duelHits("second")}`);
  check("Negotiations half does not add those extra hits", duelHits("primary") === 1, `hits ${duelHits("primary")}`);
}

// Armed & Dangerous ignores a Weapon card and uses the built-in weapon.
{
  const g = makeGame(
    [
      { id: "adigalliaarmed", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  stackTop(g, "light", "kitsterboonta");
  const saber = toPlay(g, "light", pull(g, "light", "quigonjinnslightsaber"));
  const adi = toPlay(g, "light", pull(g, "light", "adigalliaarmed"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [saber.instanceId, adi.instanceId], [foe.instanceId]);
  check(
    "Adi Gallia ignores the Weapon card and adds her built-in lightsaber",
    !steps[0]?.lightWeaponCardId && steps[0]?.lightWeaponBonus === 6 && steps[0]?.lightPower === 11,
    JSON.stringify(steps[0])
  );
  check("The ignored Weapon stays in play", g.light.inPlay.some((c) => c.cardId === "quigonjinnslightsaber"));
}
{
  const g = makeGame(
    [{ id: "bossnassarmed", set: R, count: 1 }],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  state.runDestinyCompareRound(g);
  const round = g.destinyCompareRounds?.[0];
  const darkDestiny = (getCard("pitdroidmechanic", "menaceofdarthmaul") as { destiny?: number } | undefined)?.destiny;
  check("Boss Nass counts as 4 when he is the only two-destiny card", round?.light.cardId === "bossnassarmed" && round.light.destiny === 4 && round.dark.destiny === darkDestiny, JSON.stringify(round));
}
{
  const g = makeGame(
    [{ id: "valorumarmed", set: R, count: 1 }],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  state.runDestinyCompareRound(g);
  const round = g.destinyCompareRounds?.[0];
  check("Valorum counts as 4 when he is the only two-destiny card", round?.light.cardId === "valorumarmed" && round.light.destiny === 4, JSON.stringify(round));
}

// Qui-Gon weapon bonus, Force Push leaves his own weapon alone, Fear returns only Jar Jar.
{
  const g = makeGame(
    [
      { id: "p1quigonjinn", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const qui = toPlay(g, "light", pull(g, "light", "p1quigonjinn"));
  const saber = toPlay(g, "light", pull(g, "light", "quigonjinnslightsaber"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [saber.instanceId, qui.instanceId], [foe.instanceId]);
  check("Qui-Gon gains +1 with his own lightsaber", steps[0]?.lightPower === 9, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "p1quigonjinn", set: R, count: 1 },
      { id: "quigonjinnslightsaber", set: "thejedicouncil", count: 1 },
      { id: "jediforcepushcombobattle", set: R, count: 1 },
    ],
    [
      { id: "battledroidinfantrypatroldivision", set: "battleofnaboo", count: 1 },
      { id: "stap", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const push = toHand(g, "light", pull(g, "light", "jediforcepushcombobattle"));
  const saber = toPlay(g, "light", pull(g, "light", "quigonjinnslightsaber"));
  const qui = toPlay(g, "light", pull(g, "light", "p1quigonjinn"));
  const stap = toPlay(g, "dark", pull(g, "dark", "stap"));
  const droid = toPlay(g, "dark", pull(g, "dark", "battledroidinfantrypatroldivision"));
  const steps = fight(g, [push.instanceId, saber.instanceId, qui.instanceId], [stap.instanceId, droid.instanceId]);
  check("Force Push still lets Qui-Gon use his weapon", (steps[0]?.lightWeaponBonus ?? 0) >= 2, JSON.stringify(steps[0]));
  check("Force Push does not cancel the opponent while Qui-Gon has a weapon", (steps[0]?.darkWeaponBonus ?? 0) === 2, `dark weapon ${steps[0]?.darkWeaponBonus}`);
}
{
  const g = makeGame(
    [
      { id: "p1quigonjinn", set: R, count: 1 },
      { id: "jediforcepushcombobattle", set: R, count: 1 },
    ],
    [
      { id: "battledroidinfantrypatroldivision", set: "battleofnaboo", count: 1 },
      { id: "stap", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const push = toHand(g, "light", pull(g, "light", "jediforcepushcombobattle"));
  const qui = toPlay(g, "light", pull(g, "light", "p1quigonjinn"));
  const stap = toPlay(g, "dark", pull(g, "dark", "stap"));
  const droid = toPlay(g, "dark", pull(g, "dark", "battledroidinfantrypatroldivision"));
  const steps = fight(g, [push.instanceId, qui.instanceId], [stap.instanceId, droid.instanceId]);
  check("Force Push cancels the opponent's weapon when Qui-Gon has none", (steps[0]?.darkWeaponBonus ?? 0) === 0 && steps[0]?.lightBattleCardBonus === 2, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [
      { id: "fearattractsthefearfulcombo", set: R, count: 1 },
      { id: "004anakinskywalkerchildof", set: R, count: 1 },
      { id: "jarjarbinksarmed", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 4 },
      { id: "electropole", set: "battleofnaboo", count: 1 },
      { id: "kaadu", set: "battleofnaboo", count: 1 },
    ],
    [
      { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 },
      { id: "darthmaulslightsaber", set: "battleofnaboo", count: 1 },
      { id: "p08obiwankenobi", set: R, count: 2 },
    ]
  );
  stackTop(g, "light", "kaadu");
  stackTop(g, "light", "electropole");
  stackTop(g, "dark", "p08obiwankenobi");
  stackTop(g, "dark", "p08obiwankenobi");
  const fear = toHand(g, "light", pull(g, "light", "fearattractsthefearfulcombo"));
  const anakin = toPlay(g, "light", pull(g, "light", "004anakinskywalkerchildof"));
  const jarjar = toPlay(g, "light", pull(g, "light", "jarjarbinksarmed"));
  const saber = toPlay(g, "dark", pull(g, "dark", "darthmaulslightsaber"));
  const maul = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  const steps = fight(g, [fear.instanceId, anakin.instanceId, jarjar.instanceId], [saber.instanceId, maul.instanceId]);
  check("Fear returns only Jar Jar", g.light.hand.some((c) => c.cardId === "jarjarbinksarmed") && g.light.discard.some((c) => c.cardId === "004anakinskywalkerchildof"), `mill ${steps[0]?.lightMill} winner ${steps[0]?.winner}`);
  check("Anakin is still damaged when Jar Jar goes home", steps[0]?.winner === "dark" && steps[0]?.lightMill === 4, `mill ${steps[0]?.lightMill}`);
}

// Combo battle cards are one printed ability.
{
  const g = makeGame(
    [
      { id: "areyouanangelcombobattle", set: R, count: 1 },
      { id: "004anakinskywalkerchildof", set: R, count: 1 },
      { id: "p10padmenaberrie", set: R, count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  stackTop(g, "light", "kitsterboonta");
  const battle = toHand(g, "light", pull(g, "light", "areyouanangelcombobattle"));
  const anakin = toPlay(g, "light", pull(g, "light", "004anakinskywalkerchildof"));
  const padme = toPlay(g, "light", pull(g, "light", "p10padmenaberrie"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, anakin.instanceId, padme.instanceId], [foe.instanceId]);
  check(
    "Are You An Angel adds Anakin and Padmé once",
    steps.length === 1 && steps[0]?.lightCardId2 === "p10padmenaberrie" && steps[0]?.lightBattleCardBonus === 4 && steps[0]?.lightPower === 11,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [
      { id: "bravelittledroidcombobattle", set: R, count: 1 },
      { id: "p13r2d2", set: R, count: 1 },
      { id: "c3poanakinscreation", set: "menaceofdarthmaul", count: 1 },
      { id: "electropole", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "bravelittledroidcombobattle"));
  const weapon = toPlay(g, "light", pull(g, "light", "electropole"));
  const r2 = toPlay(g, "light", pull(g, "light", "p13r2d2"));
  const threepo = toPlay(g, "light", pull(g, "light", "c3poanakinscreation"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, weapon.instanceId, r2.instanceId, threepo.instanceId], [foe.instanceId]);
  check(
    "Brave Little Droid adds R2-D2 and C-3PO and allows no weapon",
    steps[0]?.lightPower === 5 && (steps[0]?.lightWeaponBonus ?? 0) === 0,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [
      { id: "celebrationcombobattle", set: R, count: 1 },
      { id: "gunganwarriorveteran", set: "battleofnaboo", count: 1 },
      { id: "kaadu", set: "battleofnaboo", count: 1 },
      { id: "electropole", set: "battleofnaboo", count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  stackTop(g, "light", "kitsterboonta");
  stackTop(g, "light", "waldboonta");
  const battle = toHand(g, "light", pull(g, "light", "celebrationcombobattle"));
  const kaadu = toPlay(g, "light", pull(g, "light", "kaadu"));
  const pole = toPlay(g, "light", pull(g, "light", "electropole"));
  const gungan = toPlay(g, "light", pull(g, "light", "gunganwarriorveteran"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, kaadu.instanceId, pole.instanceId, gungan.instanceId], [foe.instanceId]);
  check(
    "Celebration is one ability: +2 and both Gungan weapons",
    steps[0]?.lightBattleCardBonus === 2 && (steps[0]?.lightWeaponBonus ?? 0) > 2,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [
      { id: "thequeensplandoubleimpact", set: R, count: 1 },
      { id: "royalguardleader", set: "battleofnaboo", count: 1 },
      { id: "naboosecuritytrooper", set: "battleofnaboo", count: 1 },
      { id: "bravopilotaceflyer", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "thequeensplandoubleimpact"));
  const a = toPlay(g, "light", pull(g, "light", "royalguardleader"));
  const b = toPlay(g, "light", pull(g, "light", "naboosecuritytrooper"));
  const c = toPlay(g, "light", pull(g, "light", "bravopilotaceflyer"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, a.instanceId, b.instanceId, c.instanceId], [foe.instanceId]);
  check(
    "The Queen's Plan adds three non-unique fighters",
    steps.length === 1 && !!steps[0]?.lightCardId3 && steps[0]?.lightPower === 6,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [
      { id: "themightoftherepublicdoubleimpact", set: R, count: 1 },
      { id: "coruscantguardpeacekeeper", set: "thejedicouncil", count: 2 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "themightoftherepublicdoubleimpact"));
  const a = toPlay(g, "light", pull(g, "light", "coruscantguardpeacekeeper"));
  const b = toPlay(g, "light", pull(g, "light", "coruscantguardpeacekeeper"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, a.instanceId, b.instanceId], [foe.instanceId]);
  check("The Might Of The Republic battle half is +1", steps[0]?.lightBattleCardBonus === 1 && steps[0]?.lightPower === 7, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [
      { id: "themightoftherepublicdoubleimpact", set: R, count: 1 },
      { id: "valorumarmed", set: R, count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "tatooinemosespa", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  toPlay(g, "light", pull(g, "light", "themightoftherepublicdoubleimpact"));
  stackTop(g, "light", "kitsterboonta");
  const valorum = toPlay(g, "light", pull(g, "light", "valorumarmed"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [valorum.instanceId], [foe.instanceId]);
  check("Senate Guard gives Valorum +2", steps[0]?.lightBasePower === 5, `base ${steps[0]?.lightBasePower} total ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "dosmackineeksnocomenheredoubleimpact", set: R, count: 1 },
      { id: "gunganwarriorveteran", set: "battleofnaboo", count: 3 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "dosmackineeksnocomenheredoubleimpact"));
  const ids = [0, 1, 2].map(() => toPlay(g, "light", pull(g, "light", "gunganwarriorveteran")).instanceId);
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, ...ids], [foe.instanceId]);
  check("Dos Mackineeks adds three Gungans", steps.length === 1 && !!steps[0]?.lightCardId3 && steps[0]?.lightPower === 6, JSON.stringify(steps[0]));
}

// Character abilities that are not deploy searches.
{
  const g = makeGame(
    [
      { id: "p08obiwankenobi", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }, { id: "waldboonta", set: R, count: 3 }]
  );
  const obi = toPlay(g, "light", pull(g, "light", "p08obiwankenobi"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [obi.instanceId], [foe.instanceId]);
  check("Obi-Wan Jedi Avenger adds 2 damage when he defeats someone", steps[0]?.darkMill === 3, `mill ${steps[0]?.darkMill}`);
}
{
  const g = makeGame(
    [
      { id: "p09anakinskywalker", set: R, count: 1 },
      { id: "electropole", set: "battleofnaboo", count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }],
    "bot_1"
  );
  stackTop(g, "light", "kitsterboonta");
  stackTop(g, "light", "electropole");
  const anakin = toPlay(g, "light", pull(g, "light", "p09anakinskywalker"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [anakin.instanceId], [foe.instanceId]);
  check("Anakin's ? power draws destiny and he may redraw a low result", steps[0]?.lightBasePower === 4, `base ${steps[0]?.lightBasePower}`);
}
{
  const g = makeGame(
    [
      { id: "03anakinskywalker", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "03anakinskywalker"));
  check("Anakin Rookie Pilot adds 1 to your starfighters", state.getStarfighterSupportBonus(g, "light") === 1);
}
{
  const g = makeGame(
    [
      { id: "05macewindu", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  g.controlledPlanets = [{
    locationCardId: "coruscantjedicouncilchamber",
    locationInstanceId: "cp",
    planet: "coruscant",
    controlledBy: "light",
    strandedLight: [],
    strandedDark: [],
  }];
  const mace = toPlay(g, "light", pull(g, "light", "05macewindu"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [mace.instanceId], [foe.instanceId]);
  check("Mace Jedi Councilor gains +2 when you control Coruscant", steps[0]?.lightPower === 8, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "007macewindujedispeaker", set: R, count: 1 },
      { id: "010yodajedimaster", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  toPlay(g, "light", pull(g, "light", "010yodajedimaster"));
  check(
    "Mace Jedi Speaker costs 3 while Yoda Jedi Master is here",
    state.getDeployCostWithGametextBonus(g, "light", "007macewindujedispeaker", R) === 3
  );
}
{
  const g = makeGame(
    [
      { id: "01obiwankenobi", set: R, count: 1 },
    ],
    [{ id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 }]
  );
  state.markFoughtThisTurn(g, "darthmaulsithapprentice");
  const obi = toPlay(g, "light", pull(g, "light", "01obiwankenobi"));
  const maul = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  const steps = fight(g, [obi.instanceId], [maul.instanceId]);
  check("Obi-Wan Jedi Student gains +2 after fighting Maul", steps[0]?.lightPower === 7, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "p10padmenaberrie", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  state.markFoughtThisTurn(g, "p3queenamidala");
  const padme = toPlay(g, "light", pull(g, "light", "p10padmenaberrie"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [padme.instanceId], [foe.instanceId]);
  check("Padmé gains +2 after Amidala has fought", steps[0]?.lightPower === 5, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "p3queenamidala", set: R, count: 1 },
      { id: "amidalasblaster", set: "thejedicouncil", count: 1 },
      { id: "kitsterboonta", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 3 },
    ],
    [
      { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 },
      { id: "darthmaulslightsaber", set: "battleofnaboo", count: 1 },
      { id: "p08obiwankenobi", set: R, count: 2 },
    ]
  );
  stackTop(g, "light", "kitsterboonta");
  stackTop(g, "dark", "p08obiwankenobi");
  stackTop(g, "dark", "p08obiwankenobi");
  const blaster = toPlay(g, "light", pull(g, "light", "amidalasblaster"));
  const queen = toPlay(g, "light", pull(g, "light", "p3queenamidala"));
  const saber = toPlay(g, "dark", pull(g, "dark", "darthmaulslightsaber"));
  const maul = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  const steps = fight(g, [blaster.instanceId, queen.instanceId], [saber.instanceId, maul.instanceId]);
  check("Amidala's Blaster reduces her damage by 2", steps[0]?.winner === "dark" && steps[0]?.lightMill === 1, `winner ${steps[0]?.winner} mill ${steps[0]?.lightMill}`);
}
{
  const g = makeGame(
    [
      { id: "06queenamidala", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  g.controlledPlanets = [{
    locationCardId: "nabootheedpalace",
    locationInstanceId: "naboo",
    planet: "naboo",
    controlledBy: "light",
    strandedLight: [],
    strandedDark: [],
  }];
  const queen = toPlay(g, "light", pull(g, "light", "06queenamidala"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [queen.instanceId], [foe.instanceId]);
  check("Queen Amidala gains +2 when you control Naboo", steps[0]?.lightPower === 4, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "02quigonjinnjedimentor", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 12 },
    ],
    [
      { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 },
      { id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 12 },
    ]
  );
  const qui = toPlay(g, "light", pull(g, "light", "02quigonjinnjedimentor"));
  const maul = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  g.phase = "battle";
  g.duelUsedThisTurn = false;
  const saber = {
    instanceId: "saber_test",
    cardId: "quigonjinnslightsaber",
    cardSet: "thejedicouncil",
    ownerSide: "light" as Side,
    zone: "in_play" as const,
    faceDown: false,
  };
  g.light.inPlay.push(saber);
  duel.initiateDuel(g, "light", qui.instanceId, saber.instanceId);
  duel.chooseDuelTarget(g, "light", maul.instanceId);
  check("Qui-Gon Mentor gains +2 while dueling Darth Maul", g.duelState?.lightPower === 10, `power ${g.duelState?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "p12yoda", set: R, count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  g.controlledPlanets = [{
    locationCardId: "tatooinemosespa",
    locationInstanceId: "t",
    planet: "tatooine",
    controlledBy: "dark",
    strandedLight: [],
    strandedDark: [],
  }];
  const yoda = toPlay(g, "light", pull(g, "light", "p12yoda"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [yoda.instanceId], [foe.instanceId]);
  check("Yoda Wise Jedi gains +2 when the opponent controls a planet", steps[0]?.lightPower === 6, `power ${steps[0]?.lightPower}`);
}
{
  const g = makeGame(
    [
      { id: "07yodajediphilosopher", set: R, count: 1 },
      { id: "waldboonta", set: R, count: 6 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const yoda = pull(g, "light", "07yodajediphilosopher");
  g.controlledPlanets = [{
    locationCardId: "coruscantjedicouncilchamber",
    locationInstanceId: "cp",
    planet: "coruscant",
    controlledBy: "light",
    strandedLight: [{ instanceId: yoda.instanceId, cardId: yoda.cardId }],
    strandedDark: [],
  }];
  const handIds = [0, 1, 2].map(() => toHand(g, "light", pull(g, "light", "waldboonta")).instanceId);
  const began = winControl.beginWinControl(g, "light", yoda.instanceId, 0);
  const confirmed = winControl.confirmWinControl(g, "light", handIds);
  check(
    "Yoda Jedi Philosopher discards himself and 3 cards, then draws 3",
    began.ok && confirmed.ok && g.light.discard.some((c) => c.cardId === "07yodajediphilosopher") && g.light.hand.length === 3
  );
}
{
  const g = makeGame(
    [{ id: "amidalasstarshipboonta", set: R, count: 1 }],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  g.evacuationState = {
    evacuatingSide: "light",
    transportInstanceId: "ship",
    transportCardId: "amidalasstarshipboonta",
    targetPlanetIndex: -1,
    stackedCards: [{ instanceId: "q", cardId: "p3queenamidala" }],
    awaitingInterception: true,
  };
  check("Amidala's Starship gains +3 while evacuating with Amidala", state.getEvacuatingStarshipPowerBonus(g, "light", "amidalasstarshipboonta") === 3);
  g.evacuationState.stackedCards.push({ instanceId: "r", cardId: "p13r2d2" });
  check("R2-D2 adds another +2 to that evacuation", state.getEvacuatingStarshipPowerBonus(g, "light", "amidalasstarshipboonta") === 5);
}
{
  const g = makeGame(
    [
      { id: "p11captainpanaka", set: R, count: 1 },
      { id: "thequeensplandoubleimpact", set: R, count: 1 },
      { id: "royalguardleader", set: "battleofnaboo", count: 1 },
      { id: "bravopilotaceflyer", set: "battleofnaboo", count: 1 },
    ],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }]
  );
  const battle = toHand(g, "light", pull(g, "light", "thequeensplandoubleimpact"));
  const panaka = toPlay(g, "light", pull(g, "light", "p11captainpanaka"));
  const guard = toPlay(g, "light", pull(g, "light", "royalguardleader"));
  const pilot = toPlay(g, "light", pull(g, "light", "bravopilotaceflyer"));
  const foe = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  const steps = fight(g, [battle.instanceId, panaka.instanceId, guard.instanceId, pilot.instanceId], [foe.instanceId]);
  check("Panaka counts as Naboo Security for The Queen's Plan", steps[0]?.lightPower === 8 && !!steps[0]?.lightCardId3, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [{ id: "poundeduntodeath", set: "duelofthefates", count: 1 }, { id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [{ id: "pitdroidmechanic", set: "menaceofdarthmaul", count: 1 }, { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 }]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const effect = toHand(g, "light", pull(g, "light", "poundeduntodeath"));
  check("Pounded Unto Death deploys for 2", playCard(g, effect.instanceId).applied === true && state.getForce(g, "light") === 28);
  g.phase = "even_up";
  const pit = toPlay(g, "dark", pull(g, "dark", "pitdroidmechanic"));
  toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  const began = pounded.beginPoundedUntoDeath(g, "light", effect.instanceId);
  const offered = (g.poundedPending?.targets ?? []).map((t) => t.cardId);
  check(
    "Pounded Unto Death offers the non-unique character and not the unique one",
    began.ok && offered.includes("pitdroidmechanic") && !offered.includes("darthmaulsithapprentice"),
    offered.join(",")
  );
  check(
    "Pounded Unto Death removes that character from the planet",
    pounded.confirmPoundedUntoDeath(g, "light", pit.instanceId).ok &&
      !g.dark.inPlay.some((c) => c.instanceId === pit.instanceId) &&
      g.dark.discard.some((c) => c.cardId === "pitdroidmechanic") &&
      g.dark.inPlay.some((c) => c.cardId === "darthmaulsithapprentice") &&
      !g.light.inPlay.some((c) => c.instanceId === effect.instanceId)
  );
}

for (const id of [
  "areyouanangelcombobattle",
  "bravelittledroidcombobattle",
  "celebrationcombobattle",
  "enoughofthispretensecomboba",
  "fearattractsthefearfulcombo",
  "ihaveabadfeelingaboutthiscombo",
  "jediforcepushcombobattle",
]) {
  const def = getCard(id, R) as { comboHalf?: unknown } | undefined;
  check(`${id} is one printed ability`, !def?.comboHalf);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  for (const line of failures) console.log("FAIL", line);
  process.exitCode = 1;
}
