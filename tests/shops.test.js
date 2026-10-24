import { test } from 'node:test';
import assert from 'node:assert/strict';

import { StraightPerspectivePath, lanes, LANE_LAYOUT } from '../src/path.js';
import { createFlow, stepFlow, isFinished, crossTime, activeBundle, windowsFor, DEFAULT_WINDOWS } from '../src/flow.js';
import { tryCatch, createHand, stepHand, pickTube } from '../src/catch.js';
import { createScore, recordGrade, recordTomato, recordLeaf, recordMissedBundle, starsFor } from '../src/score.js';
import { SHOPS, ALL_LEVELS, KYOTO_LEVELS, LEVELS } from '../src/levels.js';

const DT = 1 / 120;
const catchable = (e) => e.kind !== 'leaf';
const scripted = ALL_LEVELS.filter((l) => l.entries);

// Plays a level, tapping the right tube at crossTime + offsetMs(bundle) (null = no tap).
function play(level, offsetMs) {
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
      if (flow.t + DT < tTap) continue;
      done.add(b.id);
      const r = tryCatch(flow, hand, tTap, flow.tubes.length > 1 ? b.tube : null);
      assert.ok(r, `hand busy for bundle ${b.id} of ${level.id}`);
      grades.push(r.grade);
      if (!r.bundle) recordGrade(score, 'MISS', 10);
      else if (r.bundle.kind === 'tomato') recordTomato(score, 5);
      else if (r.bundle.kind === 'leaf') recordLeaf(score);
      else recordGrade(score, r.grade, 10);
    }
    for (const e of stepFlow(flow, DT)) if (e.type === 'drain' && e.bundle.kind === 'noodle') recordMissedBundle(score);
    stepHand(hand, DT * 1000);
  }
  return { flow, score, grades };
}

const catchXs = (lv) => (lv.tubes || [{ path: new StraightPerspectivePath() }]).map((t) => t.path.at(t.path.sCatch ?? 0.85).x);

// ---- shops ----

test('three shops of five levels, ids unique, shop 1 unchanged', () => {
  assert.deepEqual(SHOPS.map((s) => s.name), ['KYOTO FLUME', 'FLUME HALL', 'POOL SLIDES']);
  for (const s of SHOPS) assert.equal(s.levels.length, 5, s.id);
  assert.deepEqual(SHOPS[1].levels.map((l) => l.name), ['TWIN FLUMES', 'THREE STREAMS', 'FOUR WAYS', 'CROSSFIRE', 'GRAND HALL']);
  assert.deepEqual(SHOPS[2].levels.map((l) => l.name), ['SPLASH DOWN', 'CORKSCREW', 'TWIN SPIRALS', 'WAVE POOL', 'GRAND SLIDE']);
  assert.equal(SHOPS[0].levels, KYOTO_LEVELS);
  assert.equal(LEVELS, KYOTO_LEVELS);
  assert.equal(new Set(ALL_LEVELS.map((l) => l.id)).size, 15);
  for (const l of KYOTO_LEVELS) assert.equal(l.tubes, undefined);
});

// ---- lanes ----

test('a lane centred on its own vanishing point is exactly the shop 1 flume', () => {
  const a = new StraightPerspectivePath();
  const b = new StraightPerspectivePath({ vanishX: 78, converge: 0.6 });
  for (let s = 0; s <= 1.0001; s += 0.05) assert.deepEqual(a.at(s), b.at(s));
  assert.deepEqual(lanes(1)[0].at(0.5), a.at(0.5));
});

test('lanes end left of the bowl and are wide enough apart to aim at', () => {
  for (const n of [2, 3, 4]) {
    const ls = lanes(n);
    for (const p of ls) assert.ok(p.at(1).x + p.widthNear / 2 < 138, `${n} lanes: near end ${p.at(1).x}`);
    const xs = ls.map((p) => p.at(0.85).x);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 26, `${n} lanes: ${xs[i - 1]} → ${xs[i]}`);
    assert.equal(LANE_LAYOUT[n].centres.length, n);
  }
});

test('a tap aims at the tube with the nearest catch point', () => {
  const xs = lanes(4).map((p) => p.at(0.85).x);
  assert.equal(pickTube(xs, 0), 0);
  assert.equal(pickTube(xs, xs[2] - 3), 2);
  assert.equal(pickTube(xs, 179), 3);
  assert.equal(pickTube([78], 2), 0);
});

// ---- curves ----

const curves = SHOPS[2].levels.flatMap((l) => l.tubes.map((t) => ({ level: l.id, path: t.path })));

test('curved tubes: even speed in world terms', () => {
  for (const { level, path } of curves) {
    const rates = [];
    for (let s = 0.05; s < 0.95; s += 0.05) {
      const a = path.at(s - 0.003);
      const b = path.at(s + 0.003);
      rates.push(Math.hypot(b.x - a.x, b.y - a.y) / path.at(s).scale);
    }
    const mean = rates.reduce((x, y) => x + y) / rates.length;
    for (const r of rates) assert.ok(Math.abs(r / mean - 1) < 0.05, `${level}: ${r} vs ${mean}`);
  }
});

test('curved tubes end in a straight run-out with the catch line on it, low on screen', () => {
  for (const { level, path } of curves) {
    const angle = (s) => {
      const t = path.tangent(s);
      return Math.atan2(t.y, t.x);
    };
    const a0 = angle(path.runoutStart + 0.005);
    for (let s = path.runoutStart + 0.005; s <= 0.995; s += 0.005) {
      assert.ok(Math.abs(angle(s) - a0) < (10 * Math.PI) / 180, `${level} turns at s ${s.toFixed(3)}`);
    }
    assert.ok(path.sCatch > path.runoutStart && path.sCatch < 1);
    const c = path.at(path.sCatch);
    assert.ok(c.y > 213 && c.y < 280, `${level} catch y ${c.y}`);
    assert.ok(c.x + path.widthNear / 2 < 140 + 6, `${level} catch x ${c.x}`);
  }
});

test('curved tubes in one level have distinct catch points to aim at', () => {
  for (const lv of SHOPS[2].levels) {
    const xs = catchXs(lv).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 26, `${lv.id}`);
  }
});

// ---- aiming in the engine ----

test('tapping the wrong tube is an empty MISS and the bundle keeps flowing', () => {
  const lv = SHOPS[1].levels[0];
  const flow = createFlow(lv);
  while (!activeBundle(flow)) stepFlow(flow, DT);
  const b = activeBundle(flow);
  const r = tryCatch(flow, createHand(), crossTime(flow, b), 1 - b.tube);
  assert.equal(r.grade, 'MISS');
  assert.equal(b.state, 'flow');
});

test('one hand: the cooldown is shared across tubes', () => {
  const lv = { id: 'x', speed: 0.5, tubes: lanes(4).map((path) => ({ path })), entries: [{ at: 0, tube: 0 }, { at: 200, tube: 3 }] };
  const flow = createFlow(lv);
  for (let i = 0; i < 1000 && flow.spawned < 2; i++) stepFlow(flow, DT);
  const hand = createHand();
  const [a, b] = flow.bundles;
  assert.ok(tryCatch(flow, hand, crossTime(flow, a), 0));
  assert.equal(tryCatch(flow, hand, crossTime(flow, b), 3), null);
  assert.equal(hand.tube, 0);
});

// ---- level data ----

test('all 15 levels are fair (covers, surges, one hand across tubes)', () => {
  for (const lv of scripted) {
    const flow = createFlow(lv);
    flow.tubes.forEach((t, i) => {
      for (const [, end] of t.covers) assert.ok(end <= t.sCatch - 0.03 + 1e-9, `${lv.id} tube ${i} cover ends at ${end}`);
    });
    for (const e of lv.entries) {
      assert.ok(e.at >= 0, `${lv.id}: entry at ${e.at}`);
      if (!e.surge) continue;
      const w = windowsFor(e.kind, { ...DEFAULT_WINDOWS, ...lv.windows });
      const len = (e.surge.speed * (w.head + w.tail)) / 1000;
      assert.ok(e.surge.at <= flow.tubes[e.tube || 0].sCatch - len + 1e-9, `${lv.id} surge at ${e.surge.at}`);
    }
    const c = lv.entries.filter((e) => catchable(e) && !e.choice).map((e) => e.cross).sort((a, b) => a - b);
    for (let i = 1; i < c.length; i++) assert.ok(c[i] - c[i - 1] >= 720 - 1e-6, `${lv.id}: ${c[i - 1]} → ${c[i]}`);
    assert.ok(lv.starThresholds[2] <= flow.maxGrams, lv.id);
    if (lv.tubes) for (const e of lv.entries) assert.ok((e.tube || 0) < lv.tubes.length, `${lv.id} tube ${e.tube}`);
  }
});

test('difficulty ramps inside every shop, ending near impossible', () => {
  const perfect = (lv) => (lv.windows || {}).perfect ?? 60;
  const share = (lv) => lv.starThresholds[2] / createFlow(lv).maxGrams;
  for (const shop of SHOPS) {
    const ls = shop.levels;
    for (let i = 2; i < ls.length; i++) {
      assert.ok(perfect(ls[i]) <= perfect(ls[i - 1]), `${shop.id} perfect ${ls[i - 1].id} → ${ls[i].id}`);
      assert.ok(share(ls[i]) >= share(ls[i - 1]) - 1e-9, `${shop.id} share ${ls[i - 1].id} → ${ls[i].id}`);
    }
    const last = ls[4];
    assert.ok(perfect(last) <= 40, last.id);
    assert.ok(share(last) >= 0.95, `${last.id} share ${share(last)}`);
    const c = last.entries.filter(catchable).map((e) => e.cross).sort((a, b) => a - b);
    assert.ok(c.some((t, i) => i && Math.abs(t - c[i - 1] - 720) < 1), `${last.id} has a 720 ms pair`);
  }
});

test('every level adds something the level before it in the shop lacks', () => {
  const features = (lv) => {
    const f = new Set();
    const n = lv.tubes ? lv.tubes.length : 1;
    for (let k = 2; k <= n; k++) f.add(`tubes${k}`);
    if (lv.tubes && lv.tubes.some((t) => !t.path.straight)) f.add('curves');
    if ((lv.covers && lv.covers.length) || (lv.tubes || []).some((t) => t.covers && t.covers.length)) f.add('covers');
    if (!lv.entries) return f;
    if (new Set(lv.entries.map((e) => e.speed)).size > 1 || lv.entries.some((e) => e.surge)) f.add('speed');
    if (lv.entries.some((e) => e.surge)) f.add('surges');
    if (lv.entries.some((e) => e.kind !== 'noodle')) f.add('decoys');
    if (lv.distractions) f.add('distractions');
    const c = lv.entries.filter(catchable).map((e) => e.cross).sort((a, b) => a - b);
    if (c.some((t, i) => i && t - c[i - 1] <= 760)) f.add('pairs');
    return f;
  };
  for (const shop of SHOPS) {
    for (let i = 1; i < 5; i++) {
      const prev = features(shop.levels[i - 1]);
      assert.ok([...features(shop.levels[i])].some((x) => !prev.has(x)), `${shop.levels[i].id}`);
    }
  }
});

test('a perfectly timed run on the right tube earns 3 stars on all 15 levels', () => {
  for (const lv of ALL_LEVELS) {
    const { score, grades, flow } = play(lv, (b) => (b.kind === 'leaf' ? null : 0));
    assert.ok(grades.every((g) => g === 'PERFECT'), `${lv.id}: ${grades.join(',')}`);
    assert.equal(score.counts.PERFECT, flow.noodleTotal, lv.id);
    assert.equal(score.leaves, 0, lv.id);
    assert.equal(starsFor(score.grams, lv.starThresholds), 3, lv.id);
  }
});

test('in CROSSFIRE, tapping the tube next door at the noodle moment catches the leaf', () => {
  const lv = SHOPS[1].levels[3];
  const first = lv.entries.find((e) => e.kind === 'noodle');
  const leaf = lv.entries.find((e) => e.kind === 'leaf' && Math.abs(e.cross - first.cross) < 100);
  assert.ok(leaf && leaf.tube !== first.tube);
  const flow = createFlow(lv);
  for (let i = 0; i < 1e5 && flow.spawned < 2; i++) stepFlow(flow, DT);
  const r = tryCatch(flow, createHand(), flow.leadIn + first.cross / 1000, leaf.tube);
  assert.equal(r.bundle && r.bundle.kind, 'leaf');
});
