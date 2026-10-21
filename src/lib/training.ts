import EXERCISES from '@/data/exercises.json';

import { localDay } from './nutrition';

/** A common Adro exercise (src/data/exercises.json). Pictures and full steps live in the database. */
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
export type PlanEx = { id: string; sets: number; reps: string; n?: string; ar?: string | null; m?: string; t?: string; time?: boolean; pri?: string; sec?: string[] };
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
  /** Changes for one week only (moved or missed workouts): the latest week that has some. */
  override?: { start: string; week: Day[] };
  /** Other weeks' own changes (by the week's Sunday), kept so past weeks are still judged by what was planned then. */
  overrides?: Record<string, Day[]>;
  /** Dates (YYYY-MM-DD) skipped or dismissed, and today's short or home version. */
  skipped: Record<string, true>;
  dismiss: Record<string, true>;
  short?: string;
  homeDay?: string;
  /** Day the plan was made. Days before it are never "missed". */
  since?: string;
  /** Day the weekly layout last changed (a workout moved to another weekday). Earlier days are never "missed" either,
   * since we don't know which days they were planned on then. */
  weekSince?: string;
  /** Today's quick check-in for the recovery score. */
  checkin?: { day: string; sleep: number; sore: number; energy: number };
  /** Lighter day (date) and deload week (Sunday of that week). */
  light?: string;
  deload?: string;
  /** Last day of the latest deload week (or the day it was ended early). Only sessions after it count for a new suggestion. */
  deloadEnd?: string;
  deloadDismissed?: string;
  /** Train together invites already applied to this plan (session id). */
  togetherDone?: Record<string, true>;
  /** Day you answered "make today lighter?" after poor sleep or low recovery. */
  lightAsked?: string;
  /** 'fixed': same days every week. 'order': the next workout in order, with a rest day between. */
  type?: 'fixed' | 'order';
  /** Workout order for the 'order' type. */
  queue?: string[];
  /** Set when the plan is your coach's program (and which version of it). */
  coach?: { id: string; updated_at?: string };
  /** The weekly AI check of your results (day it ran), and the last one: what changed and what to put back on Undo. */
  reviewedAt?: string;
  review?: { at: string; summary: string; changes: import('./coach').PlanChange[]; prev: { workouts: Record<string, Workout>; deload?: string; light?: string }; seen?: boolean };
  /** Training level you picked (Train together uses it). */
  level?: Level;
};

/** A muscle group's name. In Arabic, "Back" alone would mean the back button, so it has its own key. */
export const muscleLabel = (m: string, lang: 'en' | 'ar', t: (s: string) => string) => (lang === 'ar' ? t(m === 'Back' ? 'Back muscles' : m) : m);

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
/** Filters for picking exercises: arms split into biceps, triceps and forearms. */
export const FILTER_MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Legs', 'Core'];
/** Which part of the arm the common exercises work (database exercises carry it in muscles[0]). */
const ARM_PART: Record<string, string> = { curl: 'Biceps', hammer: 'Biceps', dbcurl: 'Biceps', cablecurl: 'Biceps', preacher: 'Biceps', pushdown: 'Triceps', skull: 'Triceps', overhead: 'Triceps', dips: 'Triceps', closegrip: 'Triceps' };
/** The muscle to show for an exercise: Biceps / Triceps / Forearms instead of just Arms. */
export function exMuscle(id: string, muscle: string, muscles?: string[] | null) {
  if (muscle !== 'Arms') return muscle;
  const m = muscles?.[0]?.toLowerCase();
  if (m === 'biceps' || m === 'triceps' || m === 'forearms') return m[0].toUpperCase() + m.slice(1);
  return ARM_PART[id] ?? muscle;
}
/** Specific muscles for naming your own exercise (design: MUSCLES), and their muscle group (MGROUP). */
export const MUSCLES_FINE = ['Chest', 'Upper chest', 'Back', 'Lats', 'Front shoulders', 'Side shoulders', 'Rear shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Lower back', 'Glutes', 'Quads', 'Hamstrings', 'Calves'];
export const muscleGroup = (m: string): Muscle =>
  /chest/i.test(m) ? 'Chest' : /back|lats/i.test(m) ? 'Back' : /shoulder/i.test(m) ? 'Shoulders' : /biceps|triceps|forearm/i.test(m) ? 'Arms' : /abs/i.test(m) ? 'Core' : 'Legs';
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
/** The split the AI plan uses, decided here so the same answers always give the same split; the AI only picks the exercises.
 * It depends on days, level, goal and age, and says why. A, B and C days of the same kind use different exercises. */
export function aiSplit(days: number, who: { level?: Level | null; goal?: string; age?: number | null }): { label: string; names: string[]; why: string } {
  const easy = who.level === 'Beginner' || (who.age ?? 0) >= 50;
  const easyWhy = who.level === 'Beginner' ? 'You’re new, so simpler sessions that repeat the main lifts often build skill and strength fastest.' : 'Shorter sessions with less on each muscle are easier to recover from.';
  if (days <= 2) return { label: 'Full body × 2', names: ['Full body A', 'Full body B'], why: 'With 2 days, full body is the only way to train every muscle twice a week.' };
  if (days === 3) {
    if (easy) return { label: 'Full body × 3', names: ['Full body A', 'Full body B', 'Full body C'], why: easyWhy };
    if (who.goal === 'cut') return { label: 'Full body × 3', names: ['Full body A', 'Full body B', 'Full body C'], why: 'Full body works more muscle each session, which helps you keep muscle while losing fat.' };
    return { label: 'Upper / Lower / Full body', names: ['Upper', 'Lower', 'Full body'], why: 'Every muscle twice a week, which builds more muscle than once a week.' };
  }
  if (days === 4) return { label: 'Upper / Lower × 2', names: ['Upper A', 'Lower A', 'Upper B', 'Lower B'], why: 'Every muscle twice a week, with a rest day between the same muscles.' };
  if (days === 5) {
    if (easy) return { label: 'Upper / Lower × 2 + Full body', names: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Full body'], why: easyWhy };
    return { label: 'Upper / Lower + Push / Pull / Legs', names: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'], why: 'Every muscle twice a week, with more focused days in the second half.' };
  }
  if (easy) return { label: 'Upper / Lower × 3', names: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C', 'Lower C'], why: easyWhy };
  return { label: 'Push / Pull / Legs × 2', names: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'], why: 'Every muscle twice a week with lots of focused work, which suits experienced lifters.' };
}
export const SPREAD: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

/** True when some muscle is trained only once a week (design: onceNote). */
export function onceNote(seq: string[]) {
  const c = { push: 0, pull: 0, legs: 0 };
  // "Push 2" and "Push A" count as push days too.
  seq.map((w) => w.trim().replace(/\s+(\d+|[A-C])$/, '')).forEach((w) => {
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

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export const LEVEL_DESC: [Level, string][] = [
  ['Beginner', 'New to the gym, or back after a long break'],
  ['Intermediate', 'Training regularly for 6 months or more'],
  ['Advanced', 'Training seriously for 2 years or more'],
];
/** Easier versions of the big barbell lifts for beginners: machines and dumbbells. */
const BEGINNER_SWAP: Record<string, string[]> = {
  bench: ['chestpress', 'dbpress'],
  squat: ['goblet', 'hacksquat'],
  frontsquat: ['goblet', 'hacksquat'],
  rdl: ['dbrdl', 'legcurl'],
  row: ['dbrow', 'cablerow'],
  ohp: ['shoulder', 'dbshoulder'],
  curl: ['dbcurl', 'hammer'],
  deadlift: ['cablerow', 'dbrow'],
};

/** Shape a workout for your level. Beginners: easier exercises, fewer of them, 3 sets of 10–12.
 * Advanced: one more set on the first two (big) lifts. Intermediate: as it is. */
export function exForLevel(ex: PlanEx[], level: Level | undefined): PlanEx[] {
  if (level === 'Beginner') {
    const out: PlanEx[] = [];
    for (const x of ex) {
      const id = [x.id, ...(BEGINNER_SWAP[x.id] ?? [])].find((c, i) => (i > 0 || !BEGINNER_SWAP[x.id]) && !out.some((o) => o.id === c));
      if (!id) continue;
      // At most 2 exercises per muscle (4 on leg days), so the workout stays short but covers everything.
      const m = EX[id]?.m;
      if (out.filter((o) => EX[o.id]?.m === m).length >= (m === 'Legs' ? 4 : 2)) continue;
      out.push({ id, sets: Math.min(x.sets, 3), reps: EX[id]?.time ? x.reps : '10–12' });
    }
    return out.slice(0, 5);
  }
  if (level === 'Advanced') return ex.map((x, i) => (i < 2 ? { ...x, sets: Math.min(5, x.sets + 1) } : x));
  return ex;
}

/** A new plan from a split (fixed days, starting workouts). */
export function planFromSplit(days: number, injuries: string[], label: string, seq: string[], level?: Level): TrainPlan {
  const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
  SPREAD[days].forEach((d, i) => (week[d].w = seq[i]));
  const workouts: Record<string, Workout> = {};
  seq.forEach((w) => {
    const ex = exForLevel(tplEx(WK[w].ex), level);
    workouts[w] = { ex, focus: WK[w].focus, min: level === 'Beginner' ? Math.min(WK[w].min, workoutMinutes(ex)) : level === 'Advanced' ? Math.max(WK[w].min, workoutMinutes(ex)) : WK[w].min };
  });
  return { days, injuries, split: label, week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {}, level };
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

/** A plan from your coach's program: its days spread over the week (same as My program). */
export function planFromProgram(p: { name: string; days: { name: string; ex: PlanEx[] }[] }): TrainPlan {
  const days = p.days.filter((d) => d.ex.length).slice(0, 6);
  const n = Math.max(1, days.length);
  const spots = n === 1 ? [1] : SPREAD[n];
  const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
  const workouts: Record<string, Workout> = {};
  days.forEach((d, i) => {
    let name = d.name.trim() || `Day ${i + 1}`;
    while (workouts[name]) name = `${name} ${i + 1}`;
    workouts[name] = { ex: d.ex, focus: '', min: workoutMinutes(d.ex) };
    week[spots[i]].w = name;
  });
  return { days: n, injuries: [], split: p.name, week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {} };
}

/**
 * Your plan from your coach's program, keeping what's yours (injuries, skipped days, machines, level, home mode,
 * check-in, lighter day and deload). When the weekly layout changes, earlier days are never judged as missed
 * (weekSince), and this week's own moves stay when their workouts are still in the program.
 */
export function planWithProgram(cur: TrainPlan | null | undefined, prog: { id: string; updated_at?: string; name: string; days: { name: string; ex: PlanEx[] }[] }, today: string): TrainPlan {
  const base = rangePlan(planFromProgram(prog));
  const layout = !cur || cur.week.some((d, i) => d.w !== base.week[i]?.w);
  const override = cur?.override && cur.override.week.every((d) => !d.w || base.workouts[d.w]) ? cur.override : undefined;
  return {
    ...base,
    since: cur?.coach?.id === prog.id ? (cur.since ?? today) : today,
    weekSince: layout ? today : cur?.weekSince,
    override,
    overrides: cur?.overrides,
    skipped: cur?.skipped ?? {},
    dismiss: cur?.dismiss ?? {},
    machines: cur?.machines ?? {},
    checkin: cur?.checkin,
    light: cur?.light,
    deload: cur?.deload,
    deloadEnd: cur?.deloadEnd,
    deloadDismissed: cur?.deloadDismissed,
    togetherDone: cur?.togetherDone,
    level: cur?.level,
    // Your injuries and home mode are yours, not the program's (injured exercises keep being swapped).
    injuries: cur?.injuries ?? [],
    homeMode: cur?.homeMode ?? false,
    coach: { id: prog.id, updated_at: prog.updated_at },
  };
}

/** A free workout name based on another one: "Push" → "Push 2", "Push 3"… */
export function copyName(workouts: Record<string, unknown>, base: string) {
  const root = base.replace(/ \d+$/, '');
  let n = 2;
  while (workouts[`${root} ${n}`]) n++;
  return `${root} ${n}`;
}

/**
 * Give every repeated workout its own copy, so each day can have different exercises:
 * Push, Pull, Legs, Push, Pull, Legs → Push, Pull, Legs, Push 2, Pull 2, Legs 2.
 */
export function splitRepeats(plan: TrainPlan): Partial<TrainPlan> {
  const workouts = { ...plan.workouts };
  const seen = new Set<string>();
  const week = plan.week.map((d) => {
    if (!d.w) return d;
    if (!seen.has(d.w)) {
      seen.add(d.w);
      return d;
    }
    const name = copyName(workouts, d.w);
    workouts[name] = { ...workouts[d.w], ex: workouts[d.w].ex.map((x) => ({ ...x })) };
    return { ...d, w: name };
  });
  const order = week.filter((d) => d.w).map((d) => d.w as string);
  // This week's moves stay: the 2nd, 3rd… time a workout comes up gets the same new name as in the plan.
  const names: Record<string, string[]> = {};
  plan.week.forEach((d, i) => d.w && (names[d.w] ??= []).push(week[i].w as string));
  let override = plan.override;
  if (override) {
    const n: Record<string, number> = {};
    override = {
      ...override,
      week: override.week.map((d) => {
        if (!d.w) return d;
        n[d.w] = (n[d.w] ?? 0) + 1;
        return { ...d, w: names[d.w]?.[n[d.w] - 1] ?? d.w };
      }),
    };
  }
  return { workouts, week, queue: order, override };
}

/** Workouts in the order they come in the week (each once). */
export const weekOrder = (week: Day[]) => [...new Set(week.filter((d) => d.w).map((d) => d.w as string))];

const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
};

/**
 * 'order' plans: what's next and the earliest day for it. Any workout counts as a training day,
 * and there's at least one rest day between workouts.
 */
export function orderNext(plan: TrainPlan, logs: { day: string; name: string }[], today: string) {
  const q = (plan.queue?.length ? plan.queue : weekOrder(plan.week)).filter((w) => plan.workouts[w]);
  if (!q.length) return { queue: q, next: null as string | null, idx: 0, earliest: today };
  const last = logs.find((l) => q.includes(l.name) && l.day < today);
  const idx = last ? (q.indexOf(last.name) + 1) % q.length : 0;
  const lastDay = logs.find((l) => l.day < today)?.day;
  const earliest = lastDay && lastDay >= addDay(today, -1) ? addDay(lastDay, 2) : today;
  return { queue: q, next: q[idx], idx, earliest };
}

/** This week (Sunday to Saturday) for an 'order' plan: done days, then the coming workouts every other day. */
export function orderWeek(plan: TrainPlan, logs: { day: string; name: string }[], today: string, start: string): Day[] {
  const { queue, idx, earliest } = orderNext(plan, logs, today);
  const byDay = new Map<string, string>();
  for (const l of logs) if (!byDay.has(l.day)) byDay.set(l.day, l.name);
  const week: Day[] = DAYS.map(() => ({ w: null, lock: false }));
  let k = idx;
  let slot = byDay.has(today) ? addDay(today, 2) : earliest;
  const ti = queue.indexOf(byDay.get(today) ?? '');
  if (ti >= 0) k = (ti + 1) % queue.length;
  for (let i = 0; i < 7; i++) {
    const d = addDay(start, i);
    if (d <= today && byDay.has(d)) week[i].w = byDay.get(d) as string;
    else if (d >= today && queue.length && d === slot) {
      week[i].w = queue[k % queue.length];
      k++;
      slot = addDay(d, 2);
    }
  }
  return week;
}

/** Name, muscle, equipment and machines for any exercise in a plan. */
export function exInfo(x: { id: string; n?: string; ar?: string | null; m?: string; t?: string; time?: boolean }, lang: 'en' | 'ar') {
  const e = EX[x.id];
  if (e) return { name: lang === 'ar' ? e.ar : e.en, muscle: e.m, type: e.t, mach: e.mach, timed: !!e.time };
  return { name: (lang === 'ar' && x.ar) || x.n || x.id.replace(/_/g, ' '), muscle: (x.m as Muscle) ?? 'Other', type: (x.t as Equipment) ?? 'Other', mach: [] as [string, string][], timed: !!x.time };
}

export type LastSets = Record<string, { w: number; r: number }[]>;

export type BuiltEx = PlanEx & { swapped: boolean; target: number; last: { w: number; r: number }[] };

/**
 * Pregnancy-safe swaps (common guidance, like ACOG's): nothing lying flat on the back or on the belly, no heavy
 * barbell lifts held with the breath, no jumps or fast swings, no crunches. null = left out of the workout.
 */
export const PREG_SWAP: Record<string, string | null> = {
  bench: 'chestpress',
  smith: 'chestpress',
  dbpress: 'chestpress',
  dbfly: 'pecdeck',
  skull: 'pushdown',
  closegrip: 'pushdown',
  ohp: 'shoulder',
  row: 'cablerow',
  tbar: 'cablerow',
  deadlift: 'cablerow',
  squat: 'goblet',
  frontsquat: 'goblet',
  legcurl: 'hipthrust',
  jumpsquat: 'bwsquat',
  kbswing: 'goblet',
  crunch: 'sideplank',
  crunchfloor: 'sideplank',
  legraise: 'sideplank',
  russian: 'sideplank',
  mountain: 'sideplank',
  superman: null,
  pike: null,
};
/** Exercises from the full list that aren't pregnancy-safe, by name (lying, jumping, crunches and the like). */
const PREG_UNSAFE = /lying|supine|decline|prone|crunch|sit-?up|jump|burpee|plyo|leg raise|v-up|russian twist|snatch|clean and|box/i;

/** The pregnancy-safe version of an exercise: itself, a safer one (by id), or null to leave it out. */
export function pregSafe(x: PlanEx): string | null {
  if (x.id in PREG_SWAP) return PREG_SWAP[x.id];
  if (!EX[x.id] && PREG_UNSAFE.test(`${x.n ?? ''} ${x.id}`)) return null;
  return x.id;
}

/** The workout for today, with injury swaps, short or home version, and last time's numbers. */
export function buildWorkout(plan: TrainPlan, name: string, opts: { home?: boolean; short?: boolean; light?: boolean; deload?: boolean; preg?: boolean; last: LastSets; top?: Record<string, number> }) {
  const home = opts.home;
  // The home workout is shaped for your level too (fewer, easier sets for beginners; more for advanced).
  let base: PlanEx[] = home ? exForLevel(tplEx(WK.Home.ex), plan.level) : (plan.workouts[name]?.ex ?? []);
  // Pregnant: safer exercises (a swap shows the new one's name), at most 3 sets of 10 reps or more.
  if (opts.preg) {
    const seen = new Set<string>();
    base = base.flatMap((x) => {
      const id = pregSafe(x);
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const lo = parseInt(String(x.reps).split(/[–-]/)[0] ?? '10', 10) || 10;
      const reps = EX[id]?.time || x.time ? (id === x.id ? x.reps : '30') : lo >= 10 ? x.reps : '10–12';
      return [{ ...(id === x.id ? x : { id }), sets: Math.min(3, x.sets), reps }];
    });
  }
  const inj = plan.injuries;
  let ex: BuiltEx[] = base.map((x) => {
    const e = EX[x.id];
    const swap = e?.stress?.some((s) => inj.includes(s)) && e.alt ? e.alt : null;
    const id = swap ?? x.id;
    const last = opts.last[id] ?? [];
    return { ...x, id, ...(swap ? { n: undefined, ar: undefined } : {}), swapped: !!swap, last, target: last.length ? Math.max(...last.map((s) => s.w)) : 0 };
  });
  // Lighter day: one set less and about 10% less weight. Deload week: one set less and about 60%.
  // Cut from your best recent normal session, so an old lighter session doesn't make it cut twice.
  // Pregnant: about 20% lighter than your best recent weights (and never pushing for more).
  // Pregnant and lighter (or deload) together: the lightest of them, so it's never heavier than pregnant alone.
  const cut = Math.min(opts.deload ? 0.6 : 1, opts.light ? 0.9 : 1, opts.preg ? 0.8 : 1);
  const fewer = !!(opts.light || opts.deload);
  if (cut < 1) ex = ex.map((x) => ({ ...x, sets: fewer ? Math.max(1, x.sets - 1) : x.sets, target: Math.round((Math.max(x.target, opts.top?.[x.id] ?? 0) * cut) / 2.5) * 2.5 }));
  let min = home ? WK.Home.min : (plan.workouts[name]?.min ?? workoutMinutes(base));
  if (cut < 1) min = Math.round((min * 0.85) / 5) * 5;
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
export const effectiveWeek = (plan: TrainPlan, start: string) => (plan.override?.start === start ? plan.override.week : (plan.overrides?.[start] ?? plan.week));

/**
 * Give one week its own layout (this week only). Another week's changes move to `overrides` instead of being lost, so
 * a day moved away from in that week never counts as missed later. Weeks older than 16 weeks are let go.
 */
export function setWeekMoves(plan: TrainPlan, start: string, week: Day[]): Pick<TrainPlan, 'override' | 'overrides'> {
  const all = { ...(plan.overrides ?? {}) };
  if (plan.override && plan.override.start !== start) all[plan.override.start] = plan.override.week;
  delete all[start];
  const oldest = addDay(start, -16 * 7);
  const overrides = Object.fromEntries(Object.entries(all).filter(([s]) => s >= oldest));
  return { override: { start, week }, overrides };
}

/**
 * True when missing a day counts as a missed workout: a workout was on it in that week's plan (with moves for that
 * week only), it wasn't skipped or dismissed, and it isn't before the plan was made or its days last changed.
 */
export function plannedOn(plan: TrainPlan, day: string) {
  if ((plan.since && day < plan.since) || (plan.weekSince && day < plan.weekSince)) return false;
  if (plan.skipped[day] || plan.dismiss?.[day]) return false;
  return !!effectiveWeek(plan, weekStart(day))[weekdayOf(day)]?.w;
}

/** The first day workouts were saved with their own "lighter" flag. */
const LIGHT_FLAG_SINCE = '2026-10-14';

/** A lighter-day or deload session: its weights were lower on purpose, so they never set next time's numbers.
 * Newer logs carry a flag; older ones are matched to the plan's lighter day and deload week. */
export function isLightLog(l: { day: string; exercises?: { light?: boolean }[] | null }, plan?: Pick<TrainPlan, 'light' | 'deload'> | null) {
  if (l.exercises?.some((x) => x.light)) return true;
  // Sessions since the flag exists say it themselves: a normal one stays normal even if a lighter day or deload week
  // was turned on later that day or week. Only older ones are matched by date.
  if (l.day >= LIGHT_FLAG_SINCE) return false;
  return !!plan && (l.day === plan.light || (!!plan.deload && weekStart(l.day) === plan.deload));
}

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

/** A rep target as a range: "8" becomes "8–10", "12" becomes "12–15" and "15" becomes "15–20". Timed holds stay in seconds; anything else is left as it is. */
export function repRange(reps: string, timed?: boolean) {
  const s = String(reps ?? '').trim();
  const m = s.match(/^(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?$/);
  if (timed || !m) return s;
  const a = +m[1];
  const b = m[2] ? +m[2] : a;
  if (b > a) return `${a}–${b}`;
  return `${a}–${a + (a >= 15 ? 5 : a >= 12 ? 3 : 2)}`;
}

/** Every exercise in the plan with a rep range, never a single number. */
export function rangePlan<P extends Pick<TrainPlan, 'workouts'>>(p: P): P {
  return { ...p, workouts: Object.fromEntries(Object.entries(p.workouts ?? {}).map(([k, w]) => [k, { ...w, ex: w.ex.map((x) => ({ ...x, reps: repRange(x.reps, x.time || EX[x.id]?.time) })) }])) };
}

/** A range for showing: "8" when both ends are the same, never "8–8". */
export const rangeText = (lo: number, hi: number) => (lo === hi ? String(hi) : `${lo}–${hi}`);

/** Highest number in a reps text like "8–10" or "12". */
export const topReps = (reps: string) => parseInt(String(reps).split(/[–-]/).pop() ?? '10', 10) || 10;
/** The low end of a rep range ("8–12" gives 8). */
export const lowReps = (reps: string) => parseInt(String(reps).split(/[–-]/)[0] ?? '8', 10) || topReps(reps);

/** One weight step up (kg). */
export const STEP_KG = 2.5;

/**
 * Last time every set reached the top of the rep range at your working weight: this time starts one step heavier
 * (back at the low end of the range). Null when it isn't time to go up yet (or it isn't a weighted exercise).
 * `step`: one plate jump in kg in your unit (2.5 kg, or 5 lb); the result lands on a whole number of steps.
 */
export function nextWeight(prev: { w: number; r: number }[], reps: string, step = STEP_KG): number | null {
  if (!prev.length) return null;
  const w = Math.max(...prev.map((s) => s.w));
  if (!(w > 0)) return null;
  return prev.every((s) => s.w >= w && s.r >= topReps(reps)) ? Math.round(Math.round((w + step) / step) * step * 10000) / 10000 : null;
}

/** Calories for a strength workout (about 5 METs). */
export const workoutKcal = (minutes: number, weightKg: number) => Math.round((5 * weightKg * minutes) / 60);

/**
 * Calories from the heart rate the watch measured (Keytel et al., 2005), for when it's there. Heart-rate formulas read
 * high for lifting (rest between sets keeps the heart rate up), so the result is taken at 75%, at most 10 a minute,
 * and kept between half and twice the estimate without a watch.
 */
export function heartKcal(x: { avgHr: number; minutes: number; weightKg: number; age: number; female: boolean; guess: number }) {
  const perMin = x.female ? (-20.4022 + 0.4472 * x.avgHr - 0.1263 * x.weightKg + 0.074 * x.age) / 4.184 : (-55.0969 + 0.6309 * x.avgHr + 0.1988 * x.weightKg + 0.2017 * x.age) / 4.184;
  const total = Math.min(perMin * 0.75, 10) * x.minutes;
  return Math.round(Math.min(x.guess * 2, Math.max(x.guess * 0.5, total)));
}

/** Cardio types and their METs (design: CARDIO). */
export const CARDIO: [('Walk' | 'Run' | 'Bike' | 'Swim'), number][] = [
  ['Walk', 3.5],
  ['Run', 9],
  ['Bike', 7],
  ['Swim', 7.5],
];
export const cardioKcal = (kind: number, intensity: number, weightKg: number, minutes: number) => Math.round(CARDIO[kind][1] * [0.8, 1, 1.25][intensity] * weightKg * (minutes / 60));

/** Top weight of each finished session for an exercise, newest first. */
export function topWeights(logs: { day: string; exercises: { id: string; sets: { w: number }[] }[] }[], id: string) {
  return logs.flatMap((l) => l.exercises.filter((x) => x.id === id).map((x) => Math.max(0, ...x.sets.map((s) => s.w)))).filter((w) => w > 0);
}

/** Lifts that dropped two sessions in a row (design: deload suggestion). Lighter and deload sessions don't count. */
export function droppingLifts(all: { day: string; exercises: { id: string; n: string; light?: boolean; sets: { w: number }[] }[] }[], plan?: Pick<TrainPlan, 'light' | 'deload' | 'deloadEnd'> | null) {
  // Only normal sessions after the last deload week ended, so it isn't suggested again right after one.
  const ends = [plan?.deloadEnd, plan?.deload ? addDay(plan.deload, 6) : undefined].filter((d): d is string => !!d).sort();
  const after = ends[ends.length - 1];
  const logs = all.filter((l) => !isLightLog(l, plan) && (!after || l.day > after));
  const ids = [...new Set(logs.flatMap((l) => l.exercises.map((x) => x.id)))];
  return ids.filter((id) => {
    const w = topWeights(logs, id);
    return w.length >= 3 && w[0] < w[1] && w[1] < w[2];
  });
}

/** Title for a finished or running workout ("Push day", "Home workout", "Train together"). */
export const workoutTitle = (name: string, t: (s: string, v?: Record<string, string | number>) => string) =>
  name === 'Home' ? t('Home workout') : name === 'Together' ? t('Train together') : t('{w} day', { w: t(name) });
