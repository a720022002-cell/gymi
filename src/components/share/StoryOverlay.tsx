import { Image } from 'expo-image';
import type { Ref } from 'react';
import { Text as RNText, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

import { type OverlayData, type OverlayStyle } from '@/lib/overlay';

import { Logo } from '../Logo';

const W = 1080;
const H = 1920;
const M = 84;

/** The fonts a canvas overlay uses, one at a time (React Native has no font fallback list). */
const fontOf = (rtl: boolean, kind: 'display' | 'body', weight: 600 | 700 | 800) =>
  rtl
    ? weight >= 700
      ? 'IBMPlexSansArabic_700Bold'
      : 'IBMPlexSansArabic_600SemiBold'
    : kind === 'display'
      ? weight >= 700
        ? 'Sora_700Bold'
        : 'Sora_600SemiBold'
      : weight >= 800
        ? 'Manrope_800ExtraBold'
        : weight >= 700
          ? 'Manrope_700Bold'
          : 'Manrope_600SemiBold';

/**
 * The story overlay (same layouts as lib/overlay's canvas, for phones): drawn in a 1080 × 1920 frame shown at `width`,
 * so it can be captured as a full-size picture. Without a photo it's a dark background; as a sticker it's see-through.
 */
export function StoryOverlay({ style, d, photo, sticker, width, viewRef }: { style: OverlayStyle; d: OverlayData; photo: string | null; sticker?: boolean; width: number; viewRef?: Ref<View> }) {
  const k = width / W;
  const rtl = d.rtl;
  const start = rtl ? W - M : M;
  const a = rtl ? 'right' : 'left';

  // Text placed like canvas fillText: x and the baseline y, aligned left, right or centre.
  const T = ({
    s,
    x,
    y,
    size,
    kind = 'body',
    weight = 700,
    color = '#fff',
    align = a,
    shadow = true,
    latin,
    key,
  }: {
    s: string;
    x: number;
    y: number;
    size: number;
    kind?: 'display' | 'body';
    weight?: 600 | 700 | 800;
    color?: string;
    align?: 'left' | 'right' | 'center';
    shadow?: boolean;
    latin?: boolean;
    key?: string | number;
  }) => {
    const box = 1000;
    const pos = align === 'center' ? { left: (x - box / 2) * k, width: box * k } : align === 'left' ? { left: x * k, width: (W - x) * k } : { left: 0, width: x * k };
    return (
      <RNText
        key={key}
        numberOfLines={1}
        style={{
          position: 'absolute',
          top: (y - size * 0.98) * k,
          ...pos,
          textAlign: align,
          fontFamily: fontOf(latin ? false : rtl, kind, weight),
          fontSize: size * k,
          lineHeight: size * 1.25 * k,
          color,
          writingDirection: rtl && !latin ? 'rtl' : 'ltr',
          ...(shadow ? { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 18 * k, textShadowOffset: { width: 0, height: 2 * k } } : null),
        }}
      >
        {s}
      </RNText>
    );
  };
  const logo = (x: number, y: number, size: number, align: 'left' | 'center' | 'right') => {
    const h = size * 1.05;
    const w = h * 1.28 * 2.229;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    return (
      <View style={{ position: 'absolute', left: left * k, top: (y - h * 0.95) * k }}>
        <Logo height={h * k} color="#FFFFFF" ring="#3355FF" />
      </View>
    );
  };
  // A soft dark shade from y0 to y1 (from one opacity to another).
  const shade = (id: string, o0: number, o1: number, y0: number, y1: number) => (
    <>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={o0} />
          <Stop offset="1" stopColor="#000" stopOpacity={o1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={Math.min(y0, y1)} width={W} height={Math.abs(y1 - y0)} fill={`url(#${id})`} />
    </>
  );

  const xs = rtl ? [W - 200, W / 2, 200] : [200, W / 2, W - 200];
  const cw = 900;
  const ch = 520;
  const x0 = (W - cw) / 2;
  const y0 = H - ch - 220;
  const rx = rtl ? x0 + cw - 64 : x0 + 64;

  return (
    <View ref={viewRef} collapsable={false} style={{ width, height: H * k, overflow: 'hidden', backgroundColor: sticker ? 'transparent' : '#07080c' }}>
      {!sticker && photo ? <Image source={{ uri: photo }} style={{ position: 'absolute', left: 0, top: 0, width, height: H * k }} contentFit="cover" /> : null}
      <Svg width={width} height={H * k} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {!sticker && !photo ? (
          <>
            <Defs>
              <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1a2150" />
                <Stop offset="0.6" stopColor="#0b0d17" />
                <Stop offset="1" stopColor="#07080c" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#bg)" />
          </>
        ) : null}
        {sticker ? null : style === 'stats' ? (
          shade('s1', 0, 0.7, H * 0.5, H)
        ) : style === 'rings' ? (
          <>
            {shade('s1', 0.7, 0, 0, 900)}
            {shade('s2', 0, 0.65, H - 520, H)}
          </>
        ) : style === 'record' ? (
          <>
            {shade('s1', 0.5, 0, 0, 300)}
            {shade('s2', 0, 0.5, H * 0.55, H)}
          </>
        ) : (
          shade('s1', 0, 0.55, H - 500, H)
        )}
        {style === 'rings'
          ? d.rings.slice(0, 3).map((g, i) => {
              const C = 2 * Math.PI * 120;
              return (
                <G key={i}>
                  <Circle cx={xs[i]} cy={560} r={120} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={24} />
                  <Circle cx={xs[i]} cy={560} r={120} fill="none" stroke={g.color} strokeWidth={24} strokeLinecap="round" strokeDasharray={`${C * Math.max(0.02, Math.min(1, g.v))} ${C}`} transform={`rotate(-90 ${xs[i]} 560)`} />
                </G>
              );
            })
          : null}
        {style === 'record' ? <Rect x={x0} y={y0} width={cw} height={ch} rx={48} fill="rgba(8,10,14,0.62)" stroke="rgba(34,197,94,0.7)" strokeWidth={3} /> : null}
        {style === 'line' ? <Rect x={40} y={H - 250 - 66} width={W - 80} height={104} rx={52} fill="rgba(0,0,0,0.45)" /> : null}
      </Svg>

      {style === 'stats' ? (
        <>
          {T({ s: d.title, x: start, y: H - 800, size: 44, kind: 'display' })}
          {d.stats.slice(0, 3).map((st, i) => {
            const y = H - 760 + 175 * (i + 1);
            return (
              <View key={i} style={{ position: 'absolute', left: 0, top: 0, width, height: H * k }} pointerEvents="none">
                {T({ s: st.label, x: start, y: y - 100, size: 32, color: 'rgba(255,255,255,0.8)' })}
                {T({ s: st.value, x: start, y: y, size: 92, kind: 'display' })}
              </View>
            );
          })}
          {logo(start, H - 120, 46, rtl ? 'right' : 'left')}
        </>
      ) : style === 'rings' ? (
        <>
          {T({ s: d.title, x: W / 2, y: 250, size: 66, kind: 'display', align: 'center' })}
          {T({ s: d.date, x: W / 2, y: 310, size: 30, weight: 600, color: 'rgba(255,255,255,0.8)', align: 'center' })}
          {d.rings.slice(0, 3).map((g, i) => (
            <View key={i} style={{ position: 'absolute', left: 0, top: 0, width, height: H * k }} pointerEvents="none">
              {T({ s: g.big, x: xs[i], y: 582, size: 62, kind: 'display', align: 'center' })}
              {T({ s: g.label, x: xs[i], y: 750, size: 32, color: 'rgba(255,255,255,0.85)', align: 'center' })}
            </View>
          ))}
          {d.stats.slice(0, 3).map((st, i) => (
            <View key={i} style={{ position: 'absolute', left: 0, top: 0, width, height: H * k }} pointerEvents="none">
              {T({ s: st.value, x: xs[i], y: H - 260, size: 56, kind: 'display', align: 'center' })}
              {T({ s: st.label, x: xs[i], y: H - 210, size: 28, color: 'rgba(255,255,255,0.8)', align: 'center' })}
            </View>
          ))}
          {logo(W / 2, H - 100, 42, 'center')}
        </>
      ) : style === 'record' ? (
        <>
          {logo(start, 150, 44, rtl ? 'right' : 'left')}
          {T({ s: d.handle, x: rtl ? M : W - M, y: 150, size: 30, color: 'rgba(255,255,255,0.85)', align: rtl ? 'left' : 'right', latin: true })}
          {T({ s: d.record.kicker, x: rx, y: y0 + 100, size: 34, weight: 800, color: '#22c55e', shadow: false })}
          {T({ s: d.record.name, x: rx, y: y0 + 180, size: 56, kind: 'display', shadow: false })}
          {/* The number and its unit on one line. */}
          <RNText
            numberOfLines={1}
            style={{
              position: 'absolute',
              top: (y0 + 380 - 190 * 0.98) * k,
              ...(rtl ? { left: 0, width: rx * k } : { left: rx * k, width: (W - rx) * k }),
              textAlign: rtl ? 'right' : 'left',
              color: '#fff',
              fontFamily: 'Sora_700Bold',
              fontSize: 190 * k,
              lineHeight: 190 * 1.2 * k,
              writingDirection: rtl ? 'rtl' : 'ltr',
            }}
          >
            {d.record.big}
            <RNText style={{ fontFamily: fontOf(rtl, 'display', 700), fontSize: 54 * k, color: 'rgba(255,255,255,0.75)' }}>{` ${d.record.unit}`}</RNText>
          </RNText>
          {T({ s: d.record.sub, x: rx, y: y0 + 460, size: 32, color: 'rgba(255,255,255,0.7)', shadow: false })}
        </>
      ) : (
        <>
          {T({ s: d.line, x: W / 2, y: H - 250, size: 38, kind: 'display', align: 'center', shadow: false })}
          {logo(W / 2, H - 110, 40, 'center')}
        </>
      )}
    </View>
  );
}
