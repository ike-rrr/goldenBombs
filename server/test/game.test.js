import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BLAST_RANGE,
  BLAST_RANGE_MAX,
  COIN_KINDS,
  COIN_RESPAWN_MS,
  LARGE_SPAWN_TILES,
  MAP_SIZES,
  MAX_PLAYERS,
  MAX_ROUND_MS,
  MIN_ROUND_MS,
  MOVE_COOLDOWN_MIN_MS,
  MOVE_COOLDOWN_MS,
  POWERUP_MAX,
  POWERUP_MAX_LARGE,
  POWERUP_RESPAWN_MS,
  POWERUP_TYPES,
  SMALL_SPAWN_TILES,
  SPECIAL_COINS_MAX,
  SPECIAL_COINS_MAX_LARGE,
  SPECIAL_COINS_START,
  SPECIAL_COINS_START_LARGE,
  SPECIAL_COIN_RESPAWN_MS,
  SPECIAL_COIN_VALUE,
  SPEED_COOLDOWN_STEP_MS,
  SPEED_LEVEL_MAX,
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

function flatMap(size = MAP_SIZES.small) {
  const grid = Array.from({ length: size.height }, (_, y) =>
    Array.from({ length: size.width }, (_, x) => {
      const isBorder =
        x === 0 || y === 0 || x === size.width - 1 || y === size.height - 1;
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
  game.powerups = [];
  game.destroyed = [];
  game.events = [];

  const alpha = game.players.get('a');
  const bravo = game.players.get('b');
  alpha.x = 3;
  alpha.y = 3;
  bravo.x = 8;
  bravo.y = 7;

  return { game, map };
}

function membersFor(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Player ${index}`,
    colorIndex: index,
  }));
}

function tileKeys(tiles) {
  return new Set(tiles.map((tile) => `${tile.x},${tile.y}`));
}

test('small map generation has border, pillars, connected floor, and four corners', () => {
  const map = generateMap(mulberry32(123));
  assert.equal(map.grid.length, MAP_SIZES.small.height);
  assert.equal(map.grid[0].length, MAP_SIZES.small.width);

  for (let x = 0; x < MAP_SIZES.small.width; x += 1) {
    assert.equal(map.grid[0][x], TILE.STONE);
    assert.equal(map.grid[MAP_SIZES.small.height - 1][x], TILE.STONE);
  }
  for (let y = 0; y < MAP_SIZES.small.height; y += 1) {
    assert.equal(map.grid[y][0], TILE.STONE);
    assert.equal(map.grid[y][MAP_SIZES.small.width - 1], TILE.STONE);
  }

  for (let y = 2; y < MAP_SIZES.small.height - 1; y += 2) {
    for (let x = 2; x < MAP_SIZES.small.width - 1; x += 2) {
      assert.equal(map.grid[y][x], TILE.STONE);
    }
  }

  assert.ok(map.component.length >= 48);
  assert.ok(map.grid.flat().includes(TILE.BRICK));

  const spawns = assignSpawnTiles(4, mulberry32(123));
  assert.equal(spawns.length, 4);
  assert.deepEqual(tileKeys(spawns), tileKeys(SMALL_SPAWN_TILES));
  for (const spawn of spawns) {
    assert.equal(map.grid[spawn.y][spawn.x], TILE.FLOOR);
    assert.ok(map.component.some((tile) => tile.x === spawn.x && tile.y === spawn.y));
    assert.ok(isSafeSpawnTile(map.grid, spawn.x, spawn.y));
  }
  assert.equal(validateSpawnTiles(map.grid, spawns).ok, true);
});

test('large map generation is 19x15 and includes corners plus middle spawns', () => {
  const map = generateMap(mulberry32(456), { playerCount: MAX_PLAYERS });
  assert.equal(map.grid.length, MAP_SIZES.large.height);
  assert.equal(map.grid[0].length, MAP_SIZES.large.width);

  for (let x = 0; x < MAP_SIZES.large.width; x += 1) {
    assert.equal(map.grid[0][x], TILE.STONE);
    assert.equal(map.grid[MAP_SIZES.large.height - 1][x], TILE.STONE);
  }
  for (let y = 0; y < MAP_SIZES.large.height; y += 1) {
    assert.equal(map.grid[y][0], TILE.STONE);
    assert.equal(map.grid[y][MAP_SIZES.large.width - 1], TILE.STONE);
  }

  for (let y = 2; y < MAP_SIZES.large.height - 1; y += 2) {
    for (let x = 2; x < MAP_SIZES.large.width - 1; x += 2) {
      assert.equal(map.grid[y][x], TILE.STONE);
    }
  }

  assert.ok(map.component.length >= 90);
  const spawns = assignSpawnTiles(MAX_PLAYERS, mulberry32(456));
  assert.equal(spawns.length, MAX_PLAYERS);
  assert.deepEqual(tileKeys(spawns), tileKeys(LARGE_SPAWN_TILES));
  assert.equal(validateSpawnTiles(map.grid, spawns).ok, true);
  for (const spawn of spawns) {
    assert.equal(map.grid[spawn.y][spawn.x], TILE.FLOOR);
    assert.ok(map.component.some((tile) => tile.x === spawn.x && tile.y === spawn.y));
  }
});

test('every generated map keeps its spawn tiles open and untrapped', () => {
  for (let seed = 0; seed < 60; seed += 1) {
    const small = generateMap(mulberry32(seed), { playerCount: 4 });
    const smallCheck = validateSpawnTiles(small.grid, SMALL_SPAWN_TILES);
    assert.equal(
      smallCheck.ok,
      true,
      `small seed ${seed}: ${JSON.stringify(smallCheck.problems)}`,
    );

    const large = generateMap(mulberry32(seed + 1_000), { playerCount: MAX_PLAYERS });
    const largeCheck = validateSpawnTiles(large.grid, LARGE_SPAWN_TILES);
    assert.equal(
      largeCheck.ok,
      true,
      `large seed ${seed}: ${JSON.stringify(largeCheck.problems)}`,
    );
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

test('four-player rooms use the 15x11 map and all four corner spawns', () => {
  const game = new Game({
    members: membersFor(4),
    rng: mulberry32(81),
    now: 0,
    durationMs: 60_000,
  });

  assert.equal(game.width, MAP_SIZES.small.width);
  assert.equal(game.height, MAP_SIZES.small.height);
  assert.deepEqual(tileKeys(game.spawns), tileKeys(SMALL_SPAWN_TILES));

  const payload = game.getStartPayload(0);
  assert.equal(payload.width, MAP_SIZES.small.width);
  assert.equal(payload.height, MAP_SIZES.small.height);
  assert.equal(payload.map.length, MAP_SIZES.small.height);
});

test('six players start on the large map using corners and middle spawns', () => {
  const game = new Game({
    members: membersFor(MAX_PLAYERS),
    rng: mulberry32(81),
    now: 0,
    durationMs: 60_000,
  });

  assert.equal(game.width, MAP_SIZES.large.width);
  assert.equal(game.height, MAP_SIZES.large.height);

  const spawnKeys = [...game.players.values()].map((player) => `${player.x},${player.y}`);
  assert.equal(new Set(spawnKeys).size, MAX_PLAYERS);
  assert.deepEqual(new Set(spawnKeys), tileKeys(LARGE_SPAWN_TILES));
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

test('five players also get the large map but only occupy five spawns', () => {
  const game = new Game({
    members: membersFor(5),
    rng: mulberry32(55),
    now: 0,
    durationMs: 60_000,
  });

  assert.equal(game.width, MAP_SIZES.large.width);
  assert.equal(game.height, MAP_SIZES.large.height);
  assert.equal(game.spawns.length, 5);
  assert.equal(tileKeys(game.spawns).size, 5);
  for (const spawn of game.spawns) {
    assert.ok(LARGE_SPAWN_TILES.some((tile) => tile.x === spawn.x && tile.y === spawn.y));
  }
});

test('round duration is always between 30 and 60 seconds', () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const duration = randomRoundDuration(mulberry32(seed));
    assert.ok(duration >= MIN_ROUND_MS);
    assert.ok(duration <= MAX_ROUND_MS);
  }
});

test('red range power-ups raise bomb range up to five', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  assert.equal(player.range, BLAST_RANGE);

  for (let index = 0; index < 4; index += 1) {
    game.powerups.push({
      id: 100 + index,
      type: POWERUP_TYPES.RANGE,
      x: player.x,
      y: player.y,
    });
    game.pickupPowerups(player);
  }

  assert.equal(player.range, BLAST_RANGE_MAX);
  assert.equal(player.rangeLevel, BLAST_RANGE_MAX - BLAST_RANGE);
  assert.equal(game.powerups.length, 0);
  assert.equal(game.placeBomb('a', 0), true);
  assert.equal(game.bombs[0].range, BLAST_RANGE_MAX);

  const pickups = game.drainEvents().filter((event) => event.type === 'powerup-pickup');
  assert.equal(pickups.length, 4);
  assert.equal(pickups[0].applied, true);
  assert.equal(pickups[3].applied, false);
});

test('speed power-ups reduce the move cooldown and allow faster movement', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.lastMoveAt = 0;

  assert.equal(game.move('a', 'right', 100), false);
  for (let index = 0; index < SPEED_LEVEL_MAX + 1; index += 1) {
    game.powerups.push({
      id: 200 + index,
      type: POWERUP_TYPES.SPEED,
      x: player.x,
      y: player.y,
    });
    game.pickupPowerups(player);
  }

  assert.equal(player.speedLevel, SPEED_LEVEL_MAX);
  assert.equal(game.moveCooldownFor(player), MOVE_COOLDOWN_MIN_MS);
  assert.equal(game.moveCooldownFor(player), MOVE_COOLDOWN_MS - SPEED_COOLDOWN_STEP_MS * SPEED_LEVEL_MAX);
  assert.equal(game.move('a', 'right', 100), true);
  assert.equal(player.x, 4);
  assert.equal(game.move('a', 'right', 150), false);
  assert.equal(game.move('a', 'right', 170), true);
});

test('walking onto a power-up collects it through the normal move path', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.lastMoveAt = Number.NEGATIVE_INFINITY;
  game.powerups.push({ id: 999, type: POWERUP_TYPES.RANGE, x: 4, y: 3 });

  assert.equal(game.move('a', 'right', 500), true);
  assert.equal(player.range, BLAST_RANGE + 1);
  assert.equal(game.powerups.some((powerup) => powerup.id === 999), false);
});

test('power-ups respawn on a timer without exceeding map-specific caps', () => {
  const { game } = makeGame();
  game.powerups = [];
  game.nextPowerupAt = 0;
  game.nextCoinAt = Number.POSITIVE_INFINITY;

  for (let tick = 1; tick <= 6; tick += 1) {
    game.tick(tick * POWERUP_RESPAWN_MS);
  }
  assert.equal(game.maxPowerups, POWERUP_MAX);
  assert.equal(game.powerups.length, POWERUP_MAX);
  assert.ok(game.powerups.every((powerup) => Object.values(POWERUP_TYPES).includes(powerup.type)));

  const large = new Game({
    members: membersFor(MAX_PLAYERS),
    rng: mulberry32(3),
    now: 0,
    durationMs: 60_000,
  });
  large.powerups = [];
  large.nextPowerupAt = 0;
  large.nextCoinAt = Number.POSITIVE_INFINITY;

  for (let tick = 1; tick <= 6; tick += 1) {
    large.tick(tick * POWERUP_RESPAWN_MS);
  }
  assert.equal(large.maxPowerups, POWERUP_MAX_LARGE);
  assert.equal(large.powerups.length, POWERUP_MAX_LARGE);
});

test('state exposes power-ups and buff indicators for the HUD', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.range = 4;
  player.rangeLevel = 2;
  player.speedLevel = 1;
  game.powerups = [{ id: 7, type: POWERUP_TYPES.RANGE, x: 5, y: 5 }];

  const state = game.getState(0);
  assert.deepEqual(state.powerups, game.powerups);
  const me = state.players.find((entry) => entry.id === 'a');
  assert.equal(me.range, 4);
  assert.equal(me.rangeLevel, 2);
  assert.equal(me.speedLevel, 1);
  assert.equal(me.moveCooldownMs, MOVE_COOLDOWN_MS - SPEED_COOLDOWN_STEP_MS);
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

test('special gems are worth five coins and emit a pickup indicator', () => {
  const { game } = makeGame();
  const player = game.players.get('a');
  player.x = 3;
  player.y = 3;
  player.lastMoveAt = Number.NEGATIVE_INFINITY;
  game.coins.push({
    id: 1000,
    kind: COIN_KINDS.SPECIAL,
    value: SPECIAL_COIN_VALUE,
    x: 4,
    y: 3,
    droppedBy: null,
  });

  assert.equal(game.move('a', 'right', 500), true);
  assert.equal(player.coins, SPECIAL_COIN_VALUE);
  assert.equal(game.coins.some((coin) => coin.id === 1000), false);

  const pickup = game.drainEvents().find((event) => event.type === 'coin-pickup');
  assert.equal(pickup.amount, SPECIAL_COIN_VALUE);
  assert.equal(pickup.coinCount, 1);
  assert.equal(pickup.special, 1);
});

test('rounds start with rare gems that do not overlap other items', () => {
  const game = new Game({
    members: membersFor(2),
    rng: mulberry32(7),
    now: 0,
    durationMs: 60_000,
  });

  const gems = game.coins.filter((coin) => coin.kind === COIN_KINDS.SPECIAL);
  assert.equal(gems.length, SPECIAL_COINS_START);
  assert.ok(gems.every((coin) => coin.value === SPECIAL_COIN_VALUE));

  const occupied = [
    ...game.spawns,
    ...game.powerups,
    ...game.coins,
  ].map((item) => `${item.x},${item.y}`);
  assert.equal(new Set(occupied).size, occupied.length);
});

test('special gems respawn more slowly than normal coins and respect caps', () => {
  const { game } = makeGame();
  game.coins = [];
  game.nextCoinAt = 0;
  game.nextSpecialCoinAt = SPECIAL_COIN_RESPAWN_MS;
  game.nextPowerupAt = Number.POSITIVE_INFINITY;

  const specialCount = () =>
    game.coins.filter((coin) => coin.kind === COIN_KINDS.SPECIAL).length;

  game.tick(COIN_RESPAWN_MS);
  assert.ok(game.coins.length > 0);
  assert.equal(specialCount(), 0);

  for (const now of [15_000, 30_000, 45_000, 60_000]) {
    game.tick(now);
  }
  assert.equal(game.maxSpecialCoins, SPECIAL_COINS_MAX);
  assert.equal(specialCount(), SPECIAL_COINS_MAX);

  const large = new Game({
    members: membersFor(MAX_PLAYERS),
    rng: mulberry32(3),
    now: 0,
    durationMs: 60_000,
  });
  large.coins = [];
  large.nextCoinAt = Number.POSITIVE_INFINITY;
  large.nextSpecialCoinAt = SPECIAL_COIN_RESPAWN_MS;
  large.nextPowerupAt = Number.POSITIVE_INFINITY;

  for (const now of [15_000, 30_000, 45_000, 60_000]) {
    large.tick(now);
  }
  const largeGems = large.coins.filter((coin) => coin.kind === COIN_KINDS.SPECIAL);
  assert.equal(large.maxSpecialCoins, SPECIAL_COINS_MAX_LARGE);
  assert.equal(largeGems.length, SPECIAL_COINS_MAX_LARGE);
});

test('state exposes special coin kind and value for rendering', () => {
  const { game } = makeGame();
  game.coins = [
    { id: 1, kind: COIN_KINDS.NORMAL, value: 1, x: 4, y: 4, droppedBy: null },
    {
      id: 2,
      kind: COIN_KINDS.SPECIAL,
      value: SPECIAL_COIN_VALUE,
      x: 6,
      y: 6,
      droppedBy: null,
    },
  ];

  const coins = game.getState(0).coins;
  assert.deepEqual(coins, game.coins);
  assert.equal(coins[0].kind, COIN_KINDS.NORMAL);
  assert.equal(coins[1].value, SPECIAL_COIN_VALUE);
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
