import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useSettings } from '@/theme/settings';

/** Measure the width we can draw in (charts fill their card). */
function useWidth(): [number, (e: { nativeEvent: { layout: { width: number } } }) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/** Smooth line chart with a soft fill (design: lineChart). */
export function LineChart({
  values,
  labels = [],
  height = 150,
  color,
  dots = true,
  goal,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
  dots?: boolean;
  goal?: number;
}) {
  const { colors: c } = useSettings();
  const [w, onLayout] = useWidth();
  const col = color ?? c.cobalt;
  const h = height;
  const all = goal != null ? [...values, goal] : values;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.2 || 1;
  const a = lo - pad;
  const b = hi + pad;
  const top = 10;
  const bot = labels.length ? 24 : 8;
  const X = (i: number) => (values.length === 1 ? w / 2 : 8 + (i * (w - 16)) / (values.length - 1));
  const Y = (v: number) => top + (h - top - bot) * (1 - (v - a) / (b - a));
  let d = '';
  values.forEach((v, i) => {
    const x = X(i);
    const y = Y(v);
    if (!i) d = `M${x},${y}`;
    else {
      const px = X(i - 1);
      const py = Y(values[i - 1]);
      const cx = (px + x) / 2;
      d += ` C${cx},${py} ${cx},${y} ${x},${y}`;
    }
  });
  const li = values.length - 1;
  const area = `${d} L${X(li)},${h - bot} L${X(0)},${h - bot}Z`;
  return (
    <View onLayout={onLayout} style={{ height: h, direction: 'ltr' } as object}>
      {w > 0 && values.length ? (
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={col} stopOpacity={0.16} />
              <Stop offset="1" stopColor={col} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {goal != null ? <Line x1={0} x2={w} y1={Y(goal)} y2={Y(goal)} stroke={c.sec} strokeDasharray="3 5" opacity={0.6} /> : null}
          {values.length > 1 ? <Path d={area} fill="url(#lcfill)" /> : null}
          <Path d={d} fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" />
          {dots ? <Circle cx={X(li)} cy={Y(values[li])} r={5} fill={col} stroke={c.bg} strokeWidth={2.5} /> : null}
          {labels.map((l, i) =>
            l ? (
              <SvgText key={i} x={X(i)} y={h - 4} textAnchor={values.length > 1 && i === 0 ? 'start' : values.length > 1 && i === values.length - 1 ? 'end' : 'middle'} fontSize={11} fontFamily="Manrope_600SemiBold" fill={c.sec}>
                {l}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

/** Rounded bar chart; the highlighted bar is cobalt (design: barChart). */
export function BarChart({
  values,
  labels = [],
  height = 150,
  max,
  highlight = -1,
  goal,
  colors,
}: {
  values: (number | null)[];
  labels?: string[];
  height?: number;
  max?: number;
  highlight?: number;
  goal?: number;
  colors?: (string | null)[];
}) {
  const { colors: c } = useSettings();
  const [w, onLayout] = useWidth();
  const h = height;
  const nums = values.map((v) => v ?? 0);
  const m = max || Math.max(...nums, goal ?? 0, 1) * 1.15;
  const n = values.length;
  const bw = Math.min(26, (w / Math.max(n, 1)) * 0.5);
  const bot = 24;
  return (
    <View onLayout={onLayout} style={{ height: h, direction: 'ltr' } as object}>
      {w > 0 ? (
        <Svg width={w} height={h}>
          {goal ? <Line x1={0} x2={w} y1={(h - bot) * (1 - goal / m)} y2={(h - bot) * (1 - goal / m)} stroke={c.sec} strokeDasharray="3 5" opacity={0.6} /> : null}
          {values.map((v, i) => {
            const x = ((i + 0.5) * w) / n;
            const bh = v == null ? 0 : Math.max(4, (h - bot - 6) * Math.min(1, v / m));
            return (
              <G key={i}>
                {v != null ? <Rect x={x - bw / 2} y={h - bot - bh} width={bw} height={bh} rx={bw / 2} fill={colors?.[i] ?? (i === highlight ? c.cobalt : c.track)} /> : null}
                <SvgText x={x} y={h - 6} textAnchor="middle" fontSize={11} fontFamily="Manrope_600SemiBold" fill={c.sec}>
                  {labels[i] ?? ''}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
