import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect } from 'react-native-svg';

import { buildOf, cleanLook, type Look } from '@/lib/avatar';
import { broLevel } from '@/lib/bro';

import { Text } from '../Text';
import { AVATAR_BOX, AvatarArt, type SvgKit } from './AvatarArt';

const KIT: SvgKit = { Svg, G, Path, Circle, Ellipse, Rect, Defs, Pattern };

/** Just the drawing, at a height. `build` is 0–1 (from the commitment). */
export function BroArt({ look, build, height }: { look: Look; build: number; height: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const w = (height * AVATAR_BOX.w) / AVATAR_BOX.h;
  return (
    <Svg width={w} height={height} viewBox={`${AVATAR_BOX.x} ${AVATAR_BOX.y} ${AVATAR_BOX.w} ${AVATAR_BOX.h}`}>
      <AvatarArt look={look} build={build} kit={KIT} id={`a${id}`} />
    </Svg>
  );
}

/**
 * A Gym Bros character (design: Bitmoji-like): dressed the way its owner chose, and stronger with the 30-day
 * commitment. Someone who doesn't share it stands at level 2. The username sits under the feet.
 */
export function GymBro({ pct, female, look, username, height }: { pct: number | null; female?: boolean; look?: unknown; username: string; height: number }) {
  const fs = Math.max(8, Math.round(height * 0.055));
  return (
    <View style={{ alignItems: 'center' }} accessible={false}>
      <BroArt look={cleanLook(look, !!female)} build={buildOf(broLevel(pct))} height={height} />
      <View style={{ marginTop: -fs * 0.6, backgroundColor: '#0A0A0B', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1, maxWidth: height * 0.75 }}>
        <Text size={fs} weight={700} color="#FFFFFF" numberOfLines={1}>{`@${username}`}</Text>
      </View>
    </View>
  );
}
