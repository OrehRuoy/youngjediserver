# Deploy Young Jedi server (Render free)

The game server is a long-lived Node WebSocket process. Host it on [Render](https://render.com) so it does not run on your PC.

Free instances **sleep after ~15 minutes** with no inbound HTTP or WebSocket messages. The first player after a sleep waits about **one minute**. After that, anyone else in the same session connects immediately. Heartbeats keep it awake while someone is in the lobby or a game.

## 1. Put the repo on GitHub

Render deploys from GitHub. Push this project, then continue.

## 2. Create the web service

1. Sign up at [render.com](https://render.com) (GitHub login is fine).
2. **New → Web Service** → select this repo.
3. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** Free
   - **Health check path:** `/health`
4. Environment variables:

   | Key | Value |
   |-----|--------|
   | `HOST` | `0.0.0.0` |
   | `TRUST_PROXY` | `1` |
   | `MAX_CONNECTIONS_PER_IP` | `4` |
   | `MAX_CONNECTIONS` | `32` |

   Do **not** set `TLS_CERT_PATH` / `TLS_KEY_PATH`. Render provides HTTPS/WSS.

5. Deploy. Your URL will look like `https://young-jedi-server.onrender.com`.
   WebSocket: `wss://young-jedi-server.onrender.com` (same host, no port).

Health check: `https://YOUR-APP.onrender.com/health` should return `{"ok":true,...}`. The first request after sleep can take about a minute.

Render’s health checks may keep the free instance awake (no wait for players). Free plans include **750 hours/month** — about one month of 24/7. If Render pauses the service at the end of a 31-day month, it returns on the 1st.

Optional: if you connected the repo, `render.yaml` at the project root can create this service from a Blueprint instead of clicking through the UI.

## 3. Point the game at Render

Until this step, clients still use the old Localtonet tunnel. After you have the `*.onrender.com` URL, replace it in:

- `client/scripts/connection.gd` — `SERVER_REMOTE`
- `client/scripts/network_client.gd` — `DEFAULT_URL`
- `launcher/scripts/connection.gd` — `SERVER_REMOTE`
- `launcher/scripts/network_client.gd` — `DEFAULT_URL`
- `launcher/scripts/launcher.gd` — `VERSION_URL_REMOTE` (`https://YOUR-APP.onrender.com/updates/version.json`)
- `server/data/version.json` — `url` (`https://YOUR-APP.onrender.com/updates/game_data.pck`)
- `client/WEB_ITCH.md`

Use **`wss://`** for WebSockets and **`https://`** for version/PCK. Then re-export the Godot web build for itch.

Local debug builds still use `ws://127.0.0.1:49152`.

## Docker (optional, Fly later)

`server/Dockerfile` is for moving the same app to Fly.io or another container host. Render should use the **Node** runtime above, not Docker.
