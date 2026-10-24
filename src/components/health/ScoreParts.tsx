import { View } from 'react-native';

import { useT } from '@/i18n';
import type { recovery } from '@/lib/recovery';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Bar } from '../Ring';
import { Text } from '../Text';
import { Card, Row } from '../ui';

/** What's in the recovery score: each part (sleep, soreness, energy, load, food…) with its bar and why. */
export function ScoreParts({ parts, empty = 'Answer the questions above' }: { parts: ReturnType<typeof recovery>['parts']; empty?: string }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card>
      {parts.map((p) => (
        <View key={p.key} style={{ marginTop: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={8}>
              <Icon name={p.icon as IconName} size={16} color={c.cobalt} />
              <Text variant="small" weight={700}>
                {t(p.key)}
              </Text>
            </Row>
            <Text variant="small" weight={700} num>
              {p.value}
            </Text>
          </Row>
          <View style={{ marginTop: 4 }}>
            <Bar value={p.value} max={100} color={p.value >= 75 ? c.up : p.value >= 50 ? c.cobalt : c.down} />
          </View>
          <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
            {p.sub ? t(p.sub.t, p.sub as unknown as Record<string, string | number>) : t(empty)}
          </Text>
        </View>
      ))}
    </Card>
  );
}
