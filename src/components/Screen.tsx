import type React from 'react';
import { router } from 'expo-router';
import { createContext, type PropsWithChildren, type ReactNode, useContext, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Text } from './Text';
import { NavButton } from './ui';

/** Lets screens tell the tab bar to shrink while scrolling down (design: .tabbar.mini). */
export const TabChromeContext = createContext<{ setMini: (v: boolean) => void }>({ setMini: () => {} });

type Props = PropsWithChildren<{
  title?: string;
  /** Big title at the top that moves into the bar when you scroll (iOS style). */
  large?: boolean;
  /** Shown above the large title (e.g. the greeting on Home). */
  pre?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  /** Extra space at the bottom for the floating tab bar. */
  tabs?: boolean;
  /** No top bar at all (Welcome). */
  bare?: boolean;
  /** To scroll from outside (e.g. to the newest chat message). */
  scrollRef?: React.Ref<ScrollView>;
}>;

export function Screen({ title, large, pre, back, onBack, right, tabs, bare, scrollRef, children }: Props) {
  const { colors: c } = useSettings();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const st = Math.max(10, insets.top);
  const { setMini } = useContext(TabChromeContext);
  const [scrolled, setScrolled] = useState(false);
  const last = useRef(0);
  const fade = useState(() => new Animated.Value(0))[0];

  const onScroll = (y: number) => {
    const s = y > 24;
    if (s !== scrolled) {
      setScrolled(s);
      Animated.timing(fade, { toValue: s ? 1 : 0, duration: 250, useNativeDriver: true }).start();
    }
    if (tabs) {
      if (y > last.current + 6 && y > 60) setMini(true);
      else if (y < last.current - 6 || y < 20) setMini(false);
    }
    last.current = y;
  };

  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const titleOpacity = large ? fade : 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: bare ? 0 : st + 60,
            paddingBottom: bare ? 0 : (tabs ? 140 : 40) + insets.bottom,
            paddingHorizontal: bare ? 0 : 20,
          }}>
          {large && !bare ? (
            <View>
              {pre}
              <Text variant="lt" style={{ marginTop: 2, marginBottom: 18 }} accessibilityRole="header">
                {title}
              </Text>
            </View>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>

      {!bare ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, start: 0, end: 0, paddingTop: st + 2, paddingHorizontal: 12 }}>
          {/* Soft fade behind the bar once content scrolls under it. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              start: 0,
              end: 0,
              height: st + 30,
              backgroundColor: c.bg,
              opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
            }}
          />
          <Bar scrolled={scrolled}>
            <View style={{ minWidth: 44, flexDirection: 'row' }}>
              {back ? <NavButton icon="back" onPress={goBack} label={t('Back')} /> : null}
            </View>
            <Animated.View style={{ flex: 1, opacity: titleOpacity }}>
              <Text variant="h3" size={16} center numberOfLines={1}>
                {title}
              </Text>
            </Animated.View>
            <View style={{ minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end' }}>{right}</View>
          </Bar>
        </View>
      ) : null}
    </View>
  );
}

function Bar({ scrolled, children }: PropsWithChildren<{ scrolled: boolean }>) {
  const style = { height: 52, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, borderRadius: 26, paddingHorizontal: 4 };
  // Design: the bar itself turns to glass once scrolled; its buttons lose their own glass.
  return scrolled ? <Glass style={style}>{children}</Glass> : <View style={style}>{children}</View>;
}
