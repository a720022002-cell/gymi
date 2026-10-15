import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood, useLogFood } from '@/lib/food';
import { changeMeal, fmt, type PlannedMeal, withMealIds } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Springy } from '../ui';
import { IngredientsSheet } from './IngredientsSheet';

/** Tap a planned meal: view recipe, change it, log it, or remove it (design: mealMenu). */
export function MealMenu({ meal, logged, onClose }: { meal: PlannedMeal | null; logged: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  const [ingrFor, setIngrFor] = useState<PlannedMeal | null>(null);
  const ingr = <IngredientsSheet meal={ingrFor} onClose={() => setIngrFor(null)} />;
  if (!meal)
    return (
      <>
        <Sheet open={false} onClose={onClose} />
        {ingr}
      </>
    );

  const swap = () => {
    const before = { picks: food.plan.picks, custom: food.plan.custom };
    const { picks, custom, meal: n } = changeMeal(food.plan, meal.key, food.day, food.dayGoal(food.day));
    food.updatePlan({ picks, custom });
    onClose();
    toast(t('Changed to {name}. Same calories.', { name: n ? t(n.r.n) : '' }), { ai: true, undo: () => food.updatePlan(before) });
  };

  const actions: [IconName, string, () => void][] = [
    [
      'book',
      'View recipe',
      () => {
        onClose();
        router.push({ pathname: '/recipe', params: { key: meal.key } });
      },
    ],
    ['swap', 'Change meal', swap],
    [
      'sparkle',
      'Make from my ingredients',
      () => {
        onClose();
        setTimeout(() => setIngrFor(meal), 300);
      },
    ],
  ];
  const canRemove = !food.plan.ramadan && food.plan.meals.length > 2;

  return (
    <>
      {ingr}
      <Sheet open={!!meal} onClose={onClose}>
        <Text variant="h2" center>
          {t(meal.r.n)}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {`${t(meal.n)}, ${fmt(meal.k)} ${t('kcal')}`}
        </Text>
        <View style={{ marginTop: 16, gap: 8 }}>
          {actions.map(([icon, label, fn]) => (
            <Springy
              key={label}
              onPress={fn}
              scaleTo={0.985}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: 'rgba(127,127,135,0.12)' }}>
              <Icon name={icon} size={18} color={c.text} />
              <Text weight={700}>{t(label)}</Text>
            </Springy>
          ))}
          {!logged ? (
            <Button
              title={t('Log this meal')}
              onPress={async () => {
                onClose();
                await logFood({ name: t(meal.r.n), kcal: meal.k, protein: meal.p, carbs: meal.c, fat: meal.f, meal: meal.n, plan_key: meal.key }, toast, t);
              }}
            />
          ) : null}
          {canRemove ? (
            <Springy
              onPress={() => {
                const i = food.plan.meals.findIndex((x) => x.n === meal.n && x.t === meal.t);
                if (i < 0) return;
                const before = food.plan.meals;
                food.updatePlan({ meals: withMealIds(food.plan.meals).filter((_, j) => j !== i) });
                onClose();
                toast(t('{meal} removed', { meal: t(meal.n) }), { icon: 'trash', undo: () => food.updatePlan({ meals: before }) });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}>
              <Icon name="trash" size={18} color={c.down} />
              <Text weight={700} color="down">
                {t('Remove this meal')}
              </Text>
            </Springy>
          ) : null}
          <Button title={t('Cancel')} kind="ghost" onPress={onClose} />
        </View>
      </Sheet>
    </>
  );
}
