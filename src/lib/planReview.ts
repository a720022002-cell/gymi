// The weekly plan check: the AI reads how your last weeks went and changes the plan only where the results say so.
import { askAI } from './ai';
import { loadDeviceBrief } from './devices';
import type { PlanChange } from './coach';
import { applyPlanChanges, prepareSuggestions } from './coachPlan';
import type { Checkin } from './health';
import { addDays } from './nutrition';
import type { WorkoutLog } from './train';
import { EX, exInfo, type TrainPlan, weekStart } from './training';

/** A week after the plan was made or last checked, with at least 3 workouts done since. Never for a coach's plan. */
export function reviewDue(plan: TrainPlan | null, logs: WorkoutLog[], today: string) {
  if (!plan || plan.coach || !Object.keys(plan.workouts).length) return false;
  const from = plan.reviewedAt ?? plan.since;
  if (!from || from > addDays(today, -7)) return false;
  return logs.filter((l) => l.day > from).length >= 3;
}

/** What the AI needs, kept small: the plan, each exercise's best set per session, how many planned workouts you did, recovery. */
function reviewData(plan: TrainPlan, logs: WorkoutLog[], checkins: Checkin[], today: string, goal: string) {
  const start = addDays(today, -35) > (plan.since ?? '') ? addDays(today, -35) : (plan.since ?? addDays(today, -35));
  const recent = logs.filter((l) => l.day >= start).sort((a, b) => a.day.localeCompare(b.day));
  const name = (id: string, n?: string) => exInfo({ id, n }, 'en').name;
  const history: Record<string, { name: string; sessions: string[] }> = {};
  for (const l of recent)
    for (const x of l.exercises ?? []) {
      if (!x.sets?.length) continue;
      const best = x.sets.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a));
      const h = (history[x.id] ??= { name: name(x.id, x.n), sessions: [] });
      h.sessions.push(`${l.day}: ${best.w ? `${best.w} kg × ${best.r}` : `${best.r} reps`}, ${x.sets.length} sets`);
    }
  for (const h of Object.values(history)) h.sessions = h.sessions.slice(-6);
  const weeks = Math.max(1, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / (7 * 864e5)));
  const planned = plan.week.filter((d) => d.w).length * weeks;
  const ci = checkins.filter((c) => c.day >= addDays(today, -14));
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => typeof x === 'number');
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  return {
    goal,
    level: plan.level ?? 'Intermediate',
    injuries: plan.injuries,
    weeksOnPlan: weeks,
    deloadThisWeek: plan.deload === weekStart(today) ? true : undefined,
    plan: Object.fromEntries(Object.entries(plan.workouts).map(([w, v]) => [w, v.ex.map((x) => ({ id: x.id, name: name(x.id, x.n), sets: x.sets, reps: x.reps }))])),
    history,
    adherence: { done: recent.length, planned },
    recoveryAvg: avg(ci.map((c) => c.score)),
    sleepAvgH: avg(ci.map((c) => c.sleep_h)),
    exercises: Object.values(EX)
      .filter((e) => !(e.stress ?? []).some((s) => plan.injuries.includes(s)))
      .map((e) => ({ id: e.id, name: e.en, muscle: e.m, equipment: e.t })),
  };
}

let running = false;

/** Run the check and apply what it changes. Returns the updated plan (with the review to show), or null if it didn't run. */
/** What the weekly check may change (Undo puts these back). */
const REVIEW_OPS: PlanChange['op'][] = ['sets', 'reps', 'swap', 'remove', 'add', 'deload', 'light'];

/**
 * The weekly AI check. It takes a while, so it hands back how to change the plan, and that change is made on the newest
 * plan when it's saved (anything you changed meanwhile stays). Only training changes, never your days or breaks.
 */
export async function runReview(plan: TrainPlan, logs: WorkoutLog[], checkins: Checkin[], today: string, goal: string, lang: 'en' | 'ar'): Promise<((cur: TrainPlan) => TrainPlan) | null> {
  if (running) return null;
  running = true;
  try {
    const { result } = await askAI<{ summary: string; changes: Record<string, unknown>[] }>('plan_review', { data: { ...reviewData(plan, logs, checkins, today, goal), devices: await loadDeviceBrief() }, lang });
    if (!result) return null;
    const summary = String(result.summary ?? '').slice(0, 400);
    const [sug] = await prepareSuggestions([{ type: 'plan', title: summary, changes: (result.changes ?? []).slice(0, 4) }], plan);
    const changes = (sug?.type === 'plan' ? sug.changes : []).filter((c) => REVIEW_OPS.includes(c.op));
    return (cur) => {
      const next = changes.length ? applyPlanChanges(cur, changes, today) : cur;
      return { ...next, reviewedAt: today, review: { at: today, summary, changes, prev: { workouts: cur.workouts, deload: cur.deload, light: cur.light } } };
    };
  } finally {
    running = false;
  }
}
