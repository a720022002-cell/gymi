import { Image, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { broLevel } from '@/lib/bro';
import { useSettings } from '@/theme/settings';

import { Text } from '../Text';

const IMG = {
  m1: require('../../../assets/images/bro/m1.png'),
  m2: require('../../../assets/images/bro/m2.png'),
  m3: require('../../../assets/images/bro/m3.png'),
  m4: require('../../../assets/images/bro/m4.png'),
  m5: require('../../../assets/images/bro/m5.png'),
  w1: require('../../../assets/images/bro/w1.png'),
  w2: require('../../../assets/images/bro/w2.png'),
  w3: require('../../../assets/images/bro/w3.png'),
  w4: require('../../../assets/images/bro/w4.png'),
  w5: require('../../../assets/images/bro/w5.png'),
};
type Key = keyof typeof IMG;
/** Each picture: width per height, then the head's centre (x by width, y by height), its radius and the neck line (by height). */
const GEO: Record<Key, [number, number, number, number, number]> = {
  m1: [0.6429, 0.5142, 0.2067, 0.22, 0.46],
  m2: [0.6571, 0.4962, 0.1967, 0.2142, 0.455],
  m3: [0.6762, 0.5, 0.2133, 0.2142, 0.455],
  m4: [0.7905, 0.5032, 0.1967, 0.215, 0.4533],
  m5: [0.8595, 0.4981, 0.2033, 0.2158, 0.4533],
  w1: [0.4714, 0.5088, 0.2558, 0.1608, 0.4267],
  w2: [0.4762, 0.5018, 0.2492, 0.1525, 0.4117],
  w3: [0.4857, 0.5034, 0.2483, 0.1533, 0.4117],
  w4: [0.5643, 0.5089, 0.2483, 0.1533, 0.4117],
  w5: [0.6571, 0.4949, 0.245, 0.1533, 0.4083],
};

/**
 * A Gym Bros cartoon (design: gym-bro): it gets stronger with the 30-day commitment. Its face is the adro ring,
 * filled to that commitment, and the username sits on its neck. Someone who doesn't share it stands at level 2 with an
 * empty ring.
 */
export function GymBro({ pct, female, username, height }: { pct: number | null; female?: boolean; username: string; height: number }) {
  const { colors: c } = useSettings();
  const key = `${female ? 'w' : 'm'}${broLevel(pct) || 2}` as Key;
  const [ar, cx0, cy0, r0, neck] = GEO[key];
  const w = height * ar;
  const cx = cx0 * w;
  const cy = cy0 * height;
  const r = r0 * height;
  const R = r * 0.6;
  const sw = r * 0.34;
  const C = 2 * Math.PI * R;
  const fs = Math.max(7, Math.round(height * 0.05));
  return (
    <View style={{ width: w, height }} accessible={false}>
      <Image source={IMG[key]} style={{ width: w, height }} resizeMode="contain" />
      <Svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Circle cx={cx} cy={cy} r={r * 1.01} fill="#181E2E" />
        <Circle cx={cx} cy={cy} r={R} fill="none" stroke="#2C3350" strokeWidth={sw} />
        {pct ? <Circle cx={cx} cy={cy} r={R} fill="none" stroke={c.cobalt} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(C * Math.min(pct, 100)) / 100} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} /> : null}
      </Svg>
      <View style={{ position: 'absolute', top: neck * height - fs * 1.25, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ backgroundColor: '#0A0A0B', borderRadius: 99, paddingHorizontal: 6, paddingVertical: 1, maxWidth: w * 1.1 }}>
          <Text size={fs} weight={700} color="#FFFFFF" numberOfLines={1}>{`@${username}`}</Text>
        </View>
      </View>
    </View>
  );
}
