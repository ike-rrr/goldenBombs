import { PLAYER_COLORS } from './palette.js';

const PLAYER_DOWN = [
  '................',
  '.....OOOOOO.....',
  '....OLLLLLLO....',
  '...OLLBBBBLLO...',
  '...OLBBBBBBLO...',
  '..OBBBBBBBBBBO..',
  '..OBWWBBBBWWBO..',
  '..OBWKBBBBWKBO..',
  '..OBBBBBBBBBBO..',
  '...OBBSSSSBBO...',
  '....OBBBBBBO....',
  '....OBBBBBBO....',
  '...OBBO..OBBO...',
  '...OBBO..OBBO...',
  '...OLLO..OLLO...',
  '....OO....OO....',
];

const PLAYER_UP = [
  '................',
  '.....OOOOOO.....',
  '....OLLLLLLO....',
  '...OLLBBBBLLO...',
  '...OLBBBBBBLO...',
  '..OBBBBBBBBBBO..',
  '..OBBBBBBBBBBO..',
  '..OBBLLLLLLBBO..',
  '..OBBBBBBBBBBO..',
  '...OBBSSSSBBO...',
  '....OBBBBBBO....',
  '....OBBBBBBO....',
  '...OBBO..OBBO...',
  '...OBBO..OBBO...',
  '...OLLO..OLLO...',
  '....OO....OO....',
];

const PLAYER_SIDE = [
  '................',
  '.....OOOOOO.....',
  '....OLLLLLLO....',
  '...OLLBBBBLLO...',
  '...OLBBBBBBLO...',
  '..OBBBBBBBBBBO..',
  '..OBBBBBBWWBBO..',
  '..OBBBBBBWKBBO..',
  '..OBBBBBBBBBBO..',
  '...OBBSSSSBBO...',
  '....OBBBBBBO....',
  '....OBBBBBBO....',
  '...OBBO..OBBO...',
  '...OBBO..OBBO...',
  '...OLLO..OLLO...',
  '....OO....OO....',
];

const BOMB = [
  '................',
  '................',
  '................',
  '................',
  '.....OOOOOO.....',
  '....OBBBBBBO....',
  '...OBBBBBBBBO...',
  '...OBBLLBBBBO...',
  '..OBBLLBBBBBBO..',
  '..OBBBBBBBBBBO..',
  '..OBBBBBBBBBBO..',
  '..OBBBBBBBBBBO..',
  '...OBBBBBBBBO...',
  '....OBBBBBBO....',
  '.....OOOOOO.....',
  '................',
];

const YOU_ARROW = [
  '...GG...',
  '..GGGG..',
  '.GGGGGG.',
  'GGGGGGGG',
  '........',
];

function walking(matrix) {
  const copy = [...matrix];
  copy[12] = '..OBBO....OBBO..';
  copy[13] = '..OBBO....OBBO..';
  copy[14] = '..OLLO....OLLO..';
  copy[15] = '...OO......OO...';
  return copy;
}

function hash2d(x, y, seed = 0) {
  let value = Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263) + seed * 69069;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function makeTexture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height);
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  draw(context);
  texture.refresh();
}

function fillPixels(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

function paintMatrix(context, matrix, palette) {
  matrix.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      const color = palette[symbol];
      if (!color) return;
      fillPixels(context, x, y, 1, 1, color);
    });
  });
}

function paintPlayerFrame(context, matrix, palette) {
  paintMatrix(context, matrix, {
    O: palette.dark,
    B: palette.body,
    L: palette.light,
    S: palette.shade,
    W: '#fff8df',
    K: '#0b1027',
  });
}

function paintGrass(context, variant) {
  const base = ['#61c84b', '#5cc247', '#67cf50', '#5ec84a'][variant % 4];
  const dark = ['#47a638', '#459f36', '#4bad3b', '#44a137'][variant % 4];
  const light = ['#7adb61', '#76d65d', '#84e36a', '#7adf63'][variant % 4];

  fillPixels(context, 0, 0, 16, 16, base);

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const noise = hash2d(x, y, variant + 11);
      if (noise < 0.1) fillPixels(context, x, y, 1, 1, dark);
      else if (noise > 0.91) fillPixels(context, x, y, 1, 1, light);
    }
  }

  const tuftX = 2 + Math.floor(hash2d(variant, 4, 5) * 12);
  const tuftY = 3 + Math.floor(hash2d(3, variant, 9) * 11);
  fillPixels(context, tuftX, tuftY, 1, 3, dark);
  fillPixels(context, tuftX - 1, tuftY + 1, 1, 2, dark);
  fillPixels(context, tuftX + 1, tuftY, 1, 2, dark);

  if (hash2d(variant, 8, 13) > 0.6) {
    fillPixels(context, 11, 4, 1, 1, light);
    fillPixels(context, 10, 5, 1, 1, dark);
  }
}

function paintStone(context, variant) {
  fillPixels(context, 0, 0, 16, 16, '#17203d');
  fillPixels(context, 1, 1, 14, 14, '#5b6f9e');
  fillPixels(context, 1, 1, 14, 2, '#8ea4d2');
  fillPixels(context, 1, 1, 2, 14, '#7a8fbe');
  fillPixels(context, 1, 12, 14, 3, '#39466f');
  fillPixels(context, 12, 1, 3, 14, '#43517d');

  fillPixels(context, 1, 7, 14, 1, '#2d3858');
  fillPixels(context, 7, 1, 1, 7, '#2d3858');
  fillPixels(context, 4, 8, 1, 7, '#2d3858');

  const speck = hash2d(variant, 3, 21);
  fillPixels(context, 3 + Math.floor(speck * 5), 4, 1, 1, '#aabce6');
  fillPixels(context, 9, 10 + Math.floor(speck * 2), 2, 1, '#4a5884');
}

function paintBrick(context, variant) {
  fillPixels(context, 0, 0, 16, 16, '#4a1e12');
  fillPixels(context, 1, 1, 14, 14, '#cf6a3c');
  fillPixels(context, 1, 1, 14, 2, '#f2a264');
  fillPixels(context, 1, 1, 2, 14, '#e88b51');
  fillPixels(context, 1, 12, 14, 3, '#9a4325');
  fillPixels(context, 12, 1, 3, 14, '#a94c2a');

  fillPixels(context, 1, 5, 14, 1, '#672d1b');
  fillPixels(context, 1, 10, 14, 1, '#672d1b');
  fillPixels(context, 6, 1, 1, 5, '#672d1b');
  fillPixels(context, 10, 6, 1, 5, '#672d1b');
  fillPixels(context, 3, 11, 1, 4, '#672d1b');

  if (variant % 2 === 0) {
    fillPixels(context, 12, 3, 1, 1, '#672d1b');
    fillPixels(context, 11, 4, 1, 1, '#672d1b');
    fillPixels(context, 4, 7, 1, 2, '#f2a264');
  } else {
    fillPixels(context, 8, 2, 1, 2, '#672d1b');
    fillPixels(context, 9, 4, 1, 1, '#f2a264');
  }
}

function paintFlower(context, variant) {
  const petal = variant === 0 ? '#ff7eb6' : variant === 1 ? '#ffe45c' : '#f7f2d0';
  const center = variant === 0 ? '#ffe45c' : '#ff9f1c';
  const stem = '#2f7d27';

  fillPixels(context, 7, 9, 1, 4, stem);
  fillPixels(context, 6, 11, 1, 1, stem);

  fillPixels(context, 7, 5, 2, 1, petal);
  fillPixels(context, 6, 6, 1, 2, petal);
  fillPixels(context, 9, 6, 1, 2, petal);
  fillPixels(context, 7, 8, 2, 1, petal);
  fillPixels(context, 7, 6, 2, 2, center);
  fillPixels(context, 7, 6, 1, 1, '#fff8df');
}

function paintPebble(context) {
  fillPixels(context, 7, 8, 3, 2, '#7b8aa8');
  fillPixels(context, 7, 8, 2, 1, '#aebbd4');
  fillPixels(context, 10, 9, 1, 1, '#58657e');
}

function paintShadow(context) {
  const rows = [6, 10, 12, 14, 14, 12, 10, 6];
  rows.forEach((width, index) => {
    const left = Math.floor((16 - width) / 2);
    fillPixels(context, left, index + 4, width, 1, 'rgba(7, 14, 31, 0.32)');
  });
}

function paintCoin(context, frame) {
  const widths = [11, 8, 4, 8];
  const width = widths[frame % 4];
  const left = Math.floor((16 - width) / 2);
  const top = 2;
  const height = 12;

  fillPixels(context, left, top + 1, width, height - 2, '#8a4b00');
  fillPixels(context, left + 1, top, Math.max(1, width - 2), height, '#8a4b00');
  fillPixels(context, left + 1, top + 2, Math.max(1, width - 2), height - 4, '#ffd447');
  fillPixels(context, left + 1, top + 2, Math.max(1, width - 4), 2, '#fff3b0');
  fillPixels(context, left + 1, top + height - 4, Math.max(1, width - 2), 2, '#e69a12');

  if (width >= 8) {
    fillPixels(context, left + 2, top + 4, 1, 4, '#fff8df');
    fillPixels(context, left + width - 3, top + 5, 1, 3, '#c57a06');
  }

  if (frame === 0) {
    fillPixels(context, 13, 3, 1, 1, '#fff8df');
  }
}

// Special gems use a cyan/violet faceted diamond so they stand out from coins.
function paintGem(context, frame) {
  const outline = '#2b1a55';
  const deep = '#45217f';
  const mid = '#6b3fd6';
  const light = '#a68bff';
  const cyan = '#7ee6ff';
  const shine = '#d9f7ff';

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = Math.abs(x - 7.5);
      const dy = Math.abs(y - 7.5);
      const radius = dx + dy;
      if (radius > 7.2) continue;

      let color = outline;
      if (radius < 6.2) {
        if (radius < 2.8) color = cyan;
        else if (x < 7) color = y < 8 ? mid : deep;
        else color = y < 8 ? light : mid;
        if (x === 7 || y === 7) color = radius < 4.2 ? shine : color;
      }
      fillPixels(context, x, y, 1, 1, color);
    }
  }

  const sparkles = [
    [
      [5, 4],
      [11, 9],
    ],
    [
      [6, 3],
      [10, 10],
      [12, 8],
    ],
    [
      [7, 4],
      [11, 7],
    ],
    [
      [5, 5],
      [9, 11],
      [12, 7],
    ],
  ][frame % 4];

  for (const [x, y] of sparkles) {
    if (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 6.2) {
      fillPixels(context, x, y, 1, 1, '#ffffff');
    }
  }
}

function paintBomb(context, frame) {
  paintMatrix(context, BOMB, {
    O: '#11152d',
    B: '#343a72',
    L: '#5f68b8',
  });

  const spark = [
    [
      [10, 2],
      [11, 1],
      [9, 2],
    ],
    [
      [10, 1],
      [12, 2],
      [9, 3],
    ],
    [
      [9, 2],
      [8, 1],
      [11, 3],
    ],
  ][frame % 3];

  for (const [x, y] of spark) fillPixels(context, x, y, 1, 1, '#ffb703');
  fillPixels(context, spark[0][0], spark[0][1] - 1, 1, 1, '#fff3b0');
  fillPixels(context, 10, 3, 1, 1, '#8a4b00');
}

function rotateLevels(levels, turns) {
  let source = levels;
  for (let turn = 0; turn < turns; turn += 1) {
    const rotated = Array.from({ length: 16 }, () => Array(16).fill(0));
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        rotated[y][x] = source[15 - x][y];
      }
    }
    source = rotated;
  }
  return source;
}

function flameLevels(kind, frame) {
  const levels = Array.from({ length: 16 }, () => Array(16).fill(0));

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const jitter = hash2d(x, y, frame + 37) * 1.2;
      let level = 0;

      if (kind === 'center') {
        const radius = Math.max(Math.abs(dx), Math.abs(dy));
        if (radius < 7.4 + jitter * 0.4) level = 1;
        if (radius < 5.5 + jitter * 0.35) level = 2;
        if (radius < 3.5 + jitter * 0.25) level = 3;
        if (radius < 1.9) level = 4;
      } else if (kind === 'up') {
        const halfWidth = 5.3 + Math.sin(((y + frame * 4) / 16) * Math.PI) * 0.7;
        if (Math.abs(dx) <= halfWidth + jitter * 0.2) level = 1;
        if (Math.abs(dx) <= halfWidth - 1.4) level = 2;
        if (Math.abs(dx) <= halfWidth - 2.9) level = 3;
        if (Math.abs(dx) < 1.2 && y > 5) level = 4;
      } else if (kind === 'end-up') {
        const halfWidth = 1.7 + (y / 15) * 3.5 + jitter * 0.2;
        if (Math.abs(dx) <= halfWidth) level = 1;
        if (Math.abs(dx) <= halfWidth - 1.1) level = 2;
        if (Math.abs(dx) <= halfWidth - 2.1) level = 3;
        if (Math.abs(dx) < 1.1 && y > 9) level = 4;
      }

      if (level === 1 && hash2d(x, y, frame + 77) < 0.12) level = 0;
      levels[y][x] = level;
    }
  }

  return levels;
}

function paintFlame(context, levels) {
  const colors = [
    null,
    '#ff4f38',
    '#ff9f35',
    '#ffe15c',
    '#fff8df',
  ];

  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const level = levels[y][x];
      if (!level) continue;
      fillPixels(context, x, y, 1, 1, colors[level]);
    }
  }
}

function paintYouArrow(context) {
  paintMatrix(context, YOU_ARROW, {
    G: '#ffd447',
  });
  fillPixels(context, 3, 0, 2, 1, '#fff3b0');
}

function paintSpark(context, gold = false) {
  const main = gold ? '#ffd447' : '#fff8df';
  fillPixels(context, 1, 0, 1, 3, main);
  fillPixels(context, 0, 1, 3, 1, main);
  fillPixels(context, 1, 1, 1, 1, '#ffffff');
}

function paintDebris(context, color, highlight) {
  fillPixels(context, 0, 1, 4, 3, color);
  fillPixels(context, 1, 0, 2, 1, color);
  fillPixels(context, 0, 1, 2, 1, highlight);
}

// Range pickups are deliberately bright red so their effect can be recognized
// instantly; speed pickups use an cyan lightning bolt for contrast.
function paintRangePowerup(context) {
  fillPixels(context, 3, 1, 10, 2, '#8b0f27');
  fillPixels(context, 2, 3, 12, 10, '#8b0f27');
  fillPixels(context, 3, 13, 10, 2, '#8b0f27');
  fillPixels(context, 3, 2, 10, 11, '#e5233f');
  fillPixels(context, 4, 3, 8, 2, '#ff7b7b');
  fillPixels(context, 3, 4, 2, 7, '#ff4f5f');
  fillPixels(context, 11, 4, 2, 8, '#a8112f');
  fillPixels(context, 4, 12, 8, 1, '#a8112f');
  fillPixels(context, 7, 4, 2, 8, '#fff8df');
  fillPixels(context, 5, 7, 6, 2, '#fff8df');
  fillPixels(context, 7, 5, 2, 1, '#ffd447');
}

function paintSpeedPowerup(context) {
  fillPixels(context, 4, 1, 8, 2, '#0b6e93');
  fillPixels(context, 3, 3, 10, 10, '#0b6e93');
  fillPixels(context, 4, 13, 8, 2, '#0b6e93');
  fillPixels(context, 4, 2, 8, 11, '#28c7ef');
  fillPixels(context, 5, 3, 6, 2, '#b9f4ff');
  fillPixels(context, 3, 4, 2, 7, '#7ee6ff');
  fillPixels(context, 11, 4, 2, 8, '#0b6e93');
  fillPixels(context, 4, 12, 8, 1, '#0b6e93');
  fillPixels(context, 9, 3, 3, 4, '#fff8df');
  fillPixels(context, 6, 6, 4, 4, '#fff8df');
  fillPixels(context, 4, 9, 4, 4, '#fff8df');
  fillPixels(context, 3, 12, 3, 2, '#ffd447');
}

function paintRangeAura(context) {
  for (let index = 0; index < 16; index += 1) {
    const edge = index < 2 || index > 13;
    if (edge) {
      fillPixels(context, index, 0, 1, 1, '#ff4f5f');
      fillPixels(context, index, 15, 1, 1, '#ff4f5f');
    }
    if (index % 2 === 0) {
      fillPixels(context, 0, index, 1, 1, '#e5233f');
      fillPixels(context, 15, index, 1, 1, '#e5233f');
    }
  }
}

function paintSpeedAura(context) {
  fillPixels(context, 1, 4, 2, 3, '#7ee6ff');
  fillPixels(context, 4, 6, 2, 4, '#28c7ef');
  fillPixels(context, 7, 5, 2, 6, '#b9f4ff');
  fillPixels(context, 10, 6, 2, 4, '#28c7ef');
  fillPixels(context, 13, 4, 2, 3, '#7ee6ff');
}

export function buildTextures(scene) {
  for (let variant = 0; variant < 4; variant += 1) {
    makeTexture(scene, `grass-${variant}`, 16, 16, (context) =>
      paintGrass(context, variant),
    );
  }

  for (let variant = 0; variant < 2; variant += 1) {
    makeTexture(scene, `wall-stone-${variant}`, 16, 16, (context) =>
      paintStone(context, variant),
    );
    makeTexture(scene, `wall-brick-${variant}`, 16, 16, (context) =>
      paintBrick(context, variant),
    );
  }

  for (let variant = 0; variant < 3; variant += 1) {
    makeTexture(scene, `flower-${variant}`, 16, 16, (context) =>
      paintFlower(context, variant),
    );
  }
  makeTexture(scene, 'pebble', 16, 16, paintPebble);
  makeTexture(scene, 'shadow', 16, 16, paintShadow);

  PLAYER_COLORS.forEach((palette, colorIndex) => {
    const directions = [
      ['down', PLAYER_DOWN],
      ['up', PLAYER_UP],
      ['side', PLAYER_SIDE],
    ];

    for (const [direction, matrix] of directions) {
      const frames = [matrix, walking(matrix)];
      frames.forEach((frameMatrix, frame) => {
        makeTexture(
          scene,
          `player-${colorIndex}-${direction}-${frame}`,
          16,
          16,
          (context) => paintPlayerFrame(context, frameMatrix, palette),
        );
      });
    }
  });

  for (let frame = 0; frame < 4; frame += 1) {
    makeTexture(scene, `coin-${frame}`, 16, 16, (context) =>
      paintCoin(context, frame),
    );
    makeTexture(scene, `gem-${frame}`, 16, 16, (context) =>
      paintGem(context, frame),
    );
  }

  makeTexture(scene, 'powerup-range', 16, 16, paintRangePowerup);
  makeTexture(scene, 'powerup-speed', 16, 16, paintSpeedPowerup);
  makeTexture(scene, 'aura-range', 16, 16, paintRangeAura);
  makeTexture(scene, 'aura-speed', 16, 16, paintSpeedAura);

  for (let frame = 0; frame < 3; frame += 1) {
    makeTexture(scene, `bomb-${frame}`, 16, 16, (context) =>
      paintBomb(context, frame),
    );
  }

  const flameKinds = ['center', 'up', 'end-up'];
  const rotations = {
    up: 0,
    right: 1,
    down: 2,
    left: 3,
  };

  for (const baseKind of flameKinds) {
    for (let frame = 0; frame < 3; frame += 1) {
      const levels = flameLevels(baseKind, frame);

      for (const [direction, turns] of Object.entries(rotations)) {
        const kind = baseKind === 'up' ? direction : baseKind === 'end-up' ? `end-${direction}` : 'center';
        if (baseKind === 'center' && direction !== 'up') continue;

        const rotated = rotateLevels(levels, turns);
        makeTexture(scene, `flame-${kind}-${frame}`, 16, 16, (context) =>
          paintFlame(context, rotated),
        );
      }
    }
  }

  makeTexture(scene, 'you-arrow', 8, 5, paintYouArrow);
  makeTexture(scene, 'spark-white', 3, 3, (context) => paintSpark(context, false));
  makeTexture(scene, 'spark-gold', 3, 3, (context) => paintSpark(context, true));
  makeTexture(scene, 'debris-brick', 4, 4, (context) =>
    paintDebris(context, '#b5542c', '#f2a264'),
  );
  makeTexture(scene, 'debris-stone', 4, 4, (context) =>
    paintDebris(context, '#4f5f8c', '#9fb2dd'),
  );
}

export { hash2d };
