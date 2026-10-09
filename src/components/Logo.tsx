import { View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Mark } from './Icon';
import { Text } from './Text';

/** Ring mark + "gymi" in lowercase Sora (design: logo()). Never translated. */
export function Logo({ height = 30, color }: { height?: number; color?: string }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.3, direction: 'ltr' } as object}>
      <Mark size={height * 1.02} color={c.cobalt} stroke={height * 0.22} />
      <Text
        num
        size={height * 1.28}
        color={color ?? c.text}
        style={{ letterSpacing: -0.045 * height * 1.28, lineHeight: height * 1.4, marginTop: -height * 0.12 }}>
        gymi
      </Text>
    </View>
  );
}
