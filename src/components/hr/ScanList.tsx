import { useEffect, useState } from 'react';

import { useT } from '@/i18n';
import { ZONE_COLORS } from '@/lib/cardioCoach';
import { type SavedSensor, scanSensors } from '@/lib/liveHr';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Springy } from '../ui';

/** Find a Bluetooth heart rate sensor nearby; the one you pick is remembered and reconnects by itself next time. Scans
 * afresh each time it's shown. */
export function ScanList({ onPick }: { onPick: (s: SavedSensor) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [found, setFound] = useState<(SavedSensor & { rssi: number | null })[]>([]);
  const [st, setSt] = useState<'scanning' | 'off' | 'denied' | 'unavailable' | null>(null);
  useEffect(() => {
    const stop = scanSensors(
      (d) => setFound((xs) => [...xs.filter((x) => x.id !== d.id), d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))),
      setSt,
    );
    const end = setTimeout(stop, 20_000);
    return () => {
      clearTimeout(end);
      stop();
    };
  }, []);
  return (
    <>
      <Text variant="small" color="sec" style={{ marginTop: 6, marginBottom: 12 }}>
        {st === 'off'
          ? t('Turn on Bluetooth, then try again.')
          : st === 'denied'
            ? t('Allow Bluetooth for Adro in Settings, then try again.')
            : st === 'unavailable'
              ? t('Bluetooth isn’t available on this device.')
              : t('Wear your strap (wet the pads) or turn on heart rate broadcast on your watch.')}
      </Text>
      {found.map((d) => (
        <Springy key={d.id} onPress={() => onPick({ id: d.id, name: d.name })} style={{ minHeight: 56, borderRadius: 16, paddingHorizontal: 14, backgroundColor: c.card, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="heart" size={18} color={ZONE_COLORS[4]} />
          <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
            {d.name}
          </Text>
          <Icon name="chev" size={16} color={c.sec} />
        </Springy>
      ))}
      {st === 'scanning' && !found.length ? (
        <Text variant="small" color="sec" center style={{ marginVertical: 16 }}>
          {t('Looking for sensors…')}
        </Text>
      ) : null}
    </>
  );
}
