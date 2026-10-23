import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, buttonBorderShape, buttonStyle, controlSize, font, foregroundStyle, frame, labelStyle, lineLimit, minimumScaleFactor, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { ComponentProps } from 'react';

type SfSymbol = NonNullable<ComponentProps<typeof Image>['systemName']>;

/** What the app sends during a live cardio session, already in your language. Times are milliseconds since 1970. */
export type CardioActivityProps = {
  /** "Run", "Bike"… and the SF Symbol for it. */
  sport: string;
  icon: SfSymbol;
  /** The clock: counts from `from` (the start moved later by the pauses); while paused it shows `elapsed` instead. */
  from: number;
  paused: boolean;
  elapsed: string;
  /** "142" and "Zone 2", or empty without heart rate; the zone (0 none) colors it. */
  hr: string;
  zoneText: string;
  zone: number;
  /** "3.42 km" and "6:05 /km" (or "24 km/h"), or empty without GPS. */
  dist: string;
  pace: string;
  /** The coach's line ("Ease off a little: aim for zone 2"), and its tone. */
  tip: string;
  tipTone: 'up' | 'ok' | 'down';
  L: { pause: string; resume: string; finish: string; paused: string };
};

/** The buttons send these to the app (lib/widgetSync onCardioAction). */
export type CardioAction = 'c-pause' | 'c-resume' | 'c-finish';

/**
 * The live cardio session on the Lock Screen and in the Dynamic Island: the clock counts by itself, with heart rate and
 * zone, distance and pace, the coach's tip, and Pause / Finish (iOS 17 and later).
 */
const CardioActivity = (p: CardioActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const ZONES = ['#94A3B8', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'];
  const LIGHT = '#8FA3FF';
  const zc = p.zone >= 1 && p.zone <= 5 ? ZONES[p.zone - 1] : '#D4D4D8';
  const accent = env.isLuminanceReduced ? '#FFFFFF' : LIGHT;
  const clock = (size: number) =>
    p.paused ? (
      <Text modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FBBF24')]}>{p.elapsed}</Text>
    ) : (
      <Text timerInterval={{ lower: new Date(p.from), upper: new Date(p.from + 8 * 3600 * 1000) }} countsDown={false} modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF')]} />
    );
  const tipColor = p.tipTone === 'up' ? '#4ADE80' : p.tipTone === 'down' ? '#FBBF24' : '#D4D4D8';
  const stats = (
    <HStack spacing={14}>
      {p.hr ? (
        <HStack spacing={4}>
          <Image systemName="heart.fill" color={zc} size={14} />
          <Text modifiers={[font({ size: 18, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF')]}>{p.hr}</Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(zc), lineLimit(1)]}>{p.zoneText}</Text>
        </HStack>
      ) : null}
      {p.dist ? <Text modifiers={[font({ size: 15, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{p.dist}</Text> : null}
      {p.pace ? <Text modifiers={[font({ size: 13 }), monospacedDigit(), foregroundStyle('#A1A1AA'), lineLimit(1)]}>{p.pace}</Text> : null}
      <Spacer />
    </HStack>
  );
  const controls = (
    <HStack spacing={8}>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(tipColor), lineLimit(2), minimumScaleFactor(0.8)]}>{p.paused ? p.L.paused : p.tip}</Text>
      <Spacer />
      {p.paused ? (
        <Button target="c-resume" label={p.L.resume} systemImage="play.fill" modifiers={[labelStyle('iconOnly'), buttonStyle('bordered'), buttonBorderShape('circle'), controlSize('small'), tint('#FFFFFF')]} />
      ) : (
        <Button target="c-pause" label={p.L.pause} systemImage="pause.fill" modifiers={[labelStyle('iconOnly'), buttonStyle('bordered'), buttonBorderShape('circle'), controlSize('small'), tint('#FFFFFF')]} />
      )}
      <Button target="c-finish" label={p.L.finish} systemImage="stop.fill" modifiers={[labelStyle('iconOnly'), buttonStyle('borderedProminent'), buttonBorderShape('circle'), controlSize('small'), tint('#EF4444')]} />
    </HStack>
  );
  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 14 }), activityBackgroundTint('#0A0A0B')]}>
        <HStack spacing={10}>
          <Image systemName={p.icon} color={accent} size={20} />
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{p.sport}</Text>
          <Spacer />
          {clock(26)}
        </HStack>
        {stats}
        {controls}
      </VStack>
    ),
    compactLeading: p.hr ? (
      <HStack spacing={2}>
        <Image systemName="heart.fill" color={zc} />
        <Text modifiers={[monospacedDigit(), foregroundStyle('#FFFFFF')]}>{p.hr}</Text>
      </HStack>
    ) : (
      <Image systemName={p.icon} color={accent} />
    ),
    compactTrailing: <VStack modifiers={[frame({ maxWidth: 64 })]}>{clock(14)}</VStack>,
    minimal: <Image systemName={p.hr ? 'heart.fill' : p.icon} color={p.hr ? zc : accent} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={p.icon} color={accent} size={18} />
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{p.sport}</Text>
      </HStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 4 })]}>{clock(22)}</VStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
        {stats}
        {controls}
      </VStack>
    ),
  };
};

export default createLiveActivity('AdroCardio', CardioActivity);
