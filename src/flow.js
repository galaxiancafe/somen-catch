// Noodle bundles (and decoys) moving down the flume, all in s-space. Bundle
// positions are computed from their spawn time, so results don't depend on
// the step size.
//
// Two level formats:
// - count + spacing ({ bundles, speed, spacingMs }): the v1 rule, one bundle in
//   flight, the next waits for the spacing and for the previous one to leave.
// - scripted ({ entries: [{ at, speed?, kind?, surge? }] }): each entry starts
//   at its own time, several can be in flight.

export const BUNDLE_GRAMS = 10;
export const TOMATO_GRAMS = 5;
export const S_CATCH = 0.85;
export const DEFAULT_WINDOWS = Object.freeze({ perfect: 60, good: 120, head: 160, tail: 220 });
export const LEAD_IN_MS = 1200;
export const SCRIPT_LEAD_IN_MS = 2000;

// Decoys are short: body only, so head and tail reach just the good window.
export function windowsFor(kind, windows) {
  return kind === 'noodle' ? windows : { ...windows, head: windows.good, tail: windows.good };
}

export function createFlow(level, { sCatch = S_CATCH } = {}) {
  const windows = { ...DEFAULT_WINDOWS, ...(level.windows || {}) };
  const scripted = Array.isArray(level.entries);
  const entries = scripted ? [...level.entries].sort((a, b) => a.at - b.at) : null;
  const leadIn = (level.leadInMs ?? (scripted ? SCRIPT_LEAD_IN_MS : LEAD_IN_MS)) / 1000;
  const kindCount = (k) => (scripted ? entries.filter((e) => (e.kind || 'noodle') === k).length : k === 'noodle' ? level.bundles : 0);
  const noodleTotal = kindCount('noodle');
  const tomatoTotal = kindCount('tomato');
  return {
    level,
    speed: level.speed,
    windows,
    sCatch,
    scripted,
    entries,
    leadIn,
    total: scripted ? entries.length : level.bundles,
    noodleTotal,
    tomatoTotal,
    leafTotal: kindCount('leaf'),
    maxGrams: noodleTotal * BUNDLE_GRAMS + tomatoTotal * TOMATO_GRAMS,
    // Default-speed noodle geometry (v1 fields, used by count + spacing levels).
    len: (level.speed * (windows.head + windows.tail)) / 1000,
    bodyFromHead: (level.speed * windows.head) / 1000,
    t: 0,
    spawned: 0,
    nextSpawnAt: leadIn,
    freeAt: 0,
    bundles: [],
  };
}

function makeBundle(flow, id, spawnT, e = {}) {
  const kind = e.kind || 'noodle';
  const v0 = e.speed ?? flow.speed;
  const surge = e.surge || null;
  // Geometry uses the speed at the catch line, so ms windows mean the same on every bundle.
  const vCatch = surge ? surge.speed : v0;
  const windows = windowsFor(kind, flow.windows);
  return {
    id,
    kind,
    spawnT,
    v0,
    surge,
    tSurge: surge ? spawnT + surge.at / v0 : Infinity,
    vCatch,
    windows,
    len: (vCatch * (windows.head + windows.tail)) / 1000,
    bodyFromHead: (vCatch * windows.head) / 1000,
    state: 'flow',
    sHead: 0,
  };
}

export function headAt(flow, b, t) {
  if (t <= b.tSurge) return (t - b.spawnT) * b.v0;
  return b.surge.at + (t - b.tSurge) * b.surge.speed;
}

// When the head reaches position s.
export function timeAtHead(b, s) {
  if (!b.surge || s <= b.surge.at) return b.spawnT + s / b.v0;
  return b.tSurge + (s - b.surge.at) / b.surge.speed;
}

// When the body centre crosses the catch line.
export function crossTime(flow, b) {
  return timeAtHead(b, flow.sCatch + b.bodyFromHead);
}

// When the tail passes the end of the flume.
export function drainTime(flow, b) {
  return timeAtHead(b, 1 + b.len);
}

export function activeBundle(flow) {
  return flow.bundles.find((b) => b.state === 'flow') || null;
}

function spawn(flow, spawnT, entry) {
  const b = makeBundle(flow, flow.spawned, spawnT, entry);
  flow.bundles.push(b);
  flow.spawned++;
  return b;
}

export function stepFlow(flow, dt) {
  flow.t += dt;
  const events = [];
  const drain = () => {
    for (const b of flow.bundles) {
      if (b.state !== 'flow') continue;
      const dT = drainTime(flow, b);
      if (flow.t < dT) continue;
      b.state = 'drained';
      flow.freeAt = Math.max(flow.freeAt, dT);
      events.push({ type: 'drain', bundle: b });
    }
  };
  drain();
  if (flow.scripted) {
    while (flow.spawned < flow.total) {
      const e = flow.entries[flow.spawned];
      const spawnT = flow.leadIn + e.at / 1000;
      if (flow.t < spawnT) break;
      events.push({ type: 'spawn', bundle: spawn(flow, spawnT, e) });
    }
  } else {
    while (flow.spawned < flow.total && !activeBundle(flow)) {
      const spawnT = Math.max(flow.nextSpawnAt, flow.freeAt);
      if (flow.t < spawnT) break;
      events.push({ type: 'spawn', bundle: spawn(flow, spawnT) });
      flow.nextSpawnAt = spawnT + flow.level.spacingMs / 1000;
    }
  }
  drain(); // a bundle can't spawn and drain in one step, but keep the order exact anyway
  for (const b of flow.bundles) if (b.state === 'flow') b.sHead = headAt(flow, b, flow.t);
  if (flow.bundles.length > 32) flow.bundles = flow.bundles.filter((b) => b.state === 'flow');
  return events;
}

export function isFinished(flow) {
  return flow.spawned >= flow.total && !activeBundle(flow);
}
