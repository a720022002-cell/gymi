import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';

/** Log water while training (a normal or a group workout): it goes to today's water. */
export function WaterButton({ size = 40 }: { size?: number }) {
  const { t } = useT();
  const food = useFood();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const drink = async (ml: number) => {
    setOpen(false);
    await food.addWater(ml, 'Water', food.today);
    toast(t('+{n} ml water', { n: ml }), { icon: 'drop' });
  };
  return (
    <>
      <Springy
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('Log water')}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(56,189,248,0.16)' }}>
        <Icon name="drop" size={Math.round(size / 2)} color="#38BDF8" />
      </Springy>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <Text variant="h2" center>
          {t('How much did you drink?')}
        </Text>
        {food.isToday ? (
          <Text color="sec" center style={{ marginTop: 4 }}>
            {t('{n} ml so far today', { n: food.water })}
          </Text>
        ) : null}
        <Row gap={8} style={{ marginTop: 16 }}>
          {[150, 250, 500, 750].map((ml) => (
            <View key={ml} style={{ flex: 1 }}>
              <Button kind="soft" title={`${ml}`} style={{ alignSelf: 'stretch' }} onPress={() => drink(ml)} />
            </View>
          ))}
        </Row>
        <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
          {t('ml')}
        </Text>
      </Sheet>
    </>
  );
}
