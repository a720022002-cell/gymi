import { useState } from 'react';
import { View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Icon, type IconName } from '@/components/Icon';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { useToday } from '@/components/train/WorkoutCard';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useHealth } from '@/lib/health';
import { muscleReady, recLabel, recovery, recTips } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { muscleLabel, MUSCLES } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** Recovery score, what's in it, muscle readiness and tips (design: recovery). */
export default function RecoveryScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const today = useToday();
  const { input, r } = useRecovery();
  const health = useHealth();
  const ci = health.todayCheckin;
  const [sleep, setSleep] = useState(ci?.sleep_h ?? 7);
  const [sore, setSore] = useState<number | null>(ci?.sore ?? null);
  const [energy, setEnergy] = useState<number | null>(ci?.energy ?? null);
  const [label, tone] = recLabel(r.score);
  const ready = muscleReady(train.logs, train.today);
  const tips = recTips(r, input);
  const canLighten = !!today.name && !today.done && !today.light && !today.deload && r.score < 60;

  const save = () => {
    if (sore === null || energy === null) return;
    const score = recovery({ ...input, checkin: { day: train.today, sleep, sore, energy } }).score;
    health.saveCheckin({ sleep_h: sleep, sore, energy, score });
    toast(t('Saved. Your score is updated.'), { icon: 'check' });
  };

  const head = (s: string) => (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
      {s}
    </Text>
  );

  return (
    <Screen title={t('Recovery')} back>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Ring value={r.score} max={100} size={160} stroke={15} color={r.score >= 60 ? c.cobalt : c.down}>
          <Text num size={40}>{`${r.score}%`}</Text>
          <Text variant="xs" weight={700} color="sec">
            {t('recovered')}
          </Text>
        </Ring>
        <Text variant="h2" color={tone === 'down' ? 'down' : tone === 'up' ? 'up' : 'text'} style={{ marginTop: 12 }}>
          {t(label)}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('Based on your sleep, soreness, energy, training load and food.')}
        </Text>
      </Card>
      {canLighten ? (
        <Button
          kind="soft"
          icon="bolt"
          title={t('Make today’s workout lighter')}
          onPress={() => {
            train.updatePlan({ light: train.today });
            toast(t('Lighter today: one set less and about 10% less weight.'), { ai: true });
          }}
        />
      ) : null}

      {head(t('How do you feel today?'))}
      <Card>
        <Text weight={700}>{t('Sleep last night')}</Text>
        <View style={{ marginTop: 8 }}>
          <Stepper onMinus={() => setSleep(Math.max(0, sleep - 0.5))} onPlus={() => setSleep(Math.min(14, sleep + 0.5))} bg={c.inset} labels={[t('Less'), t('More')]}>
            <Text num size={28} style={{ width: 90, textAlign: 'center' }}>{`${sleep} ${t('h')}`}</Text>
          </Stepper>
        </View>
        <Text weight={700} style={{ marginTop: 14 }}>
          {t('Sore muscles?')}
        </Text>
        <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {['None', 'A little', 'Very sore'].map((x, i) => (
            <Chip key={x} title={t(x)} on={sore === i} onPress={() => setSore(i)} />
          ))}
        </Row>
        <Text weight={700} style={{ marginTop: 14 }}>
          {t('Energy')}
        </Text>
        <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {['Tired', 'Normal', 'Great'].map((x, i) => (
            <Chip key={x} title={t(x)} on={energy === i} onPress={() => setEnergy(i)} />
          ))}
        </Row>
        <Button title={t(ci ? 'Update' : 'Save')} disabled={sore === null || energy === null} style={{ marginTop: 16 }} onPress={save} />
      </Card>

      {head(t('What’s in your score'))}
      <Card>
        {r.parts.map((p) => (
          <View key={p.key} style={{ marginTop: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <Icon name={p.icon as IconName} size={16} color={c.cobalt} />
                <Text variant="small" weight={700}>
                  {t(p.key)}
                </Text>
              </Row>
              <Text variant="small" weight={700} num>
                {p.value}
              </Text>
            </Row>
            <View style={{ marginTop: 4 }}>
              <Bar value={p.value} max={100} color={p.value >= 75 ? c.up : p.value >= 50 ? c.cobalt : c.down} />
            </View>
            <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
              {p.sub ? t(p.sub.t, p.sub as unknown as Record<string, string | number>) : t('Answer the questions above')}
            </Text>
          </View>
        ))}
      </Card>

      {head(t('Muscles ready to train'))}
      <Card>
        {MUSCLES.map((m) => (
          <View key={m} style={{ marginTop: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" weight={700}>
                {muscleLabel(m, lang, t)}
              </Text>
              <Text variant="small" num color={ready[m] < 60 ? 'down' : 'sec'}>{`${ready[m]}%`}</Text>
            </Row>
            <View style={{ marginTop: 4 }}>
              <Bar value={ready[m]} max={100} color={ready[m] >= 85 ? c.up : ready[m] >= 60 ? c.cobalt : c.down} />
            </View>
          </View>
        ))}
      </Card>

      {head(t('Recover faster'))}
      {tips.map((x) => (
        <Card key={x.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Icon name={x.icon as IconName} size={20} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t(x.title)}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 2 }}>
              {t(x.body, x.vars)}
            </Text>
          </View>
        </Card>
      ))}
      <Text variant="xs" color="sec" center style={{ marginTop: 4 }}>
        {t('Heart data from a watch will make this more accurate when devices are added.')}
      </Text>
    </Screen>
  );
}
