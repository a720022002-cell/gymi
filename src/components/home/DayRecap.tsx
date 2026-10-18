import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { Button, Card, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useTrain } from '@/lib/train';
import { weekdayOf, weekStart } from '@/lib/training';
import { addDays, fmt } from '@/lib/nutrition';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

/** An earlier day: the meals, cardio and workouts you logged. Tap a meal to see or delete it; add food to this day from the Food tab or the + button. */
export function DayRecap() {
  const { t } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const food = useFood();
  const train = useTrain();
  const workouts = train.logs.filter((l) => l.day === food.day);
  const [pick, setPick] = useState(false);
  // Training after midnight: go back to yesterday and start it there, so it counts for the day before.
  const yesterday = food.day === addDays(train.today, -1);
  const canTrain = yesterday && !workouts.length && !!train.plan && !train.session;
  const planned = yesterday && food.day >= weekStart(train.today) ? train.week[weekdayOf(food.day)]?.w : undefined;
  const names = train.plan ? Object.keys(train.plan.workouts).sort((a, b) => (a === planned ? -1 : b === planned ? 1 : 0)) : [];
  const nothing = !food.logs.length && !food.cardio.length && !workouts.length;
  const row = (key: string, icon: IconName, title: string, sub: string, go?: () => void, i = 0) => (
    <Springy key={key} disabled={!go} onPress={go} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
      <Icon name={icon} size={20} color={c.sec} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={700} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="xs" color="sec" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {go ? <Icon name="chev" size={16} color={c.sec} /> : null}
    </Springy>
  );
  const items = [
    ...food.logs.map((l) => ({ k: l.id, icon: 'food' as IconName, title: l.name, sub: [l.meal ? t(l.meal) : null, `${fmt(+l.kcal)} ${t('kcal')}`].filter(Boolean).join(t(', ')), go: () => router.push({ pathname: '/logged', params: { id: l.id } }) })),
    ...food.cardio.map((x) => ({ k: x.id, icon: 'run' as IconName, title: x.kind === 'Other' && x.name ? x.name : t(x.kind), sub: t('{m} min, {k} kcal burned', { m: x.minutes, k: fmt(x.kcal) }), go: undefined })),
    ...workouts.map((w, i) => ({ k: `w${i}`, icon: 'train' as IconName, title: t('{w} workout', { w: t(w.name) }), sub: W.words(t('{m} min, {v} kg lifted', { m: w.minutes, v: fmt(W.num(w.volume)) })), go: () => router.push({ pathname: '/summary', params: { id: w.id } }) })),
  ];
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="h3" style={{ marginBottom: 10, marginHorizontal: 2 }}>
        {t('What you logged')}
      </Text>
      {nothing ? (
        <Card>
          <Text color="sec">{t('Nothing logged this day.')}</Text>
        </Card>
      ) : (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>{items.map((x, i) => row(x.k, x.icon, x.title, x.sub, x.go, i))}</View>
      )}
      <Button title={t('Add food to this day')} icon="plus" style={{ marginTop: 12 }} onPress={() => food.setLogOpen(true)} />
      {canTrain ? <Button title={t('Train for this day')} icon="train" kind="glass" style={{ marginTop: 8 }} onPress={() => setPick(true)} /> : null}
      <Sheet open={pick} onClose={() => setPick(false)}>
        <Text variant="h3">{t('Train for yesterday')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
          {t('Training after midnight? Start it here and it counts for yesterday.')}
        </Text>
        {names.map((w, i) => (
          <Springy
            key={w}
            onPress={() => {
              setPick(false);
              router.push({ pathname: '/workout', params: { w, day: food.day } });
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Icon name="train" size={20} color={c.sec} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('{w} workout', { w: t(w) })}
            </Text>
            {w === planned ? (
              <Text variant="xs" weight={700} style={{ color: c.cobalt }}>
                {t('Planned')}
              </Text>
            ) : null}
            <Icon name="chev" size={16} color={c.sec} />
          </Springy>
        ))}
      </Sheet>
    </View>
  );
}
