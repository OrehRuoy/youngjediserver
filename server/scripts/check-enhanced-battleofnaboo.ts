/**
 * Enhanced Battle of Naboo light side: six characters and their abilities.
 * Run from server/: npx ts-node scripts/check-enhanced-battleofnaboo.ts
 */
import { getCard, initCards } from "../src/cards/loader";
import type { CardInstance } from "../src/cards/types";
import type { Side } from "../src/types";
import { maybeApplyDeployDamage } from "../src/game/deploy-draw";
import { confirmDeployFromDeck, declineDeployFromDeck, maybeBeginDeployFromDeck } from "../src/game/deploy-from-deck";
import {
  confirmDestinyChoose,
  createGameState,
  getLocationBonusForCharacter,
  interceptTransport,
  markFoughtThisTurn,
  resolveBattlePlan,
  startEvacuation,
  type GameStateData,
} from "../src/game/state";

initCards();

const SET = "enhancedbattleofnaboo";
type Step = NonNullable<GameStateData["battleRevealSequence"]>[number];
const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

let seq = 0;
function card(side: Side, id: string, set = SET): CardInstance {
  seq += 1;
  return { instanceId: "c" + seq, cardId: id, cardSet: set, ownerSide: side, zone: "in_play", faceDown: false };
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
  const locationCard = card("light", loc, "menaceofdarthmaul");
  g.light.inPlay.push(locationCard);
  g.startingLocationInstanceId = locationCard.instanceId;
  return g;
}

function put(g: GameStateData, side: Side, id: string, set = SET): CardInstance {
  const c = card(side, id, set);
  const p = side === "light" ? g.light : g.dark;
  p.inPlay.push(c);
  return c;
}

function top(g: GameStateData, side: Side, id: string, set: string): void {
  const c = card(side, id, set);
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

const DROID = "battledroidinfantrypatroldivision";

run("Obi-Wan Jedi Avenger adds 2 damage for each character he defeats", () => {
  const g = game("obi");
  const obi = put(g, "light", "obiwankenobijediavenger");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [obi], [foe]);
  check(
    "Obi-Wan Jedi Avenger adds 2 damage for each character he defeats",
    step?.lightPower === 5 && step.darkMill === 3,
    `power ${step?.lightPower} mill ${step?.darkMill} (expected 5 power, mill 1+2)`
  );
});

run("Anakin redraws a low destiny for his own power", () => {
  const g = game("anakin");
  g.lightPlayerId = "bot_1";
  top(g, "light", "heavyblaster", "battleofnaboo");
  top(g, "light", "obiwankenobijedipadawan", "menaceofdarthmaul");
  const anakin = put(g, "light", "anakinskywalkertestedbythejedicouncil");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [anakin], [foe]);
  check(
    "Anakin redraws a low destiny for his own power",
    step?.lightPower === 7,
    `power ${step?.lightPower} (expected redraw 1 into 6, plus 1 at the capital)`
  );
});

run("Padme gains 2 after a handmaiden has fought", () => {
  const g = game("padme");
  markFoughtThisTurn(g, "rabehandmaiden");
  const padme = put(g, "light", "padmenaberrieloyalhandmaiden");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [padme], [foe]);
  check(
    "Padme gains 2 after a handmaiden has fought",
    step?.lightPower === 5,
    `power ${step?.lightPower} (expected 3+2)`
  );
});

run("Padme has no extra power before anyone has fought", () => {
  const g = game("padme-none");
  const padme = put(g, "light", "padmenaberrieloyalhandmaiden");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [padme], [foe]);
  check("Padme has no extra power before anyone has fought", step?.lightPower === 3, `power ${step?.lightPower}`);
});

run("Panaka counts as a Royal Guard for your battle cards", () => {
  const g = game("panaka");
  const battle = put(g, "light", "securityvolunteers", "menaceofdarthmaul");
  const panaka = put(g, "light", "captainpanakaroyaldefender");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [battle, panaka], [foe]);
  check(
    "Panaka counts as a Royal Guard for your battle cards",
    step?.lightPower === 6 && step.lightBattleCardBonus === 2,
    `power ${step?.lightPower} card ${step?.lightBattleCardBonus}`
  );
});

run("A unique Jedi does not count as that Royal Guard", () => {
  const g = game("panaka-no");
  const battle = put(g, "light", "securityvolunteers", "menaceofdarthmaul");
  const obi = put(g, "light", "obiwankenobijediavenger");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [battle, obi], [foe]);
  check(
    "A unique Jedi does not count as that Royal Guard",
    step?.lightPower === 5 && (step?.lightBattleCardBonus ?? 0) === 0,
    `power ${step?.lightPower} card ${step?.lightBattleCardBonus ?? 0}`
  );
});

run("Yoda gains 2 when the opponent has controlled a planet", () => {
  const g = game("yoda", "tatooinepodracearena");
  g.controlledPlanets = [{
    locationCardId: "nabootheedpalace",
    locationInstanceId: "won",
    planet: "Naboo",
    controlledBy: "dark",
    strandedLight: [],
    strandedDark: [],
  }];
  const yoda = put(g, "light", "yodawisejedi");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [yoda], [foe]);
  check(
    "Yoda gains 2 when the opponent has controlled a planet",
    step?.lightPower === 6,
    `power ${step?.lightPower} (expected 4+2)`
  );
});

run("Yoda has no extra power when the opponent controls nothing", () => {
  const g = game("yoda-none", "tatooinepodracearena");
  const yoda = put(g, "light", "yodawisejedi");
  const foe = put(g, "dark", DROID, "battleofnaboo");
  const [step] = fight(g, [yoda], [foe]);
  check("Yoda has no extra power when the opponent controls nothing", step?.lightPower === 4, `power ${step?.lightPower}`);
});

run("R2 adds 2 to Amidala's Starship evacuating his planet", () => {
  const g = game("r2");
  g.phase = "deploy";
  const ship = card("light", "amidalasstarshiproyaltransport", "battleofnaboo");
  ship.zone = "hand";
  g.light.hand.push(ship);
  put(g, "light", "r2d2starshipmaintenancedroid");
  const fighter = card("dark", "bravo3naboostarfighter", "battleofnaboo");
  fighter.zone = "hand";
  g.dark.hand.push(fighter);
  const started = startEvacuation(g, "light", ship.instanceId, -1);
  const result = interceptTransport(g, "dark", fighter.instanceId);
  check(
    "R2 adds 2 to Amidala's Starship evacuating his planet",
    started && result?.transportPower === 8,
    `started ${started} power ${result?.transportPower} (expected 6+2)`
  );
});

function hasBoth(ids: string[], a: string, b: string): boolean {
  return ids.includes(a) && ids.includes(b);
}

run("Dark side cards have the printed stats", () => {
  const expect: { id: string; cost: number; power: number; damage: number; locs: string[] }[] = [
    { id: "darthsidiousphantommenace", cost: 4, power: 5, damage: 6, locs: ["coruscantjedicouncilchamber", "coruscantgalacticsenate", "coruscantcapitalcity"] },
    { id: "wattorisktaker", cost: 1, power: 3, damage: 2, locs: ["tatooinemosespa", "tatooinedesertlandingsite", "tatooinepodracearena"] },
    { id: "aurrasingscoundrel", cost: 2, power: 5, damage: 3, locs: ["nabootheedpalace", "naboobattleplains", "naboogunganswamp"] },
    { id: "jabbathehuttatooinetyrant", cost: 2, power: 4, damage: 2, locs: ["tatooinemosespa", "tatooinedesertlandingsite", "tatooinepodracearena"] },
    { id: "nutegunrayneimoidianbureaucrat", cost: 2, power: 3, damage: 3, locs: ["nabootheedpalace", "naboobattleplains", "naboogunganswamp"] },
    { id: "runehaakoneimoidianlieutenant", cost: 2, power: 3, damage: 3, locs: ["nabootheedpalace", "naboobattleplains", "naboogunganswamp"] },
  ];
  const problems: string[] = [];
  for (const row of expect) {
    const def = getCard(row.id, SET) as { cost?: number; power?: number; damage?: number; destiny?: number; dotColors?: string[]; uniqueness?: boolean; bonus1?: number; bonus2?: number; bonus3?: number; bonus1loc?: string; bonus2loc?: string; bonus3loc?: string };
    const colors = def?.dotColors ?? [];
    const bonusOk = getLocationBonusForCharacter(row.id, row.locs[0]) === 1
      && getLocationBonusForCharacter(row.id, row.locs[1]) === 1
      && getLocationBonusForCharacter(row.id, row.locs[2]) === 1
      && getLocationBonusForCharacter(row.id, "tatooinepodracearena") === (row.locs.includes("tatooinepodracearena") ? 1 : 0);
    if (def?.cost !== row.cost || def?.power !== row.power || def?.damage !== row.damage || def?.destiny !== 6 || def?.uniqueness !== true || colors.length !== 6 || !bonusOk) {
      problems.push(`${row.id} cost ${def?.cost} power ${def?.power} damage ${def?.damage} destiny ${def?.destiny} colors ${colors.length}`);
    }
  }
  check("Dark side cards have the printed stats", problems.length === 0, problems.join("; ") || "costs, destiny 6, power, damage, all 6 dots, and +1 at each of their three locations");
});

run("Sidious deals 2 damage when he deploys to Coruscant", () => {
  const g = game("sidious-deploy");
  top(g, "dark", "blaster_dark", "menaceofdarthmaul");
  top(g, "light", "heavyblaster", "battleofnaboo");
  top(g, "light", "obiwankenobijedipadawan", "menaceofdarthmaul");
  top(g, "light", "blaster_light", "menaceofdarthmaul");
  const winner = maybeApplyDeployDamage(g, "dark", "darthsidiousphantommenace", SET, false);
  const emptied = game("sidious-empty");
  top(emptied, "dark", "blaster_dark", "menaceofdarthmaul");
  top(emptied, "light", "heavyblaster", "battleofnaboo");
  top(emptied, "light", "obiwankenobijedipadawan", "menaceofdarthmaul");
  const emptiedWinner = maybeApplyDeployDamage(emptied, "dark", "darthsidiousphantommenace", SET, false);
  const away = game("sidious-away", "tatooinepodracearena");
  top(away, "dark", "blaster_dark", "menaceofdarthmaul");
  top(away, "light", "heavyblaster", "battleofnaboo");
  const noPlanet = maybeApplyDeployDamage(away, "dark", "darthsidiousphantommenace", SET, false);
  const hidden = game("sidious-down");
  top(hidden, "dark", "blaster_dark", "menaceofdarthmaul");
  top(hidden, "light", "heavyblaster", "battleofnaboo");
  const noFaceDown = maybeApplyDeployDamage(hidden, "dark", "darthsidiousphantommenace", SET, true);
  check(
    "Sidious deals 2 damage when he deploys to Coruscant",
    winner === undefined && g.light.deck.length === 1 && g.light.discard.length === 2 && emptiedWinner === "dark" && emptied.light.deck.length === 0 && away.light.discard.length === 0 && noPlanet === undefined && hidden.light.discard.length === 0 && noFaceDown === undefined,
    `left ${g.light.deck.length} milled ${g.light.discard.length} empty ${emptiedWinner} away ${away.light.discard.length} facedown ${hidden.light.discard.length}`
  );
});

run("Sidious is 6 at the capital and mills 6 when defeated", () => {
  const g = game("sidious-fight");
  const sid = put(g, "dark", "darthsidiousphantommenace");
  const padme = put(g, "light", "padmenaberrieloyalhandmaiden");
  const [step] = fight(g, [padme], [sid]);
  const lost = game("sidious-lost", "tatooinepodracearena");
  for (let i = 0; i < 6; i++) top(lost, "dark", "obiwankenobijedipadawan", "menaceofdarthmaul");
  const sid2 = put(lost, "dark", "darthsidiousphantommenace");
  const qui = put(lost, "light", "quigonjinnjediprotectorenhanced", "enhancedmenaceofdarthmaul");
  const [lostStep] = fight(lost, [qui], [sid2]);
  check(
    "Sidious is 6 at the capital and mills 6 when defeated",
    step?.darkPower === 6 && step?.lightPower === 3 && step?.lightMill === 2 && lostStep?.darkPower === 5 && lostStep?.lightPower === 7 && lostStep?.darkMill === 6 && lost.dark.deck.length === 0,
    `capital dark ${step?.darkPower} light ${step?.lightPower} mill ${step?.lightMill}; lost dark ${lostStep?.darkPower} light ${lostStep?.lightPower} mill ${lostStep?.darkMill} deck ${lost.dark.deck.length}`
  );
});

run("Watto keeps the higher weapon destiny and both cards", () => {
  const g = game("watto-weapon");
  top(g, "dark", "obiwankenobijedipadawan", "menaceofdarthmaul");
  top(g, "dark", "heavyblaster", "battleofnaboo");
  const blaster = put(g, "dark", "blaster_dark", "menaceofdarthmaul");
  const watto = put(g, "dark", "wattorisktaker");
  const foe = put(g, "light", "padmenaberrieloyalhandmaiden");
  const [step] = fight(g, [foe], [blaster, watto]);
  const hand = g.dark.hand.map((c) => c.cardId);
  const discarded = g.dark.discard.map((c) => c.cardId);
  check(
    "Watto keeps the higher weapon destiny and both cards",
    step?.darkPower === 9 && hasBoth(hand, "heavyblaster", "obiwankenobijedipadawan") && !discarded.includes("heavyblaster") && !discarded.includes("obiwankenobijedipadawan"),
    `power ${step?.darkPower} hand ${hand.join(",")} discard ${discarded.join(",")}`
  );
});

run("Watto keeps the higher Battle card destiny and both cards", () => {
  const g = game("watto-battle");
  top(g, "dark", "obiwankenobijedipadawan", "menaceofdarthmaul");
  top(g, "dark", "heavyblaster", "battleofnaboo");
  const wager = put(g, "dark", "wattoswager", "menaceofdarthmaul");
  const watto = put(g, "dark", "wattorisktaker");
  const foe = put(g, "light", "padmenaberrieloyalhandmaiden");
  const [step] = fight(g, [foe], [wager, watto]);
  const hand = g.dark.hand.map((c) => c.cardId);
  check(
    "Watto keeps the higher Battle card destiny and both cards",
    step?.darkPower === 9 && hasBoth(hand, "heavyblaster", "obiwankenobijedipadawan"),
    `power ${step?.darkPower} hand ${hand.join(",")}`
  );
});

run("A player can choose Watto's lower destiny card", () => {
  const g = game("watto-choose");
  g.darkPlayerId = "player_dark";
  top(g, "dark", "obiwankenobijedipadawan", "menaceofdarthmaul");
  top(g, "dark", "heavyblaster", "battleofnaboo");
  const wager = put(g, "dark", "wattoswager", "menaceofdarthmaul");
  const watto = put(g, "dark", "wattorisktaker");
  const foe = put(g, "light", "padmenaberrieloyalhandmaiden");
  g.lightBattlePlanOrder = [foe.instanceId];
  g.darkBattlePlanOrder = [wager.instanceId, watto.instanceId];
  g.battlePlanPhase = true;
  resolveBattlePlan(g);
  const pending = g.destinyChoosePending;
  const options = pending?.draw.options.map((o) => o.cardId) ?? [];
  const picked = confirmDestinyChoose(g, "dark", pending?.draw.key ?? "", "obiwankenobijedipadawan");
  const step = g.battleRevealSequence?.[0];
  const hand = g.dark.hand.map((c) => c.cardId);
  check(
    "A player can choose Watto's lower destiny card",
    !!pending && hasBoth(options, "heavyblaster", "obiwankenobijedipadawan") && picked && step?.darkPower === 4 && hasBoth(hand, "heavyblaster", "obiwankenobijedipadawan"),
    `pending ${!!pending} options ${options.join(",")} picked ${picked} power ${step?.darkPower} hand ${hand.join(",")}`
  );
});

run("Watto does not draw two for his own power", () => {
  const g = game("watto-power", "tatooinemosespa");
  top(g, "dark", "heavyblaster", "battleofnaboo");
  const watto = put(g, "dark", "wattorisktaker");
  const foe = put(g, "light", "padmenaberrieloyalhandmaiden");
  const [step] = fight(g, [foe], [watto]);
  check(
    "Watto does not draw two for his own power",
    step?.darkPower === 4 && g.dark.deck.length === 1 && g.dark.hand.length === 0,
    `power ${step?.darkPower} deck ${g.dark.deck.length} hand ${g.dark.hand.length}`
  );
});

run("Aurra may deploy her blaster rifle from the deck", () => {
  const g = game("aurra-deploy", "tatooinepodracearena");
  g.ruleset = "dotf";
  g.dark.force = 6;
  const aurra = put(g, "dark", "aurrasingscoundrel");
  const rifle = card("dark", "aurrasingsblasterrifle", "menaceofdarthmaul");
  rifle.zone = "deck";
  g.dark.deck.push(rifle);
  const offered = maybeBeginDeployFromDeck(g, "dark", aurra.instanceId, aurra.cardId, aurra.cardSet, false);
  const confirmed = offered && confirmDeployFromDeck(g, "dark");
  const hidden = maybeBeginDeployFromDeck(g, "dark", aurra.instanceId, aurra.cardId, aurra.cardSet, true);
  const skip = game("aurra-skip");
  skip.ruleset = "dotf";
  const aurra2 = put(skip, "dark", "aurrasingscoundrel");
  const rifle2 = card("dark", "aurrasingsblasterrifle", "menaceofdarthmaul");
  rifle2.zone = "deck";
  skip.dark.deck.push(rifle2);
  const offeredSkip = maybeBeginDeployFromDeck(skip, "dark", aurra2.instanceId, aurra2.cardId, aurra2.cardSet, false);
  const declined = offeredSkip && declineDeployFromDeck(skip, "dark");
  const fightGame = game("aurra-fight", "nabootheedpalace");
  const aurra3 = put(fightGame, "dark", "aurrasingscoundrel");
  const foe = put(fightGame, "light", "padmenaberrieloyalhandmaiden");
  const [step] = fight(fightGame, [foe], [aurra3]);
  check(
    "Aurra may deploy her blaster rifle from the deck",
    confirmed && g.dark.inPlay.some((c) => c.instanceId === rifle.instanceId) && g.dark.force === 5 && hidden === false && declined && skip.dark.discard.some((c) => c.instanceId === rifle2.instanceId) && step?.darkPower === 6 && step?.lightMill === 2,
    `confirm ${confirmed} force ${g.dark.force} facedown ${hidden} decline ${declined} power ${step?.darkPower} mill ${step?.lightMill}`
  );
});

run("Jabba gains 2 only after he has controlled Tatooine", () => {
  const plain = game("jabba-plain");
  const jabba = put(plain, "dark", "jabbathehuttatooinetyrant");
  const foe = put(plain, "light", "padmenaberrieloyalhandmaiden");
  const [plainStep] = fight(plain, [foe], [jabba]);
  const held = game("jabba-held");
  held.controlledPlanets = [{
    locationCardId: "tatooinemosespa",
    locationInstanceId: "won",
    planet: "Tatooine",
    controlledBy: "dark",
    strandedLight: [],
    strandedDark: [],
  }];
  const jabba2 = put(held, "dark", "jabbathehuttatooinetyrant");
  const foe2 = put(held, "light", "padmenaberrieloyalhandmaiden");
  const [heldStep] = fight(held, [foe2], [jabba2]);
  const home = game("jabba-home", "tatooinemosespa");
  home.controlledPlanets = held.controlledPlanets;
  const jabba3 = put(home, "dark", "jabbathehuttatooinetyrant");
  const foe3 = put(home, "light", "padmenaberrieloyalhandmaiden");
  const [homeStep] = fight(home, [foe3], [jabba3]);
  const theirs = game("jabba-theirs");
  theirs.controlledPlanets = [{ ...held.controlledPlanets![0], controlledBy: "light" }];
  const jabba4 = put(theirs, "dark", "jabbathehuttatooinetyrant");
  const foe4 = put(theirs, "light", "padmenaberrieloyalhandmaiden");
  const [theirStep] = fight(theirs, [foe4], [jabba4]);
  check(
    "Jabba gains 2 only after he has controlled Tatooine",
    plainStep?.darkPower === 4 && heldStep?.darkPower === 6 && homeStep?.darkPower === 7 && theirStep?.darkPower === 4,
    `plain ${plainStep?.darkPower} controlled ${heldStep?.darkPower} home ${homeStep?.darkPower} opponent ${theirStep?.darkPower}`
  );
});

run("Nute deploys Rune from the deck only on Naboo", () => {
  const g = game("nute-deploy", "nabootheedpalace");
  g.ruleset = "dotf";
  g.dark.force = 6;
  const nute = put(g, "dark", "nutegunrayneimoidianbureaucrat");
  const rune = card("dark", "runehaakoneimoidianlieutenant");
  rune.zone = "deck";
  g.dark.deck.push(card("dark", "blaster_dark", "menaceofdarthmaul"), rune);
  g.dark.deck[0].zone = "deck";
  const offered = maybeBeginDeployFromDeck(g, "dark", nute.instanceId, nute.cardId, nute.cardSet, false);
  const confirmed = offered && confirmDeployFromDeck(g, "dark");
  const away = game("nute-away");
  away.ruleset = "dotf";
  const nute2 = put(away, "dark", "nutegunrayneimoidianbureaucrat");
  const no = maybeBeginDeployFromDeck(away, "dark", nute2.instanceId, nute2.cardId, nute2.cardSet, false);
  const fightGame = game("nute-fight", "naboobattleplains");
  const nute3 = put(fightGame, "dark", "nutegunrayneimoidianbureaucrat");
  const mace = put(fightGame, "light", "macewindujediwarrior", "enhancedmenaceofdarthmaul");
  const [step] = fight(fightGame, [mace], [nute3]);
  check(
    "Nute deploys Rune from the deck only on Naboo",
    confirmed && g.deployFromDeckPending === undefined && g.dark.inPlay.some((c) => c.instanceId === rune.instanceId) && g.dark.force === 4 && no === false && step?.darkPower === 4 && step?.lightPower === 6 && step?.darkMill === 3,
    `confirm ${confirmed} force ${g.dark.force} away ${no} power ${step?.darkPower} vs ${step?.lightPower} mill ${step?.darkMill}`
  );
});

run("Rune deploys a non-unique Neimoidian and not a unique one", () => {
  const g = game("rune-deploy", "naboogunganswamp");
  g.ruleset = "dotf";
  g.dark.force = 6;
  const rune = put(g, "dark", "runehaakoneimoidianlieutenant");
  const unique = card("dark", "nutegunrayneimoidiandespot", "battleofnaboo");
  unique.zone = "deck";
  const advisor = card("dark", "neimoidianadvisorbureaucrat", "battleofnaboo");
  advisor.zone = "deck";
  g.dark.deck.push(unique, advisor);
  const offered = maybeBeginDeployFromDeck(g, "dark", rune.instanceId, rune.cardId, rune.cardSet, false);
  const found = g.deployFromDeckPending?.foundCardId;
  const confirmed = offered && confirmDeployFromDeck(g, "dark");
  const onlyUnique = game("rune-unique", "naboogunganswamp");
  onlyUnique.ruleset = "dotf";
  const rune2 = put(onlyUnique, "dark", "runehaakoneimoidianlieutenant");
  const nuteOnly = card("dark", "nutegunrayneimoidiandespot", "battleofnaboo");
  nuteOnly.zone = "deck";
  onlyUnique.dark.deck.push(nuteOnly);
  const offeredUnique = maybeBeginDeployFromDeck(onlyUnique, "dark", rune2.instanceId, rune2.cardId, rune2.cardSet, false);
  const away = game("rune-away");
  away.ruleset = "dotf";
  const rune3 = put(away, "dark", "runehaakoneimoidianlieutenant");
  const no = maybeBeginDeployFromDeck(away, "dark", rune3.instanceId, rune3.cardId, rune3.cardSet, true);
  const fightGame = game("rune-fight", "nabootheedpalace");
  const rune4 = put(fightGame, "dark", "runehaakoneimoidianlieutenant");
  const mace = put(fightGame, "light", "macewindujediwarrior", "enhancedmenaceofdarthmaul");
  const [step] = fight(fightGame, [mace], [rune4]);
  check(
    "Rune deploys a non-unique Neimoidian and not a unique one",
    offered && found === "neimoidianadvisorbureaucrat" && confirmed && g.dark.inPlay.some((c) => c.instanceId === advisor.instanceId) && g.dark.force === 5 && offeredUnique && onlyUnique.deployFromDeckPending?.foundCardId === undefined && no === false && step?.darkPower === 4 && step?.darkMill === 3,
    `found ${found} force ${g.dark.force} unique-only ${onlyUnique.deployFromDeckPending?.foundCardId ?? "none"} facedown ${no} power ${step?.darkPower} mill ${step?.darkMill}`
  );
});

run("Amidala's Starship does not get that 2 without R2", () => {
  const g = game("r2-none");
  g.phase = "deploy";
  const ship = card("light", "amidalasstarshiproyaltransport", "battleofnaboo");
  ship.zone = "hand";
  g.light.hand.push(ship);
  put(g, "light", "obiwankenobijediavenger");
  const fighter = card("dark", "bravo3naboostarfighter", "battleofnaboo");
  fighter.zone = "hand";
  g.dark.hand.push(fighter);
  const started = startEvacuation(g, "light", ship.instanceId, -1);
  const result = interceptTransport(g, "dark", fighter.instanceId);
  check(
    "Amidala's Starship does not get that 2 without R2",
    started && result?.transportPower === 6,
    `started ${started} power ${result?.transportPower}`
  );
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "ok" : "FAIL"} ${r.name} — ${r.detail}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
