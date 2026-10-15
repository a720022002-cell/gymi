// The weekly recap: a story about last week (Sunday to Saturday), shown on the first open of a new week.
import { askAI } from './ai';
import { allergensIn, allergiesText } from './allergies';
import type { ChatAction } from './coach';
import { prepareSuggestions } from './coachPlan';
import { addDays } from './nutrition';
import type { ReportStats } from './report';
import { supabase } from './supabase';
import type { WorkoutLog } from './train';
import { EX, exInfo, plannedOn, type TrainPlan, weekStart } from './training';

/** What the recap can apply: plan changes and food targets (as in the coach chat), and moving a workout day,
 * turning on a reminder, saving a meal idea, or spreading calories over the coming week. */
export type Suggestion =
  | Extract<ChatAction, { type: 'plan' } | { type: 'targets' }>
  | { type: 'move'; title: string; from: number; to: number; workout: string }
  | { type: 'reminder'; title: string; kind: ReminderKind; time: string }
  | { type: 'meal'; title: string; name: string; kcal: number; protein: number; carbs: number; fat: number }
  | { type: 'balance'; title: string; kcal: number; from: number[]; to: number[] };
export type ReminderKind = 'sleep' | 'workout' | 'water' | 'checkin' | 'food';
export const REMINDER_KINDS: ReminderKind[] = ['sleep', 'workout', 'water', 'checkin', 'food'];
/** Each reminder's name, as on the Notifications screen. */
export const REMINDER_NAME = { sleep: 'Bedtime', workout: 'Workouts', water: 'Water', checkin: 'Daily check-in', food: 'Meals and food' } as const;
/** At most this many suggestions are shown. */
export const MAX_SUGGESTIONS = 3;
export type RecapNote = { title: string; detail: string };
/** What the AI wrote for the week (kept, so it's written once). */
export type RecapAI = { headline: string; wins: string[]; problems: RecapNote[]; tips: RecapNote[]; suggest: Suggestion[] };
export type RecapRow = { week_start: string; lang: 'en' | 'ar'; ai: RecapAI | null; applied: number[] | null; seen_at: string };

/** Last week: Sunday to Saturday before this one. */
export function recapWeek(today: string) {
  const start = addDays(weekStart(today), -7);
  return { start, end: addDays(start, 6) };
}

/** A recap needs a whole week in the app: you joined on or before that week's Sunday. */
export const hasRecap = (joinedAt: string | undefined, start: string) => {
  const joined = (joinedAt ?? '').slice(0, 10);
  return !!joined && joined <= start;
};

/** The Sunday your first recap is ready: the first Sunday after the week you joined. */
export const firstRecapDay = (joinedAt: string) => addDays(weekStart(joinedAt.slice(0, 10)), 7);

export type Goal = { key: 'train' | 'food' | 'protein' | 'water' | 'sleep' | 'weight'; ok: boolean; done: string; target: string };

/**
 * The week's goals, only the ones there's data for (at least 3 days logged): workouts as planned; calories, protein and water
 * on target on 70% of the days; sleep 7 h or more on average; and weight moving the way the goal wants
 * (a cut goes down, a bulk up 0.1 to 0.8 kg, maintain within 0.6 kg).
 */
export function recapGoals(s: ReportStats, goal: number, hasPlan: boolean): Goal[] {
  const out: Goal[] = [];
  if (hasPlan && s.workouts.planned > 0) out.push({ key: 'train', ok: s.workouts.asPlanned >= s.workouts.planned, done: String(s.workouts.asPlanned), target: String(s.workouts.planned) });
  const [calHit, calDays] = s.calDays;
  if (calDays >= 3) out.push({ key: 'food', ok: calHit >= Math.ceil(calDays * 0.7), done: String(calHit), target: String(calDays) });
  const [pHit, pDays] = s.proteinDays;
  if (pDays >= 3) out.push({ key: 'protein', ok: pHit >= Math.ceil(pDays * 0.7), done: String(pHit), target: String(pDays) });
  const [wHit, wDays] = s.waterDays;
  if (wDays >= 3) out.push({ key: 'water', ok: wHit >= Math.ceil(wDays * 0.7), done: String(wHit), target: String(wDays) });
  if (s.sleepAvg != null && s.sleepNights >= 3) out.push({ key: 'sleep', ok: s.sleepAvg >= 7, done: String(s.sleepAvg), target: '7' });
  if (s.weight && s.weight.series.length >= 2) {
    const d = s.weight.change;
    const ok = goal >= 3 ? d <= -0.1 : goal <= 1 ? d >= 0.1 && d <= 0.8 : Math.abs(d) <= 0.6;
    out.push({ key: 'weight', ok, done: `${d > 0 ? '+' : ''}${d}`, target: goal >= 3 ? '−' : goal <= 1 ? '+' : '±' });
  }
  return out;
}

/** Each day of the week: trained, a planned workout missed, or a rest day. */
export function recapDays(plan: TrainPlan | null, logs: WorkoutLog[], start: string): ('ok' | 'miss' | 'rest')[] {
  const done = new Set(logs.map((l) => l.day));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    if (done.has(d)) return 'ok';
    return plan && plannedOn(plan, d) ? 'miss' : 'rest';
  });
}

/** Due: a whole week after you joined, with something logged that week, and not shown yet (on any phone). */
export async function recapRow(start: string): Promise<RecapRow | null> {
  const { data } = await supabase.from('weekly_recaps').select('week_start,lang,ai,applied,seen_at').eq('week_start', start).maybeSingle();
  return (data as RecapRow | null) ?? null;
}

export async function markRecapSeen(start: string, lang: 'en' | 'ar') {
  await supabase.from('weekly_recaps').upsert({ week_start: start, lang, seen_at: new Date().toISOString() }, { onConflict: 'user_id,week_start', ignoreDuplicates: true });
}

export async function saveRecap(start: string, patch: Partial<Pick<RecapRow, 'ai' | 'applied' | 'lang'>>) {
  await supabase.from('weekly_recaps').upsert({ week_start: start, ...patch }, { onConflict: 'user_id,week_start' });
}

/** Ask the AI for the week's story. Suggestions are checked against the plan (real workouts, real exercises, injury-safe). */
export async function writeRecap(
  x: {
    stats: ReportStats;
    before: ReportStats | null;
    goals: Goal[];
    plan: TrainPlan | null;
    goal: string;
    targets: { kcal: number; protein: number; water: number } | null;
    coachFood: boolean;
    lang: 'en' | 'ar';
    /** Each day of the week: food, water, training, sleep and how you felt. */
    days?: Record<string, unknown>[];
    /** Which reminders are on, and when. */
    reminders?: Record<string, unknown>;
    savedMeals?: string[];
    /** Food allergies: meal ideas never contain them. */
    allergies?: string[];
    allergyNote?: string;
  },
): Promise<RecapAI | null> {
  const p = x.plan;
  const name = (id: string, n?: string) => exInfo({ id, n }, 'en').name;
  const data = {
    goal: x.goal,
    allHit: x.goals.length > 0 && x.goals.every((g) => g.ok),
    goals: x.goals,
    week: x.stats,
    weekBefore: x.before ? { workouts: x.before.workouts, volume: x.before.volume, caloriesAvg: x.before.caloriesAvg, sleepAvg: x.before.sleepAvg, weight: x.before.weight ? { change: x.before.weight.change } : null } : null,
    foodTargets: x.targets,
    coachManagesFood: x.coachFood,
    plan: p ? Object.fromEntries(Object.entries(p.workouts).map(([w, v]) => [w, v.ex.map((e) => ({ id: e.id, name: name(e.id, e.n), sets: e.sets, reps: e.reps }))])) : null,
    trainingDays: p ? p.week.map((d) => d.w ?? 'rest') : null,
    days: x.days ?? [],
    reminders: x.reminders ?? null,
    savedMeals: x.savedMeals ?? [],
    foodAllergies: allergiesText(x.allergies, x.allergyNote) || 'none',
    level: p?.level ?? null,
    injuries: p?.injuries ?? [],
    exercises: p && !p.coach ? Object.values(EX).filter((e) => !(e.stress ?? []).some((s) => p.injuries.includes(s))).map((e) => ({ id: e.id, name: e.en, muscle: e.m })) : [],
  };
  const { result } = await askAI<{ headline?: string; wins?: unknown[]; problems?: unknown[]; tips?: unknown[]; suggest?: unknown[] }>('recap', { data, lang: x.lang });
  if (!result) return null;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const notes = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : [])
      .map((n) => ({ title: str((n as RecapNote)?.title, 80), detail: str((n as RecapNote)?.detail, 240) }))
      .filter((n) => n.title)
      .slice(0, max);
  // Each suggestion checked on its own; the first 3 that make sense are kept.
  const t = x.targets;
  const cut = /cut/.test(x.goal);
  const bulk = /bulk/.test(x.goal);
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
  const day = (v: unknown) => (Number.isInteger(num(v)) && num(v) >= 0 && num(v) <= 6 ? num(v) : null);
  const days = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(day).filter((d): d is number => d != null))];
  const suggest: Suggestion[] = [];
  for (const r of (Array.isArray(result.suggest) ? result.suggest : []).slice(0, 8) as Record<string, unknown>[]) {
    if (suggest.length >= MAX_SUGGESTIONS || !r || typeof r !== 'object') continue;
    const title = str(r.title, 160);
    if (r.type === 'plan' || r.type === 'targets') {
      // A coach's plan or targets are the coach's: no changes suggested there.
      if ((r.type === 'plan' && p?.coach) || (r.type === 'targets' && x.coachFood)) continue;
      const [sg] = (await prepareSuggestions([r], p)) as Suggestion[];
      if (!sg) continue;
      if (sg.type === 'targets') {
        // At most 200 kcal away, only the way the goal goes (a cut never gets more, a bulk never less), and only what changes.
        if (!t) continue;
        const o = { ...sg };
        if (o.kcal != null && (Math.abs(o.kcal - t.kcal) > 200 || Math.abs(o.kcal - t.kcal) < 50 || (cut && o.kcal > t.kcal) || (bulk && o.kcal < t.kcal))) delete o.kcal;
        if (o.protein != null && Math.abs(o.protein - t.protein) < 5) delete o.protein;
        if (o.water != null && Math.abs(o.water - t.water) < 100) delete o.water;
        if (o.kcal || o.protein || o.water) suggest.push(o);
      } else suggest.push(sg);
    } else if (r.type === 'move') {
      // From a training day to a rest day of your own plan.
      const from = day(r.from);
      const to = day(r.to);
      if (!p || p.coach || from == null || to == null || from === to || !p.week[from]?.w || p.week[to]?.w) continue;
      suggest.push({ type: 'move', title, from, to, workout: p.week[from].w as string });
    } else if (r.type === 'reminder') {
      const kind = REMINDER_KINDS.find((k) => k === r.kind);
      const time = str(r.time, 5);
      if (!kind || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
      suggest.push({ type: 'reminder', title, kind, time });
    } else if (r.type === 'meal') {
      const name = str(r.name, 80);
      const g = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round(num(v) || 0)));
      if (!name || !(num(r.kcal) > 0) || (x.savedMeals ?? []).includes(name) || allergensIn([name, title], x.allergies).length) continue;
      suggest.push({ type: 'meal', title, name, kcal: g(r.kcal, 2500), protein: g(r.protein, 200), carbs: g(r.carbs, 400), fat: g(r.fat, 200) });
    } else if (r.type === 'balance') {
      const kcal = Math.round(num(r.kcal) / 10) * 10;
      const from = days(r.from);
      const to = days(r.to).filter((d) => !from.includes(d));
      if (x.coachFood || !(kcal >= 100 && kcal <= 300) || !from.length || !to.length) continue;
      suggest.push({ type: 'balance', title, kcal, from, to });
    }
  }
  return {
    headline: str(result.headline, 80),
    wins: (Array.isArray(result.wins) ? result.wins : []).map((w) => str(w, 200)).filter(Boolean).slice(0, 3),
    problems: notes(result.problems, 3),
    tips: notes(result.tips, 3),
    suggest,
  };
}
