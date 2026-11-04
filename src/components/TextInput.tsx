import { forwardRef } from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

const NUMERIC = new Set(['numeric', 'decimal-pad', 'number-pad', 'phone-pad']);

/** Arabic-Indic (٠١٢…) and Persian (۰۱۲…) digits as 0–9. In a number field the Arabic decimal mark (٫) and a comma
 * become "." and the Arabic thousands mark (٬) goes. */
export function toLatinDigits(s: string, num = false): string {
  let out = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
  if (num) out = out.replace(/[٫,]/g, '.').replace(/٬/g, '');
  return out;
}

/** The app's text box: React Native's, with numbers always typed as 0–9 (an Arabic keyboard gives ٠–٩). */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  const { onChangeText, keyboardType, inputMode } = props;
  const num = NUMERIC.has(keyboardType ?? '') || inputMode === 'numeric' || inputMode === 'decimal' || inputMode === 'tel';
  return <RNTextInput ref={ref} {...props} onChangeText={onChangeText ? (v) => onChangeText(toLatinDigits(v, num)) : undefined} />;
});
// Lets `useRef<TextInput>(null)` keep working in the files that import this one.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TextInput = RNTextInput;
