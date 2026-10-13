// Suggestions from the AI coach that change your plan: checked and made concrete here, applied only when you tap Apply.
import type { ChatAction, PlanChange } from './coach';
import { searchExercises, toPlanEx } from './exercisesDb';
import type { FoodPlan } from './nutrition';
import { EX, exInfo, type TrainPlan, weekStart } from './training';

type Suggestion = Extract<ChatAction, { type: 'plan' } | { type: 'targets' }>;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
const str = (v: unknown, n = 80) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const REPS = /^\d{1,3}(\s*[–-]\s*\d{1,3})?$/;

/** Does this exercise strain one of the injuries? Common exercises have a stress list (EX[...].stress, the same check
 * Train together uses). Others from the full list borrow it from the common exercise they match by id or by name
 * ("Seated overhead press" counts as Overhead press). */
export function strainsInjury(e: { id: string; name_en?: string }, injuries: string[]) {
  if (!injuries.length) return false;
  const name = (e.name_en ?? '').toLowerCase();
  const like = EX[e.id] ? [EX[e.id]] : Object.values(EX).filter((x) => x.fedb === e.id || (!!name && name.includes(x.en.toLowerCase())));
  return like.some((x) => x.stress?.some((s) => injuries.includes(s)));
}

/** Keep only suggestions that make sense for this plan, and look up the exercises they name. */
export async function prepareSuggestions(raw: unknown, plan: TrainPlan | null): Promise<Suggestion[]> {
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
    if (x?.type !== 'plan' || !plan || !Array.isArray(x.changes)) continue;
    const changes: PlanChange[] = [];
    for (const c of x.changes.slice(0, 8) as Record<string, unknown>[]) {
      const workout = str(c?.workout, 40) || 'all';
      if (c?.op === 'deload') changes.push({ op: 'deload' });
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
  const each = (w: string, fn: (ex: TrainPlan['workouts'][string]['ex']) => TrainPlan['workouts'][string]['ex']) => {
    for (const k of w === 'all' ? Object.keys(workouts) : [w]) if (workouts[k]) workouts[k].ex = fn(workouts[k].ex);
  };
  // Checked again here: a suggestion saved in an older chat may predate the injury check.
  const unsafe = (c: PlanChange) => (c.op === 'swap' || c.op === 'add') && !!c.toEx && strainsInjury({ id: c.toEx.id, name_en: c.toEx.n }, plan.injuries ?? []);
  for (const c of changes) {
    if (unsafe(c)) continue;
    if (c.op === 'deload') deload = weekStart(today);
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
  return { ...plan, workouts, deload, light, lightAsked };
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
