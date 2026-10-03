# Host the game publicly

The simplest setup for this downloadable project is one **Render Node web service** serving both the React frontend and the Express API. You do not need separate frontend and backend URLs.

## 1. Prepare your source

1. Extract the ZIP.
2. Optional: add your MP4 video at `public/memes/loser.mp4` (including its audio). Optional fallback sound goes at `public/audio/loser.mp3`.
3. Upload the extracted project contents to a GitHub repository, with `package.json` at the repository root. Keep `package-lock.json`. Do not upload `node_modules`, `data`, `web-dist`, private `.env` files or database files.
4. Sign in to [Render](https://render.com/), select **New → Web Service**, and connect that repository.

## 2. Configure the web service

| Setting | Value |
| --- | --- |
| Runtime / Language | Node |
| Build command | `npm ci --include=dev && npm run build:node` |
| Start command | `npm run start:node` |
| Health check path | `/health` |
| Node version | `24` (set `NODE_VERSION=24`) |
| `TRUST_PROXY` environment variable | `1` (Render's reverse proxy) |
| `DATA_DIR` environment variable | `/var/data` when using a persistent disk |
| `NODE_ENV` environment variable | `production` |

Render supplies `PORT`; leave it at Render's value. The server binds to `0.0.0.0` automatically. If you use a custom domain or another proxy, optionally set `PUBLIC_ORIGIN` to the exact public origin, e.g. `https://game.example.com`, without a trailing slash.

For rooms and scores to survive restarts, choose a plan supporting persistent disks, attach a disk mounted at **`/var/data`**, and use `DATA_DIR=/var/data`. A persistent disk is available on paid Render services. Without it, use `DATA_DIR=./data`; rooms will disappear on redeploy or restart. Check Render's current pricing before choosing a plan.

## 3. Deploy and play

1. Click **Create Web Service / Deploy** and wait for a successful deployment.
2. Open the assigned HTTPS `onrender.com` URL.
3. Create a room, then open its invite link in a second browser or another phone and join with a different name.
4. Play a complete test round. Confirm both devices receive the same letter, answers remain private while writing, scores update after review, and the end video/sound works.
5. Share the public URL with anyone. They can create their own rooms. Share a room link only with the people you want in that room.

Friends anywhere need the public URL, internet access and a browser. A `localhost` or private LAN address will not work for friends outside your network.

## Change your MP4 video later

Replace `public/memes/loser.mp4` in the repository and push the change. Render rebuilds from the linked branch. The MP4 plays its own audio; `public/audio/loser.mp3` is used only as a fallback when the video is missing or unsupported. Keep the filenames exactly as shown.

## Docker alternative

```sh
docker build -t npat-game .
docker run -d --name npat-game -p 3000:3000 -v npat-data:/app/data npat-game
```

Open `http://localhost:3000`. For a public VPS, put HTTPS in front of it using your domain and a reverse proxy. Set `PUBLIC_ORIGIN` to your HTTPS origin and `TRUST_PROXY` to the trusted proxy-hop count in that environment. The Docker volume preserves SQLite. Back up the volume with the service stopped or with SQLite's backup tools.

## Important hosting distinction

**GitHub Pages alone cannot run this game.** It hosts static frontend files but cannot run the Express API or shared room database. Use a server-capable web service. The shipped Docker/Express adapter is a single-instance deployment. Do not scale it across separate independent disks.

## Sources checked for this guide

- [Render: Deploy a Node Express App](https://render.com/docs/deploy-node-express-app)
- [Render: Persistent Disks](https://render.com/docs/disks)

Commands and environment variables above are specific to this project. Hosting plans, pricing and dashboard labels can change.
