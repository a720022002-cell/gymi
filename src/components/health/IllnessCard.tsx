import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useCycleToday } from '@/lib/cyclePhase';
import { healthAlerts, useDevices } from '@/lib/devices';
import { localDay } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { useWatchPrefs } from '@/lib/watchPrefs';
import { useSettings } from '@/theme/settings';

const WHAT: Record<string, string> = { temp: 'Temperature up', resp: 'Breathing faster', rhr: 'Resting heart rate up', hrv: 'HRV down', spo2: 'Blood oxygen low' };

/**
 * Health alerts from the watch (lib/devices healthAlerts): getting sick, temperature, oxygen, a very high or raised
 * resting heart rate, low HRV, faster breathing, short sleep and a bedtime that moves a lot. Each against your own
 * usual and most only after a few nights, so one odd night doesn't raise one. The most important one leads; the others
 * are listed under it. Offers a lighter day (it only asks), can be closed for today, or turned off in Connections.
 * Not a diagnosis.
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
  const { watch } = useWatchPrefs(session?.user.id);
  // The luteal phase raises temperature and resting heart rate by themselves.
  const luteal = useCycleToday()?.phase === 'Luteal';
  // From the phone's health app, or a band or ring linked directly (its days are deleted when it's unlinked).
  const linked = dev.connected || !!dev.days.find((d) => d.day === today)?.wearable;
  const alerts = linked && watch.illness ? healthAlerts(dev.days, today, { luteal }) : [];
  if (!alerts.length || closed === today) return null;
  const [top, ...more] = alerts;
  const tone = (l: string) => (l === 'high' ? c.down : l === 'warn' ? '#F59E0B' : c.cobalt);
  const say = (a: (typeof alerts)[number]) => t(a.body, a.key === 'ill' ? { w: String(a.v.w).split(',').map((k) => t(WHAT[k])).join(t(', ')) } : a.v);
  const serious = alerts.some((a) => a.level !== 'info');
  const lighter = serious && !!train.plan && train.plan.light !== today && !train.todayLog;
  return (
    <Card style={{ borderWidth: 1, borderColor: top.level === 'info' ? c.line : tone(top.level) }}>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Icon name={top.level === 'info' ? 'info' : 'warn'} size={22} color={tone(top.level)} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t(top.title)}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {say(top)}
          </Text>
          {more.slice(0, 3).map((a) => (
            <Row key={a.key} gap={8} style={{ alignItems: 'flex-start', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: tone(a.level) }} />
              <View style={{ flex: 1 }}>
                <Text variant="small" weight={700}>
                  {t(a.title)}
                </Text>
                <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                  {say(a)}
                </Text>
              </View>
            </Row>
          ))}
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
            <Button small kind="glass" title={t(serious ? 'I feel fine' : 'Got it')} onPress={() => setClosed(today)} />
          </Row>
          <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
            {t('From your watch, compared with your usual. Not a diagnosis.')}
          </Text>
        </View>
      </Row>
    </Card>
  );
}
