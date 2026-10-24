// Level data.
//
// FIRST TASTE is the v1 level 1, unchanged (count + spacing format).
// Levels 2–5 are scripts. Each beat says when the bundle's body should cross
// the catch line (ms after the lead-in); `script` works out when it has to
// start, so rhythms and gaps can be written directly.
//
// `speed` is flume lengths per second. Windows are in ms around the crossing.
// Noodles are 10 g, tomatoes 5 g; star thresholds are bowl grams.

import { DEFAULT_WINDOWS, S_CATCH, windowsFor } from './flow.js';

const KIND = { N: 'noodle', T: 'tomato', L: 'leaf' };

// Beat: [crossMs, 'N' | 'T' | 'L', speed, surge?] where surge = { at, speed }.
function script(windows, beats) {
  const w = { ...DEFAULT_WINDOWS, ...windows };
  return beats.map(([cross, k, speed, surge]) => {
    const kind = KIND[k];
    const vCatch = surge ? surge.speed : speed;
    const sBody = S_CATCH + (vCatch * windowsFor(kind, w).head) / 1000;
    const travel = !surge || sBody <= surge.at ? sBody / speed : surge.at / speed + (sBody - surge.at) / surge.speed;
    const entry = { at: cross - travel * 1000, kind, speed, cross };
    if (surge) entry.surge = surge;
    return entry;
  });
}

const surge = (at, speed) => ({ at, speed });

const SURGE_W = { perfect: 55, good: 110, head: 140, tail: 190 };
const TUNNEL_W = { perfect: 50, good: 100, head: 130, tail: 170 };
const GARDEN_W = { perfect: 45, good: 90, head: 120, tail: 160 };
const MATSURI_W = { perfect: 35, good: 75, head: 100, tail: 130 };

export const LEVELS = [
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
