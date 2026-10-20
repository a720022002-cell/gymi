import { View } from 'react-native';

import { Text } from '@/components/Text';
import { useWeight } from '@/lib/units';

/**
 * One set as "80 kg × 10" (bodyweight: "× 10"). The number, the unit and the reps are separate pieces laid out left
 * to right, so Arabic never reorders them.
 */
export function SetValue({ w, r, size = 15 }: { w: number; r: number; size?: number }) {
  const W = useWeight();
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
        {`× ${r}`}
      </Text>
    </View>
  );
}
