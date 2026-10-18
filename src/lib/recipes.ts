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
  /** Calories compared with the meal's share, after leaving an ingredient out (1 = unchanged). */
  kAdj?: number;
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
    {
      n: 'Shakshuka with Arabic bread',
      m: [0.24, 0.4, 0.36],
      tag: 'Cut',
      min: 15,
      ing: [
        ['Eggs', 3.5, 'large'],
        ['Tomato and pepper', 275, 'g'],
        ['Onion', 65, 'g'],
        ['Olive oil', 10, 'ml'],
        ['Arabic bread', 1, 'small'],
      ],
      steps: [
        'Soften the onion and pepper in the oil.',
        'Add the tomato and cook 5 minutes.',
        'Crack in the eggs, cover and cook until set.',
        'Serve with the bread.',
      ],
    },
    {
      n: 'Balaleet with an omelette',
      m: [0.2, 0.55, 0.25],
      tag: 'Bulk',
      min: 20,
      ing: [
        ['Vermicelli', 85, 'g'],
        ['Sugar', 10, 'g'],
        ['Cardamom and saffron', 1, 'pinch'],
        ['Eggs', 2.5, 'large'],
        ['Butter', 10, 'g'],
      ],
      steps: [
        'Boil the vermicelli 3 minutes and drain.',
        'Stir in the sugar, cardamom and saffron with the butter.',
        'Make a thin omelette and lay it on top.',
      ],
    },
    {
      n: 'Chicken and avocado wrap',
      m: [0.32, 0.4, 0.28],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Chicken breast', 150, 'g'],
        ['Whole wheat tortilla', 1, 'piece'],
        ['Avocado', 60, 'g'],
        ['Lettuce and tomato', 100, 'g'],
        ['Lemon', 1, 'half'],
      ],
      steps: [
        'Grill the chicken with salt and paprika.',
        'Mash the avocado with lemon.',
        'Fill the wrap and roll it.',
      ],
    },
    {
      n: 'Potatoes, eggs and labneh plate',
      m: [0.22, 0.46, 0.32],
      tag: 'Bulk',
      min: 20,
      ing: [
        ['Potatoes', 295, 'g'],
        ['Eggs', 2.5, 'large'],
        ['Labneh', 60, 'g'],
        ['Olive oil', 10, 'ml'],
        ['Cucumber and tomato', 140, 'g'],
      ],
      steps: [
        'Cube the potatoes and roast or pan-fry in the oil.',
        'Fry or boil the eggs.',
        'Serve with labneh and salad.',
      ],
    },
    {
      n: 'Chicken, rice and veg breakfast bowl',
      m: [0.34, 0.46, 0.2],
      tag: 'Cut',
      min: 15,
      ing: [
        ['Chicken breast', 150, 'g'],
        ['Basmati rice (raw)', 60, 'g'],
        ['Mixed vegetables', 150, 'g'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Cook the rice.',
        'Cook the chicken and vegetables in the oil with spices.',
        'Serve together.',
      ],
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
    {
      n: 'Chicken mandi with salad',
      m: [0.3, 0.48, 0.22],
      tag: 'Bulk',
      min: 60,
      ing: [
        ['Chicken thigh', 155, 'g'],
        ['Basmati rice (raw)', 80, 'g'],
        ['Mandi spice mix', 1, 'tbsp'],
        ['Onion', 45, 'g'],
        ['Mixed salad', 115, 'g'],
      ],
      steps: [
        'Rub the chicken with the spices and roast until golden.',
        'Cook the rice with onion and the same spices.',
        'Serve the chicken on the rice with salad.',
      ],
    },
    {
      n: 'Saleeg with grilled chicken',
      m: [0.3, 0.46, 0.24],
      tag: 'Bulk',
      min: 45,
      ing: [
        ['Chicken breast', 145, 'g'],
        ['Short-grain rice (raw)', 65, 'g'],
        ['Chicken stock', 320, 'ml'],
        ['Milk', 120, 'ml'],
        ['Butter', 5, 'g'],
      ],
      steps: [
        'Cook the rice in the stock until soft.',
        'Add the milk and stir until creamy.',
        'Top with butter and the grilled chicken.',
      ],
    },
    {
      n: 'Lentil soup and chicken',
      m: [0.34, 0.46, 0.2],
      tag: 'Cut',
      min: 35,
      ing: [
        ['Red lentils (raw)', 70, 'g'],
        ['Chicken breast', 140, 'g'],
        ['Onion and carrot', 120, 'g'],
        ['Cumin', 1, 'pinch'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Soften the onion and carrot in the oil.',
        'Add the lentils, cumin and water. Cook 20 minutes and blend.',
        'Serve with the grilled chicken.',
      ],
    },
    {
      n: 'Beef kofta, bulgur and salad',
      m: [0.3, 0.42, 0.28],
      tag: 'Bulk',
      min: 30,
      ing: [
        ['Lean beef mince', 170, 'g'],
        ['Bulgur (raw)', 75, 'g'],
        ['Parsley and onion', 55, 'g'],
        ['Mixed salad', 160, 'g'],
      ],
      steps: [
        'Mix the beef with parsley, onion and spices; shape into kofta.',
        'Grill 8 to 10 minutes.',
        'Cook the bulgur and serve with salad.',
      ],
    },
    {
      n: 'Shrimp machboos, lighter',
      m: [0.32, 0.5, 0.18],
      tag: 'Cut',
      min: 40,
      ing: [
        ['Shrimp', 200, 'g'],
        ['Basmati rice (raw)', 80, 'g'],
        ['Onion and tomato', 150, 'g'],
        ['Machboos spice mix', 1, 'tbsp'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Brown the onion in the oil, add tomato and spices.',
        'Add the rice and water; cook covered 20 minutes.',
        'Stir in the shrimp for the last 5 minutes.',
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
    {
      n: 'Banana and dates',
      m: [0.05, 0.9, 0.05],
      tag: 'Cut',
      min: 1,
      ing: [
        ['Banana', 3.5, 'medium'],
        ['Dates', 10.5, 'pieces'],
      ],
      steps: [
        'Eat 45 to 60 minutes before training.',
      ],
    },
    {
      n: 'Rice cakes with honey and banana',
      m: [0.06, 0.86, 0.08],
      tag: 'Bulk',
      min: 3,
      ing: [
        ['Rice cakes', 7, 'pieces'],
        ['Honey', 35, 'g'],
        ['Banana', 2.5, 'medium'],
      ],
      steps: [
        'Spread the honey on the rice cakes.',
        'Top with banana slices.',
      ],
    },
    {
      n: 'Chicken and rice small bowl',
      m: [0.34, 0.56, 0.1],
      tag: 'Bulk',
      min: 15,
      ing: [
        ['Chicken breast', 155, 'g'],
        ['Basmati rice (raw)', 95, 'g'],
      ],
      steps: [
        'Cook the rice and the chicken.',
        'Eat 1 to 2 hours before training.',
      ],
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
    {
      n: 'Chicken tikka with vegetables',
      m: [0.42, 0.28, 0.3],
      tag: 'Cut',
      min: 25,
      ing: [
        ['Chicken breast', 190, 'g'],
        ['Tikka spice mix', 1, 'tbsp'],
        ['Peppers and onion', 145, 'g'],
        ['Olive oil', 10, 'ml'],
        ['Arabic bread', 1, 'small'],
      ],
      steps: [
        'Coat the chicken with the spices and a little oil.',
        'Grill with the peppers and onion.',
        'Serve with the bread.',
      ],
    },
    {
      n: 'Tuna and potato salad',
      m: [0.34, 0.38, 0.28],
      tag: 'Cut',
      min: 15,
      ing: [
        ['Tuna in water', 195, 'g'],
        ['Potatoes', 260, 'g'],
        ['Cucumber, tomato and onion', 195, 'g'],
        ['Olive oil', 15, 'ml'],
        ['Lemon', 1.5, 'half'],
      ],
      steps: [
        'Boil the potatoes and cube them.',
        'Mix with the tuna and vegetables.',
        'Dress with olive oil and lemon.',
      ],
    },
    {
      n: 'Lamb kebab plate',
      m: [0.32, 0.36, 0.32],
      tag: 'Bulk',
      min: 25,
      ing: [
        ['Lean lamb mince', 120, 'g'],
        ['Arabic bread', 0.5, 'medium'],
        ['Grilled tomato and onion', 105, 'g'],
        ['Tahini sauce', 15, 'g'],
      ],
      steps: [
        'Shape the mince on skewers with salt and spices.',
        'Grill 8 minutes, turning once.',
        'Serve with bread, grilled vegetables and tahini.',
      ],
    },
    {
      n: 'Chicken and vegetable stir-fry with rice',
      m: [0.34, 0.46, 0.2],
      tag: 'Cut',
      min: 20,
      ing: [
        ['Chicken breast', 145, 'g'],
        ['Mixed vegetables', 170, 'g'],
        ['Basmati rice (raw)', 60, 'g'],
        ['Garlic and ginger', 1, 'tbsp'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Cook the rice.',
        'Stir-fry the chicken in the oil, then add the vegetables, garlic and ginger.',
        'Serve over the rice.',
      ],
    },
    {
      n: 'Beef and sweet potato bowl',
      m: [0.3, 0.42, 0.28],
      tag: 'Bulk',
      min: 30,
      ing: [
        ['Lean beef strips', 175, 'g'],
        ['Sweet potato', 225, 'g'],
        ['Green beans', 125, 'g'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Roast the sweet potato cubes 20 minutes.',
        'Sear the beef and beans in the oil.',
        'Serve together.',
      ],
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
    {
      n: 'Dates and almonds',
      m: [0.08, 0.6, 0.32],
      tag: 'Bulk',
      min: 1,
      ing: [
        ['Dates', 11.5, 'pieces'],
        ['Almonds', 60, 'g'],
      ],
      steps: [
        'Eat slowly with water or coffee.',
      ],
    },
    {
      n: 'Hummus with carrot and cucumber',
      m: [0.16, 0.46, 0.38],
      tag: 'Cut',
      min: 5,
      ing: [
        ['Hummus', 155, 'g'],
        ['Carrot and cucumber sticks', 305, 'g'],
        ['Arabic bread', 1.5, 'small'],
      ],
      steps: [
        'Cut the vegetables into sticks.',
        'Dip into the hummus.',
      ],
    },
    {
      n: 'Boiled eggs and an orange',
      m: [0.3, 0.36, 0.34],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Eggs', 5.5, 'large'],
        ['Orange', 2.5, 'medium'],
        ['Cucumber', 265, 'g'],
      ],
      steps: [
        'Boil the eggs 9 minutes.',
        'Eat with the orange and cucumber.',
      ],
    },
    {
      n: 'Chicken and lettuce wraps',
      m: [0.5, 0.2, 0.3],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Chicken breast', 265, 'g'],
        ['Lettuce leaves', 13.5, 'pieces'],
        ['Tomato and cucumber', 225, 'g'],
        ['Olive oil', 10, 'ml'],
      ],
      steps: [
        'Grill and slice the chicken.',
        'Wrap it in the lettuce with the vegetables.',
      ],
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
    {
      n: 'Dates, lentil soup and grilled chicken',
      m: [0.32, 0.48, 0.2],
      tag: 'Cut',
      min: 35,
      ing: [
        ['Dates', 3.5, 'pieces'],
        ['Red lentils (raw)', 60, 'g'],
        ['Chicken breast', 175, 'g'],
        ['Mixed salad', 175, 'g'],
      ],
      steps: [
        'Break your fast with the dates and water.',
        'Have the soup, then the chicken with salad.',
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
    {
      n: 'Harees with chicken',
      m: [0.3, 0.5, 0.2],
      tag: 'Bulk',
      min: 90,
      ing: [
        ['Harees wheat (raw)', 80, 'g'],
        ['Chicken breast', 160, 'g'],
        ['Ghee', 5, 'g'],
        ['Cinnamon', 1, 'pinch'],
      ],
      steps: [
        'Cook the wheat and chicken in water on low until very soft.',
        'Beat until smooth.',
        'Top with ghee and cinnamon.',
      ],
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
    {
      n: 'Foul, Arabic bread and cucumber',
      m: [0.22, 0.58, 0.2],
      tag: 'Cut',
      min: 10,
      ing: [
        ['Foul medames', 265, 'g'],
        ['Arabic bread', 1.5, 'small'],
        ['Cucumber and tomato', 200, 'g'],
        ['Olive oil', 5, 'ml'],
      ],
      steps: [
        'Warm the foul with cumin and lemon.',
        'Serve with bread and vegetables.',
      ],
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

/** Grams for one of each counted unit, so recipes show weights instead of "1 medium". */
const UNIT_G: Record<string, number> = { medium: 150, large: 50, small: 60, slice: 30, slices: 30, piece: 10, pieces: 10, scoop: 30, bun: 60, half: 40, tbsp: 15 };
const NAME_G: Record<string, number> = { Banana: 120, Apple: 180, Dates: 8, 'Baked sambousek': 30, 'Rice cakes': 9, 'Light cheese slice': 20, 'Kabsa spice mix': 7, Orange: 150, 'Whole wheat tortilla': 60, 'Lettuce leaves': 10 };
const LIQUID = new Set(['Soy sauce']);

/** An ingredient amount in grams (or ml for liquids). Units with no weight, like a pinch, stay as they are. */
export function inGrams(n: string, a: number, u: string): [number, string] {
  if (u === 'g' || u === 'ml' || !UNIT_G[u]) return [a, u];
  const v = a * (NAME_G[n] ?? UNIT_G[u]);
  return [v < 20 ? Math.max(1, Math.round(v)) : Math.round(v / 5) * 5, LIQUID.has(n) ? 'ml' : 'g'];
}

/** Rough calories per 100 g (or ml) by kind of ingredient, to keep a meal's calories when one is left out. */
const KCAL_100: [RegExp, number][] = [
  [/egg white|بياض/i, 52],
  [/oil|ghee|butter|زيت|سمن|زبدة/i, 850],
  [/nut|almond|walnut|cashew|pistachio|peanut|tahini|لوز|جوز|كاجو|فستق|طحينة/i, 590],
  [/honey|sugar|date|عسل|سكر|تمر/i, 300],
  [/rice|oat|pasta|bulgur|vermicelli|lentil|wheat|harees|rice cake|freekeh|رز|أرز|شوفان|برغل|عدس|شعيرية|هريس/i, 350],
  [/bread|toast|tortilla|bun|pita|sambousek|خبز|توست/i, 270],
  [/cheese|labneh|hummus|avocado|جبن|لبنة|حمص|أفوكادو/i, 170],
  [/whey|protein/i, 380],
  [/beef|lamb|mince|kofta|thigh|salmon|لحم|سلمون/i, 190],
  [/chicken|fish|hamour|tuna|shrimp|turkey|egg(?!plant)|دجاج|سمك|هامور|تونة|ربيان|بيض/i, 140],
  [/potato|sweet potato|banana|foul|bean|بطاطس|بطاطا|موز|فول/i, 90],
  [/milk|laban|yogurt|حليب|لبن|زبادي/i, 60],
];
/** About how many calories an ingredient amount has (0 for a pinch of spice). */
export function ingKcal(n: string, a: number, u: string) {
  const [g, unit] = inGrams(n, a, u);
  if (unit !== 'g' && unit !== 'ml') return 0;
  const per = KCAL_100.find(([re]) => re.test(n))?.[1] ?? 30;
  return (g * per) / 100;
}
