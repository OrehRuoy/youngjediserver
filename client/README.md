# Young Jedi TCG — Godot 4.x Client (example)

Example networking and message handling for the Young Jedi server. Drop these into your Godot 4.x project and wire up your UI.

## Layout

- `network_client.gd` — WebSocket connection, send/parse JSON, message dispatch
- `game_state.gd` — Client-side view of lobby, table, and game (presentation state only)
- `main.gd` — Example scene script: login, lobby list, chat, table create/join, ready, start

## Server

Run the Node server from `server/` first:

```bash
cd server && npm install && npm run build && npm start
```

Default WebSocket URL: `ws://127.0.0.1:49152` (hardcoded in login.gd, main.gd, network_client.gd).

## Usage

1. Create a scene with a root node and attach `main.gd` (or use the script as reference).
2. Ensure you have UI nodes for: name input, login button, player list, table list, chat input/list, ready/start buttons.
3. Adjust node paths in `main.gd` to match your scene tree.
4. Connect to server, login by name, create or join a table (pick Light/Dark), set ready, start when both ready.

All game logic is server-authoritative; the client only displays state and sends actions.
