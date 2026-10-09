import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Option } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type Lang, useSettings } from '@/theme/settings';

/** Choose English or Arabic. Arabic flips the whole layout right to left. */
export default function Language() {
  const { t } = useT();
  const { lang, setLang } = useSettings();
  const { session, updateProfile } = useAuth();
  const { pre } = useLocalSearchParams<{ pre?: string }>();
  const duringSignup = pre === '1';

  const choose = (l: Lang) => {
    setLang(l);
    if (session) updateProfile({ language: l });
  };

  return (
    <Screen title={t('Language')} back>
      <Text variant="h1">{t('Choose your language')}</Text>
      <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
        {t('You can change this any time in Settings.')}
      </Text>
      {(
        [
          ['en', 'English', 'English'],
          ['ar', 'العربية', 'Arabic'],
        ] as const
      ).map(([k, name, sub]) => (
        <Option key={k} icon="globe" title={name} subtitle={k === 'ar' ? t(sub) : sub} selected={lang === k} onPress={() => choose(k)} />
      ))}
      <View style={{ marginTop: 24 }}>
        <Button
          title={t(duringSignup ? 'Continue' : 'Done')}
          onPress={() => (duringSignup ? router.push('/account-type') : router.back())}
        />
      </View>
    </Screen>
  );
}
