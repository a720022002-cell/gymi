import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useDevices } from '@/lib/devices';
import { useHealth } from '@/lib/health';
import { addDays } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { recLabel } from '@/lib/recovery';
import { useSettings } from '@/theme/settings';

import { LineChart } from '../Charts';
import { ReadingInsight } from '../health/ReadingInsight';
import { ScoreParts } from '../health/ScoreParts';
import { Icon } from '../Icon';
import { Ring } from '../Ring';
import { Text } from '../Text';
import { useRecovery } from '../train/RecoveryCard';
import { Card } from '../ui';
import { SecHead } from './bits';

/** Recovery score now and over time (design: progRecovery). Sleep has its own page. */
export function RecoveryTab() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const { r, input } = useRecovery();
  const [label, tone] = recLabel(r.score);
  const hist = health.checkins.filter((x) => x.score != null).slice(-30);
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
            <LineChart values={hist.map((x) => x.score as number)} labels={hist.map((x, i) => (i === 0 || i === hist.length - 1 ? shortDate(x.day, lang) : ''))} goal={60} />
            <Text variant="xs" color="sec">
              {t('Dashed line: 60%, ready for a normal session')}
            </Text>
          </View>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t('Do your daily check-in to see your recovery over time.')}
          </Text>
        )}
      </Card>
      <SecHead title={t('What’s in your score')} />
      <ScoreParts parts={r.parts} empty="Do your daily check-in to fill this in." />
      <ReadingInsight id="recovery-tab" day={today} data={aiData} ready={health.ready} />
    </View>
  );
}
