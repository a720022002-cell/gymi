import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Mark } from '../Icon';
import { Text } from '../Text';

/** Spinning brand ring with a short message (design: thinking()). */
export function Thinking({ message }: { message: string }) {
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
