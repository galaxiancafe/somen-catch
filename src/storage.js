// Saved progress on this device. Every access is guarded so the game still
// runs when localStorage is missing or blocked (private mode, sandboxed frames).

const KEY = 'somen-catch:v1';

export function defaultProgress() {
  return { unlocked: 1, best: {}, muted: false };
}

function store() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// `levelCount` clamps progress saved against an older, longer level list.
export function loadProgress(levelCount = Infinity) {
  try {
    const s = store();
    const raw = s && s.getItem(KEY);
    if (!raw) return defaultProgress();
    const p = JSON.parse(raw);
    return {
      unlocked: Math.min(levelCount, Math.max(1, p.unlocked | 0)),
      best: p.best && typeof p.best === 'object' ? p.best : {},
      muted: !!p.muted,
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  try {
    const s = store();
    if (s) s.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Progress just isn't kept.
  }
}

// Records a finished level. Earning at least one star unlocks the next level.
export function applyResult(progress, levelIndex, levelId, points, stars, levelCount) {
  const prev = progress.best[levelId];
  const newBest = !prev || points > prev.score;
  progress.best[levelId] = {
    score: Math.max(points, prev ? prev.score : 0),
    stars: Math.max(stars, prev ? prev.stars : 0),
  };
  if (stars >= 1 && levelIndex + 2 > progress.unlocked) {
    progress.unlocked = Math.min(levelCount, levelIndex + 2);
  }
  return { progress, newBest };
}
