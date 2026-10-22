import { useCallback } from 'react';

import { useT } from '@/i18n';
import { type FoodLog, type NewLog, useLogFood } from '@/lib/food';

import { useToast } from '../Toast';
import { useAllergyCheck } from './AllergyWarn';

type Again = Pick<FoodLog, 'name' | 'kcal' | 'protein' | 'carbs' | 'fat'> & Partial<Pick<FoodLog, 'sugar_high' | 'fat_high' | 'food_id' | 'barcode'>>;

/** Log something you logged before again, same amount and numbers. `on`: the day (the one on screen when not given).
 * `meal`: the meal (else the one picked in this logging flow, or the usual one). Asks first when it may hold an allergy. */
export function useLogAgain() {
  const { t } = useT();
  const toast = useToast();
  const logFood = useLogFood();
  const allergyCheck = useAllergyCheck();
  return useCallback(
    async (l: Again, o: { on?: string; meal?: string | null } = {}) => {
      const item: NewLog = {
        name: l.name,
        kcal: +l.kcal,
        protein: +l.protein,
        carbs: +l.carbs,
        fat: +l.fat,
        meal: o.meal ?? undefined,
        sugar_high: !!l.sugar_high,
        fat_high: !!l.fat_high,
        food_id: l.food_id ?? null,
        barcode: l.barcode ?? null,
      };
      const go = () => logFood(item, toast, t, o.on);
      const bad = allergyCheck(l.name);
      if (!bad.length) return go();
      toast(
        t('Careful: this may contain {x}, which you’re allergic to.', {
          x: bad.map((a) => t(a)).join(t(', ')),
        }),
        {
          icon: 'warn',
          action: { label: t('Log anyway'), fn: () => void go() },
        },
      );
      return null;
    },
    [logFood, toast, t, allergyCheck],
  );
}
