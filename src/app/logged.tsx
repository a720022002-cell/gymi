import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { WarnChip } from '@/components/food/Chips';
import { NutritionFacts, useMyFacts } from '@/components/food/NutritionFacts';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { type DbFood, foodSource, getFood } from '@/lib/foodsDb';
import { type Facts, factsKey, factsOf, offFactsFor, withMine } from '@/lib/nutrients';
import { fmt, hhmmOf, mealAt, mealChoices, planMeals, scaleIngredients } from '@/lib/nutrition';
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
  // Editing the name and numbers (strings while you type).
  const [edit, setEdit] = useState<{ name: string; k: string; p: string; c: string; f: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const foodId = log?.food_id ?? null;
  // A scanned product that isn't in our food list: its label from Open Food Facts.
  const barcode = !foodId ? (log?.barcode ?? null) : null;
  const [off, setOff] = useState<{ code: string; f: Facts } | null>(null);
  useEffect(() => {
    if (!barcode) return;
    let alive = true;
    offFactsFor(barcode).then((f) => alive && setOff({ code: barcode, f }));
    return () => {
      alive = false;
    };
  }, [barcode]);
  const key = factsKey(foodId, barcode);
  const [mine, setMine] = useMyFacts(key);
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

  // The plan's meal for that slot, only while it's still the dish you logged (you may have changed the meal since).
  const slot = log.plan_key ? planMeals(food.plan, log.day, food.dayGoal(log.day)).find((m) => m.key === log.plan_key) : undefined;
  const meal = slot && (log.name === t(slot.r.n) || log.name === slot.r.n) ? slot : undefined;
  const ing = meal ? scaleIngredients(meal.r, meal.k) : [];
  const f = dbFood?.id === foodId ? dbFood.f : null;
  const planned = planMeals(food.plan);
  const mealNames = mealChoices(planned);
  const curMeal = log.meal || mealAt(planned, hhmmOf(new Date(log.created_at)));
  const num = (v: string) => +v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٫]/g, '.') || 0;
  const numField = (k: 'k' | 'p' | 'c' | 'f', label: string, unit: string) =>
    edit ? (
      <View style={{ flex: 1 }}>
        <Field label={label} value={edit[k]} onChangeText={(v) => setEdit({ ...edit, [k]: v.replace(/[^\d.,٠-٩٫]/g, '').slice(0, 7) })} inputMode="decimal" keyboardType="decimal-pad" ltr unit={unit} />
      </View>
    ) : null;
  const r1 = (n: number) => String(Math.round(n * 10) / 10);
  const scale = (m: number) => edit && setEdit({ ...edit, k: String(Math.round(num(edit.k) * m)), p: r1(num(edit.p) * m), c: r1(num(edit.c) * m), f: r1(num(edit.f) * m) });
  const save = async () => {
    if (!edit) return;
    setSaving(true);
    const ok = await food.updateLog(log.id, { name: edit.name.trim().slice(0, 200), kcal: Math.round(num(edit.k)), protein: Math.round(num(edit.p) * 10) / 10, carbs: Math.round(num(edit.c) * 10) / 10, fat: Math.round(num(edit.f) * 10) / 10 });
    setSaving(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setEdit(null);
    toast(t('Saved'), { icon: 'check' });
  };
  const time = new Date(log.created_at).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <Screen title={t('Meal')} back>
      <Text variant="small" weight={700} color="sec">
        {[t(curMeal), time].join(', ')}
      </Text>
      <Text variant="h1" style={{ marginTop: 4 }}>
        {log.name}
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

      {/* Which meal it counts under; tap another to move it. */}
      <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {mealNames.map((m) => (
          <Chip key={m} title={t(m)} on={curMeal === m} onPress={() => food.setLogMeal(log.id, m)} />
        ))}
      </Row>

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

      {edit ? (
        <View style={{ marginTop: 4 }}>
          <Field label={t('Name')} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} maxLength={200} />
          <Row gap={10}>
            {numField('k', t('Calories'), t('kcal'))}
            {numField('p', t('Protein'), t('g'))}
          </Row>
          <Row gap={10}>
            {numField('c', t('Carbs'), t('g'))}
            {numField('f', t('Fat'), t('g'))}
          </Row>
          <Text variant="xs" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 6 }}>
            {t('Ate more or less? Change the portion')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {[0.5, 1.5, 2].map((m) => (
              <Chip key={m} title={m === 0.5 ? '½' : `${m}×`} onPress={() => scale(m)} />
            ))}
          </Row>
          <Row gap={8} style={{ marginTop: 16 }}>
            <Button kind="glass" title={t('Cancel')} style={{ flex: 1 }} onPress={() => setEdit(null)} />
            <Button title={t('Save')} loading={saving} disabled={!edit.name.trim() || !(num(edit.k) >= 0)} style={{ flex: 1 }} onPress={save} />
          </Row>
        </View>
      ) : (
        <Button
          kind="soft"
          icon="edit"
          title={t('Edit')}
          color={c.text}
          style={{ marginTop: 12 }}
          onPress={() => setEdit({ name: log.name, k: String(Math.round(+log.kcal)), p: String(+log.protein), c: String(+log.carbs), f: String(+log.fat) })}
        />
      )}

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
          <Button kind="soft" title={t('See the recipe')} style={{ marginTop: 12 }} color={c.text} onPress={() => router.push({ pathname: '/recipe', params: { key: meal.key, day: log.day } })} />
        </>
      ) : f ? (
        <>
          <View style={{ marginTop: 10 }}>
            <NutritionFacts per100={factsOf(f, mine)} grams={100} unit={f.unit} serving={f.serving_g} factsKey={key} mine={mine} onMine={setMine} />
          </View>
          <Text variant="small" color="sec" style={{ marginTop: 12, marginHorizontal: 4 }}>
            {t('One serving: {s}', { s: `${Math.round(f.serving_g)} ${t(f.unit)}` })}
          </Text>
          {f.is_estimate ? (
            <Text variant="xs" color="sec" style={{ marginTop: 4, marginHorizontal: 4 }}>
              {t('These numbers are an estimate.')}
            </Text>
          ) : null}
        </>
      ) : barcode && off && off.code === barcode && Object.keys(off.f).length ? (
        <View style={{ marginTop: 10 }}>
          <NutritionFacts per100={withMine(off.f, mine)} grams={100} unit="g" factsKey={key} mine={mine} onMine={setMine} />
        </View>
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
