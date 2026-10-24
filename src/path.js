// Tube paths as seen by a seated customer. Every position on a tube is a
// distance `s` from 0 (far end, top of the screen) to 1 (near end). Only
// rendering turns `s` into pixels, so timing and scoring never depend on the
// shape of the tube.

export const BUFFER_W = 180;
export const BUFFER_H = 320;

// Straight flume. With `vanishX` equal to `cx` (the default) it is exactly the
// shop 1 flume; a different `vanishX` makes side-by-side lanes that lean toward a
// shared vanishing point. `converge` (0–1) is how far they lean: 1 meets at the
// point, less keeps lanes wider apart at the catch line so they are easy to aim at.
export class StraightPerspectivePath {
  constructor({ cx = 78, yHorizon = 40, yNear = 290, zFar = 4, zNear = 1, widthNear = 64, vanishX = cx, converge = 1 } = {}) {
    this.cx = cx;
    this.yHorizon = yHorizon;
    this.yNear = yNear;
    this.zFar = zFar;
    this.zNear = zNear;
    this.widthNear = widthNear;
    this.vanishX = vanishX;
    this.converge = converge;
    this.straight = true;
  }

  // Perspective scale: world distance is linear in s, screen size is 1/z.
  scaleAt(s) {
    const z = this.zFar + (this.zNear - this.zFar) * s;
    return this.zNear / z;
  }

  at(s) {
    const scale = this.scaleAt(s);
    return {
      x: this.vanishX + (this.cx - this.vanishX) * (1 - (1 - scale) * this.converge),
      y: this.yHorizon + (this.yNear - this.yHorizon) * scale,
      scale,
      width: this.widthNear * scale,
    };
  }

  // Inverse of at(s).y, used to draw the flume one screen row at a time.
  sAtY(y) {
    const scale = (y - this.yHorizon) / (this.yNear - this.yHorizon);
    const z = this.zNear / scale;
    return (this.zFar - z) / (this.zFar - this.zNear);
  }
}

// Near-end centres and widths for 2–4 side-by-side lanes. All lanes end left
// of the bowl (x < 138).
export const LANE_LAYOUT = {
  1: { width: 64, centres: [78] },
  2: { width: 50, centres: [46, 104] },
  3: { width: 40, centres: [28, 72, 116] },
  4: { width: 31, centres: [20, 54, 88, 122] },
};

export function lanes(n) {
  const { width, centres } = LANE_LAYOUT[n];
  if (n === 1) return [new StraightPerspectivePath()];
  return centres.map((cx) => new StraightPerspectivePath({ cx, widthNear: width, vanishX: 78, converge: 0.6 }));
}

// Curved tube (waterslide). Control points are screen positions with a
// nearness `scale`; the curve is a Catmull-Rom spline through them. `s` is
// spread by world length (screen length ÷ scale), so a bundle at constant
// speed looks equally fast far away and close up. The last `runout` control
// points must lie on a straight line toward the player. The straight run-out
// starts at the second of them (the spline only straightens from there), and
// the catch line sits on it.
export class CurvePath {
  constructor(points, { widthNear = 40, runout = 3, samples = 1600 } = {}) {
    this.points = points;
    this.widthNear = widthNear;
    this.straight = false;
    const pts = [points[0], ...points, points[points.length - 1]];
    const seg = points.length - 1;
    const table = [];
    let len = 0;
    let prev = null;
    for (let i = 0; i <= samples; i++) {
      const u = (i / samples) * seg;
      const k = Math.min(seg - 1, Math.floor(u));
      const p = catmull(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], u - k);
      if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y) / ((p.scale + prev.scale) / 2);
      table.push({ u, len, ...p });
      prev = p;
    }
    for (const e of table) e.s = e.len / len;
    this.table = table;
    this.worldLength = len;
    // Where the straight run-out begins, in s.
    const uStart = seg - (runout - 2);
    this.runoutStart = table.find((e) => e.u >= uStart).s;
    // The catch line sits 35% of the way along the run-out.
    this.sCatch = this.runoutStart + 0.35 * (1 - this.runoutStart);
  }

  // s for the control point with this index.
  sAtPoint(index) {
    const seg = this.points.length - 1;
    const target = Math.min(seg, Math.max(0, index));
    return this.table.find((e) => e.u >= target - 1e-9).s;
  }

  at(s) {
    const t = this.table;
    if (s <= 0) return withWidth(t[0], this.widthNear);
    if (s >= 1) return withWidth(t[t.length - 1], this.widthNear);
    let lo = 0;
    let hi = t.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid].s <= s) lo = mid;
      else hi = mid;
    }
    const a = t[lo];
    const b = t[hi];
    const f = (s - a.s) / (b.s - a.s || 1);
    return withWidth({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, scale: a.scale + (b.scale - a.scale) * f }, this.widthNear);
  }

  // Unit direction of travel at s.
  tangent(s) {
    const d = 0.002;
    const a = this.at(Math.max(0, s - d));
    const b = this.at(Math.min(1, s + d));
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  }
}

function withWidth(p, widthNear) {
  return { x: p.x, y: p.y, scale: p.scale, width: widthNear * p.scale };
}

function catmull(p0, p1, p2, p3, t) {
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  return {
    x: f(p0.x, p1.x, p2.x, p3.x),
    y: f(p0.y, p1.y, p2.y, p3.y),
    scale: Math.max(0.05, f(p0.scale, p1.scale, p2.scale, p3.scale)),
  };
}
