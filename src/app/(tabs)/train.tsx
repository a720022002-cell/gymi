import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { CoachBanner } from '@/components/train/CoachBanner';
import { GroupWorkoutsCard } from '@/components/train/GroupWorkoutsCard';
import { DeloadCard, RecoveryCard } from '@/components/train/RecoveryCard';
import { TrainSetup } from '@/components/train/TrainSetup';
import { MissedCard, WorkoutCard } from '@/components/train/WorkoutCard';
import { PlanReviewCard } from '@/components/train/PlanReviewCard';
import { WorkoutBell } from '@/components/train/WorkoutBell';
import { Button, Card, Row, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { addDays, fmt } from '@/lib/nutrition';
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
  if (train.loadError)
    return (
      <Screen title={t('Train')} large tabs>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text variant="h3" center>
            {t('Can’t load your plan')}
          </Text>
          <Text color="sec" center style={{ marginTop: 6 }}>
            {t('You’re offline. Check your connection and try again.')}
          </Text>
          <Button title={t('Try again')} style={{ marginTop: 14, alignSelf: 'stretch' }} onPress={train.reload} />
        </Card>
      </Screen>
    );
  if (!train.setupDone || redo) return <TrainSetup inTab onDone={() => setRedo(false)} onCancel={redo ? () => setRedo(false) : undefined} />;

  return (
    <Screen
      title={t('Train')}
      large
      tabs
      right={
        <Row gap={8}>
          <WorkoutBell />
          <Springy onPress={() => router.push('/weekplan')} scaleTo={1.08} accessibilityLabel={t('Weekly plan')}>
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="cal" size={22} />
            </Glass>
          </Springy>
        </Row>
      }>
      <CoachBanner />
      <Card>
        <WeekStrip />
      </Card>
      <PlanReviewCard />
      <RecoveryCard />
      <MissedCard />
      <WorkoutCard />
      <GroupWorkoutsCard />
      <DeloadCard />
      <HomeModeCard />
      <PregnancyCard />

      <Section title={t('Plan')} />
      <List
        rows={[
          ['cal', t('Weekly plan'), train.plan!.type === 'order' ? t('{split}, next workout in order', { split: t(train.plan!.split) }) : t('{split}, {n} days a week', { split: t(train.plan!.split), n: train.plan!.week.filter((d) => d.w).length }), () => router.push('/weekplan')],
          ['friends', t('Train together'), t('One workout, the right sets for each person'), () => router.push('/together')],
        ]}
      />
      <Section title={t('Tools')} />
      <ToolsList />
      {train.coach ? null : <Button kind="ghost" title={t('Redo training setup')} style={{ marginTop: 8 }} onPress={() => setConfirm(true)} />}

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
        ['camera', t('Unknown machine?'), t('Take a photo and add it'), () => router.push('/machine')],
        ['walk', t('Cardio and steps'), t('{s} steps today', { s: fmt(food.steps) }) + (food.burned ? `${t(', ')}${t('{n} kcal burned today', { n: food.burned })}` : ''), () => router.push('/cardio')],
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
        const done = train.doneIdx.has(i);
        // A day off you set (a break) shows as off, not as a workout.
        const off = !done && !!train.plan?.skipped[addDays(train.today, i - train.todayIdx)];
        const w = off ? null : train.week[i]?.w;
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
              {w ? (w === 'Full body' ? t('Full') : t(w)) : t(off ? 'Day off' : 'Rest')}
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

/** Women only: pregnancy-safe workouts (the same switch as on the pregnancy page). */
function PregnancyCard() {
  const { t } = useT();
  const toast = useToast();
  const train = useTrain();
  const { profile } = useAuth();
  if (profile?.gender !== 'female') return null;
  return (
    <Card style={{ marginTop: 10 }}>
      <Row gap={12}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(236,72,153,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="heart" size={20} color="#EC4899" />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Adjust my workouts for pregnancy')}</Text>
          <Text variant="small" color="sec">
            {t('Lighter weights, safer exercises')}
          </Text>
        </View>
        <Toggle
          value={train.preg}
          label={t('Adjust my workouts for pregnancy')}
          onChange={async (v) => {
            const ok = await train.setPreg(v);
            toast(ok ? t(v ? 'Workouts will be adjusted for pregnancy' : 'Workouts back to normal') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          }}
        />
      </Row>
      {train.preg ? (
        <Text variant="xs" color="sec" style={{ marginTop: 10 }}>
          {t('No lying on your back or belly, no jumps or crunches, about 20% lighter, 3 sets at most. Check with your doctor what’s right for you.')}
        </Text>
      ) : null}
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
