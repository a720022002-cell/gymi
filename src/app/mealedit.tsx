import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { aiErrorText, askAI } from '@/lib/ai';
import { deleteMealPlan, listMealPlans, type MealPlan, saveMealPlan } from '@/lib/coaching';
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
    setMeal(i, { k: Math.round(result.items.reduce((a, x) => a + (+x.kcal || 0), 0)), p: Math.round(result.items.reduce((a, x) => a + (+x.protein || 0), 0)) });
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
          <Button small kind="glass" icon="sparkle" title={t('Work out calories with AI')} loading={ai === i} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => estimate(i)} />
          <Row gap={8} style={{ marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                kcal
              </Text>
              <TextInput value={m.k ? String(m.k) : ''} onChangeText={(v) => setMeal(i, { k: Math.min(5000, num(v)) })} inputMode="numeric" style={[box, { marginTop: 4 }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('Protein g')}
              </Text>
              <TextInput value={m.p ? String(m.p) : ''} onChangeText={(v) => setMeal(i, { p: Math.min(400, num(v)) })} inputMode="numeric" style={[box, { marginTop: 4 }]} />
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
