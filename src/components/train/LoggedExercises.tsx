import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { SetValue } from '@/components/train/SetValue';
import { Springy } from '@/components/ui';
import { useT } from '@/i18n';
import type { WorkoutLog } from '@/lib/train';
import { loggedExName } from '@/lib/workoutHistory';
import { useSettings } from '@/theme/settings';

/** The exercises of one workout, in the order you did them, with every set (weight × reps). Tap one for its history. */
export function LoggedExercises({ log }: { log: WorkoutLog }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const prs = new Map(log.prs.map((p) => [p.id, p.w]));
  if (!log.exercises.length)
    return (
      <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
        {t('No sets were saved for this workout.')}
      </Text>
    );
  return (
    <View style={{ gap: 10 }}>
      {log.exercises.map((ex, i) => {
        const pr = prs.get(ex.id);
        // Your own exercises have no page to open.
        const own = ex.id.startsWith('custom:');
        return (
          <Springy
            key={`${ex.id}-${i}`}
            onPress={own ? null : () => router.push({ pathname: '/exercise', params: { id: ex.id } })}
            scaleTo={0.99}
            accessibilityLabel={loggedExName(ex, lang)}
            style={{ backgroundColor: c.card, borderRadius: 22, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Text num size={13}>
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text weight={700}>{loggedExName(ex, lang)}</Text>
                <Text variant="xs" color="sec">
                  {ex.light ? `${t('Lighter version')} · ` : ''}
                  {t('{n} sets', { n: ex.sets.length })}
                </Text>
              </View>
              {own ? null : <Icon name="chev" size={18} color={c.sec} />}
            </View>
            <View style={{ marginTop: 10, gap: 6 }}>
              {ex.sets.map((s, j) => {
                const best = pr != null && s.w === pr;
                return (
                  <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingStart: 42 }}>
                    <Text variant="small" color="sec" numberOfLines={1} style={{ minWidth: 76 }}>
                      {t('Set {n}', { n: j + 1 })}
                    </Text>
                    <View style={{ flex: 1, alignItems: 'flex-start' }}>
                      <SetValue w={s.w} r={s.r} />
                    </View>
                    {best ? <Icon name="trophy" size={16} color={c.cobalt} /> : null}
                  </View>
                );
              })}
            </View>
          </Springy>
        );
      })}
    </View>
  );
}
