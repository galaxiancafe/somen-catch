// Bowl grams, combo and stars.

export const GRADE_FRACTION = Object.freeze({ PERFECT: 1, GOOD: 0.7, TAIL: 0.25, MISS: 0 });

export function gramsFor(grade, bundleGrams) {
  return GRADE_FRACTION[grade] * bundleGrams;
}

export function createScore() {
  return {
    grams: 0,
    points: 0,
    combo: 0,
    maxCombo: 0,
    emptyTaps: 0,
    tomatoes: 0,
    leaves: 0,
    counts: { PERFECT: 0, GOOD: 0, TAIL: 0, MISSED: 0 },
  };
}

// Tomato: a bonus that leaves the combo alone.
export function recordTomato(score, grams) {
  score.grams += grams;
  score.points += 100;
  score.tomatoes++;
}

// Leaf: a small penalty that never touches grams, so it can't cost stars.
export function recordLeaf(score) {
  score.points = Math.max(0, score.points - 50);
  score.combo = 0;
  score.leaves++;
}

export function recordGrade(score, grade, bundleGrams) {
  if (grade === 'MISS') {
    score.emptyTaps++;
    score.combo = 0;
    return;
  }
  const grams = gramsFor(grade, bundleGrams);
  score.grams += grams;
  score.counts[grade]++;
  score.points += Math.round(grams * 10);
  if (grade === 'PERFECT') {
    score.combo++;
    score.maxCombo = Math.max(score.maxCombo, score.combo);
    if (score.combo >= 2) score.points += score.combo * 5;
  } else {
    score.combo = 0;
  }
}

// A bundle that drained away uncaught.
export function recordMissedBundle(score) {
  score.counts.MISSED++;
  score.combo = 0;
}

export function starsFor(grams, thresholds) {
  return thresholds.filter((g) => grams >= g).length;
}
