import { createContext, type PropsWithChildren, useCallback, useContext, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ToastFn = (msg: string, opts?: { icon?: IconName }) => void;
const Ctx = createContext<ToastFn>(() => {});

export const useToast = () => useContext(Ctx);

/** Glass toast that springs up above the tab bar (design: .toast). */
export function ToastProvider({ children }: PropsWithChildren) {
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; icon: IconName } | null>(null);
  const a = useState(() => new Animated.Value(0))[0];
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback<ToastFn>(
    (text, opts) => {
      setMsg({ text, icon: opts?.icon ?? 'check' });
      a.setValue(0);
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(a, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMsg(null));
      }, 2600);
    },
    [a],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            start: 14,
            end: 14,
            bottom: 104 + insets.bottom,
            opacity: a,
            transform: [
              { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}>
          <Glass style={{ minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 14 }}>
            <Icon name={msg.icon} size={20} color={c.cobalt} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text weight={600} size={14.5}>
                {msg.text}
              </Text>
            </View>
          </Glass>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}
