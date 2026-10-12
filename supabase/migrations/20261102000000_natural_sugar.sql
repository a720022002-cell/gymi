-- "High added sugar" is about added sugar. Whole fruit, dates and fresh orange juice only have natural sugar.
update public.foods set sugar_high = false
where category = 'basic' and name_en in ('Apple', 'Dates', 'Dates (Medjool)', 'Grapes', 'Mango', 'Raisins', 'Orange juice, fresh');

-- Past logs flagged by the old "total sugar" rule: plain fruit, dates and plain milk or yogurt.
update public.food_logs set sugar_high = false
where sugar_high
  and name ~* '(banana|apple|orange|mandarin|mango|grape|date|medjool|berr|watermelon|melon|pear|peach|plum|kiwi|pineapple|papaya|fig|apricot|cherr|pomegranate|guava|raisin|prune|milk|laban|leben|yogurt|yoghurt|kefir|موز|تفاح|برتقال|مانجو|منجا|عنب|تمر|رطب|فراول|توت|بطيخ|شمام|كمثرى|خوخ|كيوي|اناناس|أناناس|تين|مشمش|كرز|رمان|جوافة|زبيب|حليب|لبن|زبادي|روب)'
  and name !~* '(chocolate|flavou?red|sweetened|syrup|sugar|cake|pie|tart|ice ?cream|shake|juice|smoothie|jam|jelly|candy|caramel|honey|condensed|dessert|pudding|custard|cookie|biscuit|donut|pastry|croissant|muffin|cereal|granola|latte|mocha|frapp|شوكولات|بنكهة|محلى|سكر(?!ي)|كيك|آيس|ايس|عصير|سموذي|مربى|حلاو|حلى|كراميل|عسل|مكثف|شيك|بسكوي|دونات|كرواسون|معجنات|لاتيه|موكا|maamoul|معمول|kleija|كليجا|suntop|سن ?توب|drink|مشروب|vanilla|فانيلا|بالفانيلا|cocoa|كاكاو|protein milk|حليب بروتين|كعك|بسبوسة)';
