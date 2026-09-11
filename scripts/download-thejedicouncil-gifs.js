#!/usr/bin/env node
/**
 * Download GIF card images from swccgpc/youngjedi repo:
 * https://github.com/swccgpc/youngjedi/tree/main/cards/thejedicouncil/light
 * https://github.com/swccgpc/youngjedi/tree/main/cards/thejedicouncil/dark
 *
 * Usage: node scripts/download-thejedicouncil-gifs.js [light|dark]
 * Default: light. Saves to client/assets/thejedicouncil/<light|dark>/
 * Run convert_gifs_to_png.py on that folder after, then delete the GIFs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const subfolder = (process.argv[2] || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
const OUT_DIR = path.join(ROOT, 'client', 'assets', 'thejedicouncil', subfolder);
const GITHUB_API = `https://api.github.com/repos/swccgpc/youngjedi/contents/cards/thejedicouncil/${subfolder}`;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'YoungJedi-Download' } }, (res) => {
      let data = '';
      res.on('data', (ch) => (data += ch));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`${url} => ${res.statusCode}: ${data}`));
          return;
        }
        resolve(data);
      });
    });
    req.on('error', reject);
  });
}

function downloadBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'YoungJedi-Download' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`${url} => ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (ch) => chunks.push(ch));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log('Created', OUT_DIR);
  }
  const json = await get(GITHUB_API);
  const entries = JSON.parse(json);
  const gifs = entries.filter((e) => e.type === 'file' && e.name.toLowerCase().endsWith('.gif'));
  console.log('Found', gifs.length, 'GIF files');
  for (const file of gifs) {
    const outPath = path.join(OUT_DIR, file.name);
    process.stdout.write('Downloading ' + file.name + '... ');
    try {
      const buf = await downloadBinary(file.download_url);
      fs.writeFileSync(outPath, buf);
      console.log('OK');
    } catch (e) {
      console.log('FAIL:', e.message);
    }
  }
  console.log('Done. Run: py client/scripts/convert_gifs_to_png.py client/assets/thejedicouncil/' + subfolder);
  console.log('Then delete the .gif files in client/assets/thejedicouncil/' + subfolder);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
