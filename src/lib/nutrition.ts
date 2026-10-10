// Calorie math, copied from the design file (docs/index.html: bmr, calcPlan, targets).
import { MEAL_WEIGHT, type Recipe, RECIPES } from './recipes';

export const GOALS = ['Fast bulk', 'Moderate bulk', 'Maintain', 'Fast cut', 'Moderate cut'] as const;
export const GOAL_DESC = ['+0.5 kg a week', '+0.25 kg a week', 'Keep your weight', '−0.75 kg a week', '−0.4 kg a week'];
const GOAL_ADJ = [500, 250, 0, -600, -300];
// Order the goals are shown in: bulk, bulk, maintain, moderate cut, fast cut.
export const GOAL_ORDER = [0, 1, 2, 4, 3];

export const ACTIVITY: [string, string][] = [
  ['Mostly sitting', 'Desk work, little walking'],
  ['Lightly active', 'Some walking during the day'],
  ['Active', 'On your feet a lot'],
  ['Very active', 'Physical work, lifting, long walks'],
];
const ACT_FACTOR = [1.25, 1.4, 1.55, 1.75];

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
  /** Recipes changed by swapping an ingredient, per meal slot. */
  custom?: Record<string, Recipe>;
  shop?: { checked: Record<string, boolean>; extra: { n: string; q: string; cat: string }[]; hidden: string[]; scope: number };
  ramadan?: boolean;
};

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

/** Work out calories, protein, water, meal times and workout time from the setup answers. */
export function calcPlan(f: FoodPlan, person: Person): FoodPlan {
  const t = bmr(f.weight, person) * ACT_FACTOR[f.activity] + (f.sun ? 120 : 0) + GOAL_ADJ[f.goal];
  const start = f.noWork ? '09:00' : f.work[0]?.s ?? '09:00';
  const end = f.noWork ? '17:00' : f.work[f.work.length - 1]?.e ?? '17:00';
  const [sh, sm] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  const lunch = Math.round((sh + eh) / 2);
  return {
    ...f,
    kcal: Math.round(t / 10) * 10,
    perKg: [1.8, 1.8, 1.6, 2.2, 2.0][f.goal],
    carbG: null,
    fatG: null,
    water: Math.round((f.weight * 35 + (f.sun ? 700 : 0) + (f.activity >= 2 ? 300 : 0)) / 100) * 100,
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

export type Macros = { k: number; p: number; c: number; f: number };

/** Daily targets in grams. Calories follow the grams when carbs/fat were set by hand. */
export function targets(f: FoodPlan): Macros {
  const p = Math.round(f.weight * f.perKg);
  const fat = f.fatG ?? Math.round((f.kcal * 0.257) / 9);
  if (f.carbG != null) return { k: p * 4 + f.carbG * 4 + fat * 9, p, c: f.carbG, f: fat };
  return { k: f.kcal, p, c: Math.max(0, Math.round((f.kcal - p * 4 - fat * 9) / 4)), f: fat };
}

export const bodyFatList = (gender: Person['gender']) => (gender === 'female' ? [18, 22, 26, 30, 35, 40] : [10, 15, 20, 25, 30, 35]);

export const RAMADAN_MEALS: Meal[] = [
  { n: 'Iftar', t: '18:00' },
  { n: 'Main meal', t: '21:00' },
  { n: 'Suhoor', t: '03:45' },
];

export type PlannedMeal = Meal & { key: string; r: Recipe; k: number; p: number; c: number; f: number };

/** Today's suggested meals, sized to the daily calories. */
export function planMeals(f: FoodPlan): PlannedMeal[] {
  const ram = !!f.ramadan;
  const meals = ram ? RAMADAN_MEALS : f.meals;
  const tag = f.goal <= 1 ? 'Bulk' : 'Cut';
  const kcal = targets(f).k;
  const ws = meals.map((m) => MEAL_WEIGHT[m.type ?? m.n] ?? 0.13);
  const tot = ws.reduce((a, b) => a + b, 0) || 1;
  return meals.map((m, i) => {
    const type = m.type ?? m.n;
    const key = `${ram ? 'r' : ''}${type}${i}`;
    const all = RECIPES[type] ?? RECIPES.Snack;
    const pool = all.filter((x) => x.tag === tag).length ? all.filter((x) => x.tag === tag) : all;
    const r = f.custom?.[key] ?? pool[(f.picks?.[key] ?? 0) % pool.length];
    const k = Math.round((kcal * ws[i]) / tot / 10) * 10;
    return { ...m, key, r, k, p: Math.round((k * r.m[0]) / 4), c: Math.round((k * r.m[1]) / 4), f: Math.round((k * r.m[2]) / 9) };
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
