import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Option } from '@/components/ui';
import { useT } from '@/i18n';
import { useSignupDraft } from '@/lib/signupDraft';

export default function AccountType() {
  const { t } = useT();
  const { accountType, setAccountType } = useSignupDraft();

  return (
    <Screen title={t('Create account')} back>
      <Text variant="h1">{t('How will you use Gymi?')}</Text>
      <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
        {t('You can add the other one later.')}
      </Text>
      <Option
        big
        icon="train"
        title={t('I’m training')}
        subtitle={t('Track food, workouts and health with an AI coach. Join your coach with a code.')}
        selected={accountType === 'member'}
        onPress={() => setAccountType('member')}
      />
      <Option
        big
        icon="coach"
        title={t('Apply as a coach')}
        subtitle={t('Send an application. Our team reviews it, usually within 2 days. Then you can take clients.')}
        selected={accountType === 'coach'}
        onPress={() => setAccountType('coach')}
      />
      <View style={{ marginTop: 24 }}>
        <Button title={t('Next')} disabled={!accountType} onPress={() => router.push('/signup')} />
      </View>
    </Screen>
  );
}
