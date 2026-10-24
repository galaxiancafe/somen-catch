// Draws everything into a 180×320 buffer, then scales it to the screen by a
// whole number with smoothing off so every pixel stays square and sharp.

import { BUFFER_W as W, BUFFER_H as H } from './path.js';
import { handPhase } from './catch.js';
import {
  PAL, GRADE_COLOR, STAR, px, line, fillEllipse, drawGrid, rng, drawText, drawTextCentered, textWidth,
} from './sprites.js';

export const MUTE_BTN = { x: 164, y: 2, w: 14, h: 14, id: 'mute' };
export const QUIT_BTN = { x: 2, y: 2, w: 14, h: 14, id: 'quit' };
export const CUP = { x: 138, y: 258, w: 30, h: 36 };
const COUNTER_Y = 288;

export function hit(b, p) {
  return !!p && p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
}

export function selectButtons(n) {
  return Array.from({ length: n }, (_, i) => ({ x: 16, y: 72 + i * 46, w: 148, h: 38, id: i }));
}

export function resultButtons(hasNext) {
  const ids = hasNext ? ['retry', 'next', 'levels'] : ['retry', 'levels'];
  const w = 46;
  const gap = 5;
  const x0 = Math.round((W - (ids.length * w + (ids.length - 1) * gap)) / 2);
  const label = { retry: 'RETRY', next: 'NEXT', levels: 'LEVELS' };
  return ids.map((id, i) => ({ x: x0 + i * (w + gap), y: 250, w, h: 18, id, label: label[id] }));
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createRenderer(canvas, path) {
  const buf = makeCanvas(W, H);
  const g = buf.getContext('2d');
  const out = canvas.getContext('2d');
  const bg = buildBackground(path);
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    scale = Math.max(1, Math.floor(Math.min(canvas.width / W, canvas.height / H)));
    offX = Math.floor((canvas.width - W * scale) / 2);
    offY = Math.floor((canvas.height - H * scale) / 2);
  }

  function present() {
    out.imageSmoothingEnabled = false;
    out.fillStyle = PAL.letterbox;
    out.fillRect(0, 0, canvas.width, canvas.height);
    out.drawImage(buf, 0, 0, W, H, offX, offY, W * scale, H * scale);
  }

  function toBuffer(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * dpr - offX) / scale,
      y: ((clientY - r.top) * dpr - offY) / scale,
    };
  }

  return { g, bg, resize, present, toBuffer, get scale() { return scale; } };
}

// ---------- static background (built once) ----------

function blob(g, cx, cy, r, c) {
  fillEllipse(g, cx, cy, r, r, c);
}

function buildBackground(path) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const r = rng(11);

  // Garden ground around the flume.
  px(g, 0, 0, W, H, PAL.ground);
  for (let i = 0; i < 900; i++) px(g, r() * W, 96 + r() * (COUNTER_Y - 96), 1, 1, PAL.groundDark);
  for (let i = 0; i < 24; i++) blob(g, r() * W, 110 + r() * 170, 2 + r() * 5, PAL.leafMid);
  // White pebble beds beside the flume (like the photo).
  for (let i = 0; i < 260; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const y = 120 + r() * 166;
    const s = path.sAtY(y);
    const p = path.at(Math.min(1, Math.max(0, s)));
    const x = p.x + side * (p.width / 2 + 3 + r() * 14 * p.scale + 2);
    px(g, x, y, 1 + (r() < 0.3), 1, r() < 0.35 ? PAL.pebbleDark : PAL.pebble);
  }

  // Foliage band at the top.
  px(g, 0, 0, W, 100, PAL.leafDark);
  for (let i = 0; i < 18; i++) px(g, r() * W, r() * 30, 2 + r() * 4, 1 + r() * 2, PAL.sky);
  for (let i = 0; i < 90; i++) {
    const y = r() * 96;
    blob(g, r() * W, y, 2 + r() * 7, r() < 0.5 ? PAL.leafMid : y < 40 && r() < 0.5 ? PAL.leafLight : PAL.leafMid);
  }
  for (let i = 0; i < 60; i++) px(g, r() * W, r() * 96, 1, 1, PAL.mossHi);

  // Mossy boulders around the waterfall and along the top edge of the garden.
  const rocks = [[10, 92, 14, 9], [58, 94, 12, 8], [140, 92, 22, 11], [174, 84, 14, 12], [104, 98, 10, 6], [32, 100, 10, 5]];
  for (const [x, y, rx, ry] of rocks) {
    fillEllipse(g, x, y, rx, ry, PAL.rockDark);
    fillEllipse(g, x - 1, y - 1, rx - 2, ry - 2, PAL.rock);
    fillEllipse(g, x - 3, y - ry + 3, Math.max(2, rx - 5), 2, PAL.moss);
    px(g, x - rx / 2, y - 1, 2, 1, PAL.rockHi);
  }

  // Waterfall pool.
  fillEllipse(g, 32, 90, 18, 4, PAL.waterDeep);
  fillEllipse(g, 32, 89, 14, 2, PAL.water);

  // Stone basin where the flume ends.
  fillEllipse(g, path.cx, COUNTER_Y + 5, 40, 7, PAL.rockDark);
  fillEllipse(g, path.cx, COUNTER_Y + 4, 37, 5, PAL.rock);
  fillEllipse(g, path.cx, COUNTER_Y + 4, 32, 3, PAL.waterDeep);

  // Wooden counter in the foreground.
  px(g, 0, COUNTER_Y, path.cx - 41, H - COUNTER_Y, PAL.wood);
  px(g, path.cx + 41, COUNTER_Y, W, H - COUNTER_Y, PAL.wood);
  px(g, 0, COUNTER_Y + 11, W, H - COUNTER_Y - 11, PAL.wood);
  px(g, 0, COUNTER_Y, path.cx - 41, 1, PAL.woodHi);
  px(g, path.cx + 41, COUNTER_Y, W, 1, PAL.woodHi);
  for (let i = 0; i < 40; i++) {
    const y = COUNTER_Y + 2 + Math.floor(r() * 20);
    const x = r() * W;
    if (y < COUNTER_Y + 11 && Math.abs(x - path.cx) < 44) continue;
    px(g, x, y, 4 + r() * 14, 1, PAL.woodDark);
  }
  px(g, 0, H - 6, W, 6, PAL.woodDark);
  px(g, 0, H - 6, W, 1, PAL.woodHi);
  return c;
}

// ---------- animated scene ----------

function frac(v) {
  return v - Math.floor(v);
}

function drawWaterfall(g, t) {
  for (let x = 20; x <= 44; x++) {
    const hx = ((x * 73) % 97) / 97;
    for (let y = 0; y < 86; y += 1) {
      const k = frac((y - t * 70) / 14 + hx * 3);
      const c = x === 20 || x === 44 ? PAL.fallEdge : k < 0.22 ? PAL.waterHi : k < 0.6 ? PAL.fall : PAL.fallEdge;
      px(g, x, y, 1, 1, c);
    }
  }
  // Foam at the bottom.
  for (let i = 0; i < 10; i++) {
    const x = 20 + ((i * 37 + Math.floor(t * 12) * 11) % 26);
    px(g, x, 85 + (i % 3), 2, 1, PAL.waterHi);
  }
}

function inCover(covers, s) {
  for (const [a, b] of covers) if (s >= a && s <= b) return true;
  return false;
}

// A closed bamboo tube row: no water, a highlight band, darker right side.
function drawTubeRow(g, xl, xr, y, ring) {
  const w = xr - xl + 1;
  px(g, xl, y, w, 1, ring ? PAL.node : PAL.bamboo);
  if (ring) return;
  px(g, xl, y, 1, 1, PAL.bambooDark);
  px(g, Math.round(xl + w * 0.22), y, Math.max(1, Math.round(w * 0.14)), 1, PAL.bambooHi);
  px(g, Math.round(xr - w * 0.18), y, Math.max(1, Math.round(w * 0.18)), 1, PAL.bambooDark);
}

function drawFlume(g, path, t, covers = []) {
  const yTop = Math.ceil(path.at(0).y);
  const yBot = Math.floor(path.at(1).y);
  // Spout at the far end.
  const top = path.at(0);
  fillEllipse(g, top.x, yTop - 3, Math.round(top.width / 2) + 1, 3, PAL.bambooDark);
  fillEllipse(g, top.x, yTop - 3, Math.round(top.width / 2) - 1, 2, PAL.bambooInner);
  px(g, top.x - 1, yTop - 3, 3, 3, PAL.water);
  let prevNode = null;
  let prevCover = false;
  let prevRing = null;
  for (let y = yTop; y <= yBot; y++) {
    const s = path.sAtY(y + 0.5);
    if (s < 0 || s > 1) continue;
    const p = path.at(s);
    const half = p.width / 2;
    const wall = Math.max(1, Math.round(5 * p.scale));
    const xl = Math.round(p.x - half);
    const xr = Math.round(p.x + half);
    px(g, xl - 1, y, 1, 1, PAL.shadow);
    px(g, xr + 1, y, 1, 1, PAL.shadow);
    const covered = inCover(covers, s);
    if (covered) {
      // Slightly wider than the open flume, with rings at both ends and along it.
      const ring = Math.floor(s * 14);
      drawTubeRow(g, xl - 1, xr + 1, y, !prevCover || (prevRing !== null && ring !== prevRing));
      prevRing = ring;
      prevCover = true;
      prevNode = Math.floor(s * 6);
      continue;
    }
    if (prevCover) px(g, xl - 1, y, xr - xl + 3, 1, PAL.node);
    prevCover = false;
    prevRing = null;
    px(g, xl, y, wall, 1, PAL.bamboo);
    px(g, xr - wall + 1, y, wall, 1, PAL.bamboo);
    px(g, xl, y, 1, 1, PAL.bambooDark);
    px(g, xr, y, 1, 1, PAL.bambooDark);
    px(g, xl + wall - 1, y, 1, 1, PAL.bambooHi);
    const il = xl + wall;
    const ir = xr - wall;
    px(g, il, y, ir - il + 1, 1, PAL.bambooInner);
    const wl = Math.round(il + (ir - il) * 0.16);
    const wr = Math.round(ir - (ir - il) * 0.16);
    px(g, wl, y, wr - wl + 1, 1, PAL.water);
    // Flowing streaks: spaced evenly along the flume, so they bunch up with distance.
    for (const k of [0.2, 0.5, 0.78]) {
      if (frac(s * 22 - t * 11 + k * 3.7) < 0.2) {
        px(g, Math.round(wl + (wr - wl) * k), y, Math.max(1, Math.round(2 * p.scale)), 1, PAL.waterHi);
      }
    }
    const node = Math.floor(s * 6);
    if (prevNode !== null && node !== prevNode) {
      px(g, xl, y, wall + 1, 1, PAL.node);
      px(g, xr - wall, y, wall + 1, 1, PAL.node);
    }
    prevNode = node;
  }
}

export function drawTomato(g, x, y, scale) {
  const r = Math.max(1, Math.round(5.5 * scale));
  fillEllipse(g, x, y, r, r, PAL.tomatoDark);
  fillEllipse(g, x - (r > 2 ? 1 : 0), y - (r > 2 ? 1 : 0), Math.max(1, r - 1), Math.max(1, r - 1), PAL.tomato);
  if (r > 1) px(g, x - Math.ceil(r / 2), y - Math.ceil(r / 2), 1, 1, PAL.tomatoHi);
  px(g, x - (r > 2 ? 1 : 0), y - r - 1, r > 2 ? 3 : 1, 1, PAL.leafLight);
}

export function drawLeaf(g, x, y, scale, c = PAL.momiji, dark = PAL.momijiDark) {
  const r = Math.max(2, Math.round(7.5 * scale));
  line(g, x, y + 1, x, y + r, dark); // stem
  for (const [dx, dy] of [[0, -1], [-0.95, -0.35], [0.95, -0.35], [-0.6, 0.75], [0.6, 0.75]]) {
    line(g, x, y, x + dx * r, y + dy * r, c);
  }
  fillEllipse(g, x, y, Math.max(1, Math.round(r * 0.45)), Math.max(1, Math.round(r * 0.45)), c);
  px(g, x, y, 1, 1, dark);
}

function drawBundles(g, path, flow, t, covers = []) {
  for (const b of flow.bundles) {
    if (b.state !== 'flow') continue;
    if (b.kind !== 'noodle') {
      const sC = b.sHead - b.bodyFromHead;
      if (sC <= 0 || sC > 1 || inCover(covers, sC)) continue;
      const p = path.at(sC);
      const x = Math.round(p.x + Math.sin(sC * 50 + t * 5 + b.id) * 1.5 * p.scale);
      if (b.kind === 'tomato') drawTomato(g, x, Math.round(p.y), p.scale);
      else drawLeaf(g, x, Math.round(p.y), p.scale);
      continue;
    }
    const w = b.windows;
    const headFrac = (w.head - w.good) / (w.head + w.tail);
    const bodyFrac = (2 * w.good) / (w.head + w.tail);
    const sHead = Math.min(1, b.sHead);
    const sTail = Math.max(0, b.sHead - b.len);
    if (sHead <= 0 || sTail >= 1) continue;
    const yHead = Math.floor(path.at(sHead).y);
    const yTail = Math.ceil(path.at(sTail).y);
    for (let y = yTail; y <= yHead; y++) {
      const s = path.sAtY(y + 0.5);
      if (s < sTail || s > sHead || inCover(covers, s)) continue;
      const p = path.at(s);
      const u = (b.sHead - s) / b.len; // 0 head → 1 tail end
      let wf;
      if (u < headFrac) wf = 0.55 + 0.45 * (u / headFrac);
      else if (u < headFrac + bodyFrac) wf = 1;
      else wf = 1 - 0.7 * ((u - headFrac - bodyFrac) / (1 - headFrac - bodyFrac));
      const w = Math.max(2, Math.round(22 * p.scale * wf));
      const cx = p.x + Math.sin(s * 50 + t * 5 + b.id) * 1.5 * p.scale;
      const x0 = Math.round(cx - w / 2);
      const far = p.scale < 0.36;
      const tailEnd = u > headFrac + bodyFrac;
      for (let i = 0; i < w; i++) {
        if (tailEnd && (i + y) % 2 === 1 && w > 2) continue; // thinning strands
        const k = (i + Math.floor(s * 300) + b.id) % 4;
        const c = far ? PAL.noodleHi : i === 0 ? PAL.noodleHi : k === 0 ? PAL.noodleShadow : PAL.noodle;
        px(g, x0 + i, y, 1, 1, c);
      }
    }
  }
}

function ease(p) {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function lerpP(a, b, e) {
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
}

const HANG = { PERFECT: [7, 24], GOOD: [5, 18], TAIL: [2, 10] };

export function handPose(path, hand, sCatch) {
  const c = path.at(sCatch);
  const T0 = { x: c.x - 4, y: Math.round(c.y) };
  const dipped = { x: T0.x, y: T0.y + 3 };
  const lifted = { x: T0.x + 8, y: T0.y - 36 };
  const cupTip = { x: CUP.x + CUP.w / 2 - 2, y: CUP.y - 18 };
  const OFF0 = { x: 76, y: -10 };
  const OFF1 = { x: 24, y: -20 };
  const { name, p } = handPhase(hand);
  const e = ease(p);
  let tip = T0;
  let gap = 5;
  let off = OFF0;
  let hang = 0;
  if (name === 'dip') {
    tip = lerpP(T0, dipped, e);
    gap = 5 * (1 - e);
  } else if (name === 'lift') {
    tip = lerpP(dipped, lifted, e);
    gap = 0;
    hang = 1;
  } else if (name === 'toCup') {
    tip = lerpP(lifted, cupTip, e);
    off = lerpP(OFF0, OFF1, e);
    gap = 0;
    hang = 1 - Math.max(0, (p - 0.55) / 0.45);
  } else if (name === 'return') {
    if (hand.flick) {
      tip = lerpP(dipped, T0, e);
    } else {
      tip = lerpP(cupTip, T0, e);
      off = lerpP(OFF1, OFF0, e);
    }
    gap = 5 * e;
  }
  return { tip, gap, base: { x: tip.x + off.x, y: tip.y + off.y }, hang, grade: hand.grade, kind: hand.kind };
}

const HAND_GRID = [
  '..sss.....',
  '.sssss....',
  'ssssssss..',
  'sssssssss.',
  'dsssssssss',
  'ddssssssss',
  '.ddsssssss',
  '..dddsssss',
  '....dddddd',
];

function drawHand(g, pose, t) {
  const { tip, gap, base } = pose;
  const tx = Math.round(tip.x);
  const ty = Math.round(tip.y);
  const up = Math.ceil(gap / 2);
  const down = Math.floor(gap / 2);

  // A tomato hangs from the tips; noodles hang more and longer for better catches.
  if (pose.hang > 0 && pose.kind === 'tomato') {
    if (pose.hang > 0.4) drawTomato(g, tx, ty + 4, 0.8);
  } else if (pose.hang > 0 && HANG[pose.grade]) {
    const [n, len] = HANG[pose.grade];
    const L = Math.max(1, Math.round(len * pose.hang));
    for (let k = 0; k < n; k++) {
      const spread = k - (n - 1) / 2;
      for (let j = 0; j < L; j++) {
        const x = tx + Math.round(spread * (0.4 + (j / len) * 0.8) + Math.sin(t * 6 + k + j * 0.3) * 0.6);
        px(g, x, ty + 1 + j, 1, 1, k % 2 ? PAL.noodleShadow : PAL.noodle);
      }
    }
  }

  // Chopsticks: dark underside first, then the light top.
  line(g, base.x - 1, base.y - 1, tx, ty - up + 1, PAL.chopDark);
  line(g, base.x + 1, base.y + 4, tx + 1, ty + down + 1, PAL.chopDark);
  line(g, base.x - 1, base.y - 2, tx, ty - up, PAL.chop);
  line(g, base.x + 1, base.y + 3, tx + 1, ty + down, PAL.chop);

  // Sleeve (off to the right edge) and hand.
  const bx = Math.round(base.x);
  const by = Math.round(base.y);
  px(g, bx + 8, by - 7, W, 16, PAL.sleeve);
  px(g, bx + 8, by - 7, W, 2, PAL.sleeveHi);
  px(g, bx + 8, by - 7, 2, 16, PAL.cuff);
  drawGrid(g, HAND_GRID, bx - 2, by - 4, { s: PAL.skin, d: PAL.skinShadow });
  px(g, bx - 3, by - 3, 3, 2, PAL.skin); // thumb over the top stick
}

function drawCup(g, fill) {
  const { x, y, w, h } = CUP;
  const cx = x + w / 2;
  fillEllipse(g, cx + 2, y + h, w / 2 + 2, 2, PAL.woodDark);
  for (let i = 0; i < w; i++) {
    const c = i === 0 || i >= w - 2 ? PAL.bambooDark : i < 4 ? PAL.bambooHi : i > w - 7 ? PAL.node : PAL.bamboo;
    px(g, x + i, y + 4, 1, h - 4, c);
  }
  for (let i = 5; i < w - 4; i += 3) {
    for (let j = y + 7; j < y + h - 2; j += 1) if ((i * 7 + j) % 5 !== 0) px(g, x + i, j, 1, 1, '#64983a');
  }
  px(g, x, y + Math.round(h * 0.58), w, 2, PAL.node);
  px(g, x, y + h - 3, w, 3, PAL.bambooDark);
  fillEllipse(g, cx, y + 4, w / 2, 4, PAL.bambooInner);
  fillEllipse(g, cx, y + 4, w / 2 - 3, 2, PAL.tsuyu);
  if (fill > 0) {
    const f = Math.min(1, fill);
    const rx = Math.round(4 + 8 * f);
    const ry = Math.max(1, Math.round(1 + 4 * f));
    fillEllipse(g, cx, y + 4 - ry + 1, rx, ry, PAL.noodle);
    for (let i = -rx + 1; i < rx; i += 2) px(g, cx + i, y + 4 - ry + 1 + ((i * 3) & 1), 1, ry, PAL.noodleShadow);
    px(g, cx - rx + 2, y + 4 - ry, 3, 1, PAL.noodleHi);
  }
}

function drawSpeaker(g, muted) {
  const b = MUTE_BTN;
  px(g, b.x, b.y, b.w, b.h, PAL.panel);
  px(g, b.x, b.y, b.w, 1, PAL.panelEdge);
  const x = b.x + 3;
  const y = b.y + 4;
  px(g, x, y + 2, 2, 3, PAL.text);
  for (let i = 0; i < 3; i++) px(g, x + 2 + i, y + 2 - i, 1, 3 + i * 2, PAL.text);
  if (muted) {
    line(g, x + 6, y + 1, x + 9, y + 5, PAL.miss);
    line(g, x + 9, y + 1, x + 6, y + 5, PAL.miss);
  } else {
    px(g, x + 6, y + 2, 1, 3, PAL.text);
    px(g, x + 8, y + 1, 1, 5, PAL.text);
  }
}

function drawQuit(g) {
  const b = QUIT_BTN;
  px(g, b.x, b.y, b.w, b.h, PAL.panel);
  px(g, b.x, b.y, b.w, 1, PAL.panelEdge);
  drawText(g, '<', b.x + 5, b.y + 5, PAL.text, 1, null);
}

function drawStars(g, cx, y, n, scale = 1) {
  const size = 9 * scale;
  const gap = 2 * scale;
  const x0 = Math.round(cx - (3 * size + 2 * gap) / 2);
  for (let i = 0; i < 3; i++) {
    const on = i < n;
    drawGrid(g, STAR, x0 + i * (size + gap) + scale, y + scale, { '#': PAL.textShadow }, scale);
    drawGrid(g, STAR, x0 + i * (size + gap), y, { '#': on ? PAL.gold : PAL.dim }, scale);
  }
}

function panel(g, x, y, w, h, edge = PAL.panelEdge) {
  px(g, x - 1, y - 1, w + 2, h + 2, PAL.textShadow);
  px(g, x, y, w, h, PAL.panel);
  px(g, x, y, w, 1, edge);
  px(g, x, y + h - 1, w, 1, edge);
  px(g, x, y, 1, h, edge);
  px(g, x + w - 1, y, 1, h, edge);
  px(g, x + 1, y + 1, w - 2, 1, PAL.panelHi);
}

function dim(g, a = 0.55) {
  g.fillStyle = `rgba(10,20,10,${a})`;
  g.fillRect(0, 0, W, H);
}

// Visual-only distractions, drawn behind the bundles. Positions depend only on
// time, so a retry looks the same.
function drawDistractions(g, t, cfg) {
  if (cfg.leaves) {
    for (let i = 0; i < 7; i++) {
      const period = 7 + i * 1.3;
      const phase = frac(t / period + i * 0.37);
      const y = -10 + phase * 340;
      const x = ((i * 29 + 15) % W) + Math.sin(t * 1.2 + i) * 10;
      const flip = Math.floor(t * 3 + i) % 2;
      drawLeaf(g, Math.round(x), Math.round(y), flip ? 0.4 : 0.33, PAL.momijiFaded, PAL.momijiDark);
    }
  }
  if (cfg.dragonfly) {
    const period = 6;
    const k = Math.floor((t + 1.5) / period);
    const local = (t + 1.5) - k * period;
    if (local < 2.4) {
      const u = local / 2.4;
      const dir = k % 2 ? -1 : 1;
      const x = Math.round(dir > 0 ? -10 + u * 200 : 190 - u * 200);
      const y = Math.round(140 + (k % 3) * 22 + Math.sin(u * 9) * 18);
      const up = Math.floor(t * 24) % 2;
      px(g, x - 4 * dir, y, 1, 1, PAL.dragonflyDark);
      line(g, x - 3 * dir, y, x + 3 * dir, y, PAL.dragonfly);
      px(g, x + 3 * dir, y, 2, 2, PAL.dragonflyDark);
      px(g, x - 2, y - 1 - up, 3, 1, PAL.wing);
      px(g, x + 1, y - 1 - up, 3, 1, PAL.wing);
    }
  }
}

function drawIntro(g, level, n, t) {
  if (!level.twist || t > 1.7) return;
  if (t > 1.45 && Math.floor(t * 20) % 2) return;
  panel(g, 18, 112, 144, 62, PAL.gold);
  drawTextCentered(g, `LEVEL ${n}`, W / 2, 119, PAL.dim);
  drawTextCentered(g, level.name, W / 2, 128, PAL.text, 2);
  drawTextCentered(g, level.twist, W / 2, 145, PAL.gold);
  drawTextCentered(g, level.hint, W / 2, 157, PAL.bambooHi);
}

// ---------- public draw calls ----------

export function drawWorld(g, bg, view) {
  const { path, t, flow, hand, sCatch } = view;
  const covers = view.covers || [];
  g.drawImage(bg, 0, 0);
  drawWaterfall(g, t);
  drawFlume(g, path, t, covers);
  if (view.distractions) drawDistractions(g, t, view.distractions);
  drawBundles(g, path, flow, t, covers);
  drawCup(g, view.cupFill);
  if (view.cupLabel) drawTextCentered(g, view.cupLabel, CUP.x + CUP.w / 2, COUNTER_Y + 15, PAL.text);
  drawHand(g, handPose(path, hand, sCatch), t);
  for (const q of view.particles) {
    if (q.leaf) drawLeaf(g, Math.round(q.x), Math.round(q.y), 0.5);
    else px(g, q.x, q.y, 1, 1, PAL.waterHi);
  }
  if (view.intro) drawIntro(g, view.intro.level, view.intro.n, view.intro.t);
  for (const pop of view.popups) {
    if (pop.age > 0.55 && Math.floor(pop.age * 20) % 2) continue;
    const scale = pop.big ? 2 : 1;
    drawTextCentered(g, pop.text, pop.x, pop.y - pop.age * 22, pop.color, scale);
  }
}

export function drawHUD(g, { left, combo, muted }) {
  drawQuit(g);
  drawText(g, `LEFT ${left}`, 20, 6, PAL.text);
  if (combo >= 2) drawTextCentered(g, `COMBO X${combo}`, W / 2 + 14, 6, PAL.perfect);
  drawSpeaker(g, muted);
}

export function drawTitle(g, t, muted) {
  dim(g, 0.35);
  panel(g, 30, 118, 120, 92);
  drawTextCentered(g, 'SOMEN', W / 2, 128, PAL.noodle, 4);
  drawTextCentered(g, 'CATCH', W / 2, 152, PAL.gold, 4);
  drawTextCentered(g, 'NAGASHI SOMEN', W / 2, 178, PAL.bambooHi);
  drawTextCentered(g, 'TAP OR SPACE TO CATCH', W / 2, 190, PAL.dim);
  if (Math.floor(t * 2) % 2 === 0) drawTextCentered(g, 'TAP TO START', W / 2, 228, PAL.text, 2);
  drawSpeaker(g, muted);
}

export function drawSelect(g, levels, progress, muted) {
  dim(g);
  drawTextCentered(g, 'CHOOSE A FLUME', W / 2, 40, PAL.text, 2);
  selectButtons(levels.length).forEach((b, i) => {
    const lv = levels[i];
    const locked = i >= progress.unlocked;
    const best = progress.best[lv.id];
    panel(g, b.x, b.y, b.w, b.h, locked ? PAL.dim : PAL.panelEdge);
    drawText(g, `${i + 1}`, b.x + 6, b.y + 6, locked ? PAL.dim : PAL.gold, 2);
    drawText(g, lv.name, b.x + 20, b.y + 7, locked ? PAL.dim : PAL.text);
    if (locked) {
      drawText(g, 'LOCKED', b.x + 20, b.y + 18, PAL.dim);
      drawText(g, 'GET 1 STAR ON THE LEVEL ABOVE', b.x + 20, b.y + 27, PAL.dim);
      return;
    }
    drawText(g, lv.twist || 'THE BASICS', b.x + 20, b.y + 18, PAL.bambooHi);
    drawText(g, best ? `BEST ${best.score}` : 'BEST -', b.x + 20, b.y + 27, PAL.dim);
    drawStars(g, b.x + b.w - 22, b.y + 22, best ? best.stars : 0, 1);
  });
  drawSpeaker(g, muted);
}

export function drawResults(g, { level, score, result, hasNext, muted, totals }) {
  dim(g);
  panel(g, 12, 38, 156, 238);
  drawTextCentered(g, level.name, W / 2, 48, PAL.text, 2);
  drawStars(g, W / 2, 64, result.stars, 2);
  drawTextCentered(g, `BOWL ${fmtG(score.grams)}/${totals.maxGrams}G`, W / 2, 92, PAL.noodle);
  const rows = [
    ['PERFECT', score.counts.PERFECT, PAL.perfect],
    ['GOOD', score.counts.GOOD, PAL.good],
    ['TAIL', score.counts.TAIL, PAL.tail],
    ['MISSED', score.counts.MISSED, PAL.miss],
  ];
  let y = 106;
  for (const [label, n, c] of rows) {
    drawText(g, label, 40, y, c);
    drawText(g, `${n}`, 140 - textWidth(`${n}`), y, c);
    y += 9;
  }
  px(g, 40, y, 100, 1, PAL.dim);
  y += 4;
  const row = (label, value, c) => {
    drawText(g, label, 40, y, c);
    drawText(g, value, 140 - textWidth(value), y, c);
    y += 9;
  };
  row('NOODLES', `${totals.noodles}`, PAL.text);
  if (totals.tomatoes) row('TOMATOES', `${score.tomatoes}/${totals.tomatoes}`, PAL.tomatoHi);
  if (totals.leaves) row('LEAVES CAUGHT', `${score.leaves}`, score.leaves ? PAL.miss : PAL.dim);
  drawText(g, 'MAX COMBO', 40, y, PAL.text);
  drawText(g, `${score.maxCombo}`, 140 - textWidth(`${score.maxCombo}`), y, PAL.text);
  if (score.emptyTaps) {
    y += 9;
    drawText(g, 'EMPTY TAPS', 40, y, PAL.dim);
    drawText(g, `${score.emptyTaps}`, 140 - textWidth(`${score.emptyTaps}`), y, PAL.dim);
  }
  drawTextCentered(g, `SCORE ${score.points}`, W / 2, 200, PAL.gold, 2);
  drawTextCentered(g, result.newBest ? 'NEW BEST!' : `BEST ${result.best}`, W / 2, 220, result.newBest ? PAL.good : PAL.dim);
  if (result.stars === 0) drawTextCentered(g, 'GET 1 STAR TO UNLOCK THE NEXT', W / 2, 232, PAL.dim);
  for (const b of resultButtons(hasNext)) {
    panel(g, b.x, b.y, b.w, b.h, b.id === 'next' ? PAL.gold : PAL.panelEdge);
    drawTextCentered(g, b.label, b.x + b.w / 2, b.y + 7, PAL.text);
  }
  drawSpeaker(g, muted);
}

export function fmtG(g) {
  return Number.isInteger(g) ? `${g}` : g.toFixed(1);
}
