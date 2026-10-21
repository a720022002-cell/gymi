import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorText, Label, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type SavedMeal, useFood, useLogFood } from '@/lib/food';
import { AllergyWarn, useAllergyCheck } from '@/components/food/AllergyWarn';
import { WarnChip } from '@/components/food/Chips';
import { PickFood, per100 } from '@/components/food/PickFood';
import { useScanProduct } from '@/components/food/useScanProduct';
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
  const [editId, setEditId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const allergyCheck = useAllergyCheck();
  // Your allergies in a saved meal: its name, items and ingredients.
  const allergiesOf = (m: SavedMeal) => allergyCheck(m.name, [m.items, ...(m.ingredients ?? []).map((x) => x.n)]);
  const allergyText = (xs: string[]) => xs.map((a) => t(a)).join(t(', '));

  const opened = food.saved.find((m) => m.id === openId);
  const editing = food.saved.find((m) => m.id === editId);
  if (create) return <CreateMeal onDone={() => setCreate(false)} />;
  if (editing) return <CreateMeal edit={editing} onDone={() => setEditId(null)} />;
  if (opened) return <MealDetail m={opened} onClose={() => setOpenId(null)} onEdit={() => setEditId(opened.id)} />;

  const addCode = async () => {
    const v = code.trim().toUpperCase();
    if (!v) return;
    if (!/^MEAL-(?:[A-Z0-9]{4}|[A-Z0-9]{8})$/.test(v)) return setCodeErr(t('No meal with that code.'));
    setAdding(true);
    const r = await food.addMealByCode(v);
    setAdding(false);
    if (r.status === 'not_found') return setCodeErr(t('No meal with that code.'));
    if (r.status === 'slow') return setCodeErr(t('Too many tries. Wait an hour and try again.'));
    if (r.status === 'exists') return setCodeErr(t('That meal is already in your saved meals.'));
    if (r.status !== 'ok' || !r.meal) return setCodeErr(t('Couldn’t save. Please try again.'));
    setCode('');
    // Someone else's meal: say right away if it has something you're allergic to.
    const bad = allergiesOf(r.meal);
    if (bad.length) toast(t('Added “{name}”. Careful: it may contain {x}, which you’re allergic to.', { name: r.meal.name, x: allergyText(bad) }), { icon: 'warn' });
    else toast(t('Added “{name}”', { name: r.meal.name }), { icon: 'bookmark' });
  };

  return (
    <Screen title={t('Saved meals')} back>
      <Card>
        <Text variant="small" weight={700}>
          {t('Add a meal by code')}
        </Text>
        <Row gap={8} style={{ marginTop: 8 }}>
          <TextInput
            value={code}
            onChangeText={(v) => (
              setCode(
                v
                  .toUpperCase()
                  .replace(/[^A-Z0-9-]/g, '')
                  .slice(0, 13),
              ),
              setCodeErr(null)
            )}
            onSubmitEditing={addCode}
            placeholder="MEAL-XXXXXXXX"
            placeholderTextColor={c.sec}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={t('Meal code')}
            style={
              {
                flex: 1,
                minWidth: 0,
                height: 48,
                borderRadius: 14,
                backgroundColor: c.inset,
                paddingHorizontal: 14,
                fontFamily: fontFor('sora', 600),
                fontSize: 16,
                letterSpacing: 0.8,
                color: c.text,
                outlineStyle: 'none',
              } as object
            }
          />
          <Button small title={t('Add')} loading={adding} disabled={!code.trim()} onPress={addCode} />
        </Row>
        <ErrorText>{codeErr}</ErrorText>
      </Card>
      {food.saved.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 16 }}>
          {food.saved.map((m, i) => {
            const bad = allergiesOf(m);
            return (
              <Springy
                key={m.id}
                onPress={() => setOpenId(m.id)}
                scaleTo={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="bookmark" size={18} />
                </View>
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
                  {bad.length ? (
                    <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                      <WarnChip label={t('Contains {x}', { x: allergyText(bad) })} />
                    </View>
                  ) : null}
                </View>
                <Button
                  small
                  title={t('{n} kcal', { n: fmt(m.kcal) })}
                  style={{ paddingHorizontal: 14 }}
                  onPress={() => {
                    const item = { name: m.name, parts: [m.items ?? '', ...(m.ingredients ?? []).map((x) => x.n)].filter(Boolean), kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
                    // One tap logs it, unless it has something you're allergic to: then ask first.
                    if (!bad.length) return logFood(item, toast, t);
                    toast(t('Careful: this may contain {x}, which you’re allergic to.', { x: allergyText(bad) }), { icon: 'warn', action: { label: t('Log anyway'), fn: () => logFood(item, toast, t) } });
                  }}
                />
              </Springy>
            );
          })}
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
        {t('Tap a meal to see its code. Tap the calories to log it.')}
      </Text>
      <Button icon="plus" title={t('Create a meal')} onPress={() => setCreate(true)} />
      <Button kind="glass" icon="play" title={t('Recipe from a video')} style={{ marginTop: 8 }} onPress={() => router.push('/recipe-import')} />
    </Screen>
  );
}

/** One saved meal: totals, its shareable code, log it, or remove it (design: savedmeal). */
function MealDetail({ m, onClose, onEdit }: { m: SavedMeal; onClose: () => void; onEdit: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  const allergyCheck = useAllergyCheck();
  const allergic = allergyCheck(m.name, [m.items, ...(m.ingredients ?? []).map((x) => x.n)]);
  const share = async () => {
    const txt = t('Try my meal on Adro: {n} ({k} kcal, {p} g protein). Add it with code {c}', { n: m.name, k: fmt(m.kcal), p: Math.round(m.protein), c: m.code });
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
        await Clipboard.setStringAsync(txt);
        return toast(t('Copied'), { icon: 'copy' });
      }
      await Share.share({ message: txt });
    } catch {}
  };
  return (
    <Screen title={t('Saved meal')} back onBack={onClose}>
      <Text variant="h2">{m.name}</Text>
      {m.items ? (
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {m.items}
        </Text>
      ) : null}
      <AllergyWarn items={allergic} />
      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{m.servings && m.servings > 1 ? t('One serving') : t('Total')}</Text>
          <Text num size={22}>{`${fmt(m.kcal)} ${t('kcal')}`}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Text variant="small" color="sec">
            {t('Protein {n} g', { n: Math.round(m.protein) })}
          </Text>
          <Text variant="small" color="sec">
            {t('Carbs {n} g', { n: Math.round(m.carbs) })}
          </Text>
          <Text variant="small" color="sec">
            {t('Fat {n} g', { n: Math.round(m.fat) })}
          </Text>
        </Row>
      </Card>
      {m.servings && m.servings > 1 ? (
        <Text variant="small" color="sec" style={{ marginTop: -4, marginBottom: 8, marginHorizontal: 4 }}>
          {t('The numbers are for one serving. The whole recipe makes {n}.', { n: m.servings })}
        </Text>
      ) : null}
      {m.ingredients?.length && m.steps?.length ? (
        <Card>
          <Text weight={700}>{t('Ingredients (one serving)')}</Text>
          {m.ingredients.map((x, i) => (
            <Row key={`${x.n}-${i}`} style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <Text variant="small" style={{ flex: 1 }}>
                {x.n}
              </Text>
              <Text variant="small" color="sec" num>{`${Math.round(x.g)} ${t('g')} · ${fmt(x.k)} ${t('kcal')}`}</Text>
            </Row>
          ))}
        </Card>
      ) : null}
      {m.steps?.length ? (
        <Card>
          <Text weight={700}>{t('Steps')}</Text>
          {m.steps.map((x, i) => (
            <Row key={i} gap={10} style={{ alignItems: 'flex-start', marginTop: 8 }}>
              <Text num weight={700} style={{ color: c.cobalt, minWidth: 18 }}>
                {i + 1}
              </Text>
              <Text variant="small" style={{ flex: 1 }}>
                {x}
              </Text>
            </Row>
          ))}
          {m.source ? (
            <Text variant="xs" color="sec" numberOfLines={1} style={{ marginTop: 10 }}>
              {t('From: {s}', { s: m.source })}
            </Text>
          ) : null}
        </Card>
      ) : null}
      <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text variant="xs" weight={700} color="sec">
          {t('Meal code')}
        </Text>
        <Text num size={30} style={{ marginTop: 4, letterSpacing: 1.8 }}>
          {m.code}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
          {t('Anyone can type this code to add the meal to their saved meals.')}
        </Text>
        <Row gap={10} style={{ marginTop: 12, alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <Button
              small
              kind="glass"
              icon="copy"
              title={t('Copy')}
              style={{ alignSelf: 'stretch' }}
              onPress={async () => {
                await Clipboard.setStringAsync(m.code);
                toast(t('Code copied'), { icon: 'copy' });
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button small icon="share" title={t('Share')} style={{ alignSelf: 'stretch' }} onPress={share} />
          </View>
        </Row>
      </Card>
      <Button kind="soft" icon="edit" title={t('Edit meal')} color={c.text} style={{ marginTop: 8 }} onPress={onEdit} />
      <Button
        title={t('Log this meal')}
        style={{ marginTop: 8 }}
        onPress={async () => {
          const row = await logFood({ name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat }, toast, t);
          if (row) onClose();
        }}
      />
      <Button
        title={t('Remove from saved')}
        kind="ghost"
        color={c.down}
        style={{ marginTop: 8 }}
        onPress={async () => {
          onClose();
          await food.deleteMeal(m.id);
          const { id: _id, ...rest } = m;
          toast(t('Meal removed'), { icon: 'trash', undo: () => food.saveMeal(rest) });
        }}
      />
    </Screen>
  );
}

/** Ingredients of a saved meal, ready to edit (per 100 g from what was saved). A meal saved without a list is one item. */
function toIngs(m: SavedMeal): Ing[] {
  const list = m.ingredients?.filter((x) => x.g > 0) ?? [];
  if (list.length) return list.map((x) => ({ ...x, per: { k: (x.k * 100) / x.g, p: (x.p * 100) / x.g, c: (x.c * 100) / x.g, f: (x.f * 100) / x.g } }));
  return [{ n: m.name, g: 100, k: m.kcal, p: m.protein, c: m.carbs, f: m.fat, per: { k: m.kcal, p: m.protein, c: m.carbs, f: m.fat } }];
}

/** Make a meal, or change one you saved (`edit`). Ingredients come from the food list, a barcode, or your own numbers. */
function CreateMeal({ onDone, edit }: { onDone: () => void; edit?: SavedMeal }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const [name, setName] = useState(edit?.name ?? '');
  const [items, setItems] = useState<Ing[]>(() => (edit ? toIngs(edit) : []));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  // How to make it, one step per box (optional). Up to 30 steps.
  const [steps, setSteps] = useState<string[]>(() => (edit?.steps?.length ? edit.steps : []));
  const setStep = (i: number, v: string) => setSteps((xs) => xs.map((x, j) => (j === i ? v : x)));

  // A scanned product is added as one serving.
  const { scanning, scan } = useScanProduct(
    (f) => setItems((xs) => [...xs, { id: f.id, n: f.n, g: f.g, k: 0, p: 0, c: 0, f: 0, per: f.per }]),
    () => setPicking(true),
  );

  const tot = items.reduce((a, x) => ({ k: a.k + (x.per.k * x.g) / 100, p: a.p + (x.per.p * x.g) / 100, c: a.c + (x.per.c * x.g) / 100, f: a.f + (x.per.f * x.g) / 100 }), { k: 0, p: 0, c: 0, f: 0 });
  const ok = name.trim() && items.some((x) => x.g > 0);

  const save = async () => {
    if (!ok) return;
    setSaving(true);
    const list = items.filter((x) => x.g > 0);
    const meal = {
      name: name.trim(),
      items: list.map((x) => `${x.n} ${Math.round(x.g)} ${t('g')}`).join(', '),
      ingredients: list.map(({ id, n, g, per }) => ({ id, n, g, k: (per.k * g) / 100, p: (per.p * g) / 100, c: (per.c * g) / 100, f: (per.f * g) / 100 })),
      kcal: Math.round(tot.k),
      protein: Math.round(tot.p),
      carbs: Math.round(tot.c),
      fat: Math.round(tot.f),
      steps: (() => {
        const list = steps.map((x) => x.trim().slice(0, 400)).filter(Boolean).slice(0, 30);
        return list.length ? list : null;
      })(),
    };
    const row = edit ? await food.updateMeal(edit.id, meal) : await food.saveMeal(meal);
    setSaving(false);
    if (!row) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Saved {name}', { name: row.name }), { icon: 'bookmark' });
    onDone();
  };

  return (
    <Screen title={t(edit ? 'Edit meal' : 'Create a meal')} back onBack={onDone}>
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
                style={
                  {
                    width: 70,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: c.inset,
                    textAlign: 'center',
                    fontFamily: fontFor('sora', 600),
                    fontSize: 17,
                    color: c.text,
                    outlineStyle: 'none',
                  } as object
                }
              />
              <Text variant="small" weight={700} color="sec">
                {t('g')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Row gap={8} style={{ marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Button small kind="soft" icon="plus" title={t('Add an ingredient')} style={{ alignSelf: 'stretch' }} onPress={() => setPicking(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button small kind="soft" icon="barcode" title={t('Scan a barcode')} loading={scanning} style={{ alignSelf: 'stretch' }} onPress={scan} />
        </View>
      </Row>
      {edit?.servings && edit.servings > 1 ? (
        <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {t('These amounts are for one serving.')}
        </Text>
      ) : null}

      <Label>{t('Steps (optional)')}</Label>
      {steps.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {steps.map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text num weight={700} style={{ color: c.cobalt, minWidth: 18, marginTop: 11 }}>
                {i + 1}
              </Text>
              <TextInput
                value={x}
                onChangeText={(v) => setStep(i, v)}
                placeholder={t(i ? 'Next step' : 'For example: Cook the rice for 15 minutes')}
                placeholderTextColor={c.sec}
                multiline
                maxLength={400}
                accessibilityLabel={t('Step {n}', { n: i + 1 })}
                style={{ flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 10, fontSize: 16, lineHeight: 22, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left', textAlignVertical: 'top' } as object}
              />
              <Springy onPress={() => setSteps(steps.filter((_, j) => j !== i))} accessibilityLabel={t('Remove')} style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
              </Springy>
            </View>
          ))}
        </View>
      ) : null}
      {steps.length < 30 ? (
        <Button small kind="soft" icon="plus" title={t('Add a step')} style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setSteps([...steps, ''])} />
      ) : null}

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
      <Button title={t(edit ? 'Save changes' : 'Save meal')} disabled={!ok} loading={saving} style={{ marginTop: 8 }} onPress={save} />

      <PickFood
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(f) => {
          setPicking(false);
          setItems([...items, { id: f.id, n: foodName(f, lang), g: Math.round(f.serving_g), k: 0, p: 0, c: 0, f: 0, per: per100(f) }]);
        }}
        onOwn={(fs) => {
          setPicking(false);
          setItems((xs) => [...xs, ...fs.map((f) => ({ n: f.n, g: Math.round(f.g), k: 0, p: 0, c: 0, f: 0, per: f.per }))]);
        }}
        onScan={() => {
          setPicking(false);
          scan();
        }}
      />
    </Screen>
  );
}
