// Boot, fixed-timestep loop, input and screen flow.
//
// Screens: title → shops → select (a shop's levels) → play → results.
//
// Keyboard: in a level, ← → aim at a tube and Space (or Enter) catches; 1–4 and
// A S D F aim and catch in one press. In menus, the arrows move a highlight,
// Space or Enter picks, Esc goes back.

import { SHOPS } from './levels.js';
import { StraightPerspectivePath } from './path.js';
import { createFlow, stepFlow, isFinished, BUNDLE_GRAMS, TOMATO_GRAMS, S_CATCH } from './flow.js';
import { createHand, stepHand, tryCatch, handIdle, pickTube } from './catch.js';
import { createScore, recordGrade, recordMissedBundle, recordTomato, recordLeaf, starsFor, gramsFor } from './score.js';
import { loadProgress, saveProgress, applyResult } from './storage.js';
import {
  createRenderer, drawWorld, drawHUD, drawTitle, drawShops, drawSelect, drawResults,
  shopButtons, selectButtons, resultButtons, MUTE_BTN, QUIT_BTN, hit, fmtG,
} from './render.js';
import { GRADE_COLOR } from './sprites.js';
import { unlockAudio, setMuted, sfx } from './audio.js';

const STEP = 1 / 120;
const SHOP1_PATH = new StraightPerspectivePath();
const TUBE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3 };

const canvas = document.getElementById('game');
const R = createRenderer(canvas);
const progress = loadProgress(Object.fromEntries(SHOPS.map((s) => [s.id, s.levels.length])));
setMuted(progress.muted);

// The tubes a level is drawn and played on (shop 1 levels have the one flume).
function tubesOf(level) {
  return level.tubes || [{ path: SHOP1_PATH, covers: level.covers || [] }];
}

function sceneOf(level, shop) {
  return R.scene({ key: level.id, theme: shop.theme, tubes: tubesOf(level) });
}

// Bundles flowing behind the menus, on the shop's first level's tubes.
function demoFlow(shop) {
  const first = shop.levels[0];
  return createFlow(
    { id: `demo-${shop.id}`, bundles: Infinity, speed: shop.id === 'pool' ? 0.3 : 0.4, spacingMs: 1500, leadInMs: 200, tubes: first.tubes },
    { sCatch: S_CATCH },
  );
}

const S = {
  screen: 'title',
  t: 0,
  shopIndex: 0,
  levelIndex: 0,
  flow: demoFlow(SHOPS[0]),
  hand: createHand(),
  score: createScore(),
  cupGrams: 0,
  popups: [],
  particles: [],
  endDelay: 0,
  result: null,
  aimTube: 0, // the tube the next catch goes to (arrow keys or the last tap)
  cursor: 0, // highlighted item on menu screens
};
const taps = [];

const shop = () => SHOPS[S.shopIndex];
const level = () => shop().levels[S.levelIndex];
const unlockedIn = (sh) => progress.unlocked[sh.id] || 1;

function startLevel(i) {
  S.levelIndex = i;
  S.flow = createFlow(level(), { sCatch: S_CATCH });
  S.hand = createHand();
  S.score = createScore();
  S.cupGrams = 0;
  S.popups = [];
  S.particles = [];
  S.endDelay = 0;
  S.aimTube = 0;
  S.screen = 'play';
  taps.length = 0;
}

function toMenu(screen) {
  S.screen = screen;
  S.flow = demoFlow(screen === 'title' || screen === 'shops' ? SHOPS[0] : shop());
  S.hand = createHand();
  S.cupGrams = 0;
  S.popups = [];
  // Start the highlight on the shop just visited, or the newest open level.
  if (screen === 'shops') S.cursor = S.shopIndex;
  if (screen === 'select') S.cursor = Math.min(unlockedIn(shop()), shop().levels.length) - 1;
}

function finishLevel() {
  const lv = level();
  const stars = starsFor(S.score.grams, lv.starThresholds);
  const { newBest } = applyResult(progress, shop().id, S.levelIndex, lv.id, S.score.points, stars, shop().levels.length);
  saveProgress(progress);
  S.result = { stars, newBest, best: progress.best[lv.id].score };
  S.screen = 'results';
  S.cursor = hasNext() ? 1 : 0; // NEXT when it's open, else RETRY
  sfx(stars > 0 ? 'fanfare' : 'plop');
}

function hasNext() {
  return S.levelIndex + 1 < shop().levels.length && S.levelIndex + 1 < unlockedIn(shop());
}

function vibrate(ms) {
  if (progress.muted) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Not supported.
  }
}

// Each tube's catch point on screen, left to right as the level defines them.
function catchPoints() {
  return tubesOf(S.screen === 'play' || S.screen === 'results' ? level() : SHOPS[0].levels[0]).map((t, i) =>
    t.path.at((S.flow.tubes[i] || S.flow.tubes[0]).sCatch),
  );
}

function feedback(grade, kind, tube) {
  const tip = catchPoints()[tube] || catchPoints()[0];
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
    const { ts, tube } = taps.shift();
    if (S.screen !== 'play') continue;
    const tTap = S.flow.t + (ts - anchor) / 1000;
    const multi = S.flow.tubes.length > 1;
    const r = tryCatch(S.flow, S.hand, tTap, multi ? tube : null);
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
    feedback(r.grade, kind, S.hand.tube);
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
  // A resting hand waits over the tube being aimed at.
  if (handIdle(S.hand) && S.hand.tube !== S.aimTube) S.hand.tube = S.hand.fromTube = S.aimTube;
  if (isFinished(S.flow) && handIdle(S.hand)) {
    S.endDelay += dt;
    if (S.endDelay > 0.7) finishLevel();
  }
}

function render() {
  const playing = S.screen === 'play' || S.screen === 'results';
  const menuShop = S.screen === 'title' || S.screen === 'shops' ? SHOPS[0] : shop();
  const lv = playing ? level() : menuShop.levels[0];
  const max = S.flow.maxGrams;
  drawWorld(R.g, {
    scene: sceneOf(lv, playing ? shop() : menuShop),
    t: S.t, flow: S.flow, hand: S.hand,
    distractions: playing ? lv.distractions : null,
    aim: S.screen === 'play' && S.flow.tubes.length > 1 ? S.aimTube : null,
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
  } else if (S.screen === 'shops') {
    drawShops(R.g, SHOPS, progress, progress.muted, S.cursor);
  } else if (S.screen === 'select') {
    drawSelect(R.g, shop(), progress, progress.muted, S.cursor);
  } else if (S.screen === 'results') {
    const f = S.flow;
    const totals = { maxGrams: f.maxGrams, noodles: f.noodleTotal, tomatoes: f.tomatoTotal, leaves: f.leafTotal };
    drawResults(R.g, { level: lv, score: S.score, result: S.result, hasNext: hasNext(), muted: progress.muted, totals, cursor: S.cursor });
  }
  R.present();
}

// ---------- input ----------

function catchAt(tube, ts) {
  S.aimTube = tube;
  taps.push({ ts, tube });
}

function openShop(i) {
  sfx('tick');
  S.shopIndex = i;
  toMenu('select');
}

function openLevel(i) {
  if (i < unlockedIn(shop())) {
    sfx('tick');
    startLevel(i);
  } else {
    sfx('locked');
  }
}

function resultAction(id) {
  sfx('tick');
  if (id === 'retry') startLevel(S.levelIndex);
  else if (id === 'next') startLevel(S.levelIndex + 1);
  else toMenu('select');
}

// `p` is the tap in buffer pixels.
function press(p, ts) {
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
      toMenu('shops');
      return;
    case 'shops': {
      const i = shopButtons(SHOPS.length).findIndex((b) => hit(b, p));
      if (i >= 0) openShop(i);
      return;
    }
    case 'select': {
      if (hit(QUIT_BTN, p)) {
        sfx('tick');
        toMenu('shops');
        return;
      }
      const i = selectButtons(shop().levels.length).findIndex((b) => hit(b, p));
      if (i >= 0) openLevel(i);
      return;
    }
    case 'play':
      if (hit(QUIT_BTN, p)) {
        sfx('tick');
        toMenu('select');
        return;
      }
      catchAt(pickTube(catchPoints().map((c) => c.x), p.x), ts);
      return;
    case 'results': {
      const b = resultButtons(hasNext()).find((x) => hit(x, p));
      if (b) resultAction(b.id);
      return;
    }
  }
}

// Keyboard. Returns true when the key was used (so the page doesn't scroll).
function key(code, ts) {
  const pick = code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
  const back = code === 'Escape' || code === 'Backspace';
  const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[code] || 0;
  const vertical = code === 'ArrowUp' || code === 'ArrowDown';
  const move = (n) => {
    if (!dir) return;
    S.cursor = (S.cursor + dir + n) % n;
    sfx('tick');
  };
  unlockAudio();
  switch (S.screen) {
    case 'title':
      if (!pick) return false;
      sfx('tick');
      toMenu('shops');
      return true;
    case 'shops':
      if (back) return toMenu('title'), true;
      if (pick) return openShop(S.cursor), true;
      if (vertical) return move(SHOPS.length), true;
      return false;
    case 'select':
      if (back) return sfx('tick'), toMenu('shops'), true;
      if (pick) return openLevel(S.cursor), true;
      if (vertical) return move(shop().levels.length), true;
      return false;
    case 'play': {
      if (back) return sfx('tick'), toMenu('select'), true;
      const n = S.flow.tubes.length;
      if (code in TUBE_KEYS) {
        if (TUBE_KEYS[code] < n || n === 1) catchAt(n === 1 ? 0 : TUBE_KEYS[code], ts);
        return true;
      }
      if (code === 'ArrowLeft' || code === 'ArrowRight') {
        S.aimTube = Math.max(0, Math.min(n - 1, S.aimTube + dir));
        return true;
      }
      if (pick) return catchAt(S.aimTube, ts), true;
      return vertical;
    }
    case 'results': {
      if (back) return sfx('tick'), toMenu('select'), true;
      const buttons = resultButtons(hasNext());
      if (pick) return resultAction(buttons[Math.min(S.cursor, buttons.length - 1)].id), true;
      if (dir) return move(buttons.length), true;
      return false;
    }
  }
  return false;
}

function eventTime(e) {
  const now = performance.now();
  // Event timestamps share performance.now()'s clock in current browsers;
  // fall back if a browser reports something else.
  return e.timeStamp > 0 && Math.abs(e.timeStamp - now) < 1000 ? e.timeStamp : now;
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  press(R.toBuffer(e.clientX, e.clientY), eventTime(e));
});
window.addEventListener('keydown', (e) => {
  const code = e.code || (e.key === ' ' ? 'Space' : e.key);
  // Holding a key never repeats a catch; held arrows may repeat in menus only.
  if (e.repeat && !(code.startsWith('Arrow') && S.screen !== 'play')) {
    if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
    return;
  }
  if (key(code, eventTime(e))) e.preventDefault();
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
window.__somen = { S, progress, SHOPS };
