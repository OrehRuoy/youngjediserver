#!/usr/bin/env node
/**
 * Download GIF card images from swccgpc/youngjedi:
 * https://github.com/swccgpc/youngjedi/tree/main/cards/duelofthefates
 *
 * Usage: node scripts/download-duelofthefates-gifs.js [light|dark|all]
 * Default: all. Saves to client/assets/duelofthefates/<light|dark>/
 * Then: py client/scripts/convert_gifs_to_png.py client/assets/duelofthefates/light
 *       py client/scripts/convert_gifs_to_png.py client/assets/duelofthefates/dark
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const SET = "duelofthefates";
const arg = (process.argv[2] || "all").toLowerCase();
const SIDES = arg === "all" ? ["light", "dark"] : [arg === "dark" ? "dark" : "light"];

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "YoungJedi-Download" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", (ch) => chunks.push(ch));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          reject(new Error(`${url} => ${res.statusCode}: ${buf.toString("utf8").slice(0, 200)}`));
          return;
        }
        resolve(buf);
      });
    });
    req.on("error", reject);
  });
}

async function listGifs(side) {
  const api = `https://api.github.com/repos/swccgpc/youngjedi/contents/cards/${SET}/${side}`;
  const buf = await get(api);
  const entries = JSON.parse(buf.toString("utf8"));
  return entries.filter((e) => e.type === "file" && e.name.toLowerCase().endsWith(".gif"));
}

async function downloadSide(side) {
  const outDir = path.join(ROOT, "client", "assets", SET, side);
  fs.mkdirSync(outDir, { recursive: true });
  const gifs = await listGifs(side);
  console.log(side + ":", gifs.length, "GIF files");
  for (const file of gifs) {
    const outPath = path.join(outDir, file.name);
    process.stdout.write("  " + file.name + "... ");
    try {
      const buf = await get(file.download_url);
      fs.writeFileSync(outPath, buf);
      console.log("OK");
    } catch (e) {
      console.log("FAIL:", e.message);
    }
  }
}

async function main() {
  for (const side of SIDES) {
    await downloadSide(side);
  }
  console.log("Done. Convert with:");
  for (const side of SIDES) {
    console.log("  py client/scripts/convert_gifs_to_png.py client/assets/" + SET + "/" + side);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
