// "High added sugar" is about sugar that was added (sweets, sugary drinks, syrups), not the natural sugar in fruit, dates or plain milk.

const NATURAL =
  /\b(banana|apple|orange|mandarin|clementine|mango|grapes?|dates?|medjool|berr(y|ies)|strawberr\w*|blueberr\w*|raspberr\w*|watermelon|melon|cantaloupe|pear|peach|nectarine|plum|kiwi|pineapple|papaya|figs?|apricots?|cherr(y|ies)|pomegranate|guava|lychee|raisins?|prunes?|fruit|milk|laban|leben|yogh?urt|kefir|labneh)\b|موز|تفاح|برتقال|يوسفي|مانجو|منجا|عنب|تمر|رطب|فراول|توت|بطيخ|شمام|كمثرى|خوخ|دراق|برقوق|كيوي|أناناس|اناناس|بابايا|تين|مشمش|كرز|رمان|جوافة|ليتشي|زبيب|قراصيا|فواكه|فاكهة|حليب|لبن|زبادي|روب|كفير|لبنة/i;
const ADDED =
  /chocolate|flavou?red|sweetened|syrup|sugar|cake|pie|tart|ice ?cream|milkshake|shake|juice|smoothie|jam|jelly|candy|caramel|honey|condensed|dessert|pudding|custard|cookie|biscuit|donut|pastry|croissant|muffin|cereal|granola|bar\b|frappe|latte|mocha|شوكولات|بنكهة|محلى|سكر(?!ي)|كيك|كيكة|آيس|ايس|عصير|سموذي|مربى|حلاو|حلى|كراميل|عسل|مكثف|ميلك ?شيك|بسكوي|دونات|كرواسون|معجنات|حبوب الإفطار|جرانولا|لاتيه|موكا|فرابيه|maamoul|معمول|kleija|كليجا|suntop|سن ?توب|drink|مشروب|vanilla|فانيلا|cocoa|كاكاو|protein milk|حليب بروتين|كعك|بسبوسة/i;

/** Whole fruit, dates or plain milk/yogurt: their sugar is natural, never "added". */
export function naturalSugar(name: string) {
  return NATURAL.test(name) && !ADDED.test(name);
}

/** High added sugar for packaged food read from a label or barcode: about 10 g or more per serving, unless it's plain fruit or milk. */
export function addedSugarHigh(name: string, sugarG: number) {
  return sugarG >= 10 && !naturalSugar(name);
}
