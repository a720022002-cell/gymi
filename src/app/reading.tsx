import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart, LineChart } from '@/components/Charts';
import { DEVICE_FIELD, INFO, type ReadingKey } from '@/components/health/readings';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type DeviceDay, sourceName, useDevices } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

type Rows = { day: string; v: number }[];

/** One reading in detail: today vs usual, a day (by hour), week or month chart, and what it means (design: reading). */
export default function Reading() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const health = useHealth();
  const train = useTrain();
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  const { k: raw } = useLocalSearchParams<{ k: string }>();
  const k: ReadingKey = raw && raw in INFO ? (raw as ReadingKey) : 'steps';
  const info = INFO[k];
  const [pickRange, setRange] = useState<'day' | 'week' | 'month'>('week');
  const [fetched, setFetched] = useState<{ k: ReadingKey; rows: Rows } | null>(null);
  const today = food.today;
  // Steps and heart rate by hour, when the watch or phone sent them for today.
  const devToday = dev.days.find((d) => d.day === today);
  const hourly = k === 'steps' ? devToday?.hours?.steps : k === 'hr' ? devToday?.hours?.hr : null;
  const hasDay = !!hourly && hourly.some((x) => x != null && x > 0);
  const range = pickRange === 'day' && !hasDay ? 'week' : pickRange;
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

  const devRows = (f: keyof DeviceDay): Rows => dev.days.filter((d) => d[f] != null).map((d) => ({ day: d.day, v: Number(d[f]) }));
  const field = DEVICE_FIELD[k];
  const rows: Rows | null = field
    ? devRows(field)
    : k === 'weight'
      ? health.weights.map((x) => ({ day: x.day, v: x.value }))
      : k === 'sleep'
        ? [...devRows('sleep_h').filter((x) => !health.checkins.some((c) => c.day === x.day && c.sleep_h != null)), ...health.checkins.filter((x) => x.sleep_h != null).map((x) => ({ day: x.day, v: x.sleep_h as number }))]
        : k === 'recovery'
          ? health.checkins.filter((x) => x.score != null).map((x) => ({ day: x.day, v: x.score as number }))
          : fetched?.k === k
            ? fetched.rows
            : null;
  const by = new Map((rows ?? []).map((x) => [x.day, x.v]));
  // Steps: the higher of what you logged and what your phone counted. Today's own log may not be saved yet.
  if (k === 'steps') {
    devRows('steps').forEach((x) => by.set(x.day, Math.max(by.get(x.day) ?? 0, x.v)));
    by.set(today, Math.max(food.steps, devToday?.steps ?? 0));
  }
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
  const hours = hourly ?? [];
  const dayVals = hours.map((x) => (x == null || (k === 'hr' && x === 0) ? null : x));
  const vals = (range === 'day' ? dayVals : series).filter((x): x is number => x != null);
  const show = (v: number) => (info.dec ? fx(v) : fmt(v));
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const labels = range === 'day' ? hours.map((_, h) => (h % 3 === 0 ? ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'][h / 3] : '')) : range === 'week' ? days.map((d) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`))) : days.map((d, i) => (i % 5 === 0 ? String(Number(d.slice(8))) : ''));
  const enough = vals.length > (info.bar ? 0 : 1);
  const open: Partial<Record<ReadingKey, [string, () => void]>> = {
    steps: ['Log cardio or steps', () => router.push('/cardio')],
    burned: ['Log cardio or steps', () => router.push('/cardio')],
    weight: ['Open weight in Progress', () => router.push({ pathname: '/progress', params: { tab: 'body' } })],
    sleep: ['Open sleep in Progress', () => router.push({ pathname: '/progress', params: { tab: 'recovery' } })],
    recovery: ['Open recovery', () => router.push('/recovery')],
    workouts: ['Open Train', () => router.push('/train')],
    bed: ['Open sleep in Progress', () => router.push({ pathname: '/progress', params: { tab: 'recovery' } })],
    sleepEff: ['Open sleep in Progress', () => router.push({ pathname: '/progress', params: { tab: 'recovery' } })],
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
            {field || (k === 'steps' && devToday?.steps) ? t('Today, from {s}', { s: sourceName(dev.prefs.source) }) : by.has(today) || counted ? t('Today, from what you log') : latest ? t('Last logged') : t('Today')}
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
      <Segmented<'day' | 'week' | 'month'>
        value={range}
        options={[
          ...(hasDay ? [{ value: 'day' as const, label: t('Day') }] : []),
          { value: 'week' as const, label: t('Week') },
          { value: 'month' as const, label: t('Month') },
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
        ) : range === 'day' ? (
          k === 'hr' ? <LineChart values={vals} dots={false} /> : <BarChart values={dayVals} labels={labels} />
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
