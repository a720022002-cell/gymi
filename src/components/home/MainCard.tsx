import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { RCOL, useDayRings, useMetrics } from '@/components/home/metrics';
import { RingPickSheet } from '@/components/home/RingPickSheet';
import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { MacroBars } from '@/components/food/MacroBars';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useStepGoal } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { RING_NAMES, type RingKey } from '@/lib/homeLayout';
import { recLabel } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { fx } from '@/lib/progress';
import { useStreaks } from '@/lib/useProgress';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

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

/** Round button on the main card that opens "Your rings" (design: ringSwitchBtn). */
function RingSwitch({ onPress }: { onPress: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t('Change what this ring shows')}
      hitSlop={6}
      style={{ position: 'absolute', top: 12, end: 12, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="swap" size={16} strokeWidth={2.2} />
    </Pressable>
  );
}

/** The main card: calories, one other ring big, or up to 3 rings inside each other. */
export function MainCard() {
  const food = useFood();
  const [pick, setPick] = useState(false);
  const rs = useDayRings();
  const sw = <RingSwitch onPress={() => setPick(true)} />;
  return (
    <>
      {rs.length > 1 ? <RingsCard sw={sw} /> : rs[0] && rs[0] !== 'calories' ? <HeroCard k={rs[0]} sw={sw} /> : food.setupDone ? <CaloriesCard sw={sw} /> : <SetupCard />}
      <RingPickSheet open={pick} onClose={() => setPick(false)} />
    </>
  );
}

/** Up to 3 rings inside each other, with a row per ring that opens its screen (design: ringsCard). */
function RingsCard({ sw }: { sw: React.ReactNode }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const m = useMetrics();
  const cols = RCOL(c);
  const rs = useDayRings();
  const nest = (i: number): React.ReactNode =>
    i >= rs.length ? null : (
      <Ring value={m[rs[i]].v} max={m[rs[i]].max} size={160 - i * 38} stroke={15} color={cols[i]}>
        {nest(i + 1)}
      </Ring>
    );
  return (
    <Card style={{ padding: 20 }}>
      {sw}
      <Row gap={16}>
        {nest(0)}
        <View style={{ flex: 1, minWidth: 0, paddingEnd: 26 }}>
          {rs.map((k, i) => (
            <Pressable key={k} onPress={m[k].go} accessibilityRole="button" style={{ marginTop: i ? 14 : 0 }}>
              <Row gap={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cols[i] }} />
                <Text variant="xs" weight={700} color={cols[i]}>
                  {t(RING_NAMES[k])}
                </Text>
              </Row>
              <Text num size={20} style={{ lineHeight: 24 }}>
                {m[k].big}
              </Text>
              <Text variant="xs" color="sec" numberOfLines={1}>
                {m[k].txt}
              </Text>
            </Pressable>
          ))}
        </View>
      </Row>
    </Card>
  );
}

/** One ring big, for anything but calories (design: heroCard). */
function HeroCard({ k, sw }: { k: RingKey; sw: React.ReactNode }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const { session } = useAuth();
  const STEP_GOAL = useStepGoal(session?.user.id);
  const train = useTrain();
  const s = useStreaks();
  const { r } = useRecovery();
  const m = useMetrics()[k];
  const wGoal = food.waterGoal;
  let big = m.big;
  let unit = '';
  let color = c.cobalt;
  let stats: [string, string][] = [];
  let action: React.ReactNode = null;
  const addWater = async (ml: number) => {
    await food.addWater(ml);
    toast(t('Added {n} ml water', { n: ml }), { icon: 'drop' });
  };
  if (k === 'protein') {
    big = String(Math.max(0, Math.round(food.dayTarget.p - food.eaten.p)));
    unit = t('g protein left');
    stats = [
      [`${Math.round(food.eaten.p)} g`, t('Eaten')],
      [`${food.dayTarget.p} g`, t('Goal')],
      [String(food.logs.length), t('Meals logged')],
    ];
    action = <Button small kind="glass" icon="plus" title={t('Log food')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => food.setLogOpen(true)} />;
  } else if (k === 'water') {
    big = fmt(food.water);
    unit = t('of {n} ml', { n: fmt(wGoal) });
    stats = [
      [fmt(Math.max(0, wGoal - food.water)), t('ml left')],
      [String(food.waterLogs.length), t('Drinks')],
      [`${Math.round((food.water / wGoal) * 100)}%`, t('Done')],
    ];
    action = (
      <Row gap={8} style={{ marginTop: 12, justifyContent: 'center' }}>
        <Button small kind="glass" title={t('+ {n} ml', { n: 250 })} onPress={() => addWater(250)} />
        <Button small kind="glass" title={t('+ {n} ml', { n: 500 })} onPress={() => addWater(500)} />
      </Row>
    );
  } else if (k === 'steps') {
    unit = t('steps today');
    stats = [
      [fmt(STEP_GOAL), t('Goal')],
      [food.steps ? fmt(Math.max(0, STEP_GOAL - food.steps)) : '--', t('To go')],
      [food.steps ? `${fx(food.steps * 0.00075)} ${t('km')}` : '--', t('Distance')],
    ];
    if (!food.steps) action = <Button small title={t('Connect a watch')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.push('/devices')} />;
  } else if (k === 'recovery') {
    unit = t('recovered');
    color = r.score >= 60 ? c.cobalt : c.down;
    stats = [
      [r.sleepH != null ? `${fx(r.sleepH)} h` : '–', t('Sleep')],
      [`${fx(r.acwr)}×`, t('Training load')],
      [`${r.parts[4].value}%`, t('Nutrition')],
    ];
    action = (
      <Text variant="small" weight={700} center style={{ marginTop: 12 }}>
        {t(recLabel(r.score)[0])}
      </Text>
    );
  } else if (k === 'workouts') {
    unit = t('workouts this week');
    stats = [
      [String(train.streak), t('In a row')],
      [train.todayName ? t(train.todayName) : t('Rest'), t('Today')],
      [String(Math.max(0, (train.plan?.days ?? 0) - train.doneIdx.size)), t('To go')],
    ];
    if (train.todayName && !train.todayLog) action = <Button small title={t('Start {w} day', { w: t(train.todayName) })} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.push('/train')} />;
  } else if (k === 'commit') {
    unit = t('commitment this week');
    const p = s.c7.parts;
    stats = [
      [`${p.work[0]}/${p.work[1]}`, t('Workouts')],
      [`${p.cal[0]}/${p.cal[1]}`, t('Calories')],
      [`${p.prot[0]}/${p.prot[1]}`, t('Protein')],
    ];
  }
  return (
    <Card onPress={m.go} style={{ alignItems: 'center', padding: 22 }}>
      {sw}
      <Ring value={m.v} max={m.max} size={180} stroke={16} color={color}>
        <View style={{ alignItems: 'center' }}>
          <Text num size={big.length > 5 ? 34 : 44} style={{ letterSpacing: -1.2 }}>
            {big}
          </Text>
          <Text variant="small" weight={700} color="sec">
            {unit}
          </Text>
        </View>
      </Ring>
      <Row style={{ marginTop: 16, alignSelf: 'stretch', justifyContent: 'space-around' }}>
        {stats.map(([a, b]) => (
          <View key={b} style={{ alignItems: 'center', flex: 1 }}>
            <Text num size={17} numberOfLines={1}>
              {a}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {b}
            </Text>
          </View>
        ))}
      </Row>
      {action}
    </Card>
  );
}

function CaloriesCard({ sw }: { sw: React.ReactNode }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const e = food.eaten;
  const goal = food.dayGoal(food.day);
  const left = food.kcalLeft;
  const over = left < 0;
  return (
    <Card onPress={() => router.push('/food')} style={{ paddingTop: 22 }}>
      {sw}
      <View style={{ alignItems: 'center' }}>
        <Ring value={e.k} max={goal + food.burned} size={196} stroke={18} color={over ? c.down : c.cobalt}>
          <View style={{ alignItems: 'center' }}>
            <Text num size={46} style={{ letterSpacing: -1.2, lineHeight: 50 }}>
              {fmt(Math.abs(left))}
            </Text>
            <Text variant="small" weight={700} color="sec" style={{ marginTop: 2 }}>
              {t(over ? 'kcal over' : 'kcal left')}
            </Text>
          </View>
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
