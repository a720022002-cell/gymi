// Helpers for the weekly recap: the week in detail for the AI, and applying the kinds of suggestions that aren't plan or target changes.
import { addDays } from './nutrition';
import type { ReminderKind, Suggestion } from './recap';
import type { Prefs } from './reminders';
import type { ReportData } from './report';
import { type TrainPlan, weekStart } from './training';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Each day of the week for the AI: food, water, training, sleep and how you felt. */
export function weekDays(start: string, data: ReportData, days: ('ok' | 'miss' | 'rest')[] | null) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const f = data.days[d];
    const c = data.checkins.find((x) => x.day === d);
    return {
      day: d,
      weekday: i,
      name: WEEKDAYS[i],
      kcal: f ? Math.round(f.k) : null,
      protein: f ? Math.round(f.p) : null,
      waterMl: f ? Math.round(f.w) : null,
      training: days?.[i] === 'ok' ? 'trained' : days?.[i] === 'miss' ? 'missed planned workout' : 'rest',
      sleepH: c?.sleep_h ?? null,
      recovery: c?.score ?? null,
      energy: c?.energy == null ? null : ['tired', 'normal', 'great'][c.energy],
      soreness: c?.sore == null ? null : ['none', 'a little', 'very sore'][c.sore],
    };
  });
}

/** Which reminders are on, and at what time (for the AI, so it doesn't suggest one you already have). */
export function remindersSummary(p: Prefs | null) {
  if (!p) return undefined;
  return {
    allOn: p.on,
    sleep: p.sleep.on ? p.sleep.time : 'off',
    workout: p.workout.on ? p.workout.time : 'off',
    water: p.water.on ? `from ${p.water.from}` : 'off',
    checkin: p.checkin.on ? p.checkin.time : 'off',
    food: p.food.on ? 'on' : 'off',
  };
}

/** Turn a reminder on at a time (all reminders on too). */
export function withReminder(p: Prefs, kind: ReminderKind, time: string): Prefs {
  const n: Prefs = { ...p, on: true };
  if (kind === 'sleep') n.sleep = { ...p.sleep, on: true, time };
  if (kind === 'workout') n.workout = { ...p.workout, on: true, time };
  if (kind === 'water') n.water = { ...p.water, on: true, from: time };
  if (kind === 'checkin') n.checkin = { ...p.checkin, on: true, time };
  if (kind === 'food') {
    n.food = { ...p.food, on: true };
    n.meals = { on: true };
  }
  return n;
}

/** Move a workout from one weekday to a rest day, for good (this week's own moves follow too). */
export function moveDay(plan: TrainPlan, from: number, to: number, today: string): TrainPlan {
  const swap = (w: TrainPlan['week']) => (w[from]?.w && !w[to]?.w ? w.map((d, i) => (i === from ? w[to] : i === to ? w[from] : d)) : w);
  const start = weekStart(today);
  const override = plan.override?.start === start ? { ...plan.override, week: swap(plan.override.week) } : plan.override;
  return { ...plan, week: swap(plan.week), override, weekSince: today };
}

/** Calories moved in the coming days: taken from each "from" weekday, shared over the "to" weekdays (whole tens, adding up to zero). */
export function balanceMoves(s: Extract<Suggestion, { type: 'balance' }>, today: string) {
  const start = weekStart(today);
  // The next time each weekday comes (today counts).
  const date = (wd: number) => {
    const d = addDays(start, wd);
    return d < today ? addDays(d, 7) : d;
  };
  const total = s.kcal * s.from.length;
  const share = Math.floor(total / s.to.length / 10) * 10;
  const out = s.from.map((wd) => ({ day: date(wd), kcal: -s.kcal }));
  s.to.forEach((wd, i) => out.push({ day: date(wd), kcal: i === s.to.length - 1 ? total - share * (s.to.length - 1) : share }));
  return out;
}
