// Waterslide tubes (shop 3). Curved tubes can loop and cross, so they can't be
// drawn one screen row at a time like the straight flumes. Instead every tube
// is drawn by stepping along its path, and each pixel keeps the nearness
// (scale) of whatever was drawn there: a depth buffer. A pixel is only
// replaced by something at least as near, so the front slide hides the one
// behind it, noodles included.
//
// The tubes and their support posts never change during a level, so they are
// drawn once into a base layer; each frame copies that and adds water streaks,
// noodles and decoys on top.

import { BUFFER_W as W, BUFFER_H as H } from './path.js';
import { PAL } from './sprites.js';

export const POOL = {
  fibre: '#7fd0e6',
  fibreDark: '#3d9fbd',
  fibreHi: '#d4f4fb',
  rim: '#ffffff',
  inner: '#bdeefa',
  water: '#4fb8dc',
  waterHi: '#eafcff',
  closed: '#68c3dc',
  closedHi: '#a9e5f3',
  post: '#d5d8dc',
  postDark: '#9a9fa6',
};

// '#rrggbb' → a pixel for ImageData's little-endian Uint32 view (0xAABBGGRR).
function rgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

const C = {};
for (const [k, v] of Object.entries({ ...POOL, ...PAL })) if (v.startsWith('#')) C[k] = rgba(v);

function frac(v) {
  return v - Math.floor(v);
}

function inCover(covers, s) {
  for (const [a, b] of covers) if (s >= a && s <= b) return true;
  return false;
}

export class CurveLayer {
  constructor(tubes) {
    this.tubes = tubes.map((t) => ({ path: t.path, covers: t.covers || [] }));
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(W, H);
    this.col = new Uint32Array(this.img.data.buffer);
    this.dep = new Float32Array(W * H);
    this.buildBase();
    this.baseCol = this.col.slice();
    this.baseDep = this.dep.slice();
  }

  plot(x, y, c, d) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (d >= this.dep[i]) {
      this.col[i] = c;
      this.dep[i] = d;
    }
  }

  disc(cx, cy, r, c, d) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (dy * dy) / (r * r || 1))));
      for (let dx = -half; dx <= half; dx++) this.plot(cx + dx, cy + dy, c, d);
    }
  }

  seg(x0, y0, x1, y1, c, d) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) this.plot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, d);
  }

  buildBase() {
    for (const { path, covers } of this.tubes) {
      // Support posts down to the deck, behind the tube at that point.
      for (let s = 0.04; s < path.runoutStart - 0.05; s += 0.09) {
        const p = path.at(s);
        const ground = 40 + 250 * p.scale; // where the deck is at this depth
        if (ground - p.y < 6) continue;
        const w = Math.max(1, Math.round(3 * p.scale));
        for (let y = p.y; y <= ground; y++) {
          for (let k = 0; k < w; k++) this.plot(p.x - w / 2 + k, y, k === w - 1 ? C.postDark : C.post, p.scale - 0.004);
        }
      }
      // The tube itself, one cross-section per small step along the path.
      const steps = 3000;
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        const p = path.at(s);
        const t = path.tangent(s);
        const nx = -t.y;
        const ny = t.x;
        const hw = p.width / 2;
        const closed = inCover(covers, s);
        const ring = closed && frac(s * 30) < 0.08;
        for (let o = -hw; o <= hw; o += 0.5) {
          const f = (o + hw) / (2 * hw);
          let c;
          let lift = 0;
          if (closed) {
            c = ring ? C.fibreDark : f < 0.12 || f > 0.9 ? C.fibreDark : f < 0.38 ? C.closedHi : C.closed;
            lift = 0.0006; // the roof sits above the water
          } else if (f < 0.07 || f > 0.93) {
            c = C.rim;
            lift = 0.0004;
          } else if (f < 0.2) {
            c = C.fibre;
          } else if (f > 0.8) {
            c = C.fibreDark;
          } else if (f < 0.3 || f > 0.7) {
            c = C.inner;
          } else {
            c = C.water;
          }
          this.plot(p.x + nx * o, p.y + ny * o, c, p.scale + lift);
        }
      }
      // Open mouth at the top of the slide.
      const top = path.at(0);
      this.disc(top.x, top.y - 1, Math.max(2, Math.round(top.width / 2)), C.fibreDark, top.scale + 0.0008);
      this.disc(top.x, top.y - 1, Math.max(1, Math.round(top.width / 2) - 2), C.water, top.scale + 0.001);
    }
  }

  // Draws this frame's moving parts and blits the layer onto `g`.
  draw(g, flow, t) {
    this.col.set(this.baseCol);
    this.dep.set(this.baseDep);
    this.tubes.forEach(({ path, covers }) => {
      const hw = (s) => path.at(s).width / 2;
      for (let i = 0; i <= 1200; i++) {
        const s = i / 1200;
        if (inCover(covers, s)) continue;
        for (const k of [-0.25, 0.05, 0.3]) {
          if (frac((s * path.worldLength) / 26 - t * 5 + k * 3.7) < 0.16) {
            const p = path.at(s);
            const tg = path.tangent(s);
            this.plot(p.x - tg.y * k * hw(s), p.y + tg.x * k * hw(s), C.waterHi, p.scale + 0.0003);
          }
        }
      }
    });
    for (const b of flow.bundles) {
      if (b.state !== 'flow') continue;
      const tube = this.tubes[b.tube] || this.tubes[0];
      if (b.kind === 'noodle') this.noodle(b, tube, t);
      else this.decoy(b, tube, t);
    }
    this.ctx.putImageData(this.img, 0, 0);
    g.drawImage(this.canvas, 0, 0);
  }

  noodle(b, { path, covers }, t) {
    const w = b.windows;
    const headFrac = (w.head - w.good) / (w.head + w.tail);
    const bodyFrac = (2 * w.good) / (w.head + w.tail);
    const sHead = Math.min(1, b.sHead);
    const sTail = Math.max(0, b.sHead - b.len);
    if (sHead <= 0 || sTail >= 1) return;
    const steps = Math.max(8, Math.ceil((sHead - sTail) * 2400));
    for (let i = 0; i <= steps; i++) {
      const s = sTail + ((sHead - sTail) * i) / steps;
      if (inCover(covers, s)) continue;
      const p = path.at(s);
      const tg = path.tangent(s);
      const u = (b.sHead - s) / b.len;
      let wf;
      if (u < headFrac) wf = 0.55 + 0.45 * (u / headFrac);
      else if (u < headFrac + bodyFrac) wf = 1;
      else wf = 1 - 0.7 * ((u - headFrac - bodyFrac) / (1 - headFrac - bodyFrac));
      const width = Math.max(2, 0.34 * p.width * wf);
      const wob = Math.sin(s * 80 + t * 5 + b.id) * 0.8 * p.scale;
      for (let o = -width / 2; o <= width / 2; o += 0.5) {
        const k = (Math.round(o * 2) + Math.floor(s * 400) + b.id) & 3;
        const c = o <= -width / 2 + 0.5 ? C.noodleHi : k === 0 ? C.noodleShadow : C.noodle;
        this.plot(p.x - tg.y * (o + wob), p.y + tg.x * (o + wob), c, p.scale + 0.001);
      }
    }
  }

  decoy(b, { path, covers }, t) {
    const sC = b.sHead - b.bodyFromHead;
    if (sC <= 0 || sC > 1 || inCover(covers, sC)) return;
    const p = path.at(sC);
    const tg = path.tangent(sC);
    const k = path.widthNear / 64;
    const d = p.scale + 0.0015;
    if (b.kind === 'tomato') {
      // Bounces wall to wall in a zig-zag (visual only).
      const u = frac(sC * 9 + b.id * 0.31);
      const tri = 1 - 4 * Math.abs(u - 0.5);
      const hop = Math.abs(Math.sin(u * Math.PI * 2)) * 3 * p.scale;
      const off = tri * p.width * 0.24;
      const x = p.x - tg.y * off;
      const y = p.y + tg.x * off - hop;
      const r = Math.max(2, Math.round(7 * p.scale * k));
      this.disc(x, y, r, C.tomatoDark, d);
      this.disc(x - 1, y - 1, Math.max(1, r - 1), C.tomato, d + 0.0001);
      this.plot(x - Math.ceil(r / 2), y - Math.ceil(r / 2), C.tomatoHi, d + 0.0002);
      this.seg(x - 1, y - r - 1, x + 1, y - r - 1, C.leafLight, d + 0.0002);
    } else {
      const r = Math.max(2, Math.round(7.5 * p.scale * k));
      const x = p.x + Math.sin(sC * 50 + t * 5 + b.id) * 1.2 * p.scale;
      const y = p.y;
      this.seg(x, y + 1, x, y + r, C.momijiDark, d);
      for (const [dx, dy] of [[0, -1], [-0.95, -0.35], [0.95, -0.35], [-0.6, 0.75], [0.6, 0.75]]) {
        this.seg(x, y, x + dx * r, y + dy * r, C.momiji, d + 0.0001);
      }
      this.disc(x, y, Math.max(1, Math.round(r * 0.45)), C.momiji, d + 0.0001);
    }
  }
}
