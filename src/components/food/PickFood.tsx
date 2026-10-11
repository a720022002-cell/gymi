import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { Button, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type DbFood, foodName, forGrams, partsTotal, searchFoods, servingLabel } from '@/lib/foodsDb';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** Calories per 100 g, also for dishes made of parts. */
export function per100(f: DbFood) {
  if (!f.parts) return { k: f.kcal_100, p: f.protein_100, c: f.carbs_100, f: f.fat_100 };
  const t = partsTotal(f.parts);
  const d = t.g / 100 || 1;
  return { k: t.k / d, p: t.p / d, c: t.c / d, f: t.f / d };
}

/** Your own food: name, the amount in grams, and its numbers for that amount. */
export type OwnFood = { n: string; g: number; per: { k: number; p: number; c: number; f: number } };
const num = (s: string) =>
  +s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٫]/g, '.')
    .replace(/[^\d.]/g, '') || 0;

/** Search the food database and pick one ingredient, or add your own with your own numbers. */
export function PickFood({ open, onClose, onPick, onOwn }: { open: boolean; onClose: () => void; onPick: (f: DbFood) => void; onOwn?: (f: OwnFood) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [q, setQ] = useState('');
  const [own, setOwn] = useState<{ n: string; g: string; k: string; p: string; c: string; f: string } | null>(null);
  const ownOk = !!own && own.n.trim() && num(own.g) > 0 && num(own.k) > 0;
  const saveOwn = () => {
    if (!own || !ownOk || !onOwn) return;
    const g = num(own.g);
    onOwn({ n: own.n.trim().slice(0, 80), g, per: { k: (num(own.k) * 100) / g, p: (num(own.p) * 100) / g, c: (num(own.c) * 100) / g, f: (num(own.f) * 100) / g } });
    setOwn(null);
  };
  const [results, setResults] = useState<DbFood[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const loading = doneKey !== q;
  const latest = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++latest.current;
    const timer = setTimeout(
      async () => {
        const r = await searchFoods(q, null, 25);
        if (id === latest.current) {
          setResults(r);
          setDoneKey(q);
        }
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [q, open]);

  return (
    <Sheet open={open} onClose={() => (setOwn(null), onClose())}>
      {own ? (
        <View>
          <Text variant="h2">{t('Add your own')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Use the numbers from the package or your own estimate.')}
          </Text>
          <Field label={t('Name')} value={own.n} onChangeText={(n) => setOwn({ ...own, n })} maxLength={80} />
          <Field label={t('Amount')} value={own.g} onChangeText={(g) => setOwn({ ...own, g })} inputMode="decimal" ltr unit={t('g')} />
          <Text variant="xs" weight={700} color="sec" style={{ marginTop: 12 }}>
            {t('Your numbers for {n} g', { n: num(own.g) || '…' })}
          </Text>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label={t('Calories')} value={own.k} onChangeText={(k) => setOwn({ ...own, k })} inputMode="decimal" ltr unit={t('kcal')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Protein')} value={own.p} onChangeText={(p) => setOwn({ ...own, p })} inputMode="decimal" ltr unit={t('g')} />
            </View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label={t('Carbs')} value={own.c} onChangeText={(cc) => setOwn({ ...own, c: cc })} inputMode="decimal" ltr unit={t('g')} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('Fat')} value={own.f} onChangeText={(f) => setOwn({ ...own, f })} inputMode="decimal" ltr unit={t('g')} />
            </View>
          </Row>
          <Button title={t('Add')} disabled={!ownOk} style={{ marginTop: 16 }} onPress={saveOwn} />
          <Button title={t('Back')} kind="ghost" style={{ marginTop: 8 }} onPress={() => setOwn(null)} />
        </View>
      ) : (
        <View>
          <Text variant="h2">{t('Add an ingredient')}</Text>
          <Field value={q} onChangeText={setQ} placeholder={t('Chicken breast, rice, laban…')} autoCorrect={false} />
          <View style={{ marginTop: 10, minHeight: 200 }}>
            {loading && !results.length ? (
              <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
            ) : results.length ? (
              <View style={{ backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
                {results.map((f, i) => (
                  <Springy
                    key={f.id}
                    onPress={() => onPick(f)}
                    scaleTo={0.99}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text weight={700} numberOfLines={1}>
                        {foodName(f, lang)}
                      </Text>
                      <Text variant="xs" color="sec" numberOfLines={1}>
                        {[f.restaurant, servingLabel(f, lang)].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    <Text num size={15}>
                      {fmt(f.parts ? partsTotal(f.parts).k : forGrams(f, f.serving_g).k)}
                    </Text>
                    <Icon name="plus" size={18} color={c.cobalt} strokeWidth={2.2} />
                  </Springy>
                ))}
              </View>
            ) : (
              <Text color="sec" center style={{ marginTop: 30 }}>
                {t('No match for “{q}”', { q })}
              </Text>
            )}
            {onOwn ? (
              <Springy
                onPress={() => setOwn({ n: q.trim(), g: '100', k: '', p: '', c: '', f: '' })}
                scaleTo={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, marginTop: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(127,127,135,0.1)' }}>
                <Icon name="plus" size={16} color={c.cobalt} strokeWidth={2.4} />
                <Text variant="small" weight={700} style={{ flex: 1 }}>
                  {q.trim() ? t('Not in the list? Add “{q}” with your own numbers', { q: q.trim() }) : t('Add your own')}
                </Text>
              </Springy>
            ) : null}
          </View>
        </View>
      )}
    </Sheet>
  );
}
