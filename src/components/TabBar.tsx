import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Icon, type IconName, Mark } from './Icon';
import { Text } from './Text';
import { Springy } from './ui';

export const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'food', label: 'Food', icon: 'food' },
  { name: 'train', label: 'Train', icon: 'train' },
  { name: 'progress', label: 'Progress', icon: 'progress' },
  { name: 'friends', label: 'Gym Bros', icon: 'friends' },
];

const spring = (v: Animated.Value, toValue: number) =>
  Animated.spring(v, { toValue, useNativeDriver: false, speed: 14, bounciness: 9 });

/**
 * Floating glass tab bar + AI coach button (design: .tabbar / .aibtn).
 * While scrolling down it shrinks to just the active tab's icon; tap it to open again.
 */
export function TabBar({ state, navigation, mini, setMini }: BottomTabBarProps & { mini: boolean; setMini: (v: boolean) => void }) {
  const { colors: c, isDark, isRTL } = useSettings();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [rowW, setRowW] = useState(0);
  const idx = state.index;

  const width = useState(() => new Animated.Value(0))[0]; // 0 = full, 1 = mini
  const pill = useState(() => new Animated.Value(idx))[0];

  useEffect(() => {
    spring(width, mini ? 1 : 0).start();
  }, [mini, width]);
  useEffect(() => {
    spring(pill, idx).start();
  }, [idx, pill]);

  const [full, setFull] = useState(0);
  const barW = width.interpolate({ inputRange: [0, 1], outputRange: [Math.max(full, 54), 54] });
  const barH = width.interpolate({ inputRange: [0, 1], outputRange: [64, 54] });
  const bottom = width.interpolate({ inputRange: [0, 1], outputRange: [24 + insets.bottom, 18 + insets.bottom] });
  const aiSize = width.interpolate({ inputRange: [0, 1], outputRange: [60, 54] });
  const aiBottom = width.interpolate({ inputRange: [0, 1], outputRange: [26 + insets.bottom, 18 + insets.bottom] });
  const tabW = (rowW - 8) / TABS.length;
  const active = isDark ? c.link : c.cobalt;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 + insets.bottom }}
      onLayout={(e) => setFull(e.nativeEvent.layout.width - 92)}>
      <Animated.View style={{ position: 'absolute', [isRTL ? 'right' : 'left']: 12, bottom, width: barW, height: barH }}>
        <Glass style={{ flex: 1, borderRadius: 32, overflow: 'hidden' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: mini ? 0 : 4 }} onLayout={(e) => !mini && setRowW(e.nativeEvent.layout.width)}>
            {!mini && rowW > 0 ? (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  [isRTL ? 'right' : 'left']: 4,
                  width: tabW,
                  borderRadius: 28,
                  backgroundColor: c.pill,
                  transform: [{ translateX: pill.interpolate({ inputRange: [0, 4], outputRange: [0, (isRTL ? -1 : 1) * tabW * 4] }) }],
                }}
              />
            ) : null}
            {TABS.map((tab, i) => {
              const on = i === idx;
              if (mini && !on) return null;
              return (
                <Pressable
                  key={tab.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(tab.label)}
                  onPress={() => {
                    if (mini) return setMini(false);
                    const route = state.routes.find((r) => r.name === tab.name);
                    if (!route) return;
                    const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!on && !ev.defaultPrevented) navigation.navigate(route.name);
                  }}
                  style={{ flex: 1, height: mini ? 54 : 56, alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <Icon name={tab.icon} size={24} color={on ? active : c.text} strokeWidth={on ? 2.1 : 1.8} />
                  {!mini ? (
                    <Text
                      weight={700}
                      size={isRTL ? 9.5 : 10}
                      color={on ? active : c.text}
                      numberOfLines={1}
                      style={{ letterSpacing: isRTL ? 0 : -0.1, lineHeight: isRTL ? 15 : 13 }}>
                      {t(tab.label)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Glass>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', [isRTL ? 'left' : 'right']: 12, bottom: aiBottom, width: aiSize, height: aiSize }}>
        <Springy onPress={() => router.push('/coach')} scaleTo={1.08} accessibilityLabel={t('Open AI coach')} style={{ flex: 1 }}>
          <Glass ai style={{ flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
            <Mark size={30} color={c.cobalt} stroke={6} />
          </Glass>
        </Springy>
      </Animated.View>
    </View>
  );
}
