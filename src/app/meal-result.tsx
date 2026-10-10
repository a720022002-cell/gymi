import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { WarnChip } from '@/components/food/Chips';
import { Thinking } from '@/components/food/Thinking';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useLogFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { takePendingPhoto } from '@/lib/pending';
import type { Photo } from '@/lib/photo';
import { useSettings } from '@/theme/settings';

type Item = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
type Result = { title: string; items: Item[]; sugar_high?: boolean; fat_high?: boolean; note?: string };
/** An item with its numbers per gram, so changing grams scales everything. */
type Row_ = { name: string; g: number; per: { k: number; p: number; c: number; f: number } };

const toRows = (items: Item[]): Row_[] =>
  items.map((x) => {
    const g = Math.max(1, x.grams || 100);
    return { name: x.name, g: Math.round(g), per: { k: (x.kcal || 0) / g, p: (x.protein || 0) / g, c: (x.carbs || 0) / g, f: (x.fat || 0) / g } };
  });

/** What the AI found in your meal photo or your words (design: mealphoto). */
export default function MealResult() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const { text } = useLocalSearchParams<{ text?: string }>();
  const [photo] = useState<Photo | null>(() => takePendingPhoto());
  const [res, setRes] = useState<Result | null>(null);
  const [rows, setRows] = useState<Row_[]>([]);
  const [err, setErr] = useState<AiError | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');

  const run = (withNote?: string) => {
    setBusy(true);
    setErr(null);
    fetchResult(withNote);
  };
  const fetchResult = async (withNote?: string) => {
    const r = photo
      ? await askAI<Result>('meal_photo', { lang, image: photo.base64, mime: photo.mime, note: withNote })
      : await askAI<Result>('food_text', { lang, text: `${text ?? ''}${withNote ? `. ${withNote}` : ''}` });
    setBusy(false);
    if (r.error || !r.result) return setErr(r.error ?? 'failed');
    setRes(r.result);
    setTitle(r.result.title || '');
    setRows(toRows(r.result.items ?? []));
  };

  useEffect(() => {
    if (!photo && !text) {
      router.back();
      return;
    }
    fetchResult();
    // Run once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tot = rows.reduce((a, x) => ({ k: a.k + x.per.k * x.g, p: a.p + x.per.p * x.g, c: a.c + x.per.c * x.g, f: a.f + x.per.f * x.g }), { k: 0, p: 0, c: 0, f: 0 });
  const set = (i: number, patch: Partial<Row_>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const add = async () => {
    if (!rows.length || tot.k <= 0) return;
    const name = title.trim() || rows.map((x) => x.name).join(t(', '));
    const row = await logFood({ name: name.slice(0, 200), kcal: tot.k, protein: tot.p, carbs: tot.c, fat: tot.f, sugar_high: !!res?.sugar_high, fat_high: !!res?.fat_high }, toast, t);
    if (row) router.back();
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
          <Field label={t('Name')} value={title} onChangeText={setTitle} maxLength={80} />
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Ingredients')}
          </Text>
          {rows.length ? (
            <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
              {rows.map((x, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <Springy onPress={() => setRows(rows.filter((_, j) => j !== i))} accessibilityLabel={t('Remove')} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
                  </Springy>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TextInput
                      value={x.name}
                      onChangeText={(v) => set(i, { name: v })}
                      accessibilityLabel={t('Ingredient')}
                      style={{ fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 700), fontSize: 15, color: c.text, outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object}
                    />
                    <Text variant="xs" color="sec">
                      {t('{k} kcal, {p} g protein', { k: fmt(x.per.k * x.g), p: Math.round(x.per.p * x.g) })}
                    </Text>
                  </View>
                  <TextInput
                    value={String(x.g)}
                    onChangeText={(v) => set(i, { g: Math.min(3000, +v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '') || 0) })}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    accessibilityLabel={t('Grams')}
                    style={{ width: 64, height: 40, borderRadius: 10, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 16, color: c.text, outlineStyle: 'none' } as object}
                  />
                  <Text variant="small" weight={700} color="sec">
                    {t('g')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
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
            {res.sugar_high || res.fat_high ? (
              <Row gap={6} style={{ marginTop: 10 }}>
                {res.sugar_high ? <WarnChip label={t('High added sugar')} /> : null}
                {res.fat_high ? <WarnChip label={t('High fat')} /> : null}
              </Row>
            ) : null}
          </Card>
          <Text variant="xs" color="sec" center>
            {t('AI estimate. Check the numbers before you save.')}
          </Text>
          <Button title={t('Add {n} kcal', { n: fmt(tot.k) })} disabled={!rows.length || tot.k <= 0} style={{ marginTop: 12 }} onPress={add} />
        </View>
      ) : null}
    </Screen>
  );
}
