import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { WarnChip } from '@/components/food/Chips';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useLogFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { takePendingPhoto } from '@/lib/pending';
import type { Photo } from '@/lib/photo';
import { useSettings } from '@/theme/settings';

type Label = { name?: string; unit?: 'g' | 'ml'; serving?: number; kcal_100: number; protein_100: number; carbs_100: number; fat_100: number; sugar_100?: number; readable: boolean };
const num = (s: string) => +s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٫]/g, '.') || 0;
const clean = (s: string) => s.replace(/[^\d.,٠-٩٫]/g, '').slice(0, 6);

/** Numbers read from a nutrition label photo (design: labelresult). */
export default function LabelResult() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const [photo] = useState<Photo | null>(() => takePendingPhoto());
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<AiError | null>(null);
  const [unit, setUnit] = useState<'g' | 'ml'>('g');
  const [v, setV] = useState({ name: '', k: '', p: '', c: '', f: '', s: '', g: '100' });

  const fetchLabel = async () => {
    const r = await askAI<Label>('label_photo', { lang, image: photo?.base64, mime: photo?.mime });
    setBusy(false);
    if (r.error || !r.result) return setErr(r.error ?? 'failed');
    const x = r.result;
    if (!x.readable) toast(t('Some numbers were hard to read. Please check them.'), { icon: 'info' });
    setUnit(x.unit === 'ml' ? 'ml' : 'g');
    const r1 = (n?: number) => (n == null ? '' : String(Math.round(n * 10) / 10));
    setV({ name: x.name ?? '', k: r1(x.kcal_100), p: r1(x.protein_100), c: r1(x.carbs_100), f: r1(x.fat_100), s: r1(x.sugar_100), g: String(Math.round(x.serving || 100)) });
  };

  useEffect(() => {
    if (!photo) {
      router.back();
      return;
    }
    const id = setTimeout(fetchLabel, 0);
    return () => clearTimeout(id);
    // Read the label once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = num(v.g) / 100;
  const k = num(v.k) * m;
  const sugar = num(v.s) * m;
  const ok = v.name.trim() && num(v.k) > 0 && m > 0;
  const set = (key: keyof typeof v) => (s: string) => setV({ ...v, [key]: key === 'name' ? s : clean(s) });

  const add = async () => {
    if (!ok) return;
    const row = await logFood(
      { name: `${v.name.trim()}, ${Math.round(num(v.g))} ${t(unit)}`, kcal: k, protein: num(v.p) * m, carbs: num(v.c) * m, fat: num(v.f) * m, sugar_high: sugar >= 10, fat_high: num(v.f) >= 17.5 },
      toast,
      t,
    );
    if (row) router.back();
  };

  return (
    <Screen title={t('Label read')} back>
      {photo ? (
        <View style={{ alignItems: 'center' }}>
          <Image source={{ uri: photo.uri }} style={{ width: 140, height: 140, borderRadius: 22 }} contentFit="cover" />
        </View>
      ) : null}
      {busy ? (
        <View style={{ paddingTop: 30 }}>
          <Thinking message={t('Reading the label')} />
        </View>
      ) : err ? (
        <Card style={{ marginTop: 16, alignItems: 'center', paddingVertical: 22 }}>
          <Icon name="warn" size={28} color={c.sec} />
          <Text center style={{ marginTop: 8 }}>
            {t(aiErrorText(err))}
          </Text>
          <Button
            small
            kind="soft"
            title={t('Try again')}
            style={{ marginTop: 12, alignSelf: 'center' }}
            onPress={() => {
              setBusy(true);
              setErr(null);
              fetchLabel();
            }}
          />
        </Card>
      ) : (
        <View>
          <Text variant="small" color="sec" center style={{ marginTop: 12 }}>
            {t('Per 100 {u}. Fix anything that looks wrong.', { u: t(unit) })}
          </Text>
          <Field label={t('Name')} value={v.name} onChangeText={set('name')} placeholder={t('Granola')} maxLength={80} />
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label={t('Calories')} value={v.k} onChangeText={set('k')} inputMode="decimal" ltr unit={t('kcal')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Protein')} value={v.p} onChangeText={set('p')} inputMode="decimal" ltr unit={t('g')} />
            </View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label={t('Carbs')} value={v.c} onChangeText={set('c')} inputMode="decimal" ltr unit={t('g')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Fat')} value={v.f} onChangeText={set('f')} inputMode="decimal" ltr unit={t('g')} />
            </View>
          </Row>
          <Field label={t('Sugar')} optional={t('(optional)')} value={v.s} onChangeText={set('s')} inputMode="decimal" ltr unit={t('g')} />
          <Field label={t('How much you ate')} value={v.g} onChangeText={set('g')} inputMode="decimal" ltr unit={t(unit)} />
          <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {[30, 50, 100, 200].map((g) => (
              <Chip key={g} title={`${g} ${t(unit)}`} on={num(v.g) === g} onPress={() => setV({ ...v, g: String(g) })} />
            ))}
          </Row>
          <Card style={{ marginTop: 16, alignItems: 'center' }}>
            <Text num size={36}>
              {fmt(k)}
            </Text>
            <Text variant="small" weight={700} color="sec">
              {t('kcal')}
            </Text>
            {sugar >= 10 ? (
              <View style={{ marginTop: 8 }}>
                <WarnChip label={t('High sugar: {n} g', { n: Math.round(sugar) })} />
              </View>
            ) : null}
          </Card>
          <Button title={ok ? t('Add {n} kcal', { n: fmt(k) }) : t('Add to log')} disabled={!ok} onPress={add} />
        </View>
      )}
    </Screen>
  );
}
