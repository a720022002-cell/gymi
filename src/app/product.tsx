import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { WarnChip } from '@/components/food/Chips';
import { Stepper } from '@/components/food/Stepper';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useLogFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

type Product = {
  name: string;
  brand: string;
  image: string | null;
  unit: 'g' | 'ml';
  /** Size of one serving, or the whole pack when there is no serving size. */
  size: number;
  k: number;
  p: number;
  c: number;
  f: number;
  sugar: number;
};

type Nutriments = Record<string, number | string | undefined>;

async function lookup(code: string, lang: 'en' | 'ar'): Promise<Product | null> {
  const fields = 'product_name,product_name_ar,product_name_en,brands,quantity,serving_quantity,nutriments,image_front_small_url';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`);
  if (!res.ok) return null;
  const j = await res.json();
  const x = j?.product;
  const n: Nutriments = x?.nutriments ?? {};
  const kcal = +(n['energy-kcal_100g'] ?? 0) || +(n['energy_100g'] ?? 0) / 4.184;
  const name = (lang === 'ar' && x?.product_name_ar) || x?.product_name || x?.product_name_en || x?.product_name_ar;
  if (j?.status !== 1 || !name || !kcal) return null;
  const q = String(x.quantity ?? '').toLowerCase();
  const unit = /\d\s*(ml|cl|l)\b/.test(q) ? 'ml' : 'g';
  const m = q.match(/([\d.,]+)\s*(ml|cl|l|kg|g)\b/);
  let pack = m ? parseFloat(m[1].replace(',', '.')) * ({ ml: 1, cl: 10, l: 1000, kg: 1000, g: 1 } as Record<string, number>)[m[2]] : 0;
  if (!(pack > 0) || pack > 5000) pack = 0;
  const serving = +(x.serving_quantity ?? 0);
  return {
    name: String(name).trim(),
    brand: String(x.brands ?? '').split(',')[0].trim(),
    image: x.image_front_small_url ?? null,
    unit,
    size: Math.round(serving > 0 && serving < 2000 ? serving : pack || 100),
    k: kcal,
    p: +(n.proteins_100g ?? 0),
    c: +(n.carbohydrates_100g ?? 0),
    f: +(n.fat_100g ?? 0),
    sugar: +(n.sugars_100g ?? 0),
  };
}

export default function ProductScreen() {
  const { t, lang } = useT();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'error'>(code ? 'loading' : 'missing');
  const [prod, setProd] = useState<Product | null>(null);

  useEffect(() => {
    if (!code) return;
    let live = true;
    lookup(code, lang)
      .then((p) => {
        if (!live) return;
        setProd(p);
        setState(p ? 'found' : 'missing');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
  }, [code, lang]);

  return (
    <Screen title={t('Product')} back>
      {state === 'loading' ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <ActivityIndicator />
          <Text color="sec">{t('Looking it up…')}</Text>
        </View>
      ) : state === 'found' && prod ? (
        <Found x={prod} code={code!} />
      ) : (
        <Manual code={code} offline={state === 'error'} />
      )}
    </Screen>
  );
}

function Found({ x, code }: { x: Product; code: string }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const [um, setUm] = useState<'serving' | 'g'>('serving');
  const [sv, setSv] = useState(1);
  const [g, setG] = useState(String(x.size));
  const grams = um === 'serving' ? sv * x.size : +g || 0;
  const m = grams / 100;
  const sugar = x.sugar * m;
  const chips = [100, Math.round(x.size / 2), 250, x.size].filter((v, i, a) => v > 0 && a.indexOf(v) === i).sort((a, b) => a - b);

  const add = async () => {
    if (!(grams > 0)) return;
    const name = um === 'serving' ? (sv === 1 ? x.name : `${x.name} ×${sv}`) : `${x.name}, ${Math.round(grams)} ${t(x.unit)}`;
    const row = await logFood({ name, kcal: x.k * m, protein: x.p * m, carbs: x.c * m, fat: x.f * m, sugar_high: sugar >= 10, fat_high: x.f >= 17.5, barcode: code }, toast, t);
    if (row) router.back();
  };

  return (
    <View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {x.image ? <Image source={{ uri: x.image }} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Icon name="barcode" size={26} color={c.sec} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={2}>
            {x.name}
          </Text>
          <Text variant="small" color="sec" numberOfLines={1}>
            {[x.brand, t('1 serving = {n} {u}', { n: x.size, u: t(x.unit) })].filter(Boolean).join(', ')}
          </Text>
        </View>
      </Card>
      {sugar >= 10 ? (
        <Row style={{ justifyContent: 'center', marginTop: 4 }}>
          <WarnChip label={t('High sugar: {n} g', { n: Math.round(sugar) })} />
        </Row>
      ) : null}
      <Card style={{ marginTop: 12, alignItems: 'center' }}>
        <Text num size={44} style={{ letterSpacing: -1.7, lineHeight: 48 }}>
          {fmt(x.k * m)}
        </Text>
        <Text variant="small" weight={700} color="sec">
          {t('kcal')}
        </Text>
        <Row style={{ marginTop: 14, alignSelf: 'stretch', justifyContent: 'space-around' }}>
          {(
            [
              ['Protein', x.p],
              ['Carbs', x.c],
              ['Fat', x.f],
            ] as const
          ).map(([a, v]) => (
            <View key={a} style={{ alignItems: 'center' }}>
              <Text num>{`${Math.round(v * m)} ${t('g')}`}</Text>
              <Text variant="xs" weight={700} color="sec">
                {t(a)}
              </Text>
            </View>
          ))}
        </Row>
      </Card>
      <Card>
        <Text weight={700} style={{ marginBottom: 10 }}>
          {t('How much?')}
        </Text>
        <Segmented
          value={um}
          options={[
            { value: 'serving', label: t('Servings') },
            { value: 'g', label: t(x.unit === 'ml' ? 'ml' : 'Grams') },
          ]}
          onChange={setUm}
        />
        {um === 'serving' ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <Text variant="small" color="sec">
              {t('1 serving = {n} {u}', { n: x.size, u: t(x.unit) })}
            </Text>
            <Stepper bg={c.inset} minusDisabled={sv <= 0.5} onMinus={() => setSv(Math.max(0.5, sv - 0.5))} onPlus={() => setSv(sv + 0.5)} labels={[t('Less'), t('More')]}>
              <Text num style={{ width: 34, textAlign: 'center' }}>
                {sv}
              </Text>
            </Stepper>
          </Row>
        ) : (
          <View>
            <Row gap={8} style={{ marginTop: 12 }}>
              <TextInput
                value={g}
                onChangeText={(v) => setG(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                keyboardType="decimal-pad"
                style={{ flex: 1, height: 52, borderRadius: 14, paddingHorizontal: 14, backgroundColor: c.inset, fontFamily: fontFor('sora', 600), fontSize: 22, color: c.text, outlineStyle: 'none' } as object}
              />
              <Text weight={700} color="sec">
                {t(x.unit)}
              </Text>
            </Row>
            <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {chips.map((v) => (
                <Chip key={v} title={`${v} ${t(x.unit)}`} on={+g === v} onPress={() => setG(String(v))} />
              ))}
            </Row>
          </View>
        )}
      </Card>
      <Row gap={6} style={{ alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Icon name="info" size={16} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Data from Open Food Facts. Check the label if a number looks wrong.')}
        </Text>
      </Row>
      <Button title={t('Add to log')} disabled={!(grams > 0)} style={{ marginTop: 16 }} onPress={add} />
    </View>
  );
}

/** Product not found: type the numbers from the label (per 100 g). */
function Manual({ code, offline }: { code?: string; offline: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const [v, setV] = useState({ name: '', k: '', p: '', c: '', f: '', sugar: '', g: '100' });
  const num = (s: string) => +s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) || 0;
  const set = (k: keyof typeof v) => (s: string) => setV({ ...v, [k]: s.replace(/[^\d.٠-٩]/g, '') });
  const m = num(v.g) / 100;
  const ok = v.name.trim() && num(v.k) > 0 && m > 0;

  const add = async () => {
    if (!ok) return;
    const row = await logFood(
      { name: `${v.name.trim()}, ${Math.round(num(v.g))} ${t('g')}`, kcal: num(v.k) * m, protein: num(v.p) * m, carbs: num(v.c) * m, fat: num(v.f) * m, sugar_high: num(v.sugar) * m >= 10, barcode: code ?? null },
      toast,
      t,
    );
    if (row) router.back();
  };

  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Icon name={offline ? 'warn' : 'search'} size={30} color={c.sec} />
        <Text variant="h3" center style={{ marginTop: 8 }}>
          {t(offline ? 'Couldn’t look it up' : 'We couldn’t find this product')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t(offline ? 'Check your internet, or type the numbers from the label.' : 'Type the numbers from the nutrition label. Use the “per 100 g” column.')}
        </Text>
        {code ? (
          <Text variant="xs" color="sec" num style={{ marginTop: 6 }}>
            {code}
          </Text>
        ) : null}
      </Card>
      <Field label={t('Name')} value={v.name} onChangeText={(name) => setV({ ...v, name })} placeholder={t('Protein bar')} />
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Field label={t('Calories per 100 g')} value={v.k} onChangeText={set('k')} inputMode="decimal" keyboardType="decimal-pad" ltr unit={t('kcal')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('Protein per 100 g')} value={v.p} onChangeText={set('p')} inputMode="decimal" keyboardType="decimal-pad" ltr unit={t('g')} />
        </View>
      </Row>
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Field label={t('Carbs per 100 g')} value={v.c} onChangeText={set('c')} inputMode="decimal" keyboardType="decimal-pad" ltr unit={t('g')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('Fat per 100 g')} value={v.f} onChangeText={set('f')} inputMode="decimal" keyboardType="decimal-pad" ltr unit={t('g')} />
        </View>
      </Row>
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Field label={t('Sugar per 100 g')} optional={t('(optional)')} value={v.sugar} onChangeText={set('sugar')} inputMode="decimal" keyboardType="decimal-pad" ltr unit={t('g')} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('How much you ate')} value={v.g} onChangeText={set('g')} inputMode="decimal" keyboardType="decimal-pad" ltr unit={t('g')} />
        </View>
      </Row>
      <Button title={ok ? t('Add {n} kcal', { n: fmt(num(v.k) * m) }) : t('Add to log')} disabled={!ok} style={{ marginTop: 16 }} onPress={add} />
    </View>
  );
}
