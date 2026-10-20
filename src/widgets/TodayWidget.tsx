import { Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, gaugeStyle, lineLimit, minimumScaleFactor, monospacedDigit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/** What the app sends: numbers already formatted, and every label already in your language. */
export type TodayProps = {
  /** Calories left (or over, when negative) and how much of the goal is eaten, 0 to 1. */
  left: string;
  over: boolean;
  part: number;
  eaten: string;
  goal: string;
  protein: string;
  proteinPart: number;
  steps: string;
  stepsPart: number;
  L: { left: string; over: string; eaten: string; protein: string; steps: string; today: string };
};

/** Home screen and Lock Screen: calories left as a ring, with protein and steps. Opens Food. */
const TodayWidget = (p: TodayProps, env: WidgetEnvironment) => {
  'widget';
  const BLUE = '#3355FF';
  const dark = env.colorScheme === 'dark';
  const ink = dark ? '#FAFAFA' : '#0A0A0B';
  const sec = dark ? '#A1A1AA' : '#52525B';
  const bg = dark ? '#0A0A0B' : '#FFFFFF';
  const ring = p.over ? '#DC2626' : BLUE;
  const big = (size: number) => [font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(ink), lineLimit(1), minimumScaleFactor(0.6)];
  const small = [font({ size: 12, weight: 'medium' }), foregroundStyle(sec), lineLimit(1)];

  if (env.widgetFamily === 'accessoryCircular')
    return (
      <Gauge value={Math.min(1, p.part)} modifiers={[gaugeStyle('circularCapacity'), widgetURL('adro://food')]} currentValueLabel={<Text modifiers={[font({ size: 14, weight: 'bold' }), minimumScaleFactor(0.5)]}>{p.left}</Text>} />
    );
  if (env.widgetFamily === 'accessoryRectangular')
    return (
      <VStack alignment="leading" spacing={3} modifiers={[widgetURL('adro://food')]}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{`${p.left} ${p.over ? p.L.over : p.L.left}`}</Text>
        <Gauge value={Math.min(1, p.part)} modifiers={[gaugeStyle('linearCapacity')]} />
        <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{`${p.L.protein} ${p.protein}`}</Text>
      </VStack>
    );

  const gauge = (
    <Gauge
      value={Math.min(1, p.part)}
      modifiers={[gaugeStyle('circularCapacity'), tint(ring), frame({ width: env.widgetFamily === 'systemSmall' ? 84 : 104, height: env.widgetFamily === 'systemSmall' ? 84 : 104 })]}
      currentValueLabel={
        <VStack spacing={0}>
          <Text modifiers={big(env.widgetFamily === 'systemSmall' ? 20 : 24)}>{p.left}</Text>
          <Text modifiers={[font({ size: 10, weight: 'medium' }), foregroundStyle(sec), lineLimit(1)]}>{p.over ? p.L.over : p.L.left}</Text>
        </VStack>
      }
    />
  );

  if (env.widgetFamily === 'systemSmall')
    return (
      <VStack alignment="leading" spacing={6} modifiers={[containerBackground(bg, 'widget'), widgetURL('adro://food')]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(BLUE)]}>{p.L.today}</Text>
        <HStack>
          <Spacer />
          {gauge}
          <Spacer />
        </HStack>
        <Text modifiers={small}>{`${p.L.protein} ${p.protein}`}</Text>
      </VStack>
    );

  // Medium: the ring, and the day in three lines with small bars.
  const row = (label: string, value: string, part: number, color: string) => (
    <VStack alignment="leading" spacing={3}>
      <HStack>
        <Text modifiers={small}>{label}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(ink), lineLimit(1)]}>{value}</Text>
      </HStack>
      <Gauge value={Math.min(1, part)} modifiers={[gaugeStyle('linearCapacity'), tint(color)]} />
    </VStack>
  );
  return (
    <HStack spacing={16} modifiers={[containerBackground(bg, 'widget'), widgetURL('adro://food')]}>
      {gauge}
      <VStack alignment="leading" spacing={8} modifiers={[padding({ vertical: 2 })]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(BLUE)]}>{p.L.today}</Text>
        {row(p.L.eaten, `${p.eaten} / ${p.goal}`, p.part, ring)}
        {row(p.L.protein, p.protein, p.proteinPart, ink)}
        {row(p.L.steps, p.steps, p.stepsPart, '#16A34A')}
      </VStack>
    </HStack>
  );
};

export default createWidget('AdroToday', TodayWidget);
