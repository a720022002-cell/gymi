import { Image } from 'expo-image';
import { View } from 'react-native';

/** Photo for each body fat level (AI-made, same person per set). Men: 10–35 %, women: 18–40 %. */
const PHOTOS: Record<string, number> = {
  m10: require('../../../assets/bodyfat/m10.jpg'),
  m15: require('../../../assets/bodyfat/m15.jpg'),
  m20: require('../../../assets/bodyfat/m20.jpg'),
  m25: require('../../../assets/bodyfat/m25.jpg'),
  m30: require('../../../assets/bodyfat/m30.jpg'),
  m35: require('../../../assets/bodyfat/m35.jpg'),
  f18: require('../../../assets/bodyfat/f18.jpg'),
  f22: require('../../../assets/bodyfat/f22.jpg'),
  f26: require('../../../assets/bodyfat/f26.jpg'),
  f30: require('../../../assets/bodyfat/f30.jpg'),
  f35: require('../../../assets/bodyfat/f35.jpg'),
  f40: require('../../../assets/bodyfat/f40.jpg'),
};

/** A real-looking body at about this body fat (design: bodyFig). */
export function BodyFigure({ bf, female, selected }: { bf: number; female: boolean; selected: boolean; color?: string }) {
  const src = PHOTOS[`${female ? 'f' : 'm'}${bf}`];
  return (
    <View style={{ width: '100%', aspectRatio: 360 / 445, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E6E6E8', opacity: selected ? 1 : 0.9 }}>
      {src ? <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : null}
    </View>
  );
}
