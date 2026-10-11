import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Mark } from '../Icon';
import { Text } from '../Text';

/**
 * On the web the spin is a CSS animation: the browser runs it on its own, so it keeps turning
 * while the app is busy (loading data, waiting for the AI). Animated on the web runs on the
 * same thread as the app and freezes when that thread is busy.
 */
// Keyframes only work through StyleSheet.create on the web (not in inline styles).
const web = StyleSheet.create({
  spin: {
    animationKeyframes: [{ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }],
    animationDuration: '1s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  } as object,
});

/** Spinning brand ring with a short message (design: thinking()). */
export function Thinking({ message }: { message: string }) {
  if (Platform.OS === 'web') return <WebThinking message={message} />;
  return <NativeThinking message={message} />;
}

function WebThinking({ message }: { message: string }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 16 }}>
      <View style={web.spin}>
        <Mark size={52} color={c.cobalt} stroke={9} />
      </View>
      <Text weight={700} center>
        {message}
      </Text>
    </View>
  );
}

/** On phones the spin runs on the native UI thread, so it never freezes. */
function NativeThinking({ message }: { message: string }) {
  const { colors: c } = useSettings();
  const spin = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 16 }}>
      <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Mark size={52} color={c.cobalt} stroke={9} />
      </Animated.View>
      <Text weight={700} center>
        {message}
      </Text>
    </View>
  );
}
