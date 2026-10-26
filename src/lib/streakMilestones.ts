/** Day-streak milestones and their names: each one is a step on your journey. */
export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000] as const;

export const MILESTONE_NAME: Record<number, string> = {
  3: 'First spark',
  7: 'One week',
  14: 'Two weeks',
  21: 'Habit formed',
  30: 'One month',
  50: 'Fifty days',
  75: 'Seventy-five days',
  100: 'The 100 club',
  150: '150 days',
  200: '200 days',
  250: '250 days',
  300: '300 days',
  365: 'One year',
  500: '500 days',
  730: 'Two years',
  1000: 'Legend',
};

/** The big ones get a crown. */
export const BIG_MILESTONES = new Set([100, 365, 730, 1000]);

/** The last milestone reached, the next one, days to go and how far along (0–1). */
export function milestoneOf(streak: number) {
  const reached = [...MILESTONES].reverse().find((m) => streak >= m) ?? 0;
  const next = MILESTONES.find((m) => m > streak) ?? null;
  const toGo = next ? next - streak : 0;
  const frac = next ? (streak - reached) / (next - reached) : 1;
  return { reached, next, toGo, frac, unlocked: MILESTONES.filter((m) => streak >= m).length };
}
