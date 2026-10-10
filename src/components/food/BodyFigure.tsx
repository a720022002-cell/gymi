import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/** Simple body outline that gets wider with body fat (design: bodyFig). */
export function BodyFigure({ bf, female, selected, color }: { bf: number; female: boolean; selected: boolean; color: string }) {
  const sh = female ? 17 : 21;
  const wa = (female ? 9 : 8) + bf * 0.42;
  const hip = female ? 14 + bf * 0.3 : 13 + bf * 0.26;
  const o = selected ? 1 : 0.45;
  return (
    <Svg width={64} height={112} viewBox="0 0 70 122">
      <G fill={color} opacity={o}>
        <Circle cx={35} cy={13} r={9} />
        <Rect x={31} y={20} width={8} height={8} rx={3} />
        <Path d={`M${35 - sh} 30 H${35 + sh} Q${35 + sh + 3} 33 ${35 + wa} 60 Q${35 + hip + 2} 74 ${35 + hip} 84 H${35 - hip} Q${35 - hip - 2} 74 ${35 - wa} 60 Q${35 - sh - 3} 33 ${35 - sh} 30Z`} />
      </G>
      <G stroke={color} opacity={o} strokeLinecap="round" fill="none">
        <Path d={`M${35 - sh} 33 L${35 - sh - 5 - bf * 0.1} 78`} strokeWidth={7} />
        <Path d={`M${35 + sh} 33 L${35 + sh + 5 + bf * 0.1} 78`} strokeWidth={7} />
        <Path d={`M${35 - hip * 0.5} 84 L${35 - hip * 0.55} 118`} strokeWidth={9 + bf * 0.12} />
        <Path d={`M${35 + hip * 0.5} 84 L${35 + hip * 0.55} 118`} strokeWidth={9 + bf * 0.12} />
      </G>
    </Svg>
  );
}
