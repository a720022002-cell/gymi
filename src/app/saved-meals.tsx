import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Label, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type SavedMeal, useFood, useLogFood } from '@/lib/food';
import { PickFood, per100 } from '@/components/food/PickFood';
import { foodName } from '@/lib/foodsDb';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

type Ing = NonNullable<SavedMeal['ingredients']>[number] & { per: { k: number; p: number; c: number; f: number } };

export default function SavedMeals() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  const [create, setCreate] = useState(false);
  const [confirm, setConfirm] = useState<SavedMeal | null>(null);

  if (create) return <CreateMeal onDone={() => setCreate(false)} />;

  return (
    <Screen title={t('Saved meals')} back>
      {food.saved.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 16 }}>
          {food.saved.map((m, i) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Springy onPress={() => setConfirm(m)} accessibilityLabel={t('Delete')} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trash" size={18} color={c.sec} />
              </Springy>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.items ? (
                  <Text variant="small" color="sec" numberOfLines={2}>
                    {m.items}
                  </Text>
                ) : null}
                <Text variant="xs" color="sec" num>
                  {t('P {p} g, C {c} g, F {f} g', { p: Math.round(m.protein), c: Math.round(m.carbs), f: Math.round(m.fat) })}
                </Text>
              </View>
              <Button
                small
                title={t('{n} kcal', { n: fmt(m.kcal) })}
                style={{ paddingHorizontal: 14 }}
                onPress={() => logFood({ name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat }, toast, t)}
              />
            </View>
          ))}
        </View>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Icon name="bookmark" size={30} color={c.sec} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t('No saved meals yet')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Make a meal you eat often once, then log it with one tap.')}
          </Text>
        </Card>
      )}
      <Text variant="small" color="sec" center style={{ marginBottom: 12 }}>
        {t('Tap the calories to log a meal.')}
      </Text>
      <Button icon="plus" title={t('Create a meal')} onPress={() => setCreate(true)} />

      <Sheet open={!!confirm} onClose={() => setConfirm(null)}>
        <Text variant="h2">{t('Delete {name}?', { name: confirm?.name ?? '' })}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Food you already logged stays in your log.')}
        </Text>
        <Button
          title={t('Delete')}
          kind="danger"
          style={{ marginTop: 16 }}
          onPress={async () => {
            const m = confirm!;
            setConfirm(null);
            await food.deleteMeal(m.id);
            toast(t('Removed {name}', { name: m.name }), { icon: 'check' });
          }}
        />
        <Button title={t('Cancel')} kind="ghost" style={{ marginTop: 8 }} onPress={() => setConfirm(null)} />
      </Sheet>
    </Screen>
  );
}

function CreateMeal({ onDone }: { onDone: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const [name, setName] = useState('');
  const [items, setItems] = useState<Ing[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const tot = items.reduce((a, x) => ({ k: a.k + (x.per.k * x.g) / 100, p: a.p + (x.per.p * x.g) / 100, c: a.c + (x.per.c * x.g) / 100, f: a.f + (x.per.f * x.g) / 100 }), { k: 0, p: 0, c: 0, f: 0 });
  const ok = name.trim() && items.some((x) => x.g > 0);

  const save = async () => {
    if (!ok) return;
    setSaving(true);
    const list = items.filter((x) => x.g > 0);
    const row = await food.saveMeal({
      name: name.trim(),
      items: list.map((x) => `${x.n} ${Math.round(x.g)} ${t('g')}`).join(', '),
      ingredients: list.map(({ id, n, g, per }) => ({ id, n, g, k: (per.k * g) / 100, p: (per.p * g) / 100, c: (per.c * g) / 100, f: (per.f * g) / 100 })),
      kcal: Math.round(tot.k),
      protein: Math.round(tot.p),
      carbs: Math.round(tot.c),
      fat: Math.round(tot.f),
    });
    setSaving(false);
    if (!row) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Saved {name}', { name: row.name }), { icon: 'bookmark' });
    onDone();
  };

  return (
    <Screen title={t('Create a meal')} back onBack={onDone}>
      <Text color="sec">{t('Search each ingredient, set how much, and the calories add up as you go.')}</Text>
      <Field label={t('Meal name')} value={name} onChangeText={setName} placeholder={t('My post-gym bowl')} maxLength={60} />
      <Label>{t('Ingredients')}</Label>
      {items.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
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
                  {t('{n} kcal', { n: fmt((x.per.k * x.g) / 100) })}
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

      <Card style={{ marginTop: 16, alignItems: 'center' }}>
        <Text num size={34}>
          {fmt(tot.k)}
        </Text>
        <Text variant="small" weight={700} color="sec">
          {t('kcal')}
        </Text>
        <Row style={{ marginTop: 10, alignSelf: 'stretch', justifyContent: 'space-around' }}>
          {(
            [
              ['Protein', tot.p],
              ['Carbs', tot.c],
              ['Fat', tot.f],
            ] as const
          ).map(([a, v]) => (
            <View key={a} style={{ alignItems: 'center' }}>
              <Text num>{`${Math.round(v)} ${t('g')}`}</Text>
              <Text variant="xs" weight={700} color="sec">
                {t(a)}
              </Text>
            </View>
          ))}
        </Row>
      </Card>
      <Button title={t('Save meal')} disabled={!ok} loading={saving} style={{ marginTop: 8 }} onPress={save} />

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
