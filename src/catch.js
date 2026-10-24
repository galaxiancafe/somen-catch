// Catch judging and the chopstick hand cycle. A catch is judged at the tap's
// own time, not when the dip animation ends.

import { crossTime } from './flow.js';

export const HAND_MS = Object.freeze({ dip: 80, lift: 220, toCup: 200, ret: 180, missRet: 120 });

// offMs < 0: tapped early (head over the line); > 0: late (tail over the line).
export function gradeOffset(offMs, w) {
  const a = Math.abs(offMs);
  if (a <= w.perfect) return 'PERFECT';
  if (a <= w.good) return 'GOOD';
  if (offMs < 0 ? -offMs <= w.head : offMs <= w.tail) return 'TAIL';
  return 'MISS';
}

// Judges the tap against every bundle on the chosen tube (every tube when
// `tube` is null); the one closest to its catch moment wins.
export function judge(flow, tTap, tube = null) {
  let best = null;
  for (const b of flow.bundles) {
    if (b.state !== 'flow') continue;
    if (tube !== null && b.tube !== tube) continue;
    const offsetMs = (tTap - crossTime(flow, b)) * 1000;
    const grade = gradeOffset(offsetMs, b.windows);
    if (grade === 'MISS') continue;
    if (!best || Math.abs(offsetMs) < Math.abs(best.offsetMs)) best = { grade, bundle: b, offsetMs };
  }
  return best || { grade: 'MISS', bundle: null, offsetMs: null };
}

export function createHand() {
  return { phases: null, i: 0, t: 0, grade: null, grams: 0, kind: null, flick: false, tube: 0, fromTube: 0 };
}

export function handIdle(hand) {
  return hand.phases === null;
}

// An empty tap or a caught leaf is a quick flick; anything else is lifted to the cup.
export function startHand(hand, grade, kind = 'noodle') {
  hand.flick = grade === 'MISS' || kind === 'leaf';
  hand.phases = hand.flick
    ? [['dip', HAND_MS.dip], ['return', HAND_MS.missRet]]
    : [['dip', HAND_MS.dip], ['lift', HAND_MS.lift], ['toCup', HAND_MS.toCup], ['return', HAND_MS.ret]];
  hand.i = 0;
  hand.t = 0;
  hand.grade = grade;
  hand.kind = grade === 'MISS' ? null : kind;
  hand.grams = 0;
}

export function cycleMs(grade) {
  return grade === 'MISS'
    ? HAND_MS.dip + HAND_MS.missRet
    : HAND_MS.dip + HAND_MS.lift + HAND_MS.toCup + HAND_MS.ret;
}

export function stepHand(hand, dtMs) {
  const events = [];
  if (!hand.phases) return events;
  hand.t += dtMs;
  while (hand.phases && hand.t >= hand.phases[hand.i][1]) {
    hand.t -= hand.phases[hand.i][1];
    if (hand.phases[hand.i][0] === 'toCup') events.push({ type: 'drop', grams: hand.grams, grade: hand.grade });
    hand.i++;
    if (hand.i >= hand.phases.length) {
      hand.phases = null;
      hand.i = 0;
      hand.t = 0;
      events.push({ type: 'ready' });
    }
  }
  return events;
}

export function handPhase(hand) {
  if (!hand.phases) return { name: 'idle', p: 0 };
  const [name, d] = hand.phases[hand.i];
  return { name, p: Math.min(1, hand.t / d) };
}

// Which tube a tap at buffer x aims at: the one whose catch point is nearest
// in x (ties go left). `catchXs` is each tube's catch-point x, left to right.
export function pickTube(catchXs, x) {
  let best = 0;
  for (let i = 1; i < catchXs.length; i++) if (Math.abs(catchXs[i] - x) < Math.abs(catchXs[best] - x)) best = i;
  return best;
}

// Returns null when the hand is busy (the cooldown, shared by all tubes);
// otherwise the judgement. On multi-tube levels `tube` is the tube aimed at.
export function tryCatch(flow, hand, tTap, tube = null) {
  if (!handIdle(hand)) return null;
  const r = judge(flow, tTap, tube);
  hand.fromTube = hand.tube;
  hand.tube = tube ?? 0;
  if (r.bundle) {
    r.bundle.state = 'caught';
    flow.freeAt = Math.max(flow.freeAt, tTap);
  }
  startHand(hand, r.grade, r.bundle ? r.bundle.kind : 'noodle');
  return r;
}
