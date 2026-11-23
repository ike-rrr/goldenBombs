import {
  BLAST_MS,
  BLAST_RANGE,
  BOMB_FUSE_MS,
  COINS_DROPPED_ON_HIT,
  COINS_MAX,
  COINS_START,
  COIN_RESPAWN_MS,
  DIRECTIONS,
  INVULNERABILITY_MS,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_ACTIVE_BOMBS,
  MAX_ROUND_MS,
  MIN_ROUND_MS,
  MOVE_COOLDOWN_MS,
  SPAWN_ESCAPE_TILES,
  SPAWN_TILES,
  TILE,
} from './constants.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function chooseRandom(items, rng) {
  return items[Math.floor(rng() * items.length)];
}

// A spawn is safe when it stands on open floor and has at least two neighbours
// that are not indestructible stone. Bricks count as an escape route because a
// player can always bomb through them; requiring two exits prevents spawning
// inside a one-tile pocket squeezed by unbreakable walls.
export function isSafeSpawnTile(grid, x, y) {
  if (grid[y]?.[x] !== TILE.FLOOR) return false;

  const neighbours = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];

  const openNeighbours = neighbours.filter((tile) => {
    if (tile.x < 0 || tile.y < 0 || tile.x >= MAP_WIDTH || tile.y >= MAP_HEIGHT) {
      return false;
    }
    return grid[tile.y][tile.x] !== TILE.STONE;
  });

  return openNeighbours.length >= 2;
}

export function validateSpawnTiles(grid, tiles = SPAWN_TILES) {
  const problems = [];

  for (const tile of tiles) {
    if (grid[tile.y]?.[tile.x] !== TILE.FLOOR) {
      problems.push({ ...tile, reason: 'blocked' });
    } else if (!isSafeSpawnTile(grid, tile.x, tile.y)) {
      problems.push({ ...tile, reason: 'trapped' });
    }
  }

  return { ok: problems.length === 0, problems };
}

// The location set is fixed (corners + top/bottom middle), but which player
// gets which location is shuffled so spawns still vary from round to round.
export function assignSpawnTiles(count, rng = Math.random) {
  const shuffled = shuffle(SPAWN_TILES, rng);
  return shuffled
    .slice(0, Math.max(0, Math.min(count, shuffled.length)))
    .map((tile) => ({ ...tile }));
}

export function getLargestFloorComponent(grid) {
  const seen = new Set();
  let best = [];

  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      if (grid[y][x] !== TILE.FLOOR) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;

      const queue = [{ x, y }];
      const component = [];
      seen.add(key);

      while (queue.length > 0) {
        const current = queue.pop();
        component.push(current);

        for (const { dx, dy } of Object.values(DIRECTIONS)) {
          const nx = current.x + dx;
          const ny = current.y + dy;

          if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
          if (grid[ny][nx] !== TILE.FLOOR) continue;

          const neighbourKey = `${nx},${ny}`;
          if (seen.has(neighbourKey)) continue;

          seen.add(neighbourKey);
          queue.push({ x: nx, y: ny });
        }
      }

      if (component.length > best.length) best = component;
    }
  }

  return best;
}

export function generateMap(rng = Math.random) {
  let best = null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const grid = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => TILE.FLOOR),
    );

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const isBorder =
          x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
        const isPillar = x % 2 === 0 && y % 2 === 0;

        if (isBorder || isPillar) {
          grid[y][x] = TILE.STONE;
        } else if (rng() < 0.32) {
          grid[y][x] = TILE.BRICK;
        }
      }
    }

    // Spawn zones and their escape tiles are always open floor. This keeps the
    // six starting positions predictable for players while the rest of the
    // layout (bricks, coins, route network) stays random.
    for (const tile of [...SPAWN_TILES, ...SPAWN_ESCAPE_TILES]) {
      grid[tile.y][tile.x] = TILE.FLOOR;
    }

    // Carve two horizontal lanes and a centre lane so every spawn zone belongs
    // to the same walkable network. These tiles are never pillars, so clearing
    // them cannot create an island or open the indestructible border.
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      grid[1][x] = TILE.FLOOR;
      grid[MAP_HEIGHT - 2][x] = TILE.FLOOR;
    }
    for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
      grid[y][(MAP_WIDTH - 1) / 2] = TILE.FLOOR;
    }

    if (!validateSpawnTiles(grid).ok) continue;

    const component = getLargestFloorComponent(grid);
    const spawnsConnected = SPAWN_TILES.every((tile) =>
      component.some((entry) => entry.x === tile.x && entry.y === tile.y),
    );
    if (!spawnsConnected) continue;

    if (!best || component.length > best.component.length) {
      best = { grid, component };
    }

    if (component.length >= 48) break;
  }

  return best;
}

export function randomRoundDuration(rng = Math.random) {
  const span = MAX_ROUND_MS - MIN_ROUND_MS + 1;
  return MIN_ROUND_MS + Math.min(span - 1, Math.floor(rng() * span));
}

export class Game {
  constructor({ members, rng = Math.random, now = Date.now(), mapData = null, durationMs = null }) {
    this.rng = rng;
    this.startedAt = now;
    this.finished = false;
    this.bombSeq = 0;
    this.coinSeq = 0;
    this.events = [];

    this.players = new Map();
    for (const member of members) {
      this.players.set(member.id, {
        id: member.id,
        name: member.name,
        colorIndex: member.colorIndex,
        x: 0,
        y: 0,
        coins: 0,
        dir: 'down',
        lastMoveAt: Number.NEGATIVE_INFINITY,
        invulnerableUntil: 0,
        bombsActive: 0,
      });
    }

    const generated = mapData ?? generateMap(rng);
    this.grid = generated.grid.map((row) => [...row]);
    const component = generated.component ?? getLargestFloorComponent(this.grid);

    const spawns = assignSpawnTiles(this.players.size, rng);
    if (spawns.length < this.players.size) {
      throw new Error('The generated map does not have enough spawn tiles.');
    }

    const spawnCheck = validateSpawnTiles(this.grid, spawns);
    if (!spawnCheck.ok) {
      throw new Error('A spawn tile is blocked or trapped by indestructible walls.');
    }

    let spawnIndex = 0;
    for (const player of this.players.values()) {
      player.x = spawns[spawnIndex].x;
      player.y = spawns[spawnIndex].y;
      spawnIndex += 1;
    }

    this.spawns = spawns.map((tile) => ({ ...tile }));
    this.durationMs = durationMs ?? randomRoundDuration(rng);
    this.endsAt = now + this.durationMs;
    this.nextCoinAt = now + COIN_RESPAWN_MS;

    this.bombs = [];
    this.flames = [];
    this.coins = [];
    this.destroyed = [];

    this.spawnStartingCoins(component);

    this.events.push({
      type: 'round-start',
      durationMs: this.durationMs,
    });
  }

  spawnStartingCoins(component) {
    const taken = new Set(this.spawns.map((tile) => `${tile.x},${tile.y}`));
    const candidates = shuffle(
      component.filter((tile) => !taken.has(`${tile.x},${tile.y}`)),
      this.rng,
    );

    const count = Math.min(COINS_START, candidates.length);
    for (let i = 0; i < count; i += 1) {
      this.coins.push({
        id: (this.coinSeq += 1),
        x: candidates[i].x,
        y: candidates[i].y,
        droppedBy: null,
      });
    }
  }

  emitEvent(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  bombAt(x, y) {
    return this.bombs.find((bomb) => bomb.x === x && bomb.y === y);
  }

  isWalkable(x, y) {
    return (
      x >= 0 &&
      y >= 0 &&
      x < MAP_WIDTH &&
      y < MAP_HEIGHT &&
      this.grid[y][x] === TILE.FLOOR
    );
  }

  playerAt(x, y) {
    return [...this.players.values()].find((player) => player.x === x && player.y === y);
  }

  openCoinTiles() {
    const coinKeys = new Set(this.coins.map((coin) => `${coin.x},${coin.y}`));
    const bombKeys = new Set(this.bombs.map((bomb) => `${bomb.x},${bomb.y}`));
    const playerKeys = new Set(
      [...this.players.values()].map((player) => `${player.x},${player.y}`),
    );

    const tiles = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
      for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
        const key = `${x},${y}`;
        if (this.grid[y][x] !== TILE.FLOOR) continue;
        if (coinKeys.has(key) || bombKeys.has(key) || playerKeys.has(key)) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }

  spawnCoin() {
    const tiles = this.openCoinTiles();
    if (tiles.length === 0) return null;

    const tile = chooseRandom(tiles, this.rng);
    const coin = {
      id: (this.coinSeq += 1),
      x: tile.x,
      y: tile.y,
      droppedBy: null,
    };
    this.coins.push(coin);
    return coin;
  }

  move(playerId, directionName, now = Date.now()) {
    if (this.finished) return false;

    const player = this.players.get(playerId);
    const direction = DIRECTIONS[directionName];
    if (!player || !direction) return false;
    if (now - player.lastMoveAt < MOVE_COOLDOWN_MS) return false;

    const targetX = player.x + direction.dx;
    const targetY = player.y + direction.dy;

    if (!this.isWalkable(targetX, targetY)) return false;
    if (this.bombAt(targetX, targetY)) return false;

    player.x = targetX;
    player.y = targetY;
    player.dir = directionName;
    player.lastMoveAt = now;

    this.pickupCoins(player);
    return true;
  }

  pickupCoins(player) {
    const picked = this.coins.filter((coin) => coin.x === player.x && coin.y === player.y);
    if (picked.length === 0) return 0;

    const ids = new Set(picked.map((coin) => coin.id));
    this.coins = this.coins.filter((coin) => !ids.has(coin.id));
    player.coins += picked.length;

    this.emitEvent('coin-pickup', {
      playerId: player.id,
      x: player.x,
      y: player.y,
      amount: picked.length,
    });
    return picked.length;
  }

  placeBomb(playerId, now = Date.now()) {
    if (this.finished) return false;

    const player = this.players.get(playerId);
    if (!player) return false;
    if (player.bombsActive >= MAX_ACTIVE_BOMBS) return false;
    if (this.bombAt(player.x, player.y)) return false;

    const bomb = {
      id: (this.bombSeq += 1),
      ownerId: player.id,
      x: player.x,
      y: player.y,
      placedAt: now,
      explodeAt: now + BOMB_FUSE_MS,
      range: BLAST_RANGE,
    };

    this.bombs.push(bomb);
    player.bombsActive += 1;

    this.emitEvent('bomb-place', {
      bombId: bomb.id,
      playerId: player.id,
      x: bomb.x,
      y: bomb.y,
    });
    return true;
  }

  addFlame(x, y, kind, now) {
    const existing = this.flames.find((flame) => flame.x === x && flame.y === y);

    if (existing) {
      existing.expiresAt = Math.max(existing.expiresAt, now + BLAST_MS);
      if (kind === 'center') existing.kind = 'center';
      return;
    }

    this.flames.push({
      x,
      y,
      kind,
      expiresAt: now + BLAST_MS,
    });
  }

  destroyBrick(x, y) {
    if (this.grid[y][x] !== TILE.BRICK) return;
    this.grid[y][x] = TILE.FLOOR;
    this.destroyed.push({ x, y });
    this.emitEvent('wall-break', { x, y });
  }

  explodeBomb(bomb, now, detonated) {
    if (detonated.has(bomb.id)) return;
    detonated.add(bomb.id);

    const bombIndex = this.bombs.findIndex((entry) => entry.id === bomb.id);
    if (bombIndex >= 0) this.bombs.splice(bombIndex, 1);

    const owner = this.players.get(bomb.ownerId);
    if (owner) owner.bombsActive = Math.max(0, owner.bombsActive - 1);

    this.emitEvent('explosion', { x: bomb.x, y: bomb.y, bombId: bomb.id });
    this.addFlame(bomb.x, bomb.y, 'center', now);

    for (const [directionName, { dx, dy }] of Object.entries(DIRECTIONS)) {
      for (let step = 1; step <= bomb.range; step += 1) {
        const x = bomb.x + dx * step;
        const y = bomb.y + dy * step;

        if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) break;

        if (this.grid[y][x] === TILE.STONE) break;

        if (this.grid[y][x] === TILE.BRICK) {
          this.destroyBrick(x, y);
          break;
        }

        const isEnd = step === bomb.range;
        this.addFlame(x, y, isEnd ? `end-${directionName}` : directionName, now);

        const chainedBomb = this.bombAt(x, y);
        if (chainedBomb && !detonated.has(chainedBomb.id)) {
          this.explodeBomb(chainedBomb, now, detonated);
        }
      }
    }
  }

  dropCoinsAt(x, y, amount, droppedBy) {
    if (amount <= 0) return;

    const neighbours = shuffle(Object.values(DIRECTIONS), this.rng)
      .map(({ dx, dy }) => ({ x: x + dx, y: y + dy }))
      .filter(
        (tile) =>
          this.isWalkable(tile.x, tile.y) &&
          !this.bombAt(tile.x, tile.y),
      );

    const candidates = [...neighbours, { x, y }];

    for (let i = 0; i < amount; i += 1) {
      const tile = candidates[i] ?? { x, y };
      this.coins.push({
        id: (this.coinSeq += 1),
        x: tile.x,
        y: tile.y,
        droppedBy,
      });
    }
  }

  damagePlayer(playerId, now = Date.now()) {
    const player = this.players.get(playerId);
    if (!player) return false;
    if (now < player.invulnerableUntil) return false;

    const amount = Math.min(COINS_DROPPED_ON_HIT, player.coins);
    player.coins -= amount;
    player.invulnerableUntil = now + INVULNERABILITY_MS;

    this.dropCoinsAt(player.x, player.y, amount, player.id);

    this.emitEvent('player-hit', {
      playerId,
      x: player.x,
      y: player.y,
      amount,
    });

    return true;
  }

  tick(now = Date.now()) {
    if (this.finished) return;

    const detonated = new Set();
    let safety = 0;

    while (safety < 500) {
      const bomb = this.bombs.find(
        (entry) => entry.explodeAt <= now && !detonated.has(entry.id),
      );
      if (!bomb) break;

      this.explodeBomb(bomb, now, detonated);
      safety += 1;
    }

    this.flames = this.flames.filter((flame) => flame.expiresAt > now);

    const flameKeys = new Set(this.flames.map((flame) => `${flame.x},${flame.y}`));
    for (const player of [...this.players.values()]) {
      if (flameKeys.has(`${player.x},${player.y}`)) {
        this.damagePlayer(player.id, now);
      }
    }

    if (now >= this.nextCoinAt) {
      if (this.coins.length < COINS_MAX) this.spawnCoin();
      this.nextCoinAt = now + COIN_RESPAWN_MS;
    }

    if (now >= this.endsAt) {
      this.finished = true;
    }
  }

  removePlayer(playerId, now = Date.now()) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.dropCoinsAt(player.x, player.y, player.coins, player.id);
    this.emitEvent('player-left', {
      playerId,
      x: player.x,
      y: player.y,
      amount: player.coins,
    });

    const ownedBombs = this.bombs.filter((bomb) => bomb.ownerId === playerId);
    this.bombs = this.bombs.filter((bomb) => bomb.ownerId !== playerId);
    for (const bomb of ownedBombs) {
      this.emitEvent('bomb-removed', { bombId: bomb.id, x: bomb.x, y: bomb.y });
    }

    this.players.delete(playerId);
  }

  getResults() {
    const ranking = [...this.players.values()]
      .sort((a, b) => b.coins - a.coins || a.name.localeCompare(b.name))
      .map((player) => ({
        id: player.id,
        name: player.name,
        colorIndex: player.colorIndex,
        coins: player.coins,
      }));

    const topCoins = ranking.length > 0 ? ranking[0].coins : 0;
    const winnerIds = ranking.filter((player) => player.coins === topCoins).map((p) => p.id);

    return { ranking, winnerIds, topCoins };
  }

  getState(now = Date.now()) {
    const players = [...this.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      colorIndex: player.colorIndex,
      x: player.x,
      y: player.y,
      coins: player.coins,
      dir: player.dir,
      invulnerable: now < player.invulnerableUntil,
      bombsActive: player.bombsActive,
    }));

    return {
      serverNow: now,
      timeLeftMs: Math.max(0, this.endsAt - now),
      roundDurationMs: this.durationMs,
      players,
      bombs: this.bombs.map((bomb) => ({
        id: bomb.id,
        ownerId: bomb.ownerId,
        x: bomb.x,
        y: bomb.y,
        fuseLeftMs: Math.max(0, bomb.explodeAt - now),
        range: bomb.range,
      })),
      coins: this.coins.map((coin) => ({
        id: coin.id,
        x: coin.x,
        y: coin.y,
        droppedBy: coin.droppedBy,
      })),
      flames: this.flames.map((flame) => ({
        x: flame.x,
        y: flame.y,
        kind: flame.kind,
        remainingMs: Math.max(0, flame.expiresAt - now),
      })),
      destroyed: this.destroyed.map((tile) => ({ ...tile })),
      events: this.drainEvents(),
    };
  }

  getStartPayload(now = Date.now()) {
    return {
      map: this.grid.map((row) => [...row]),
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      spawns: this.spawns,
      roundDurationMs: this.durationMs,
      startedAt: this.startedAt,
      state: this.getState(now),
    };
  }
}
