import Phaser from 'phaser';
import { io } from 'socket.io-client';
import './style.css';
import { GameScene } from './game/GameScene.js';
import { GameUI } from './ui.js';

const socket = io({
  transports: ['websocket', 'polling'],
});

let phaserGame = null;
let inGame = false;
let myId = null;
let currentRoom = null;

const ui = new GameUI();

function getScene() {
  return phaserGame?.scene?.getScene('GameScene') ?? null;
}

// The board is 48px per tile. Six-player rooms use a 19x15 map, so the canvas
// and its wrapper grow from 720x528 to 912x720 when the round starts.
function resizeGame(width = 15, height = 11) {
  const pixelWidth = width * 48;
  const pixelHeight = height * 48;
  phaserGame?.scale?.resize(pixelWidth, pixelHeight);

  const wrap = document.getElementById('canvas-wrap');
  if (wrap) {
    wrap.style.maxWidth = `${pixelWidth}px`;
    wrap.style.aspectRatio = `${width} / ${height}`;
  }
  document.getElementById('screen-game')?.classList.toggle('wide-map', width > 15);
}

function emitAck(eventName, payload, timeoutMs = 7_000) {
  return new Promise((resolve) => {
    if (!socket.connected) {
      resolve({
        ok: false,
        code: 'OFFLINE',
        message: 'The server is not connected yet.',
      });
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({
        ok: false,
        code: 'TIMEOUT',
        message: 'The server took too long to respond.',
      });
    }, timeoutMs);

    socket.emit(eventName, payload, (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result ?? { ok: false, code: 'NO_RESPONSE', message: 'No response from server.' });
    });
  });
}

function sendDirection(direction) {
  if (!inGame || !socket.connected) return;
  socket.emit('player:move', { dir: direction });
}

function sendBomb() {
  if (!inGame || !socket.connected) return;
  socket.emit('player:bomb');
}

async function createRoom(name) {
  const result = await emitAck('room:create', { name });
  ui.setBusy(false);

  if (!result.ok) {
    ui.showMenuError(result.message ?? 'Could not create the room.');
    ui.showToast(result.message ?? 'Could not create the room.', 'error');
    return;
  }

  myId = result.playerId;
  currentRoom = result.room;
  ui.showLobby(result.room, myId);
}

async function joinRoom(code, name) {
  const result = await emitAck('room:join', { code, name });
  ui.setBusy(false);

  if (!result.ok) {
    ui.showMenuError(result.message ?? 'Could not join the room.');
    ui.showToast(result.message ?? 'Could not join the room.', 'error');
    return;
  }

  myId = result.playerId;
  currentRoom = result.room;
  ui.showLobby(result.room, myId);
}

async function startMatch() {
  const result = await emitAck('lobby:start', {});
  if (!result.ok) ui.showToast(result.message ?? 'Could not start the match.', 'error');
}

async function leaveRoom() {
  if (socket.connected) await emitAck('room:leave', {});
  inGame = false;
  myId = null;
  currentRoom = null;
  getScene()?.stopGame();
  ui.showMenu();
}

ui.setHandlers({
  onCreate: (name) => {
    createRoom(name);
  },
  onJoin: (code, name) => {
    joinRoom(code, name);
  },
  onStart: () => {
    startMatch();
  },
  onLeave: () => {
    leaveRoom();
  },
  onDirection: (direction, pressed) => {
    if (!inGame) return;
    const scene = getScene();
    scene?.setHeldDirection(direction, pressed);
    if (pressed) scene?.trySendMove(true);
  },
  onBomb: () => {
    if (!inGame) return;
    getScene()?.triggerBomb();
  },
});

socket.on('connect', () => {
  ui.setConnected(true);
});

socket.on('disconnect', () => {
  inGame = false;
  myId = null;
  currentRoom = null;
  getScene()?.stopGame();
  ui.showConnectionLost();
});

socket.on('connect_error', () => {
  ui.setConnected(false);
  ui.showToast('Cannot reach the game server. Is it running?', 'error');
});

socket.on('room:update', (room) => {
  currentRoom = room;
  if (room.phase !== 'lobby') return;

  if (inGame) {
    inGame = false;
    getScene()?.stopGame();
  }

  if (myId) ui.showLobby(room, myId);
});

socket.on('room:error', (payload) => {
  ui.showToast(payload?.message ?? 'Room error.', 'error');
});

socket.on('game:start', (payload) => {
  inGame = true;
  resizeGame(payload.width, payload.height);
  const scene = getScene();

  if (scene) {
    scene.beginGame({ ...payload, localPlayerId: myId });
    scene.onMove = sendDirection;
    scene.onBomb = sendBomb;
    scene.onDamage = () => ui.flashDamage();
    scene.onToast = (message) => ui.showToast(message);
  }

  ui.showGame(payload.state.players, myId);
  ui.updateHud(payload.state);
  ui.showRoundBanner(payload.roundDurationMs);
});

socket.on('game:state', (state) => {
  if (!inGame) return;
  getScene()?.applyState(state);
  ui.updateHud(state);
});

socket.on('game:over', (payload) => {
  inGame = false;
  getScene()?.stopGame();
  ui.showResults(payload);
});

async function loadFonts() {
  if (!document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('400 10px Silkscreen'),
      document.fonts.load('700 10px Silkscreen'),
    ]);
    await document.fonts.ready;
  } catch {
    // The monospace fallback is still playable.
  }
}

async function boot() {
  await loadFonts();

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-canvas',
    width: 720,
    height: 528,
    backgroundColor: '#0b1027',
    pixelArt: true,
    roundPixels: true,
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 720,
      height: 528,
    },
    scene: GameScene,
  });

  const scene = getScene();
  if (scene) {
    scene.onMove = sendDirection;
    scene.onBomb = sendBomb;
    scene.onDamage = () => ui.flashDamage();
    scene.onToast = (message) => ui.showToast(message);
  }
}

if (socket.connected) ui.setConnected(true);
boot();
