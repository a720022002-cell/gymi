import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { MarkerPoint } from '@/lib/bloodFood';
import { useSettings } from '@/theme/settings';

/** One blood marker across reports: a line with a dot per result and the normal range as a soft band. */
export function MarkerChart({ points, labels, height = 150 }: { points: MarkerPoint[]; labels: string[]; height?: number }) {
  const { colors: c } = useSettings();
  const [w, setW] = useState(0);
  const last = points.at(-1);
  const low = last?.low ?? null;
  const high = last?.high ?? null;
  const all = [...points.map((p) => p.value), ...(low != null ? [low] : []), ...(high != null ? [high] : [])];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.2 || Math.abs(hi) * 0.2 || 1;
  const a = lo - pad;
  const b = hi + pad;
  const top = 10;
  const bot = 24;
  const X = (i: number) => (points.length === 1 ? w / 2 : 14 + (i * (w - 28)) / (points.length - 1));
  const Y = (v: number) => top + (height - top - bot) * (1 - (v - a) / (b - a));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.value)}`).join(' ');
  const bandTop = Y(high ?? b);
  const bandBot = Y(low ?? a);
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height, direction: 'ltr' } as object}>
      {w > 0 && points.length ? (
        <Svg width={w} height={height}>
          {low != null || high != null ? <Rect x={0} y={bandTop} width={w} height={Math.max(0, bandBot - bandTop)} rx={8} fill={c.up} opacity={0.12} /> : null}
          {low != null ? <Line x1={0} x2={w} y1={Y(low)} y2={Y(low)} stroke={c.sec} strokeDasharray="3 5" opacity={0.5} /> : null}
          {high != null ? <Line x1={0} x2={w} y1={Y(high)} y2={Y(high)} stroke={c.sec} strokeDasharray="3 5" opacity={0.5} /> : null}
          {points.length > 1 ? <Path d={d} fill="none" stroke={c.cobalt} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {points.map((p, i) => (
            <Circle key={`${p.day}${i}`} cx={X(i)} cy={Y(p.value)} r={i === points.length - 1 ? 5.5 : 4} fill={p.flag ? c.down : c.cobalt} stroke={c.card} strokeWidth={2} />
          ))}
          {labels.map((l, i) =>
            l ? (
              <SvgText key={i} x={X(i)} y={height - 4} textAnchor={points.length > 1 && i === 0 ? 'start' : points.length > 1 && i === points.length - 1 ? 'end' : 'middle'} fontSize={11} fontFamily="Manrope_600SemiBold" fill={c.sec}>
                {l}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}
