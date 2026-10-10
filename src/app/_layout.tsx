import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Sora_500Medium } from '@expo-google-fonts/sora/500Medium';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BalanceSheet } from '@/components/food/BalanceSheet';
import { LogSheet } from '@/components/food/LogSheet';
import { CheckinSheet } from '@/components/health/CheckinSheet';
import { ReminderSync } from '@/components/ReminderSync';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/lib/auth';
import { FoodProvider } from '@/lib/food';
import { HealthProvider } from '@/lib/health';
import { TrainProvider } from '@/lib/train';
import { SignupDraftProvider } from '@/lib/signupDraft';
import { SettingsProvider, useSettings } from '@/theme/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  return (
    <SettingsProvider>
      <AuthProvider>
        <FoodProvider>
          <TrainProvider>
            <HealthProvider>
              <SignupDraftProvider>
                <ToastProvider>
                  <AppStack ready={fontsLoaded || !!fontError} />
                </ToastProvider>
              </SignupDraftProvider>
            </HealthProvider>
          </TrainProvider>
        </FoodProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

function AppStack({ ready }: { ready: boolean }) {
  const { colors, isDark, ready: settingsReady } = useSettings();
  const show = ready && settingsReady;

  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);

  if (!show) return null;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      </Stack>
      <LogSheet />
      <BalanceSheet />
      <CheckinSheet />
      <ReminderSync />
    </>
  );
}
