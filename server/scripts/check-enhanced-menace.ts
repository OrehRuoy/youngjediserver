/**
 * Enhanced Menace of Darth Maul: six characters, each with one ability.
 * Run from server/: npx ts-node scripts/check-enhanced-menace.ts
 */
import { initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import { createGameState, resolveBattlePlan, type GameStateData } from "../src/game/state";

initCards();

const SET = "enhancedmenaceofdarthmaul";
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

/** Capital City is a zero bonus for everyone here except Mace Windu Jedi Warrior. */
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

function run(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    check(name, false, err instanceof Error ? err.message : String(err));
  }
}

function powerLine(step: Step | undefined): string {
  if (!step) return "no fight";
  return `light ${step.lightPower} (card ${step.lightBattleCardBonus ?? 0}, weapon ${step.lightWeaponBonus ?? 0}, mill ${step.lightMill ?? 0}) dark ${step.darkPower} (card ${step.darkBattleCardBonus ?? 0}, weapon ${step.darkWeaponBonus ?? 0}, mill ${step.darkMill ?? 0})`;
}

const DROID = "battledroidinfantrypatroldivision";
const THEED = "nabootheedpalace";

run("Qui-Gon Jedi Protector adds 1 when using Qui-Gon Jinn's Lightsaber", () => {
  const g = game("qui");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const qui = put(g, "light", "quigonjinnjediprotectorenhanced");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, qui], [foe]);
  check(
    "Qui-Gon Jedi Protector adds 1 when using Qui-Gon Jinn's Lightsaber",
    step?.lightPower === 9 && step.lightWeaponBonus === 2,
    powerLine(step) + " (expected 6 + saber 2 + text 1)"
  );
});

run("Qui-Gon Jedi Protector gets no extra power from another Jedi's lightsaber", () => {
  const g = game("qui-other");
  const saber = put(g, "light", "macewinduslightsaber");
  const qui = put(g, "light", "quigonjinnjediprotectorenhanced");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [saber, qui], [foe]);
  check(
    "Qui-Gon Jedi Protector gets no extra power from another Jedi's lightsaber",
    step?.lightPower === 6 && (step.lightWeaponBonus ?? 0) === 0,
    powerLine(step)
  );
});

run("Qui-Gon Jedi Protector has no extra power without a lightsaber", () => {
  const g = game("qui-none");
  const qui = put(g, "light", "quigonjinnjediprotectorenhanced");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [qui], [foe]);
  check("Qui-Gon Jedi Protector has no extra power without a lightsaber", step?.lightPower === 6, powerLine(step));
});

run("Mace Windu Jedi Warrior adds 2 when using Wisdom of the Council", () => {
  const g = game("mace", THEED);
  const battle = put(g, "light", "wisdomofthecouncil");
  const mace = put(g, "light", "macewindujediwarrior");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, mace], [foe]);
  check(
    "Mace Windu Jedi Warrior adds 2 when using Wisdom of the Council",
    step?.lightPower === 8 && (step.lightBattleCardBonus ?? 0) === 0,
    powerLine(step) + " (expected 6 + text 2, the battle card itself adds 0)"
  );
});

run("Mace Windu Jedi Warrior does not add that 2 for a different battle card", () => {
  const g = game("mace-other", THEED);
  const battle = put(g, "light", "balancetotheforce");
  const mace = put(g, "light", "macewindujediwarrior");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [battle, mace], [foe]);
  check(
    "Mace Windu Jedi Warrior does not add that 2 for a different battle card",
    step?.lightPower === 9 && step.lightBattleCardBonus === 3,
    powerLine(step) + " (expected 6 + Balance of the Force 3)"
  );
});

run("Mace Windu Jedi Warrior has no extra power without a battle card", () => {
  const g = game("mace-none", THEED);
  const mace = put(g, "light", "macewindujediwarrior");
  const foe = put(g, "dark", DROID);
  const [step] = fight(g, [mace], [foe]);
  check("Mace Windu Jedi Warrior has no extra power without a battle card", step?.lightPower === 6, powerLine(step));
});

run("Queen Amidala Cunning Warrior loses 2 damage when using Amidala's Blaster", () => {
  const g = game("queen");
  const blaster = put(g, "light", "amidalasblaster");
  const queen = put(g, "light", "queenamidalacunningwarrior");
  const saber = put(g, "dark", "darthmaulslightsaber");
  const maul = put(g, "dark", "darthmaulsithassassin");
  const [step] = fight(g, [blaster, queen], [saber, maul]);
  check(
    "Queen Amidala Cunning Warrior loses 2 damage when using Amidala's Blaster",
    step?.lightPower === 6 && step.lightWeaponBonus === 3 && step.winner === "dark" && (step.lightMill ?? 0) === 1,
    powerLine(step) + " (expected 3 + blaster 3, damage 3 - 2)"
  );
});

run("Queen Amidala Cunning Warrior takes full damage without her blaster", () => {
  const g = game("queen-none");
  const queen = put(g, "light", "queenamidalacunningwarrior");
  const maul = put(g, "dark", "darthmaulsithassassin");
  const [step] = fight(g, [queen], [maul]);
  check(
    "Queen Amidala Cunning Warrior takes full damage without her blaster",
    step?.lightPower === 3 && step.winner === "dark" && (step.lightMill ?? 0) === 3,
    powerLine(step)
  );
});

run("Darth Maul Sith Assassin loses 2 damage when using Darth Maul's Lightsaber", () => {
  const g = game("maul");
  top(g, "light", "heavyblaster");
  const saber = put(g, "light", "quigonjinnslightsaber");
  const qui = put(g, "light", "quigonjinnjediprotectorenhanced");
  const maulSaber = put(g, "dark", "darthmaulslightsaber");
  const maul = put(g, "dark", "darthmaulsithassassin");
  const [step] = fight(g, [saber, qui], [maulSaber, maul]);
  check(
    "Darth Maul Sith Assassin loses 2 damage when using Darth Maul's Lightsaber",
    step?.darkPower === 8 && step.darkWeaponBonus === 2 && step.winner === "light" && (step.darkMill ?? 0) === 3,
    powerLine(step) + " (expected Maul 6 + saber 2, damage 5 - 2)"
  );
});

run("Darth Maul Sith Assassin takes full damage without his lightsaber", () => {
  const g = game("maul-none");
  const mace = put(g, "light", "macewindujediwarrior");
  const maul = put(g, "dark", "darthmaulsithassassin");
  const [step] = fight(g, [mace], [maul]);
  check(
    "Darth Maul Sith Assassin takes full damage without his lightsaber",
    step?.lightPower === 7 && step.darkPower === 6 && step.winner === "light" && (step.darkMill ?? 0) === 5,
    powerLine(step) + " (Mace has +1 at the Capital)"
  );
});

run("Sebulba Champion adds 2 from Yoka to Bantha Poodoo on top of the battle card", () => {
  const g = game("seb");
  const battle = put(g, "dark", "yokatobanthapoodoo");
  const seb = put(g, "dark", "sebulbachampionpodracerpilot");
  const foe = put(g, "light", "quigonjinnjediprotectorenhanced");
  const [step] = fight(g, [foe], [battle, seb]);
  check(
    "Sebulba Champion adds 2 from Yoka to Bantha Poodoo on top of the battle card",
    step?.darkPower === 8 && step.darkBattleCardBonus === 2,
    powerLine(step) + " (expected 4 + card 2 + text 2)"
  );
});

run("Sebulba Champion has no extra power without Yoka to Bantha Poodoo", () => {
  const g = game("seb-none");
  const seb = put(g, "dark", "sebulbachampionpodracerpilot");
  const foe = put(g, "light", "quigonjinnjediprotectorenhanced");
  const [step] = fight(g, [foe], [seb]);
  check("Sebulba Champion has no extra power without Yoka to Bantha Poodoo", step?.darkPower === 4, powerLine(step));
});

run("Yoka to Bantha Poodoo still does nothing for Clegg", () => {
  const g = game("seb-clegg");
  const battle = put(g, "dark", "yokatobanthapoodoo");
  const clegg = put(g, "dark", "cleggholdfastpodracerpilot");
  const foe = put(g, "light", "quigonjinnjediprotectorenhanced");
  const [step] = fight(g, [foe], [battle, clegg]);
  check("Yoka to Bantha Poodoo still does nothing for Clegg", step?.darkPower === 2 && (step.darkBattleCardBonus ?? 0) === 0, powerLine(step));
});

run("Trade Federation Tank Assault Leader loses 2 damage when using its laser cannon", () => {
  const g = game("tank");
  const mace = put(g, "light", "macewindujediwarrior");
  const cannon = put(g, "dark", "tradefederationtanklasercannon");
  const tank = put(g, "dark", "tradefederationtankassaultleader");
  const [step] = fight(g, [mace], [cannon, tank]);
  check(
    "Trade Federation Tank Assault Leader loses 2 damage when using its laser cannon",
    step?.darkPower === 6 && step.darkWeaponBonus === 2 && step.lightPower === 7 && step.winner === "light" && (step.darkMill ?? 0) === 1,
    powerLine(step) + " (expected 4 + cannon 2, damage 3 - 2)"
  );
});

run("Trade Federation Tank Assault Leader takes full damage without its cannon", () => {
  const g = game("tank-none");
  const mace = put(g, "light", "macewindujediwarrior");
  const tank = put(g, "dark", "tradefederationtankassaultleader");
  const [step] = fight(g, [mace], [tank]);
  check(
    "Trade Federation Tank Assault Leader takes full damage without its cannon",
    step?.darkPower === 4 && step.winner === "light" && (step.darkMill ?? 0) === 3,
    powerLine(step)
  );
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "ok" : "FAIL"}  ${r.name}${r.ok ? "" : "\n      " + r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
