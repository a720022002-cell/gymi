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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ErrorBoundaryProps, router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { keysReady } from '@/lib/renameKeys';
// Defines the background health sync first thing, so it also exists when the phone starts Adro in the background.
import '@/lib/backgroundSync';
// The live cardio session's GPS task, defined first too (the phone hands it locations while the screen is locked).
import '@/lib/cardioGps';
import { CardioLive } from '@/components/CardioLive';
import { ErrorScreen } from '@/components/ErrorScreen';
import { BalanceSheet } from '@/components/food/BalanceSheet';
import { CaffeineSheet } from '@/components/food/CaffeineSheet';
import { LogSheet } from '@/components/food/LogSheet';
import { RingClosed } from '@/components/food/RingClosed';
import { MilestoneUnlocked } from '@/components/streak/MilestoneUnlocked';
import { STREAK_PAGE } from '@/lib/config';
import { CheckinSheet } from '@/components/health/CheckinSheet';
import { FriendAlerts } from '@/components/FriendAlerts';
import { NotifyBanner } from '@/components/NotifyBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PushSync } from '@/components/PushSync';
import { ReferralClaim } from '@/components/ReferralClaim';
import { ReminderSync } from '@/components/ReminderSync';
import { Suspended } from '@/components/Suspended';
import { ToastProvider } from '@/components/Toast';
import { AiConsentSheet } from '@/components/ai/AiConsentSheet';
import { TourOverlay } from '@/components/tour/Tour';
import { UpdateBanner } from '@/components/UpdateBanner';
import { WorkoutLive } from '@/components/WorkoutLive';
import { AuthProvider, useAuth } from '@/lib/auth';
import { FoodProvider } from '@/lib/food';
import { HealthProvider } from '@/lib/health';
import { installLatinDigits } from '@/lib/latinDigits';
import { TrainProvider } from '@/lib/train';
import { SignupDraftProvider } from '@/lib/signupDraft';
import { RESUME_KEY, SettingsProvider, useSettings } from '@/theme/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});
installLatinDigits();

/** Something broke on a screen: a friendly page with Try again, instead of a white screen. */
export function ErrorBoundary(p: ErrorBoundaryProps) {
  return <ErrorScreen {...p} />;
}

export default function RootLayout() {
  // Saved data moved from the old "gymi." keys first (phones only; the splash screen stays up until then).
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    keysReady.then(() => setMoved(true));
  }, []);
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

  if (!moved) return null;
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

/** Screens you can open without being logged in (i = an invite link). Everything else sends you to Welcome. */
const PUBLIC = ['welcome', 'login', 'signup', 'language', 'account-type', 'reset-password', 'legal', '+not-found', 'i'];

function AppStack({ ready }: { ready: boolean }) {
  const { colors, isDark, ready: settingsReady, langChosen, setLang } = useSettings();
  const { configured, loading, session, profile, refreshProfile } = useAuth();
  const show = ready && settingsReady;
  const nav = useRootNavigationState();
  const navReady = !!nav?.key;
  const segments = useSegments() as string[];

  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);

  // Logged out (or never logged in) on a signed-in screen: go to Welcome, closing what's open.
  const first = segments[0];
  useEffect(() => {
    if (!navReady || !configured || loading || session || !first || PUBLIC.includes(first)) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace('/welcome');
  }, [navReady, configured, loading, session, first]);

  // Back from the restart Arabic needs: reopen the screen you were on (sign-up's language step).
  // Waits until a first screen is showing (Start's own redirect to Welcome must not replace it).
  const started = navReady && !!first;
  useEffect(() => {
    if (!started) return;
    AsyncStorage.getItem(RESUME_KEY)
      .then((r) => {
        if (!r) return;
        AsyncStorage.removeItem(RESUME_KEY).catch(() => {});
        if (r.startsWith('/')) router.push(r as never);
      })
      .catch(() => {});
  }, [started]);

  // Back in the app: check the account again now and then (so a suspension shows without restarting).
  useEffect(() => {
    if (!session) return;
    let last = Date.now();
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' || Date.now() - last < 10 * 60 * 1000) return;
      last = Date.now();
      refreshProfile().catch(() => {});
    });
    return () => sub.remove();
  }, [session, refreshProfile]);

  // Language saved in your account, on a phone where it wasn't chosen yet: use it.
  useEffect(() => {
    if (!settingsReady || langChosen || !profile?.language) return;
    setLang(profile.language);
  }, [settingsReady, langChosen, profile?.language, setLang]);

  if (!show) return null;
  // Suspended by the Adro team: only the "Your account is suspended" page (support and Log out).
  if (session && profile?.suspended_at)
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Suspended />
      </>
    );
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
      <AiConsentSheet />
      <LogSheet />
      <BalanceSheet />
      <CaffeineSheet />
      <RingClosed />
      {STREAK_PAGE ? <MilestoneUnlocked /> : null}
      <CheckinSheet />
      <ReminderSync />
      <PushSync />
      <WorkoutLive />
      <CardioLive />
      <ReferralClaim />
      <FriendAlerts />
      <OfflineBanner />
      <UpdateBanner />
      <NotifyBanner />
      <TourOverlay />
    </>
  );
}
