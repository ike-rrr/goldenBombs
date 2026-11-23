# Golden Bombs

A colorful, real-time multiplayer Bomberman-style coin rush. Create a room, share the five-character code, grab coins, dodge flames, and finish with the highest score.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:5173> in each browser/player window. The dev script starts both the Socket.IO game server (port 3001) and the Vite client (port 5173), with the socket connection proxied through Vite.

For a production-style run:

```bash
npm install
npm run build
npm start
```

Then open <http://localhost:3001>. The Express server serves the built client from `client/dist`.

Optional environment variables for the server:

- `PORT` — server port (default `3001`).
- `CLIENT_ORIGIN` — comma-separated allowed origins, or `*` (local origins are always allowed by default).

## Controls

- Move: `WASD` or arrow keys.
- Place bomb: `Space` or `E`.
- Touch devices: on-screen D-pad and BOMB button.

## How a match works

1. Create a room and copy its five-character code, or join with someone else's code.
2. The host can start immediately, or the match auto-starts after a 30-second lobby countdown. Solo play is allowed; rooms hold up to six players.
3. Each round lasts a random 30–60 seconds and uses a newly generated map. Players start on six fixed zones (four inner corners plus the middle of the top and bottom edges), shuffled each round. Every spawn is checked to be on open floor with at least two exits that are not indestructible walls.
4. Coins are scattered around the board and respawn over time. Walking onto a coin scores it.
5. Bombs detonate after 2.2 seconds with a blast range of two tiles. They destroy brick walls, chain-react with other bombs, and stop at stone borders and pillars.
6. A hit costs up to three coins and grants one second of invulnerability. Dropped coins can be collected by anyone.
7. The highest coin count wins. Tied players share victory. Results are shown for eight seconds before everyone returns to a new lobby.

## Project structure

```
client/
  src/main.js              Socket.IO orchestration, boot, game lifecycle
  src/ui.js                DOM screens, lobby, HUD, results, touch input
  src/style.css            pixel-art UI theme
  src/game/GameScene.js    Phaser rendering, interpolation, effects, input
  src/game/pixelArt.js     procedural 16x16 pixel textures and animations
  src/game/palette.js      player colors
  src/assets/fonts/        bundled Silkscreen pixel font (OFL)
  index.html               all screen markup
server/
  src/index.js             Express + Socket.IO server, static hosting, rate limits
  src/rooms.js             room codes, lobby countdown, host transfer, results
  src/game.js              authoritative match engine
  src/constants.js         gameplay tuning values
  test/                    Node test suite
```

The server owns all gameplay state (movement, bombs, flames, pickups, damage, timer, scoring) and broadcasts 20 Hz snapshots. The client interpolates sprites between snapshots and plays cosmetic effects from server events, so cheating clients cannot change the outcome.

## Testing

```bash
npm test        # 21 server engine/room tests
npm run build   # production client build
```

## Notes

- No external image assets are required: all sprites and tile textures are generated procedurally from pixel matrices at runtime.
- Everything is held in server memory; restarting the server clears rooms and matches.
- Mobile touch controls appear on coarse-pointer devices.
