import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

import { OkChip, Tag } from '@/components/food/Chips';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood, useLogFood } from '@/lib/food';
import { fmt, planMeals, scaleIngredients } from '@/lib/nutrition';
import { subOptions } from '@/lib/subs';
import { useSettings } from '@/theme/settings';

export default function RecipeScreen() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  const { key } = useLocalSearchParams<{ key: string }>();
  const meal = planMeals(food.plan).find((m) => m.key === key);
  const [subFor, setSubFor] = useState<number | null>(null);

  if (!meal)
    return (
      <Screen title={t('Recipe')} back>
        <Text color="sec">{t('This meal is no longer in your plan.')}</Text>
      </Screen>
    );

  const r = meal.r;
  const ing = scaleIngredients(r, meal.k);
  const subbed = r.subbed ?? [];
  const logged = food.logs.some((l) => l.plan_key === meal.key);

  const applySub = (i: number, j: number) => {
    const base = r.ing[i];
    const old = t(ing[i][0]).toLowerCase();
    let newIng = r.ing.map((x) => [...x] as typeof x);
    let newSubbed = [...subbed];
    let label: string;
    if (j < 0) {
      newIng.splice(i, 1);
      newIng = newIng.map(([n, a, u]) => [n, u === 'g' || u === 'ml' ? a * 1.12 : a, u]);
      newSubbed = newSubbed.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
      label = t('Left out {x}. The rest is a bit bigger.', { x: old });
    } else {
      const o = subOptions(base[0], base[1], base[2])[j];
      newIng[i] = o;
      if (!newSubbed.includes(i)) newSubbed.push(i);
      label = t('Swapped {a} for {b}. Calories stay about the same.', { a: old, b: t(o[0]).toLowerCase() });
    }
    const before = food.plan.custom;
    food.updatePlan({ custom: { ...(food.plan.custom ?? {}), [meal.key]: { ...r, ing: newIng, subbed: newSubbed } } });
    setSubFor(null);
    toast(label, { ai: true, undo: () => food.updatePlan({ custom: before }) });
  };

  return (
    <Screen title={t(r.n)} back>
      <View style={{ marginHorizontal: -20, marginTop: -8 }}>
        <Svg viewBox="0 0 350 180" width="100%" height={180}>
          <Rect width={350} height={180} fill={c.card} />
          <Circle cx={175} cy={96} r={78} fill={c.bg} />
          <Circle cx={175} cy={96} r={62} fill={c.inset} />
          <Ellipse cx={152} cy={86} rx={30} ry={20} fill="#E8C07D" />
          <Ellipse cx={200} cy={80} rx={26} ry={18} fill="#C9784A" />
          <Ellipse cx={190} cy={118} rx={28} ry={14} fill="#6FA35A" />
          <Ellipse cx={150} cy={116} rx={14} ry={10} fill="#D9534F" opacity={0.85} />
        </Svg>
      </View>
      <Row gap={8} style={{ marginTop: 18 }}>
        <Tag label={t(r.tag === 'Cut' ? 'Cutting' : 'Bulking')} />
        <Tag label={t('{n} min', { n: r.min })} />
        {logged ? <OkChip label={t('Logged')} /> : null}
      </Row>
      <Text variant="h1" style={{ marginTop: 12 }}>
        {t(r.n)}
      </Text>
      <Row gap={10} style={{ marginTop: 16 }}>
        {(
          [
            ['kcal', fmt(meal.k)],
            ['Protein', `${meal.p}${t('g')}`],
            ['Carbs', `${meal.c}${t('g')}`],
          ] as const
        ).map(([a, b]) => (
          <Card key={a} style={{ flex: 1, alignItems: 'center', marginBottom: 0 }}>
            <Text num size={20}>
              {b}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(a)}
            </Text>
          </Card>
        ))}
      </Row>
      <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
        {t('Fat {n} g', { n: meal.f })}
      </Text>

      <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        {t('Ingredients')}
      </Text>
      <Row gap={6} style={{ marginBottom: 8, paddingHorizontal: 4 }}>
        <Mark size={16} color={c.cobalt} stroke={3.2} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Missing something? Tap it and your coach suggests a swap.')}
        </Text>
      </Row>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {ing.map(([n, a, u], i) => (
          <Springy key={`${n}-${i}`} onPress={() => setSubFor(i)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Text style={{ flex: 1 }}>
              {t(n)}
              {subbed.includes(i) ? <Text variant="xs" weight={700} color="cobalt">{`  ${t('Swapped')}`}</Text> : null}
            </Text>
            <Text num size={15}>{`${a} ${t(u)}`}</Text>
            <Icon name="swap" size={16} color={c.sec} />
          </Springy>
        ))}
      </View>

      <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        {t('Steps')}
      </Text>
      {r.steps.map((s, i) => (
        <Row key={i} gap={12} style={{ alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text num size={13}>
              {i + 1}
            </Text>
          </View>
          <Text style={{ flex: 1, paddingTop: 3 }}>{t(s)}</Text>
        </Row>
      ))}

      {!logged ? (
        <Button
          title={t('Log this meal')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            await logFood({ name: t(r.n), kcal: meal.k, protein: meal.p, carbs: meal.c, fat: meal.f, meal: meal.n, plan_key: meal.key }, toast, t);
            router.back();
          }}
        />
      ) : null}
      <Button
        kind="glass"
        icon="swap"
        title={t('Change meal')}
        style={{ marginTop: 8 }}
        onPress={() => {
          const picks = { ...(food.plan.picks ?? {}), [meal.key]: (food.plan.picks?.[meal.key] ?? 0) + 1 };
          const custom = { ...(food.plan.custom ?? {}) };
          delete custom[meal.key];
          food.updatePlan({ picks, custom });
          toast(t('Changed meal. Same calories.'), { ai: true });
        }}
      />

      <Sheet open={subFor !== null} onClose={() => setSubFor(null)}>
        {subFor !== null ? (
          <View>
            <Text variant="h2">{t('No {x}?', { x: t(ing[subFor][0]).toLowerCase() })}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t('Instead of {a} {u}, use one of these. Calories stay about the same.', { a: ing[subFor][1], u: t(ing[subFor][2]) })}
            </Text>
            <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
              {subOptions(r.ing[subFor][0], r.ing[subFor][1], r.ing[subFor][2]).map((o, j) => {
                const shown = scaleIngredients({ ...r, ing: [o] }, meal.k)[0];
                return (
                  <Springy key={o[0]} onPress={() => applySub(subFor, j)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderTopWidth: j ? 1 : 0, borderTopColor: c.line }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="swap" size={16} color="#FFFFFF" />
                    </View>
                    <Text weight={700} style={{ flex: 1 }}>
                      {t(o[0])}
                    </Text>
                    <Text num size={15}>{`${shown[1]} ${t(shown[2])}`}</Text>
                  </Springy>
                );
              })}
              <Springy onPress={() => applySub(subFor, -1)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: c.line }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={16} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{t('Leave it out')}</Text>
                  <Text variant="xs" color="sec">
                    {t('I’ll add a bit more of the rest to keep the calories')}
                  </Text>
                </View>
              </Springy>
            </View>
            <Button title={t('Cancel')} kind="ghost" style={{ marginTop: 8 }} onPress={() => setSubFor(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
