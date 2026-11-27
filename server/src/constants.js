export const MAP_SIZES = Object.freeze({
  small: Object.freeze({ width: 15, height: 11 }),
  large: Object.freeze({ width: 19, height: 15 }),
});

export const MAP_WIDTH = MAP_SIZES.small.width;
export const MAP_HEIGHT = MAP_SIZES.small.height;

export function getMapSize(playerCount) {
  return playerCount >= 5 ? MAP_SIZES.large : MAP_SIZES.small;
}

export const TILE_SIZE = 16;

export const MAX_PLAYERS = 6;
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const LOBBY_COUNTDOWN_MS = 30_000;
export const MIN_ROUND_MS = 30_000;
export const MAX_ROUND_MS = 60_000;
export const RESULTS_MS = 8_000;
export const TICK_MS = 50;

export const BOMB_FUSE_MS = 2_200;
export const BLAST_MS = 450;
export const BLAST_RANGE = 2;
export const BLAST_RANGE_MAX = 5;
export const MAX_ACTIVE_BOMBS = 1;
export const MOVE_COOLDOWN_MS = 130;
export const MOVE_COOLDOWN_MIN_MS = 70;
// After a bomb hit the player is safe for longer, but cannot score or bomb.
export const INVULNERABILITY_MS = 2_000;

export const COINS_START = 12;
export const COINS_MAX = 18;
export const COINS_START_LARGE = 18;
export const COINS_MAX_LARGE = 26;
export const COIN_RESPAWN_MS = 2_500;
export const COINS_DROPPED_ON_HIT = 3;

// Special gems are worth five normal coins but appear much more slowly.
export const COIN_KINDS = Object.freeze({
  NORMAL: 'coin',
  SPECIAL: 'gem',
});
export const SPECIAL_COIN_VALUE = 5;
export const SPECIAL_COINS_START = 1;
export const SPECIAL_COINS_START_LARGE = 2;
export const SPECIAL_COINS_MAX = 2;
export const SPECIAL_COINS_MAX_LARGE = 3;
export const SPECIAL_COIN_RESPAWN_MS = 15_000;

export const POWERUP_TYPES = Object.freeze({
  RANGE: 'range',
  SPEED: 'speed',
});

export const POWERUP_START = 3;
export const POWERUP_START_LARGE = 5;
export const POWERUP_MAX = 4;
export const POWERUP_MAX_LARGE = 6;
export const POWERUP_RESPAWN_MS = 10_000;
export const SPEED_COOLDOWN_STEP_MS = 20;
export const SPEED_LEVEL_MAX = 3;

// Small maps use the four inner corners. Large maps add the middle of the top
// and bottom edges, which gives five- and six-player rooms six spawn zones.
export const SMALL_SPAWN_TILES = Object.freeze([
  Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: 13, y: 1 }),
  Object.freeze({ x: 1, y: 9 }),
  Object.freeze({ x: 13, y: 9 }),
]);

export const LARGE_SPAWN_TILES = Object.freeze([
  Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: 17, y: 1 }),
  Object.freeze({ x: 1, y: 13 }),
  Object.freeze({ x: 17, y: 13 }),
  Object.freeze({ x: 9, y: 1 }),
  Object.freeze({ x: 9, y: 13 }),
]);

export function getSpawnTiles(playerCount, size = getMapSize(playerCount)) {
  return size.width >= MAP_SIZES.large.width ? LARGE_SPAWN_TILES : SMALL_SPAWN_TILES;
}

// Every spawn gets an inward neighbour on both axes cleared. This guarantees
// at least two non-stone exits even before the connecting lanes are carved.
export function getEscapeTiles(spawns, size) {
  const middleX = (size.width - 1) / 2;
  const middleY = (size.height - 1) / 2;
  const tiles = [];

  for (const spawn of spawns) {
    const horizontalX = spawn.x <= middleX ? spawn.x + 1 : spawn.x - 1;
    const verticalY = spawn.y <= middleY ? spawn.y + 1 : spawn.y - 1;
    tiles.push(
      Object.freeze({ x: horizontalX, y: spawn.y }),
      Object.freeze({ x: spawn.x, y: verticalY }),
    );
  }

  return tiles;
}

export const PLAYER_COLORS = [
  {
    name: 'Cyan',
    body: '#28c7ef',
    light: '#b9f4ff',
    shade: '#0b6e93',
    dark: '#10334a',
  },
  {
    name: 'Magenta',
    body: '#f0509f',
    light: '#ffd0e8',
    shade: '#9c1c60',
    dark: '#45102f',
  },
  {
    name: 'Lime',
    body: '#9ede38',
    light: '#e7ffad',
    shade: '#4f8f16',
    dark: '#243d0b',
  },
  {
    name: 'Orange',
    body: '#ff9a3d',
    light: '#ffe0ad',
    shade: '#b95811',
    dark: '#4b1f06',
  },
  {
    name: 'Purple',
    body: '#a76bff',
    light: '#e3ccff',
    shade: '#6334a8',
    dark: '#2b124f',
  },
  {
    name: 'Red',
    body: '#ff5c5c',
    light: '#ffd0d0',
    shade: '#a82031',
    dark: '#4a0d16',
  },
];

export const TILE = Object.freeze({
  FLOOR: 0,
  STONE: 1,
  BRICK: 2,
});

export const DIRECTIONS = Object.freeze({
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
});
