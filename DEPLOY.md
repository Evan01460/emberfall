# Put Emberfall online on a free host (Render) — about 5 minutes, no card

One server for everybody: anyone who opens your Render URL and picks **Online · Public world** is in the same persistent world.

1. **Put this project on GitHub.** Create a new (public or private) repository and upload the contents of this folder
   (on github.com: *Add file → Upload files*, drag everything in except `node_modules`).
2. On **render.com**: *New → Blueprint*, connect the repository. Render reads `render.yaml` and builds the `Dockerfile`
   (it generates a `VAULT_SECRET` for you). Wait for the deploy to turn green — you get a URL like `https://emberfall-xxxx.onrender.com`.
3. Share that URL. Done. `GET /health` shows how many players are online.

## What to expect on the free plan
* The server **sleeps after ~15 minutes with nobody online**; the first visitor waits ~30–60 s for it to wake. A free uptime pinger
  (e.g. UptimeRobot hitting `/health` every 5 minutes) keeps it awake.
* Its disk is **wiped whenever it restarts**, so the *world itself* (market prices, guilds, who holds a mythic class) starts fresh.
  **Characters are not lost:** every player's browser keeps a copy signed by your server's `VAULT_SECRET`, and logging in again
  restores it (passphrase-checked, impossible to forge or edit). Keep `VAULT_SECRET` the same across redeploys.
* For a world that never resets, use a plan with a persistent disk (set `DATA_DIR` to the mounted path) or Fly.io (`fly.toml` included).

## Other hosts
Anything that runs a Docker container and allows WebSockets works: Fly.io (`fly.toml`), Koyeb, Railway, a VPS, or your own PC
(`npm install && npm start`). Optional: `EMBERFALL_GLOBAL_WS=wss://your.host/ws npm run build` makes the downloadable
`emberfall.html` connect to your server whenever someone picks *Public world*.
