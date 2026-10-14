import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { redeemCode } from '@/lib/coaching';
import { claimInvite } from '@/lib/invites';
import { useSettings } from '@/theme/settings';

import { Field } from './Field';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { useToast } from './Toast';
import { Button, ErrorText } from './ui';

/**
 * "Got an invite code?" (design: SH.invitecode). A friend's code makes you Gym Bros,
 * a coach's code connects you to that coach. onDone runs after Connect or Skip.
 */
export function InviteCodeSheet({ open, onDone, cancel }: { open: boolean; onDone: (joined: 'friend' | 'coach' | null) => void; cancel?: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const code = v.trim().toUpperCase();
    if (!code) return setErr(cancel ? t('Type a code.') : t('Type a code or tap Skip.'));
    setBusy(true);
    setErr(null);
    const f = await claimInvite(code);
    if (f.status === 'ok' || f.status === 'friends') {
      setBusy(false);
      setV('');
      toast(t('You and {n} are now Gym Bros', { n: f.name || f.username || '' }), { icon: 'users' });
      return onDone('friend');
    }
    if (f.status === 'requested') {
      setBusy(false);
      setV('');
      toast(t('Friend request sent to @{u}', { u: f.username ?? '' }), { icon: 'users' });
      return onDone('friend');
    }
    if (f.status === 'self') {
      setBusy(false);
      return setErr(t('That’s your own code.'));
    }
    const r = await redeemCode(code);
    setBusy(false);
    if (r === 'ok') {
      setV('');
      toast(t('You’re connected with your coach'), { icon: 'check' });
      return onDone('coach');
    }
    if (r === 'has_coach') return setErr(t('You already have a coach. End that first.'));
    if (r === 'full') return setErr(t('This coach is full right now. Check back soon.'));
    if (r === 'self') return setErr(t('That’s your own code.'));
    setErr(t(f.status === 'failed' && r === 'failed' ? 'You’re offline. Check your connection and try again.' : 'That code doesn’t match. Check it with the person who sent it.'));
  };

  return (
    <Sheet open={open} onClose={() => onDone(null)}>
      <View style={{ alignItems: 'center' }}>
        <Icon name="key" size={34} color={c.cobalt} strokeWidth={2} />
        <Text variant="h2" center style={{ marginTop: 8 }}>
          {t('Got an invite code?')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('From a friend or a coach. You can skip this.')}
        </Text>
      </View>
      <Field
        value={v}
        onChangeText={(x) => {
          setV(x.toUpperCase());
          setErr(null);
        }}
        placeholder="NOURA-2K8 or GYMI-XXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        onSubmitEditing={connect}
        ltr
        style={{ textAlign: 'center', fontSize: 18, letterSpacing: 1 }}
      />
      <ErrorText>{err}</ErrorText>
      <Button title={t('Connect')} loading={busy} style={{ marginTop: 16 }} onPress={connect} />
      <Button title={cancel ? t('Cancel') : t('Skip')} kind="ghost" style={{ marginTop: 8 }} onPress={() => onDone(null)} />
    </Sheet>
  );
}
