import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECTIONS,
  LOBBY_COUNTDOWN_MS,
  MAX_PLAYERS,
  RESULTS_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../src/constants.js';
import { RoomManager } from '../src/rooms.js';
import { mulberry32 } from '../src/game.js';

function createHarness() {
  const emissions = [];
  const io = {
    to(code) {
      return {
        emit(event, payload) {
          emissions.push({ code, event, payload });
        },
      };
    },
  };

  const manager = new RoomManager(io, {
    now: () => harness.now,
    rng: mulberry32(42),
  });
  const harness = { manager, emissions, now: 1_000 };

  harness.socket = (id) => ({
    id,
    joined: new Set(),
    join(code) {
      this.joined.add(code);
    },
    leave(code) {
      this.joined.delete(code);
    },
  });

  harness.create = (id, name) =>
    manager.createRoom(harness.socket(id), name);
  harness.join = (id, code, name) =>
    manager.joinRoom(harness.socket(id), code, name);

  harness.lastEmit = (event) =>
    [...emissions].reverse().find((entry) => entry.event === event);

  return harness;
}

function addFullRoom(harness) {
  const host = harness.create('host', 'Host');
  const guests = [];
  for (let index = 1; index < MAX_PLAYERS; index += 1) {
    guests.push(harness.join(`guest-${index}`, host.code, `Guest ${index}`));
  }
  return { host, guests };
}

test('room creation issues a unique five-character code and a valid lobby payload', () => {
  const harness = createHarness();
  const first = harness.create('host', '  Pixel  Pete  ');
  const second = harness.create('other', 'Other');

  assert.equal(first.ok, true);
  assert.equal(first.code.length, ROOM_CODE_LENGTH);
  assert.match(first.code, new RegExp(`^[${ROOM_CODE_ALPHABET}]{5}$`));
  assert.notEqual(first.code, second.code);
  assert.equal(first.room.phase, 'lobby');
  assert.equal(first.room.hostId, 'host');
  assert.equal(first.room.maxPlayers, MAX_PLAYERS);
  assert.equal(first.room.players.length, 1);
  assert.equal(first.room.players[0].name, 'Pixel Pete');
  assert.equal(first.room.countdownMs, LOBBY_COUNTDOWN_MS);
});

test('joining normalizes codes and enforces room membership rules', () => {
  const harness = createHarness();
  const room = harness.create('host', 'Host');

  assert.equal(harness.join('guest', room.code.toLowerCase(), 'Guest').ok, true);
  assert.equal(harness.join('guest', room.code, 'Again').code, 'ALREADY_IN_ROOM');
  assert.equal(harness.join('bad', 'ABC', 'Bad').code, 'INVALID_CODE');
  assert.equal(harness.join('bad', 'ZZZZZ', 'Bad').code, 'ROOM_NOT_FOUND');

  for (let index = 2; index < MAX_PLAYERS; index += 1) {
    harness.join(`g${index}`, room.code, `G${index}`);
  }
  assert.equal(harness.join('overflow', room.code, 'Overflow').code, 'ROOM_FULL');

  const fullRoom = harness.manager.rooms.get(room.code);
  assert.equal(fullRoom.members.size, MAX_PLAYERS);

  harness.manager.start(harness.socket('host'));
  const late = harness.manager.joinRoom(harness.socket('late'), room.code, 'Late');
  assert.equal(late.code, 'MATCH_IN_PROGRESS');
});

test('only the host can start, and starting broadcasts the authoritative start payload', () => {
  const harness = createHarness();
  const room = harness.create('host', 'Host');
  harness.join('guest', room.code, 'Guest');

  assert.equal(harness.manager.start(harness.socket('guest')).code, 'NOT_HOST');

  const result = harness.manager.start(harness.socket('host'));
  assert.equal(result.ok, true);
  assert.equal(result.roundNumber, 1);

  const emitted = harness.lastEmit('game:start');
  assert.equal(emitted.code, room.code);
  assert.equal(emitted.payload.roundNumber, 1);
  assert.equal(emitted.payload.map.length, 11);
  assert.equal(emitted.payload.state.players.length, 2);
  assert.ok(emitted.payload.roundDurationMs >= 30_000);
  assert.ok(emitted.payload.roundDurationMs <= 60_000);

  assert.equal(harness.manager.start(harness.socket('host')).code, 'NOT_IN_LOBBY');
});

test('the lobby auto-starts when its countdown expires', () => {
  const harness = createHarness();
  const room = harness.create('host', 'Host');

  harness.now += LOBBY_COUNTDOWN_MS - 1;
  harness.manager.tick(harness.now);
  assert.equal(harness.lastEmit('game:start'), undefined);

  harness.now += 1;
  harness.manager.tick(harness.now);
  assert.equal(harness.manager.rooms.get(room.code).phase, 'playing');
  assert.equal(harness.lastEmit('game:start').event, 'game:start');
});

test('a finished round shows results and returns to a fresh lobby', () => {
  const harness = createHarness();
  const room = harness.create('host', 'Host');
  harness.join('guest', room.code, 'Guest');
  harness.manager.start(harness.socket('host'));

  const active = harness.manager.rooms.get(room.code);
  active.game.players.get('host').coins = 7;
  active.game.endsAt = harness.now + 50;

  harness.now += 100;
  harness.manager.tick(harness.now);
  assert.equal(active.phase, 'results');

  const over = harness.lastEmit('game:over');
  assert.equal(over.payload.topCoins, 7);
  assert.deepEqual(over.payload.winnerIds, ['host']);
  assert.equal(over.payload.ranking.length, 2);
  assert.equal(over.payload.resultsMs, RESULTS_MS);

  harness.now += RESULTS_MS - 1;
  harness.manager.tick(harness.now);
  assert.equal(active.phase, 'results');

  harness.now += 1;
  harness.manager.tick(harness.now);
  assert.equal(active.phase, 'lobby');
  assert.equal(active.game, null);
  assert.equal(active.lobbyEndsAt, harness.now + LOBBY_COUNTDOWN_MS);
  assert.equal(harness.lastEmit('room:update').payload.phase, 'lobby');
});

test('leaving transfers host duties and removes empty rooms', () => {
  const harness = createHarness();
  const { guests } = addFullRoom(harness);
  const roomCode = guests[0].code;
  let room = harness.manager.rooms.get(roomCode);

  harness.manager.leave(harness.socket('host'));
  assert.equal(room.hostId, 'guest-1');

  harness.manager.leave(harness.socket('guest-1'));
  assert.equal(room.hostId, 'guest-2');

  for (const guest of guests.slice(1)) {
    harness.manager.leave(harness.socket(guest.playerId));
  }
  assert.equal(harness.manager.rooms.has(roomCode), false);
  assert.equal(harness.manager.socketRooms.size, 0);
});

test('moves and bombs are ignored outside a running match', () => {
  const harness = createHarness();
  const room = harness.create('host', 'Host');

  assert.equal(harness.manager.handleMove(harness.socket('host'), 'up'), false);
  assert.equal(harness.manager.handleBomb(harness.socket('host')), false);
  assert.equal(harness.manager.handleMove(harness.socket('nobody'), 'up', 'bad'), false);

  harness.manager.start(harness.socket('host'));
  const active = harness.manager.rooms.get(room.code);
  const hostPlayer = active.game.players.get('host');
  hostPlayer.lastMoveAt = Number.NEGATIVE_INFINITY;

  const direction = Object.entries(DIRECTIONS).find(([, { dx, dy }]) =>
    active.game.isWalkable(hostPlayer.x + dx, hostPlayer.y + dy),
  )?.[0];
  assert.ok(direction, 'the spawned player has at least one walkable neighbour');

  assert.equal(harness.manager.handleMove(harness.socket('host'), direction), true);
  assert.equal(harness.manager.handleMove(harness.socket('host'), 'sideways'), false);
  assert.equal(harness.manager.handleBomb(harness.socket('host')), true);
});
