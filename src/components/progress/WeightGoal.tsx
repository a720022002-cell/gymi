import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt, maintenance, targetFits } from '@/lib/nutrition';
import { dayKcalGoal, shortDate, weekAvg } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useWeight } from '@/lib/units';
import { useProgressInput } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

import { ReadingInsight } from '../health/ReadingInsight';
import { Icon, type IconName } from '../Icon';
import { Bar } from '../Ring';
import { Text } from '../Text';
import { Card, Row } from '../ui';
import { SecHead } from './bits';

/** Cardio you logged in the last 28 days (minutes and calories by day). */
function useCardio28(uid: string | undefined, today: string) {
  const [rows, setRows] = useState<{
    key: string;
    xs: { day: string; minutes: number; kcal: number }[];
  } | null>(null);
  const key = `${uid}|${today}`;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase
      .from('cardio_logs')
      .select('day,minutes,kcal')
      .gt('day', addDays(today, -28))
      .lte('day', today)
      .limit(500)
      .then(({ data }) => {
        if (!alive) return;
        const xs = ((data as { day: string; minutes: number; kcal: number }[] | null) ?? []).map((r) => ({
          day: r.day,
          minutes: Number(r.minutes || 0),
          kcal: Number(r.kcal || 0),
        }));
        setRows({ key: `${uid}|${today}`, xs });
      });
    return () => {
      alive = false;
    };
  }, [uid, today]);
  return rows?.key === key ? rows.xs : null;
}

/** Your target weight and what moves you toward it: food, training and cardio, week by week (last 4 weeks). */
export function WeightGoal() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const W = useWeight();
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const { session, profile } = useAuth();
  const x = useProgressInput();
  const today = food.today;
  const cardio = useCardio28(session?.user.id, today);
  const ws = health.weights;
  const goal = food.plan.goal;
  const cut = goal >= 3;
  const bulk = goal <= 1;
  const latest = ws.at(-1)?.value ?? null;
  const cur = weekAvg(ws, today) ?? latest;
  const target = targetFits(goal, food.plan.weight, food.plan.targetWeight) ? (food.plan.targetWeight as number) : null;
  const start = ws[0]?.value ?? null;

  // Last 4 weeks, newest last. A week's change: its average weight against the week before.
  const weeks = [3, 2, 1, 0].map((i) => {
    const end = addDays(today, -7 * i);
    const from = addDays(end, -6);
    const a = weekAvg(ws, end);
    const b = weekAvg(ws, addDays(end, -7));
    // Food days that are over (today still changes).
    const fd: string[] = [];
    for (let d = from; d <= end; d = addDays(d, 1)) if (d < today && x.days[d]?.k > 0) fd.push(d);
    const onT = fd.filter((d) => Math.abs(x.days[d].k - dayKcalGoal(x, d)) <= dayKcalGoal(x, d) * 0.1).length;
    const kcal = fd.length ? Math.round(fd.reduce((s, d) => s + x.days[d].k, 0) / fd.length) : null;
    const cd = (cardio ?? []).filter((r) => r.day >= from && r.day <= end);
    return {
      from,
      end,
      change: a != null && b != null ? Math.round((a - b) * 100) / 100 : null,
      foodDays: fd.length,
      onTarget: onT,
      kcal,
      workouts: train.logs.filter((l) => l.day >= from && l.day <= end).length,
      cardioMin: cd.reduce((s, r) => s + r.minutes, 0),
      cardioKcal: Math.round(cd.reduce((s, r) => s + r.kcal, 0)),
    };
  });
  // Pace: this week's average against 4 weeks ago, or your first week when you started weighing in less than 4 weeks ago (at least 2 weeks back).
  const first = ws[0]?.day;
  const baseEnd = first && addDays(first, 6) > addDays(today, -28) ? addDays(first, 6) : addDays(today, -28);
  const base = baseEnd <= addDays(today, -14) ? weekAvg(ws, baseEnd) : null;
  const pace = cur != null && base != null ? Math.round(((cur - base) / (daysAgo(baseEnd, today) / 7)) * 100) / 100 : null;
  const left = target != null && cur != null ? target - cur : null;
  const eta = left != null && pace && Math.sign(pace) === Math.sign(left) ? Math.ceil(left / pace) : null;
  const done = target != null && start != null && cur != null && start !== target ? Math.max(0, Math.min(1, (start - cur) / (start - target))) : null;
  const rightWay = (v: number) => (cut ? v < 0 : bulk ? v > 0 : Math.abs(v) < 0.25);

  // Food: what you ate against what you burn, as kilos a week.
  const burn = cur != null ? Math.round(maintenance({ ...food.plan, weight: cur }, food.person)) : null;
  const allDays = weeks.flatMap((w) => (w.kcal != null ? [{ k: w.kcal, n: w.foodDays }] : []));
  const nDays = allDays.reduce((s, v) => s + v.n, 0);
  const avgKcal = nDays ? Math.round(allDays.reduce((s, v) => s + v.k * v.n, 0) / nDays) : null;
  const onT = weeks.reduce((s, w) => s + w.onTarget, 0);
  const expected = avgKcal != null && burn != null ? Math.round((((avgKcal - burn) * 7) / 7700) * 100) / 100 : null;
  // Weeks you mostly hit your calories against weeks you didn't: how your weight moved in each.
  const avg = (v: number[]) => (v.length ? Math.round((v.reduce((s, y) => s + y, 0) / v.length) * 100) / 100 : null);
  const good = weeks.filter((w) => w.change != null && w.foodDays >= 3 && w.onTarget / w.foodDays >= 0.6).map((w) => w.change as number);
  const bad = weeks.filter((w) => w.change != null && w.foodDays >= 3 && w.onTarget / w.foodDays < 0.6).map((w) => w.change as number);

  // Training: weeks with your planned workouts against weeks with fewer.
  const planned = train.week.filter((d) => d?.w).length;
  const wFull = weeks.filter((w) => w.change != null && planned && w.workouts >= planned).map((w) => w.change as number);
  const wLess = weeks.filter((w) => w.change != null && planned && w.workouts < planned).map((w) => w.change as number);
  const workouts = weeks.reduce((s, w) => s + w.workouts, 0);

  const cMin = weeks.reduce((s, w) => s + w.cardioMin, 0);
  const cKcal = weeks.reduce((s, w) => s + w.cardioKcal, 0);

  const kg = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${W.show(Math.abs(v))} ${W.label}`;
  const goalWord = cut ? 'lose' : bulk ? 'gain' : 'keep';

  const foodText =
    nDays < 7
      ? t('Log your food on more days to see how it moves your weight.')
      : expected == null
        ? ''
        : cut
          ? expected < 0
            ? t('You eat about {n} kcal a day under what you burn. That’s about {k} a week, the way you want.', { n: fmt(Math.abs(avgKcal! - burn!)), k: kg(expected) })
            : t('You eat about {n} kcal a day over what you burn, so your weight can’t go down yet. Hit your calorie goal more days.', { n: fmt(Math.abs(avgKcal! - burn!)) })
          : bulk
            ? expected > 0
              ? t('You eat about {n} kcal a day over what you burn. That’s about {k} a week, the way you want.', { n: fmt(Math.abs(avgKcal! - burn!)), k: kg(expected) })
              : t('You eat about {n} kcal a day under what you burn, so you can’t gain yet. Eat up to your calorie goal more days.', { n: fmt(Math.abs(avgKcal! - burn!)) })
            : Math.abs(expected) < 0.25
              ? t('You eat about what you burn. Your weight should stay steady.')
              : t('You eat about {n} kcal a day {w} what you burn. That’s about {k} a week.', {
                  n: fmt(Math.abs(avgKcal! - burn!)),
                  w: t(expected > 0 ? 'more than' : 'less than'),
                  k: kg(expected),
                });
  const trainText = !workouts
    ? t('No workouts in the last 4 weeks. Training makes sure the weight you change is the right kind.')
    : cut
      ? t('Lifting while you cut keeps your muscle, so the weight you lose is mostly fat.')
      : bulk
        ? t('Training turns your extra calories into muscle instead of fat.')
        : t('Training keeps your muscle and shape while your weight stays the same.');
  const cardioText = !cMin
    ? t('No cardio logged in the last 4 weeks. It’s optional: food matters most for weight.')
    : t('{m} min of cardio burned about {k} kcal, like {w}. Adro adds cardio calories to your food goal, so it only moves your weight if you don’t eat them all back.', { m: fmt(cMin), k: fmt(cKcal), w: kg(-(cKcal / 7700)) });

  const factors: {
    icon: IconName;
    title: string;
    rows: [string, string][];
    text: string;
    compare?: [string, number | null, string, number | null];
  }[] = [
    {
      icon: 'food',
      title: 'Food',
      rows: [
        [t('Calories on target'), nDays ? t('{a} of {b} days', { a: onT, b: nDays }) : '–'],
        [t('Average calories'), avgKcal != null ? t('{n} kcal', { n: fmt(avgKcal) }) : '–'],
        [t('You burn about'), burn != null ? t('{n} kcal', { n: fmt(burn) }) : '–'],
        [t('Expected from food'), expected != null && nDays >= 7 ? `${kg(expected)} / ${t('week')}` : '–'],
      ],
      text: foodText,
      compare: good.length && bad.length ? ['Weeks on your calorie target', avg(good), 'Weeks off target', avg(bad)] : undefined,
    },
    {
      icon: 'train',
      title: 'Training',
      rows: [
        [t('Workouts'), planned ? t('{a} of {b}', { a: workouts, b: planned * 4 }) : String(workouts)],
        [t('Per week'), fmt(Math.round((workouts / 4) * 10) / 10)],
      ],
      text: trainText,
      compare: wFull.length && wLess.length ? ['Weeks with all your workouts', avg(wFull), 'Weeks with fewer', avg(wLess)] : undefined,
    },
    {
      icon: 'heart',
      title: 'Cardio',
      rows: [
        [t('Cardio'), `${fmt(cMin)} ${t('min')}`],
        [t('Burned'), t('{n} kcal', { n: fmt(cKcal) })],
      ],
      text: cardio ? cardioText : '',
    },
  ];

  const aiData = {
    name: 'Body weight',
    unit: 'kg',
    series: Array.from({ length: 30 }, (_, i) => ws.find((m) => m.day === addDays(today, i - 29))?.value ?? null),
    dir: cut ? -1 : bulk ? 1 : 0,
    goal: target ?? undefined,
    female: profile?.gender === 'female',
    sex: profile?.gender ?? null,
    other: Object.fromEntries(
      Object.entries({
        goal: ['fast bulk', 'moderate bulk', 'maintain', 'fast cut', 'moderate cut'][goal],
        targetKg: target,
        startKg: start,
        pacePerWeekKg: pace,
        weeksToTarget: eta,
        averageCaloriesLast4Weeks: avgKcal,
        estimatedBurnPerDay: burn,
        caloriesOnTargetDays: nDays ? [onT, nDays] : null,
        workoutsLast4Weeks: workouts,
        plannedPerWeek: planned || null,
        cardioMinutesLast4Weeks: cMin,
        cardioKcalLast4Weeks: cKcal,
        cardioCaloriesAddedToFoodGoal: true,
        weeks: weeks.map((w) => ({
          from: w.from,
          weightChangeKg: w.change,
          caloriesOnTarget: `${w.onTarget}/${w.foodDays}`,
          avgKcal: w.kcal,
          workouts: w.workouts,
          cardioMin: w.cardioMin,
        })),
      }).filter(([, v]) => v != null),
    ),
  };

  if (!ws.length)
    return (
      <Card>
        <Text color="sec">{t('Log your weight to see how food, training and cardio move it.')}</Text>
      </Card>
    );

  return (
    <View>
      <Card>
        <Text variant="xs" weight={700} color="sec">
          {t(goalWord === 'keep' ? 'Goal: keep your weight' : goalWord === 'lose' ? 'Goal: lose weight' : 'Goal: gain weight')}
        </Text>
        <Row
          style={{
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 6,
          }}
        >
          {(
            [
              ['Start', start],
              ['Now', cur],
              ['Target', target],
            ] as const
          ).map(([k, v]) => (
            <View
              key={k}
              style={{
                alignItems: k === 'Start' ? 'flex-start' : k === 'Now' ? 'center' : 'flex-end',
              }}
            >
              <Text variant="xs" weight={700} color="sec">
                {t(k)}
              </Text>
              <Text num size={k === 'Now' ? 28 : 18} color={k === 'Target' ? c.cobalt : undefined}>
                {v != null ? W.show(v) : '–'}
              </Text>
            </View>
          ))}
        </Row>
        {done != null ? (
          <View style={{ marginTop: 10 }}>
            <Bar value={done * 100} max={100} color={c.cobalt} />
            <Text variant="small" weight={700} style={{ marginTop: 8 }}>
              {left != null && Math.abs(left) >= 0.1
                ? t('{n} to go, {p}% of the way', {
                    n: kg(left).replace(/^[+−]/, ''),
                    p: Math.round(done * 100),
                  })
                : t('You reached your target!')}
            </Text>
          </View>
        ) : null}
        {pace != null ? (
          <Text variant="small" color={rightWay(pace) ? 'up' : 'sec'} style={{ marginTop: 6 }}>
            {`${t('Your pace')}: ${kg(pace)} / ${t('week')}`}
            {eta != null ? ` · ${t('about {n} weeks to your target', { n: eta })}` : ''}
          </Text>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t('Weigh in a few mornings a week to see your pace.')}
          </Text>
        )}
      </Card>

      <SecHead title={t('What moves your weight')} />
      {factors.map((f) => (
        <Card key={f.title}>
          <Row gap={8}>
            <Icon name={f.icon} size={18} color={c.cobalt} />
            <Text weight={700}>{t(f.title)}</Text>
          </Row>
          {f.rows.map(([k, v]) => (
            <Row key={k} style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Text variant="small" color="sec">
                {k}
              </Text>
              <Text variant="small" weight={700} num>
                {v}
              </Text>
            </Row>
          ))}
          {f.compare ? (
            <View
              style={{
                marginTop: 10,
                backgroundColor: c.inset,
                borderRadius: 12,
                padding: 10,
              }}
            >
              <Text variant="xs" weight={700} color="sec">
                {t('Your weight change a week')}
              </Text>
              {(
                [
                  [f.compare[0], f.compare[1]],
                  [f.compare[2], f.compare[3]],
                ] as const
              ).map(([k, v]) => (
                <Row key={k} style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <Text variant="small">{t(k)}</Text>
                  <Text variant="small" weight={700} num color={v != null && rightWay(v) ? 'up' : 'text'}>
                    {v != null ? kg(v) : '–'}
                  </Text>
                </Row>
              ))}
            </View>
          ) : null}
          {f.text ? (
            <Text variant="small" style={{ marginTop: 10 }}>
              {f.text}
            </Text>
          ) : null}
        </Card>
      ))}

      <SecHead title={t('Week by week')} />
      <Card>
        <Row style={{ paddingBottom: 6 }}>
          {['Week', 'Weight', 'On target', 'Workouts', 'Cardio'].map((h, i) => (
            <Text key={h} variant="xs" weight={700} color="sec" style={i ? { width: COLS[i - 1], textAlign: 'right' } : { flex: 1 }}>
              {t(h)}
            </Text>
          ))}
        </Row>
        {weeks.map((w) => (
          <Row
            key={w.from}
            style={{
              paddingVertical: 8,
              borderTopWidth: 1,
              borderTopColor: c.line,
            }}
          >
            <Text variant="small" weight={700} style={{ flex: 1 }}>
              {w.end === today ? t('This week') : shortDate(w.from, lang)}
            </Text>
            <Text variant="small" num style={{ width: COLS[0], textAlign: 'right' }} color={w.change != null && rightWay(w.change) ? 'up' : 'text'}>
              {w.change != null ? kg(w.change).replace(` ${W.label}`, '') : '–'}
            </Text>
            <Text variant="small" num style={{ width: COLS[1], textAlign: 'right' }}>
              {w.foodDays ? `${w.onTarget}/${w.foodDays}` : '–'}
            </Text>
            <Text variant="small" num style={{ width: COLS[2], textAlign: 'right' }}>
              {String(w.workouts)}
            </Text>
            <Text variant="small" num style={{ width: COLS[3], textAlign: 'right' }}>
              {w.cardioMin ? `${w.cardioMin}′` : '–'}
            </Text>
          </Row>
        ))}
        <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
          {t('Weight: the week’s average against the week before. Green: the way your goal wants it.')}
        </Text>
      </Card>
      <ReadingInsight id="weight-goal" day={today} data={aiData} ready={health.ready && cardio != null && !!x.goals} />
    </View>
  );
}

/** Week table column widths: weight, on target, workouts, cardio. */
const COLS = [50, 60, 68, 48];
const daysAgo = (d: string, today: string) => Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${d}T12:00:00`).getTime()) / 864e5);
