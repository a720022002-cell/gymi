// The workout in progress, shared by the workout screen (app/active) and the Live Activity (components/WorkoutLive):
// the set you're on, logging a set, and the coach's advice under each exercise.
import { coachSet, type SetIn } from './setCoach';
import { lastTime, type Session, type SessionEx, type WorkoutLog } from './train';
import { exInfo, isLightLog, type TrainPlan, topReps } from './training';
import type { useWeight } from './units';

/** Rest after a working set (seconds). */
export const REST = 90;

type Tone = 'up' | 'ok' | 'down';
type Tr = (k: string, v?: Record<string, string | number>) => string;
type W = ReturnType<typeof useWeight>;

/** Signed numbers ("+2.5", "−5") kept as one left-to-right piece, so Arabic doesn't show them as "2.5+". */
export const ltrNums = (s: string) => s.replace(/[+−-]\d[\d.,]*/g, (m) => `⁦${m}⁩`);

/** Your last normal workouts with an exercise (newest first, working sets only), for the coach under it. */
export const histFor = (logs: WorkoutLog[], plan: TrainPlan | null, id: string): SetIn[][] =>
  logs
    .filter((l) => !isLightLog(l, plan))
    .map((l) => (l.exercises ?? []).find((e) => e.id === id)?.sets ?? [])
    .filter((sets) => sets.length)
    .slice(0, 6);

/** Coach advice for an exercise: today's sets and your last workouts with it (lib/setCoach for weights).
 * Updates after every set; before the first set it can say where to start. */
export function setAdvice(x: SessionEx, timed: boolean, bodyweight: boolean, hist: SetIn[][], t: Tr, W: W): { text: string; tone: Tone } | null {
  const a = adviceKg(x, timed, bodyweight, hist, t, W);
  // Written in kg; shown in lb when you picked pounds.
  return a ? { ...a, text: W.words(a.text) } : null;
}

function adviceKg(x: SessionEx, timed: boolean, bodyweight: boolean, hist: SetIn[][], t: Tr, W: W): { text: string; tone: Tone } | null {
  const work = x.sets.filter((y) => !y.warm);
  const done = work.filter((y) => y.done);
  const nums = String(x.reps).match(/\d+/g)?.map(Number) ?? [10];
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const last = done[done.length - 1];
  const w = last ? +last.w || 0 : 0;
  const r = last ? +last.r || 0 : 0;
  const finished = done.length === work.length;

  if (timed) {
    if (!last) return null;
    if (r >= hi + 10) return { text: t('{r} s, strong hold. Add 10 seconds next set.', { r }), tone: 'up' };
    if (r >= hi) return { text: t('{r} s, you hit the target. Keep it steady.', { r }), tone: 'ok' };
    return { text: t('{r} s. Rest a little longer and aim for {hi} s.', { r, hi }), tone: 'down' };
  }
  if (bodyweight || (last && w <= 0)) {
    if (!last) return null;
    if (r > hi + 2) return { text: t('{r} reps, too easy. Slow it down or add weight.', { r }), tone: 'up' };
    if (r >= lo) return { text: finished ? t('All sets done. Nice work.') : t('{r} reps, right in the range. Same again.', { r }), tone: 'ok' };
    return { text: t('{r} reps. Rest a bit longer before the next set.', { r }), tone: 'down' };
  }
  const a = coachSet({ done: done.map((y) => ({ w: +y.w || 0, r: +y.r || 0 })), left: work.length - done.length, lo, hi, step: W.step, hist });
  if (!a) return null;
  // Weights are kg: shown in your unit.
  const vars = Object.fromEntries(Object.entries(a.vars).map(([k, v]) => [k, k === 'w' || k === 'w2' ? W.show(+v) : v]));
  // Better than last time's matching set (not today's target)? Said first, when it's good news.
  const p = last ? lastTime(last, work.indexOf(last), hist[0]) : null;
  const beat = p && a.tone !== 'down' && p.w > 0 && (w > p.w || (w === p.w && r > p.r)) ? (w > p.w ? t('+{n} kg on last time. ', { n: W.show(w - p.w) }) : t('+{n} reps on last time. ', { n: r - p.r })) : '';
  return { text: `${beat}${t(a.key, vars)}`, tone: a.tone };
}

/** The set you're on: the first one not done, or null when all are done. */
export function currentSet(s: Session): { ei: number; si: number } | null {
  const ei = s.ex.findIndex((x) => x.sets.some((y) => !y.done));
  return ei < 0 ? null : { ei, si: s.ex[ei].sets.findIndex((y) => !y.done) };
}

/** Main compound lifts get a longer rest: squats, bench, deadlifts, rows, presses, pull-ups and chin-ups. */
export function restFor(x: SessionEx, warm?: boolean) {
  if (warm) return 45;
  const info = exInfo(x, 'en');
  if (info.timed) return REST;
  const big = /squat|bench|deadlift|\brow\b|press|pull-?up|chin-?up/i.test(info.name) && (info.type !== 'Bodyweight' || /pull-?up|chin-?up/i.test(info.name));
  return big ? 150 : REST;
}

/**
 * Logs a set (empty weight and reps take last time's) and says how long to rest after it, or null when it was the last.
 * `needWeight`: a weighted exercise with no weight typed and none from last time; nothing is logged (never 0 kg).
 */
export function logSet(s: Session, ei: number, si: number, lang: Parameters<typeof exInfo>[1]): { next: Session; restFor: number | null; needWeight?: boolean } {
  const x = s.ex[ei];
  const st = x.sets[si];
  const info = exInfo(x, lang);
  const w = st.w === '' ? String(st.lw || 0) : st.w;
  const r = st.r === '' ? String(st.lr) : st.r;
  if (!info.timed && info.type !== 'Bodyweight' && !(+w > 0) && st.w === '') return { next: s, restFor: null, needWeight: true };
  const easy = !st.warm && +r >= topReps(x.reps) && +w >= st.lw && info.type !== 'Bodyweight' && !info.timed && +w > 0;
  const next: Session = {
    ...s,
    // When the last set was done: the workout ends a little after it, even if Finish is tapped much later.
    lastAt: Date.now(),
    ex: s.ex.map((e, i) => (i !== ei ? e : { ...e, tip: e.tip || easy, sets: e.sets.map((y, j) => (j === si ? { ...y, w, r, done: true } : y)) })),
  };
  const more = next.ex.some((e) => e.sets.some((z) => !z.done));
  // Longer rest after the big lifts, shorter after a warm-up set.
  return { next, restFor: more ? restFor(x, st.warm) : null };
}
