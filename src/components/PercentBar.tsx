import { useRef } from 'react';
import { View } from 'react-native';

import { useSettings } from '@/theme/settings';

/** A bar you drag or tap to pick 0-100% (in steps). Works the same on iPhone, Android and the web. */
export function PercentBar({ value, onChange, step = 5, label }: { value: number; onChange: (v: number) => void; step?: number; label: string }) {
  const { colors: c, isRTL } = useSettings();
  const box = useRef<View>(null);
  const geo = useRef({ x: 0, w: 1 });
  const pick = (pageX: number) => {
    let f = (pageX - geo.current.x) / geo.current.w;
    if (isRTL) f = 1 - f;
    const v = Math.round((Math.min(1, Math.max(0, f)) * 100) / step) * step;
    if (v !== value) onChange(v);
  };
  const v = Math.min(100, Math.max(0, value));
  return (
    <View
      ref={box}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: v, text: `${v}%` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(100, Math.max(0, v + (e.nativeEvent.actionName === 'increment' ? step : -step))))}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const x = e.nativeEvent.pageX;
        box.current?.measure((_a, _b, w, _h, px) => {
          geo.current = { x: px, w: Math.max(1, w) };
          pick(x);
        });
      }}
      onResponderMove={(e) => pick(e.nativeEvent.pageX)}
      style={{ height: 36, justifyContent: 'center' }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.inset, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${v}%`, backgroundColor: c.cobalt }} />
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', [isRTL ? 'right' : 'left']: `${v}%`, marginStart: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: c.cobalt }}
      />
    </View>
  );
}
