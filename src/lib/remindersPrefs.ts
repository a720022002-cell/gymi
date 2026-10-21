import { useCallback, useEffect, useState } from 'react';

import { useAuth } from './auth';
import { fmtTime } from './nutrition';
import { askNotifPermission, DEFAULT_PREFS, FREQ, loadPrefs, type NCat, notifPermission, type Prefs, remindersSupported, savePrefs } from './reminders';

/** Reminder settings for the Notifications screens: read and save (ReminderSync reschedules on the phone). */
export function useReminderPrefs() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [p, setP] = useState<{ uid: string; v: Prefs } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    loadPrefs(uid).then((v) => alive && setP({ uid, v }));
    return () => {
      alive = false;
    };
  }, [uid]);

  const prefs = p && p.uid === uid ? p.v : DEFAULT_PREFS;

  /** Save; ask = also ask the phone for permission. Answers 'denied' when notifications are off for Adro. */
  const save = useCallback(
    async (next: Prefs, ask = false): Promise<'ok' | 'denied'> => {
      if (!uid) return 'ok';
      setP({ uid, v: next });
      // ReminderSync hears this and schedules, so there's one scheduler.
      await savePrefs(uid, next);
      if (!remindersSupported) return 'ok';
      if (ask) return (await askNotifPermission()) ? 'ok' : 'denied';
      return (await notifPermission()) === 'denied' ? 'denied' : 'ok';
    },
    [uid],
  );

  return { prefs, ready: !!p, save };
}

type T = (s: string, v?: Record<string, string | number>) => string;
const DAY_NAMES: Record<string, string> = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

/** One line about a reminder type, e.g. "Every 2 hours, 8:00 AM to 10:00 PM" (design: catSummary). */
export function catSummary(k: NCat, p: Prefs, t: T, lang: 'en' | 'ar') {
  const tm = (x: string) => fmtTime(x, lang);
  switch (k) {
    case 'water':
      return p.water.freq === 'day' ? `${t(FREQ.day)}, ${tm(p.water.from)}` : t('{f}, {a} to {b}', { f: t(FREQ[p.water.freq]), a: tm(p.water.from), b: tm(p.water.to) });
    case 'food':
      return p.food.mode === 'before' ? t('{n} min before each meal', { n: p.food.before }) : p.food.mode === 'after' ? t('After each meal, to log it') : t('Once a day');
    case 'workout':
      return p.workout.before ? (p.workout.before === 60 ? t('1 hour before your workout') : t('{n} min before your workout', { n: p.workout.before })) : t('At workout time');
    case 'checkin':
      return t('Every day at {x}', { x: tm(p.checkin.time) });
    case 'sleep':
      return p.sleep.wind ? t('Bedtime {x}, plus a wind-down reminder', { x: tm(p.sleep.time) }) : t('Bedtime {x}', { x: tm(p.sleep.time) });
    case 'vitamins':
      return t('At each vitamin’s own time');
    case 'report':
      return t('{d} at {x}', { d: t(DAY_NAMES[p.report.day] ?? 'Friday'), x: tm(p.report.time) });
    case 'friends': {
      const on = [p.friends.prs && t('PRs'), p.friends.challenges && t('challenges'), p.friends.cheers && t('cheers')].filter(Boolean);
      return on.length ? on.join(', ') : t('Nothing selected');
    }
  }
}
