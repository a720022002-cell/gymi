import { View } from 'react-native';

import { useT } from '@/i18n';
import { type DeviceDay, sleepDetail } from '@/lib/devices';

import { Text } from '../Text';
import { Card, Row } from '../ui';

/** Minutes from midnight (negative = before it) as a clock time, like 23:15. */
const clock = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** Sleep stages from the watch, and how steady your bedtime is. */
export function SleepStages({ days, today }: { days: DeviceDay[]; today: string }) {
  const { t } = useT();
  const sd = sleepDetail(days, today);
  if (!sd || (sd.deep == null && sd.rem == null && sd.bedUsual == null)) return null;
  const h = (v: number | null) => {
    if (v == null) return '–';
    // Whole minutes first, so 1.999 h is 2 h 0 min, not 1 h 60 min.
    const m = Math.round(v * 60);
    return t('{h} h {m} min', { h: Math.floor(m / 60), m: m % 60 });
  };
  const steady = sd.bedSpread == null ? null : sd.bedSpread < 30 ? 'Very steady' : sd.bedSpread < 60 ? 'Fairly steady' : 'Changes a lot';
  return (
    <Card>
      <Text weight={700}>{t('Last night')}</Text>
      <Row gap={8} style={{ marginTop: 10 }}>
        {(
          [
            ['Deep sleep', sd.deep, sd.deepWeek],
            ['REM sleep', sd.rem, sd.remWeek],
          ] as const
        ).map(([a, v, wk]) => (
          <View key={a} style={{ flex: 1 }}>
            <Text num size={18}>
              {h(v)}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(a)}
            </Text>
            {wk != null ? (
              <Text variant="xs" color="sec">
                {t('This week {v}', { v: h(wk) })}
              </Text>
            ) : null}
          </View>
        ))}
      </Row>
      {sd.bedUsual != null ? (
        <Text variant="small" style={{ marginTop: 12 }}>
          {t('You usually fall asleep around {c}.', { c: clock(sd.bedUsual) })} {steady ? t(steady === 'Very steady' ? 'Your bedtime is very steady.' : steady === 'Fairly steady' ? 'Your bedtime is fairly steady.' : 'Your bedtime moves about {n} min from night to night. A steadier bedtime sleeps better.', { n: sd.bedSpread ?? 0 }) : null}
        </Text>
      ) : null}
      <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
        {t('Most adults get 1 to 2 h of deep sleep and 1.5 to 2 h of REM.')}
      </Text>
    </Card>
  );
}

