import { getLocales } from 'expo-localization';
import { type ErrorBoundaryProps, router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';

import { dark, light } from '@/theme/tokens';

/**
 * Shown instead of a white screen when something breaks. It works without the app's providers (they may be what
 * broke), so it picks the language and colors from the phone. No error details: those go to the log only.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const c = useColorScheme() === 'dark' ? dark : light;
  const ar = getLocales()[0]?.languageCode === 'ar';
  useEffect(() => {
    console.error(error);
  }, [error]);
  const home = () => {
    try {
      router.replace('/');
    } catch {
      retry();
    }
  };
  const button = (label: string, onPress: () => void, main: boolean) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ alignSelf: 'stretch', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: main ? c.cobalt : c.card, marginTop: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: main ? '#FFFFFF' : c.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text, textAlign: 'center' }}>{ar ? 'صار خطأ' : 'Something went wrong'}</Text>
      <Text style={{ fontSize: 15, color: c.sec, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
        {ar ? 'بياناتك محفوظة. جرّب مرة ثانية، أو ارجع للرئيسية.' : 'Your data is safe. Try again, or go back home.'}
      </Text>
      {button(ar ? 'حاول مرة ثانية' : 'Try again', () => void retry(), true)}
      {button(ar ? 'الرئيسية' : 'Go home', home, false)}
    </View>
  );
}
