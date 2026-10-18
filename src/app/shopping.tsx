import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Bar } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Field } from '@/components/Field';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, Label, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { shoppingLock } from '@/lib/aiRecipes';
import { addDays, type FoodPlan, planMeals, scaleIngredients } from '@/lib/nutrition';
import { inGrams } from '@/lib/recipes';
import { daysBetween } from '@/lib/report';
import { useSettings } from '@/theme/settings';

const CATS = ['Protein', 'Dairy', 'Carbs and grains', 'Fruit and vegetables', 'Pantry', 'Other'];

function category(n: string) {
  if (/chicken|beef|fish|salmon|egg(?!plant)|whey|patty|mince|hamour|tuna|thigh|lamb|shrimp|prawn|kofta|kebab|turkey|دجاج|لحم|سمك|سلمون|بيض|تونة|هامور|ربيان|روبيان|كفتة|ديك رومي/i.test(n)) return 'Protein';
  if (/rice|oat|bread|toast|bun|potato|bulgur|dates|lentil|pasta|harees|sambousek|vermicelli|tortilla|wheat|chickpea|foul|quinoa|couscous|freekeh|رز|أرز|ارز|شوفان|خبز|توست|بطاطس|بطاطا|برغل|تمر|عدس|مكرونة|معكرونة|هريس|شعيرية|تورتيلا|حمص|فول|كينوا|كسكس|فريكة/i.test(n)) return 'Carbs and grains';
  if (/yogurt|labneh|milk|laban|cheese|cottage|زبادي|لبنة|حليب|لبن|جبن/i.test(n)) return 'Dairy';
  if (/salad|tomato|cucumber|onion|pepper|bean|banana|apple|berr|lemon|lettuce|pickle|fattoush|spinach|veggies|greens|vegetable|carrot|avocado|orange|zucchini|parsley|garlic|ginger|سلطة|طماطم|خيار|بصل|فلفل|فاصوليا|موز|تفاح|ليمون|خس|سبانخ|خضار|جزر|أفوكادو|برتقال|كوسة|بقدونس|ثوم|زنجبيل/i.test(n)) return 'Fruit and vegetables';
  return 'Pantry';
}

type Shop = NonNullable<FoodPlan['shop']>;
const EMPTY: Shop = { checked: {}, extra: [], hidden: [], scope: 0 };

export default function Shopping() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const dayLabel = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${d}T12:00:00`));
  const shop = { ...EMPTY, ...(food.plan.shop ?? {}) };
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ n: '', q: '', cat: 'Other' });
  const save = (patch: Partial<Shop>) => food.updatePlan({ shop: { ...shop, ...patch } });

  // Add up every ingredient in the plan for the chosen time.
  // Meals change from day to day, so each day's own meals are added up: today, the next 7 days, or the next 30.
  // Once you start buying a week's or month's list, it stays on those same days (it doesn't move on each day).
  const lock = shoppingLock(food.plan, food.today);
  const locked = !!lock && lock.scope === shop.scope;
  const from = locked ? lock.from : food.today;
  const days = locked ? daysBetween(lock.from, lock.to) : [1, 7, 30][shop.scope];
  // One row per ingredient: counted ones (2 slices, half a lemon) become grams, so they add up with the rest.
  // Worked out once per plan and period (up to 30 days of meals), not again on every tap or keystroke.
  const { plan: fp, dayGoal } = food;
  const agg = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (let i = 0; i < days; i++)
      planMeals(fp, addDays(from, i), dayGoal(addDays(from, i))).forEach((m) =>
        scaleIngredients(m.r, m.k).forEach(([n, a, u]) => {
          const [v, unit] = inGrams(n, a, u);
          (out[n] ??= {})[unit] = (out[n][unit] ?? 0) + v;
        }),
      );
    return out;
    // Only meals matter here: ticking an item changes `shop` inside the plan, which doesn't change the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fp.meals, fp.picks, fp.custom, fp.aiRecipes, fp.allergies, fp.goal, fp.kcal, fp.perKg, fp.carbG, fp.fatG, fp.ramadan, from, days, dayGoal]);
  const amount = (u: Record<string, number>) => {
    if (u.g) return u.g >= 1000 ? `${(u.g / 1000).toFixed(1)} ${t('kg')}` : `${Math.round(u.g)} ${t('g')}`;
    if (u.ml) return u.ml >= 1000 ? `${(u.ml / 1000).toFixed(1)} ${t('L')}` : `${Math.round(u.ml)} ${t('ml')}`;
    const [unit, v] = Object.entries(u).find(([k]) => k !== 'pinch') ?? [];
    return unit ? `${Math.ceil(v ?? 0)} ${t(unit)}` : '';
  };
  const cats: Record<string, [string, string, boolean][]> = {};
  const hidden: [string, string][] = [];
  Object.entries(agg).forEach(([n, u]) => {
    const q = amount(u);
    if (shop.hidden.includes(n)) return hidden.push([n, q]);
    (cats[category(n)] ??= []).push([n, q, false]);
  });
  shop.extra.forEach((e) => (cats[e.cat] ??= []).push([e.n, e.q, true]));
  const all = Object.values(cats).flat();
  // Ticks belong to one list (this lock, or today's): a new week or month starts with none.
  const period = locked ? `${lock.scope}:${lock.from}` : `${shop.scope}:${food.today}`;
  const checked = shop.checkedFor === period ? shop.checked : {};
  const done = all.filter(([n]) => checked[n]).length;
  const scopeName = [t('today'), t('this week'), t('this month')][shop.scope];
  const text = () =>
    `${t('Gymi shopping list ({x})', { x: scopeName })}\n` +
    CATS.filter((k) => cats[k])
      .map((k) => `\n${t(k)}\n` + cats[k].map(([n, q]) => `${checked[n] ? '✓' : '-'} ${t(n)}${q ? `: ${q}` : ''}`).join('\n'))
      .join('\n');

  return (
    <Screen
      title={t('Shopping list')}
      large
      back
      right={
        <Row gap={6}>
          <Springy onPress={() => setEdit(!edit)} scaleTo={1.08}>
            <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={700}>{t(edit ? 'Done' : 'Edit')}</Text>
            </Glass>
          </Springy>
          <Springy onPress={() => setAdding(true)} scaleTo={1.08} accessibilityLabel={t('Add an item')}>
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={22} strokeWidth={2.2} />
            </Glass>
          </Springy>
        </Row>
      }>
      <Segmented
        value={String(shop.scope)}
        options={[
          { value: '0', label: t('Today') },
          { value: '1', label: t('This week') },
          { value: '2', label: t('This month') },
        ]}
        onChange={(v) => save({ scope: +v })}
      />
      <Row gap={10} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            small
            kind="glass"
            icon="copy"
            title={t('Copy as text')}
            style={{ alignSelf: 'stretch' }}
            onPress={async () => {
              await Clipboard.setStringAsync(text());
              toast(t('Copied'), { icon: 'copy' });
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            small
            kind="glass"
            icon="share"
            title={t('Share')}
            style={{ alignSelf: 'stretch' }}
            onPress={async () => {
              try {
                if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
                  await Clipboard.setStringAsync(text());
                  return toast(t('Copied'), { icon: 'copy' });
                }
                await Share.share({ message: text() });
              } catch {}
            }}
          />
        </View>
      </Row>
      {lock ? (
        <Row gap={10} style={{ marginTop: 14, backgroundColor: c.card, borderRadius: 16, padding: 12, alignItems: 'flex-start' }}>
          <Icon name="lock" size={18} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('This list is kept until {day}, and new AI recipes wait until then. Changing a meal yourself changes the list.', { day: dayLabel(lock.to) })}
            </Text>
            <Springy
              onPress={() => {
                save({ lock: undefined });
                toast(t('Unlocked. Your meals can change again.'), { icon: 'check' });
              }}
              style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <Text variant="small" weight={700} color="link">
                {t('Unlock')}
              </Text>
            </Springy>
          </View>
        </Row>
      ) : null}
      <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
        <Text variant="small" weight={700} color="sec">
          {t(edit ? 'Tap − to remove what you already have' : 'Made from your meal plan')}
        </Text>
        <Text variant="small" weight={700} num>
          {t('{a} of {b}', { a: done, b: all.length })}
        </Text>
      </Row>
      <Bar value={done} max={all.length || 1} />

      {CATS.filter((k) => cats[k]).map((k) => (
        <View key={k}>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
            {t(k)}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {cats[k].map(([n, q, extra], i) => {
              const on = !!checked[n];
              return (
                <Springy
                  key={n}
                  scaleTo={0.99}
                  accessibilityRole={edit ? 'button' : 'checkbox'}
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    if (edit) {
                      const before = { extra: shop.extra, hidden: shop.hidden };
                      if (extra) save({ extra: shop.extra.filter((e) => e.n !== n) });
                      else save({ hidden: [...shop.hidden, n] });
                      toast(extra ? t('Removed {name}', { name: t(n) }) : t('{name} moved to “Already have”', { name: t(n) }), {
                        icon: extra ? 'trash' : 'check',
                        undo: () => food.updatePlan({ shop: { ...shop, ...(food.plan.shop ?? {}), ...before } }),
                      });
                    } else
                    {
                      // First thing bought from a week's or month's list: it's kept on those days until the last one.
                      const startLock = !on && shop.scope > 0 && !lock;
                      const nextLock = startLock ? { from: food.today, to: addDays(food.today, [1, 7, 30][shop.scope] - 1), scope: shop.scope } : undefined;
                      const nextPeriod = nextLock ? `${nextLock.scope}:${nextLock.from}` : period;
                      save({
                        checked: { ...(nextPeriod === period ? checked : {}), [n]: !on },
                        checkedFor: nextPeriod,
                        ...(nextLock ? { lock: nextLock } : {}),
                      });
                    }
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  {edit ? (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.down, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="minus" size={16} color="#FFFFFF" strokeWidth={2.6} />
                    </View>
                  ) : (
                    <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : 'transparent', borderWidth: on ? 0 : 2, borderColor: c.line }}>
                      {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  )}
                  <Text style={{ flex: 1, textDecorationLine: on && !edit ? 'line-through' : 'none' }} color={on && !edit ? 'sec' : 'text'}>
                    {t(n)}
                  </Text>
                  <Text variant="small" weight={700} color="sec" num>
                    {q}
                  </Text>
                </Springy>
              );
            })}
          </View>
        </View>
      ))}

      <Button small kind="soft" icon="plus" title={t('Add an item')} style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={() => setAdding(true)} />

      {hidden.length ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Already have at home ({n})', { n: hidden.length })}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {hidden.map(([n], i) => (
              <View key={n} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Text color="sec" style={{ flex: 1, textDecorationLine: 'line-through' }}>
                  {t(n)}
                </Text>
                <Springy onPress={() => save({ hidden: shop.hidden.filter((x) => x !== n) })}>
                  <Text variant="small" weight={700} color="link">
                    {t('Put back')}
                  </Text>
                </Springy>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Sheet open={adding} onClose={() => setAdding(false)}>
        <Text variant="h2">{t('Add an item')}</Text>
        <Field label={t('Item')} value={newItem.n} onChangeText={(n) => setNewItem({ ...newItem, n, cat: category(n) === 'Pantry' ? newItem.cat : category(n) })} placeholder={t('Water bottles, spices, foil…')} />
        <Field label={t('Amount')} optional={t('(optional)')} value={newItem.q} onChangeText={(q) => setNewItem({ ...newItem, q })} placeholder={t('2 packs, 1 kg…')} />
        <Label>{t('Section')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATS.map((k) => (
            <Chip key={k} title={t(k)} on={newItem.cat === k} onPress={() => setNewItem({ ...newItem, cat: k })} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {['Water bottles', 'Spices', 'Olive oil', 'Coffee', 'Oats'].map((x) => (
            <Springy
              key={x}
              onPress={() => setNewItem({ ...newItem, n: t(x), cat: category(x) === 'Pantry' && x === 'Water bottles' ? 'Other' : category(x) })}
              style={{ minHeight: 38, paddingHorizontal: 15, borderRadius: 19, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={600} size={14}>{`+ ${t(x)}`}</Text>
            </Springy>
          ))}
        </View>
        <Button
          title={t('Add to list')}
          style={{ marginTop: 16 }}
          onPress={() => {
            const n = newItem.n.trim();
            if (!n) return;
            if (shop.extra.some((e) => e.n.toLowerCase() === n.toLowerCase())) return toast(t('{name} is already on your list', { name: n }), { icon: 'info' });
            save({ extra: [...shop.extra, { n, q: newItem.q.trim(), cat: newItem.cat }], hidden: shop.hidden.filter((x) => x !== n) });
            setNewItem({ n: '', q: '', cat: 'Other' });
            setAdding(false);
            toast(t('Added {name}', { name: n }), { icon: 'cart' });
          }}
        />
      </Sheet>
    </Screen>
  );
}
