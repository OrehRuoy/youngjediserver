# Young Jedi TCG — Server

Server-authoritative Node.js (TypeScript) backend: WebSocket lobby, tables, and game engine.

## Folder structure

```
server/
├── src/
│   ├── index.ts              # Entry: HTTP + WebSocket server
│   ├── types.ts              # Shared message & game types
│   ├── lobby/
│   │   ├── lobby.ts          # Lobby state, player list, chat
│   │   └── handlers.ts       # Lobby message handlers
│   ├── table/
│   │   ├── table.ts          # Table state, seats, ready, sides
│   │   └── handlers.ts       # Table create/join/ready handlers
│   ├── game/
│   │   ├── engine.ts         # Turn/phases, timers, state transitions
│   │   ├── state.ts          # Game state types and helpers
│   │   └── handlers.ts       # In-game message handlers
│   └── cards/
│       ├── loader.ts         # Load cards from JSON
│       └── types.ts          # Card definition types
├── data/
│   └── cards/                # JSON card definitions
│       ├── index.json        # Card catalog
│       └── *.json            # Per-card or per-set files
├── package.json
├── tsconfig.json
└── README.md
```

## Assumptions

- **Name-based login**: No passwords; display name only. Suitable for dev / trusted LAN.
- **Sides**: Light Side vs Dark Side; one player per side per table; enforced on join.
- **Starter decks**: Decks are defined by deck IDs in JSON; only starter deck IDs allowed initially.
- **Turn timers**: Configurable per phase; server ticks and notifies when time runs out (turn passes or action forced).
- **Card JSON**: One file per set or one catalog; each card has `id`, `side`, `type`, and type-specific stats.

## Setup (first time)

**Requires Node.js 18+** — [Download](https://nodejs.org) if needed.

From the `server` folder:

- **PowerShell:** `.\setup.ps1`
- **Command Prompt:** `setup.cmd`
- **Or manually:** `npm install` then `npm run build`

## Run

**Easiest:** Double-click **`Start Server.bat`** (Windows). It builds the server and starts it; the window stays open. Stop with Ctrl+C.

**Or from a terminal:**
```bash
npm run serve   # builds then starts (use this to always run latest code)
npm start       # starts only (requires prior npm run build)
```

Listens on **127.0.0.1:49152** by default. If `PORT` is set (Render/Fly), binds **0.0.0.0** unless `HOST` is set. Dev with auto-run: `npm run dev`. Off-PC hosting: see **DEPLOY.md**.

**Security:**
- Max 4 connections per external IP by default (`MAX_CONNECTIONS_PER_IP`); localhost unlimited
- Global cap: 32 connections (`MAX_CONNECTIONS`)
- Idle timeout: 5 minutes (heartbeats and WebSocket pings refresh this)
- Login throttle: 5 attempts per 15 minutes per IP
- Cloud: set `HOST=0.0.0.0`, `TRUST_PROXY=1` (see `DEPLOY.md` for Render)

## Protocol

All messages are JSON. Client sends `{ type: string, ...payload }`. Server sends `{ type: string, ...payload }` (and may include `error`, `tableId`, `gameId`, etc.). See `src/types.ts` for message types.
