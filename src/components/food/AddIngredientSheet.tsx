import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import type { SavedMeal } from '@/lib/food';
import { type Photo, takeLabelPhoto, takePhoto } from '@/lib/photo';
import { canListen, listen } from '@/lib/speech';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { Button, Row, Springy } from '../ui';
import type { OwnFood } from './PickFood';

type AiItem = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };
type Label = { name?: string; serving?: number; kcal_100: number; protein_100: number; carbs_100: number; fat_100: number };

/** The foods in a meal photo, as ingredients (or the AI's error). */
export async function mealPhotoIngredients(p: Photo, lang: 'en' | 'ar'): Promise<{ items: OwnFood[]; error?: AiError }> {
  const r = await askAI<{ items?: AiItem[] }>('meal_photo', { lang, image: p.base64, mime: p.mime });
  if (r.error || !r.result) return { items: [], error: r.error ?? 'failed' };
  return { items: toOwn(r.result.items ?? []) };
}

/** AI items (numbers for the amount eaten) as ingredients with numbers per 100 g. */
const toOwn = (items: AiItem[]): OwnFood[] =>
  items
    .filter((x) => x && x.name && +x.kcal > 0)
    .map((x) => {
      const g = Math.max(1, +x.grams || 100);
      return { n: String(x.name).slice(0, 80), g: Math.round(g), per: { k: (+x.kcal * 100) / g, p: ((+x.protein || 0) * 100) / g, c: ((+x.carbs || 0) * 100) / g, f: ((+x.fat || 0) * 100) / g } };
    });

/**
 * "Add an ingredient" for a meal you're making: the same ways as Log food (search, meal photo, barcode, label photo,
 * saved meals, type it), but what you pick is added to the meal instead of logged.
 */
export function AddIngredientSheet({
  open,
  onClose,
  onSearch,
  onScan,
  onMealCamera,
  onAdd,
  saved,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
  onScan: () => void;
  /** Phone apps: open our own camera screen for a meal photo (its foods come back to the meal). */
  onMealCamera?: () => void;
  onAdd: (fs: OwnFood[]) => void;
  saved: SavedMeal[];
  onSaved: (m: SavedMeal) => void;
}) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [mode, setMode] = useState<'menu' | 'type' | 'saved' | 'gallery' | 'meal' | 'label'>('menu');
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setMode('menu');
      setErr(null);
    }, 320);
  };
  const fail = (e?: AiError) => setErr(e ? aiErrorText(e) : 'I couldn’t work that out. Try again.');
  const add = (fs: OwnFood[]) => {
    if (!fs.length) return fail();
    onAdd(fs);
    setText('');
    close();
  };

  /** The camera must open from the tap. Cancelled: offer the camera or the gallery again. */
  const photo = async (kind: 'meal' | 'label', camera = true) => {
    setErr(null);
    if (kind === 'meal' && camera && onMealCamera && Platform.OS !== 'web') {
      close();
      setTimeout(onMealCamera, 320);
      return;
    }
    const p = await (kind === 'label' ? takeLabelPhoto : takePhoto)(camera);
    if (!p) return setMode(kind);
    if (kind === 'meal') {
      setBusy('Looking at your meal');
      const r = await mealPhotoIngredients(p, lang);
      setBusy(null);
      if (r.error) return fail(r.error), setMode('meal');
      add(r.items);
    } else {
      setBusy('Reading the label');
      const r = await askAI<Label>('label_photo', { lang, image: p.base64, mime: p.mime });
      setBusy(null);
      const x = r.result;
      if (r.error || !x || !(+x.kcal_100 > 0)) return fail(r.error), setMode('label');
      add([{ n: (x.name || t('Label photo')).slice(0, 80), g: Math.round(x.serving && x.serving > 0 ? x.serving : 100), per: { k: +x.kcal_100, p: +x.protein_100 || 0, c: +x.carbs_100 || 0, f: +x.fat_100 || 0 } }]);
    }
  };
  const typed = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setErr(null);
    setBusy('Working out the calories');
    const r = await askAI<{ items?: AiItem[] }>('food_text', { lang, text: v.slice(0, 500) });
    setBusy(null);
    if (r.error || !r.result) return fail(r.error);
    add(toOwn(r.result.items ?? []));
  };

  const back = (title: string) => (
    <Row gap={8}>
      <Springy onPress={() => (setMode('menu'), setErr(null))} accessibilityLabel={t('Back')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={20} />
      </Springy>
      <Text variant="h2">{t(title)}</Text>
    </Row>
  );
  const error = err ? (
    <Text variant="small" color="down" style={{ marginTop: 10 }}>
      {t(err)}
    </Text>
  ) : null;

  const tiles: [IconName, string, string, () => void][] = [
    ['camera', 'Meal photo', 'AI finds the ingredients', () => photo('meal')],
    ['barcode', 'Scan barcode', 'Packaged food', () => (close(), setTimeout(onScan, 320))],
    ['doc', 'Label photo', 'Photo + grams eaten', () => photo('label')],
    ['bookmark', 'Saved meals', t('{n} saved', { n: saved.length }), () => setMode('saved')],
  ];

  return (
    <Sheet open={open} onClose={close}>
      {busy ? (
        <View style={{ alignItems: 'center', paddingVertical: 36, gap: 12 }}>
          <ActivityIndicator color={c.cobalt} />
          <Text color="sec">{t(busy)}</Text>
        </View>
      ) : mode === 'type' ? (
        <View>
          {back('Type what you ate')}
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Write it like you’d say it. The AI works out the calories.')}
          </Text>
          <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.12)', borderRadius: 18, padding: 12 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              maxLength={500}
              placeholder={t(listening ? 'Listening…' : 'For example: 2 eggs, a piece of toast and a laban')}
              placeholderTextColor={c.sec}
              style={{ minHeight: 80, fontSize: 16, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left', textAlignVertical: 'top' } as object}
            />
          </View>
          {error}
          <Row gap={10} style={{ marginTop: 12 }}>
            {canListen() ? (
              <Button
                kind="soft"
                icon="mic"
                title={t(listening ? 'Listening…' : 'Say it')}
                onPress={async () => {
                  setListening(true);
                  const s = await listen(lang);
                  setListening(false);
                  if (s) setText((x) => (x ? `${x} ${s}` : s));
                }}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button title={t('Work it out')} disabled={!text.trim()} onPress={typed} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : mode === 'saved' ? (
        <View>
          {back('Saved meals')}
          {saved.length ? (
            <ScrollView style={{ maxHeight: 360, marginTop: 12 }}>
              {saved.map((m) => (
                <Springy
                  key={m.id}
                  onPress={() => (onSaved(m), close())}
                  scaleTo={0.98}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, marginBottom: 8, backgroundColor: 'rgba(127,127,135,0.1)' }}>
                  <Icon name="bookmark" size={20} color={c.cobalt} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight={700} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text variant="xs" color="sec">
                      {t('{n} kcal', { n: fmt(m.kcal) })}
                    </Text>
                  </View>
                  <Icon name="plus" size={18} color={c.sec} />
                </Springy>
              ))}
            </ScrollView>
          ) : (
            <Text color="sec" style={{ marginTop: 12 }}>
              {t('No saved meals yet')}
            </Text>
          )}
        </View>
      ) : mode === 'gallery' || mode === 'meal' || mode === 'label' ? (
        <View>
          {back(mode === 'label' ? 'Label photo' : mode === 'meal' ? 'Meal photo' : 'Choose from photos')}
          {error}
          {mode === 'gallery' ? (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button kind="soft" icon="camera" title={t('A meal')} onPress={() => photo('meal', false)} />
              <Button kind="soft" icon="doc" title={t('A nutrition label')} onPress={() => photo('label', false)} />
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button icon="camera" title={t('Take photo')} onPress={() => photo(mode)} />
              <Button kind="soft" icon="image" title={t('Choose from photos')} onPress={() => photo(mode, false)} />
            </View>
          )}
        </View>
      ) : (
        <View>
          <Text variant="h2">{t('Add an ingredient')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
            {t('Pick the fastest way for you.')}
          </Text>
          <Springy
            onPress={() => (close(), setTimeout(onSearch, 320))}
            scaleTo={0.985}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 16, paddingHorizontal: 16, backgroundColor: 'rgba(127,127,135,0.12)' }}>
            <Icon name="search" size={20} color={c.sec} />
            <Text color="sec">{t('Search Saudi dishes, restaurants…')}</Text>
          </Springy>
          {[tiles.slice(0, 2), tiles.slice(2)].map((pair, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 10, marginTop: r ? 10 : 12 }}>
              {pair.map(([icon, title, sub, fn]) => (
                <Springy key={title} onPress={fn} scaleTo={0.97} style={{ flex: 1, minHeight: 112, borderRadius: 22, padding: 16, backgroundColor: 'rgba(127,127,135,0.1)' }}>
                  <Icon name={icon} size={26} color={c.cobalt} />
                  <Text weight={700} numberOfLines={1} style={{ marginTop: 8 }}>
                    {t(title)}
                  </Text>
                  <Text variant="xs" color="sec" numberOfLines={2}>
                    {t(sub)}
                  </Text>
                </Springy>
              ))}
            </View>
          ))}
          <Springy onPress={() => setMode('gallery')} style={{ marginTop: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}>
            <Icon name="image" size={16} color={c.link} />
            <Text variant="small" weight={700} color="link">
              {t('Choose from photos')}
            </Text>
          </Springy>
          <Springy onPress={() => setMode('type')} scaleTo={0.985} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, backgroundColor: 'rgba(127,127,135,0.1)' }}>
            <Icon name="edit" size={20} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Type what you ate')}</Text>
              <Text variant="xs" color="sec">
                {t('Or say it. The AI works out the calories.')}
              </Text>
            </View>
            <Icon name="chev" size={16} color={c.sec} />
          </Springy>
        </View>
      )}
    </Sheet>
  );
}
