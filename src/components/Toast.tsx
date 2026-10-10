import { createContext, type PropsWithChildren, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Glass } from './Glass';
import { Icon, type IconName, Mark } from './Icon';
import { Text } from './Text';

type ToastOpts = { icon?: IconName; ai?: boolean; undo?: () => void; action?: { label: string; fn: () => void } };
type ToastFn = (msg: string, opts?: ToastOpts) => void;
const Ctx = createContext<ToastFn>(() => {});

export const useToast = () => useContext(Ctx);

/** Glass toast that springs up above the tab bar (design: .toast). Can carry Undo. */
export function ToastProvider({ children }: PropsWithChildren) {
  const { colors: c } = useSettings();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<({ text: string } & ToastOpts) | null>(null);
  const a = useState(() => new Animated.Value(0))[0];
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(a, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMsg(null));
  }, [a]);

  const show = useCallback<ToastFn>(
    (text, opts) => {
      setMsg({ text, ...opts });
      a.setValue(0);
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(hide, opts?.undo || opts?.action ? 5200 : 2600);
    },
    [a, hide],
  );

  const act = msg?.action ?? (msg?.undo ? { label: t('Undo'), fn: msg.undo } : null);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents={act ? 'box-none' : 'none'}
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
          <Glass ai={msg.ai} style={{ minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingStart: 14, paddingEnd: 8 }}>
            {msg.ai ? <Mark size={22} color={c.cobalt} stroke={4.5} /> : <Icon name={msg.icon ?? 'check'} size={20} color={c.cobalt} strokeWidth={2.2} />}
            <View style={{ flex: 1 }}>
              <Text weight={600} size={14.5}>
                {msg.text}
              </Text>
            </View>
            {act ? (
              <Pressable
                onPress={() => {
                  hide();
                  act.fn();
                }}
                hitSlop={8}
                style={{ height: 40, paddingHorizontal: 14, justifyContent: 'center' }}>
                <Text weight={700} size={14} color="link">
                  {act.label}
                </Text>
              </Pressable>
            ) : null}
          </Glass>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}
