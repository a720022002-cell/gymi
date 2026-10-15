// Food allergies: asked once in the food setup, then kept out of every meal the app or the AI suggests.

/** The common allergens. `re` finds them in a food or ingredient name (English and Arabic). */
export const ALLERGENS = [
  { key: 'peanuts', en: 'Peanuts', re: /peanut|فول سوداني|فستق عبيد/i },
  { key: 'nuts', en: 'Tree nuts', re: /almond|walnut|cashew|pistachio|hazelnut|pecan|macadamia|\bnuts?\b|(?<!pea)nut butter|praline|marzipan|pesto|baklava|kunafa|knafeh|بقلاوة|كنافة|لوز|جوز|كاجو|فستق|بندق|مكسرات/i },
  { key: 'dairy', en: 'Milk and dairy', re: /milk|cheese|yogh?urt|laban|labneh|(?<!(?:nut|almond|cashew|peanut|seed) )butter(?!nut)|cream|whey|ghee|halloumi|feta|mozzarella|parmesan|paneer|casein|pesto|alfredo|bechamel|béchamel|tzatziki|ice cream|kunafa|knafeh|كنافة|بشاميل|آيس كريم|حليب|جبن|زبادي|لبن|لبنة|زبدة|قشطة|كريمة|سمن|حلوم/i },
  { key: 'eggs', en: 'Eggs', re: /\beggs?\b|omelet|mayonnaise|mayo|aioli|shakshuka|بيض|عجة|شكشوكة|مايونيز/i },
  { key: 'gluten', en: 'Wheat and gluten', re: /bread|toast|wheat|flour|pasta|spaghetti|macaroni|noodle|\boats?\b|oatmeal|barley|bulgur|burghul|freekeh|couscous|tortilla|wrap|samoon|pita|bagel|cracker|cereal|granola|semolina|vermicelli|balaleet|شعيرية|بلاليط|baklava|kunafa|knafeh|بقلاوة|كنافة|خبز|توست|قمح|طحين|مكرونة|معكرونة|شوفان|شعير|برغل|فريكة|كسكس|صامولي|تورتيلا|جريش|هريس|سميد/i },
  { key: 'fish', en: 'Fish', re: /fish|salmon|tuna|hamour|sardine|cod|tilapia|mackerel|anchov|سمك|سلمون|تونة|هامور|سردين|بلطي|ماكريل|أنشوجة/i },
  { key: 'shellfish', en: 'Shellfish', re: /shrimp|prawn|crab|lobster|oyster|mussel|clam|scallop|calamari|squid|ربيان|روبيان|جمبري|سلطعون|استاكوزا|محار|بلح البحر|حبار|كاليماري/i },
  { key: 'sesame', en: 'Sesame', re: /sesame|tahini|tahina|hummus|halva|halawa|سمسم|طحينة|طحينه|حمص بطحينة|حلاوة طحينية/i },
  { key: 'soy', en: 'Soy', re: /\bsoy|soya|tofu|edamame|tempeh|miso|صويا|توفو|ادامامي/i },
] as const;
export type AllergenKey = (typeof ALLERGENS)[number]['key'];

/** Which of your allergens a food contains (from its name and its ingredient names). */
export function allergensIn(texts: string[], keys: readonly string[] | undefined): AllergenKey[] {
  if (!keys?.length) return [];
  const s = texts.join(' | ');
  return ALLERGENS.filter((a) => keys.includes(a.key) && a.re.test(s)).map((a) => a.key);
}

/** Your allergies as words for the AI (with anything you wrote yourself). */
export function allergiesText(keys: readonly string[] | undefined, note?: string) {
  const list = ALLERGENS.filter((a) => keys?.includes(a.key)).map((a) => a.en.toLowerCase());
  const extra = (note ?? '').trim().slice(0, 200);
  return [...list, ...(extra ? [extra] : [])].join(', ');
}
