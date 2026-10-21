import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { closeAiConsent, setAiConsent, useAiConsent } from '@/lib/aiConsent';
import { useSettings } from '@/theme/settings';

/** Asked once, before the first AI answer: what goes to the outside AI service and why. */
export function AiConsentSheet() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { asking } = useAiConsent();
  const line = (icon: 'sparkle' | 'lock' | 'gear', text: string) => (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
      <Icon name={icon} size={18} color={c.cobalt} />
      <Text variant="small" color="sec" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
  return (
    <Sheet open={asking} onClose={closeAiConsent}>
      <Text variant="h2">{t('Use AI features?')}</Text>
      {line('sparkle', t('To answer you, Adro sends what you ask (and any photo or text you add) to an outside AI service, OpenRouter and the AI models it uses, with what it needs from your Adro data: your goal, targets, allergies, recent food, workouts and readings.'))}
      {line('lock', t('They use it only to make the answer. Adro keeps your chat history, not your photos. Cycle data in private mode is never sent.'))}
      {line('gear', t('You can turn this off any time in You, then Privacy and data.'))}
      <Button title={t('Allow')} style={{ marginTop: 20, alignSelf: 'stretch' }} onPress={() => setAiConsent(true)} />
      <Button kind="ghost" title={t('Not now')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={closeAiConsent} />
    </Sheet>
  );
}
