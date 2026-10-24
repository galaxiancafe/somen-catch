import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createFlow, stepFlow, isFinished, crossTime, headAt, activeBundle, windowsFor, S_CATCH,
} from '../src/flow.js';
import { tryCatch, createHand, stepHand, judge, cycleMs } from '../src/catch.js';
import { createScore, recordGrade, recordTomato, recordLeaf, recordMissedBundle, starsFor, gramsFor } from '../src/score.js';
import { loadProgress } from '../src/storage.js';
import { LEVELS } from '../src/levels.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v1-first-taste.json', import.meta.url)));
const DT = 1 / 120;
const scripted = LEVELS.slice(1);

function catchable(e) {
  return e.kind !== 'leaf';
}

// Plays a level, tapping each bundle at crossTime + offsetMs(bundle) (null = no tap).
function play(level, offsetMs, dt = DT) {
  const flow = createFlow(level);
  const hand = createHand();
  const score = createScore();
  const done = new Set();
  const grades = [];
  for (let i = 0; i < 1e6 && !isFinished(flow); i++) {
    for (const b of flow.bundles) {
      if (b.state !== 'flow' || done.has(b.id)) continue;
      const off = offsetMs(b);
      if (off === null) continue;
      const tTap = crossTime(flow, b) + off / 1000;
      if (flow.t + dt < tTap) continue;
      done.add(b.id);
      const r = tryCatch(flow, hand, tTap);
      assert.ok(r, `hand busy for bundle ${b.id} (${b.kind}) of ${level.id}`);
      grades.push({ id: b.id, kind: r.bundle ? r.bundle.kind : null, grade: r.grade });
      if (!r.bundle) recordGrade(score, 'MISS', 10);
      else if (r.bundle.kind === 'tomato') recordTomato(score, 5);
      else if (r.bundle.kind === 'leaf') recordLeaf(score);
      else recordGrade(score, r.grade, 10);
    }
    for (const e of stepFlow(flow, dt)) if (e.type === 'drain' && e.bundle.kind === 'noodle') recordMissedBundle(score);
    stepHand(hand, dt * 1000);
  }
  return { flow, score, grades };
}

// ---- level 1 is v1 ----

test('FIRST TASTE data is the v1 level 1, unchanged', () => {
  assert.deepEqual(LEVELS[0], fixture.level);
  assert.equal(LEVELS[0].entries, undefined);
  assert.equal(LEVELS[0].twist, undefined); // no intro card
});

test('FIRST TASTE spawn times match the recorded v1 run', () => {
  const { flow } = play(LEVELS[0], (b) => fixture.offsets[b.id]);
  const got = flow.bundles.map((b) => b.spawnT);
  assert.equal(got.length, fixture.spawnTimes.length);
  got.forEach((t, i) => assert.ok(Math.abs(t - fixture.spawnTimes[i]) < 1e-9, `bundle ${i}: ${t} vs ${fixture.spawnTimes[i]}`));
  assert.equal(createFlow(LEVELS[0]).leadIn, 1.2);
});

// ---- engine ----

test('scripted entries spawn on time, after a 2 s lead-in', () => {
  const { flow } = play(LEVELS[1], () => null);
  assert.equal(flow.leadIn, 2);
  assert.equal(flow.spawned, LEVELS[1].entries.length);
  flow.bundles.forEach((b, i) => assert.ok(Math.abs(b.spawnT - (2 + LEVELS[1].entries[i].at / 1000)) < 1e-9));
});

test('several bundles can be in flight', () => {
  const flow = createFlow(LEVELS[4]);
  let most = 0;
  for (let i = 0; i < 4000; i++) {
    stepFlow(flow, DT);
    most = Math.max(most, flow.bundles.filter((b) => b.state === 'flow').length);
  }
  assert.ok(most >= 2, `max in flight ${most}`);
});

test('surge switches speed at the surge point', () => {
  const lv = { id: 's', speed: 0.35, entries: [{ at: 0, speed: 0.35, surge: { at: 0.5, speed: 0.7 } }] };
  const flow = createFlow(lv);
  while (!activeBundle(flow)) stepFlow(flow, DT);
  const b = activeBundle(flow);
  const tS = b.spawnT + 0.5 / 0.35;
  assert.ok(Math.abs(headAt(flow, b, tS) - 0.5) < 1e-9);
  assert.ok(Math.abs(headAt(flow, b, tS + 0.1) - (0.5 + 0.07)) < 1e-9);
  assert.ok(Math.abs(headAt(flow, b, tS - 0.1) - (0.5 - 0.035)) < 1e-9);
});

test('frame-rate independent with surges', () => {
  const arrival = (dt) => {
    const flow = createFlow(LEVELS[1]);
    for (;;) {
      stepFlow(flow, dt);
      const b = flow.bundles.find((x) => x.id === 2 && x.state === 'flow'); // a surging bundle
      if (b && b.sHead - b.bodyFromHead >= flow.sCatch) return flow.t;
    }
  };
  assert.ok(LEVELS[1].entries[2].surge);
  assert.ok(Math.abs(arrival(1 / 30) - arrival(1 / 144)) <= 1 / 30 + 1e-9);
});

test('uncaught decoys drain without counting as missed', () => {
  const { score, flow } = play(LEVELS[3], () => null);
  assert.equal(score.counts.MISSED, flow.noodleTotal);
  assert.ok(flow.leafTotal > 0 && flow.tomatoTotal > 0);
  assert.equal(score.points, 0);
});

// ---- catch & scoring ----

test('the bundle closest to its catch moment wins', () => {
  const lv = { id: 'c', speed: 0.5, entries: [{ at: 0 }, { at: 170 }] };
  const flow = createFlow(lv);
  for (let i = 0; i < 1000 && flow.spawned < 2; i++) stepFlow(flow, DT);
  const [a, b] = flow.bundles;
  const r = judge(flow, crossTime(flow, a) + 0.15);
  assert.equal(r.bundle, b);
  assert.equal(r.grade, 'PERFECT');
});

test('same ms offset gives same grade at different catch-line speeds', () => {
  const grade = (entry, off) => {
    const flow = createFlow({ id: 'g', speed: 0.4, entries: [entry] });
    while (!activeBundle(flow)) stepFlow(flow, DT);
    return judge(flow, crossTime(flow, activeBundle(flow)) + off / 1000).grade;
  };
  for (const off of [-150, -90, 0, 40, 110, 200, 300]) {
    assert.equal(grade({ at: 0, speed: 0.4 }, off), grade({ at: 0, speed: 0.4, surge: { at: 0.3, speed: 0.9 } }, off), `offset ${off}`);
  }
});

test('tomato: +5 g, +100, combo kept; leaf: -50 (floor 0), combo reset, grams kept', () => {
  const s = createScore();
  for (let i = 0; i < 3; i++) recordGrade(s, 'PERFECT', 10);
  const pts = s.points;
  recordTomato(s, 5);
  assert.equal(s.combo, 3);
  assert.equal(s.grams, 35);
  assert.equal(s.points, pts + 100);
  const s2 = createScore();
  s2.points = 30;
  s2.combo = 2;
  s2.grams = 20;
  recordLeaf(s2);
  assert.deepEqual([s2.points, s2.combo, s2.grams, s2.leaves], [0, 0, 20, 1]);
});

test('a caught leaf is flicked away on the short cycle; a tomato is lifted', () => {
  const flow = createFlow({ id: 'd', speed: 0.6, entries: [{ at: 0, kind: 'leaf' }, { at: 3000, kind: 'tomato' }] });
  const hand = createHand();
  while (flow.spawned < 1) stepFlow(flow, DT);
  tryCatch(flow, hand, crossTime(flow, flow.bundles[0]));
  assert.ok(hand.flick);
  assert.ok(stepHand(hand, cycleMs('MISS')).some((e) => e.type === 'ready'));
  while (flow.spawned < 2) stepFlow(flow, DT);
  tryCatch(flow, hand, crossTime(flow, flow.bundles[1]));
  assert.equal(hand.flick, false);
  assert.equal(hand.kind, 'tomato');
});

// ---- level data ----

const crossings = (lv) => {
  const flow = createFlow(lv);
  return lv.entries.map((e) => ({ e, cross: flow.leadIn * 1000 + e.cross }));
};
const topSpeed = (lv) => Math.max(...(lv.entries || [{ speed: lv.speed }]).map((e) => Math.max(e.speed, e.surge ? e.surge.speed : 0)));
const perfectMs = (lv) => (lv.windows || {}).perfect ?? 60;
const share = (lv) => lv.starThresholds[2] / createFlow(lv).maxGrams;

test('five levels in order', () => {
  assert.deepEqual(LEVELS.map((l) => l.name), ['FIRST TASTE', 'SURGE', 'BAMBOO TUNNEL', 'GARDEN GUESTS', 'MATSURI']);
  for (const l of scripted) assert.ok(l.twist && l.hint, `${l.id} intro text`);
});

test('each of levels 2–5 adds a feature the level before lacks', () => {
  const features = (lv) => {
    const f = new Set();
    if (!lv.entries) return f;
    if (new Set(lv.entries.map((e) => e.speed)).size > 1 || lv.entries.some((e) => e.surge)) f.add('speed');
    if (lv.covers && lv.covers.length) f.add('covers');
    if (lv.entries.some((e) => e.kind !== 'noodle')) f.add('decoys');
    if (lv.distractions) f.add('distractions');
    const c = crossings(lv).filter((x) => catchable(x.e)).map((x) => x.cross).sort((a, b) => a - b);
    if (c.some((t, i) => i && t - c[i - 1] <= 760)) f.add('pairs');
    return f;
  };
  for (let i = 1; i < LEVELS.length; i++) {
    const prev = features(LEVELS[i - 1]);
    assert.ok([...features(LEVELS[i])].some((x) => !prev.has(x)), LEVELS[i].id);
  }
});

test('level data is fair', () => {
  for (const lv of scripted) {
    for (const [, end] of lv.covers || []) assert.ok(end <= S_CATCH - 0.03 + 1e-9, `${lv.id} cover ends at ${end}`);
    const w = { ...lv.windows };
    for (const e of lv.entries) {
      assert.ok(e.at >= 0, `${lv.id} entry starts before the level`);
      if (!e.surge) continue;
      const ww = windowsFor(e.kind, { perfect: 60, good: 120, head: 160, tail: 220, ...w });
      const len = (e.surge.speed * (ww.head + ww.tail)) / 1000;
      assert.ok(e.surge.at <= S_CATCH - len + 1e-9, `${lv.id} surge at ${e.surge.at} too late`);
    }
    const c = crossings(lv).filter((x) => catchable(x.e) && !x.e.choice).map((x) => x.cross).sort((a, b) => a - b);
    for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] >= 720 - 1e-6, `${lv.id} crossings ${c[i - 1]} → ${c[i]}`);
    assert.ok(lv.starThresholds[2] <= createFlow(lv).maxGrams);
  }
});

test('difficulty ramps from level 2 to 5, and MATSURI is near impossible', () => {
  for (let i = 2; i < LEVELS.length; i++) {
    const [a, b] = [LEVELS[i - 1], LEVELS[i]];
    assert.ok(topSpeed(b) >= topSpeed(a), `top speed ${a.id} → ${b.id}`);
    assert.ok(perfectMs(b) <= perfectMs(a), `perfect window ${a.id} → ${b.id}`);
    assert.ok(share(b) >= share(a), `3-star share ${a.id} → ${b.id}`);
  }
  const m = LEVELS[4];
  assert.ok(perfectMs(m) <= 40);
  assert.ok(topSpeed(m) >= 1.0);
  assert.ok(share(m) >= 0.95);
  const c = crossings(m).filter((x) => catchable(x.e)).map((x) => x.cross).sort((a, b) => a - b);
  assert.ok(c.some((t, i) => i && Math.abs(t - c[i - 1] - 720) < 1), 'a 720 ms pair');
});

test('a perfectly timed run earns 3 stars on every level, MATSURI included', () => {
  for (const lv of LEVELS) {
    const { score, grades, flow } = play(lv, (b) => (b.kind === 'leaf' ? null : 0));
    assert.ok(grades.every((g) => g.grade === 'PERFECT'), `${lv.id}: ${JSON.stringify(grades.filter((g) => g.grade !== 'PERFECT'))}`);
    assert.equal(score.counts.PERFECT, flow.noodleTotal);
    assert.equal(starsFor(score.grams, lv.starThresholds), 3, lv.id);
  }
});

test('tapping 300 ms early in MATSURI catches the leaf in front of a noodle', () => {
  const lv = LEVELS[4];
  const leafIdx = lv.entries.findIndex((e) => e.kind === 'leaf');
  const next = lv.entries[leafIdx + 1];
  const flow = createFlow(lv);
  for (let i = 0; i < 1e5 && flow.spawned <= leafIdx + 1; i++) stepFlow(flow, DT);
  const r = judge(flow, flow.leadIn + (next.cross - 300) / 1000);
  assert.equal(r.bundle && r.bundle.kind, 'leaf');
});

test('tomatoes roll slower than the speed written for them', async () => {
  const { TOMATO_SPEED_FACTOR } = await import('../src/levels.js');
  assert.ok(TOMATO_SPEED_FACTOR < 1);
  const tomatoes = LEVELS.flatMap((l) => l.entries || []).filter((e) => e.kind === 'tomato');
  assert.ok(tomatoes.length > 0);
  for (const e of tomatoes) assert.ok(Math.abs(e.speed - e.writtenSpeed * TOMATO_SPEED_FACTOR) < 1e-12);
  // Crossing times stay where the script put them, so the fairness gaps hold.
  for (const lv of scripted) {
    const flow = createFlow(lv);
    for (const e of lv.entries.filter((x) => x.kind === 'tomato')) {
      const b = { spawnT: 0, v0: e.speed, surge: null, tSurge: Infinity, bodyFromHead: (e.speed * windowsFor('tomato', flow.windows).head) / 1000 };
      assert.ok(Math.abs(e.at + crossTime(flow, b) * 1000 - e.cross) < 1e-6, `${lv.id} tomato at ${e.cross}`);
    }
  }
});

// ---- save data ----

test('a v1 save with 4 levels unlocked keeps FIRST TASTE best and clamps to the level list', () => {
  const saved = JSON.stringify({
    unlocked: 4,
    best: { 'first-taste': { score: 975, stars: 3 }, 'lunch-rush': { score: 500, stars: 2 }, 'swift-stream': { score: 1, stars: 1 }, 'kyoto-rapids': { score: 1, stars: 1 } },
    muted: false,
  });
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem() {} } });
  try {
    const p = loadProgress();
    assert.deepEqual(p.unlocked, { kyoto: 4, hall: 1, pool: 1 });
    assert.deepEqual(p.best['first-taste'], { score: 975, stars: 3 });
    const shown = LEVELS.filter((l) => p.best[l.id]).map((l) => l.id);
    assert.deepEqual(shown, ['first-taste']);
    assert.equal(loadProgress({ kyoto: 3, hall: 5, pool: 5 }).unlocked.kyoto, 3);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
  }
});

test('noodle grams still follow the v1 grade table', () => {
  assert.equal(gramsFor('TAIL', 10), 2.5);
});
