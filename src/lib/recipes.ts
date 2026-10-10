// Ready-made recipes from the design file (docs/index.html, MP).
// m = share of calories from [protein, carbs, fat]. Ingredient amounts are for a 600 kcal portion.
export type Ingredient = [name: string, amount: number, unit: string];
export type Recipe = {
  n: string;
  m: [number, number, number];
  tag: 'Cut' | 'Bulk';
  min: number;
  ing: Ingredient[];
  steps: string[];
  /** Ingredient positions the user swapped. */
  subbed?: number[];
};

export const RECIPES: Record<string, Recipe[]> = {
  Breakfast: [
    {
      n: 'Egg white omelette, veggies and toast',
      m: [0.36, 0.38, 0.26],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Egg whites', 200, 'g'],
        ['Whole egg', 1, 'large'],
        ['Spinach, pepper, onion', 150, 'g'],
        ['Whole wheat toast', 1, 'slice'],
      ],
      steps: [
        'Whisk the egg whites with the whole egg.',
        'Cook the vegetables for 2 minutes, then add the eggs.',
        'Fold and serve with toast.',
      ],
    },
    {
      n: 'Eggs, labneh and whole wheat toast',
      m: [0.24, 0.4, 0.36],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Eggs', 3, 'large'],
        ['Labneh', 40, 'g'],
        ['Whole wheat toast', 2, 'slices'],
        ['Cucumber and tomato', 150, 'g'],
        ['Olive oil', 5, 'ml'],
      ],
      steps: [
        'Scramble the eggs on low heat with a little olive oil.',
        'Toast the bread.',
        'Serve with labneh, cucumber and tomato.',
      ],
    },
    {
      n: 'Oats with whey, banana and peanut butter',
      m: [0.28, 0.5, 0.22],
      tag: 'Bulk',
      min: 5,
      ing: [
        ['Oats', 80, 'g'],
        ['Whey protein', 1, 'scoop'],
        ['Banana', 1, 'medium'],
        ['Peanut butter', 15, 'g'],
        ['Milk', 250, 'ml'],
      ],
      steps: [
        'Cook the oats in the milk for 3 minutes.',
        'Stir in the whey once it cools a little.',
        'Top with sliced banana and peanut butter.',
      ],
    },
    {
      n: 'Foul, eggs and bread',
      m: [0.26, 0.48, 0.26],
      tag: 'Bulk',
      min: 10,
      ing: [
        ['Foul medames', 200, 'g'],
        ['Eggs', 2, 'large'],
        ['Arabic bread', 1, 'small'],
        ['Lemon and cumin', 1, 'pinch'],
      ],
      steps: ['Warm the foul with lemon and cumin.', 'Boil or fry the eggs.', 'Serve with the bread.'],
    },
  ],
  Lunch: [
    {
      n: 'Chicken kabsa, full plate',
      m: [0.28, 0.52, 0.2],
      tag: 'Bulk',
      min: 40,
      ing: [
        ['Chicken thigh', 220, 'g'],
        ['Basmati rice (raw)', 130, 'g'],
        ['Onion and tomato', 150, 'g'],
        ['Kabsa spice mix', 1, 'tbsp'],
        ['Ghee', 10, 'g'],
        ['Laban', 250, 'ml'],
      ],
      steps: [
        'Brown the onion in ghee, add the chicken and spices.',
        'Add tomato, water and the rice.',
        'Cover and cook on low for 25 minutes.',
        'Serve with laban.',
      ],
    },
    {
      n: 'Chicken kabsa, lighter version',
      m: [0.32, 0.46, 0.22],
      tag: 'Cut',
      min: 40,
      ing: [
        ['Chicken breast', 200, 'g'],
        ['Basmati rice (raw)', 90, 'g'],
        ['Onion and tomato', 150, 'g'],
        ['Kabsa spice mix', 1, 'tbsp'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Brown the onion in the oil, add the chicken and spices.',
        'Add tomato, water and the rice.',
        'Cover and cook on low for 25 minutes.',
        'Serve with salad.',
      ],
    },
    {
      n: 'Grilled fish, rice and salad',
      m: [0.34, 0.44, 0.22],
      tag: 'Cut',
      min: 25,
      ing: [
        ['White fish (hamour)', 220, 'g'],
        ['Basmati rice (raw)', 80, 'g'],
        ['Mixed salad', 200, 'g'],
        ['Olive oil', 10, 'ml'],
        ['Lemon', 1, 'half'],
      ],
      steps: [
        'Season the fish with salt, cumin and lemon.',
        'Grill 4 minutes per side.',
        'Cook the rice. Serve with salad and olive oil.',
      ],
    },
    {
      n: 'Beef and rice bowl',
      m: [0.3, 0.45, 0.25],
      tag: 'Bulk',
      min: 25,
      ing: [
        ['Lean beef mince', 180, 'g'],
        ['Basmati rice (raw)', 100, 'g'],
        ['Peppers and onion', 150, 'g'],
        ['Soy sauce', 1, 'tbsp'],
      ],
      steps: [
        'Cook the rice.',
        'Brown the beef, then add peppers and onion.',
        'Add soy sauce and serve over the rice.',
      ],
    },
  ],
  'Pre-workout': [
    {
      n: 'Whey shake and rice cakes',
      m: [0.4, 0.52, 0.08],
      tag: 'Cut',
      min: 3,
      ing: [
        ['Whey protein', 1, 'scoop'],
        ['Rice cakes', 2, 'pieces'],
        ['Honey', 5, 'g'],
      ],
      steps: ['Shake the whey with water.', 'Top the rice cakes with a little honey.'],
    },
    {
      n: 'Oats and milk shake',
      m: [0.22, 0.58, 0.2],
      tag: 'Bulk',
      min: 5,
      ing: [
        ['Oats', 60, 'g'],
        ['Milk', 300, 'ml'],
        ['Banana', 1, 'medium'],
        ['Whey protein', 1, 'scoop'],
      ],
      steps: ['Blend everything until smooth.', 'Drink it 60 to 90 minutes before training.'],
    },
    {
      n: 'Greek yogurt, dates and honey',
      m: [0.3, 0.62, 0.08],
      tag: 'Cut',
      min: 2,
      ing: [
        ['Greek yogurt', 200, 'g'],
        ['Dates', 3, 'pieces'],
        ['Honey', 10, 'g'],
      ],
      steps: ['Spoon the yogurt into a bowl.', 'Chop the dates on top and add honey.'],
    },
    {
      n: 'Banana and peanut butter toast',
      m: [0.14, 0.6, 0.26],
      tag: 'Bulk',
      min: 3,
      ing: [
        ['Whole wheat toast', 2, 'slices'],
        ['Banana', 1, 'medium'],
        ['Peanut butter', 15, 'g'],
      ],
      steps: ['Toast the bread.', 'Spread peanut butter and add sliced banana.'],
    },
  ],
  Dinner: [
    {
      n: 'Chicken pasta with pesto',
      m: [0.3, 0.46, 0.24],
      tag: 'Bulk',
      min: 25,
      ing: [
        ['Chicken breast', 180, 'g'],
        ['Pasta (raw)', 100, 'g'],
        ['Pesto', 25, 'g'],
        ['Cherry tomatoes', 100, 'g'],
      ],
      steps: ['Boil the pasta.', 'Pan-cook the chicken, then slice it.', 'Mix with pesto and tomatoes.'],
    },
    {
      n: 'Chicken shawarma bowl',
      m: [0.36, 0.38, 0.26],
      tag: 'Cut',
      min: 25,
      ing: [
        ['Chicken thigh, skinless', 180, 'g'],
        ['Rice or bulgur (raw)', 60, 'g'],
        ['Garlic yogurt sauce', 60, 'g'],
        ['Pickles and salad', 150, 'g'],
      ],
      steps: [
        'Marinate the chicken with shawarma spices and lemon.',
        'Pan-grill until browned, then slice.',
        'Serve over rice with salad and garlic yogurt.',
      ],
    },
    {
      n: 'Salmon, potatoes and greens',
      m: [0.3, 0.35, 0.35],
      tag: 'Bulk',
      min: 30,
      ing: [
        ['Salmon', 170, 'g'],
        ['Potatoes', 250, 'g'],
        ['Green beans', 150, 'g'],
        ['Olive oil', 5, 'ml'],
      ],
      steps: [
        'Roast the potatoes at 220°C for 25 minutes.',
        'Pan-sear the salmon 4 minutes per side.',
        'Steam the green beans.',
      ],
    },
    {
      n: 'Lean beef burger, no fries',
      m: [0.34, 0.36, 0.3],
      tag: 'Cut',
      min: 20,
      ing: [
        ['Lean beef patty', 170, 'g'],
        ['Whole wheat bun', 1, 'bun'],
        ['Lettuce, tomato, onion', 100, 'g'],
        ['Light cheese slice', 1, 'slice'],
      ],
      steps: ['Grill the patty 4 minutes per side.', 'Toast the bun.', 'Build the burger with vegetables and cheese.'],
    },
  ],
  Snack: [
    {
      n: 'Laban and mixed nuts',
      m: [0.18, 0.3, 0.52],
      tag: 'Bulk',
      min: 2,
      ing: [
        ['Laban', 250, 'ml'],
        ['Mixed nuts', 30, 'g'],
        ['Dates', 2, 'pieces'],
      ],
      steps: ['Drink the laban with a handful of nuts and dates.'],
    },
    {
      n: 'Peanut butter sandwich and milk',
      m: [0.18, 0.46, 0.36],
      tag: 'Bulk',
      min: 3,
      ing: [
        ['Whole wheat bread', 2, 'slices'],
        ['Peanut butter', 25, 'g'],
        ['Milk', 250, 'ml'],
      ],
      steps: ['Spread peanut butter on the bread.', 'Have it with a glass of milk.'],
    },
    {
      n: 'Protein shake and an apple',
      m: [0.4, 0.5, 0.1],
      tag: 'Cut',
      min: 2,
      ing: [
        ['Whey protein', 1, 'scoop'],
        ['Water or milk', 300, 'ml'],
        ['Apple', 1, 'medium'],
      ],
      steps: ['Shake the whey with water or milk.', 'Eat the apple on the side.'],
    },
    {
      n: 'Cottage cheese and berries',
      m: [0.4, 0.4, 0.2],
      tag: 'Cut',
      min: 2,
      ing: [
        ['Cottage cheese', 200, 'g'],
        ['Berries', 100, 'g'],
      ],
      steps: ['Top the cottage cheese with berries.'],
    },
  ],
  Iftar: [
    {
      n: 'Dates, harees and baked sambousek',
      m: [0.2, 0.56, 0.24],
      tag: 'Bulk',
      min: 40,
      ing: [
        ['Dates', 4, 'pieces'],
        ['Harees', 300, 'g'],
        ['Baked sambousek', 3, 'pieces'],
        ['Water', 500, 'ml'],
      ],
      steps: ['Break your fast with dates and water.', 'Have a bowl of harees.', 'Finish with baked sambousek.'],
    },
    {
      n: 'Dates, lentil soup and fattoush',
      m: [0.18, 0.62, 0.2],
      tag: 'Cut',
      min: 30,
      ing: [
        ['Dates', 3, 'pieces'],
        ['Lentil soup', 300, 'ml'],
        ['Fattoush salad', 200, 'g'],
        ['Water', 500, 'ml'],
      ],
      steps: [
        'Break your fast with dates and water.',
        'Have a bowl of lentil soup.',
        'Finish with fattoush. Pray, then have your main meal later.',
      ],
    },
  ],
  'Main meal': [
    {
      n: 'Lamb mandi plate',
      m: [0.28, 0.48, 0.24],
      tag: 'Bulk',
      min: 60,
      ing: [
        ['Lamb', 200, 'g'],
        ['Mandi rice (raw)', 120, 'g'],
        ['Salad', 150, 'g'],
        ['Laban', 250, 'ml'],
      ],
      steps: ['Cook the mandi as usual.', 'Serve with salad and laban.'],
    },
    {
      n: 'Chicken kabsa with salad',
      m: [0.32, 0.46, 0.22],
      tag: 'Cut',
      min: 40,
      ing: [
        ['Chicken breast', 220, 'g'],
        ['Basmati rice (raw)', 100, 'g'],
        ['Salad', 200, 'g'],
        ['Laban', 250, 'ml'],
      ],
      steps: ['Cook the kabsa as usual with less oil.', 'Serve with a big salad and laban.'],
    },
  ],
  Suhoor: [
    {
      n: 'Eggs, foul and cucumber',
      m: [0.3, 0.42, 0.28],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Eggs', 2, 'large'],
        ['Foul medames', 150, 'g'],
        ['Cucumber', 100, 'g'],
        ['Arabic bread', 1, 'small'],
      ],
      steps: ['Warm the foul with cumin and lemon.', 'Boil the eggs.', 'Eat slowly and drink water.'],
    },
    {
      n: 'Oats, laban and eggs',
      m: [0.28, 0.5, 0.22],
      tag: 'Bulk',
      min: 10,
      ing: [
        ['Oats', 70, 'g'],
        ['Laban', 250, 'ml'],
        ['Eggs', 2, 'large'],
        ['Dates', 2, 'pieces'],
      ],
      steps: ['Cook the oats.', 'Boil the eggs.', 'Drink the laban slowly. Slow carbs keep you full longer.'],
    },
  ],
};

// Share of daily calories for each meal type.
export const MEAL_WEIGHT: Record<string, number> = {
  Breakfast: 0.25,
  Lunch: 0.33,
  Dinner: 0.28,
  'Pre-workout': 0.14,
  Iftar: 0.3,
  'Main meal': 0.4,
  Suhoor: 0.3,
};
