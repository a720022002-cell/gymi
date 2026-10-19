import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { illnessCheck, useDevices } from '@/lib/devices';
import { localDay } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

const WHAT: Record<string, string> = { temp: 'Temperature up', resp: 'Breathing faster', rhr: 'Resting heart rate up', hrv: 'HRV down', spo2: 'Blood oxygen low' };

/**
 * Early warning: last night the watch saw two or more signs that often come before getting sick. Offers a rest day
 * (it only asks) and can be closed for today. Not a diagnosis.
 */
export function IllnessCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  const train = useTrain();
  const today = localDay();
  const [closed, setClosed] = useState<string | null>(null);
  const ill = dev.connected ? illnessCheck(dev.days, today) : null;
  if (!ill || closed === today) return null;
  const lighter = !!train.plan && train.plan.light !== today && !train.todayLog;
  return (
    <Card style={{ borderWidth: 1, borderColor: c.down }}>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Icon name="warn" size={22} color={c.down} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Your body may be fighting something')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Your watch saw this last night: {w}.', { w: ill.keys.map((k) => t(WHAT[k])).join(t(', ')) })}{' '}
            {t('Rest, drink water and sleep early. If you feel unwell, see a doctor.')}
          </Text>
          <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {lighter ? (
              <Button
                small
                title={t('Make today lighter')}
                onPress={() => {
                  train.updatePlan({ light: today, lightAsked: today });
                  toast(t('Lighter today: one set less and about 10% less weight.'), { ai: true });
                }}
              />
            ) : null}
            <Button small kind="glass" title={t('I feel fine')} onPress={() => setClosed(today)} />
          </Row>
        </View>
      </Row>
    </Card>
  );
}
