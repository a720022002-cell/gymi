import { Button, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/** What the app sends while you train, already in your language. Times are milliseconds since 1970. */
export type WorkoutActivityProps = {
  workout: string;
  /** The exercise you're on, "Set 2 of 4", and its target ("80 kg × 10"), or empty when all sets are done. */
  exercise: string;
  set: string;
  target: string;
  /** The set you're on, as shown with the − and + buttons ("80 كجم", "× 10"). wText is empty without a weight. */
  wText: string;
  rText: string;
  /** There's a set to log: show the buttons (iOS 17 and later). */
  canLog: boolean;
  /** The set coach's tip for this exercise ("+2.5 kg next set"), or empty; its tone colors it. */
  tip: string;
  tipTone: 'up' | 'ok' | 'down';
  startedAt: number;
  /** When the rest ends, or null when not resting. */
  restEnd: number | null;
  restStart: number | null;
  done: number;
  total: number;
  L: { rest: string; next: string; sets: string; done: string; skip: string };
};

/** The buttons send these to the app (lib/widgetSync onWorkoutAction), which changes the set and updates this. */
export type WorkoutAction = 'w-' | 'w+' | 'r-' | 'r+' | 'done' | 'skip';

/**
 * The workout on the Lock Screen and in the Dynamic Island: the clock counts by itself (no updates needed), and the
 * rest countdown takes its place while you rest. With a set to do, − and + change its weight and reps, and Done logs
 * it (Skip ends the rest), without opening the app.
 */
const WorkoutActivity = (p: WorkoutActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const BLUE = '#3355FF';
  const LIGHT = '#8FA3FF';
  const resting = p.restEnd != null && p.restStart != null && p.restEnd > Date.now();
  const clock = (size: number, color: string) =>
    resting ? (
      <Text timerInterval={{ lower: new Date(p.restStart as number), upper: new Date(p.restEnd as number) }} countsDown modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(color)]} />
    ) : (
      <Text timerInterval={{ lower: new Date(p.startedAt), upper: new Date(p.startedAt + 6 * 3600 * 1000) }} countsDown={false} modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(color)]} />
    );
  const bar = resting ? (
    <ProgressView timerInterval={{ lower: new Date(p.restStart as number), upper: new Date(p.restEnd as number) }} countsDown modifiers={[tint(LIGHT)]} />
  ) : (
    <ProgressView value={p.total ? p.done / p.total : 0} modifiers={[tint(BLUE)]} />
  );
  const icon = resting ? 'timer' : 'dumbbell.fill';
  const accent = env.isLuminanceReduced ? '#FFFFFF' : LIGHT;
  const line = p.target ? `${p.set} · ${p.target}` : p.set;
  const step = (target: string, sign: 'minus' | 'plus') => (
    <Button target={target} label={sign === 'minus' ? '−' : '+'} systemImage={sign} modifiers={[labelStyle('iconOnly'), buttonStyle('bordered'), buttonBorderShape('circle'), controlSize('small'), tint('#FFFFFF')]} />
  );
  const value = (text: string) => <Text modifiers={[font({ size: 15, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF'), lineLimit(1), minimumScaleFactor(0.7)]}>{text}</Text>;
  // − 80 kg +   − × 10 +   ✓ Done (Skip while resting).
  const controls = (
    <HStack spacing={6}>
      {p.wText ? step('w-', 'minus') : null}
      {p.wText ? value(p.wText) : null}
      {p.wText ? step('w+', 'plus') : null}
      {p.wText ? <Spacer /> : null}
      {step('r-', 'minus')}
      {value(p.rText)}
      {step('r+', 'plus')}
      <Spacer />
      {resting ? (
        <Button target="skip" label={p.L.skip} systemImage="forward.fill" modifiers={[buttonStyle('bordered'), buttonBorderShape('capsule'), controlSize('small'), tint(LIGHT)]} />
      ) : (
        <Button target="done" label={p.L.done} systemImage="checkmark" modifiers={[buttonStyle('borderedProminent'), buttonBorderShape('capsule'), controlSize('small'), tint(BLUE)]} />
      )}
    </HStack>
  );
  // Under the bar: the coach's tip (green: go heavier, amber: rest or hold back), or the set when there's no tip.
  const tipColor = p.tipTone === 'up' ? '#4ADE80' : p.tipTone === 'down' ? '#FBBF24' : '#D4D4D8';
  const status = (
    <HStack spacing={6}>
      {p.tip && p.canLog ? <Image systemName="sparkles" color={tipColor} size={12} /> : null}
      <Text modifiers={[font({ size: 12, weight: p.tip && p.canLog ? 'medium' : 'regular' }), foregroundStyle(p.tip && p.canLog ? tipColor : '#D4D4D8'), lineLimit(2), minimumScaleFactor(0.8)]}>
        {p.canLog ? p.tip || p.set : line}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle('#A1A1AA')]}>{`${p.done}/${p.total}`}</Text>
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={p.canLog ? 6 : 8} modifiers={[padding({ all: p.canLog ? 14 : 16 }), activityBackgroundTint('#0A0A0B')]}>
        <HStack spacing={10}>
          <Image systemName={icon} color={accent} size={20} />
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#A1A1AA'), lineLimit(1)]}>{p.canLog ? `${resting ? p.L.rest : p.workout} · ${p.set}` : resting ? `${p.L.rest} · ${p.workout}` : p.workout}</Text>
            <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(1), minimumScaleFactor(0.7)]}>{resting ? `${p.L.next}: ${p.exercise}` : p.exercise}</Text>
          </VStack>
          <Spacer />
          {clock(26, resting ? LIGHT : '#FFFFFF')}
        </HStack>
        {bar}
        {status}
        {p.canLog ? controls : null}
      </VStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: <VStack modifiers={[frame({ maxWidth: 64 })]}>{clock(14, resting ? LIGHT : '#FFFFFF')}</VStack>,
    minimal: <Image systemName={icon} color={accent} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={icon} color={accent} size={18} />
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{resting ? p.L.rest : p.canLog ? p.set : p.workout}</Text>
      </HStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 4 })]}>{clock(22, resting ? LIGHT : '#FFFFFF')}</VStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{resting ? `${p.L.next}: ${p.exercise}` : p.exercise}</Text>
        {status}
        {bar}
        {p.canLog ? controls : null}
      </VStack>
    ),
  };
};

export default createLiveActivity('AdroWorkout', WorkoutActivity);
