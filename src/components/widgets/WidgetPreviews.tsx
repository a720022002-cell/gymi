import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import type { TodayProps } from '@/widgets/TodayWidget';
import type { TrainProps } from '@/widgets/TrainWidget';

// The iPhone widgets drawn in the app (Widgets page), the same layout and colors as src/widgets. Only a picture:
// the real ones are drawn by iOS.

const BLUE = '#3355FF';
const LIGHT = '#8FA3FF';
const GREEN = '#16A34A';
export const SMALL = 158;
export const MEDIUM = 338;

type Theme = { bg: string; ink: string; sec: string; track: string };
const themeOf = (dark: boolean): Theme =>
  dark ? { bg: '#0A0A0B', ink: '#FAFAFA', sec: '#A1A1AA', track: '#27272A' } : { bg: '#FFFFFF', ink: '#0A0A0B', sec: '#52525B', track: '#E4E4E7' };

function MiniRing({ size, stroke, part, color, track, children }: { size: number; stroke: number; part: number; color: string; track: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, part));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${len * p} ${len}`} /> : null}
      </Svg>
      {children}
    </View>
  );
}

function Line({ part, color, track, h = 5 }: { part: number; color: string; track: string; h?: number }) {
  return (
    <View style={{ height: h, borderRadius: h / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%`, height: '100%', borderRadius: h / 2, backgroundColor: color }} />
    </View>
  );
}

function Box({ w, theme, children, style }: { w: number; theme: Theme; children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        { width: w, height: SMALL, borderRadius: 22, padding: 14, backgroundColor: theme.bg, borderWidth: theme.bg === '#0A0A0B' ? 1 : 0, borderColor: '#27272A', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
        style,
      ]}>
      {children}
    </View>
  );
}

const Small = ({ children, color }: { children: ReactNode; color: string }) => (
  <Text size={12} weight={500} color={color} numberOfLines={1}>
    {children}
  </Text>
);

export function TodaySmall({ p, dark }: { p: TodayProps; dark: boolean }) {
  const th = themeOf(dark);
  return (
    <Box w={SMALL} theme={th} style={{ gap: 6 }}>
      <Text size={13} weight={700} color={BLUE}>
        {p.L.today}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <MiniRing size={80} stroke={8} part={p.part} color={p.over ? '#DC2626' : BLUE} track={th.track}>
          <Text num size={19} weight={700} color={th.ink}>
            {p.left}
          </Text>
          <Text size={9} weight={500} color={th.sec} numberOfLines={1}>
            {p.over ? p.L.over : p.L.left}
          </Text>
        </MiniRing>
      </View>
      <Small color={th.sec}>{`${p.L.protein} ${p.protein}`}</Small>
    </Box>
  );
}

export function TodayMedium({ p, dark }: { p: TodayProps; dark: boolean }) {
  const th = themeOf(dark);
  const ring = p.over ? '#DC2626' : BLUE;
  const row = (label: string, value: string, part: number, color: string) => (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        <Small color={th.sec}>{label}</Small>
        <Text num size={12} weight={600} color={th.ink} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Line part={part} color={color} track={th.track} />
    </View>
  );
  return (
    <Box w={MEDIUM} theme={th} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <MiniRing size={100} stroke={10} part={p.part} color={ring} track={th.track}>
        <Text num size={22} weight={700} color={th.ink}>
          {p.left}
        </Text>
        <Text size={10} weight={500} color={th.sec} numberOfLines={1}>
          {p.over ? p.L.over : p.L.left}
        </Text>
      </MiniRing>
      <View style={{ flex: 1, gap: 7 }}>
        <Text size={13} weight={700} color={BLUE}>
          {p.L.today}
        </Text>
        {row(p.L.eaten, `${p.eaten} / ${p.goal}`, p.part, ring)}
        {row(p.L.protein, p.protein, p.proteinPart, th.ink)}
        {row(p.L.steps, p.steps, p.stepsPart, GREEN)}
      </View>
    </Box>
  );
}

function TrainMain({ p, th, big }: { p: TrainProps; th: Theme; big: boolean }) {
  const icon: IconName = p.done ? 'check' : p.rest ? 'walk' : 'train';
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={15} color={p.done ? GREEN : BLUE} />
        <Text size={13} weight={700} color={BLUE}>
          {p.L.today}
        </Text>
      </View>
      <Text size={big ? 21 : 19} weight={700} color={th.ink} numberOfLines={2}>
        {p.workout}
      </Text>
      <Small color={th.sec}>{p.status}</Small>
      <View style={{ flex: 1 }} />
      {p.next ? <Small color={th.sec}>{p.next}</Small> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="flame" size={12} color="#F59E0B" />
        <Text size={12} weight={600} color={th.ink} numberOfLines={1}>
          {`${p.streak} ${p.L.streak}`}
        </Text>
      </View>
    </View>
  );
}

export function TrainSmall({ p, dark }: { p: TrainProps; dark: boolean }) {
  const th = themeOf(dark);
  return (
    <Box w={SMALL} theme={th}>
      <TrainMain p={p} th={th} big={false} />
    </Box>
  );
}

export function TrainMedium({ p, dark }: { p: TrainProps; dark: boolean }) {
  const th = themeOf(dark);
  const score = p.readiness;
  const color = score == null ? th.track : score >= 67 ? GREEN : score >= 34 ? '#F59E0B' : '#DC2626';
  return (
    <Box w={MEDIUM} theme={th} style={{ flexDirection: 'row', gap: 12 }}>
      <TrainMain p={p} th={th} big />
      {score != null ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <MiniRing size={80} stroke={8} part={score / 100} color={color} track={th.track}>
            <Text num size={21} weight={700} color={th.ink}>
              {score}
            </Text>
          </MiniRing>
          <Small color={th.sec}>{p.L.ready}</Small>
        </View>
      ) : null}
    </Box>
  );
}

/** The two Lock Screen widgets under the clock, on a wallpaper. */
export function LockScreen({ p, date, time }: { p: TodayProps; date: string; time: string }) {
  return (
    <View style={{ borderRadius: 28, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', backgroundColor: '#2B2F6E', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', backgroundColor: '#5A2E62', opacity: 0.7 }} />
      <Text size={15} weight={500} color="#FFFFFFD9">
        {date}
      </Text>
      <Text num size={64} weight={600} color="#FFFFFF" style={{ lineHeight: 72 }}>
        {time}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}>
        <MiniRing size={54} stroke={5} part={p.part} color="#FFFFFFF2" track="#FFFFFF40">
          <Text num size={12} weight={700} color="#FFFFFF">
            {p.left}
          </Text>
        </MiniRing>
        <View style={{ width: 150, gap: 3 }}>
          <Text size={14} weight={700} color="#FFFFFF" numberOfLines={1}>
            {`${p.left} ${p.over ? p.L.over : p.L.left}`}
          </Text>
          <Line part={p.part} color="#FFFFFF" track="#FFFFFF40" h={4} />
          <Text size={11} color="#FFFFFF" numberOfLines={1}>
            {`${p.L.protein} ${p.protein}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

export type CardSample = { workout: string; set: string; exercise: string; clock: string; tip: string; w: string; r: string; water: string; count: string };

/** The workout on the Lock Screen while you train, with its buttons (a picture; nothing here is tappable). */
export function WorkoutCard({ s }: { s: CardSample }) {
  const circle = (child: ReactNode, bg = '#FFFFFF29') => <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{child}</View>;
  const pm = (name: IconName) => circle(<Icon name={name} size={14} color="#FFFFFF" />);
  return (
    <View style={{ backgroundColor: '#0A0A0B', borderRadius: 22, padding: 14, gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="train" size={20} color={LIGHT} />
        <View style={{ flex: 1 }}>
          <Text size={12} weight={600} color="#A1A1AA" numberOfLines={1}>
            {`${s.workout} · ${s.set}`}
          </Text>
          <Text size={16} weight={700} color="#FFFFFF" numberOfLines={1}>
            {s.exercise}
          </Text>
        </View>
        <Text num size={24} weight={600} color="#FFFFFF">
          {s.clock}
        </Text>
      </View>
      <Line part={0.3} color={BLUE} track="#3F3F46" h={4} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Icon name="sparkle" size={12} color="#4ADE80" />
        <Text size={12} weight={500} color="#4ADE80" numberOfLines={2} style={{ flex: 1 }}>
          {s.tip}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text num size={12} color="#A1A1AA">
            {s.count}
          </Text>
          <Text size={12} color="#38BDF8" numberOfLines={1}>
            {s.water}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {pm('minus')}
        <Text size={14} weight={700} color="#FFFFFF" numberOfLines={1}>
          {s.w}
        </Text>
        {pm('plus')}
        <View style={{ flex: 1 }} />
        {pm('minus')}
        <Text size={14} weight={700} color="#FFFFFF" numberOfLines={1}>
          {s.r}
        </Text>
        {pm('plus')}
        <View style={{ flex: 1 }} />
        {circle(<Icon name="drop" size={13} color="#38BDF8" />, '#38BDF833')}
        {circle(<Icon name="check" size={14} color="#FFFFFF" />, BLUE)}
      </View>
    </View>
  );
}
