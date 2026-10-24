import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, type StyleProp, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Mark } from '../Icon';
import { Text } from '../Text';
import { Button, Row, Springy } from '../ui';
import { TOURS, type TourId } from './tours';

/*
 * The app tour: the first time you open each tab, a few cards point at the real buttons (a dimmed screen with a
 * ring around the one being explained). Home starts with a welcome card. Replay it from You (replayTours).
 */

const SEEN = 'tour:seen';
const OFF = 'tour:off';

type State = { id: TourId; step: number; intro: boolean } | null;
let state: State = null;
const subs = new Set<() => void>();
const set = (s: State) => {
  state = s;
  subs.forEach((f) => f());
};
const targets = new Map<string, View>();
let seen: TourId[] | null = null;
let off = false;

async function loadSeen() {
  if (seen) return;
  try {
    const [a, b] = await Promise.all([AsyncStorage.getItem(SEEN), AsyncStorage.getItem(OFF)]);
    seen = a ? (JSON.parse(a) as TourId[]) : [];
    off = b === '1';
  } catch {
    seen = [];
  }
}
const markSeen = (id: TourId) => {
  if (!seen) seen = [];
  if (!seen.includes(id)) seen.push(id);
  AsyncStorage.setItem(SEEN, JSON.stringify(seen)).catch(() => {});
};

/** Show the tour of this tab the first time it opens (after a moment, so the screen has laid out). */
export function useTour(id: TourId, ready = true) {
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let alive = true;
      const timer = setTimeout(async () => {
        await loadSeen();
        if (!alive || off || state || seen?.includes(id)) return;
        set({ id, step: 0, intro: id === 'home' });
      }, 900);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }, [id, ready]),
  );
}

/** Start the tours again from Home (You → Replay app tour). */
export async function replayTours() {
  seen = [];
  off = false;
  await AsyncStorage.multiRemove([SEEN, OFF]).catch(() => {});
}

/** Wraps something a tour points at. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const v = ref.current;
    if (v) targets.set(id, v);
    return () => {
      if (targets.get(id) === v) targets.delete(id);
    };
  }, [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

type Box = { x: number; y: number; w: number; h: number };

/** The dimmed screen, the ring and the card. Mounted once, above everything (app/_layout). */
export function TourOverlay() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
  const { t } = useT();
  const { colors: c } = useSettings();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Where this step's target is on screen, for the step it was measured for.
  const [found, setFound] = useState<{ key: string; box: Box } | null>(null);
  const pulse = useState(() => new Animated.Value(0))[0];
  const fade = useState(() => new Animated.Value(0))[0];
  const steps = s ? TOURS[s.id] : [];
  const step = s && !s.intro ? steps[s.step] : null;
  const key = s ? `${s.id}:${s.step}` : '';
  const box = found?.key === key ? found.box : null;

  // Find where the thing this step points at is on screen (none: the card shows in the middle).
  useEffect(() => {
    if (!step?.target) return;
    const v = targets.get(step.target);
    if (!v) return;
    const timer = setTimeout(
      () =>
        v.measureInWindow((x, y, w, h) => {
          if (!w || !h || y + h < 0 || y > H) return;
          setFound({ key, box: { x: x - 6, y: y - 6, w: w + 12, h: h + 12 } });
        }),
      60,
    );
    return () => clearTimeout(timer);
  }, [step, key, H]);

  useEffect(() => {
    if (!s) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [s, fade, pulse]);

  if (!s) return null;
  const end = (never = false) => {
    markSeen(s.id);
    if (never) {
      off = true;
      AsyncStorage.setItem(OFF, '1').catch(() => {});
    }
    set(null);
  };
  const next = () => (s.step + 1 < steps.length ? set({ ...s, step: s.step + 1 }) : end());

  const dim = 'rgba(0,0,0,0.72)';
  if (s.intro)
    return (
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: dim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          opacity: fade,
        }}>
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: c.card,
            borderRadius: 28,
            padding: 22,
            alignItems: 'center',
          }}>
          <Mark size={46} color={c.cobalt} stroke={7} />
          <Text variant="h2" center style={{ marginTop: 12 }}>
            {t('Welcome to Adro')}
          </Text>
          <Text color="sec" center style={{ marginTop: 6 }}>
            {t('A quick tour of the app, about a minute. Each tab shows its own short tour the first time you open it. Replay it any time from You.')}
          </Text>
          <Row gap={10} style={{ marginTop: 18, alignSelf: 'stretch' }}>
            <Button kind="soft" title={t('Skip')} style={{ flex: 1 }} onPress={() => end()} />
            <Button title={t('Start')} style={{ flex: 1 }} onPress={() => set({ ...s, intro: false })} />
          </Row>
          <Springy onPress={() => end(true)} style={{ marginTop: 14, padding: 4 }}>
            <Text variant="small" color="sec">
              {t('Don’t show tutorials again')}
            </Text>
          </Springy>
        </View>
      </Animated.View>
    );
  if (!step) return null;

  // The dimmed screen with a rounded hole around the target.
  const r = 18;
  const hole = box
    ? `M${box.x + r},${box.y} H${box.x + box.w - r} A${r},${r} 0 0 1 ${box.x + box.w},${box.y + r} V${box.y + box.h - r} A${r},${r} 0 0 1 ${box.x + box.w - r},${box.y + box.h} H${box.x + r} A${r},${r} 0 0 1 ${box.x},${box.y + box.h - r} V${box.y + r} A${r},${r} 0 0 1 ${box.x + r},${box.y} Z`
    : '';
  // The card goes below the target when it's in the top half of the screen, else above it.
  const below = box ? box.y + box.h / 2 < H / 2 : false;
  const cardPos: ViewStyle = box ? (below ? { top: Math.min(box.y + box.h + 14, H - 260) } : { bottom: Math.min(H - box.y + 14, H - insets.top - 220) }) : { top: H / 2 - 110 };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: fade,
      }}>
      <Svg width={W} height={H} style={{ position: 'absolute' }}>
        <Path d={`M0,0 H${W} V${H} H0 Z ${hole}`} fill={dim} fillRule="evenodd" />
      </Svg>
      {/* Tapping anywhere goes on (the screen underneath doesn't take taps while the tour shows). */}
      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={next} accessibilityLabel={t('Next')} />
      {box ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            borderRadius: r,
            borderWidth: 2.5,
            borderColor: c.cobalt,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.45],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.04],
                }),
              },
            ],
          }}
        />
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          ...cardPos,
          backgroundColor: c.card,
          borderRadius: 24,
          padding: 16,
        }}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Mark size={22} color={c.cobalt} stroke={5} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t(step.title)}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 3 }}>
              {t(step.body)}
            </Text>
          </View>
        </Row>
        <Row
          style={{
            marginTop: 14,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Row gap={4} style={{ alignItems: 'center' }}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === s.step ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i <= s.step ? c.cobalt : c.inset,
                }}
              />
            ))}
            <Text variant="xs" color="sec" num style={{ marginStart: 6 }}>{`${s.step + 1}/${steps.length}`}</Text>
          </Row>
          <Row gap={14} style={{ alignItems: 'center' }}>
            {s.step + 1 < steps.length ? (
              <Springy onPress={() => end()} style={{ padding: 4 }}>
                <Text variant="small" color="sec">
                  {t('Skip tutorial')}
                </Text>
              </Springy>
            ) : null}
            <Button small title={t(s.step + 1 < steps.length ? 'Next' : 'Done')} onPress={next} />
          </Row>
        </Row>
      </View>
    </Animated.View>
  );
}
