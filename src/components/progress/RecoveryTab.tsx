import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { sleepHours, useHealth } from '@/lib/health';
import { addDays, fmtTime } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { recLabel } from '@/lib/recovery';
import { useSettings } from '@/theme/settings';

import { BarChart, LineChart } from '../Charts';
import { TimeField } from '../food/TimeField';
import { Choices, fmtDur } from '../health/bits';
import { Icon } from '../Icon';
import { Ring } from '../Ring';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { useRecovery } from '../train/RecoveryCard';
import { Button, Card, Label, Row } from '../ui';
import { SecHead } from './bits';

const QL = ['Poor', 'Okay', 'Great'];

/** Recovery score now and over time, then sleep (design: progRecovery). */
export function RecoveryTab() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const { r } = useRecovery();
  const [label, tone] = recLabel(r.score);
  const [open, setOpen] = useState(false);
  const hist = health.checkins.filter((x) => x.score != null).slice(-30);
  const { today } = useFood();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const sleepBy = new Map(health.checkins.map((x) => [x.day, x]));
  const nights = week.map((d) => sleepBy.get(d)?.sleep_h ?? null);
  const logged = nights.filter((x): x is number => x != null);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : null;
  const last = [...health.checkins].reverse().find((x) => x.sleep_h != null);

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
            {t('Do your morning check-in each day to see your recovery over time.')}
          </Text>
        )}
      </Card>

      <SecHead title={t('Sleep')} />
      {last ? (
        <Card>
          <Text variant="small" weight={700} color="sec">
            {t(last.day === today ? 'Last night' : 'Last logged')}
          </Text>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text num size={34}>
              {fx(last.sleep_h as number)}
              <Text num size={18} weight={500} color="sec">{` ${t('h')}`}</Text>
            </Text>
            {last.sleep_q != null ? (
              <View style={{ backgroundColor: c.inset, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text variant="small" weight={700}>
                  {t(QL[last.sleep_q])}
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
      ) : null}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t('This week')}</Text>
          {avg != null ? (
            <Text variant="small" weight={700} color="sec">
              {t('Average {n} h', { n: fx(avg) })}
            </Text>
          ) : null}
        </Row>
        <View style={{ marginTop: 12 }}>
          <BarChart values={nights} labels={week.map((d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`)))} highlight={6} max={10} goal={7.5} />
        </View>
        <Text variant="xs" color="sec">
          {t('Dashed line: 7.5 h goal')}
        </Text>
      </Card>
      <Button icon="moon" title={t('Log sleep')} onPress={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)}>
        {open ? <SleepForm onDone={() => setOpen(false)} /> : null}
      </Sheet>
    </View>
  );
}

function SleepForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const health = useHealth();
  const ci = health.todayCheckin;
  const [bed, setBed] = useState(ci?.bed ?? '23:00');
  const [wake, setWake] = useState(ci?.wake ?? '07:00');
  const [q, setQ] = useState<number | null>(ci?.sleep_q ?? 1);
  const h = sleepHours(bed, wake);
  return (
    <View>
      <Text variant="h2">{t('Log sleep')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Last night’s sleep. It updates today’s recovery score.')}
      </Text>
      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t('Went to sleep')}</Text>
          <TimeField value={bed} onChange={setBed} label={t('Went to sleep')} />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <Text weight={700}>{t('Woke up')}</Text>
          <TimeField value={wake} onChange={setWake} label={t('Woke up')} />
        </Row>
      </Card>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 6 }}>
        <Text weight={700}>{t('Total sleep')}</Text>
        <Text num size={18}>
          {fmtDur(h, t)}
        </Text>
      </Row>
      <Label>{t('Quality')}</Label>
      <Choices options={QL} value={q} onChange={setQ} />
      <Button
        title={t('Save')}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const ok = await health.saveCheckin({ sleep_h: h, sleep_q: q, bed, wake });
          onDone();
          toast(ok ? t('Sleep saved: {n}', { n: fmtDur(h, t) }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'moon' : 'warn' });
        }}
      />
    </View>
  );
}
