import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { dayKcalGoal, fx, goalsFor } from '@/lib/progress';
import { useProgressInput } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

import { BarChart } from '../Charts';
import { ReadingInsight } from '../health/ReadingInsight';
import { Text } from '../Text';
import { Card, Row, Segmented } from '../ui';
import { SecHead } from './bits';

/** Food for recovery: calories, protein and water against your goals, and how eating well shows in your recovery. */
export function NutritionView() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const health = useHealth();
  const { profile } = useAuth();
  const x = useProgressInput();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const today = food.today;
  const span = range === 'week' ? 7 : 30;
  const days = Array.from({ length: span }, (_, i) => addDays(today, i - span + 1));
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const labels = range === 'week' ? days.map((d) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`))) : days.map((d, i) => (i % 5 === 0 ? String(Number(d.slice(8))) : ''));
  const of = (d: string) => x.days[d];
  const kcal = days.map((d) => (of(d)?.k ? Math.round(of(d)!.k) : null));
  const prot = days.map((d) => (of(d)?.k ? Math.round(of(d)!.p) : null));
  const water = days.map((d) => (of(d)?.w ? of(d)!.w : null));
  const kGoal = (d: string) => Math.round(dayKcalGoal(x, d));
  const pGoal = (d: string) => Math.round(goalsFor(x, d).protein);
  const onTarget = (d: string) => !!of(d)?.k && Math.abs(of(d)!.k - kGoal(d)) <= kGoal(d) * 0.1;
  const protMet = (d: string) => !!of(d)?.k && of(d)!.p >= pGoal(d) * 0.9;
  const avg = (v: (number | null)[]) => {
    const n = v.filter((y): y is number => y != null);
    return n.length ? Math.round(n.reduce((a, b) => a + b, 0) / n.length) : null;
  };
  const logged = days.filter((d) => !!of(d)?.k && (d !== today || onTarget(d)));
  const stats: [string, string, string][] = [
    ['Average calories', avg(kcal) != null ? fmt(avg(kcal)!) : '–', t('goal {n}', { n: fmt(Math.round(x.kcal)) })],
    ['Average protein', avg(prot) != null ? `${avg(prot)} ${t('g')}` : '–', t('goal {n}', { n: `${Math.round(x.protein)} ${t('g')}` })],
    ['Average water', avg(water) != null ? `${fx(avg(water)! / 1000)} ${t('L')}` : '–', t('goal {n}', { n: `${fx(x.water / 1000)} ${t('L')}` })],
    ['Calories on target', `${logged.filter(onTarget).length}/${logged.length}`, t('days')],
  ];

  // Recovery the morning after: days you hit your protein goal against days you didn't (last 30 days).
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 30));
  const next = (d: string) => health.checkins.find((ci) => ci.day === addDays(d, 1))?.score ?? null;
  const split = (fn: (d: string) => boolean) => avg(last30.filter((d) => !!of(d)?.k && fn(d)).map(next));
  const hit = split(protMet);
  const miss = split((d) => !protMet(d));
  const kOk = split(onTarget);
  const kOff = split((d) => !onTarget(d));

  const aiData = {
    name: 'Calories eaten',
    unit: 'kcal',
    series: Array.from({ length: 30 }, (_, i) => {
      const v = of(addDays(today, i - 29));
      return v?.k ? Math.round(v.k) : null;
    }),
    liveToday: true,
    dir: 0,
    goal: Math.round(x.kcal),
    female: profile?.gender === 'female',
    sex: profile?.gender ?? null,
    other: Object.fromEntries(
      Object.entries({
        goal: ['fast bulk', 'moderate bulk', 'maintain', 'fast cut', 'moderate cut'][food.plan.goal],
        proteinGoalGrams: Math.round(x.protein),
        protein30Days: Array.from({ length: 30 }, (_, i) => of(addDays(today, i - 29))?.p ?? null).map((v) => (v ? Math.round(v) : null)),
        waterGoalMl: x.water,
        averageWaterMl7Days: avg(days.slice(-7).map((d) => of(d)?.w || null)),
        recoveryAfterProteinGoalDays: hit,
        recoveryAfterMissedProteinDays: miss,
      }).filter(([, v]) => v != null),
    ),
  };

  if (!food.setupDone)
    return (
      <Card>
        <Text color="sec">{t('Set up your food goals to see how your eating supports recovery.')}</Text>
      </Card>
    );

  return (
    <View>
      <Segmented<'week' | 'month'>
        value={range}
        options={[
          { value: 'week', label: t('Week') },
          { value: 'month', label: t('Month') },
        ]}
        onChange={setRange}
      />
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          marginTop: 12,
        }}
      >
        {stats.map(([k, v, sub]) => (
          <View
            key={k}
            style={{
              width: '48.5%',
              backgroundColor: c.card,
              borderRadius: 22,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <Text variant="xs" weight={700} color="sec">
              {t(k)}
            </Text>
            <Text num size={20} style={{ marginTop: 4 }} numberOfLines={1}>
              {v}
            </Text>
            <Text variant="xs" color="sec">
              {sub}
            </Text>
          </View>
        ))}
      </View>
      <Card>
        <Text weight={700}>{t('Calories')}</Text>
        <View style={{ marginTop: 10 }}>
          <BarChart values={kcal} labels={labels} highlight={span - 1} goal={Math.round(x.kcal)} colors={days.map((d) => (of(d)?.k ? (onTarget(d) ? c.up : c.cobalt) : null))} />
        </View>
        <Text variant="xs" color="sec">
          {t('Green: within 10% of your goal. Dashed line: your goal.')}
        </Text>
      </Card>
      <Card>
        <Text weight={700}>{t('Protein')}</Text>
        <View style={{ marginTop: 10 }}>
          <BarChart values={prot} labels={labels} highlight={span - 1} goal={Math.round(x.protein)} colors={days.map((d) => (of(d)?.k ? (protMet(d) ? c.up : c.cobalt) : null))} />
        </View>
        <Text variant="xs" color="sec">
          {t('Protein helps your muscles repair. Green: goal met.')}
        </Text>
      </Card>

      {[hit, miss, kOk, kOff].some((v) => v != null) ? (
        <>
          <SecHead title={t('Food and your recovery')} />
          <Card>
            {[
              ['After days you hit your protein', hit, 'After days you missed it', miss],
              ['After days on your calorie target', kOk, 'After days off target', kOff],
            ].map(([a, va, b, vb], i) => (
              <View
                key={i}
                style={{
                  marginTop: i ? 12 : 0,
                  paddingTop: i ? 12 : 0,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.line,
                }}
              >
                {[
                  [a, va],
                  [b, vb],
                ].map(([k, v]) => (
                  <Row
                    key={k as string}
                    style={{
                      justifyContent: 'space-between',
                      marginVertical: 3,
                    }}
                  >
                    <Text variant="small" style={{ flex: 1 }}>
                      {t(k as string)}
                    </Text>
                    <Text variant="small" weight={700} num>
                      {v != null ? `${v}%` : '–'}
                    </Text>
                  </Row>
                ))}
              </View>
            ))}
            <Text variant="xs" color="sec" style={{ marginTop: 10 }}>
              {t('Your average recovery score the next morning, last 30 days.')}
            </Text>
          </Card>
        </>
      ) : null}
      <ReadingInsight id="nutrition-tab" day={today} data={aiData} ready={health.ready && !!x.goals} />
    </View>
  );
}
