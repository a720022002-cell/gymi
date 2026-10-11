import type { IconName } from '../Icon';

import type { DeviceDay } from '@/lib/devices';

/** Readings you log yourself, then readings that only come from a watch or phone. */
export const READING_KEYS = ['steps', 'burned', 'weight', 'sleep', 'recovery', 'workouts', 'hr', 'rest', 'hrv', 'sleepEff', 'bed', 'vo2'] as const;
export type ReadingKey = (typeof READING_KEYS)[number];
/** These only show when a device sent them. */
export const DEVICE_ONLY: ReadingKey[] = ['hr', 'rest', 'hrv', 'sleepEff', 'bed', 'vo2'];
/** Device field behind each device reading. */
export const DEVICE_FIELD: Partial<Record<ReadingKey, keyof DeviceDay>> = { hr: 'hr_avg', rest: 'hr_rest', hrv: 'hrv', sleepEff: 'sleep_eff', bed: 'in_bed_h', vo2: 'vo2' };

export type Info = { name: string; icon: IconName; unit: string; bar?: boolean; dec?: boolean; dir: -1 | 0 | 1; goal?: number; what: string; coach: string; range: string };

/** What each reading means and how the coach uses it (design: RD). */
export const INFO: Record<ReadingKey, Info> = {
  steps: { name: 'Steps', icon: 'walk', unit: '', bar: true, dir: 1, goal: 8000, what: 'How much you walked today, from your phone, your watch or what you log.', coach: 'Low on steps on a rest day? I’ll suggest a short evening walk.', range: 'Your goal: 8,000 steps a day' },
  burned: { name: 'Calories burned in exercise', icon: 'flame', unit: 'kcal', bar: true, dir: 0, what: 'Calories you burned in workouts and cardio today.', coach: 'Extra activity is added to today’s food budget, so you can eat a bit more on active days.', range: 'Most training days: 200 to 600 kcal from exercise' },
  weight: { name: 'Weight', icon: 'scale', unit: 'kg', dec: true, dir: 0, what: 'From your smart scale or the weight you log each morning.', coach: 'I use your weekly average, not single days, to decide if your calories need a change.', range: 'Normal daily swing: up to 1 kg from water and food' },
  sleep: { name: 'Sleep', icon: 'moon', unit: 'h', bar: true, dec: true, dir: 1, goal: 7.5, what: 'How long you slept, from your morning check-in or your watch.', coach: 'Short on sleep? I keep your workout but make it a bit lighter.', range: 'Aim for 7 to 9 hours' },
  recovery: { name: 'Recovery', icon: 'bolt', unit: '%', dir: 1, goal: 67, what: 'How ready your body is to train today, from your sleep, soreness and energy.', coach: 'Under 33%: I make the workout lighter. Over 66%: you’re ready to push.', range: '67% or more is ready to train hard' },
  workouts: { name: 'Workouts', icon: 'train', unit: 'min', bar: true, dir: 0, what: 'Minutes you trained each day.', coach: 'I spread hard and easy days through your week so you don’t burn out.', range: 'Your plan: {n} workouts a week' },
  hr: { name: 'Average heart rate', icon: 'heart', unit: 'bpm', dir: -1, what: 'Your average heart rate across the day. A lower number at rest usually means better fitness.', coach: 'If your morning heart rate is much higher than usual, I make your workout lighter.', range: 'At rest, 50 to 70 bpm is common for active adults' },
  rest: { name: 'Resting heart rate', icon: 'heart', unit: 'bpm', dir: -1, what: 'Your heart rate when you’re fully at rest, usually measured while you sleep.', coach: 'A resting heart rate well above your usual can mean you need more recovery, so I go lighter.', range: 'At rest, 50 to 70 bpm is common for active adults' },
  hrv: { name: 'Heart rate variability', icon: 'pulse', unit: 'ms', dir: 1, what: 'The small changes in time between heartbeats (HRV). Higher than your usual means your body is well recovered.', coach: 'When your HRV drops well below your usual, I lower today’s intensity.', range: 'Compare with your own usual, not with other people' },
  sleepEff: { name: 'Sleep efficiency', icon: 'moon', unit: '%', dir: 1, goal: 85, what: 'The share of your time in bed that you were actually asleep.', coach: 'If it stays under 85% for a few nights, I’ll share simple sleep tips.', range: '85% or more is good' },
  bed: { name: 'Time in bed', icon: 'clock', unit: 'h', bar: true, dec: true, dir: 1, goal: 7.5, what: 'Total time you spent in bed, asleep or awake.', coach: 'I pair it with sleep efficiency to see how much you really slept.', range: 'Aim for 7.5 to 9 hours in bed' },
  vo2: { name: 'VO2 max', icon: 'bolt', unit: 'ml/kg/min', dec: true, dir: 1, what: 'How well your body uses oxygen when you work hard. It shows your heart and lung fitness.', coach: 'Guides how hard your cardio should be. It goes up slowly with regular cardio.', range: 'Higher is better. It changes over weeks, not days' },
};

/** Your saved card order, with any new readings added at the end. */
export function orderedKeys(saved: string[]) {
  const known = saved.filter((k): k is ReadingKey => (READING_KEYS as readonly string[]).includes(k));
  return [...known, ...READING_KEYS.filter((k) => !known.includes(k))];
}
