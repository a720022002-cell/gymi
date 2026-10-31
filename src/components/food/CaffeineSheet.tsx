import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { CAFFEINE_DAY, CAFFEINE_ONCE, type CaffeineAlert, muteCaffeineToday, showCaffeineAlert, useCaffeineAlert } from '@/lib/caffeine';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet, useSheetsOnScreen } from '../Sheet';
import { Text } from '../Text';
import { Button, Row, Springy } from '../ui';

/** "That's a lot of caffeine": after logging a big coffee, energy drink or pre-workout. */
export function CaffeineSheet() {
  const a = useCaffeineAlert();
  const close = () => showCaffeineAlert(null);
  // On iPhone a sheet that opens while another is still on screen (the food log closing) never appears: wait until
  // no other sheet is there, then stay open until it's closed.
  const others = useSheetsOnScreen();
  const [shown, setShown] = useState<CaffeineAlert | null>(null);
  if (a && a !== shown && others === 0) setShown(a);
  if (!a && shown) setShown(null);
  return (
    <Sheet open={!!a && shown === a} onClose={close}>
      {a ? <CaffeineBody a={a} onClose={close} /> : null}
    </Sheet>
  );
}

/**
 * The warning itself, so a sheet that's already open (Add a drink) can show it in place: on iPhone a second sheet
 * opening right as the first one closes can fail to appear.
 */
export function CaffeineBody({ a, onClose }: { a: CaffeineAlert; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const max = a.max ?? CAFFEINE_DAY;
  const preg = max < CAFFEINE_DAY;
  const overDay = a.day > max;
  return (
    <View>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(245,158,11,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="warn" size={26} color="#F59E0B" />
      </View>
      <Text variant="h2" style={{ marginTop: 12 }}>
        {t('That’s a high dose of caffeine')}
      </Text>
      <Text color="sec" style={{ marginTop: 6 }}>
        {overDay
          ? preg
            ? t('About {n} mg of caffeine today. In pregnancy, the usual advice is up to {max} mg a day.', { n: a.day, max })
            : t('About {n} mg of caffeine today. The usual safe amount for adults is up to {max} mg a day.', { n: a.day, max })
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
        {t('A guess from what you logged. Pregnant, or sensitive to caffeine? Ask your doctor what’s right for you.')}
      </Text>
      <Button title={t('Got it')} style={{ marginTop: 16 }} onPress={onClose} />
      <Springy onPress={() => (muteCaffeineToday(), onClose())} scaleTo={0.97} style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text variant="small" weight={600} color="sec">
          {t('Don’t remind me today')}
        </Text>
      </Springy>
    </View>
  );
}
