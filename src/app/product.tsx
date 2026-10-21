import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { AllergyWarn } from '@/components/food/AllergyWarn';
import { WarnChip } from '@/components/food/Chips';
import { NutritionFacts, useMyFacts } from '@/components/food/NutritionFacts';
import { Stepper } from '@/components/food/Stepper';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { productAllergies } from '@/lib/allergies';
import { useFood, useLogFood } from '@/lib/food';
import { aiErrorText, askAI } from '@/lib/ai';
import { lookupProduct, normBarcode, type Product } from '@/lib/products';
import { takePhoto } from '@/lib/photo';
import { supabase } from '@/lib/supabase';
import { EXTRA_KEYS, extraFacts, type Facts, FACTS, factsKey, myNameFor, offFactsFor, setMyName, withMine } from '@/lib/nutrients';
import { fmt } from '@/lib/nutrition';
import { addedSugarHigh } from '@/lib/sugar';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

export default function ProductScreen() {
  const { t, lang } = useT();
  const { code: raw } = useLocalSearchParams<{ code?: string }>();
  // Saved and looked up as 13 digits (a 12-digit UPC-A gets a 0 in front).
  const code = raw ? normBarcode(raw) : undefined;
  const [state, setState] = useState<'loading' | 'found' | 'missing' | 'error' | 'fix'>(code ? 'loading' : 'missing');
  const [prod, setProd] = useState<Product | null>(null);

  useEffect(() => {
    if (!code) return;
    let live = true;
    lookupProduct(code, lang)
      .then((p) => {
        if (!live) return;
        setProd(p);
        setState(p ? 'found' : 'missing');
        // Saved in our food list: Open Food Facts may know more of the label (saturated fat, cholesterol, vitamins…).
        if (p?.id && p.src !== 'fix')
          offFactsFor(code).then((more) => live && Object.keys(more).length && setProd((cur) => (cur && cur.id === p.id ? { ...cur, facts: { ...more, ...cur.facts } } : cur)));
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
  const key = factsKey(x.id, code);
  const [mine, setMine] = useMyFacts(key);
  // Your own name for it (only you see it): shown here, in your log and in Recent in search.
  const [own, setOwn] = useState<{ key: string; n: string | null } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    myNameFor(key).then((n) => alive && setOwn({ key, n }));
    return () => {
      alive = false;
    };
  }, [key]);
  const ownName = own?.key === key ? own.n : null;
  const shownName = ownName ?? x.name;
  const saveName = async () => {
    if (!key || renaming == null) return;
    const n = renaming.trim() && renaming.trim() !== x.name ? renaming.trim() : null;
    if (!(await setMyName(key, n))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setOwn({ key, n });
    setRenaming(null);
    toast(t(n ? 'Renamed. Only you see this name.' : 'Back to the product’s name.'), { icon: 'check' });
  };
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const food = useFood();
  // Your allergies in this product: from its name, ingredient list and the label's allergen tags.
  const allergic = productAllergies({ name: `${x.name} ${shownName}`, ingredients: x.ingredients, tags: x.allergenTags }, food.plan.allergies, food.plan.allergyNote);
  const [um, setUm] = useState<'serving' | 'g'>('serving');
  const [sv, setSv] = useState(1);
  const [g, setG] = useState(String(x.size));
  const grams = um === 'serving' ? sv * x.size : +g || 0;
  const m = grams / 100;
  const sugar = x.sugar * m;
  const chips = [100, Math.round(x.size / 2), 250, x.size].filter((v, i, a) => v > 0 && a.indexOf(v) === i).sort((a, b) => a - b);

  const add = async () => {
    if (!(grams > 0)) return;
    const name = um === 'serving' ? (sv === 1 ? shownName : `${shownName} ×${sv}`) : `${shownName}, ${Math.round(grams)} ${t(x.unit)}`;
    // High sugar is judged on one serving (two of something aren't "high sugar" twice over); high fat per 100 g, or per
    // 100 ml for drinks (half the limit, as on UK front-of-pack labels).
    const row = await logFood({ name, kcal: x.k * m, protein: x.p * m, carbs: x.c * m, fat: x.f * m, sugar_high: addedSugarHigh(name, (x.sugar * (x.size || 100)) / 100), fat_high: x.f >= (x.unit === 'ml' ? 8.75 : 17.5), barcode: code, food_id: x.id ?? null }, toast, t);
    if (row) goBack();
  };

  return (
    <View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {x.image ? <Image source={{ uri: x.image }} style={{ width: 56, height: 56 }} contentFit="cover" /> : <Icon name="barcode" size={26} color={c.sec} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={2}>
            {shownName}
          </Text>
          <Text variant="small" color="sec" numberOfLines={1}>
            {[ownName ? x.name : x.brand, t('1 serving = {n} {u}', { n: x.size, u: t(x.unit) })].filter(Boolean).join(', ')}
          </Text>
        </View>
        {key && renaming == null ? (
          <Springy onPress={() => setRenaming(shownName)} accessibilityLabel={t('Rename')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="edit" size={18} color={c.text} />
          </Springy>
        ) : null}
      </Card>
      {/* No ingredient list or allergen tags (often in our own food list): the name was checked, but say it isn't sure. */}
      <AllergyWarn items={allergic} unknown={!x.ingredients?.trim() && !x.allergenTags?.length} />
      {renaming != null ? (
        <Card>
          <Field label={t('Your name for it')} value={renaming} onChangeText={setRenaming} maxLength={120} autoFocus />
          <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
            {t('Only you see this name. It shows in your log and in Recent when you search.')}
          </Text>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button kind="glass" title={t('Cancel')} style={{ flex: 1 }} onPress={() => setRenaming(null)} />
            <Button title={t('Save')} style={{ flex: 1 }} onPress={saveName} />
          </Row>
        </Card>
      ) : null}
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
      <NutritionFacts per100={withMine(x.facts, mine)} grams={grams} unit={x.unit} serving={x.size} factsKey={key} mine={mine} onMine={setMine} />
      <Card style={{ marginTop: 12 }}>
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
          {t(x.src === 'fix' ? 'These are the numbers you fixed.' : x.src === 'user' ? 'Typed from the label by a Adro user. Check the label if a number looks wrong.' : 'Data from Open Food Facts. Check the label if a number looks wrong.')}
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
      ? { name: init.name, brand: init.brand, size: String(init.size), k: r1(init.k), p: r1(init.p), c: r1(init.c), f: r1(init.f), sugar: init.sugar ? r1(init.sugar) : '', fiber: init.facts.fiber != null ? r1(init.facts.fiber) : '', sodium: init.facts.sodium != null ? r1(init.facts.sodium) : '', g: '' }
      : { name: '', brand: '', size: '', k: '', p: '', c: '', f: '', sugar: '', fiber: '', sodium: '', g: '' },
  );
  // The rest of the label (saturated fat, cholesterol, vitamins…), all optional.
  const [extra, setExtra] = useState<Partial<Record<string, string>>>(() =>
    init ? Object.fromEntries(EXTRA_KEYS.filter((k) => init.facts[k] != null).map((k) => [k, r1(init.facts[k] as number)])) : {},
  );
  const [moreOpen, setMoreOpen] = useState(() => !!init && EXTRA_KEYS.some((k) => init.facts[k] != null));
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
    const r = await askAI<{ name?: string; unit?: 'g' | 'ml'; serving?: number; kcal_100: number; protein_100: number; carbs_100: number; fat_100: number; sugar_100?: number; fiber_100?: number; sodium_100?: number; extra_100?: Facts; readable: boolean }>('label_photo', { lang, image: pic.base64, mime: pic.mime });
    setReading(false);
    if (r.error || !r.result) return toast(t(aiErrorText(r.error ?? 'failed')), { icon: 'warn' });
    const x = r.result;
    const r1 = (n?: number) => (n == null ? '' : String(Math.round(n * 10) / 10));
    setBasis('100');
    setUnit(x.unit === 'ml' ? 'ml' : 'g');
    setV({ ...v, name: v.name || x.name || '', size: x.serving ? String(Math.round(x.serving)) : v.size, k: r1(x.kcal_100), p: r1(x.protein_100), c: r1(x.carbs_100), f: r1(x.fat_100), sugar: r1(x.sugar_100), fiber: r1(x.fiber_100), sodium: r1(x.sodium_100) });
    const more = Object.fromEntries(EXTRA_KEYS.filter((k) => x.extra_100?.[k] != null).map((k) => [k, r1(x.extra_100?.[k])]));
    if (Object.keys(more).length) {
      setExtra(more);
      setMoreOpen(true);
    }
    if (!x.readable) toast(t('Some numbers were hard to read. Please check them.'), { icon: 'info' });
  };

  const add = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const { data: foodId } = await supabase.rpc(init && code ? 'fix_product' : 'save_user_product', {
      p_barcode: code ?? null, p_name: v.name.trim(), p_brand: v.brand.trim() || null, p_unit: unit, p_serving: size || 100,
      p_kcal: per.k, p_protein: per.p, p_carbs: per.c, p_fat: per.f,
      p_sugar: v.sugar ? per.sugar : null, p_fiber: v.fiber ? per.fiber : null, p_sodium: v.sodium ? per.sodium : null,
      p_nutrients: extraFacts(Object.fromEntries(EXTRA_KEYS.filter((k) => extra[k]?.trim()).map((k) => [k, num(extra[k] as string) * to100])) as Facts),
    });
    const name = um === 'serving' && canServing ? (sv === 1 ? v.name.trim() : `${v.name.trim()} ×${sv}`) : `${v.name.trim()}, ${Math.round(eaten)} ${u}`;
    const row = await logFood(
      { name, kcal: per.k * m, protein: per.p * m, carbs: per.c * m, fat: per.f * m, sugar_high: addedSugarHigh(name, (per.sugar * (size || 100)) / 100), fat_high: per.f >= (unit === 'ml' ? 8.75 : 17.5), barcode: code ?? null, food_id: (foodId as string) ?? null },
      toast,
      t,
    );
    setBusy(false);
    if (row) goBack();
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
      <Button
        small
        kind="ghost"
        icon={moreOpen ? 'minus' : 'plus'}
        title={t('More from the label (optional)')}
        color={c.text}
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        onPress={() => setMoreOpen(!moreOpen)}
      />
      {moreOpen ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
          {FACTS.filter((f) => EXTRA_KEYS.includes(f.key)).map((f) => (
            <View key={f.key} style={{ width: '47%', flexGrow: 1 }}>
              <Field
                label={t(f.label)}
                optional={t('(optional)')}
                value={extra[f.key] ?? ''}
                onChangeText={(s) => setExtra({ ...extra, [f.key]: s.replace(/[^\d.,٠-٩٫]/g, '').slice(0, 8) })}
                inputMode="decimal"
                keyboardType="decimal-pad"
                ltr
                unit={t(f.unit)}
              />
            </View>
          ))}
        </View>
      ) : null}

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
