#!/usr/bin/env node
/**
 * Writes server/data/cards/duelofthefates.json (60 cards, numbered 1–60)
 * and renames client PNGs to {n}{slug}.png.
 * Stats are placeholders until cards are extracted from art.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SET = "duelofthefates";

function character(id, name, extra = {}) {
  const uniqueness = extra.uniqueness !== undefined ? extra.uniqueness : true;
  return {
    id,
    name,
    side: extra.side,
    dotColor: extra.dotColor || "red",
    type: "character",
    trait: extra.trait || "",
    persona: extra.persona || "",
    cost: 0,
    power: 0,
    bonus1: 0,
    bonus2: 0,
    bonus3: 0,
    bonus1loc: "",
    bonus2loc: "",
    bonus3loc: "",
    damage: 0,
    lore: "",
    gametext: "",
    gametextbonus: "",
    destiny: 0,
    uniqueness,
    image: extra.image,
    set: SET,
    stackable: false,
  };
}

function weapon(id, name, extra = {}) {
  return {
    id,
    name,
    side: extra.side,
    dotColor: "orange",
    type: "weapon",
    uniqueness: extra.uniqueness !== undefined ? extra.uniqueness : true,
    cost: 0,
    powerAdd: 0,
    powerAdd2: 0,
    destinyAdd: 0,
    destinyAdd2: 0,
    lore: "",
    canUse: "",
    canUse2: "",
    destiny: 0,
    image: extra.image,
    set: SET,
  };
}

function battle(id, name, extra = {}) {
  return {
    id,
    name,
    side: extra.side,
    dotColor: "yellow",
    type: "battle",
    powerAdd: 0,
    lore: "",
    canUse: "",
    condition: "",
    destiny: 0,
    destinyAdd: 0,
    image: extra.image,
    set: SET,
  };
}

function effect(id, name, extra = {}) {
  return {
    id,
    name,
    side: extra.side,
    dotColor: "yellow",
    type: "effect",
    cost: 0,
    powerAdd: 0,
    lore: "",
    canUse: "",
    effects: "",
    destiny: 0,
    image: extra.image,
    set: SET,
    gametext: "",
    gametextbonus: "",
  };
}

function starship(id, name, extra = {}) {
  return {
    id,
    name,
    side: extra.side,
    dotColor: "purple",
    type: "starship",
    trait: extra.trait || "starfighter",
    power: 0,
    destinyAdd: 0,
    lore: "",
    damage: 0,
    unique: extra.unique !== undefined ? extra.unique : false,
    destiny: 0,
    image: extra.image,
    set: SET,
    stackable: false,
    gametext: "",
    gametextbonus: "",
  };
}

/** Official set order 1–60. src = current unnumbered PNG stem. */
const LIST = [
  { n: 1, src: "obiwankenobi", id: "obiwankenobijedistudent", name: "Obi-Wan Kenobi Jedi Student", type: "character", side: "light", extra: { trait: "jedi", persona: "obiwan" } },
  { n: 2, src: "quigonjinnjedimentor", id: "quigonjinnjedimentor", name: "Qui-Gon Jinn Jedi Mentor", type: "character", side: "light", extra: { trait: "jedi", persona: "quigon" } },
  { n: 3, src: "anakinskywalker", id: "anakinskywalkerrookiepilot", name: "Anakin Skywalker Rookie Pilot", type: "character", side: "light", extra: { trait: "podracepilot", persona: "anakin" } },
  { n: 4, src: "captainpanaka", id: "captainquarshpanakasecuritycommander", name: "Captain Quarsh Panaka Security Commander", type: "character", side: "light", extra: { persona: "panaka" } },
  { n: 5, src: "macewindu", id: "macewindujedicouncilor", name: "Mace Windu Jedi Councilor", type: "character", side: "light", extra: { trait: "jedi", persona: "macewindu" } },
  { n: 6, src: "queenamidala", id: "queenamidalayoungleader", name: "Queen Amidala Young Leader", type: "character", side: "light", extra: { persona: "amidala" } },
  { n: 7, src: "yodajediphilosopher", id: "yodajediphilosopher", name: "Yoda Jedi Philosopher", type: "character", side: "light", extra: { trait: "jedi", persona: "yoda" } },
  { n: 8, src: "r2d2repairdroid", id: "r2d2repairdroid", name: "R2-D2 Repair Droid", type: "character", side: "light", extra: { trait: "droid", persona: "r2d2" } },
  { n: 9, src: "ricoliestarshippilot", id: "ricoliestarshippilot", name: "Ric Olié Starship Pilot", type: "character", side: "light", extra: { persona: "ricolie" } },
  { n: 10, src: "bravopilotflyer", id: "bravopilotflyer", name: "Bravo Pilot Flyer", type: "character", side: "light", extra: { uniqueness: false } },
  { n: 11, src: "valorum", id: "valorumleaderofthesenate", name: "Valorum Leader of the Senate", type: "character", side: "light", extra: { persona: "valorum" } },
  { n: 12, src: "quigonjinnslightsaber", id: "quigonjinnslightsaberwieldedbyobiwan", name: "Qui-Gon Jinn's Lightsaber Wielded by Obi-Wan Kenobi", type: "weapon", side: "light" },
  { n: 13, src: "booma", id: "booma", name: "Booma", type: "weapon", side: "light" },
  { n: 14, src: "apowerfulopponent", id: "apowerfulopponent", name: "A Powerful Opponent", type: "battle", side: "light" },
  { n: 15, src: "comeonmove", id: "comeonmove", name: "Come On, Move", type: "battle", side: "light" },
  { n: 16, src: "criticalconfrontation", id: "criticalconfrontation", name: "Critical Confrontation", type: "battle", side: "light" },
  { n: 17, src: "gunganmountedtroops", id: "gunganmountedtroops", name: "Gungan Mounted Troops", type: "battle", side: "light" },
  { n: 18, src: "naboofighterattack", id: "naboofighterattack", name: "Naboo Fighter Attack", type: "battle", side: "light" },
  { n: 19, src: "quigonnsfinalstand", id: "quigonsfinalstand", name: "Qui-Gon's Final Stand", type: "battle", side: "light" },
  { n: 20, src: "runtheblockade", id: "runtheblockade", name: "Run the Blockade", type: "battle", side: "light" },
  { n: 21, src: "twistoffate", id: "twistoffate", name: "Twist of Fate", type: "battle", side: "light" },
  { n: 22, src: "youarestrongwiththeforce", id: "youarestrongwiththeforce", name: "You Are Strong With The Force", type: "battle", side: "light" },
  { n: 23, src: "gunganenergyshield", id: "gunganenergyshield", name: "Gungan Energy Shield", type: "effect", side: "light" },
  { n: 24, src: "hecanseethings", id: "hecanseethingsbeforetheyhappen", name: "He Can See Things Before They Happen", type: "effect", side: "light" },
  { n: 25, src: "jedimeditation", id: "jedimeditation", name: "Jedi Meditation", type: "effect", side: "light" },
  { n: 26, src: "jeditraining", id: "jeditraining", name: "Jedi Training", type: "effect", side: "light" },
  { n: 27, src: "nabooroyalsecurityforces", id: "royalnaboosecurityforces", name: "Royal Naboo Security Forces", type: "effect", side: "light" },
  { n: 28, src: "poundeduntodeath", id: "poundeduntodeath", name: "Pounded Unto Death", type: "effect", side: "light" },
  { n: 29, src: "senateguard", id: "senateguard", name: "Senate Guard", type: "effect", side: "light" },
  { n: 30, src: "naboostarfighter", id: "naboostarfighterduel", name: "Naboo Starfighter", type: "starship", side: "light", extra: { unique: false } },
  { n: 31, src: "darthmaul", id: "darthmaulstudentofthedarkside", name: "Darth Maul Student of the Dark Side", type: "character", side: "dark", extra: { persona: "darthmaul" } },
  { n: 32, src: "darthsidious", id: "darthsidiousmasterofthedarkside", name: "Darth Sidious Master of the Dark Side", type: "character", side: "dark", extra: { persona: "darthsidious" } },
  { n: 33, src: "aurrasing", id: "aurrasingtrophycollector", name: "Aurra Sing Trophy Collector", type: "character", side: "dark", extra: { persona: "aurrasing" } },
  { n: 34, src: "teyhow", id: "teyhowneimoidiancommofficer", name: "Tey How Neimoidian Comm Officer", type: "character", side: "dark", extra: { trait: "neimoidian", persona: "teyhow" } },
  { n: 35, src: "owo1", id: "owo1battledroidcommandofficer", name: "OWO-1 Battle Droid Command Officer", type: "character", side: "dark", extra: { trait: "battledroid", persona: "owo1" } },
  { n: 36, src: "raynovaca", id: "raynovacataxidriver", name: "Rayno Vaca Taxi Driver", type: "character", side: "dark", extra: { persona: "raynovaca" } },
  { n: 37, src: "baskolyeesrim", id: "baskolyeesrimgransenator", name: "Baskol Yeesrim Gran Senator", type: "character", side: "dark", extra: { trait: "senator", persona: "baskolyeesrim" } },
  { n: 38, src: "starfighterdroiddfs327", id: "starfighterdroiddfs327", name: "Starfighter Droid DFS-327", type: "character", side: "dark", extra: { persona: "dfs327" } },
  { n: 39, src: "starfighterdroiddfs1104", id: "starfighterdroiddfs1104", name: "Starfighter Droid DFS-1104", type: "character", side: "dark", extra: { persona: "dfs1104" } },
  { n: 40, src: "starfighterdroiddfs1138", id: "starfighterdroiddfs1138", name: "Starfighter Droid DFS-1138", type: "character", side: "dark", extra: { persona: "dfs1138" } },
  { n: 41, src: "jedilightsaberstolen", id: "jedilightsaberstolenbyaurrasing", name: "Jedi Lightsaber Stolen By Aurra Sing", type: "weapon", side: "dark" },
  { n: 42, src: "coruscanttaxi", id: "coruscanttaxi", name: "Coruscant Taxi", type: "weapon", side: "dark" },
  { n: 43, src: "neimoideanviewscreen", id: "neimoidianviewscreen", name: "Neimoidian Viewscreen", type: "weapon", side: "dark" },
  { n: 44, src: "battledroidpatrol", id: "battledroidpatrol", name: "Battle Droid Patrol", type: "battle", side: "dark" },
  { n: 45, src: "changeintactics", id: "changeintactics", name: "Change In Tactics", type: "battle", side: "dark" },
  { n: 46, src: "dangerousencounter", id: "dangerousencounter", name: "Dangerous Encounter", type: "battle", side: "dark" },
  { n: 47, src: "darthmauldefiant", id: "darthmauldefiant", name: "Darth Maul Defiant", type: "battle", side: "dark" },
  { n: 48, src: "impossible", id: "impossible", name: "Impossible!", type: "battle", side: "dark" },
  { n: 49, src: "itsastandoff", id: "itsastandoff", name: "It's A Standoff!", type: "battle", side: "dark" },
  { n: 50, src: "mobileassassin", id: "mobileassassin", name: "Mobile Assassin", type: "battle", side: "dark" },
  { n: 51, src: "powerofthesith", id: "powerofthesith", name: "Power Of The Sith", type: "battle", side: "dark" },
  { n: 52, src: "starfighterscreen", id: "starfighterscreen", name: "Starfighter Screen", type: "battle", side: "dark" },
  { n: 53, src: "tothedeath", id: "tothedeath", name: "To The Death", type: "battle", side: "dark" },
  { n: 54, src: "usecaution", id: "usecaution", name: "Use Caution", type: "battle", side: "dark" },
  { n: 55, src: "blockade", id: "blockade", name: "Blockade", type: "effect", side: "dark" },
  { n: 56, src: "endthispointlessdebate", id: "endthispointlessdebate", name: "End This Pointless Debate", type: "effect", side: "dark" },
  { n: 57, src: "theduelbegins", id: "theduelbegins", name: "The Duel Begins", type: "effect", side: "dark" },
  { n: 58, src: "thejediareinvolved", id: "thejediareinvolved", name: "The Jedi Are Involved", type: "effect", side: "dark" },
  { n: 59, src: "wherearethosedroidekas", id: "wherearethosedroidekas", name: "Where Are Those Droidekas?", type: "effect", side: "dark" },
  { n: 60, src: "droidstarfighter", id: "droidstarfighterduel", name: "Droid Starfighter", type: "starship", side: "dark", extra: { unique: false } },
];

function numberedStem(entry) {
  return String(entry.n) + entry.id;
}

function buildCard(entry) {
  const image = numberedStem(entry) + ".gif";
  const extra = { ...(entry.extra || {}), side: entry.side, image };
  if (entry.type === "character") return character(entry.id, entry.name, extra);
  if (entry.type === "weapon") return weapon(entry.id, entry.name, extra);
  if (entry.type === "battle") return battle(entry.id, entry.name, extra);
  if (entry.type === "effect") return effect(entry.id, entry.name, extra);
  if (entry.type === "starship") return starship(entry.id, entry.name, extra);
  throw new Error("Unknown type " + entry.type);
}

function renamePngs() {
  for (const entry of LIST) {
    const dir = path.join(ROOT, "client", "assets", SET, entry.side);
    const destName = numberedStem(entry) + ".png";
    const dest = path.join(dir, destName);
    const candidates = [
      path.join(dir, entry.src + ".png"),
      dest,
      path.join(dir, String(entry.n) + entry.src + ".png"),
    ];
    const src = candidates.find((p) => fs.existsSync(p));
    if (!src) {
      console.warn("Missing PNG for #" + entry.n, entry.name, "expected", entry.src + ".png");
      continue;
    }
    if (src !== dest) {
      if (fs.existsSync(dest) && src !== dest) fs.unlinkSync(dest);
      fs.renameSync(src, dest);
      console.log("Renamed", path.basename(src), "->", destName);
    }
  }
}

renamePngs();
const cards = LIST.map(buildCard);
const out = path.join(ROOT, "server", "data", "cards", SET + ".json");
fs.writeFileSync(out, JSON.stringify({ cards }, null, 2) + "\n", "utf8");
console.log("Wrote", cards.length, "cards to", out);
