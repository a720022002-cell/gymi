import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useWatchSleep } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { type SleepPart, sleepHours, useHealth } from '@/lib/health';
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
import { Button, Card, Label, Row, Segmented, Springy } from '../ui';
import { Wheel } from '../Wheel';
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
  // Nights you didn't log come from your watch.
  const { session } = useAuth();
  const watch = useWatchSleep(session?.user.id);
  const sleepBy = new Map(health.checkins.map((x) => [x.day, x]));
  const nights = week.map((d) => sleepBy.get(d)?.sleep_h ?? watch[d] ?? null);
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
            {t('Do your daily check-in to see your recovery over time.')}
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
          <BarChart values={nights} labels={week.map((d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`)))} highlight={6} max={10} goal={7.5} />
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
  const { colors: c } = useSettings();
  const toast = useToast();
  const health = useHealth();
  const ci = health.todayCheckin;
  const [mode, setMode] = useState<'times' | 'hours'>('times');
  const [parts, setParts] = useState<SleepPart[]>(() => (ci?.sleep_parts?.length ? ci.sleep_parts : [{ bed: ci?.bed ?? '23:00', wake: ci?.wake ?? '07:00' }]));
  const [hm, setHm] = useState<[number, number]>(() => {
    const m = Math.round((ci?.sleep_h ?? 7) * 60);
    return [Math.min(16, Math.floor(m / 60)), Math.round((m % 60) / 5) * 5 % 60];
  });
  const [q, setQ] = useState<number | null>(ci?.sleep_q ?? 1);
  const h = mode === 'hours' ? hm[0] + hm[1] / 60 : parts.reduce((a, p) => a + sleepHours(p.bed, p.wake), 0);
  const setPart = (i: number, patch: Partial<SleepPart>) => setParts((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <View>
      <Text variant="h2">{t('Log sleep')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
        {t('Add every sleep in the day, like your night and a nap.')}
      </Text>
      <Segmented<'times' | 'hours'>
        value={mode}
        options={[
          { value: 'times', label: t('Bed and wake time') },
          { value: 'hours', label: t('Just hours') },
        ]}
        onChange={setMode}
      />
      {mode === 'hours' ? (
        <Card style={{ marginTop: 12, paddingVertical: 4 }}>
          <Row gap={0} style={{ justifyContent: 'center' }}>
            <Wheel
              columns={[
                { items: Array.from({ length: 17 }, (_, i) => ({ value: i, label: `${i} ${t('h')}` })), selected: hm[0], width: 96 },
                { items: Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: `${String(i * 5).padStart(2, '0')} ${t('min')}` })), selected: hm[1], width: 110 },
              ]}
              onChange={([hh, mm]) => setHm([hh, mm])}
            />
          </Row>
        </Card>
      ) : (
        <>
          {parts.map((p, i) => (
            <Card key={i} style={{ marginTop: 12 }}>
              <Row gap={8}>
                <Text weight={700} style={{ flex: 1 }}>
                  {t(i ? 'Nap or other sleep' : 'Night sleep')}
                </Text>
                <Text variant="small" weight={700} color="sec">
                  {fmtDur(sleepHours(p.bed, p.wake), t)}
                </Text>
                {parts.length > 1 ? (
                  <Springy onPress={() => setParts((xs) => xs.filter((_, j) => j !== i))} accessibilityLabel={t('Remove this sleep')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={16} color={c.sec} />
                  </Springy>
                ) : null}
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <Text weight={600}>{t('Went to sleep')}</Text>
                <TimeField value={p.bed} onChange={(v) => setPart(i, { bed: v })} label={t('Went to sleep')} />
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <Text weight={600}>{t('Woke up')}</Text>
                <TimeField value={p.wake} onChange={(v) => setPart(i, { wake: v })} label={t('Woke up')} />
              </Row>
            </Card>
          ))}
          {parts.length < 4 ? <Button small kind="soft" icon="plus" title={t('Add another sleep')} style={{ marginTop: 4, alignSelf: 'stretch' }} onPress={() => setParts((xs) => [...xs, { bed: '14:00', wake: '15:00' }])} /> : null}
        </>
      )}
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 12 }}>
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
          const total = Math.min(24, Math.round(h * 10) / 10);
          const patch =
            mode === 'hours'
              ? { sleep_h: total, sleep_q: q, bed: null, wake: null, sleep_parts: null }
              : { sleep_h: total, sleep_q: q, bed: parts[0].bed, wake: parts[0].wake, sleep_parts: parts.length > 1 ? parts : null };
          const ok = await health.saveCheckin(patch);
          onDone();
          toast(ok ? t('Sleep saved: {n}', { n: fmtDur(total, t) }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'moon' : 'warn' });
        }}
      />
    </View>
  );
}
