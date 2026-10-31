/** When a vitamin's reminder goes off, like Apple's Reminders: a date, a time and how it repeats. */
import type { VitDay } from './reminders.shared';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** Today on the phone's clock (YYYY-MM-DD). */
export const todayIso = () => iso(new Date());

/** never: once, on the date. every: every `every` days from the date. weekly: on `days` (0 = Sunday … 6). */
export type Repeat = 'never' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly' | 'every';
export type VitSchedule = { repeat: Repeat; date: string; days?: number[]; every?: number };
export const REPEATS: Repeat[] = ['never', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'yearly', 'every'];
export const REPEAT_LABEL: Record<Repeat, string> = {
  never: 'Never',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  every: 'Every few days',
};

const dow = (day: string) => new Date(`${day}T12:00:00`).getDay();
/** Workdays and the weekend follow the region: Friday and Saturday off in the Gulf and most Arab countries. */
export function weekendDays(): number[] {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region ?? '';
    if (['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'EG', 'JO', 'IQ', 'SY', 'LY', 'SD', 'YE', 'DZ'].includes(region)) return [5, 6];
  } catch {
    // Older phones without Intl.Locale: Saturday and Sunday.
  }
  return [0, 6];
}

/** The schedule saved with the vitamin, or one made from how often it was set before (and the day picked then). */
export function scheduleOf(v: { freq: string; schedule?: VitSchedule | null }, old?: VitDay, today = new Date()): VitSchedule {
  if (v.schedule?.repeat && v.schedule.date) return v.schedule;
  const y = today.getFullYear();
  const m = today.getMonth();
  const date = iso(today);
  if (v.freq === 'Weekly') return { repeat: 'weekly', date, days: [((old?.w ?? today.getDay() + 1) - 1 + 7) % 7] };
  if (v.freq === 'Monthly') return { repeat: 'monthly', date: iso(new Date(y, m, old?.m ?? Math.min(28, today.getDate()))) };
  return { repeat: 'daily', date };
}

/** How often, in the old words the database and older app versions know (Daily, Weekly or Monthly). */
export function freqOf(s: VitSchedule): 'Daily' | 'Weekly' | 'Monthly' {
  if (s.repeat === 'weekly' || s.repeat === 'weekdays' || s.repeat === 'weekends') return 'Weekly';
  if (s.repeat === 'monthly' || s.repeat === 'yearly') return 'Monthly';
  return 'Daily';
}

type T = (s: string, v?: Record<string, string | number>) => string;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every day", "Every Sunday and Wednesday", "Monthly on day 5", "Once, Nov 3"… */
export function scheduleText(s: VitSchedule, t: T, lang: 'en' | 'ar') {
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const d = new Date(`${s.date}T12:00:00`);
  switch (s.repeat) {
    case 'never':
      return t('Once, {d}', { d: new Intl.DateTimeFormat(loc, { weekday: 'short', month: 'short', day: 'numeric' }).format(d) });
    case 'daily':
      return t('Every day');
    case 'weekdays':
      return t('Weekdays');
    case 'weekends':
      return t('Weekends');
    case 'weekly': {
      const days = [...(s.days?.length ? s.days : [dow(s.date)])].sort((a, b) => a - b);
      if (days.length === 7) return t('Every day');
      if (days.length === 1) return t('Every {d}', { d: t(DAY_NAMES[days[0]]) });
      return t('Every {d}', { d: days.map((x) => t(SHORT[x])).join(t(', ')) });
    }
    case 'monthly':
      return t('Monthly on day {n}', { n: d.getDate() });
    case 'yearly':
      return t('Yearly on {d}', { d: new Intl.DateTimeFormat(loc, { month: 'long', day: 'numeric' }).format(d) });
    case 'every':
      return (s.every ?? 2) === 1 ? t('Every day') : t('Every {n} days', { n: s.every ?? 2 });
  }
}

/** Taken every day (for the "days in a row" count). */
export const isDaily = (s: VitSchedule) => s.repeat === 'daily' || (s.repeat === 'every' && (s.every ?? 2) === 1);

/** Is it due on this day? (for "due today" on the list). */
export function dueOn(s: VitSchedule, day: string) {
  if (day < s.date) return false;
  const w = dow(day);
  switch (s.repeat) {
    case 'never':
      return day === s.date;
    case 'daily':
      return true;
    case 'weekdays':
      return !weekendDays().includes(w);
    case 'weekends':
      return weekendDays().includes(w);
    case 'weekly':
      return (s.days?.length ? s.days : [dow(s.date)]).includes(w);
    case 'monthly':
      return Number(day.slice(8)) === Number(s.date.slice(8));
    case 'yearly':
      return day.slice(5) === s.date.slice(5);
    case 'every': {
      const n = Math.max(1, s.every ?? 2);
      const diff = Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${s.date}T12:00:00`).getTime()) / 864e5);
      return diff % n === 0;
    }
  }
}

/**
 * The phone reminders for a schedule: repeating ones by weekday, day of the month or date of the year; one-time and
 * "every few days" as their next dates (they're scheduled again each time the app opens).
 */
export function triggersOf(s: VitSchedule, today: string): { weekday?: number; monthDay?: number; month?: number; date?: string }[] {
  const wk = (days: number[]) => days.map((x) => ({ weekday: x + 1 }));
  switch (s.repeat) {
    case 'never':
      return s.date >= today ? [{ date: s.date }] : [];
    case 'daily':
      return [{}];
    case 'weekdays':
      return wk([0, 1, 2, 3, 4, 5, 6].filter((x) => !weekendDays().includes(x)));
    case 'weekends':
      return wk(weekendDays());
    case 'weekly':
      return wk(s.days?.length ? s.days : [dow(s.date)]);
    case 'monthly':
      return [{ monthDay: Number(s.date.slice(8)) }];
    case 'yearly':
      return [{ monthDay: Number(s.date.slice(8)), month: Number(s.date.slice(5, 7)) }];
    case 'every': {
      const n = Math.max(1, s.every ?? 2);
      const out: { date: string }[] = [];
      for (let d = s.date; out.length < 6 && d <= addDays(today, 120); d = addDays(d, n)) if (d >= today) out.push({ date: d });
      return out;
    }
  }
}
