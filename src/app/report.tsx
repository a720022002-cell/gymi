import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Thinking } from '@/components/food/Thinking';
import { DateField } from '@/components/health/DateField';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Chip, ErrorText, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { addDays, fmt } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { daysBetween, reportRange, type ReportStats, useReportData, useReportStats } from '@/lib/report';
import { useSettings } from '@/theme/settings';

type Mode = 'week' | 'month' | 'custom';
type Coach = { well: string[]; improve: string[]; focus: string };

/** Reports for a week, a month or any dates, with a coach summary (design: report). */
export default function ReportScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const [mode, setMode] = useState<Mode>('week');
  const [from, setFrom] = useState(addDays(food.today, -29));
  const [to, setTo] = useState(food.today);
  const { a, b } = reportRange(mode, food.today, from, to);
  const err = a > b ? t('The start date is after the end date.') : b > food.today ? t('The end date can’t be in the future.') : daysBetween(a, b) > 366 ? t('Pick a range of one year or less.') : '';
  const data = useReportData(err ? b : a, b);
  const stats = useReportStats(a, b, err ? null : data);
  const quick = (n: number) => {
    setTo(food.today);
    setFrom(n ? addDays(food.today, -(n - 1)) : `${food.today.slice(0, 4)}-01-01`);
  };
  const label = `${shortDate(a, lang)} – ${shortDate(b, lang)}, ${b.slice(0, 4)}`;

  return (
    <Screen title={t('Reports')} back>
      <Segmented<Mode>
        value={mode}
        options={[
          { value: 'week', label: t('Week') },
          { value: 'month', label: t('Month') },
          { value: 'custom', label: t('Custom') },
        ]}
        onChange={setMode}
      />
      {mode === 'custom' ? (
        <View style={{ marginTop: 12 }}>
          <Card style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{t('From')}</Text>
              <DateField value={from} onChange={setFrom} label={t('From')} max={food.today} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{t('To')}</Text>
              <DateField value={to} onChange={setTo} label={t('To')} max={food.today} />
            </Row>
          </Card>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Chip title={t('Last 3 months')} onPress={() => quick(90)} />
            <Chip title={t('Last 6 months')} onPress={() => quick(182)} />
            <Chip title={t('This year')} onPress={() => quick(0)} />
          </Row>
          <ErrorText>{err}</ErrorText>
        </View>
      ) : null}
      {err ? (
        <Card style={{ marginTop: 12, alignItems: 'center' }}>
          <Text variant="h3">{t('Fix the dates to see your report')}</Text>
        </Card>
      ) : !stats ? (
        <View style={{ paddingTop: 30 }}>
          <Thinking message={t('Loading your report')} />
        </View>
      ) : (
        <ReportBody stats={stats} label={label} a={a} b={b} c={c} />
      )}
    </Screen>
  );
}

function ReportBody({ stats: s, label, a, b, c }: { stats: ReportStats; label: string; a: string; b: string; c: ReturnType<typeof useSettings>['colors'] }) {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const key = `gymi.report.${profile?.id ?? ''}.${a}.${b}.${lang}`;
  const [coach, setCoach] = useState<{ key: string; v: Coach } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<AiError | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((v) => alive && v && setCoach({ key, v: JSON.parse(v) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const write = async () => {
    setBusy(true);
    setErr(null);
    const pair = ([hit, of]: [number, number]) => (of ? { daysHit: hit, outOf: of } : null);
    const stats = {
      period: `${a} to ${b} (${s.days} days)`,
      goal: s.goal,
      workouts: s.workouts.planned ? { doneAsPlanned: s.workouts.asPlanned, planned: s.workouts.planned } : { done: s.workouts.done },
      weightKg: s.weight ? { start: s.weight.first, end: s.weight.last, change: s.weight.change } : null,
      waistChangeCm: s.waistChange,
      averageCalories: s.caloriesAvg,
      calorieGoal: s.calorieGoal,
      caloriesWithin10Percent: pair(s.calDays),
      proteinGoalGrams: s.proteinGoal,
      proteinGoalHit: pair(s.proteinDays),
      waterGoalHit: pair(s.waterDays),
      averageSleepHours: s.sleepAvg,
      nightsUnder6_5h: s.shortNights,
      newPersonalRecords: s.prs,
      liftsThatWentUp: s.liftUps,
      commitmentPercent: s.commitment,
    };
    const { result, error } = await askAI<Coach>('report', { lang, stats });
    setBusy(false);
    if (error || !result) return setErr(error ?? 'failed');
    const v = { well: (result.well ?? []).slice(0, 3), improve: (result.improve ?? []).slice(0, 3), focus: result.focus ?? '' };
    setCoach({ key, v });
    AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});
  };

  const tiles: [string, string][] = [
    [t('Workouts'), s.workouts.planned ? t('{a} of {b}', { a: s.workouts.asPlanned, b: s.workouts.planned }) : String(s.workouts.done)],
    [t('Weight'), s.weight && s.weight.change !== 0 ? `${s.weight.change > 0 ? '+' : ''}${fx(s.weight.change)} ${t('kg')}` : s.weight ? `${fx(s.weight.last)} ${t('kg')}` : '–'],
    [t('Protein goal'), s.proteinGoal ? t('{a} of {b} days', { a: s.proteinDays[0], b: s.proteinDays[1] }) : '–'],
    [t('Sleep'), s.sleepAvg != null ? t('{n} h avg', { n: fx(s.sleepAvg) }) : '–'],
  ];
  const v = coach?.key === key ? coach.v : null;

  return (
    <View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginHorizontal: 4 }}>
        {t('{r}, {n} days', { r: label, n: s.days })}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }}>
        {tiles.map(([k, val]) => (
          <View key={k} style={{ width: '48.5%', backgroundColor: c.card, borderRadius: 22, padding: 14, marginBottom: 10 }}>
            <Text variant="xs" weight={700} color="sec">
              {k}
            </Text>
            <Text num size={20} style={{ marginTop: 4 }} numberOfLines={1}>
              {val}
            </Text>
          </View>
        ))}
      </View>
      {s.weight && s.weight.series.length > 1 ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" weight={700}>
              {t('Weight')}
            </Text>
            <Text variant="small" weight={700} color="sec">{`${s.weight.change < 0 ? '↓' : '↑'} ${fx(Math.abs(s.weight.change))} ${t('kg')}`}</Text>
          </Row>
          <View style={{ marginTop: 8 }}>
            <LineChart values={s.weight.series} height={110} />
          </View>
        </Card>
      ) : null}
      <Card>
        {[
          [t('Average calories'), s.caloriesAvg != null ? `${fmt(s.caloriesAvg)}${s.calorieGoal ? ` / ${fmt(s.calorieGoal)}` : ''} kcal` : '–'],
          [t('Calories on target'), s.calDays[1] ? t('{a} of {b} days', { a: s.calDays[0], b: s.calDays[1] }) : '–'],
          [t('Water goal'), s.waterDays[1] ? t('{a} of {b} days', { a: s.waterDays[0], b: s.waterDays[1] }) : '–'],
          [t('Training volume'), s.volume ? `${fmt(s.volume)} ${t('kg')}` : '–'],
          [t('New records'), String(s.prs)],
          [t('Commitment'), s.commitment != null ? `${s.commitment}%` : '–'],
        ].map(([k, val], i) => (
          <Row key={k} style={{ justifyContent: 'space-between', marginTop: i ? 10 : 0 }}>
            <Text variant="small" color="sec">
              {k}
            </Text>
            <Text variant="small" weight={700} num>
              {val}
            </Text>
          </Row>
        ))}
      </Card>

      {busy ? (
        <Card>
          <Thinking message={t('Writing your report')} />
        </Card>
      ) : v ? (
        <>
          <Card>
            <Row gap={8}>
              <Mark size={24} color={c.cobalt} stroke={5} />
              <Text weight={700}>{t('What went well')}</Text>
            </Row>
            {v.well.map((x) => (
              <Row key={x} gap={8} style={{ alignItems: 'flex-start', marginTop: 12 }}>
                <Icon name="check" size={18} color={c.up} strokeWidth={2.6} />
                <Text variant="small" style={{ flex: 1 }}>
                  {x}
                </Text>
              </Row>
            ))}
          </Card>
          <Card>
            <Row gap={8}>
              <Icon name="up" size={22} color={c.cobalt} strokeWidth={2.2} />
              <Text weight={700}>{t('What to improve')}</Text>
            </Row>
            {v.improve.map((x) => (
              <Row key={x} gap={8} style={{ alignItems: 'flex-start', marginTop: 12 }}>
                <Icon name="chev" size={18} color={c.sec} strokeWidth={2.2} />
                <Text variant="small" style={{ flex: 1 }}>
                  {x}
                </Text>
              </Row>
            ))}
          </Card>
          {v.focus ? (
            <Card>
              <Text weight={700}>{t('Focus next')}</Text>
              <Text variant="small" style={{ marginTop: 4 }}>
                {v.focus}
              </Text>
            </Card>
          ) : null}
          <Button small kind="ghost" icon="sparkle" title={t('Write it again')} style={{ alignSelf: 'center' }} onPress={write} />
        </>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Mark size={30} color={c.cobalt} stroke={6} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t('Coach summary')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('What went well, what to improve, and one thing to focus on next.')}
          </Text>
          {err ? <ErrorText>{t(aiErrorText(err))}</ErrorText> : null}
          <Button small icon="sparkle" title={t('Write my report')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={write} />
        </Card>
      )}
      <Button kind="glass" icon="share" title={t('Export this report as PDF')} style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/export', params: { from: a, to: b } })} />
    </View>
  );
}
