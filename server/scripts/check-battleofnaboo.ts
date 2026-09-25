/**
 * Battle of Naboo: battle cards, character game text, and weapons whose backup user differs.
 * Run from server/: npx ts-node scripts/check-battleofnaboo.ts
 */
import { initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import { createGameState, getDeployCostWithGametextBonus, resolveBattlePlan, type GameStateData } from "../src/game/state";

initCards();

const SET = "battleofnaboo";
type Step = NonNullable<GameStateData["battleRevealSequence"]>[number];
const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

let seq = 0;
function card(side: Side, id: string): CardInstance {
  seq += 1;
  return { instanceId: "c" + seq, cardId: id, cardSet: SET, ownerSide: side, zone: "in_play", faceDown: false };
}

/** Coruscant Capital gives this set's Naboo people no location bonus. */
function game(label: string, loc = "coruscantcapitalcity"): GameStateData {
  const g = createGameState(label, "table", "human", "bot_1", "You", "Bot", 60000);
  g.ruleset = "classic";
  g.phase = "battle";
  g.turnSide = "light";
  g.light.deck = [];
  g.dark.deck = [];
  g.light.hand = [];
  g.dark.hand = [];
  g.light.inPlay = [];
  g.dark.inPlay = [];
  g.light.discard = [];
  g.dark.discard = [];
  g.light.force = 6;
  g.dark.force = 6;
  const locationCard = card("light", loc);
  g.light.inPlay.push(locationCard);
  g.startingLocationInstanceId = locationCard.instanceId;
  return g;
}

function put(g: GameStateData, side: Side, id: string): CardInstance {
  const c = card(side, id);
  const p = side === "light" ? g.light : g.dark;
  p.inPlay.push(c);
  return c;
}

function top(g: GameStateData, side: Side, id: string): void {
  const c = card(side, id);
  c.zone = "deck";
  const p = side === "light" ? g.light : g.dark;
  p.deck.push(c);
}

function fight(g: GameStateData, light: CardInstance[], dark: CardInstance[]): Step[] {
  g.lightBattlePlanOrder = light.map((c) => c.instanceId);
  g.darkBattlePlanOrder = dark.map((c) => c.instanceId);
  g.battlePlanPhase = true;
  resolveBattlePlan(g);
  return g.battleRevealSequence ?? [];
}

function inZone(list: CardInstance[], c: CardInstance): boolean {
  return list.some((x) => x.instanceId === c.instanceId);
}

function run(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    check(name, false, err instanceof Error ? err.message : String(err));
  }
}

function powerLine(step: Step | undefined): string {
  if (!step) return "no fight";
  return `light ${step.lightPower} (card ${step.lightBattleCardBonus ?? 0}, weapon ${step.lightWeaponBonus ?? 0}) dark ${step.darkPower} (card ${step.darkBattleCardBonus ?? 0}, weapon ${step.darkWeaponBonus ?? 0}) second ${step.lightCardId2 ?? "-"}/${step.darkCardId2 ?? "-"} mill ${step.lightMill ?? 0}/${step.darkMill ?? 0}`;
}

const DROID = "battledroidinfantrypatroldivision";
const DROID2 = "battledroidsecuritypatroldivision";
const DROID3 = "battledroidofficerdefensedivision";
const THEED = "nabootheedpalace";
const SWAMP = "naboogunganswamp";

// --- Light battle cards ---

run("Capture the Viceroy joins two non-unique Naboo Officers and adds 1", () => {
  const g = game("capture");
  const battle = put(g, "light", "capturetheviceroy");
  const a = put(g, "light", "nabooofficersquadleader");
  const b = put(g, "light", "nabooofficercommander");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b], [foe]);
  const step = steps[0];
  check(
    "Capture the Viceroy joins two non-unique Naboo Officers and adds 1",
    steps.length === 1 && step?.lightPower === 6 && step.lightBattleCardBonus === 1 && step.lightCardId2 === "nabooofficercommander",
    powerLine(step) + " (expected 3 + 2 + 1)"
  );
});

run("Capture the Viceroy does nothing for one Naboo Officer", () => {
  const g = game("capture-one");
  const battle = put(g, "light", "capturetheviceroy");
  const a = put(g, "light", "nabooofficersquadleader");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, a], [foe]);
  check("Capture the Viceroy does nothing for one Naboo Officer", step?.lightPower === 3 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Celebration adds 2 for a non-unique Gungan", () => {
  const g = game("cele");
  const battle = put(g, "light", "celebration");
  const gungan = put(g, "light", "gunganofficialbureaucrat");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, gungan], [foe]);
  check("Celebration adds 2 for a non-unique Gungan", step?.lightPower === 4 && step.lightBattleCardBonus === 2, powerLine(step));
});

run("Celebration does nothing for Boss Nass", () => {
  const g = game("cele-no");
  const battle = put(g, "light", "celebration");
  const nass = put(g, "light", "bossnassgunganchief");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, nass], [foe]);
  check("Celebration does nothing for Boss Nass", step?.lightPower === 4 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Guardians of the Queen joins Qui-Gon and Obi-Wan", () => {
  const g = game("guard");
  const battle = put(g, "light", "guardiansofthequeen");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const obi = put(g, "light", "obiwankenobijediknight");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, qui, obi], [foe]);
  check(
    "Guardians of the Queen joins Qui-Gon and Obi-Wan",
    steps.length === 1 && steps[0]?.lightPower === 11 && steps[0].lightCardId2 === "obiwankenobijediknight",
    powerLine(steps[0])
  );
});

run("Guardians of the Queen does not join Qui-Gon and Mace", () => {
  const g = game("guard-no");
  const battle = put(g, "light", "guardiansofthequeen");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const mace = put(g, "light", "macewindujedispeaker");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, qui, mace], [foe]);
  check("Guardians of the Queen does not join Qui-Gon and Mace", steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 6, powerLine(steps[0]));
});

run("Gunga City adds 3 for Boss Nass", () => {
  const g = game("city-nass");
  const battle = put(g, "light", "gungacity");
  const nass = put(g, "light", "bossnassgunganchief");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, nass], [foe]);
  check("Gunga City adds 3 for Boss Nass", step?.lightPower === 7 && step.lightBattleCardBonus === 3, powerLine(step));
});

run("Gunga City adds 3 for Rep Been", () => {
  const g = game("city-rep");
  const battle = put(g, "light", "gungacity");
  const rep = put(g, "light", "repbeengungan");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, rep], [foe]);
  check("Gunga City adds 3 for Rep Been", step?.lightPower === 7 && step.lightBattleCardBonus === 3, powerLine(step));
});

run("Gunga City adds 3 for a non-unique Gungan Official", () => {
  const g = game("city-off");
  const battle = put(g, "light", "gungacity");
  const off = put(g, "light", "gunganofficialbureaucrat");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, off], [foe]);
  check("Gunga City adds 3 for a non-unique Gungan Official", step?.lightPower === 5 && step.lightBattleCardBonus === 3, powerLine(step));
});

run("Gunga City does nothing for a Republic Captain", () => {
  const g = game("city-no");
  const battle = put(g, "light", "gungacity");
  const cap = put(g, "light", "republiccaptainofficer");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, cap], [foe]);
  check("Gunga City does nothing for a Republic Captain", step?.lightPower === 2 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Gungan Battle Cry joins Tarpals and a non-unique Gungan", () => {
  const g = game("cry-win");
  const battle = put(g, "light", "gunganbattlecry");
  const tarpals = put(g, "light", "captaintarpalsgunganofficer");
  const gungan = put(g, "light", "gunganofficialbureaucrat");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, tarpals, gungan], [foe]);
  check(
    "Gungan Battle Cry joins Tarpals and a non-unique Gungan",
    steps.length === 1 && steps[0]?.lightPower === 5 && steps[0].lightCardId2 === "gunganofficialbureaucrat" && inZone(g.light.inPlay, tarpals) && inZone(g.light.inPlay, gungan),
    powerLine(steps[0])
  );
});

run("Gungan Battle Cry defeats only the Gungan when they lose", () => {
  const g = game("cry-lose");
  const battle = put(g, "light", "gunganbattlecry");
  const tarpals = put(g, "light", "captaintarpalsgunganofficer");
  const gungan = put(g, "light", "gunganofficialbureaucrat");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const steps = fight(g, [battle, tarpals, gungan], [maul]);
  check(
    "Gungan Battle Cry defeats only the Gungan when they lose",
    steps[0]?.winner === "dark" && inZone(g.light.discard, gungan) && !inZone(g.light.discard, tarpals) && inZone(g.light.inPlay, tarpals) && (steps[0]?.lightMill ?? 0) === 1,
    powerLine(steps[0]) + ` tarpals play ${inZone(g.light.inPlay, tarpals)} gungan discard ${inZone(g.light.discard, gungan)}`
  );
});

run("Gungan Battle Cry does not join Tarpals with Boss Nass", () => {
  const g = game("cry-no");
  const battle = put(g, "light", "gunganbattlecry");
  const tarpals = put(g, "light", "captaintarpalsgunganofficer");
  const nass = put(g, "light", "bossnassgunganchief");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, tarpals, nass], [foe]);
  check("Gungan Battle Cry does not join Tarpals with Boss Nass", steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 3, powerLine(steps[0]));
});

run("How Wude sends a losing Jar Jar back to hand with no damage", () => {
  const g = game("wude");
  for (let i = 0; i < 6; i++) top(g, "light", "blaster_light");
  const battle = put(g, "light", "howwude");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const [step] = fight(g, [battle, jar], [maul]);
  check(
    "How Wude sends a losing Jar Jar back to hand with no damage",
    step?.winner === "dark" && inZone(g.light.hand, jar) && g.light.deck.length === 6 && (step.lightMill ?? 0) === 0,
    `winner ${step?.winner} hand ${inZone(g.light.hand, jar)} deck ${g.light.deck.length}`
  );
});

run("How Wude still damages the loser when Jar Jar wins", () => {
  const g = game("wude-win");
  const battle = put(g, "light", "howwude");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, jar], [foe]);
  check(
    "How Wude still damages the loser when Jar Jar wins",
    step?.winner === "light" && inZone(g.dark.discard, foe) && (step.darkMill ?? 0) === 1 && g.light.hand.length === 0,
    powerLine(step)
  );
});

run("I Will Take Back What Is Ours joins a Royal Guard, Naboo Security, and Bravo Pilot", () => {
  const g = game("take");
  const battle = put(g, "light", "iwilltakebackwhatisours");
  const royal = put(g, "light", "royalguardleader");
  const sec = put(g, "light", "naboosecurityamidalasguard");
  const bravo = put(g, "light", "bravopilotaceflyer");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, royal, sec, bravo], [foe]);
  check(
    "I Will Take Back What Is Ours joins a Royal Guard, Naboo Security, and Bravo Pilot",
    steps.length === 1 && steps[0]?.lightPower === 7 && steps[0].lightCardId3 === "bravopilotaceflyer",
    powerLine(steps[0])
  );
});

run("I Will Take Back What Is Ours does not join a Gungan with the pilots", () => {
  const g = game("take-no");
  const battle = put(g, "light", "iwilltakebackwhatisours");
  const royal = put(g, "light", "royalguardleader");
  const bravo = put(g, "light", "bravopilotaceflyer");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, royal, bravo, jar], [foe]);
  check("I Will Take Back What Is Ours does not join a Gungan with the pilots", steps[0]?.lightCardId2 == null, powerLine(steps[0]));
});

run("Jedi Force Push ignores the opponent's weapon when Qui-Gon has none", () => {
  const g = game("jpush");
  const battle = put(g, "light", "jediforcepush");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const stap = put(g, "dark", "stap");
  const droid = put(g, "dark", DROID);
  const [step] = fight(g, [battle, qui], [stap, droid]);
  check(
    "Jedi Force Push ignores the opponent's weapon when Qui-Gon has none",
    step?.lightPower === 6 && step.darkPower === 2 && (step.darkWeaponBonus ?? 0) === 0 && inZone(g.dark.inPlay, stap) && inZone(g.dark.discard, droid),
    powerLine(step) + ` stap stays ${inZone(g.dark.inPlay, stap)}`
  );
});

run("Jedi Force Push still allows both weapons when Qui-Gon is armed", () => {
  const g = game("jpush-arm");
  const battle = put(g, "light", "jediforcepush");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const stap = put(g, "dark", "stap");
  const droid = put(g, "dark", DROID);
  const [step] = fight(g, [battle, saber, qui], [stap, droid]);
  check(
    "Jedi Force Push still allows both weapons when Qui-Gon is armed",
    step?.lightPower === 8 && step.darkPower === 4 && step.lightWeaponBonus === 2 && step.darkWeaponBonus === 2 && inZone(g.dark.discard, stap),
    powerLine(step)
  );
});

run("Meeesa Like Dis joins three non-unique Gungans", () => {
  const g = game("meesa");
  const battle = put(g, "light", "meeeesalikedis");
  const a = put(g, "light", "gunganwarriorveteran");
  const b = put(g, "light", "gungansoldierinfantry");
  const c = put(g, "light", "gunganguardlookout");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b, c], [foe]);
  check(
    "Meeesa Like Dis joins three non-unique Gungans",
    steps.length === 1 && steps[0]?.lightPower === 6 && steps[0].lightCardId3 === "gunganguardlookout",
    powerLine(steps[0])
  );
});

run("Meeesa Like Dis does not join Jar Jar", () => {
  const g = game("meesa-no");
  const battle = put(g, "light", "meeeesalikedis");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const a = put(g, "light", "gunganwarriorveteran");
  const b = put(g, "light", "gungansoldierinfantry");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, jar, a, b], [foe]);
  check("Meeesa Like Dis does not join Jar Jar", steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 4, powerLine(steps[0]));
});

run("Nooooooooooo adds 4 when Obi-Wan fights Darth Maul", () => {
  const g = game("no");
  const battle = put(g, "light", "nooooooooooo");
  const obi = put(g, "light", "obiwankenobijediknight");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const [step] = fight(g, [battle, obi], [maul]);
  check("Nooooooooooo adds 4 when Obi-Wan fights Darth Maul", step?.lightPower === 9 && step.lightBattleCardBonus === 4, powerLine(step));
});

run("Nooooooooooo adds 4 when Obi-Wan fights Darth Sidious", () => {
  const g = game("no-sid");
  const battle = put(g, "light", "nooooooooooo");
  const obi = put(g, "light", "obiwankenobijediknight");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const [step] = fight(g, [battle, obi], [sid]);
  check("Nooooooooooo adds 4 when Obi-Wan fights Darth Sidious", step?.lightPower === 9 && step.lightBattleCardBonus === 4, powerLine(step));
});

run("Nooooooooooo does nothing when Obi-Wan fights a battle droid", () => {
  const g = game("no-droid");
  const battle = put(g, "light", "nooooooooooo");
  const obi = put(g, "light", "obiwankenobijediknight");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, obi], [foe]);
  check("Nooooooooooo does nothing when Obi-Wan fights a battle droid", step?.lightPower === 5 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Thanks Artoo joins Anakin and R2-D2 and adds 3", () => {
  const g = game("thanks");
  top(g, "light", "heavyblaster");
  const battle = put(g, "light", "thanksartoo");
  const anakin = put(g, "light", "anakinskywalkerpadawan");
  const r2 = put(g, "light", "r2d2thequeenshero");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, anakin, r2], [foe]);
  check(
    "Thanks Artoo joins Anakin and R2-D2 and adds 3",
    steps.length === 1 && steps[0]?.lightPower === 10 && steps[0].lightBattleCardBonus === 3 && steps[0].lightCardId2 === "r2d2thequeenshero",
    powerLine(steps[0]) + " (expected destiny 6 + R2 1 + card 3)"
  );
});

run("Thanks Artoo does not join Anakin and Padme", () => {
  const g = game("thanks-no");
  top(g, "light", "heavyblaster");
  const battle = put(g, "light", "thanksartoo");
  const anakin = put(g, "light", "anakinskywalkerpadawan");
  const padme = put(g, "light", "padmenaberrieamidalashandmaiden");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, anakin, padme], [foe]);
  check("Thanks Artoo does not join Anakin and Padme", steps[0]?.lightCardId2 == null, powerLine(steps[0]));
});

run("The Chancellor's Ambassador joins Qui-Gon and the Queen", () => {
  const g = game("amb");
  const battle = put(g, "light", "thechancellorsambassador");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const queen = put(g, "light", "queenamidalaresolutenegotiator");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, qui, queen], [foe]);
  check(
    "The Chancellor's Ambassador joins Qui-Gon and the Queen",
    steps.length === 1 && steps[0]?.lightPower === 8 && steps[0].lightCardId2 === "queenamidalaresolutenegotiator",
    powerLine(steps[0])
  );
});

run("The Chancellor's Ambassador joins Qui-Gon and Padme", () => {
  const g = game("amb-padme");
  const battle = put(g, "light", "thechancellorsambassador");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const padme = put(g, "light", "padmenaberrieamidalashandmaiden");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, qui, padme], [foe]);
  check(
    "The Chancellor's Ambassador joins Qui-Gon and Padme",
    steps.length === 1 && steps[0]?.lightPower === 9 && steps[0].lightCardId2 === "padmenaberrieamidalashandmaiden",
    powerLine(steps[0])
  );
});

run("The Chancellor's Ambassador does not join Qui-Gon and Obi-Wan", () => {
  const g = game("amb-no");
  const battle = put(g, "light", "thechancellorsambassador");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const obi = put(g, "light", "obiwankenobijediknight");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, qui, obi], [foe]);
  check("The Chancellor's Ambassador does not join Qui-Gon and Obi-Wan", steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 6, powerLine(steps[0]));
});

run("The Will of the Force adds 2 when Qui-Gon uses his lightsaber", () => {
  const g = game("will");
  const battle = put(g, "light", "thewilloftheforce");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, saber, qui], [foe]);
  check("The Will of the Force adds 2 when Qui-Gon uses his lightsaber", step?.lightPower === 10 && step.lightBattleCardBonus === 2 && step.lightWeaponBonus === 2, powerLine(step));
});

run("The Will of the Force does nothing when Qui-Gon has no lightsaber", () => {
  const g = game("will-no");
  const battle = put(g, "light", "thewilloftheforce");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, qui], [foe]);
  check("The Will of the Force does nothing when Qui-Gon has no lightsaber", step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Young Skywalker sends a losing Anakin back to hand with no damage", () => {
  const g = game("young");
  for (let i = 0; i < 4; i++) top(g, "light", "blaster_light");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "youngskywalker");
  const anakin = put(g, "light", "anakinskywalkerpadawan");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const [step] = fight(g, [battle, anakin], [maul]);
  check(
    "Young Skywalker sends a losing Anakin back to hand with no damage",
    step?.winner === "dark" && step.lightPower === 3 && inZone(g.light.hand, anakin) && g.light.deck.length === 4 && (step.lightMill ?? 0) === 0,
    powerLine(step) + ` hand ${inZone(g.light.hand, anakin)} deck ${g.light.deck.length}`
  );
});

run("Young Skywalker still damages the loser when Anakin wins", () => {
  const g = game("young-win");
  top(g, "light", "heavyblaster");
  const battle = put(g, "light", "youngskywalker");
  const anakin = put(g, "light", "anakinskywalkerpadawan");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, anakin], [foe]);
  check(
    "Young Skywalker still damages the loser when Anakin wins",
    step?.winner === "light" && step.lightPower === 6 && (step.darkMill ?? 0) === 1 && g.light.hand.length === 0,
    powerLine(step)
  );
});

run("Your Occupation Here Has Ended adds 3 for anyone on Naboo", () => {
  const g = game("occ", THEED);
  const battle = put(g, "light", "youroccupationherehasended");
  const off = put(g, "light", "nabooofficersquadleader");
  const foe = put(g, "dark", DROID3);
  const [step] = fight(g, [battle, off], [foe]);
  check("Your Occupation Here Has Ended adds 3 for anyone on Naboo", step?.lightPower === 6 && step.lightBattleCardBonus === 3, powerLine(step));
});

run("Your Occupation Here Has Ended does nothing off Naboo", () => {
  const g = game("occ-off");
  const battle = put(g, "light", "youroccupationherehasended");
  const off = put(g, "light", "nabooofficersquadleader");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, off], [foe]);
  check("Your Occupation Here Has Ended does nothing off Naboo", step?.lightPower === 3 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

// --- Dark battle cards ---

run("A Thousand Terrible Things adds 2 for a non-unique battle droid", () => {
  const g = game("thousand");
  const battle = put(g, "dark", "athousandterriblethings");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, droid]);
  check("A Thousand Terrible Things adds 2 for a non-unique battle droid", step?.darkPower === 4 && step.darkBattleCardBonus === 2, powerLine(step));
});

run("A Thousand Terrible Things does nothing for the unique Battle Droid Squad", () => {
  const g = game("thousand-no");
  const battle = put(g, "dark", "athousandterriblethings");
  const squad = put(g, "dark", "battledroidsquadguardunit");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, squad]);
  check("A Thousand Terrible Things does nothing for the unique Battle Droid Squad", step?.darkPower === 4 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Armored Assault joins a tank and a non-unique battle droid", () => {
  const g = game("armor-win");
  const battle = put(g, "dark", "armoredassault");
  const tank = put(g, "dark", "tradefederationtankpatroldivision");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "nabooofficercommander");
  const steps = fight(g, [foe], [battle, tank, droid]);
  check(
    "Armored Assault joins a tank and a non-unique battle droid",
    steps.length === 1 && steps[0]?.darkPower === 6 && steps[0].darkCardId2 === DROID3 && inZone(g.dark.inPlay, tank) && inZone(g.dark.inPlay, droid),
    powerLine(steps[0])
  );
});

run("Armored Assault defeats only the battle droid when they lose", () => {
  const g = game("armor-lose");
  const battle = put(g, "dark", "armoredassault");
  const tank = put(g, "dark", "tradefederationtankpatroldivision");
  const droid = put(g, "dark", DROID3);
  const saber = put(g, "light", "macewinduslightsaber");
  const mace = put(g, "light", "macewindujedispeaker");
  const steps = fight(g, [saber, mace], [battle, tank, droid]);
  check(
    "Armored Assault defeats only the battle droid when they lose",
    steps[0]?.winner === "light" && inZone(g.dark.discard, droid) && !inZone(g.dark.discard, tank) && inZone(g.dark.inPlay, tank) && (steps[0]?.darkMill ?? 0) === 1,
    powerLine(steps[0]) + ` tank play ${inZone(g.dark.inPlay, tank)} droid discard ${inZone(g.dark.discard, droid)}`
  );
});

run("Armored Assault does not join a tank with the unique Battle Droid Squad", () => {
  const g = game("armor-no");
  const battle = put(g, "dark", "armoredassault");
  const tank = put(g, "dark", "tradefederationtankpatroldivision");
  const squad = put(g, "dark", "battledroidsquadguardunit");
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, tank, squad]);
  check("Armored Assault does not join a tank with the unique Battle Droid Squad", steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 4, powerLine(steps[0]));
});

run("Death From Above adds 3 for anyone on Naboo", () => {
  const g = game("death", THEED);
  const battle = put(g, "dark", "deathfromabove");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Death From Above adds 3 for anyone on Naboo", step?.darkPower === 5 && step.darkBattleCardBonus === 3, powerLine(step));
});

run("Death From Above does nothing off Naboo", () => {
  const g = game("death-off");
  const battle = put(g, "dark", "deathfromabove");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Death From Above does nothing off Naboo", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Dont Spectate 'Em Welcome adds 4 at the Gungan Swamp", () => {
  const g = game("swamp", SWAMP);
  const battle = put(g, "dark", "dontspectawermwelcome");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Dont Spectate 'Em Welcome adds 4 at the Gungan Swamp", step?.darkPower === 6 && step.darkBattleCardBonus === 4, powerLine(step));
});

run("Dont Spectate 'Em Welcome does nothing at Theed", () => {
  const g = game("swamp-off", THEED);
  const battle = put(g, "dark", "dontspectawermwelcome");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Dont Spectate 'Em Welcome does nothing at Theed", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("I Will Make It Legal joins Sidious and a non-unique Neimoidian", () => {
  const g = game("legal-win");
  const battle = put(g, "dark", "iwillmakeitlegal");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const neo = put(g, "dark", "neimoidianadvisorbureaucrat");
  const foe = put(g, "light", "nabooofficercommander");
  const steps = fight(g, [foe], [battle, sid, neo]);
  check(
    "I Will Make It Legal joins Sidious and a non-unique Neimoidian",
    steps.length === 1 && steps[0]?.darkPower === 6 && steps[0].darkCardId2 === "neimoidianadvisorbureaucrat",
    powerLine(steps[0])
  );
});

run("I Will Make It Legal defeats only the Neimoidian when they lose", () => {
  const g = game("legal-lose");
  const battle = put(g, "dark", "iwillmakeitlegal");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const neo = put(g, "dark", "neimoidianadvisorbureaucrat");
  const saber = put(g, "light", "macewinduslightsaber");
  const mace = put(g, "light", "macewindujedispeaker");
  const steps = fight(g, [saber, mace], [battle, sid, neo]);
  check(
    "I Will Make It Legal defeats only the Neimoidian when they lose",
    steps[0]?.winner === "light" && inZone(g.dark.discard, neo) && !inZone(g.dark.discard, sid) && inZone(g.dark.inPlay, sid) && (steps[0]?.darkMill ?? 0) === 2,
    powerLine(steps[0]) + ` sid play ${inZone(g.dark.inPlay, sid)} neo discard ${inZone(g.dark.discard, neo)}`
  );
});

run("I Will Make It Legal does not join Sidious with Nute", () => {
  const g = game("legal-no");
  const battle = put(g, "dark", "iwillmakeitlegal");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const nute = put(g, "dark", "nutegunrayneimoidiandespot");
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, sid, nute]);
  check("I Will Make It Legal does not join Sidious with Nute", steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 5, powerLine(steps[0]));
});

run("Not For a Sith adds 2 when Maul uses his lightsaber", () => {
  const g = game("notsith");
  const battle = put(g, "dark", "notforasith");
  const saber = put(g, "dark", "darthmaulslightsaber");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, saber, maul]);
  check(
    "Not For a Sith adds 2 when Maul uses his lightsaber",
    step?.darkPower === 8 && step.darkBattleCardBonus === 2 && (step.darkWeaponBonus ?? 0) === 0,
    powerLine(step) + " (Naboo saber adds no power when the deck is empty)"
  );
});

run("Naboo Darth Maul's Lightsaber draws two destiny cards", () => {
  const g = game("maulsaber-draw");
  top(g, "dark", "blaster_light");
  top(g, "dark", "heavyblaster");
  const saber = put(g, "dark", "darthmaulslightsaber");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [saber, maul]);
  check(
    "Naboo Darth Maul's Lightsaber draws two destiny cards",
    step?.darkPower === 15 && step.darkWeaponBonus === 9 && g.dark.deck.length === 0,
    powerLine(step) + ` deck ${g.dark.deck.length} (expected 6 + destiny 6 + destiny 3)`
  );
});

run("Not For a Sith does nothing when Maul has no lightsaber", () => {
  const g = game("notsith-no");
  const battle = put(g, "dark", "notforasith");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [battle, maul]);
  check("Not For a Sith does nothing when Maul has no lightsaber", step?.darkPower === 6 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Now There Are Two of Them joins Sidious and Maul", () => {
  const g = game("two");
  const battle = put(g, "dark", "nowtherearetwoofthem");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, sid, maul]);
  check(
    "Now There Are Two of Them joins Sidious and Maul",
    steps.length === 1 && steps[0]?.darkPower === 11 && steps[0].darkCardId2 === "darthmauldarklordofthesith",
    powerLine(steps[0])
  );
});

run("Now There Are Two of Them does not join Sidious and Nute", () => {
  const g = game("two-no");
  const battle = put(g, "dark", "nowtherearetwoofthem");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const nute = put(g, "dark", "nutegunrayneimoidiandespot");
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, sid, nute]);
  check("Now There Are Two of Them does not join Sidious and Nute", steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 5, powerLine(steps[0]));
});

run("Sith Force Push ignores the opponent's weapon when Maul has none", () => {
  const g = game("spush");
  const battle = put(g, "dark", "sithforcepush");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const saber = put(g, "light", "macewinduslightsaber");
  const off = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [saber, off], [battle, maul]);
  check(
    "Sith Force Push ignores the opponent's weapon when Maul has none",
    step?.darkPower === 6 && step.lightPower === 3 && (step.lightWeaponBonus ?? 0) === 0 && step.winner === "dark" && inZone(g.light.inPlay, saber) && inZone(g.light.discard, off),
    powerLine(step) + ` saber stays ${inZone(g.light.inPlay, saber)}`
  );
});

run("The Phantom Menace sends a losing Sidious back to hand with no damage", () => {
  const g = game("phantom");
  for (let i = 0; i < 6; i++) top(g, "dark", "blaster_dark");
  const battle = put(g, "dark", "thephantommenace");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const [step] = fight(g, [qui], [battle, sid]);
  check(
    "The Phantom Menace sends a losing Sidious back to hand with no damage",
    step?.winner === "light" && inZone(g.dark.hand, sid) && g.dark.deck.length === 6 && (step.darkMill ?? 0) === 0,
    powerLine(step) + ` hand ${inZone(g.dark.hand, sid)} deck ${g.dark.deck.length}`
  );
});

run("The Phantom Menace still damages the loser when Sidious wins", () => {
  const g = game("phantom-win");
  const battle = put(g, "dark", "thephantommenace");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const foe = put(g, "light", DROID);
  const [step] = fight(g, [foe], [battle, sid]);
  check(
    "The Phantom Menace still damages the loser when Sidious wins",
    step?.winner === "dark" && inZone(g.light.discard, foe) && (step.lightMill ?? 0) === 1 && g.dark.hand.length === 0,
    powerLine(step)
  );
});

run("They Win This Round joins two non-unique Destroyer Droids and adds 1", () => {
  const g = game("theywin");
  const battle = put(g, "dark", "theywinthisround");
  const a = put(g, "dark", "destroyerdroidvanguarddroid");
  const b = put(g, "dark", "destroyerdroidmttinfantry");
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, a, b]);
  check(
    "They Win This Round joins two non-unique Destroyer Droids and adds 1",
    steps.length === 1 && steps[0]?.darkPower === 7 && steps[0].darkBattleCardBonus === 1 && steps[0].darkCardId2 === "destroyerdroidmttinfantry",
    powerLine(steps[0])
  );
});

run("They Win This Round does not join the unique Destroyer Droid Squad", () => {
  const g = game("theywin-no");
  const battle = put(g, "dark", "theywinthisround");
  const squad = put(g, "dark", "destroyerdroidsquadguarddivision");
  const one = put(g, "dark", "destroyerdroidvanguarddroid");
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, squad, one]);
  check("They Win This Round does not join the unique Destroyer Droid Squad", steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 5, powerLine(steps[0]));
});

run("We Are Sending All Troops joins three non-unique battle droids", () => {
  const g = game("sending");
  const battle = put(g, "dark", "wearesendingalltroops");
  const a = put(g, "dark", DROID);
  const b = put(g, "dark", DROID2);
  const c = put(g, "dark", DROID3);
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, a, b, c]);
  check(
    "We Are Sending All Troops joins three non-unique battle droids",
    steps.length === 1 && steps[0]?.darkPower === 6 && steps[0].darkCardId3 === DROID3,
    powerLine(steps[0])
  );
});

run("We Are Sending All Troops does not join two battle droids", () => {
  const g = game("sending-no");
  const battle = put(g, "dark", "wearesendingalltroops");
  const a = put(g, "dark", DROID);
  const b = put(g, "dark", DROID2);
  const foe = put(g, "light", "nabooofficersquadleader");
  const steps = fight(g, [foe], [battle, a, b]);
  check("We Are Sending All Troops does not join two battle droids", steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 2, powerLine(steps[0]));
});

// --- Character game text ---

run("Obi-Wan Jedi Knight adds 1 when using Obi-Wan's Lightsaber", () => {
  const g = game("obi-saber");
  const saber = put(g, "light", "obiwankenobislightsaber");
  const obi = put(g, "light", "obiwankenobijediknight");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, obi], [foe]);
  check("Obi-Wan Jedi Knight adds 1 when using Obi-Wan's Lightsaber", step?.lightPower === 8 && step.lightWeaponBonus === 2, powerLine(step) + " (expected 5 + saber 2 + text 1)");
});

run("Obi-Wan Jedi Knight has no extra power without his lightsaber", () => {
  const g = game("obi-nosaber");
  const obi = put(g, "light", "obiwankenobijediknight");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [obi], [foe]);
  check("Obi-Wan Jedi Knight has no extra power without his lightsaber", step?.lightPower === 5, powerLine(step));
});

run("Jar Jar Bombad Gungan General adds 4 against a tank", () => {
  const g = game("jar-tank");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const tank = put(g, "dark", "tradefederationtankpatroldivision");
  const [step] = fight(g, [jar], [tank]);
  check("Jar Jar Bombad Gungan General adds 4 against a tank", step?.lightPower === 8 && step.darkPower === 4, powerLine(step));
});

run("Jar Jar Bombad Gungan General has no extra power against a battle droid", () => {
  const g = game("jar-droid");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [jar], [foe]);
  check("Jar Jar Bombad Gungan General has no extra power against a battle droid", step?.lightPower === 4, powerLine(step));
});

run("Darth Sidious adds 1 power and loses 1 damage with a Sith Lightsaber", () => {
  const g = game("sid-saber");
  const saber = put(g, "light", "macewinduslightsaber");
  const mace = put(g, "light", "macewindujedispeaker");
  const sith = put(g, "dark", "sithlightsaber");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const [step] = fight(g, [saber, mace], [sith, sid]);
  check(
    "Darth Sidious adds 1 power and loses 1 damage with a Sith Lightsaber",
    step?.darkPower === 7 && step.darkWeaponBonus === 1 && step.lightPower === 8 && step.winner === "light" && (step.darkMill ?? 0) === 5,
    powerLine(step) + " (expected power 5 + saber 1 + text 1, damage 6 - 1)"
  );
});

run("Darth Sidious takes full damage without a Sith Lightsaber", () => {
  const g = game("sid-nosaber");
  const mace = put(g, "light", "macewindujedispeaker");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const [step] = fight(g, [mace], [sid]);
  check("Darth Sidious takes full damage without a Sith Lightsaber", step?.darkPower === 5 && step.winner === "light" && (step.darkMill ?? 0) === 6, powerLine(step));
});

run("Aurra Sing adds 1 when using Aurra Sing's Blaster Rifle", () => {
  const g = game("aurra");
  const rifle = put(g, "dark", "aurrasingsblasterrifle");
  const aurra = put(g, "dark", "aurrasingmercenary");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [rifle, aurra]);
  check("Aurra Sing adds 1 when using Aurra Sing's Blaster Rifle", step?.darkPower === 8 && step.darkWeaponBonus === 2, powerLine(step) + " (expected 5 + rifle 2 + text 1)");
});

run("Aurra Sing has no extra power without her rifle", () => {
  const g = game("aurra-no");
  const aurra = put(g, "dark", "aurrasingmercenary");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [aurra]);
  check("Aurra Sing has no extra power without her rifle", step?.darkPower === 5, powerLine(step));
});

run("Nute Gunray adds 4 when fighting Queen Amidala", () => {
  const g = game("nute");
  const nute = put(g, "dark", "nutegunrayneimoidiandespot");
  const queen = put(g, "light", "queenamidalaresolutenegotiator");
  const [step] = fight(g, [queen], [nute]);
  check("Nute Gunray adds 4 when fighting Queen Amidala", step?.darkPower === 7 && step.lightPower === 2, powerLine(step));
});

run("Nute Gunray has no extra power against Padme", () => {
  const g = game("nute-no");
  const nute = put(g, "dark", "nutegunrayneimoidiandespot");
  const padme = put(g, "light", "padmenaberrieamidalashandmaiden");
  const [step] = fight(g, [padme], [nute]);
  check("Nute Gunray has no extra power against Padme", step?.darkPower === 3, powerLine(step));
});

run("Rune Haako adds 3 when fighting a handmaiden", () => {
  const g = game("rune");
  const rune = put(g, "dark", "runehaakoneimoidiandeputy");
  const padme = put(g, "light", "padmenaberrieamidalashandmaiden");
  const [step] = fight(g, [padme], [rune]);
  check("Rune Haako adds 3 when fighting a handmaiden", step?.darkPower === 6 && step.lightPower === 3, powerLine(step));
});

run("Rune Haako has no extra power against the Queen", () => {
  const g = game("rune-no");
  const rune = put(g, "dark", "runehaakoneimoidiandeputy");
  const queen = put(g, "light", "queenamidalaresolutenegotiator");
  const [step] = fight(g, [queen], [rune]);
  check("Rune Haako has no extra power against the Queen", step?.darkPower === 3, powerLine(step));
});

run("Qui-Gon Jedi Ambassador deploys for 3 when Qui-Gon Jedi Master is present", () => {
  const g = game("cost-qui");
  put(g, "light", "quigonjinnjedimaster");
  const cost = getDeployCostWithGametextBonus(g, "light", "quigonjinnjediambassador", SET);
  check("Qui-Gon Jedi Ambassador deploys for 3 when Qui-Gon Jedi Master is present", cost === 3, `cost ${cost}`);
});

run("Qui-Gon Jedi Ambassador keeps cost 6 without Qui-Gon Jedi Master", () => {
  const g = game("cost-qui-no");
  put(g, "light", "yodajedimaster");
  const cost = getDeployCostWithGametextBonus(g, "light", "quigonjinnjediambassador", SET);
  check("Qui-Gon Jedi Ambassador keeps cost 6 without Qui-Gon Jedi Master", cost === 6, `cost ${cost}`);
});

run("Mace Windu Jedi Speaker deploys for 3 when Yoda Jedi Master is present", () => {
  const g = game("cost-mace");
  put(g, "light", "yodajedimaster");
  const cost = getDeployCostWithGametextBonus(g, "light", "macewindujedispeaker", SET);
  check("Mace Windu Jedi Speaker deploys for 3 when Yoda Jedi Master is present", cost === 3, `cost ${cost}`);
});

run("Mace Windu Jedi Speaker keeps cost 6 when only Yoda Jedi Elder is present", () => {
  const g = game("cost-mace-no");
  put(g, "light", "yodajedielder");
  const cost = getDeployCostWithGametextBonus(g, "light", "macewindujedispeaker", SET);
  check("Mace Windu Jedi Speaker keeps cost 6 when only Yoda Jedi Elder is present", cost === 6, `cost ${cost}`);
});

run("Yoda Jedi Elder deploys for 2 when Mace Windu Jedi Master is present", () => {
  const g = game("cost-yoda");
  put(g, "light", "macewindujedimaster");
  const cost = getDeployCostWithGametextBonus(g, "light", "yodajedielder", SET);
  check("Yoda Jedi Elder deploys for 2 when Mace Windu Jedi Master is present", cost === 2, `cost ${cost}`);
});

run("Yoda Jedi Elder keeps cost 4 when only Mace Windu Jedi Speaker is present", () => {
  const g = game("cost-yoda-no");
  put(g, "light", "macewindujedispeaker");
  const cost = getDeployCostWithGametextBonus(g, "light", "yodajedielder", SET);
  check("Yoda Jedi Elder keeps cost 4 when only Mace Windu Jedi Speaker is present", cost === 4, `cost ${cost}`);
});

run("Darth Maul Dark Lord deploys for 3 when Darth Maul Sith Apprentice is present", () => {
  const g = game("cost-maul");
  put(g, "dark", "darthmaulsithapprentice");
  const cost = getDeployCostWithGametextBonus(g, "dark", "darthmauldarklordofthesith", SET);
  check("Darth Maul Dark Lord deploys for 3 when Darth Maul Sith Apprentice is present", cost === 3, `cost ${cost}`);
});

run("Darth Maul Dark Lord keeps cost 6 without Darth Maul Sith Apprentice", () => {
  const g = game("cost-maul-no");
  const cost = getDeployCostWithGametextBonus(g, "dark", "darthmauldarklordofthesith", SET);
  check("Darth Maul Dark Lord keeps cost 6 without Darth Maul Sith Apprentice", cost === 6, `cost ${cost}`);
});

// --- Weapons with a different backup user ---

run("Eeth Koth's Lightsaber adds 2 for Eeth Koth", () => {
  const g = game("eeth");
  const saber = put(g, "light", "eethkothslightsaber");
  const eeth = put(g, "light", "eethkothzabrakjedimaster");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, eeth], [foe]);
  check("Eeth Koth's Lightsaber adds 2 for Eeth Koth", step?.lightPower === 7 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Eeth Koth's Lightsaber gives another Jedi only the destiny draw", () => {
  const g = game("eeth-jedi");
  top(g, "light", "heavyblaster");
  const saber = put(g, "light", "eethkothslightsaber");
  const yoda = put(g, "light", "yodajedielder");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, yoda], [foe]);
  check("Eeth Koth's Lightsaber gives another Jedi only the destiny draw", step?.lightPower === 10 && step.lightWeaponBonus === 6, powerLine(step));
});

run("Mace Windu's Lightsaber adds 2 for Mace", () => {
  const g = game("macesaber");
  const saber = put(g, "light", "macewinduslightsaber");
  const mace = put(g, "light", "macewindujedispeaker");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, mace], [foe]);
  check("Mace Windu's Lightsaber adds 2 for Mace", step?.lightPower === 8 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Captain Tarpals' Electropole adds 2 for Tarpals", () => {
  const g = game("tarpals-pole");
  const pole = put(g, "light", "captaintarpalselectropole");
  const tarpals = put(g, "light", "captaintarpalsgunganofficer");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [pole, tarpals], [foe]);
  check("Captain Tarpals' Electropole adds 2 for Tarpals", step?.lightPower === 5 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Captain Tarpals' Electropole gives anyone else only the destiny draw", () => {
  const g = game("tarpals-any");
  top(g, "light", "heavyblaster");
  const pole = put(g, "light", "captaintarpalselectropole");
  const off = put(g, "light", "gunganofficialbureaucrat");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [pole, off], [foe]);
  check("Captain Tarpals' Electropole gives anyone else only the destiny draw", step?.lightPower === 8 && step.lightWeaponBonus === 6, powerLine(step));
});

run("Planetary Shuttle adds 2 for Valorum", () => {
  const g = game("shuttle");
  const shuttle = put(g, "light", "planetaryshuttle");
  const valorum = put(g, "light", "valorumsupremechancellor");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [shuttle, valorum], [foe]);
  check("Planetary Shuttle adds 2 for Valorum", step?.lightPower === 5 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Planetary Shuttle adds 2 for a senator", () => {
  const g = game("shuttle-sen");
  const shuttle = put(g, "light", "planetaryshuttle");
  const lott = put(g, "light", "lottdodneimoidiansenator");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [shuttle, lott], [foe]);
  check("Planetary Shuttle adds 2 for a senator", step?.lightPower === 4 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Planetary Shuttle gives anyone else only the destiny draw", () => {
  const g = game("shuttle-any");
  top(g, "light", "heavyblaster");
  const shuttle = put(g, "light", "planetaryshuttle");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [shuttle, jar], [foe]);
  check("Planetary Shuttle gives anyone else only the destiny draw", step?.lightPower === 10 && step.lightWeaponBonus === 6, powerLine(step));
});

run("Fambaa adds 2 for Boss Nass", () => {
  const g = game("fambaa");
  const fambaa = put(g, "light", "fambaa");
  const nass = put(g, "light", "bossnassgunganchief");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [fambaa, nass], [foe]);
  check("Fambaa adds 2 for Boss Nass", step?.lightPower === 6 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Fambaa gives another Gungan only the destiny draw", () => {
  const g = game("fambaa-gungan");
  top(g, "light", "heavyblaster");
  const fambaa = put(g, "light", "fambaa");
  const jar = put(g, "light", "jarjarbinksbombadgungangeneral");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [fambaa, jar], [foe]);
  check("Fambaa gives another Gungan only the destiny draw", step?.lightPower === 10 && step.lightWeaponBonus === 6, powerLine(step));
});

run("Fambaa does nothing for Qui-Gon", () => {
  const g = game("fambaa-no");
  top(g, "light", "heavyblaster");
  const fambaa = put(g, "light", "fambaa");
  const qui = put(g, "light", "quigonjinnjediambassador");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [fambaa, qui], [foe]);
  check("Fambaa does nothing for Qui-Gon", step?.lightPower === 6 && (step.lightWeaponBonus ?? 0) === 0 && g.light.deck.length === 1, powerLine(step));
});

run("Naboo Darth Maul's Lightsaber does nothing for Sidious", () => {
  const g = game("maulsaber-sid");
  top(g, "dark", "heavyblaster");
  const saber = put(g, "dark", "darthmaulslightsaber");
  const sid = put(g, "dark", "darthsidioussithmanipulator");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [saber, sid]);
  check("Naboo Darth Maul's Lightsaber does nothing for Sidious", step?.darkPower === 5 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1, powerLine(step));
});

run("Darth Maul's Electrobinoculars add 1 for Maul", () => {
  const g = game("bino");
  const bino = put(g, "dark", "darthmaulselectrobinoculars");
  const maul = put(g, "dark", "darthmauldarklordofthesith");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [bino, maul]);
  check("Darth Maul's Electrobinoculars add 1 for Maul", step?.darkPower === 7 && step.darkWeaponBonus === 1, powerLine(step));
});

run("Darth Maul's Electrobinoculars add 1 for a non-unique Sith Probe Droid", () => {
  const g = game("bino-probe");
  const bino = put(g, "dark", "darthmaulselectrobinoculars");
  const probe = put(g, "dark", "sithprobedroidhunterdroid");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [bino, probe]);
  check("Darth Maul's Electrobinoculars add 1 for a non-unique Sith Probe Droid", step?.darkPower === 2 && step.darkWeaponBonus === 1, powerLine(step));
});

run("Darth Maul's Electrobinoculars do nothing for a battle droid", () => {
  const g = game("bino-no");
  top(g, "dark", "heavyblaster");
  const bino = put(g, "dark", "darthmaulselectrobinoculars");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [bino, droid]);
  check("Darth Maul's Electrobinoculars do nothing for a battle droid",     step?.darkPower === 2 && (step.darkWeaponBonus ?? 0) === 0 && (step.darkMill ?? 0) === 1,
    powerLine(step)
  );
});

run("Naboo STAP adds 2 only for a non-unique battle droid", () => {
  const g = game("stap");
  const stap = put(g, "dark", "stap");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [stap, droid]);
  check("Naboo STAP adds 2 only for a non-unique battle droid", step?.darkPower === 4 && step.darkWeaponBonus === 2, powerLine(step));
});

run("Naboo STAP does nothing for the unique Battle Droid Squad", () => {
  const g = game("stap-no");
  top(g, "dark", "heavyblaster");
  const stap = put(g, "dark", "stap");
  const squad = put(g, "dark", "battledroidsquadguardunit");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [stap, squad]);
  check("Naboo STAP does nothing for the unique Battle Droid Squad", step?.darkPower === 4 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1, powerLine(step));
});

run("Naboo MTT adds 2 for a non-unique Destroyer Droid", () => {
  const g = game("mtt");
  const mtt = put(g, "dark", "multitrooptransport");
  const droid = put(g, "dark", "destroyerdroidvanguarddroid");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [mtt, droid]);
  check("Naboo MTT adds 2 for a non-unique Destroyer Droid", step?.darkPower === 5 && step.darkWeaponBonus === 2, powerLine(step));
});

run("Naboo MTT gives a non-unique battle droid only the destiny draw", () => {
  const g = game("mtt-droid");
  top(g, "dark", "heavyblaster");
  const mtt = put(g, "dark", "multitrooptransport");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [mtt, droid]);
  check("Naboo MTT gives a non-unique battle droid only the destiny draw", step?.darkPower === 8 && step.darkWeaponBonus === 6, powerLine(step));
});

run("Naboo MTT does nothing for the unique Destroyer Droid Squad", () => {
  const g = game("mtt-no");
  top(g, "dark", "heavyblaster");
  const mtt = put(g, "dark", "multitrooptransport");
  const squad = put(g, "dark", "destroyerdroidsquadguarddivision");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [mtt, squad]);
  check("Naboo MTT does nothing for the unique Destroyer Droid Squad", step?.darkPower === 5 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1, powerLine(step));
});

run("Naboo Tank Laser Cannon adds 2 only for a non-unique tank", () => {
  const g = game("cannon");
  const cannon = put(g, "dark", "tradefederationtanklasercannon");
  const tank = put(g, "dark", "tradefederationtankpatroldivision");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [cannon, tank]);
  check("Naboo Tank Laser Cannon adds 2 only for a non-unique tank", step?.darkPower === 6 && step.darkWeaponBonus === 2, powerLine(step));
});

run("Naboo Tank Laser Cannon does nothing for a battle droid", () => {
  const g = game("cannon-no");
  top(g, "dark", "heavyblaster");
  const cannon = put(g, "dark", "tradefederationtanklasercannon");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [cannon, droid]);
  check("Naboo Tank Laser Cannon does nothing for a battle droid",     step?.darkPower === 2 && (step.darkWeaponBonus ?? 0) === 0 && (step.darkMill ?? 0) === 1,
    powerLine(step)
  );
});

run("Naboo Battle Droid Blaster Rifle adds 1 for a non-unique battle droid", () => {
  const g = game("rifle-droid");
  const rifle = put(g, "dark", "battledroidblasterrifle");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [rifle, droid]);
  check("Naboo Battle Droid Blaster Rifle adds 1 for a non-unique battle droid", step?.darkPower === 3 && step.darkWeaponBonus === 1, powerLine(step));
});

run("Naboo Battle Droid Blaster Rifle adds 1 for a non-unique Neimoidian", () => {
  const g = game("rifle-neo");
  const rifle = put(g, "dark", "battledroidblasterrifle");
  const neo = put(g, "dark", "neimoidianadvisorbureaucrat");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [rifle, neo]);
  check("Naboo Battle Droid Blaster Rifle adds 1 for a non-unique Neimoidian", step?.darkPower === 2 && step.darkWeaponBonus === 1, powerLine(step));
});

run("Naboo Battle Droid Blaster Rifle does nothing for Nute", () => {
  const g = game("rifle-no");
  top(g, "dark", "heavyblaster");
  const rifle = put(g, "dark", "battledroidblasterrifle");
  const nute = put(g, "dark", "nutegunrayneimoidiandespot");
  const foe = put(g, "light", "nabooofficersquadleader");
  const [step] = fight(g, [foe], [rifle, nute]);
  check("Naboo Battle Droid Blaster Rifle does nothing for Nute", step?.darkPower === 3 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1, powerLine(step));
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "ok" : "FAIL"}  ${r.name}${r.ok ? "" : "\n      " + r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
