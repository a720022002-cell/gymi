import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BarChart, LineChart } from '@/components/Charts';
import { ReadingInsight } from '@/components/health/ReadingInsight';
import { DEVICE_FIELD, INFO, type ReadingKey } from '@/components/health/readings';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SleepStages } from '@/components/sleep/SleepStages';
import { Text } from '@/components/Text';
import { Button, Card, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type DeviceDay, sourceName, useDevices, useStepGoal, vo2Level } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { goalOf } from '@/lib/cardioCoach';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useWeight } from '@/lib/units';
import { wearableName } from '@/lib/wearables';
import { useSettings } from '@/theme/settings';

type Rows = { day: string; v: number }[];

/** One reading in detail: today vs usual, a day (by hour), week or month chart, and what it means (design: reading). */
export default function Reading() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const health = useHealth();
  const train = useTrain();
  const { session, profile } = useAuth();
  const dev = useDevices(session?.user.id);
  const stepGoal = useStepGoal(session?.user.id);
  const { k: raw } = useLocalSearchParams<{ k: string }>();
  const k: ReadingKey = raw && raw in INFO ? (raw as ReadingKey) : 'steps';
  const info = INFO[k];
  // Weight in the unit you picked (kg or lb); the rest have one unit.
  const W = useWeight();
  const unit = k === 'weight' ? W.unit : info.unit;
  const [pickRange, setRange] = useState<'day' | 'week' | 'month' | '3m'>('week');
  const [fetched, setFetched] = useState<{ k: ReadingKey; rows: Rows } | null>(null);
  const today = food.today;
  // Steps and heart rate by hour, when the watch or phone sent them for today.
  const devToday = dev.days.find((d) => d.day === today);
  const hourly = k === 'steps' ? devToday?.hours?.steps : k === 'hr' ? devToday?.hours?.hr : null;
  const hasDay = !!hourly && hourly.some((x) => x != null && x > 0);
  const range = pickRange === 'day' && !hasDay ? 'week' : pickRange;
  const span = range === 'week' ? 7 : range === '3m' ? 91 : 30;
  const days = Array.from({ length: span }, (_, i) => addDays(today, i - span + 1));

  // Steps, exercise calories and workouts are loaded here; the rest is already in the health store.
  useEffect(() => {
    if (k !== 'steps' && k !== 'burned' && k !== 'workouts') return;
    let alive = true;
    const from = addDays(today, -90);
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
      ? health.weights.map((x) => ({ day: x.day, v: W.num(x.value) }))
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
  const daily = days.map((d) => by.get(d) ?? (counted ? 0 : null));
  // Three months: one point a week (the average of the days that have a reading).
  const series =
    range === '3m'
      ? Array.from({ length: 13 }, (_, w) => {
          const v = daily.slice(w * 7, w * 7 + 7).filter((x): x is number => x != null);
          return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
        })
      : daily;
  // Counted readings: "usual", averages and the lowest leave out days with nothing logged and today (it isn't over).
  const last7 = (counted ? Array.from({ length: 7 }, (_, i) => by.get(addDays(today, i - 7))) : Array.from({ length: 7 }, (_, i) => by.get(addDays(today, i - 6)))).filter((x): x is number => x != null);
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
  const statVals = range !== 'day' && counted ? days.filter((d) => d < today && by.has(d)).map((d) => by.get(d) as number) : vals;
  const goalLine = k === 'steps' ? stepGoal : info.goal;
  const show = (v: number) => (info.dec ? fx(v) : fmt(v));
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  // Every third hour, like 12a or 3p (ص / م in Arabic).
  const hourLabel = (h: number) => `${h % 12 || 12}${lang === 'ar' ? (h < 12 ? 'ص' : 'م') : h < 12 ? 'a' : 'p'}`;
  const labels = range === 'day' ? hours.map((_, h) => (h % 3 === 0 ? hourLabel(h) : '')) : range === 'week' ? days.map((d) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`))) : range === '3m' ? series.map((_, w) => (w < 12 && w % 4 === 0 ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(`${days[w * 7]}T12:00:00`)) : '')) : days.map((d, i) => (i % 5 === 0 ? String(Number(d.slice(8))) : ''));
  const enough = vals.length > (info.bar ? 0 : 1);
  const open: Partial<Record<ReadingKey, [string, () => void]>> = {
    steps: ['Log cardio or steps', () => router.push('/cardio')],
    burned: ['Log cardio or steps', () => router.push('/cardio')],
    weight: ['Open weight in Progress', () => router.push({ pathname: '/progress', params: { tab: 'body' } })],
    sleep: ['Open sleep', () => router.push('/sleep')],
    recovery: ['Open recovery', () => router.push('/recovery')],
    workouts: ['Open Train', () => router.push('/train')],
    bed: ['Open sleep', () => router.push('/sleep')],
    sleepEff: ['Open sleep', () => router.push('/sleep')],
  };
  const [btn, go] = open[k] ?? [];
  // Where today's reading came from: the phone's health app, or a band or ring linked directly (its own readings,
  // and sleep and heart ones unless the phone is your main device).
  const phoneDay = devToday?.source === 'apple' || devToday?.source === 'health_connect' ? devToday.source : null;
  const wearOnly: (keyof DeviceDay)[] = ['recovery', 'strain', 'sleep_score'];
  const wearWins: (keyof DeviceDay)[] = ['hrv', 'hr_rest', 'sleep_h', 'in_bed_h', 'sleep_eff', 'spo2', 'temp_dev'];
  const fromWear = !!devToday?.wearable && (!phoneDay || (!!field && (wearOnly.includes(field) || (dev.prefs.primary !== 'phone' && wearWins.includes(field)))));
  const srcName = fromWear && devToday?.wearable ? wearableName(devToday.wearable) : phoneDay ? sourceName(phoneDay) : null;

  // What the coach reads for its analysis: the last 30 days (today last) and a few other averages for context.
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const v = by.get(addDays(today, i - 29));
    return v == null ? (counted ? 0 : null) : Math.round(v * 10) / 10;
  });
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null && x > 0);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const wk = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7));
  const other = {
    sleepHours7Days: mean(wk.map((d) => health.checkins.find((x) => x.day === d)?.sleep_h ?? dev.days.find((x) => x.day === d)?.sleep_h)),
    steps7Days: mean(wk.map((d) => dev.days.find((x) => x.day === d)?.steps)),
    recoveryToday: health.checkins.find((x) => x.day === today)?.score ?? null,
    restingHr7Days: mean(wk.map((d) => dev.days.find((x) => x.day === d)?.hr_rest)),
    workoutsPlannedPerWeek: train.plan?.days ?? null,
  };
  const aiData = {
    name: info.name,
    unit: unit || null,
    series: last30,
    counted,
    dir,
    goal: goalLine ?? null,
    goalType: goalOf(goal),
    age: ageOf(profile?.date_of_birth),
    sex: profile?.gender ?? null,
    female: profile?.gender === 'female',
    device: srcName,
    other: Object.fromEntries(Object.entries(other).filter(([key, v]) => v != null && key !== k)),
  };

  return (
    <Screen title={t(info.name)} back>
      <Card>
        <Row gap={10}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={info.icon} size={18} color={c.cobalt} />
          </View>
          <Text variant="small" weight={700} color="sec">
            {srcName && (field || (k === 'steps' && devToday?.steps)) ? t('Today, from {s}', { s: srcName }) : by.has(today) || counted ? t('Today, from what you log') : latest ? t('Last logged') : t('Today')}
          </Text>
        </Row>
        <Row style={{ marginTop: 12, alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text num size={40}>
            {now == null ? '–' : show(now)}
            {unit && now != null ? <Text num size={16} weight={500} color="sec">{` ${t(unit)}`}</Text> : null}
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
      <Segmented<'day' | 'week' | 'month' | '3m'>
        value={range}
        options={[
          ...(hasDay ? [{ value: 'day' as const, label: t('Day') }] : []),
          { value: 'week' as const, label: t('Week') },
          { value: 'month' as const, label: t('Month') },
          { value: '3m' as const, label: t('3 months') },
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
          <BarChart values={series} labels={labels} highlight={series.length - 1} goal={goalLine} />
        ) : (
          <LineChart values={vals} dots={range === 'week'} goal={goalLine} />
        )}
      </Card>
      {statVals.length ? (
        <Row gap={8}>
          {(
            [
              ['Average', statVals.reduce((a, b) => a + b, 0) / statVals.length],
              ['Lowest', Math.min(...statVals)],
              ['Highest', Math.max(...statVals)],
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
      {k === 'sleep' ? <SleepStages days={dev.days} today={today} /> : null}
      {k === 'vo2' && devLatestVo2(dev.days) != null ? (
        <Vo2More vo2={devLatestVo2(dev.days) as number} age={ageOf(profile?.date_of_birth)} female={profile?.gender === 'female'} />
      ) : null}
      <ReadingInsight id={k} day={today} data={aiData} ready={rows != null && health.ready} />
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('What it means')}
      </Text>
      <Card>
        <Text>{t(info.what)}</Text>
        <Row gap={6} style={{ marginTop: 12 }}>
          <Icon name="info" size={16} color={c.cobalt} />
          <Text variant="small" color="sec" style={{ flex: 1 }}>
            {k === 'steps' ? t('Your goal: {n} steps a day', { n: fmt(stepGoal) }) : W.words(t(info.range, { n: train.plan?.days ?? 3 }))}
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

const devLatestVo2 = (days: DeviceDay[]) => [...days].reverse().find((d) => d.vo2 != null)?.vo2 ?? null;
const ageOf = (dob?: string | null) => (dob ? Math.max(14, Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10)) : 30);
/** Where your VO2 max stands for your age and sex. */
function Vo2More({ vo2, age, female }: { vo2: number; age: number; female: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const lv = vo2Level(vo2, age, female);
  const steps = ['Low', 'Fair', 'Good', 'Excellent', 'Superior'] as const;
  const i = steps.indexOf(lv);
  return (
    <Card>
      <Text weight={700}>{t('For your age: {l}', { l: t(lv) })}</Text>
      <Row gap={4} style={{ marginTop: 10 }}>
        {steps.map((x, j) => (
          <View key={x} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: j <= i ? (i >= 2 ? c.up : i === 1 ? c.cobalt : c.down) : c.inset }} />
        ))}
      </Row>
      <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
        {t('Compared with {s} aged {a}, from common fitness norms. Regular cardio raises it slowly over weeks.', { s: t(female ? 'women' : 'men'), a: age })}
      </Text>
    </Card>
  );
}
