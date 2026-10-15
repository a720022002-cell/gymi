// Calorie math, copied from the design file (docs/index.html: bmr, calcPlan, targets).
import type { AiRecipes } from './aiRecipes';
import { type AllergenKey, allergensIn } from './allergies';
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

// Ramadan mode is hidden outside Ramadan. Set to true when Ramadan comes to show it again.
export const RAMADAN_SWITCH = false;

export type Meal = { n: string; t: string; type?: string };
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
  /** Which recipe is shown for each meal slot (changes with "Change meal"). */
  picks?: Record<string, number>;
  /** Recipes changed by swapping an ingredient (or made from your ingredients), per meal slot. */
  custom?: Record<string, CustomRecipe>;
  shop?: { checked: Record<string, boolean>; extra: { n: string; q: string; cat: string }[]; hidden: string[]; scope: number };
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

export const bmr = (weight: number, p: Person) =>
  10 * weight + 6.25 * p.height - 5 * p.age + (p.gender === 'female' ? -161 : 5);

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad((h + 24) % 24)}:${pad(m)}`;

/** Calories that keep your weight where it is (no goal change). */
export const maintenance = (f: Pick<FoodPlan, 'weight' | 'activity' | 'sun'>, p: Person) => bmr(f.weight, p) * ACT_FACTOR[f.activity] + (f.sun ? 120 : 0);

/** Lowest daily calories we suggest: 10% above what you burn at rest, and never under 1,200 (women) or 1,500 (men). */
export const kcalFloor = (weight: number, p: Person) => Math.round(Math.max(bmr(weight, p) * 1.1, p.gender === 'male' ? 1500 : 1200) / 10) * 10;

/** Under 18: no cut or bulk, you stay at maintenance so you have energy to grow. */
export const isMinor = (p: Person) => p.age < 18;

/** Suggested daily calories for the goal. A cut never takes more than 25% off maintenance, and never goes under the floor. */
export function suggestKcal(f: Pick<FoodPlan, 'weight' | 'activity' | 'sun' | 'goal'>, p: Person) {
  const tdee = maintenance(f, p);
  const adj = isMinor(p) ? 0 : Math.max(GOAL_ADJ[f.goal], -0.25 * tdee);
  return Math.round(Math.max(tdee + adj, kcalFloor(f.weight, p)) / 10) * 10;
}

/** What calcPlan suggested before the floor and the 25% cap (to tell untouched plans from ones changed by hand). */
export const oldSuggestKcal = (f: Pick<FoodPlan, 'weight' | 'activity' | 'sun' | 'goal'>, p: Person) => Math.round((maintenance(f, p) + GOAL_ADJ[f.goal]) / 10) * 10;

/** Suggested water (ml): 35 ml per kg, more for sun and an active day. */
export const suggestWater = (f: Pick<FoodPlan, 'weight' | 'activity' | 'sun'>) => Math.round((f.weight * 35 + (f.sun ? 700 : 0) + (f.activity >= 2 ? 300 : 0)) / 100) * 100;

/** Work out calories, protein, water, meal times and workout time from the setup answers. */
export function calcPlan(plan: FoodPlan, person: Person): FoodPlan {
  // Safety net: under 18 always means maintain.
  const f = isMinor(person) && plan.goal !== 2 ? { ...plan, goal: 2 } : plan;
  const start = f.noWork ? '09:00' : f.work[0]?.s ?? '09:00';
  const end = f.noWork ? '17:00' : f.work[f.work.length - 1]?.e ?? '17:00';
  const [sh, sm] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  const lunch = Math.round((sh + eh) / 2);
  return {
    ...f,
    kcal: suggestKcal(f, person),
    perKg: [1.8, 1.8, 1.6, 2.2, 2.0][f.goal],
    carbG: null,
    fatG: null,
    water: suggestWater(f),
    meals: [
      { n: 'Breakfast', t: hhmm(sh - 1, sm === 0 ? 15 : 0) },
      { n: 'Lunch', t: hhmm(lunch, 30) },
      { n: 'Pre-workout', t: hhmm(eh, 30) },
      { n: 'Dinner', t: hhmm(eh + 3, 30) },
    ],
    workoutTime: hhmm(eh + 1, 30),
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
  const kcalOff = plan.kcal === oldSuggestKcal(plan, prev) ? 0 : plan.kcal - suggestKcal(plan, prev);
  const floor = kcalFloor(weight, person);
  let kcal = suggestKcal(next, person) + kcalOff;
  // Never pushed under the floor by a recalculation (unless you had already set it lower yourself).
  if (kcal < floor) kcal = Math.max(kcal, Math.min(plan.kcal, floor));
  const water = suggestWater(next) + (plan.water - suggestWater(plan));
  return { ...next, kcal: Math.round(kcal / 10) * 10, water: Math.min(6000, Math.max(1000, Math.round(water / 100) * 100)) };
}

/** Pregnant: no deficit (never under maintenance) plus about 300 kcal; breastfeeding plus 400. Only changes what's shown, not the saved plan. */
export function withPregnancy(f: FoodPlan, p: Person, extra: number): FoodPlan {
  const base = targets(f).k;
  const k = Math.max(base, Math.round(maintenance(f, p) / 10) * 10) + extra;
  // Carbs set by hand: the extra calories go to carbs, so your protein and fat stay the same.
  if (f.carbG != null) return { ...f, carbG: f.carbG + Math.round((k - base) / 4) };
  return { ...f, kcal: k };
}

export type Macros = { k: number; p: number; c: number; f: number };

/** Daily targets in grams. Calories follow the grams when carbs/fat were set by hand. */
export function targets(f: FoodPlan): Macros {
  const p = Math.round(f.weight * f.perKg);
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
    const d = Math.abs(min(m.t) - now);
    if (d <= 60 && (!best || d < best.d)) best = { n: m.n, d };
  }
  if (best) return best.n;
  return now >= 240 && now < 660 ? 'Breakfast' : now >= 660 && now < 960 ? 'Lunch' : now >= 1110 ? 'Dinner' : 'Snack';
}

/** The meals you can log to: breakfast, lunch, dinner and snack, plus any other meal in your plan (like Pre-workout). */
export const mealChoices = (meals: { n: string }[]) => [...new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack', ...meals.map((m) => m.n)])];

/** The time of a date as HH:MM. */
export const hhmmOf = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** `contains`: your allergens in this meal, only when there was no safe recipe to pick (shown as a warning). */
export type PlannedMeal = Meal & { key: string; r: CustomRecipe; k: number; p: number; c: number; f: number; contains?: AllergenKey[] };

/**
 * A day's suggested meals, sized to the daily calories. Your own AI recipes come first, then the built-in ones; the
 * dish changes from day to day (and with "Change meal"), and the same dish isn't used twice in a day.
 */
export function planMeals(f: FoodPlan, day?: string): PlannedMeal[] {
  const date = day ?? localDay(new Date());
  const dayNo = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000) || 0;
  const ram = RAMADAN_SWITCH && !!f.ramadan;
  const meals = ram ? ramadanMeals(f.city, day) : f.meals;
  const tag = f.goal <= 1 ? 'Bulk' : 'Cut';
  const kcal = targets(f).k;
  const ws = meals.map((m) => MEAL_WEIGHT[m.type ?? m.n] ?? 0.13);
  const tot = ws.reduce((a, b) => a + b, 0) || 1;
  // Recipes already on today's plan: another one is picked when there's a choice, so meals don't repeat.
  const used = new Set<string>();
  return meals.map((m, i) => {
    const type = m.type ?? m.n;
    const key = `${ram ? 'r' : ''}${type}${i}`;
    // Recipes without your allergens: this meal's for your goal, then any for this meal, then another meal's.
    const safe = (list: Recipe[]) => list.filter((x) => !allergensIn([x.n, ...x.ing.map((g) => g[0])], f.allergies).length);
    const ai = ram ? [] : (f.aiRecipes?.list ?? []).filter((x) => x.type === type);
    const all = [...ai, ...(RECIPES[type] ?? RECIPES.Snack)];
    const mine = all.filter((x) => x.tag === tag);
    const others = Object.entries(RECIPES).filter(([k]) => k !== type && k !== 'Iftar' && k !== 'Suhoor').flatMap(([, v]) => v);
    const pool = [safe(mine), safe(all), safe(others), mine.length ? mine : all].find((p) => p.length)!;
    const start = (f.picks?.[key] ?? 0) + dayNo;
    const fresh = Array.from({ length: pool.length }, (_, j) => pool[(start + j) % pool.length]).find((x) => !used.has(x.n));
    const r = f.custom?.[key] ?? fresh ?? pool[start % pool.length];
    used.add(r.n);
    const contains = allergensIn([r.n, ...r.ing.map((g) => g[0])], f.allergies);
    const k = Math.round((kcal * ws[i]) / tot / 10) * 10;
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
