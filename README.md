# Name Place Animal Thing

An online game for 2–12 friends and family members, with separate shareable rooms, synchronized letters, timed answers, host review and a playful last-place reveal.

## Run locally

Install **Node.js 24 LTS** (npm is included), then open a terminal in this folder:

```sh
npm ci
npm run build:node
npm run start:node
```

Open **http://localhost:3000**. Create a room and share its code. To test on one computer, use two different browsers or separate browser profiles. A room link does not sign another person in as you. For people outside your network, deploy using HOSTING.md first.

The downloadable server is **React + Vite + Node.js + Express**. Room state uses SQLite built into Node, so you do not need a MongoDB account or a separate database server. React Bits ClickSpark provides click animations; the letter spinner uses CSS animation and a shared server clock.

## Your MP4 video and sound

| File | Exact location from project root | Format |
| --- | --- | --- |
| Last-place reaction | `public/memes/loser.mp4` | MP4 video, lowercase filename |
| Optional reaction sound | `public/audio/loser.mp3` | MP3 |

Use an MP4 encoded with H.264 video and AAC audio, around 480–800 pixels wide, ideally under 10 MB. The video plays its own audio, so a separate MP3 is not required. An optional short MP3 is used only if the video is missing or cannot play. Renaming a GIF to .mp4 does not convert it. Replace these files, rebuild with `npm run build:node`, and redeploy. No code change is needed. The repository deliberately does not include either media file: the game shows its built-in emoji/text meme and plays the optional MP3 or a synthesized sound when no playable MP4 is provided. Use files you have permission to share. All-player ties show a neutral caption; your custom video will still appear.

## Play

1. Choose your name, 1–26 rounds, and a custom writing time from 1 to 3,600 seconds per round (any whole number, such as 45, 75 or 150).
2. Create a room. It opens on `/room/ABC234`, separately from the home page.
3. Copy the invite link, or give friends the six-character room code.
4. With at least two connected players, the host starts.
5. The active player presses **Start alphabet**, then **Stop alphabet**. Turns rotate. Used letters cannot repeat.
6. Everyone writes a name, place, animal and thing starting with the selected letter. Answers save as you type. **Submit & stop everyone** becomes available when all four boxes are filled. The first complete submission received by the server immediately ends the round and locks answers for every player. Each other player’s last saved answers count, including partial answers. If nobody submits all four, the custom timer ends the round instead. Writing four answers does not guarantee four correct answers; scoring still happens during review.
7. Roman-letter answers of at least two letters with the correct first letter provisionally earn 10 points. Matching ignores upper/lowercase, accents and common Latin variants; spaces, apostrophes and hyphens are accepted. Indian, local and foreign names are all welcome without a dictionary list. Native-script answers (such as Hindi) start unchecked so the host can approve their starting sound manually. The host reviews the categories with the group and unchecks invalid words. There is no automatic dictionary/category validation. Identical answers still earn 10 points each. Empty/wrong-letter answers earn zero. Maximum 40 points per round.
8. The host confirms scores. At the end, the game announces the winner(s), displays the last-place meme (including ties), and offers a rematch.

## Reconnection and rules

- Refreshing the same browser tab restores your player session. Player credentials are stored per room in sessionStorage. Closing the tab or changing browser may lose this session; this is not an account-based game.
- Rooms expire 24 hours after creation and are cleaned up on subsequent activity.
- New players can join only in the lobby. Up to 12 players per room.
- If the host disappears for 45 seconds, another connected player becomes host.
- Letter selection automatically starts after 45 seconds and stops after 20 seconds to prevent an abandoned turn blocking everyone.
- Answers are hidden from other players until review. The server owns round timing, roles and scores.
- Connection delays can make the last displayed spinning frame differ briefly from the server-selected letter. Every player then receives the same authoritative final letter.
- The server closes the round on the first complete submission or the timer deadline, whichever comes first. Only answers successfully saved before closure count. Later saves and submissions are rejected, including simultaneous submissions that lose the server’s atomic update race. Other screens show the locked round on their next refresh (normally about one second). Offline edits cannot be recovered after time runs out. A save-status message warns when an answer did not save.
- The MP4 autoplays inline and muted, without native playback/seek controls. Tap **Tap for sound** to enable audio, or **Replay video** to restart it. If the device blocks autoplay entirely, use **Play video**. **Replay sound** is available for the fallback when the video is missing.
- On phones, round reviews use stacked player cards that fit the screen. Alphabet shuffling advances every 60 ms (three times faster).

## Project map

- `app/game.tsx` — shared React game interface.
- `app/globals.css` — responsive styling, visual theme and animations.
- `lib/game/engine.mjs` — platform-independent rules and scoring.
- `lib/game/service.mjs` — room actions with revision checks for concurrent updates.
- `server/index.mjs` — standalone Express API, SQLite persistence and static site hosting.
- `standalone/` and `vite.standalone.config.ts` — the downloadable React/Vite entry point.
- `components/react-bits/ClickSpark.jsx` — React Bits animation; license in `licenses/`.
- `app/api/game/route.ts`, `lib/game/d1-store.ts`, `db/`, `drizzle/` — Cloudflare/Sites hosted adapter. This uses D1 instead of local SQLite.
- `tests/` — rule tests plus a two-player HTTP integration test.
- `HOSTING.md` — public hosting instructions.

The hosted Sites version and downloadable Express version share the same UI and game engine. Sites publishing metadata is omitted from the download so it is not tied to someone else's deployment.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build:node` | Build the React client into `web-dist/` |
| `npm run start:node` | Run the Express server and built client |
| `npm test` | Run engine and HTTP tests; build client first |
| `npx tsc --noEmit` | Check TypeScript |
| `npm run build` | Build the Sites/Cloudflare adapter (not the Render build command) |

## Operational scope

The Node version supports multiple rooms on one server instance. Use persistent storage to survive restarts. Do not run it on several independent servers with separate local databases: their room state would diverge. For very large traffic, move the store to a shared database and add broader abuse controls and capacity testing. Updates use short polling (about once per second), with a locally animated synchronized alphabet; this is not a WebSocket implementation.

Verification covers the game rules, concurrent updates, authorization, hidden answers, round deadlines and two-player HTTP play. A browser automation session was not available during this build, so mobile visual layout and real-device audio should be checked with your chosen MP4 before a large launch.
