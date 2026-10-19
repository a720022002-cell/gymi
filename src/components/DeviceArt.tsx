import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type ArtKind = 'health' | 'whoop' | 'oura' | 'garmin' | 'polar' | 'fitbit';

/** Gymi's own drawings of each kind of device (no brand photos or logos), for the Connections cards. */
export function DeviceArt({ kind, size = 64 }: { kind: ArtKind; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        <LinearGradient id="heart" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF6B8B" />
          <Stop offset="1" stopColor="#FF2D55" />
        </LinearGradient>
        <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F5E6C8" />
          <Stop offset="0.45" stopColor="#C9A86A" />
          <Stop offset="1" stopColor="#8A6D3B" />
        </LinearGradient>
        <LinearGradient id="ringIn" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#D4D4D8" />
          <Stop offset="1" stopColor="#71717A" />
        </LinearGradient>
        <LinearGradient id="band" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#60A5FA" />
          <Stop offset="1" stopColor="#1D4ED8" />
        </LinearGradient>
      </Defs>
      {kind === 'health' ? (
        <G>
          <Rect x="12" y="12" width="56" height="56" rx="15" fill="#FFFFFF" />
          <Path d="M40 60 C22 48 18 38 22 30 C26 22 36 22 40 30 C44 22 54 22 58 30 C62 38 58 48 40 60 Z" fill="url(#heart)" />
          <Path d="M27 39 H34 L37 33 L42 45 L45 39 H53" stroke="#FFFFFF" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      ) : kind === 'oura' ? (
        <G>
          <Ellipse cx="40" cy="44" rx="26" ry="19" fill="none" stroke="#5B4A2C" strokeWidth="8" />
          <Ellipse cx="40" cy="40" rx="26" ry="19" fill="none" stroke="url(#ring)" strokeWidth="8" />
          <Ellipse cx="40" cy="41" rx="21" ry="14" fill="none" stroke="url(#ringIn)" strokeWidth="2" />
          <Circle cx="34" cy="54" r="2" fill="#3F3F46" />
          <Circle cx="40" cy="55" r="2" fill="#3F3F46" />
          <Circle cx="46" cy="54" r="2" fill="#3F3F46" />
          <Path d="M20 30 Q30 22 44 22" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" />
        </G>
      ) : kind === 'whoop' ? (
        <G>
          <Ellipse cx="44" cy="40" rx="20" ry="29" fill="none" stroke="#0A0A0B" strokeWidth="10" />
          <Ellipse cx="44" cy="40" rx="20" ry="29" fill="none" stroke="#3F3F46" strokeWidth="1.5" />
          <Rect x="14" y="26" width="17" height="28" rx="6" fill="#18181B" stroke="#52525B" strokeWidth="1.5" />
          <Rect x="18" y="31" width="9" height="2" rx="1" fill="#71717A" />
        </G>
      ) : kind === 'fitbit' ? (
        <G>
          <Ellipse cx="42" cy="40" rx="19" ry="29" fill="none" stroke="url(#band)" strokeWidth="9" />
          <Path d="M30 18 L54 62 M36 14 L58 56" stroke="#93C5FD" strokeOpacity="0.35" strokeWidth="1.5" />
          <Rect x="13" y="28" width="15" height="24" rx="5" fill="#0A0A0B" stroke="#3F3F46" strokeWidth="1.5" />
          <Rect x="16" y="33" width="9" height="3" rx="1.5" fill="#22D3EE" />
          <Rect x="16" y="39" width="6" height="2" rx="1" fill="#A1A1AA" />
        </G>
      ) : (
        // A round sport watch: Garmin with an orange strap, Polar with a brown leather one.
        <G>
          <Rect x="29" y="2" width="22" height="24" rx="6" fill={kind === 'garmin' ? '#F59E0B' : '#8B5E3C'} />
          <Rect x="29" y="54" width="22" height="24" rx="6" fill={kind === 'garmin' ? '#D97706' : '#6B4429'} />
          {kind === 'garmin' ? <Path d="M33 8 H47 M33 14 H47 M33 60 H47 M33 66 H47 M33 72 H47" stroke="#B45309" strokeWidth="2" /> : null}
          <Rect x="61" y="31" width="5" height="7" rx="2" fill="#71717A" />
          <Rect x="61" y="43" width="5" height="7" rx="2" fill="#71717A" />
          <Rect x="14" y="36" width="5" height="8" rx="2" fill="#71717A" />
          <Circle cx="40" cy="40" r="23" fill={kind === 'garmin' ? '#52525B' : '#3F3F46'} />
          <Circle cx="40" cy="40" r="20" fill="#18181B" />
          <Circle cx="40" cy="40" r="16.5" fill="#050505" />
          <Path d="M40 25 A15 15 0 1 1 26.5 46.5" stroke={kind === 'garmin' ? '#22C55E' : '#EF4444'} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Rect x="33" y="36" width="14" height="4" rx="2" fill="#E4E4E7" />
          <Rect x="35" y="43" width="10" height="2.5" rx="1.25" fill="#71717A" />
        </G>
      )}
    </Svg>
  );
}
