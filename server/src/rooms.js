import { randomInt } from 'node:crypto';
import {
  DIRECTIONS,
  LOBBY_COUNTDOWN_MS,
  MAX_PLAYERS,
  RESULTS_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './constants.js';
import { Game } from './game.js';

const ROOM_CODE_PATTERN = /^[A-Z0-9]{5}$/;
const MAX_NAME_LENGTH = 14;

function sanitizeName(rawName) {
  if (typeof rawName !== 'string') return '';
  return rawName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function error(code, message) {
  return { ok: false, code, message };
}

export class RoomManager {
  constructor(io, { now = () => Date.now(), rng = Math.random } = {}) {
    this.io = io;
    this.now = now;
    this.rng = rng;
    this.rooms = new Map();
    this.socketRooms = new Map();
    this.lastLobbyBroadcast = new Map();
  }

  generateRoomCode() {
    let code = '';
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  nextColorIndex(room) {
    const used = new Set([...room.members.values()].map((member) => member.colorIndex));
    for (let index = 0; index < MAX_PLAYERS; index += 1) {
      if (!used.has(index)) return index;
    }
    return 0;
  }

  getRoomForSocket(socketId) {
    const code = this.socketRooms.get(socketId);
    return code ? this.rooms.get(code) : null;
  }

  createRoom(socket, rawName) {
    if (this.getRoomForSocket(socket.id)) {
      return error('ALREADY_IN_ROOM', 'You are already in a room.');
    }

    const name = sanitizeName(rawName) || 'Player';
    const code = this.generateRoomCode();
    const now = this.now();

    const room = {
      code,
      hostId: socket.id,
      members: new Map(),
      phase: 'lobby',
      createdAt: now,
      lobbyEndsAt: now + LOBBY_COUNTDOWN_MS,
      resultsEndsAt: 0,
      game: null,
      roundNumber: 0,
    };

    room.members.set(socket.id, {
      id: socket.id,
      name,
      colorIndex: 0,
      joinedAt: now,
    });

    this.rooms.set(code, room);
    this.socketRooms.set(socket.id, code);
    socket.join(code);

    this.broadcastLobby(room, true);
    return { ok: true, code, playerId: socket.id, room: this.getLobbyPayload(room, now) };
  }

  joinRoom(socket, rawCode, rawName) {
    if (this.getRoomForSocket(socket.id)) {
      return error('ALREADY_IN_ROOM', 'You are already in a room.');
    }

    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    if (!ROOM_CODE_PATTERN.test(code)) {
      return error('INVALID_CODE', 'Room codes are 5 letters or numbers.');
    }

    const room = this.rooms.get(code);
    if (!room) {
      return error('ROOM_NOT_FOUND', 'No room exists with that code.');
    }

    if (room.phase !== 'lobby') {
      return error('MATCH_IN_PROGRESS', 'That room is already playing. Try again soon.');
    }

    if (room.members.size >= MAX_PLAYERS) {
      return error('ROOM_FULL', 'That room is full.');
    }

    const name = sanitizeName(rawName) || 'Player';
    const now = this.now();

    room.members.set(socket.id, {
      id: socket.id,
      name,
      colorIndex: this.nextColorIndex(room),
      joinedAt: now,
    });

    this.socketRooms.set(socket.id, code);
    socket.join(code);

    this.broadcastLobby(room, true);
    return { ok: true, code, playerId: socket.id, room: this.getLobbyPayload(room, now) };
  }

  leave(socket, { silent = false } = {}) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return;

    const member = room.members.get(socket.id);
    room.members.delete(socket.id);
    this.socketRooms.delete(socket.id);
    socket.leave(room.code);

    if (room.game && room.phase === 'playing') {
      room.game.removePlayer(socket.id, this.now());
    }

    if (member && room.hostId === socket.id) {
      const nextHost = room.members.values().next();
      room.hostId = nextHost.done ? null : nextHost.value.id;
    }

    if (room.members.size === 0) {
      this.rooms.delete(room.code);
      this.lastLobbyBroadcast.delete(room.code);
      return;
    }

    if (!silent && room.phase === 'lobby') {
      this.broadcastLobby(room, true);
    }
  }

  start(socket) {
    const room = this.getRoomForSocket(socket.id);
    if (!room) return error('NOT_IN_ROOM', 'Join a room first.');
    if (room.hostId !== socket.id) {
      return error('NOT_HOST', 'Only the host can start the match.');
    }
    if (room.phase !== 'lobby') {
      return error('NOT_IN_LOBBY', 'The match is already running.');
    }
    if (room.members.size < 1) {
      return error('NO_PLAYERS', 'There are no players in this room.');
    }

    return this.startRound(room, this.now());
  }

  startRound(room, now) {
    try {
      room.game = new Game({
        members: [...room.members.values()],
        now,
        rng: this.rng,
      });
    } catch (startError) {
      return error('START_FAILED', startError.message);
    }

    room.phase = 'playing';
    room.roundNumber += 1;

    const payload = room.game.getStartPayload(now);
    this.io.to(room.code).emit('game:start', {
      code: room.code,
      roundNumber: room.roundNumber,
      ...payload,
    });

    return { ok: true, roundNumber: room.roundNumber };
  }

  handleMove(socket, directionName) {
    const room = this.getRoomForSocket(socket.id);
    if (!room || room.phase !== 'playing' || !room.game) return false;
    if (!Object.hasOwn(DIRECTIONS, directionName)) return false;

    return room.game.move(socket.id, directionName, this.now());
  }

  handleBomb(socket) {
    const room = this.getRoomForSocket(socket.id);
    if (!room || room.phase !== 'playing' || !room.game) return false;

    return room.game.placeBomb(socket.id, this.now());
  }

  getLobbyPayload(room, now = this.now()) {
    return {
      code: room.code,
      hostId: room.hostId,
      phase: 'lobby',
      maxPlayers: MAX_PLAYERS,
      secondsLeft: Math.max(0, Math.ceil((room.lobbyEndsAt - now) / 1000)),
      countdownMs: Math.max(0, room.lobbyEndsAt - now),
      players: [...room.members.values()].map((member) => ({
        id: member.id,
        name: member.name,
        colorIndex: member.colorIndex,
        isHost: member.id === room.hostId,
      })),
    };
  }

  broadcastLobby(room, force = false) {
    const now = this.now();
    const last = this.lastLobbyBroadcast.get(room.code) ?? 0;
    if (!force && now - last < 250) return;

    this.lastLobbyBroadcast.set(room.code, now);
    this.io.to(room.code).emit('room:update', this.getLobbyPayload(room, now));
  }

  broadcastGameState(room, now) {
    if (!room.game) return;
    this.io.to(room.code).emit('game:state', room.game.getState(now));
  }

  finishRound(room, now) {
    if (!room.game) return;

    const results = room.game.getResults();
    room.phase = 'results';
    room.resultsEndsAt = now + RESULTS_MS;

    this.io.to(room.code).emit('game:over', {
      ...results,
      roundDurationMs: room.game.durationMs,
      resultsMs: RESULTS_MS,
      resultsEndsAt: room.resultsEndsAt,
      serverNow: now,
    });
  }

  returnToLobby(room, now) {
    room.phase = 'lobby';
    room.game = null;
    room.resultsEndsAt = 0;
    room.lobbyEndsAt = now + LOBBY_COUNTDOWN_MS;
    this.broadcastLobby(room, true);
  }

  tick(now = this.now()) {
    for (const room of [...this.rooms.values()]) {
      if (room.phase === 'lobby') {
        if (now >= room.lobbyEndsAt) {
          const result = this.startRound(room, now);
          if (!result.ok) {
            room.lobbyEndsAt = now + LOBBY_COUNTDOWN_MS;
            this.io.to(room.code).emit('room:error', {
              message: 'The match could not start. A new countdown has begun.',
            });
          }
        } else {
          this.broadcastLobby(room);
        }
      } else if (room.phase === 'playing') {
        room.game.tick(now);
        this.broadcastGameState(room, now);

        if (room.game.finished) {
          this.finishRound(room, now);
        }
      } else if (room.phase === 'results') {
        if (now >= room.resultsEndsAt) {
          this.returnToLobby(room, now);
        }
      }
    }
  }
}
