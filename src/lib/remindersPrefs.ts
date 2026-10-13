import { useCallback, useEffect, useState } from 'react';

import { useT } from '@/i18n';

import { useAuth } from './auth';
import { useFood } from './food';
import { useHealth } from './health';
import { fmtTime } from './nutrition';
import { buildReminders, DEFAULT_PREFS, FREQ, loadPrefs, type NCat, type Prefs, remindersSupported, savePrefs, scheduleReminders, vitaminDays } from './reminders';
import { useTrain } from './train';

/** Reminder settings for the Notifications screens: read, save, and reschedule on the phone. */
export function useReminderPrefs() {
  const { t } = useT();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const { week } = useTrain();
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

  /** Save; ask = also ask the phone for permission. Answers 'denied' when notifications are off for Gymi. */
  const save = useCallback(
    async (next: Prefs, ask = false) => {
      if (!uid) return 'ok';
      setP({ uid, v: next });
      await savePrefs(uid, next);
      if (!remindersSupported) return 'ok';
      const vitamins = health.supplements.filter((x) => x.active && x.remind);
      return scheduleReminders(
        buildReminders(
          next,
          {
            meals: food.setupDone ? food.plan.meals : [],
            vitamins,
            vitDays: await vitaminDays(uid, vitamins),
            workoutTime: food.plan.myWorkoutTime || food.plan.workoutTime || null,
            workoutWeek: week.length ? week.map((d) => d.w) : null,
          },
          t,
        ),
        ask,
      );
    },
    [uid, food.setupDone, food.plan.meals, food.plan.myWorkoutTime, food.plan.workoutTime, health.supplements, week, t],
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
