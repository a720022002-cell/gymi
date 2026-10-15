import { Redirect } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Mark } from '@/components/Icon';
import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { profileComplete, useAuth } from '@/lib/auth';
import { useSettings } from '@/theme/settings';

/** Decides where to start: Welcome, finish sign-up, or Home. */
export default function Start() {
  const { configured, loading, session, profile, profileReady, profileError, refreshProfile } = useAuth();
  const { colors } = useSettings();
  const { t } = useT();
  const [trying, setTrying] = useState(false);

  if (!configured) return <NotConfigured />;
  // Signed in, but your profile couldn't load (no connection) and isn't on this phone yet.
  if (session && !profileReady && profileError)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Mark size={44} />
        <Text variant="h2" center>
          {t('Can’t connect')}
        </Text>
        <Text color="sec" center>
          {t('You’re offline. Check your connection and try again.')}
        </Text>
        <Button
          title={t('Try again')}
          loading={trying}
          style={{ alignSelf: 'stretch', marginTop: 8 }}
          onPress={async () => {
            setTrying(true);
            await refreshProfile();
            setTrying(false);
          }}
        />
      </View>
    );
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
