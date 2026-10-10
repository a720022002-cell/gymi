import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { PickFood, per100 } from '@/components/food/PickFood';

import { TimeField } from '@/components/food/TimeField';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { aiErrorText, askAI } from '@/lib/ai';
import { deleteMealPlan, listMealPlans, type MealPlan, type PlanIng, type PlanMeal, saveMealPlan } from '@/lib/coaching';
import { foodName } from '@/lib/foodsDb';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

const NEW: MealPlan = {
  id: '',
  name: '',
  meals: [
    { n: 'Breakfast', t: '08:00', k: 500, p: 30, d: '' },
    { n: 'Lunch', t: '13:30', k: 700, p: 45, d: '' },
    { n: 'Dinner', t: '20:00', k: 600, p: 40, d: '' },
  ],
};

/** Coach: make or edit a meal plan (design: mealedit). The AI can work out calories from what you write. */
export default function MealEdit() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [p, setP] = useState<MealPlan | null>(id ? null : { ...NEW, meals: NEW.meals.map((m) => ({ ...m, n: m.n })) });
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<number | null>(null);
  const [build, setBuild] = useState<number | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    listMealPlans().then((l) => alive && setP(l.find((x) => x.id === id) ?? NEW));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!p)
    return (
      <Screen title={t('Meal plan')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (build != null && p.meals[build])
    return (
      <MealBuild
        meal={p.meals[build]}
        onBack={() => setBuild(null)}
        onUse={(patch) => {
          setP({ ...p, meals: p.meals.map((m, j) => (j === build ? { ...m, ...patch } : m)) });
          toast(t('{n} updated', { n: p.meals[build].n }), { icon: 'check' });
          setBuild(null);
        }}
      />
    );
  const setMeal = (i: number, patch: Partial<MealPlan['meals'][number]>) => setP({ ...p, meals: p.meals.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const num = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;
  const tot = p.meals.reduce((a, m) => a + (+m.k || 0), 0);
  const pt = p.meals.reduce((a, m) => a + (+m.p || 0), 0);
  const box = { height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 15, color: c.text } as const;

  const estimate = async (i: number) => {
    const m = p.meals[i];
    if (!m.d.trim()) return toast(t('Write what to eat first.'), { icon: 'info' });
    setAi(i);
    const { result, error } = await askAI<{ items: { kcal: number; protein: number }[] }>('food_text', { lang, text: m.d });
    setAi(null);
    if (error || !result) return toast(t(aiErrorText(error ?? 'failed')), { icon: 'warn' });
    setMeal(i, { ing: undefined, c: undefined, f: undefined, k: Math.round(result.items.reduce((a, x) => a + (+x.kcal || 0), 0)), p: Math.round(result.items.reduce((a, x) => a + (+x.protein || 0), 0)) });
  };

  return (
    <Screen title={t('Meal plan')} back>
      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 6 }}>
        {t('Plan name')}
      </Text>
      <TextInput value={p.name} onChangeText={(v) => setP({ ...p, name: v.slice(0, 60) })} placeholder={t('For example: Cut, 1,900 kcal')} placeholderTextColor={c.sec} style={{ height: 50, borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 14, fontSize: 16, color: c.text, marginBottom: 12 }} />
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text weight={700}>{t('Total')}</Text>
        <Text num>{t('{k} kcal, {p} g protein', { k: fmt(tot), p: pt })}</Text>
      </Card>
      {p.meals.map((m, i) => (
        <Card key={i}>
          <Row gap={8}>
            <TextInput value={m.n} onChangeText={(v) => setMeal(i, { n: v.slice(0, 30) })} style={{ flex: 1, fontSize: 16, fontFamily: 'Manrope_700Bold', color: c.text, borderBottomWidth: 1.5, borderBottomColor: c.line, paddingVertical: 4 }} />
            <TimeField value={m.t} onChange={(v) => setMeal(i, { t: v })} label={t('Time')} height={36} />
            <Springy accessibilityLabel={t('Remove meal')} onPress={() => setP({ ...p, meals: p.meals.filter((_, j) => j !== i) })} style={{ width: 30, alignItems: 'center' }}>
              <Icon name="trash" size={16} color={c.down} />
            </Springy>
          </Row>
          <TextInput
            value={m.d}
            onChangeText={(v) => setMeal(i, { d: v.slice(0, 300) })}
            multiline
            placeholder={t('What to eat, for example: 150 g chicken, 1 cup rice, salad')}
            placeholderTextColor={c.sec}
            style={[box, { height: 64, marginTop: 8, paddingTop: 10, textAlignVertical: 'top' }]}
          />
          {m.ing?.length ? (
            <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
              {t('Built from {n} ingredients', { n: m.ing.length })}
            </Text>
          ) : null}
          <Row gap={8} style={{ marginTop: 8 }}>
            <Button small kind="soft" icon="search" title={t('Ingredients')} style={{ flex: 1 }} onPress={() => setBuild(i)} />
            <Button small kind="glass" icon="sparkle" title={t('Ask AI')} loading={ai === i} style={{ flex: 1 }} onPress={() => estimate(i)} />
          </Row>
          <Row gap={8} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                kcal
              </Text>
              <TextInput value={m.k ? String(m.k) : ''} onChangeText={(v) => setMeal(i, { k: Math.min(5000, num(v)), ing: undefined })} inputMode="numeric" style={[box, { marginTop: 4 }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('Protein g')}
              </Text>
              <TextInput value={m.p ? String(m.p) : ''} onChangeText={(v) => setMeal(i, { p: Math.min(400, num(v)), ing: undefined })} inputMode="numeric" style={[box, { marginTop: 4 }]} />
            </View>
          </Row>
        </Card>
      ))}
      {p.meals.length < 8 ? <Button kind="soft" icon="plus" title={t('Add a meal')} onPress={() => setP({ ...p, meals: [...p.meals, { n: t('Snack'), t: '16:00', k: 250, p: 20, d: '' }] })} /> : null}
      <Button
        title={t('Save')}
        loading={busy}
        disabled={!p.name.trim() || !p.meals.length}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setBusy(true);
          const r = await saveMealPlan({ ...p, id: p.id || undefined });
          setBusy(false);
          if (!r) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Meal plan saved. Clients on it see the changes.'), { icon: 'check' });
          router.back();
        }}
      />
      {p.id ? (
        <Button
          kind="ghost"
          icon="trash"
          title={t('Delete meal plan')}
          color={c.down}
          style={{ marginTop: 8 }}
          onPress={async () => {
            await deleteMealPlan(p.id);
            toast(t('Meal plan deleted'), { icon: 'trash' });
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}

type Item = PlanIng & { per: { k: number; p: number; c: number; f: number } };

/** Build one meal from food-database ingredients; calories and macros add up (design: mealbuild). */
function MealBuild({ meal, onBack, onUse }: { meal: PlanMeal; onBack: () => void; onUse: (patch: Partial<PlanMeal>) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(() =>
    (meal.ing ?? []).map((x) => {
      const d = x.g / 100 || 1;
      return { ...x, per: { k: x.k / d, p: x.p / d, c: x.c / d, f: x.f / d } };
    }),
  );
  const [picking, setPicking] = useState(false);
  const of = (x: Item) => ({ k: (x.per.k * x.g) / 100, p: (x.per.p * x.g) / 100, c: (x.per.c * x.g) / 100, f: (x.per.f * x.g) / 100 });
  const tot = items.reduce((a, x) => {
    const v = of(x);
    return { k: a.k + v.k, p: a.p + v.p, c: a.c + v.c, f: a.f + v.f };
  }, { k: 0, p: 0, c: 0, f: 0 });

  const use = () => {
    const list = items.filter((x) => x.g > 0);
    if (!list.length) return toast(t('Add at least one ingredient'), { icon: 'info' });
    onUse({
      ing: list.map((x) => {
        const v = of(x);
        return { id: x.id, n: x.n, g: Math.round(x.g), k: Math.round(v.k), p: Math.round(v.p * 10) / 10, c: Math.round(v.c * 10) / 10, f: Math.round(v.f * 10) / 10 };
      }),
      k: Math.round(tot.k),
      p: Math.round(tot.p),
      c: Math.round(tot.c),
      f: Math.round(tot.f),
      d: list.map((x) => `${Math.round(x.g)} ${t('g')} ${x.n}`).join(', ').slice(0, 300),
    });
  };

  return (
    <Screen title={meal.n} back onBack={onBack}>
      <Text color="sec">{t('Search each ingredient and set how much. Calories and protein fill in for this meal.')}</Text>
      {items.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginTop: 12 }}>
          {items.map((x, i) => (
            <View key={`${x.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Springy onPress={() => setItems(items.filter((_, j) => j !== i))} accessibilityLabel={t('Remove')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
              </Springy>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={2}>
                  {x.n}
                </Text>
                <Text variant="xs" color="sec">
                  {t('{n} kcal', { n: fmt(of(x).k) })}
                </Text>
              </View>
              <TextInput
                value={String(Math.round(x.g))}
                onChangeText={(v) => setItems(items.map((y, j) => (j === i ? { ...y, g: Math.min(3000, +v.replace(/[^\d]/g, '') || 0) } : y)))}
                inputMode="numeric"
                keyboardType="number-pad"
                accessibilityLabel={t('Grams')}
                style={{ width: 70, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
              />
              <Text variant="small" weight={700} color="sec">
                {t('g')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Button small kind="soft" icon="plus" title={t('Add an ingredient')} style={{ marginTop: 10, alignSelf: 'stretch' }} onPress={() => setPicking(true)} />
      <Card style={{ marginTop: 16 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t('This meal')}</Text>
          <Text num size={22}>
            {t('{n} kcal', { n: fmt(tot.k) })}
          </Text>
        </Row>
        <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
          {(
            [
              ['Protein', tot.p],
              ['Carbs', tot.c],
              ['Fat', tot.f],
            ] as const
          ).map(([a, v]) => (
            <Text key={a} variant="small" color="sec">{`${t(a)} ${Math.round(v)} ${t('g')}`}</Text>
          ))}
        </Row>
      </Card>
      <Button title={t('Use for {n}', { n: meal.n })} style={{ marginTop: 8 }} onPress={use} />
      <PickFood
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(f) => {
          setPicking(false);
          setItems([...items, { id: f.id, n: foodName(f, lang), g: Math.round(f.serving_g), k: 0, p: 0, c: 0, f: 0, per: per100(f) }]);
        }}
      />
    </Screen>
  );
}
