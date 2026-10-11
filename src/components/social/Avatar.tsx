import { Image } from 'expo-image';
import { View } from 'react-native';

import { useAvatarUrl } from '@/lib/avatars';
import { avatarColor } from '@/lib/social';

import { Text } from '../Text';

/**
 * Round avatar: the person's profile photo, or their first letter in a colour picked from the id.
 * id can be a user id or a username. Pass url when you already know the photo.
 */
export function Avatar({ id, name, size = 40, url }: { id: string; name: string; size?: number; url?: string | null }) {
  const found = useAvatarUrl(url === undefined ? id : '');
  const src = url === undefined ? found : url;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text weight={700} size={size * 0.42} color="#FFFFFF">
          {(name[0] ?? '?').toUpperCase()}
        </Text>
      )}
    </View>
  );
}
