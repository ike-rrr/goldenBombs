import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PLAYERS,
  MAX_ROUND_MS,
  MIN_ROUND_MS,
  SPAWN_TILES,
  TILE,
} from '../src/constants.js';
import {
  Game,
  assignSpawnTiles,
  generateMap,
  getLargestFloorComponent,
  isSafeSpawnTile,
  mulberry32,
  randomRoundDuration,
  validateSpawnTiles,
} from '../src/game.js';

function flatMap() {
  const grid = Array.from({ length: 11 }, (_, y) =>
    Array.from({ length: 15 }, (_, x) => {
      const isBorder = x === 0 || y === 0 || x === 14 || y === 10;
      return isBorder ? TILE.STONE : TILE.FLOOR;
    }),
  );
  return { grid, component: getLargestFloorComponent(grid) };
}

function makeGame({ durationMs = 60_000 } = {}) {
  const map = flatMap();
  const game = new Game({
    members: [
      { id: 'a', name: 'Alpha', colorIndex: 0 },
      { id: 'b', name: 'Bravo', colorIndex: 1 },
    ],
    rng: mulberry32(7),
    now: 0,
    mapData: map,
    durationMs,
  });

  // Keep tests deterministic and obstacle-free.
  game.grid = map.grid.map((row) => [...row]);
  game.coins = [];
  game.events = [];

  const alpha = game.players.get('a');
  const bravo = game.players.get('b');
  alpha.x = 3;
  alpha.y = 3;
  bravo.x = 8;
  bravo.y = 7;

  return { game, map };
}

test('map generation has indestructible border, pillars, and a connected floor area', () => {
  const map = generateMap(mulberry32(123));
  assert.equal(map.grid.length, 11);
  assert.equal(map.grid[0].length, 15);

  for (let x = 0; x < 15; x += 1) {
    assert.equal(map.grid[0][x], TILE.STONE);
    assert.equal(map.grid[10][x], TILE.STONE);
  }
  for (let y = 0; y < 11; y += 1) {
    assert.equal(map.grid[y][0], TILE.STONE);
    assert.equal(map.grid[y][14], TILE.STONE);
  }

  for (let y = 2; y < 10; y += 2) {
    for (let x = 2; x < 14; x += 2) {
      assert.equal(map.grid[y][x], TILE.STONE);
    }
  }

  assert.ok(map.component.length >= 48);
  assert.ok(map.grid.flat().includes(TILE.BRICK));

  const spawns = assignSpawnTiles(MAX_PLAYERS, mulberry32(123));
  assert.equal(spawns.length, MAX_PLAYERS);
  assert.equal(new Set(spawns.map((tile) => `${tile.x},${tile.y}`)).size, MAX_PLAYERS);
  for (const spawn of spawns) {
    assert.ok(SPAWN_TILES.some((tile) => tile.x === spawn.x && tile.y === spawn.y));
    assert.equal(map.grid[spawn.y][spawn.x], TILE.FLOOR);
    assert.ok(map.component.some((tile) => tile.x === spawn.x && tile.y === spawn.y));
    assert.ok(isSafeSpawnTile(map.grid, spawn.x, spawn.y));
  }
  assert.equal(validateSpawnTiles(map.grid).ok, true);
});

test('every generated map keeps all six spawn tiles open and untrapped', () => {
  for (let seed = 0; seed < 60; seed += 1) {
    const map = generateMap(mulberry32(seed));
    const check = validateSpawnTiles(map.grid);
    assert.equal(check.ok, true, `seed ${seed}: ${JSON.stringify(check.problems)}`);
  }
});

test('spawn validation rejects blocked and trapped tiles', () => {
  const grid = Array.from({ length: 11 }, () => Array(15).fill(TILE.FLOOR));
  const tile = { x: 3, y: 3 };

  assert.equal(validateSpawnTiles(grid, [tile]).ok, true);

  grid[tile.y][tile.x] = TILE.BRICK;
  let check = validateSpawnTiles(grid, [tile]);
  assert.equal(check.ok, false);
  assert.equal(check.problems[0].reason, 'blocked');

  grid[tile.y][tile.x] = TILE.FLOOR;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    grid[tile.y + dy][tile.x + dx] = TILE.STONE;
  }
  check = validateSpawnTiles(grid, [tile]);
  assert.equal(check.ok, false);
  assert.equal(check.problems[0].reason, 'trapped');

  // A single open neighbour is still a pocket and must be rejected too.
  grid[tile.y][tile.x - 1] = TILE.FLOOR;
  check = validateSpawnTiles(grid, [tile]);
  assert.equal(check.ok, false);
  assert.equal(check.problems[0].reason, 'trapped');
});

test('six players start on the six designated tiles, shuffled per round', () => {
  const members = Array.from({ length: MAX_PLAYERS }, (_, index) => ({
    id: `p${index}`,
    name: `Player ${index}`,
    colorIndex: index,
  }));
  const map = generateMap(mulberry32(81));
  const game = new Game({
    members,
    rng: mulberry32(81),
    now: 0,
    mapData: map,
    durationMs: 60_000,
  });

  const spawnKeys = [...game.players.values()].map((player) => `${player.x},${player.y}`);
  assert.equal(new Set(spawnKeys).size, MAX_PLAYERS);
  for (const tile of SPAWN_TILES) {
    assert.ok(spawnKeys.includes(`${tile.x},${tile.y}`));
  }
  for (const player of game.players.values()) {
    assert.equal(game.grid[player.y][player.x], TILE.FLOOR);
    assert.ok(isSafeSpawnTile(game.grid, player.x, player.y));
  }

  const orders = new Set();
  for (let seed = 1; seed <= 20; seed += 1) {
    orders.add(
      assignSpawnTiles(MAX_PLAYERS, mulberry32(seed))
        .map((tile) => `${tile.x},${tile.y}`)
        .join('|'),
    );
  }
  assert.ok(orders.size > 1);
});

test('round duration is always between 30 and 60 seconds', () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const duration = randomRoundDuration(mulberry32(seed));
    assert.ok(duration >= MIN_ROUND_MS);
    assert.ok(duration <= MAX_ROUND_MS);
  }
});

test('players drop three coins and cannot be hit again for one second', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.coins = 5;
  player.invulnerableUntil = 0;

  assert.equal(game.damagePlayer('a', 1_000), true);
  assert.equal(player.coins, 2);
  assert.equal(player.invulnerableUntil, 2_000);
  assert.equal(game.coins.length, 3);

  assert.equal(game.damagePlayer('a', 1_500), false);
  assert.equal(player.coins, 2);

  assert.equal(game.damagePlayer('a', 2_000), true);
  assert.equal(player.coins, 0);
  assert.equal(game.coins.length, 5);
});

test('a hit drops only the coins the player owns', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.coins = 2;
  player.invulnerableUntil = 0;

  game.damagePlayer('a', 1_000);
  assert.equal(player.coins, 0);
  assert.equal(game.coins.length, 2);
});

test('bombs stop at indestructible walls and destroy breakable walls', () => {
  const { game } = makeGame();
  const player = game.players.get('a');

  game.grid[3][4] = TILE.BRICK;
  game.grid[2][3] = TILE.STONE;
  player.x = 3;
  player.y = 3;

  assert.equal(game.placeBomb('a', 0), true);
  game.tick(2_200);

  assert.equal(game.bombs.length, 0);
  assert.equal(game.grid[3][4], TILE.FLOOR);
  assert.ok(game.destroyed.some((tile) => tile.x === 4 && tile.y === 3));
  assert.ok(!game.flames.some((flame) => flame.x === 4 && flame.y === 3));
  assert.ok(!game.flames.some((flame) => flame.x === 3 && flame.y === 2));
  assert.ok(!game.flames.some((flame) => flame.x === 3 && flame.y === 1));
  assert.ok(game.flames.some((flame) => flame.x === 3 && flame.y === 4));
});

test('explosions chain-trigger other bombs', () => {
  const { game } = makeGame();
  const alpha = game.players.get('a');
  const bravo = game.players.get('b');

  alpha.x = 3;
  alpha.y = 3;
  bravo.x = 5;
  bravo.y = 3;

  assert.equal(game.placeBomb('a', 0), true);
  assert.equal(game.placeBomb('b', 0), true);
  assert.equal(game.bombs.length, 2);

  game.tick(2_200);

  assert.equal(game.bombs.length, 0);
  assert.equal(alpha.bombsActive, 0);
  assert.equal(bravo.bombsActive, 0);
  assert.ok(game.flames.some((flame) => flame.x === 5 && flame.y === 3));
});

test('players may step off their bomb but cannot walk back onto it', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.x = 3;
  player.y = 3;
  player.lastMoveAt = Number.NEGATIVE_INFINITY;

  assert.equal(game.placeBomb('a', 0), true);
  assert.equal(game.move('a', 'right', 500), true);
  assert.equal(player.x, 4);
  assert.equal(game.move('a', 'left', 700), false);
  assert.equal(player.x, 4);
});

test('a player can only have one active bomb', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.x = 3;
  player.y = 3;

  assert.equal(game.placeBomb('a', 0), true);
  assert.equal(game.placeBomb('a', 10), false);
  assert.equal(game.bombs.length, 1);
});

test('walking onto a coin collects it', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.x = 3;
  player.y = 3;
  player.lastMoveAt = Number.NEGATIVE_INFINITY;
  game.coins.push({ id: 999, x: 4, y: 3, droppedBy: null });

  assert.equal(game.move('a', 'right', 500), true);
  assert.equal(player.coins, 1);
  assert.equal(game.coins.some((coin) => coin.id === 999), false);
});

test('winner calculation handles ties and ranking order', () => {
  const { game } = makeGame();
  game.players.get('a').coins = 4;
  game.players.get('b').coins = 4;

  let results = game.getResults();
  assert.equal(results.topCoins, 4);
  assert.equal(results.winnerIds.length, 2);
  assert.equal(results.ranking.length, 2);

  game.players.get('b').coins = 8;
  results = game.getResults();
  assert.deepEqual(results.winnerIds, ['b']);
  assert.equal(results.ranking[0].id, 'b');
});

test('disconnecting drops the player coins and removes their bombs', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.coins = 4;
  game.placeBomb('a', 0);

  game.removePlayer('a', 10);

  assert.equal(game.players.has('a'), false);
  assert.equal(game.bombs.length, 0);
  assert.equal(game.coins.length, 4);
});
