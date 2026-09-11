# Web export (itch.io)

1. **Export → Web**, then open the exported **`index.html`** in a text editor and confirm it contains **`youngJediWsStart`** (search the file). If missing, **Project → Export → Web → Head Include** was cleared — paste the script from `export_presets.cfg` or re-clone this repo’s preset.

2. Zip so **`index.html` is at the zip root**, upload to itch.

3. Try **Run game** in a **new browser tab** (not only the small embed).

4. Web client uses `wss://youngjediserver.onrender.com` (`connection.gd`).

5. Login waits two frames before connecting so the head script is ready; the client calls `window.youngJediWsStart` directly (no `eval`).
