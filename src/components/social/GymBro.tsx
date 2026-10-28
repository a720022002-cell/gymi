import { useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { cleanLook, RING_COLORS } from '@/lib/avatar';
import { type Bro, broLevel } from '@/lib/bro';

import { Text } from '../Text';
import { Springy } from '../ui';
import { BRO_GEO, type BroKey } from './broGeo';

const IMG: Record<BroKey, number> = {
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

/** The width of a character drawn at a height. */
export const broWidth = (height: number) => height * BRO_GEO.m1[0];

/**
 * A Gym Bros character (design: owner's flexing cartoon): stronger at each commitment level (1–5; someone who
 * doesn't share it stands at level 2). Its face is the adro ring in their colour, filled to the commitment, with the
 * username under it.
 */
export function GymBro({ pct, female, look, username, height, level }: { pct: number | null; female?: boolean; look?: unknown; username: string; height: number; level?: number }) {
  const key = `${female ? 'w' : 'm'}${level ?? (broLevel(pct) || 2)}` as BroKey;
  const [ar, cx0, cy0, r0] = BRO_GEO[key];
  const w = height * ar;
  const cx = cx0 * w;
  const cy = cy0 * height;
  const r = r0 * height;
  const R = r * 0.6;
  const sw = r * 0.36;
  const C = 2 * Math.PI * R;
  const color = RING_COLORS[cleanLook(look).color];
  const fs = Math.max(7, Math.round(height * 0.045));
  return (
    <View style={{ width: w, height }} accessible={false}>
      <Image source={IMG[key]} style={{ width: w, height }} resizeMode="contain" />
      <Svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Circle cx={cx} cy={cy} r={r} fill="#10131C" stroke="#0A0A0B" strokeWidth={Math.max(1.5, r * 0.08)} />
        <Circle cx={cx} cy={cy} r={R} fill="none" stroke="#2A3047" strokeWidth={sw} />
        {pct ? <Circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(C * Math.min(pct, 100)) / 100} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} /> : null}
      </Svg>
      {username ? (
        <View style={{ position: 'absolute', top: cy + r + 2, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(10,10,11,0.82)', borderRadius: 99, paddingHorizontal: 5, paddingVertical: 1, maxWidth: w * 0.42 }}>
            <Text size={fs} weight={700} color="#FFFFFF" numberOfLines={1}>
              {username}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * You and your friends lined up (design: the crew picture): you in front in the middle, friends beside you by
 * commitment, each pair a step further back and smaller; more friends stand in a row behind.
 */
export function CrewLineup({ people, height, onPress }: { people: Bro[]; height: number; onPress: (b: Bro, i: number) => void }) {
  const [W, setW] = useState(0);
  const front = height * 0.86;
  const fw = broWidth(front);
  // How many pairs fit beside you, each a step back.
  const step = fw * 0.5;
  const pairs = W ? Math.max(1, Math.floor((W / 2 - fw * 0.3) / step)) : 0;
  const v = people.slice(1, 1 + pairs * 2);
  const back = people.slice(1 + pairs * 2, 1 + pairs * 2 + 8);
  type Spot = { b: Bro; i: number; h: number; x: number; y: number; z: number };
  const spots: Spot[] = [];
  back.forEach((b, j) => {
    const h = front * 0.5;
    const n = back.length;
    spots.push({ b, i: 1 + pairs * 2 + j, h, x: n === 1 ? W / 2 : (W - broWidth(h)) * (j / (n - 1)) + broWidth(h) / 2, y: height * 0.0, z: 0 });
  });
  v.forEach((b, j) => {
    const k = Math.floor(j / 2) + 1;
    const side = j % 2 ? 1 : -1;
    const h = front * Math.max(0.5, 1 - 0.15 * k);
    spots.push({ b, i: 1 + j, h, x: W / 2 + side * k * step, y: height - h - 4 * k, z: 10 - k });
  });
  if (people[0]) spots.push({ b: people[0], i: 0, h: front, x: W / 2, y: height - front, z: 20 });
  spots.sort((a, b) => a.z - b.z);
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height }}>
      {W
        ? spots.map(({ b, i, h, x, y }) => (
            <Springy
              key={b.user_id}
              onPress={() => onPress(b, i)}
              accessibilityRole="button"
              accessibilityLabel={`${b.name || b.username}${b.pct == null ? '' : `, ${b.pct}%`}`}
              style={{ position: 'absolute', left: x - broWidth(h) / 2, top: y }}>
              <GymBro pct={b.pct} female={b.gender === 'female'} look={b.look} username={b.username} height={h} />
            </Springy>
          ))
        : null}
    </View>
  );
}
