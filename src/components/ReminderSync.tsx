import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { buildReminders, listenReminderTaps, loadPrefs, onPrefs, remindersSupported, scheduleReminders } from '@/lib/reminders';

/** Phone apps: keep the scheduled reminders in step with your settings, meals and vitamins. Does nothing on the web. */
export function ReminderSync() {
  const { t } = useT();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const [rev, setRev] = useState(0);
  const meals = food.setupDone ? food.plan.meals.map((m) => `${m.n}@${m.t}`).join('|') : '';
  const vits = health.supplements.filter((v) => v.active && v.remind).map((v) => `${v.name}@${v.time}`).join('|');
  const workoutTime = food.plan.myWorkoutTime || food.plan.workoutTime || null;

  useEffect(() => listenReminderTaps((route) => router.push(route as never)), []);
  // Settings saved anywhere (Notifications, the bells on Food and Train) reschedule.
  useEffect(() => onPrefs(() => setRev((r) => r + 1)), []);

  useEffect(() => {
    if (!remindersSupported || !uid) return;
    const id = setTimeout(async () => {
      const p = await loadPrefs(uid);
      const list = buildReminders(
        p,
        {
          meals: meals ? meals.split('|').map((s) => ({ n: s.split('@')[0], t: s.split('@')[1] })) : [],
          vitamins: vits ? vits.split('|').map((s) => ({ name: s.split('@')[0], time: s.split('@')[1] })) : [],
          workoutTime,
        },
        t,
      );
      await scheduleReminders(list, false);
    }, 1500);
    return () => clearTimeout(id);
  }, [uid, meals, vits, workoutTime, t, rev]);
  return null;
}
