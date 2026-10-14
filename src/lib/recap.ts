// The weekly recap: a story about last week (Sunday to Saturday), shown on the first open of a new week.
import { askAI } from './ai';
import type { ChatAction } from './coach';
import { prepareSuggestions } from './coachPlan';
import { addDays } from './nutrition';
import type { ReportStats } from './report';
import { supabase } from './supabase';
import type { WorkoutLog } from './train';
import { EX, exInfo, plannedOn, type TrainPlan, weekStart } from './training';

export type Suggestion = Extract<ChatAction, { type: 'plan' } | { type: 'targets' }>;
export type RecapNote = { title: string; detail: string };
/** What the AI wrote for the week (kept, so it's written once). */
export type RecapAI = { headline: string; wins: string[]; problems: RecapNote[]; tips: RecapNote[]; suggest: Suggestion[] };
export type RecapRow = { week_start: string; lang: 'en' | 'ar'; ai: RecapAI | null; applied: number[] | null; seen_at: string };

/** Last week: Sunday to Saturday before this one. */
export function recapWeek(today: string) {
  const start = addDays(weekStart(today), -7);
  return { start, end: addDays(start, 6) };
}

export type Goal = { key: 'train' | 'food' | 'weight'; ok: boolean; done: string; target: string };

/**
 * The week's goals, only the ones there's data for: workouts as planned, calories on target on 5 of 7 days,
 * and weight moving the way the goal wants (a cut goes down, a bulk up 0.1 to 0.8 kg, maintain within 0.6 kg).
 */
export function recapGoals(s: ReportStats, goal: number, hasPlan: boolean): Goal[] {
  const out: Goal[] = [];
  if (hasPlan && s.workouts.planned > 0) out.push({ key: 'train', ok: s.workouts.asPlanned >= s.workouts.planned, done: String(s.workouts.asPlanned), target: String(s.workouts.planned) });
  const [calHit, calDays] = s.calDays;
  if (calDays >= 3) out.push({ key: 'food', ok: calHit >= Math.ceil(calDays * 0.7), done: String(calHit), target: String(calDays) });
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
  x: { stats: ReportStats; before: ReportStats | null; goals: Goal[]; plan: TrainPlan | null; goal: string; targets: { kcal: number; protein: number; water: number } | null; coachFood: boolean; lang: 'en' | 'ar' },
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
  // A coach's plan or targets are the coach's: no changes suggested there.
  const raw = (Array.isArray(result.suggest) ? result.suggest : []).filter((s) => !((s as { type?: string })?.type === 'plan' && p?.coach) && !((s as { type?: string })?.type === 'targets' && x.coachFood));
  // Food targets: at most 200 kcal away, only the way the goal goes (a cut never gets more, a bulk never less), and only what changes.
  const t = x.targets;
  const cut = /cut/.test(x.goal);
  const bulk = /bulk/.test(x.goal);
  const suggest = ((await prepareSuggestions(raw, p)) as Suggestion[])
    .map((sg) => {
      if (sg.type !== 'targets' || !t) return sg;
      const out = { ...sg };
      if (out.kcal != null && (Math.abs(out.kcal - t.kcal) > 200 || Math.abs(out.kcal - t.kcal) < 50 || (cut && out.kcal > t.kcal) || (bulk && out.kcal < t.kcal))) delete out.kcal;
      if (out.protein != null && Math.abs(out.protein - t.protein) < 5) delete out.protein;
      if (out.water != null && Math.abs(out.water - t.water) < 100) delete out.water;
      return out.kcal || out.protein || out.water ? out : null;
    })
    .filter((sg): sg is Suggestion => !!sg);
  return {
    headline: str(result.headline, 80),
    wins: (Array.isArray(result.wins) ? result.wins : []).map((w) => str(w, 200)).filter(Boolean).slice(0, 3),
    problems: notes(result.problems, 3),
    tips: notes(result.tips, 3),
    suggest,
  };
}
