import { Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/theme/settings';

import { Icon } from './Icon';
import { Text } from './Text';
import { Button, Card } from './ui';

const SUPPORT = 'support@adroapp.com';

/** Shown instead of the app when the Adro team suspended your account. */
export function Suspended() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { profile, refreshProfile, logOut } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 20, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Icon name="lock" size={40} color={c.down} />
        <Text variant="h1" center style={{ marginTop: 12 }}>
          {t('Your account is suspended')}
        </Text>
        <Text color="sec" center style={{ marginTop: 8 }}>
          {t('The Adro team suspended your account because it broke our rules. While it’s suspended, you can’t use Adro and others can’t see you.')}
        </Text>
      </View>
      {profile?.suspend_reason ? (
        <Card>
          <Text variant="xs" weight={700} color="sec">
            {t('Reason')}
          </Text>
          <Text style={{ marginTop: 4 }}>{profile.suspend_reason}</Text>
        </Card>
      ) : null}
      <Text color="sec" center style={{ marginBottom: 16 }}>
        {t('Think this is a mistake? Email us at {e}.', { e: SUPPORT })}
      </Text>
      <Button icon="mail" title={t('Email support')} onPress={() => Linking.openURL(`mailto:${SUPPORT}`).catch(() => {})} />
      <Button kind="soft" title={t('Check again')} style={{ marginTop: 10 }} onPress={() => refreshProfile()} />
      <Button kind="ghost" icon="logout" title={t('Log out')} style={{ marginTop: 10 }} onPress={() => logOut()} />
    </View>
  );
}
