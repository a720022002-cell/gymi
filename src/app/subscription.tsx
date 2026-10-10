import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

const PRO = { m: 39, y: 299 };
const FREE = ['Calories, macros and water', 'Barcode scan and food search', 'Workout plan, logging and records', 'Weight, sleep and streaks', 'Gym Bros friends and cheers', 'Cycle tracking'];
const PLUS = ['AI coach chat, no limits', 'Meal photo: the AI finds the ingredients', 'Label, machine and blood test photos', 'Recovery score with Apple Health and WHOOP', 'Groups, challenges and train together', 'Weekly reports and PDF export'];

/** Gymi Pro plans (design: subscription). Payments open when the phone apps are in the stores. */
export default function Subscription() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [per, setPer] = useState<'m' | 'y'>('y');
  const yr = per === 'y';
  const month = yr ? Math.round(PRO.y / 12) : PRO.m;
  const save = Math.round((1 - PRO.y / (PRO.m * 12)) * 100);
  return (
    <Screen title={t('Gymi Pro')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Start free. Upgrade when you want the full AI coach.')}
      </Text>
      <View style={{ marginTop: 12 }}>
        <Segmented<'m' | 'y'>
          value={per}
          options={[
            { value: 'm', label: t('Monthly') },
            { value: 'y', label: t('Yearly, save {n}%', { n: save }) },
          ]}
          onChange={setPer}
        />
      </View>
      <Card style={{ marginTop: 12, borderWidth: 2, borderColor: c.cobalt }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text variant="xs" weight={700} color={c.cobalt}>
              {t('Most popular')}
            </Text>
            <Text variant="h2" style={{ marginTop: 6 }}>
              {t('Pro')}
            </Text>
            <Text variant="small" color="sec">
              {t('Your full AI coach')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text num size={30}>
              {month}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t('SAR a month')}
            </Text>
            {yr ? (
              <Text variant="xs" color="sec">
                {t('{n} SAR billed yearly', { n: PRO.y })}
              </Text>
            ) : null}
          </View>
        </Row>
        <Text variant="xs" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 4 }}>
          {t('Everything in Free, plus')}
        </Text>
        {PLUS.map((x) => (
          <Row key={x} gap={8} style={{ marginVertical: 4 }}>
            <Icon name="check" size={16} color={c.cobalt} strokeWidth={2.6} />
            <Text variant="small" style={{ flex: 1 }}>
              {t(x)}
            </Text>
          </Row>
        ))}
        <Button kind="cobalt" title={t('Try Pro free for 7 days')} style={{ marginTop: 12 }} onPress={() => toast(t('Subscriptions open when Gymi launches on the App Store and Google Play. Everything is free until then.'), { icon: 'star' })} />
        <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
          {yr ? t('Then {n} SAR a year. Cancel any time before it renews.', { n: PRO.y }) : t('Then {n} SAR a month. Cancel any time before it renews.', { n: PRO.m })}
        </Text>
      </Card>
      <Card>
        <Text variant="h3">{t('Free')}</Text>
        <Text variant="small" color="sec">
          {t('Yours forever')}
        </Text>
        {FREE.map((x) => (
          <Row key={x} gap={8} style={{ marginVertical: 4 }}>
            <Icon name="check" size={16} color={c.up} strokeWidth={2.6} />
            <Text variant="small" style={{ flex: 1 }}>
              {t(x)}
            </Text>
          </Row>
        ))}
      </Card>
      <Text variant="xs" color="sec" center>
        {t('You’re on the free plan. During early access every feature is open.')}
      </Text>
    </Screen>
  );
}
