import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Avatar } from '@/components/social/Avatar';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

/**
 * Your photo inside the Adro logo's cut circle. The ring fills along the logo's shape with your commitment this
 * week (like the commitment bar): at 100% it's the whole logo.
 */
export function CommitAvatar({ id, name, url, size }: { id: string; name: string; url?: string | null; size: number }) {
  const { colors: c } = useSettings();
  const pct = useStreaks().c7.pct ?? 0;
  const sw = Math.max(3, Math.round(size * 0.08));
  const gap = Math.max(2, Math.round(size * 0.04));
  const box = size + 2 * (sw + gap);
  const r = (box - sw) / 2;
  const C = 2 * Math.PI * r;
  // The logo is 80% of a circle, starting at the top.
  const full = C * 0.8;
  const on = full * Math.min(1, Math.max(0, pct / 100));
  const ring = (len: number, color: string) => (
    <Circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${len} ${C}`} transform={`rotate(-90 ${box / 2} ${box / 2})`} />
  );
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={box} height={box} style={{ position: 'absolute' }}>
        {ring(full, c.line)}
        {on > 0 ? ring(on, c.cobalt) : null}
      </Svg>
      <Avatar id={id} name={name} size={size} url={url} />
    </View>
  );
}
