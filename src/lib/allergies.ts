// Food allergies: asked once in the food setup, then kept out of every meal the app or the AI suggests.

type Allergen = {
  key: string;
  en: string;
  /** English words (a regex, case-insensitive). */
  words: RegExp;
  /** Arabic words. Each matches as a whole word, with the usual prefixes (و ب ف ل ك, ال): "بيض" finds "بالبيض" but not "أبيض". */
  ar: string[];
  /** Phrases that look like the allergen but aren't (coconut milk isn't dairy, "جوز الهند" isn't a nut). */
  not?: RegExp;
};

/** The common allergens, matched in food and ingredient names in English and Arabic. */
export const ALLERGENS = [
  {
    key: 'peanuts',
    en: 'Peanuts',
    words: /peanut|groundnut|satay/i,
    ar: ['فول\\s*(?:ال)?سوداني', 'فستق\\s*(?:ال)?عبيد'],
  },
  {
    key: 'nuts',
    en: 'Tree nuts',
    words: /almond|walnut|cashew|pistachio|hazelnut|pecan|macadamia|brazil nut|pine ?nut|\bnuts?\b|(?<!pea)nut butter|nutella|praline|marzipan|pesto|baklava|kunafa|knafeh/i,
    ar: ['لوز', 'جوز', 'عين\\s*جمل', 'كاجو', 'فستق', 'فسدق', 'بندق', 'مكسرات', 'صنوبر', 'نوتيلا', 'بقلاوة', 'كنافة', 'كنافه'],
    not: /coconut|nutmeg|butternut|جوز\s*(?:ال)?هند|جوزة\s*(?:ال)?طيب|فستق\s*(?:ال)?عبيد/gi,
  },
  {
    key: 'dairy',
    en: 'Milk and dairy',
    words:
      /milk|cheese|cheddar|ricotta|mascarpone|cottage|halloumi|feta|mozzarella|parmesan|paneer|yogh?urt|laban|labneh|kefir|ayran|butter|cream|whey|casein|ghee|custard|curd|gelato|latte|cappuccino|pesto|alfredo|b[eé]chamel|tzatziki|kunafa|knafeh/i,
    ar: ['حليب', 'جبن', 'جبنة', 'جبنه', 'أجبان', 'زبادي', 'لبن', 'لبنة', 'لبنه', 'روب', 'زبدة', 'زبده', 'قشطة', 'قشطه', 'قشدة', 'قشده', 'كريمة', 'كريم', 'سمن', 'حلوم', 'بشاميل', 'مهلبية', 'كاسترد', 'لاتيه', 'كابتشينو', 'شنينة', 'كنافة', 'كنافه', 'واي\\s*بروتين'],
    not: /(?:coconut|almond|oat|soy|soya|rice|cashew) (?:milk|cream|yogh?urt)|(?:cocoa|peanut|almond|cashew|nut|seed|shea|sunflower) butter|butternut|cream of tartar|حليب\s*(?:ال)?(?:جوز\s*(?:ال)?هند|لوز|شوفان|صويا)|زبدة\s*(?:ال)?(?:فول\s*(?:ال)?سوداني|فستق|لوز|كاجو|سمسم|كاكاو)|سمن\s*نباتي|كريمة\s*(?:ال)?(?:جوز\s*(?:ال)?هند)/gi,
  },
  {
    key: 'eggs',
    en: 'Eggs',
    words: /\beggs?\b|omelet|frittata|quiche|carbonara|mayonnaise|mayo|aioli|meringue|custard|shakshuka/i,
    ar: ['بيض', 'بيضة', 'بيضه', 'بيضتين', 'بيضات', 'عجة', 'عجه', 'شكشوكة', 'شكشوكه', 'مايونيز', 'مايونيزي', 'كاسترد', 'منمن', 'مينمن'],
    not: /eggplant/gi,
  },
  {
    key: 'gluten',
    en: 'Wheat and gluten',
    words:
      /bread|toast|wheat|flour|pasta|spaghetti|macaroni|noodle|\boats?\b|oatmeal|barley|\brye\b|spelt|bulgur|burghul|freekeh|couscous|tortilla|(?<!lettuce )wraps?\b|samoon|pita|bagel|\bbuns?\b|naan|roti|chapati|paratha|flatbread|cracker|biscuit|cookie|cake|croissant|pastr(?:y|ies)|pizza|crouton|breadcrumb|panko|seitan|cereal|granola|semolina|vermicelli|balaleet|harees|sambous|samosa|sambusa|fattoush|soy sauce|baklava|kunafa|knafeh|regag/i,
    ar: ['خبز', 'توست', 'قمح', 'طحين', 'دقيق', 'مكرونة', 'مكرونه', 'معكرونة', 'معكرونه', 'باستا', 'شوفان', 'شعير', 'برغل', 'فريكة', 'فريكه', 'كسكس', 'صامولي', 'تميس', 'تورتيلا', 'صاج', 'روتي', 'جريش', 'هريس', 'سميد', 'شعيرية', 'شعيريه', 'بلاليط', 'بقلاوة', 'كنافة', 'كنافه', 'بسكويت', 'كعك', 'كيك', 'فطيرة', 'فطائر', 'معجنات', 'كرواسون', 'بيتزا', 'سمبوسة', 'سمبوسه', 'سمبوسك', 'فتوش', 'رقاق', 'مرقوق', 'مطازيز', 'قرصان', 'لقيمات', 'صلصة\\s*(?:ال)?صويا'],
    not: /rice (?:noodles?|paper|cakes?)|buckwheat|gluten[- ]free/gi,
  },
  {
    key: 'fish',
    en: 'Fish',
    words: /(?<!shell)fish|salmon|tuna|hamm?our|grouper|kingfish|sea ?bass|trout|bream|snapper|halibut|herring|sardine|\bcod\b|tilapia|mackerel|anchov|fish sauce/i,
    ar: ['سمك', 'أسماك', 'اسماك', 'سلمون', 'تونة', 'تونه', 'تونا', 'هامور', 'كنعد', 'سردين', 'بلطي', 'ماكريل', 'أنشوجة', 'انشوجة', 'قاروص', 'زبيدي', 'سبيطي'],
  },
  {
    key: 'shellfish',
    en: 'Shellfish',
    words: /shellfish|shrimp|prawn|crab|lobster|oyster|mussel|clam|scallop|calamari|squid|octopus/i,
    ar: ['ربيان', 'روبيان', 'جمبري', 'قريدس', 'سلطعون', 'كابوريا', 'استاكوزا', 'محار', 'بلح\\s*(?:ال)?بحر', 'حبار', 'كاليماري', 'أخطبوط', 'اخطبوط'],
  },
  {
    key: 'sesame',
    en: 'Sesame',
    words: /sesame|tahini|tahina|hummus|halva|halawa|moutabal|baba ?ghanouj|za'?atar/i,
    ar: ['سمسم', 'طحينة', 'طحينه', 'طحينية', 'طحينيه', 'حمص\\s*(?:ب|بال)?طحينة', 'متبل', 'بابا\\s*غنوج', 'حلاوة\\s*طحينية'],
  },
  {
    key: 'soy',
    en: 'Soy',
    words: /\bsoy|soya|tofu|edamame|tempeh|miso/i,
    ar: ['صويا', 'توفو', 'ادامامي'],
  },
] as const satisfies readonly Allergen[];
export type AllergenKey = (typeof ALLERGENS)[number]['key'];

const AR_LETTER = '[\\u0600-\\u06FF]';
/** One regex per allergen for the Arabic words: whole words, with و ب ف ل ك and ال in front. */
const AR_RE: Record<string, RegExp> = Object.fromEntries(
  ALLERGENS.map((a) => [a.key, new RegExp(`(?<!${AR_LETTER})(?:[وبفلك])?(?:ال|لل)?(?:${a.ar.join('|')})(?!${AR_LETTER})`)]),
);

/** Does a text contain this allergen? */
function has(a: (typeof ALLERGENS)[number], text: string) {
  const s = 'not' in a && a.not ? text.replace(a.not, ' ') : text;
  return a.words.test(s) || AR_RE[a.key].test(s);
}

/** Which of your allergens a food contains (from its name and its ingredient names). */
export function allergensIn(texts: string[], keys: readonly string[] | undefined): AllergenKey[] {
  if (!keys?.length) return [];
  const s = texts.join(' | ').toLowerCase();
  return ALLERGENS.filter((a) => keys.includes(a.key) && has(a, s)).map((a) => a.key);
}

/** Your allergies as words for the AI (with anything you wrote yourself). */
export function allergiesText(keys: readonly string[] | undefined, note?: string) {
  const list = ALLERGENS.filter((a) => keys?.includes(a.key)).map((a) => a.en.toLowerCase());
  const extra = (note ?? '').trim().slice(0, 200);
  return [...list, ...(extra ? [extra] : [])].join(', ');
}
