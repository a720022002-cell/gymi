import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

/** A link to a page that doesn't exist (an old or mistyped link). */
export default function NotFound() {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Screen title="" back>
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <Icon name="search" size={40} color={c.sec} />
        <Text variant="h2" center style={{ marginTop: 12 }}>
          {t('This page doesn’t exist')}
        </Text>
        <Text color="sec" center style={{ marginTop: 6 }}>
          {t('The link may be old or mistyped.')}
        </Text>
        <Button title={t('Go home')} style={{ marginTop: 20, alignSelf: 'stretch' }} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
