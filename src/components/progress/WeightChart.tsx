import { useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { useSettings } from '@/theme/settings';

const GUTTER = 58;
const daysFrom = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);

/**
 * Weight over time (design: owner's sketch): dates along the bottom, your current weight and your target on the side
 * (the target above for a bulk, below for a cut), and a dot for every weigh-in. Tap near a dot to pick that day.
 */
export function WeightChart({
  points,
  target,
  labels,
  dateLabel,
  selected,
  onSelect,
  height = 190,
}: {
  /** Weigh-ins, oldest first, in the unit shown. */
  points: { day: string; value: number }[];
  target: number | null;
  /** Side labels: [target caption, current caption], and how to show a number. */
  labels: { target: string; current: string; num: (v: number) => string };
  dateLabel: (day: string) => string;
  selected: number | null;
  onSelect: (i: number | null) => void;
  height?: number;
}) {
  const { colors: c } = useSettings();
  const [w, setW] = useState(0);
  const box = useRef<View>(null);
  const h = height;
  const top = 14;
  const bot = 24;
  const x0 = GUTTER;
  const x1 = w - 10;
  const first = points[0]?.day;
  const span = Math.max(1, daysFrom(first, points.at(-1)!.day));
  const X = (i: number) => (points.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * daysFrom(first, points[i].day)) / span);
  const all = [...points.map((p) => p.value), ...(target != null ? [target] : [])];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.12 || 1;
  const a = lo - pad;
  const b = hi + pad;
  const Y = (v: number) => top + (h - top - bot) * (1 - (v - a) / (b - a));

  let d = '';
  points.forEach((p, i) => {
    const x = X(i);
    const y = Y(p.value);
    if (!i) d = `M${x},${y}`;
    else {
      const px = X(i - 1);
      const py = Y(points[i - 1].value);
      const cx = (px + x) / 2;
      d += ` C${cx},${py} ${cx},${y} ${x},${y}`;
    }
  });
  const li = points.length - 1;
  const area = `${d} L${X(li)},${h - bot} L${X(0)},${h - bot}Z`;
  const cur = points[li]?.value;
  const yCur = cur != null ? Y(cur) : 0;
  const yT = target != null ? Y(target) : null;
  // Keep the two side labels apart when the current weight is close to the target.
  const clash = yT != null && Math.abs(yT - yCur) < 30;
  const curLabelY = clash ? (yCur < (yT as number) ? (yT as number) - 30 : (yT as number) + 30) : yCur;
  // Dates along the bottom: first, last, and the middle when there's room.
  // Dropped when it would sit too close to the next one (so two dates never overlap).
  const ticks = (points.length > 1 ? [0, ...(span >= 10 ? [points.findIndex((p) => daysFrom(first, p.day) >= span / 2)] : []), li].filter((v, i, xs) => v >= 0 && xs.indexOf(v) === i) : [0]).filter(
    (v, i, xs) => i === 0 || i === xs.length - 1 || (Math.abs(X(v) - X(xs[i - 1])) > 70 && Math.abs(X(xs[xs.length - 1]) - X(v)) > 70),
  );

  const nearest = (lx: number) => {
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(X(i) - lx) < Math.abs(X(best) - lx)) best = i;
    return best;
  };
  const left = useRef(0);

  return (
    <View ref={box} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height: h, direction: 'ltr' } as object}>
      {w > 0 && points.length ? (
        <>
          <Svg width={w} height={h}>
            <Defs>
              <LinearGradient id="wcfill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.cobalt} stopOpacity={0.18} />
                <Stop offset="1" stopColor={c.cobalt} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* Axes */}
            <Line x1={x0 - 6} x2={x0 - 6} y1={top - 4} y2={h - bot} stroke={c.line} strokeWidth={1.5} />
            <Line x1={x0 - 6} x2={x1} y1={h - bot} y2={h - bot} stroke={c.line} strokeWidth={1.5} />
            {/* Target */}
            {yT != null ? (
              <>
                <Line x1={x0 - 6} x2={x1} y1={yT} y2={yT} stroke={c.up} strokeWidth={1.5} strokeDasharray="4 5" />
                <SvgText x={x0 - 12} y={yT - 3} textAnchor="end" fontSize={10} fontFamily="Manrope_600SemiBold" fill={c.up}>
                  {labels.target}
                </SvgText>
                <SvgText x={x0 - 12} y={yT + 10} textAnchor="end" fontSize={11} fontFamily="Manrope_700Bold" fill={c.up}>
                  {labels.num(target as number)}
                </SvgText>
              </>
            ) : null}
            {/* Current */}
            {cur != null ? (
              <>
                <Line x1={x0 - 6} x2={X(li)} y1={yCur} y2={yCur} stroke={c.cobalt} strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />
                <SvgText x={x0 - 12} y={curLabelY - 3} textAnchor="end" fontSize={10} fontFamily="Manrope_600SemiBold" fill={c.sec}>
                  {labels.current}
                </SvgText>
                <SvgText x={x0 - 12} y={curLabelY + 10} textAnchor="end" fontSize={11} fontFamily="Manrope_700Bold" fill={c.text}>
                  {labels.num(cur)}
                </SvgText>
              </>
            ) : null}
            {points.length > 1 ? <Path d={area} fill="url(#wcfill)" /> : null}
            <Path d={d} fill="none" stroke={c.cobalt} strokeWidth={2.5} strokeLinecap="round" />
            {selected != null && points[selected] ? <Line x1={X(selected)} x2={X(selected)} y1={top - 4} y2={h - bot} stroke={c.cobalt} strokeWidth={1} opacity={0.5} /> : null}
            {/* A dot for every weigh-in */}
            {points.map((p, i) => (
              <Circle key={p.day} cx={X(i)} cy={Y(p.value)} r={i === selected ? 6.5 : i === li ? 5 : 3.5} fill={i === selected ? c.bg : c.cobalt} stroke={c.cobalt} strokeWidth={i === selected ? 3 : i === li ? 2.5 : 0} />
            ))}
            {ticks.map((i) => (
              <SvgText key={i} x={X(i)} y={h - 6} textAnchor={points.length > 1 && i === 0 ? 'start' : points.length > 1 && i === li ? 'end' : 'middle'} fontSize={11} fontFamily="Manrope_600SemiBold" fill={c.sec}>
                {dateLabel(points[i].day)}
              </SvgText>
            ))}
          </Svg>
          {/* On top of the drawing: tap a day (again to hide it), or slide across to move between days. Positions are
              the touch on the screen minus where the chart starts. */}
          <View
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => true}
            onResponderGrant={(e) => {
              const px = e.nativeEvent.pageX;
              box.current?.measureInWindow((bx) => {
                left.current = bx;
                const i = nearest(px - bx);
                onSelect(selected === i ? null : i);
              });
            }}
            onResponderMove={(e) => onSelect(nearest(e.nativeEvent.pageX - left.current))}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={labels.current}
            style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}
          />
        </>
      ) : null}
    </View>
  );
}
