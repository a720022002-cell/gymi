import { useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/Charts';
import { ReadingInsight } from '@/components/health/ReadingInsight';
import { Sheet } from '@/components/Sheet';
import { QL, SleepForm } from './SleepForm';
import { SleepStages } from './SleepStages';
import { Text } from '@/components/Text';
import { Button, Card, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useDevices } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmtTime } from '@/lib/nutrition';
import { fx, sleepOn } from '@/lib/progress';
import { wearableName } from '@/lib/wearables';
import { useSettings } from '@/theme/settings';

/** Everything about your sleep: last night, stages from the watch, the week or month, the coach's analysis and logging. */
export function SleepView() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const { today } = useFood();
  const { session, profile } = useAuth();
  const dev = useDevices(session?.user.id);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<'week' | 'month'>('week');
  // Nights you didn't log come from your watch.
  const watchSleep = Object.fromEntries(dev.days.filter((d) => d.sleep_h != null && d.sleep_h > 0).map((d) => [d.day, d.sleep_h as number]));
  const night = (d: string) => sleepOn({ checkins: health.checkins, watchSleep }, d);
  const span = range === 'week' ? 7 : 30;
  const days = Array.from({ length: span }, (_, i) => addDays(today, i - span + 1));
  const nights = days.map(night);
  const logged = nights.filter((x): x is number => x != null);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : null;
  // Last night: your own log first, else the watch.
  const lastLog = [...health.checkins].reverse().find((x) => x.sleep_h != null);
  const lastWatch = [...dev.days].reverse().find((d) => d.sleep_h != null && d.sleep_h > 0);
  const useWatch = !!lastWatch && (!lastLog || lastWatch.day > lastLog.day);
  const last = useWatch ? { day: lastWatch.day, h: lastWatch.sleep_h as number, q: null, bed: null, wake: null } : lastLog ? { day: lastLog.day, h: lastLog.sleep_h as number, q: lastLog.sleep_q, bed: lastLog.bed, wake: lastLog.wake } : null;
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const labels = range === 'week' ? days.map((d) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`))) : days.map((d, i) => (i % 5 === 0 ? String(Number(d.slice(8))) : ''));

  const last30 = Array.from({ length: 30 }, (_, i) => {
    const v = night(addDays(today, i - 29));
    return v == null ? null : Math.round(v * 10) / 10;
  });
  const wk = Array.from({ length: 7 }, (_, i) => addDays(today, i - 7));
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => x != null && x > 0);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const byDay = new Map(dev.days.map((d) => [d.day, d]));
  const aiData = {
    name: 'Sleep',
    unit: 'h',
    series: last30,
    dir: 1,
    goal: 7.5,
    female: profile?.gender === 'female',
    sex: profile?.gender ?? null,
    device: lastWatch?.wearable ? wearableName(lastWatch.wearable) : lastWatch ? 'phone health app' : null,
    other: Object.fromEntries(
      Object.entries({
        deepSleepHours7Days: mean(wk.map((d) => byDay.get(d)?.deep_h)),
        remSleepHours7Days: mean(wk.map((d) => byDay.get(d)?.rem_h)),
        sleepEfficiency7Days: mean(wk.map((d) => byDay.get(d)?.sleep_eff)),
        bedtimeMinutesFromMidnight: wk.map((d) => byDay.get(d)?.bed_min ?? null),
        sleepQualityLogged: wk.map((d) => health.checkins.find((x) => x.day === d)?.sleep_q ?? null).map((q) => (q == null ? null : QL[q])),
        recoveryToday: health.checkins.find((x) => x.day === today)?.score ?? null,
        restingHr7Days: mean(wk.map((d) => byDay.get(d)?.hr_rest)),
      }).filter(([, v]) => v != null && !(Array.isArray(v) && v.every((x) => x == null))),
    ),
  };

  return (
    <View>
      {last ? (
        <Card>
          <Text variant="small" weight={700} color="sec">
            {last.day === today ? t('Last night') : t('Last logged')}
            {useWatch && lastWatch?.wearable ? ` · ${wearableName(lastWatch.wearable)}` : ''}
          </Text>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text num size={34}>
              {fx(last.h)}
              <Text num size={18} weight={500} color="sec">{` ${t('h')}`}</Text>
            </Text>
            {last.q != null ? (
              <View style={{ backgroundColor: c.inset, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text variant="small" weight={700}>
                  {t(QL[last.q])}
                </Text>
              </View>
            ) : null}
          </Row>
          {last.bed && last.wake ? (
            <Row gap={10} style={{ marginTop: 12 }}>
              {(
                [
                  ['Bedtime', last.bed],
                  ['Woke up', last.wake],
                ] as const
              ).map(([k, v]) => (
                <View key={k} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                  <Text variant="xs" weight={700} color="sec">
                    {t(k)}
                  </Text>
                  <Text num>{fmtTime(v, lang)}</Text>
                </View>
              ))}
            </Row>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text color="sec">{t('Log your sleep or connect a watch to see it here.')}</Text>
        </Card>
      )}
      <SleepStages days={dev.days} today={today} />
      <Segmented<'week' | 'month'>
        value={range}
        options={[
          { value: 'week', label: t('Week') },
          { value: 'month', label: t('Month') },
        ]}
        onChange={setRange}
      />
      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t(range === 'week' ? 'This week' : 'Last 30 days')}</Text>
          {avg != null ? (
            <Text variant="small" weight={700} color="sec">
              {t('Average {n} h', { n: fx(avg) })}
            </Text>
          ) : null}
        </Row>
        <View style={{ marginTop: 12 }}>
          <BarChart values={nights} labels={labels} highlight={span - 1} max={10} goal={7.5} />
        </View>
        <Text variant="xs" color="sec">
          {t('Dashed line: 7.5 h goal')}
        </Text>
      </Card>
      <ReadingInsight id="sleep-page" day={today} data={aiData} ready={health.ready} />
      <Button icon="moon" title={t('Log sleep')} style={{ marginTop: 4 }} onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)}>
        {open ? <SleepForm onDone={() => setOpen(false)} /> : null}
      </Sheet>
    </View>
  );
}
