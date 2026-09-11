#!/usr/bin/env node
/**
 * Syncs card and deck data from server to client.
 * Run this whenever you update server/data/cards/ (index.json, set JSONs, or decks.json).
 *
 * Usage: node scripts/sync-cards.js
 *
 * - Copies server/data/cards/index.json -> client/data/cards/index.json
 * - Copies each set file server/data/cards/<set>.json -> client/data/cards/<set>.json
 *   (converts image .gif -> .png for client assets in set files)
 * - Copies server/data/cards/decks.json -> client/data/decks.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_CARDS_DIR = path.join(ROOT, 'server', 'data', 'cards');
const SERVER_INDEX = path.join(SERVER_CARDS_DIR, 'index.json');
const SERVER_DECKS = path.join(SERVER_CARDS_DIR, 'decks.json');
const CLIENT_CARDS_DIR = path.join(ROOT, 'client', 'data', 'cards');
const CLIENT_DECKS = path.join(ROOT, 'client', 'data', 'decks.json');

function syncCards() {
  if (!fs.existsSync(SERVER_INDEX)) {
    console.error('Server card index not found:', SERVER_INDEX);
    process.exit(1);
  }
  const indexData = JSON.parse(fs.readFileSync(SERVER_INDEX, 'utf8'));
  const sets = indexData.sets;
  if (!Array.isArray(sets) || sets.length === 0) {
    console.error('Server index.json has no "sets" array.');
    process.exit(1);
  }
  if (!fs.existsSync(CLIENT_CARDS_DIR)) {
    fs.mkdirSync(CLIENT_CARDS_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(CLIENT_CARDS_DIR, 'index.json'),
    JSON.stringify(indexData, null, 2),
    'utf8'
  );
  console.log('Synced index ->', path.join(CLIENT_CARDS_DIR, 'index.json'));
  let totalCards = 0;
  for (const setId of sets) {
    const setPath = path.join(SERVER_CARDS_DIR, setId + '.json');
    if (!fs.existsSync(setPath)) {
      console.warn('Set file not found:', setPath);
      continue;
    }
    const setData = JSON.parse(fs.readFileSync(setPath, 'utf8'));
    if (setData.cards && Array.isArray(setData.cards)) {
      for (const card of setData.cards) {
        if (card.image && card.image.endsWith('.gif')) {
          card.image = card.image.replace(/\.gif$/, '.png');
        }
        totalCards += 1;
      }
    }
    const clientSetPath = path.join(CLIENT_CARDS_DIR, setId + '.json');
    fs.writeFileSync(clientSetPath, JSON.stringify(setData, null, 2), 'utf8');
    console.log('Synced set', setId, '->', clientSetPath, '(', (setData.cards || []).length, 'cards)');
  }
  console.log('Total cards synced:', totalCards);
}

function syncDecks() {
  if (!fs.existsSync(SERVER_DECKS)) {
    console.error('Server decks not found:', SERVER_DECKS);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(SERVER_DECKS, 'utf8'));
  fs.writeFileSync(CLIENT_DECKS, JSON.stringify(data, null, 2), 'utf8');
  console.log('Synced decks:', data.decks?.length ?? 0, 'decks ->', CLIENT_DECKS);
}

syncCards();
syncDecks();
console.log('Done. Client data now matches server.');
