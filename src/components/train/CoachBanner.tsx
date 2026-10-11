import { router } from 'expo-router';

import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Card, Springy } from '../ui';

/** "<Coach> manages your training" with Ask, when your coach's program is your plan (design: lockBanner). */
export function CoachBanner() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { coach } = useTrain();
  if (!coach) return null;
  const name = coach.name || t('Your coach');
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: c.gAi }}>
      <Icon name="lock" size={18} color={c.cobalt} />
      <Text variant="small" style={{ flex: 1 }}>
        {t('{n} manages your training.', { n: name })}
      </Text>
      {coach.link ? (
        <Springy onPress={() => router.push({ pathname: '/thread', params: { link: coach.link, name } })}>
          <Text variant="small" weight={700} color="link">
            {t('Ask')}
          </Text>
        </Springy>
      ) : null}
    </Card>
  );
}
