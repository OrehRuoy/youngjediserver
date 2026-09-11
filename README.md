# Young Jedi TCG — Online Server-Authoritative Implementation

Multiplayer, server-authoritative implementation of the Young Jedi Trading Card Game.

- **Client:** Godot 4.x (example scripts + minimal UI)
- **Server:** Node.js + TypeScript, WebSocket

## Features

- **Name-based login** — No passwords; display name only (suitable for dev/LAN).
- **Lobby** — Player list and global lobby chat.
- **Tables** — Create table (choose Light or Dark), join existing table (pick empty side), leave.
- **Light vs Dark** — One player per side per table; enforced on join.
- **Ready system** — Both players must be ready; host clicks Start to begin the game.
- **Server-hosted games** — All game state and rules on the server; no P2P.
- **In-game chat** — Chat in lobby and at the table/game.
- **Turn-based engine** — Phases: draw → deploy → battle → end, with configurable phase timers.
- **First game** — Draw 1 in draw phase; deploy cards (character/weapon/location) in deploy phase; initiate battle in battle phase (power + destiny, loser loses 2 life); pass to advance phase. Win by reducing opponent life to 0.
- **Card system** — Cards loaded from JSON (`server/data/cards/`); starter decks only initially.
- **Clean separation** — Client only displays state and sends actions; server owns logic.

## Quick start

### Server

```bash
cd server
npm install
npm run build
npm start
```

- Listens on **port 49152** by default (override with `PORT=9090 npm start`).
- WebSocket: `ws://localhost:49152` (or your IP when hosting)
- Health: `http://localhost:49152/health`

### Client (Godot 4.x)

1. Open `client/` as a Godot 4.x project.
2. Run the main scene (`scenes/login.tscn`).
3. Enter your name, click Login.
4. Create a table (Light or Dark) or join an existing one (select table, then Join as Light/Dark).
5. Toggle Ready; when both are ready, host clicks Start Game.
6. When the game starts you enter the **game scene**: hand at bottom, your/opponent cards in play, Phase/Turn and Life. In **deploy** phase select a card and click "Play card"; in **battle** phase click "Initiate battle" (power + destiny, loser loses 2 life). Use "Pass phase" to advance. First to reduce opponent to 0 life wins.

## Project layout

```
YoungJedi/
├── server/                 # Node.js + TypeScript
│   ├── src/
│   │   ├── index.ts        # HTTP + WebSocket entry, message routing
│   │   ├── types.ts        # Client/server message types
│   │   ├── lobby/          # Lobby state, chat, table create/join/leave/ready
│   │   ├── table/          # (Table logic lives in lobby)
│   │   ├── game/           # Turn/phases, timers, state snapshots
│   │   └── cards/          # Load cards/decks from JSON
│   └── data/cards/         # Card and deck definitions (index.json)
├── client/                 # Godot 4.x example
│   ├── scripts/
│   │   ├── network_client.gd   # WebSocket, send/recv JSON
│   │   ├── game_state.gd       # Client view of lobby/table/game
│   │   └── main.gd             # UI wiring example
│   └── scenes/main.tscn
└── README.md
```

## Protocol (summary)

- All messages are **JSON** with a `type` field.
- **Client → Server:** `login`, `lobby_chat`, `table_create`, `table_join`, `table_leave`, `table_ready`, `table_start`, `game_chat`, `game_action`, `game_concede`.
- **Server → Client:** `login_result`, `lobby_snapshot`, `lobby_chat`, `table_update`, `game_started`, `game_state`, `game_hand`, `game_chat`, `game_ended`, `error`.

See `server/src/types.ts` for full payload shapes.

## Card data

- **Anatomy:** Cards have `id`, `name`, `side` (light/dark), `dotColor`, `type` (character, weapon, location, starship, battle), and type-specific stats (power, ability, destiny, text).
- **Decks:** Defined in `data/cards/index.json` under `decks`; each deck has `id`, `name`, `side`, and `cards: [{ id, count }]`.
- Starter decks: `starter_light`, `starter_dark`. The engine builds decks from these IDs only (expand later for deck validation).

## Assumptions

- Single server process; in-memory state (no DB).
- Name uniqueness per connection; reconnecting with same name is allowed (replaces previous connection).
- Phase timer: server advances phase after `phaseDurationMs` (default 90s) and broadcasts new `game_state`.
- Game actions are accepted in a placeholder form; full rules (play card, battle, etc.) can be added in `server/src/game/handlers.ts` and `engine.ts`.

## References

- [Young Jedi card anatomy](https://www.starwarsccg.org/anatomy-of-a-young-jedi-card/)
- [Playing your first Young Jedi game](https://www.starwarsccg.org/playing-your-first-young-jedi-game/)
