// Suggestions from the AI coach that change your plan: checked and made concrete here, applied only when you tap Apply.
import type { ChatAction, PlanChange } from './coach';
import { searchExercises, toPlanEx } from './exercisesDb';
import { addDays, type FoodPlan } from './nutrition';
import { REMINDER_KINDS } from './recap';
import { DAYS_LONG, EX, exInfo, type TrainPlan, weekOrder, weekStart } from './training';

type Suggestion = Extract<ChatAction, { type: 'plan' } | { type: 'targets' } | { type: 'reminder' }>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A break is at most 4 weeks. */
const MAX_REST = 28;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
const str = (v: unknown, n = 80) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const REPS = /^\d{1,3}(\s*[–-]\s*\d{1,3})?$/;

/** Does this exercise strain one of the injuries? Common exercises have a stress list (EX[...].stress, the same check
 * Train together uses). Others from the full list borrow it from the common exercise they match by id or by name
 * ("Seated overhead press" counts as Overhead press). */
export function strainsInjury(e: { id: string; name_en?: string }, injuries: string[]) {
  return injuriesStrained(e, injuries).length > 0;
}

/** Which of your injuries an exercise loads (from the matching exercise in our own list). */
export function injuriesStrained(e: { id: string; name_en?: string }, injuries: string[]) {
  if (!injuries.length) return [];
  const name = (e.name_en ?? '').toLowerCase();
  const like = EX[e.id] ? [EX[e.id]] : Object.values(EX).filter((x) => x.fedb === e.id || (!!name && name.includes(x.en.toLowerCase())));
  return injuries.filter((i) => like.some((x) => x.stress?.includes(i)));
}

/** Keep only suggestions that make sense for this plan, and look up the exercises they name. */
export async function prepareSuggestions(raw: unknown, plan: TrainPlan | null, today?: string): Promise<Suggestion[]> {
  if (!Array.isArray(raw)) return [];
  const out: Suggestion[] = [];
  const names = plan ? Object.keys(plan.workouts) : [];
  const okWorkout = (w: string) => w === 'all' || names.includes(w);
  const inWorkout = (w: string, id: string) => (w === 'all' ? names.some((n) => plan?.workouts[n].ex.some((y) => y.id === id)) : !!plan?.workouts[w]?.ex.some((y) => y.id === id));
  for (const s of raw.slice(0, 3)) {
    const x = s as Record<string, unknown>;
    const title = str(x?.title, 160);
    if (x?.type === 'targets') {
      const kcal = num(x.kcal), protein = num(x.protein), water = num(x.water);
      const t: Suggestion = { type: 'targets', title };
      if (kcal >= 1200 && kcal <= 5000) t.kcal = Math.round(kcal / 10) * 10;
      if (protein >= 40 && protein <= 300) t.protein = Math.round(protein);
      if (water >= 1000 && water <= 6000) t.water = Math.round(water / 100) * 100;
      if (t.kcal || t.protein || t.water) out.push(t);
      continue;
    }
    if (x?.type === 'reminder') {
      const kind = REMINDER_KINDS.find((k) => k === x.kind);
      const time = str(x.time, 5);
      if (kind && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) out.push({ type: 'reminder', title, kind, time });
      continue;
    }
    if (x?.type !== 'plan' || !plan || !Array.isArray(x.changes)) continue;
    const changes: PlanChange[] = [];
    for (const c of x.changes.slice(0, 8) as Record<string, unknown>[]) {
      const workout = str(c?.workout, 40) || 'all';
      if (c?.op === 'rest') {
        // Today or later, at most 4 weeks.
        let from = str(c.from, 10);
        let to = str(c.to, 10) || from;
        if (!DATE.test(from) || !DATE.test(to)) continue;
        if (today && from < today) from = today;
        if (to < from) continue;
        if (to > addDays(from, MAX_REST - 1)) to = addDays(from, MAX_REST - 1);
        changes.push({ op: 'rest', from, to });
      } else if (c?.op === 'resume') changes.push({ op: 'resume' });
      else if (c?.op === 'days' && Array.isArray(c.week) && c.week.length === 7) {
        // Each weekday is a workout from the plan or a rest day, and every workout stays in the week.
        const week = (c.week as unknown[]).map((w) => (typeof w === 'string' && names.includes(w) ? w : null));
        if (!week.some(Boolean) || plan.week.every((d, i) => (d.w ?? null) === week[i])) continue;
        changes.push({ op: 'days', week });
      } else if (c?.op === 'deload') changes.push({ op: 'deload' });
      else if (c?.op === 'light') changes.push({ op: 'light' });
      else if (c?.op === 'sets' && okWorkout(workout) && [-2, -1, 1, 2].includes(Math.round(num(c.delta)))) changes.push({ op: 'sets', workout, delta: Math.round(num(c.delta)) });
      else if (c?.op === 'reps' && okWorkout(workout) && REPS.test(str(c.reps, 9))) changes.push({ op: 'reps', workout, reps: str(c.reps, 9).replace('-', '–').replace(/\s/g, '') });
      else if (c?.op === 'remove' && workout !== 'all' && inWorkout(workout, str(c.ex))) changes.push({ op: 'remove', workout, ex: str(c.ex) });
      else if ((c?.op === 'swap' || c?.op === 'add') && workout !== 'all' && okWorkout(workout)) {
        const words = str(c.op === 'swap' ? c.to : c.search, 60);
        if (!words) continue;
        if (c.op === 'swap' && !inWorkout(workout, str(c.from))) continue;
        const have = plan.workouts[workout].ex.map((y) => y.id);
        // Never swap in or add an exercise that strains an injury in the plan: the first safe hit, or no change at all.
        const found = (await searchExercises(words, null, null, 8)).find((e) => !have.includes(e.id) && !strainsInjury(e, plan.injuries ?? []));
        if (!found) continue;
        const toEx = toPlanEx(found);
        if (c.op === 'swap') changes.push({ op: 'swap', workout, from: str(c.from), to: words, toEx });
        else changes.push({ op: 'add', workout, search: words, sets: Math.min(5, Math.max(1, Math.round(num(c.sets)) || 3)), reps: REPS.test(str(c.reps, 9)) ? str(c.reps, 9).replace('-', '–') : toEx.reps, toEx });
      }
    }
    if (changes.length) out.push({ type: 'plan', title, changes });
  }
  return out;
}

/** The plan with the changes made. */
export function applyPlanChanges(plan: TrainPlan, changes: PlanChange[], today: string): TrainPlan {
  const workouts = Object.fromEntries(Object.entries(plan.workouts).map(([k, w]) => [k, { ...w, ex: [...w.ex] }]));
  let deload = plan.deload;
  let light = plan.light;
  let lightAsked = plan.lightAsked;
  let skipped = plan.skipped;
  let week = plan.week;
  let override = plan.override;
  let weekSince = plan.weekSince;
  const each = (w: string, fn: (ex: TrainPlan['workouts'][string]['ex']) => TrainPlan['workouts'][string]['ex']) => {
    for (const k of w === 'all' ? Object.keys(workouts) : [w]) if (workouts[k]) workouts[k].ex = fn(workouts[k].ex);
  };
  // Checked again here: a suggestion saved in an older chat may predate the injury check.
  const unsafe = (c: PlanChange) => (c.op === 'swap' || c.op === 'add') && !!c.toEx && strainsInjury({ id: c.toEx.id, name_en: c.toEx.n }, plan.injuries ?? []);
  for (const c of changes) {
    if (unsafe(c)) continue;
    if (c.op === 'rest') {
      skipped = { ...skipped };
      for (let d = c.from < today ? today : c.from; d <= c.to; d = addDays(d, 1)) skipped[d] = true;
    } else if (c.op === 'resume') skipped = Object.fromEntries(Object.entries(skipped).filter(([d]) => d < today));
    else if (c.op === 'days') {
      // For good, from this week on (this week's own moves are dropped).
      week = week.map((d, i) => ({ ...d, w: c.week[i] ?? null }));
      override = undefined;
      weekSince = today;
    } else if (c.op === 'deload') deload = weekStart(today);
    else if (c.op === 'light') {
      light = today;
      lightAsked = today;
    }
    else if (c.op === 'sets') each(c.workout, (ex) => ex.map((y) => ({ ...y, sets: Math.min(6, Math.max(1, y.sets + c.delta)) })));
    else if (c.op === 'reps') each(c.workout, (ex) => ex.map((y) => ({ ...y, reps: c.reps })));
    else if (c.op === 'remove') each(c.workout, (ex) => (ex.length > 1 ? ex.filter((y) => y.id !== c.ex) : ex));
    else if (c.op === 'swap' && c.toEx) each(c.workout, (ex) => ex.map((y) => (y.id === c.from ? { ...c.toEx!, sets: y.sets, reps: y.reps } : y)));
    else if (c.op === 'add' && c.toEx) each(c.workout, (ex) => [...ex, { ...c.toEx!, sets: c.sets, reps: c.reps }]);
  }
  return { ...plan, workouts, deload, light, lightAsked, skipped, week, override, weekSince, days: week.filter((d) => d.w).length, queue: weekOrder(week) };
}

/** The food plan with new calorie, protein or water goals. */
export function applyTargets(plan: FoodPlan, s: Extract<ChatAction, { type: 'targets' }>): FoodPlan {
  return {
    ...plan,
    ...(s.kcal ? { kcal: s.kcal, carbG: null } : {}),
    ...(s.protein && plan.weight ? { perKg: Math.round((s.protein / plan.weight) * 100) / 100 } : {}),
    ...(s.water ? { water: s.water } : {}),
  };
}

/** One line per change, for the suggestion card. */
export function changeLine(c: PlanChange, plan: TrainPlan | null, lang: 'en' | 'ar', t: (s: string, v?: Record<string, string | number>) => string) {
  const w = (name: string) => (name === 'all' ? t('All workouts') : t(name));
  const exName = (id: string) => {
    for (const k of Object.keys(plan?.workouts ?? {})) {
      const y = plan?.workouts[k].ex.find((e) => e.id === id);
      if (y) return exInfo(y, lang).name;
    }
    return exInfo({ id }, lang).name;
  };
  if (c.op === 'rest') {
    const f = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const d = (x: string) => f.format(new Date(`${x}T12:00:00`));
    return c.from === c.to ? t('No workout on {a}', { a: d(c.from) }) : t('No workouts from {a} to {b}', { a: d(c.from), b: d(c.to) });
  }
  if (c.op === 'resume') return t('Workouts back on from today');
  if (c.op === 'days')
    return t('Your week: {x}', {
      x: c.week
        .map((w, i) => (w ? `${t(DAYS_LONG[i])} ${t(w)}` : null))
        .filter(Boolean)
        .join(' · '),
    });
  if (c.op === 'deload') return t('This week: lighter weights and fewer sets (deload)');
  if (c.op === 'light') return t('Today: one set less and about 10% less weight');
  if (c.op === 'sets')
    return Math.abs(c.delta) === 1
      ? t(c.delta > 0 ? '{w}: one more set per exercise' : '{w}: one set less per exercise', { w: w(c.workout) })
      : t(c.delta > 0 ? '{w}: {n} more sets per exercise' : '{w}: {n} fewer sets per exercise', { w: w(c.workout), n: Math.abs(c.delta) });
  if (c.op === 'reps') return t('{w}: {r} reps', { w: w(c.workout), r: c.reps });
  if (c.op === 'remove') return t('{w}: remove {x}', { w: w(c.workout), x: exName(c.ex) });
  if (c.op === 'swap') return t('{w}: {a} → {b}', { w: w(c.workout), a: exName(c.from), b: c.toEx ? exInfo(c.toEx, lang).name : c.to });
  return t('{w}: add {x}, {s} × {r}', { w: w(c.workout), x: c.toEx ? exInfo(c.toEx, lang).name : c.search, s: c.sets, r: c.reps });
}

/**
 * What Undo puts back for a set of changes: only the parts they touched (the workouts they changed, the lighter day,
 * the break days, the week's layout), taken from the plan before. Anything else you changed since stays.
 */
export function undoPatch(prev: TrainPlan, changes: PlanChange[]): Partial<TrainPlan> {
  const patch: Partial<TrainPlan> = {};
  const names = new Set<string>();
  for (const c of changes) {
    if ('workout' in c) (c.workout === 'all' ? Object.keys(prev.workouts) : [c.workout]).forEach((w) => names.add(w));
    if (c.op === 'deload') patch.deload = prev.deload;
    if (c.op === 'light') Object.assign(patch, { light: prev.light, lightAsked: prev.lightAsked });
    if (c.op === 'rest' || c.op === 'resume') patch.skipped = prev.skipped;
    if (c.op === 'days') Object.assign(patch, { week: prev.week, override: prev.override, overrides: prev.overrides, weekSince: prev.weekSince, days: prev.days, queue: prev.queue });
  }
  if (names.size) patch.workouts = Object.fromEntries([...names].filter((w) => prev.workouts[w]).map((w) => [w, prev.workouts[w]]));
  return patch;
}

/** The plan with an Undo patch put back (a workout renamed or removed since is left as it is). */
export function applyUndo(cur: TrainPlan, patch: Partial<TrainPlan>): TrainPlan {
  const workouts = patch.workouts
    ? { ...cur.workouts, ...Object.fromEntries(Object.entries(patch.workouts).filter(([w]) => cur.workouts[w])) }
    : cur.workouts;
  return { ...cur, ...patch, workouts };
}

/** Older suggestions kept the whole plan for Undo (newer ones keep only what changed). */
export const isWholePlan = (p: unknown): p is TrainPlan => !!p && typeof p === 'object' && 'week' in p && 'workouts' in p && 'injuries' in p;
