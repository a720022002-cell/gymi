import { foodByBarcode, foodName, myFix } from './foodsDb';
import { type Facts, factsOf, offFacts } from './nutrients';

/** A packaged product found by its barcode. */
export type Product = {
  name: string;
  brand: string;
  image: string | null;
  unit: 'g' | 'ml';
  /** Size of one serving, or the whole pack when there is no serving size. */
  size: number;
  k: number;
  p: number;
  c: number;
  f: number;
  sugar: number;
  /** Where the numbers come from: Open Food Facts, a Adro user who typed the label, or your own fix. */
  src: 'off' | 'user' | 'fix';
  /** The product's id in our food database, when it came from there. */
  id?: string;
  /** Everything the label says, per 100 (see lib/nutrients). */
  facts: Facts;
  /** The ingredient list and allergen tags from the label (Open Food Facts), for allergy warnings. */
  ingredients?: string;
  allergenTags?: string[];
};

type Nutriments = Record<string, number | string | undefined>;

/** Look up a barcode: your own fix, then our food list, then Open Food Facts. Null when nobody knows it. */
export async function lookupProduct(code: string, lang: 'en' | 'ar'): Promise<Product | null> {
  // Your own fix first, then our database (fast, and works when Open Food Facts is down).
  const own = (await myFix(code).catch(() => null)) ?? (await foodByBarcode(code).catch(() => null));
  if (own)
    return {
      name: foodName(own, lang),
      brand: own.brand ?? '',
      image: null,
      unit: own.unit,
      size: Math.round(+own.serving_g || 100),
      k: +own.kcal_100,
      p: +own.protein_100,
      c: +own.carbs_100,
      f: +own.fat_100,
      sugar: +(own.sugar_100 ?? 0),
      src: own.category === 'fix' ? 'fix' : own.source === 'user' ? 'user' : 'off',
      id: own.id,
      facts: factsOf(own),
    };
  const fields = 'product_name,product_name_ar,product_name_en,brands,quantity,serving_quantity,nutriments,image_front_small_url,ingredients_text,ingredients_text_ar,ingredients_text_en,allergens_tags,traces_tags';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`);
  if (!res.ok) return null;
  const j = await res.json();
  const x = j?.product;
  const n: Nutriments = x?.nutriments ?? {};
  const kcal = +(n['energy-kcal_100g'] ?? 0) || +(n['energy_100g'] ?? 0) / 4.184;
  const name = (lang === 'ar' && x?.product_name_ar) || x?.product_name || x?.product_name_en || x?.product_name_ar;
  if (j?.status !== 1 || !name || !kcal) return null;
  const q = String(x.quantity ?? '').toLowerCase();
  const unit = /\d\s*(ml|cl|l)\b/.test(q) ? 'ml' : 'g';
  const m = q.match(/([\d.,]+)\s*(ml|cl|l|kg|g)\b/);
  let pack = m ? parseFloat(m[1].replace(',', '.')) * ({ ml: 1, cl: 10, l: 1000, kg: 1000, g: 1 } as Record<string, number>)[m[2]] : 0;
  if (!(pack > 0) || pack > 5000) pack = 0;
  const serving = +(x.serving_quantity ?? 0);
  return {
    name: String(name).trim(),
    brand: String(x.brands ?? '').split(',')[0].trim(),
    image: x.image_front_small_url ?? null,
    unit,
    size: Math.round(serving > 0 && serving < 2000 ? serving : pack || 100),
    k: kcal,
    p: +(n.proteins_100g ?? 0),
    c: +(n.carbohydrates_100g ?? 0),
    f: +(n.fat_100g ?? 0),
    sugar: +(n.sugars_100g ?? 0),
    src: 'off',
    facts: { ...offFacts(n), kcal },
    ingredients: [x.ingredients_text, x.ingredients_text_ar, x.ingredients_text_en].filter(Boolean).join(' | ').slice(0, 4000),
    // "May contain" (traces) counts too: for an allergy that's still a risk.
    allergenTags: [...(x.allergens_tags ?? []), ...(x.traces_tags ?? [])].filter((v: unknown) => typeof v === 'string'),
  };
}

