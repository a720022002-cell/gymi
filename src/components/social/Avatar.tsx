import { View } from 'react-native';

import { avatarColor } from '@/lib/social';

import { Text } from '../Text';

/** Round letter avatar in a colour picked from the person's id. */
export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id), alignItems: 'center', justifyContent: 'center' }}>
      <Text weight={700} size={size * 0.42} color="#FFFFFF">
        {(name[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}
