// Boot, fixed-timestep loop, input and screen flow.

import { LEVELS } from './levels.js';
import { StraightPerspectivePath } from './path.js';
import { createFlow, stepFlow, isFinished, BUNDLE_GRAMS, TOMATO_GRAMS, S_CATCH } from './flow.js';
import { createHand, stepHand, tryCatch, handIdle } from './catch.js';
import { createScore, recordGrade, recordMissedBundle, recordTomato, recordLeaf, starsFor, gramsFor } from './score.js';
import { loadProgress, saveProgress, applyResult } from './storage.js';
import {
  createRenderer, drawWorld, drawHUD, drawTitle, drawSelect, drawResults,
  selectButtons, resultButtons, MUTE_BTN, QUIT_BTN, hit, fmtG,
} from './render.js';
import { GRADE_COLOR } from './sprites.js';
import { unlockAudio, setMuted, sfx } from './audio.js';

const STEP = 1 / 120;
const DEMO_LEVEL = { id: 'demo', bundles: Infinity, speed: 0.4, spacingMs: 1500, leadInMs: 200 };

const path = new StraightPerspectivePath();
const canvas = document.getElementById('game');
const R = createRenderer(canvas, path);
const progress = loadProgress(LEVELS.length);
setMuted(progress.muted);

const S = {
  screen: 'title',
  t: 0,
  levelIndex: 0,
  flow: createFlow(DEMO_LEVEL, { sCatch: S_CATCH }),
  hand: createHand(),
  score: createScore(),
  cupGrams: 0,
  popups: [],
  particles: [],
  endDelay: 0,
  result: null,
};
const taps = [];

function startLevel(i) {
  S.levelIndex = i;
  S.flow = createFlow(LEVELS[i], { sCatch: S_CATCH });
  S.hand = createHand();
  S.score = createScore();
  S.cupGrams = 0;
  S.popups = [];
  S.particles = [];
  S.endDelay = 0;
  S.screen = 'play';
  taps.length = 0;
}

function toSelect() {
  S.screen = 'select';
  S.flow = createFlow(DEMO_LEVEL, { sCatch: S_CATCH });
  S.hand = createHand();
  S.cupGrams = 0;
  S.popups = [];
}

function finishLevel() {
  const lv = LEVELS[S.levelIndex];
  const stars = starsFor(S.score.grams, lv.starThresholds);
  const { newBest } = applyResult(progress, S.levelIndex, lv.id, S.score.points, stars, LEVELS.length);
  saveProgress(progress);
  S.result = { stars, newBest, best: progress.best[lv.id].score };
  S.screen = 'results';
  sfx(stars > 0 ? 'fanfare' : 'plop');
}

function hasNext() {
  return S.levelIndex + 1 < LEVELS.length && S.levelIndex + 1 < progress.unlocked;
}

function vibrate(ms) {
  if (progress.muted) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Not supported.
  }
}

function feedback(grade, kind) {
  const tip = path.at(S_CATCH);
  if (kind === 'tomato') {
    S.popups.push({ text: '+5G', color: GRADE_COLOR.TOMATO, x: tip.x, y: tip.y + 16, age: 0, big: true });
    sfx('splash');
    sfx('chime');
    vibrate(20);
    return;
  }
  if (kind === 'leaf') {
    S.popups.push({ text: 'LEAF!', color: GRADE_COLOR.MISS, x: tip.x, y: tip.y + 16, age: 0, big: true });
    S.particles.push({ x: tip.x, y: tip.y, vx: -70, vy: -60, age: 0, leaf: true });
    sfx('locked');
    return;
  }
  S.popups.push({ text: grade, color: GRADE_COLOR[grade], x: tip.x, y: tip.y + 16, age: 0, big: grade !== 'MISS' });
  if (grade === 'MISS') {
    sfx('plop');
    return;
  }
  sfx('splash');
  if (grade !== 'TAIL') sfx('slurp');
  vibrate(grade === 'PERFECT' ? 30 : grade === 'GOOD' ? 20 : 12);
  for (let i = 0; i < (grade === 'PERFECT' ? 12 : 7); i++) {
    S.particles.push({
      x: tip.x + (Math.random() - 0.5) * 10, y: tip.y,
      vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 55, age: 0,
    });
  }
  if (S.score.combo >= 3 && S.score.combo % 3 === 0) sfx('chime');
}

// Taps are judged at their own timestamp. `anchor` is the real time that the
// simulation's current time corresponds to.
function processTaps(anchor) {
  while (taps.length) {
    const ts = taps.shift();
    if (S.screen !== 'play') continue;
    const tTap = S.flow.t + (ts - anchor) / 1000;
    const r = tryCatch(S.flow, S.hand, tTap);
    if (!r) continue; // hand still busy
    const kind = r.bundle ? r.bundle.kind : 'noodle';
    if (kind === 'tomato') {
      S.hand.grams = TOMATO_GRAMS;
      recordTomato(S.score, TOMATO_GRAMS);
    } else if (kind === 'leaf') {
      recordLeaf(S.score);
    } else {
      S.hand.grams = gramsFor(r.grade, BUNDLE_GRAMS);
      recordGrade(S.score, r.grade, BUNDLE_GRAMS);
    }
    feedback(r.grade, kind);
  }
}

function update(dt) {
  S.t += dt;
  for (const p of S.popups) p.age += dt;
  S.popups = S.popups.filter((p) => p.age < 0.7);
  for (const q of S.particles) {
    q.age += dt;
    q.vy += 260 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  S.particles = S.particles.filter((q) => q.age < (q.leaf ? 0.9 : 0.5));

  const events = stepFlow(S.flow, dt);
  if (S.screen !== 'play') return;
  for (const e of events) {
    if (e.type === 'drain' && e.bundle.kind === 'noodle') {
      recordMissedBundle(S.score);
      sfx('plop');
    }
  }
  for (const e of stepHand(S.hand, dt * 1000)) {
    if (e.type === 'drop' && e.grams > 0) {
      S.cupGrams += e.grams;
      sfx('drop');
    }
  }
  if (isFinished(S.flow) && handIdle(S.hand)) {
    S.endDelay += dt;
    if (S.endDelay > 0.7) finishLevel();
  }
}

function render() {
  const lv = LEVELS[S.levelIndex];
  const playing = S.screen === 'play' || S.screen === 'results';
  const max = S.flow.maxGrams;
  drawWorld(R.g, R.bg, {
    path, t: S.t, flow: S.flow, hand: S.hand, sCatch: S_CATCH,
    covers: playing ? lv.covers : null,
    distractions: playing ? lv.distractions : null,
    intro: S.screen === 'play' ? { level: lv, n: S.levelIndex + 1, t: S.flow.t } : null,
    cupFill: playing ? S.cupGrams / max : 0,
    cupLabel: playing ? `${fmtG(S.cupGrams)}/${max}G` : '',
    popups: S.popups, particles: S.particles,
  });
  if (S.screen === 'play') {
    const c = S.score.counts;
    drawHUD(R.g, { left: S.flow.noodleTotal - (c.PERFECT + c.GOOD + c.TAIL + c.MISSED), combo: S.score.combo, muted: progress.muted });
  } else if (S.screen === 'title') {
    drawTitle(R.g, S.t, progress.muted);
  } else if (S.screen === 'select') {
    drawSelect(R.g, LEVELS, progress, progress.muted);
  } else if (S.screen === 'results') {
    const f = S.flow;
    const totals = { maxGrams: f.maxGrams, noodles: f.noodleTotal, tomatoes: f.tomatoTotal, leaves: f.leafTotal };
    drawResults(R.g, { level: lv, score: S.score, result: S.result, hasNext: hasNext(), muted: progress.muted, totals });
  }
  R.present();
}

// ---------- input ----------

function press(p, ts, viaKey) {
  unlockAudio();
  if (p && hit(MUTE_BTN, p)) {
    progress.muted = !progress.muted;
    setMuted(progress.muted);
    saveProgress(progress);
    sfx('tick');
    return;
  }
  switch (S.screen) {
    case 'title':
      sfx('tick');
      toSelect();
      return;
    case 'select': {
      if (viaKey) {
        startLevel(Math.min(progress.unlocked, LEVELS.length) - 1);
        return;
      }
      const i = selectButtons(LEVELS.length).findIndex((b) => hit(b, p));
      if (i < 0) return;
      if (i < progress.unlocked) {
        sfx('tick');
        startLevel(i);
      } else {
        sfx('locked');
      }
      return;
    }
    case 'play':
      if (p && hit(QUIT_BTN, p)) {
        sfx('tick');
        toSelect();
        return;
      }
      taps.push(ts);
      return;
    case 'results': {
      if (viaKey) {
        startLevel(S.levelIndex);
        return;
      }
      const b = resultButtons(hasNext()).find((x) => hit(x, p));
      if (!b) return;
      sfx('tick');
      if (b.id === 'retry') startLevel(S.levelIndex);
      else if (b.id === 'next') startLevel(S.levelIndex + 1);
      else toSelect();
      return;
    }
  }
}

function eventTime(e) {
  const now = performance.now();
  // Event timestamps share performance.now()'s clock in current browsers;
  // fall back if a browser reports something else.
  return e.timeStamp > 0 && Math.abs(e.timeStamp - now) < 1000 ? e.timeStamp : now;
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  press(R.toBuffer(e.clientX, e.clientY), eventTime(e), false);
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.key !== ' ') return;
  e.preventDefault();
  if (e.repeat) return;
  press(null, eventTime(e), true);
});
for (const type of ['touchstart', 'touchmove', 'dblclick', 'contextmenu', 'gesturestart']) {
  canvas.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
window.addEventListener('resize', () => R.resize());

// ---------- loop ----------

let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  processTaps(now - acc * 1000);
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

R.resize();
requestAnimationFrame(frame);

// Exposed for debugging in the browser console only.
window.__somen = { S, progress, LEVELS };
