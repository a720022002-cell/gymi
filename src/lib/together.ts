/** Train together: shared workout and the right sets and reps for each level. */
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Person = { name: string; level: Level; me?: boolean; id?: string };
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
export const COLORS = ['#3355FF', '#15803D', '#B45309', '#7C3AED', '#DB2777'];

/** One full-body workout for the group (design: together). 1 = main lift, 0 = extra, 2 = timed. */
export const TOG: [string, number][] = [
  ['bench', 1],
  ['pulldown', 1],
  ['squat', 1],
  ['shoulder', 0],
  ['cablerow', 0],
  ['plank', 2],
];
export function scheme(level: Level, type: number): { sets: number; reps: number; timed: boolean } {
  if (type === 2) return { sets: 3, reps: level === 'Beginner' ? 30 : level === 'Advanced' ? 60 : 45, timed: true };
  if (type === 1) return { Beginner: { sets: 3, reps: 10 }, Intermediate: { sets: 4, reps: 8 }, Advanced: { sets: 4, reps: 6 } }[level] as { sets: number; reps: number } & { timed: false };
  return { sets: 3, reps: level === 'Advanced' ? 10 : 12, timed: false };
}

