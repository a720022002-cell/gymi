import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { watchOnline } from '@/lib/online';
import { useSettings } from '@/theme/settings';

import { Icon } from './Icon';
import { Text } from './Text';
import { useToast } from './Toast';

/** "You're offline" bar at the top while there's no connection, and a "Back online" toast after (design: setOffline). */
export function OfflineBanner() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [off, setOff] = useState(false);
  const [hidden, setHidden] = useState(false);
  const was = useRef(false);
  const a = useState(() => new Animated.Value(0))[0];

  useEffect(
    () =>
      watchOnline((online) => {
        setOff(!online);
        if (!online) setHidden(false);
        if (online && was.current) toast(t('Back online. Everything is synced.'), { icon: 'check' });
        was.current = !online;
      }),
    [toast, t],
  );

  const show = off && !hidden;
  useEffect(() => {
    Animated.spring(a, { toValue: show ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
  }, [show, a]);

  if (!off) return null;
  return (
    <Animated.View
      pointerEvents={show ? 'auto' : 'none'}
      style={{ position: 'absolute', top: Math.max(8, insets.top) + 4, start: 8, end: 8, zIndex: 999, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] }) }] }}>
      <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.text, borderRadius: 18, paddingVertical: 4, paddingStart: 14, paddingEnd: 2 }}>
        <Icon name="warn" size={20} color={c.bg} strokeWidth={2} />
        <Text variant="small" weight={600} color={c.bg} style={{ flex: 1 }}>
          {t('You’re offline. What you change is saved and syncs when you’re back online.')}
        </Text>
        <Pressable onPress={() => setHidden(true)} accessibilityLabel={t('Dismiss')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={16} color={c.bg} strokeWidth={2.2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
