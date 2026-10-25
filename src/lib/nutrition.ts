// Calorie math, copied from the design file (docs/index.html: bmr, calcPlan, targets).
import type { AiRecipes } from './aiRecipes';
import { allergensIn, noteHit } from './allergies';
import { addMin, fastTimes } from './prayer';
import { MEAL_WEIGHT, type Recipe, RECIPES } from './recipes';

export const GOALS = ['Fast bulk', 'Moderate bulk', 'Maintain', 'Fast cut', 'Moderate cut'] as const;
// Gain and loss mirror each other: the same range and the same daily calorie change, up or down.
export const GOAL_DESC = ['+0.5 to 0.75 kg a week', '+0.25 to 0.5 kg a week', 'Keep your weight', '−0.5 to 0.75 kg a week', '−0.25 to 0.5 kg a week'];
const GOAL_ADJ = [650, 350, 0, -650, -350];
// Order the goals are shown in: bulk, bulk, maintain, moderate cut, fast cut.
export const GOAL_ORDER = [0, 1, 2, 4, 3];

export const ACTIVITY: [string, string][] = [
  ['Mostly sitting', 'Under 5,000 steps a day · 0–1 workouts a week'],
  ['Lightly active', '5,000–7,500 steps a day · 1–3 workouts a week'],
  ['Active', '7,500–10,000 steps a day · 3–5 workouts a week'],
  ['Very active', 'Over 10,000 steps a day · 6–7 workouts a week'],
];
const ACT_FACTOR = [1.25, 1.4, 1.55, 1.75];

/** Ramadan mode is hidden until it's ready for launch: no switch, no Ramadan meals or cards. Turn on to bring it back. */
export const RAMADAN_LIVE = false;

// Ramadan (month 9 of the Umm al-Qura calendar), for when the phone can't tell: about the first and last day.
const RAMADAN_FALLBACK: [string, string][] = [
  ['2027-02-08', '2027-03-08'],
  ['2028-01-28', '2028-02-25'],
  ['2029-01-16', '2029-02-13'],
  ['2030-01-05', '2030-02-03'],
  ['2030-12-26', '2030-12-31'],
];

/** Is this day ("YYYY-MM-DD") in Ramadan? From the phone's Umm al-Qura calendar, or a short table when it has none. */
let hijri: Intl.DateTimeFormat | null | undefined;
export function isRamadan(day = localDay()) {
  if (hijri === undefined) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', timeZone: 'UTC' });
      // A phone without the Islamic calendar quietly uses the normal one (September would look like Ramadan).
      hijri = f.resolvedOptions().calendar?.startsWith('islamic') ? f : null;
    } catch {
      hijri = null;
    }
  }
  if (hijri) return Number(hijri.format(new Date(`${day}T12:00:00Z`)).replace(/\D/g, '')) === 9;
  return RAMADAN_FALLBACK.some(([a, b]) => day >= a && day <= b);
}

/** Ramadan meals are used on this day: you turned Ramadan mode on, and it's Ramadan. */
export const ramadanOn = (f: Pick<FoodPlan, 'ramadan'>, day = localDay()) => RAMADAN_LIVE && !!f.ramadan && isRamadan(day);

/** `id`: stays the same when other meals are removed, so picks, swapped recipes and logs stay with the right meal. */
export type Meal = { n: string; t: string; type?: string; id?: number };
export type Work = { s: string; e: string };

export type FoodPlan = {
  weight: number;
  activity: number;
  goal: number;
  bf: number;
  work: Work[];
  rotate?: boolean;
  sun: boolean;
  noWork?: boolean;
  notes: string;
  kcal: number;
  perKg: number;
  carbG: number | null;
  fatG: number | null;
  water: number;
  meals: Meal[];
  workoutTime: string;
  myWorkoutTime?: string | null;
  intensity: string;
  /** Which recipe is shown for each meal slot on a day (`day:key`, changes with "Change meal"). Keys without a day are from before and count for every day. */
  picks?: Record<string, number>;
  /** Recipes changed by swapping an ingredient (or made from your ingredients), per meal slot on a day (`day:key`; older ones without a day count for every day). */
  custom?: Record<string, CustomRecipe>;
  /** `lock`: you started buying a week's or a month's list, so meals (and the list) stay the same from `from` to `to`. */
  shop?: { checked: Record<string, boolean>; extra: { n: string; q: string; cat: string }[]; hidden: string[]; scope: number; lock?: { from: string; to: string; scope: number }; checkedFor?: string; ticks?: Record<string, Record<string, boolean>> };
  ramadan?: boolean;
  /** City for iftar and suhoor times (Ramadan mode). Riyadh when not set. */
  city?: string;
  /** Beginner: calories and protein are set for you. Advanced (default): edit every number. */
  mode?: 'beginner' | 'advanced';
  /** Day the weight plateau suggestion was dismissed or applied (hidden for 2 weeks after). */
  plateauDay?: string;
  /** Food allergies (keys from ALLERGENS) and any others in your own words: kept out of suggested meals. */
  allergies?: string[];
  allergyNote?: string;
  /** Recipes the AI wrote for you (mixed into the meal plan, so it isn't the same as everyone else's). */
  aiRecipes?: AiRecipes;
  /** The weight you're aiming for (kg), set with a cut or bulk goal. */
  targetWeight?: number | null;
};

/** A recipe in the plan. gen = made by the AI from the ingredients you have. */
export type CustomRecipe = Recipe & { gen?: boolean };

export type Person = { gender: 'male' | 'female' | null; age: number; height: number };

export function defaultPlan(weight: number): FoodPlan {
  return {
    weight,
    activity: 1,
    goal: 2,
    bf: 2,
    work: [{ s: '08:00', e: '17:00' }],
    sun: false,
    notes: '',
    kcal: 2200,
    perKg: 1.8,
    carbG: null,
    fatG: null,
    water: 2800,
    meals: [],
    workoutTime: '18:30',
    intensity: 'Moderate to hard',
    picks: {},
  };
}

/** Calories burned at rest. With a body fat % it uses lean mass (Katch-McArdle), else weight, height and age (Mifflin-St Jeor). */
export const bmr = (weight: number, p: Person, bfPct?: number | null) =>
  bfPct != null && bfPct > 0 && bfPct < 70
    ? 370 + 21.6 * weight * (1 - bfPct / 100)
    : 10 * weight + 6.25 * p.height - 5 * p.age + (p.gender === 'female' ? -161 : 5);

/** The body fat % picked in setup (the body that looks closest), or undefined. */
export const bfOf = (f: { bf?: number | null }, p: Person) => (f.bf == null ? undefined : bodyFatList(p.gender)[f.bf]);

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad((h + 24) % 24)}:${pad(m)}`;

type BodyFacts = Pick<FoodPlan, 'weight' | 'activity' | 'sun'> & { bf?: number | null };

/** Calories that keep your weight where it is (no goal change). */
export const maintenance = (f: BodyFacts, p: Person) => bmr(f.weight, p, bfOf(f, p)) * ACT_FACTOR[f.activity] + (f.sun ? 120 : 0);

/**
 * Lowest daily calories we suggest: what you burn at rest, and never under 1,200 (women) or 1,500 (men). `bf` is the
 * plan's body fat pick (FoodPlan.bf), so the floor uses the same resting burn as your calories.
 */
export const kcalFloor = (weight: number, p: Person, bf?: number | null) => Math.ceil(Math.max(bmr(weight, p, bfOf({ bf }, p)), p.gender === 'male' ? 1500 : 1200) / 10) * 10;

/** Under 18: no cut or bulk, you stay at maintenance so you have energy to grow. */
export const isMinor = (p: Person) => p.age < 18;

/** Suggested daily calories for the goal. A cut never takes more than 25% off maintenance, and never goes under the floor. */
export function suggestKcal(f: BodyFacts & Pick<FoodPlan, 'goal'>, p: Person) {
  const tdee = maintenance(f, p);
  const adj = isMinor(p) ? 0 : Math.max(GOAL_ADJ[f.goal], -0.25 * tdee);
  return Math.round(Math.max(tdee + adj, kcalFloor(f.weight, p, f.bf)) / 10) * 10;
}

/**
 * A cut the calorie floor holds back: about how much you'd lose a week at these calories (kg, negative), else null.
 * Shown instead of the goal's usual range, which isn't reachable then.
 */
export function flooredRate(f: BodyFacts & Pick<FoodPlan, 'goal'>, p: Person, kcal = suggestKcal(f, p)) {
  if (f.goal < 3 || isMinor(p)) return null;
  const tdee = maintenance(f, p);
  if (tdee + Math.max(GOAL_ADJ[f.goal], -0.25 * tdee) >= kcalFloor(f.weight, p, f.bf)) return null;
  return Math.min(0, Math.round(((kcal - tdee) * 7) / 7700 / 0.05) * 0.05);
}

/** Is the target weight on the goal's side: lower for a cut, higher for a bulk? */
export const targetFits = (goal: number, weight: number, target?: number | null) => target != null && target > 0 && (goal >= 3 ? target < weight : goal <= 1 ? target > weight : false);

/** A first target for the goal: about 8% lower for a cut, 5% higher for a bulk (to the half kilo). None to maintain. */
export const defaultTarget = (goal: number, weight: number) => (goal === 2 ? null : Math.round(weight * (goal >= 3 ? 0.92 : 1.05) * 2) / 2);

/** The lowest target we offer for a cut: a healthy weight for your height (BMI 18.5), and never more than 40% off. */
export const lowestTarget = (weight: number, p: Person) => Math.ceil(Math.max(p.height > 0 ? 18.5 * (p.height / 100) ** 2 : 0, weight * 0.6) * 2) / 2;

/** About how many weeks to the target weight at these calories; null without a target, to maintain, or when the calories don't move that way. */
export function weeksToTarget(f: BodyFacts & Pick<FoodPlan, 'goal' | 'targetWeight'>, p: Person, kcal = suggestKcal(f, p)) {
  if (!targetFits(f.goal, f.weight, f.targetWeight) || isMinor(p)) return null;
  const perWeek = ((kcal - maintenance(f, p)) * 7) / 7700;
  const left = (f.targetWeight as number) - f.weight;
  if (!perWeek || Math.sign(perWeek) !== Math.sign(left)) return null;
  return Math.max(1, Math.ceil(left / perWeek));
}

// Earlier formulas (by weight only, Mifflin-St Jeor), to tell untouched plans from ones changed by hand.
const mifflinTdee = (f: BodyFacts, p: Person) => bmr(f.weight, p) * ACT_FACTOR[f.activity] + (f.sun ? 120 : 0);
/** What calcPlan suggested before the floor and the 25% cap. */
export const oldSuggestKcal = (f: Pick<FoodPlan, 'weight' | 'activity' | 'sun' | 'goal'>, p: Person) => Math.round((mifflinTdee(f, p) + GOAL_ADJ[f.goal]) / 10) * 10;
/** What calcPlan suggested before body fat and the new floor (floor 10% above resting burn). */
const prevSuggestKcal = (f: Pick<FoodPlan, 'weight' | 'activity' | 'sun' | 'goal'>, p: Person) => {
  const tdee = mifflinTdee(f, p);
  const adj = isMinor(p) ? 0 : Math.max(GOAL_ADJ[f.goal], -0.25 * tdee);
  const floor = Math.round(Math.max(bmr(f.weight, p) * 1.1, p.gender === 'male' ? 1500 : 1200) / 10) * 10;
  return Math.round(Math.max(tdee + adj, floor) / 10) * 10;
};
/** Calories still at one of our suggestions (now or before), so not changed by hand. */
export const untouchedKcal = (f: FoodPlan, p: Person) => f.kcal === suggestKcal(f, p) || f.kcal === oldSuggestKcal(f, p) || f.kcal === prevSuggestKcal(f, p);

/** Suggested water (ml): 35 ml per kg, more for sun and an active day. Between 1.5 and 6 litres (the most you can set). */
export const suggestWater = (f: Pick<FoodPlan, 'weight' | 'activity' | 'sun'>) =>
  Math.min(6000, Math.max(1500, Math.round((f.weight * 35 + (f.sun ? 700 : 0) + (f.activity >= 2 ? 300 : 0)) / 100) * 100));

/** Work out calories, protein, water, meal times and workout time from the setup answers. */
export function calcPlan(plan: FoodPlan, person: Person): FoodPlan {
  // Safety net: under 18 always means maintain.
  const f = isMinor(person) && plan.goal !== 2 ? { ...plan, goal: 2 } : plan;
  // Meal times from the work day, in minutes. Rotating shifts use the first shift (they change every week); a night
  // shift ends the next morning, so it runs past midnight. Every time is rounded to a quarter hour.
  const shifts = f.noWork || !f.work.length ? [{ s: '09:00', e: '17:00' }] : f.rotate ? [f.work[0]] : f.work;
  const toMin = (x: string) => {
    const [h, m] = x.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const s0 = toMin(shifts[0].s);
  let e0 = toMin(shifts[shifts.length - 1].e);
  if (e0 <= s0) e0 += 1440;
  const at = (min: number) => {
    const q = (((Math.round(min / 15) * 15) % 1440) + 1440) % 1440;
    return hhmm(Math.floor(q / 60), q % 60);
  };
  return {
    ...f,
    kcal: suggestKcal(f, person),
    perKg: [1.8, 1.8, 1.6, 2.2, 2.0][f.goal],
    carbG: null,
    fatG: null,
    water: suggestWater(f),
    // Before work, halfway through, after work, then dinner 3.5 hours after work (the workout fits between).
    meals: [
      { n: 'Breakfast', t: at(s0 - 45) },
      { n: 'Lunch', t: at((s0 + e0) / 2) },
      { n: 'Pre-workout', t: at(e0 + 30) },
      { n: 'Dinner', t: at(e0 + 210) },
    ],
    workoutTime: at(e0 + 90),
    intensity: f.goal >= 3 ? 'Moderate, keep volume high' : 'Moderate to hard',
    picks: {},
    custom: {},
  };
}

/**
 * New weight, height, birthday or gender: update calories and water, and keep everything you changed yourself
 * (meals, picks, custom recipes, protein per kg, carbs and fat). If you moved calories or water away from our
 * suggestion, that difference is kept. `prev` is who the old plan was worked out for (defaults to `person`).
 */
export function recalcTargets(plan: FoodPlan, person: Person, opts: { weight?: number; prev?: Person } = {}): FoodPlan {
  const weight = Math.round((opts.weight ?? plan.weight) * 10) / 10;
  const prev = opts.prev ?? person;
  const goal = isMinor(person) ? 2 : plan.goal;
  const next = { ...plan, weight, goal };
  // Calories still at what we suggested (now, or before the calorie floor existed) count as untouched.
  const kcalOff = untouchedKcal(plan, prev) ? 0 : plan.kcal - suggestKcal(plan, prev);
  const floor = kcalFloor(weight, person, plan.bf);
  let kcal = suggestKcal(next, person) + kcalOff;
  // Never pushed under the floor by a recalculation (unless you had already set it lower yourself).
  if (kcal < floor) kcal = Math.max(kcal, Math.min(plan.kcal, floor));
  const water = suggestWater(next) + (plan.water - suggestWater(plan));
  return { ...next, kcal: Math.round(kcal / 10) * 10, water: Math.min(6000, Math.max(1000, Math.round(water / 100) * 100)) };
}

/**
 * Extra calories a day for pregnancy or breastfeeding: about +0 in the first trimester (to week 13), +340 in the
 * second (to week 27), +450 in the third; +400 after birth (breastfeeding). Week unknown: the second trimester's.
 */
export function pregExtra(mode: 'preg' | 'post' | null, week?: number | null) {
  if (mode === 'post') return 400;
  if (mode !== 'preg') return 0;
  if (week == null) return 340;
  return week < 14 ? 0 : week < 28 ? 340 : 450;
}

/**
 * Pregnant: no deficit (never under maintenance) plus the trimester's extra; breastfeeding (`floor` false): your plan
 * plus 400. Only changes what's shown, not the saved plan (save the plan's own numbers, never these).
 */
export function withPregnancy(f: FoodPlan, p: Person, extra: number, floor = true): FoodPlan {
  const base = targets(f).k;
  const k = (floor ? Math.max(base, Math.round(maintenance(f, p) / 10) * 10) : base) + extra;
  // Carbs set by hand: the extra calories go to carbs, so your protein and fat stay the same.
  if (f.carbG != null) return { ...f, carbG: f.carbG + Math.round((k - base) / 4) };
  return { ...f, kcal: k };
}

export type Macros = { k: number; p: number; c: number; f: number };

/** Most protein we suggest in a day (g). */
export const PROTEIN_MAX = 250;

/**
 * The weight protein per kg is counted on. Over 100 kg only part of the extra counts (most of it isn't muscle),
 * so 250 kg doesn't ask for 550 g a day.
 */
export const proteinKg = (weight: number) => (weight <= 100 ? weight : 100 + (weight - 100) * 0.4);

/** Daily protein (g) for a weight and grams per kg. */
export const proteinFor = (weight: number, perKg: number) => Math.min(PROTEIN_MAX, Math.round(proteinKg(weight) * perKg));

/** Daily targets in grams. Calories follow the grams when carbs/fat were set by hand. */
export function targets(f: FoodPlan): Macros {
  const p = proteinFor(f.weight, f.perKg);
  const fat = f.fatG ?? Math.round((f.kcal * 0.257) / 9);
  if (f.carbG != null) return { k: p * 4 + f.carbG * 4 + fat * 9, p, c: f.carbG, f: fat };
  return { k: f.kcal, p, c: Math.max(0, Math.round((f.kcal - p * 4 - fat * 9) / 4)), f: fat };
}

export const bodyFatList = (gender: Person['gender']) => (gender === 'female' ? [18, 22, 26, 30, 35, 40] : [10, 15, 20, 25, 30, 35]);

/** Ramadan meals around today's real iftar (sunset) and suhoor (ends at Fajr) for your city. */
export function ramadanMeals(city?: string | null, day = localDay()): Meal[] {
  const { fajr, maghrib } = fastTimes(city, day);
  const q = (t: string) => addMin(t, -(Number(t.slice(3)) % 15));
  return [
    { n: 'Iftar', t: maghrib },
    { n: 'Main meal', t: q(addMin(maghrib, 180)) },
    { n: 'Suhoor', t: q(addMin(fajr, -45)) },
  ];
}

/** Which meal a time belongs to: a meal in your plan within an hour of its time; otherwise by time of day
 * (breakfast until 11, lunch until 4, a snack until 6:30, then dinner; after midnight a snack). */
export function mealAt(meals: { n: string; t: string }[], time: string) {
  const min = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  const now = min(time);
  let best: { n: string; d: number } | null = null;
  for (const m of meals) {
    if (!/^\d{2}:\d{2}/.test(m.t)) continue;
    // Around midnight: 23:30 and 00:10 are 40 minutes apart, not 23 hours.
    const raw = Math.abs(min(m.t) - now);
    const d = Math.min(raw, 1440 - raw);
    if (d <= 60 && (!best || d < best.d)) best = { n: m.n, d };
  }
  if (best) return best.n;
  return now >= 240 && now < 660 ? 'Breakfast' : now >= 660 && now < 960 ? 'Lunch' : now >= 1110 ? 'Dinner' : 'Snack';
}

/** The meals you can log to: breakfast, lunch, dinner and snack, plus any other meal in your plan (like Pre-workout). */
export const mealChoices = (meals: { n: string }[]) => [...new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack', ...meals.map((m) => m.n)])];

/** The time of a date as HH:MM. */
export const hhmmOf = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * "Change meal": the next recipe for this meal that's a different dish (other meals that day are skipped, so one step
 * can land on the same one), with any swapped-ingredient version of it dropped. Undo puts `picks` and `custom` back.
 */
export function changeMeal(f: FoodPlan, key: string, day: string, dayKcal: number) {
  const dk = dayKey(day, key);
  const custom = prune({ ...(f.custom ?? {}) }, day);
  delete custom[dk];
  // An older swap (kept for every day) goes too, or this day would still show it.
  delete custom[key];
  const cur = planMeals(f, day, dayKcal).find((x) => x.key === key);
  const old = prune({ ...(f.picks ?? {}) }, day);
  const at = (step: number) => {
    const picks = { ...old, [dk]: (f.picks?.[dk] ?? f.picks?.[key] ?? 0) + step };
    return { picks, custom, meal: planMeals({ ...f, picks, custom }, day, dayKcal).find((x) => x.key === key) };
  };
  let next = at(1);
  for (let step = 2; step <= 12 && next.meal?.r.n === cur?.r.n; step++) next = at(step);
  return next;
}

/** A meal slot's key for one day: picks and swapped recipes are kept per day, so changing today's lunch leaves other days alone. */
export const dayKey = (day: string, key: string) => `${day}:${key}`;

/** Picks or swaps for days more than 2 weeks back are dropped (they're no longer shown). */
function prune<T>(m: Record<string, T>, day: string) {
  const cut = addDays(day < localDay() ? day : localDay(), -14);
  for (const k of Object.keys(m)) if (/^\d{4}-\d{2}-\d{2}:/.test(k) && k.slice(0, 10) < cut) delete m[k];
  return m;
}

/** Give every meal its own id (its place in the list, for meals from before ids), before meals are removed, moved or added. */
export const withMealIds = (meals: Meal[]): Meal[] => meals.map((m, i) => (m.id == null ? { ...m, id: i } : m));
/** The id for a new meal. */
export const nextMealId = (meals: Meal[]) => withMealIds(meals).reduce((a, m) => Math.max(a, (m.id ?? 0) + 1), 0);

/** `contains`: your allergens in this meal, only when there was no safe recipe to pick (shown as a warning). */
export type PlannedMeal = Meal & { key: string; r: CustomRecipe; k: number; p: number; c: number; f: number; contains?: string[] };

// Each recipe's allergens, worked out once for the current allergy settings (planMeals runs for every day of a list).
let allergyCache = { key: '', map: new WeakMap<Recipe, string[]>() };
function allergensOf(f: FoodPlan) {
  const key = JSON.stringify([f.allergies ?? [], f.allergyNote ?? '']);
  if (allergyCache.key !== key) allergyCache = { key, map: new WeakMap() };
  const { map } = allergyCache;
  return (x: Recipe) => {
    let v = map.get(x);
    if (!v) {
      const texts = [x.n, ...x.ing.map((g) => g[0])];
      const own = noteHit(texts, f.allergyNote);
      v = [...allergensIn(texts, f.allergies), ...(own ? [own] : [])];
      map.set(x, v);
    }
    return v;
  };
}

/**
 * A day's suggested meals, sized to the daily calories. Your own AI recipes come first, then the built-in ones; the
 * dish changes from day to day (and with "Change meal"), and the same dish isn't used twice in a day.
 */
export function planMeals(f: FoodPlan, day?: string, dayKcal?: number): PlannedMeal[] {
  const date = day ?? localDay(new Date());
  const dayNo = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000) || 0;
  const ram = ramadanOn(f, date);
  const meals = ram ? ramadanMeals(f.city, day) : f.meals;
  const tag = f.goal <= 1 ? 'Bulk' : 'Cut';
  // The day's real goal when known (pregnancy, calories moved between days), else the plan's.
  const kcal = dayKcal ?? targets(f).k;
  const ws = meals.map((m) => MEAL_WEIGHT[m.type ?? m.n] ?? 0.13);
  const tot = ws.reduce((a, b) => a + b, 0) || 1;
  // Recipes already on today's plan: another one is picked when there's a choice, so meals don't repeat.
  const used = new Set<string>();
  const has = allergensOf(f);
  return meals.map((m, i) => {
    const type = m.type ?? m.n;
    const key = `${ram ? 'r' : ''}${type}${m.id ?? i}`;
    // Recipes without your allergens: this meal's for your goal; when that's fewer than 3, any for this meal too,
    // then other meals' (so there's always a choice and "Change meal" changes something).
    // Your own words count too ("strawberries"), not just the allergens you picked.
    const safe = (list: Recipe[]) => list.filter((x) => !has(x).length);
    const ai = ram ? [] : (f.aiRecipes?.list ?? []).filter((x) => x.type === type);
    const all = [...ai, ...(RECIPES[type] ?? RECIPES.Snack)];
    const mine = all.filter((x) => x.tag === tag);
    // Borrowing from other meals: full meals for a main meal, snacks for a snack.
    const light = (k: string) => k === 'Snack' || k === 'Pre-workout';
    const others = () =>
      Object.entries(RECIPES)
        .filter(([k]) => k !== type && k !== 'Iftar' && k !== 'Suhoor' && light(k) === light(type))
        .flatMap(([, v]) => v);
    // The wider lists are only checked when the closer ones are too short.
    const grow = (a: Recipe[], b: () => Recipe[]) => (a.length >= 3 ? a : [...a, ...b().filter((x) => !a.includes(x))]);
    const okMine = safe(mine);
    const safeAll = grow(grow(okMine, () => safe(all)), () => safe(others()));
    const pool = safeAll.length ? safeAll : mine.length ? mine : all;
    const dk = dayKey(date, key);
    const start = (f.picks?.[dk] ?? f.picks?.[key] ?? 0) + dayNo;
    const fresh = Array.from({ length: pool.length }, (_, j) => pool[(start + j) % pool.length]).find((x) => !used.has(x.n));
    const r = f.custom?.[dk] ?? f.custom?.[key] ?? fresh ?? pool[start % pool.length];
    used.add(r.n);
    const contains = has(r);
    const k = Math.round(((kcal * ws[i]) / tot) * (r.kAdj ?? 1) / 10) * 10;
    return { ...m, key, r, k, p: Math.round((k * r.m[0]) / 4), c: Math.round((k * r.m[1]) / 4), f: Math.round((k * r.m[2]) / 9), ...(contains.length ? { contains } : {}) };
  });
}

/** Ingredient amounts for a recipe at a given calorie size (recipes are written for 600 kcal). */
export function scaleIngredients(r: Recipe, k: number): [string, number, string][] {
  const factor = k / 600;
  return r.ing.map(([n, a, u]) => {
    let v = a * factor;
    v = u === 'g' || u === 'ml' ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v * 2) / 2);
    return [n, v, u];
  });
}

export function fmtTime(t: string, lang: 'en' | 'ar' = 'en') {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : lang === 'ar' ? 'م' : 'PM';
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
}

export function ageFromIso(iso: string | null | undefined) {
  if (!iso) return 30;
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

/** Local date as YYYY-MM-DD (the user's day, not UTC). */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Ramadan mode can be turned on (only during Ramadan). Worked out when the app starts; use isRamadan(day) for a given day. */
export const RAMADAN_SWITCH = RAMADAN_LIVE && isRamadan();
