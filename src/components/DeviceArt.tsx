import { Image } from 'expo-image';
import { View } from 'react-native';

import { useSettings } from '@/theme/settings';

import { Icon } from './Icon';

export type ArtKind = 'health' | 'health_connect' | 'whoop' | 'oura' | 'fitbitair' | 'polar' | 'fitbit';

// The makers' own pictures: Apple's official Apple Health icon (Apple Design Resources), the WHOOP icon from its
// developer kit, and product photos from each company's site.
const ART: Record<Exclude<ArtKind, 'health_connect'>, number> = {
  health: require('../../assets/devices/health.png'),
  whoop: require('../../assets/devices/whoop.png'),
  oura: require('../../assets/devices/oura.png'),
  fitbitair: require('../../assets/devices/fitbitair.png'),
  polar: require('../../assets/devices/polar.png'),
  fitbit: require('../../assets/devices/fitbit.png'),
};

/** The device's picture for the Connections cards. Health Connect (Android) keeps Gymi's heart icon. */
export function DeviceArt({ kind, size = 64 }: { kind: ArtKind; size?: number }) {
  const { colors: c } = useSettings();
  if (kind === 'health_connect')
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.8, height: size * 0.8, borderRadius: size * 0.22, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="heart" size={size * 0.4} color={c.cobalt} />
        </View>
      </View>
    );
  // The Apple Health icon and the WHOOP mark are flat icons: a bit smaller than the device photos.
  const s = kind === 'health' ? size * 0.78 : kind === 'whoop' ? size * 0.7 : size;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={ART[kind]} style={{ width: s, height: s }} contentFit="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}
