import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useFood, useLogFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

type Ing = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
type Result = { found: boolean; title: string; servings: number; ingredients: Ing[]; steps: string[]; note?: string; site?: string };
/** An ingredient you can change: grams, with calories and macros per gram from the AI. */
type Row_ = { name: string; g: number; per: { k: number; p: number; c: number; f: number } };

const FRAMES = 8;

/** Eight pictures spread through the video (web), small enough to send. Sound isn't used. */
async function videoFrames(uri: string): Promise<string[]> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = uri;
  await new Promise<void>((ok, no) => {
    v.onloadedmetadata = () => ok();
    v.onerror = () => no(new Error('video'));
  });
  const cv = document.createElement('canvas');
  const scale = Math.min(1, 640 / Math.max(v.videoWidth || 640, v.videoHeight || 640));
  cv.width = Math.round((v.videoWidth || 360) * scale);
  cv.height = Math.round((v.videoHeight || 640) * scale);
  const ctx = cv.getContext('2d');
  if (!ctx || !isFinite(v.duration)) throw new Error('video');
  const out: string[] = [];
  for (let i = 0; i < FRAMES; i++) {
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      v.currentTime = (v.duration * (i + 0.5)) / FRAMES;
    });
    ctx.drawImage(v, 0, 0, cv.width, cv.height);
    out.push(cv.toDataURL('image/jpeg', 0.7).split(',')[1]);
  }
  return out;
}

/** Recipe from a video: a TikTok, Instagram or YouTube link, or a video you upload. The AI lists the ingredients with calories, the steps and the servings; you check it and save it. */
export default function RecipeImport() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  const [url, setUrl] = useState('');
  const [frames, setFrames] = useState<string[] | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(1);
  const [rows, setRows] = useState<Row_[]>([]);
  const [saving, setSaving] = useState(false);
  const web = Platform.OS === 'web';

  const pickVideo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    const uri = r.canceled ? null : r.assets?.[0]?.uri;
    if (!uri) return;
    setReading(true);
    setErr(null);
    try {
      setFrames(await videoFrames(uri));
    } catch {
      setFrames(null);
      setErr(t('Couldn’t read that video. Try another one, or paste the link.'));
    }
    setReading(false);
  };

  const run = async () => {
    setBusy(true);
    setErr(null);
    const r = await askAI<Result>('recipe', { url: url.trim() || undefined, frames: frames ?? undefined, lang });
    setBusy(false);
    if (r.error || !r.result) return setErr(t(aiErrorText(r.error as AiError)));
    const x = r.result;
    if (!x.found || !x.ingredients?.length) {
      return setErr(
        x.note === 'no_content'
          ? t('Couldn’t open that link. It may be private, or Instagram hid it. Upload the video instead.')
          : t('The recipe isn’t written in this post. Upload the video so the AI can read what’s shown in it.'),
      );
    }
    setRes(x);
    setTitle(x.title);
    setServings(Math.max(1, Math.min(20, Math.round(x.servings) || 1)));
    setRows(x.ingredients.map((i) => ({ name: i.name, g: Math.max(0, Math.round(i.grams)), per: { k: i.kcal / (i.grams || 1), p: i.protein / (i.grams || 1), c: i.carbs / (i.grams || 1), f: i.fat / (i.grams || 1) } })));
  };

  const tot = rows.reduce((a, x) => ({ k: a.k + x.per.k * x.g, p: a.p + x.per.p * x.g, c: a.c + x.per.c * x.g, f: a.f + x.per.f * x.g }), { k: 0, p: 0, c: 0, f: 0 });
  const one = { k: tot.k / servings, p: tot.p / servings, c: tot.c / servings, f: tot.f / servings };

  // Saved per serving, so logging it adds one portion.
  const save = async (andLog: boolean) => {
    if (!res || !title.trim()) return;
    setSaving(true);
    const list = rows.filter((x) => x.g > 0);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const meal = await food.saveMeal({
      name: title.trim().slice(0, 80),
      items: list.map((x) => x.name).join(t(', ')).slice(0, 300),
      ingredients: list.map((x) => ({ n: x.name, g: r1(x.g / servings), k: r1((x.per.k * x.g) / servings), p: r1((x.per.p * x.g) / servings), c: r1((x.per.c * x.g) / servings), f: r1((x.per.f * x.g) / servings) })),
      kcal: Math.round(one.k),
      protein: r1(one.p),
      carbs: r1(one.c),
      fat: r1(one.f),
      steps: res.steps.slice(0, 40).map((s) => s.slice(0, 500)),
      servings,
      source: url.trim().slice(0, 500) || null,
    });
    if (!meal) {
      setSaving(false);
      return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    }
    if (andLog) await logFood({ name: meal.name, parts: list.map((x) => x.name), kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }, toast, t);
    else toast(t('Saved “{name}”', { name: meal.name }), { icon: 'bookmark' });
    setSaving(false);
    router.replace('/saved-meals');
  };

  if (!res)
    return (
      <Screen title={t('Recipe from a video')} back>
        <Text color="sec" style={{ marginTop: -8 }}>
          {t('Paste a TikTok, Instagram or YouTube link, or upload the video. The AI finds the recipe and works out the calories.')}
        </Text>
        <Field label={t('Video link')} value={url} onChangeText={setUrl} placeholder="https://www.tiktok.com/…" autoCapitalize="none" autoCorrect={false} inputMode="url" />
        {web ? (
          <Button kind="soft" icon="play" color={c.text} loading={reading} title={frames ? t('Video added ✓ (tap to change)') : t('Or upload the video')} style={{ marginTop: 4 }} onPress={pickVideo} />
        ) : null}
        {err ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
            <Icon name="warn" size={18} color={c.down} />
            <Text variant="small" style={{ flex: 1 }}>
              {err}
            </Text>
          </Card>
        ) : null}
        <Button icon="sparkle" title={t('Get the recipe')} loading={busy} disabled={reading || (!url.trim() && !frames)} style={{ marginTop: 16 }} onPress={run} />
        <Text variant="xs" color="sec" center style={{ marginTop: 10 }}>
          {t('The AI reads the post’s caption and what’s shown in the video, not the sound. If a link doesn’t work (Instagram often hides posts), upload the video.')}
        </Text>
      </Screen>
    );

  return (
    <Screen title={t('Your recipe')} back onBack={() => setRes(null)}>
      <Field label={t('Name')} value={title} onChangeText={setTitle} maxLength={80} />
      <Card style={{ marginTop: 4 }}>
        <Row gap={10} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight={700}>{t('Servings')}</Text>
            <Text variant="xs" color="sec">
              {t('How many portions the whole recipe makes')}
            </Text>
          </View>
          <Row gap={8}>
            <Springy disabled={servings <= 1} onPress={() => setServings(servings - 1)} accessibilityLabel={t('Fewer servings')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', opacity: servings <= 1 ? 0.4 : 1 }}>
              <Icon name="minus" size={16} />
            </Springy>
            <Text num size={20} style={{ minWidth: 28, textAlign: 'center' }}>
              {servings}
            </Text>
            <Springy disabled={servings >= 20} onPress={() => setServings(servings + 1)} accessibilityLabel={t('More servings')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={16} />
            </Springy>
          </Row>
        </Row>
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 12 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{t('One serving')}</Text>
          <Text num size={24}>{`${fmt(one.k)} ${t('kcal')}`}</Text>
        </Row>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Protein {p} g · Carbs {c} g · Fat {f} g', { p: Math.round(one.p), c: Math.round(one.c), f: Math.round(one.f) })}
        </Text>
        <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
          {t('Whole recipe: {k} kcal', { k: fmt(tot.k) })}
        </Text>
      </Card>

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Ingredients (whole recipe)')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {rows.map((x, i) => (
          <Row key={`${x.name}-${i}`} gap={10} style={{ minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight={700} numberOfLines={2}>
                {x.name}
              </Text>
              <Text variant="xs" color="sec">{`${fmt(x.per.k * x.g)} ${t('kcal')}`}</Text>
            </View>
            <TextInput
              value={x.g ? String(x.g) : ''}
              onChangeText={(v) => setRows(rows.map((y, j) => (j === i ? { ...y, g: Math.min(5000, Number(v.replace(/\D/g, '')) || 0) } : y)))}
              inputMode="numeric"
              accessibilityLabel={t('Grams of {x}', { x: x.name })}
              style={{ width: 72, height: 40, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontSize: 16, color: c.text }}
            />
            <Text variant="small" color="sec">
              {t('g')}
            </Text>
            <Springy onPress={() => setRows(rows.filter((_, j) => j !== i))} accessibilityLabel={t('Remove {name}', { name: x.name })} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color={c.sec} />
            </Springy>
          </Row>
        ))}
      </View>

      {res.steps.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Steps')}
          </Text>
          <Card>
            {res.steps.map((s, i) => (
              <Row key={i} gap={10} style={{ alignItems: 'flex-start', marginTop: i ? 10 : 0 }}>
                <Text num weight={700} style={{ color: c.cobalt, minWidth: 18 }}>
                  {i + 1}
                </Text>
                <Text variant="small" style={{ flex: 1 }}>
                  {s}
                </Text>
              </Row>
            ))}
          </Card>
        </>
      ) : null}
      {res.note ? (
        <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {res.note}
        </Text>
      ) : null}
      <Text variant="xs" color="sec" style={{ marginTop: 6, marginHorizontal: 4 }}>
        {t('AI estimate. Check the grams before you save.')}
      </Text>
      <Button icon="bookmark" title={t('Save recipe')} loading={saving} disabled={!title.trim() || !rows.some((x) => x.g > 0)} style={{ marginTop: 16 }} onPress={() => save(false)} />
      <Button kind="glass" icon="plus" title={t('Save and log 1 serving ({k} kcal)', { k: fmt(one.k) })} disabled={saving || !title.trim() || !rows.some((x) => x.g > 0)} style={{ marginTop: 8 }} onPress={() => save(true)} />
    </Screen>
  );
}
