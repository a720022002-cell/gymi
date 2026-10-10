import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useHealth } from '@/lib/health';
import { fmtTime } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

/** Health hub: vitamins and blood tests (design: progHealth). */
export default function HealthScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const h = useHealth();
  const bt = h.blood[0];
  const bad = bt ? bt.values.filter((v) => v.flag !== 0).length : 0;
  const ico = (name: IconName) => (
    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={20} color={c.cobalt} />
    </View>
  );
  return (
    <Screen title={t('Health')} back>
      <Card onPress={() => router.push('/vitamins')}>
        <Row>
          {ico('pill')}
          <Text weight={700} style={{ flex: 1 }}>
            {t('Vitamins and supplements')}
          </Text>
          <Icon name="chev" size={18} color={c.sec} />
        </Row>
        {h.supplements.length ? (
          <View style={{ marginTop: 10 }}>
            {h.supplements.map((v) => (
              <Row key={v.id} style={{ justifyContent: 'space-between', marginVertical: 3 }}>
                <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{`${v.name}${v.dose ? `, ${v.dose} ${v.unit}` : ''}`}</Text>
                <Text variant="small" color="sec">
                  {!v.active ? t('Paused') : v.remind ? fmtTime(v.time, lang) : t('No reminder')}
                </Text>
              </Row>
            ))}
          </View>
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 8 }}>
            {t('Add what you take to keep track of it.')}
          </Text>
        )}
      </Card>
      <Card onPress={() => router.push('/blood')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {ico('doc')}
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Blood tests')}</Text>
          <Text variant="small" color="sec">
            {bt
              ? bad
                ? t('{d} report, {n} values to check with your doctor', { d: shortDate(bt.day, lang), n: bad })
                : t('{d} report, all values in the normal range', { d: shortDate(bt.day, lang) })
              : t('Take a photo of a lab report and I’ll read the values')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
      <Row gap={8} style={{ alignItems: 'flex-start', marginTop: 8, paddingHorizontal: 4 }}>
        <Icon name="info" size={18} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Gymi logs your health data. It never suggests treatment or doses. Ask your doctor before starting anything new.')}
        </Text>
      </Row>
    </Screen>
  );
}
