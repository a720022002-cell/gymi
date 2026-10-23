import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { sessionText, sportIcon, startCardio } from '@/components/train/CardioPlan';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { clockText, movingMs, useCardioSession } from '@/lib/cardioSession';
import { sportInfo, type SportId } from '@/lib/sports';
import { useCardioWeek } from '@/lib/useCardioWeek';
import { useSettings } from '@/theme/settings';

/** Home: start cardio or a sport in one tap. A running session comes first, then today's planned one, else quick picks. */
export function CardioHomeCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useCardioSession();
  const cw = useCardioWeek();
  const live = !!s && !s.endedAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [live]);

  if (live && s) {
    return (
      <Card onPress={() => router.push('/cardio-live')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={sportInfo(s.sport).icon} size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {s.pausedAt ? t('Paused') : t('Running now')}
          </Text>
          <Text weight={700} numberOfLines={1}>
            {`${t(sportInfo(s.sport).name)} · ${clockText(movingMs(s, now))}`}
          </Text>
        </View>
        <Button small title={t('Open')} onPress={() => router.push('/cardio-live')} />
      </Card>
    );
  }

  const today = cw.today && !cw.todayDone ? cw.today : null;
  // Quick picks: the sports in your plan first, then the usual ones.
  const picks = [...new Set<SportId>([...(cw.sessions.map((x) => x.sport) as SportId[]), 'Run', 'Walk', 'Bike', 'Padel'])].slice(0, 4);
  return (
    <Card>
      <Row gap={12}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={today ? sportIcon(today.sport) : 'run'} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {today ? t(today.fixed ? 'Sport today' : 'Cardio today') : t('Cardio and sports')}
          </Text>
          <Text weight={700} numberOfLines={1}>
            {today ? sessionText(today, t) : t('Start a session')}
          </Text>
          {today ? null : (
            <Text variant="xs" color="sec" numberOfLines={2}>
              {t('Live heart rate, zones and coach tips as you move.')}
            </Text>
          )}
        </View>
        <Button small title={t('Start')} onPress={() => (today ? startCardio(today) : router.push('/cardio-live'))} />
      </Row>
      <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
        {picks.map((p) => (
          <Chip key={p} title={t(sportInfo(p).name)} onPress={() => router.push({ pathname: '/cardio-live', params: { sport: p } })} />
        ))}
      </Row>
    </Card>
  );
}
