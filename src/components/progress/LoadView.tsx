import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { dailyLoad, hoursToReady, muscleReady } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { muscleLabel, MUSCLES } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

import { BarChart } from '../Charts';
import { ReadingInsight } from '../health/ReadingInsight';
import { Bar } from '../Ring';
import { Text } from '../Text';
import { useRecovery } from '../train/RecoveryCard';
import { Card, Row } from '../ui';
import { SecHead } from './bits';

const SORE = ['None', 'A little', 'Very sore'];

/** Training load: this week against your usual, the last 14 days, week against week, soreness and muscles ready. */
export function LoadView() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const W = useWeight();
  const train = useTrain();
  const health = useHealth();
  const { profile } = useAuth();
  const { r } = useRecovery();
  const today = train.today;
  const ratio = Math.round(r.acwr * 10) / 10;
  // Under 0.8 lighter than usual, 0.8 to 1.3 the safe range, over 1.5 a jump that raises injury risk.
  const [status, tone] = r.early
    ? ['Building your baseline. It needs 2 weeks of workouts.', 'sec']
    : ratio < 0.8
      ? ['Lighter than usual. Fine for a rest week.', 'sec']
      : ratio <= 1.3
        ? ['In your usual range. Good balance.', 'up']
        : ratio <= 1.5
          ? ['Higher than usual. Sleep and eat well.', 'cobalt']
          : ['Much higher than usual. Watch your recovery.', 'down'];
  const load = dailyLoad(train.logs, today, 14);
  const dayLabel = (d: string) => t(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${d}T12:00:00`).getDay()]).slice(0, 2);

  // This week (last 7 days) against the 7 before.
  const week = (end: string) => {
    const ls = train.logs.filter((l) => l.day > addDays(end, -7) && l.day <= end);
    return {
      workouts: ls.length,
      sets: ls.reduce((a, l) => a + (l.sets_done || 0), 0),
      volume: ls.reduce((a, l) => a + Number(l.volume || 0), 0),
      minutes: ls.reduce((a, l) => a + (l.minutes || 0), 0),
    };
  };
  const now = week(today);
  const before = week(addDays(today, -7));
  const rows: [string, number, number, (v: number) => string][] = [
    ['Workouts', now.workouts, before.workouts, String],
    ['Sets', now.sets, before.sets, (v) => fmt(v)],
    ['Volume', now.volume, before.volume, (v) => `${fmt(Math.round(W.num(v)))} ${W.label}`],
    ['Minutes', now.minutes, before.minutes, (v) => fmt(v)],
  ];

  // Soreness from the daily check-in, last 14 days.
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const sore = days14.map((d) => health.checkins.find((x) => x.day === d)?.sore ?? null);
  const counts = [0, 1, 2].map((v) => sore.filter((x) => x === v).length);
  const soreColor = [c.up, '#D97706', c.down];
  // Days after a workout against rest days: how sore you were the next morning.
  const after = days14.filter((d, i) => i > 0 && sore[i] != null && train.logs.some((l) => l.day === addDays(d, -1))).map((d) => sore[days14.indexOf(d)] as number);
  const rest = days14.filter((d, i) => i > 0 && sore[i] != null && !train.logs.some((l) => l.day === addDays(d, -1))).map((d) => sore[days14.indexOf(d)] as number);
  const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const ready = muscleReady(train.logs, today);

  const aiData = {
    name: 'Training load (sets per day)',
    unit: 'sets',
    series: Array.from({ length: 30 }, (_, i) => {
      const d = addDays(today, i - 29);
      const ls = train.logs.filter((l) => l.day === d);
      return ls.length ? ls.reduce((a, l) => a + (l.sets_done || Math.round((l.minutes || 0) / 3)), 0) : null;
    }),
    liveToday: true,
    dir: 0,
    female: profile?.gender === 'female',
    sex: profile?.gender ?? null,
    other: Object.fromEntries(
      Object.entries({
        loadThisWeekVsUsual: r.early ? null : ratio,
        thisWeek: now,
        lastWeek: before,
        soreness14DaysNoneLittleVery: counts,
        sorenessAfterWorkoutDays: avg(after),
        sorenessAfterRestDays: avg(rest),
        musclesNotReady: MUSCLES.filter((m) => ready[m] < 80),
      }).filter(([, v]) => v != null),
    ),
  };

  return (
    <View>
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text variant="xs" weight={700} color="sec">
              {t('This week against your usual')}
            </Text>
            <Text variant="small" weight={700} color={tone as 'sec' | 'up' | 'cobalt' | 'down'} style={{ marginTop: 4 }}>
              {t(status)}
            </Text>
          </View>
          <Text num size={30}>
            {r.early ? '–' : `${ratio}×`}
          </Text>
        </Row>
        {!r.early ? (
          <View style={{ marginTop: 10 }}>
            <Bar value={Math.min(ratio, 2)} max={2} color={tone === 'down' ? c.down : tone === 'up' ? c.up : c.cobalt} />
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text variant="xs" color="sec">
                {t('Lighter')}
              </Text>
              <Text variant="xs" color="sec">
                {t('Usual')}
              </Text>
              <Text variant="xs" color="sec">
                {t('Much higher')}
              </Text>
            </Row>
          </View>
        ) : null}
      </Card>
      <Card>
        <Text weight={700}>{t('Training load, 14 days')}</Text>
        <View style={{ marginTop: 8 }}>
          <BarChart values={load.map((x) => x.volume || (x.minutes ? x.minutes * 10 : 0))} labels={load.map((x, i) => (i % 2 ? '' : dayLabel(x.day)))} highlight={load.length - 1} height={120} tip={(i) => `${shortDate(load[i].day, lang)} · ${load[i].volume ? `${fmt(Math.round(load[i].volume))} ${t('kg')}` : load[i].minutes ? `${load[i].minutes} ${t('min')}` : t('Rest')}`} />
        </View>
      </Card>

      <SecHead title={t('Week against week')} />
      <Card>
        <Row style={{ paddingBottom: 6 }}>
          <Text variant="xs" weight={700} color="sec" style={{ flex: 1 }}>
            {''}
          </Text>
          <Text variant="xs" weight={700} color="sec" style={{ width: 90, textAlign: 'right' }}>
            {t('Last 7 days')}
          </Text>
          <Text variant="xs" weight={700} color="sec" style={{ width: 90, textAlign: 'right' }}>
            {t('7 days before')}
          </Text>
        </Row>
        {rows.map(([k, a, b, f]) => (
          <Row
            key={k}
            style={{
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Text weight={700} style={{ flex: 1 }}>
              {t(k)}
            </Text>
            <Text num size={14} style={{ width: 90, textAlign: 'right' }} color={a > b ? 'up' : a < b ? 'down' : 'text'}>
              {f(a)}
            </Text>
            <Text num size={14} color="sec" style={{ width: 90, textAlign: 'right' }}>
              {f(b)}
            </Text>
          </Row>
        ))}
      </Card>

      <SecHead title={t('Muscle soreness')} />
      <Card>
        {counts.some((n) => n) ? (
          <>
            <BarChart values={sore.map((v) => (v == null ? null : v + 1))} colors={sore.map((v) => (v == null ? null : soreColor[v]))} labels={days14.map((d, i) => (i % 2 ? '' : dayLabel(d)))} max={3} height={90} />
            <Row gap={12} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {SORE.map((n, i) => (
                <Row key={n} gap={6}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: soreColor[i],
                    }}
                  />
                  <Text variant="xs" weight={700} color="sec">{`${t(n)} ${counts[i]}`}</Text>
                </Row>
              ))}
            </Row>
            {avg(after) != null && avg(rest) != null ? (
              <Text variant="small" color="sec" style={{ marginTop: 10 }}>
                {avg(after)! > avg(rest)! + 0.3
                  ? t('You’re sorer the day after a workout than after a rest day. Normal, but sleep and protein help.')
                  : t('Soreness stays about the same after workouts and rest days. Your body handles the load well.')}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="small" color="sec">
            {t('Do your daily check-in to see your soreness over time.')}
          </Text>
        )}
      </Card>

      <SecHead title={t('Muscles ready to train')} />
      <Card>
        {MUSCLES.map((m) => (
          <View key={m} style={{ marginTop: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" weight={700}>
                {muscleLabel(m, lang, t)}
              </Text>
              <Text variant="small" weight={700} num color={ready[m] >= 80 ? 'up' : 'sec'}>
                {hoursToReady(ready[m]) ? t('~{n} h', { n: hoursToReady(ready[m]) }) : t('Ready')}
              </Text>
            </Row>
            <View style={{ marginTop: 4 }}>
              <Bar value={ready[m]} max={100} color={ready[m] >= 80 ? c.up : ready[m] >= 55 ? '#D97706' : c.down} />
            </View>
          </View>
        ))}
      </Card>
      <ReadingInsight id="load-tab" day={today} data={aiData} ready={health.ready && train.ready} />
    </View>
  );
}
