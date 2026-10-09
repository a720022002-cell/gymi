import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

/** AI coach chat. Placeholder until Phase 4 (Gemini via Supabase Edge Functions). */
export default function Coach() {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Screen title={t('AI coach')} back>
      <View style={{ alignItems: 'center', marginTop: 24 }}>
        <Glass ai style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Mark size={44} color={c.cobalt} stroke={8} />
        </Glass>
        <Text variant="h1" center style={{ marginTop: 20 }}>
          {t('Your AI coach is almost here')}
        </Text>
        <Text color="sec" center style={{ marginTop: 6, maxWidth: 320 }}>
          {t('Ask anything about food, training and health. Log meals and sleep just by chatting.')}
        </Text>
      </View>
      <View style={{ marginTop: 28, gap: 8 }}>
        <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: c.text, borderRadius: 22, borderBottomEndRadius: 8, paddingVertical: 11, paddingHorizontal: 15 }}>
          <Text color={c.bg}>{t('I ate chicken and rice')}</Text>
        </View>
        <View style={{ alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: c.card, borderRadius: 22, borderBottomStartRadius: 8, paddingVertical: 11, paddingHorizontal: 15 }}>
          <Text>{t('Logged: chicken and rice, about 650 kcal and 45 g protein.')}</Text>
        </View>
      </View>
      <Text variant="xs" color="sec" center style={{ marginTop: 16 }}>
        {t('Example only. The chat comes in a later update.')}
      </Text>
    </Screen>
  );
}
