import { Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, gaugeStyle, lineLimit, minimumScaleFactor, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/** What the app sends, already in your language. */
export type TrainProps = {
  /** Today's workout name, or "Rest day". */
  workout: string;
  /** "Done", "Ready when you are" or "Rest and walk". */
  status: string;
  done: boolean;
  rest: boolean;
  /** "Next: Push · Wed", or empty. */
  next: string;
  streak: string;
  /** Recovery score 0 to 100 from today's check-in or the watch, or null. */
  readiness: number | null;
  L: { today: string; streak: string; ready: string };
};

/** Home screen: today's workout, the next one and your streak. Opens Train. */
const TrainWidget = (p: TrainProps, env: WidgetEnvironment) => {
  'widget';
  const BLUE = '#3355FF';
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#FAFAFA' : '#0A0A0B';
  const sec = dark ? '#A1A1AA' : '#52525B';
  const bg = dark ? '#0A0A0B' : '#FFFFFF';
  const icon = p.done ? 'checkmark.circle.fill' : p.rest ? 'figure.walk' : 'dumbbell.fill';
  const iconColor = p.done ? '#16A34A' : BLUE;
  const small = [font({ size: 12, weight: 'medium' }), foregroundStyle(sec), lineLimit(1)];

  const main = (
    <VStack alignment="leading" spacing={4}>
      <HStack spacing={6}>
        <Image systemName={icon} color={iconColor} size={15} />
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(BLUE)]}>{p.L.today}</Text>
      </HStack>
      <Text modifiers={[font({ size: env.widgetFamily === 'systemSmall' ? 20 : 22, weight: 'bold' }), foregroundStyle(ink), lineLimit(2), minimumScaleFactor(0.7)]}>{p.workout}</Text>
      <Text modifiers={small}>{p.status}</Text>
      <Spacer />
      {p.next ? <Text modifiers={small}>{p.next}</Text> : null}
      <HStack spacing={4}>
        <Image systemName="flame.fill" color="#F59E0B" size={12} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(1)]}>{`${p.streak} ${p.L.streak}`}</Text>
      </HStack>
    </VStack>
  );

  if (env.widgetFamily === 'systemSmall' || p.readiness == null)
    return (
      <HStack modifiers={[containerBackground(bg, 'widget'), widgetURL('adro://train')]}>
        {main}
        <Spacer />
      </HStack>
    );

  // Medium with a recovery score: the score as a ring on the side.
  const color = p.readiness >= 67 ? '#16A34A' : p.readiness >= 34 ? '#F59E0B' : '#DC2626';
  return (
    <HStack spacing={12} modifiers={[containerBackground(bg, 'widget'), widgetURL('adro://train')]}>
      {main}
      <Spacer />
      <VStack spacing={4}>
        <Gauge
          value={p.readiness / 100}
          modifiers={[gaugeStyle('circularCapacity'), tint(color), frame({ width: 84, height: 84 })]}
          currentValueLabel={<Text modifiers={[font({ size: 22, weight: 'bold', design: 'rounded' }), foregroundStyle(ink)]}>{`${p.readiness}`}</Text>}
        />
        <Text modifiers={small}>{p.L.ready}</Text>
      </VStack>
    </HStack>
  );
};

export default createWidget('AdroTrain', TrainWidget);
