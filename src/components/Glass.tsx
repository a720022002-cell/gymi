import { BlurView } from 'expo-blur';
import { createContext, useContext } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useSettings } from '@/theme/settings';

type Props = ViewProps & {
  /** Cobalt-tinted glass for anything AI. */
  ai?: boolean;
  /** Thicker glass for bottom sheets. */
  sheet?: boolean;
};

/**
 * Liquid Glass, for controls that float on top (tab bar, AI button, top bar buttons,
 * sheets, toasts). Content cards stay solid. With Reduce Transparency on, glass turns solid.
 * Never put glass inside glass.
 */
const InsideGlass = createContext(false);

export function Glass(props: Props) {
  const nested = useContext(InsideGlass);
  const { ai, sheet, style, children, ...rest } = props;
  // Never glass on glass: inside another glass surface, render plain.
  if (nested)
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  return (
    <InsideGlass.Provider value>
      <GlassSurface {...props} />
    </InsideGlass.Provider>
  );
}

function GlassSurface({ ai, sheet, style, children, ...rest }: Props) {
  const { colors: c, reduceTransparency, isDark } = useSettings();

  if (reduceTransparency) {
    const solid: ViewStyle = {
      backgroundColor: sheet ? c.bg : c.card,
      borderColor: c.line,
      borderWidth: StyleSheet.hairlineWidth,
      boxShadow: c.gShadow,
    };
    return (
      <View style={[solid, style]} {...rest}>
        {children}
      </View>
    );
  }

  const tint = ai ? c.gAi : sheet ? c.gSheet : c.gBg;
  const border = ai ? c.gAiBorder : c.gBorder;
  const edge = `inset 0px 1px 0.5px ${c.gHi}, inset 0px -0.5px 0.5px ${c.gHi}, inset 0px 0px 16px ${c.gGlow}, ${c.gShadow}`;

  if (Platform.OS === 'web') {
    const web = {
      backgroundColor: tint,
      borderColor: border,
      borderWidth: 0.5,
      boxShadow: edge,
      backdropFilter: 'blur(20px) saturate(1.9)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.9)',
    } as ViewStyle;
    return (
      <View style={[web, style]} {...rest}>
        {children}
      </View>
    );
  }

  // iPhone and Android: real blur behind a tinted layer.
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <View style={[{ borderColor: border, borderWidth: 0.5, boxShadow: c.gShadow, overflow: 'hidden' }, style]} {...rest}>
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius }]}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      {children}
    </View>
  );
}
