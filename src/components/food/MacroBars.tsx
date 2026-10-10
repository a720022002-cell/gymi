import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Bar } from '../Ring';
import { Text } from '../Text';

/** Protein, carbs, fat eaten vs target (design: macroBars). */
export function MacroBars() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { eaten, target } = useFood();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {(
        [
          ['Protein', eaten.p, target.p, c.cobalt],
          ['Carbs', eaten.c, target.c, c.macroC],
          ['Fat', eaten.f, target.f, c.macroF],
        ] as const
      ).map(([label, v, max, color]) => (
        <View key={label} style={{ flex: 1 }}>
          <Text variant="small" color="sec">
            {t(label)}
          </Text>
          <Text num size={16} style={{ marginTop: 1, marginBottom: 6 }}>
            {fmt(v)}
            <Text num size={16} weight={500} color="sec">{`/${fmt(max)}${t('g')}`}</Text>
          </Text>
          <Bar value={v} max={max} color={color} />
        </View>
      ))}
    </View>
  );
}
