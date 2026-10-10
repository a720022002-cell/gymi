import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { HOME_NAMES, useHomeLayout } from '@/lib/homeLayout';
import { useSettings } from '@/theme/settings';

/** Edit home: move cards up or down and turn off what you don't need (design: customize). */
export default function Customize() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [l, save] = useHomeLayout();
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= l.order.length) return;
    const order = [...l.order];
    [order[i], order[j]] = [order[j], order[i]];
    save({ ...l, order });
  };
  return (
    <Screen title={t('Edit home')} back>
      <Text color="sec" style={{ marginTop: -8, marginBottom: 16 }}>
        {t('Move cards up or down. Turn off what you don’t need.')}
      </Text>
      <List>
        {l.order.map((k, i) => (
          <ListRow key={k} first={!i}>
            <View style={{ gap: 2 }}>
              <Springy accessibilityLabel={t('Move up')} disabled={!i} onPress={() => move(i, -1)} style={{ width: 32, height: 24, alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.3 }}>
                <Icon name="up" size={16} color={c.sec} />
              </Springy>
              <Springy accessibilityLabel={t('Move down')} disabled={i === l.order.length - 1} onPress={() => move(i, 1)} style={{ width: 32, height: 24, alignItems: 'center', justifyContent: 'center', opacity: i === l.order.length - 1 ? 0.3 : 1 }}>
                <Icon name="down" size={16} color={c.sec} />
              </Springy>
            </View>
            <Text weight={700} style={{ flex: 1 }}>
              {t(HOME_NAMES[k])}
            </Text>
            <Toggle value={!l.hidden.includes(k)} label={t(HOME_NAMES[k])} onChange={(on) => save({ ...l, hidden: on ? l.hidden.filter((x) => x !== k) : [...l.hidden, k] })} />
          </ListRow>
        ))}
      </List>
      <Text variant="small" color="sec" center>
        {t('Changes save as you go.')}
      </Text>
    </Screen>
  );
}
