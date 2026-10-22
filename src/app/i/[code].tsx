import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { COACH_REF_KEY, REF_KEY } from '@/components/ReferralClaim';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorText } from '@/components/ui';
import { useT } from '@/i18n';
import { profileComplete, useAuth } from '@/lib/auth';
import { redeemCode } from '@/lib/coaching';
import { claimInvite } from '@/lib/invites';
import { appInviteUrl, COACH_CODE, FRIEND_CODE, type InviteKind, USERNAME } from '@/lib/links';
import { useSettings } from '@/theme/settings';

/** What a link's code is: a friend's invite code (or username), a coach's code, or nothing we know. */
function readCode(raw: string | undefined, k: string | undefined): { code: string; kind: InviteKind } | null {
  const v = decodeURIComponent(String(raw ?? ''))
    .trim()
    .replace(/^@/, '');
  if (k === 'coach') return COACH_CODE.test(v.toUpperCase()) ? { code: v.toUpperCase(), kind: 'coach' } : null;
  if (FRIEND_CODE.test(v)) return { code: v.toUpperCase(), kind: 'friend' };
  if (USERNAME.test(v.toLowerCase())) return { code: v.toLowerCase(), kind: 'friend' };
  return null;
}

/**
 * An invite link (https://…/i/CODE, or adro://i/CODE). On the website: the invite, with Open in Adro and
 * Continue on the web. In the app: confirm, then send the friend request or connect to the coach. Signed out,
 * the code is kept and used once your account is ready.
 */
export default function InviteLink() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session, profile, loading } = useAuth();
  const { code: raw, k } = useLocalSearchParams<{ code: string; k?: string }>();
  const inv = readCode(raw, k);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const web = Platform.OS === 'web';
  const signedIn = !!session && profileComplete(profile);

  const close = () => router.replace('/');

  // Signed out: keep the code (it's used after sign-up or log-in) and go to Welcome.
  const later = async () => {
    if (!inv) return;
    if (inv.kind === 'coach') {
      await AsyncStorage.setItem(COACH_REF_KEY, inv.code).catch(() => {});
      return router.replace('/welcome');
    }
    await AsyncStorage.setItem(REF_KEY, inv.code).catch(() => {});
    router.replace({ pathname: '/welcome', params: { ref: inv.code } });
  };

  const confirm = async () => {
    if (!inv || busy) return;
    if (!signedIn) return later();
    setBusy(true);
    setErr(null);
    if (inv.kind === 'friend') {
      const f = await claimInvite(inv.code);
      setBusy(false);
      if (f.status === 'ok' || f.status === 'friends') {
        toast(t('You and {n} are now Gym Bros', { n: f.name || f.username || '' }), { icon: 'users' });
        return router.replace('/friends');
      }
      if (f.status === 'requested') {
        toast(t('Friend request sent to {n}. You’ll be Gym Bros once they accept.', { n: f.name || `@${f.username ?? ''}` }), { icon: 'users' });
        return router.replace('/friends');
      }
      if (f.status === 'self') return setErr(t('That’s your own code.'));
      if (f.status === 'slow') return setErr(t('Too many tries. Wait an hour and try again.'));
      if (f.status === 'failed') return setErr(t('You’re offline. Check your connection and try again.'));
      return setErr(t('That code doesn’t match. Check it with the person who sent it.'));
    }
    const r = await redeemCode(inv.code);
    setBusy(false);
    if (r === 'ok') {
      toast(t('You’re connected with your coach'), { icon: 'check' });
      return router.replace('/mycoach');
    }
    if (r === 'has_coach') return setErr(t('You already have a coach. End that first.'));
    if (r === 'full') return setErr(t('This coach is full right now. Check back soon.'));
    if (r === 'self') return setErr(t('That’s your own code.'));
    if (r === 'slow') return setErr(t('Too many tries. Wait an hour and try again.'));
    if (r === 'failed') return setErr(t('You’re offline. Check your connection and try again.'));
    setErr(t('That coach code doesn’t work anymore. Ask your coach for a new one.'));
  };

  if (!inv)
    return (
      <Screen title={t('Invite')}>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="warn" size={30} color={c.sec} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t('This invite link doesn’t work')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Ask the person who sent it for a new link, or type their code in Adro.')}
          </Text>
        </Card>
        <Button title={t('Open Adro')} onPress={close} />
      </Screen>
    );

  const coach = inv.kind === 'coach';
  return (
    <Screen title={t('Invite')}>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Logo height={34} />
      </View>
      <Card style={{ alignItems: 'center', paddingVertical: 24, marginTop: 20 }}>
        <Icon name={coach ? 'key' : 'users'} size={34} color={c.cobalt} />
        <Text variant="h2" center style={{ marginTop: 8 }}>
          {coach ? t('Your coach invited you to Adro') : t('You’re invited to Adro')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 6 }}>
          {coach
            ? t('Use this code to connect with your coach. They’ll see your progress and send you plans.')
            : t('Use this code to send your friend a friend request. Train together, cheer each other on and start challenges.')}
        </Text>
        <Text num size={24} style={{ letterSpacing: 2, marginTop: 14 }}>
          {inv.code}
        </Text>
      </Card>
      <ErrorText>{err}</ErrorText>
      {web ? (
        <>
          <Button icon="phone" title={t('Open in Adro')} style={{ marginTop: 12 }} onPress={() => Linking.openURL(appInviteUrl(inv.code, inv.kind)).catch(() => {})} />
          <Button
            kind="glass"
            title={signedIn ? (coach ? t('Connect on the web') : t('Send friend request on the web')) : t('Continue on the web')}
            loading={busy}
            disabled={loading}
            style={{ marginTop: 8 }}
            onPress={confirm}
          />
          <Text variant="xs" color="sec" center style={{ marginTop: 10 }}>
            {t('Open in Adro works on a phone with Adro installed.')}
          </Text>
        </>
      ) : (
        <>
          <Button
            title={signedIn ? (coach ? t('Connect with my coach') : t('Send friend request')) : t('Sign up or log in to continue')}
            loading={busy}
            disabled={loading}
            style={{ marginTop: 12 }}
            onPress={confirm}
          />
          <Button kind="ghost" title={t('Not now')} style={{ marginTop: 8 }} onPress={close} />
        </>
      )}
    </Screen>
  );
}
