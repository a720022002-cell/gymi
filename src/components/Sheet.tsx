import { type PropsWithChildren, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/theme/settings';
import { useT } from '@/i18n';
import { useKeyboardHeight } from '@/lib/useKeyboard';

import { Glass } from './Glass';

/** Glass bottom sheet that springs up (design: .sheet). Tap outside to close. */
export function Sheet({ open, onClose, children }: PropsWithChildren<{ open: boolean; onClose: () => void }>) {
  const { colors: c } = useSettings();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  // With the keyboard open the sheet sits right above it and shrinks to the space left, so the field you type in and
  // the buttons stay visible.
  const kb = useKeyboardHeight();
  const { height: winH } = useWindowDimensions();
  const a = useState(() => new Animated.Value(0))[0];
  const [mounted, setMounted] = useState(open);
  // Mount as soon as it opens; unmount after the closing animation.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }).start();
    } else {
      Animated.timing(a, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [open, a]);

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: a }}>
        <Pressable style={{ flex: 1, backgroundColor: c.scrim }} onPress={onClose} accessibilityLabel={t('Close')} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          start: 8,
          end: 8,
          bottom: kb ? kb + 8 : 8 + insets.bottom,
          maxHeight: kb ? winH - kb - insets.top - 24 : '85%',
          transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }) }],
        }}>
        <Glass sheet style={{ borderRadius: 40, overflow: 'hidden', flexShrink: 1 }}>
          <View style={{ height: 30, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.sec, opacity: 0.45 }} />
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Glass>
      </Animated.View>
    </Modal>
  );
}
