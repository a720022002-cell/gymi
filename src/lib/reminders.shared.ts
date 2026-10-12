import AsyncStorage from '@react-native-async-storage/async-storage';

/** The 8 reminder types (design: NCAT). */
export const NCATS = ['water', 'food', 'workout', 'checkin', 'sleep', 'vitamins', 'report', 'friends'] as const;
export type NCat = (typeof NCATS)[number];

export type WaterFreq = '1h' | '2h' | '3h' | 'day' | 'behind';
export type Prefs = {
  /** Master switch: off pauses everything (choices are kept). */
  on: boolean;
  quiet: { on: boolean; from: string; to: string };
  /** every: hours between water reminders (older field, kept in step with freq). */
  water: { on: boolean; freq: WaterFreq; from: string; to: string; sound: string; every: number };
  food: { on: boolean; mode: 'before' | 'after' | 'day'; before: number; summary: boolean; sumTime: string; sound: string };
  /** before: minutes before your workout time (0 = at workout time). Rest sound lives in beep.ts. */
  workout: { on: boolean; before: number; time: string; sound: string };
  checkin: { on: boolean; time: string; sound: string };
  sleep: { on: boolean; time: string; wind: boolean; sound: string };
  vitamins: { on: boolean; sound: string };
  report: { on: boolean; day: string; time: string; sound: string };
  friends: { on: boolean; prs: boolean; challenges: boolean; cheers: boolean; sound: string };
  /** Older name for food.on (the Food screen's bell); kept in step with it. */
  meals: { on: boolean };
};

export const DEFAULT_PREFS: Prefs = {
  on: true,
  quiet: { on: false, from: '23:00', to: '07:00' },
  water: { on: false, freq: '2h', from: '08:00', to: '22:00', sound: 'drop', every: 2 },
  food: { on: true, mode: 'before', before: 30, summary: true, sumTime: '21:00', sound: 'crunch' },
  workout: { on: true, before: 30, time: '17:00', sound: 'lightweight' },
  checkin: { on: true, time: '07:30', sound: 'chime' },
  sleep: { on: false, time: '23:00', wind: true, sound: 'soft' },
  vitamins: { on: true, sound: 'default' },
  report: { on: true, day: 'Fri', time: '10:00', sound: 'default' },
  friends: { on: true, prs: true, challenges: true, cheers: false, sound: 'yeahbuddy' },
  meals: { on: true },
};

/** Names, icons and the sample text a preview shows (design: NCAT). */
export const NCAT_INFO: Record<NCat, { name: string; icon: 'drop' | 'food' | 'train' | 'sun' | 'moon' | 'pill' | 'doc' | 'users'; sample: string; route: string }> = {
  water: { name: 'Water', icon: 'drop', sample: 'Time for a glass of water. You’re 700 ml behind.', route: '/water' },
  food: { name: 'Meals and food', icon: 'food', sample: 'Lunch in 30 minutes: chicken kabsa, 810 kcal.', route: '/food' },
  workout: { name: 'Workouts', icon: 'train', sample: 'Push day in 30 minutes. Light weight, let’s go.', route: '/train' },
  checkin: { name: 'Daily check-in', icon: 'sun', sample: 'Your 30-second daily check-in is ready.', route: '/home' },
  sleep: { name: 'Bedtime', icon: 'moon', sample: 'Bed in 30 minutes. Put the phone away soon.', route: '/progress' },
  vitamins: { name: 'Vitamins', icon: 'pill', sample: 'Time for Vitamin D, 50,000 IU.', route: '/vitamins' },
  report: { name: 'Reports', icon: 'doc', sample: 'Your weekly report is ready. You trained 3 of 3 days.', route: '/report' },
  friends: { name: 'Gym Bros', icon: 'users', sample: 'Ahmed hit a new PR: Bench 100 kg.', route: '/friends' },
};

/** Sounds each type can play (design: NSOUNDS) and their names (design: SOUNDS). */
export const NSOUNDS: Record<NCat, string[]> = {
  water: ['drop', 'pour', 'default', 'bell', 'none'],
  food: ['crunch', 'default', 'bell', 'none'],
  workout: ['lightweight', 'yeahbuddy', 'gymbell', 'horn', 'default', 'none'],
  checkin: ['chime', 'default', 'bell', 'none'],
  sleep: ['soft', 'bell', 'default', 'none'],
  vitamins: ['default', 'bell', 'chime', 'none'],
  report: ['default', 'chime', 'none'],
  friends: ['yeahbuddy', 'default', 'horn', 'none'],
};
export const SOUND_NAMES: Record<string, string> = {
  default: 'Gymi ding',
  drop: 'Water drop',
  pour: 'Pouring water',
  crunch: 'Crunchy bite',
  bell: 'Soft bell',
  chime: 'Morning chime',
  soft: 'Night chimes',
  gymbell: 'Gym bell',
  horn: 'Air horn',
  lightweight: '“Light weight!” voice',
  yeahbuddy: '“Yeah buddy!” voice',
  none: 'None (silent)',
};
export const FREQ: Record<WaterFreq, string> = { '1h': 'Every hour', '2h': 'Every 2 hours', '3h': 'Every 3 hours', day: 'Once a day', behind: 'Only when I’m behind' };
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** weekday: 1 = Sunday … 7 = Saturday (weekly). Without it the reminder is daily. */
export type Reminder = { title: string; body: string; time: string; route?: string; weekday?: number; sound?: boolean };

const KEY = (uid: string) => `gymi.reminders.v1.${uid}`;
const subs = new Set<(p: Prefs) => void>();

/** Settings saved by older versions had fewer options; fill in the rest. */
function migrate(raw: Record<string, unknown>): Prefs {
  const p = raw as Partial<Prefs>;
  const merge = <K extends Exclude<keyof Prefs, 'on'>>(k: K) => ({ ...(DEFAULT_PREFS[k] as object), ...((p[k] as object | undefined) ?? {}) }) as Prefs[K];
  const out: Prefs = {
    on: typeof p.on === 'boolean' ? p.on : true,
    quiet: merge('quiet'),
    water: merge('water'),
    food: merge('food'),
    workout: merge('workout'),
    checkin: merge('checkin'),
    sleep: merge('sleep'),
    vitamins: merge('vitamins'),
    report: merge('report'),
    friends: merge('friends'),
    meals: merge('meals'),
  };
  const every = p.water?.every;
  if (every && !(raw.water as { freq?: string }).freq) out.water.freq = `${Math.min(3, Math.max(1, every))}h` as WaterFreq;
  if (p.meals && !raw.food) out.food.on = !!p.meals.on;
  return sync(out, null);
}

/** Keep the older fields (meals.on, water.every) and the new ones in step; whichever changed wins. */
function sync(p: Prefs, prev: Prefs | null): Prefs {
  const food = prev && p.meals.on !== prev.meals.on ? { ...p.food, on: p.meals.on } : p.food;
  const freq: WaterFreq = prev && p.water.every !== prev.water.every ? (`${Math.min(3, Math.max(1, p.water.every))}h` as WaterFreq) : p.water.freq;
  const every = freq === '1h' ? 1 : freq === '3h' ? 3 : 2;
  return { ...p, food, meals: { on: food.on }, water: { ...p.water, freq, every } };
}
const last = new Map<string, Prefs>();

export async function loadPrefs(uid: string): Promise<Prefs> {
  try {
    const v = await AsyncStorage.getItem(KEY(uid));
    const p = v ? migrate(JSON.parse(v)) : DEFAULT_PREFS;
    last.set(uid, p);
    return p;
  } catch {
    return DEFAULT_PREFS;
  }
}
export async function savePrefs(uid: string, next: Prefs) {
  const p = sync(next, last.get(uid) ?? null);
  last.set(uid, p);
  subs.forEach((f) => f(p));
  await AsyncStorage.setItem(KEY(uid), JSON.stringify(p)).catch(() => {});
}
/** Hear about saved changes (ReminderSync reschedules, the friend alerts read the Gym Bros choices). */
export function onPrefs(f: (p: Prefs) => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** "Settings → Notifications": "5 of 8 on" or "Off". */
export function notifSummary(p: Prefs, t: (s: string, v?: Record<string, string | number>) => string) {
  if (!p.on) return t('Off');
  return t('{a} of {b} on', { a: NCATS.filter((k) => p[k].on).length, b: NCATS.length });
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (m: number) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
/** Is this time inside quiet hours (which may cross midnight)? */
export function inQuiet(q: Prefs['quiet'], time: string) {
  if (!q.on) return false;
  const v = toMin(time);
  const a = toMin(q.from);
  const b = toMin(q.to);
  return a <= b ? v >= a && v < b : v >= a || v < b;
}

/** The reminders these settings make (local notifications on the phone). */
export function buildReminders(
  p: Prefs,
  x: { meals: { n: string; t: string }[]; vitamins: { name: string; time: string }[]; workoutTime?: string | null; workoutName?: string | null; workoutToday?: string | null },
  t: (s: string, v?: Record<string, string | number>) => string,
): Reminder[] {
  if (!p.on) return [];
  const out: Reminder[] = [];
  const snd = (s: string) => s !== 'none';
  if (p.checkin.on) out.push({ title: t('Daily check-in'), body: t('Your 30-second daily check-in is ready.'), time: p.checkin.time, route: '/home', sound: snd(p.checkin.sound) });
  if (p.water.on) {
    const w = p.water;
    const body = w.freq === 'behind' ? t('Check your water. Have a glass if you’re behind.') : t('Time for a glass of water.');
    if (w.freq === 'day') out.push({ title: t('Water'), body, time: w.from, route: '/water', sound: snd(w.sound) });
    else {
      const step = w.freq === '1h' ? 60 : w.freq === '3h' ? 180 : 120;
      const a = toMin(w.from);
      let b = toMin(w.to);
      if (b <= a) b += 1440;
      for (let m = a; m <= b; m += step) out.push({ title: t('Water'), body, time: hhmm(m), route: '/water', sound: snd(w.sound) });
    }
  }
  if (p.food.on) {
    const f = p.food;
    if (f.mode === 'before')
      for (const m of x.meals.slice(0, 6))
        out.push({ title: t(m.n), body: t('{m} in {n} minutes. Check what’s on your plan.', { m: t(m.n), n: f.before }), time: hhmm(toMin(m.t) - f.before), route: '/food', sound: snd(f.sound) });
    if (f.mode === 'after')
      for (const m of x.meals.slice(0, 6)) out.push({ title: t(m.n), body: t('Log your {m} so your day stays on track.', { m: t(m.n).toLowerCase() }), time: hhmm(toMin(m.t) + 45), route: '/food', sound: snd(f.sound) });
    if (f.mode === 'day' && !f.summary) out.push({ title: t('Meals and food'), body: t('Log what you ate today.'), time: f.sumTime, route: '/food', sound: snd(f.sound) });
    if (f.summary) out.push({ title: t('Daily summary'), body: t('See the calories and protein you have left today.'), time: f.sumTime, route: '/food', sound: snd(f.sound) });
  }
  if (p.workout.on) {
    const at = x.workoutTime || p.workout.time;
    const name = x.workoutName ?? x.workoutToday;
    const body = p.workout.before
      ? t('{w} in {n} minutes. Light weight, let’s go.', { w: name ? t(name) : t('Your workout'), n: p.workout.before })
      : t('Time for your workout. Light weight, let’s go.');
    out.push({ title: t('Workouts'), body, time: hhmm(toMin(at) - p.workout.before), route: '/train', sound: snd(p.workout.sound) });
  }
  if (p.sleep.on) {
    if (p.sleep.wind) out.push({ title: t('Bedtime'), body: t('Bed in 30 minutes. Put the phone away soon.'), time: hhmm(toMin(p.sleep.time) - 30), sound: snd(p.sleep.sound) });
    out.push({ title: t('Bedtime'), body: t('Time for bed. Good sleep helps you recover.'), time: p.sleep.time, sound: snd(p.sleep.sound) });
  }
  if (p.vitamins.on) for (const v of x.vitamins.slice(0, 8)) out.push({ title: v.name, body: t('Time to take {n}.', { n: v.name }), time: v.time, route: '/vitamins', sound: snd(p.vitamins.sound) });
  if (p.report.on) out.push({ title: t('Reports'), body: t('Your weekly report is ready.'), time: p.report.time, route: '/report', weekday: Math.max(0, WEEKDAYS.indexOf(p.report.day)) + 1, sound: snd(p.report.sound) });
  // Quiet hours win over everything except your own vitamin times.
  return out.filter((r) => /^\d{2}:\d{2}$/.test(r.time) && (r.route === '/vitamins' || !inQuiet(p.quiet, r.time))).slice(0, 60);
}
