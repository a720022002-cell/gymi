import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { fmtTime } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';

const toDate = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const toClock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * A time: tap it for Apple's own time picker (iPhone), or use − and + for 15 minutes; hold them to keep going
 * (faster the longer you hold). Other phones: − and + only.
 */
export function TimeField({ value, onChange, label, height = 46, bg }: { value: string; onChange: (v: string) => void; label: string; height?: number; bg?: string }) {
  const { colors: c, isDark } = useSettings();
  const { t, lang } = useT();
  // The latest time, so holding a button keeps counting from it.
  const cur = useRef(value);
  useEffect(() => {
    cur.current = value;
  }, [value]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const step = (d: number) => {
    const [h, m] = cur.current.split(':').map(Number);
    const n = (h * 60 + m + d + 1440) % 1440;
    cur.current = `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    onChange(cur.current);
  };
  const stop = () => clearTimeout(timer.current);
  useEffect(() => stop, []);
  // Tap: one step. Hold: after a moment it repeats, quicker the longer you hold.
  const hold = (dir: 1 | -1) => {
    stop();
    step(dir * 15);
    let n = 0;
    const tick = () => {
      n++;
      step(dir * 15);
      timer.current = setTimeout(tick, n > 6 ? 70 : 140);
    };
    timer.current = setTimeout(tick, 400);
  };
  const btn = (dir: 1 | -1) => (
    <Pressable
      onPressIn={() => hold(dir)}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={t(dir < 0 ? 'Earlier' : 'Later')}
      hitSlop={6}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      <Icon name={dir < 0 ? 'minus' : 'plus'} size={16} />
    </Pressable>
  );
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height, borderRadius: 12, backgroundColor: bg ?? c.inset, paddingHorizontal: 6 }}>
      {btn(-1)}
      {Platform.OS === 'ios' ? (
        <Host matchContents colorScheme={isDark ? 'dark' : 'light'}>
          <DatePicker selection={toDate(value)} displayedComponents={['hourAndMinute']} onDateChange={(d) => onChange(toClock(d))} modifiers={[datePickerStyle('compact'), labelsHidden(), tint(c.cobalt)]} />
        </Host>
      ) : (
        <Text num size={16}>
          {fmtTime(value, lang)}
        </Text>
      )}
      {btn(1)}
    </View>
  );
}
