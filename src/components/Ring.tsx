import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useSettings } from '@/theme/settings';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress ring (design: ring()). Fills from 0 with the design's ease. */
export function Ring({
  value,
  max,
  size = 180,
  stroke = 16,
  color,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const { colors: c } = useSettings();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const anim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: p,
      duration: 1100,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: false,
    }).start();
  }, [p, anim]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.track} strokeWidth={stroke} />
        {p > 0 ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color ?? c.cobalt}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={anim.interpolate({ inputRange: [0, 1], outputRange: [C, 0] })}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

/** Thin progress bar (design: .bar). */
export function Bar({ value, max, color, thick }: { value: number; max: number; color?: string; thick?: boolean }) {
  const { colors: c } = useSettings();
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const [w, setW] = useState(0);
  const anim = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(anim, { toValue: p, useNativeDriver: false, speed: 6, bounciness: 6 }).start();
  }, [p, anim]);
  const h = thick ? 10 : 6;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: h, borderRadius: h / 2, backgroundColor: c.track, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: h / 2,
          backgroundColor: color ?? c.cobalt,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, w] }),
        }}
      />
    </View>
  );
}
