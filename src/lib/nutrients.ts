import type { DbFood } from './foodsDb';
import { supabase } from './supabase';

/** Everything a nutrition facts label can show, per 100 g (or ml). Sodium, cholesterol and minerals in mg, vitamin D in µg. */
export type FactKey = 'kcal' | 'fat' | 'sat_fat' | 'trans_fat' | 'chol' | 'sodium' | 'carbs' | 'fiber' | 'sugar' | 'added_sugar' | 'protein' | 'vit_d' | 'calcium' | 'iron' | 'potassium' | 'vit_c';
export type Facts = Partial<Record<FactKey, number>>;

type FactInfo = { key: FactKey; label: string; unit: 'kcal' | 'g' | 'mg' | 'µg'; dv?: number; indent?: boolean; bold?: boolean; max: number };

/** Label order, units, daily values (adult, 2,000 kcal) and the highest believable value per 100. */
export const FACTS: FactInfo[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', bold: true, max: 900 },
  { key: 'fat', label: 'Total fat', unit: 'g', dv: 78, bold: true, max: 100 },
  { key: 'sat_fat', label: 'Saturated fat', unit: 'g', dv: 20, indent: true, max: 100 },
  { key: 'trans_fat', label: 'Trans fat', unit: 'g', indent: true, max: 100 },
  { key: 'chol', label: 'Cholesterol', unit: 'mg', dv: 300, bold: true, max: 3000 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300, bold: true, max: 40000 },
  { key: 'carbs', label: 'Total carbs', unit: 'g', dv: 275, bold: true, max: 100 },
  { key: 'fiber', label: 'Fiber', unit: 'g', dv: 28, indent: true, max: 100 },
  { key: 'sugar', label: 'Total sugars', unit: 'g', indent: true, max: 100 },
  { key: 'added_sugar', label: 'Added sugars', unit: 'g', dv: 50, indent: true, max: 100 },
  { key: 'protein', label: 'Protein', unit: 'g', dv: 50, bold: true, max: 100 },
  { key: 'vit_d', label: 'Vitamin D', unit: 'µg', dv: 20, max: 1000 },
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300, max: 5000 },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: 18, max: 500 },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700, max: 10000 },
  { key: 'vit_c', label: 'Vitamin C', unit: 'mg', dv: 90, max: 5000 },
];

/** The ones kept in foods.nutrients (the rest have their own columns). */
export const EXTRA_KEYS: FactKey[] = ['sat_fat', 'trans_fat', 'chol', 'added_sugar', 'vit_d', 'calcium', 'iron', 'potassium', 'vit_c'];

/** Only known keys with believable numbers. */
export function cleanFacts(x: unknown): Facts {
  const out: Facts = {};
  if (!x || typeof x !== 'object') return out;
  for (const f of FACTS) {
    const v = Number((x as Record<string, unknown>)[f.key]);
    if ((x as Record<string, unknown>)[f.key] != null && Number.isFinite(v) && v >= 0 && v <= f.max) out[f.key] = Math.round(v * 1000) / 1000;
  }
  return out;
}

/** A food's facts per 100 from the food list, with the ones you added yourself on top of the gaps. */
export function factsOf(f: DbFood, mine?: Facts | null): Facts {
  const base: Facts = {
    kcal: +f.kcal_100,
    protein: +f.protein_100,
    carbs: +f.carbs_100,
    fat: +f.fat_100,
    ...(f.sugar_100 != null ? { sugar: +f.sugar_100 } : {}),
    ...(f.fiber_100 != null ? { fiber: +f.fiber_100 } : {}),
    ...(f.sodium_100 != null ? { sodium: +f.sodium_100 } : {}),
    ...cleanFacts(f.nutrients),
  };
  return withMine(base, mine);
}

/** Your own numbers only fill what's missing; they never replace the food list's. */
export const withMine = (base: Facts, mine?: Facts | null): Facts => ({ ...cleanFacts(mine), ...base });

type Nutriments = Record<string, number | string | undefined>;
/** Open Food Facts gives everything per 100 g in grams; turn it into label units. */
export function offFacts(n: Nutriments | null | undefined): Facts {
  if (!n) return {};
  const g = (k: string, scale = 1) => {
    const v = n[`${k}_100g`];
    return v == null || v === '' || !Number.isFinite(+v) ? undefined : +v * scale;
  };
  const kcal = g('energy-kcal') ?? (g('energy') != null ? (g('energy') as number) / 4.184 : undefined);
  return cleanFacts({
    kcal,
    fat: g('fat'),
    sat_fat: g('saturated-fat'),
    trans_fat: g('trans-fat'),
    chol: g('cholesterol', 1000),
    sodium: g('sodium', 1000) ?? (g('salt') != null ? (g('salt') as number) * 400 : undefined),
    carbs: g('carbohydrates'),
    fiber: g('fiber'),
    sugar: g('sugars'),
    added_sugar: g('added-sugars'),
    protein: g('proteins'),
    vit_d: g('vitamin-d', 1e6),
    calcium: g('calcium', 1000),
    iron: g('iron', 1000),
    potassium: g('potassium', 1000),
    vit_c: g('vitamin-c', 1000),
  });
}

/** Full facts for a barcode from Open Food Facts (empty when it isn't there or the site is down). */
export async function offFactsFor(code: string): Promise<Facts> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=nutriments`);
    if (!res.ok) return {};
    const j = await res.json();
    return j?.status === 1 ? offFacts(j.product?.nutriments) : {};
  } catch {
    return {};
  }
}

/** Key for the facts you add yourself: the food's id, or the barcode for a product that isn't in the food list. */
export const factsKey = (foodId?: string | null, barcode?: string | null) => (foodId ? foodId : barcode ? `bc:${barcode}` : null);

/** The facts you added yourself for one food. */
export async function myFacts(key: string): Promise<Facts | null> {
  const { data } = await supabase.from('food_facts_mine').select('nutrients').eq('food_key', key).maybeSingle();
  return data ? cleanFacts((data as { nutrients: unknown }).nutrients) : null;
}

export async function saveMyFacts(key: string, facts: Facts) {
  const { error } = await supabase.from('food_facts_mine').upsert({ food_key: key, nutrients: cleanFacts(facts), updated_at: new Date().toISOString() }, { onConflict: 'user_id,food_key' });
  return !error;
}

/** Only the extra facts (for foods.nutrients when you save a product). */
export const extraFacts = (x: Facts): Facts => Object.fromEntries(EXTRA_KEYS.filter((k) => x[k] != null).map((k) => [k, x[k]])) as Facts;

/** A value for display: grams with one decimal under 10, whole numbers otherwise. */
export function fmtFact(v: number, unit: string) {
  if (unit === 'mg' || unit === 'kcal') return String(Math.round(v));
  const r = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return String(r);
}
