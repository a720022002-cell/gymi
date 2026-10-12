import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { fmt } from '@/lib/nutrition';
import { postActivity } from '@/lib/social';
import type { WorkoutLog } from '@/lib/train';
import { workoutTitle } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Option } from '../ui';

/** Share a finished workout to your profile; your friends see it in Activity (design: SH.share). */
export function ShareWorkoutSheet({ log, open, onClose }: { log: WorkoutLog; open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pr = log.prs?.[0];
  const text = pr
    ? t('{w} done. New record on {x}: {k} kg.', { w: workoutTitle(log.name, t), x: pr.n, k: pr.w })
    : t('{w} done in {m} minutes, {v} kg lifted.', { w: workoutTitle(log.name, t), m: log.minutes, v: fmt(log.volume) });
  const post = async () => {
    setBusy(true);
    const ok = await postActivity('post', text, { minutes: log.minutes, volume: Math.round(log.volume) });
    setBusy(false);
    onClose();
    toast(ok ? t('Posted to your profile') : t('Couldn’t save. Please try again.'), { icon: ok ? 'share' : 'warn' });
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Share your workout')}</Text>
      <Card style={{ marginTop: 12, backgroundColor: c.inset }}>
        <Text variant="small">{text}</Text>
      </Card>
      <Option icon="user" title={t('My profile')} subtitle={t('Your friends see it in Activity')} selected onPress={() => {}} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Icon name="lock" size={14} color={c.sec} />
        <Text variant="xs" color="sec">
          {t('Only your friends can see it.')}
        </Text>
      </View>
      <Button title={t('Post')} icon="send" loading={busy} style={{ marginTop: 16 }} onPress={post} />
    </Sheet>
  );
}
