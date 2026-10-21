import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { cardioKind, type DeviceDay, maxHeartRate, trimp, useDevices } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays } from '@/lib/nutrition';
import { recLabel, recovery, type RecoveryInput } from '@/lib/recovery';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { droppingLifts, EX, weekStart } from '@/lib/training';
import { wearableName } from '@/lib/wearables';
import { useSettings } from '@/theme/settings';

import { Icon, Mark } from '../Icon';
import { Ring } from '../Ring';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row, Springy } from '../ui';

/** Last night's HRV, resting heart rate and WHOOP/Oura score next to your 30-day usual. Null without today's readings. */
function watchBody(days: DeviceDay[], today: string): RecoveryInput['body'] {
  const d = days.find((x) => x.day === today);
  if (!d) return null;
  const usual = (k: 'hrv' | 'hr_rest') => {
    const xs = days.filter((x) => x.day < today && x.day >= addDays(today, -30) && x[k] != null).map((x) => x[k] as number);
    return xs.length >= 5 ? xs.reduce((a, v) => a + v, 0) / xs.length : null;
  };
  const device = d.recovery != null && d.wearable ? { name: wearableName(d.wearable), score: d.recovery } : null;
  if (!device && d.hrv == null && d.hr_rest == null) return null;
  return { hrv: d.hrv, hrvUsual: usual('hrv'), rhr: d.hr_rest, rhrUsual: usual('hr_rest'), device };
}

/**
 * Cardio the watch recorded in the last 4 weeks, as training work: heart-rate load (TRIMP / 10) when the watch
 * measured heart rate and a resting heart rate is known, otherwise a set per 8 minutes. Strength sessions are left out
 * (they're the Adro workouts already counted).
 */
function watchCardioLoad(days: DeviceDay[], today: string, dob: string | null | undefined, female: boolean) {
  const age = dob ? Math.max(14, Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10)) : 30;
  const rests = days.filter((d) => d.hr_rest != null).map((d) => d.hr_rest as number);
  const rest = rests.length ? rests.reduce((a, v) => a + v, 0) / rests.length : null;
  return days
    .filter((d) => d.day <= today && d.day > addDays(today, -28))
    .flatMap((d) =>
      d.workouts
        .filter((w) => cardioKind(w.type) !== 'skip' && w.minutes >= 5)
        .map((w) => ({ day: d.day, work: w.avg_hr && rest ? trimp(w.minutes, w.avg_hr, rest, maxHeartRate(age), female) / 10 : w.minutes / 8 })),
    );
}

/** Cardio you logged yourself in the last 4 weeks, as training work: a set per 8 minutes, more for hard and less for easy. */
function useLoggedCardio(userId: string | undefined, today: string, refresh: unknown) {
  const [rows, setRows] = useState<{ uid: string; xs: { day: string; work: number }[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('cardio_logs')
      .select('day,minutes,intensity')
      .gt('day', addDays(today, -28))
      .lte('day', today)
      .limit(500)
      .then(({ data, error }) => {
        if (!alive || error) return;
        const xs = ((data as { day: string; minutes: number; intensity: number }[] | null) ?? []).map((r) => ({ day: r.day, work: ((+r.minutes || 0) / 8) * ([0.75, 1, 1.3][r.intensity] ?? 1) }));
        setRows({ uid: userId, xs });
      });
    return () => {
      alive = false;
    };
  }, [userId, today, refresh]);
  return rows && rows.uid === userId ? rows.xs : [];
}

/** Everything the recovery score needs, from food, training and the watch. */
export function useRecovery() {
  const train = useTrain();
  const food = useFood();
  const { session, profile } = useAuth();
  const devices = useDevices(session?.user.id);
  // Refetched when today's cardio changes (logged or deleted).
  const logged = useLoggedCardio(session?.user.id, train.today, food.isToday ? food.cardio.length : -1);
  const watchCardio = watchCardioLoad(devices.days, train.today, profile?.date_of_birth, profile?.gender === 'female');
  // A day the watch recorded cardio uses the watch's, so the same run isn't counted twice.
  const watchDays = new Set(watchCardio.map((x) => x.day));
  const { todayCheckin: ci, days } = useHealth();
  // Sleep you logged wins; otherwise last night's sleep from your watch.
  const watchSleep = devices.days.find((d) => d.day === train.today)?.sleep_h ?? null;
  const sleep = ci?.sleep_h ?? watchSleep;
  const input = {
    today: train.today,
    checkin: ci || sleep != null ? { day: train.today, sleep, sore: ci?.sore ?? null, energy: ci?.energy ?? null } : null,
    logs: train.logs,
    // From the day totals, so looking at another day on the Food page doesn't change it.
    protein: food.setupDone ? { eaten: days[train.today]?.p ?? 0, yesterday: days[addDays(train.today, -1)]?.p ?? null, target: food.target.p } : null,
    // Today's water, even when the Food page is showing another day.
    water: { ml: food.isToday ? food.water : (days[food.today]?.w ?? 0), goal: food.waterGoal },
    tools: train.recTools,
    body: watchBody(devices.days, train.today),
    cardio: [...watchCardio, ...logged.filter((x) => !watchDays.has(x.day))],
  };
  return { input, r: recovery(input), watchSleep };
}

/** Recovery score on Train home (design: recoveryCard). */
export function RecoveryCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { r } = useRecovery();
  const [label, tone] = recLabel(r.score);
  return (
    <Card onPress={() => router.push('/recovery')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ring value={r.score} max={100} size={56} stroke={6} color={r.score >= 60 ? c.cobalt : c.down}>
        <Text num size={15}>
          {r.score}
        </Text>
      </Ring>
      <View style={{ flex: 1 }}>
        <Text variant="xs" weight={700} color="sec">
          {t('Recovery')}
        </Text>
        <Text weight={700} color={tone === 'down' ? 'down' : 'text'}>
          {t(label)}
        </Text>
        <Text variant="small" color="sec">
          {t(r.checked ? 'Tap for tips to recover faster' : 'Tap to tell me how you feel today')}
        </Text>
      </View>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
}

/** "Time for a lighter week?" when lifts drop two sessions in a row; or the deload week banner. */
export function DeloadCard() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const p = train.plan;
  if (!p) return null;
  const week = weekStart(train.today);
  if (p.deload === week)
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="bolt" size={22} color={c.cobalt} />
        <Text variant="small" style={{ flex: 1 }}>
          <Text variant="small" weight={700}>
            {t('Deload week is on.')}
          </Text>{' '}
          {t('Weights are about 60% and one set less. Next week you go back to normal.')}
        </Text>
        <Springy
          onPress={() => {
            // Ended early: only sessions after today count toward the next "lighter week?" suggestion.
            train.updatePlan({ deload: undefined, deloadEnd: train.today });
            toast(t('Back to normal weights'), { icon: 'train' });
          }}>
          <Text variant="small" weight={700} color="link">
            {t('End')}
          </Text>
        </Springy>
      </Card>
    );
  if (p.deloadDismissed === week) return null;
  const drops = droppingLifts(train.logs, train.plan);
  if (drops.length < 2) return null;
  const names = drops.slice(0, 2).map((id) => (EX[id] ? (lang === 'ar' ? EX[id].ar : EX[id].en) : (train.logs.flatMap((l) => l.exercises).find((x) => x.id === id)?.n ?? id)).toLowerCase());
  return (
    <Card>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Mark size={24} color={c.cobalt} stroke={5} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Time for a lighter week?')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Your {a} and {b} dropped two sessions in a row. A deload week lets your body catch up, then you come back stronger.', { a: names[0], b: names[1] })}
          </Text>
        </View>
      </Row>
      <Row gap={8} style={{ marginTop: 12 }}>
        <Button
          small
          title={t('Start deload week')}
          onPress={() => {
            train.updatePlan({ deload: week, deloadEnd: addDays(week, 6), deloadDismissed: week });
            toast(t('Deload week started'), { ai: true });
          }}
        />
        <Button small kind="soft" title={t('Not now')} onPress={() => train.updatePlan({ deloadDismissed: week })} />
      </Row>
    </Card>
  );
}
