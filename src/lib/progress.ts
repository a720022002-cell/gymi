import type { Checkin, DayTotals, Measure } from './health';
import { addDays } from './nutrition';
import type { WorkoutLog } from './train';
import { type TrainPlan, weekdayOf, weekStart } from './training';

export type ProgressInput = {
  today: string;
  days: Record<string, DayTotals>;
  logs: WorkoutLog[];
  checkins: Checkin[];
  measures: Measure[];
  plan: TrainPlan | null;
  foodSetup: boolean;
  kcal: number;
  protein: number;
  water: number;
  /** 0-1 bulk, 2 maintain, 3-4 cut. */
  goal: number;
};

/** Days you logged anything: food, water, a workout, your check-in or a measurement. */
export function activeDays(x: ProgressInput) {
  const s = new Set<string>();
  for (const [d, v] of Object.entries(x.days)) if (v.k > 0 || v.w > 0) s.add(d);
  x.logs.forEach((l) => s.add(l.day));
  x.checkins.forEach((c) => s.add(c.day));
  x.measures.forEach((m) => s.add(m.day));
  return s;
}

/** Days in a row with something logged. Today doesn't break it until it's over. */
export function overallStreak(active: Set<string>, today: string) {
  let streak = active.has(today) ? 1 : 0;
  for (let d = addDays(today, -1); active.has(d); d = addDays(d, -1)) streak++;
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of [...active].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { streak, best: Math.max(best, streak) };
}

/** Best run of planned workouts without missing one (last 120 days). */
export function bestWorkoutStreak(x: ProgressInput, current: number) {
  const p = x.plan;
  if (!p) return current;
  const done = new Set(x.logs.map((l) => l.day));
  let best = 0;
  let run = 0;
  for (let i = 120; i >= 0; i--) {
    const d = addDays(x.today, -i);
    if (p.since && d < p.since) continue;
    if (done.has(d)) best = Math.max(best, ++run);
    else if (i > 0 && p.week[weekdayOf(d)]?.w && !p.skipped[d]) run = 0;
  }
  return Math.max(best, current);
}

export const COMMIT_WEIGHT = { work: 0.35, cal: 0.25, prot: 0.2, water: 0.1, sleep: 0.1 } as const;
export type CommitKey = keyof typeof COMMIT_WEIGHT;
export const COMMIT_LABEL: Record<CommitKey, [string, string, string]> = {
  work: ['Workouts as planned', 'train', '{a} of {b} workouts'],
  cal: ['Calories on target', 'food', '{a} of {b} days within 10%'],
  prot: ['Protein goal', 'check', '{a} of {b} days'],
  water: ['Water goal', 'drop', '{a} of {b} days'],
  sleep: ['Sleep 7 h or more', 'moon', '{a} of {b} nights'],
};

/**
 * How well you stuck to your plan between two days (design: commitment rate).
 * Today only counts once you've hit it, so a new day never pulls the rate down.
 */
export function commitWindow(x: ProgressInput, from: string, to: string, first: string | null) {
  const parts: Record<CommitKey, [number, number]> = { work: [0, 0], cal: [0, 0], prot: [0, 0], water: [0, 0], sleep: [0, 0] };
  if (!first) return { parts, pct: null as number | null };
  const done = new Set(x.logs.map((l) => l.day));
  const sleep = new Map(x.checkins.map((c) => [c.day, c.sleep_h]));
  const add = (k: CommitKey, met: boolean, d: string) => {
    if (d === x.today && !met) return;
    parts[k][1]++;
    if (met) parts[k][0]++;
  };
  let extra = 0;
  for (let d = from < first ? first : from; d <= to; d = addDays(d, 1)) {
    const p = x.plan;
    if (p && !(p.since && d < p.since)) {
      const planned = !!p.week[weekdayOf(d)]?.w && !p.skipped[d];
      if (planned) add('work', done.has(d), d);
      else if (done.has(d)) extra++;
    }
    const v = x.days[d];
    if (x.foodSetup) {
      add('cal', !!v && v.k > 0 && Math.abs(v.k - x.kcal) <= x.kcal * 0.1, d);
      add('prot', !!v && v.p >= x.protein * 0.9, d);
    }
    add('water', !!v && v.w >= x.water, d);
    // Only nights you told us about count.
    const h = sleep.get(d);
    if (h != null) add('sleep', h >= 7, d);
  }
  // A workout on a rest day makes up for a missed one.
  parts.work[0] = Math.min(parts.work[1], parts.work[0] + extra);
  let w = 0;
  let sum = 0;
  (Object.keys(COMMIT_WEIGHT) as CommitKey[]).forEach((k) => {
    const [a, b] = parts[k];
    if (!b) return;
    w += COMMIT_WEIGHT[k];
    sum += (COMMIT_WEIGHT[k] * a) / b;
  });
  return { parts, pct: w ? Math.round((sum / w) * 100) : null };
}

export function firstDay(active: Set<string>) {
  return [...active].sort()[0] ?? null;
}

export function commitment(x: ProgressInput, range: 7 | 30, active: Set<string>) {
  return commitWindow(x, addDays(x.today, -(range - 1)), x.today, firstDay(active));
}

/** Commitment for each of the last n weeks (Sunday to Saturday), oldest first; this week last. */
export function weeklyCommitment(x: ProgressInput, active: Set<string>, n = 8) {
  const first = firstDay(active);
  const ws = weekStart(x.today);
  return Array.from({ length: n }, (_, i) => {
    const s = addDays(ws, -7 * (n - 1 - i));
    const e = addDays(s, 6) > x.today ? x.today : addDays(s, 6);
    if (!first || e < first) return null;
    return commitWindow(x, s, e, first).pct;
  });
}

/** Weeks in a row at 80% or more, not counting this unfinished week unless it's already there. */
export function weeksAbove(hist: (number | null)[]) {
  let n = (hist.at(-1) ?? 0) >= 80 ? 1 : 0;
  for (let i = hist.length - 2; i >= 0 && (hist[i] ?? 0) >= 80; i--) n++;
  let best = 0;
  let run = 0;
  hist.forEach((v) => {
    run = (v ?? 0) >= 80 ? run + 1 : 0;
    best = Math.max(best, run);
  });
  return { weeks: n, best };
}

export type Badge = { id: string; name: string; unit: string; tiers: number[]; v: number; icon: string };

/** Badges with levels (design: BADGE2). */
export function badges(x: ProgressInput, bestStreak: number): Badge[] {
  const daysHit = (f: (v: DayTotals) => boolean) => Object.values(x.days).filter(f).length;
  const months: Record<string, number> = {};
  x.logs.forEach((l) => (months[l.day.slice(0, 7)] = (months[l.day.slice(0, 7)] ?? 0) + 1));
  const w = x.measures.filter((m) => m.kind === 'weight');
  const dw = w.length > 1 ? w.at(-1)!.value - w[0].value : 0;
  const toward = x.goal >= 3 ? -dw : x.goal <= 1 ? dw : 0;
  return [
    { id: 'workouts', name: 'Workouts', unit: 'workouts', tiers: [1, 10, 50, 100, 250], v: x.logs.length, icon: 'train' },
    { id: 'streak', name: 'Streak', unit: 'days in a row', tiers: [7, 30, 100, 365], v: bestStreak, icon: 'flame' },
    { id: 'protein', name: 'Protein pro', unit: 'days hitting protein', tiers: [5, 30, 100], v: x.foodSetup ? daysHit((v) => v.p >= x.protein * 0.9) : 0, icon: 'food' },
    { id: 'early', name: 'Early bird', unit: 'workouts before 8 AM', tiers: [1, 10, 30], v: x.logs.filter((l) => new Date(l.started_at).getHours() < 8).length, icon: 'sun' },
    { id: 'prs', name: 'Record breaker', unit: 'personal records', tiers: [1, 5, 25, 50], v: x.logs.reduce((a, l) => a + (l.prs?.length ?? 0), 0), icon: 'trophy' },
    { id: 'water', name: 'Hydrated', unit: 'days hitting water', tiers: [7, 30, 100], v: daysHit((v) => v.w >= x.water), icon: 'drop' },
    { id: 'iron', name: 'Iron month', unit: 'months with 12+ workouts', tiers: [1, 3, 6, 12], v: Object.values(months).filter((n) => n >= 12).length, icon: 'bolt' },
    { id: 'lost', name: x.goal <= 1 ? 'Stronger' : 'Lighter', unit: 'kg toward your goal', tiers: [1, 5, 10, 20], v: Math.max(0, Math.round(toward * 10) / 10), icon: 'scale' },
  ];
}

export const badgeLevel = (b: Badge) => b.tiers.filter((t) => b.v >= t).length;
export function badgeProgress(b: Badge) {
  const L = badgeLevel(b);
  if (L >= b.tiers.length) return 1;
  const lo = L ? b.tiers[L - 1] : 0;
  return (b.v - lo) / (b.tiers[L] - lo);
}

/** Training volume (kg moved) for each of the last n weeks, oldest first. */
export function weeklyVolume(logs: WorkoutLog[], today: string, n = 8) {
  const ws = weekStart(today);
  return Array.from({ length: n }, (_, i) => {
    const s = addDays(ws, -7 * (n - 1 - i));
    const e = addDays(s, 6);
    return logs.filter((l) => l.day >= s && l.day <= e).reduce((a, l) => a + Number(l.volume), 0);
  });
}

/** Average of a measure over the 7 days ending `end`. */
export function weekAvg(ms: Measure[], end: string) {
  const s = addDays(end, -6);
  const xs = ms.filter((m) => m.day >= s && m.day <= end);
  return xs.length ? xs.reduce((a, m) => a + m.value, 0) / xs.length : null;
}

/** Short date like "Oct 3" (or "٣ أكتوبر"). */
export function shortDate(day: string, lang: 'en' | 'ar') {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00`));
}

export const fx = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
