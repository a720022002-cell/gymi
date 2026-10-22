import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { AllergyWarn, useAllergyCheck } from '@/components/food/AllergyWarn';
import { WarnChip } from '@/components/food/Chips';
import { per100, PickFood } from '@/components/food/PickFood';
import { useScanProduct } from '@/components/food/useScanProduct';
import { Thinking } from '@/components/food/Thinking';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useFood, useLogFood } from '@/lib/food';
import { foodName } from '@/lib/foodsDb';
import { fmt, hhmmOf, mealAt, mealChoices, planMeals } from '@/lib/nutrition';
import { takePendingPhoto } from '@/lib/pending';
import { type Photo, takePhoto } from '@/lib/photo';
import { naturalSugar } from '@/lib/sugar';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

type Item = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
type Result = { title: string; items: Item[]; sugar_high?: boolean; fat_high?: boolean; note?: string; alternatives?: string[]; confidence?: 'high' | 'medium' | 'low' };
/** An item with its numbers per gram; g is the amount in the chosen unit, so changing it scales everything. */
type Row_ = { name: string; g: number; txt?: string; u: Unit; per: { k: number; p: number; c: number; f: number }; own?: boolean };

const UNITS = ['g', 'tbsp', 'tsp', 'piece', 'cup'] as const;
type Unit = (typeof UNITS)[number];
/** Grams in one unit (design: itemCalc). Oils are lighter per spoon; eggs and dates are small pieces. */
function unitG(u: Unit, name: string): number {
  const n = name.toLowerCase();
  if (u === 'g') return 1;
  if (u === 'tbsp') return /oil|ghee|butter|زيت|سمن|زبدة/.test(n) ? 13.5 : /honey|عسل/.test(n) ? 21 : 15;
  if (u === 'tsp') return unitG('tbsp', name) / 3;
  if (u === 'cup') return /milk|laban|juice|water|soup|حليب|لبن|عصير|شوربة/.test(n) ? 240 : 160;
  // Eggs: "eggplant" and "أبيض" (white) aren't eggs.
  return /\beggs?\b|(?<![\u0600-\u06FF])(?:ال)?بيض(?:ة|ه|ات)?(?![\u0600-\u06FF])/.test(n) ? 50 : /date|تمر/.test(n) ? 8 : 100;
}
const grams = (x: Row_) => x.g * unitG(x.u, x.name);
/** Switch to the next unit, keeping about the same amount of food. */
function nextUnit(x: Row_): Partial<Row_> {
  const u = UNITS[(UNITS.indexOf(x.u) + 1) % UNITS.length];
  const v = grams(x) / unitG(u, x.name);
  return { u, txt: undefined, g: u === 'g' ? Math.round(v) : Math.max(0.5, Math.round(v * 2) / 2) };
}

const toRows = (items: Item[]): Row_[] =>
  items.map((x) => {
    const g = Math.max(1, x.grams || 100);
    return { name: x.name, g: Math.round(g), u: 'g', per: { k: (x.kcal || 0) / g, p: (x.protein || 0) / g, c: (x.carbs || 0) / g, f: (x.fat || 0) / g } };
  });

/** The planned meal closest before now, else the first one. */

/** What the AI found in your meal photo or your words (design: mealphoto). */
export default function MealResult() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const food = useFood();
  const { text } = useLocalSearchParams<{ text?: string }>();
  const [photo, setPhoto] = useState<Photo | null>(() => takePendingPhoto());
  const planned = planMeals(food.plan);
  const mealNames = mealChoices(planned);
  // The meal picked when you started logging; else the one for this time of day (an earlier day: a snack).
  const [meal, setMeal] = useState(() => food.mealPick ?? (food.isToday ? mealAt(planned, hhmmOf()) : 'Snack'));
  const [picking, setPicking] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [rows, setRows] = useState<Row_[]>([]);
  const [err, setErr] = useState<AiError | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  // A scanned product is added as one more ingredient (the photo isn't looked at again).
  const { scanning, scan } = useScanProduct(
    (f) => setRows((xs) => [...xs, { name: f.n, g: f.g, u: 'g', own: true, per: { k: f.per.k / 100, p: f.per.p / 100, c: f.per.c / 100, f: f.per.f / 100 } }]),
    () => setPicking(true),
  );

  const run = (withNote?: string, pic = photo) => {
    setBusy(true);
    setErr(null);
    fetchResult(withNote, pic);
  };
  const fetchResult = async (withNote?: string, pic = photo) => {
    const r = pic
      ? await askAI<Result>('meal_photo', { lang, image: pic.base64, mime: pic.mime, note: withNote })
      : await askAI<Result>('food_text', { lang, text: `${text ?? ''}${withNote ? `. ${withNote}` : ''}` });
    setBusy(false);
    if (r.error || !r.result) return setErr(r.error ?? 'failed');
    setRes(r.result);
    setTitle(r.result.title || '');
    setRows(toRows(r.result.items ?? []));
  };

  useEffect(() => {
    if (!photo && !text) {
      goBack();
      return;
    }
    fetchResult();
    // Run once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tot = rows.reduce(
    (a, x) => {
      const g = grams(x);
      return { k: a.k + x.per.k * g, p: a.p + x.per.p * g, c: a.c + x.per.c * g, f: a.f + x.per.f * g };
    },
    { k: 0, p: 0, c: 0, f: 0 },
  );
  const retake = async (camera: boolean) => {
    const p = await takePhoto(camera);
    if (!p) return;
    setPhoto(p);
    setRows([]);
    setRes(null);
    run(note.trim() || undefined, p);
  };
  const set = (i: number, patch: Partial<Row_>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // The AI's sugar flag, but never for plain fruit, dates or milk (their sugar is natural).
  const sugarHigh = !!res?.sugar_high && !rows.every((x) => naturalSugar(x.name));
  // High fat from the grams themselves (over about 21 g in one meal), so it's the same every time.
  const fatHigh = tot.f > 21;
  // Your allergies in what the AI found (the dish's name and every item).
  const allergyCheck = useAllergyCheck();
  const allergic = allergyCheck([title, res?.title ?? ''].join(' | '), rows.map((x) => x.name));
  const add = async () => {
    if (!rows.length || tot.k <= 0) return;
    const name = title.trim() || rows.map((x) => x.name).join(t(', '));
    const row = await logFood({ name: name.slice(0, 200), parts: rows.map((x) => x.name), kcal: tot.k, protein: tot.p, carbs: tot.c, fat: tot.f, meal, sugar_high: sugarHigh, fat_high: fatHigh }, toast, t);
    if (row) goBack();
  };

  return (
    <Screen title={t(photo ? 'Your meal' : 'What you ate')} back>
      {photo ? (
        <View style={{ alignItems: 'center' }}>
          <Image source={{ uri: photo.uri }} style={{ width: 180, height: 180, borderRadius: 90 }} contentFit="cover" />
        </View>
      ) : (
        <Card>
          <Text variant="small" color="sec">
            {t('You said')}
          </Text>
          <Text weight={700}>{text}</Text>
        </Card>
      )}

      {busy ? (
        <View style={{ paddingTop: 30 }}>
          <Thinking message={t(photo ? 'Looking at your meal' : 'Working out the calories')} />
        </View>
      ) : err ? (
        <Card style={{ marginTop: 16, alignItems: 'center', paddingVertical: 22 }}>
          <Icon name="warn" size={28} color={c.sec} />
          <Text center style={{ marginTop: 8 }}>
            {t(aiErrorText(err))}
          </Text>
          <Button small kind="soft" title={t('Try again')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => run(note || undefined)} />
        </Card>
      ) : res ? (
        <View>
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
            <Mark size={22} color={c.cobalt} stroke={4.5} />
            <Text variant="small" weight={700} style={{ flex: 1 }}>
              {rows.length ? t('I found these. Fix anything that’s wrong, delete what isn’t there, or add what I missed.') : res.note || t('I couldn’t find food in this photo.')}
            </Text>
          </Card>
          {photo && rows.length && res.alternatives?.length ? (
            <View style={{ marginTop: 4 }}>
              <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 6 }}>
                {t(res.confidence === 'low' ? 'I’m not sure. Is it one of these?' : 'Not {x}? Pick the right dish:', { x: res.title })}
              </Text>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {res.alternatives.slice(0, 3).map((a) => (
                  <Chip key={a} title={a} onPress={() => run(`It is ${a}.${note.trim() ? ` ${note.trim()}` : ''}`)} />
                ))}
              </Row>
            </View>
          ) : null}
          <AllergyWarn items={allergic} />
          <Field label={t('Name')} value={title} onChangeText={setTitle} maxLength={80} />
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Ingredients')}
          </Text>
          {rows.length ? (
            <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
              {rows.map((x, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <Springy onPress={() => setRows(rows.filter((_, j) => j !== i))} accessibilityLabel={t('Remove')} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
                  </Springy>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TextInput
                      value={x.name}
                      onChangeText={(v) => set(i, { name: v })}
                      accessibilityLabel={t('Ingredient')}
                      style={
                        { fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 700), fontSize: 15, color: c.text, outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object
                      }
                    />
                    <Text variant="xs" color="sec">
                      {t('{k} kcal, {p} g protein', { k: fmt(x.per.k * grams(x)), p: Math.round(x.per.p * grams(x)) })}
                      {x.own ? `, ${t('your numbers')}` : ''}
                    </Text>
                  </View>
                  <TextInput
                    value={x.txt ?? String(x.g)}
                    onChangeText={(v) => {
                      const txt = v
                        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                        .replace(/[,٫]/g, '.')
                        .replace(/[^\d.]/g, '')
                        .slice(0, 6);
                      set(i, { txt, g: Math.min(3000, +txt || 0) });
                    }}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('Amount')}
                    style={
                      {
                        width: 64,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: c.inset,
                        textAlign: 'center',
                        fontFamily: fontFor('sora', 600),
                        fontSize: 16,
                        color: c.text,
                        outlineStyle: 'none',
                      } as object
                    }
                  />
                  <Springy
                    onPress={() => set(i, nextUnit(x))}
                    accessibilityLabel={t('Unit')}
                    style={{ minWidth: 52, height: 40, borderRadius: 10, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                    <Text variant="small" weight={700}>
                      {t(x.u)}
                    </Text>
                  </Springy>
                </View>
              ))}
            </View>
          ) : null}
          <Button small kind="soft" icon="plus" title={t('Add an ingredient')} loading={scanning} style={{ marginTop: 10, alignSelf: 'stretch' }} onPress={() => setPicking(true)} />
          <Field label={t('How was it cooked?')} optional={t('(optional)')} value={note} onChangeText={setNote} placeholder={t('For example: chicken grilled, rice cooked with a little ghee.')} />
          {note.trim() ? <Button small kind="soft" icon="sparkle" title={t('Ask again with this')} style={{ marginTop: 8 }} onPress={() => run(note.trim())} /> : null}

          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text num size={40}>
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
            {sugarHigh || fatHigh ? (
              <Row gap={6} style={{ marginTop: 10 }}>
                {sugarHigh ? <WarnChip label={t('High added sugar')} /> : null}
                {fatHigh ? <WarnChip label={t('High fat')} /> : null}
              </Row>
            ) : null}
          </Card>
          <Text variant="xs" color="sec" center>
            {t('AI estimate. Check the numbers before you save.')}
          </Text>
          <Label>{t('Add to')}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {mealNames.map((m) => (
              <Chip
                key={m}
                title={t(m)}
                on={meal === m}
                onPress={() => {
                  setMeal(m);
                  food.setMealPick(m);
                }}
              />
            ))}
          </Row>
          <Button title={t('Add {n} kcal', { n: fmt(tot.k) })} disabled={!rows.length || tot.k <= 0} style={{ marginTop: 16 }} onPress={add} />
        </View>
      ) : null}
      {photo && !busy ? (
        <Row gap={10} style={{ marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button kind="glass" icon="camera" title={t('Retake photo')} style={{ alignSelf: 'stretch' }} onPress={() => retake(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="glass" icon="image" title={t('Choose from photos')} style={{ alignSelf: 'stretch' }} onPress={() => retake(false)} />
          </View>
        </Row>
      ) : null}
      <PickFood
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(f) => {
          setPicking(false);
          const per = per100(f);
          setRows([...rows, { name: foodName(f, lang), g: Math.round(f.serving_g), u: 'g', per: { k: per.k / 100, p: per.p / 100, c: per.c / 100, f: per.f / 100 } }]);
        }}
        onOwn={(fs) => {
          setPicking(false);
          setRows((xs) => [...xs, ...fs.map((f) => ({ name: f.n, g: Math.round(f.g), u: 'g' as const, own: true, per: { k: f.per.k / 100, p: f.per.p / 100, c: f.per.c / 100, f: f.per.f / 100 } }))]);
        }}
        onScan={() => {
          setPicking(false);
          scan();
        }}
      />
    </Screen>
  );
}
