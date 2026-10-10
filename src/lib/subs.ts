// Ingredient swaps with similar calories (from the design file, SUBS).
// [keywords, [[name, amount factor, unit], ...]]
export const SUBS: [string[], [string, number, string][]][] = [
  [
    ['egg white'],
    [
      ['Whole eggs', 0.0125, 'large'],
      ['Cottage cheese', 1, 'g'],
      ['Greek yogurt', 1.1, 'g'],
    ],
  ],
  [
    ['egg'],
    [
      ['Egg whites', 50, 'g'],
      ['Firm tofu', 40, 'g'],
      ['Cottage cheese', 50, 'g'],
    ],
  ],
  [
    ['chicken'],
    [
      ['Turkey breast', 1, 'g'],
      ['Lean beef', 0.8, 'g'],
      ['Canned tuna', 1, 'g'],
      ['Firm tofu', 1.4, 'g'],
    ],
  ],
  [
    ['fish', 'hamour', 'salmon'],
    [
      ['Chicken breast', 1, 'g'],
      ['Shrimp', 1.1, 'g'],
      ['Canned tuna', 1, 'g'],
    ],
  ],
  [
    ['beef', 'lamb', 'patty', 'mince'],
    [
      ['Chicken thigh', 1.1, 'g'],
      ['Turkey mince', 1.1, 'g'],
      ['Lentils (cooked)', 2, 'g'],
    ],
  ],
  [
    ['rice', 'bulgur'],
    [
      ['Bulgur (raw)', 1, 'g'],
      ['Quinoa (raw)', 1, 'g'],
      ['Potatoes', 3.5, 'g'],
      ['Whole wheat pasta (raw)', 1, 'g'],
    ],
  ],
  [
    ['pasta'],
    [
      ['Basmati rice (raw)', 1, 'g'],
      ['Quinoa (raw)', 1, 'g'],
    ],
  ],
  [
    ['potato'],
    [
      ['Sweet potato', 1, 'g'],
      ['Basmati rice (raw)', 0.3, 'g'],
    ],
  ],
  [
    ['labneh'],
    [
      ['Cottage cheese', 1.3, 'g'],
      ['Greek yogurt', 1.6, 'g'],
      ['Hummus', 0.8, 'g'],
    ],
  ],
  [
    ['yogurt', 'laban', 'cottage'],
    [
      ['Laban', 1.2, 'ml'],
      ['Skyr', 1, 'g'],
      ['Cottage cheese', 0.9, 'g'],
    ],
  ],
  [
    ['whey'],
    [
      ['Greek yogurt', 200, 'g'],
      ['Milk', 400, 'ml'],
      ['Cottage cheese', 150, 'g'],
    ],
  ],
  [
    ['toast', 'bread', 'bun'],
    [
      ['Rice cakes', 1, 'pieces'],
      ['Oats', 18, 'g'],
      ['Arabic bread', 0.35, 'small'],
    ],
  ],
  [
    ['oat'],
    [
      ['Whole wheat toast', 0.045, 'slices'],
      ['Granola', 0.8, 'g'],
    ],
  ],
  [
    ['olive oil', 'ghee', 'oil'],
    [
      ['Avocado', 5, 'g'],
      ['Butter', 0.9, 'g'],
      ['Tahini', 1, 'g'],
    ],
  ],
  [
    ['peanut butter'],
    [
      ['Almond butter', 1, 'g'],
      ['Tahini', 1, 'g'],
    ],
  ],
  [
    ['banana'],
    [
      ['Dates', 3, 'pieces'],
      ['Apple', 1, 'medium'],
    ],
  ],
  [
    ['date'],
    [
      ['Banana', 0.3, 'medium'],
      ['Honey', 5, 'g'],
    ],
  ],
  [
    ['honey'],
    [
      ['Dates', 0.1, 'pieces'],
      ['Maple syrup', 1, 'g'],
    ],
  ],
  [
    ['milk'],
    [
      ['Laban', 1, 'ml'],
      ['Soy milk', 1, 'ml'],
      ['Almond milk', 1.6, 'ml'],
    ],
  ],
  [
    ['spinach', 'pepper', 'onion', 'salad', 'tomato', 'cucumber', 'vegetable', 'veggies', 'bean', 'greens', 'lettuce'],
    [
      ['Frozen mixed vegetables', 1, 'g'],
      ['Zucchini and mushrooms', 1, 'g'],
      ['Cucumber and tomato', 1, 'g'],
    ],
  ],
  [
    ['lentil'],
    [
      ['Chickpeas (cooked)', 1, 'g'],
      ['Red beans (cooked)', 1, 'g'],
    ],
  ],
  [
    ['cheese'],
    [
      ['Labneh', 1.4, 'g'],
      ['Cottage cheese', 2, 'g'],
    ],
  ],
];

export function subOptions(name: string, a: number, u: string): [string, number, string][] {
  const n = name.toLowerCase();
  const hit = SUBS.find(([ks]) => ks.some((k) => n.includes(k)));
  const list = hit ? hit[1] : [['Something similar you have', 1, u] as [string, number, string]];
  return list.map(([nn, f, uu]) => {
    const amt = a * f;
    return [
      nn,
      uu === 'g' || uu === 'ml' ? Math.max(5, Math.round(amt / 5) * 5) : Math.max(1, Math.round(amt * 2) / 2),
      uu,
    ];
  });
}
