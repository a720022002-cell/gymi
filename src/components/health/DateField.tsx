import { View } from 'react-native';

import { useT } from '@/i18n';
import { addDays } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Springy } from '../ui';

/** Native fallback until the native date picker is added: one day at a time. */
export function DateField({ value, onChange, label, max }: { value: string; onChange: (v: string) => void; label: string; max?: string }) {
  const { colors: c } = useSettings();
  const { lang } = useT();
  const shown = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 6 }}>
      <Springy onPress={() => onChange(addDays(value, -1))} accessibilityLabel="Earlier"><Icon name="minus" size={16} /></Springy>
      <Text num size={15}>{shown}</Text>
      <Springy onPress={() => (!max || addDays(value, 1) <= max) && onChange(addDays(value, 1))} accessibilityLabel="Later"><Icon name="plus" size={16} /></Springy>
    </View>
  );
}
