import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Springy } from '../ui';

/** "Log food" menu (design: SH.log menu). AI options arrive with the AI coach. */
export function LogSheet() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const close = () => food.setLogOpen(false);
  const go = (path: '/food-search' | '/barcode' | '/saved-meals') => {
    close();
    setTimeout(() => router.push(path), 200);
  };
  const soon = () => toast(t('Coming with the AI coach'), { ai: true });

  const tiles: [IconName, string, string, () => void, boolean][] = [
    ['camera', 'Meal photo', 'AI finds the ingredients', soon, true],
    ['barcode', 'Scan barcode', 'Packaged food', () => go('/barcode'), false],
    ['doc', 'Label photo', 'Photo + grams eaten', soon, true],
    ['bookmark', 'Saved meals', t('{n} saved', { n: food.saved.length }), () => go('/saved-meals'), false],
  ];

  return (
    <Sheet open={food.logOpen} onClose={close}>
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {tiles.map(([icon, title, sub, fn, ai]) => (
          <Springy key={title} onPress={fn} scaleTo={0.97} style={{ width: '48%', flexGrow: 1, borderRadius: 22, padding: 16, backgroundColor: 'rgba(127,127,135,0.1)', opacity: ai ? 0.7 : 1 }}>
            <Icon name={icon} size={26} color={c.cobalt} />
            <Text weight={700} style={{ marginTop: 8 }}>
              {t(title)}
            </Text>
            <Text variant="xs" color="sec">
              {ai ? t('Coming soon') : t(sub)}
            </Text>
          </Springy>
        ))}
      </View>
      <Springy onPress={soon} scaleTo={0.985} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, backgroundColor: 'rgba(127,127,135,0.1)', opacity: 0.7 }}>
        <Icon name="edit" size={20} color={c.cobalt} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Type what you ate')}</Text>
          <Text variant="xs" color="sec">
            {t('Coming soon')}
          </Text>
        </View>
      </Springy>
    </Sheet>
  );
}
