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
import { aiErrorText, askAI } from '@/lib/ai';
import { foodByBarcode, foodName, myFix } from '@/lib/foodsDb';
import { takePhoto } from '@/lib/photo';
import { supabase } from '@/lib/supabase';
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
  /** Where the numbers come from: Open Food Facts, a Gymi user who typed the label, or your own fix. */
  src: 'off' | 'user' | 'fix';
  /** The product's id in our food database, when it came from there. */
  id?: string;
};

type Nutriments = Record<string, number | string | undefined>;

async function lookup(code: string, lang: 'en' | 'ar'): Promise<Product | null> {
  // Your own fix first, then our database (fast, and works when Open Food Facts is down).
  const own = (await myFix(code).catch(() => null)) ?? (await foodByBarcode(code).catch(() => null));
  if (own)
    return {
      name: foodName(own, lang),
      brand: own.brand ?? '',
      image: null,
      unit: own.unit,
      size: Math.round(+own.serving_g || 100),
      k: +own.kcal_100,
      p: +own.protein_100,
      c: +own.carbs_100,
      f: +own.fat_100,
      sugar: +(own.sugar_100 ?? 0),
      src: own.category === 'fix' ? 'fix' : own.source === 'user' ? 'user' : 'off',
      id: own.id,
    };
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
    src: 'off',
  };
}

export default function ProductScreen() {
  const { t, lang } = useT();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'error' | 'fix'>(code ? 'loading' : 'missing');
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
        <Found x={prod} code={code!} onFix={() => setState('fix')} />
      ) : state === 'fix' && prod ? (
        <Manual code={code} offline={false} init={prod} />
      ) : (
        <Manual code={code} offline={state === 'error'} />
      )}
    </Screen>
  );
}

function Found({ x, code, onFix }: { x: Product; code: string; onFix: () => void }) {
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
    const row = await logFood({ name, kcal: x.k * m, protein: x.p * m, carbs: x.c * m, fat: x.f * m, sugar_high: sugar >= 10, fat_high: x.f >= 17.5, barcode: code, food_id: x.id ?? null }, toast, t);
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
                style={{ flex: 1, minWidth: 0, height: 52, borderRadius: 14, paddingHorizontal: 14, backgroundColor: c.inset, fontFamily: fontFor('sora', 600), fontSize: 22, color: c.text, outlineStyle: 'none' } as object}
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
          {t(x.src === 'fix' ? 'These are the numbers you fixed.' : x.src === 'user' ? 'Typed from the label by a Gymi user. Check the label if a number looks wrong.' : 'Data from Open Food Facts. Check the label if a number looks wrong.')}
        </Text>
      </Row>
      <Button kind="soft" icon="edit" title={t('Numbers wrong? Fix them')} color={c.text} style={{ marginTop: 12 }} onPress={onFix} />
      <Button title={t('Add to log')} disabled={!(grams > 0)} style={{ marginTop: 16 }} onPress={add} />
    </View>
  );
}

/** Product not found: type the label exactly as printed (per serving or per 100 g), then how much you ate.
 * The product is saved, so the next scan finds it and the log can show its details. */
function Manual({ code, offline, init }: { code?: string; offline: boolean; init?: Product }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  // Fixing a product: start from its numbers (per 100) so you only change what's wrong.
  const r1 = (n: number) => String(Math.round(n * 10) / 10);
  const [v, setV] = useState(() =>
    init
      ? { name: init.name, brand: init.brand, size: String(init.size), k: r1(init.k), p: r1(init.p), c: r1(init.c), f: r1(init.f), sugar: init.sugar ? r1(init.sugar) : '', fiber: '', sodium: '', g: '' }
      : { name: '', brand: '', size: '', k: '', p: '', c: '', f: '', sugar: '', fiber: '', sodium: '', g: '' },
  );
  const [unit, setUnit] = useState<'g' | 'ml'>(init?.unit ?? 'g');
  const [basis, setBasis] = useState<'serving' | '100'>(init ? '100' : 'serving');
  const [um, setUm] = useState<'serving' | 'g'>('serving');
  const [sv, setSv] = useState(1);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const num = (s: string) => +s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٫]/g, '.') || 0;
  const set = (k: keyof typeof v) => (s: string) => setV({ ...v, [k]: k === 'name' || k === 'brand' ? s : s.replace(/[^\d.,٠-٩٫]/g, '').slice(0, 7) });

  const size = num(v.size);
  // Label numbers are for one serving (size) or for 100; turn them into "per 100" once.
  const to100 = basis === '100' ? 1 : size > 0 ? 100 / size : 0;
  const per = { k: num(v.k) * to100, p: num(v.p) * to100, c: num(v.c) * to100, f: num(v.f) * to100, sugar: num(v.sugar) * to100, fiber: num(v.fiber) * to100, sodium: num(v.sodium) * to100 };
  const canServing = size > 0;
  const eaten = um === 'serving' && canServing ? sv * size : num(v.g);
  const m = eaten / 100;
  const ok = !!v.name.trim() && num(v.k) > 0 && to100 > 0 && eaten > 0;
  const u = t(unit);

  // Read the numbers from a photo of the label (fills the form; you can still fix them).
  const readLabel = async () => {
    const pic = await takePhoto(true);
    if (!pic) return;
    setReading(true);
    const r = await askAI<{ name?: string; unit?: 'g' | 'ml'; serving?: number; kcal_100: number; protein_100: number; carbs_100: number; fat_100: number; sugar_100?: number; readable: boolean }>('label_photo', { lang, image: pic.base64, mime: pic.mime });
    setReading(false);
    if (r.error || !r.result) return toast(t(aiErrorText(r.error ?? 'failed')), { icon: 'warn' });
    const x = r.result;
    const r1 = (n?: number) => (n == null ? '' : String(Math.round(n * 10) / 10));
    setBasis('100');
    setUnit(x.unit === 'ml' ? 'ml' : 'g');
    setV({ ...v, name: v.name || x.name || '', size: x.serving ? String(Math.round(x.serving)) : v.size, k: r1(x.kcal_100), p: r1(x.protein_100), c: r1(x.carbs_100), f: r1(x.fat_100), sugar: r1(x.sugar_100) });
    if (!x.readable) toast(t('Some numbers were hard to read. Please check them.'), { icon: 'info' });
  };

  const add = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const { data: foodId } = await supabase.rpc(init && code ? 'fix_product' : 'save_user_product', {
      p_barcode: code ?? null, p_name: v.name.trim(), p_brand: v.brand.trim() || null, p_unit: unit, p_serving: size || 100,
      p_kcal: per.k, p_protein: per.p, p_carbs: per.c, p_fat: per.f,
      p_sugar: v.sugar ? per.sugar : null, p_fiber: v.fiber ? per.fiber : null, p_sodium: v.sodium ? per.sodium : null,
    });
    const name = um === 'serving' && canServing ? (sv === 1 ? v.name.trim() : `${v.name.trim()} ×${sv}`) : `${v.name.trim()}, ${Math.round(eaten)} ${u}`;
    const row = await logFood(
      { name, kcal: per.k * m, protein: per.p * m, carbs: per.c * m, fat: per.f * m, sugar_high: per.sugar * m >= 10, fat_high: per.f >= (unit === 'ml' ? 8.75 : 17.5), barcode: code ?? null, food_id: (foodId as string) ?? null },
      toast,
      t,
    );
    setBusy(false);
    if (row) router.back();
  };

  const field = (k: keyof typeof v, label: string, unitLabel: string, optional?: boolean) => (
    <View style={{ flex: 1 }}>
      <Field label={label} optional={optional ? t('(optional)') : undefined} value={v[k]} onChangeText={set(k)} inputMode="decimal" keyboardType="decimal-pad" ltr unit={unitLabel} />
    </View>
  );

  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Icon name={init ? 'edit' : offline ? 'warn' : 'search'} size={30} color={c.sec} />
        <Text variant="h3" center style={{ marginTop: 8 }}>
          {t(init ? 'Fix the numbers' : offline ? 'Couldn’t look it up' : 'We couldn’t find this product')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t(init ? 'Change what’s wrong, as printed on the label. Your fix is saved for you, so the next scan shows your numbers.' : 'Type the label as it is printed. We save it, so next time the scan finds it.')}
        </Text>
        {code ? (
          <Text variant="xs" color="sec" num style={{ marginTop: 6 }}>
            {code}
          </Text>
        ) : null}
        <Button small kind="soft" icon="camera" title={t('Read the label from a photo')} loading={reading} style={{ marginTop: 12, alignSelf: 'center' }} onPress={readLabel} />
      </Card>
      <Field label={t('Name')} value={v.name} onChangeText={set('name')} placeholder={t('Protein bar')} maxLength={120} />
      <Field label={t('Brand')} optional={t('(optional)')} value={v.brand} onChangeText={set('brand')} placeholder={t('For example: Almarai')} maxLength={60} />

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
        {t('The numbers on the label are for')}
      </Text>
      <Segmented
        value={basis}
        options={[
          { value: 'serving', label: t('One serving') },
          { value: '100', label: t('100 {u}', { u }) },
        ]}
        onChange={setBasis}
      />
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Field
            label={t('Serving size')}
            optional={basis === '100' ? t('(optional)') : undefined}
            value={v.size}
            onChangeText={set('size')}
            placeholder={basis === 'serving' ? '30' : ''}
            inputMode="decimal"
            keyboardType="decimal-pad"
            ltr
            unit={u}
          />
        </View>
        <View style={{ width: 120, justifyContent: 'flex-end' }}>
          <Segmented
            value={unit}
            options={[
              { value: 'g', label: t('g') },
              { value: 'ml', label: t('ml') },
            ]}
            onChange={setUnit}
          />
        </View>
      </Row>
      <Text variant="xs" color="sec" style={{ marginTop: 6, marginHorizontal: 4 }}>
        {basis === 'serving' ? t('Copy the numbers for one serving, exactly as printed.') : t('Copy the “per 100” column, exactly as printed.')}
      </Text>
      <Row gap={10}>
        {field('k', t('Calories'), t('kcal'))}
        {field('p', t('Protein'), t('g'))}
      </Row>
      <Row gap={10}>
        {field('c', t('Carbs'), t('g'))}
        {field('f', t('Fat'), t('g'))}
      </Row>
      <Row gap={10}>
        {field('sugar', t('Sugar'), t('g'), true)}
        {field('fiber', t('Fiber'), t('g'), true)}
      </Row>
      <Row gap={10}>
        {field('sodium', t('Sodium'), t('mg'), true)}
        <View style={{ flex: 1 }} />
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Text weight={700} style={{ marginBottom: 10 }}>
          {t('How much did you eat?')}
        </Text>
        <Segmented
          value={canServing ? um : 'g'}
          options={[
            { value: 'serving', label: t('Servings') },
            { value: 'g', label: t(unit === 'ml' ? 'ml' : 'Grams') },
          ]}
          onChange={(x) => (x === 'serving' && !canServing ? toast(t('Add the serving size first.'), { icon: 'info' }) : setUm(x))}
        />
        {um === 'serving' && canServing ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <Text variant="small" color="sec">
              {t('1 serving = {n} {u}', { n: size, u })}
            </Text>
            <Stepper bg={c.inset} minusDisabled={sv <= 0.5} onMinus={() => setSv(Math.max(0.5, sv - 0.5))} onPlus={() => setSv(sv + 0.5)} labels={[t('Less'), t('More')]}>
              <Text num style={{ width: 34, textAlign: 'center' }}>
                {sv}
              </Text>
            </Stepper>
          </Row>
        ) : (
          <Row gap={8} style={{ marginTop: 12 }}>
            <TextInput
              value={v.g}
              onChangeText={set('g')}
              inputMode="decimal"
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={c.sec}
              style={{ flex: 1, minWidth: 0, height: 52, borderRadius: 14, paddingHorizontal: 14, backgroundColor: c.inset, fontFamily: fontFor('sora', 600), fontSize: 22, color: c.text, outlineStyle: 'none' } as object}
            />
            <Text weight={700} color="sec">
              {u}
            </Text>
          </Row>
        )}
        {ok ? (
          <Text variant="small" color="sec" style={{ marginTop: 10 }}>
            {t('{k} kcal · {p} g protein · {c} g carbs · {f} g fat', { k: fmt(per.k * m), p: Math.round(per.p * m), c: Math.round(per.c * m), f: Math.round(per.f * m) })}
          </Text>
        ) : null}
      </Card>
      <Button title={ok ? t('Add {n} kcal', { n: fmt(per.k * m) }) : t('Add to log')} disabled={!ok} loading={busy} style={{ marginTop: 16 }} onPress={add} />
    </View>
  );
}
