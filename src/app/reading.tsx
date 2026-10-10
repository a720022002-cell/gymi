import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart, LineChart } from '@/components/Charts';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

type ReadingKey = 'steps' | 'burned' | 'weight' | 'sleep' | 'recovery' | 'workouts';

type Info = { name: string; icon: IconName; unit: string; bar?: boolean; dec?: boolean; dir: -1 | 0 | 1; goal?: number; what: string; coach: string; range: string };

/** What each reading means and how the coach uses it (design: RD). */
const INFO: Record<ReadingKey, Info> = {
  steps: { name: 'Steps', icon: 'walk', unit: '', bar: true, dir: 1, goal: 8000, what: 'How much you walked today, from your phone, your watch or what you log.', coach: 'Low on steps on a rest day? I’ll suggest a short evening walk.', range: 'Your goal: 8,000 steps a day' },
  burned: { name: 'Calories burned in exercise', icon: 'flame', unit: 'kcal', bar: true, dir: 0, what: 'Calories you burned in workouts and cardio today.', coach: 'Extra activity is added to today’s food budget, so you can eat a bit more on active days.', range: 'Most training days: 200 to 600 kcal from exercise' },
  weight: { name: 'Weight', icon: 'scale', unit: 'kg', dec: true, dir: 0, what: 'From your smart scale or the weight you log each morning.', coach: 'I use your weekly average, not single days, to decide if your calories need a change.', range: 'Normal daily swing: up to 1 kg from water and food' },
  sleep: { name: 'Sleep', icon: 'moon', unit: 'h', bar: true, dec: true, dir: 1, goal: 7.5, what: 'How long you slept, from your morning check-in or your watch.', coach: 'Short on sleep? I keep your workout but make it a bit lighter.', range: 'Aim for 7 to 9 hours' },
  recovery: { name: 'Recovery', icon: 'bolt', unit: '%', dir: 1, goal: 67, what: 'How ready your body is to train today, from your sleep, soreness and energy.', coach: 'Under 33%: I make the workout lighter. Over 66%: you’re ready to push.', range: '67% or more is ready to train hard' },
  workouts: { name: 'Workouts', icon: 'train', unit: 'min', bar: true, dir: 0, what: 'Minutes you trained each day.', coach: 'I spread hard and easy days through your week so you don’t burn out.', range: 'Your plan: {n} workouts a week' },
};

type Rows = { day: string; v: number }[];

/** One reading in detail: today vs usual, week or month chart, and what it means (design: reading). */
export default function Reading() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const health = useHealth();
  const train = useTrain();
  const { k: raw } = useLocalSearchParams<{ k: string }>();
  const k: ReadingKey = raw && raw in INFO ? (raw as ReadingKey) : 'steps';
  const info = INFO[k];
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [fetched, setFetched] = useState<{ k: ReadingKey; rows: Rows } | null>(null);
  const today = food.today;
  const days = Array.from({ length: range === 'week' ? 7 : 30 }, (_, i) => addDays(today, i - (range === 'week' ? 6 : 29)));

  // Steps, exercise calories and workouts are loaded here; the rest is already in the health store.
  useEffect(() => {
    if (k !== 'steps' && k !== 'burned' && k !== 'workouts') return;
    let alive = true;
    const from = addDays(today, -29);
    (async () => {
      let rows: Rows = [];
      if (k === 'steps') {
        const { data } = await supabase.from('step_logs').select('day,steps').gte('day', from);
        rows = ((data as { day: string; steps: number }[]) ?? []).map((x) => ({ day: x.day, v: x.steps }));
      } else {
        const [w, cd] = await Promise.all([
          supabase.from('workout_logs').select('day,kcal,minutes').gte('day', from).limit(500),
          k === 'burned' ? supabase.from('cardio_logs').select('day,kcal').gte('day', from).limit(500) : Promise.resolve({ data: [] }),
        ]);
        const sum = new Map<string, number>();
        for (const x of (w.data as { day: string; kcal: number; minutes: number }[]) ?? []) sum.set(x.day, (sum.get(x.day) ?? 0) + (k === 'burned' ? x.kcal : x.minutes));
        for (const x of (cd.data as { day: string; kcal: number }[]) ?? []) sum.set(x.day, (sum.get(x.day) ?? 0) + x.kcal);
        rows = [...sum].map(([day, v]) => ({ day, v }));
      }
      if (alive) setFetched({ k, rows });
    })();
    return () => {
      alive = false;
    };
  }, [k, today]);

  const rows: Rows | null =
    k === 'weight'
      ? health.weights.map((x) => ({ day: x.day, v: x.value }))
      : k === 'sleep'
        ? health.checkins.filter((x) => x.sleep_h != null).map((x) => ({ day: x.day, v: x.sleep_h as number }))
        : k === 'recovery'
          ? health.checkins.filter((x) => x.score != null).map((x) => ({ day: x.day, v: x.score as number }))
          : fetched?.k === k
            ? fetched.rows
            : null;
  const by = new Map((rows ?? []).map((x) => [x.day, x.v]));
  // Today's own log always wins for steps (it may not be saved yet).
  if (k === 'steps') by.set(today, food.steps);
  // Counted days (steps, calories, minutes) are 0 when nothing was logged; measured ones are blank.
  const counted = k === 'steps' || k === 'burned' || k === 'workouts';
  const series = days.map((d) => by.get(d) ?? (counted ? 0 : null));
  const last7 = Array.from({ length: 7 }, (_, i) => by.get(addDays(today, i - 6)) ?? (counted ? 0 : null)).filter((x): x is number => x != null);
  const latest = [...(rows ?? [])].sort((a, b) => a.day.localeCompare(b.day)).at(-1);
  const now = by.get(today) ?? (counted ? 0 : (latest?.v ?? null));
  const avg7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null;
  const diff = now != null && avg7 != null ? now - avg7 : 0;
  const goal = food.plan?.goal;
  const dir = k === 'weight' ? (goal == null || goal === 2 ? 0 : goal <= 1 ? 1 : -1) : info.dir;
  const good = dir === 0 ? null : Math.sign(diff) === dir;
  const vals = series.filter((x): x is number => x != null);
  const show = (v: number) => (info.dec ? fx(v) : fmt(v));
  const locale = lang === 'ar' ? 'ar' : 'en-US';
  const labels = range === 'week' ? days.map((d) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`))) : days.map((d, i) => (i % 5 === 0 ? String(Number(d.slice(8))) : ''));
  const enough = vals.length > (info.bar ? 0 : 1);
  const open: Partial<Record<ReadingKey, [string, () => void]>> = {
    steps: ['Log cardio or steps', () => router.push('/cardio')],
    burned: ['Log cardio or steps', () => router.push('/cardio')],
    weight: ['Open weight in Progress', () => router.push({ pathname: '/progress', params: { tab: 'body' } })],
    sleep: ['Open sleep in Progress', () => router.push({ pathname: '/progress', params: { tab: 'recovery' } })],
    recovery: ['Open recovery', () => router.push('/recovery')],
    workouts: ['Open Train', () => router.push('/train')],
  };
  const [btn, go] = open[k] ?? [];

  return (
    <Screen title={t(info.name)} back>
      <Card>
        <Row gap={10}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={info.icon} size={18} color={c.cobalt} />
          </View>
          <Text variant="small" weight={700} color="sec">
            {by.has(today) || counted ? t('Today, from what you log') : latest ? t('Last logged') : t('Today')}
          </Text>
        </Row>
        <Row style={{ marginTop: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text num size={40}>
            {now == null ? '–' : show(now)}
            {info.unit && now != null ? <Text num size={16} weight={500} color="sec">{` ${t(info.unit)}`}</Text> : null}
          </Text>
          {now == null || avg7 == null ? null : Math.abs(diff) > (info.dec ? 0.05 : 0.5) ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Row gap={2}>
                <Icon name={diff > 0 ? 'up' : 'down'} size={15} strokeWidth={2.4} color={good == null ? c.sec : good ? c.up : c.down} />
                <Text variant="small" weight={700} style={{ color: good == null ? c.sec : good ? c.up : c.down }}>
                  {show(Math.abs(diff))}
                </Text>
              </Row>
              <Text variant="xs" color="sec">
                {t('vs 7-day average')}
              </Text>
            </View>
          ) : (
            <Text variant="small" color="sec">
              {t('Same as usual')}
            </Text>
          )}
        </Row>
      </Card>
      <Segmented<'week' | 'month'>
        value={range}
        options={[
          { value: 'week', label: t('Week') },
          { value: 'month', label: t('Month') },
        ]}
        onChange={setRange}
      />
      <Card style={{ marginTop: 12 }}>
        {rows == null ? (
          <View style={{ height: 150 }} />
        ) : !enough ? (
          <Text color="sec" center style={{ paddingVertical: 30 }}>
            {t('Log this on a few days to see a chart.')}
          </Text>
        ) : info.bar ? (
          <BarChart values={series} labels={labels} highlight={series.length - 1} goal={info.goal} />
        ) : (
          <LineChart values={vals} dots={range === 'week'} goal={info.goal} />
        )}
      </Card>
      {vals.length ? (
        <Row gap={8}>
          {(
            [
              ['Average', vals.reduce((a, b) => a + b, 0) / vals.length],
              ['Lowest', Math.min(...vals)],
              ['Highest', Math.max(...vals)],
            ] as const
          ).map(([a, v]) => (
            <Card key={a} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}>
              <Text num size={18}>
                {show(v)}
              </Text>
              <Text variant="xs" weight={700} color="sec">
                {t(a)}
              </Text>
            </Card>
          ))}
        </Row>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('What it means')}
      </Text>
      <Card>
        <Text>{t(info.what)}</Text>
        <Row gap={6} style={{ marginTop: 12 }}>
          <Icon name="info" size={16} color={c.cobalt} />
          <Text variant="small" color="sec" style={{ flex: 1 }}>
            {t(info.range, { n: train.plan?.days ?? 3 })}
          </Text>
        </Row>
      </Card>
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={22} color={c.cobalt} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('How your coach uses it')}</Text>
          <Text variant="small" style={{ marginTop: 4 }}>
            {t(info.coach)}
          </Text>
        </View>
      </Card>
      {btn && go ? <Button kind="glass" title={t(btn)} style={{ marginTop: 4 }} onPress={go} /> : null}
    </Screen>
  );
}
