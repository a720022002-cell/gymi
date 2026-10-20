import Svg, { Circle, Path } from 'react-native-svg';

import { useSettings } from '@/theme/settings';

import { WORDMARK } from './wordmark';

/** The adro wordmark: "adr" + the open ring as the o (design: docs/brand). Same in Arabic and English. */
export function Logo({ height = 30, color, ring }: { height?: number; color?: string; ring?: string }) {
  const { colors: c } = useSettings();
  const size = height * 1.28;
  const { cx, cy, r, stroke } = WORDMARK.ring;
  const C = 2 * Math.PI * r;
  return (
    <Svg width={size * WORDMARK.w} height={size * WORDMARK.h} viewBox={WORDMARK.viewBox} accessibilityRole="image" accessibilityLabel="adro">
      <Path d={WORDMARK.letters} fill={color ?? c.text} />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={ring ?? c.cobalt}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${C * 0.8} ${C}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}
