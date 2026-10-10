import { View } from 'react-native';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { Springy } from '../ui';
import { Wheel } from '../Wheel';

/** Equal-width choices in one row (design: .grid3 of chips). */
export function Choices({ options, value, onChange, icons }: { options: string[]; value: number | null; onChange: (i: number) => void; icons?: IconName[] }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((o, i) => {
        const on = value === i;
        return (
          <Springy
            key={o}
            onPress={() => onChange(i)}
            scaleTo={1.04}
            accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: icons ? 64 : 44, borderRadius: 16, backgroundColor: on ? c.text : c.card, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 }}>
            {icons ? <Icon name={icons[i]} size={22} color={on ? c.bg : c.text} /> : null}
            <Text weight={600} size={14} color={on ? c.bg : c.text} numberOfLines={1}>
              {t(o)}
            </Text>
          </Springy>
        );
      })}
    </View>
  );
}

/** Weight wheel: whole kilos and one decimal (design: weightPicker). */
export function WeightWheel({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const whole = Math.max(30, Math.min(250, Math.floor(value + 1e-6)));
  const dec = Math.round((value - Math.floor(value + 1e-6)) * 10) % 10;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', direction: 'ltr' } as object}>
      <Wheel
        columns={[
          { items: Array.from({ length: 221 }, (_, i) => ({ value: 30 + i, label: String(30 + i) })), selected: whole, width: 92 },
          { items: Array.from({ length: 10 }, (_, i) => ({ value: i, label: `.${i}` })), selected: dec, width: 60 },
        ]}
        onChange={([w, d]) => onChange(w + d / 10)}
      />
      <Text weight={700} color="sec" size={18} style={{ marginStart: 4 }}>
        kg
      </Text>
    </View>
  );
}

/** "7 h 30 min" */
export function fmtDur(hours: number, t: (s: string, v?: Record<string, string | number>) => string) {
  const m = Math.round(hours * 60);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? t('{h} h {m} min', { h, m: r }) : t('{h} h', { h });
}
