import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { challengeTitle, respondInvite, type SocialInvite } from '@/lib/social';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row } from '../ui';

/** Invites to groups and challenges, with Accept and Decline (design: friends). You join only when you accept. */
export function SocialInvites({ items, onDone }: { items: SocialInvite[]; onDone: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length) return null;

  const answer = async (x: SocialInvite, accept: boolean) => {
    if (busy) return;
    setBusy(`${x.kind}:${x.id}:${accept ? 1 : 0}`);
    const r = await respondInvite(x.kind, x.id, accept);
    setBusy(null);
    if (r === 'failed') return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    onDone();
    if (r === 'joined') {
      toast(x.kind === 'group' ? t('You joined {n}', { n: x.title ?? '' }) : t('You joined the challenge'), { icon: x.kind === 'group' ? 'users' : 'trophy' });
      return router.push({ pathname: x.kind === 'group' ? '/group' : '/challenge', params: { id: x.id } });
    }
    if (r === 'declined') return toast(t('Invite declined'), { icon: 'check' });
    if (r === 'ended') return toast(t('This challenge has ended.'), { icon: 'info' });
    if (r === 'blocked') return toast(t('You can’t join this one.'), { icon: 'info' });
    toast(t('This invite isn’t available anymore.'), { icon: 'info' });
  };

  return (
    <View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 4, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Invites')}
      </Text>
      {items.map((x) => {
        const group = x.kind === 'group';
        const name = group ? (x.title ?? '') : challengeTitle({ kind: x.challenge_kind ?? 'workouts', exercise_name: x.exercise_name }, t);
        const key = `${x.kind}:${x.id}`;
        return (
          <Card key={key} style={{ gap: 12 }}>
            <Row gap={12}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={group ? 'users' : 'trophy'} size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={2}>
                  {group ? t('{n} invited you to the group {g}', { n: x.from_name ?? '', g: name }) : t('{n} invited you to a challenge: {g}', { n: x.from_name ?? '', g: name })}
                </Text>
                <Text variant="small" color="sec">
                  {group ? t('{n} members', { n: x.members }) : t('{n} people', { n: x.members })}
                </Text>
              </View>
            </Row>
            <Row gap={10}>
              <Button small title={t('Accept')} loading={busy === `${key}:1`} style={{ flex: 1 }} onPress={() => answer(x, true)} />
              <Button small kind="soft" title={t('Decline')} loading={busy === `${key}:0`} style={{ flex: 1 }} onPress={() => answer(x, false)} />
            </Row>
          </Card>
        );
      })}
    </View>
  );
}
