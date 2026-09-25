/**
 * The Menace of Darth Maul: battle cards on both sides, plus weapon user vs backup user.
 * Characters have no abilities in this set, so they are only here as the people a battle card or weapon names.
 * Run from server/: npx ts-node scripts/check-menace.ts
 */
import { initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import { createGameState, resolveBattlePlan, type GameStateData } from "../src/game/state";

initCards();

const SET = "menaceofdarthmaul";
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

/** Deck top is the end of the array. */
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

function run(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    check(name, false, err instanceof Error ? err.message : String(err));
  }
}

function powerLine(step: Step | undefined): string {
  if (!step) return "no fight";
  return `light ${step.lightPower} (card ${step.lightBattleCardBonus ?? 0}) dark ${step.darkPower} (card ${step.darkBattleCardBonus ?? 0}) second ${step.lightCardId2 ?? "-"}/${step.darkCardId2 ?? "-"} third ${step.lightCardId3 ?? "-"}/${step.darkCardId3 ?? "-"}`;
}

// --- Light battle cards ---

run("Security Volunteers adds 2 for a non-unique Royal Guard", () => {
  const g = game("sv");
  const battle = put(g, "light", "securityvolunteers");
  const guard = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, guard], [foe]);
  check(
    "Security Volunteers adds 2 for a non-unique Royal Guard",
    step?.lightPower === 4 && step.darkPower === 2 && step.lightBattleCardBonus === 2,
    powerLine(step) + " (expected 4 vs 2, bonus 2)"
  );
});

run("Security Volunteers does nothing for Qui-Gon", () => {
  const g = game("sv-no");
  const battle = put(g, "light", "securityvolunteers");
  const qui = put(g, "light", "quigonjinnjedimaster");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, qui], [foe]);
  check(
    "Security Volunteers does nothing for Qui-Gon",
    step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Qui-Gon 6 and no bonus)"
  );
});

run("Anakin Skywalker, Meet Obi-Wan Kenobi puts those two in one fight", () => {
  const g = game("meet");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "anakinskywalkermeetobiwankenobi");
  const anakin = put(g, "light", "anakinskywalkerpodracerpilot");
  const obi = put(g, "light", "obiwankenobiyoungjedi");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const steps = fight(g, [battle, anakin, obi], [foe]);
  const step = steps[0];
  check(
    "Anakin Skywalker, Meet Obi-Wan Kenobi puts those two in one fight",
    steps.length === 1 && step?.lightCardId2 === obi.cardId && step.lightPower === 8 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + ` steps ${steps.length} (expected one fight, Anakin destiny 3 + Obi-Wan 5)`
  );
});

run("Anakin Skywalker, Meet Obi-Wan Kenobi does not pair Anakin with Jar Jar", () => {
  const g = game("meet-no");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "anakinskywalkermeetobiwankenobi");
  const anakin = put(g, "light", "anakinskywalkerpodracerpilot");
  const jar = put(g, "light", "jarjarbinksgunganchubathief");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [battle, anakin, jar], [foe, foe2]);
  check(
    "Anakin Skywalker, Meet Obi-Wan Kenobi does not pair Anakin with Jar Jar",
    steps.length === 2 && steps[0]?.lightCardId2 == null,
    `steps ${steps.length} second ${steps[0]?.lightCardId2 ?? "-"} (expected two separate fights)`
  );
});

run("Are You An Angel? adds 3 when Anakin and Padme fight together", () => {
  const g = game("angel");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "areyouanangel");
  const anakin = put(g, "light", "anakinskywalkerpodracerpilot");
  const padme = put(g, "light", "padmenaberriehandmaiden");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, anakin, padme], [foe]);
  check(
    "Are You An Angel? adds 3 when Anakin and Padme fight together",
    step?.lightCardId2 === padme.cardId && step.lightPower === 9 && step.lightBattleCardBonus === 3,
    powerLine(step) + " (expected 3 + 3 + 3)"
  );
});

run("Are You An Angel? does not pair Padme with the Queen", () => {
  const g = game("angel-no");
  const battle = put(g, "light", "areyouanangel");
  const padme = put(g, "light", "padmenaberriehandmaiden");
  const queen = put(g, "light", "queenamidalarulerofnaboo");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [battle, padme, queen], [foe, foe2]);
  check(
    "Are You An Angel? does not pair Padme with the Queen",
    steps.length === 2 && steps[0]?.lightCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("Cha Skrunee Da Pat, Sleemo adds 4 at the Podrace Arena", () => {
  const g = game("sleemo", "tatooinepodracearena");
  const battle = put(g, "light", "chaskruneedapatsleemo");
  const guard = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, guard], [foe]);
  check(
    "Cha Skrunee Da Pat, Sleemo adds 4 at the Podrace Arena",
    step?.lightPower === 8 && step.lightBattleCardBonus === 4 && step.darkPower === 2,
    powerLine(step) + " (expected guard 2 + arena 2 + card 4 vs droid 2)"
  );
});

run("Cha Skrunee Da Pat, Sleemo does nothing off the Podrace Arena", () => {
  const g = game("sleemo-no");
  const battle = put(g, "light", "chaskruneedapatsleemo");
  const guard = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, guard], [foe]);
  check(
    "Cha Skrunee Da Pat, Sleemo does nothing off the Podrace Arena",
    step?.lightPower === 2 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected guard 2 and no bonus)"
  );
});

run("Counterparts draws 2 destiny and ignores a weapon", () => {
  const g = game("counter");
  top(g, "light", "blasterrifle_light");
  top(g, "light", "sithlightsaber");
  top(g, "light", "sithlightsaber");
  const battle = put(g, "light", "counterparts");
  const rifle = put(g, "light", "blasterrifle_light");
  const r2 = put(g, "light", "r2d2astromechdroid");
  const c3 = put(g, "light", "c3poanakinscreation");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, rifle, r2, c3], [foe]);
  check(
    "Counterparts draws 2 destiny and ignores a weapon",
    step?.lightCardId2 === c3.cardId &&
      step.lightPower === 6 &&
      (step.lightWeaponBonus ?? 0) === 0 &&
      (step.lightBattleDestinyDraws?.length ?? 0) === 2 &&
      g.light.deck.length === 1,
    powerLine(step) + ` draws ${step?.lightBattleDestinyDraws?.length} deck left ${g.light.deck.length} (expected power 6, two battle draws, weapon draw left in the deck)`
  );
});

run("Counterparts does not pair R2-D2 with Jar Jar", () => {
  const g = game("counter-no");
  const battle = put(g, "light", "counterparts");
  const r2 = put(g, "light", "r2d2astromechdroid");
  const jar = put(g, "light", "jarjarbinksgunganchubathief");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [battle, r2, jar], [foe, foe2]);
  check(
    "Counterparts does not pair R2-D2 with Jar Jar",
    steps.length === 2 && steps[0]?.lightCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("Da Beings Hereabouts Cawazy adds 3 on Tatooine", () => {
  const g = game("cawazy", "tatooinedesertlandingsite");
  const battle = put(g, "light", "dabeingshereaboutscawazy");
  const guard = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "tuskenraidermarksman");
  const [step] = fight(g, [battle, guard], [foe]);
  check(
    "Da Beings Hereabouts Cawazy adds 3 on Tatooine",
    step?.lightPower === 5 && step.lightBattleCardBonus === 3 && step.darkPower === 2,
    powerLine(step) + " (expected 5 vs 2)"
  );
});

run("Da Beings Hereabouts Cawazy does nothing on Coruscant", () => {
  const g = game("cawazy-no");
  const battle = put(g, "light", "dabeingshereaboutscawazy");
  const guard = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "tuskenraidermarksman");
  const [step] = fight(g, [battle, guard], [foe]);
  check(
    "Da Beings Hereabouts Cawazy does nothing on Coruscant",
    step?.lightPower === 2 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected 2 and no bonus)"
  );
});

run("Enough Of This Pretense adds 3 for Queen Amidala", () => {
  const g = game("pretense");
  const battle = put(g, "light", "enoughofthispretense");
  const queen = put(g, "light", "queenamidalarulerofnaboo");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, queen], [foe]);
  check(
    "Enough Of This Pretense adds 3 for Queen Amidala",
    step?.lightPower === 5 && step.lightBattleCardBonus === 3,
    powerLine(step) + " (expected queen 2 + 3)"
  );
});

run("Enough Of This Pretense does nothing for Padme", () => {
  const g = game("pretense-no");
  const battle = put(g, "light", "enoughofthispretense");
  const padme = put(g, "light", "padmenaberriehandmaiden");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, padme], [foe]);
  check(
    "Enough Of This Pretense does nothing for Padme",
    step?.lightPower === 3 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Padme 3)"
  );
});

run("Fear Attracts The Fearful adds 2 when Anakin and Jar Jar fight together", () => {
  const g = game("fear");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "fearattractsthefearful");
  const anakin = put(g, "light", "anakinskywalkerpodracerpilot");
  const jar = put(g, "light", "jarjarbinksgunganchubathief");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, anakin, jar], [foe]);
  check(
    "Fear Attracts The Fearful adds 2 when Anakin and Jar Jar fight together",
    step?.lightCardId2 === jar.cardId && step.lightPower === 9 && step.lightBattleCardBonus === 2,
    powerLine(step) + " (expected 3 + 4 + 2)"
  );
});

run("Gungan Curiosity sends three non-unique Gungans in as one fight", () => {
  const g = game("gungan");
  const battle = put(g, "light", "gungancuriosity");
  const a = put(g, "light", "gunganwarriorinfantry");
  const b = put(g, "light", "gungansoldierscout");
  const c = put(g, "light", "gunganguard");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const steps = fight(g, [battle, a, b, c], [foe]);
  const step = steps[0];
  check(
    "Gungan Curiosity sends three non-unique Gungans in as one fight",
    steps.length === 1 && step?.lightCardId3 === c.cardId && step.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + ` steps ${steps.length} (expected 2+2+2 and no extra power)`
  );
});

run("Gungan Curiosity does not accept Boss Nass", () => {
  const g = game("gungan-no");
  const battle = put(g, "light", "gungancuriosity");
  const a = put(g, "light", "bossnassleaderofthegungans");
  const b = put(g, "light", "gungansoldierscout");
  const c = put(g, "light", "gunganguard");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const foe3 = put(g, "dark", "battledroidofficeraatdivision");
  const steps = fight(g, [battle, a, b, c], [foe, foe2, foe3]);
  check(
    "Gungan Curiosity does not accept Boss Nass",
    steps.length === 3 && steps[0]?.lightCardId2 == null,
    `steps ${steps.length} (expected three separate fights)`
  );
});

run("He Was Meant To Help You pairs Anakin with Qui-Gon", () => {
  const g = game("meant");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "hewasmeanttohelpyou");
  const anakin = put(g, "light", "anakinskywalkerpodracerpilot");
  const qui = put(g, "light", "quigonjinnjedimaster");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const steps = fight(g, [battle, anakin, qui], [foe]);
  check(
    "He Was Meant To Help You pairs Anakin with Qui-Gon",
    steps.length === 1 && steps[0]?.lightCardId2 === qui.cardId && steps[0].lightPower === 9,
    powerLine(steps[0]) + ` steps ${steps.length} (expected 3 + 6)`
  );
});

run("I Have A Bad Feeling About This sends a losing Obi-Wan back to hand with no damage", () => {
  const g = game("bad");
  for (let i = 0; i < 6; i++) top(g, "light", "blaster_light");
  const battle = put(g, "light", "ihaveabadfeelingaboutthis");
  const obi = put(g, "light", "obiwankenobiyoungjedi");
  const maul = put(g, "dark", "darthmaulsithapprentice");
  const [step] = fight(g, [battle, obi], [maul]);
  const back = g.light.hand.some((c) => c.instanceId === obi.instanceId);
  check(
    "I Have A Bad Feeling About This sends a losing Obi-Wan back to hand with no damage",
    step?.winner === "dark" && back && g.light.deck.length === 6 && (step.lightMill ?? 0) === 0,
    `winner ${step?.winner} hand ${back} deck ${g.light.deck.length} mill ${step?.lightMill ?? 0} (expected back to hand, deck untouched)`
  );
});

run("I Have A Bad Feeling About This still damages the loser when Obi-Wan wins", () => {
  const g = game("bad-win");
  top(g, "dark", "blaster_dark");
  const battle = put(g, "light", "ihaveabadfeelingaboutthis");
  const obi = put(g, "light", "obiwankenobiyoungjedi");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, obi], [foe]);
  const foeDiscarded = g.dark.discard.some((c) => c.instanceId === foe.instanceId);
  check(
    "I Have A Bad Feeling About This still damages the loser when Obi-Wan wins",
    step?.winner === "light" && foeDiscarded && (step.darkMill ?? 0) === 1 && g.light.hand.length === 0,
    `winner ${step?.winner} discarded ${foeDiscarded} mill ${step?.darkMill ?? 0} obi hand ${g.light.hand.length}`
  );
});

run("I've Been Trained In Defense adds 3 for Padme", () => {
  const g = game("trained");
  const battle = put(g, "light", "ivebeentrainedindefense");
  const padme = put(g, "light", "padmenaberriehandmaiden");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, padme], [foe]);
  check(
    "I've Been Trained In Defense adds 3 for Padme",
    step?.lightPower === 6 && step.lightBattleCardBonus === 3,
    powerLine(step) + " (expected 3 + 3)"
  );
});

run("I've Been Trained In Defense does nothing for the Queen", () => {
  const g = game("trained-no");
  const battle = put(g, "light", "ivebeentrainedindefense");
  const queen = put(g, "light", "queenamidalarulerofnaboo");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, queen], [foe]);
  check(
    "I've Been Trained In Defense does nothing for the Queen",
    step?.lightPower === 2 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected queen 2)"
  );
});

run("Shmi's Pride adds 3 for Anakin", () => {
  const g = game("shmi");
  top(g, "light", "blaster_light");
  const battle = put(g, "light", "shmispride");
  const anakin = put(g, "light", "anakinskywalkerpodracerpilot");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, anakin], [foe]);
  check(
    "Shmi's Pride adds 3 for Anakin",
    step?.lightPower === 6 && step.lightBattleCardBonus === 3,
    powerLine(step) + " (expected destiny 3 + card 3)"
  );
});

run("The Federation Has Gone Too Far adds 1 for two Naboo Officers", () => {
  const g = game("federation");
  const battle = put(g, "light", "thefederationhasgonetoofar");
  const a = put(g, "light", "nabooofficerbattleplanner");
  const b = put(g, "light", "nabooofficerbattleplanner");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, a, b], [foe]);
  check(
    "The Federation Has Gone Too Far adds 1 for two Naboo Officers",
    step?.lightCardId2 === b.cardId && step.lightPower === 7 && step.lightBattleCardBonus === 1,
    powerLine(step) + " (expected 3 + 3 + 1)"
  );
});

run("The Federation Has Gone Too Far does not pair an officer with a Royal Guard", () => {
  const g = game("federation-no");
  const battle = put(g, "light", "thefederationhasgonetoofar");
  const a = put(g, "light", "nabooofficerbattleplanner");
  const b = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [battle, a, b], [foe, foe2]);
  check(
    "The Federation Has Gone Too Far does not pair an officer with a Royal Guard",
    steps.length === 2 && steps[0]?.lightCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("The Negotiations Were Short adds 3 only for the first character", () => {
  const g = game("negotiations");
  const first = put(g, "light", "royalguardleader");
  const battle = put(g, "light", "thenegotiationswereshort");
  const second = put(g, "light", "royalguardveteran");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [battle, first, second], [foe, foe2]);
  check(
    "The Negotiations Were Short adds 3 only for the first character",
    steps[0]?.lightPower === 5 &&
      steps[0].lightBattleCardBonus === 3 &&
      steps[1]?.lightPower === 2 &&
      (steps[1].lightBattleCardBonus ?? 0) === 0,
    `first ${powerLine(steps[0])} | second ${powerLine(steps[1])}`
  );
});

run("The Queen's Plan sends a Royal Guard, Naboo Security, and Bravo Pilot in together", () => {
  const g = game("queen");
  const battle = put(g, "light", "thequeensplan");
  const a = put(g, "light", "royalguardleader");
  const b = put(g, "light", "nabooosecurityguard");
  const c = put(g, "light", "bravopilotveteranflyer");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const steps = fight(g, [battle, a, b, c], [foe]);
  check(
    "The Queen's Plan sends a Royal Guard, Naboo Security, and Bravo Pilot in together",
    steps.length === 1 && steps[0]?.lightCardId3 === c.cardId && steps[0].lightPower === 6,
    powerLine(steps[0]) + ` steps ${steps.length} (expected 2+2+2)`
  );
});

run("We're Not In Trouble Yet adds 2 for Qui-Gon", () => {
  const g = game("trouble");
  const battle = put(g, "light", "werenotintroubleyet");
  const qui = put(g, "light", "quigonjinnjedimaster");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, qui], [foe]);
  check(
    "We're Not In Trouble Yet adds 2 for Qui-Gon",
    step?.lightPower === 8 && step.lightBattleCardBonus === 2,
    powerLine(step) + " (expected 6 + 2)"
  );
});

run("We're Not In Trouble Yet does nothing for Obi-Wan", () => {
  const g = game("trouble-no");
  const battle = put(g, "light", "werenotintroubleyet");
  const obi = put(g, "light", "obiwankenobiyoungjedi");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [battle, obi], [foe]);
  check(
    "We're Not In Trouble Yet does nothing for Obi-Wan",
    step?.lightPower === 5 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Obi-Wan 5)"
  );
});

run("Yousa Guys Bombad! pairs two of the same persona", () => {
  const g = game("bombad");
  const battle = put(g, "light", "yousaguysbombad");
  const a = put(g, "light", "obiwankenobiyoungjedi");
  const b = put(g, "light", "obiwankenobijedipadawan");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const steps = fight(g, [battle, a, b], [foe]);
  check(
    "Yousa Guys Bombad! pairs two of the same persona",
    steps.length === 1 && steps[0]?.lightCardId2 === b.cardId && steps[0].lightPower === 8,
    powerLine(steps[0]) + ` steps ${steps.length} (expected 5 + 3)`
  );
});

run("Yousa Guys Bombad! does not pair Obi-Wan with Qui-Gon", () => {
  const g = game("bombad-no");
  const battle = put(g, "light", "yousaguysbombad");
  const a = put(g, "light", "obiwankenobiyoungjedi");
  const b = put(g, "light", "quigonjinnjedimaster");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [battle, a, b], [foe, foe2]);
  check(
    "Yousa Guys Bombad! does not pair Obi-Wan with Qui-Gon",
    steps.length === 2 && steps[0]?.lightCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

// --- Dark battle cards ---

run("In Complete Control adds 2 for a non-unique Battle Droid", () => {
  const g = game("control");
  const battle = put(g, "dark", "incompletecontrol");
  const droid = put(g, "dark", "battledroidinfantrymttdivision");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, droid]);
  check(
    "In Complete Control adds 2 for a non-unique Battle Droid",
    step?.darkPower === 4 && step.darkBattleCardBonus === 2 && step.lightPower === 2,
    powerLine(step) + " (expected 4 vs 2)"
  );
});

run("In Complete Control does nothing for Darth Maul", () => {
  const g = game("control-no");
  const battle = put(g, "dark", "incompletecontrol");
  const maul = put(g, "dark", "darthmaulsithapprentice");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, maul]);
  check(
    "In Complete Control does nothing for Darth Maul",
    step?.darkPower === 6 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Maul 6)"
  );
});

run("At Last We Will Have Revenge adds 3 against a Jedi", () => {
  const g = game("revenge");
  const battle = put(g, "dark", "atlastwewillhaverevenge");
  const maul = put(g, "dark", "darthmaulsithapprentice");
  const obi = put(g, "light", "obiwankenobiyoungjedi");
  const [step] = fight(g, [obi], [battle, maul]);
  check(
    "At Last We Will Have Revenge adds 3 against a Jedi",
    step?.darkPower === 9 && step.darkBattleCardBonus === 3 && step.lightPower === 5,
    powerLine(step) + " (expected 9 vs 5)"
  );
});

run("At Last We Will Have Revenge does nothing against a Royal Guard", () => {
  const g = game("revenge-no");
  const battle = put(g, "dark", "atlastwewillhaverevenge");
  const maul = put(g, "dark", "darthmaulsithapprentice");
  const guard = put(g, "light", "royalguardleader");
  const [step] = fight(g, [guard], [battle, maul]);
  check(
    "At Last We Will Have Revenge does nothing against a Royal Guard",
    step?.darkPower === 6 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Maul 6)"
  );
});

run("Begin Landing Your Troops adds 1 for two Destroyer Droids", () => {
  const g = game("landing");
  const battle = put(g, "dark", "beginlandingyourtroops");
  const a = put(g, "dark", "destroyerdroidwheeldroid");
  const b = put(g, "dark", "destroyerdroiddefensedroid");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, a, b]);
  check(
    "Begin Landing Your Troops adds 1 for two Destroyer Droids",
    step?.darkCardId2 === b.cardId && step.darkPower === 7 && step.darkBattleCardBonus === 1,
    powerLine(step) + " (expected 3 + 3 + 1)"
  );
});

run("Begin Landing Your Troops does not pair a Destroyer Droid with a Battle Droid", () => {
  const g = game("landing-no");
  const battle = put(g, "dark", "beginlandingyourtroops");
  const a = put(g, "dark", "destroyerdroidwheeldroid");
  const b = put(g, "dark", "battledroidinfantrymttdivision");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [battle, a, b]);
  check(
    "Begin Landing Your Troops does not pair a Destroyer Droid with a Battle Droid",
    steps.length === 2 && steps[0]?.darkCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("Boonta Eve Podrace adds 2 for Jabba alone", () => {
  const g = game("boonta");
  const battle = put(g, "dark", "boontaevepodrace");
  const jabba = put(g, "dark", "jabbathehuttvilecrimelord");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, jabba]);
  check(
    "Boonta Eve Podrace adds 2 for Jabba alone",
    step?.darkPower === 6 && step.darkBattleCardBonus === 2 && step.darkCardId2 == null,
    powerLine(step) + " (expected Jabba 4 + 2)"
  );
});

run("Boonta Eve Podrace adds 2 for Gardulla and nothing for Bib Fortuna", () => {
  const g = game("boonta-bib");
  const gardullaCard = put(g, "dark", "boontaevepodrace");
  const gardulla = put(g, "dark", "gardullathehuttvilecrimelord");
  const bibCard = put(g, "dark", "boontaevepodrace");
  const bib = put(g, "dark", "bibfortunatwilekadvisor");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [gardullaCard, gardulla, bibCard, bib]);
  check(
    "Boonta Eve Podrace adds 2 for Gardulla and nothing for Bib Fortuna",
    steps[0]?.darkPower === 5 && steps[0].darkBattleCardBonus === 2 && steps[1]?.darkPower === 2 && (steps[1].darkBattleCardBonus ?? 0) === 0,
    `gardulla ${powerLine(steps[0])} | bib ${powerLine(steps[1])}`
  );
});

run("Grueling Contest adds 2 for a podracer and a pit droid", () => {
  const g = game("grueling");
  const pilotCard = put(g, "dark", "gruelingcontest");
  const pilot = put(g, "dark", "sebulbabadtempereddug");
  const pitCard = put(g, "dark", "gruelingcontest");
  const pit = put(g, "dark", "pitdroidengineer");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [pilotCard, pilot, pitCard, pit]);
  check(
    "Grueling Contest adds 2 for a podracer and a pit droid",
    steps[0]?.darkPower === 6 && steps[0].darkBattleCardBonus === 2 && steps[1]?.darkPower === 3 && steps[1].darkBattleCardBonus === 2,
    `pilot ${powerLine(steps[0])} | pit ${powerLine(steps[1])}`
  );
});

run("Grueling Contest does nothing for Jabba", () => {
  const g = game("grueling-no");
  const battle = put(g, "dark", "gruelingcontest");
  const jabba = put(g, "dark", "jabbathehuttvilecrimelord");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, jabba]);
  check(
    "Grueling Contest does nothing for Jabba",
    step?.darkPower === 4 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Jabba 4)"
  );
});

run("Kaa Bazza Kundee Hodrudda! adds 1 when Jabba and Bib fight together", () => {
  const g = game("kaa");
  const battle = put(g, "dark", "kaabazzakundeehodrudda");
  const jabba = put(g, "dark", "jabbathehuttvilecrimelord");
  const bib = put(g, "dark", "bibfortunatwilekadvisor");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, jabba, bib]);
  check(
    "Kaa Bazza Kundee Hodrudda! adds 1 when Jabba and Bib fight together",
    step?.darkCardId2 === bib.cardId && step.darkPower === 7 && step.darkBattleCardBonus === 1,
    powerLine(step) + " (expected 4 + 2 + 1)"
  );
});

run("Kaa Bazza Kundee Hodrudda! does not give Jabba the bonus alone", () => {
  const g = game("kaa-no");
  const battle = put(g, "dark", "kaabazzakundeehodrudda");
  const jabba = put(g, "dark", "jabbathehuttvilecrimelord");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, jabba]);
  check(
    "Kaa Bazza Kundee Hodrudda! does not give Jabba the bonus alone",
    step?.darkCardId2 == null && step?.darkPower === 4 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected Jabba 4 alone)"
  );
});

run("Opee Sea Killer adds 3 only for the first character", () => {
  const g = game("opee");
  const first = put(g, "dark", "darthmaulsithlord");
  const battle = put(g, "dark", "opeeseakiller");
  const second = put(g, "dark", "battledroidinfantrymttdivision");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [battle, first, second]);
  check(
    "Opee Sea Killer adds 3 only for the first character",
    steps[0]?.darkPower === 6 && steps[0].darkBattleCardBonus === 3 && steps[1]?.darkPower === 2 && (steps[1].darkBattleCardBonus ?? 0) === 0,
    `first ${powerLine(steps[0])} | second ${powerLine(steps[1])}`
  );
});

run("Podrace Preparation adds 2 when Sebulba's attendants and Sebulba fight together", () => {
  const g = game("prep");
  const battle = put(g, "dark", "podracepreparation");
  const attendants = put(g, "dark", "annandtanngellasebulbasattendants");
  const sebulba = put(g, "dark", "sebulbabadtempereddug");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, attendants, sebulba]);
  check(
    "Podrace Preparation adds 2 when Sebulba's attendants and Sebulba fight together",
    step?.darkCardId2 === sebulba.cardId && step.darkPower === 7 && step.darkBattleCardBonus === 2,
    powerLine(step) + " (expected 1 + 4 + 2)"
  );
});

run("Podrace Preparation does not pair Sebulba with Ben Quadinaros", () => {
  const g = game("prep-no");
  const battle = put(g, "dark", "podracepreparation");
  const ben = put(g, "dark", "benquadinarospodracerpilot");
  const sebulba = put(g, "dark", "sebulbabadtempereddug");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [battle, ben, sebulba]);
  check(
    "Podrace Preparation does not pair Sebulba with Ben Quadinaros",
    steps.length === 2 && steps[0]?.darkCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("Sandstorm adds 3 on Tatooine", () => {
  const g = game("sand", "tatooinedesertlandingsite");
  const battle = put(g, "dark", "sandstorm");
  const guard = put(g, "light", "royalguardleader");
  const foe = put(g, "dark", "tuskenraidermarksman");
  const [step] = fight(g, [guard], [battle, foe]);
  check(
    "Sandstorm adds 3 on Tatooine",
    step?.darkPower === 5 && step.darkBattleCardBonus === 3 && step.lightPower === 2,
    powerLine(step) + " (expected 5 vs 2)"
  );
});

run("Sandstorm does nothing on Coruscant", () => {
  const g = game("sand-no");
  const battle = put(g, "dark", "sandstorm");
  const foe = put(g, "dark", "tuskenraidermarksman");
  const guard = put(g, "light", "royalguardleader");
  const [step] = fight(g, [guard], [battle, foe]);
  check(
    "Sandstorm does nothing on Coruscant",
    step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected 2)"
  );
});

run("Sniper adds 4 for a Tusken at the Desert Landing Site", () => {
  const g = game("sniper", "tatooinedesertlandingsite");
  const battle = put(g, "dark", "sniper");
  const tusken = put(g, "dark", "tuskenraidermarksman");
  const guard = put(g, "light", "royalguardleader");
  const [step] = fight(g, [guard], [battle, tusken]);
  check(
    "Sniper adds 4 for a Tusken at the Desert Landing Site",
    step?.darkPower === 6 && step.darkBattleCardBonus === 4,
    powerLine(step) + " (expected 2 + 4)"
  );
});

run("Sniper does nothing for a Tusken away from the Desert Landing Site", () => {
  const g = game("sniper-away");
  const battle = put(g, "dark", "sniper");
  const tusken = put(g, "dark", "tuskenraidermarksman");
  const guard = put(g, "light", "royalguardleader");
  const [step] = fight(g, [guard], [battle, tusken]);
  check(
    "Sniper does nothing for a Tusken away from the Desert Landing Site",
    step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected 2)"
  );
});

run("Sniper does nothing for a pit droid even at the Desert Landing Site", () => {
  const g = game("sniper-pit", "tatooinedesertlandingsite");
  const battle = put(g, "dark", "sniper");
  const pit = put(g, "dark", "pitdroidengineer");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, pit]);
  check(
    "Sniper does nothing for a pit droid even at the Desert Landing Site",
    step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected pit droid 1 + desert bonus 1, no card)"
  );
});

run("The Invasion Is On Schedule sends three Battle Droids in as one fight", () => {
  const g = game("invasion");
  const battle = put(g, "dark", "theinvasionisonschedule");
  const a = put(g, "dark", "battledroidinfantrymttdivision");
  const b = put(g, "dark", "battledroidofficeraatdivision");
  const c = put(g, "dark", "battledroidpilotaatdivision");
  const foe = put(g, "light", "royalguardleader");
  const steps = fight(g, [foe], [battle, a, b, c]);
  check(
    "The Invasion Is On Schedule sends three Battle Droids in as one fight",
    steps.length === 1 && steps[0]?.darkCardId3 === c.cardId && steps[0].darkPower === 6 && (steps[0].darkBattleCardBonus ?? 0) === 0,
    powerLine(steps[0]) + ` steps ${steps.length} (expected 2+2+2)`
  );
});

run("The Invasion Is On Schedule does nothing with only two Battle Droids", () => {
  const g = game("invasion-no");
  const battle = put(g, "dark", "theinvasionisonschedule");
  const a = put(g, "dark", "battledroidinfantrymttdivision");
  const b = put(g, "dark", "battledroidofficeraatdivision");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [battle, a, b]);
  check(
    "The Invasion Is On Schedule does nothing with only two Battle Droids",
    steps.length === 2 && steps[0]?.darkCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("Vile Gangsters adds 4 when Jabba and Gardulla fight together", () => {
  const g = game("vile");
  const battle = put(g, "dark", "vilegangsters");
  const jabba = put(g, "dark", "jabbathehuttvilecrimelord");
  const gardulla = put(g, "dark", "gardullathehuttvilecrimelord");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, jabba, gardulla]);
  check(
    "Vile Gangsters adds 4 when Jabba and Gardulla fight together",
    step?.darkCardId2 === gardulla.cardId && step.darkPower === 11 && step.darkBattleCardBonus === 4,
    powerLine(step) + " (expected 4 + 3 + 4)"
  );
});

run("Vile Gangsters does not pair Jabba with Bib", () => {
  const g = game("vile-no");
  const battle = put(g, "dark", "vilegangsters");
  const jabba = put(g, "dark", "jabbathehuttvilecrimelord");
  const bib = put(g, "dark", "bibfortunatwilekadvisor");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [battle, jabba, bib]);
  check(
    "Vile Gangsters does not pair Jabba with Bib",
    steps.length === 2 && steps[0]?.darkCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

run("Watto's Wager adds a destiny draw for Watto", () => {
  const g = game("wager");
  top(g, "dark", "tatooinethunderrifle");
  const battle = put(g, "dark", "wattoswager");
  const watto = put(g, "dark", "wattoslaveowner");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, watto]);
  check(
    "Watto's Wager adds a destiny draw for Watto",
    step?.darkPower === 8 && step.darkBattleDestinyDraws?.[0]?.destiny === 5,
    powerLine(step) + ` draw ${step?.darkBattleDestinyDraws?.[0]?.destiny} (expected 3 + 5)`
  );
});

run("Watto's Wager does nothing for Sebulba", () => {
  const g = game("wager-no");
  top(g, "dark", "tatooinethunderrifle");
  const battle = put(g, "dark", "wattoswager");
  const sebulba = put(g, "dark", "sebulbabadtempereddug");
  const foe = put(g, "light", "royalguardleader");
  const [step] = fight(g, [foe], [battle, sebulba]);
  check(
    "Watto's Wager does nothing for Sebulba",
    step?.darkPower === 4 && (step.darkBattleDestinyDraws?.length ?? 0) === 0 && g.dark.deck.length === 1,
    powerLine(step) + ` deck ${g.dark.deck.length} (expected Sebulba 4, destiny still in the deck)`
  );
});

run("You Have Been Well Trained pairs two Darth Mauls", () => {
  const g = game("trained-maul");
  const battle = put(g, "dark", "youhavebeenwelltrained");
  const a = put(g, "dark", "darthmaulsithapprentice");
  const b = put(g, "dark", "darthmaulsithlord");
  const foe = put(g, "light", "royalguardleader");
  const steps = fight(g, [foe], [battle, a, b]);
  check(
    "You Have Been Well Trained pairs two Darth Mauls",
    steps.length === 1 && steps[0]?.darkCardId2 === b.cardId && steps[0].darkPower === 9,
    powerLine(steps[0]) + ` steps ${steps.length} (expected 6 + 3)`
  );
});

run("You Have Been Well Trained does not pair Maul with Sidious", () => {
  const g = game("trained-maul-no");
  const battle = put(g, "dark", "youhavebeenwelltrained");
  const a = put(g, "dark", "darthmaulsithapprentice");
  const b = put(g, "dark", "darthsidioussithmaster");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [battle, a, b]);
  check(
    "You Have Been Well Trained does not pair Maul with Sidious",
    steps.length === 2 && steps[0]?.darkCardId2 == null,
    `steps ${steps.length} (expected two fights)`
  );
});

// --- Weapons: primary user, backup user, and someone who cannot use it ---

run("Sith Lightsaber adds 1 for Darth Maul and nothing for a Battle Droid", () => {
  const g = game("saber");
  const maulSaber = put(g, "dark", "sithlightsaber");
  const maul = put(g, "dark", "darthmaulsithapprentice");
  const droidSaber = put(g, "dark", "sithlightsaber");
  const droid = put(g, "dark", "battledroidinfantrymttdivision");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [maulSaber, maul, droidSaber, droid]);
  check(
    "Sith Lightsaber adds 1 for Darth Maul and nothing for a Battle Droid",
    steps[0]?.darkPower === 7 && steps[0].darkWeaponBonus === 1 && steps[1]?.darkPower === 2 && (steps[1].darkWeaponBonus ?? 0) === 0,
    `maul ${powerLine(steps[0])} weapon ${steps[0]?.darkWeaponBonus} | droid ${powerLine(steps[1])} weapon ${steps[1]?.darkWeaponBonus ?? 0}`
  );
});

run("Aurra Sing's Blaster Rifle adds 2 for Aurra and only a destiny draw for anyone else", () => {
  const g = game("aurra");
  top(g, "dark", "blaster_dark");
  top(g, "dark", "tatooinethunderrifle");
  const aurraRifle = put(g, "dark", "aurrasingsblasterrifle");
  const aurra = put(g, "dark", "aurrasingbountyhunter");
  const droidRifle = put(g, "dark", "aurrasingsblasterrifle");
  const droid = put(g, "dark", "battledroidinfantrymttdivision");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [aurraRifle, aurra, droidRifle, droid]);
  check(
    "Aurra Sing's Blaster Rifle adds 2 for Aurra and only a destiny draw for anyone else",
    steps[0]?.darkPower === 12 &&
      steps[0].darkWeaponBonus === 7 &&
      steps[1]?.darkPower === 5 &&
      steps[1].darkWeaponBonus === 3 &&
      steps[1].darkDestinyDraws?.[0]?.destiny === 3,
    `aurra ${steps[0]?.darkPower} bonus ${steps[0]?.darkWeaponBonus} | droid ${steps[1]?.darkPower} bonus ${steps[1]?.darkWeaponBonus ?? 0} draw ${steps[1]?.darkDestinyDraws?.[0]?.destiny} (Aurra 5+2+5, droid 2+0+3)`
  );
});

run("Sebulba's Podracer adds 3 for Sebulba and only a destiny draw for another podracer", () => {
  const g = game("pod");
  top(g, "dark", "blaster_dark");
  top(g, "dark", "tatooinethunderrifle");
  const sebulbaPod = put(g, "dark", "sebulbaspodracer");
  const sebulba = put(g, "dark", "sebulbabadtempereddug");
  const benPod = put(g, "dark", "sebulbaspodracer");
  const ben = put(g, "dark", "benquadinarospodracerpilot");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [sebulbaPod, sebulba, benPod, ben]);
  check(
    "Sebulba's Podracer adds 3 for Sebulba and only a destiny draw for another podracer",
    steps[0]?.darkPower === 12 && steps[0].darkWeaponBonus === 8 && steps[1]?.darkPower === 5 && steps[1].darkWeaponBonus === 3,
    `sebulba ${steps[0]?.darkPower} bonus ${steps[0]?.darkWeaponBonus} | ben ${steps[1]?.darkPower} bonus ${steps[1]?.darkWeaponBonus ?? 0} draw ${steps[1]?.darkDestinyDraws?.[0]?.destiny}`
  );
});

run("Trade Federation Tank Laser Cannon adds 2 only for the tank", () => {
  const g = game("tank");
  const cannon = put(g, "dark", "tradefederationtanklasercannon");
  const tank = put(g, "dark", "tradefederationtankarmoreddivision");
  const otherCannon = put(g, "dark", "tradefederationtanklasercannon");
  const droid = put(g, "dark", "battledroidinfantrymttdivision");
  const foe = put(g, "light", "royalguardleader");
  const foe2 = put(g, "light", "royalguardveteran");
  const steps = fight(g, [foe, foe2], [cannon, tank, otherCannon, droid]);
  check(
    "Trade Federation Tank Laser Cannon adds 2 only for the tank",
    steps[0]?.darkPower === 7 && steps[0].darkWeaponBonus === 2 && steps[1]?.darkPower === 2 && (steps[1].darkWeaponBonus ?? 0) === 0,
    `tank ${steps[0]?.darkPower} | droid ${steps[1]?.darkPower}`
  );
});

run("Obi-Wan's lightsaber adds 2 for Obi-Wan and only a destiny draw for another Jedi", () => {
  const g = game("obisaber");
  top(g, "light", "blaster_light");
  top(g, "light", "sithlightsaber");
  const obiSaber = put(g, "light", "obiwankenobislightsaber");
  const obi = put(g, "light", "obiwankenobiyoungjedi");
  const quiSaber = put(g, "light", "obiwankenobislightsaber");
  const qui = put(g, "light", "quigonjinnjedimaster");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const foe2 = put(g, "dark", "battledroidpilotaatdivision");
  const steps = fight(g, [obiSaber, obi, quiSaber, qui], [foe, foe2]);
  check(
    "Obi-Wan's lightsaber adds 2 for Obi-Wan and only a destiny draw for another Jedi",
    steps[0]?.lightPower === 9 && steps[0].lightWeaponBonus === 4 && steps[1]?.lightPower === 9 && steps[1].lightWeaponBonus === 3,
    `obi ${steps[0]?.lightPower} bonus ${steps[0]?.lightWeaponBonus} | qui ${steps[1]?.lightPower} bonus ${steps[1]?.lightWeaponBonus ?? 0} draw ${steps[1]?.lightDestinyDraws?.[0]?.destiny}`
  );
});

run("Ki-Adi-Mundi's lightsaber adds 1, not 2, for another Jedi", () => {
  const g = game("kiadi");
  const saber = put(g, "light", "jedilightsaberconstructedbykiadimundi");
  const qui = put(g, "light", "quigonjinnjedimaster");
  const foe = put(g, "dark", "battledroidinfantrymttdivision");
  const [step] = fight(g, [saber, qui], [foe]);
  check(
    "Ki-Adi-Mundi's lightsaber adds 1, not 2, for another Jedi",
    step?.lightPower === 7 && step.lightWeaponBonus === 1,
    powerLine(step) + ` weapon ${step?.lightWeaponBonus} (expected Qui-Gon 6 + backup 1)`
  );
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "ok" : "FAIL"}  ${r.name}${r.ok ? "" : "\n      " + r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
