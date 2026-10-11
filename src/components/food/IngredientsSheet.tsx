import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { askAI } from '@/lib/ai';
import { useFood } from '@/lib/food';
import { type CustomRecipe, type PlannedMeal } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Chip, Row } from '../ui';
import { Thinking } from './Thinking';

type Item = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
type Result = { title: string; items: Item[] };

const CHIPS = ['chicken', 'eggs', 'rice', 'potatoes', 'tuna', 'tomatoes', 'spinach', 'yogurt'];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const PROT = /chicken|beef|tuna|fish|egg|salmon|meat|lamb|yogurt|shrimp|دجاج|لحم|تونة|بيض|سمك/i;
const CARB = /rice|potato|bread|pasta|oat|bulgur|رز|أرز|بطاطس|خبز|معكرونة|شوفان/i;

/** Simple steps for whatever the ingredients are (the AI gives amounts, these give the method). */
function steps(items: string[], t: (s: string, v?: Record<string, string | number>) => string) {
  const prot = items.find((i) => PROT.test(i));
  const carb = items.find((i) => CARB.test(i));
  const rest = items.filter((i) => i !== prot && i !== carb);
  return [
    carb ? t('Cook the {x} first so it’s ready when the rest is done.', { x: carb.toLowerCase() }) : t('Chop everything into bite-size pieces.'),
    prot ? t('Heat a little oil and cook the {x} until browned.', { x: prot.toLowerCase() }) : t('Heat a little oil in a pan.'),
    rest.length ? t('Add the rest: {x}. Season and cook 5 minutes.', { x: rest.join(', ').toLowerCase() }) : t('Season with salt, pepper and cumin.'),
    t('Serve warm. Portions are set to match this meal’s calories.'),
  ];
}

/** Recipe without the AI (design: makeRecipe), used when the AI can't answer. */
function localRecipe(words: string[], meal: PlannedMeal, t: (s: string, v?: Record<string, string | number>) => string): CustomRecipe {
  const prot = words.find((i) => PROT.test(i)) ?? 'eggs';
  const carb = words.find((i) => CARB.test(i));
  const ing: CustomRecipe['ing'] = words.map((i) =>
    /chicken|beef|fish|salmon|meat|lamb|shrimp/i.test(i)
      ? [cap(i), 200, 'g']
      : /tuna/i.test(i)
        ? [cap(i), 2, 'cans']
        : /egg/i.test(i)
          ? [cap(i), 3, 'large']
          : /rice|bulgur|pasta|oat/i.test(i)
            ? [`${cap(i)} (raw)`, 90, 'g']
            : /potato/i.test(i)
              ? [cap(i), 300, 'g']
              : [cap(i), 120, 'g'],
  );
  ing.push(['Olive oil', 10, 'ml'], ['Salt, pepper, cumin', 1, 'pinch']);
  return {
    n: carb ? t('{a} and {b} skillet', { a: cap(prot), b: carb }) : t('{a} skillet', { a: cap(prot) }),
    m: [0.32, 0.43, 0.25],
    tag: meal.r.tag,
    min: 25,
    gen: true,
    ing,
    steps: steps(words, t),
  };
}

/** "Make from my ingredients": type what you have, get a recipe with the same calories (design: SH.ingr). */
export function IngredientsSheet({ meal, onClose }: { meal: PlannedMeal | null; onClose: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);

  const make = async () => {
    if (!meal) return;
    const v = text.trim();
    if (!v) return setBad(true);
    setBusy(true);
    const words = v
      .split(/,|\band\b|،| و/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    // No recipe task on the server yet: food_text returns ingredients with grams and macros, sized by the request.
    const r = await askAI<Result>('food_text', {
      lang,
      text: `One home-cooked ${meal.n.toLowerCase()} recipe of about ${meal.k} kcal total, using only: ${words.join(', ')} (plus a little oil and spices). The title is the dish name. List each ingredient with raw grams for one serving.`,
    });
    let recipe: CustomRecipe;
    const items = (r.result?.items ?? []).filter((x) => x.kcal > 0 && x.grams > 0);
    const K = items.reduce((a, x) => a + x.kcal, 0);
    if (r.result && items.length && K > 0) {
      const P = items.reduce((a, x) => a + x.protein, 0) * 4;
      const C = items.reduce((a, x) => a + x.carbs, 0) * 4;
      const F = items.reduce((a, x) => a + x.fat, 0) * 9;
      const tot = P + C + F || 1;
      recipe = {
        n: (r.result.title || words.map(cap).join(', ')).slice(0, 60),
        m: [P / tot, C / tot, F / tot],
        tag: meal.r.tag,
        min: 25,
        gen: true,
        // Recipes are written for 600 kcal; the plan scales them to the meal's calories.
        ing: items.map((x) => [cap(x.name), Math.max(1, (x.grams * 600) / K), 'g']),
        steps: steps(
          items.map((x) => x.name),
          t,
        ),
      };
    } else recipe = localRecipe(words, meal, t);
    const before = food.plan.custom;
    food.updatePlan({ custom: { ...(food.plan.custom ?? {}), [meal.key]: recipe } });
    setBusy(false);
    setText('');
    onClose();
    router.push({ pathname: '/recipe', params: { key: meal.key } });
    toast(t('Recipe ready. Same calories as your plan.'), { ai: true, undo: () => food.updatePlan({ custom: before }) });
  };

  return (
    <Sheet open={!!meal} onClose={busy ? () => {} : onClose}>
      {busy ? (
        <Thinking message={t('Making a recipe with your ingredients')} />
      ) : (
        <View>
          <Text variant="h2">{t('Make from my ingredients')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Type what you have at home. You’ll get a recipe with the same calories as this meal.')}
          </Text>
          <TextInput
            value={text}
            onChangeText={(v) => (setText(v), setBad(false))}
            multiline
            maxLength={300}
            placeholder={t('chicken, rice, tomatoes, onion')}
            placeholderTextColor={c.sec}
            accessibilityLabel={t('Your ingredients')}
            style={
              {
                marginTop: 12,
                minHeight: 84,
                borderRadius: 16,
                padding: 12,
                borderWidth: bad ? 1.5 : 0,
                borderColor: c.down,
                backgroundColor: 'rgba(127,127,135,0.12)',
                fontSize: 16,
                color: c.text,
                fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500),
                outlineStyle: 'none',
                textAlign: lang === 'ar' ? 'right' : 'left',
                textAlignVertical: 'top',
              } as object
            }
          />
          <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {CHIPS.map((x) => (
              <Chip key={x} title={`+ ${t(x)}`} onPress={() => setText((s) => (s.trim() ? `${s.trim()}, ${t(x)}` : t(x)))} />
            ))}
          </Row>
          <Button kind="cobalt" icon="sparkle" title={t('Make a recipe')} style={{ marginTop: 16 }} onPress={make} />
        </View>
      )}
    </Sheet>
  );
}
