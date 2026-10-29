import { View } from 'react-native';

import { useT } from '@/i18n';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

import { Icon } from './Icon';
import { Text } from './Text';
import { Springy } from './ui';

/** "‹ Oct 13 – Oct 19 ›": go back to earlier weeks or months on a chart, and forward again up to now. */
export function PeriodNav({ from, to, back, onBack }: { from: string; to: string; back: number; onBack: (n: number) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const btn = (dir: -1 | 1) => {
    const off = dir > 0 && back === 0;
    return (
      <Springy
        onPress={() => !off && onBack(back - dir)}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={t(dir < 0 ? 'Earlier' : 'Later')}
        hitSlop={8}
        style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.inset, opacity: off ? 0.35 : 1 }}>
        <Icon name={dir < 0 ? 'back' : 'chev'} size={16} />
      </Springy>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
      {btn(-1)}
      <Text variant="small" weight={700} color={back ? 'text' : 'sec'}>{`${shortDate(from, lang)} – ${shortDate(to, lang)}`}</Text>
      {btn(1)}
    </View>
  );
}
