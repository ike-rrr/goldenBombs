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
3. Each round lasts a random 30–60 seconds and uses a newly generated map. Rooms with up to four players play on the original 15×11 board and start in its four inner corners; rooms with five or six players use a larger 19×15 board with the four corners plus the middle of the top and bottom edges. Spawn zones are shuffled each round and checked to be on open floor with at least two exits that are not indestructible walls.
4. Coins are scattered around the board and respawn every 2.5 seconds. Walking onto a coin scores one point. Rare cyan/violet gems are worth five coins each; they start on the map (one on the small board, two on the large one) and respawn only every 15 seconds, capped at two / three at a time.
5. Bombs detonate after 2.2 seconds. The base blast range is two tiles; red range pickups increase it up to five. Bombs destroy brick walls, chain-react with other bombs, and stop at stone borders and pillars.
6. Cyan speed pickups reduce the movement cooldown from 130 ms toward 70 ms over three levels. Active range and speed levels are shown by player auras, scoreboard badges, and the local HUD.
7. Pickups appear at the start of a round and respawn every 10 seconds, up to four on the small map and six on the large map.
8. A hit costs up to three coins and grants two seconds of invulnerability. While invulnerable you can still move, but you cannot collect coins or place bombs; dropped coins become collectable when the window ends (anyone may grab them).
9. The highest coin count wins. Tied players share victory. Results are shown for eight seconds before everyone returns to a new lobby.

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
npm test        # 35 server engine/room tests
npm run build   # production client build
```

## Notes

- No external image assets are required: all sprites and tile textures are generated procedurally from pixel matrices at runtime.
- Everything is held in server memory; restarting the server clears rooms and matches.
- Mobile touch controls appear on coarse-pointer devices.
