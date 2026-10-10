import { View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { Button, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import type { GymHours } from '@/lib/coaching';
import { fmtTime } from '@/lib/nutrition';
import { DAYS } from '@/lib/training';
import { useSettings } from '@/theme/settings';

type T = ReturnType<typeof useT>['t'];

/** "Sun to Thu, 5:00 PM to 10:00 PM · Sat, 9:00 AM to 12:00 PM" */
export function hoursText(list: GymHours[] | null | undefined, t: T, lang: 'en' | 'ar') {
  const days = (a: number[]) => {
    const x = [...a].sort((p, q) => p - q);
    if (x.length === 7) return t('Every day');
    if (x.length > 2 && x.every((v, i) => !i || v === x[i - 1] + 1)) return t('{a} to {b}', { a: t(DAYS[x[0]]), b: t(DAYS[x[x.length - 1]]) });
    return x.map((i) => t(DAYS[i])).join(t(', '));
  };
  return (list ?? [])
    .filter((h) => h.days.length)
    .map((h) => `${days(h.days)}${t(', ')}${t('{a} to {b}', { a: fmtTime(h.from, lang), b: fmtTime(h.to, lang) })}`)
    .join(' · ');
}

/** Coach: pick the days and times you're at the gym (design: hoursEditor). */
export function GymHoursEditor({ value, onChange }: { value: GymHours[]; onChange: (v: GymHours[]) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const set = (i: number, patch: Partial<GymHours>) => onChange(value.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  return (
    <View>
      {value.map((h, i) => (
        <View key={i} style={{ backgroundColor: c.card, borderRadius: 18, padding: 12, marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            {DAYS.map((d, di) => {
              const on = h.days.includes(di);
              return (
                <Springy
                  key={d}
                  accessibilityLabel={t(d)}
                  accessibilityState={{ selected: on }}
                  onPress={() => set(i, { days: on ? h.days.filter((x) => x !== di) : [...h.days, di].sort((a, b) => a - b) })}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : c.inset }}>
                  <Text size={12} weight={700} style={{ color: on ? '#FFFFFF' : c.sec }}>
                    {t(d).slice(0, 1)}
                  </Text>
                </Springy>
              );
            })}
          </Row>
          <Row gap={8} style={{ marginTop: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('From')}
              </Text>
              <TimeField value={h.from} onChange={(v) => set(i, { from: v })} label={t('From')} height={40} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('To')}
              </Text>
              <TimeField value={h.to} onChange={(v) => set(i, { to: v })} label={t('To')} height={40} />
            </View>
            <Springy accessibilityLabel={t('Remove')} onPress={() => onChange(value.filter((_, j) => j !== i))} style={{ width: 36, height: 36, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={14} color={c.sec} strokeWidth={2.2} />
            </Springy>
          </Row>
        </View>
      ))}
      {value.length < 7 ? (
        <Button small kind="soft" icon="plus" title={t(value.length ? 'Add another time' : 'Add gym hours')} style={{ alignSelf: 'stretch' }} onPress={() => onChange([...value, { days: [0, 1, 2, 3, 4], from: '17:00', to: '21:00' }])} />
      ) : null}
    </View>
  );
}
