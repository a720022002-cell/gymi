import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { fmt } from '@/lib/nutrition';
import { fx, shortDate, weeklyVolume } from '@/lib/progress';
import { recLabel } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { EX } from '@/lib/training';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

import { Bar } from '../Ring';
import { BarChart } from '../Charts';
import { Icon, type IconName, Mark } from '../Icon';
import { Text } from '../Text';
import { useRecovery } from '../train/RecoveryCard';
import { Button, Card, Row, Springy } from '../ui';
import { SecHead } from './bits';

export type PTab = 'overall' | 'body' | 'recovery' | 'streaks';

/** Overall: your month at a glance, tiles, strength and nutrition (design: progOverall). */
export function Overall({ go }: { go: (t: PTab, sub?: number) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const s = useStreaks();
  const { r } = useRecovery();
  const w = health.weights;
  const waist = health.measures.filter((m) => m.kind === 'waist');
  const cur = w.at(-1)?.value;
  const dw = w.length > 1 ? w.at(-1)!.value - w[0].value : 0;
  const dWaist = waist.length > 1 ? waist.at(-1)!.value - waist[0].value : 0;
  const goal = food.plan.goal;
  const goodW = w.length < 2 ? null : goal >= 3 ? dw < 0 : goal <= 1 ? dw > 0 : Math.abs(dw) < 1;
  const sleeps = health.checkins.filter((x) => x.sleep_h != null).slice(-7);
  const sAvg = sleeps.length ? sleeps.reduce((a, x) => a + (x.sleep_h ?? 0), 0) / sleeps.length : null;
  const cm = s.commitment;
  const vol = weeklyVolume(train.logs, train.today);
  const volUp = vol[6] > 0 ? Math.round(((vol[7] - vol[6]) / vol[6]) * 100) : null;
  const prs = Object.entries(train.best)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const exName = (id: string) => (EX[id] ? (lang === 'ar' ? EX[id].ar : EX[id].en) : (train.logs.flatMap((l) => l.exercises).find((x) => x.id === id)?.n ?? id));

  const mood = cm == null ? 'Your first days' : cm >= 80 && r.score >= 60 ? 'You’re on track' : cm >= 65 ? 'Good, with room to grow' : 'Let’s get back on track';
  const lines: string[] = [];
  if (w.length > 1)
    lines.push(
      t(goal >= 3 ? 'You’ve lost {n} kg since {d}.' : goal <= 1 ? 'You’ve gained {n} kg since {d}.' : 'Your weight moved {n} kg since {d}.', {
        n: fx(Math.abs(dw)),
        d: shortDate(w[0].day, lang),
      }),
    );
  else lines.push(t('Log your weight a few mornings a week to see your trend here.'));
  if (cm != null) lines.push(t('You hit {n}% of your plan in the last 30 days.', { n: cm }));
  if (sAvg != null) lines.push(sAvg < 7 ? t('Sleep is the easiest win: you’re averaging {n} h.', { n: fx(sAvg) }) : t('Your sleep is solid. Keep it up.'));

  const tile = (icon: IconName, label: string, val: string, sub: string, onPress: () => void, good: boolean | null) => (
    <Springy key={label} onPress={onPress} style={{ width: '48.5%', marginBottom: 10 }}>
      <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="xs" weight={700} color="sec">
            {label}
          </Text>
          <Icon name={icon} size={16} color={c.cobalt} />
        </Row>
        <Text num size={22} style={{ marginTop: 4 }} numberOfLines={1}>
          {val}
        </Text>
        <Text variant="xs" weight={700} color={good === true ? 'up' : good === false ? 'down' : 'sec'} style={{ marginTop: 4 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Springy>
  );
  const arrow = (d: number) => (d < 0 ? '↓' : '↑');
  const last7 = s.c7.parts;

  return (
    <View>
      <Card style={{ backgroundColor: c.gAi }}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Mark size={24} color={c.cobalt} stroke={5} />
          <View style={{ flex: 1 }}>
            <Text variant="xs" weight={700} color="sec">
              {t('Your month at a glance')}
            </Text>
            <Text variant="h3" style={{ marginTop: 4 }}>
              {t(mood)}
            </Text>
            <Text variant="small" style={{ marginTop: 4 }}>
              {lines.join(' ')}
            </Text>
          </View>
        </Row>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 2 }}>
        {tile('scale', t('Weight'), cur ? `${fx(cur)} ${t('kg')}` : '–', w.length > 1 ? `${arrow(dw)} ${fx(Math.abs(dw))} ${t('kg')}` : t('Log your weight'), () => go('body'), goodW)}
        {tile('ruler', t('Waist'), waist.length ? `${fx(waist.at(-1)!.value)} cm` : '–', waist.length > 1 ? `${arrow(dWaist)} ${fx(Math.abs(dWaist))} cm` : t('Add measurements'), () => go('body'), waist.length > 1 ? dWaist < 0 : null)}
        {tile('moon', t('Sleep'), sAvg != null ? `${fx(sAvg)} ${t('h')}` : '–', t('Average, last 7 nights'), () => go('recovery'), sAvg != null ? sAvg >= 7 : null)}
        {tile('bolt', t('Recovery'), `${r.score}%`, t(recLabel(r.score)[0]), () => go('recovery'), r.score >= 60)}
        {tile('flame', t('Streak'), t('{n} days', { n: s.overall }), t('Best {n}', { n: s.best }), () => go('streaks', 0), s.overall > 0 ? true : null)}
        {tile('check', t('Commitment'), cm == null ? '–' : `${cm}%`, t('Last 30 days'), () => go('streaks', 2), cm == null ? null : cm >= 80)}
        {tile('food', t('Calories today'), fmt(food.eaten.k), t('of {n} kcal', { n: fmt(food.dayGoal(food.today)) }), () => router.push('/food'), null)}
        {tile('drop', t('Water today'), `${fx(food.water / 1000)} L`, t('of {n} L', { n: fx((food.plan.water || 2800) / 1000) }), () => router.push('/water'), food.water >= (food.plan.water || 2800) * 0.8 ? true : null)}
      </View>

      <SecHead title={t('Strength')} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" weight={700}>
            {t('Training volume, last 8 weeks')}
          </Text>
          {volUp != null ? (
            <Text variant="xs" weight={700} color={volUp >= 0 ? 'up' : 'down'}>
              {`${volUp >= 0 ? '↑' : '↓'} ${Math.abs(volUp)}%`}
            </Text>
          ) : null}
        </Row>
        {vol.some((v) => v > 0) ? (
          <View style={{ marginTop: 8 }}>
            <BarChart values={vol} labels={['W1', '', 'W3', '', 'W5', '', 'W7', t('Now')]} highlight={7} />
          </View>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 8 }}>
            {t('Finish a workout to see your training volume.')}
          </Text>
        )}
        {prs.map(([id, kg]) => (
          <Row key={id} style={{ marginTop: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trophy" size={16} color="#FFFFFF" />
            </View>
            <Text variant="small" weight={700} style={{ flex: 1 }} numberOfLines={1}>
              {exName(id)}
            </Text>
            <Text num weight={700}>{`${fx(kg)} ${t('kg')}`}</Text>
          </Row>
        ))}
        <Button small kind="ghost" title={t('See all exercises')} style={{ marginTop: 6 }} onPress={() => router.push('/library')} />
      </Card>

      {food.setupDone ? (
        <>
          <SecHead title={t('Nutrition, last 7 days')} />
          <Card>
            {(
              [
                ['Calories on target', last7.cal],
                ['Protein goal hit', last7.prot],
                ['Water goal hit', last7.water],
              ] as const
            ).map(([n, [a, b]]) => (
              <View key={n} style={{ marginTop: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="small" weight={700}>
                    {t(n)}
                  </Text>
                  <Text variant="small" weight={700} num>
                    {t('{a} of {b} days', { a, b })}
                  </Text>
                </Row>
                <View style={{ marginTop: 4 }}>
                  <Bar value={a} max={Math.max(b, 1)} color={b && a / b >= 0.8 ? c.up : c.cobalt} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Card onPress={() => router.push('/health')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="doc" size={18} color={c.cobalt} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Health')}</Text>
          <Text variant="small" color="sec">
            {t('Vitamins and blood tests')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
    </View>
  );
}
