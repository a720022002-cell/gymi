import AsyncStorage from '@react-native-async-storage/async-storage';

export type Prefs = {
  checkin: { on: boolean; time: string };
  water: { on: boolean; from: string; to: string; every: number };
  meals: { on: boolean };
  workout: { on: boolean; time: string };
  vitamins: { on: boolean };
};
export const DEFAULT_PREFS: Prefs = {
  checkin: { on: true, time: '07:30' },
  water: { on: false, from: '09:00', to: '21:00', every: 2 },
  meals: { on: false },
  workout: { on: true, time: '17:00' },
  vitamins: { on: true },
};
export type Reminder = { title: string; body: string; time: string; route?: string };

const KEY = (uid: string) => `gymi.reminders.v1.${uid}`;

export async function loadPrefs(uid: string): Promise<Prefs> {
  try {
    const v = await AsyncStorage.getItem(KEY(uid));
    return v ? { ...DEFAULT_PREFS, ...JSON.parse(v) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
export async function savePrefs(uid: string, p: Prefs) {
  await AsyncStorage.setItem(KEY(uid), JSON.stringify(p)).catch(() => {});
}

/** The daily reminders these settings make. */
export function buildReminders(
  p: Prefs,
  x: { meals: { n: string; t: string }[]; vitamins: { name: string; time: string }[]; workoutToday: string | null },
  t: (s: string, v?: Record<string, string | number>) => string,
): Reminder[] {
  const out: Reminder[] = [];
  if (p.checkin.on) out.push({ title: t('Morning check-in'), body: t('Weight, sleep and energy. Under 30 seconds.'), time: p.checkin.time, route: '/home' });
  if (p.water.on) {
    const [fh] = p.water.from.split(':').map(Number);
    const [th] = p.water.to.split(':').map(Number);
    for (let h = fh; h <= th; h += Math.max(1, p.water.every)) out.push({ title: t('Water'), body: t('Time for a glass of water.'), time: `${String(h).padStart(2, '0')}:00`, route: '/water' });
  }
  if (p.meals.on) for (const m of x.meals.slice(0, 6)) out.push({ title: t(m.n), body: t('Log your {m} so your day stays on track.', { m: t(m.n).toLowerCase() }), time: m.t, route: '/food' });
  if (p.workout.on) out.push({ title: t('Training'), body: t('Check today’s workout and get moving.'), time: p.workout.time, route: '/train' });
  if (p.vitamins.on) for (const v of x.vitamins.slice(0, 8)) out.push({ title: v.name, body: t('Time to take {n}.', { n: v.name }), time: v.time, route: '/vitamins' });
  return out.filter((r) => /^\d{2}:\d{2}$/.test(r.time)).slice(0, 40);
}
