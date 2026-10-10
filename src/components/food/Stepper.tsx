import { type ReactNode } from 'react';
import { View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Springy } from '../ui';

/** − value + (design: .stepper). */
export function Stepper({
  onMinus,
  onPlus,
  children,
  size = 44,
  bg,
  minusDisabled,
  labels = ['Less', 'More'],
}: {
  onMinus: () => void;
  onPlus: () => void;
  children: ReactNode;
  size?: number;
  bg?: string;
  minusDisabled?: boolean;
  labels?: [string, string];
}) {
  const { colors: c } = useSettings();
  const btn = { width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? c.card, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Springy onPress={onMinus} scaleTo={1.1} disabled={minusDisabled} accessibilityLabel={labels[0]} style={btn}>
        <Icon name="minus" size={size > 40 ? 20 : 16} strokeWidth={2.2} />
      </Springy>
      <View style={{ flex: 1, alignItems: 'center' }}>{children}</View>
      <Springy onPress={onPlus} scaleTo={1.1} accessibilityLabel={labels[1]} style={btn}>
        <Icon name="plus" size={size > 40 ? 20 : 16} strokeWidth={2.2} />
      </Springy>
    </View>
  );
}
