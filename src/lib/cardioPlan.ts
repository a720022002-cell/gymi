// The weekly cardio and sports plan: the sports you already play (fixed days), plus classic cardio to fill what's
// missing: how many sessions, which sport, how long, how hard, and on which days. Pure functions only (no React, no
// database), so the rules are easy to check.
//
// The rules (common guidance: ACSM / WHO activity guidelines, concurrent-training research, ACOG for pregnancy):
// - Lose fat: 3–4 sessions, mostly easy zone 2 (30–45 min), plus one zone 4 interval session for intermediate and
//   advanced. Easy cardio adds calories burned without eating into strength recovery.
// - Maintain / general health: 2–3 sessions (2 easy zone 2 of 30–40 min, plus one optional interval session).
// - Gain muscle: 2 short easy sessions (20–25 min), low-impact (bike, walk, incline walk, elliptical), no intervals,
//   kept off leg days and the day before them so legs recover. Sports next to leg day get a warning.
// - Sports you play count toward the week: padel, tennis, badminton, volleyball, hiking ≈ a moderate session; football,
//   basketball, squash, boxing, jump rope ≈ a hard session (counted like intervals). Yoga / Pilates is light and
//   doesn't count. Classic cardio only fills what's missing.
// - Beginners start 15 minutes shorter and add 5 minutes a week, reaching the target in week 4.
// - Pregnancy: walk, bike, swim, yoga or an easy hike, easy only (zone 2: can talk the whole time), no intervals, no
//   contact, racket or jumping sports.
// - Knee, ankle or hip injury: no running, stairs, HIIT, jump rope, or sports with sprints and sharp turns (football,
//   basketball, padel, tennis, squash, badminton, volleyball). Shoulder: no swimming, rowing, racket sports, volleyball
//   or boxing. Lower back: no rowing.
// - Intervals are never on a leg day or a hard sport day, nor the day before or after one. Easy sessions go on rest
//   days first, then after lifting.
// - The more lifting days, the fewer cardio sessions, so the whole week stays reasonable.

import type { SportId } from './sports';
import type { Day, Level } from './training';

/** Every sport (the shared list in src/lib/sports.ts; the live cardio screen takes the same keys). */
export type CardioSport = SportId;
/** Classic cardio the plan can fill the week with. */
export const CARDIO_SPORTS: CardioSport[] = ['Run', 'Walk', 'Bike', 'Swim', 'Row', 'Elliptical', 'Stairs', 'HIIT'];
/** Sports you play on your own days. */
export const PLAY_SPORTS: CardioSport[] = ['Padel', 'Football', 'Tennis', 'Squash', 'Badminton', 'Basketball', 'Volleyball', 'Boxing', 'MartialArts', 'Yoga', 'Pilates', 'Hike', 'JumpRope', 'Other'];
/** How hard a sport is for the week: hard counts like intervals, moderate like a cardio session, light doesn't count. */
export const SPORT_LOAD: Partial<Record<CardioSport, 'hard' | 'moderate' | 'light'>> = {
  Football: 'hard',
  Basketball: 'hard',
  Squash: 'hard',
  Boxing: 'hard',
  MartialArts: 'hard',
  JumpRope: 'hard',
  Padel: 'moderate',
  Tennis: 'moderate',
  Badminton: 'moderate',
  Volleyball: 'moderate',
  Hike: 'moderate',
  Other: 'moderate',
  Yoga: 'light',
  Pilates: 'light',
};
/** Usual length of a session of each sport you play (minutes). */
export const PLAY_MIN: Partial<Record<CardioSport, number>> = { Padel: 75, Tennis: 60, Squash: 45, Badminton: 60, Football: 75, Basketball: 60, Volleyball: 60, Boxing: 45, MartialArts: 60, Yoga: 45, Pilates: 45, Hike: 90, JumpRope: 15, Other: 60 };

export type CardioKind = 'steady' | 'intervals';
export type CardioGoal = 'cut' | 'maintain' | 'bulk';
/** One session's shape (its day is worked out from the week: see cardioWeek). */
export type CardioSlot = { sport: CardioSport; min: number; zone: 2 | 3 | 4; kind: CardioKind };
/** A sport you play: on your own days every week. */
export type CardioPlay = { sport: CardioSport; days: number[]; min: number };
/** Saved with the training plan (TrainPlan.cardio). */
export type CardioPlan = {
  goal: CardioGoal;
  /** The classic cardio sport you picked (or the one picked for you). */
  sport: CardioSport;
  /** Sessions a week in all (sports you play included). */
  per: number;
  /** Weekdays you picked for classic cardio (0 = Sunday). None: placed around your workouts, and moved when they move. */
  days?: number[];
  /** Classic cardio sessions at full length; the intervals one (if any) first. */
  slots: CardioSlot[];
  /** Sports you play (fixed days). */
  play?: CardioPlay[];
  /** Sunday of the week it was made: beginners build up from here. */
  start: string;
  /** Beginners: start 15 min shorter and add 5 min a week. */
  ramp?: boolean;
};

/** What the plan is made from. `week`: the training week, Sunday first (workout name or null). */
export type CardioInput = {
  goal: CardioGoal;
  level?: Level | null;
  age?: number | null;
  preg?: boolean;
  injuries?: string[];
  week: (string | null)[];
  /** Your choices (left out: picked for you). */
  sport?: CardioSport;
  per?: number;
  days?: number[];
  play?: CardioPlay[];
};

/** A session placed on a day of a given week. `id` is stable for that week (planId for the live screen and
 * cardio_logs.plan_ref). `fixed`: a sport you play. */
export type CardioSession = CardioSlot & { day: number; date: string; id: string; index: number; fixed?: boolean };

const LEG_JOINTS = ['Knee', 'Ankle', 'Hip'];
const HIGH_IMPACT: CardioSport[] = ['Run', 'Stairs', 'HIIT', 'JumpRope', 'Football', 'Basketball', 'Padel', 'Tennis', 'Squash', 'Badminton', 'Volleyball', 'MartialArts'];
const SHOULDER: CardioSport[] = ['Swim', 'Row', 'Tennis', 'Padel', 'Squash', 'Badminton', 'Volleyball', 'Boxing', 'MartialArts'];
const PREG_OK: CardioSport[] = ['Walk', 'Bike', 'Swim', 'Yoga', 'Pilates', 'Hike'];

/** A training day that works the legs hard. Unknown names count as not legs. */
export const isLegDay = (w: string | null | undefined) => !!w && /\b(legs?|lower|full ?body)\b/i.test(w);
export const isPlay = (s: CardioSport) => PLAY_SPORTS.includes(s);
const loadOf = (s: CardioSport) => SPORT_LOAD[s] ?? 'moderate';

const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const sundayOf = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return addDay(day, -d.getDay());
};
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);

/** Whether a sport is safe for you now (pregnancy and injuries). */
export function sportSafe(s: CardioSport, x: Pick<CardioInput, 'preg' | 'injuries'>) {
  const inj = x.injuries ?? [];
  if (x.preg) return PREG_OK.includes(s);
  if (inj.some((i) => LEG_JOINTS.includes(i)) && HIGH_IMPACT.includes(s)) return false;
  if (inj.includes('Shoulder') && SHOULDER.includes(s)) return false;
  if (inj.includes('Lower back') && s === 'Row') return false;
  return true;
}

/** Classic cardio that's safe for you (and low-impact only when building muscle). */
export function allowedSports(x: Pick<CardioInput, 'goal' | 'preg' | 'injuries'>): CardioSport[] {
  return CARDIO_SPORTS.filter((s) => sportSafe(s, x) && !(x.goal === 'bulk' && (['Run', 'Stairs', 'HIIT', 'Row'] as CardioSport[]).includes(s)));
}
/** Sports you play that are safe for you. */
export const allowedPlay = (x: Pick<CardioInput, 'preg' | 'injuries'>) => PLAY_SPORTS.filter((s) => sportSafe(s, x));

/** The sport picked for you when you don't choose one. */
export function defaultSport(x: Pick<CardioInput, 'goal' | 'level' | 'age' | 'preg' | 'injuries'>): CardioSport {
  const ok = allowedSports(x);
  const older = (x.age ?? 0) >= 50;
  const order: CardioSport[] = x.preg
    ? ['Walk', 'Bike', 'Swim']
    : x.goal === 'bulk'
      ? ['Bike', 'Walk', 'Elliptical', 'Swim']
      : x.level === 'Beginner' || older
        ? ['Walk', 'Bike', 'Elliptical', 'Swim']
        : ['Run', 'Bike', 'Elliptical', 'Row', 'Swim', 'Walk'];
  return order.find((s) => ok.includes(s)) ?? ok[0] ?? 'Walk';
}

/** Whether interval sessions fit you at all. */
export function intervalsOk(x: Pick<CardioInput, 'goal' | 'level' | 'age' | 'preg'>, sport: CardioSport) {
  return !x.preg && x.goal !== 'bulk' && x.level !== 'Beginner' && (x.age ?? 0) < 60 && sport !== 'Walk';
}

/** Sessions a week in all, picked for you: by goal and level, fewer when you already lift on many days. */
export function defaultPer(x: Pick<CardioInput, 'goal' | 'level' | 'preg' | 'week'>) {
  const lift = x.week.filter(Boolean).length;
  const beginner = x.level === 'Beginner';
  let n = x.goal === 'cut' ? (beginner ? 3 : 4) : x.goal === 'bulk' ? 2 : beginner ? 2 : 3;
  if (lift >= 5) n = Math.min(n, x.goal === 'cut' ? 3 : 2);
  if (x.preg) n = Math.min(n, 3);
  return n;
}

/** Steady session length (full target) by goal, level and age. */
function steadyMin(x: Pick<CardioInput, 'goal' | 'level' | 'age' | 'preg'>) {
  const lvl = x.level === 'Beginner' ? 0 : x.level === 'Advanced' ? 2 : 1;
  let m = x.goal === 'cut' ? [30, 40, 45][lvl] : x.goal === 'bulk' ? [20, 25, 25][lvl] : [30, 35, 40][lvl];
  if (x.preg || (x.age ?? 0) >= 60) m = Math.min(m, 30);
  return m;
}

/** Interval session length, warm-up and cool-down included. */
export const INTERVAL_MIN = 25;

/** Sports you play as sessions on their days (only safe ones, each day once per sport). */
function playSessions(play: CardioPlay[] | undefined): { day: number; slot: CardioSlot }[] {
  return (play ?? []).flatMap((p) =>
    [...new Set(p.days)]
      .filter((d) => d >= 0 && d <= 6)
      .map((day) => {
        const load = loadOf(p.sport);
        return { day, slot: { sport: p.sport, min: p.min, zone: load === 'hard' ? 4 : load === 'light' ? 2 : 3, kind: load === 'hard' ? 'intervals' : 'steady' } as CardioSlot };
      }),
  );
}

/** Sessions of sports you play that count toward the week (light ones like yoga don't), and whether one is hard. */
export function playCount(play: CardioPlay[] | undefined) {
  const xs = playSessions(play).filter((p) => loadOf(p.slot.sport) !== 'light');
  return { n: xs.length, hard: xs.some((p) => p.slot.kind === 'intervals') };
}

/**
 * Pick the days for classic cardio: intervals first (never on a leg day or a hard sport day, nor the day before or
 * after one; a rest day if it can), then the easy sessions on rest days first, then after lifting (upper-body days
 * first), spread out so they're not back to back, and off the days you play. Returns one weekday per slot (same order
 * as `slots`); null means there was no day for it (intervals: no safe day).
 */
export function placeDays(week: (string | null)[], slots: Pick<CardioSlot, 'kind'>[], opts: { bulk?: boolean; days?: number[]; play?: { day: number; hard: boolean }[] } = {}): (number | null)[] {
  const legs = week.map((w) => isLegDay(w));
  const hardDay = legs.map((l, i) => l || !!opts.play?.some((p) => p.hard && p.day === i));
  const before = (i: number) => legs[(i + 1) % 7];
  const lift = (i: number) => !!week[i];
  const out: (number | null)[] = slots.map(() => null);
  const playDays = new Set((opts.play ?? []).map((p) => p.day));
  const used = new Set<number>();
  const near = (i: number) => (used.has((i + 1) % 7) || playDays.has((i + 1) % 7) ? 1 : 0) + (used.has((i + 6) % 7) || playDays.has((i + 6) % 7) ? 1 : 0);
  const safeHard = (i: number) => !hardDay[i] && !hardDay[(i + 1) % 7] && !hardDay[(i + 6) % 7] && !playDays.has(i);
  // Your own days: intervals go on the safest of them, the rest in order.
  if (opts.days?.length) {
    const pool = [...new Set(opts.days.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
    slots.forEach((s, k) => {
      if (s.kind !== 'intervals') return;
      const d = pool.filter((i) => !used.has(i) && safeHard(i)).sort((a, b) => Number(lift(a)) - Number(lift(b)) || a - b)[0];
      if (d != null) {
        out[k] = d;
        used.add(d);
      }
    });
    slots.forEach((s, k) => {
      if (s.kind === 'intervals') return;
      const d = pool.find((i) => !used.has(i));
      if (d != null) {
        out[k] = d;
        used.add(d);
      }
    });
    return out;
  }
  // Lower score = better day.
  const easyScore = (i: number) => (lift(i) ? (legs[i] ? 6 : 3) : 0) + (opts.bulk ? (legs[i] ? 6 : 0) + (before(i) ? 2 : 0) : 0) + near(i) * 2;
  const hardScore = (i: number) => (lift(i) ? 3 : 0) + near(i) * 2;
  slots.forEach((s, k) => {
    if (s.kind !== 'intervals') return;
    const c = [0, 1, 2, 3, 4, 5, 6].filter((i) => !used.has(i) && safeHard(i)).sort((a, b) => hardScore(a) - hardScore(b) || a - b)[0];
    if (c != null) {
      out[k] = c;
      used.add(c);
    }
  });
  slots.forEach((s, k) => {
    if (s.kind === 'intervals') return;
    const c = [0, 1, 2, 3, 4, 5, 6].filter((i) => !used.has(i) && !playDays.has(i)).sort((a, b) => easyScore(a) - easyScore(b) || a - b)[0];
    if (c != null) {
      out[k] = c;
      used.add(c);
    }
  });
  return out;
}

/** A new plan from your goal, level, age, pregnancy, injuries, training week and sports. `today`: YYYY-MM-DD. */
export function makeCardioPlan(x: CardioInput, today: string): CardioPlan {
  const ok = allowedSports(x);
  const sport = x.sport && ok.includes(x.sport) ? x.sport : defaultSport(x);
  // Sports you play: safe ones only, at least one day each.
  const play = (x.play ?? [])
    .filter((p) => isPlay(p.sport) && sportSafe(p.sport, x))
    .map((p) => ({ sport: p.sport, days: [...new Set(p.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b), min: Math.max(10, Math.min(240, Math.round(p.min || PLAY_MIN[p.sport] || 60))) }))
    .filter((p) => p.days.length);
  const counted = playCount(play);
  const days = x.days?.length ? [...new Set(x.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b) : undefined;
  // In all: your own number, or classic days you picked plus your sports, or the usual number for you.
  const per = Math.max(1, Math.min(10, Math.round(days?.length ? days.length + counted.n : (x.per ?? Math.max(defaultPer(x), counted.n)))));
  // Classic cardio fills only what your sports don't cover.
  const classic = days?.length ? days.length : Math.max(0, per - counted.n);
  // HIIT is intervals by nature: its easy sessions use a low-impact sport instead.
  const easySport: CardioSport = sport === 'HIIT' ? ((['Bike', 'Elliptical', 'Walk'] as CardioSport[]).find((s) => ok.includes(s)) ?? 'Walk') : sport;
  // One interval session when it fits you, the week has 3+ sessions, none of your sports is already hard, and at
  // least one easy classic session stays.
  const hard = intervalsOk(x, sport) && (x.goal === 'cut' || x.goal === 'maintain') && per >= 3 && !counted.hard && classic >= 2 ? 1 : 0;
  const min = steadyMin(x);
  const slots: CardioSlot[] = [
    ...Array.from({ length: hard }, () => ({ sport, min: INTERVAL_MIN, zone: 4 as const, kind: 'intervals' as const })),
    ...Array.from({ length: classic - hard }, () => ({ sport: easySport, min, zone: 2 as const, kind: 'steady' as const })),
  ];
  return { goal: x.goal, sport, per, ...(days?.length ? { days } : {}), slots, ...(play.length ? { play } : {}), start: sundayOf(today), ...(x.level === 'Beginner' ? { ramp: true } : {}) };
}

/** Minutes for a session in a given week: beginners build up by 5 min a week (−15, −10, −5, then the full time). */
export function rampMin(plan: Pick<CardioPlan, 'ramp' | 'start'>, slot: CardioSlot, weekStartDay: string) {
  if (!plan.ramp || slot.kind === 'intervals') return slot.min;
  const k = Math.max(0, Math.floor(daysBetween(plan.start, weekStartDay) / 7));
  return Math.max(15, slot.min - 5 * Math.max(0, 3 - k));
}

/**
 * The week's sessions on their days: your sports on their days, and classic cardio placed around them and your
 * workouts (without days of your own it follows your workouts: a moved leg day moves the intervals). Intervals with no
 * safe day that week become an easy session, so the rule always holds.
 */
export function cardioWeek(plan: CardioPlan | null | undefined, week: (Day | string | null)[], weekStartDay: string): CardioSession[] {
  const plays = playSessions(plan?.play);
  if (!plan || (!plan.slots?.length && !plays.length)) return [];
  const names = week.map((d) => (d && typeof d === 'object' ? d.w : d) ?? null);
  const slots = plan.slots ?? [];
  const placed = placeDays(names, slots, { bulk: plan.goal === 'bulk', days: plan.days, play: plays.map((p) => ({ day: p.day, hard: p.slot.kind === 'intervals' })) });
  const out: CardioSession[] = plays.map((p) => ({ ...p.slot, day: p.day, date: addDay(weekStartDay, p.day), id: '', index: 0, fixed: true }));
  const playDays = new Set(plays.map((p) => p.day));
  slots.forEach((s, k) => {
    let day = placed[k];
    let slot = s;
    if (day == null && s.kind === 'intervals') {
      // No safe day for intervals: an easy session on the best free day instead.
      slot = { ...s, kind: 'steady', zone: 2, min: 30 };
      const taken = new Set(placed.filter((d): d is number => d != null));
      const pool = (plan.days?.length ? plan.days : [0, 1, 2, 3, 4, 5, 6]).filter((i) => !taken.has(i) && (plan.days?.length || !playDays.has(i)));
      day = [...pool].sort((a, b) => Number(!!names[a]) - Number(!!names[b]) || Number(isLegDay(names[a])) - Number(isLegDay(names[b])) || a - b)[0] ?? null;
      placed[k] = day;
    }
    if (day == null) return;
    out.push({ ...slot, min: rampMin(plan, slot, weekStartDay), day, date: addDay(weekStartDay, day), id: '', index: 0 });
  });
  // Sorted by day (sports you play first on a shared day), so ids stay the same for the same plan and week.
  return out
    .sort((a, b) => a.day - b.day || Number(!!b.fixed) - Number(!!a.fixed) || a.sport.localeCompare(b.sport))
    .map((s, i) => ({ ...s, index: i, id: `${weekStartDay}:${i}` }));
}

/** Total minutes, easy minutes, interval sessions and sports in a week. */
export function weekSummary(sessions: (Pick<CardioSlot, 'min' | 'kind'> & { fixed?: boolean })[]) {
  return {
    sessions: sessions.length,
    minutes: sessions.reduce((a, s) => a + s.min, 0),
    easy: sessions.filter((s) => s.kind === 'steady' && !s.fixed).reduce((a, s) => a + s.min, 0),
    intervals: sessions.filter((s) => s.kind === 'intervals').length,
    sports: sessions.filter((s) => s.fixed).length,
  };
}

/** A cardio row from cardio_logs (plan_ref may not exist yet). */
export type CardioLogRef = { day: string; plan_ref?: string | null };

/**
 * Which sessions are done: a row tied to the session (plan_ref), or any cardio or sport logged on its day. Each row
 * counts for one session only. Missing one never touches the workout streak.
 */
export function cardioDone(sessions: CardioSession[], logs: CardioLogRef[]): Set<string> {
  const done = new Set<string>();
  const used = new Set<number>();
  sessions.forEach((s) => {
    const k = logs.findIndex((l, i) => !used.has(i) && l.plan_ref === s.id);
    if (k >= 0) {
      done.add(s.id);
      used.add(k);
    }
  });
  sessions.forEach((s) => {
    if (done.has(s.id)) return;
    const k = logs.findIndex((l, i) => !used.has(i) && l.day === s.date && (!l.plan_ref || !sessions.some((x) => x.id === l.plan_ref)));
    if (k >= 0) {
      done.add(s.id);
      used.add(k);
    }
  });
  return done;
}

export type CardioStatus = 'done' | 'missed' | 'today' | 'planned';
export const cardioStatus = (s: CardioSession, done: Set<string>, today: string): CardioStatus => (done.has(s.id) ? 'done' : s.date < today ? 'missed' : s.date === today ? 'today' : 'planned');

/**
 * Today's classic cardio for how you feel: recovery under 60 turns intervals into an easy session; under 40 it's a
 * short easy one (20 min at most) and running becomes walking. Sports you play stay as they are.
 */
export function forReadiness<S extends CardioSlot & { fixed?: boolean }>(s: S, score: number | null | undefined): S & { eased: boolean } {
  if (s.fixed || score == null || score >= 60) return { ...s, eased: false };
  if (score < 40) return { ...s, kind: 'steady', zone: 2, min: Math.min(s.min, 20), sport: s.sport === 'Run' || s.sport === 'HIIT' || s.sport === 'Stairs' ? 'Walk' : s.sport, eased: true };
  if (s.kind === 'intervals') return { ...s, kind: 'steady', zone: 2, min: Math.max(20, s.min), eased: true };
  return { ...s, eased: false };
}

/** Why a cardio plan helps, for your goal (English text: shown with t()). */
export function cardioWhy(x: Pick<CardioInput, 'goal' | 'preg' | 'level' | 'injuries'>): string[] {
  const out: string[] = [];
  if (x.goal === 'cut') out.push('Easy cardio burns more calories without hurting your lifting, so you lose fat faster and keep your muscle.');
  else if (x.goal === 'bulk') out.push('A little easy cardio keeps your heart fit and your appetite up, without slowing muscle gain. Short and low-impact, so your legs recover.');
  else out.push('Cardio keeps your heart strong, helps you recover between workouts and keeps your weight steady.');
  out.push('Sports you play count too. We only add what’s missing.');
  if (x.preg) out.push('Easy only: you should be able to talk the whole time. No contact or jumping sports. Check with your doctor first.');
  if ((x.injuries ?? []).some((i) => LEG_JOINTS.includes(i))) out.push('No running, jumping or quick-turn sports, to protect your joints.');
  if ((x.injuries ?? []).includes('Shoulder')) out.push('No swimming, rowing, racket sports or boxing, to protect your shoulder.');
  if (x.level === 'Beginner') out.push('You start shorter and add 5 minutes a week for 4 weeks.');
  return out;
}

/** A warning about the week (English text with its values, shown with t()). */
export type CardioWarning = { text: string; vars?: Record<string, string> };
/**
 * Warnings: building muscle with a sport (not yoga) on a leg day or next to one; a sport you play that isn't safe now
 * (pregnancy or an injury; it's left out of the plan when saved).
 */
export function cardioWarnings(x: Pick<CardioInput, 'goal' | 'preg' | 'injuries' | 'week' | 'play'>): CardioWarning[] {
  const out: CardioWarning[] = [];
  const legs = x.week.map((w) => isLegDay(w));
  const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const p of x.play ?? []) {
    if (!sportSafe(p.sport, x)) {
      out.push({ text: x.preg ? '{sport} isn’t advised in pregnancy. Try walking, swimming, cycling or yoga instead.' : '{sport} can hurt your injury, so it’s left out. Pick a safer sport.', vars: { sport: p.sport } });
      continue;
    }
    if (x.goal !== 'bulk' || loadOf(p.sport) === 'light') continue;
    const d = p.days.find((i) => legs[i] || legs[(i + 1) % 7] || legs[(i + 6) % 7]);
    if (d != null) out.push({ text: '{sport} on {day} is next to leg day. It can slow your leg recovery, so keep a day between them if you can.', vars: { sport: p.sport, day: DAY[d] } });
  }
  return out;
}

/** Zone in plain words (English, shown with t()). */
export const zoneText = (zone: number) => (zone >= 4 ? 'Zone 4: hard, only a few words' : zone === 3 ? 'Zone 3: moderate, short sentences' : 'Zone 2: easy, you can still talk');

/** The parameters the live cardio screen takes (router.push({ pathname: '/cardio-live', params })). */
export const liveParams = (s: Pick<CardioSession, 'sport' | 'min' | 'zone' | 'kind' | 'id'>) => ({ sport: s.sport, min: String(s.min), zone: String(s.zone), kind: s.kind, planId: s.id });

/** A short line for the AI coach: "Mon 2026-10-19: Bike 30 min, zone 2 (easy) - done". */
export const sessionLine = (s: CardioSession, status: CardioStatus) =>
  `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.day]} ${s.date}: ${s.sport} ${s.min} min, ${s.fixed ? `sport they play (${loadOf(s.sport)})` : s.kind === 'intervals' ? 'intervals zone 4 (hard)' : 'zone 2 (easy)'} - ${status}`;
