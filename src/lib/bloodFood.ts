// Blood markers over time, and food ideas for the ones that came back low (food only, never doses or treatment).
import { allergensIn, noteHit } from './allergies';
import type { BloodTest, BloodValue, Supplement } from './health';

/** The same test across reports, whatever the lab called it ("Vitamin D, 25-OH" and "25-OH Vitamin D" too). */
export const markerKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

export type MarkerPoint = { day: string; value: number; raw: string; unit: string; low: number | null; high: number | null; flag: -1 | 0 | 1 };

/** A value as a number (plain numbers only; "<10" or "Negative" can't be drawn). */
const asNum = (v: BloodValue['value']) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return /^[-+]?\d*\.?\d+$/.test(s) ? Number(s) : null;
};

/** One marker in every saved report, oldest first (only reports with the same unit as the latest one). */
export function markerHistory(blood: BloodTest[], name: string): MarkerPoint[] {
  const key = markerKey(name);
  const all: (MarkerPoint & { at: number })[] = [];
  blood.forEach((b, at) => {
    const v = b.values.find((x) => markerKey(x.name) === key);
    const n = v ? asNum(v.value) : null;
    if (v && n != null) all.push({ at, day: b.day, value: n, raw: String(v.value), unit: v.unit, low: v.low ?? null, high: v.high ?? null, flag: v.flag });
  });
  all.sort((a, b) => a.day.localeCompare(b.day) || b.at - a.at);
  const unit = all.at(-1)?.unit.toLowerCase();
  return all.filter((p) => p.unit.toLowerCase() === unit).map(({ at: _at, ...p }) => p);
}

/** Nutrients food can help with, and the test names that point to them. */
const NUTRIENTS = [
  { key: 'iron', re: /\b(iron|ferritin|fe|serum iron)\b|حديد|فيريتين/i },
  { key: 'vitd', re: /vit(amin)?\s*d|25\s*-?\s*oh|calcidiol|cholecalciferol|فيتامين د/i },
  { key: 'b12', re: /b\s*-?\s*12|cobalamin/i },
  { key: 'folate', re: /folate|folic/i },
  { key: 'calcium', re: /\bcalcium\b|كالسيوم/i },
  { key: 'magnesium', re: /magnesium|مغنيسيوم/i },
] as const;
export type Nutrient = (typeof NUTRIENTS)[number]['key'];

/** Low markers in your latest report that has each one (a newer normal result clears an older low one). */
export function lowNutrients(blood: BloodTest[]): Nutrient[] {
  const seen = new Set<Nutrient>();
  const low = new Set<Nutrient>();
  // Newest report first.
  for (const b of [...blood].sort((x, y) => y.day.localeCompare(x.day)))
    for (const n of NUTRIENTS) {
      if (seen.has(n.key)) continue;
      // Iron binding capacity (TIBC) runs the other way: left out.
      const vs = b.values.filter((v) => n.re.test(v.name) && !/binding|tibc|uibc/i.test(v.name));
      if (!vs.length) continue;
      seen.add(n.key);
      if (vs.some((v) => v.flag < 0)) low.add(n.key);
    }
  return NUTRIENTS.map((n) => n.key).filter((k) => low.has(k));
}

/** The latest result of each marker that's outside its range (for the AI coach). */
export function flaggedMarkers(blood: BloodTest[]) {
  const seen = new Set<string>();
  const out: { name: string; value: string; unit: string; flag: 'low' | 'high'; day: string }[] = [];
  for (const b of [...blood].sort((x, y) => y.day.localeCompare(x.day)))
    for (const v of b.values) {
      const k = markerKey(v.name);
      if (seen.has(k)) continue;
      seen.add(k);
      if (v.flag) out.push({ name: v.name, value: String(v.value), unit: v.unit, flag: v.flag < 0 ? 'low' : 'high', day: b.day });
    }
  return out.slice(0, 15);
}

/** Food ideas per low nutrient: the first one without your allergens is used. English keys, translated by t(). */
const FOOD_TIPS: Record<Nutrient, [string[], string][]> = {
  iron: [
    [['red meat', 'beef', 'lentils', 'spinach'], 'Your iron was low on your last test. Add red meat, lentils or spinach, with some vitamin C like orange or peppers. Check with your doctor.'],
    [['lentils', 'chickpeas', 'spinach'], 'Your iron was low on your last test. Add lentils, chickpeas or spinach, with some vitamin C like orange or peppers. Check with your doctor.'],
  ],
  vitd: [
    [['eggs', 'salmon', 'sardines'], 'Your vitamin D was low on your last test. Eggs, salmon and sardines help, and a bit of sun. Check with your doctor.'],
    [['mushrooms'], 'Your vitamin D was low on your last test. A bit of sun and mushrooms help. Check with your doctor.'],
  ],
  b12: [
    [['eggs', 'fish', 'meat', 'milk'], 'Your B12 was low on your last test. Eggs, fish, meat and dairy have it. Check with your doctor.'],
    [['meat', 'chicken'], 'Your B12 was low on your last test. Meat and chicken have it. Check with your doctor.'],
  ],
  folate: [[['spinach', 'beans', 'lentils'], 'Your folate was low on your last test. Add leafy greens, beans and lentils. Check with your doctor.']],
  calcium: [
    [['laban', 'yogurt', 'cheese', 'milk'], 'Your calcium was low on your last test. Laban, yogurt and cheese help. Check with your doctor.'],
    [['sardines', 'almonds', 'tahini'], 'Your calcium was low on your last test. Sardines, almonds and tahini help. Check with your doctor.'],
  ],
  magnesium: [
    [['nuts', 'almonds', 'seeds', 'dates'], 'Your magnesium was low on your last test. Nuts, seeds, beans and dates help. Check with your doctor.'],
    [['beans', 'dates', 'oats'], 'Your magnesium was low on your last test. Beans, dates and oats help. Check with your doctor.'],
  ],
};

/** Supplement habits that go with food (no doses). */
const SUP_TIPS: [RegExp, string][] = [
  [/iron|حديد/i, 'Taking iron? Have it with some vitamin C, away from tea, coffee and milk.'],
  [/vit(amin)?\s*d|فيتامين د/i, 'Taking vitamin D? Have it with a meal that has some fat.'],
  [/creatine|كرياتين/i, 'Taking creatine? Drink a bit more water through the day.'],
];

/**
 * Short food tips from your low blood markers, then from the supplements you take. English keys for t().
 * Tips that only list foods you're allergic to are left out.
 */
export function healthFoodTips(blood: BloodTest[], sups: Supplement[], allergies?: string[], allergyNote?: string): { key: Nutrient | 'sup'; text: string }[] {
  const safe = (foods: string[]) => !allergensIn(foods, allergies).length && !noteHit(foods, allergyNote);
  const out: { key: Nutrient | 'sup'; text: string }[] = [];
  for (const n of lowNutrients(blood)) {
    const tip = FOOD_TIPS[n].find(([foods]) => safe(foods));
    if (tip) out.push({ key: n, text: tip[1] });
  }
  const active = sups.filter((s) => s.active);
  for (const [re, text] of SUP_TIPS) if (active.some((s) => re.test(s.name))) out.push({ key: 'sup', text });
  return out;
}

/** Nutrients to favour in AI meal ideas (plain English, for the AI). */
export const FOCUS_WORDS: Record<Nutrient, string> = { iron: 'iron', vitd: 'vitamin D', b12: 'vitamin B12', folate: 'folate', calcium: 'calcium', magnesium: 'magnesium' };
