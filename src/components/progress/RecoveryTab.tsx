import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useDevices } from '@/lib/devices';
import { useHealth } from '@/lib/health';
import { addDays } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { recLabel } from '@/lib/recovery';
import { useSettings } from '@/theme/settings';

import { ReadingInsight } from '../health/ReadingInsight';
import { ScoreParts } from '../health/ScoreParts';
import { Icon } from '../Icon';
import { Ring } from '../Ring';
import { Text } from '../Text';
import { useRecovery } from '../train/RecoveryCard';
import { SleepView } from '../sleep/SleepView';
import { Card, Segmented } from '../ui';
import { SecHead } from './bits';
import { WeightChart } from './WeightChart';
import { LoadView } from './LoadView';
import { NutritionView } from './NutritionView';

/** Recovery first, then its parts: sleep, training load and soreness, and food. */
export function RecoveryTab() {
  const { t } = useT();
  const [sub, setSub] = useState(0);
  return (
    <View>
      <Segmented<string>
        value={String(sub)}
        options={[
          { value: '0', label: t('Recovery') },
          { value: '1', label: t('Sleep') },
          { value: '2', label: t('Load') },
          { value: '3', label: t('Nutrition') },
        ]}
        onChange={(v) => setSub(Number(v))}
      />
      <View style={{ height: 12 }} />
      {sub === 0 ? <RecoveryNow /> : sub === 1 ? <SleepView /> : sub === 2 ? <LoadView /> : <NutritionView />}
    </View>
  );
}

/** Recovery score now and over time (design: progRecovery). */
function RecoveryNow() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const { r, input } = useRecovery();
  const [label, tone] = recLabel(r.score);
  const hist = health.checkins.filter((x) => x.score != null).slice(-30);
  // Tap a day on the chart to see that day's score and what it was made of (like the weight chart).
  const [sel, setSel] = useState<number | null>(null);
  const selDay = sel != null ? hist[sel]?.day : undefined;
  const picked = useRecovery(selDay);
  const parts = selDay ? picked.r.parts : r.parts;
  const { session, profile } = useAuth();
  const dev = useDevices(session?.user.id);
  const today = input.today;
  // What the coach reads: the last 30 days' scores (today live), what today's is made of, and the watch's heart data.
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(today, i - 29);
    return d === today ? r.score : (health.checkins.find((x) => x.day === d)?.score ?? null);
  });
  const wk = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null && x > 0);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const byDay = new Map(dev.days.map((d) => [d.day, d]));
  const aiData = {
    name: 'Recovery score',
    unit: '%',
    series,
    liveToday: true,
    dir: 1,
    goal: 60,
    female: profile?.gender === 'female',
    sex: profile?.gender ?? null,
    other: Object.fromEntries(
      Object.entries({
        todayScoreParts: Object.fromEntries(r.parts.map((p) => [p.key, p.value])),
        trainingLoadVsUsual: r.early ? null : Math.round(r.acwr * 10) / 10,
        sleepHours7Days: mean(wk.map((d) => health.checkins.find((x) => x.day === d)?.sleep_h ?? byDay.get(d)?.sleep_h)),
        hrv7Days: mean(wk.map((d) => byDay.get(d)?.hrv)),
        restingHr7Days: mean(wk.map((d) => byDay.get(d)?.hr_rest)),
        sorenessToday: input.checkin?.sore ?? null,
        energyToday: input.checkin?.energy ?? null,
      }).filter(([, v]) => v != null),
    ),
  };

  return (
    <View>
      <Card onPress={() => router.push('/recovery')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ring value={r.score} max={100} size={84} stroke={9} color={r.score >= 60 ? c.cobalt : c.down}>
          <Text num size={22}>{`${r.score}`}</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {t('Recovery today')}
          </Text>
          <Text variant="h3" color={tone === 'down' ? 'down' : tone === 'up' ? 'up' : 'text'}>
            {t(label)}
          </Text>
          <Text variant="small" color="sec">
            {t('Tap for what’s in your score and tips')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
      <Card>
        <Text weight={700}>{t('Recovery history')}</Text>
        {hist.length > 1 ? (
          <View style={{ marginTop: 8 }}>
            <WeightChart
              points={hist.map((x) => ({ day: x.day, value: x.score as number }))}
              target={60}
              labels={{ target: t('Ready'), current: t('Now'), num: (v) => `${Math.round(v)}%` }}
              dateLabel={(d) => shortDate(d, lang)}
              selected={sel}
              onSelect={setSel}
            />
            {selDay && sel != null ? (
              <View style={{ marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: c.inset, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="xs" weight={700} color="sec">
                    {shortDate(selDay, lang)}
                  </Text>
                  <Text weight={700}>{`${hist[sel].score}% · ${t(recLabel(hist[sel].score as number)[0])}`}</Text>
                </View>
                <Text variant="small" weight={700} color="link" onPress={() => setSel(null)}>
                  {t('Today')}
                </Text>
              </View>
            ) : null}
            <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
              {t('Dashed line: 60%, ready for a normal session. Tap a day to see it.')}
            </Text>
          </View>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t('Do your daily check-in to see your recovery over time.')}
          </Text>
        )}
      </Card>
      <SecHead title={selDay ? `${t('What’s in your score')} · ${shortDate(selDay, lang)}` : t('What’s in your score')} />
      <ScoreParts parts={parts} empty="Do your daily check-in to fill this in." />
      <ReadingInsight id="recovery-tab" day={today} data={aiData} ready={health.ready} />
    </View>
  );
}
