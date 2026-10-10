import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { Springy } from '@/components/ui';
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

/** Search the food database and pick one ingredient. */
export function PickFood({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (f: DbFood) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<DbFood[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const loading = doneKey !== q;
  const latest = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const r = await searchFoods(q, null, 25);
      if (id === latest.current) {
        setResults(r);
        setDoneKey(q);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, open]);

  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Add an ingredient')}</Text>
      <Field value={q} onChangeText={setQ} placeholder={t('Chicken breast, rice, laban…')} autoCorrect={false} />
      <View style={{ marginTop: 10, minHeight: 200 }}>
        {loading && !results.length ? (
          <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
        ) : results.length ? (
          <View style={{ backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
            {results.map((f, i) => (
              <Springy key={f.id} onPress={() => onPick(f)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
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
      </View>
    </Sheet>
  );
}
