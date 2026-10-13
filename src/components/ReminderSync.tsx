import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { buildReminders, listenReminderTaps, loadPrefs, onPrefs, onVitDays, remindersSupported, scheduleReminders, type VitReminder, vitaminDays } from '@/lib/reminders';
import { useTrain } from '@/lib/train';

/** Phone apps: keep the scheduled reminders in step with your settings, meals, workout days and vitamins. Does nothing on the web. */
export function ReminderSync() {
  const { t } = useT();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const train = useTrain();
  const [rev, setRev] = useState(0);
  const meals = food.setupDone ? food.plan.meals.map((m) => `${m.n}@${m.t}`).join('|') : '';
  const vits = JSON.stringify(health.supplements.filter((v) => v.active && v.remind).map((v): VitReminder => ({ id: v.id, name: v.name, time: v.time, freq: v.freq })));
  const workoutTime = food.plan.myWorkoutTime || food.plan.workoutTime || null;
  // This week's workout names, Sunday to Saturday (empty without a plan: then the reminder is daily).
  const week = train.week.map((d) => d.w ?? '').join('|');

  useEffect(() => listenReminderTaps((route) => router.push(route as never)), []);
  // Settings saved anywhere (Notifications, the bells on Food and Train, vitamin days) reschedule.
  useEffect(() => onPrefs(() => setRev((r) => r + 1)), []);
  useEffect(() => onVitDays(() => setRev((r) => r + 1)), []);

  useEffect(() => {
    if (!remindersSupported || !uid) return;
    const id = setTimeout(async () => {
      const p = await loadPrefs(uid);
      const vitamins = JSON.parse(vits) as VitReminder[];
      const list = buildReminders(
        p,
        {
          meals: meals ? meals.split('|').map((s) => ({ n: s.split('@')[0], t: s.split('@')[1] })) : [],
          vitamins,
          vitDays: await vitaminDays(uid, vitamins),
          workoutTime,
          workoutWeek: week ? week.split('|').map((w) => w || null) : null,
        },
        t,
      );
      await scheduleReminders(list, false);
    }, 1500);
    return () => clearTimeout(id);
  }, [uid, meals, vits, workoutTime, week, t, rev]);
  return null;
}
