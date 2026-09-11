/**
 * Load card and deck definitions from JSON.
 * Loads card sets from data/cards/:
 *   - If index.json exists with { "sets": ["menaceofdarthmaul", ...] }, those sets are loaded in order.
 *   - Any other .json file in data/cards/ (except index.json and decks.json) is also loaded as a set (filename without .json = set id), so new card files are picked up without editing index.json.
 * Each set file <set>.json: { "cards": CardDefinition[] }.
 */

import * as fs from "fs";
import * as path from "path";
import type { CardDefinition, DeckDefinition, DeckCardEntry } from "./types";

const DATA_DIR = path.join(__dirname, "..", "..", "data", "cards");

const INDEX_FILE = "index.json";
const DECKS_FILE = "decks.json";

/** In-memory card registry by id (first occurrence wins when same id exists in multiple sets) */
const cardsById = new Map<string, CardDefinition>();
/** Cards keyed by "set:id" so location (and other) cards with same id in different sets (e.g. light vs dark) are both loaded */
const cardsBySetId = new Map<string, CardDefinition>();
/** All loaded cards (one entry per card per set) for getAllCards() */
const allCardsList: CardDefinition[] = [];

/** In-memory deck registry by id (starter decks only for now) */
const decksById = new Map<string, DeckDefinition>();

/**
 * Discover set ids from the data/cards directory: all .json files except index.json and decks.json.
 * Returns sorted list so load order is deterministic.
 */
function discoverSetFiles(): string[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const names = fs.readdirSync(DATA_DIR);
  const sets = names
    .filter((n) => n.endsWith(".json") && n !== INDEX_FILE && n !== DECKS_FILE)
    .map((n) => n.slice(0, -5));
  return sets.sort();
}

/**
 * Load one set file into cardsById, cardsBySetId, allCardsList.
 */
function loadSetFile(setId: string): void {
  const setPath = path.join(DATA_DIR, setId + ".json");
  if (!fs.existsSync(setPath)) return;
  const setRaw = fs.readFileSync(setPath, "utf-8");
  const setData = JSON.parse(setRaw) as { cards?: CardDefinition[] };
  if (!setData.cards) return;
  for (const c of setData.cards) {
    if (!c.id) continue;
    const setKey = (c.set || setId) + ":" + c.id;
    cardsBySetId.set(setKey, c);
    if (!cardsById.has(c.id)) cardsById.set(c.id, c);
    allCardsList.push(c);
  }
}

/**
 * Load cards: use index.json "sets" if present, then load any additional set files found in the directory.
 * This way new card files (e.g. newset.json) are loaded automatically without editing index.json.
 */
function loadCardsFromIndex(): void {
  cardsById.clear();
  cardsBySetId.clear();
  allCardsList.length = 0;

  const discovered = discoverSetFiles();
  let setsToLoad: string[];

  const indexPath = path.join(DATA_DIR, INDEX_FILE);
  if (fs.existsSync(indexPath)) {
    try {
      const raw = fs.readFileSync(indexPath, "utf-8");
      const indexData = JSON.parse(raw) as { sets?: string[] };
      const indexSets = Array.isArray(indexData.sets) ? indexData.sets : [];
      const extra = discovered.filter((s) => !indexSets.includes(s));
      setsToLoad = indexSets.length > 0 ? [...indexSets, ...extra] : discovered;
    } catch {
      setsToLoad = discovered;
    }
  } else {
    setsToLoad = discovered;
  }

  if (setsToLoad.length === 0) {
    console.warn("[cards] No set files found in data/cards/ (add <set>.json or index.json with \"sets\" array).");
    return;
  }

  for (const setId of setsToLoad) {
    loadSetFile(setId);
  }
  console.log("[cards] Loaded", allCardsList.length, "cards from", setsToLoad.length, "set(s):", setsToLoad.join(", "));
}

/**
 * Load decks from data/cards/decks.json.
 * Format: { decks: DeckDefinition[] }
 */
function loadDecksFromFile(): void {
  const decksPath = path.join(DATA_DIR, "decks.json");
  if (!fs.existsSync(decksPath)) {
    console.warn("[cards] No data/cards/decks.json found; no decks loaded.");
    return;
  }
  const raw = fs.readFileSync(decksPath, "utf-8");
  const data = JSON.parse(raw) as { decks?: DeckDefinition[] };
  if (data.decks) {
    for (const d of data.decks) {
      if (d.id) decksById.set(d.id, d);
    }
    console.log("[cards] Loaded", decksById.size, "decks from decks.json");
  }
}

/**
 * Load a single JSON file of cards (e.g. data/cards/starter_light.json).
 */
export function loadCardFile(filename: string): void {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  const arr = JSON.parse(raw) as CardDefinition[];
  if (!Array.isArray(arr)) return;
  for (const c of arr) {
    if (c.id) cardsById.set(c.id, c);
  }
}

/**
 * Initialize card system: load index and any additional files you want.
 */
export function initCards(): void {
  cardsById.clear();
  cardsBySetId.clear();
  allCardsList.length = 0;
  decksById.clear();
  loadCardsFromIndex();
  loadDecksFromFile();
}

/**
 * Get card definition by id. When set is provided, returns the card from that set (for locations etc. that share an id across sets, e.g. light vs dark).
 * When set is not provided, returns the first-loaded card with that id (backward compatible).
 */
export function getCard(id: string, set?: string): CardDefinition | undefined {
  if (set) {
    const fromSet = cardsBySetId.get(set + ":" + id);
    if (fromSet) return fromSet;
  }
  return cardsById.get(id);
}

export function getDeck(id: string): DeckDefinition | undefined {
  return decksById.get(id);
}

export function getAllCards(): CardDefinition[] {
  return [...allCardsList];
}

/** Return starter deck card list (id + set + count). Used by game engine to build decks. */
export function getStarterDeckCardList(deckId: string): DeckCardEntry[] {
  const deck = decksById.get(deckId);
  if (!deck) return [];
  return deck.cards.map(({ id, set, count }) => ({ id, set, count }));
}

/** Return all deck definitions for a given side (light/dark). */
export function getDecksForSide(side: "light" | "dark"): DeckDefinition[] {
  return Array.from(decksById.values()).filter((d) => d.side === side);
}
