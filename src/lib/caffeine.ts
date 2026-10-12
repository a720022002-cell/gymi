// Caffeine guessed from what you log, so Gymi can warn you about a big dose. Numbers are typical servings (mg).
import { useSyncExternalStore } from 'react';

/** Usual safe amounts for healthy adults: up to 400 mg a day, about 200 mg at once. */
export const CAFFEINE_DAY = 400;
export const CAFFEINE_ONCE = 200;

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

export type CaffeineAlert = { once: number; day: number; late: boolean };

/** Should logging this item warn you? Once: a big single dose. Day: today's total just went past the daily amount. */
export function caffeineCheck(name: string, dayLogNames: string[], late: boolean): CaffeineAlert | null {
  const once = caffeineOf(name);
  if (!once) return null;
  const before = dayLogNames.reduce((a, x) => a + caffeineOf(x), 0);
  const day = before + once;
  if (once > CAFFEINE_ONCE || (day > CAFFEINE_DAY && before <= CAFFEINE_DAY)) return { once, day, late };
  return null;
}

// The warning sheet is mounted once at the root; anything that logs food can show it.
let current: CaffeineAlert | null = null;
const listeners = new Set<() => void>();
export function showCaffeineAlert(a: CaffeineAlert | null) {
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
