import EXERCISES from '@/data/exercises.json';

import { localDay } from './nutrition';

/** A common Gymi exercise (src/data/exercises.json). Pictures and full steps live in the database. */
export type Ex = {
  id: string;
  fedb: string;
  en: string;
  ar: string;
  m: Muscle;
  t: Equipment;
  mach: [string, string][];
  stress?: string[];
  alt?: string;
  time?: boolean;
  steps?: string[];
};
export type Muscle = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core' | 'Other';
export type Equipment = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Free weight' | 'Other';

export const EX: Record<string, Ex> = Object.fromEntries((EXERCISES as Ex[]).map((e) => [e.id, e]));

/** One exercise in a workout. Exercises from the full list keep their name with them. */
export type PlanEx = { id: string; sets: number; reps: string; n?: string; ar?: string | null; m?: string; t?: string; time?: boolean };
export type Workout = { ex: PlanEx[]; focus: string; min: number };
export type Day = { w: string | null; lock: boolean };
export type TrainPlan = {
  days: number;
  injuries: string[];
  split: string;
  /** Sunday to Saturday. */
  week: Day[];
  workouts: Record<string, Workout>;
  /** Machine picked for an exercise (index into its machine list). */
  machines: Record<string, number>;
  homeMode: boolean;
  /** Changes for this week only (moved or missed workouts). */
  override?: { start: string; week: Day[] };
  /** Dates (YYYY-MM-DD) skipped or dismissed, and today's short or home version. */
  skipped: Record<string, true>;
  dismiss: Record<string, true>;
  short?: string;
  homeDay?: string;
  /** Day the plan was made. Days before it are never "missed". */
  since?: string;
};

/** A muscle group's name. In Arabic, "Back" alone would mean the back button, so it has its own key. */
export const muscleLabel = (m: string, lang: 'en' | 'ar', t: (s: string) => string) => (lang === 'ar' ? t(m === 'Back' ? 'Back muscles' : m) : m);

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
export const EQUIPMENT: Equipment[] = ['Free weight', 'Dumbbell', 'Barbell', 'Machine', 'Cable', 'Bodyweight'];
export const INJURIES = ['Shoulder', 'Lower back', 'Knee', 'Elbow', 'Wrist', 'Neck', 'Hip'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Tpl = { ex: [string, number, string][]; min: number; focus: string };
/** Starting workouts (design: WK). */
export const WK: Record<string, Tpl> = {
  Push: { ex: [['bench', 4, '8–10'], ['incline', 3, '8–10'], ['shoulder', 3, '10–12'], ['lateral', 3, '12–15'], ['fly', 3, '12'], ['pushdown', 3, '10–12']], min: 55, focus: 'Chest, shoulders, triceps' },
  Pull: { ex: [['pulldown', 3, '8–10'], ['row', 3, '8'], ['cablerow', 3, '10–12'], ['facepull', 2, '15'], ['curl', 2, '8–10'], ['hammer', 2, '12']], min: 50, focus: 'Back, rear shoulders, biceps' },
  Legs: { ex: [['squat', 4, '6–8'], ['rdl', 3, '8'], ['legpress', 3, '10–12'], ['legcurl', 2, '12'], ['calf', 2, '15'], ['plank', 2, '60']], min: 60, focus: 'Quads, hamstrings, glutes, core' },
  Upper: { ex: [['bench', 3, '8'], ['row', 3, '8'], ['shoulder', 3, '10'], ['pulldown', 3, '10'], ['curl', 2, '10'], ['pushdown', 2, '12']], min: 55, focus: 'Chest, back, shoulders, arms' },
  Lower: { ex: [['squat', 4, '6–8'], ['rdl', 3, '8'], ['legpress', 3, '12'], ['legcurl', 3, '12'], ['calf', 3, '15']], min: 50, focus: 'Quads, hamstrings, glutes' },
  'Full body': { ex: [['squat', 3, '8'], ['bench', 3, '8'], ['pulldown', 3, '10'], ['rdl', 2, '10'], ['lateral', 2, '15'], ['plank', 2, '45']], min: 55, focus: 'Whole body' },
  Home: { ex: [['pushup', 4, '12–15'], ['bwsquat', 4, '20'], ['lunge', 3, '12'], ['pike', 3, '8–10'], ['bridge', 3, '15'], ['plank', 3, '45']], min: 35, focus: 'No equipment' },
};

/** Splits that fit each number of days (design: SPLITS), and which weekdays they go on (SPREAD, 0 = Sunday). */
export const SPLITS: Record<number, [string, string[]][]> = {
  2: [['Upper / Lower', ['Upper', 'Lower']], ['Full body / Full body', ['Full body', 'Full body']]],
  3: [['Push / Pull / Legs', ['Push', 'Pull', 'Legs']], ['Upper / Lower / Full body', ['Upper', 'Lower', 'Full body']], ['Full body × 3', ['Full body', 'Full body', 'Full body']]],
  4: [['Upper / Lower × 2', ['Upper', 'Lower', 'Upper', 'Lower']], ['Push / Pull / Legs / Full body', ['Push', 'Pull', 'Legs', 'Full body']]],
  5: [['Push / Pull / Legs / Upper / Lower', ['Push', 'Pull', 'Legs', 'Upper', 'Lower']], ['Upper / Lower × 2 + Full body', ['Upper', 'Lower', 'Upper', 'Lower', 'Full body']]],
  6: [['Push / Pull / Legs × 2', ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']], ['Upper / Lower × 3', ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower']]],
};
export const SPREAD: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

/** True when some muscle is trained only once a week (design: onceNote). */
export function onceNote(seq: string[]) {
  const c = { push: 0, pull: 0, legs: 0 };
  seq.forEach((w) => {
    if (w === 'Push') c.push++;
    if (w === 'Pull') c.pull++;
    if (w === 'Legs' || w === 'Lower') c.legs++;
    if (w === 'Upper' || w === 'Full body') {
      c.push++;
      c.pull++;
    }
    if (w === 'Full body') c.legs++;
  });
  return Math.min(c.push, c.pull, c.legs) < 2;
}

const tplEx = (rows: [string, number, string][]): PlanEx[] => rows.map(([id, sets, reps]) => ({ id, sets, reps }));

export function workoutMinutes(ex: PlanEx[]) {
  return ex.length ? Math.max(15, Math.round((ex.reduce((a, x) => a + x.sets, 0) * 2.6 + 8) / 5) * 5) : 0;
}

/** A new plan from a split (fixed days, starting workouts). */
export function planFromSplit(days: number, injuries: string[], label: string, seq: string[]): TrainPlan {
  const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
  SPREAD[days].forEach((d, i) => (week[d].w = seq[i]));
  const workouts: Record<string, Workout> = {};
  seq.forEach((w) => (workouts[w] = { ex: tplEx(WK[w].ex), focus: WK[w].focus, min: WK[w].min }));
  return { days, injuries, split: label, week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {} };
}

/** An empty plan the user fills in: Workout A, B, C… */
export function planOwn(days: number, injuries: string[]): TrainPlan {
  const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
  const workouts: Record<string, Workout> = {};
  SPREAD[days].forEach((d, i) => {
    const n = `Workout ${String.fromCharCode(65 + i)}`;
    week[d].w = n;
    workouts[n] = { ex: [], focus: '', min: 0 };
  });
  return { days, injuries, split: 'My own plan', week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {} };
}

/** Name, muscle, equipment and machines for any exercise in a plan. */
export function exInfo(x: { id: string; n?: string; ar?: string | null; m?: string; t?: string; time?: boolean }, lang: 'en' | 'ar') {
  const e = EX[x.id];
  if (e) return { name: lang === 'ar' ? e.ar : e.en, muscle: e.m, type: e.t, mach: e.mach, timed: !!e.time };
  return { name: (lang === 'ar' && x.ar) || x.n || x.id.replace(/_/g, ' '), muscle: (x.m as Muscle) ?? 'Other', type: (x.t as Equipment) ?? 'Other', mach: [] as [string, string][], timed: !!x.time };
}

export type LastSets = Record<string, { w: number; r: number }[]>;

export type BuiltEx = PlanEx & { swapped: boolean; target: number; last: { w: number; r: number }[] };

/** The workout for today, with injury swaps, short or home version, and last time's numbers. */
export function buildWorkout(plan: TrainPlan, name: string, opts: { home?: boolean; short?: boolean; last: LastSets }) {
  const home = opts.home;
  const base: PlanEx[] = home ? tplEx(WK.Home.ex) : (plan.workouts[name]?.ex ?? []);
  const inj = plan.injuries;
  let ex: BuiltEx[] = base.map((x) => {
    const e = EX[x.id];
    const swap = e?.stress?.some((s) => inj.includes(s)) && e.alt ? e.alt : null;
    const id = swap ?? x.id;
    const last = opts.last[id] ?? [];
    return { ...x, id, ...(swap ? { n: undefined, ar: undefined } : {}), swapped: !!swap, last, target: last.length ? Math.max(...last.map((s) => s.w)) : 0 };
  });
  let min = home ? WK.Home.min : (plan.workouts[name]?.min ?? workoutMinutes(base));
  if (opts.short && ex.length > 3) {
    ex = ex.slice(0, 3);
    min = 25;
  }
  return { name, ex, min, focus: home ? WK.Home.focus : (plan.workouts[name]?.focus ?? '') };
}

/** Sunday of the week a day is in (YYYY-MM-DD). */
export function weekStart(day: string) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return localDay(d);
}

export const weekdayOf = (day: string) => new Date(`${day}T12:00:00`).getDay();

/** This week's days (with any moves for this week only). */
export const effectiveWeek = (plan: TrainPlan, start: string) => (plan.override?.start === start ? plan.override.week : plan.week);

/**
 * Move a workout from one day to a later day; the rest of the week shifts one workout later
 * (design: shiftPlan). Returns null when a locked day is in the way.
 */
export function shiftPlan(week: Day[], done: Set<number>, fromDay: number, start: number) {
  const mw = week[fromDay].w;
  if (!mw || start > 6) return null;
  const later: number[] = [];
  for (let i = start; i <= 6; i++) if (week[i].w && i !== fromDay && !done.has(i)) later.push(i);
  const queue = [mw, ...later.map((i) => week[i].w as string)];
  const slots = [...new Set([start, ...later])].sort((a, b) => a - b);
  while (slots.length < queue.length) {
    const last = slots[slots.length - 1];
    let c: number | null = null;
    for (const g of [2, 1])
      if (last + g <= 6 && !week[last + g].w && !slots.includes(last + g)) {
        c = last + g;
        break;
      }
    if (c === null) break;
    slots.push(c);
  }
  if (week[fromDay].lock || slots.some((i) => week[i].lock)) return null;
  const changes = slots.map((d, k) => [d, queue[k]] as [number, string]);
  return { fromDay, changes, overflow: queue.slice(slots.length) };
}

export function applyShift(week: Day[], sh: NonNullable<ReturnType<typeof shiftPlan>>): Day[] {
  const next = week.map((d) => ({ ...d }));
  next[sh.fromDay].w = null;
  sh.changes.forEach(([d]) => (next[d].w = null));
  sh.changes.forEach(([d, w]) => (next[d].w = w));
  return next;
}

/** Highest number in a reps text like "8–10" or "12". */
export const topReps = (reps: string) => parseInt(String(reps).split(/[–-]/).pop() ?? '10', 10) || 10;

/** Calories for a strength workout (about 5 METs). */
export const workoutKcal = (minutes: number, weightKg: number) => Math.round((5 * weightKg * minutes) / 60);

/** Cardio types and their METs (design: CARDIO). */
export const CARDIO: [('Walk' | 'Run' | 'Bike' | 'Swim'), number][] = [
  ['Walk', 3.5],
  ['Run', 9],
  ['Bike', 7],
  ['Swim', 7.5],
];
export const cardioKcal = (kind: number, intensity: number, weightKg: number, minutes: number) => Math.round(CARDIO[kind][1] * [0.8, 1, 1.25][intensity] * weightKg * (minutes / 60));
