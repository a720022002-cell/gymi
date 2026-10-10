import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { recLabel, recovery } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { droppingLifts, EX, weekStart } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Icon, Mark } from '../Icon';
import { Ring } from '../Ring';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row, Springy } from '../ui';

/** Everything the recovery score needs, from food and training. */
export function useRecovery() {
  const train = useTrain();
  const food = useFood();
  const { todayCheckin: ci } = useHealth();
  const input = {
    today: train.today,
    checkin: ci ? { day: ci.day, sleep: ci.sleep_h, sore: ci.sore, energy: ci.energy } : null,
    logs: train.logs,
    protein: food.setupDone ? { eaten: food.eaten.p, target: food.target.p } : null,
    water: { ml: food.water, goal: food.plan.water || 2800 },
  };
  return { input, r: recovery(input) };
}

/** Recovery score on Train home (design: recoveryCard). */
export function RecoveryCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { r } = useRecovery();
  const [label, tone] = recLabel(r.score);
  return (
    <Card onPress={() => router.push('/recovery')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ring value={r.score} max={100} size={56} stroke={6} color={r.score >= 60 ? c.cobalt : c.down}>
        <Text num size={15}>
          {r.score}
        </Text>
      </Ring>
      <View style={{ flex: 1 }}>
        <Text variant="xs" weight={700} color="sec">
          {t('Recovery')}
        </Text>
        <Text weight={700} color={tone === 'down' ? 'down' : 'text'}>
          {t(label)}
        </Text>
        <Text variant="small" color="sec">
          {t(r.checked ? 'Tap for tips to recover faster' : 'Tap to tell me how you feel today')}
        </Text>
      </View>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
}

/** "Time for a lighter week?" when lifts drop two sessions in a row; or the deload week banner. */
export function DeloadCard() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const p = train.plan;
  if (!p) return null;
  const week = weekStart(train.today);
  if (p.deload === week)
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="bolt" size={22} color={c.cobalt} />
        <Text variant="small" style={{ flex: 1 }}>
          <Text variant="small" weight={700}>
            {t('Deload week is on.')}
          </Text>{' '}
          {t('Weights are about 60% and one set less. Next week you go back to normal.')}
        </Text>
        <Springy
          onPress={() => {
            train.updatePlan({ deload: undefined });
            toast(t('Back to normal weights'), { icon: 'train' });
          }}>
          <Text variant="small" weight={700} color="link">
            {t('End')}
          </Text>
        </Springy>
      </Card>
    );
  if (p.deloadDismissed === week) return null;
  const drops = droppingLifts(train.logs);
  if (drops.length < 2) return null;
  const names = drops.slice(0, 2).map((id) => (EX[id] ? (lang === 'ar' ? EX[id].ar : EX[id].en) : (train.logs.flatMap((l) => l.exercises).find((x) => x.id === id)?.n ?? id)).toLowerCase());
  return (
    <Card>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Mark size={24} color={c.cobalt} stroke={5} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Time for a lighter week?')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Your {a} and {b} dropped two sessions in a row. A deload week lets your body catch up, then you come back stronger.', { a: names[0], b: names[1] })}
          </Text>
        </View>
      </Row>
      <Row gap={8} style={{ marginTop: 12 }}>
        <Button
          small
          title={t('Start deload week')}
          onPress={() => {
            train.updatePlan({ deload: week, deloadDismissed: week });
            toast(t('Deload week started'), { ai: true });
          }}
        />
        <Button small kind="soft" title={t('Not now')} onPress={() => train.updatePlan({ deloadDismissed: week })} />
      </Row>
    </Card>
  );
}
