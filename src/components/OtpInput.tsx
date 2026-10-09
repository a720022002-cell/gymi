import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Text } from './Text';

/**
 * 6-digit code box. One hidden input under six boxes, so iPhone
 * "From Messages / Mail" autofill and paste both work.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const { colors: c } = useSettings();
  const { t } = useT();
  const ref = useRef<TextInput>(null);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 350);
  }, [autoFocus]);

  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ marginTop: 16 }}>
      {/* Codes are always left to right, even in Arabic. */}
      <View style={{ flexDirection: 'row', gap: 8, direction: 'ltr' } as object}>
        {Array.from({ length: 6 }, (_, i) => {
          const active = focus && i === Math.min(value.length, 5);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 58,
                borderRadius: 14,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: error ? c.down : active ? c.cobalt : 'transparent',
              }}>
              <Text num size={26}>
                {value[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(raw) => {
          const v = raw
            .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/\D/g, '')
            .slice(0, 6);
          onChange(v);
          if (v.length === 6) {
            ref.current?.blur();
            onComplete?.(v);
          }
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        accessibilityLabel={t('6-digit code')}
        caretHidden
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 58, opacity: 0.011, fontSize: 16, color: 'transparent' }}
      />
    </Pressable>
  );
}
