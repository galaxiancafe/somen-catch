// Saved progress on this device. Every access is guarded so the game still
// runs when localStorage is missing or blocked (private mode, sandboxed frames).
//
// Shape: { unlocked: { <shopId>: levelsUnlocked }, best: { <levelId>: { score, stars } }, muted }.
// Saves from before shops had a single number for `unlocked`; it is read as
// shop 1 (kyoto) progress.

const KEY = 'somen-catch:v1';
export const DEFAULT_SHOP_SIZES = Object.freeze({ kyoto: 5, hall: 5, pool: 5 });

export function defaultProgress(sizes = DEFAULT_SHOP_SIZES) {
  return { unlocked: Object.fromEntries(Object.keys(sizes).map((id) => [id, 1])), best: {}, muted: false };
}

function store() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// `sizes` maps shop id → number of levels, to clamp older or odd saves.
export function loadProgress(sizes = DEFAULT_SHOP_SIZES) {
  const fresh = defaultProgress(sizes);
  try {
    const s = store();
    const raw = s && s.getItem(KEY);
    if (!raw) return fresh;
    const p = JSON.parse(raw);
    const saved = typeof p.unlocked === 'number' ? { kyoto: p.unlocked } : p.unlocked && typeof p.unlocked === 'object' ? p.unlocked : {};
    for (const id of Object.keys(sizes)) {
      fresh.unlocked[id] = Math.min(sizes[id], Math.max(1, saved[id] | 0));
    }
    fresh.best = p.best && typeof p.best === 'object' ? p.best : {};
    fresh.muted = !!p.muted;
    return fresh;
  } catch {
    return defaultProgress(sizes);
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

// Records a finished level. Earning at least one star unlocks the next level
// in the same shop.
export function applyResult(progress, shopId, levelIndex, levelId, points, stars, levelCount) {
  const prev = progress.best[levelId];
  const newBest = !prev || points > prev.score;
  progress.best[levelId] = {
    score: Math.max(points, prev ? prev.score : 0),
    stars: Math.max(stars, prev ? prev.stars : 0),
  };
  const unlocked = progress.unlocked[shopId] || 1;
  if (stars >= 1 && levelIndex + 2 > unlocked) {
    progress.unlocked[shopId] = Math.min(levelCount, levelIndex + 2);
  }
  return { progress, newBest };
}
