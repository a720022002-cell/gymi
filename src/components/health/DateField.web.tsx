import { createElement } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Text } from '../Text';

/** Shows a date; tapping opens the phone's own date picker. */
export function DateField({ value, onChange, label, max }: { value: string; onChange: (v: string) => void; label: string; max?: string }) {
  const { colors: c } = useSettings();
  const { lang } = useT();
  const shown = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  return (
    <View style={{ position: 'relative', height: 44, minWidth: 130, borderRadius: 12, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
      <Text num size={15}>
        {shown}
      </Text>
      {createElement('input', {
        type: 'date',
        value,
        max,
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0 },
      })}
    </View>
  );
}
