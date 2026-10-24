import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { type SleepPart, sleepHours, useHealth } from '@/lib/health';
import { useSettings } from '@/theme/settings';

import { TimeField } from '../food/TimeField';
import { Choices, fmtDur } from '../health/bits';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Label, Row, Segmented, Springy } from '../ui';
import { Wheel } from '../Wheel';

export const QL = ['Poor', 'Okay', 'Great'];

/** Log every sleep of the day (night and naps), by times or just hours. */
export function SleepForm({ onDone }: { onDone: () => void }) {
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
