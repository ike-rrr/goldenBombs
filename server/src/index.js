import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { LOBBY_COUNTDOWN_MS, TICK_MS } from './constants.js';
import { RoomManager } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'golden-bombs', uptime: process.uptime() });
});

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((request, response, next) => {
    if (request.method !== 'GET') return next();
    if (request.path.startsWith('/socket.io')) return next();
    if (!request.accepts('html')) return next();

    response.sendFile(path.join(CLIENT_DIST, 'index.html'), (sendError) => {
      if (sendError) next();
    });
  });
}

const httpServer = createServer(app);

const configuredOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

function createRateLimiter(limitPerSecond) {
  let windowStart = Date.now();
  let count = 0;

  return function allow() {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      count = 0;
    }
    if (count >= limitPerSecond) return false;
    count += 1;
    return true;
  };
}

function reply(callback, payload) {
  if (typeof callback === 'function') callback(payload);
}

io.on('connection', (socket) => {
  const canMove = createRateLimiter(80);
  const canBomb = createRateLimiter(12);

  socket.on('room:create', (payload, callback) => {
    const result = roomManager.createRoom(socket, payload?.name);
    reply(callback, result);
  });

  socket.on('room:join', (payload, callback) => {
    const result = roomManager.joinRoom(socket, payload?.code, payload?.name);
    reply(callback, result);
  });

  socket.on('lobby:start', (_payload, callback) => {
    const result = roomManager.start(socket);
    reply(callback, result);
  });

  socket.on('room:leave', (_payload, callback) => {
    roomManager.leave(socket);
    reply(callback, { ok: true });
  });

  socket.on('player:move', (payload) => {
    if (!canMove()) return;
    roomManager.handleMove(socket, payload?.dir);
  });

  socket.on('player:bomb', () => {
    if (!canBomb()) return;
    roomManager.handleBomb(socket);
  });

  socket.on('disconnect', () => {
    roomManager.leave(socket);
  });

  socket.emit('server:hello', {
    lobbyCountdownMs: LOBBY_COUNTDOWN_MS,
    serverNow: Date.now(),
  });
});

const gameLoop = setInterval(() => {
  roomManager.tick(Date.now());
}, TICK_MS);

function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down...`);
  clearInterval(gameLoop);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

httpServer.listen(PORT, () => {
  console.log('');
  console.log('  GOLDEN BOMBS server');
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Client dev: http://localhost:5173`);
  console.log('');
});
