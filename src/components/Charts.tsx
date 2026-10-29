import { useRef, useState } from 'react';
import { type GestureResponderEvent, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { useSettings } from '@/theme/settings';

/** Measure the width we can draw in (charts fill their card). */
function useWidth(): [number, (e: { nativeEvent: { layout: { width: number } } }) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/**
 * Touch a chart to see one point: tap a bar or a day, or slide your finger across to move between them (design:
 * owner's ask, like the weight chart). Tapping the same one again hides it.
 */
function useScrub(pick: (x: number) => number) {
  const [sel, setSel] = useState<number | null>(null);
  const box = useRef<View>(null);
  const left = useRef(0);
  const at = (e: GestureResponderEvent) => pick(e.nativeEvent.pageX - left.current);
  const handlers = {
    onStartShouldSetResponder: () => true,
    // A vertical scroll of the page still wins.
    onResponderTerminationRequest: () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      const px = e.nativeEvent.pageX;
      box.current?.measureInWindow((x) => {
        left.current = x;
        const i = pick(px - x);
        setSel((s) => (s === i ? null : i));
      });
    },
    onResponderMove: (e: GestureResponderEvent) => setSel(at(e)),
  };
  return { sel, box, handlers };
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));

/** The bubble over the picked point: its text, kept inside the chart. */
function Bubble({ x, w, text }: { x: number; w: number; text: string }) {
  const { colors: c } = useSettings();
  const bw = Math.min(w, text.length * 6.6 + 18);
  const left = Math.max(0, Math.min(w - bw, x - bw / 2));
  return (
    <G>
      <Rect x={left} y={0} width={bw} height={22} rx={11} fill={c.text} />
      <SvgText x={left + bw / 2} y={15} textAnchor="middle" fontSize={11.5} fontFamily="Manrope_700Bold" fill={c.bg}>
        {text}
      </SvgText>
    </G>
  );
}

/** Smooth line chart with a soft fill (design: lineChart). */
export function LineChart({
  values,
  labels = [],
  height = 150,
  color,
  dots = true,
  goal,
  tip,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
  dots?: boolean;
  goal?: number;
  /** What the bubble says for a touched point (the date and value); just the value when left out. */
  tip?: (i: number) => string;
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
  const top = 28;
  const bot = labels.length ? 24 : 8;
  // Room on the left for the values (y), dates along the bottom (x).
  const gx = 34;
  const X = (i: number) => (values.length === 1 ? (w + gx) / 2 : gx + (i * (w - gx - 8)) / (values.length - 1));
  const { sel, box, handlers } = useScrub((x) => Math.max(0, Math.min(values.length - 1, values.length === 1 ? 0 : Math.round(((x - gx) * (values.length - 1)) / Math.max(1, w - gx - 8)))));
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
    <View ref={box} onLayout={onLayout} {...handlers} style={{ height: h, direction: 'ltr' } as object}>
      {w > 0 && values.length ? (
        <Svg width={w} height={h} pointerEvents="none">
          <Defs>
            <LinearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={col} stopOpacity={0.16} />
              <Stop offset="1" stopColor={col} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {goal != null ? <Line x1={0} x2={w} y1={Y(goal)} y2={Y(goal)} stroke={c.sec} strokeDasharray="3 5" opacity={0.6} /> : null}
          {values.length > 1 ? <Path d={area} fill="url(#lcfill)" /> : null}
          <Path d={d} fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" />
          {/* The y values: highest and lowest, at their height. */}
          {[hi, lo].filter((v, i, xs) => xs.indexOf(v) === i).map((v) => (
            <SvgText key={v} x={gx - 6} y={Y(v) + 4} textAnchor="end" fontSize={10} fontFamily="Manrope_600SemiBold" fill={c.sec}>
              {num(v)}
            </SvgText>
          ))}
          {dots && values.length <= 40 ? values.map((v, i) => <Circle key={i} cx={X(i)} cy={Y(v)} r={i === li ? 5 : 3} fill={col} stroke={c.bg} strokeWidth={i === li ? 2.5 : 1} />) : null}
          {sel != null && values[sel] != null ? (
            <G>
              <Line x1={X(sel)} x2={X(sel)} y1={24} y2={h - bot} stroke={col} strokeWidth={1} opacity={0.5} />
              <Circle cx={X(sel)} cy={Y(values[sel])} r={6} fill={c.bg} stroke={col} strokeWidth={3} />
              <Bubble x={X(sel)} w={w} text={tip ? tip(sel) : num(values[sel])} />
            </G>
          ) : null}
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
  tip,
}: {
  values: (number | null)[];
  labels?: string[];
  height?: number;
  max?: number;
  highlight?: number;
  goal?: number;
  colors?: (string | null)[];
  /** What the bubble says for a touched bar (the date and value); just the value when left out. */
  tip?: (i: number) => string;
}) {
  const { colors: c } = useSettings();
  const [w, onLayout] = useWidth();
  const h = height;
  const nums = values.map((v) => v ?? 0);
  const m = max || Math.max(...nums, goal ?? 0, 1) * 1.15;
  const n = values.length;
  const bw = Math.min(26, (w / Math.max(n, 1)) * 0.5);
  const bot = 24;
  const { sel, box, handlers } = useScrub((x) => Math.max(0, Math.min(n - 1, Math.floor((x * n) / Math.max(1, w)))));
  // The bars sit below the bubble.
  const room = 26;
  return (
    <View ref={box} onLayout={onLayout} {...handlers} style={{ height: h + room, direction: 'ltr' } as object}>
      {w > 0 ? (
        <Svg width={w} height={h + room} pointerEvents="none">
          <G transform={`translate(0 ${room})`}>
          {goal ? <Line x1={0} x2={w} y1={(h - bot) * (1 - goal / m)} y2={(h - bot) * (1 - goal / m)} stroke={c.sec} strokeDasharray="3 5" opacity={0.6} /> : null}
          {values.map((v, i) => {
            const x = ((i + 0.5) * w) / n;
            const bh = v == null ? 0 : Math.max(4, (h - bot - 6) * Math.min(1, v / m));
            return (
              <G key={i} opacity={sel == null || sel === i ? 1 : 0.45}>
                {v != null ? <Rect x={x - bw / 2} y={h - bot - bh} width={bw} height={bh} rx={bw / 2} fill={sel === i ? c.cobalt : (colors?.[i] ?? (i === highlight ? c.cobalt : c.track))} /> : null}
                <SvgText x={x} y={h - 6} textAnchor="middle" fontSize={11} fontFamily="Manrope_600SemiBold" fill={c.sec}>
                  {labels[i] ?? ''}
                </SvgText>
              </G>
            );
          })}
          </G>
          {sel != null ? <Bubble x={((sel + 0.5) * w) / n} w={w} text={tip ? tip(sel) : values[sel] == null ? '–' : num(values[sel] as number)} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}
