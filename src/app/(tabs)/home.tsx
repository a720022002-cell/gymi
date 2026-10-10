import { router } from 'expo-router';
import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { MacroBars } from '@/components/food/MacroBars';
import { MissedCard, WorkoutCard } from '@/components/train/WorkoutCard';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { useStreaks } from '@/lib/useProgress';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const food = useFood();
  const health = useHealth();
  const toast = useToast();
  const soon = () => toast(t('Coming soon'), { icon: 'clock' });

  const name = profile?.name || profile?.username || '';
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());

  return (
    <Screen
      title={date}
      large
      tabs
      pre={
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <Text weight={700} color="sec">
            {t(greeting())}
            {name ? `, ${name}` : ''}
          </Text>
        </Row>
      }
      right={
        <Springy onPress={() => router.push('/you')} scaleTo={1.08} accessibilityLabel={t('Profile and settings')}>
          <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h3" size={16}>
              {(name[0] ?? '?').toUpperCase()}
            </Text>
          </Glass>
        </Springy>
      }>
      {health.ready && !health.todayCheckin ? <CheckinCard onStart={() => health.setCheckinOpen(true)} /> : null}
      {profile?.account_type === 'coach' && profile.coach_status === 'pending' ? <CoachPendingCard /> : null}
      {food.setupDone ? <CaloriesCard /> : <SetupCard />}
      <WaterCard />
      <MissedCard />
      <WorkoutCard />
      <StreaksCard />
      {food.setupDone ? <TipCard /> : null}
      <Button title={t('Edit home')} icon="sliders" kind="glass" style={{ marginTop: 8 }} onPress={soon} />
    </Screen>
  );
}

function CheckinCard({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card style={{ backgroundColor: c.cobalt, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Mark size={38} color="#FFFFFF" stroke={7} />
      <View style={{ flex: 1 }}>
        <Text variant="h3" color="#FFFFFF">
          {t('Morning check-in')}
        </Text>
        <Text variant="small" color="rgba(255,255,255,0.85)">
          {t('Weight, sleep and energy. Under 30 seconds.')}
        </Text>
      </View>
      <Springy onPress={onStart} style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
        <Text weight={700} size={14} color="#0A0A0B">
          {t('Start')}
        </Text>
      </Springy>
    </Card>
  );
}

function CoachPendingCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="clock" size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{t('Coach application under review')}</Text>
        <Text variant="small" color="sec">
          {t('Usually within 2 days. We’ll notify you.')}
        </Text>
      </View>
    </Card>
  );
}

function SetupCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card onPress={() => router.push('/food')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="flame" size={22} color="#FFFFFF" strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{t('Set your calories')}</Text>
        <Text variant="small" color="sec">
          {t('Answer a few questions and get your daily calories and meal plan.')}
        </Text>
      </View>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
}

function CaloriesCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const e = food.eaten;
  const goal = food.dayGoal(food.today);
  const left = food.kcalLeft;
  const over = left < 0;
  return (
    <Card onPress={() => router.push('/food')} style={{ paddingTop: 22 }}>
      <View style={{ alignItems: 'center' }}>
        <Ring value={e.k} max={goal + food.burned} size={196} stroke={18} color={over ? c.down : c.cobalt}>
          <Text num size={46} style={{ letterSpacing: -1.84, lineHeight: 50 }}>
            {fmt(Math.abs(left))}
          </Text>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 4 }}>
            {t(over ? 'kcal over' : 'kcal left')}
          </Text>
        </Ring>
      </View>
      <Row style={{ justifyContent: 'space-around', marginVertical: 16, paddingHorizontal: 10 }}>
        {(
          [
            ['Eaten', e.k],
            ['Goal', goal],
            ['Burned', food.burned],
          ] as const
        ).map(([label, v]) => (
          <View key={label} style={{ alignItems: 'center' }}>
            <Text num size={17}>
              {fmt(v)}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(label)}
            </Text>
          </View>
        ))}
      </Row>
      <MacroBars />
    </Card>
  );
}

function WaterCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const goal = food.plan.water || 2800;
  return (
    <Card onPress={() => router.push('/water')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ring value={food.water} max={goal} size={64} stroke={7}>
        <Icon name="drop" size={22} color={c.cobalt} strokeWidth={2} />
      </Ring>
      <View style={{ flex: 1 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Water')}
        </Text>
        <Text num size={22}>
          {fmt(food.water)}
          <Text num size={15} weight={500} color="sec">{` / ${fmt(goal)} ${t('ml')}`}</Text>
        </Text>
      </View>
      <Springy
        onPress={async () => {
          await food.addWater(250);
          toast(t('Added {n} ml water', { n: 250 }), { icon: 'drop' });
        }}
        scaleTo={1.08}
        accessibilityLabel={t('Add 250 ml water')}>
        <Glass style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={24} strokeWidth={2.2} />
        </Glass>
      </Springy>
    </Card>
  );
}

function StreaksCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const box = (key: string, v: number, max: number, icon: IconName, value: string, label: string) => (
    <View key={key} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' }}>
      <Ring value={v} max={max} size={46} stroke={5}>
        <Icon name={icon} size={17} color={c.cobalt} strokeWidth={2} />
      </Ring>
      <Text num size={18} style={{ marginTop: 8 }}>
        {value}
      </Text>
      <Text variant="xs" weight={700} color="sec" center style={{ lineHeight: 15 }}>
        {label}
      </Text>
    </View>
  );
  return (
    <Card onPress={() => router.push({ pathname: '/progress', params: { tab: 'streaks' } })}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text weight={700}>{t('Streaks')}</Text>
        <Icon name="chev" size={18} color={c.sec} />
      </Row>
      <Row gap={8}>
        {box('o', s.overall, s.best, 'flame', t('{n} days', { n: s.overall }), t('Overall'))}
        {box('w', s.workouts, s.bestWorkouts, 'train', String(s.workouts), t('Workouts in a row'))}
        {box('c', s.commitment ?? 0, 100, 'check', s.commitment == null ? '–' : `${s.commitment}%`, t('Commitment'))}
      </Row>
    </Card>
  );
}

function TipCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { eaten, target, kcalLeft } = useFood();
  const left = Math.round(target.p - eaten.p);
  const tip =
    kcalLeft < 0
      ? t('You went over today. No stress: a walk tonight or a lighter dinner tomorrow evens it out.')
      : left > 25
        ? t('You still need {n} g of protein. A cup of Greek yogurt after training covers most of it.', { n: left })
        : left > 0
          ? t('Only {n} g of protein left. A glass of laban or two eggs will finish it.', { n: left })
          : t('Protein done for today. Nice work.');
  return (
    <Card onPress={() => router.push('/coach')} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Mark size={26} color={c.cobalt} stroke={5} />
      <View style={{ flex: 1 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Coach tip')}
        </Text>
        <Text weight={600} style={{ marginTop: 4 }}>
          {tip}
        </Text>
      </View>
    </Card>
  );
}
