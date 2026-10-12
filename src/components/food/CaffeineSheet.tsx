import { View } from 'react-native';

import { useT } from '@/i18n';
import { CAFFEINE_DAY, CAFFEINE_ONCE, showCaffeineAlert, useCaffeineAlert } from '@/lib/caffeine';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { Button, Row } from '../ui';

/** "That's a lot of caffeine": after logging a big coffee, energy drink or pre-workout. */
export function CaffeineSheet() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const a = useCaffeineAlert();
  const close = () => showCaffeineAlert(null);
  const overDay = !!a && a.day > CAFFEINE_DAY;
  return (
    <Sheet open={!!a} onClose={close}>
      {a ? (
        <View>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(245,158,11,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="warn" size={26} color="#F59E0B" />
          </View>
          <Text variant="h2" style={{ marginTop: 12 }}>
            {t('That’s a high dose of caffeine')}
          </Text>
          <Text color="sec" style={{ marginTop: 6 }}>
            {overDay
              ? t('About {n} mg of caffeine today. The usual safe amount for adults is up to {max} mg a day.', { n: a.day, max: CAFFEINE_DAY })
              : t('About {n} mg in one go. More than {max} mg at once can cause a racing heart, shakes or a crash later.', { n: a.once, max: CAFFEINE_ONCE })}
          </Text>
          <View style={{ marginTop: 14, gap: 10 }}>
            {[
              t('Drink a glass of water with it.'),
              a.late ? t('It’s late in the day: caffeine can stay in your body for 6 hours and hurt your sleep.') : t('Try to have your last caffeine before 3 pm, so you sleep well.'),
              t('If your heart races or you feel dizzy, stop and rest.'),
            ].map((x) => (
              <Row key={x} gap={10} style={{ alignItems: 'flex-start' }}>
                <Icon name="check" size={16} color={c.cobalt} strokeWidth={2.4} />
                <Text variant="small" style={{ flex: 1 }}>
                  {x}
                </Text>
              </Row>
            ))}
          </View>
          <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
            {t('A guess from the name of what you logged. Pregnant, or sensitive to caffeine? Ask your doctor what’s right for you.')}
          </Text>
          <Button title={t('Got it')} style={{ marginTop: 16 }} onPress={close} />
        </View>
      ) : null}
    </Sheet>
  );
}
