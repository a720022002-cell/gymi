import { View } from 'react-native';

import { useT } from '@/i18n';
import type { CommitParts } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

import { Bar } from '../Ring';
import { Text } from '../Text';
import { Row } from '../ui';

type C = ReturnType<typeof useSettings>['colors'];

/** Green from 80%, cobalt from 60%, red below (design: cTone). */
export const commitTone = (v: number, c: C) => (v >= 80 ? c.up : v >= 60 ? c.cobalt : c.down);

/** Gold, silver and bronze for the top 3, then a plain number (design: medal). */
export function Medal({ i }: { i: number }) {
  const col = ['#D4A017', '#9CA3AF', '#B45309'][i];
  if (!col)
    return (
      <Text num weight={700} color="sec" style={{ width: 26, textAlign: 'center' }}>
        {i + 1}
      </Text>
    );
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
      <Text num size={12} color="#FFFFFF">
        {i + 1}
      </Text>
    </View>
  );
}

/** "94%" with "↑ 3" under it. */
export function CommitValue({ v, trend }: { v: number; trend: number | null }) {
  const { colors: c } = useSettings();
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text num weight={700} color={commitTone(v, c)}>{`${v}%`}</Text>
      {trend != null ? (
        <Text variant="xs" weight={700} color={trend >= 0 ? 'up' : 'down'}>
          {`${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend)}`}
        </Text>
      ) : null}
    </View>
  );
}

/** Commitment, last 30 days: one bar per part (design: cOverview). */
export function CommitBars({ p }: { p: CommitParts }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const rows: [string, number][] = [
    [t('Workouts as planned'), p.workouts],
    [t('Calories on target'), p.calories],
    [t('Protein goal'), p.protein],
    [t('Water goal'), p.water],
    [t('Sleep 7 h+'), p.sleep],
  ];
  return (
    <View>
      {rows.map(([n, v]) => (
        <View key={n} style={{ marginTop: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small">{n}</Text>
            <Text variant="small" num weight={700}>{`${v}%`}</Text>
          </Row>
          <View style={{ marginTop: 4 }}>
            <Bar value={v} max={100} color={commitTone(v, c)} />
          </View>
        </View>
      ))}
    </View>
  );
}
