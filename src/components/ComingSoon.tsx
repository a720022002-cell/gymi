import { View } from 'react-native';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from './Icon';
import { Ring } from './Ring';
import { Text } from './Text';
import { Card } from './ui';

/** Simple placeholder for parts of the app that come in later phases. */
export function ComingSoon({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 18 }}>
      <Ring value={0} max={1} size={120} stroke={12}>
        <Icon name={icon} size={30} color={c.sec} />
      </Ring>
      <Text variant="h2" center style={{ marginTop: 16 }}>
        {t(title)}
      </Text>
      <Text color="sec" center style={{ marginTop: 4 }}>
        {t(text)}
      </Text>
      <View style={{ marginTop: 14, backgroundColor: c.inset, borderRadius: 12, height: 24, paddingHorizontal: 9, justifyContent: 'center' }}>
        <Text variant="xs" weight={700} color="sec">
          {t('Coming soon')}
        </Text>
      </View>
    </Card>
  );
}
