import { router } from 'expo-router';
import { useEffect } from 'react';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { buildReminders, listenReminderTaps, loadPrefs, remindersSupported, scheduleReminders } from '@/lib/reminders';

/** Phone apps: keep the scheduled reminders in step with your meals and vitamins. Does nothing on the web. */
export function ReminderSync() {
  const { t } = useT();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const meals = food.setupDone ? food.plan.meals.map((m) => `${m.n}@${m.t}`).join('|') : '';
  const vits = health.supplements.filter((v) => v.active && v.remind).map((v) => `${v.name}@${v.time}`).join('|');

  useEffect(() => listenReminderTaps((route) => router.push(route as never)), []);

  useEffect(() => {
    if (!remindersSupported || !uid) return;
    const id = setTimeout(async () => {
      const p = await loadPrefs(uid);
      const list = buildReminders(
        p,
        {
          meals: meals ? meals.split('|').map((s) => ({ n: s.split('@')[0], t: s.split('@')[1] })) : [],
          vitamins: vits ? vits.split('|').map((s) => ({ name: s.split('@')[0], time: s.split('@')[1] })) : [],
          workoutToday: null,
        },
        t,
      );
      await scheduleReminders(list, false);
    }, 1500);
    return () => clearTimeout(id);
  }, [uid, meals, vits, t]);
  return null;
}
