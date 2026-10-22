import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Field } from '@/components/Field';
import { Glass } from '@/components/Glass';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { allergensIn, noteHit } from '@/lib/allergies';
import { healthFoodTips } from '@/lib/bloodFood';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { fx } from '@/lib/progress';
import { useStreaks } from '@/lib/useProgress';
import { fmt, localDay } from '@/lib/nutrition';
import { lockSupported } from '@/lib/biolock';
import { useCycleCoach } from '@/lib/cyclePhase';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

export function WaterCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const goal = food.waterGoal;
  // Long press on + : type your own amount.
  const [custom, setCustom] = useState<string | null>(null);
  const amount = Number((custom ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;
  const add = async (ml: number) => {
    await food.addWater(ml);
    toast(t('Added {n} ml water', { n: fmt(ml) }), { icon: 'drop' });
  };
  return (
    <>
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
          onPress={() => add(250)}
          onLongPress={() => setCustom('')}
          delayLongPress={400}
          scaleTo={1.08}
          accessibilityLabel={t('Add 250 ml water')}
          accessibilityHint={t('Press and hold to type an amount')}
          style={Platform.OS === 'web' ? ({ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as object) : undefined}>
          <Glass style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} strokeWidth={2.2} />
          </Glass>
        </Springy>
      </Card>
      <Sheet open={custom !== null} onClose={() => setCustom(null)}>
        <Text variant="h2">{t('Add water')}</Text>
        <Field label={t('Amount')} value={custom ?? ''} onChangeText={(v) => setCustom(v.replace(/[^\d٠-٩]/g, '').slice(0, 4))} placeholder="330" unit={t('ml')} keyboardType="number-pad" ltr autoFocus />
        <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
          {[150, 330, 500, 750, 1000].map((n) => (
            <Button key={n} small kind="soft" title={t('{n} ml', { n: fmt(n) })} onPress={() => setCustom(String(n))} />
          ))}
        </Row>
        <Button
          title={amount ? t('Add {n} ml', { n: fmt(amount) }) : t('Add')}
          disabled={amount < 10 || amount > 3000}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setCustom(null);
            await add(amount);
          }}
        />
        {amount > 3000 ? (
          <Text variant="xs" color="down" style={{ marginTop: 6 }}>
            {t('That’s a lot at once. Add up to 3,000 ml.')}
          </Text>
        ) : null}
      </Sheet>
    </>
  );
}

export function ReadingsCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const health = useHealth();
  const w = health.weights.at(-1);
  const W = useWeight();
  const sl = [...health.checkins].reverse().find((x) => x.sleep_h != null);
  const items: [IconName, string, string][] = [
    ['walk', fmt(food.steps), t('Steps')],
    ['scale', w ? W.show(w.value) : '–', W.label],
    ['moon', sl ? `${fx(sl.sleep_h as number)}` : '–', t('h sleep')],
  ];
  return (
    <Card onPress={() => router.push('/devices')}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text weight={700}>{t('Your readings')}</Text>
        <Icon name="chev" size={18} color={c.sec} />
      </Row>
      <Row gap={8}>
        {items.map(([i, v, l]) => (
          <View key={l} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, padding: 12 }}>
            <Icon name={i} size={18} color={c.cobalt} />
            <Text num size={18} style={{ marginTop: 6 }}>
              {v}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {l}
            </Text>
          </View>
        ))}
      </Row>
    </Card>
  );
}

export function StreaksCard() {
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

export function TipCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { eaten, dayTarget: target, kcalLeft, plan, today } = useFood();
  const h = useHealth();
  const left = Math.round(target.p - eaten.p);
  // From low blood markers and the supplements you take: one a day, in turn.
  const extra = healthFoodTips(h.blood, h.supplements, plan.allergies, plan.allergyNote);
  const health = extra.length ? extra[Math.floor(new Date(`${today}T12:00:00Z`).getTime() / 864e5) % extra.length] : null;
  // The first protein idea without any of your allergens (or the words in your own allergy note).
  const safe = (tips: [string[], string][]) =>
    tips.find(([foods]) => !allergensIn(foods, plan.allergies).length && !noteHit(foods, plan.allergyNote))?.[1] ?? 'You still need {n} g of protein. Add some to your next meal.';
  const tip =
    kcalLeft < 0
      ? t('You went over today. No stress: a walk tonight or a lighter dinner tomorrow evens it out.')
      : left > 25
        ? t(
            safe([
              [['Greek yogurt'], 'You still need {n} g of protein. A cup of Greek yogurt after training covers most of it.'],
              [['chicken breast'], 'You still need {n} g of protein. A grilled chicken breast covers most of it.'],
              [['tuna'], 'You still need {n} g of protein. A can of tuna covers most of it.'],
            ]),
            { n: left },
          )
        : left > 0
          ? t(
              safe([
                [['laban', 'eggs'], 'Only {n} g of protein left. A glass of laban or two eggs will finish it.'],
                [['chicken'], 'Only {n} g of protein left. A few slices of chicken will finish it.'],
                [['tuna'], 'Only {n} g of protein left. Half a can of tuna will finish it.'],
              ]),
              { n: left },
            )
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
        {health ? (
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t(health.text)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/** Cycle, for women: today's phase and the next period. Private; opens the cycle screen. */
export function CycleCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const all = useCycleCoach();
  const cy = all?.cycle ?? null;
  const preg = all?.preg ?? null;
  const today = localDay();
  const until = cy ? Math.max(0, Math.round((new Date(`${cy.next}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 864e5)) : 0;
  // Locked with Face ID or a fingerprint: no details on Home.
  const sub = all?.lock && lockSupported
    ? t('Locked. Tap to open.')
    : preg
      ? preg.week == null
        ? t(preg.mode === 'preg' ? 'Pregnant' : 'After birth')
        : t(preg.mode === 'preg' ? 'Pregnant · week {n}' : 'After birth · week {n}', { n: preg.week })
      : !cy
        ? t('Log your period to see your phase. Private. Never shared.')
        : cy.phase === 'Period'
          ? t('Period day {n}', { n: cy.day })
          : cy.late
            ? t('Your period is late')
            : `${t(cy.phase)} · ${until > 0 ? t('Next period in {n} days', { n: until }) : t('Your period could start any day')}`;
  return (
    <Card onPress={() => router.push('/period')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(236,72,153,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="drop" size={22} color="#EC4899" />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{t('Cycle')}</Text>
        <Text variant="small" color="sec">
          {sub}
        </Text>
      </View>
      <Icon name="chev" size={16} color={c.sec} />
    </Card>
  );
}
