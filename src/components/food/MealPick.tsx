import { ScrollView } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { hhmmOf, mealAt, mealChoices, planMeals } from '@/lib/nutrition';

import { Text } from '../Text';
import { Chip } from '../ui';

/** The meal new food goes to in this logging flow (and which day, when it isn't today). Tap another to change it. */
export function MealPick({ style }: { style?: object }) {
  const { t, lang } = useT();
  const food = useFood();
  const planned = planMeals(food.plan);
  const cur = food.mealPick ?? (food.isToday ? mealAt(planned, hhmmOf()) : 'Snack');
  const dayText = food.isToday
    ? ''
    : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date(`${food.day}T12:00:00`));
  return (
    <>
      <Text variant="xs" weight={700} color="sec" style={[{ marginHorizontal: 4, marginBottom: 6 }, style]}>
        {food.isToday ? t('Add to') : t('Add to {day}', { day: dayText })}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
        {mealChoices(planned).map((m) => (
          <Chip key={m} title={t(m)} on={cur === m} onPress={() => food.setMealPick(m)} />
        ))}
      </ScrollView>
    </>
  );
}
