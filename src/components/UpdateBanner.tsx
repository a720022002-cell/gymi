import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Icon } from './Icon';
import { Text } from './Text';

const ENTRY = /\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js/;

/** The app file this page is running. */
const running = () => (Platform.OS === 'web' && typeof document !== 'undefined' ? (Array.from(document.scripts).map((s) => s.src.match(ENTRY)?.[0]).find(Boolean) ?? null) : null);

/** On the web, a phone keeps the app open for days. When a newer version is online, offer to load it (the workout in progress is saved and comes back). */
export function UpdateBanner() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const mine = running();
    if (!mine) return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const html = await (await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })).text();
        const live = html.match(ENTRY)?.[0];
        if (live && live !== mine) setReady(true);
      } catch {
        // Offline: try again next time.
      }
    };
    check();
    document.addEventListener('visibilitychange', check);
    const id = setInterval(check, 10 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
    };
  }, []);

  if (!ready || hidden) return null;
  return (
    <View style={{ position: 'absolute', top: Math.max(8, insets.top) + 4, start: 8, end: 8, zIndex: 998 }}>
      <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.cobalt, borderRadius: 18, paddingVertical: 8, paddingStart: 14, paddingEnd: 6 }}>
        <Icon name="sparkle" size={20} color="#FFFFFF" strokeWidth={2} />
        <Text variant="small" weight={600} color="#FFFFFF" style={{ flex: 1 }}>
          {t('A new version of Adro is ready.')}
        </Text>
        <Pressable onPress={() => window.location.reload()} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="small" weight={700} style={{ color: c.cobalt }}>
            {t('Update')}
          </Text>
        </Pressable>
        <Pressable onPress={() => setHidden(true)} accessibilityLabel={t('Dismiss')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={16} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}
