import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useT } from '@/i18n';
import { useWeight } from '@/lib/units';

/**
 * One set as "80 kg × 10" (bodyweight: "× 10", a timed hold: "45 s"). The number, the unit and the reps are separate pieces laid out left
 * to right, so Arabic never reorders them.
 */
export function SetValue({ w, r, size = 15, timed }: { w: number; r: number; size?: number; timed?: boolean }) {
  const W = useWeight();
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, direction: 'ltr' } as object}>
      {w > 0 ? (
        <>
          <Text num size={size}>
            {W.show(w)}
          </Text>
          <Text variant="xs" color="sec">
            {W.label}
          </Text>
        </>
      ) : null}
      <Text num size={size}>
        {timed ? `${r} ${t('s')}` : `× ${r}`}
      </Text>
    </View>
  );
}
