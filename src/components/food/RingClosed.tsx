import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, useWindowDimensions } from 'react-native';

import { useT } from '@/i18n';
import { OVER_KCAL, useFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Ring } from '../Ring';
import { Text } from '../Text';
import { Button } from '../ui';

const KEY = 'adro.ringClosed';
const COLORS = ['#3355FF', '#22C55E', '#F59E0B', '#EF4444', '#A855F7', '#06B6D4', '#FFFFFF'];
const CHEERS = ['Ring closed!', 'Nailed it!', 'Goal hit!', 'Right on target!'];

/** Close enough to the day's calories to count: 95% of the goal (plus cardio) up to 10% or 100 kcal over, whichever is less.
 * More than that opens the balance sheet instead. */
const hit = (eaten: number, max: number) => max > 0 && eaten >= max * 0.95 && eaten < Math.min(max * 1.1, max + OVER_KCAL);

/** A celebration with confetti the first time today's calories land on the goal (design: ring closed). Once a day. */
export function RingClosed() {
  const { t } = useT();
  const food = useFood();
  const max = food.dayGoal(food.today) + food.burned;
  const eaten = Math.round(food.eaten.k);
  const now = food.ready && food.setupDone && food.isToday && hit(eaten, max);
  const [show, setShow] = useState<{ k: number; p: boolean; cheer: string } | null>(null);
  // Only a change counts (logging the meal that closes it), not opening the app on a day that's already closed.
  const prev = useRef<{ day: string; on: boolean } | null>(null);

  useEffect(() => {
    const day = food.today;
    const before = prev.current?.day === day ? prev.current.on : null;
    prev.current = { day, on: now };
    if (!now || before !== false) return;
    const pOk = food.eaten.p >= food.target.p * 0.9;
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((last) => {
        if (last === day) return;
        AsyncStorage.setItem(KEY, day).catch(() => {});
        setShow({ k: eaten, p: pOk, cheer: CHEERS[Math.floor(Math.random() * CHEERS.length)] });
      });
  }, [now, food.today, eaten, food.eaten.p, food.target.p]);

  if (!show) return null;
  return <Celebration k={show.k} goal={max} protein={show.p} cheer={t(show.cheer)} onClose={() => setShow(null)} />;
}

function Celebration({ k, goal, protein, cheer, onClose }: { k: number; goal: number; protein: boolean; cheer: string; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { width, height } = useWindowDimensions();
  const [ring] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [fall] = useState(() => new Animated.Value(0));
  const [bits] = useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      x: Math.random(),
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 1440,
      delay: Math.random() * 0.35,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      round: i % 3 === 0,
      color: COLORS[i % COLORS.length],
    })),
  );
  const [shown, setShown] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 12 }),
      Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // The ring fills up to closed, counting the calories as it goes.
    const id = ring.addListener(({ value }) => setShown(Math.round(value * k)));
    Animated.timing(ring, { toValue: 1, duration: 1100, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => ring.removeListener(id);
  }, [ring, pop, fall, k]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {bits.map((b, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -20,
              left: b.x * width,
              width: b.w,
              height: b.round ? b.w : b.h,
              borderRadius: b.round ? b.w / 2 : 2,
              backgroundColor: b.color,
              opacity: fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: fall.interpolate({ inputRange: [0, b.delay, 1], outputRange: [0, 0, height * (0.75 + b.x * 0.3)] }) },
                { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
                { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${b.spin}deg`] }) },
              ],
            }}
          />
        ))}
        <Animated.View style={{ width: '100%', maxWidth: 360, transform: [{ scale }], opacity: pop }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 32, padding: 24, alignItems: 'center' }}>
            <AnimatedRing value={ring}>
              <Text num size={34}>
                {fmt(shown)}
              </Text>
              <Text variant="xs" weight={700} color="sec">
                {t('of {n} kcal', { n: fmt(goal) })}
              </Text>
            </AnimatedRing>
            <Text variant="h1" center style={{ marginTop: 18 }}>
              {cheer} 🎉
            </Text>
            <Text color="sec" center style={{ marginTop: 6 }}>
              {protein ? t('You hit your calories and your protein today. That’s how results happen.') : t('You hit your calories today. One more good day in the bank.')}
            </Text>
            <Button title={t('Keep it up')} icon="flame" style={{ marginTop: 20, alignSelf: 'stretch' }} onPress={onClose} />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** The ring, driven by an animated value from 0 to closed. */
function AnimatedRing({ value, children }: { value: Animated.Value; children?: ReactNode }) {
  const { colors: c } = useSettings();
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = value.addListener(({ value: x }) => setV(x));
    return () => value.removeListener(id);
  }, [value]);
  return (
    <Ring value={v} max={1} size={180} stroke={18} color={v >= 0.999 ? '#22C55E' : c.cobalt}>
      {children}
    </Ring>
  );
}
