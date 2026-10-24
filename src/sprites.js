// Palette, 3×5 pixel font and small pixel helpers. All drawing is in
// low-resolution buffer pixels.

export const PAL = {
  letterbox: '#10140f',
  leafDark: '#1d4228',
  leafMid: '#2f6b3a',
  leafLight: '#5f9a48',
  sky: '#cfe8d8',
  moss: '#7fae4e',
  mossHi: '#a8c860',
  rock: '#5d6660',
  rockDark: '#3c4440',
  rockHi: '#8a948c',
  ground: '#33502e',
  groundDark: '#283f25',
  pebble: '#cfd2c4',
  pebbleDark: '#a3a796',
  fall: '#d7eef2',
  fallEdge: '#9fc6cc',
  water: '#8fcbd6',
  waterDeep: '#4f97a8',
  waterHi: '#eafcff',
  bamboo: '#6fa53a',
  bambooDark: '#3f6e22',
  bambooHi: '#b6d86a',
  bambooInner: '#d9e7a0',
  node: '#4d7d28',
  wood: '#8a5a34',
  woodDark: '#5a3920',
  woodHi: '#a8744a',
  noodle: '#f3ead3',
  noodleHi: '#ffffff',
  noodleShadow: '#cdbf9c',
  skin: '#f0c39c',
  skinShadow: '#d39a72',
  sleeve: '#2c3e78',
  sleeveHi: '#4a5fa3',
  cuff: '#e8e4d8',
  chop: '#e2bf86',
  chopDark: '#a9834e',
  tsuyu: '#5a3418',
  shadow: '#1a2618',
  text: '#fffbe8',
  textShadow: '#14200f',
  panel: '#1f3420',
  panelEdge: '#6fa53a',
  panelHi: '#2c4a2c',
  gold: '#ffd84a',
  goldDark: '#8a6a1a',
  perfect: '#ffd84a',
  good: '#9be26b',
  tail: '#9fd3dc',
  miss: '#e57a6a',
  dim: '#7d8f78',
  tomato: '#d8392b',
  tomatoDark: '#8e1f17',
  tomatoHi: '#ff9a80',
  momiji: '#e8642a',
  momijiDark: '#9c3517',
  momijiFaded: '#b0603a',
  dragonfly: '#3a9fc7',
  dragonflyDark: '#1f5a78',
  wing: '#d8f0ff',
};

export const GRADE_COLOR = { PERFECT: PAL.perfect, GOOD: PAL.good, TAIL: PAL.tail, MISS: PAL.miss, TOMATO: PAL.tomatoHi };

export function px(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

export function line(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  g.fillStyle = c;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function fillEllipse(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry || 1))));
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

// Grid sprite: one string per row, characters map to colours, '.' is clear.
export function drawGrid(g, rows, x, y, colors, scale = 1) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const col = colors[rows[r][c]];
      if (col) px(g, x + c * scale, y + r * scale, scale, scale, col);
    }
  }
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STAR = [
  '....#....',
  '...###...',
  '...###...',
  '#########',
  '.#######.',
  '..#####..',
  '..#####..',
  '.###.###.',
  '.##...##.',
];

// 3×5 font, rows top to bottom.
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  ' ': '000000000000000', '!': '010010010000010', '.': '000000000000010', ':': '000010000010000',
  '/': '001001010100100', '-': '000000111000000', '?': '110001010000010', '<': '001010100010001',
  '>': '100010001010100', '+': '000010111010000', '%': '101001010100101',
};

export function textWidth(text, scale = 1) {
  return text.length ? text.length * 4 * scale - scale : 0;
}

export function drawText(g, text, x, y, color = PAL.text, scale = 1, shadow = PAL.textShadow) {
  text = String(text).toUpperCase();
  const pass = (ox, oy, col) => {
    g.fillStyle = col;
    let cx = Math.round(x) + ox;
    for (const ch of text) {
      const bits = GLYPHS[ch] || GLYPHS['?'];
      for (let i = 0; i < 15; i++) {
        if (bits[i] === '1') g.fillRect(cx + (i % 3) * scale, Math.round(y) + oy + ((i / 3) | 0) * scale, scale, scale);
      }
      cx += 4 * scale;
    }
  };
  if (shadow) pass(1, 1, shadow);
  pass(0, 0, color);
}

export function drawTextCentered(g, text, cx, y, color, scale = 1, shadow) {
  drawText(g, text, Math.round(cx - textWidth(String(text), scale) / 2), y, color, scale, shadow);
}
