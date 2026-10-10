import { View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';

export function WarnChip({ label }: { label: string }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(220,38,38,0.1)' }}>
      <Icon name="warn" size={13} color={c.down} strokeWidth={2.2} />
      <Text variant="xs" weight={700} color="down">
        {label}
      </Text>
    </View>
  );
}

export function OkChip({ label }: { label: string }) {
  const { colors: c, isDark } = useSettings();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: isDark ? 'rgba(112,136,255,0.14)' : 'rgba(51,85,255,0.1)' }}>
      <Icon name="check" size={13} color={isDark ? c.link : c.cobalt} strokeWidth={2.6} />
      <Text variant="xs" weight={700} color={isDark ? c.link : c.cobalt}>
        {label}
      </Text>
    </View>
  );
}

export function Tag({ label }: { label: string }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, backgroundColor: c.inset, justifyContent: 'center' }}>
      <Text variant="xs" weight={700} color="sec">
        {label}
      </Text>
    </View>
  );
}
