import { View } from 'react-native';

import { useT } from '@/i18n';
import { fmtTime } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Springy } from '../ui';

/** Native fallback until the native time picker is added: 15-minute steps. */
export function TimeField({ value, onChange, label, height = 46, bg }: { value: string; onChange: (v: string) => void; label: string; height?: number; bg?: string }) {
  const { colors: c } = useSettings();
  const { lang } = useT();
  const step = (d: number) => {
    const [h, m] = value.split(':').map(Number);
    const t = (h * 60 + m + d + 1440) % 1440;
    onChange(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  };
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height, borderRadius: 12, backgroundColor: bg ?? c.inset, paddingHorizontal: 6 }}>
      <Springy onPress={() => step(-15)} accessibilityLabel="Earlier"><Icon name="minus" size={16} /></Springy>
      <Text num size={16}>{fmtTime(value, lang)}</Text>
      <Springy onPress={() => step(15)} accessibilityLabel="Later"><Icon name="plus" size={16} /></Springy>
    </View>
  );
}
