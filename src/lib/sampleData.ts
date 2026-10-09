// Sample numbers for Home until Food, Train and Progress are built (Phases 2 to 5).
// Same values as the design file's demo user.
export const SAMPLE = {
  kcalGoal: 2450,
  burned: 0,
  meals: [
    { k: 520, p: 30, c: 46, f: 22 },
    { k: 780, p: 50, c: 100, f: 18 },
    { k: 260, p: 24, c: 34, f: 4 },
    { k: 300, p: 38, c: 30, f: 14 },
  ],
  macroGoal: { p: 160, c: 295, f: 70 },
  water: { ml: 1500, goal: 3200 },
  workout: { name: 'Push', exercises: 6, minutes: 55, first: 'Bench press', target: 82.5 },
  streaks: { overall: 12, best: 21, workouts: 9, bestWorkouts: 14, commitment: 86 },
};

export const eaten = () =>
  SAMPLE.meals.reduce((a, m) => ({ k: a.k + m.k, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
