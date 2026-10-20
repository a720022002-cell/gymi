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

type Kind = 'water' | 'meals';

/** Reminder settings for one category, with a toggle that saves and reschedules (phone apps). */
export function useReminder(kind: Kind) {
  const { t, lang } = useT();
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

  const prefs = p && p.uid === uid ? p.v : null;
  const on = !!prefs?.[kind].on;
  const summary = (x: Prefs) =>
    kind === 'water'
      ? t('every {n} hours, {a} to {b}', { n: x.water.every, a: fmtTime(x.water.from, lang), b: fmtTime(x.water.to, lang) })
      : t('at each meal time');

  const toggle = async () => {
    if (!uid) return;
    const cur = prefs ?? (await loadPrefs(uid));
    const next: Prefs = { ...cur, [kind]: { ...cur[kind], on: !cur[kind].on } };
    setP({ uid, v: next });
    await savePrefs(uid, next);
    const name = kind === 'water' ? t('Water') : t('Meals and food');
    toast(next[kind].on ? t('{x} reminders on: {s}', { x: name, s: summary(next) }) : t('{x} reminders off', { x: name }), {
      icon: 'bell',
      action: { label: t('Settings'), fn: () => router.push('/notifications') },
    });
    if (!remindersSupported) return;
    const r = await scheduleReminders(
      buildReminders(next, { meals: food.setupDone ? food.plan.meals : [], vitamins: health.supplements.filter((x) => x.active && x.remind), workoutToday: null }, t),
      next[kind].on,
    );
    if (r === 'denied') toast(t('Turn on notifications for Adro in your phone settings.'), { icon: 'bell' });
  };

  return { on, prefs, summary: prefs ? summary(prefs) : '', toggle };
}

/** Bell in a screen's top bar: filled when that reminder is on (design: bellBtn). */
export function ReminderBell({ kind }: { kind: Kind }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const r = useReminder(kind);
  const name = kind === 'water' ? t('Water') : t('Meals and food');
  return (
    <Springy
      onPress={r.toggle}
      scaleTo={1.08}
      accessibilityRole="switch"
      accessibilityState={{ checked: r.on }}
      accessibilityLabel={t(r.on ? '{x} reminders on' : '{x} reminders off', { x: name })}>
      <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" size={22} color={r.on ? c.cobalt : c.text} strokeWidth={r.on ? 2.4 : 2} />
      </Glass>
    </Springy>
  );
}
