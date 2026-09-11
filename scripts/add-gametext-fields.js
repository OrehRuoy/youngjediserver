#!/usr/bin/env node
/**
 * Add "gametext": "" and "gametextbonus": "" to every card in set JSON files that don't have them.
 * Run from project root: node scripts/add-gametext-fields.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  path.join(ROOT, "server", "data", "cards", "thejedicouncil.json"),
  path.join(ROOT, "server", "data", "cards", "menaceofdarthmaul.json"),
  path.join(ROOT, "client", "data", "cards", "thejedicouncil.json"),
  path.join(ROOT, "client", "data", "cards", "menaceofdarthmaul.json"),
];

for (const filePath of FILES) {
  if (!fs.existsSync(filePath)) {
    console.warn("Skip (not found):", filePath);
    continue;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.cards)) {
    console.warn("Skip (no cards array):", filePath);
    continue;
  }
  let updated = 0;
  for (const card of data.cards) {
    if (card.gametext === undefined) {
      card.gametext = "";
      updated++;
    }
    if (card.gametextbonus === undefined) {
      card.gametextbonus = "";
      updated++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(filePath, "->", updated, "fields added across", data.cards.length, "cards");
}
console.log("Done.");
