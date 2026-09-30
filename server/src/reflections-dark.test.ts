/**
 * Plays the Reflections dark cards through the game engine.
 * Jabba's podracing handling and Watto's thrust bonus belong to the next set and are not played.
 * Run: npm run test:reflections-dark
 */
import * as fs from "fs";
import * as path from "path";
import { initCards, getCard } from "./cards/loader";
import type { CardInstance } from "./cards/types";
import * as handlers from "./game/handlers";
import * as hyperspace from "./game/hyperspace";
import * as jediTraining from "./game/jedi-training";
import * as deployFromDeck from "./game/deploy-from-deck";
import * as engine from "./game/engine";
import * as pounded from "./game/pounded";
import * as state from "./game/state";
import type { GameStateData } from "./game/state";
import * as duel from "./game/duel";
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
function makeGame(light: Entry[], dark: Entry[]): GameStateData {
  gameN++;
  const g = engine.startGame(
    "ref_dark_" + gameN,
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
  g.turnSide = "dark";
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
  for (const zone of [p.deck, p.hand, p.discard]) {
    const idx = zone.findIndex((c) => c.cardId === cardId);
    if (idx >= 0) return zone.splice(idx, 1)[0];
  }
  throw new Error(`missing ${cardId} on ${side}`);
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

function drain(g: GameStateData, side: Side): void {
  pile(g, side).deck = [];
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

function playCard(g: GameStateData, instanceId: string, playerId = "D") {
  return handlers.handleGameAction(g.id, playerId, { kind: "play_card", instanceId });
}

function fight(g: GameStateData, lightIds: string[], darkIds: string[]) {
  g.phase = "battle";
  g.turnSide = "dark";
  g.battlePlanPhase = true;
  g.lightBattlePlanReady = true;
  g.darkBattlePlanReady = true;
  g.lightBattlePlanOrder = lightIds;
  g.darkBattlePlanOrder = darkIds;
  state.resolveBattlePlan(g);
  return g.battleRevealSequence ?? [];
}

const R = "reflections";
const PIT = "pitdroidmechanic";
const PIT_SET = "menaceofdarthmaul";
const QUI = "p1quigonjinn";
const SABER = "quigonjinnslightsaber";
const OBI = "obiwankenobijedipadawan";
const OBI_SET = "menaceofdarthmaul";

const darkJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/cards/reflections.json"), "utf8")) as {
  cards: Record<string, unknown>[];
};
const clientJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../client/data/cards/reflections.json"), "utf8")
) as { cards: Record<string, unknown>[] };
const darkCards = darkJson.cards.filter((c) => c.side === "dark");
const clientById = new Map(clientJson.cards.map((c) => [String(c.id), c]));

check("dark Reflections has the reviewed cards", darkCards.length === 50, String(darkCards.length));

for (const card of darkCards) {
  const id = String(card.id);
  const client = clientById.get(id);
  check(`${id} matches the client copy`, !!client && JSON.stringify(client) === JSON.stringify(card));
  check(`${id} image is a png`, String(card.image ?? "").endsWith(".png"), String(card.image));
  check(`${id} set is reflections`, card.set === R);
  const loaded = getCard(id, R) as Record<string, unknown> | undefined;
  check(`${id} loads from reflections`, !!loaded && loaded.name === card.name);
  if (Array.isArray(card.dotColors)) {
    check(`${id} wildcard has six colors`, (card.dotColors as string[]).length === 6);
  }
  if (card.type === "character") {
    const locs = [card.bonus1loc, card.bonus2loc, card.bonus3loc] as string[];
    const bonuses = [card.bonus1, card.bonus2, card.bonus3] as number[];
    locs.forEach((loc, i) => {
      if (!loc) return;
      const got = state.getLocationBonusForCharacter(id, loc);
      check(`${id} location ${loc} is +${bonuses[i]}`, got === bonuses[i], `engine returned ${got}`);
    });
    const g = makeGame([{ id: PIT, set: PIT_SET, count: 1 }], [{ id, set: R, count: 1 }]);
    check(
      `${id} deploys for ${card.cost}`,
      state.getDeployCostWithGametextBonus(g, "dark", id, R) === card.cost,
      `cost ${state.getDeployCostWithGametextBonus(g, "dark", id, R)}`
    );
    check(`${id} battle power is ${card.power}`, state.getPowerForBattle(id) === card.power);
  }
  if (card.type === "starship") {
    check(`${id} power is ${card.power}`, (getCard(id, R) as { power?: number }).power === card.power);
  }
}

check(
  "Jabba handling is stored for the next set and does not add power",
  (getCard("jabbathehuttboonta", R) as { note?: string; gametextbonus?: string }).gametextbonus === "" &&
    String((getCard("jabbathehuttboonta", R) as { note?: string }).note ?? "").includes("handling")
);
check(
  "Watto thrust is stored for the next set and does not add power",
  (getCard("wattoboonta", R) as { note?: string; gametextbonus?: string }).gametextbonus === "" &&
    String((getCard("wattoboonta", R) as { note?: string }).note ?? "").includes("thrust") &&
    state.getGametextBonusForCharacter("wattoboonta", R, undefined, PIT).bonus === 0
);

function foe(): Entry[] {
  return [{ id: PIT, set: PIT_SET, count: 1 }];
}

{
  const g = makeGame(
    foe(),
    [
      { id: "athousandterriblethingscomb", set: R, count: 1 },
      { id: "battledroidinfantrypatroldivision", set: "battleofnaboo", count: 1 },
      { id: "battledroidinfantrydefensedivision", set: "battleofnaboo", count: 1 },
      { id: "battledroidinfantryaatdivision", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "athousandterriblethingscomb"));
  const a = toPlay(g, "dark", pull(g, "dark", "battledroidinfantrypatroldivision"));
  const b = toPlay(g, "dark", pull(g, "dark", "battledroidinfantrydefensedivision"));
  const c = toPlay(g, "dark", pull(g, "dark", "battledroidinfantryaatdivision"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, a.instanceId, b.instanceId, c.instanceId]);
  check(
    "A Thousand Terrible Things adds three non-unique battle droids for +2",
    steps.length === 1 && steps[0]?.darkCardId3 === "battledroidinfantryaatdivision" && steps[0]?.darkBattleCardBonus === 2 && steps[0]?.darkPower === 8,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "athousandterriblethingscomb", set: R, count: 1 },
      { id: "r35battledroidsquadescortunit", set: R, count: 3 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "athousandterriblethingscomb"));
  const droids = [0, 1, 2].map(() => toPlay(g, "dark", pull(g, "dark", "r35battledroidsquadescortunit")));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  const steps = fight(g, [pit.instanceId], [battle.instanceId, ...droids.map((d) => d.instanceId)]);
  check("A Thousand Terrible Things does not accept unique battle droids", !steps[0]?.darkCardId3, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: SABER, set: "thejedicouncil", count: 1 }],
    [{ id: "atlastwewillhaverevengecomb", set: R, count: 1 }, { id: "p4darthmaul", set: R, count: 1 }]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "atlastwewillhaverevengecomb"));
  const maul = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const saber = toPlay(g, "light", pull(g, "light", SABER));
  drain(g, "light");
  drain(g, "dark");
  const steps = fight(g, [saber.instanceId, qui.instanceId], [battle.instanceId, maul.instanceId]);
  check(
    "At Last We Will Have Revenge is +3 against a Jedi and ignores the Jedi weapon when Maul is unarmed",
    steps[0]?.darkBattleCardBonus === 3 && (steps[0]?.lightWeaponBonus ?? 0) === 0 && steps[0]?.darkPower === 9,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [{ id: "atlastwewillhaverevengecomb", set: R, count: 1 }, { id: "p4darthmaul", set: R, count: 1 }]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "atlastwewillhaverevengecomb"));
  const maul = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, maul.instanceId]);
  check("At Last We Will Have Revenge adds no power against a non-Jedi", (steps[0]?.darkBattleCardBonus ?? 0) === 0 && steps[0]?.darkPower === 6, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: "tatooinedesertlandingsite", set: "battleofnaboo", count: 1 }],
    [{ id: "aurrasingboonta", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 2 }]
  );
  setLocation(g, "tatooinedesertlandingsite", "battleofnaboo");
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingboonta"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  drain(g, "dark");
  const steps = fight(g, [qui.instanceId], [aurra.instanceId]);
  check(
    "Aurra Formidable gains Desert +2 and +2 against a Jedi",
    steps[0]?.darkBonus === 2 && steps[0]?.darkPower === 9,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [{ id: "aurrasingboonta", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 1 }]
  );
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingboonta"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  const steps = fight(g, [pit.instanceId], [aurra.instanceId]);
  check(
    "Aurra Formidable may draw after she defeats a character",
    steps[0]?.winner === "dark" && g.deployDrawPending?.side === "dark" && g.deployDrawPending.count === 1,
    JSON.stringify(g.deployDrawPending)
  );
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [
      { id: "p16aurrasing", set: R, count: 1 },
      { id: "aurrasingsblasterrifle", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const aurra = toHand(g, "dark", pull(g, "dark", "p16aurrasing"));
  const result = playCard(g, aurra.instanceId);
  check(
    "Aurra Scoundrel offers her blaster from the deck",
    result.applied === true && g.deployFromDeckPending?.foundCardId === "aurrasingsblasterrifle"
  );
  const beforeRifle = state.getForce(g, "dark");
  const paid = deployFromDeck.confirmDeployFromDeck(g, "dark");
  check(
    "Aurra Scoundrel pays the blaster cost and deploys it",
    paid && state.getForce(g, "dark") === beforeRifle - 1 && g.dark.inPlay.some((c) => c.cardId === "aurrasingsblasterrifle"),
    `paid ${paid} force ${state.getForce(g, "dark")} was ${beforeRifle}`
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "aurrasingarmed", set: R, count: 1 },
      { id: "aurrasingsblasterrifle", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const rifle = toPlay(g, "dark", pull(g, "dark", "aurrasingsblasterrifle"));
  const aurra = toPlay(g, "dark", pull(g, "dark", "aurrasingarmed"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [rifle.instanceId, aurra.instanceId]);
  check(
    "Aurra Armed & Dangerous ignores the Weapon card and uses her built-in lightsaber",
    !steps[0]?.darkWeaponCardId && steps[0]?.darkWeaponBonus === 2 && steps[0]?.darkPower === 7,
    JSON.stringify(steps[0])
  );
  check("The ignored blaster stays in play", g.dark.inPlay.some((c) => c.cardId === "aurrasingsblasterrifle"));
}
{
  const g = makeGame(foe(), [{ id: "aurrasingarmed", set: R, count: 1 }]);
  state.runDestinyCompareRound(g);
  const round = g.destinyCompareRounds?.[0];
  check(
    "Aurra Armed & Dangerous counts as 3 when she is the only two-destiny card",
    round?.dark.cardId === "aurrasingarmed" && round.dark.destiny === 3,
    JSON.stringify(round)
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "battledroidpatrolcombobattle", set: R, count: 1 },
      { id: "stap", set: "battleofnaboo", count: 1 },
      { id: "battledroidblasterrifle", set: "battleofnaboo", count: 1 },
      { id: "battledroidinfantrypatroldivision", set: "battleofnaboo", count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "battledroidpatrolcombobattle"));
  const stap = toPlay(g, "dark", pull(g, "dark", "stap"));
  const rifle = toPlay(g, "dark", pull(g, "dark", "battledroidblasterrifle"));
  const droid = toPlay(g, "dark", pull(g, "dark", "battledroidinfantrypatroldivision"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, stap.instanceId, rifle.instanceId, droid.instanceId]);
  check(
    "Battle Droid Patrol lets one battle droid add both weapons and +2",
    steps[0]?.darkBattleCardBonus === 2 && steps[0]?.darkWeaponBonus === 3 && steps[0]?.darkPower === 7,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "boontaevepodracecombobattle", set: R, count: 1 },
      { id: "p17jabbathehutt", set: R, count: 1 },
      { id: "gardullathehuttvilecrimelord", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "boontaevepodracecombobattle"));
  const jabba = toPlay(g, "dark", pull(g, "dark", "p17jabbathehutt"));
  const gardulla = toPlay(g, "dark", pull(g, "dark", "gardullathehuttvilecrimelord"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, jabba.instanceId, gardulla.instanceId]);
  check(
    "Boonta Eve Podrace adds Jabba and Gardulla together for +3",
    steps[0]?.darkCardId2 === "gardullathehuttvilecrimelord" && steps[0]?.darkBattleCardBonus === 3 && steps[0]?.darkPower === 10,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: SABER, set: "thejedicouncil", count: 1 }, { id: OBI, set: OBI_SET, count: 1 }],
    [
      { id: "p4darthmaul", set: R, count: 1 },
      { id: "darthmaulslightsaber", set: "battleofnaboo", count: 1 },
      { id: OBI, set: OBI_SET, count: 7 },
    ]
  );
  const maul = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const saber = toPlay(g, "dark", pull(g, "dark", "darthmaulslightsaber"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const qsaber = toPlay(g, "light", pull(g, "light", SABER));
  for (let i = 0; i < 7; i++) stackTop(g, "dark", OBI);
  stackTop(g, "light", OBI);
  const steps = fight(g, [qsaber.instanceId, qui.instanceId], [saber.instanceId, maul.instanceId]);
  check(
    "Maul Sith Apprentice loses 2 damage while using his lightsaber",
    steps[0]?.winner === "light" && steps[0]?.darkMill === 3,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [
      { id: "coruscantjedicouncilchamber", set: "menaceofdarthmaul", count: 1 },
      { id: PIT, set: PIT_SET, count: 4 },
    ],
    [{ id: "p14darthsidious", set: R, count: 1 }]
  );
  setLocation(g, "coruscantjedicouncilchamber", "menaceofdarthmaul");
  const before = g.light.deck.length;
  const sidious = toHand(g, "dark", pull(g, "dark", "p14darthsidious"));
  playCard(g, sidious.instanceId);
  check("Sidious Phantom Menace deals 2 damage when he deploys to Coruscant", g.light.deck.length === before - 2, `deck ${g.light.deck.length} before ${before}`);
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }, { id: PIT, set: PIT_SET, count: 4 }],
    [{ id: "p14darthsidious", set: R, count: 1 }]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const before = g.light.deck.length;
  const sidious = toHand(g, "dark", pull(g, "dark", "p14darthsidious"));
  playCard(g, sidious.instanceId);
  check("Sidious Phantom Menace deals no deploy damage off Coruscant", g.light.deck.length === before);
}
{
  const g = makeGame(
    foe(),
    [{ id: "gruelingcontestdoubleimpact", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 1 }]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "gruelingcontestdoubleimpact"));
  const pit = toPlay(g, "dark", pull(g, "dark", PIT));
  const foePit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [foePit.instanceId], [battle.instanceId, pit.instanceId]);
  check("Grueling Contest is +2 with a pit droid", steps[0]?.darkBattleCardBonus === 2 && steps[0]?.darkPower === 3, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }],
    [
      { id: "gruelingcontestdoubleimpact", set: R, count: 1 },
      { id: "p5sebulba", set: R, count: 1 },
      { id: PIT, set: PIT_SET, count: 4 },
    ]
  );
  toPlay(g, "dark", pull(g, "dark", "gruelingcontestdoubleimpact"));
  const sebulba = toPlay(g, "dark", pull(g, "dark", "p5sebulba"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  drain(g, "light");
  const steps = fight(g, [qui.instanceId], [sebulba.instanceId]);
  check(
    "Da Dug Chaaa adds 1 power and subtracts 1 damage from a Podracer pilot",
    steps[0]?.darkBasePower === 5 && steps[0]?.winner === "light" && steps[0]?.darkMill === 1,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: "tatooinemosespa", set: "battleofnaboo", count: 1 }, { id: PIT, set: PIT_SET, count: 1 }],
    [{ id: "p17jabbathehutt", set: R, count: 1 }]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  g.controlledPlanets = [{
    locationCardId: "tatooinemosespa",
    locationInstanceId: g.startingLocationInstanceId ?? "loc",
    planet: "tatooine",
    controlledBy: "dark",
    strandedLight: [],
    strandedDark: [],
  }];
  const jabba = toPlay(g, "dark", pull(g, "dark", "p17jabbathehutt"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [jabba.instanceId]);
  check("Jabba Tatooine Tyrant gains +2 after controlling Tatooine", steps[0]?.darkPower === 7 && steps[0]?.darkBonus === 1, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [{ id: "p3queenamidala", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 1 }],
    [
      { id: "letthemmakethefirstmovedoubleimpact", set: R, count: 1 },
      { id: "p4darthmaul", set: R, count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "letthemmakethefirstmovedoubleimpact"));
  battle.doubleImpactChoice = "primary";
  const maul = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const amidala = toPlay(g, "light", pull(g, "light", "p3queenamidala"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  drain(g, "light");
  const steps = fight(g, [amidala.instanceId, pit.instanceId], [battle.instanceId, maul.instanceId]);
  check(
    "Let Them Make The First Move fights the next character after defeating a unique character",
    steps.length === 2 && steps[0]?.winner === "dark" && steps[1]?.darkCardId === "p4darthmaul" && !steps[1]?.darkBattleCardId,
    `steps ${steps.length} ${JSON.stringify(steps.map((s) => s.winner))}`
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "letthemmakethefirstmovedoubleimpact", set: R, count: 1 },
      { id: "sithprobedroidspydrone", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "letthemmakethefirstmovedoubleimpact"));
  battle.doubleImpactChoice = "second";
  const probe = toPlay(g, "dark", pull(g, "dark", "sithprobedroidspydrone"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, probe.instanceId]);
  check("Very Unusual is +3 with a Sith probe droid and does not use the other half", steps[0]?.darkBattleCardBonus === 3 && steps[0]?.darkPower === 4, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    foe(),
    [
      { id: "nowtherearetwoofthemdoubleimpact", set: R, count: 1 },
      { id: "p4darthmaul", set: R, count: 1 },
      { id: "p14darthsidious", set: R, count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "nowtherearetwoofthemdoubleimpact"));
  const maul = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const sidious = toPlay(g, "dark", pull(g, "dark", "p14darthsidious"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, sidious.instanceId, maul.instanceId]);
  check(
    "Now There Are Two Of Them adds Sidious and Maul together",
    steps[0]?.darkCardId2 === "p4darthmaul" && steps[0]?.darkPower === 11,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [
      { id: "nowtherearetwoofthemdoubleimpact", set: R, count: 1 },
      { id: "p4darthmaul", set: R, count: 1 },
      { id: "sithlightsaber", set: "battleofnaboo", count: 1 },
    ]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  toPlay(g, "dark", pull(g, "dark", "nowtherearetwoofthemdoubleimpact"));
  const maul = toHand(g, "dark", pull(g, "dark", "p4darthmaul"));
  playCard(g, maul.instanceId);
  check("The Duel Begins offers a lightsaber when Maul deploys", (g.jediTrainingPending?.choices.length ?? 0) === 1);
  check(
    "The Duel Begins deploys that lightsaber",
    jediTraining.confirmJediTraining(g, "dark", g.jediTrainingPending?.choices[0]?.instanceId ?? "") &&
      g.dark.inPlay.some((c) => c.cardId === "sithlightsaber")
  );
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [{ id: "p18nutegunray", set: R, count: 1 }, { id: "p19runehaako", set: R, count: 1 }]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const nute = toHand(g, "dark", pull(g, "dark", "p18nutegunray"));
  playCard(g, nute.instanceId);
  check("Nute Bureaucrat offers Rune from the deck on Naboo", g.deployFromDeckPending?.foundCardId === "p19runehaako" && g.deployFromDeckPending.toHand !== true);
  const force = state.getForce(g, "dark");
  check(
    "Nute pays Rune's cost and deploys him",
    deployFromDeck.confirmDeployFromDeck(g, "dark") && state.getForce(g, "dark") === force - 2 && g.dark.inPlay.some((c) => c.cardId === "p19runehaako")
  );
}
{
  const g = makeGame(
    [{ id: PIT, set: PIT_SET, count: 1 }, { id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [{ id: "oom9armed", set: R, count: 1 }]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const oom = toPlay(g, "dark", pull(g, "dark", "oom9armed"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [oom.instanceId]);
  check(
    "OOM-9 Armed & Dangerous adds Theed +1 and the built-in weapon +2",
    steps[0]?.darkBonus === 1 && steps[0]?.darkWeaponBonus === 2 && steps[0]?.darkPower === 6,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "opeeseakillerdoubleimpact", set: R, count: 1 },
      { id: "p59armed", set: R, count: 1 },
      { id: "tc14boonta", set: R, count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "opeeseakillerdoubleimpact"));
  battle.doubleImpactChoice = "primary";
  const first = toPlay(g, "dark", pull(g, "dark", "p59armed"));
  const second = toPlay(g, "dark", pull(g, "dark", "tc14boonta"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, first.instanceId, second.instanceId]);
  check("Opee Sea Killer adds +3 only to the first character", steps[0]?.darkBattleCardBonus === 3 && (steps[1]?.darkBattleCardBonus ?? 0) === 0, JSON.stringify(steps.map((s) => s.darkBattleCardBonus)));
}
{
  const g = makeGame(
    [{ id: "tatooinemosespa", set: "battleofnaboo", count: 1 }],
    [
      { id: "orrurruurrboonta", set: R, count: 1 },
      { id: "tuskenraidernomad", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  setLocation(g, "tatooinemosespa", "battleofnaboo");
  const orr = toHand(g, "dark", pull(g, "dark", "orrurruurrboonta"));
  playCard(g, orr.instanceId);
  check("Orr offers a Tusken Raider from the deck on Tatooine", g.deployFromDeckPending?.foundCardId === "tuskenraidernomad");
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [
      { id: "wehavethemontherundoubleimpact", set: R, count: 1 },
      { id: "p59armed", set: R, count: 1 },
      { id: "multitrooptransport", set: "battleofnaboo", count: 1 },
    ]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const effect = toHand(g, "dark", pull(g, "dark", "wehavethemontherundoubleimpact"));
  check("Where Are Those Droidekas deploys for 2", playCard(g, effect.instanceId).applied === true && state.getForce(g, "dark") === 28);
  check(
    "Where Are Those Droidekas makes a Multi Troop Transport free and does not discount P-59",
    state.getWeaponDeployCost(g, "dark", "multitrooptransport", "battleofnaboo") === 0 &&
      state.getWeaponDeployCost(g, "dark", "p59armed", R) === 5
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "wehavethemontherundoubleimpact", set: R, count: 1 },
      { id: "r34destroyerdroidsquaddefensedivision", set: R, count: 1 },
    ]
  );
  toPlay(g, "dark", pull(g, "dark", "wehavethemontherundoubleimpact"));
  const squad = toPlay(g, "dark", pull(g, "dark", "r34destroyerdroidsquaddefensedivision"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [squad.instanceId]);
  check("Where Are Those Droidekas adds +2 power to a destroyer droid", steps[0]?.darkBasePower === 7, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    foe(),
    [
      { id: "podracepreparationcombobatt", set: R, count: 1 },
      { id: "annandtanngellasebulbasattendants", set: "menaceofdarthmaul", count: 1 },
      { id: "p5sebulba", set: R, count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "podracepreparationcombobatt"));
  const ann = toPlay(g, "dark", pull(g, "dark", "annandtanngellasebulbasattendants"));
  const sebulba = toPlay(g, "dark", pull(g, "dark", "p5sebulba"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, ann.instanceId, sebulba.instanceId]);
  check(
    "Podrace Preparation adds Ann and Tann with Sebulba for +3 once",
    steps[0]?.darkCardId2 === "p5sebulba" && steps[0]?.darkBattleCardBonus === 3 && steps[0]?.darkPower === 8,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [
      { id: "p19runehaako", set: R, count: 1 },
      { id: "neimoidianadvisorbureaucrat", set: "battleofnaboo", count: 1 },
      { id: "daultaydofineneimoidianattendant", set: "battleofnaboo", count: 1 },
    ]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const rune = toHand(g, "dark", pull(g, "dark", "p19runehaako"));
  playCard(g, rune.instanceId);
  check(
    "Rune Lieutenant offers a non-unique Neimoidian and skips the unique one",
    g.deployFromDeckPending?.foundCardId === "neimoidianadvisorbureaucrat"
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "p5sebulba", set: R, count: 1 },
      { id: "yokatobanthapoodoo", set: "thejedicouncil", count: 1 },
    ]
  );
  check(
    "Sebulba Champion's Yoka bonus is +2 power",
    state.getGametextBonusForCharacter("p5sebulba", R, "yokatobanthapoodoo", PIT, "thejedicouncil").bonus === 2
  );
}
{
  const g = makeGame(
    [
      { id: "bravo3naboostarfighter", set: "battleofnaboo", count: 1 },
    ],
    [
      { id: "starfighterscreendoubleimpact", set: R, count: 1 },
      { id: "sithinfiltratorstarfighter", set: "battleofnaboo", count: 1 },
      { id: "viceroysbattleshipboonta", set: R, count: 1 },
    ]
  );
  const screen = toHand(g, "dark", pull(g, "dark", "starfighterscreendoubleimpact"));
  const fighter = pull(g, "dark", "sithinfiltratorstarfighter");
  const transport = pull(g, "dark", "viceroysbattleshipboonta");
  const bravo = pull(g, "light", "bravo3naboostarfighter");
  g.dark.hyperspace = [fighter, transport];
  g.light.hyperspace = [bravo];
  fighter.zone = "hyperspace";
  transport.zone = "hyperspace";
  bravo.zone = "hyperspace";
  g.darkDeclaredBattleCards = [screen.instanceId];
  g.starshipBattleAttacker = "dark";
  g.lightBattlePlanOrder = [bravo.instanceId];
  g.darkBattlePlanOrder = [screen.instanceId, fighter.instanceId, transport.instanceId];
  drain(g, "dark");
  drain(g, "light");
  hyperspace.resolveStarshipBattle(g);
  const step = g.battleRevealSequence?.[0];
  check(
    "Starfighter Screen fights a starfighter and a transport together",
    step?.darkPower === 9 && step?.lightPower === 3 && step?.winner === "dark",
    JSON.stringify(step)
  );
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }, { id: PIT, set: PIT_SET, count: 1 }, { id: QUI, set: R, count: 1 }],
    [{ id: "starfighterscreendoubleimpact", set: R, count: 1 }]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const effect = toHand(g, "dark", pull(g, "dark", "starfighterscreendoubleimpact"));
  check("Blockade deploys for 2", playCard(g, effect.instanceId).applied === true && state.getForce(g, "dark") === 28, `force ${state.getForce(g, "dark")}`);
  g.phase = "even_up";
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const began = pounded.beginPoundedUntoDeath(g, "dark", effect.instanceId);
  const uniqueOffered = began.ok && (g.poundedPending?.targets ?? []).some((t) => t.cardId === QUI);
  const pitOffered = (g.poundedPending?.targets ?? []).some((t) => t.instanceId === pit.instanceId);
  check("Blockade can discard a non-unique card and does not offer a unique character", began.ok && pitOffered && !uniqueOffered, JSON.stringify(g.poundedPending));
  check("Blockade discards the chosen card and itself", pounded.confirmPoundedUntoDeath(g, "dark", pit.instanceId).ok && g.light.discard.some((c) => c.cardId === PIT));
}
{
  const g = makeGame(
    foe(),
    [
      { id: "switchtobiocombobattle", set: R, count: 1 },
      { id: "daultaydofineneimoidianattendant", set: "battleofnaboo", count: 1 },
      { id: "r34destroyerdroidsquaddefensedivision", set: R, count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "switchtobiocombobattle"));
  const daultay = toPlay(g, "dark", pull(g, "dark", "daultaydofineneimoidianattendant"));
  const squad = toPlay(g, "dark", pull(g, "dark", "r34destroyerdroidsquaddefensedivision"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, daultay.instanceId, squad.instanceId]);
  check(
    "Switch To Bio adds Daultay and a destroyer droid for +3",
    steps[0]?.darkCardId2 === "r34destroyerdroidsquaddefensedivision" && steps[0]?.darkBattleCardBonus === 3 && steps[0]?.darkPower === 11,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: SABER, set: "thejedicouncil", count: 1 }, { id: "nabootheedpalace", set: "battleofnaboo", count: 1 }],
    [{ id: "thephantommenacecombobattle", set: R, count: 1 }, { id: "p14darthsidious", set: R, count: 1 }]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "thephantommenacecombobattle"));
  const sidious = toPlay(g, "dark", pull(g, "dark", "p14darthsidious"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const saber = toPlay(g, "light", pull(g, "light", SABER));
  drain(g, "dark");
  stackTop(g, "light", "nabootheedpalace");
  const steps = fight(g, [saber.instanceId, qui.instanceId], [battle.instanceId, sidious.instanceId]);
  check(
    "The Phantom Menace returns Sidious with no damage when a Jedi defeats him",
    steps[0]?.winner === "light" && (steps[0]?.darkMill ?? 0) === 0 && g.dark.hand.some((c) => c.cardId === "p14darthsidious") && !g.dark.discard.some((c) => c.cardId === "p14darthsidious"),
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [{ id: "thephantommenacecombobattle", set: R, count: 1 }, { id: "p14darthsidious", set: R, count: 1 }]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "thephantommenacecombobattle"));
  const sidious = toPlay(g, "dark", pull(g, "dark", "p14darthsidious"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, sidious.instanceId]);
  check("The Phantom Menace adds no power against a non-Jedi", (steps[0]?.darkBattleCardBonus ?? 0) === 0 && steps[0]?.darkPower === 5, JSON.stringify(steps[0]));
}
{
  const g = makeGame(
    [{ id: "coruscantgalacticsenate", set: "battleofnaboo", count: 1 }, { id: PIT, set: PIT_SET, count: 1 }],
    [{ id: "toonbucktooraarmed", set: R, count: 1 }]
  );
  setLocation(g, "coruscantgalacticsenate", "battleofnaboo");
  const toon = toPlay(g, "dark", pull(g, "dark", "toonbucktooraarmed"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [toon.instanceId]);
  check(
    "Toonbuck adds Senate +2 and his taxi +2",
    steps[0]?.darkBonus === 2 && steps[0]?.darkWeaponBonus === 2 && steps[0]?.darkPower === 7,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: SABER, set: "thejedicouncil", count: 1 }],
    [
      { id: "p6tradefederationtank", set: R, count: 1 },
      { id: "tradefederationtanklasercannon", set: "battleofnaboo", count: 1 },
      { id: OBI, set: OBI_SET, count: 4 },
    ]
  );
  const tank = toPlay(g, "dark", pull(g, "dark", "p6tradefederationtank"));
  const cannon = toPlay(g, "dark", pull(g, "dark", "tradefederationtanklasercannon"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const saber = toPlay(g, "light", pull(g, "light", SABER));
  drain(g, "light");
  for (let i = 0; i < 4; i++) stackTop(g, "dark", OBI);
  const steps = fight(g, [saber.instanceId, qui.instanceId], [cannon.instanceId, tank.instanceId]);
  check(
    "Trade Federation Tank loses 2 damage while using its laser cannon",
    steps[0]?.winner === "light" && steps[0]?.darkMill === 1 && steps[0]?.darkWeaponBonus === 3,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: "p3queenamidala", set: R, count: 1 }],
    [{ id: "viceroysbattleshipboonta", set: R, count: 1 }, { id: "p18nutegunray", set: R, count: 1 }]
  );
  g.evacuationState = {
    evacuatingSide: "dark",
    transportInstanceId: "ship",
    transportCardId: "viceroysbattleshipboonta",
    targetPlanetIndex: -1,
    stackedCards: [{ instanceId: "n", cardId: "p18nutegunray" }],
    awaitingInterception: true,
  };
  check("Viceroy's Battleship gains +3 while evacuating Nute", state.getEvacuatingStarshipPowerBonus(g, "dark", "viceroysbattleshipboonta") === 3);
  g.evacuationState.stackedCards = [{ instanceId: "q", cardId: "p3queenamidala" }];
  check("Viceroy's Battleship gains nothing while evacuating Amidala", state.getEvacuatingStarshipPowerBonus(g, "dark", "viceroysbattleshipboonta") === 0);
}
{
  const g = makeGame(
    foe(),
    [
      { id: "p15watto", set: R, count: 1 },
      { id: "wattoswager", set: "menaceofdarthmaul", count: 1 },
      { id: "p14darthsidious", set: R, count: 1 },
      { id: "r40jabbathehuttcrimelord", set: R, count: 1 },
    ]
  );
  g.darkPlayerId = "bot_1";
  const battle = toHand(g, "dark", pull(g, "dark", "wattoswager"));
  const watto = toPlay(g, "dark", pull(g, "dark", "p15watto"));
  stackTop(g, "dark", "r40jabbathehuttcrimelord");
  stackTop(g, "dark", "p14darthsidious");
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  const steps = fight(g, [pit.instanceId], [battle.instanceId, watto.instanceId]);
  check(
    "Watto Risk Taker draws two destiny cards and keeps the higher one",
    steps[0]?.darkBattleCardBonus === 6 && g.dark.hand.some((c) => c.cardId === "p14darthsidious") && g.dark.hand.some((c) => c.cardId === "r40jabbathehuttcrimelord"),
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "wehavethemontherundoubleimpact", set: R, count: 1 },
      { id: "p19runehaako", set: R, count: 1 },
      { id: "r34destroyerdroidsquaddefensedivision", set: R, count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "wehavethemontherundoubleimpact"));
  const rune = toPlay(g, "dark", pull(g, "dark", "p19runehaako"));
  const squad = toPlay(g, "dark", pull(g, "dark", "r34destroyerdroidsquaddefensedivision"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, rune.instanceId, squad.instanceId]);
  check(
    "We Have Them On The Run adds Rune and a destroyer droid squad together",
    steps[0]?.darkCardId2 === "r34destroyerdroidsquaddefensedivision" && steps[0]?.darkPower === 8,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [{ id: "youhavebeenwelltraineddoubleimpact", set: R, count: 1 }, { id: "tc14boonta", set: R, count: 2 }]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "youhavebeenwelltraineddoubleimpact"));
  const a = toPlay(g, "dark", pull(g, "dark", "tc14boonta"));
  const b = toPlay(g, "dark", pull(g, "dark", "tc14boonta"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, a.instanceId, b.instanceId]);
  check(
    "You Have Been Well Trained adds two copies from the same character",
    steps.length === 1 && steps[0]?.darkCardId2 === "tc14boonta" && steps[0]?.darkPower === 2,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "youhavebeenwelltrained", set: "menaceofdarthmaul", count: 1 },
      { id: "tc14boonta", set: R, count: 2 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "youhavebeenwelltrained"));
  const a = toPlay(g, "dark", pull(g, "dark", "tc14boonta"));
  const b = toPlay(g, "dark", pull(g, "dark", "tc14boonta"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, a.instanceId, b.instanceId]);
  check(
    "The older You Have Been Well Trained also adds two copies of the same character",
    steps.length === 1 && steps[0]?.darkCardId2 === "tc14boonta" && steps[0]?.darkPower === 2,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    foe(),
    [
      { id: "youhavebeenwelltrained", set: "menaceofdarthmaul", count: 1 },
      { id: "p4darthmaul", set: R, count: 1 },
      { id: "darthmaulsithapprentice", set: "menaceofdarthmaul", count: 1 },
    ]
  );
  const battle = toHand(g, "dark", pull(g, "dark", "youhavebeenwelltrained"));
  const a = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const b = toPlay(g, "dark", pull(g, "dark", "darthmaulsithapprentice"));
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  drain(g, "dark");
  const steps = fight(g, [pit.instanceId], [battle.instanceId, a.instanceId, b.instanceId]);
  check(
    "You Have Been Well Trained adds two different cards of the same character",
    steps[0]?.darkCardId2 === "darthmaulsithapprentice" && steps[0]?.darkPower === 12,
    JSON.stringify(steps[0])
  );
}
{
  const g = makeGame(
    [{ id: "nabootheedpalace", set: "battleofnaboo", count: 1 }, { id: PIT, set: PIT_SET, count: 1 }, { id: QUI, set: R, count: 1 }],
    [{ id: "blockade", set: "duelofthefates", count: 1 }]
  );
  setLocation(g, "nabootheedpalace", "battleofnaboo");
  const effect = toHand(g, "dark", pull(g, "dark", "blockade"));
  check("The older Blockade deploys for 2", playCard(g, effect.instanceId).applied === true && state.getForce(g, "dark") === 28);
  g.phase = "even_up";
  const pit = toPlay(g, "light", pull(g, "light", PIT));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const began = pounded.beginPoundedUntoDeath(g, "dark", effect.instanceId);
  const offered = (g.poundedPending?.targets ?? []).map((t) => t.cardId);
  check("The older Blockade offers the non-unique character and not the unique one", began.ok && offered.includes(PIT) && !offered.includes(QUI), offered.join(","));
  check(
    "The older Blockade removes that character from the planet",
    pounded.confirmPoundedUntoDeath(g, "dark", pit.instanceId).ok &&
      !g.light.inPlay.some((c) => c.instanceId === pit.instanceId) &&
      g.light.discard.some((c) => c.cardId === PIT) &&
      g.light.inPlay.some((c) => c.cardId === QUI) &&
      !g.dark.inPlay.some((c) => c.instanceId === effect.instanceId)
  );
}
{
  const g = makeGame(
    [{ id: "p3queenamidala", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 6 }],
    [{ id: "youhavebeenwelltraineddoubleimpact", set: R, count: 1 }, { id: "p4darthmaul", set: R, count: 1 }]
  );
  toPlay(g, "dark", pull(g, "dark", "youhavebeenwelltraineddoubleimpact"));
  const maul = toPlay(g, "dark", pull(g, "dark", "p4darthmaul"));
  const queen = toPlay(g, "light", pull(g, "light", "p3queenamidala"));
  drain(g, "dark");
  const steps = fight(g, [queen.instanceId], [maul.instanceId]);
  check("After Her adds 2 damage to Queen Amidala", steps[0]?.winner === "dark" && steps[0]?.lightMill === 5, `mill ${steps[0]?.lightMill}`);
}
{
  const g = makeGame(
    [{ id: "eirtaehandmaiden", set: "thejedicouncil", count: 1 }],
    [{ id: "r41runehaakoneimoidiandeputy", set: R, count: 1 }]
  );
  const rune = toPlay(g, "dark", pull(g, "dark", "r41runehaakoneimoidiandeputy"));
  const maid = toPlay(g, "light", pull(g, "light", "eirtaehandmaiden"));
  drain(g, "dark");
  const steps = fight(g, [maid.instanceId], [rune.instanceId]);
  check("Rune Deputy gains +3 against a handmaiden", steps[0]?.darkPower === 6, `power ${steps[0]?.darkPower}`);
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: SABER, set: "thejedicouncil", count: 1 }],
    [{ id: "r45darthmaulstudentofthedarkside", set: R, count: 1 }, { id: "sithlightsaber", set: "battleofnaboo", count: 1 }]
  );
  const maul = toPlay(g, "dark", pull(g, "dark", "r45darthmaulstudentofthedarkside"));
  const saber = toPlay(g, "dark", pull(g, "dark", "sithlightsaber"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const qsaber = toPlay(g, "light", pull(g, "light", SABER));
  drain(g, "light");
  drain(g, "dark");
  const steps = fight(g, [qsaber.instanceId, qui.instanceId], [saber.instanceId, maul.instanceId]);
  check("Maul Student does not gain his duel bonus in a battle", steps[0]?.darkPower === 7, `power ${steps[0]?.darkPower}`);
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 12 }],
    [{ id: "r45darthmaulstudentofthedarkside", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 12 }]
  );
  const maul = toPlay(g, "dark", pull(g, "dark", "r45darthmaulstudentofthedarkside"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  g.phase = "battle";
  g.duelUsedThisTurn = false;
  const saber = {
    instanceId: "sith_saber_test",
    cardId: "sithlightsaber",
    cardSet: "battleofnaboo",
    ownerSide: "dark" as Side,
    zone: "in_play" as const,
    faceDown: false,
  };
  g.dark.inPlay.push(saber);
  check("Maul Student can start a duel", duel.initiateDuel(g, "dark", maul.instanceId, saber.instanceId) === true);
  duel.chooseDuelTarget(g, "dark", qui.instanceId);
  check("Maul Student gains +2 while dueling a Jedi", g.duelState?.darkPower === 9, `power ${g.duelState?.darkPower}`);
}
{
  const g = makeGame(
    [{ id: "coruscantjedicouncilchamber", set: "menaceofdarthmaul", count: 1 }],
    [{ id: "r46darthsidiousmasterofthedarkside", set: R, count: 1 }, { id: PIT, set: PIT_SET, count: 6 }]
  );
  const sidious = pull(g, "dark", "r46darthsidiousmasterofthedarkside");
  g.controlledPlanets = [{
    locationCardId: "coruscantjedicouncilchamber",
    locationInstanceId: "cp",
    planet: "coruscant",
    controlledBy: "dark",
    strandedLight: [],
    strandedDark: [{ instanceId: sidious.instanceId, cardId: sidious.cardId, cardSet: R }],
  }];
  const handIds = [0, 1, 2].map(() => toHand(g, "dark", pull(g, "dark", PIT)).instanceId);
  const began = winControl.beginWinControl(g, "dark", sidious.instanceId, 0);
  const confirmed = winControl.confirmWinControl(g, "dark", handIds);
  check(
    "Sidious Master discards himself and three cards, then draws three",
    began.ok && confirmed.ok && g.dark.discard.some((c) => c.cardId === "r46darthsidiousmasterofthedarkside") && g.dark.hand.length === 3,
    `began ${began.ok} confirmed ${confirmed.ok} hand ${g.dark.hand.length}`
  );
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }],
    [
      { id: "r47aurrasingtrophycollector", set: R, count: 1 },
      { id: "sithlightsaber", set: "battleofnaboo", count: 1 },
      { id: "darthmaulslightsaber", set: "battleofnaboo", count: 1 },
    ]
  );
  const aurra = toPlay(g, "dark", pull(g, "dark", "r47aurrasingtrophycollector"));
  const open = toPlay(g, "dark", pull(g, "dark", "sithlightsaber"));
  const unique = toPlay(g, "dark", pull(g, "dark", "darthmaulslightsaber"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  drain(g, "dark");
  const withOpen = fight(g, [qui.instanceId], [open.instanceId, aurra.instanceId]);
  check(
    "Aurra Trophy Collector gains +2 against a Jedi and may use a non-unique Sith Lightsaber",
    state.characterGrantsWeaponUse("r47aurrasingtrophycollector", "sithlightsaber", "battleofnaboo") &&
      !state.characterGrantsWeaponUse("r47aurrasingtrophycollector", "darthmaulslightsaber", "battleofnaboo") &&
      withOpen[0]?.darkPower === 8,
    JSON.stringify(withOpen[0])
  );
  check("The unique Sith Lightsaber stays unused beside her", g.dark.inPlay.some((c) => c.instanceId === unique.instanceId));
}
{
  const g = makeGame(
    [{ id: QUI, set: R, count: 1 }, { id: SABER, set: "thejedicouncil", count: 1 }, { id: OBI, set: OBI_SET, count: 1 }],
    [
      { id: "r37darthsidioussithmanipulator", set: R, count: 1 },
      { id: "sithlightsaber", set: "battleofnaboo", count: 1 },
      { id: OBI, set: OBI_SET, count: 7 },
    ]
  );
  const sidious = toPlay(g, "dark", pull(g, "dark", "r37darthsidioussithmanipulator"));
  const saber = toPlay(g, "dark", pull(g, "dark", "sithlightsaber"));
  const qui = toPlay(g, "light", pull(g, "light", QUI));
  const qsaber = toPlay(g, "light", pull(g, "light", SABER));
  for (let i = 0; i < 7; i++) stackTop(g, "dark", OBI);
  stackTop(g, "light", OBI);
  const steps = fight(g, [qsaber.instanceId, qui.instanceId], [saber.instanceId, sidious.instanceId]);
  check(
    "Sidious Manipulator gains +1 power and loses 1 damage with a Sith Lightsaber",
    steps[0]?.darkPower === 8 && steps[0]?.winner === "light" && steps[0]?.darkMill === 5,
    JSON.stringify(steps[0])
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
