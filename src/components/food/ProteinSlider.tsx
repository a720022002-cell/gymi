import { useRef, useState } from 'react';
import { type GestureResponderEvent, View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Text } from '../Text';

const MIN = 1.2;
const MAX = 3.5;

/** Protein g/kg slider with the common 1.6–2.2 range marked; snaps near the edges of the range. */
export function ProteinSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors: c, isRTL } = useSettings();
  const [w, setW] = useState(0);
  const left = useRef(0);
  const pos = (v: number) => ((v - MIN) / (MAX - MIN)) * w;
  const from = (x: number) => {
    let v = MIN + (Math.max(0, Math.min(w, isRTL ? w - x : x)) / (w || 1)) * (MAX - MIN);
    for (const t of [1.6, 2.2]) if (Math.abs(v - t) < 0.07) v = t;
    return Math.round(v * 10) / 10;
  };
  const move = (e: GestureResponderEvent) => onChange(from(e.nativeEvent.pageX - left.current));
  const at = (v: number) => (isRTL ? { right: pos(v) } : { left: pos(v) });
  return (
    <View style={{ marginTop: 14 }}>
      <View
        ref={(r) => {
          r?.measure?.((_x, _y, _w, _h, px) => (left.current = px));
        }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          (e.currentTarget as unknown as View)?.measure?.((_x, _y, _w, _h, px) => (left.current = px));
          move(e);
        }}
        onResponderMove={move}
        accessibilityRole="adjustable"
        accessibilityLabel="Protein grams per kg"
        accessibilityValue={{ min: MIN, max: MAX, now: value }}
        style={{ height: 44, justifyContent: 'center' }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.track }} />
        {w ? (
          <>
            <View style={{ position: 'absolute', top: 15, height: 14, borderRadius: 7, backgroundColor: 'rgba(34,197,94,0.28)', borderWidth: 1.5, borderColor: 'rgba(21,128,61,0.45)', width: pos(2.2) - pos(1.6), ...at(1.6) } as object} />
            <View style={{ position: 'absolute', top: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: '0px 2px 8px rgba(0,0,0,0.25)', ...(isRTL ? { right: pos(value) - 14 } : { left: pos(value) - 14 }) } as object} />
          </>
        ) : null}
      </View>
      {w ? (
        <View style={{ height: 18 }}>
          {[1.6, 2.2].map((t) => (
            <Text key={t} variant="xs" weight={700} color="up" style={{ position: 'absolute', width: 30, textAlign: 'center', ...(isRTL ? { right: pos(t) - 15 } : { left: pos(t) - 15 }) } as object}>
              {t.toFixed(1)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
