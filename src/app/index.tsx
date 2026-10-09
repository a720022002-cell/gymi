import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { Mark } from '@/components/Icon';
import { Text } from '@/components/Text';
import { profileComplete, useAuth } from '@/lib/auth';
import { useSettings } from '@/theme/settings';

/** Decides where to start: Welcome, finish sign-up, or Home. */
export default function Start() {
  const { configured, loading, session, profile, profileReady } = useAuth();
  const { colors } = useSettings();

  if (!configured) return <NotConfigured />;
  if (loading || !profileReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><Mark size={44} /></View>;
  }
  if (!session) return <Redirect href="/welcome" />;
  if (!profileComplete(profile)) return <Redirect href={{ pathname: '/signup', params: { step: 'about' } }} />;
  return <Redirect href="/home" />;
}

/** Shown only if the Supabase environment variables are missing from the build. */
function NotConfigured() {
  const { colors } = useSettings();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Mark size={44} />
      <Text variant="h2" center>
        Almost ready
      </Text>
      <Text color="sec" center>
        The app can&apos;t reach the database yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Vercel,
        then redeploy.
      </Text>
    </View>
  );
}
