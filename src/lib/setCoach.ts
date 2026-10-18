// The coach under every exercise in a workout: what to do with the weight next set, next time, or before you start.
// It reads today's sets and your last workouts with this exercise, not just the last set against the rep range.

export type SetIn = { w: number; r: number };
/** `w`, `w2`: weights in kg (shown in your unit). Text is an English key, translated by the screen. */
export type Advice = { key: string; vars: Record<string, number | string>; tone: 'up' | 'ok' | 'down' };

/** Strength from one set (Epley's estimate of the most you could lift once). */
const e1rm = (s: SetIn) => s.w * (1 + s.r / 30);
/** The weight you can do about `reps` times, from that strength, rounded to a step you can load. */
const weightFor = (oneRm: number, reps: number, step: number, dir: 'up' | 'down' | 'near' = 'near') => {
  const raw = oneRm / (1 + reps / 30);
  const f = dir === 'up' ? Math.ceil : dir === 'down' ? Math.floor : Math.round;
  return Math.max(step, f(raw / step - 1e-9) * step);
};

/**
 * Advice for an exercise. `done`: today's finished working sets (in order). `left`: working sets still to do.
 * `hist`: your last normal workouts with this exercise, newest first, each its working sets. `step`: one weight jump.
 */
export function coachSet(o: { done: SetIn[]; left: number; lo: number; hi: number; step: number; hist: SetIn[][] }): Advice | null {
  const { done, left, lo, hi, step } = o;
  const hist = o.hist.filter((h) => h.some((s) => s.w > 0));
  const mid = Math.round((lo + hi) / 2);
  const top = (h: SetIn[]) => Math.max(...h.map((s) => s.w));

  // Same top weight for 3 or more workouts in a row, with every one in the rep range: time to go up.
  const stall = (() => {
    if (hist.length < 3) return null;
    const w = top(hist[0]);
    let n = 0;
    for (const h of hist) {
      if (Math.abs(top(h) - w) > 0.01 || !h.filter((s) => s.w === w).some((s) => s.r >= lo)) break;
      n++;
    }
    return n >= 3 ? { w, n } : null;
  })();

  // Before the first set: from your last workouts.
  if (!done.length) {
    if (!hist.length) return null;
    if (stall) return { key: 'You’ve used {w} kg for {n} workouts in a row. Time to go up: start at {w2} kg.', vars: { w: stall.w, n: stall.n, w2: stall.w + step }, tone: 'up' };
    const last = hist[0];
    const w = top(last);
    const atTop = last.filter((s) => s.w === w);
    if (atTop.every((s) => s.r >= hi)) return { key: 'Last time every set hit {hi} reps at {w} kg. Start at {w2} kg today.', vars: { hi, w, w2: w + step }, tone: 'up' };
    const best = Math.max(...atTop.map((s) => s.r));
    if (best < lo - 1) return { key: 'Last time {w} kg was heavy ({r} reps). Start at {w2} kg to get {lo} or more.', vars: { w, r: best, lo, w2: Math.min(w, weightFor(Math.max(...last.map(e1rm)), lo, step, 'down')) }, tone: 'down' };
    return null;
  }

  const last = done[done.length - 1];
  const prev = done.length > 1 ? done[done.length - 2] : null;
  const first = done[0];
  const { w, r } = last;
  const strength = Math.max(...done.map(e1rm));

  // Finished: what to do next time, judged on your main working weight (the one most sets used). A heavier last set
  // (like the "go heavier" one) is a strong finish, not a miss.
  if (left === 0) {
    const count = new Map<number, number>();
    for (const s of done) count.set(s.w, (count.get(s.w) ?? 0) + 1);
    const base = [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    const atBase = done.filter((s) => s.w === base);
    const heavy = done.filter((s) => s.w > base && s.r >= Math.max(3, lo - 2));
    if (heavy.length && atBase.some((s) => s.r >= lo)) {
      const h = heavy[heavy.length - 1];
      return { key: 'Strong finish: {w} kg × {r}. Next time start your sets at {w2} kg.', vars: { w: h.w, r: h.r, w2: base + step }, tone: 'up' };
    }
    if (atBase.every((s) => s.r >= hi)) return { key: 'Every set hit {hi} reps. Next time start at {w2} kg.', vars: { hi, w2: base + step }, tone: 'up' };
    if (stall && Math.abs(stall.w - base) < 0.01 && atBase.some((s) => s.r >= lo))
      return { key: 'That’s {n} workouts at {w} kg. Next time go to {w2} kg, even if you get fewer reps.', vars: { n: stall.n + 1, w: base, w2: base + step }, tone: 'up' };
    if (atBase.some((s) => s.r >= lo)) return { key: 'Done. Top set {w} kg × {r}. Stay at {w} kg until every set gets {hi}.', vars: { w: base, r: Math.max(...atBase.map((s) => s.r)), hi }, tone: 'ok' };
    // Under the range: next time from how strong your first (fresh) set was.
    return { key: 'Done. Next time start at {w2} kg so you can do {lo}–{hi} reps.', vars: { w2: weightFor(e1rm(first), mid, step, 'down'), lo, hi }, tone: 'down' };
  }

  // Tiring: reps fell even though the weight stayed or went down. Lowering it again won't help; rest does.
  if (prev && w <= prev.w && prev.r - r >= (w < prev.w ? 1 : 3))
    return { key: 'Your reps are dropping ({a} → {b}), so you’re tired. Rest 2–3 minutes and stay at {w} kg.', vars: { a: prev.r, b: r, w }, tone: 'ok' };

  // Strong and steady with one set to go: a heavier last set with fewer reps.
  if (left === 1 && done.length >= 2 && done.every((s) => s.w === w) && Math.min(...done.map((s) => s.r)) >= Math.min(hi, mid) && r >= first.r - 1) {
    const pLo = Math.max(3, lo - 2);
    const w2 = Math.max(w + step, weightFor(strength, lo - 1, step, 'near'));
    return { key: 'Strong and steady. Last set: go heavier, {w2} kg for {a}–{b} reps.', vars: { w2, a: pLo, b: lo }, tone: 'up' };
  }

  // Too light: the weight that fits the range, from what you just did.
  if (r > hi + 2) return { key: '{r} reps is light for {lo}–{hi}. Go to {w2} kg next set.', vars: { r, lo, hi, w2: Math.max(w + step, weightFor(strength, mid, step, 'near')) }, tone: 'up' };
  if (r >= hi) return { key: 'Top of the range. Try {w2} kg next set.', vars: { w2: w + step }, tone: 'up' };
  if (r >= lo) {
    if (prev && w > prev.w) return { key: 'Good jump to {w} kg, {r} reps is in the range. Stay here.', vars: { w, r }, tone: 'ok' };
    return { key: '{r} reps, in the range. Stay at {w} kg and aim for {n}.', vars: { r, w, n: Math.min(hi, r + 1) }, tone: 'ok' };
  }
  // A rep or two short: keep the weight.
  if (r >= lo - 2) return { key: 'Close to {lo}. Stay at {w} kg and rest a little longer.', vars: { lo, w }, tone: 'ok' };
  // Well under the range: the weight for it, worked out from this set (not just one step down).
  return { key: '{r} reps is heavy for {lo}–{hi}. Use about {w2} kg next set.', vars: { r, lo, hi, w2: Math.min(w - step, weightFor(strength, lo, step, 'down')) }, tone: 'down' };
}
