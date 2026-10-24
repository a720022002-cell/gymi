import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useHealth } from '@/lib/health';
import { shortDate } from '@/lib/progress';
import { recLabel } from '@/lib/recovery';
import { useSettings } from '@/theme/settings';

import { LineChart } from '../Charts';
import { Icon } from '../Icon';
import { Ring } from '../Ring';
import { Text } from '../Text';
import { useRecovery } from '../train/RecoveryCard';
import { Card } from '../ui';

/** Recovery score now and over time (design: progRecovery). Sleep has its own page. */
export function RecoveryTab() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const { r } = useRecovery();
  const [label, tone] = recLabel(r.score);
  const hist = health.checkins.filter((x) => x.score != null).slice(-30);

  return (
    <View>
      <Card onPress={() => router.push('/recovery')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ring value={r.score} max={100} size={84} stroke={9} color={r.score >= 60 ? c.cobalt : c.down}>
          <Text num size={22}>{`${r.score}`}</Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {t('Recovery today')}
          </Text>
          <Text variant="h3" color={tone === 'down' ? 'down' : tone === 'up' ? 'up' : 'text'}>
            {t(label)}
          </Text>
          <Text variant="small" color="sec">
            {t('Tap for what’s in your score and tips')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
      <Card>
        <Text weight={700}>{t('Recovery history')}</Text>
        {hist.length > 1 ? (
          <View style={{ marginTop: 8 }}>
            <LineChart values={hist.map((x) => x.score as number)} labels={hist.map((x, i) => (i === 0 || i === hist.length - 1 ? shortDate(x.day, lang) : ''))} goal={60} />
            <Text variant="xs" color="sec">
              {t('Dashed line: 60%, ready for a normal session')}
            </Text>
          </View>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t('Do your daily check-in to see your recovery over time.')}
          </Text>
        )}
      </Card>

    </View>
  );
}
