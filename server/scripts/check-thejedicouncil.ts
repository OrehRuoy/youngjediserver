/**
 * The Jedi Council: battle cards on both sides, plus weapons whose backup user is not the same as the owner.
 * Characters have no abilities in this set, so they are only here as the people a battle card or weapon names.
 * Run from server/: npx ts-node scripts/check-thejedicouncil.ts
 */
import { initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import { createGameState, resolveBattlePlan, type GameStateData } from "../src/game/state";

initCards();

const SET = "thejedicouncil";
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

/** Tatooine Podrace Arena gives this set's Coruscant and Naboo people no location bonus. */
function game(label: string, loc = "tatooinepodracearena"): GameStateData {
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

function run(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    check(name, false, err instanceof Error ? err.message : String(err));
  }
}

function powerLine(step: Step | undefined): string {
  if (!step) return "no fight";
  return `light ${step.lightPower} (card ${step.lightBattleCardBonus ?? 0}, weapon ${step.lightWeaponBonus ?? 0}) dark ${step.darkPower} (card ${step.darkBattleCardBonus ?? 0}, weapon ${step.darkWeaponBonus ?? 0}) second ${step.lightCardId2 ?? "-"}/${step.darkCardId2 ?? "-"} third ${step.lightCardId3 ?? "-"}/${step.darkCardId3 ?? "-"} steps-type ${step.type}`;
}

const DROID = "battledroidinfantryassaultdivision";
const DROID2 = "battledroidinfantryguarddivision";
const DROID3 = "battledroidofficerguarddivision";
const PROBE = "sithprobedroidhunterdroid";
const CHAMBER = "coruscantjedicouncilchamber";
const SENATE = "coruscantgalacticsenate";
const CAPITAL = "coruscantcapitalcity";

// --- Light battle cards ---

run("Balance of the Force adds 3 for Mace Windu", () => {
  const g = game("balance");
  const battle = put(g, "light", "balancetotheforce");
  const mace = put(g, "light", "macewinduseniorjedicouncilmember");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, mace], [foe]);
  check("Balance of the Force adds 3 for Mace Windu", step?.lightPower === 9 && step.lightBattleCardBonus === 3, powerLine(step) + " (expected 6 + 3)");
});

run("Balance of the Force does nothing for Yoda", () => {
  const g = game("balance-no");
  const battle = put(g, "light", "balancetotheforce");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, yoda], [foe]);
  check("Balance of the Force does nothing for Yoda", step?.lightPower === 4 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Brave Little Droid adds 3 for R2-D2", () => {
  const g = game("r2");
  const battle = put(g, "light", "bravelittledroid");
  const r2 = put(g, "light", "r2d2loyaldroid");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, r2], [foe]);
  check("Brave Little Droid adds 3 for R2-D2", step?.lightPower === 4 && step.lightBattleCardBonus === 3, powerLine(step) + " (expected 1 + 3)");
});

run("Brave Little Droid does nothing for Jar Jar", () => {
  const g = game("r2-no");
  const battle = put(g, "light", "bravelittledroid");
  const jar = put(g, "light", "jarjarbinksgunganoutcast");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, jar], [foe]);
  check("Brave Little Droid does nothing for Jar Jar", step?.lightPower === 4 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Dos Mackineeks No Comen Here joins three non-unique Gungans", () => {
  const g = game("dos");
  const battle = put(g, "light", "dosmackineeksnocomenhere");
  const a = put(g, "light", "gunganwarriorinfantry");
  const b = put(g, "light", "gunganwarriorinfantry");
  const c = put(g, "light", "gunganwarriorinfantry");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b, c], [foe]);
  const step = steps[0];
  check(
    "Dos Mackineeks No Comen Here joins three non-unique Gungans",
    steps.length === 1 && step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0 && step.lightCardId2 === "gunganwarriorinfantry" && step.lightCardId3 === "gunganwarriorinfantry",
    powerLine(step) + ` fights ${steps.length}`
  );
});

run("Dos Mackineeks No Comen Here joins three non-unique Gungans from Battle of Naboo", () => {
  const g = game("dos-naboo");
  const battle = put(g, "light", "dosmackineeksnocomenhere");
  const a = put(g, "light", "gunganwarriorveteran");
  const b = put(g, "light", "gungansoldierinfantry");
  const c = put(g, "light", "gunganguardlookout");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b, c], [foe]);
  const step = steps[0];
  check(
    "Dos Mackineeks No Comen Here joins three non-unique Gungans from Battle of Naboo",
    steps.length === 1 && step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0 && step.lightCardId2 === "gungansoldierinfantry" && step.lightCardId3 === "gunganguardlookout",
    powerLine(step) + ` fights ${steps.length} (expected 2 + 2 + 2)`
  );
});

run("Dos Mackineeks No Comen Here does not join a unique Gungan", () => {
  const g = game("dos-no");
  const battle = put(g, "light", "dosmackineeksnocomenhere");
  const jar = put(g, "light", "jarjarbinksgunganoutcast");
  const a = put(g, "light", "gunganwarriorinfantry");
  const b = put(g, "light", "gunganwarriorinfantry");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, jar, a, b], [foe]);
  check(
    "Dos Mackineeks No Comen Here does not join a unique Gungan",
    steps[0]?.lightCardId2 == null && (steps[0]?.lightBattleCardBonus ?? 0) === 0 && steps[0]?.lightPower === 4,
    powerLine(steps[0]) + ` fights ${steps.length}`
  );
});

run("Galactic Chancellor adds 4 for Valorum at the Senate", () => {
  const g = game("valor", SENATE);
  const battle = put(g, "light", "galacticchancellor");
  const valorum = put(g, "light", "valorumsupremechancellor");
  const foe = put(g, "dark", DROID3);
  const [step] = fight(g, [battle, valorum], [foe]);
  check(
    "Galactic Chancellor adds 4 for Valorum at the Senate",
    step?.lightPower === 9 && step.lightBattleCardBonus === 4,
    powerLine(step) + " (expected 3 + senate 2 + card 4)"
  );
});

run("Galactic Chancellor does nothing for Valorum away from the Senate", () => {
  const g = game("valor-off");
  const battle = put(g, "light", "galacticchancellor");
  const valorum = put(g, "light", "valorumsupremechancellor");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, valorum], [foe]);
  check("Galactic Chancellor does nothing for Valorum away from the Senate", step?.lightPower === 3 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Galactic Chancellor does nothing for Mace even at the Senate", () => {
  const g = game("valor-mace", SENATE);
  const battle = put(g, "light", "galacticchancellor");
  const mace = put(g, "light", "macewinduseniorjedicouncilmember");
  const foe = put(g, "dark", DROID3);
  const [step] = fight(g, [battle, mace], [foe]);
  check("Galactic Chancellor does nothing for Mace even at the Senate", (step?.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Hate Leads to Suffering adds 3 for Yoda", () => {
  const g = game("hate");
  const battle = put(g, "light", "hateleadstosuffering");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, yoda], [foe]);
  check("Hate Leads to Suffering adds 3 for Yoda", step?.lightPower === 7 && step.lightBattleCardBonus === 3, powerLine(step));
});

run("Hate Leads to Suffering adds 3 for Yaddle", () => {
  const g = game("hate-yaddle");
  const battle = put(g, "light", "hateleadstosuffering");
  const yaddle = put(g, "light", "yaddlejedimaster");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, yaddle], [foe]);
  check("Hate Leads to Suffering adds 3 for Yaddle", step?.lightPower === 7 && step.lightBattleCardBonus === 3, powerLine(step));
});

run("Hate Leads to Suffering does nothing for Qui-Gon", () => {
  const g = game("hate-no");
  const battle = put(g, "light", "hateleadstosuffering");
  const qui = put(g, "light", "quigonjinnjediprotector");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, qui], [foe]);
  check("Hate Leads to Suffering does nothing for Qui-Gon", step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("I Will Not Cooperate sends a losing Queen back to hand with no damage", () => {
  const g = game("coop");
  for (let i = 0; i < 6; i++) top(g, "light", "blasterrifle_light");
  const battle = put(g, "light", "iwillnotcooperate");
  const queen = put(g, "light", "queenamidalarepresentativeofnaboo");
  const maul = put(g, "dark", "darthmaulmasterofevil");
  const [step] = fight(g, [battle, queen], [maul]);
  const back = g.light.hand.some((c) => c.instanceId === queen.instanceId);
  check(
    "I Will Not Cooperate sends a losing Queen back to hand with no damage",
    step?.winner === "dark" && back && g.light.deck.length === 6 && (step.lightMill ?? 0) === 0,
    `winner ${step?.winner} hand ${back} deck ${g.light.deck.length} mill ${step?.lightMill ?? 0}`
  );
});

run("I Will Not Cooperate still damages the loser when the Queen wins", () => {
  const g = game("coop-win");
  const battle = put(g, "light", "iwillnotcooperate");
  const queen = put(g, "light", "queenamidalarepresentativeofnaboo");
  const probe = put(g, "dark", PROBE);
  const [step] = fight(g, [battle, queen], [probe]);
  const discarded = g.dark.discard.some((c) => c.instanceId === probe.instanceId);
  check(
    "I Will Not Cooperate still damages the loser when the Queen wins",
    step?.winner === "light" && discarded && (step.darkMill ?? 0) === 1 && g.light.hand.length === 0,
    `winner ${step?.winner} discarded ${discarded} mill ${step?.darkMill ?? 0} hand ${g.light.hand.length}`
  );
});

run("Invasion joins three non-unique Bravo Pilots", () => {
  const g = game("inv");
  const battle = put(g, "light", "invasion");
  const a = put(g, "light", "bravopilotnaboovolunteer");
  const b = put(g, "light", "bravopilotnaboovolunteer");
  const c = put(g, "light", "naboosecurityamidalasguard");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b, c], [foe]);
  const step = steps[0];
  check(
    "Invasion joins three non-unique Bravo Pilots",
    steps.length === 1 && step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0 && step.lightCardId3 === "naboosecurityamidalasguard",
    powerLine(step) + ` fights ${steps.length}`
  );
});

run("Invasion does not join a Gungan with the pilots", () => {
  const g = game("inv-no");
  const battle = put(g, "light", "invasion");
  const a = put(g, "light", "bravopilotnaboovolunteer");
  const b = put(g, "light", "naboosecurityamidalasguard");
  const jar = put(g, "light", "jarjarbinksgunganoutcast");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b, jar], [foe]);
  check(
    "Invasion does not join a Gungan with the pilots",
    steps[0]?.lightCardId2 == null && (steps[0]?.lightBattleCardBonus ?? 0) === 0,
    powerLine(steps[0]) + ` fights ${steps.length}`
  );
});

run("May the Force Be With You joins Mace and Yoda", () => {
  const g = game("force");
  const battle = put(g, "light", "maytheforcebewithyou");
  const mace = put(g, "light", "macewinduseniorjedicouncilmember");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, mace, yoda], [foe]);
  const step = steps[0];
  check(
    "May the Force Be With You joins Mace and Yoda",
    steps.length === 1 && step?.lightPower === 10 && (step.lightBattleCardBonus ?? 0) === 0 && step.lightCardId2 === "yodajedicouncilmember",
    powerLine(step)
  );
});

run("May the Force Be With You does not join Mace and Qui-Gon", () => {
  const g = game("force-no");
  const battle = put(g, "light", "maytheforcebewithyou");
  const mace = put(g, "light", "macewinduseniorjedicouncilmember");
  const qui = put(g, "light", "quigonjinnjediprotector");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, mace, qui], [foe]);
  check(
    "May the Force Be With You does not join Mace and Qui-Gon",
    steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 6,
    powerLine(steps[0]) + ` fights ${steps.length}`
  );
});

run("Senator Palpatine adds 3 for anyone on Coruscant", () => {
  const g = game("palp", CHAMBER);
  const battle = put(g, "light", "senatorpalpatine");
  const cap = put(g, "light", "republiccaptainofficer");
  const foe = put(g, "dark", DROID3);
  const [step] = fight(g, [battle, cap], [foe]);
  check("Senator Palpatine adds 3 for anyone on Coruscant", step?.lightPower === 5 && step.lightBattleCardBonus === 3, powerLine(step) + " (expected 2 + 3)");
});

run("Senator Palpatine does nothing off Coruscant", () => {
  const g = game("palp-off");
  const battle = put(g, "light", "senatorpalpatine");
  const cap = put(g, "light", "republiccaptainofficer");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, cap], [foe]);
  check("Senator Palpatine does nothing off Coruscant", step?.lightPower === 2 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Might of the Republic joins two Coruscant Guards and adds 1", () => {
  const g = game("might");
  const battle = put(g, "light", "mightoftherepublic");
  const a = put(g, "light", "coruscantguardpeacekeeper");
  const b = put(g, "light", "coruscantguardofficer");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, a, b], [foe]);
  const step = steps[0];
  check(
    "Might of the Republic joins two Coruscant Guards and adds 1",
    steps.length === 1 && step?.lightPower === 6 && step.lightBattleCardBonus === 1 && step.lightCardId2 === "coruscantguardofficer",
    powerLine(step) + " (expected 3 + 2 + 1)"
  );
});

run("Might of the Republic does nothing for one Coruscant Guard", () => {
  const g = game("might-one");
  const battle = put(g, "light", "mightoftherepublic");
  const guard = put(g, "light", "coruscantguardpeacekeeper");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, guard], [foe]);
  check(
    "Might of the Republic does nothing for one Coruscant Guard",
    step?.lightPower === 3 && (step.lightBattleCardBonus ?? 0) === 0 && step.lightCardId2 == null,
    powerLine(step)
  );
});

run("Might of the Republic does not join a Coruscant Guard with a Republic Captain", () => {
  const g = game("might-no");
  const battle = put(g, "light", "mightoftherepublic");
  const guard = put(g, "light", "coruscantguardpeacekeeper");
  const cap = put(g, "light", "republiccaptainofficer");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, guard, cap], [foe]);
  check(
    "Might of the Republic does not join a Coruscant Guard with a Republic Captain",
    steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 3 && (steps[0]?.lightBattleCardBonus ?? 0) === 0,
    powerLine(steps[0])
  );
});

run("We Don't Have Time for This joins the Queen and Panaka and adds 1", () => {
  const g = game("time");
  const battle = put(g, "light", "wedonthavetimeforthis");
  const queen = put(g, "light", "queenamidalarepresentativeofnaboo");
  const panaka = put(g, "light", "captainpanakaamidalasbodyguard");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, queen, panaka], [foe]);
  const step = steps[0];
  check(
    "We Don't Have Time for This joins the Queen and Panaka and adds 1",
    steps.length === 1 && step?.lightPower === 7 && step.lightBattleCardBonus === 1 && step.lightCardId2 === "captainpanakaamidalasbodyguard",
    powerLine(step) + " (expected 2 + 4 + 1)"
  );
});

run("We Don't Have Time for This does not join the Queen and Padme", () => {
  const g = game("time-no");
  const battle = put(g, "light", "wedonthavetimeforthis");
  const queen = put(g, "light", "queenamidalarepresentativeofnaboo");
  const padme = put(g, "light", "padmenaberriequeenshandmaiden");
  const foe = put(g, "dark", DROID);
  const steps = fight(g, [battle, queen, padme], [foe]);
  check(
    "We Don't Have Time for This does not join the Queen and Padme",
    steps[0]?.lightCardId2 == null && steps[0]?.lightPower === 2,
    powerLine(steps[0])
  );
});

run("We Wish to Board at Once adds 2 for a Republic Pilot", () => {
  const g = game("board");
  const battle = put(g, "light", "wewishtoboardatonce");
  const pilot = put(g, "light", "republicpilotveteran");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, pilot], [foe]);
  check("We Wish to Board at Once adds 2 for a Republic Pilot", step?.lightPower === 4 && step.lightBattleCardBonus === 2, powerLine(step));
});

run("We Wish to Board at Once adds 2 for a Republic Captain", () => {
  const g = game("board-cap");
  const battle = put(g, "light", "wewishtoboardatonce");
  const cap = put(g, "light", "republiccaptainofficer");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, cap], [foe]);
  check("We Wish to Board at Once adds 2 for a Republic Captain", step?.lightPower === 4 && step.lightBattleCardBonus === 2, powerLine(step));
});

run("We Wish to Board at Once does nothing for Qui-Gon", () => {
  const g = game("board-no");
  const battle = put(g, "light", "wewishtoboardatonce");
  const qui = put(g, "light", "quigonjinnjediprotector");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, qui], [foe]);
  check("We Wish to Board at Once does nothing for Qui-Gon", step?.lightPower === 6 && (step.lightBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Wisdom of the Council lets a Jedi fight the next non-unique after a win", () => {
  const g = game("wisdom");
  const battle = put(g, "light", "wisdomofthecouncil");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const a = put(g, "dark", DROID);
  const b = put(g, "dark", DROID2);
  const steps = fight(g, [battle, yoda], [a, b]);
  const second = steps[1];
  check(
    "Wisdom of the Council lets a Jedi fight the next non-unique after a win",
    steps.length === 2 &&
      steps[0]?.lightPower === 4 &&
      steps[0]?.winner === "light" &&
      (steps[0]?.lightBattleCardBonus ?? 0) === 0 &&
      second?.lightCardId === "yodajedicouncilmember" &&
      second.darkCardId === DROID2 &&
      second.lightPower === 4 &&
      (second.lightBattleCardBonus ?? 0) === 0 &&
      second.winner === "light",
    `fights ${steps.length} first ${powerLine(steps[0])} second ${powerLine(second)}`
  );
});

run("Wisdom of the Council does not fight again after beating a unique character", () => {
  const g = game("wisdom-unique");
  const battle = put(g, "light", "wisdomofthecouncil");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const lott = put(g, "dark", "lottdodneimoidiansenator");
  const extra = put(g, "dark", DROID);
  const steps = fight(g, [battle, yoda], [lott, extra]);
  check(
    "Wisdom of the Council does not fight again after beating a unique character",
    steps.length === 1 && steps[0]?.winner === "light" && steps[0]?.lightPower === 4,
    `fights ${steps.length} ${powerLine(steps[0])}`
  );
});

run("Wisdom of the Council does nothing for Panaka", () => {
  const g = game("wisdom-no");
  const battle = put(g, "light", "wisdomofthecouncil");
  const panaka = put(g, "light", "captainpanakaamidalasbodyguard");
  const a = put(g, "dark", DROID);
  const b = put(g, "dark", DROID2);
  const steps = fight(g, [battle, panaka], [a, b]);
  check(
    "Wisdom of the Council does nothing for Panaka",
    steps.length === 1 && steps[0]?.lightPower === 4 && (steps[0]?.lightBattleCardBonus ?? 0) === 0,
    `fights ${steps.length} ${powerLine(steps[0])}`
  );
});

// --- Dark battle cards ---

run("I Object adds 3 for anyone on Coruscant", () => {
  const g = game("object", CHAMBER);
  const battle = put(g, "dark", "iobject");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("I Object adds 3 for anyone on Coruscant", step?.darkPower === 5 && step.darkBattleCardBonus === 3, powerLine(step));
});

run("I Object does nothing off Coruscant", () => {
  const g = game("object-off");
  const battle = put(g, "dark", "iobject");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("I Object does nothing off Coruscant", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("I Will Deal With Them Myself adds 4 at the Capital", () => {
  const g = game("deal", CAPITAL);
  const battle = put(g, "dark", "iwilldealwiththemmyself");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("I Will Deal With Them Myself adds 4 at the Capital", step?.darkPower === 6 && step.darkBattleCardBonus === 4, powerLine(step));
});

run("I Will Deal With Them Myself does nothing at the Council Chamber", () => {
  const g = game("deal-off", CHAMBER);
  const battle = put(g, "dark", "iwilldealwiththemmyself");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("I Will Deal With Them Myself does nothing at the Council Chamber", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Let Them Make the First Move lets Maul fight the next non-unique after a win", () => {
  const g = game("first");
  g.turnSide = "dark";
  const battle = put(g, "dark", "letthemmakethefirstmove");
  const maul = put(g, "dark", "darthmaulmasterofevil");
  const a = put(g, "light", "bravopilotnaboovolunteer");
  const b = put(g, "light", "naboosecurityamidalasguard");
  const steps = fight(g, [a, b], [battle, maul]);
  const second = steps[1];
  check(
    "Let Them Make the First Move lets Maul fight the next non-unique after a win",
    steps.length === 2 &&
      steps[0]?.darkPower === 6 &&
      steps[0]?.winner === "dark" &&
      second?.darkCardId === "darthmaulmasterofevil" &&
      second.lightCardId === "naboosecurityamidalasguard" &&
      second.darkPower === 6 &&
      (second.darkBattleCardBonus ?? 0) === 0 &&
      second.winner === "dark",
    `fights ${steps.length} second ${powerLine(second)}`
  );
});

run("Let Them Make the First Move also works for Darth Sidious", () => {
  const g = game("first-sid");
  g.turnSide = "dark";
  const battle = put(g, "dark", "letthemmakethefirstmove");
  const sid = put(g, "dark", "darthsidiouslordofthesith");
  const a = put(g, "light", "bravopilotnaboovolunteer");
  const b = put(g, "light", "naboosecurityamidalasguard");
  const steps = fight(g, [a, b], [battle, sid]);
  check(
    "Let Them Make the First Move also works for Darth Sidious",
    steps.length === 2 && steps[0]?.darkPower === 5 && steps[1]?.darkPower === 5 && steps[1]?.darkCardId === "darthsidiouslordofthesith",
    `fights ${steps.length} second ${powerLine(steps[1])}`
  );
});

run("Let Them Make the First Move does not fight again after beating a unique character", () => {
  const g = game("first-unique");
  g.turnSide = "dark";
  const battle = put(g, "dark", "letthemmakethefirstmove");
  const maul = put(g, "dark", "darthmaulmasterofevil");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const extra = put(g, "light", "bravopilotnaboovolunteer");
  const steps = fight(g, [yoda, extra], [battle, maul]);
  check(
    "Let Them Make the First Move does not fight again after beating a unique character",
    steps.length === 1 && steps[0]?.winner === "dark" && steps[0]?.darkPower === 6,
    `fights ${steps.length} ${powerLine(steps[0])}`
  );
});

run("Let Them Make the First Move does nothing for a battle droid", () => {
  const g = game("first-no");
  g.turnSide = "dark";
  const battle = put(g, "dark", "letthemmakethefirstmove");
  const droid = put(g, "dark", DROID);
  const a = put(g, "light", PROBE);
  const b = put(g, "light", PROBE);
  const steps = fight(g, [a, b], [battle, droid]);
  check(
    "Let Them Make the First Move does nothing for a battle droid",
    steps.length === 1 && steps[0]?.darkPower === 2 && steps[0]?.winner === "dark",
    `fights ${steps.length} ${powerLine(steps[0])}`
  );
});

run("Move Against the Jedi First adds 4 at the Council Chamber", () => {
  const g = game("move", CHAMBER);
  const battle = put(g, "dark", "moveagainstthejedifirst");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Move Against the Jedi First adds 4 at the Council Chamber", step?.darkPower === 6 && step.darkBattleCardBonus === 4, powerLine(step));
});

run("Move Against the Jedi First does nothing at the Capital", () => {
  const g = game("move-off", CAPITAL);
  const battle = put(g, "dark", "moveagainstthejedifirst");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Move Against the Jedi First does nothing at the Capital", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Open Fire adds 3 for a tank that is using its laser cannon", () => {
  const g = game("open");
  const battle = put(g, "dark", "openfire");
  const cannon = put(g, "dark", "tradefederationtanklasercannon");
  const tank = put(g, "dark", "tradefederationtankassaultdivision");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, cannon, tank]);
  check(
    "Open Fire adds 3 for a tank that is using its laser cannon",
    step?.darkPower === 9 && step.darkBattleCardBonus === 3 && step.darkWeaponBonus === 2,
    powerLine(step) + " (expected 4 + cannon 2 + card 3)"
  );
});

run("Open Fire does nothing for a tank without the cannon", () => {
  const g = game("open-no");
  const battle = put(g, "dark", "openfire");
  const tank = put(g, "dark", "tradefederationtankassaultdivision");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, tank]);
  check("Open Fire does nothing for a tank without the cannon", step?.darkPower === 4 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Open Fire does nothing for a battle droid even with the cannon", () => {
  const g = game("open-droid");
  const battle = put(g, "dark", "openfire");
  const cannon = put(g, "dark", "tradefederationtanklasercannon");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, cannon, droid]);
  check(
    "Open Fire does nothing for a battle droid even with the cannon",
    step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0 && (step.darkWeaponBonus ?? 0) === 0,
    powerLine(step)
  );
});

run("Seal Off the Bridge joins Nute and Rune and adds 4", () => {
  const g = game("seal");
  const battle = put(g, "dark", "sealoffthebridge");
  const nute = put(g, "dark", "nutegunrayneimoidianviceroy");
  const rune = put(g, "dark", "runehaakoneimoidianadvisor");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, nute, rune]);
  const step = steps[0];
  check(
    "Seal Off the Bridge joins Nute and Rune and adds 4",
    steps.length === 1 && step?.darkPower === 10 && step.darkBattleCardBonus === 4 && step.darkCardId2 === "runehaakoneimoidianadvisor",
    powerLine(step)
  );
});

run("Seal Off the Bridge does not join Nute and Lott Dod", () => {
  const g = game("seal-no");
  const battle = put(g, "dark", "sealoffthebridge");
  const nute = put(g, "dark", "nutegunrayneimoidianviceroy");
  const lott = put(g, "dark", "lottdodneimoidiansenator");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, nute, lott]);
  check(
    "Seal Off the Bridge does not join Nute and Lott Dod",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 3 && (steps[0]?.darkBattleCardBonus ?? 0) === 0,
    powerLine(steps[0])
  );
});

run("Start Your Engines joins two different podracer pilots who are not Sebulba", () => {
  const g = game("engines", CHAMBER);
  const battle = put(g, "dark", "startyourengines");
  const clegg = put(g, "dark", "cleggholdfastpodracerpilot");
  const dud = put(g, "dark", "dudboltpodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, clegg, dud]);
  const step = steps[0];
  check(
    "Start Your Engines joins two different podracer pilots who are not Sebulba",
    steps.length === 1 && step?.darkPower === 6 && step.darkBattleCardBonus === 2 && step.darkCardId2 === "dudboltpodracerpilot",
    powerLine(step) + " (expected 2 + 2 + 2)"
  );
});

run("Start Your Engines does not join Sebulba and Clegg", () => {
  const g = game("engines-seb", CHAMBER);
  const battle = put(g, "dark", "startyourengines");
  const seb = put(g, "dark", "sebulbapodracerpilot");
  const clegg = put(g, "dark", "cleggholdfastpodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, seb, clegg]);
  check(
    "Start Your Engines does not join Sebulba and Clegg",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 4 && (steps[0]?.darkBattleCardBonus ?? 0) === 0,
    powerLine(steps[0])
  );
});

run("Start Your Engines does not join two copies of Clegg", () => {
  const g = game("engines-same", CHAMBER);
  const battle = put(g, "dark", "startyourengines");
  const a = put(g, "dark", "cleggholdfastpodracerpilot");
  const b = put(g, "dark", "cleggholdfastpodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, a, b]);
  check(
    "Start Your Engines does not join two copies of Clegg",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 2,
    powerLine(steps[0])
  );
});

run("Start Your Engines does not join one podracer and a battle droid", () => {
  const g = game("engines-one", CHAMBER);
  const battle = put(g, "dark", "startyourengines");
  const clegg = put(g, "dark", "cleggholdfastpodracerpilot");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, clegg, droid]);
  check(
    "Start Your Engines does not join one podracer and a battle droid",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 2 && (steps[0]?.darkBattleCardBonus ?? 0) === 0,
    powerLine(steps[0])
  );
});

run("Switch to Bio joins two non-unique Destroyer Droids and adds 1", () => {
  const g = game("bio");
  const battle = put(g, "dark", "switchtobio");
  const a = put(g, "dark", "destroyerdroidassaultdroid");
  const b = put(g, "dark", "destroyerdroidbattleshipsecurity");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, a, b]);
  const step = steps[0];
  check(
    "Switch to Bio joins two non-unique Destroyer Droids and adds 1",
    steps.length === 1 && step?.darkPower === 7 && step.darkBattleCardBonus === 1 && step.darkCardId2 === "destroyerdroidbattleshipsecurity",
    powerLine(step)
  );
});

run("Switch to Bio does not join the unique Destroyer Droid Squad", () => {
  const g = game("bio-no");
  const battle = put(g, "dark", "switchtobio");
  const squad = put(g, "dark", "destroyerdroidsquaddefensedivision");
  const one = put(g, "dark", "destroyerdroidassaultdroid");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, squad, one]);
  check(
    "Switch to Bio does not join the unique Destroyer Droid Squad",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 5 && (steps[0]?.darkBattleCardBonus ?? 0) === 0,
    powerLine(steps[0])
  );
});

run("Take Them to Camp Four adds 2 for a non-unique battle droid", () => {
  const g = game("camp");
  const battle = put(g, "dark", "takethemtocampfour");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Take Them to Camp Four adds 2 for a non-unique battle droid", step?.darkPower === 4 && step.darkBattleCardBonus === 2, powerLine(step));
});

run("Take Them to Camp Four does nothing for the unique Battle Droid Squad", () => {
  const g = game("camp-no");
  const battle = put(g, "dark", "takethemtocampfour");
  const squad = put(g, "dark", "battledroidsquadescortunit");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, squad]);
  check("Take Them to Camp Four does nothing for the unique Battle Droid Squad", (step?.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Very Unusual adds 3 for a Sith Probe Droid", () => {
  const g = game("unusual");
  const battle = put(g, "dark", "veryunusual");
  const probe = put(g, "dark", PROBE);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, probe]);
  check("Very Unusual adds 3 for a Sith Probe Droid", step?.darkPower === 4 && step.darkBattleCardBonus === 3, powerLine(step));
});

run("Very Unusual does nothing for a battle droid", () => {
  const g = game("unusual-no");
  const battle = put(g, "dark", "veryunusual");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Very Unusual does nothing for a battle droid", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Vote of No Confidence adds 4 for a senator at the Senate", () => {
  const g = game("vote", SENATE);
  const battle = put(g, "dark", "voteofnoconfidence");
  const lott = put(g, "dark", "lottdodneimoidiansenator");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, lott]);
  check(
    "Vote of No Confidence adds 4 for a senator at the Senate",
    step?.darkPower === 8 && step.darkBattleCardBonus === 4,
    powerLine(step) + " (expected 2 + senate 2 + card 4)"
  );
});

run("Vote of No Confidence does nothing for a senator away from the Senate", () => {
  const g = game("vote-off", CHAMBER);
  const battle = put(g, "dark", "voteofnoconfidence");
  const lott = put(g, "dark", "lottdodneimoidiansenator");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, lott]);
  check("Vote of No Confidence does nothing for a senator away from the Senate", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Vote of No Confidence does nothing for a non-senator at the Senate", () => {
  const g = game("vote-no", SENATE);
  const battle = put(g, "dark", "voteofnoconfidence");
  const del = put(g, "dark", "galacticdelegaterepresentative");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, del]);
  check(
    "Vote of No Confidence does nothing for a non-senator at the Senate",
    (step?.darkBattleCardBonus ?? 0) === 0 && step?.darkPower === 4,
    powerLine(step) + " (expected senate bonus 2 and no card)"
  );
});

run("We Are Meeting No Resistance joins three non-unique battle droids", () => {
  const g = game("meet");
  const battle = put(g, "dark", "wearemeetingnoresistance");
  const a = put(g, "dark", DROID);
  const b = put(g, "dark", DROID2);
  const c = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, a, b, c]);
  const step = steps[0];
  check(
    "We Are Meeting No Resistance joins three non-unique battle droids",
    steps.length === 1 && step?.darkPower === 6 && (step.darkBattleCardBonus ?? 0) === 0 && step.darkCardId3 === DROID3,
    powerLine(step)
  );
});

run("We Are Meeting No Resistance does not join two battle droids", () => {
  const g = game("meet-no");
  const battle = put(g, "dark", "wearemeetingnoresistance");
  const a = put(g, "dark", DROID);
  const b = put(g, "dark", DROID2);
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, a, b]);
  check(
    "We Are Meeting No Resistance does not join two battle droids",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 2,
    powerLine(steps[0])
  );
});

run("We Have Them on the Run joins Rune and the Destroyer Droid Squad", () => {
  const g = game("run");
  const battle = put(g, "dark", "wehavethemontherun");
  const rune = put(g, "dark", "runehaakoneimoidianadvisor");
  const squad = put(g, "dark", "destroyerdroidsquaddefensedivision");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, rune, squad]);
  const step = steps[0];
  check(
    "We Have Them on the Run joins Rune and the Destroyer Droid Squad",
    steps.length === 1 && step?.darkPower === 8 && (step.darkBattleCardBonus ?? 0) === 0 && step.darkCardId2 === "destroyerdroidsquaddefensedivision",
    powerLine(step) + " (expected 3 + 5)"
  );
});

run("We Have Them on the Run does not join Rune and one Destroyer Droid", () => {
  const g = game("run-no");
  const battle = put(g, "dark", "wehavethemontherun");
  const rune = put(g, "dark", "runehaakoneimoidianadvisor");
  const one = put(g, "dark", "destroyerdroidassaultdroid");
  const foe = put(g, "light", "republiccaptainofficer");
  const steps = fight(g, [foe], [battle, rune, one]);
  check(
    "We Have Them on the Run does not join Rune and one Destroyer Droid",
    steps[0]?.darkCardId2 == null && steps[0]?.darkPower === 3,
    powerLine(steps[0])
  );
});

run("Yoka to Bantha Poodoo adds 2 for Sebulba", () => {
  const g = game("yoka", CHAMBER);
  const battle = put(g, "dark", "yokatobanthapoodoo");
  const seb = put(g, "dark", "sebulbapodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, seb]);
  check("Yoka to Bantha Poodoo adds 2 for Sebulba", step?.darkPower === 6 && step.darkBattleCardBonus === 2, powerLine(step));
});

run("Yoka to Bantha Poodoo does nothing for Clegg", () => {
  const g = game("yoka-no", CHAMBER);
  const battle = put(g, "dark", "yokatobanthapoodoo");
  const clegg = put(g, "dark", "cleggholdfastpodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, clegg]);
  check("Yoka to Bantha Poodoo does nothing for Clegg", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Your Little Insurrection Is at an End adds 2 for a non-unique Destroyer Droid", () => {
  const g = game("ins");
  const battle = put(g, "dark", "yourlittleinsurrectionisatanend");
  const droid = put(g, "dark", "destroyerdroidassaultdroid");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Your Little Insurrection Is at an End adds 2 for a non-unique Destroyer Droid", step?.darkPower === 5 && step.darkBattleCardBonus === 2, powerLine(step));
});

run("Your Little Insurrection Is at an End adds 2 for Daultay Dofine", () => {
  const g = game("ins-daultay");
  const battle = put(g, "dark", "yourlittleinsurrectionisatanend");
  const daultay = put(g, "dark", "daultaydofineneimoidianattendant");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, daultay]);
  check("Your Little Insurrection Is at an End adds 2 for Daultay Dofine", step?.darkPower === 5 && step.darkBattleCardBonus === 2, powerLine(step));
});

run("Your Little Insurrection Is at an End does nothing for a battle droid", () => {
  const g = game("ins-no");
  const battle = put(g, "dark", "yourlittleinsurrectionisatanend");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, droid]);
  check("Your Little Insurrection Is at an End does nothing for a battle droid", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Your Little Insurrection Is at an End does nothing for the unique Destroyer Droid Squad", () => {
  const g = game("ins-squad");
  const battle = put(g, "dark", "yourlittleinsurrectionisatanend");
  const squad = put(g, "dark", "destroyerdroidsquaddefensedivision");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [battle, squad]);
  check("Your Little Insurrection Is at an End does nothing for the unique Destroyer Droid Squad", step?.darkPower === 5 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

// --- Weapons: owner vs backup user. Empty decks so a destiny add contributes 0, unless the test stacks a known draw. ---

run("Qui-Gon Jinn's Lightsaber adds 2 for Qui-Gon", () => {
  const g = game("qsaber");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const qui = put(g, "light", "quigonjinnjediprotector");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, qui], [foe]);
  check("Qui-Gon Jinn's Lightsaber adds 2 for Qui-Gon", step?.lightPower === 8 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Qui-Gon Jinn's Lightsaber gives another Jedi only the destiny draw", () => {
  const g = game("qsaber-jedi");
  top(g, "light", "blasterrifle_light");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, yoda], [foe]);
  check(
    "Qui-Gon Jinn's Lightsaber gives another Jedi only the destiny draw",
    step?.lightPower === 10 && step.lightWeaponBonus === 6 && g.light.deck.length === 0,
    powerLine(step) + ` deck ${g.light.deck.length} (expected 4 + destiny 6, not +2)`
  );
});

run("Qui-Gon Jinn's Lightsaber does nothing for Panaka", () => {
  const g = game("qsaber-no");
  top(g, "light", "blasterrifle_light");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const panaka = put(g, "light", "captainpanakaamidalasbodyguard");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, panaka], [foe]);
  check(
    "Qui-Gon Jinn's Lightsaber does nothing for Panaka",
    step?.lightPower === 4 && (step.lightWeaponBonus ?? 0) === 0 && g.light.deck.length === 1,
    powerLine(step) + ` deck ${g.light.deck.length}`
  );
});

run("Amidala's Blaster adds 3 for the Queen", () => {
  const g = game("ablaster");
  const blaster = put(g, "light", "amidalasblaster");
  const queen = put(g, "light", "queenamidalarepresentativeofnaboo");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [blaster, queen], [foe]);
  check("Amidala's Blaster adds 3 for the Queen", step?.lightPower === 5 && step.lightWeaponBonus === 3, powerLine(step));
});

run("Amidala's Blaster adds 3 for a handmaiden", () => {
  const g = game("ablaster-hand");
  const blaster = put(g, "light", "amidalasblaster");
  const padme = put(g, "light", "padmenaberriequeenshandmaiden");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [blaster, padme], [foe]);
  check("Amidala's Blaster adds 3 for a handmaiden", step?.lightPower === 6 && step.lightWeaponBonus === 3, powerLine(step));
});

run("Amidala's Blaster gives anyone else only the destiny draw", () => {
  const g = game("ablaster-any");
  top(g, "light", "blasterrifle_light");
  const blaster = put(g, "light", "amidalasblaster");
  const mace = put(g, "light", "macewinduseniorjedicouncilmember");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [blaster, mace], [foe]);
  check(
    "Amidala's Blaster gives anyone else only the destiny draw",
    step?.lightPower === 12 && step.lightWeaponBonus === 6,
    powerLine(step) + " (expected 6 + destiny 6, not +3)"
  );
});

run("Adi Gallia's Lightsaber adds 2 for Adi", () => {
  const g = game("adisaber");
  const saber = put(g, "light", "adigalliaslightsaber");
  const adi = put(g, "light", "adigalliacorellianjedimaster");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, adi], [foe]);
  check("Adi Gallia's Lightsaber adds 2 for Adi", step?.lightPower === 7 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Adi Gallia's Lightsaber gives another Jedi only the destiny draw", () => {
  const g = game("adisaber-jedi");
  top(g, "light", "blasterrifle_light");
  const saber = put(g, "light", "adigalliaslightsaber");
  const yoda = put(g, "light", "yodajedicouncilmember");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, yoda], [foe]);
  check(
    "Adi Gallia's Lightsaber gives another Jedi only the destiny draw",
    step?.lightPower === 10 && step.lightWeaponBonus === 6,
    powerLine(step) + " (expected 4 + destiny 6, not +2)"
  );
});

run("Coruscant Guard Blaster Rifle adds 2 for a non-unique Coruscant Guard", () => {
  const g = game("cgrifle");
  const rifle = put(g, "light", "coruscantguardblasterrifle");
  const guard = put(g, "light", "coruscantguardpeacekeeper");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [rifle, guard], [foe]);
  check("Coruscant Guard Blaster Rifle adds 2 for a non-unique Coruscant Guard", step?.lightPower === 5 && step.lightWeaponBonus === 2, powerLine(step));
});

run("Coruscant Guard Blaster Rifle gives anyone else only the destiny draw", () => {
  const g = game("cgrifle-any");
  top(g, "light", "blasterrifle_light");
  const rifle = put(g, "light", "coruscantguardblasterrifle");
  const panaka = put(g, "light", "captainpanakaamidalasbodyguard");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [rifle, panaka], [foe]);
  check(
    "Coruscant Guard Blaster Rifle gives anyone else only the destiny draw",
    step?.lightPower === 10 && step.lightWeaponBonus === 6,
    powerLine(step) + " (expected 4 + destiny 6, not +2)"
  );
});

run("Ascension Gun adds 1 for Padme", () => {
  const g = game("asc");
  const gun = put(g, "light", "ascensiongun");
  const padme = put(g, "light", "padmenaberriequeenshandmaiden");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [gun, padme], [foe]);
  check("Ascension Gun adds 1 for Padme", step?.lightPower === 4 && step.lightWeaponBonus === 1, powerLine(step));
});

run("Ascension Gun adds 1 for Panaka", () => {
  const g = game("asc-panaka");
  const gun = put(g, "light", "ascensiongun");
  const panaka = put(g, "light", "captainpanakaamidalasbodyguard");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [gun, panaka], [foe]);
  check("Ascension Gun adds 1 for Panaka", step?.lightPower === 5 && step.lightWeaponBonus === 1, powerLine(step));
});

run("Ascension Gun gives anyone else only the destiny draw", () => {
  const g = game("asc-any");
  top(g, "light", "blasterrifle_light");
  const gun = put(g, "light", "ascensiongun");
  const r2 = put(g, "light", "r2d2loyaldroid");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [gun, r2], [foe]);
  check("Ascension Gun gives anyone else only the destiny draw", step?.lightPower === 7 && step.lightWeaponBonus === 6, powerLine(step));
});

run("Gian Speeder adds 1 for Panaka", () => {
  const g = game("gian");
  const speeder = put(g, "light", "gianspeeder");
  const panaka = put(g, "light", "captainpanakaamidalasbodyguard");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [speeder, panaka], [foe]);
  check("Gian Speeder adds 1 for Panaka", step?.lightPower === 5 && step.lightWeaponBonus === 1, powerLine(step));
});

run("Gian Speeder adds 1 for Ric Olie", () => {
  const g = game("gian-ric");
  const speeder = put(g, "light", "gianspeeder");
  const ric = put(g, "light", "ricoliechiefpilot");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [speeder, ric], [foe]);
  check("Gian Speeder adds 1 for Ric Olie", step?.lightPower === 5 && step.lightWeaponBonus === 1, powerLine(step));
});

run("Gian Speeder adds 1 for Sio Bibble", () => {
  const g = game("gian-sio");
  const speeder = put(g, "light", "gianspeeder");
  const sio = put(g, "light", "siobibblegovernorofnaboo");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [speeder, sio], [foe]);
  check("Gian Speeder adds 1 for Sio Bibble", step?.lightPower === 3 && step.lightWeaponBonus === 1, powerLine(step) + " (expected 2 + 1)");
});

run("Gian Speeder gives anyone else only the destiny draw", () => {
  const g = game("gian-any");
  top(g, "light", "blasterrifle_light");
  const speeder = put(g, "light", "gianspeeder");
  const jar = put(g, "light", "jarjarbinksgunganoutcast");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [speeder, jar], [foe]);
  check("Gian Speeder gives anyone else only the destiny draw", step?.lightPower === 10 && step.lightWeaponBonus === 6, powerLine(step));
});

run("Darth Maul's Lightsaber adds 2 for Maul", () => {
  const g = game("msaber");
  const saber = put(g, "dark", "darthmaulslightsaber");
  const maul = put(g, "dark", "darthmaulmasterofevil");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [saber, maul]);
  check("Darth Maul's Lightsaber adds 2 for Maul", step?.darkPower === 8 && step.darkWeaponBonus === 2, powerLine(step));
});

run("Darth Maul's Lightsaber gives Sidious only the destiny draw", () => {
  const g = game("msaber-sid");
  top(g, "dark", PROBE);
  const saber = put(g, "dark", "darthmaulslightsaber");
  const sid = put(g, "dark", "darthsidiouslordofthesith");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [saber, sid]);
  check(
    "Darth Maul's Lightsaber gives Sidious only the destiny draw",
    step?.darkPower === 11 && step.darkWeaponBonus === 6,
    powerLine(step) + " (expected 5 + destiny 6, not +2)"
  );
});

run("Darth Maul's Lightsaber does nothing for a battle droid", () => {
  const g = game("msaber-no");
  top(g, "dark", PROBE);
  const saber = put(g, "dark", "darthmaulslightsaber");
  const droid = put(g, "dark", DROID);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [saber, droid]);
  check(
    "Darth Maul's Lightsaber does nothing for a battle droid",
    step?.darkPower === 2 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1,
    powerLine(step) + ` deck ${g.dark.deck.length}`
  );
});

run("Darth Maul's Sith Speeder adds 2 for Maul", () => {
  const g = game("speeder");
  const speeder = put(g, "dark", "darthmaulssithspeeder");
  const maul = put(g, "dark", "darthmaulmasterofevil");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [speeder, maul]);
  check("Darth Maul's Sith Speeder adds 2 for Maul", step?.darkPower === 8 && step.darkWeaponBonus === 2, powerLine(step));
});

run("Darth Maul's Sith Speeder does nothing for Sidious", () => {
  const g = game("speeder-no");
  top(g, "dark", PROBE);
  const speeder = put(g, "dark", "darthmaulssithspeeder");
  const sid = put(g, "dark", "darthsidiouslordofthesith");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [speeder, sid]);
  check(
    "Darth Maul's Sith Speeder does nothing for Sidious",
    step?.darkPower === 5 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1,
    powerLine(step) + ` deck ${g.dark.deck.length}`
  );
});

run("Clegg Holdfast's Podracer adds 3 for Clegg", () => {
  const g = game("cleggpod", CHAMBER);
  const pod = put(g, "dark", "cleggholdfastspodracer");
  const clegg = put(g, "dark", "cleggholdfastpodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [pod, clegg]);
  check("Clegg Holdfast's Podracer adds 3 for Clegg", step?.darkPower === 5 && step.darkWeaponBonus === 3, powerLine(step));
});

run("Clegg Holdfast's Podracer gives another podracer only the destiny draw", () => {
  const g = game("cleggpod-dud", CHAMBER);
  top(g, "dark", PROBE);
  const pod = put(g, "dark", "cleggholdfastspodracer");
  const dud = put(g, "dark", "dudboltpodracerpilot");
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [pod, dud]);
  check(
    "Clegg Holdfast's Podracer gives another podracer only the destiny draw",
    step?.darkPower === 8 && step.darkWeaponBonus === 6,
    powerLine(step) + " (expected 2 + destiny 6, not +3)"
  );
});

run("Clegg Holdfast's Podracer does nothing for a battle droid", () => {
  const g = game("cleggpod-no", CHAMBER);
  top(g, "dark", PROBE);
  const pod = put(g, "dark", "cleggholdfastspodracer");
  const droid = put(g, "dark", DROID3);
  const foe = put(g, "light", "republiccaptainofficer");
  const [step] = fight(g, [foe], [pod, droid]);
  check(
    "Clegg Holdfast's Podracer does nothing for a battle droid",
    step?.darkPower === 2 && (step.darkWeaponBonus ?? 0) === 0 && g.dark.deck.length === 1,
    powerLine(step) + ` deck ${g.dark.deck.length}`
  );
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "ok" : "FAIL"}  ${r.name}${r.ok ? "" : "\n      " + r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
