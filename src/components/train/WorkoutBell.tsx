import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { fmtTime } from '@/lib/nutrition';
import { buildReminders, loadPrefs, type Prefs, remindersSupported, savePrefs, scheduleReminders } from '@/lib/reminders';
import { useSettings } from '@/theme/settings';

import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { useToast } from '../Toast';
import { Springy } from '../ui';

/** Bell in the Train header: workout reminders on or off, saved and rescheduled (design: bellBtn('workout')). */
export function WorkoutBell() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const [p, setP] = useState<{ uid: string; v: Prefs } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    loadPrefs(uid).then((v) => alive && setP({ uid, v }));
    return () => {
      alive = false;
    };
  }, [uid]);
  const on = !!(p && p.uid === uid && p.v.workout.on);

  const toggle = async () => {
    if (!uid) return;
    const cur = p && p.uid === uid ? p.v : await loadPrefs(uid);
    const next: Prefs = { ...cur, workout: { ...cur.workout, on: !cur.workout.on } };
    setP({ uid, v: next });
    await savePrefs(uid, next);
    toast(next.workout.on ? t('Workout reminders on: every day at {x}', { x: fmtTime(next.workout.time, lang) }) : t('Workout reminders off'), {
      icon: 'bell',
      action: { label: t('Settings'), fn: () => router.push('/notifications') },
    });
    if (!remindersSupported) return;
    const r = await scheduleReminders(
      buildReminders(next, { meals: food.setupDone ? food.plan.meals : [], vitamins: health.supplements.filter((x) => x.active && x.remind), workoutToday: null }, t),
      next.workout.on,
    );
    if (r === 'denied') toast(t('Turn on notifications for Adro in your phone settings.'), { icon: 'bell' });
  };

  return (
    <Springy
      onPress={toggle}
      scaleTo={1.08}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t(on ? 'Workout reminders on' : 'Workout reminders off')}>
      <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" size={22} color={on ? c.cobalt : c.text} strokeWidth={on ? 2.4 : 2} />
      </Glass>
    </Springy>
  );
}
