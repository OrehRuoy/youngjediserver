# Young Jedi CCG — Launcher

Small launcher that checks for updates, downloads `game_data.pck` from the URL in version.json, then runs the game.

## How it works

1. On start, the launcher requests **version.json** from your game server (localhost first, then remote).
2. It compares the server version with the one stored in `user://version.txt`.
3. If there is no local game data or the server version is newer, it downloads the PCK from the **url** in version.json.
4. It saves the PCK to `user://game_data.pck` and runs the game with `ProjectSettings.load_resource_pack()` then switches to the game’s main scene.

## Where to host the PCK (important)

**itch.io** does **not** officially provide a direct-download URL for the file. Their project link (e.g. `https://orehruoy.itch.io/young-jedi-ccg/download`) usually redirects to a **web page** where the user clicks “Download”, not to the raw file. So the launcher may receive HTML instead of the .pck and updates will fail.

**Recommended:** host the PCK on **your own server** (same one that serves version.json). The server already supports this:

1. Export the game as **game_data.pck** (see below).
2. Copy **game_data.pck** into **server/data/**.
3. In **server/data/version.json**, set **url** to your server’s URL, for example:
   - Remote: `"url": "https://youngjediserver.onrender.com/updates/game_data.pck"`
   - (For local testing the launcher uses localhost automatically.)

The server serves `GET /updates/game_data.pck` from `server/data/game_data.pck`. Use that URL in version.json and the launcher will download the file correctly.

You can still **distribute** the game on itch.io for manual downloads; the launcher’s auto-update should use your server URL.

## Setup

### 1. Version file on your server

Edit **server/data/version.json**:

```json
{
  "version": "1.0.0",
  "url": "http://tuuhpezgri.localto.net:5913/updates/game_data.pck"
}
```

- **version**: Any string (e.g. `"1.0.1"`). Bump it when you publish a new build.
- **url**: Direct URL to the PCK. Must match your HTTP server route: **`https://YOUR_HOST/updates/game_data.pck`** (not `/data/...` — that path is not served). The server adds **`pck_bytes`** automatically when serving `version.json`; the launcher re-downloads if your local `game_data.pck` file size does not match (even when `version` is unchanged).

### 2. Export the game as PCK only

In the **client** (game) project:

1. Open **Project → Export**.
2. Select your Windows (or Linux) preset.
3. Click **Export PCK/Zip** (not “Export Project”).
4. Save as **game_data.pck**.

### 3. Put the PCK on your server

Copy **game_data.pck** into **server/data/**. The server will serve it at `/updates/game_data.pck`. Ensure **version.json**’s **url** points to that (see above).

(Optional: also upload the same file to itch.io for manual downloads.)

### 4. Export the launcher

In this **launcher** project:

1. **Project → Export** → Add/use a Windows (or Linux) preset.
2. Click **Export Project** and build the launcher executable.
3. Give this executable to testers; they keep it. Future updates are just new `game_data.pck` on itch.io and an updated `version` in `version.json` on your server.

## Config (launcher)

In `scripts/launcher.gd`:

- **VERSION_URL_REMOTE**: Remote version.json. Default: `https://youngjediserver.onrender.com/updates/version.json`. Local dev still tries `http://127.0.0.1:49152/updates/version.json` first.
- **GAME_SCENE**: Scene to run after loading the pack (`res://scenes/login.tscn` for the current game).
- **PCK_PATH**: Where to store the downloaded pack (`user://game_data.pck`).

## Releasing an update

1. Export the **client** as **game_data.pck** (Export PCK/Zip).
2. Replace **server/data/game_data.pck** with the new file.
3. In **server/data/version.json**, bump **version** (e.g. to `"1.0.1"`).
4. Restart the server if you want (version.json is read on each request).

Testers open the launcher; it will download the new PCK from your server.

### Launcher still shows old card art?

- **`load_resource_pack(..., true)`** — the second argument is **`replace_files`**. **`false`** means Godot keeps files already on `res://` (from the launcher exe) and **ignores** the same paths in the PCK — so card images (and anything else) can stay stuck on old data. **`true`** (default) makes the downloaded PCK override overlaps.
- The launcher checks **localhost `version.json` first** unless **`YOUNG_JEDI_UPDATES_REMOTE_ONLY=1`**.
