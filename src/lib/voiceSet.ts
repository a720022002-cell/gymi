/** Understand a spoken set like "Bench 80 kilos, 10 reps" or "بنش ٨٠ كيلو ١٠ عدات" (design: voiceSet). */

const EN_UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const AR_UNITS: Record<string, number> = {
  واحد: 1, وحدة: 1, اثنين: 2, اثنان: 2, ثنتين: 2, ثلاث: 3, ثلاثة: 3, اربع: 4, اربعة: 4, خمس: 5, خمسة: 5, ست: 6, ستة: 6,
  سبع: 7, سبعة: 7, ثمان: 8, ثمانية: 8, ثمانيه: 8, تسع: 9, تسعة: 9, عشر: 10, عشرة: 10, عشره: 10,
  احدعش: 11, اطنعش: 12, اثنعش: 12, ثلطعش: 13, خمسطعش: 15, عشرين: 20, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60,
  سبعين: 70, ثمانين: 80, تسعين: 90, مية: 100, مئة: 100, مائة: 100, ميه: 100,
};

/** Turn spoken numbers into digits: "eighty five" → 85, "twelve and a half" → 12.5, "٨٠" → 80. */
export function wordsToNumbers(text: string) {
  let s = text
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٫,](?=\d)/g, '.')
    .replace(/[أإآ]/g, 'ا')
    .replace(/(\d)\s*(kg|kgs)\b/g, '$1 kg');
  const words = s.split(/\s+/);
  const out: string[] = [];
  let acc: number | null = null;
  const flush = () => {
    if (acc !== null) out.push(String(acc));
    acc = null;
  };
  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    const w = raw.replace(/[.,!?،]/g, '');
    const bare = w.replace(/^و/, '');
    const v = EN_UNITS[w] ?? EN_TENS[w] ?? AR_UNITS[w] ?? (w !== bare ? AR_UNITS[bare] : undefined);
    if (v !== undefined) {
      if (v === 100 && acc !== null && acc < 10) acc *= 100;
      else if (acc !== null && acc >= 20 && acc % 10 === 0 && v < 10) acc += v; // "eighty five"
      else if (acc !== null && acc < 10 && v >= 20 && v < 100 && w !== bare) acc += v; // "خمسة وثمانين"
      else {
        flush();
        acc = v;
      }
      continue;
    }
    if (w === 'hundred' && acc !== null) {
      acc *= 100;
      continue;
    }
    if (acc !== null && (w === 'and' || w === 'a') && /^(a|half)$/.test(words[i + 1] ?? '')) continue;
    if (acc !== null && (w === 'half' || w === 'ونص')) {
      acc += 0.5;
      continue;
    }
    if ((w === 'point' || w === 'فاصلة') && acc !== null && /^\d$/.test(words[i + 1] ?? '')) {
      acc = parseFloat(`${acc}.${words[i + 1]}`);
      i++;
      continue;
    }
    flush();
    out.push(raw);
  }
  flush();
  s = out.join(' ');
  return s;
}

const WEIGHT = /(\d+(?:\.\d+)?)\s*(kg|kilo|kilos|kilograms?|kgs|كيلو|كيلوات|كيلوغرام|كغ|ك)(?![a-z؀-ۿ])/;
const POUNDS = /(\d+(?:\.\d+)?)\s*(pounds?|lbs?|باوند)(?![a-z])/;
const REPS = /(\d+)\s*(reps?|repetitions?|times|عدة|عدات|عده|تكرار|تكرارات|مرات|مرة|مره)(?![a-z])/;
const REPS_BEFORE = /(reps?|عدات|تكرار)\s*(\d+)/;

/** Weight and reps from what was said. Either can be missing. */
export function parseSet(text: string): { w: number | null; r: number | null; said: string } {
  const s = wordsToNumbers(text);
  let w: number | null = null;
  let r: number | null = null;
  const mw = s.match(WEIGHT);
  const mp = s.match(POUNDS);
  if (mw) w = parseFloat(mw[1]);
  else if (mp) w = Math.round((parseFloat(mp[1]) * 0.4536) / 0.5) * 0.5;
  const mr = s.match(REPS) ?? s.match(REPS_BEFORE);
  if (mr) r = parseInt(mr[1] && /\d/.test(mr[1]) ? mr[1] : mr[2], 10);
  // Plain numbers: "80 10" = 80 kg × 10; one number alone is reps if small, else weight.
  const nums = (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n !== w && n !== r);
  if (w === null && r === null && nums.length >= 2) [w, r] = [nums[0], Math.round(nums[1])];
  else if (w === null && r !== null && nums.length) w = nums[0];
  else if (r === null && w !== null && nums.length) r = Math.round(nums[0]);
  else if (w === null && r === null && nums.length === 1) {
    if (nums[0] <= 30 && Number.isInteger(nums[0])) r = nums[0];
    else w = nums[0];
  }
  if (w !== null && (w < 0 || w > 500)) w = null;
  if (r !== null && (r <= 0 || r > 300)) r = null;
  return { w, r, said: text };
}

/** Which exercise was named: the one whose name shares the most words with what was said. */
export function matchExercise(text: string, names: string[]) {
  const said = text.toLowerCase();
  let best = -1;
  let score = 0;
  names.forEach((n, i) => {
    const words = n
      .toLowerCase()
      .split(/[\s-]+/)
      .filter((x) => x.length > 2 && !['press', 'machine', 'the'].includes(x));
    const hit = words.filter((x) => said.includes(x)).length + (said.includes(n.toLowerCase()) ? 2 : 0);
    if (hit > score) {
      score = hit;
      best = i;
    }
  });
  return best;
}
