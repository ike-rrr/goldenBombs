import Phaser from 'phaser';
import { buildTextures, hash2d } from './pixelArt.js';
import { playerColor } from './palette.js';

const TILE_SIZE = 48;
const WALK_FRAME_MS = 120;
const MOVE_SEND_MS = 105;

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    buildTextures(this);

    this.layers = {
      floor: this.add.container(0, 0).setDepth(0),
      decals: this.add.container(0, 0).setDepth(1),
      walls: this.add.container(0, 0).setDepth(5),
      coins: this.add.container(0, 0).setDepth(8),
      bombs: this.add.container(0, 0).setDepth(15),
      players: this.add.container(0, 0).setDepth(20),
      flames: this.add.container(0, 0).setDepth(30),
      fx: this.add.container(0, 0).setDepth(40),
    };

    this.wallSprites = new Map();
    this.playerSprites = new Map();
    this.bombSprites = new Map();
    this.coinSprites = new Map();
    this.flameSprites = new Map();
    this.map = [];
    this.activeRound = false;
    this.held = new Map();
    this.lastSentAt = 0;
    this.onMove = null;
    this.onBomb = null;
    this.onDamage = null;
    this.onToast = null;

    this.bindInput();
  }

  bindInput() {
    this.handleKeyDown = (event) => {
      if (!this.activeRound) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(event.target.tagName)) {
        return;
      }

      const direction = KEY_DIRECTIONS[event.code];
      if (direction) {
        event.preventDefault();
        if (event.repeat) return;
        this.setHeldDirection(direction, true);
        this.trySendMove(true);
        return;
      }

      if (event.code === 'Space' || event.code === 'KeyE') {
        event.preventDefault();
        if (!event.repeat) this.triggerBomb();
      }
    };

    this.handleKeyUp = (event) => {
      if (!this.activeRound) return;
      const direction = KEY_DIRECTIONS[event.code];
      if (direction) {
        event.preventDefault();
        this.setHeldDirection(direction, false);
      }
    };

    this.handleBlur = () => {
      this.held.clear();
    };

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.events.once('shutdown', () => {
      document.removeEventListener('keydown', this.handleKeyDown);
      document.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleBlur);
    });
  }

  setHeldDirection(direction, pressed) {
    if (pressed) this.held.set(direction, performance.now());
    else this.held.delete(direction);
  }

  triggerBomb() {
    if (!this.activeRound) return;
    this.onBomb?.();
  }

  trySendMove(force = false) {
    if (!this.activeRound || this.held.size === 0) return;
    const now = performance.now();
    if (!force && now - this.lastSentAt < MOVE_SEND_MS) return;

    let direction = null;
    let latest = -1;
    for (const [name, pressedAt] of this.held.entries()) {
      if (pressedAt > latest) {
        latest = pressedAt;
        direction = name;
      }
    }

    if (!direction) return;
    this.lastSentAt = now;
    this.onMove?.(direction);
  }

  beginGame(payload) {
    this.resetBoard();
    this.localPlayerId = payload.localPlayerId;
    this.map = payload.map.map((row) => [...row]);
    this.activeRound = true;
    this.held.clear();
    this.lastSentAt = 0;

    this.buildBoard();
    this.applyState({
      ...payload.state,
      events: payload.state.events ?? [],
    });
  }

  stopGame() {
    this.activeRound = false;
    this.held.clear();
    this.tweens.killAll();
    this.resetBoard();
  }

  resetBoard() {
    this.tweens.killAll();
    for (const layer of Object.values(this.layers)) layer.removeAll(true);
    this.wallSprites?.clear();
    this.playerSprites?.clear();
    this.bombSprites?.clear();
    this.coinSprites?.clear();
    this.flameSprites?.clear();
    this.map = [];
  }

  tileCenter(x, y) {
    return {
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  tileKey(x, y) {
    return `${x},${y}`;
  }

  buildBoard() {
    for (let y = 0; y < this.map.length; y += 1) {
      for (let x = 0; x < this.map[y].length; x += 1) {
        const center = this.tileCenter(x, y);
        const variant = Math.floor(hash2d(x, y, 7) * 4) % 4;

        const grass = this.add.image(center.x, center.y, `grass-${variant}`).setScale(3);
        this.layers.floor.add(grass);

        if (this.map[y][x] === 0) {
          const decorRoll = hash2d(x, y, 91);
          if (decorRoll > 0.84) {
            const flower = this.add
              .image(center.x, center.y, `flower-${Math.floor(decorRoll * 10) % 3}`)
              .setScale(3);
            this.layers.decals.add(flower);
          } else if (decorRoll < 0.07) {
            const pebble = this.add.image(center.x, center.y, 'pebble').setScale(3);
            this.layers.decals.add(pebble);
          }
        }

        if (this.map[y][x] === 1) {
          const wall = this.add
            .image(center.x, center.y, `wall-stone-${Math.floor(hash2d(x, y, 31) * 2)}`)
            .setScale(3);
          this.layers.walls.add(wall);
          this.wallSprites.set(this.tileKey(x, y), wall);
        } else if (this.map[y][x] === 2) {
          const wall = this.add
            .image(center.x, center.y, `wall-brick-${Math.floor(hash2d(x, y, 41) * 2)}`)
            .setScale(3);
          this.layers.walls.add(wall);
          this.wallSprites.set(this.tileKey(x, y), wall);
        }
      }
    }
  }

  applyState(state) {
    if (!this.activeRound) return;

    this.processEvents(state.events ?? []);
    this.syncPlayers(state.players ?? []);
    this.syncBombs(state.bombs ?? []);
    this.syncCoins(state.coins ?? []);
    this.syncFlames(state.flames ?? []);
    this.syncDestroyed(state.destroyed ?? []);
  }

  processEvents(events) {
    for (const event of events) {
      const center = this.tileCenter(event.x ?? 0, event.y ?? 0);

      if (event.type === 'wall-break') {
        this.removeWall(event.x, event.y, true);
      } else if (event.type === 'player-hit') {
        this.spawnBurst(center.x, center.y, 'spark-white', 8, [0xffffff, 0xff7b6b, 0xffd447]);
        this.cameras.main.shake(130, 0.006);
        if (event.playerId === this.localPlayerId) this.onDamage?.();
      } else if (event.type === 'coin-pickup') {
        this.spawnBurst(center.x, center.y, 'spark-gold', 6, [0xffd447, 0xfff3b0, 0xff9f1c]);
        if (event.playerId === this.localPlayerId) {
          this.spawnFloatingText(center.x, center.y - 10, `+${event.amount}`, '#ffd447');
        }
      } else if (event.type === 'explosion') {
        this.cameras.main.shake(100, 0.004);
        this.spawnBurst(center.x, center.y, 'spark-gold', 7, [0xffd447, 0xff7b2f, 0xff4f38]);
      } else if (event.type === 'player-left') {
        this.onToast?.(`${event.playerId === this.localPlayerId ? 'You' : 'A player'} left the match.`);
      }
    }
  }

  syncPlayers(players) {
    const seen = new Set();

    for (const state of players) {
      seen.add(state.id);
      let player = this.playerSprites.get(state.id);
      const center = this.tileCenter(state.x, state.y);

      if (!player) {
        player = this.createPlayer(state, center);
        this.playerSprites.set(state.id, player);
      }

      player.targetX = center.x;
      player.targetY = center.y;
      player.dir = state.dir;
      player.colorIndex = state.colorIndex;
      player.invulnerable = state.invulnerable;
      player.coins = state.coins;

      if (player.name !== state.name) {
        player.name = state.name;
        player.label.setText(state.name);
      }

      player.indicator.setVisible(state.id === this.localPlayerId);
    }

    for (const [id, player] of this.playerSprites.entries()) {
      if (seen.has(id)) continue;
      player.container.destroy(true);
      this.playerSprites.delete(id);
    }
  }

  createPlayer(state, center) {
    const palette = playerColor(state.colorIndex);
    const container = this.add.container(center.x, center.y);
    const shadow = this.add.image(0, 12, 'shadow').setScale(3).setAlpha(0.9);
    const sprite = this.add.image(0, 0, `player-${state.colorIndex}-down-0`).setScale(3);
    const label = this.add
      .text(0, -27, state.name, {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '9px',
        color: '#fff8df',
        backgroundColor: '#101a38',
        padding: { x: 3, y: 2 },
        resolution: 2,
      })
      .setOrigin(0.5, 1);
    const indicator = this.add.image(0, -45, 'you-arrow').setScale(2);
    indicator.setTint(Phaser.Display.Color.HexStringToColor(palette.light).color);

    container.add([shadow, sprite, label, indicator]);
    this.layers.players.add(container);

    return {
      container,
      sprite,
      label,
      indicator,
      dir: state.dir,
      name: state.name,
      targetX: center.x,
      targetY: center.y,
      walkClock: 0,
      invulnerable: state.invulnerable,
      colorIndex: state.colorIndex,
      coins: state.coins,
    };
  }

  syncBombs(bombs) {
    const seen = new Set();

    for (const bomb of bombs) {
      seen.add(bomb.id);
      let entry = this.bombSprites.get(bomb.id);
      const center = this.tileCenter(bomb.x, bomb.y);

      if (!entry) {
        const sprite = this.add.image(center.x, center.y, 'bomb-0').setScale(0);
        this.layers.bombs.add(sprite);
        this.tweens.add({
          targets: sprite,
          scale: 3,
          duration: 190,
          ease: 'Back.Out',
        });
        entry = { sprite, fuseLeftMs: bomb.fuseLeftMs };
        this.bombSprites.set(bomb.id, entry);
      }

      entry.fuseLeftMs = bomb.fuseLeftMs;
      entry.sprite.setPosition(center.x, center.y);
    }

    for (const [id, entry] of this.bombSprites.entries()) {
      if (seen.has(id)) continue;
      entry.sprite.destroy();
      this.bombSprites.delete(id);
    }
  }

  syncCoins(coins) {
    const seen = new Set();

    for (const coin of coins) {
      seen.add(coin.id);
      let entry = this.coinSprites.get(coin.id);
      const center = this.tileCenter(coin.x, coin.y);

      if (!entry) {
        const sprite = this.add.image(center.x, center.y, 'coin-0').setScale(0);
        this.layers.coins.add(sprite);
        this.tweens.add({
          targets: sprite,
          scale: 3,
          duration: coin.droppedBy ? 280 : 180,
          ease: coin.droppedBy ? 'Bounce.Out' : 'Back.Out',
        });
        entry = {
          sprite,
          baseX: center.x,
          baseY: center.y,
          phase: (coin.id % 17) * 0.4,
        };
        this.coinSprites.set(coin.id, entry);
      }

      entry.baseX = center.x;
      entry.baseY = center.y;
      entry.sprite.setPosition(center.x, center.y);
    }

    for (const [id, entry] of this.coinSprites.entries()) {
      if (seen.has(id)) continue;
      entry.sprite.destroy();
      this.coinSprites.delete(id);
    }
  }

  syncFlames(flames) {
    const seen = new Set();

    for (const flame of flames) {
      const key = this.tileKey(flame.x, flame.y);
      seen.add(key);
      let entry = this.flameSprites.get(key);
      const center = this.tileCenter(flame.x, flame.y);

      if (!entry) {
        const sprite = this.add
          .image(center.x, center.y, `flame-${flame.kind}-0`)
          .setScale(3);
        this.layers.flames.add(sprite);
        entry = { sprite, kind: flame.kind };
        this.flameSprites.set(key, entry);
      }

      if (entry.kind !== flame.kind) {
        entry.kind = flame.kind;
        entry.sprite.setTexture(`flame-${flame.kind}-0`);
      }
    }

    for (const [key, entry] of this.flameSprites.entries()) {
      if (seen.has(key)) continue;
      entry.sprite.destroy();
      this.flameSprites.delete(key);
    }
  }

  syncDestroyed(destroyed) {
    for (const tile of destroyed) {
      if (this.map[tile.y]?.[tile.x] !== 0) {
        this.removeWall(tile.x, tile.y, false);
      }
    }
  }

  removeWall(x, y, animate) {
    const key = this.tileKey(x, y);
    const wall = this.wallSprites.get(key);
    if (!wall) return;

    const center = this.tileCenter(x, y);
    const isBrick = this.map[y]?.[x] === 2;

    if (animate) {
      this.spawnDebris(center.x, center.y, isBrick ? 'debris-brick' : 'debris-stone', isBrick ? 7 : 5);
    }

    wall.destroy();
    this.wallSprites.delete(key);
    if (this.map[y]) this.map[y][x] = 0;
  }

  spawnBurst(x, y, texture, count, tints) {
    for (let index = 0; index < count; index += 1) {
      const spark = this.add.image(x, y, texture).setScale(2.5);
      spark.setTint(tints[index % tints.length]);
      this.layers.fx.add(spark);

      const angle = Math.random() * Math.PI * 2;
      const distance = 12 + Math.random() * 22;

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 1,
        duration: 320 + Math.random() * 260,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      });
    }
  }

  spawnDebris(x, y, texture, count) {
    for (let index = 0; index < count; index += 1) {
      const debris = this.add
        .image(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 16, texture)
        .setScale(2.2);
      this.layers.fx.add(debris);

      this.tweens.add({
        targets: debris,
        x: debris.x + (Math.random() - 0.5) * 46,
        y: debris.y + (Math.random() - 0.5) * 36,
        angle: Math.random() * 240 - 120,
        alpha: 0,
        duration: 340 + Math.random() * 260,
        ease: 'Quad.Out',
        onComplete: () => debris.destroy(),
      });
    }
  }

  spawnFloatingText(x, y, text, color) {
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'Silkscreen, monospace',
        fontSize: '10px',
        color,
        stroke: '#10172d',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.layers.fx.add(label);

    this.tweens.add({
      targets: label,
      y: y - 26,
      alpha: 0,
      duration: 760,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  update(_time, delta) {
    if (!this.activeRound) return;

    this.trySendMove();

    for (const player of this.playerSprites.values()) {
      const dx = player.targetX - player.container.x;
      const dy = player.targetY - player.container.y;
      const catchUp = 1 - Math.exp(-delta / 48);

      player.container.x += dx * catchUp;
      player.container.y += dy * catchUp;

      const moving = Math.abs(dx) + Math.abs(dy) > 0.7;
      if (moving) player.walkClock += delta;
      else player.walkClock = 0;

      const side = player.dir === 'left' || player.dir === 'right';
      const direction = side ? 'side' : player.dir === 'up' ? 'up' : 'down';
      const frame = moving ? Math.floor(player.walkClock / WALK_FRAME_MS) % 2 : 0;
      const key = `player-${player.colorIndex}-${direction}-${frame}`;

      if (player.sprite.texture.key !== key) player.sprite.setTexture(key);
      player.sprite.setFlipX(player.dir === 'left');
      player.sprite.setAlpha(
        player.invulnerable && Math.floor(this.time.now / 90) % 2 === 0 ? 0.35 : 1,
      );
    }

    for (const [id, bomb] of this.bombSprites.entries()) {
      const frame = Math.floor(this.time.now / 140 + id * 0.35) % 3;
      const key = `bomb-${frame}`;
      if (bomb.sprite.texture.key !== key) bomb.sprite.setTexture(key);
      bomb.sprite.setAlpha(bomb.fuseLeftMs < 700 && Math.floor(this.time.now / 85) % 2 === 0 ? 0.5 : 1);
    }

    for (const [id, coin] of this.coinSprites.entries()) {
      const frame = Math.floor(this.time.now / 150 + coin.phase) % 4;
      const key = `coin-${frame}`;
      if (coin.sprite.texture.key !== key) coin.sprite.setTexture(key);
      coin.sprite.x = coin.baseX;
      coin.sprite.y = coin.baseY + Math.sin(this.time.now / 330 + id) * 2;
    }

    for (const [key, flame] of this.flameSprites.entries()) {
      const frame = Math.floor(this.time.now / 75 + key.length) % 3;
      const texture = `flame-${flame.kind}-${frame}`;
      if (flame.sprite.texture.key !== texture) flame.sprite.setTexture(texture);
    }
  }
}
