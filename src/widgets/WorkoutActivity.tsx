import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/** What the app sends while you train, already in your language. Times are milliseconds since 1970. */
export type WorkoutActivityProps = {
  workout: string;
  /** The exercise you're on, "Set 2 of 4", and its target ("80 kg × 10"), or empty when all sets are done. */
  exercise: string;
  set: string;
  target: string;
  startedAt: number;
  /** When the rest ends, or null when not resting. */
  restEnd: number | null;
  restStart: number | null;
  done: number;
  total: number;
  L: { rest: string; next: string; sets: string };
};

/**
 * The workout on the Lock Screen and in the Dynamic Island: the clock counts by itself (no updates needed), and the
 * rest countdown takes its place while you rest.
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

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), activityBackgroundTint('#0A0A0B')]}>
        <HStack spacing={10}>
          <Image systemName={icon} color={accent} size={20} />
          <VStack alignment="leading" spacing={1}>
            <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#A1A1AA'), lineLimit(1)]}>{resting ? `${p.L.rest} · ${p.workout}` : p.workout}</Text>
            <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(1), minimumScaleFactor(0.7)]}>{resting ? `${p.L.next}: ${p.exercise}` : p.exercise}</Text>
          </VStack>
          <Spacer />
          {clock(26, resting ? LIGHT : '#FFFFFF')}
        </HStack>
        {bar}
        <HStack>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#D4D4D8'), lineLimit(1)]}>{line}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13 }), monospacedDigit(), foregroundStyle('#A1A1AA')]}>{`${p.done}/${p.total} ${p.L.sets}`}</Text>
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: <VStack modifiers={[frame({ maxWidth: 64 })]}>{clock(14, resting ? LIGHT : '#FFFFFF')}</VStack>,
    minimal: <Image systemName={icon} color={accent} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={icon} color={accent} size={18} />
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{resting ? p.L.rest : p.workout}</Text>
      </HStack>
    ),
    expandedTrailing: <VStack modifiers={[padding({ trailing: 4 })]}>{clock(22, resting ? LIGHT : '#FFFFFF')}</VStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4, bottom: 4 })]}>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{resting ? `${p.L.next}: ${p.exercise}` : p.exercise}</Text>
        <HStack>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#D4D4D8'), lineLimit(1)]}>{line}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13 }), monospacedDigit(), foregroundStyle('#A1A1AA')]}>{`${p.done}/${p.total}`}</Text>
        </HStack>
        {bar}
      </VStack>
    ),
  };
};

export default createLiveActivity('AdroWorkout', WorkoutActivity);
