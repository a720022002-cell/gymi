import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useSettings } from '@/theme/settings';
import { type ColorTokens, fonts, type Weight, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

type Props = TextProps & {
  variant?: Variant;
  weight?: Weight;
  /** Color token name, or any CSS color. */
  color?: keyof ColorTokens | (string & {});
  /** Big numbers: Sora with tabular figures, even in Arabic. */
  num?: boolean;
  center?: boolean;
  size?: number;
};

const HEADINGS: Variant[] = ['lt', 'h1', 'h2', 'h3'];

/** Pick the font file for a weight. Fonts are registered per weight, so no fontWeight is set. */
export function fontFor(kind: 'sora' | 'manrope' | 'arabic', weight: Weight) {
  if (kind === 'sora') return fonts.sora[weight <= 500 ? 500 : weight >= 700 ? 700 : 600];
  if (kind === 'arabic') return fonts.arabic[(weight >= 700 ? 700 : weight) as 400 | 500 | 600 | 700];
  return fonts.manrope[weight];
}

export function Text({
  variant = 'body',
  weight,
  color = 'text',
  num,
  center,
  size,
  style,
  ...rest
}: Props) {
  const { colors, isRTL } = useSettings();
  const heading = HEADINGS.includes(variant);
  const w: Weight = weight ?? (heading || num ? 600 : 400);
  const kind = num ? 'sora' : isRTL ? 'arabic' : heading ? 'sora' : 'manrope';
  const scale = typeScale[variant];
  const resolved = (colors as Record<string, string>)[color] ?? color;

  const s: TextStyle = {
    ...scale,
    fontFamily: fontFor(kind, w),
    color: resolved,
    ...(isRTL && !num ? { letterSpacing: 0 } : null),
    ...(num ? { fontVariant: ['tabular-nums'] } : null),
    // Align by the app language, not by the text's own script (browsers guess per line).
    textAlign: center ? 'center' : isRTL ? 'right' : 'left',
    ...(size ? { fontSize: size, lineHeight: Math.round(size * (heading || num ? 1.15 : 1.45)) } : null),
  };
  // Arabic letters are taller; give them a bit more line height.
  if (isRTL && !num && s.lineHeight) s.lineHeight = Math.round((s.fontSize ?? 15) * 1.6);

  return <RNText style={[s, style]} {...rest} />;
}
