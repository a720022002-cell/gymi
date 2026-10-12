import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { setPendingPhoto } from '@/lib/pending';
import { takePhoto } from '@/lib/photo';
import { canListen, listen } from '@/lib/speech';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { Button, Chip, Row, Springy } from '../ui';

/** "Log food" menu (design: SH.log menu). */
export function LogSheet() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  /** Photo choice after the camera was closed, or when picking from the gallery. */
  const [chooser, setChooser] = useState<'/meal-result' | '/label-result' | 'gallery' | null>(null);
  // "Type it instead" from search opens straight into typing with the search words.
  const [seeded, setSeeded] = useState<string | null>(null);
  if (food.typeSeed !== null && food.typeSeed !== seeded) {
    setSeeded(food.typeSeed);
    setText(food.typeSeed);
    setTyping(true);
  }
  const close = () => {
    food.setLogOpen(false);
    setTyping(false);
    setChooser(null);
    setSeeded(null);
  };
  const go = (path: '/food-search' | '/barcode' | '/saved-meals' | '/recipe-import') => {
    close();
    setTimeout(() => router.push(path), 200);
  };
  /** Open the camera now (it must start from the tap), then read the photo on the next screen. Cancel offers the gallery. */
  const photo = async (path: '/meal-result' | '/label-result', camera = true) => {
    const p = await takePhoto(camera);
    if (!p) {
      setChooser(path);
      return;
    }
    setPendingPhoto(p);
    close();
    setTimeout(() => router.push(path), 200);
  };
  const sendText = (s: string) => {
    const v = s.trim();
    if (!v) return;
    close();
    setText('');
    setTimeout(() => router.push({ pathname: '/meal-result', params: { text: v.slice(0, 500) } }), 200);
  };

  const tiles: [IconName, string, string, () => void][] = [
    ['camera', 'Meal photo', 'AI finds the ingredients', () => photo('/meal-result')],
    ['barcode', 'Scan barcode', 'Packaged food', () => go('/barcode')],
    ['doc', 'Label photo', 'Photo + grams eaten', () => photo('/label-result')],
    ['bookmark', 'Saved meals', t('{n} saved', { n: food.saved.length }), () => go('/saved-meals')],
  ];

  return (
    <Sheet open={food.logOpen} onClose={close}>
      {typing ? (
        <View>
          <Row gap={8}>
            <Springy onPress={() => setTyping(false)} accessibilityLabel={t('Back')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" size={20} />
            </Springy>
            <Text variant="h2">{t('Type what you ate')}</Text>
          </Row>
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
          <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {[t('chicken and rice'), t('chicken shawarma wrap'), t('kabsa'), t('3 dates and laban')].map((x) => (
              <Chip key={x} title={x} onPress={() => setText(x)} />
            ))}
          </Row>
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
            <Button title={t('Work it out')} disabled={!text.trim()} onPress={() => sendText(text)} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : chooser ? (
        <View>
          <Row gap={8}>
            <Springy onPress={() => setChooser(null)} accessibilityLabel={t('Back')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="back" size={20} />
            </Springy>
            <Text variant="h2">{t(chooser === '/label-result' ? 'Label photo' : chooser === '/meal-result' ? 'Meal photo' : 'Choose from photos')}</Text>
          </Row>
          {chooser === 'gallery' ? (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button kind="soft" icon="camera" title={t('A meal')} onPress={() => photo('/meal-result', false)} />
              <Button kind="soft" icon="doc" title={t('A nutrition label')} onPress={() => photo('/label-result', false)} />
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Button icon="camera" title={t('Take photo')} onPress={() => photo(chooser)} />
              <Button kind="soft" icon="image" title={t('Choose from photos')} onPress={() => photo(chooser, false)} />
            </View>
          )}
        </View>
      ) : (
        <View>
          <Text variant="h2">{t('Log food')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('Pick the fastest way for you.')}
          </Text>
          <Springy
            onPress={() => go('/food-search')}
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
          <Springy onPress={() => go('/recipe-import')} scaleTo={0.98} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 16, backgroundColor: 'rgba(127,127,135,0.1)' }}>
            <Icon name="play" size={24} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Recipe from a video')}</Text>
              <Text variant="xs" color="sec">
                {t('TikTok, Instagram or your own video. The AI writes the recipe and calories.')}
              </Text>
            </View>
            <Icon name="chev" size={16} color={c.sec} />
          </Springy>
          <Springy onPress={() => setChooser('gallery')} style={{ marginTop: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 }}>
            <Icon name="image" size={16} color={c.link} />
            <Text variant="small" weight={700} color="link">
              {t('Choose from photos')}
            </Text>
          </Springy>
          <Springy onPress={() => setTyping(true)} scaleTo={0.985} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, backgroundColor: 'rgba(127,127,135,0.1)' }}>
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
