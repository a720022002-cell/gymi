import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { BIG_MILESTONES, MILESTONE_NAME, milestoneOf } from '@/lib/streakMilestones';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

import { Text } from '../Text';
import { Button } from '../ui';
import { Icon } from '../Icon';
import { Ring } from '../Ring';

const KEY = (uid: string) => `adro.streakMilestone.${uid}`;

/** "New milestone": once, the first time your day streak reaches a milestone you haven't reached before. */
export function MilestoneUnlocked() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const s = useStreaks();
  const reached = milestoneOf(s.overall).reached;
  const [show, setShow] = useState<number | null>(null);

  useEffect(() => {
    if (!uid || !food.ready || !health.ready) return;
    // Wait for everything to load (the streak can grow as data comes in) before judging.
    const id = setTimeout(() => {
      AsyncStorage.getItem(KEY(uid))
        .catch(() => null)
        .then((v) => {
          const last = v == null ? null : +v;
          // The first time after this update: remember where you are, no celebration for the past.
          if (last == null || Number.isNaN(last)) return AsyncStorage.setItem(KEY(uid), String(reached)).catch(() => {});
          if (reached <= last) return;
          AsyncStorage.setItem(KEY(uid), String(reached)).catch(() => {});
          setShow(reached);
        });
    }, 3000);
    return () => clearTimeout(id);
  }, [uid, food.ready, health.ready, reached]);

  if (show == null) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setShow(null)}>
      <Pressable onPress={() => setShow(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, backgroundColor: c.card, borderRadius: 28, padding: 24, alignItems: 'center' }}>
          <Ring value={1} max={1} size={150} stroke={14} color={c.cobalt}>
            <Icon name={BIG_MILESTONES.has(show) ? 'crown' : 'trophy'} size={24} color={c.cobalt} strokeWidth={2} />
            <Text num size={42} style={{ letterSpacing: -1 }}>
              {String(show)}
            </Text>
          </Ring>
          <Text variant="xs" weight={800} color="sec" style={{ marginTop: 14, letterSpacing: 0.6 }}>
            {t('NEW MILESTONE')}
          </Text>
          <Text variant="h2" center style={{ marginTop: 2 }}>
            {t(MILESTONE_NAME[show])}
          </Text>
          <Text color="sec" center style={{ marginTop: 6 }}>
            {t('{n} days in a row. Keep the flame going.', { n: show })}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 18 }}>
            <Button
              title={t('See your streak')}
              onPress={() => {
                setShow(null);
                router.push('/day-streak');
              }}
            />
            <Button kind="ghost" title={t('Keep it up')} onPress={() => setShow(null)} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
