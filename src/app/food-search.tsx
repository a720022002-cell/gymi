import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { PortionSheet } from '@/components/food/PortionSheet';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { productAllergies } from '@/lib/allergies';
import { useProgressive } from '@/lib/useProgressive';
import { type DbFood, foodName, foodSource, listRestaurants, type Restaurant, searchFoods, servingLabel } from '@/lib/foodsDb';
import { myNames, type RecentFood, recentFoods } from '@/lib/nutrients';
import { fmt } from '@/lib/nutrition';
import { canListen, listen, stopListening } from '@/lib/speech';
import { useSettings } from '@/theme/settings';

const CATS: [string | null, string][] = [
  [null, 'All'],
  ['gulf', 'Saudi and Gulf'],
  ['product', 'Products'],
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
  // Each result checks your allergies too: drawn a part at a time so typing stays quick.
  const shown = useProgressive(doneKey ?? '', results.length, 20, 20);
  const loading = doneKey !== `${cat}|${q}`;
  const [picked, setPicked] = useState<DbFood | null>(null);
  const [listening, setListening] = useState(false);
  const food = useFood();
  // Your allergies in a food, from its name in English and Arabic (and your own words).
  const allergic = (f: { name_en?: string | null; name_ar?: string | null }) => productAllergies({ name: `${f.name_en ?? ''} | ${f.name_ar ?? ''}` }, food.plan.allergies, food.plan.allergyNote);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  // What you logged lately, and the names you gave foods (only you see them). Fresh each time you come back.
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([recentFoods(20), myNames()]).then(([r, n]) => {
        if (!alive) return;
        setRecent(r);
        setNames(n);
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  const nameOf = (r: RecentFood) => names[r.key] ?? (r.food ? foodName(r.food, lang) : r.logName);
  const ql = q.trim().toLowerCase();
  // Empty box: your recent foods. Typing: the recent ones that match (your own names too) come first.
  const mine = (ql ? recent.filter((r) => nameOf(r).toLowerCase().includes(ql) || (r.food && foodName(r.food, 'en').toLowerCase().includes(ql)) || r.logName.toLowerCase().includes(ql)) : recent).filter(
    (r) => !cat || r.food?.category === cat || (cat === 'product' && !r.food),
  );
  const shownMine = mine.slice(0, ql ? 5 : 8);
  const openRecent = (r: RecentFood) => (r.food ? setPicked(r.food) : r.barcode ? router.push({ pathname: '/product', params: { code: r.barcode } }) : null);
  useEffect(() => {
    let alive = true;
    listRestaurants().then((r) => alive && setRestaurants(r));
    return () => {
      alive = false;
    };
  }, []);
  const voice = async () => {
    if (listening) return stopListening();
    setListening(true);
    const s = await listen(lang);
    setListening(false);
    if (s) setQ(s.trim());
  };
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
        {cat === 'rest' && restaurants.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {restaurants.map((r) => {
              const on = q.toLowerCase() === r.restaurant.toLowerCase();
              return <Chip key={r.restaurant} title={(lang === 'ar' && r.name_ar) || r.restaurant} on={on} onPress={() => setQ(on ? '' : r.restaurant)} />;
            })}
          </ScrollView>
        ) : null}
        <View style={{ marginTop: 12, paddingBottom: 90 }}>
          {shownMine.length ? (
            <>
              <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
                {t(ql ? 'Yours' : 'Recent')}
              </Text>
              <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 16 }}>
                {shownMine.map((r, i) => (
                  <Springy key={r.key} onPress={() => openRecent(r)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                    <Icon name={r.food ? 'clock' : 'barcode'} size={18} color={c.sec} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text weight={700} numberOfLines={2}>
                        {nameOf(r)}
                      </Text>
                      {r.food ? (
                        <Text variant="small" color="sec" numberOfLines={1}>
                          {[foodSource(r.food, lang), servingLabel(r.food, lang)].filter(Boolean).join(t(', '))}
                        </Text>
                      ) : null}
                    </View>
                    {r.food ? (
                      <>
                        <Text num>{fmt((r.food.kcal_100 * r.food.serving_g) / 100)}</Text>
                        <Text variant="small" color="sec">
                          {t('kcal')}
                        </Text>
                      </>
                    ) : (
                      <Icon name="chev" size={16} color={c.sec} />
                    )}
                  </Springy>
                ))}
              </View>
              {!ql ? (
                <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
                  {t('All foods')}
                </Text>
              ) : null}
            </>
          ) : null}
          {loading && !results.length ? (
            <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
          ) : results.length ? (
            <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
              {results.slice(0, shown).map((f, i) => (
                <Springy key={f.id} onPress={() => setPicked(f)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight={700} numberOfLines={2}>
                      {names[f.id] ?? foodName(f, lang)}
                    </Text>
                    <Text variant="small" color="sec" numberOfLines={1}>
                      {[foodSource(f, lang), servingLabel(f, lang)].filter(Boolean).join(t(', '))}
                    </Text>
                    {allergic(f).length ? (
                      <Text variant="xs" weight={700} color={c.down} numberOfLines={1}>
                        {t('May contain {x}', { x: allergic(f).map((a) => t(a)).join(t(', ')) })}
                      </Text>
                    ) : null}
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
              <Text variant="small" color="sec" center style={{ marginTop: 4, marginBottom: 12 }}>
                {t('Type it instead and your coach will estimate it.')}
              </Text>
              <Button small title={t('Type it instead')} style={{ alignSelf: 'center' }} onPress={() => food.openTyping(q)} />
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
            placeholder={t(listening ? 'Listening…' : 'kabsa, mandi, shawarma…')}
            placeholderTextColor={c.sec}
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1, height: 44, fontSize: 16, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object}
          />
          {q ? (
            <Springy onPress={() => setQ('')} accessibilityLabel={t('Clear')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.pill, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} />
            </Springy>
          ) : canListen() ? (
            <Springy onPress={voice} accessibilityLabel={t('Voice search')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: listening ? c.cobalt : c.pill, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" size={20} color={listening ? '#FFFFFF' : c.text} />
            </Springy>
          ) : null}
        </Glass>
      </View>

      <PortionSheet food={picked} name={picked ? names[picked.id] : undefined} onClose={() => setPicked(null)} />
    </View>
  );
}
