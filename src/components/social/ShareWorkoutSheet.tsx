import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { fmt } from '@/lib/nutrition';
import { type Group, myGroups, postActivity, postToGroup } from '@/lib/social';
import type { WorkoutLog } from '@/lib/train';
import { workoutTitle } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Option, Row } from '../ui';

/** Share a finished workout to your profile (friends see it) or to your groups (design: SH.share). */
export function ShareWorkoutSheet({ log, open, onClose }: { log: WorkoutLog; open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [where, setWhere] = useState<'profile' | 'groups'>('profile');
  const [groups, setGroups] = useState<Group[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    myGroups().then((g) => alive && setGroups(g));
    return () => {
      alive = false;
    };
  }, [open]);
  const pr = log.prs?.[0];
  const text = pr
    ? t('{w} done. New record on {x}: {k} kg.', { w: workoutTitle(log.name, t), x: pr.n, k: pr.w })
    : t('{w} done in {m} minutes, {v} kg lifted.', { w: workoutTitle(log.name, t), m: log.minutes, v: fmt(log.volume) });
  const post = async () => {
    setBusy(true);
    let ok = true;
    if (where === 'profile') ok = await postActivity('post', text, { minutes: log.minutes, volume: Math.round(log.volume) });
    else for (const g of sel) ok = (await postToGroup(g, text)) && ok;
    setBusy(false);
    onClose();
    toast(ok ? t(where === 'profile' ? 'Posted to your profile' : 'Shared to your groups') : t('Couldn’t save. Please try again.'), { icon: ok ? 'share' : 'warn' });
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Share your workout')}</Text>
      <Card style={{ marginTop: 12, backgroundColor: c.inset }}>
        <Text variant="small">{text}</Text>
      </Card>
      <Option icon="user" title={t('My profile')} subtitle={t('Your friends see it in Activity')} selected={where === 'profile'} onPress={() => setWhere('profile')} />
      <Option icon="users" title={t('My groups')} subtitle={groups.length ? groups.map((g) => g.name).join(', ') : t('No groups yet')} selected={where === 'groups'} disabled={!groups.length} onPress={() => setWhere('groups')} />
      {where === 'groups' && groups.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <Chip key={g.id} title={g.name} on={sel.includes(g.id)} onPress={() => setSel(sel.includes(g.id) ? sel.filter((x) => x !== g.id) : [...sel, g.id])} />
          ))}
        </Row>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <Icon name="lock" size={14} color={c.sec} />
        <Text variant="xs" color="sec">
          {t('Only your friends and group members can see it.')}
        </Text>
      </View>
      <Button title={t('Post')} icon="send" loading={busy} disabled={where === 'groups' && !sel.length} style={{ marginTop: 16 }} onPress={post} />
    </Sheet>
  );
}
