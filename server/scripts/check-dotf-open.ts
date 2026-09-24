/**
 * Scenarios for Duel of the Fates light cards that still needed a non-duel check.
 * Run from server/: npx ts-node scripts/check-dotf-open.ts
 */
import { initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import {
  createGameState,
  resolveBattlePlan,
  declineDamageReplace,
  confirmDamageReplace,
  type GameStateData,
} from "../src/game/state";
import { resolveStarshipBattle } from "../src/game/hyperspace";
import {
  initiateDuel,
  chooseDuelTarget,
  playDuelCard,
  discardDuelCardForDraw,
  removeDuelHit,
} from "../src/game/duel";
import * as jediTraining from "../src/game/jedi-training";
import * as pounded from "../src/game/pounded";
import * as winControl from "../src/game/win-control";

initCards();

const DOTF = "duelofthefates";
const MENACE = "menaceofdarthmaul";
const NABOO = "battleofnaboo";
const COUNCIL = "thejedicouncil";

type Step = NonNullable<GameStateData["battleRevealSequence"]>[number];
const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

let seq = 0;
function card(side: Side, id: string, set: string, zone: CardInstance["zone"]): CardInstance {
  seq += 1;
  return { instanceId: "c" + seq, cardId: id, cardSet: set, ownerSide: side, zone, faceDown: false };
}

function game(label: string): GameStateData {
  const g = createGameState(label, "table", "human", "bot_1", "You", "Bot", 60000);
  g.ruleset = "dotf";
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
  g.light.hyperspace = [];
  g.dark.hyperspace = [];
  g.light.force = 6;
  g.dark.force = 6;
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
  const p = side === "light" ? g.light : g.dark;
  p.deck.push(c);
  return c;
}

function fuel(g: GameStateData, side: Side, destiny: 1 | 6, count = 4): void {
  const id = destiny === 1 ? "quigonjinnjedimentor" : "queenamidalayoungleader";
  const set = DOTF;
  for (let i = 0; i < count; i++) deckTop(g, side, id, set);
}

function location(g: GameStateData, id: string, set: string): void {
  const loc = play(g, "light", card("light", id, set, "in_play"));
  g.startingLocationInstanceId = loc.instanceId;
}

function characterFight(g: GameStateData, lightIds: string[], darkIds: string[]): Step | undefined {
  g.lightBattlePlanOrder = lightIds;
  g.darkBattlePlanOrder = darkIds;
  g.battlePlanPhase = true;
  resolveBattlePlan(g);
  return g.battleRevealSequence?.[0];
}

function shipFight(g: GameStateData, lightOrder: string[], darkOrder: string[], lightDeclared: string[] = []): Step | undefined {
  g.lightBattlePlanOrder = lightOrder;
  g.darkBattlePlanOrder = darkOrder;
  g.lightDeclaredBattleCards = lightDeclared;
  g.starshipBattleAttacker = "light";
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

run("Bravo Pilot adds 1 damage to an enemy starship", () => {
  const g = game("bravo");
  location(g, "tatooinepodracearena", MENACE);
  play(g, "light", card("light", "bravopilotflyer", DOTF, "in_play"));
  const mine = play(g, "light", card("light", "naboostarfighterduel", DOTF, "in_play"));
  mine.zone = "hyperspace";
  g.light.hyperspace = [mine];
  g.light.inPlay = g.light.inPlay.filter((c) => c.instanceId !== mine.instanceId);
  const theirs = play(g, "dark", card("dark", "droidstarfighterduel", DOTF, "in_play"));
  theirs.zone = "hyperspace";
  g.dark.hyperspace = [theirs];
  g.dark.inPlay = [];
  fuel(g, "light", 6);
  fuel(g, "dark", 1);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "Bravo Pilot adds 1 damage to an enemy starship",
    step?.winner === "light" && step.darkMill === 2 && step.lightPower === 8 && step.darkPower === 3,
    `winner ${step?.winner} light ${step?.lightPower} dark ${step?.darkPower} dark mill ${step?.darkMill} (expected light 8 vs dark 3, mill 2 = droid damage 1 + Bravo 1)`
  );
});

run("Bravo Pilot face down does not add damage", () => {
  const g = game("bravo-down");
  location(g, "tatooinepodracearena", MENACE);
  const bravo = play(g, "light", card("light", "bravopilotflyer", DOTF, "in_play"));
  bravo.faceDown = true;
  const mine = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  const theirs = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [mine];
  g.dark.hyperspace = [theirs];
  fuel(g, "light", 6);
  fuel(g, "dark", 1);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "Bravo Pilot face down does not add damage",
    step?.winner === "light" && step.darkMill === 1,
    `winner ${step?.winner} dark mill ${step?.darkMill} (expected 1, the starship's own damage)`
  );
});

run("Anakin adds 1 power to your starfighter", () => {
  const g = game("anakin");
  location(g, "tatooinepodracearena", MENACE);
  play(g, "light", card("light", "anakinskywalkerrookiepilot", DOTF, "in_play"));
  const mine = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  const theirs = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [mine];
  g.dark.hyperspace = [theirs];
  fuel(g, "light", 1);
  fuel(g, "dark", 1);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "Anakin adds 1 power to your starfighter",
    step?.lightPower === 4 && step?.darkPower === 3,
    `light ${step?.lightPower} dark ${step?.darkPower} (expected 4 vs 3: 2 printed + destiny 1 + Anakin 1)`
  );
});

run("Ric Olié adds 1 power to your transport", () => {
  const g = game("ric");
  location(g, "tatooinepodracearena", MENACE);
  play(g, "light", card("light", "ricoliestarshippilot", DOTF, "in_play"));
  const mine = card("light", "republiccruisertransport", MENACE, "hyperspace");
  const theirs = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [mine];
  g.dark.hyperspace = [theirs];
  fuel(g, "dark", 1);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "Ric Olié adds 1 power to your transport",
    step?.lightPower === 6 && step?.darkPower === 3,
    `light ${step?.lightPower} dark ${step?.darkPower} (expected 6 vs 3: transport 5 + Ric 1)`
  );
});

run("R2-D2 subtracts 1 damage from your transport", () => {
  const g = game("r2");
  location(g, "tatooinepodracearena", MENACE);
  play(g, "light", card("light", "r2d2repairdroid", DOTF, "in_play"));
  const mine = card("light", "republiccruisertransport", MENACE, "hyperspace");
  const theirs = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [mine];
  g.dark.hyperspace = [theirs];
  fuel(g, "dark", 6);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "R2-D2 subtracts 1 damage from your transport",
    step?.winner === "dark" && step.lightMill === 4,
    `winner ${step?.winner} light mill ${step?.lightMill} light ${step?.lightPower} dark ${step?.darkPower} (expected mill 4 = transport damage 5 minus 1)`
  );
});

run("Naboo Starfighter gains 2 power at Naboo", () => {
  const g = game("naboo-ship");
  location(g, "nabootheedpalace", MENACE);
  const mine = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  const theirs = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [mine];
  g.dark.hyperspace = [theirs];
  fuel(g, "light", 1);
  fuel(g, "dark", 1);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "Naboo Starfighter gains 2 power at Naboo",
    step?.lightPower === 5 && step?.darkPower === 3,
    `light ${step?.lightPower} dark ${step?.darkPower} (expected 5 vs 3: 2 printed + 2 at Naboo + destiny 1)`
  );
});

run("Naboo Starfighter does not gain that power away from Naboo", () => {
  const g = game("naboo-ship-away");
  location(g, "tatooinepodracearena", MENACE);
  const mine = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  const theirs = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [mine];
  g.dark.hyperspace = [theirs];
  fuel(g, "light", 1);
  fuel(g, "dark", 1);
  const step = shipFight(g, [mine.instanceId], [theirs.instanceId]);
  check(
    "Naboo Starfighter does not gain that power away from Naboo",
    step?.lightPower === 3,
    `light ${step?.lightPower} (expected 3: 2 printed + destiny 1)`
  );
});

run("Queen Amidala gains 2 after Naboo is controlled", () => {
  const g = game("amidala");
  location(g, "tatooinepodracearena", MENACE);
  g.controlledPlanets = [{
    locationCardId: "nabootheedpalace",
    locationInstanceId: "old-naboo",
    planet: "Naboo",
    controlledBy: "light",
    strandedLight: [],
    strandedDark: [],
  }];
  const her = play(g, "light", card("light", "queenamidalayoungleader", DOTF, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const step = characterFight(g, [her.instanceId], [foe.instanceId]);
  check(
    "Queen Amidala gains 2 after Naboo is controlled",
    step?.lightPower === 4,
    `light ${step?.lightPower} (expected 4 = printed 2 + controlled Naboo 2)`
  );
});

run("Queen Amidala has no bonus before Naboo is controlled", () => {
  const g = game("amidala-before");
  location(g, "tatooinepodracearena", MENACE);
  const her = play(g, "light", card("light", "queenamidalayoungleader", DOTF, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const step = characterFight(g, [her.instanceId], [foe.instanceId]);
  check(
    "Queen Amidala has no bonus before Naboo is controlled",
    step?.lightPower === 2,
    `light ${step?.lightPower} (expected printed 2)`
  );
});

run("Booma gives +2 against a tank and not against a battle droid", () => {
  const vsTank = game("booma-tank");
  location(vsTank, "naboogunganswamp", COUNCIL);
  const gungan = play(vsTank, "light", card("light", "gunganwarriorinfantry", MENACE, "in_play"));
  const booma = play(vsTank, "light", card("light", "booma", DOTF, "in_play"));
  const tank = play(vsTank, "dark", card("dark", "tradefederationtankarmoreddivision", MENACE, "in_play"));
  fuel(vsTank, "light", 1);
  const tankStep = characterFight(vsTank, [booma.instanceId, gungan.instanceId], [tank.instanceId]);

  const vsDroid = game("booma-droid");
  location(vsDroid, "naboogunganswamp", COUNCIL);
  const gungan2 = play(vsDroid, "light", card("light", "gunganwarriorinfantry", MENACE, "in_play"));
  const booma2 = play(vsDroid, "light", card("light", "booma", DOTF, "in_play"));
  const droid = play(vsDroid, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  fuel(vsDroid, "light", 1);
  const droidStep = characterFight(vsDroid, [booma2.instanceId, gungan2.instanceId], [droid.instanceId]);
  check(
    "Booma gives +2 against a tank and not against a battle droid",
    tankStep?.lightPower === 5 && droidStep?.lightPower === 3,
    `vs tank ${tankStep?.lightPower}, vs droid ${droidStep?.lightPower} (expected 5 and 3: Gungan 2 + destiny 1, plus 2 only against the tank)`
  );
});

run("Come On, Move lets a Naboo Officer use a speeder and a Naboo Blaster", () => {
  const g = game("come-on");
  location(g, "nabootheedpalace", MENACE);
  const battle = hand(g, "light", card("light", "comeonmove", DOTF, "hand"));
  const speeder = play(g, "light", card("light", "flashspeeder", MENACE, "in_play"));
  const blaster = play(g, "light", card("light", "nabooblaster", MENACE, "in_play"));
  const officer = play(g, "light", card("light", "nabooofficerbattleplanner", MENACE, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  fuel(g, "light", 1, 2);
  const step = characterFight(g, [battle.instanceId, speeder.instanceId, blaster.instanceId, officer.instanceId], [foe.instanceId]);
  const draws = step?.lightDestinyDraws?.length ?? 0;
  check(
    "Come On, Move lets a Naboo Officer use a speeder and a Naboo Blaster",
    draws === 2 && step?.lightPower === 7,
    `draws ${draws} power ${step?.lightPower} (expected 2 destiny draws and power 7 = officer 3 + speeder 2 + both destinies 1)`
  );
});

run("Gungan Mounted Troops uses a kaadu and an electropole", () => {
  const g = game("mounted");
  location(g, "naboogunganswamp", COUNCIL);
  const battle = hand(g, "light", card("light", "gunganmountedtroops", DOTF, "hand"));
  const kaadu = play(g, "light", card("light", "kaadu", MENACE, "in_play"));
  const pole = play(g, "light", card("light", "electropole", MENACE, "in_play"));
  const gungan = play(g, "light", card("light", "gunganwarriorinfantry", MENACE, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  fuel(g, "light", 1, 2);
  const step = characterFight(g, [battle.instanceId, kaadu.instanceId, pole.instanceId, gungan.instanceId], [foe.instanceId]);
  check(
    "Gungan Mounted Troops uses a kaadu and an electropole",
    (step?.lightDestinyDraws?.length ?? 0) === 2 && step?.lightPower === 7,
    `draws ${step?.lightDestinyDraws?.length} power ${step?.lightPower} (expected 2 draws and power 7 = Gungan 2 + kaadu 1 + electropole 2 + destinies 1+1)`
  );
});

run("Gungan Energy Shield adds 2 when a Gungan uses a fambaa", () => {
  const g = game("shield-power");
  location(g, "naboogunganswamp", COUNCIL);
  play(g, "light", card("light", "gunganenergyshield", DOTF, "in_play"));
  const fambaa = play(g, "light", card("light", "fambaa", NABOO, "in_play"));
  const gungan = play(g, "light", card("light", "gunganwarriorinfantry", MENACE, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  fuel(g, "light", 1);
  const step = characterFight(g, [fambaa.instanceId, gungan.instanceId], [foe.instanceId]);
  check(
    "Gungan Energy Shield adds 2 when a Gungan uses a fambaa",
    step?.lightPower === 5,
    `light ${step?.lightPower} (expected 5 = Gungan 2 + fambaa destiny 1 + shield 2)`
  );
});

run("Gungan Energy Shield stops a tank from using a weapon", () => {
  const g = game("shield-tank");
  location(g, "naboogunganswamp", COUNCIL);
  play(g, "light", card("light", "gunganenergyshield", DOTF, "in_play"));
  const cannon = play(g, "dark", card("dark", "tradefederationtanklasercannon", MENACE, "in_play"));
  const tank = play(g, "dark", card("dark", "tradefederationtankarmoreddivision", MENACE, "in_play"));
  const me = play(g, "light", card("light", "gunganwarriorinfantry", MENACE, "in_play"));
  fuel(g, "dark", 1);
  const step = characterFight(g, [me.instanceId], [cannon.instanceId, tank.instanceId]);
  check(
    "Gungan Energy Shield stops a tank from using a weapon",
    step?.darkPower === 5 && (step?.darkDestinyDraws?.length ?? 0) === 0,
    `dark power ${step?.darkPower} draws ${step?.darkDestinyDraws?.length ?? 0} (expected printed 5 and no cannon destiny)`
  );
});

run("Naboo Fighter Attack fights a starfighter and a transport together", () => {
  const g = game("fighter-attack");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "light", card("light", "naboofighterattack", DOTF, "hand"));
  const fighter = card("light", "naboostarfighterduel", DOTF, "hyperspace");
  const transport = card("light", "republiccruisertransport", MENACE, "hyperspace");
  const foe = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [fighter, transport];
  g.dark.hyperspace = [foe];
  fuel(g, "light", 1);
  fuel(g, "dark", 1);
  const step = shipFight(
    g,
    [battle.instanceId, fighter.instanceId, transport.instanceId],
    [foe.instanceId],
    [battle.instanceId]
  );
  check(
    "Naboo Fighter Attack fights a starfighter and a transport together",
    step?.lightCardId2 === transport.cardId && step.lightPower === 8 && (g.battleRevealSequence?.length ?? 0) === 1,
    `second ship ${step?.lightCardId2} power ${step?.lightPower} steps ${g.battleRevealSequence?.length} (expected the cruiser in the same fight and power 8)`
  );
});

run("Naboo Fighter Attack lets Ric Olié and a pilot fight together", () => {
  const g = game("fighter-attack-pilots");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "light", card("light", "naboofighterattack", DOTF, "hand"));
  const ric = play(g, "light", card("light", "ricoliestarshippilot", DOTF, "in_play"));
  const pilot = play(g, "light", card("light", "bravopilotnaboovolunteer", COUNCIL, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const step = characterFight(
    g,
    [battle.instanceId, ric.instanceId, pilot.instanceId],
    [foe.instanceId]
  );
  check(
    "Naboo Fighter Attack lets Ric Olié and a pilot fight together",
    step?.lightCardId2 === pilot.cardId && step.lightPower === 6 && (g.battleRevealSequence?.length ?? 0) === 1 && step.lightBattleCardId === battle.cardId,
    `second character ${step?.lightCardId2} power ${step?.lightPower} steps ${g.battleRevealSequence?.length} card ${step?.lightBattleCardId} (expected the volunteer in the same fight and power 6 = Ric 4 + volunteer 2)`
  );
});

run("Run The Blockade adds 3 with Ric Olié", () => {
  const g = game("blockade-ric");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "light", card("light", "runtheblockade", DOTF, "hand"));
  const ric = play(g, "light", card("light", "ricoliestarshippilot", DOTF, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const step = characterFight(g, [battle.instanceId, ric.instanceId], [foe.instanceId]);
  check(
    "Run The Blockade adds 3 with Ric Olié",
    step?.lightPower === 7,
    `light ${step?.lightPower} (expected 7 = Ric 4 + battle card 3)`
  );
});

run("Run The Blockade adds 3 with Amidala's Starship", () => {
  const g = game("blockade-ship");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "light", card("light", "runtheblockade", DOTF, "hand"));
  const ship = card("light", "amidalasstarshiproyaltransport", NABOO, "hyperspace");
  const foe = card("dark", "droidstarfighterduel", DOTF, "hyperspace");
  g.light.hyperspace = [ship];
  g.dark.hyperspace = [foe];
  fuel(g, "dark", 1);
  const step = shipFight(g, [battle.instanceId, ship.instanceId], [foe.instanceId], [battle.instanceId]);
  check(
    "Run The Blockade adds 3 with Amidala's Starship",
    step?.lightPower === 9 && step.lightBattleCardBonus === 3,
    `light ${step?.lightPower} bonus ${step?.lightBattleCardBonus} (expected 9 = ship 6 + 3)`
  );
});

function effectPower(label: string, effectId: string, whoId: string, whoSet: string, expected: number): void {
  run(label, () => {
    const g = game(label);
    location(g, "tatooinemosespa", COUNCIL);
    play(g, "light", card("light", effectId, DOTF, "in_play"));
    const who = play(g, "light", card("light", whoId, whoSet, "in_play"));
    const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
    const step = characterFight(g, [who.instanceId], [foe.instanceId]);
    check(label, step?.lightPower === expected, `light ${step?.lightPower} (expected ${expected})`);
  });
}

effectPower("Senate Guard boosts Valorum", "senateguard", "valorumleaderofthesenate", DOTF, 5);
effectPower("Senate Guard boosts Mas Amedda", "senateguard", "masameddavicechancellor", MENACE, 5);
effectPower("Senate Guard boosts Sci Taria", "senateguard", "scitariachancellorsaide", COUNCIL, 3);
effectPower("Senate Guard boosts a senator", "senateguard", "galacticsenatordelegate", COUNCIL, 3);
effectPower("Senate Guard boosts a Coruscant Guard", "senateguard", "coruscantguardofficer", COUNCIL, 4);
effectPower("Senate Guard does not boost an unrelated character", "senateguard", "ishitibwarrior", MENACE, 3);

effectPower("Naboo Royal Security boosts Panaka", "royalnaboosecurityforces", "captainquarshpanakasecuritycommander", DOTF, 6);
effectPower("Naboo Royal Security boosts a Royal Guard", "royalnaboosecurityforces", "royalguardleader", MENACE, 4);
effectPower("Naboo Royal Security boosts a Naboo Officer", "royalnaboosecurityforces", "nabooofficerbattleplanner", MENACE, 5);
effectPower("Naboo Royal Security boosts Naboo Security", "royalnaboosecurityforces", "naboosecuritytrooper", NABOO, 4);
effectPower("Naboo Royal Security does not boost an unrelated character", "royalnaboosecurityforces", "ishitibwarrior", MENACE, 3);

run("Pounded Unto Death discards a diamond card and leaves a unique", () => {
  const g = game("pounded");
  g.phase = "even_up";
  location(g, "naboogunganswamp", COUNCIL);
  const effect = play(g, "light", card("light", "poundeduntodeath", DOTF, "in_play"));
  const droid = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  const began = pounded.beginPoundedUntoDeath(g, "light", effect.instanceId);
  const ids = (g.poundedPending?.targets ?? []).map((t) => t.cardId);
  const confirmed = began.ok ? pounded.confirmPoundedUntoDeath(g, "light", droid.instanceId) : { ok: false, error: began.error };
  const droidDiscarded = g.dark.discard.some((c) => c.instanceId === droid.instanceId);
  const effectDiscarded = g.light.discard.some((c) => c.instanceId === effect.instanceId);
  const maulStays = g.dark.inPlay.some((c) => c.instanceId === maul.instanceId);
  check(
    "Pounded Unto Death discards a diamond card and leaves a unique",
    began.ok && ids.length === 1 && ids[0] === droid.cardId && confirmed.ok && droidDiscarded && effectDiscarded && maulStays,
    `targets ${ids.join(", ") || "none"}; confirm ${confirmed.ok ? "ok" : confirmed.error}; droid discarded ${droidDiscarded}; effect discarded ${effectDiscarded}; Maul stays ${maulStays}`
  );
});

run("Jedi Training offers a lightsaber when a Jedi deploys", () => {
  const g = game("training");
  g.phase = "deploy";
  location(g, "nabootheedpalace", MENACE);
  play(g, "light", card("light", "jeditraining", DOTF, "in_play"));
  const saber = deckTop(g, "light", "quigonjinnslightsaberwieldedbyobiwan", DOTF);
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const offered = jediTraining.maybeBeginJediTraining(g, "light", qui);
  const choice = g.jediTrainingPending?.choices.find((c) => c.instanceId === saber.instanceId);
  const confirmed = offered && choice ? jediTraining.confirmJediTraining(g, "light", saber.instanceId) : { ok: false, error: "no offer" };
  const saberInPlay = g.light.inPlay.some((c) => c.instanceId === saber.instanceId);
  const effectDiscarded = g.light.discard.some((c) => c.cardId === "jeditraining");
  check(
    "Jedi Training offers a lightsaber when a Jedi deploys",
    offered && !!choice && confirmed.ok && saberInPlay && effectDiscarded && g.light.force === 5,
    `offered ${offered}; choice ${choice ? "yes" : "no"}; confirm ${confirmed.ok ? "ok" : confirmed.error}; saber in play ${saberInPlay}; effect discarded ${effectDiscarded}; force left ${g.light.force}`
  );
});

run("Jedi Training does not offer for Obi-Wan, who is not a Jedi trait", () => {
  const g = game("training-obi");
  g.phase = "deploy";
  play(g, "light", card("light", "jeditraining", DOTF, "in_play"));
  deckTop(g, "light", "obiwankenobislightsaber", MENACE);
  const obi = play(g, "light", card("light", "obiwankenobijedistudent", DOTF, "in_play"));
  const offered = jediTraining.maybeBeginJediTraining(g, "light", obi);
  check(
    "Jedi Training does not offer for Obi-Wan, who is not a Jedi trait",
    offered === false,
    `offered ${offered} (expected no prompt)`
  );
});

run("Yoda discards himself and 3 hand cards, then draws 3", () => {
  const g = game("yoda");
  g.phase = "deploy";
  const yoda = card("light", "yodajediphilosopher", DOTF, "in_play");
  g.controlledPlanets = [{
    locationCardId: "nabootheedpalace",
    locationInstanceId: "won-naboo",
    planet: "Naboo",
    controlledBy: "light",
    strandedLight: [{ instanceId: yoda.instanceId, cardId: yoda.cardId, faceDown: false }],
    strandedDark: [],
  }];
  const h1 = hand(g, "light", card("light", "c3poanakinscreation", MENACE, "hand"));
  const h2 = hand(g, "light", card("light", "c3poanakinscreation", MENACE, "hand"));
  const h3 = hand(g, "light", card("light", "c3poanakinscreation", MENACE, "hand"));
  deckTop(g, "light", "quigonjinnjedimentor", DOTF);
  deckTop(g, "light", "quigonjinnjedimentor", DOTF);
  deckTop(g, "light", "quigonjinnjedimentor", DOTF);
  const began = winControl.beginWinControl(g, "light", yoda.instanceId, 0);
  const confirmed = began.ok
    ? winControl.confirmWinControl(g, "light", [h1.instanceId, h2.instanceId, h3.instanceId])
    : { ok: false, error: began.error };
  const stranded = g.controlledPlanets?.[0].strandedLight ?? [];
  check(
    "Yoda discards himself and 3 hand cards, then draws 3",
    began.ok && confirmed.ok && stranded.length === 0 && g.light.hand.length === 3 && g.light.discard.length === 4,
    `begin ${began.ok ? "ok" : began.error}; confirm ${confirmed.ok ? "ok" : confirmed.error}; stranded ${stranded.length}; hand ${g.light.hand.length}; discard ${g.light.discard.length}`
  );
});

run("A Powerful Opponent asks again after you decline the first destiny", () => {
  const g = game("replace");
  location(g, "tatooinepodracearena", MENACE);
  const battle = hand(g, "light", card("light", "apowerfulopponent", DOTF, "hand"));
  const blaster = play(g, "light", card("light", "blaster_light", MENACE, "in_play"));
  const anakin = play(g, "light", card("light", "anakinskywalkerrookiepilot", DOTF, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  deckTop(g, "light", "queenamidalayoungleader", DOTF);
  deckTop(g, "light", "quigonjinnjedimentor", DOTF);
  characterFight(g, [battle.instanceId, blaster.instanceId, anakin.instanceId], [foe.instanceId]);
  const first = g.damageReplacePending?.draw;
  const declined = first ? declineDamageReplace(g, "light") : false;
  const second = g.damageReplacePending?.draw;
  const accepted = second ? confirmDamageReplace(g, "light", second.key) : false;
  const step = g.battleRevealSequence?.[0];
  check(
    "A Powerful Opponent asks again after you decline the first destiny",
    !!first && first.destiny === 1 && declined && !!second && second.key !== first.key && second.destiny === 6 && accepted && step?.lightPower === 5,
    `first ${first?.destiny ?? "none"}; declined ${declined}; second ${second?.destiny ?? "none"}; accepted ${accepted}; power ${step?.lightPower} (expected keep the 1, replace the 6 with Anakin damage 4, power 5)`
  );
});

run("Twist of Fate swaps when your destiny is lower", () => {
  const g = game("twist-low");
  location(g, "tatooinemosespa", COUNCIL);
  const battle = hand(g, "light", card("light", "twistoffate", DOTF, "hand"));
  const myWeapon = play(g, "light", card("light", "blaster_light", MENACE, "in_play"));
  const me = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const theirWeapon = play(g, "dark", card("dark", "blaster_dark", MENACE, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  deckTop(g, "light", "quigonjinnjedimentor", DOTF);
  deckTop(g, "dark", "queenamidalayoungleader", DOTF);
  const step = characterFight(
    g,
    [battle.instanceId, myWeapon.instanceId, me.instanceId],
    [theirWeapon.instanceId, foe.instanceId]
  );
  check(
    "Twist of Fate swaps when your destiny is lower",
    step?.lightPower === 9 && step?.darkPower === 3,
    `light ${step?.lightPower} dark ${step?.darkPower} (expected 9 and 3: Ithorian 3 + their 6, droid 2 + your 1)`
  );
});

run("Twist of Fate does not swap when your destiny is higher", () => {
  const g = game("twist-high");
  location(g, "tatooinemosespa", COUNCIL);
  const battle = hand(g, "light", card("light", "twistoffate", DOTF, "hand"));
  const myWeapon = play(g, "light", card("light", "blaster_light", MENACE, "in_play"));
  const me = play(g, "light", card("light", "ishitibwarrior", MENACE, "in_play"));
  const theirWeapon = play(g, "dark", card("dark", "blaster_dark", MENACE, "in_play"));
  const foe = play(g, "dark", card("dark", "battledroidinfantrymttdivision", MENACE, "in_play"));
  deckTop(g, "light", "queenamidalayoungleader", DOTF);
  deckTop(g, "dark", "quigonjinnjedimentor", DOTF);
  const step = characterFight(
    g,
    [battle.instanceId, myWeapon.instanceId, me.instanceId],
    [theirWeapon.instanceId, foe.instanceId]
  );
  check(
    "Twist of Fate does not swap when your destiny is higher",
    step?.lightPower === 9 && step?.darkPower === 3 && !g.destinySwapPending,
    `light ${step?.lightPower} dark ${step?.darkPower} pending ${g.destinySwapPending ? "yes" : "no"} (expected no swap: Ithorian 3 + your 6)`
  );
});

function openDuel(
  label: string,
  foeId: string,
  foeSet: string,
  stack?: (g: GameStateData) => void
): { g: GameStateData; qui: CardInstance; foe: CardInstance } | undefined {
  const g = game(label);
  location(g, "tatooinepodracearena", MENACE);
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const saber = play(g, "light", card("light", "quigonjinnslightsaberwieldedbyobiwan", DOTF, "in_play"));
  const foe = play(g, "dark", card("dark", foeId, foeSet, "in_play"));
  if (stack) stack(g);
  const started = initiateDuel(g, "light", qui.instanceId, saber.instanceId);
  const aimed = started && chooseDuelTarget(g, "light", foe.instanceId);
  if (!aimed || g.duelState?.step !== "play") {
    check(label, false, `duel did not start (initiate ${started}, step ${g.duelState?.step ?? "none"})`);
    return undefined;
  }
  return { g, qui, foe };
}

run("Qui-Gon gains 2 power while dueling Darth Maul", () => {
  const opened = openDuel("qui-maul", "darthmaulstudentofthedarkside", DOTF, (g) => {
    fuel(g, "light", 1, 10);
    fuel(g, "dark", 1, 8);
  });
  if (!opened) return;
  const d = opened.g.duelState!;
  check(
    "Qui-Gon gains 2 power while dueling Darth Maul",
    d.lightPower === 10 && d.darkPower === 8,
    `light ${d.lightPower} dark ${d.darkPower} (expected 10 = Qui-Gon 6 + saber 2 + dueling 2, and 8 = Maul 6 + his own dueling-a-Jedi 2)`
  );
});

run("Qui-Gon gains 2 power while dueling Darth Sidious", () => {
  const opened = openDuel("qui-sidious", "darthsidiousmasterofthedarkside", DOTF, (g) => {
    fuel(g, "light", 1, 10);
    fuel(g, "dark", 1, 5);
  });
  if (!opened) return;
  const d = opened.g.duelState!;
  check(
    "Qui-Gon gains 2 power while dueling Darth Sidious",
    d.lightPower === 10 && d.darkPower === 5,
    `light ${d.lightPower} dark ${d.darkPower} (expected 10 and Sidious printed 5)`
  );
});

run("Qui-Gon has no dueling bonus against a battle droid", () => {
  const opened = openDuel("qui-droid", "battledroidinfantrymttdivision", MENACE, (g) => {
    fuel(g, "light", 1, 8);
    fuel(g, "dark", 1, 2);
  });
  if (!opened) return;
  const d = opened.g.duelState!;
  check(
    "Qui-Gon has no dueling bonus against a battle droid",
    d.lightPower === 8 && d.darkPower === 2,
    `light ${d.lightPower} dark ${d.darkPower} (expected 8 = Qui-Gon 6 + saber 2, droid 2)`
  );
});

run("Qui-Gon's dueling bonus does not apply in a planet battle", () => {
  const g = game("qui-planet");
  location(g, "tatooinepodracearena", MENACE);
  const qui = play(g, "light", card("light", "quigonjinnjedimentor", DOTF, "in_play"));
  const saber = play(g, "light", card("light", "quigonjinnslightsaberwieldedbyobiwan", DOTF, "in_play"));
  const maul = play(g, "dark", card("dark", "darthmaulstudentofthedarkside", DOTF, "in_play"));
  fuel(g, "light", 1);
  const step = characterFight(g, [saber.instanceId, qui.instanceId], [maul.instanceId]);
  check(
    "Qui-Gon's dueling bonus does not apply in a planet battle",
    step?.lightPower === 9 && step.darkPower === 6,
    `light ${step?.lightPower} dark ${step?.darkPower} (expected 9 = Qui-Gon 6 + saber 2 + destiny 1, Maul printed 6)`
  );
});

run("Critical Confrontation draws one extra dueling card", () => {
  const opened = openDuel("critical-draw", "battledroidinfantrymttdivision", MENACE, (g) => {
    deckTop(g, "light", "queenamidalayoungleader", DOTF);
    for (let i = 0; i < 7; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "criticalconfrontation", DOTF);
    fuel(g, "dark", 1, 2);
  });
  if (!opened) return;
  const hand = opened.g.duelState!.lightDuelHand;
  const criticals = hand.filter((c) => c.cardId === "criticalconfrontation").length;
  check(
    "Critical Confrontation draws one extra dueling card",
    hand.length === 9 && criticals === 1,
    `hand ${hand.length} critical cards ${criticals} (expected 9 cards, one of them Critical Confrontation: power 8 plus 1)`
  );
});

run("A second Critical Confrontation drawn by the extra card does not draw again", () => {
  const opened = openDuel("critical-chain", "battledroidinfantrymttdivision", MENACE, (g) => {
    deckTop(g, "light", "criticalconfrontation", DOTF);
    for (let i = 0; i < 7; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "criticalconfrontation", DOTF);
    fuel(g, "dark", 1, 2);
  });
  if (!opened) return;
  const hand = opened.g.duelState!.lightDuelHand;
  const criticals = hand.filter((c) => c.cardId === "criticalconfrontation").length;
  check(
    "A second Critical Confrontation drawn by the extra card does not draw again",
    hand.length === 9 && criticals === 2,
    `hand ${hand.length} critical cards ${criticals} (expected 9 cards and both copies, not a third draw)`
  );
});

run("A Powerful Opponent scores two hits", () => {
  const opened = openDuel("apo-hit", "darthmaulstudentofthedarkside", DOTF, (g) => {
    for (let i = 0; i < 9; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "apowerfulopponent", DOTF);
    fuel(g, "dark", 1, 8);
  });
  if (!opened) return;
  const d = opened.g.duelState!;
  const attack = d.lightDuelHand.find((c) => c.cardId === "apowerfulopponent")!;
  const block = d.darkDuelHand[0];
  const played = playDuelCard(opened.g, "light", attack.instanceId) && playDuelCard(opened.g, "dark", block.instanceId);
  check(
    "A Powerful Opponent scores two hits",
    played && opened.g.duelState?.darkHits === 2,
    `played ${played}; dark hits ${opened.g.duelState?.darkHits} (expected 2 from one attack)`
  );
});

run("A normal dueling card scores one hit", () => {
  const opened = openDuel("one-hit", "darthmaulstudentofthedarkside", DOTF, (g) => {
    fuel(g, "light", 1, 10);
    fuel(g, "dark", 6, 8);
  });
  if (!opened) return;
  const d = opened.g.duelState!;
  const played = playDuelCard(opened.g, "light", d.lightDuelHand[0].instanceId)
    && playDuelCard(opened.g, "dark", d.darkDuelHand[0].instanceId);
  check(
    "A normal dueling card scores one hit",
    played && opened.g.duelState?.darkHits === 1,
    `played ${played}; dark hits ${opened.g.duelState?.darkHits} (expected 1)`
  );
});

run("Qui-Gon's Final Stand can be discarded for two extra hits", () => {
  const opened = openDuel("final-stand", "darthmaulstudentofthedarkside", DOTF, (g) => {
    for (let i = 0; i < 9; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "quigonsfinalstand", DOTF);
    fuel(g, "dark", 1, 8);
  });
  if (!opened) return;
  const stand = opened.g.duelState!.lightDuelHand.find((c) => c.cardId === "quigonsfinalstand")!;
  const played = playDuelCard(opened.g, "light", stand.instanceId, { discardForExtraHits: true });
  const pending = opened.g.duelState?.pendingAttack;
  const discarded = opened.g.light.discard.some((c) => c.instanceId === stand.instanceId);
  const stillInHand = opened.g.duelState?.lightDuelHand.some((c) => c.instanceId === stand.instanceId);
  const blocked = played && playDuelCard(opened.g, "dark", opened.g.duelState!.darkDuelHand[0].instanceId);
  check(
    "Qui-Gon's Final Stand can be discarded for two extra hits",
    played && pending?.bonusHits === 2 && pending.discarded === true && discarded && !stillInHand && blocked && opened.g.duelState?.darkHits === 3,
    `played ${played}; bonus hits ${pending?.bonusHits}; discarded flag ${pending?.discarded}; in discard ${discarded}; still in hand ${stillInHand}; dark hits ${opened.g.duelState?.darkHits} (expected 3)`
  );
});

run("Qui-Gon's Final Stand is one hit if you do not discard it", () => {
  const opened = openDuel("final-stand-plain", "darthmaulstudentofthedarkside", DOTF, (g) => {
    for (let i = 0; i < 9; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "quigonsfinalstand", DOTF);
    fuel(g, "dark", 1, 8);
  });
  if (!opened) return;
  const stand = opened.g.duelState!.lightDuelHand.find((c) => c.cardId === "quigonsfinalstand")!;
  const played = playDuelCard(opened.g, "light", stand.instanceId)
    && playDuelCard(opened.g, "dark", opened.g.duelState!.darkDuelHand[0].instanceId);
  const inPlayed = opened.g.duelState?.lightPlayed.some((c) => c.instanceId === stand.instanceId);
  check(
    "Qui-Gon's Final Stand is one hit if you do not discard it",
    played && opened.g.duelState?.darkHits === 1 && !!inPlayed,
    `played ${played}; dark hits ${opened.g.duelState?.darkHits}; kept with the played cards ${!!inPlayed}`
  );
});

run("Twist of Fate removes one hit, once", () => {
  const opened = openDuel("twist-hit", "darthmaulstudentofthedarkside", DOTF, (g) => {
    deckTop(g, "light", "comeonmove", DOTF);
    fuel(g, "light", 1, 8);
    deckTop(g, "light", "twistoffate", DOTF);
    deckTop(g, "dark", "quigonjinnjedimentor", DOTF);
    fuel(g, "dark", 6, 7);
  });
  if (!opened) return;
  const d = opened.g.duelState!;
  const twist = d.lightDuelHand.find((c) => c.cardId === "twistoffate")!;
  const mine = d.lightDuelHand.find((c) => c.cardId === "quigonjinnjedimentor")!;
  const tooEarly = removeDuelHit(opened.g, "light", twist.instanceId);
  const openedExchange = playDuelCard(opened.g, "light", mine.instanceId)
    && playDuelCard(opened.g, "dark", d.darkDuelHand[0].instanceId);
  const theirAttack = d.darkDuelHand.find((c) => c.cardId === "quigonjinnjedimentor")!;
  const myAnswer = d.lightDuelHand.find((c) => c.cardId === "comeonmove")!;
  const hit = playDuelCard(opened.g, "dark", theirAttack.instanceId)
    && playDuelCard(opened.g, "light", myAnswer.instanceId);
  const wrongCard = removeDuelHit(opened.g, "light", d.lightDuelHand.find((c) => c.instanceId !== twist.instanceId)!.instanceId);
  const removed = removeDuelHit(opened.g, "light", twist.instanceId);
  const again = removeDuelHit(opened.g, "light", twist.instanceId);
  const stillThere = opened.g.duelState?.lightDuelHand.some((c) => c.instanceId === twist.instanceId);
  check(
    "Twist of Fate removes one hit, once",
    !tooEarly && openedExchange && hit && opened.g.duelState?.lightHits === 0 && !wrongCard && removed && !again && !!stillThere,
    `before any hits ${tooEarly}; opening exchange ${openedExchange}; hit landed ${hit}; hits now ${opened.g.duelState?.lightHits}; other card ${wrongCard}; removed ${removed}; second time ${again}; card stays ${!!stillThere}`
  );
});

run("You Are Strong With The Force discards to draw two dueling cards", () => {
  const opened = openDuel("strong-draw", "battledroidinfantrymttdivision", MENACE, (g) => {
    deckTop(g, "light", "queenamidalayoungleader", DOTF);
    deckTop(g, "light", "queenamidalayoungleader", DOTF);
    for (let i = 0; i < 6; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "comeonmove", DOTF);
    deckTop(g, "light", "youarestrongwiththeforce", DOTF);
    fuel(g, "dark", 1, 2);
  });
  if (!opened) return;
  const hand = opened.g.duelState!.lightDuelHand;
  const strong = hand.find((c) => c.cardId === "youarestrongwiththeforce")!;
  const other = hand.find((c) => c.cardId === "comeonmove")!;
  const wrong = discardDuelCardForDraw(opened.g, "light", other.instanceId);
  const drawn = discardDuelCardForDraw(opened.g, "light", strong.instanceId);
  const after = opened.g.duelState!.lightDuelHand;
  const discarded = opened.g.light.discard.some((c) => c.instanceId === strong.instanceId);
  const drewQueens = after.filter((c) => c.cardId === "queenamidalayoungleader").length;
  check(
    "You Are Strong With The Force discards to draw two dueling cards",
    !wrong && drawn && after.length === 9 && discarded && drewQueens === 2,
    `other card ${wrong}; discarded for draw ${drawn}; hand ${after.length}; in discard ${discarded}; queens drawn ${drewQueens} (expected hand 9)`
  );
});

run("You cannot discard the attack you just played to draw cards", () => {
  const opened = openDuel("strong-pending", "battledroidinfantrymttdivision", MENACE, (g) => {
    for (let i = 0; i < 7; i++) deckTop(g, "light", "quigonjinnjedimentor", DOTF);
    deckTop(g, "light", "youarestrongwiththeforce", DOTF);
    fuel(g, "dark", 1, 2);
  });
  if (!opened) return;
  const strong = opened.g.duelState!.lightDuelHand.find((c) => c.cardId === "youarestrongwiththeforce")!;
  const attacked = playDuelCard(opened.g, "light", strong.instanceId);
  const drawn = discardDuelCardForDraw(opened.g, "light", strong.instanceId);
  check(
    "You cannot discard the attack you just played to draw cards",
    attacked && !drawn && opened.g.duelState?.pendingAttack?.cardId === "youarestrongwiththeforce",
    `attack ${attacked}; discard-for-draw ${drawn}; pending ${opened.g.duelState?.pendingAttack?.cardId ?? "none"}`
  );
});

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  if (!r.ok) console.log(`      ${r.detail}`);
}
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed, ${results.length} checks`);
if (failed.length > 0) process.exitCode = 1;
