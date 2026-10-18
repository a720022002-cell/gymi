// Recipes the AI writes for you: a few for each meal in your plan, from cuisines picked at random, so two people
// rarely get the same meal plan. Checked here (amounts, macros, allergens) and kept in your food plan for 2 weeks.
import { askAI } from './ai';
import { allergensIn, allergiesText, noteHit } from './allergies';
import { addDays, type FoodPlan, RAMADAN_SWITCH } from './nutrition';
import type { Recipe } from './recipes';

export type AiRecipe = Recipe & { type: string };
export type AiRecipes = { at: string; lang: 'en' | 'ar'; key: string; list: AiRecipe[] };

const CUISINES = ['Saudi', 'Emirati', 'Kuwaiti', 'Yemeni', 'Levantine', 'Egyptian', 'Turkish', 'Indian', 'Persian', 'Moroccan', 'Mediterranean', 'Japanese', 'Thai', 'Mexican', 'Italian', 'Greek'];
const UNITS = new Set(['g', 'ml', 'large', 'medium', 'small', 'slice', 'slices', 'piece', 'pieces', 'tbsp', 'tsp', 'pinch']);
/** New recipes every 2 weeks, or when your goal, allergies, meals or language change. */
const KEEP_DAYS = 14;

/** Cut, bulk or maintain: what the recipes are written for (a fast or a moderate cut get the same recipes). */
const goalKind = (f: FoodPlan) => (f.goal <= 1 ? 'bulk' : f.goal >= 3 ? 'cut' : 'maintain');

/** What all the recipes were made for: when it changes, all of them are made again. */
export const recipesKey = (f: FoodPlan) => [goalKind(f), [...(f.allergies ?? [])].sort().join('+'), (f.allergyNote ?? '').trim().toLowerCase()].join('|');

/** Your meals that have no recipes of their own yet (a meal you just added). */
const missingTypes = (f: FoodPlan) => mealTypes(f).filter((t) => !(f.aiRecipes?.list ?? []).some((r) => r.type === t));

/** Your meals' kinds (Breakfast, Lunch, ...), each once. */
const mealTypes = (f: FoodPlan) => [...new Set(f.meals.map((m) => m.type ?? m.n))].slice(0, 6);

/** Meals are locked to a shopping list you're buying (until its last day). */
export const shoppingLock = (f: FoodPlan, today: string) => (f.shop?.lock && f.shop.lock.to >= today ? f.shop.lock : null);

/** Time for new recipes? Not while you're shopping from a list (only new allergies, goal or meals change them then). */
export function needsRecipes(f: FoodPlan, lang: 'en' | 'ar', today: string) {
  if (RAMADAN_SWITCH && f.ramadan) return false;
  const r = f.aiRecipes;
  if (!r || r.key !== recipesKey(f) || missingTypes(f).length) return true;
  if (shoppingLock(f, today)) return false;
  return r.lang !== lang || r.at < addDays(today, -KEEP_DAYS);
}

const pick = <T,>(xs: T[], n: number) => [...xs].sort(() => Math.random() - 0.5).slice(0, n);

/**
 * Ask for 4 recipes per meal (all at once), and keep only the sound ones. When only some meals are new (and the rest
 * are still fresh), only those are asked for and the others are kept. Null when nothing came back.
 */
export async function makeRecipes(f: FoodPlan, lang: 'en' | 'ar', today: string): Promise<AiRecipes | null> {
  const goal = goalKind(f);
  const r0 = f.aiRecipes;
  const onlyNew = !!r0 && r0.key === recipesKey(f) && r0.lang === lang && r0.at >= addDays(today, -KEEP_DAYS) && missingTypes(f).length > 0;
  const types = onlyNew ? missingTypes(f) : mealTypes(f);
  const kept = onlyNew ? r0!.list.filter((x) => mealTypes(f).includes(x.type)) : [];
  const allergies = allergiesText(f.allergies, f.allergyNote);
  const old = (f.aiRecipes?.list ?? []).map((r) => r.n);
  const lists = await Promise.all(
    types.map(async (type) => {
      // Different cuisines for each meal, picked at random for you.
      const cuisines = pick(CUISINES, 2).join(', ');
      const { result } = await askAI<{ recipes?: unknown[] }>('recipes', { lang, meal: type, count: 4, goal, cuisines, allergies, avoid: old }).catch(() => ({ result: null }));
      return (result?.recipes ?? []).map((x) => clean(x, type, f)).filter((x): x is AiRecipe => !!x);
    }),
  );
  const list = [...kept, ...lists.flat()];
  // Each dish once.
  const seen = new Set<string>();
  const uniq = list.filter((r) => !seen.has(r.n) && seen.add(r.n));
  if (uniq.length <= kept.length) return null;
  // Adding meals keeps the date the others were made (they still renew on time).
  return { at: onlyNew ? r0!.at : today, lang, key: recipesKey(f), list: uniq };
}

function clean(raw: unknown, type: string, f: FoodPlan): AiRecipe | null {
  const x = raw as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const n = str(x?.n, 70);
  const m = x?.m as Record<string, unknown> | undefined;
  const [p, c, fat] = [Number(m?.p), Number(m?.c), Number(m?.f)];
  const sum = p + c + fat;
  if (!n || !(sum > 50) || [p, c, fat].some((v) => !(v >= 0))) return null;
  const ing = (Array.isArray(x.ing) ? x.ing : [])
    .map((i) => {
      const o = i as Record<string, unknown>;
      const unit = str(o?.unit, 10).toLowerCase();
      const amount = Number(o?.amount);
      return [str(o?.name, 50), amount, unit] as [string, number, string];
    })
    .filter(([name, a, u]) => name && a > 0 && a < 2000 && UNITS.has(u))
    .slice(0, 8);
  const steps = (Array.isArray(x.steps) ? x.steps : []).map((s) => str(s, 200)).filter(Boolean).slice(0, 5);
  if (ing.length < 2 || !steps.length) return null;
  // Never a dish with one of your allergens, even if the AI slipped.
  if (allergensIn([n, ...ing.map((i) => i[0])], f.allergies).length || noteHit([n, ...ing.map((i) => i[0])], f.allergyNote)) return null;
  const r2 = (v: number) => Math.round((v / sum) * 100) / 100;
  return { type, n, m: [r2(p), r2(c), r2(fat)], tag: x.tag === 'Bulk' ? 'Bulk' : 'Cut', min: Math.min(180, Math.max(1, Math.round(Number(x.min) || 15))), ing, steps };
}
