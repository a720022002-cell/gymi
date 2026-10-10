import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { PortionSheet } from '@/components/food/PortionSheet';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type DbFood, foodName, searchFoods, servingLabel } from '@/lib/foodsDb';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

const CATS: [string | null, string][] = [
  [null, 'All'],
  ['gulf', 'Saudi and Gulf'],
  ['rest', 'Restaurants'],
  ['basic', 'Basics'],
];

export default function FoodSearch() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [results, setResults] = useState<DbFood[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const loading = doneKey !== `${cat}|${q}`;
  const [picked, setPicked] = useState<DbFood | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const id = ++latest.current;
      const r = await searchFoods(q, cat, 40);
      if (id === latest.current) {
        setResults(r);
        setDoneKey(`${cat}|${q}`);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer.current);
  }, [q, cat]);

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t('Search food')} back>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {CATS.map(([k, l]) => (
            <Chip key={l} title={t(l)} on={cat === k} onPress={() => setCat(k)} />
          ))}
        </Row>
        <View style={{ marginTop: 12, paddingBottom: 90 }}>
          {loading && !results.length ? (
            <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
          ) : results.length ? (
            <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
              {results.map((f, i) => (
                <Springy key={f.id} onPress={() => setPicked(f)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight={700} numberOfLines={2}>
                      {foodName(f, lang)}
                    </Text>
                    <Text variant="small" color="sec" numberOfLines={1}>
                      {[f.restaurant, servingLabel(f, lang)].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  {f.sugar_high || f.fat_high ? <Icon name="warn" size={16} color={c.down} strokeWidth={2} /> : null}
                  <Text num>{fmt((f.kcal_100 * f.serving_g) / 100)}</Text>
                  <Text variant="small" color="sec">
                    {t('kcal')}
                  </Text>
                </Springy>
              ))}
            </View>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
              <Icon name="search" size={30} color={c.sec} />
              <Text variant="h3" center style={{ marginTop: 8 }}>
                {t('No match for “{q}”', { q })}
              </Text>
              <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
                {t('Try another spelling, or create your own meal from Saved meals.')}
              </Text>
            </Card>
          )}
        </View>
      </Screen>

      <View pointerEvents="box-none" style={{ position: 'absolute', start: 16, end: 16, bottom: 24 + insets.bottom }}>
        <Glass style={{ borderRadius: 32, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ paddingStart: 8 }}>
            <Icon name="search" size={20} color={c.sec} />
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={t('kabsa, mandi, shawarma…')}
            placeholderTextColor={c.sec}
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, height: 44, fontSize: 16, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object}
          />
          {q ? (
            <Springy onPress={() => setQ('')} accessibilityLabel={t('Clear')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} />
            </Springy>
          ) : null}
        </Glass>
      </View>

      <PortionSheet food={picked} onClose={() => setPicked(null)} />
    </View>
  );
}
