import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { SetValue } from '@/components/train/SetValue';
import { Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { shortDate } from '@/lib/progress';
import { useTrain } from '@/lib/train';
import { workoutTitle } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { type ExerciseSession, loadExerciseHistory } from '@/lib/workoutHistory';
import { useSettings } from '@/theme/settings';

/** The last times you did this exercise, with every set, and your best weight. Hidden until you've done it once. */
export function ExerciseHistory({ id }: { id: string }) {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const train = useTrain();
  const [got, setGot] = useState<{ id: string; rows: ExerciseSession[] } | null>(null);

  useEffect(() => {
    let live = true;
    loadExerciseHistory(id).then((rows) => live && setGot({ id, rows: rows ?? [] }));
    return () => {
      live = false;
    };
  }, [id]);

  const rows = got?.id === id ? got.rows : [];
  if (!rows.length) return null;
  const best = Math.max(train.best?.[id] ?? 0, ...rows.flatMap((r) => r.sets.map((s) => s.w)));
  const unit = (kg: number) => `${W.show(kg)} ${W.label}`;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        <Text variant="h3">{t('Your history')}</Text>
        {best > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="trophy" size={15} color={c.cobalt} />
            <Text variant="small" weight={700} style={{ color: c.cobalt }}>
              {t('Best: {n}', { n: unit(best) })}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <Springy
            key={r.id}
            onPress={() => router.push({ pathname: '/workout-log', params: { id: r.id } })}
            scaleTo={0.99}
            accessibilityLabel={`${shortDate(r.day, lang)}, ${workoutTitle(r.workout, t)}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ flex: 1 }}>
              <Text weight={700}>
                {shortDate(r.day, lang)}
                <Text variant="small" color="sec">{` · ${workoutTitle(r.workout, t)}`}</Text>
              </Text>
              {/* One box per set, so the numbers read the same way in Arabic and English. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {r.sets.map((s, j) => (
                  <View key={j} style={{ backgroundColor: c.inset, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <SetValue w={s.w} r={s.r} size={13} />
                  </View>
                ))}
              </View>
            </View>
            <Icon name="chev" size={18} color={c.sec} />
          </Springy>
        ))}
      </View>
    </View>
  );
}
