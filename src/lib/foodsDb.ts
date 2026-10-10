import { supabase } from './supabase';

export type Part = { key: string; en: string; ar: string; g: number; k: number; p: number; c: number; f: number };

export type DbFood = {
  id: string;
  source: 'usda' | 'gymi';
  category: 'basic' | 'gulf' | 'rest' | 'usda';
  name_en: string;
  name_ar: string | null;
  restaurant: string | null;
  serving_en: string | null;
  serving_ar: string | null;
  serving_g: number;
  unit: 'g' | 'ml';
  kcal_100: number;
  protein_100: number;
  carbs_100: number;
  fat_100: number;
  sugar_100: number | null;
  parts: Part[] | null;
  sugar_high: boolean;
  fat_high: boolean;
  is_estimate: boolean;
};

export async function searchFoods(q: string, category: string | null, limit = 40): Promise<DbFood[]> {
  const { data, error } = await supabase.rpc('search_foods', { p_query: q, p_category: category, p_limit: limit });
  if (error) return [];
  return (data as DbFood[]).map((f) => ({
    ...f,
    serving_g: +f.serving_g,
    kcal_100: +f.kcal_100,
    protein_100: +f.protein_100,
    carbs_100: +f.carbs_100,
    fat_100: +f.fat_100,
    sugar_100: f.sugar_100 == null ? null : +f.sugar_100,
  }));
}

export const foodName = (f: DbFood, lang: 'en' | 'ar') => (lang === 'ar' && f.name_ar) || f.name_en;
export const servingLabel = (f: DbFood, lang: 'en' | 'ar') => (lang === 'ar' && f.serving_ar) || f.serving_en || `${f.serving_g} ${f.unit}`;

/** Calories and macros for a number of grams. */
export function forGrams(f: DbFood, g: number) {
  const m = g / 100;
  return { k: f.kcal_100 * m, p: f.protein_100 * m, c: f.carbs_100 * m, f: f.fat_100 * m, sugar: (f.sugar_100 ?? 0) * m };
}

/** Totals for a dish made of parts with grams the user set. */
export function partsTotal(parts: Part[]) {
  return parts.reduce(
    (a, x) => ({ k: a.k + (x.k * x.g) / 100, p: a.p + (x.p * x.g) / 100, c: a.c + (x.c * x.g) / 100, f: a.f + (x.f * x.g) / 100, g: a.g + x.g }),
    { k: 0, p: 0, c: 0, f: 0, g: 0 },
  );
}
