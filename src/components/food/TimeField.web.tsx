import { createElement } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { fmtTime } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Text } from '../Text';

/** Shows a time like "7:15 AM"; tapping opens the phone's own time picker. */
export function TimeField({ value, onChange, label, height = 46, bg }: { value: string; onChange: (v: string) => void; label: string; height?: number; bg?: string }) {
  const { colors: c } = useSettings();
  const { lang } = useT();
  return (
    <View style={{ position: 'relative', height, minWidth: 96, borderRadius: 12, backgroundColor: bg ?? c.inset, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
      <Text num size={16}>
        {fmtTime(value, lang)}
      </Text>
      {createElement('input', {
        type: 'time',
        value,
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0 },
      })}
    </View>
  );
}
