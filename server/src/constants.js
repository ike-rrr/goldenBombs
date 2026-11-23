export const MAP_WIDTH = 15;
export const MAP_HEIGHT = 11;
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
export const MAX_ACTIVE_BOMBS = 1;
export const MOVE_COOLDOWN_MS = 130;
export const INVULNERABILITY_MS = 1_000;

export const COINS_START = 12;
export const COINS_MAX = 18;
export const COIN_RESPAWN_MS = 2_500;
export const COINS_DROPPED_ON_HIT = 3;

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

// Six fixed spawn zones: four inner corners plus the middle of the top and
// bottom rows. The order assigned to players is shuffled every round.
export const SPAWN_TILES = Object.freeze([
  Object.freeze({ x: 1, y: 1 }),
  Object.freeze({ x: 13, y: 1 }),
  Object.freeze({ x: 1, y: 9 }),
  Object.freeze({ x: 13, y: 9 }),
  Object.freeze({ x: 7, y: 1 }),
  Object.freeze({ x: 7, y: 9 }),
]);

// Each spawn keeps one nearby tile clear so a player can never be walled in
// by indestructible stone from the first frame of the round.
export const SPAWN_ESCAPE_TILES = Object.freeze([
  Object.freeze({ x: 2, y: 1 }),
  Object.freeze({ x: 12, y: 1 }),
  Object.freeze({ x: 2, y: 9 }),
  Object.freeze({ x: 12, y: 9 }),
  Object.freeze({ x: 7, y: 2 }),
  Object.freeze({ x: 7, y: 8 }),
]);

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
