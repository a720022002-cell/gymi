import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood, useLogFood } from '@/lib/food';
import { fmt, type PlannedMeal, planMeals } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Springy } from '../ui';

/** Tap a planned meal: view recipe, change it, log it, or remove it (design: mealMenu). */
export function MealMenu({ meal, logged, onClose }: { meal: PlannedMeal | null; logged: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  if (!meal) return <Sheet open={false} onClose={onClose} />;

  const swap = () => {
    const picks = { ...(food.plan.picks ?? {}), [meal.key]: (food.plan.picks?.[meal.key] ?? 0) + 1 };
    const custom = { ...(food.plan.custom ?? {}) };
    delete custom[meal.key];
    const before = food.plan.picks;
    food.updatePlan({ picks, custom });
    const n = planMeals({ ...food.plan, picks, custom }).find((x) => x.key === meal.key);
    onClose();
    toast(t('Changed to {name}. Same calories.', { name: n ? t(n.r.n) : '' }), { ai: true, undo: () => food.updatePlan({ picks: before }) });
  };

  const actions: [IconName, string, () => void, boolean?][] = [
    ['book', 'View recipe', () => { onClose(); router.push({ pathname: '/recipe', params: { key: meal.key } }); }],
    ['swap', 'Change meal', swap],
    ['sparkle', 'Make from my ingredients', () => toast(t('Coming with the AI coach'), { ai: true }), true],
  ];
  const canRemove = !food.plan.ramadan && food.plan.meals.length > 2;

  return (
    <Sheet open={!!meal} onClose={onClose}>
      <Text variant="h2" center>
        {t(meal.r.n)}
      </Text>
      <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
        {`${t(meal.n)}, ${fmt(meal.k)} ${t('kcal')}`}
      </Text>
      <View style={{ marginTop: 16, gap: 8 }}>
        {actions.map(([icon, label, fn, ai]) => (
          <Springy key={label} onPress={fn} scaleTo={0.985} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, backgroundColor: 'rgba(127,127,135,0.12)', opacity: ai ? 0.7 : 1 }}>
            <Icon name={icon} size={18} color={c.text} />
            <Text weight={700}>{t(label)}</Text>
            {ai ? <Text variant="xs" color="sec">{`· ${t('Coming soon')}`}</Text> : null}
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
              food.updatePlan({ meals: food.plan.meals.filter((_, j) => j !== i) });
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
  );
}
