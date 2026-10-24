// Level data, in three shops of five levels.
//
// KYOTO FLUME: FIRST TASTE is the v1 level 1, unchanged (count + spacing
// format); the rest of the levels are scripts. Each beat says when the bundle's body should cross
// the catch line (ms after the lead-in); `script` works out when it has to
// start, so rhythms and gaps can be written directly.
//
// `speed` is flume lengths per second. Windows are in ms around the crossing.
// Noodles are 10 g, tomatoes 5 g; star thresholds are bowl grams.

import { DEFAULT_WINDOWS, S_CATCH, windowsFor } from './flow.js';
import { lanes, CurvePath } from './path.js';

const KIND = { N: 'noodle', T: 'tomato', L: 'leaf' };

// Tomatoes roll a little slower than the speed written for them.
export const TOMATO_SPEED_FACTOR = 0.85;

// Beat: [crossMs, 'N' | 'T' | 'L', speed, surge?, tube?] where surge = { at, speed }.
// `tubes` (multi-tube levels) supplies each tube's catch line.
function script(windows, beats, tubes = null) {
  const w = { ...DEFAULT_WINDOWS, ...windows };
  return beats.map(([cross, k, written, surge, tube]) => {
    const kind = KIND[k];
    const speed = kind === 'tomato' ? written * TOMATO_SPEED_FACTOR : written;
    const vCatch = surge ? surge.speed : speed;
    const path = tubes ? tubes[tube || 0].path : null;
    const sCatch = path && path.sCatch !== undefined ? path.sCatch : S_CATCH;
    const sBody = sCatch + (vCatch * windowsFor(kind, w).head) / 1000;
    const travel = !surge || sBody <= surge.at ? sBody / speed : surge.at / speed + (sBody - surge.at) / surge.speed;
    const entry = { at: cross - travel * 1000, kind, speed, cross };
    if (surge) entry.surge = surge;
    if (kind === 'tomato') entry.writtenSpeed = written;
    if (tube !== undefined) entry.tube = tube;
    return entry;
  });
}

// Rows: [gapMs, kind, speed, tube = 0, surge?]. A row crosses its catch line
// `gapMs` after the previous catchable row. A leaf row with a negative gap
// doesn't move the clock: it crosses that long before the previous row.
function timeline(start, rows) {
  let t = start;
  const beats = [];
  for (const [gap, k, speed, tube = 0, sg] of rows) {
    if (k === 'L' && gap < 0) {
      beats.push([t + gap, k, speed, sg, tube]);
      continue;
    }
    t += gap;
    beats.push([t, k, speed, sg, tube]);
  }
  return beats.sort((a, b) => a[0] - b[0]);
}

const surge = (at, speed) => ({ at, speed });

const SURGE_W = { perfect: 55, good: 110, head: 140, tail: 190 };
const TUNNEL_W = { perfect: 50, good: 100, head: 130, tail: 170 };
const GARDEN_W = { perfect: 45, good: 90, head: 120, tail: 160 };
const MATSURI_W = { perfect: 35, good: 75, head: 100, tail: 130 };

export const KYOTO_LEVELS = [
  {
    id: 'first-taste',
    name: 'FIRST TASTE',
    bundles: 8,
    speed: 0.4,
    spacingMs: 900,
    starThresholds: [30, 55, 72],
  },
  {
    id: 'surge',
    name: 'SURGE',
    twist: 'SPEEDS CHANGE',
    hint: 'SOME NOODLES SURGE MIDWAY',
    speed: 0.5,
    windows: SURGE_W,
    entries: script(SURGE_W, [
      [2600, 'N', 0.45],
      [3700, 'N', 0.6],
      [4800, 'N', 0.4, surge(0.3, 0.8)],
      [5900, 'N', 0.5],
      [6900, 'N', 0.75],
      [8000, 'N', 0.45, surge(0.35, 0.9)],
      [9100, 'N', 0.45],
      [10000, 'N', 0.9],
      [11100, 'N', 0.5, surge(0.4, 0.85)],
      [12200, 'N', 0.55],
      [13100, 'N', 0.4, surge(0.3, 0.9)],
      [14200, 'N', 0.8],
    ]),
    starThresholds: [50, 80, 102],
  },
  {
    id: 'bamboo-tunnel',
    name: 'BAMBOO TUNNEL',
    twist: 'HIDDEN IN TUBES',
    hint: 'KEEP THE RHYTHM IN THE DARK',
    speed: 0.65,
    windows: TUNNEL_W,
    covers: [[0.18, 0.42], [0.56, 0.82]],
    entries: script(TUNNEL_W, [
      [2600, 'N', 0.55],
      [3500, 'N', 0.65],
      [4400, 'N', 0.9],
      [5400, 'N', 0.6],
      [6250, 'N', 0.7],
      [7300, 'N', 0.55],
      [8150, 'N', 0.9],
      [9200, 'N', 0.65],
      [10050, 'N', 0.6],
      [11000, 'N', 0.9],
      [11900, 'N', 0.7],
      [12800, 'N', 0.9],
    ]),
    starThresholds: [50, 85, 106],
  },
  {
    id: 'garden-guests',
    name: 'GARDEN GUESTS',
    twist: 'TOMATOES AND LEAVES',
    hint: 'CATCH TOMATOES. LET LEAVES PASS.',
    speed: 0.7,
    windows: GARDEN_W,
    distractions: { dragonfly: true, leaves: true },
    entries: script(GARDEN_W, [
      [2600, 'N', 0.6],
      [3080, 'L', 0.7],
      [3380, 'N', 0.7],
      [4160, 'T', 0.75],
      [4940, 'N', 0.65],
      [5720, 'N', 0.8],
      [6150, 'L', 0.75],
      [6500, 'N', 0.75],
      [7280, 'T', 0.7],
      [8060, 'N', 0.95],
      [8540, 'L', 0.8],
      [8840, 'N', 0.6],
      [9620, 'N', 0.7],
      [10050, 'L', 0.65],
      [10400, 'N', 0.95],
      [11180, 'T', 0.65],
      [11960, 'N', 0.75],
      [12460, 'L', 0.7],
      [12740, 'N', 0.8],
      [13520, 'N', 0.95],
    ]),
    starThresholds: [55, 95, 122],
  },
  {
    id: 'matsuri',
    name: 'MATSURI',
    twist: 'EVERYTHING AT ONCE',
    hint: 'GOOD LUCK.',
    speed: 0.9,
    windows: MATSURI_W,
    covers: [[0.3, 0.5], [0.62, 0.82]],
    distractions: { dragonfly: true, leaves: true },
    entries: script(MATSURI_W, [
      [2400, 'N', 0.8],
      [3120, 'N', 1.0],
      [3540, 'L', 0.9],
      [3840, 'N', 0.7, surge(0.55, 1.1)],
      [4560, 'N', 0.9],
      [5280, 'T', 0.85],
      [6000, 'N', 1.1],
      [6720, 'N', 0.75, surge(0.55, 1.05)],
      [7120, 'L', 1.0],
      [7440, 'N', 0.95],
      [8160, 'N', 0.8],
      [8580, 'L', 0.85],
      [8880, 'N', 0.7, surge(0.5, 1.1)],
      [9600, 'N', 1.0],
      [10320, 'T', 0.9],
      [11040, 'N', 1.1],
      [11450, 'L', 0.95],
      [11760, 'N', 0.85],
      [12480, 'N', 0.75, surge(0.55, 1.1)],
      [13200, 'N', 1.05],
      [13600, 'L', 0.9],
      [13920, 'N', 0.9],
      [14640, 'N', 1.1],
    ]),
    starThresholds: [75, 120, 164],
  },
];

// ---------- Shop 2: FLUME HALL (2–4 straight lanes) ----------

const tubesOf = (paths, covers = {}) => paths.map((path, i) => ({ path, covers: covers[i] || [] }));

const TWIN_W = { perfect: 55, good: 110, head: 140, tail: 190 };
const THREE_W = { perfect: 50, good: 100, head: 130, tail: 170 };
const FOUR_W = { perfect: 45, good: 90, head: 120, tail: 160 };
const CROSS_W = { perfect: 40, good: 85, head: 110, tail: 150 };
const HALL_W = { perfect: 35, good: 75, head: 100, tail: 130 };

const TWIN_T = tubesOf(lanes(2));
const THREE_T = tubesOf(lanes(3));
const FOUR_T = tubesOf(lanes(4), { 1: [[0.5, 0.8]], 2: [[0.25, 0.6]] });
const CROSS_T = tubesOf(lanes(4));
const HALL_T = tubesOf(lanes(4), { 1: [[0.45, 0.8]], 2: [[0.2, 0.5]] });

export const HALL_LEVELS = [
  {
    id: 'twin-flumes',
    name: 'TWIN FLUMES',
    twist: 'TWO FLUMES',
    hint: 'TAP THE FLUME THE NOODLE IS IN',
    speed: 0.5,
    windows: TWIN_W,
    tubes: TWIN_T,
    entries: script(TWIN_W, timeline(2600, [
      [0, 'N', 0.45, 0], [1000, 'N', 0.5, 1], [1000, 'N', 0.5, 0], [1100, 'N', 0.55, 1],
      [1000, 'N', 0.45, 1], [1000, 'N', 0.6, 0], [1100, 'N', 0.5, 1], [1000, 'N', 0.55, 0],
      [1000, 'N', 0.6, 0], [1000, 'N', 0.45, 1], [1100, 'N', 0.6, 0], [1000, 'N', 0.55, 1],
    ]), TWIN_T),
    starThresholds: [45, 75, 96],
  },
  {
    id: 'three-streams',
    name: 'THREE STREAMS',
    twist: 'THREE FLUMES, SURGES',
    hint: 'WATCH ALL THREE',
    speed: 0.6,
    windows: THREE_W,
    tubes: THREE_T,
    entries: script(THREE_W, timeline(2600, [
      [0, 'N', 0.5, 0], [900, 'N', 0.6, 2], [900, 'N', 0.45, 1, surge(0.35, 0.85)], [900, 'N', 0.7, 0],
      [950, 'N', 0.55, 2], [900, 'N', 0.4, 2, surge(0.3, 0.9)], [900, 'N', 0.65, 1], [950, 'N', 0.75, 0],
      [900, 'N', 0.5, 1, surge(0.4, 0.85)], [900, 'N', 0.6, 2], [900, 'N', 0.8, 0], [950, 'N', 0.45, 1, surge(0.35, 0.9)],
    ]), THREE_T),
    starThresholds: [50, 80, 102],
  },
  {
    id: 'four-ways',
    name: 'FOUR WAYS',
    twist: 'FOUR FLUMES, TWO TUNNELS',
    hint: 'THE MIDDLE FLUMES HIDE NOODLES',
    speed: 0.65,
    windows: FOUR_W,
    tubes: FOUR_T,
    entries: script(FOUR_W, timeline(2600, [
      [0, 'N', 0.55, 0], [850, 'N', 0.65, 1], [850, 'N', 0.6, 3], [850, 'N', 0.7, 2],
      [900, 'N', 0.75, 0], [850, 'N', 0.6, 2], [850, 'N', 0.8, 1], [900, 'N', 0.65, 3],
      [850, 'N', 0.9, 0], [850, 'N', 0.7, 1], [850, 'N', 0.55, 2], [900, 'N', 0.85, 3],
      [850, 'N', 0.75, 2], [850, 'N', 0.9, 1],
    ]), FOUR_T),
    starThresholds: [60, 95, 123],
  },
  {
    id: 'crossfire',
    name: 'CROSSFIRE',
    twist: 'LEAVES NEXT DOOR',
    hint: 'A LEAF CAN RIDE BESIDE A NOODLE',
    speed: 0.7,
    windows: CROSS_W,
    tubes: CROSS_T,
    distractions: { dragonfly: true, leaves: true },
    entries: script(CROSS_W, timeline(2600, [
      [0, 'N', 0.6, 1], [-30, 'L', 0.65, 2],
      [800, 'N', 0.7, 3], [-300, 'L', 0.7, 3],
      [800, 'T', 0.75, 0],
      [800, 'N', 0.65, 2], [-20, 'L', 0.7, 1],
      [800, 'N', 0.8, 0],
      [800, 'N', 0.75, 1], [-40, 'L', 0.75, 0],
      [800, 'N', 0.85, 3],
      [800, 'T', 0.7, 2],
      [800, 'N', 0.7, 0],
      [800, 'N', 0.9, 2], [-30, 'L', 0.8, 3],
      [800, 'N', 0.65, 1],
      [800, 'N', 0.85, 3],
      [800, 'T', 0.65, 1],
      [800, 'N', 0.75, 0],
      [800, 'N', 0.9, 2],
      [800, 'N', 0.8, 1],
      [800, 'N', 0.95, 3],
    ]), CROSS_T),
    starThresholds: [65, 105, 141],
  },
  {
    id: 'grand-hall',
    name: 'GRAND HALL',
    twist: 'EVERY FLUME AT ONCE',
    hint: 'GOOD LUCK.',
    speed: 0.85,
    windows: HALL_W,
    tubes: HALL_T,
    distractions: { dragonfly: true, leaves: true },
    entries: script(HALL_W, timeline(2400, [
      [0, 'N', 0.8, 0],
      [720, 'N', 1.0, 3], [-30, 'L', 0.9, 2],
      [720, 'N', 0.7, 1, surge(0.4, 1.05)],
      [720, 'N', 0.9, 2],
      [720, 'T', 0.85, 0],
      [720, 'N', 1.05, 3],
      [720, 'N', 0.75, 0, surge(0.5, 1.1)], [-300, 'L', 1.0, 0],
      [720, 'N', 0.95, 2],
      [720, 'N', 0.8, 1],
      [720, 'N', 1.1, 3], [-40, 'L', 0.95, 0],
      [720, 'N', 0.7, 0, surge(0.45, 1.05)],
      [720, 'T', 0.9, 2],
      [720, 'N', 1.0, 1],
      [720, 'N', 0.85, 3], [-20, 'L', 0.9, 2],
      [720, 'N', 1.1, 0],
      [720, 'N', 0.75, 2, surge(0.5, 1.1)],
      [720, 'N', 1.05, 1], [-300, 'L', 0.9, 1],
      [720, 'N', 0.9, 3],
      [720, 'N', 1.1, 0],
      [720, 'N', 0.95, 2],
    ]), HALL_T),
    starThresholds: [85, 135, 181],
  },
];

// ---------- Shop 3: POOL SLIDES (curved tubes) ----------
// Control points are { x, y, scale }; the last three points of every tube are
// its straight run-out toward the player.

const P = (x, y, scale) => ({ x, y, scale });
// The slide tower stands closer than the far end of a flume, so far points are
// lifted toward full size (scale 0.25 becomes about 0.5).
const curve = (pts, widthNear = 40) =>
  new CurvePath(pts.map((p) => ({ ...p, scale: 0.35 + 0.65 * p.scale })), { widthNear, runout: 3 });

const SPLASH_C = curve([P(92, 100, 0.25), P(40, 128, 0.31), P(118, 160, 0.4), P(72, 182, 0.5), P(72, 216, 0.66), P(72, 292, 1)], 54);
const CORK_C = curve([P(112, 98, 0.24), P(70, 112, 0.28), P(42, 140, 0.34), P(60, 170, 0.41), P(100, 166, 0.44), P(104, 138, 0.39), P(76, 130, 0.36), P(54, 160, 0.46), P(70, 182, 0.5), P(70, 216, 0.66), P(70, 292, 1)], 54);
const TWIN_A = curve([P(40, 100, 0.25), P(118, 140, 0.37), P(50, 182, 0.5), P(50, 216, 0.66), P(50, 292, 1)], 46);
const TWIN_B = curve([P(128, 100, 0.25), P(46, 138, 0.34), P(104, 182, 0.5), P(104, 216, 0.66), P(104, 292, 1)], 46);
const WAVE = [
  curve([P(150, 100, 0.24), P(90, 128, 0.32), P(36, 168, 0.45), P(32, 182, 0.5), P(32, 216, 0.66), P(32, 292, 1)]),
  curve([P(22, 100, 0.24), P(82, 126, 0.32), P(112, 164, 0.44), P(76, 182, 0.5), P(76, 216, 0.66), P(76, 292, 1)]),
  curve([P(92, 96, 0.22), P(140, 124, 0.3), P(150, 164, 0.42), P(120, 182, 0.5), P(120, 216, 0.66), P(120, 292, 1)]),
];
const GRAND = [
  curve([P(120, 96, 0.22), P(60, 118, 0.28), P(18, 150, 0.38), P(24, 182, 0.5), P(24, 216, 0.66), P(24, 292, 1)], 31),
  curve([P(30, 96, 0.22), P(100, 120, 0.3), P(132, 156, 0.4), P(58, 182, 0.5), P(58, 216, 0.66), P(58, 292, 1)], 31),
  curve([P(150, 100, 0.24), P(96, 125, 0.31), P(40, 160, 0.42), P(92, 182, 0.5), P(92, 216, 0.66), P(92, 292, 1)], 31),
  curve([P(70, 98, 0.23), P(150, 130, 0.33), P(152, 170, 0.45), P(126, 182, 0.5), P(126, 216, 0.66), P(126, 292, 1)], 31),
];

const POOL_W1 = { perfect: 55, good: 110, head: 140, tail: 190 };
const POOL_W2 = { perfect: 50, good: 100, head: 130, tail: 170 };
const POOL_W3 = { perfect: 45, good: 90, head: 120, tail: 160 };
const POOL_W4 = { perfect: 40, good: 85, head: 110, tail: 150 };
const POOL_W5 = { perfect: 35, good: 75, head: 100, tail: 130 };

const SPLASH_T = [{ path: SPLASH_C }];
const CORK_T = [{ path: CORK_C, covers: [[CORK_C.sAtPoint(3), CORK_C.sAtPoint(7)]] }];
const TWIN_SP_T = [{ path: TWIN_A }, { path: TWIN_B }];
const WAVE_T = WAVE.map((path) => ({ path }));
const GRAND_T = GRAND.map((path, i) => ({ path, covers: i === 2 ? [[path.sAtPoint(1), path.sAtPoint(3)]] : [] }));

export const POOL_LEVELS = [
  {
    id: 'splash-down',
    name: 'SPLASH DOWN',
    twist: 'A SWERVING SLIDE',
    hint: 'THE SLIDE SWINGS LEFT AND RIGHT',
    speed: 0.32,
    windows: POOL_W1,
    tubes: SPLASH_T,
    entries: script(POOL_W1, timeline(3400, [
      [0, 'N', 0.3], [1100, 'N', 0.34], [1100, 'N', 0.3], [1150, 'N', 0.38], [1100, 'N', 0.32],
      [1100, 'N', 0.36], [1150, 'N', 0.3], [1100, 'N', 0.4], [1100, 'N', 0.34], [1100, 'N', 0.38],
    ]), SPLASH_T),
    starThresholds: [40, 65, 80],
  },
  {
    id: 'corkscrew',
    name: 'CORKSCREW',
    twist: 'A CLOSED LOOP',
    hint: 'NOODLES VANISH IN THE LOOP',
    speed: 0.32,
    windows: POOL_W2,
    tubes: CORK_T,
    entries: script(POOL_W2, timeline(3600, [
      [0, 'N', 0.28], [950, 'N', 0.32], [950, 'N', 0.26, 0, surge(0.3, 0.42)], [950, 'N', 0.34],
      [1000, 'N', 0.3], [950, 'N', 0.25, 0, surge(0.35, 0.45)], [950, 'N', 0.36], [1000, 'N', 0.3],
      [950, 'N', 0.27, 0, surge(0.3, 0.44)], [950, 'N', 0.38], [950, 'N', 0.32], [1000, 'N', 0.4],
    ]), CORK_T),
    starThresholds: [50, 80, 102],
  },
  {
    id: 'twin-spirals',
    name: 'TWIN SPIRALS',
    twist: 'TWO SLIDES CROSSING',
    hint: 'TRACK YOUR NOODLE BEHIND THE OTHER',
    speed: 0.34,
    windows: POOL_W3,
    tubes: TWIN_SP_T,
    entries: script(POOL_W3, timeline(3400, [
      [0, 'N', 0.3, 0], [880, 'N', 0.34, 1], [880, 'N', 0.32, 0], [900, 'N', 0.36, 1],
      [880, 'N', 0.38, 1], [880, 'N', 0.3, 0], [900, 'N', 0.4, 1], [880, 'N', 0.34, 0],
      [880, 'N', 0.42, 0], [880, 'N', 0.32, 1], [900, 'N', 0.4, 0], [880, 'N', 0.44, 1],
    ]), TWIN_SP_T),
    starThresholds: [50, 85, 106],
  },
  {
    id: 'wave-pool',
    name: 'WAVE POOL',
    twist: 'THREE SLIDES, GUESTS',
    hint: 'CATCH TOMATOES. LET LEAVES PASS.',
    speed: 0.36,
    windows: POOL_W4,
    tubes: WAVE_T,
    distractions: { dragonfly: true, leaves: true },
    entries: script(POOL_W4, timeline(3400, [
      [0, 'N', 0.32, 0], [800, 'N', 0.36, 2], [-300, 'L', 0.36, 2],
      [800, 'T', 0.34, 1], [800, 'N', 0.4, 0], [-40, 'L', 0.38, 1],
      [800, 'N', 0.34, 1], [800, 'N', 0.42, 2], [800, 'T', 0.36, 0],
      [800, 'N', 0.38, 1], [-300, 'L', 0.4, 1], [800, 'N', 0.44, 0],
      [800, 'N', 0.36, 2], [-30, 'L', 0.4, 0], [800, 'T', 0.38, 2],
      [800, 'N', 0.42, 1], [800, 'N', 0.46, 0], [800, 'N', 0.4, 2], [800, 'N', 0.44, 1], [800, 'N', 0.48, 2],
    ]), WAVE_T),
    starThresholds: [60, 100, 132],
  },
  {
    id: 'grand-slide',
    name: 'GRAND SLIDE',
    twist: 'FOUR SLIDES AT ONCE',
    hint: 'GOOD LUCK.',
    speed: 0.42,
    windows: POOL_W5,
    tubes: GRAND_T,
    distractions: { dragonfly: true, leaves: true },
    entries: script(POOL_W5, timeline(3600, [
      [0, 'N', 0.38, 0],
      [720, 'N', 0.46, 3], [-30, 'L', 0.42, 2],
      [720, 'N', 0.34, 1, surge(0.35, 0.5)],
      [720, 'N', 0.42, 2],
      [720, 'T', 0.4, 0],
      [720, 'N', 0.5, 3],
      [720, 'N', 0.36, 0, surge(0.4, 0.52)], [-300, 'L', 0.46, 0],
      [720, 'N', 0.44, 2],
      [720, 'N', 0.4, 1],
      [720, 'N', 0.52, 3], [-40, 'L', 0.44, 0],
      [720, 'N', 0.34, 0, surge(0.35, 0.5)],
      [720, 'T', 0.42, 2],
      [720, 'N', 0.48, 1],
      [720, 'N', 0.4, 3], [-20, 'L', 0.42, 2],
      [720, 'N', 0.52, 0],
      [720, 'N', 0.36, 2, surge(0.4, 0.52)],
      [720, 'N', 0.5, 1], [-300, 'L', 0.42, 1],
      [720, 'N', 0.44, 3],
      [720, 'N', 0.52, 0],
      [720, 'N', 0.46, 2],
    ]), GRAND_T),
    starThresholds: [85, 135, 181],
  },
];

export const SHOPS = [
  { id: 'kyoto', name: 'KYOTO FLUME', theme: 'kyoto', blurb: 'ONE BAMBOO FLUME', levels: KYOTO_LEVELS },
  { id: 'hall', name: 'FLUME HALL', theme: 'hall', blurb: 'TWO TO FOUR FLUMES', levels: HALL_LEVELS },
  { id: 'pool', name: 'POOL SLIDES', theme: 'pool', blurb: 'SPIRAL SLIDES', levels: POOL_LEVELS },
];

// Shop 1's levels, kept under their old name for the shop 1 tests.
export const LEVELS = KYOTO_LEVELS;
export const ALL_LEVELS = SHOPS.flatMap((shop) => shop.levels);
