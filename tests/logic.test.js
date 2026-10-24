import { test } from 'node:test';
import assert from 'node:assert/strict';

import { StraightPerspectivePath } from '../src/path.js';
import { createFlow, stepFlow, isFinished, crossTime, activeBundle } from '../src/flow.js';
import { gradeOffset, judge, tryCatch, createHand, stepHand, handIdle, cycleMs } from '../src/catch.js';
import { createScore, recordGrade, recordMissedBundle, starsFor } from '../src/score.js';
import { defaultProgress, applyResult, loadProgress, saveProgress } from '../src/storage.js';
import { LEVELS } from '../src/levels.js';

const level = (o = {}) => ({ id: 't', bundles: 8, speed: 0.5, spacingMs: 900, starThresholds: [30, 55, 72], ...o });

function runToEnd(flow, dt) {
  let drains = 0;
  for (let i = 0; i < 100000 && !isFinished(flow); i++) {
    for (const e of stepFlow(flow, dt)) if (e.type === 'drain') drains++;
  }
  return drains;
}

// ---- path ----

test('path: scale and y grow toward the player', () => {
  const p = new StraightPerspectivePath();
  let prev = p.at(0);
  for (let s = 0.1; s <= 1.0001; s += 0.1) {
    const cur = p.at(s);
    assert.ok(cur.scale > prev.scale);
    assert.ok(cur.y > prev.y);
    prev = cur;
  }
});

test('path: sAtY inverts at(s).y', () => {
  const p = new StraightPerspectivePath();
  for (const s of [0, 0.3, 0.85, 1]) assert.ok(Math.abs(p.sAtY(p.at(s).y) - s) < 1e-9);
});

test('path: catch line sits in the lower third of the screen', () => {
  const p = new StraightPerspectivePath();
  assert.ok(p.at(0.85).y > 320 * 0.62, `catch y ${p.at(0.85).y}`);
});

// ---- flow ----

test('flow: spawns exactly the configured bundle count', () => {
  const flow = createFlow(level({ bundles: 8 }));
  const drains = runToEnd(flow, 1 / 120);
  assert.equal(flow.spawned, 8);
  assert.equal(drains, 8);
});

test('flow: next bundle waits for spacingMs', () => {
  const flow = createFlow(level({ spacingMs: 2000 }));
  while (!activeBundle(flow)) stepFlow(flow, 1 / 120);
  const first = activeBundle(flow);
  // Catch it right away so only the spacing holds the next one back.
  tryCatch(flow, createHand(), crossTime(flow, first));
  while (flow.spawned < 2) stepFlow(flow, 1 / 120);
  assert.ok(flow.bundles[1].spawnT - first.spawnT >= 2 - 1e-9);
});

test('flow: one bundle in flight at a time', () => {
  const flow = createFlow(level({ spacingMs: 100 }));
  for (let i = 0; i < 2000; i++) {
    stepFlow(flow, 1 / 120);
    assert.ok(flow.bundles.filter((b) => b.state === 'flow').length <= 1);
  }
});

test('flow: frame-rate independent arrival at the catch line', () => {
  const arrival = (dt) => {
    const flow = createFlow(level());
    for (;;) {
      stepFlow(flow, dt);
      const b = activeBundle(flow);
      if (b && b.sHead - flow.bodyFromHead >= flow.sCatch) return flow.t;
    }
  };
  const a = arrival(1 / 30);
  const b = arrival(1 / 144);
  assert.ok(Math.abs(a - b) <= 1 / 30 + 1e-9, `${a} vs ${b}`);
});

test('flow: same drains at different step sizes', () => {
  const a = createFlow(level());
  const b = createFlow(level());
  runToEnd(a, 1 / 30);
  runToEnd(b, 1 / 144);
  assert.deepEqual(a.bundles.map((x) => x.spawnT), b.bundles.map((x) => x.spawnT));
});

// ---- catch ----

test('catch: grades by offset', () => {
  const w = { perfect: 60, good: 120, head: 160, tail: 220 };
  assert.equal(gradeOffset(0, w), 'PERFECT');
  assert.equal(gradeOffset(-60, w), 'PERFECT');
  assert.equal(gradeOffset(100, w), 'GOOD');
  assert.equal(gradeOffset(-150, w), 'TAIL');
  assert.equal(gradeOffset(200, w), 'TAIL');
  assert.equal(gradeOffset(-170, w), 'MISS');
  assert.equal(gradeOffset(230, w), 'MISS');
});

test('catch: no bundle over the line is a MISS and removes nothing', () => {
  const flow = createFlow(level());
  stepFlow(flow, 0.01);
  const r = judge(flow, flow.t);
  assert.equal(r.grade, 'MISS');
  assert.equal(r.bundle, null);
});

test('catch: same ms offset gives same grade at two speeds', () => {
  for (const off of [-150, -90, 0, 40, 110, 200, 300]) {
    const grades = [0.4, 0.75].map((speed) => {
      const flow = createFlow(level({ speed }));
      while (!activeBundle(flow)) stepFlow(flow, 1 / 120);
      return judge(flow, crossTime(flow, activeBundle(flow)) + off / 1000).grade;
    });
    assert.equal(grades[0], grades[1], `offset ${off}`);
  }
});

test('catch: caught bundle leaves the flume', () => {
  const flow = createFlow(level());
  while (!activeBundle(flow)) stepFlow(flow, 1 / 120);
  const b = activeBundle(flow);
  const r = tryCatch(flow, createHand(), crossTime(flow, b));
  assert.equal(r.grade, 'PERFECT');
  assert.equal(b.state, 'caught');
  assert.equal(activeBundle(flow), null);
});

test('hand: taps during the cycle are ignored', () => {
  const flow = createFlow(level());
  while (!activeBundle(flow)) stepFlow(flow, 1 / 120);
  const hand = createHand();
  assert.ok(tryCatch(flow, hand, crossTime(flow, activeBundle(flow))));
  stepHand(hand, 150);
  assert.equal(tryCatch(flow, hand, flow.t), null);
  stepHand(hand, cycleMs('PERFECT'));
  assert.ok(handIdle(hand));
});

test('hand: a miss recovers faster than a catch, and a catch drops into the cup', () => {
  assert.ok(cycleMs('MISS') < cycleMs('GOOD'));
  const hand = createHand();
  tryCatch(createFlow(level()), hand, 0);
  assert.equal(hand.grade, 'MISS');
  const events = stepHand(hand, cycleMs('MISS'));
  assert.ok(events.some((e) => e.type === 'ready'));
  assert.ok(!events.some((e) => e.type === 'drop'));
});

// ---- score ----

test('score: grams by grade', () => {
  const s = createScore();
  recordGrade(s, 'PERFECT', 10);
  assert.equal(s.grams, 10);
  recordGrade(s, 'TAIL', 10);
  assert.equal(s.grams, 12.5);
  recordGrade(s, 'GOOD', 10);
  assert.equal(s.grams, 19.5);
  recordGrade(s, 'MISS', 10);
  assert.equal(s.grams, 19.5);
});

test('score: combo grows on perfects and resets otherwise', () => {
  const s = createScore();
  for (let i = 0; i < 3; i++) recordGrade(s, 'PERFECT', 10);
  assert.equal(s.combo, 3);
  recordGrade(s, 'GOOD', 10);
  assert.equal(s.combo, 0);
  recordGrade(s, 'PERFECT', 10);
  recordMissedBundle(s);
  assert.equal(s.combo, 0);
  assert.equal(s.maxCombo, 3);
});

test('score: counts add up to bundle total; zero catches gives zero stars', () => {
  const flow = createFlow(level({ bundles: 8 }));
  const s = createScore();
  for (let i = 0; i < 100000 && !isFinished(flow); i++) {
    for (const e of stepFlow(flow, 1 / 120)) if (e.type === 'drain') recordMissedBundle(s);
  }
  const c = s.counts;
  assert.equal(c.PERFECT + c.GOOD + c.TAIL + c.MISSED, 8);
  assert.equal(starsFor(s.grams, [30, 55, 72]), 0);
  assert.equal(starsFor(72, [30, 55, 72]), 3);
});

// ---- progression / storage ----

test('progress: one star unlocks the next level; best keeps the higher score', () => {
  const p = defaultProgress();
  applyResult(p, 0, 'a', 300, 0, 4);
  assert.equal(p.unlocked, 1);
  const r1 = applyResult(p, 0, 'a', 500, 1, 4);
  assert.equal(p.unlocked, 2);
  assert.ok(r1.newBest);
  const r2 = applyResult(p, 0, 'a', 400, 3, 4);
  assert.equal(r2.newBest, false);
  assert.deepEqual(p.best.a, { score: 500, stars: 3 });
  applyResult(p, 3, 'd', 900, 3, 4);
  assert.equal(p.unlocked, 4);
});

test('storage: blocked localStorage falls back to defaults without throwing', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  try {
    assert.deepEqual(loadProgress(), defaultProgress());
    assert.doesNotThrow(() => saveProgress(defaultProgress()));
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
  }
});

test('levels: data is well formed', () => {
  for (const l of LEVELS) {
    assert.equal(l.starThresholds.length, 3);
    assert.ok(l.starThresholds[2] <= createFlow(l).maxGrams);
  }
});
