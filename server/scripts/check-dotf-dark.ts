/**
 * Dark side Duel of the Fates checks. Run from server/:
 * npx ts-node scripts/check-dotf-dark.ts
 */
import { initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import {
  createGameState,
  resolveBattlePlan,
  declineDamageReplace,
  confirmDamageReplace,
  getWeaponDeployCost,
  startEffectActivation,
  resolveOppDeckPeek,
  placeHandCardUnderDeck,
  type GameStateData,
} from "../src/game/state";
import { resolveStarshipBattle } from "../src/game/hyperspace";
import {
  maybeBeginDeployFromDeck,
  beginInPlayDeployFromDeck,
  confirmDeployFromDeck,
} from "../src/game/deploy-from-deck";
import { maybeBeginDeployDraw, confirmDeployDraw, declineDeployDraw } from "../src/game/deploy-draw";
import * as jediTraining from "../src/game/jedi-training";
import * as pounded from "../src/game/pounded";
import * as winControl from "../src/game/win-control";
import { initiateDuel, chooseDuelTarget, playDuelCard, discardDuelCardForDraw, removeDuelHit } from "../src/game/duel";

initCards();

const DOTF = "duelofthefates";
const MENACE = "menaceofdarthmaul";
const NABOO = "battleofnaboo";
const COUNCIL = "thejedicouncil";

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

let seq = 0;
function card(side: Side, id: string, set: string, zone: CardInstance["zone"]): CardInstance {
  seq += 1;
  return { instanceId: "d" + seq, cardId: id, cardSet: set, ownerSide: side, zone, faceDown: false };
}

function game(label: string): GameStateData {
  const g = createGameState(label, "table", "human", "human2", "You", "Them", 60000);
  g.ruleset = "dotf";
  g.phase = "battle";
  g.turnSide = "light";
  for (const p of [g.light, g.dark]) {
    p.deck = [];
    p.hand = [];
    p.inPlay = [];
    p.discard = [];
    p.hyperspace = [];
    p.force = 6;
  }
  return g;
}

function play(g: GameStateData, side: Side, c: CardInstance): CardInstance {
  const p = side === "light" ? g.light : g.dark;
  c.ownerSide = side;
  c.zone = "in_play";
  p.inPlay.push(c);
  return c;
}
function hand(g: GameStateData, side: Side, c: CardInstance): CardInstance {
  const p = side === "light" ? g.light : g.dark;
  c.ownerSide = side;
  c.zone = "hand";
  p.hand.push(c);
  return c;
}
function deckTop(g: GameStateData, side: Side, id: string, set: string): CardInstance {
  const c = card(side, id, set, "deck");
  (side === "light" ? g.light : g.dark).deck.push(c);
  return c;
}
function fuel(g: GameStateData, side: Side, destiny: 1 | 6, count: number): void {
  const id = destiny === 1 ? "quigonjinnjedimentor" : "queenamidalayoungleader";
  for (let i = 0; i < count; i++) deckTop(g, side, id, setOf(id));
}
function setOf(id: string): string {
  return id === "quigonjinnjedimentor" || id === "queenamidalayoungleader" ? DOTF : DOTF;
}
function location(g: GameStateData, id: string, set: string): void {
  const loc = play(g, "light", card("light", id, set, "in_play"));
  g.startingLocationInstanceId = loc.instanceId;
}
function fight(g: GameStateData, lightIds: string[], darkIds: string[]) {
  g.lightBattlePlanOrder = lightIds;
  g.darkBattlePlanOrder = darkIds;
  g.battlePlanPhase = true;
  resolveBattlePlan(g);
  return g.battleRevealSequence?.[0];
}
function ships(g: GameStateData, lightOrder: string[], darkOrder: string[], darkDeclared: string[] = []) {
  g.lightBattlePlanOrder = lightOrder;
  g.darkBattlePlanOrder = darkOrder;
  g.darkDeclaredBattleCards = darkDeclared;
  g.starshipBattleAttacker = "dark";
  resolveStarshipBattle(g);
  return g.battleRevealSequence?.[0];
}
function run(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    check(name, false, err instanceof Error ? err.message : String(err));
  }
}

run("Darth Maul gains 2 while dueling Qui-Gon", () => {
  const g = game("maul-duel");
  g.turnSide = "dark";
  location(g, "tatooinepodracearena", MENACE);
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const saber = play(g, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  fuel(g, "dark", 1, 9);
  fuel(g, "light", 1, 8);
  const started = initiateDuel(g, "dark", maul.instanceId, saber.instanceId) && chooseDuelTarget(g, "dark", qui.instanceId);
  const d = g.duelState;
  check(
    "Darth Maul gains 2 while dueling Qui-Gon",
    !!started && d?.darkPower === 9 && d.lightPower === 8,
    `started ${!!started} dark ${d?.darkPower} light ${d?.lightPower} (expected 9 = Maul 6 + saber 1 + dueling 2, Qui-Gon 8 = 6 + his own dueling 2)`
  );
});

run("Darth Maul has no Jedi bonus against Obi-Wan", () => {
  const g = game("maul-obi");
  g.turnSide = "dark";
  location(g, "tatooinepodracearena", MENACE);
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const saber = play(g, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const obi = play(g, "light", card("light", "obiwankenobijedistudent", DOTF, "in_play"));
  fuel(g, "dark", 1, 9);
  fuel(g, "light", 1, 8);
  initiateDuel(g, "dark", maul.instanceId, saber.instanceId);
  chooseDuelTarget(g, "dark", obi.instanceId);
  const d = g.duelState;
  check(
    "Darth Maul has no Jedi bonus against Obi-Wan",
    d?.darkPower === 7,
    `dark ${d?.darkPower} (expected 7 = Maul 6 + saber 1; Obi-Wan has no Jedi trait)`
  );
});

run("Aurra Sing gains 2 against a Jedi trait and not against Obi-Wan", () => {
  const vsQui = game("aurra-qui");
  location(vsQui, "tatooinepodracearena", MENACE);
  const aurra = play(vsQui, "dark", card("dark", "aurrasingtrophycollector", DOTF, "in_play"));
  const qui = play(vsQui, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const quiStep = fight(vsQui, [qui.instanceId], [aurra.instanceId]);
  const vsObi = game("aurra-obi");
  location(vsObi, "tatooinepodracearena", MENACE);
  const aurra2 = play(vsObi, "dark", card("dark", "aurrasingtrophycollector", DOTF, "in_play"));
  const obi = play(vsObi, "light", card("light", "obiwankenobijedistudent", DOTF, "in_play"));
  const obiStep = fight(vsObi, [obi.instanceId], [aurra2.instanceId]);
  check(
    "Aurra Sing gains 2 against a Jedi trait and not against Obi-Wan",
    quiStep?.darkPower === 7 && obiStep?.darkPower === 5,
    `vs Qui-Gon ${quiStep?.darkPower}, vs Obi-Wan ${obiStep?.darkPower} (expected 7 and 5)`
  );
});

run("Aurra uses her stolen lightsaber", () => {
  const g = game("aurra-saber");
  location(g, "tatooinepodracearena", MENACE);
  const saber = play(g, "dark", card("dark", "jedilightsaberstolenbyaurrasing", DOTF, "in_play"));
  const aurra = play(g, "dark", card("dark", "aurrasingtrophycollector", DOTF, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(g, "dark", 1, 1);
  const step = fight(g, [foe.instanceId], [saber.instanceId, aurra.instanceId]);
  check(
    "Aurra uses her stolen lightsaber",
    step?.darkWeaponCardId === saber.cardId && step.darkPower === 8,
    `weapon ${step?.darkWeaponCardId} power ${step?.darkPower} base ${step?.darkBasePower} bonus ${step?.darkBonus} weapon bonus ${step?.darkWeaponBonus} draws ${(step?.darkDestinyDraws ?? []).map((d) => d.destiny).join(",")}`
  );
});

run("Aurra may carry a non-unique Sith lightsaber", () => {
  const g = game("aurra-sith");
  location(g, "tatooinepodracearena", MENACE);
  const saber = play(g, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const aurra = play(g, "dark", card("dark", "aurrasingtrophycollector", DOTF, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(g, "dark", 1, 1);
  const step = fight(g, [foe.instanceId], [saber.instanceId, aurra.instanceId]);
  check(
    "Aurra may carry a non-unique Sith lightsaber",
    step?.darkWeaponCardId === saber.cardId && step.darkPower === 7 && (step.darkDestinyDraws?.length ?? 0) === 1,
    `weapon ${step?.darkWeaponCardId ?? "none"} power ${step?.darkPower} draws ${step?.darkDestinyDraws?.length ?? 0} (expected 7 = Aurra 5 + saber 1 + destiny 1)`
  );
});

run("Tey How adds 1 power to your transport", () => {
  const g = game("tey");
  location(g, "tatooinepodracearena", MENACE);
  play(g, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "in_play"));
  const mine = card("dark", "battleshiptradefederationtransport", MENACE, "hyperspace");
  const theirs = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  g.dark.hyperspace = [mine];
  g.light.hyperspace = [theirs];
  fuel(g, "light", 1, 1);
  const step = ships(g, [theirs.instanceId], [mine.instanceId]);
  check(
    "Tey How adds 1 power to your transport",
    step?.darkPower === 6,
    `dark ${step?.darkPower} (expected 6 = transport 5 + Tey 1)`
  );
});

run("Rayno Vaca gains 2 while using a Coruscant Taxi", () => {
  const g = game("rayno");
  location(g, "tatooinepodracearena", MENACE);
  const taxi = play(g, "dark", card("dark", "coruscanttaxi", DOTF, "in_play"));
  const rayno = play(g, "dark", card("dark", "raynovacataxidriver", DOTF, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(g, "dark", 1, 1);
  const step = fight(g, [foe.instanceId], [taxi.instanceId, rayno.instanceId]);
  check(
    "Rayno Vaca gains 2 while using a Coruscant Taxi",
    step?.darkPower === 5,
    `dark ${step?.darkPower} (expected 5 = Rayno 2 + taxi destiny 1 + his bonus 2)`
  );
});

run("Coruscant Taxi gives a senator its printed bonus", () => {
  const g = game("taxi-senator");
  location(g, "tatooinepodracearena", MENACE);
  const taxi = play(g, "dark", card("dark", "coruscanttaxi", DOTF, "in_play"));
  const senator = play(g, "dark", card("dark", "baskolyeesrimgransenator", DOTF, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(g, "dark", 1, 1);
  const step = fight(g, [foe.instanceId], [taxi.instanceId, senator.instanceId]);
  check(
    "Coruscant Taxi gives a senator its printed bonus",
    step?.darkPower === 4,
    `dark ${step?.darkPower} (expected 4 = senator 2 + taxi 1 + destiny 1)`
  );
});

run("Neimoidian Viewscreen gives Nute 2 and another Neimoidian 1", () => {
  const nuteGame = game("view-nute");
  location(nuteGame, "tatooinepodracearena", MENACE);
  const screen = play(nuteGame, "dark", card("dark", "neimoidianviewscreen", DOTF, "in_play"));
  const nute = play(nuteGame, "dark", card("dark", "nutegunrayneimoidianviceroy", COUNCIL, "in_play"));
  const foe = play(nuteGame, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(nuteGame, "dark", 1, 1);
  const nuteStep = fight(nuteGame, [foe.instanceId], [screen.instanceId, nute.instanceId]);
  const teyGame = game("view-tey");
  location(teyGame, "tatooinepodracearena", MENACE);
  const screen2 = play(teyGame, "dark", card("dark", "neimoidianviewscreen", DOTF, "in_play"));
  const tey = play(teyGame, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "in_play"));
  const foe2 = play(teyGame, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(teyGame, "dark", 1, 1);
  const teyStep = fight(teyGame, [foe2.instanceId], [screen2.instanceId, tey.instanceId]);
  check(
    "Neimoidian Viewscreen gives Nute 2 and another Neimoidian 1",
    nuteStep?.darkPower === 6 && teyStep?.darkPower === 3,
    `Nute ${nuteStep?.darkPower}, Tey ${teyStep?.darkPower} (expected 6 and 3)`
  );
});

run("Battle Droid Patrol uses a STAP and a blaster rifle", () => {
  const g = game("patrol");
  location(g, "coruscantcapitalcity", MENACE);
  const battle = hand(g, "dark", card("dark", "battledroidpatrol", DOTF, "hand"));
  const stap = play(g, "dark", card("dark", "stap", MENACE, "in_play"));
  const rifle = play(g, "dark", card("dark", "battledroidblasterrifle", MENACE, "in_play"));
  const droid = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(g, "dark", 1, 2);
  const step = fight(g, [foe.instanceId], [battle.instanceId, stap.instanceId, rifle.instanceId, droid.instanceId]);
  check(
    "Battle Droid Patrol uses a STAP and a blaster rifle",
    (step?.darkDestinyDraws?.length ?? 0) === 2 && step?.darkPower === 7,
    `draws ${step?.darkDestinyDraws?.length} power ${step?.darkPower} (expected 2 draws and power 7)`
  );
});

run("Change In Tactics swaps a lower destiny and leaves a higher one", () => {
  const low = game("change-low");
  location(low, "tatooinemosespa", COUNCIL);
  const battle = hand(low, "dark", card("dark", "changeintactics", DOTF, "hand"));
  const saber = play(low, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const maul = play(low, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const blaster = play(low, "light", card("light", "blaster_light", MENACE, "in_play"));
  const foe = play(low, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  deckTop(low, "dark", "quigonjinnjedimentor", DOTF);
  deckTop(low, "light", "queenamidalayoungleader", DOTF);
  const lowStep = fight(low, [blaster.instanceId, foe.instanceId], [battle.instanceId, saber.instanceId, maul.instanceId]);
  const high = game("change-high");
  location(high, "tatooinemosespa", COUNCIL);
  const battle2 = hand(high, "dark", card("dark", "changeintactics", DOTF, "hand"));
  const saber2 = play(high, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const maul2 = play(high, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const blaster2 = play(high, "light", card("light", "blaster_light", MENACE, "in_play"));
  const foe2 = play(high, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  deckTop(high, "dark", "queenamidalayoungleader", DOTF);
  deckTop(high, "light", "quigonjinnjedimentor", DOTF);
  const highStep = fight(high, [blaster2.instanceId, foe2.instanceId], [battle2.instanceId, saber2.instanceId, maul2.instanceId]);
  check(
    "Change In Tactics swaps a lower destiny and leaves a higher one",
    lowStep?.darkPower === 13 && lowStep.lightPower === 4 && highStep?.darkPower === 13 && highStep.lightPower === 4,
    `low dark ${lowStep?.darkPower} light ${lowStep?.lightPower}; high dark ${highStep?.darkPower} light ${highStep?.lightPower}`
  );
});

run("Dangerous Encounter adds 2 damage on a win and 1 on a loss", () => {
  const win = game("danger-win");
  location(win, "tatooinemosespa", COUNCIL);
  const battle = hand(win, "dark", card("dark", "dangerousencounter", DOTF, "hand"));
  const maul = play(win, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const foe = play(win, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const winStep = fight(win, [foe.instanceId], [battle.instanceId, maul.instanceId]);
  const lose = game("danger-lose");
  location(lose, "tatooinemosespa", COUNCIL);
  const battle2 = hand(lose, "dark", card("dark", "dangerousencounter", DOTF, "hand"));
  const tey = play(lose, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "in_play"));
  const foe2 = play(lose, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const loseStep = fight(lose, [foe2.instanceId], [battle2.instanceId, tey.instanceId]);
  check(
    "Dangerous Encounter adds 2 damage on a win and 1 on a loss",
    winStep?.winner === "dark" && winStep.lightMill === 4 && loseStep?.winner === "light" && loseStep.darkMill === 3,
    `win mill ${winStep?.lightMill} lose mill ${loseStep?.darkMill} (expected 4 and 3)`
  );
});

run("Darth Maul Defiant adds the destiny difference", () => {
  const g = game("defiant");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "dark", card("dark", "darthmauldefiant", DOTF, "hand"));
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const step = fight(g, [foe.instanceId], [battle.instanceId, maul.instanceId]);
  check(
    "Darth Maul Defiant adds the destiny difference",
    step?.darkPower === 8,
    `dark ${step?.darkPower} (expected 8 = Maul 6 + Ishi destiny 3 minus Maul destiny 1)`
  );
});

run("Impossible adds 3 to Tey How and to a transport", () => {
  const person = game("impossible-tey");
  location(person, "tatooinepodracearena", MENACE);
  const battle = hand(person, "dark", card("dark", "impossible", DOTF, "hand"));
  const tey = play(person, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "in_play"));
  const foe = play(person, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const personStep = fight(person, [foe.instanceId], [battle.instanceId, tey.instanceId]);
  const ship = game("impossible-ship");
  location(ship, "tatooinepodracearena", MENACE);
  const battle2 = hand(ship, "dark", card("dark", "impossible", DOTF, "hand"));
  const mine = card("dark", "battleshiptradefederationtransport", MENACE, "hyperspace");
  const theirs = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  ship.dark.hyperspace = [mine];
  ship.light.hyperspace = [theirs];
  fuel(ship, "light", 1, 1);
  const shipStep = ships(ship, [theirs.instanceId], [battle2.instanceId, mine.instanceId], [battle2.instanceId]);
  check(
    "Impossible adds 3 to Tey How and to a transport",
    personStep?.darkPower === 4 && shipStep?.darkPower === 8 && shipStep.darkBattleCardBonus === 3,
    `Tey ${personStep?.darkPower} ship ${shipStep?.darkPower} bonus ${shipStep?.darkBattleCardBonus}`
  );
});

run("It's A Standoff loses only the destroyer droid", () => {
  const g = game("standoff");
  location(g, "coruscantcapitalcity", MENACE);
  const battle = hand(g, "dark", card("dark", "itsastandoff", DOTF, "hand"));
  const p59 = play(g, "dark", card("dark", "p59destroyerdroidcommander", NABOO, "in_play"));
  const wheel = play(g, "dark", card("dark", "destroyerdroidwheeldroid", MENACE, "in_play"));
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const saber = play(g, "light", card("light", "quigonjinnslightsaberwieldedbyobiwan", DOTF, "in_play"));
  fuel(g, "light", 6, 1);
  const step = fight(g, [saber.instanceId, qui.instanceId], [battle.instanceId, p59.instanceId, wheel.instanceId]);
  const wheelGone = g.dark.discard.some((c) => c.instanceId === wheel.instanceId);
  const p59Stays = g.dark.inPlay.some((c) => c.instanceId === p59.instanceId);
  check(
    "It's A Standoff loses only the destroyer droid",
    step?.winner === "light" && step.darkCardId2 === wheel.cardId && step.darkPower === 9 && wheelGone && p59Stays && step.darkMill === 3,
    `winner ${step?.winner} pair ${step?.darkCardId2} power ${step?.darkPower} mill ${step?.darkMill} wheel discarded ${wheelGone} P-59 stays ${p59Stays}`
  );
});

run("Mobile Assassin adds 3 only with Darth Maul's Sith Speeder", () => {
  const withIt = game("assassin");
  location(withIt, "tatooinepodracearena", MENACE);
  const battle = hand(withIt, "dark", card("dark", "mobileassassin", DOTF, "hand"));
  const speeder = play(withIt, "dark", card("dark", "darthmaulssithspeeder", COUNCIL, "in_play"));
  const maul = play(withIt, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const foe = play(withIt, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(withIt, "dark", 1, 1);
  const yes = fight(withIt, [foe.instanceId], [battle.instanceId, speeder.instanceId, maul.instanceId]);
  const bare = game("assassin-bare");
  location(bare, "tatooinepodracearena", MENACE);
  const battle2 = hand(bare, "dark", card("dark", "mobileassassin", DOTF, "hand"));
  const maul2 = play(bare, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const foe2 = play(bare, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const no = fight(bare, [foe2.instanceId], [battle2.instanceId, maul2.instanceId]);
  check(
    "Mobile Assassin adds 3 only with Darth Maul's Sith Speeder",
    yes?.darkPower === 12 && no?.darkPower === 6,
    `with speeder ${yes?.darkPower}, without ${no?.darkPower} (expected 12 and 6)`
  );
});

run("Power Of The Sith can replace one drawn destiny with damage", () => {
  const g = game("sith-power");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "dark", card("dark", "powerofthesith", DOTF, "hand"));
  const saber = play(g, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  deckTop(g, "dark", "queenamidalayoungleader", DOTF);
  fight(g, [foe.instanceId], [battle.instanceId, saber.instanceId, maul.instanceId]);
  const pending = g.damageReplacePending;
  const accepted = pending?.side === "dark" && confirmDamageReplace(g, "dark", pending.draw.key);
  const step = g.battleRevealSequence?.[0];
  check(
    "Power Of The Sith can replace one drawn destiny with damage",
    pending?.draw.destiny === 6 && accepted && step?.darkPower === 12,
    `drawn ${pending?.draw.destiny ?? "none"} accepted ${accepted} power ${step?.darkPower} (expected replace 6 with Maul damage 5, power 12)`
  );
});

run("Starfighter Screen pairs Tey How with a pilot and two ships", () => {
  const people = game("screen-people");
  location(people, "coruscantcapitalcity", MENACE);
  const battle = hand(people, "dark", card("dark", "starfighterscreen", DOTF, "hand"));
  const tey = play(people, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "in_play"));
  const pilot = play(people, "dark", card("dark", "battledroidpilotaatdivision", MENACE, "in_play"));
  const foe = play(people, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const peopleStep = fight(people, [foe.instanceId], [battle.instanceId, tey.instanceId, pilot.instanceId]);
  const ship = game("screen-ships");
  location(ship, "tatooinepodracearena", MENACE);
  const battle2 = hand(ship, "dark", card("dark", "starfighterscreen", DOTF, "hand"));
  const fighter = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  const transport = card("dark", "battleshiptradefederationtransport", MENACE, "hyperspace");
  const theirs = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  ship.dark.hyperspace = [fighter, transport];
  ship.light.hyperspace = [theirs];
  fuel(ship, "dark", 1, 1);
  fuel(ship, "light", 1, 1);
  const shipStep = ships(ship, [theirs.instanceId], [battle2.instanceId, fighter.instanceId, transport.instanceId], [battle2.instanceId]);
  check(
    "Starfighter Screen pairs Tey How with a pilot and two ships",
    peopleStep?.darkCardId2 === pilot.cardId && peopleStep.darkPower === 3 && shipStep?.darkCardId2 === transport.cardId && shipStep.darkPower === 8,
    `people second ${peopleStep?.darkCardId2} power ${peopleStep?.darkPower}; ships second ${shipStep?.darkCardId2} power ${shipStep?.darkPower}`
  );
});

run("To The Death stops breakthrough when that character is last", () => {
  const g = game("death");
  g.turnSide = "light";
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "dark", card("dark", "tothedeath", DOTF, "hand"));
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const a = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const b = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  fuel(g, "dark", 1, 3);
  fight(g, [a.instanceId, b.instanceId], [battle.instanceId, maul.instanceId]);
  const unopposed = (g.battleRevealSequence ?? []).filter((s) => s.type === "unopposed").length;
  check(
    "To The Death stops breakthrough when that character is last",
    unopposed === 0 && g.dark.deck.length === 3,
    `unopposed steps ${unopposed} deck left ${g.dark.deck.length} (expected no overflow mill)`
  );
});

run("Use Caution adds 4 when Sidious fights a Jedi trait", () => {
  const vsQui = game("caution-qui");
  location(vsQui, "tatooinepodracearena", MENACE);
  const battle = hand(vsQui, "dark", card("dark", "usecaution", DOTF, "hand"));
  const sid = play(vsQui, "dark", card("dark", "darthsidiousmasterofthedarkside", DOTF, "in_play"));
  const qui = play(vsQui, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const quiStep = fight(vsQui, [qui.instanceId], [battle.instanceId, sid.instanceId]);
  const vsDroid = game("caution-droid");
  location(vsDroid, "tatooinepodracearena", MENACE);
  const battle2 = hand(vsDroid, "dark", card("dark", "usecaution", DOTF, "hand"));
  const sid2 = play(vsDroid, "dark", card("dark", "darthsidiousmasterofthedarkside", DOTF, "in_play"));
  const droid = play(vsDroid, "light", card("light", "c3poanakinscreation", MENACE, "in_play"));
  const droidStep = fight(vsDroid, [droid.instanceId], [battle2.instanceId, sid2.instanceId]);
  check(
    "Use Caution adds 4 when Sidious fights a Jedi trait",
    quiStep?.darkPower === 9 && droidStep?.darkPower === 5,
    `vs Qui-Gon ${quiStep?.darkPower}, vs a non-Jedi ${droidStep?.darkPower} (expected 9 and 5)`
  );
});

run("Blockade discards a diamond card and leaves a unique", () => {
  const g = game("blockade");
  g.phase = "even_up";
  g.turnSide = "dark";
  location(g, "naboogunganswamp", COUNCIL);
  const effect = play(g, "dark", card("dark", "blockade", DOTF, "in_play"));
  const droid = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const began = pounded.beginPoundedUntoDeath(g, "dark", effect.instanceId);
  const ids = (g.poundedPending?.targets ?? []).map((t) => t.cardId);
  const confirmed = began.ok ? pounded.confirmPoundedUntoDeath(g, "dark", droid.instanceId) : { ok: false, error: began.error };
  check(
    "Blockade discards a diamond card and leaves a unique",
    began.ok && ids.length === 1 && ids[0] === droid.cardId && confirmed.ok && g.light.discard.some((c) => c.instanceId === droid.instanceId) && g.light.inPlay.some((c) => c.instanceId === qui.instanceId),
    `targets ${ids.join(", ") || "none"}; confirm ${confirmed.ok ? "ok" : confirmed.error}`
  );
});

run("End This Pointless Debate can put the top card under the deck", () => {
  const g = game("debate");
  g.phase = "deploy";
  g.turnSide = "dark";
  const effect = play(g, "dark", card("dark", "endthispointlessdebate", DOTF, "in_play"));
  const top = deckTop(g, "light", "quigonjinnjedimentor", DOTF);
  deckTop(g, "light", "queenamidalayoungleader", DOTF);
  const began = startEffectActivation(g, "dark", effect.instanceId);
  const peeked = g.effectActivationPending?.peekedCardId;
  const placed = began.ok && resolveOppDeckPeek(g, "dark", "bottom").ok;
  check(
    "End This Pointless Debate can put the top card under the deck",
    began.ok && peeked === "queenamidalayoungleader" && placed && g.light.deck[0]?.cardId === "queenamidalayoungleader" && g.light.deck[g.light.deck.length - 1]?.instanceId === top.instanceId,
    `peeked ${peeked}; placed ${placed}; bottom ${g.light.deck[0]?.cardId}; top ${g.light.deck[g.light.deck.length - 1]?.cardId}`
  );
});

run("The Jedi Are Involved puts one hand card under the deck", () => {
  const g = game("involved");
  g.phase = "deploy";
  g.turnSide = "dark";
  const effect = play(g, "dark", card("dark", "thejediareinvolved", DOTF, "in_play"));
  const held = hand(g, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "hand"));
  const began = startEffectActivation(g, "dark", effect.instanceId);
  const kind = g.effectActivationPending?.kind;
  const placed = began.ok && placeHandCardUnderDeck(g, "dark", held.instanceId).ok;
  check(
    "The Jedi Are Involved puts one hand card under the deck",
    began.ok && kind === "bottom_hand" && placed && g.dark.hand.length === 0 && g.dark.deck[0]?.instanceId === held.instanceId,
    `kind ${kind}; placed ${placed}; hand ${g.dark.hand.length}; bottom ${g.dark.deck[0]?.cardId}`
  );
});

run("The Duel Begins offers a lightsaber for Maul and not for a battle droid", () => {
  const g = game("duel-begins");
  g.phase = "deploy";
  g.turnSide = "dark";
  play(g, "dark", card("dark", "theduelbegins", DOTF, "in_play"));
  const saber = deckTop(g, "dark", "sithlightsaber", MENACE);
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const offered = jediTraining.maybeBeginJediTraining(g, "dark", maul);
  const confirmed = offered ? jediTraining.confirmJediTraining(g, "dark", saber.instanceId) : { ok: false, error: "no offer" };
  const g2 = game("duel-begins-no");
  play(g2, "dark", card("dark", "theduelbegins", DOTF, "in_play"));
  deckTop(g2, "dark", "sithlightsaber", MENACE);
  const droid = play(g2, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const no = jediTraining.maybeBeginJediTraining(g2, "dark", droid);
  check(
    "The Duel Begins offers a lightsaber for Maul and not for a battle droid",
    offered && confirmed.ok && g.dark.inPlay.some((c) => c.instanceId === saber.instanceId) && g.dark.discard.some((c) => c.cardId === "theduelbegins") && g.dark.force === 5 && no === false,
    `offered ${offered}; confirm ${confirmed.ok ? "ok" : confirmed.error}; force ${g.dark.force}; droid offered ${no}`
  );
});

run("Where Are Those Droidekas adds 2 to destroyer droids and makes an MTT free", () => {
  const g = game("droidekas");
  location(g, "coruscantcapitalcity", MENACE);
  play(g, "dark", card("dark", "wherearethosedroidekas", DOTF, "in_play"));
  const wheel = play(g, "dark", card("dark", "destroyerdroidwheeldroid", MENACE, "in_play"));
  const foe = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const wheelStep = fight(g, [foe.instanceId], [wheel.instanceId]);
  const plain = game("droidekas-no");
  location(plain, "coruscantcapitalcity", MENACE);
  const droid2 = play(plain, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const foe2 = play(plain, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const step2 = fight(plain, [foe2.instanceId], [droid2.instanceId]);
  const free = getWeaponDeployCost(g, "dark", "multitrooptransport", MENACE);
  const paid = getWeaponDeployCost(plain, "dark", "multitrooptransport", MENACE);
  check(
    "Where Are Those Droidekas adds 2 to destroyer droids and makes an MTT free",
    wheelStep?.darkPower === 5 && step2?.darkPower === 2 && free === 0 && paid === 2,
    `destroyer ${wheelStep?.darkPower} battle droid ${step2?.darkPower} MTT cost ${free} without effect ${paid}; unused ${droid2.cardId}`
  );
});

run("Sidious discards himself and 3 hand cards, then draws 3", () => {
  const g = game("sidious-draw");
  g.phase = "deploy";
  g.turnSide = "dark";
  const sid = card("dark", "darthsidiousmasterofthedarkside", DOTF, "in_play");
  g.controlledPlanets = [{
    locationCardId: "coruscantcapitalcity",
    locationInstanceId: "won",
    planet: "Coruscant",
    controlledBy: "dark",
    strandedLight: [],
    strandedDark: [{ instanceId: sid.instanceId, cardId: sid.cardId, faceDown: false }],
  }];
  const h1 = hand(g, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "hand"));
  const h2 = hand(g, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "hand"));
  const h3 = hand(g, "dark", card("dark", "teyhowneimoidiancommofficer", DOTF, "hand"));
  fuel(g, "dark", 1, 3);
  const began = winControl.beginWinControl(g, "dark", sid.instanceId, 0);
  const confirmed = began.ok ? winControl.confirmWinControl(g, "dark", [h1.instanceId, h2.instanceId, h3.instanceId]) : { ok: false, error: began.error };
  check(
    "Sidious discards himself and 3 hand cards, then draws 3",
    began.ok && confirmed.ok && (g.controlledPlanets?.[0].strandedDark.length ?? 1) === 0 && g.dark.hand.length === 3 && g.dark.discard.length === 4,
    `begin ${began.ok ? "ok" : began.error}; confirm ${confirmed.ok ? "ok" : confirmed.error}; hand ${g.dark.hand.length}; discard ${g.dark.discard.length}`
  );
});

run("OWO-1 offers a diamond battle droid and not a unique one", () => {
  const g = game("owo");
  g.phase = "deploy";
  g.turnSide = "dark";
  const owo = play(g, "dark", card("dark", "owo1battledroidcommandofficer", DOTF, "in_play"));
  const diamond = card("dark", "battledroidinfantrymttdivision", MENACE, "deck");
  const unique = card("dark", "owo1battledroidcommandofficer", DOTF, "deck");
  g.dark.deck.push(diamond, unique);
  const offered = maybeBeginDeployFromDeck(g, "dark", owo.instanceId, owo.cardId, owo.cardSet, false);
  const found = g.deployFromDeckPending?.foundCardId;
  const confirmed = offered && confirmDeployFromDeck(g, "dark");
  check(
    "OWO-1 offers a diamond battle droid and not a unique one",
    offered && found === diamond.cardId && confirmed && g.dark.inPlay.some((c) => c.instanceId === diamond.instanceId) && g.dark.force === 4,
    `offered ${offered}; found ${found}; confirm ${confirmed}; force ${g.dark.force}`
  );
});

run("Baskol Yeesrim offers a draw on Coruscant and not elsewhere", () => {
  const g = game("baskol");
  g.phase = "deploy";
  location(g, "coruscantcapitalcity", MENACE);
  fuel(g, "dark", 1, 1);
  const offered = maybeBeginDeployDraw(g, "dark", "baskolyeesrimgransenator", DOTF, false);
  const away = game("baskol-away");
  location(away, "tatooinepodracearena", MENACE);
  const no = maybeBeginDeployDraw(away, "dark", "baskolyeesrimgransenator", DOTF, false);
  const drew = offered && confirmDeployDraw(g, "dark").ok;
  check(
    "Baskol Yeesrim offers a draw on Coruscant and not elsewhere",
    offered && drew && g.dark.hand.length === 1 && no === false,
    `offered ${offered}; drew ${drew}; hand ${g.dark.hand.length}; elsewhere ${no}`
  );
});

run("A Starfighter Droid deploys a Droid Starfighter, then the ship can deploy a droid", () => {
  const g = game("dfs");
  g.phase = "deploy";
  g.turnSide = "dark";
  const droid = play(g, "dark", card("dark", "starfighterdroiddfs327", DOTF, "in_play"));
  const ship = deckTop(g, "dark", "droidstarfighterduel", DOTF);
  const began = beginInPlayDeployFromDeck(g, "dark", droid.instanceId);
  const confirmed = began.ok && confirmDeployFromDeck(g, "dark");
  const shipOut = g.dark.hyperspace?.some((c) => c.instanceId === ship.instanceId);
  const droidDiscarded = g.dark.discard.some((c) => c.instanceId === droid.instanceId);
  const pilot = deckTop(g, "dark", "starfighterdroiddfs1104", DOTF);
  const began2 = beginInPlayDeployFromDeck(g, "dark", ship.instanceId);
  const confirmed2 = began2.ok && confirmDeployFromDeck(g, "dark");
  check(
    "A Starfighter Droid deploys a Droid Starfighter, then the ship can deploy a droid",
    began.ok && confirmed && !!shipOut && droidDiscarded && began2.ok && confirmed2 && g.dark.inPlay.some((c) => c.instanceId === pilot.instanceId) && g.dark.discard.some((c) => c.instanceId === ship.instanceId),
    `droid search ${began.ok ? "ok" : began.error}; ship in hyperspace ${!!shipOut}; ship search ${began2.ok ? "ok" : began2.error}; pilot in play ${g.dark.inPlay.some((c) => c.cardId === pilot.cardId)}`
  );
});

function maulDuel(label: string, stack: (g: GameStateData) => void): GameStateData | undefined {
  const g = game(label);
  g.turnSide = "dark";
  location(g, "tatooinepodracearena", MENACE);
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const saber = play(g, "dark", card("dark", "sithlightsaber", MENACE, "in_play"));
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  stack(g);
  const ok = initiateDuel(g, "dark", maul.instanceId, saber.instanceId) && chooseDuelTarget(g, "dark", qui.instanceId);
  if (!ok || g.duelState?.step !== "play") {
    check(label, false, `duel did not start (${g.duelState?.step ?? "none"})`);
    return undefined;
  }
  return g;
}

run("Dangerous Encounter draws one extra dueling card", () => {
  const g = maulDuel("danger-draw", (state) => {
    deckTop(state, "dark", "queenamidalayoungleader", DOTF);
    for (let i = 0; i < 8; i++) deckTop(state, "dark", "quigonjinnjedimentor", DOTF);
    deckTop(state, "dark", "dangerousencounter", DOTF);
    fuel(state, "light", 1, 8);
  });
  if (!g) return;
  const hand = g.duelState!.darkDuelHand;
  check(
    "Dangerous Encounter draws one extra dueling card",
    hand.length === 10 && hand.filter((c) => c.cardId === "dangerousencounter").length === 1,
    `hand ${hand.length}`
  );
});

run("Power Of The Sith scores two duel hits", () => {
  const g = maulDuel("sith-hits", (state) => {
    for (let i = 0; i < 8; i++) deckTop(state, "dark", "quigonjinnjedimentor", DOTF);
    deckTop(state, "dark", "powerofthesith", DOTF);
    fuel(state, "light", 1, 8);
  });
  if (!g) return;
  const attack = g.duelState!.darkDuelHand.find((c) => c.cardId === "powerofthesith")!;
  const played = playDuelCard(g, "dark", attack.instanceId) && playDuelCard(g, "light", g.duelState!.lightDuelHand[0].instanceId);
  check("Power Of The Sith scores two duel hits", played && g.duelState?.lightHits === 2, `played ${played}; light hits ${g.duelState?.lightHits}`);
});

run("To The Death can be discarded for two extra duel hits", () => {
  const g = maulDuel("death-hits", (state) => {
    for (let i = 0; i < 8; i++) deckTop(state, "dark", "quigonjinnjedimentor", DOTF);
    deckTop(state, "dark", "tothedeath", DOTF);
    fuel(state, "light", 1, 8);
  });
  if (!g) return;
  const stand = g.duelState!.darkDuelHand.find((c) => c.cardId === "tothedeath")!;
  const played = playDuelCard(g, "dark", stand.instanceId, { discardForExtraHits: true });
  const pending = g.duelState?.pendingAttack;
  const blocked = played && playDuelCard(g, "light", g.duelState!.lightDuelHand[0].instanceId);
  check(
    "To The Death can be discarded for two extra duel hits",
    !!pending && pending.bonusHits === 2 && g.dark.discard.some((c) => c.instanceId === stand.instanceId) && !!blocked && g.duelState?.lightHits === 3,
    `bonus ${pending?.bonusHits}; hits ${g.duelState?.lightHits}`
  );
});

run("Change In Tactics removes one duel hit, once", () => {
  const g = maulDuel("change-hit", (state) => {
    deckTop(state, "dark", "changeintactics", DOTF);
    deckTop(state, "dark", "comeonmove", DOTF);
    fuel(state, "dark", 1, 7);
    fuel(state, "light", 6, 7);
    deckTop(state, "light", "quigonjinnjedimentor", DOTF);
  });
  if (!g) return;
  const twist = g.duelState!.darkDuelHand.find((c) => c.cardId === "changeintactics")!;
  const mine = g.duelState!.darkDuelHand.find((c) => c.cardId === "quigonjinnjedimentor")!;
  const tooEarly = removeDuelHit(g, "dark", twist.instanceId);
  const answer = g.duelState!.darkDuelHand.find((c) => c.cardId === "comeonmove")!;
  const opened = playDuelCard(g, "dark", mine.instanceId) && playDuelCard(g, "light", g.duelState!.lightDuelHand[0].instanceId);
  const hit = playDuelCard(g, "dark", answer.instanceId);
  const removed = removeDuelHit(g, "dark", twist.instanceId);
  const again = removeDuelHit(g, "dark", twist.instanceId);
  check(
    "Change In Tactics removes one duel hit, once",
    !tooEarly && opened && hit && removed && !again && g.duelState?.darkHits === 0 && g.duelState.darkDuelHand.some((c) => c.instanceId === twist.instanceId),
    `early ${tooEarly}; opened ${opened}; hit ${hit}; removed ${removed}; again ${again}; hits ${g.duelState?.darkHits}`
  );
});

run("Darth Maul Defiant discards to draw two dueling cards", () => {
  const g = maulDuel("defiant-draw", (state) => {
    deckTop(state, "dark", "queenamidalayoungleader", DOTF);
    deckTop(state, "dark", "queenamidalayoungleader", DOTF);
    for (let i = 0; i < 8; i++) deckTop(state, "dark", "quigonjinnjedimentor", DOTF);
    deckTop(state, "dark", "darthmauldefiant", DOTF);
    fuel(state, "light", 1, 8);
  });
  if (!g) return;
  const cardInHand = g.duelState!.darkDuelHand.find((c) => c.cardId === "darthmauldefiant")!;
  const drawn = discardDuelCardForDraw(g, "dark", cardInHand.instanceId);
  check(
    "Darth Maul Defiant discards to draw two dueling cards",
    drawn && g.duelState!.darkDuelHand.length === 10 && g.dark.discard.some((c) => c.instanceId === cardInHand.instanceId),
    `drawn ${drawn}; hand ${g.duelState?.darkDuelHand.length}`
  );
});

run("Declining Baskol's draw does not take a card", () => {
  const g = game("baskol-no");
  location(g, "coruscantcapitalcity", MENACE);
  fuel(g, "dark", 1, 1);
  const offered = maybeBeginDeployDraw(g, "dark", "baskolyeesrimgransenator", DOTF, false);
  const declined = offered && declineDeployDraw(g, "dark");
  check(
    "Declining Baskol's draw does not take a card",
    offered && declined && g.dark.hand.length === 0 && g.dark.deck.length === 1,
    `offered ${offered}; declined ${declined}; hand ${g.dark.hand.length}; deck ${g.dark.deck.length}`
  );
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  if (!r.ok) console.log(`      ${r.detail}`);
}
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed, ${results.length} checks`);
if (failed.length > 0) process.exitCode = 1;
