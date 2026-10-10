import { Redirect } from 'expo-router';
import Tabs from 'expo-router/js-tabs';
import { useMemo, useState } from 'react';

import { TabChromeContext } from '@/components/Screen';
import { TabBar } from '@/components/TabBar';
import { profileComplete, useAuth } from '@/lib/auth';
import { useSettings } from '@/theme/settings';

export default function TabsLayout() {
  const { session, profile, loading, profileReady } = useAuth();
  const { colors } = useSettings();
  const [mini, setMini] = useState(false);
  const chrome = useMemo(() => ({ setMini }), []);

  if (!loading && !session) return <Redirect href="/welcome" />;
  if (session && profileReady && !profileComplete(profile)) return <Redirect href={{ pathname: '/signup', params: { step: 'about' } }} />;

  return (
    <TabChromeContext.Provider value={chrome}>
      <Tabs
        tabBar={(props) => <TabBar {...props} mini={mini} setMini={setMini} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
        screenListeners={{ focus: () => setMini(false) }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="food" />
        <Tabs.Screen name="train" />
        <Tabs.Screen name="progress" />
        <Tabs.Screen name="friends" />
        <Tabs.Screen name="cclients" />
        <Tabs.Screen name="cprog" />
        <Tabs.Screen name="cmsg" />
        <Tabs.Screen name="cme" />
      </Tabs>
    </TabChromeContext.Provider>
  );
}
