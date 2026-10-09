import { forwardRef, type ReactNode, useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';
import { radius, size } from '@/theme/tokens';

import { Icon } from './Icon';
import { fontFor, Text } from './Text';
import { ErrorText, Label } from './ui';

type Props = TextInputProps & {
  label?: string;
  optional?: string;
  error?: string | null;
  /** Shown inside the field before the text (e.g. "@"). */
  prefix?: string;
  /** Shown inside the field after the text (e.g. "cm"). */
  unit?: string;
  /** Under the field, when there is no error. */
  hint?: ReactNode;
  /** Keep left-to-right even in Arabic (emails, phone numbers, numbers). */
  ltr?: boolean;
  /** Red border without a message (the hint explains the problem). */
  invalid?: boolean;
};

export const Field = forwardRef<TextInput, Props>(function Field(
  { label, optional, error, prefix, unit, hint, ltr, invalid, secureTextEntry, style, ...rest },
  ref,
) {
  const { colors: c, isRTL } = useSettings();
  const { t } = useT();
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const secret = !!secureTextEntry && !show;

  return (
    <View>
      {label ? <Label optional={optional}>{label}</Label> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: c.card,
          borderRadius: radius.field,
          height: size.field,
          paddingStart: 16,
          paddingEnd: secureTextEntry ? 4 : 16,
          borderWidth: 1.5,
          borderColor: error || invalid ? c.down : focus ? c.cobalt : 'transparent',
        }}>
        {prefix ? (
          <Text weight={700} size={16} color="sec">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.sec}
          secureTextEntry={secret}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              height: 48,
              fontSize: 16,
              color: c.text,
              fontFamily: fontFor(isRTL && !ltr ? 'arabic' : 'manrope', 500),
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: ltr ? 'ltr' : undefined,
              outlineStyle: 'none',
            } as object,
            style,
          ]}
          {...rest}
        />
        {unit ? (
          <Text weight={700} color="sec">
            {unit}
          </Text>
        ) : null}
        {secureTextEntry ? (
          <Pressable
            onPress={() => setShow((v) => !v)}
            accessibilityLabel={t(show ? 'Hide password' : 'Show password')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={show ? 'eyeoff' : 'eye'} size={20} color={c.sec} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : hint ? (
        <View style={{ marginTop: 6, marginHorizontal: 4 }}>
          {typeof hint === 'string' ? (
            <Text variant="xs" color="sec">
              {hint}
            </Text>
          ) : (
            hint
          )}
        </View>
      ) : null}
    </View>
  );
});

/** Password strength (design: pwScore/pwMeter). */
export function passwordScore(v: string) {
  let s = 0;
  if (v.length >= 8) s++;
  if (v.length >= 12) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return v ? Math.min(3, Math.ceil((s * 3) / 5)) : 0;
}

export function PasswordMeter({ value }: { value: string }) {
  const { colors: c } = useSettings();
  const { t } = useT();
  const sc = passwordScore(value);
  const col = [c.track, c.down, '#D97706', c.up][sc];
  const label = ['', t('Weak password'), t('Okay password'), t('Strong password')][sc];
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= sc ? col : c.track }} />
        ))}
      </View>
      <Text variant="xs" weight={700} color={sc ? col : 'sec'} style={{ marginTop: 4 }}>
        {value ? label : t('At least 8 characters, with a letter and a number')}
      </Text>
    </View>
  );
}
