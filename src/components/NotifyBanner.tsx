import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Icon, type IconName, Mark } from './Icon';
import { Text } from './Text';

export type Banner = {
  /** Already translated. */
  title: string;
  body: string;
  /** 'ring' shows the Adro mark. */
  icon?: IconName | 'ring';
  /** Screen to open when tapped, e.g. '/friends' or '/notif?type=water'. */
  route?: string;
  onTap?: () => void;
};

let listener: ((b: Banner) => void) | null = null;

/**
 * Show an in-app notification that drops from the top (design: notify()). Tapping it opens `route`.
 * Use it anywhere, e.g. "Preview a reminder" buttons: showBanner({ title: 'Adro', body: t('…'), icon: 'drop', route: '/water' }).
 */
export function showBanner(b: Banner) {
  listener?.(b);
}

/** Mounted once in the root layout. */
export function NotifyBanner() {
  const { colors: c } = useSettings();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [b, setB] = useState<Banner | null>(null);
  const a = useState(() => new Animated.Value(0))[0];
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const hide = () => Animated.timing(a, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setB(null));
    listener = (next) => {
      setB(next);
      a.setValue(0);
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 7 }).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(hide, 4800);
    };
    return () => {
      listener = null;
      clearTimeout(timer.current);
    };
  }, [a]);

  if (!b) return null;
  const tap = () => {
    clearTimeout(timer.current);
    Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setB(null));
    if (b.onTap) b.onTap();
    else if (b.route) router.push(b.route as never);
  };
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: Math.max(8, insets.top) + 4,
        start: 8,
        end: 8,
        zIndex: 1000,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) }],
      }}>
      <Pressable onPress={tap} accessibilityRole="alert" accessibilityLabel={`${b.title}. ${b.body}`}>
        <Glass style={{ borderRadius: 24, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
            {!b.icon || b.icon === 'ring' ? <Mark size={22} color="#FFFFFF" stroke={4.5} /> : <Icon name={b.icon} size={20} color="#FFFFFF" strokeWidth={2} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text weight={700} size={14} numberOfLines={1} style={{ flex: 1 }}>
                {b.title}
              </Text>
              <Text variant="xs" color="sec">
                {t('now')}
              </Text>
            </View>
            <Text size={14} numberOfLines={3} style={{ lineHeight: 19 }}>
              {b.body}
            </Text>
          </View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}
