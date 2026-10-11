import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { WarnChip } from '@/components/food/Chips';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { type DbFood, foodSource, getFood } from '@/lib/foodsDb';
import { fmt, planMeals, scaleIngredients } from '@/lib/nutrition';
import { inGrams } from '@/lib/recipes';
import { useSettings } from '@/theme/settings';

/** One thing you logged today: its numbers, and the ingredients when it came from your plan or the food list. */
export default function LoggedScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const { id } = useLocalSearchParams<{ id: string }>();
  const log = food.logs.find((l) => l.id === id);
  const [dbFood, setDbFood] = useState<{ id: string; f: DbFood | null } | null>(null);

  const foodId = log?.food_id ?? null;
  useEffect(() => {
    if (!foodId) return;
    let alive = true;
    getFood(foodId).then((f) => alive && setDbFood({ id: foodId, f }));
    return () => {
      alive = false;
    };
  }, [foodId]);

  if (!log)
    return (
      <Screen title={t('Meal')} back>
        <Text color="sec">{t('This meal was removed.')}</Text>
      </Screen>
    );

  const meal = log.plan_key ? planMeals(food.plan).find((m) => m.key === log.plan_key) : undefined;
  const ing = meal ? scaleIngredients(meal.r, meal.k) : [];
  const f = dbFood?.id === foodId ? dbFood.f : null;
  const time = new Date(log.created_at).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <Screen title={t('Meal')} back>
      <Text variant="small" weight={700} color="sec">
        {[log.meal ? t(log.meal) : null, time].filter(Boolean).join(', ')}
      </Text>
      <Text variant="h1" style={{ marginTop: 4 }}>
        {meal ? t(meal.r.n) : log.name}
      </Text>
      {f && foodSource(f, lang) ? (
        <Text color="sec" style={{ marginTop: 2 }}>
          {foodSource(f, lang)}
        </Text>
      ) : null}
      {log.sugar_high || log.fat_high ? (
        <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {log.sugar_high ? <WarnChip label={t('High added sugar')} /> : null}
          {log.fat_high ? <WarnChip label={t('High fat')} /> : null}
        </Row>
      ) : null}

      <Row gap={8} style={{ marginTop: 16 }}>
        {(
          [
            ['kcal', fmt(log.kcal)],
            ['Protein', `${Math.round(+log.protein)}${t('g')}`],
            ['Carbs', `${Math.round(+log.carbs)}${t('g')}`],
            ['Fat', `${Math.round(+log.fat)}${t('g')}`],
          ] as const
        ).map(([a, b]) => (
          <Card key={a} style={{ flex: 1, alignItems: 'center', marginBottom: 0, paddingHorizontal: 4 }}>
            <Text num size={18}>
              {b}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(a)}
            </Text>
          </Card>
        ))}
      </Row>

      {meal ? (
        <>
          <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
            {t('Ingredients')}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {ing.map(([n, a, u], i) => (
              <Row key={`${n}-${i}`} gap={10} style={{ minHeight: 52, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Text style={{ flex: 1 }}>{t(n)}</Text>
                <Text num size={15}>
                  {(([v, w]) => `${v} ${t(w)}`)(inGrams(n, a, u))}
                </Text>
              </Row>
            ))}
          </View>
          <Button kind="soft" title={t('See the recipe')} style={{ marginTop: 12 }} color={c.text} onPress={() => router.push({ pathname: '/recipe', params: { key: meal.key } })} />
        </>
      ) : f ? (
        <>
          <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
            {t('Nutrition per 100 {u}', { u: t(f.unit) })}
          </Text>
          <Card>
            {(
              [
                ['Calories', `${fmt(f.kcal_100)} ${t('kcal')}`],
                ['Protein', `${Math.round(f.protein_100 * 10) / 10} ${t('g')}`],
                ['Carbs', `${Math.round(f.carbs_100 * 10) / 10} ${t('g')}`],
                ['Fat', `${Math.round(f.fat_100 * 10) / 10} ${t('g')}`],
                ...(f.sugar_100 != null ? ([['Sugar', `${Math.round(f.sugar_100 * 10) / 10} ${t('g')}`]] as const) : []),
                ...(f.fiber_100 != null ? ([['Fiber', `${Math.round(+f.fiber_100 * 10) / 10} ${t('g')}`]] as const) : []),
                ...(f.sodium_100 != null ? ([['Sodium', `${Math.round(+f.sodium_100)} ${t('mg')}`]] as const) : []),
              ] as const
            ).map(([a, b], i) => (
              <Row key={a} style={{ justifyContent: 'space-between', marginTop: i ? 10 : 0 }}>
                <Text color="sec">{t(a)}</Text>
                <Text weight={700}>{b}</Text>
              </Row>
            ))}
          </Card>
          <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
            {t('One serving: {s}', { s: `${Math.round(f.serving_g)} ${t(f.unit)}` })}
          </Text>
          {f.is_estimate ? (
            <Text variant="xs" color="sec" style={{ marginTop: 4, marginHorizontal: 4 }}>
              {t('These numbers are an estimate.')}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="small" color="sec" style={{ marginTop: 16, marginHorizontal: 4 }}>
          {t('This was logged as a whole meal, so there is no ingredient list.')}
        </Text>
      )}

      <Button
        kind="ghost"
        icon="trash"
        title={t('Delete')}
        color={c.down}
        style={{ marginTop: 20 }}
        onPress={async () => {
          const removed = await food.deleteLog(log.id);
          if (!removed) return;
          toast(t('Removed {name}', { name: removed.name }), { icon: 'trash', undo: () => food.restoreLog(removed) });
          router.back();
        }}
      />
    </Screen>
  );
}
