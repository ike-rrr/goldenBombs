export const PLAYER_COLORS = [
  {
    name: 'Cyan',
    body: '#28c7ef',
    light: '#b9f4ff',
    shade: '#0b6e93',
    dark: '#10334a',
    css: '#35d0ff',
  },
  {
    name: 'Magenta',
    body: '#f0509f',
    light: '#ffd0e8',
    shade: '#9c1c60',
    dark: '#45102f',
    css: '#ff5caf',
  },
  {
    name: 'Lime',
    body: '#9ede38',
    light: '#e7ffad',
    shade: '#4f8f16',
    dark: '#243d0b',
    css: '#b8f53d',
  },
  {
    name: 'Orange',
    body: '#ff9a3d',
    light: '#ffe0ad',
    shade: '#b95811',
    dark: '#4b1f06',
    css: '#ff9a3d',
  },
  {
    name: 'Purple',
    body: '#a76bff',
    light: '#e3ccff',
    shade: '#6334a8',
    dark: '#2b124f',
    css: '#bd8bff',
  },
  {
    name: 'Red',
    body: '#ff5c5c',
    light: '#ffd0d0',
    shade: '#a82031',
    dark: '#4a0d16',
    css: '#ff7a7a',
  },
];

export function playerColor(colorIndex) {
  return PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
}
