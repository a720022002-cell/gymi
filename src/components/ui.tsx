import { type PropsWithChildren, type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useSettings } from '@/theme/settings';
import { radius, size } from '@/theme/tokens';

import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginStart', 'marginEnd', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'bottom', 'left', 'right', 'start', 'end'] as const;

/** Springy press feedback (design: transform .35s cubic-bezier(.34,1.45,.64,1)). */
export function Springy({
  children,
  scaleTo = 0.97,
  style,
  disabled,
  ...rest
}: PressableProps & { scaleTo?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const s = useState(() => new Animated.Value(1))[0];
  // Layout props must sit on the outer Pressable, or flex: 1 / margins don't apply.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const outer: ViewStyle = {};
  const inner: ViewStyle = { ...flat };
  for (const k of OUTER_KEYS) {
    if (k in inner) {
      (outer as Record<string, unknown>)[k] = (inner as Record<string, unknown>)[k];
      delete (inner as Record<string, unknown>)[k];
    }
  }
  if (outer.flex != null) inner.flex = 1;
  const to = (v: number) =>
    Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 10 }).start();
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      style={outer}
      {...rest}>
      <Animated.View style={[inner, { transform: [{ scale: s }] }, disabled && { opacity: 0.4 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'glass' | 'cobalt' | 'soft' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  small,
  icon,
  loading,
  disabled,
  style,
  color,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  small?: boolean;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const { colors: c } = useSettings();
  const h = small ? size.buttonSm : size.button;
  const bg =
    kind === 'primary' ? c.btn : kind === 'cobalt' ? c.cobalt : kind === 'danger' ? c.down : kind === 'soft' ? c.card : 'transparent';
  const fg = color ?? (kind === 'primary' ? c.btnText : kind === 'cobalt' || kind === 'danger' ? '#FFFFFF' : c.text);
  const base: ViewStyle = {
    height: h,
    borderRadius: h / 2,
    paddingHorizontal: small ? 14 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: small ? 'flex-start' : 'stretch',
  };
  const inner = (
    <>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 20} color={fg} strokeWidth={2.2} /> : null}
          <Text weight={700} size={small ? 14 : 16} color={fg} numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </>
  );
  return (
    <Springy
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={kind === 'glass' ? 1.04 : 0.97}
      style={[small ? { alignSelf: 'flex-start' } : null, style]}>
      {kind === 'glass' ? (
        <Glass style={[base, { borderRadius: h / 2 }]}>{inner}</Glass>
      ) : (
        <View style={[base, { backgroundColor: bg }]}>{inner}</View>
      )}
    </Springy>
  );
}

export function Card({
  children,
  style,
  onPress,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void }>) {
  const { colors: c } = useSettings();
  const s: ViewStyle = { backgroundColor: c.card, borderRadius: radius.card, padding: 18, marginBottom: 12 };
  if (onPress)
    return (
      <Springy onPress={onPress} scaleTo={0.985} style={[s, style]}>
        {children}
      </Springy>
    );
  return <View style={[s, style]}>{children}</View>;
}

export function Row({ children, style, gap = 12 }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; gap?: number }>) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Big tappable choice (design: .opt) with a round check on the end. */
export function Option({
  selected,
  onPress,
  icon,
  title,
  subtitle,
  big,
  disabled,
  right,
}: {
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  title: string;
  subtitle?: string;
  big?: boolean;
  disabled?: boolean;
  right?: ReactNode;
}) {
  const { colors: c } = useSettings();
  return (
    <Springy
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: c.card,
        borderRadius: radius.opt,
        paddingVertical: big ? 18 : 14,
        paddingHorizontal: big ? 18 : 16,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: selected ? c.cobalt : 'transparent',
      }}>
      {icon ? (
        <View
          style={{
            width: big ? 46 : 36,
            height: big ? 46 : 36,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected && big ? c.cobalt : c.inset,
          }}>
          <Icon name={icon} size={big ? 22 : 20} color={selected && big ? '#FFFFFF' : c.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={700} size={big ? 17 : 15}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="sec">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? c.cobalt : c.line,
            backgroundColor: selected ? c.cobalt : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {selected ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
      )}
    </Springy>
  );
}

/** Segmented control (design: .seg). Solid by default; glass when floating. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { colors: c } = useSettings();
  return (
    <View style={{ flexDirection: 'row', padding: 4, borderRadius: 24, gap: 2, backgroundColor: c.card }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Springy
            key={o.value}
            onPress={() => onChange(o.value)}
            scaleTo={1.04}
            accessibilityState={{ selected: on }}
            style={[
              { flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
              on && { backgroundColor: c.segOn, boxShadow: '0px 1px 4px rgba(0,0,0,0.08)' },
            ]}>
            <Text weight={700} size={14} color={on ? 'text' : 'sec'}>
              {o.label}
            </Text>
          </Springy>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  const { colors: c, isRTL } = useSettings();
  const x = useState(() => new Animated.Value(value ? 1 : 0))[0];
  useEffect(() => {
    Animated.spring(x, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 8 }).start();
  }, [value, x]);
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}>
      <View
        style={{
          width: 51,
          height: 31,
          borderRadius: 16,
          backgroundColor: value ? c.cobalt : c.track,
          justifyContent: 'center',
        }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 2,
            [isRTL ? 'right' : 'left']: 2,
            width: 27,
            height: 27,
            borderRadius: 14,
            backgroundColor: '#FFFFFF',
            boxShadow: '0px 2px 6px rgba(0,0,0,0.18)',
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, isRTL ? -20 : 20] }) }],
          }}
        />
      </View>
    </Pressable>
  );
}

export function ProgDots({ step, total = 3 }: { step: number; total?: number }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? c.cobalt : c.track }} />
      ))}
    </View>
  );
}

export function Label({ children, optional }: { children: string; optional?: string }) {
  return (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 6, marginHorizontal: 4 }}>
      {children}
      {optional ? <Text variant="small" weight={600} color="sec">{` ${optional}`}</Text> : null}
    </Text>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <Text size={12.5} weight={600} color="down" style={{ marginTop: 6, marginHorizontal: 4 }}>
      {children}
    </Text>
  );
}

/** Small round button for top bars (design: .nb glass). */
export function NavButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Springy onPress={onPress} scaleTo={1.08} accessibilityLabel={label}>
      <Glass style={{ width: size.touch, height: size.touch, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} />
      </Glass>
    </Springy>
  );
}

export function Chip({ title, on, onPress }: { title: string; on?: boolean; onPress?: () => void }) {
  const { colors: c } = useSettings();
  return (
    <Springy
      onPress={onPress}
      scaleTo={1.05}
      style={{
        minHeight: 38,
        paddingHorizontal: 15,
        borderRadius: 19,
        backgroundColor: on ? c.text : c.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text weight={600} size={14} color={on ? c.bg : c.text}>
        {title}
      </Text>
    </Springy>
  );
}
