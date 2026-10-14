import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { type Facts, FACTS, type FactKey, fmtFact, myFacts, saveMyFacts } from '@/lib/nutrients';
import { useSettings } from '@/theme/settings';

import { Field } from '../Field';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Row, Segmented } from '../ui';

/** Your own facts for a food (loaded once per food). */
export function useMyFacts(key: string | null) {
  const [mine, setMine] = useState<{ key: string; f: Facts | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    myFacts(key).then((f) => alive && setMine({ key, f }));
    return () => {
      alive = false;
    };
  }, [key]);
  const cur = key && mine?.key === key ? mine.f : null;
  return [cur, (f: Facts) => key && setMine({ key, f })] as const;
}

/**
 * A nutrition facts label for the amount you're eating (design: like the label on a pack).
 * `per100`: everything known per 100 g/ml. `main` overrides calories and macros with exact totals (dishes with parts).
 * Facts that are missing can be added (optional); they're saved for you only, under `factsKey`.
 */
export function NutritionFacts({
  per100,
  grams,
  unit,
  serving,
  factsKey,
  mine,
  onMine,
  main,
  bg,
}: {
  per100: Facts;
  grams: number;
  unit: 'g' | 'ml';
  serving?: number;
  factsKey?: string | null;
  mine?: Facts | null;
  onMine?: (f: Facts) => void;
  main?: { kcal: number; protein: number; carbs: number; fat: number };
  bg?: string;
}) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [basis, setBasis] = useState<'100' | 'serving'>('100');
  const [vals, setVals] = useState<Partial<Record<FactKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const m = grams / 100;
  const amount = (k: FactKey) => (main && (k === 'kcal' || k === 'protein' || k === 'carbs' || k === 'fat') ? main[k] : per100[k] != null ? (per100[k] as number) * m : null);
  const shown = FACTS.filter((f) => amount(f.key) != null);
  const missing = FACTS.filter((f) => per100[f.key] == null && f.key !== 'kcal');
  const u = t(unit);
  const num = (s: string) => +s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٫]/g, '.');

  const save = async () => {
    if (!factsKey) return;
    const to100 = basis === 'serving' && serving ? 100 / serving : 1;
    const add: Facts = {};
    for (const f of missing) {
      const s = vals[f.key]?.trim();
      if (s && Number.isFinite(num(s)) && num(s) >= 0) add[f.key] = num(s) * to100;
    }
    if (!Object.keys(add).length) return setAdding(false);
    setBusy(true);
    const next = { ...(mine ?? {}), ...add };
    const ok = await saveMyFacts(factsKey, next);
    setBusy(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    onMine?.(next);
    setVals({});
    setAdding(false);
    toast(t('Saved. Only you see the facts you add.'), { icon: 'check' });
  };

  return (
    <View style={{ marginTop: 12, backgroundColor: bg ?? c.card, borderRadius: 22, padding: 16 }}>
      <Text variant="h3">{t('Nutrition facts')}</Text>
      <Row style={{ justifyContent: 'space-between', marginTop: 2, paddingBottom: 8, borderBottomWidth: 6, borderBottomColor: c.text }}>
        <Text variant="small" color="sec">
          {t('For {n} {u}', { n: Math.round(grams), u })}
        </Text>
        <Text variant="xs" weight={700} color="sec">
          {t('% Daily Value')}
        </Text>
      </Row>
      {shown.map((f, i) => {
        const v = amount(f.key) as number;
        const dv = f.dv ? Math.round((v / f.dv) * 100) : null;
        const own = mine?.[f.key] != null && per100[f.key] === mine[f.key];
        return (
          <Row key={f.key} style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingStart: f.indent ? 16 : 0 }}>
            <Text weight={f.bold ? 700 : 400} style={{ flex: 1 }} numberOfLines={1}>
              {`${t(f.label)} `}
              <Text weight={400} color={f.bold ? 'text' : 'sec'}>{`${fmtFact(v, f.unit)} ${t(f.unit)}`}</Text>
              {own ? <Text variant="xs" color="link">{`  ${t('added by you')}`}</Text> : null}
            </Text>
            <Text weight={700} num>
              {dv != null ? `${dv}%` : ''}
            </Text>
          </Row>
        );
      })}
      <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
        {t('% Daily Value is for an adult eating 2,000 kcal a day.')}
      </Text>

      {missing.length && factsKey ? (
        adding ? (
          <View style={{ marginTop: 12 }}>
            <Text weight={700}>{t('Add what’s on the label')}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 2, marginBottom: 8 }}>
              {t('All optional. Fill only what you know. Only you see these.')}
            </Text>
            {serving ? (
              <Segmented
                value={basis}
                options={[
                  { value: '100', label: t('Per 100 {u}', { u }) },
                  { value: 'serving', label: t('Per serving ({n} {u})', { n: Math.round(serving), u }) },
                ]}
                onChange={setBasis}
              />
            ) : null}
            {missing.map((f) => (
              <Field
                key={f.key}
                label={t(f.label)}
                optional={t('(optional)')}
                value={vals[f.key] ?? ''}
                onChangeText={(s) => setVals({ ...vals, [f.key]: s.replace(/[^\d.,٠-٩٫]/g, '').slice(0, 8) })}
                inputMode="decimal"
                keyboardType="decimal-pad"
                ltr
                unit={t(f.unit)}
              />
            ))}
            <Row gap={8} style={{ marginTop: 12 }}>
              <Button kind="glass" title={t('Cancel')} style={{ flex: 1 }} onPress={() => (setAdding(false), setVals({}))} />
              <Button title={t('Save')} loading={busy} style={{ flex: 1 }} onPress={save} />
            </Row>
          </View>
        ) : (
          <View style={{ marginTop: 10 }}>
            <Text variant="xs" color="sec">
              {t('Not on file: {x}', { x: missing.map((f) => t(f.label)).join(t(', ')) })}
            </Text>
            <Button small kind="soft" icon="plus" title={t('Add missing facts (optional)')} color={c.text} style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setAdding(true)} />
          </View>
        )
      ) : null}
    </View>
  );
}
