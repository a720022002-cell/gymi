import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { TrainSetup } from '@/components/train/TrainSetup';
import { MissedCard, WorkoutCard } from '@/components/train/WorkoutCard';
import { Button, Card, Row, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useTrain } from '@/lib/train';
import { DAYS } from '@/lib/training';
import { useSettings } from '@/theme/settings';

export default function Train() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const train = useTrain();
  const [redo, setRedo] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!train.ready)
    return (
      <Screen title={t('Train')} large tabs>
        <ActivityIndicator color={c.cobalt} style={{ marginTop: 40 }} />
      </Screen>
    );
  if (!train.setupDone || redo) return <TrainSetup inTab onDone={() => setRedo(false)} onCancel={redo ? () => setRedo(false) : undefined} />;

  return (
    <Screen
      title={t('Train')}
      large
      tabs
      right={
        <Springy onPress={() => router.push('/weekplan')} scaleTo={1.08} accessibilityLabel={t('Weekly plan')}>
          <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="cal" size={22} />
          </Glass>
        </Springy>
      }>
      <Card>
        <WeekStrip />
      </Card>
      <MissedCard />
      <WorkoutCard />
      <HomeModeCard />

      <Section title={t('Plan')} />
      <List
        rows={[
          ['cal', t('Weekly plan'), t('{split}, {n} days a week', { split: t(train.plan!.split), n: train.plan!.week.filter((d) => d.w).length }), () => router.push('/weekplan')],
        ]}
      />
      <Section title={t('Tools')} />
      <ToolsList />
      <Button kind="ghost" title={t('Redo training setup')} style={{ marginTop: 8 }} onPress={() => setConfirm(true)} />

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <View style={{ alignItems: 'center' }}>
          <Icon name="warn" size={30} color={c.down} />
        </View>
        <Text variant="h2" center style={{ marginTop: 8 }}>
          {t('Redo training setup?')}
        </Text>
        <Text color="sec" center style={{ marginTop: 6 }}>
          {t('Your current plan ({split}) will be replaced. Your workout history and records stay.', { split: t(train.plan!.split) })}
        </Text>
        <Button
          kind="danger"
          title={t('Yes, redo setup')}
          style={{ marginTop: 16 }}
          onPress={() => {
            setConfirm(false);
            setRedo(true);
          }}
        />
        <Button kind="glass" title={t('Keep my plan')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}

function ToolsList() {
  const { t } = useT();
  const food = useFood();
  return (
    <List
      rows={[
        ['book', t('Exercise library'), t('Filter by equipment and muscle'), () => router.push('/library')],
        ['walk', t('Cardio'), food.burned ? t('{n} kcal burned today', { n: food.burned }) : t('Walk, run, bike or swim'), () => router.push('/cardio')],
      ]}
    />
  );
}

/** The week at a glance (design: weekStrip). */
function WeekStrip() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const train = useTrain();
  return (
    <Row gap={4} style={{ justifyContent: 'space-between' }}>
      {DAYS.map((d, i) => {
        const w = train.week[i]?.w;
        const done = train.doneIdx.has(i);
        const isT = i === train.todayIdx;
        return (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="xs" weight={700} color="sec">
              {t(d)}
            </Text>
            <View style={{ marginTop: 6, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isT ? c.text : w ? c.inset : 'transparent' }}>
              {done ? (
                <Icon name="check" size={18} color={isT ? c.bg : c.cobalt} strokeWidth={2.6} />
              ) : w ? (
                <Text num size={12} color={isT ? c.bg : c.text}>
                  {t(w).slice(0, 1)}
                </Text>
              ) : null}
            </View>
            <Text variant="xs" color="sec" numberOfLines={1} style={{ marginTop: 4, height: 16 }}>
              {w ? (w === 'Full body' ? t('Full') : t(w)) : t('Rest')}
            </Text>
          </View>
        );
      })}
    </Row>
  );
}

function HomeModeCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const on = !!train.plan?.homeMode;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plane" size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{t('Home or travel mode')}</Text>
        <Text variant="small" color="sec">
          {t('No equipment. Bodyweight only.')}
        </Text>
      </View>
      <Toggle
        value={on}
        label={t('Home or travel mode')}
        onChange={(v) => {
          train.updatePlan({ homeMode: v, homeDay: undefined });
          toast(t(v ? 'Workouts are now no-equipment' : 'Back to your gym plan'), { icon: v ? 'home' : 'train' });
        }}
      />
    </Card>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
      {title}
    </Text>
  );
}

function List({ rows }: { rows: [IconName, string, string, () => void][] }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
      {rows.map(([icon, title, sub, fn], i) => (
        <Springy key={title} onPress={fn} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{title}</Text>
            <Text variant="small" color="sec" numberOfLines={1}>
              {sub}
            </Text>
          </View>
          <Icon name="chev" size={18} color={c.sec} />
        </Springy>
      ))}
    </View>
  );
}
