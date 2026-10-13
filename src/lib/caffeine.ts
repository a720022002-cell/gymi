// Caffeine guessed from what you log, so Gymi can warn you about a big dose. Numbers are typical servings (mg).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { localDay } from './nutrition';

/** Usual safe amounts for healthy adults: up to 400 mg a day, about 200 mg at once. */
export const CAFFEINE_DAY = 400;
export const CAFFEINE_ONCE = 200;
/** In pregnancy the usual advice is up to 200 mg a day. */
export const CAFFEINE_DAY_PREG = 200;

// Today's daily limit: FoodProvider sets it to 200 mg in pregnancy mode, so every caffeine check uses it.
let dayLimit = CAFFEINE_DAY;
export const caffeineDayLimit = () => dayLimit;
export function setCaffeinePregnant(on: boolean) {
  dayLimit = on ? CAFFEINE_DAY_PREG : CAFFEINE_DAY;
}

// First match wins, so the specific drinks come before the general ones.
const DRINKS: [RegExp, number][] = [
  [/decaf|منزوع|بدون كافيين|ديكاف/i, 0],
  // Coffee-flavoured food, not a drink.
  [/cake|كيك|ice ?cream|آيس ?كريم|ايس ?كريم|cookie|كوكيز|بسكويت|tiramisu|تيراميسو|chocolate|شوكولات/i, 0],
  [/caffeine (pill|tablet)|حبوب كافيين|حبة كافيين/i, 200],
  [/pre.?workout|بري ?ورك ?(اوت|آوت)|بريورك/i, 200],
  [/monster|مونستر|bang\b|reign|c4 energy/i, 160],
  [/red ?bull|ريد ?بول|code ?red|كود ?ريد|power ?horse|باور ?هورس|energy drink|مشروب طاقة|مشروب الطاقة/i, 80],
  [/cold ?brew|كولد ?برو/i, 200],
  [/americano|أمريكانو|امريكانو/i, 150],
  [/v60|drip|filter coffee|pour.?over|مقطرة|فلتر|كيمكس|chemex/i, 150],
  [/latte|لاتيه|لاتي|cappuccino|كابتشينو|كابوتشينو|flat ?white|فلات ?وايت|cortado|كورتادو|mocha|موكا|macchiato|ماكياتو|spanish|سبانش/i, 130],
  [/iced coffee|آيس كوفي|ايس كوفي|قهوة مثلجة|frappuccino|فرابتشينو/i, 120],
  [/espresso|إسبريسو|اسبريسو|اسبرسو/i, 65],
  [/nescaf|نسكافيه|نسكافه|instant coffee|قهوة سريعة|3 ?in ?1|ثري ان ون/i, 65],
  [/turkish coffee|قهوة تركي/i, 60],
  [/arabic coffee|saudi coffee|qahwa|قهوة عربي|قهوة سعودي|قهوة سعوديه|فنجال|فنجان قهوة|دلة/i, 30],
  [/coffee|قهوة|قهوه|كوفي/i, 95],
  [/matcha|ماتشا/i, 70],
  [/karak|كرك/i, 50],
  [/green tea|شاي أخضر|شاي اخضر/i, 30],
  [/\btea\b|شاي/i, 40],
  [/cola|coke|pepsi|كولا|بيبسي|كوكاكولا|كوكا|dr ?pepper/i, 35],
];

/** Guessed caffeine (mg) in one logged item, from its name: "Large latte ×2" or "2 large lattes" is 2 large lattes,
 * and "Latte, croissant" adds up each part. */
export function caffeineOf(name: string): number {
  return name.split(/[,،+&]| and | with | مع /i).reduce((a, part) => a + oneDrink(part), 0);
}

function oneDrink(part: string): number {
  const n = part.trim();
  const hit = DRINKS.find(([re]) => re.test(n));
  if (!hit || !hit[1]) return 0;
  let mg = hit[1];
  if (/double|دبل|دوبل|doppio/i.test(n)) mg *= 2;
  else if (/triple|تريبل/i.test(n)) mg *= 3;
  if (/large|grande|venti|كبير|لارج/i.test(n)) mg *= 1.5;
  else if (/small|short|صغير|سمول/i.test(n)) mg *= 0.7;
  const times = n.match(/[×x]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*[×x]|^(\d+)\s+(?!ml|مل|g\b|oz|in\b|ان\b)/i);
  const count = times ? Number(times[1] ?? times[2] ?? times[3]) : NaN;
  if (count > 0 && count <= 10) mg *= count;
  return Math.round(mg);
}

/** Coffee or tea logged on the Water screen, by amount: brewed coffee about 40 mg per 100 ml, tea about 20. */
export function caffeineOfDrink(kind: string, ml: number) {
  return Math.round(ml * (kind === 'Coffee' ? 0.4 : kind === 'Tea' ? 0.2 : 0));
}

/** Caffeine so far today: food you logged (by name) plus coffee and tea on the Water screen. */
export function caffeineToday(foodNames: string[], drinks: { kind: string; ml: number }[]) {
  return foodNames.reduce((a, x) => a + caffeineOf(x), 0) + drinks.reduce((a, d) => a + caffeineOfDrink(d.kind, d.ml), 0);
}

/** max: the daily limit used (400 mg, or 200 mg in pregnancy). */
export type CaffeineAlert = { once: number; day: number; late: boolean; max?: number };

/** Should this drink warn you? Once: a big single dose (mg). Day: today's total just went past the daily amount. */
export function caffeineCheck(once: number, before: number, late: boolean, max = dayLimit): CaffeineAlert | null {
  if (!once) return null;
  const day = before + once;
  if (once > CAFFEINE_ONCE || (day > max && before <= max)) return { once, day, late, max };
  return null;
}

// The warning sheet is mounted once at the root; anything that logs food can show it.
let current: CaffeineAlert | null = null;
const listeners = new Set<() => void>();
// "Don't remind me today": the day it was tapped, kept on the device.
const MUTE_KEY = 'gymi.caffeineMuted';
let mutedDay: string | null = null;
AsyncStorage.getItem(MUTE_KEY)
  .then((d) => (mutedDay = d))
  .catch(() => {});
export function muteCaffeineToday() {
  mutedDay = localDay();
  AsyncStorage.setItem(MUTE_KEY, mutedDay).catch(() => {});
  showCaffeineAlert(null);
}
export function showCaffeineAlert(a: CaffeineAlert | null) {
  if (a && mutedDay === localDay()) return;
  current = a;
  listeners.forEach((l) => l());
}
export function useCaffeineAlert() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
