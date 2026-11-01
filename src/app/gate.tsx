import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Share, TextInput, View } from 'react-native';

import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { friendsJoined, joinWaitlist, myWaiting, tryCode, useGate, type Waiting } from '@/lib/gate';
import { useSettings } from '@/theme/settings';

/**
 * The invite gate (before signing in, while the launch is invite-only): open Adro with a code, or join the waitlist
 * and share your own code to move up. Your place in line isn't shown, only how many friends joined with your code.
 */
export default function Gate() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  // The team switched the gate off (or this phone already got in): straight on.
  const state = useGate();
  useEffect(() => {
    if (state === 'open') router.replace('/welcome');
  }, [state]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'code' | 'join' | null>(null);
  const [email, setEmail] = useState('');
  const [friend, setFriend] = useState('');
  const [me, setMe] = useState<Waiting | null>(null);
  const [friends, setFriends] = useState(0);

  useEffect(() => {
    let alive = true;
    myWaiting().then((w) => {
      if (!alive || !w) return;
      setMe(w);
      friendsJoined(w.ref).then((n) => alive && setFriends(n));
    });
    return () => {
      alive = false;
    };
  }, []);

  // The logo breathes while you wait.
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const open = async () => {
    if (!code.trim() || busy) return;
    setBusy('code');
    const ok = await tryCode(code);
    setBusy(null);
    if (!ok) return toast(t('That code didn’t work. Check it and try again.'), { icon: 'warn' });
    toast(t('You’re in. Welcome to Adro.'), { icon: 'check' });
    router.replace('/welcome');
  };
  const join = async () => {
    if (busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast(t('Write a real email address.'), { icon: 'info' });
    setBusy('join');
    const ref = await joinWaitlist(email, friend, lang);
    setBusy(null);
    if (!ref) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setMe({ email: email.trim().toLowerCase(), ref });
    friendsJoined(ref).then(setFriends);
  };
  const shareText = (ref: string) => t('I’m on the Adro waitlist. Join with my code {c} to get in sooner: https://adroapp.com', { c: ref });

  const box = { height: 52, borderRadius: 16, backgroundColor: c.inset, paddingHorizontal: 16, fontSize: 20, color: c.text, fontFamily: fontFor('sora', 700), letterSpacing: 3, textAlign: 'center' } as const;

  const field = { height: 50, borderRadius: 14, backgroundColor: c.inset, paddingHorizontal: 14, fontSize: 16, color: c.text, textAlign: 'left', writingDirection: 'ltr' } as const;

  return (
    <Screen title="">
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 18 }}>
        <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: c.cobalt,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.3] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] }) }],
            }}
          />
          <Mark size={72} color={c.cobalt} />
        </View>
        <Text variant="h1" center style={{ marginTop: 14 }}>
          {t('Adro is invite-only for now')}
        </Text>
        <Text color="sec" center style={{ marginTop: 6, paddingHorizontal: 12 }}>
          {t('We’re letting people in a few at a time.')}
        </Text>
      </View>

      <Card>
        <Text weight={700}>{t('Have a code?')}</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
          onSubmitEditing={open}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          placeholder="XXXXXX"
          placeholderTextColor={c.sec}
          accessibilityLabel={t('Your code')}
          style={[box, { marginTop: 10 }]}
        />
        <Button kind="cobalt" title={t('Open Adro')} loading={busy === 'code'} disabled={!code.trim()} style={{ marginTop: 10 }} onPress={open} />
      </Card>

      {me ? (
        <Card>
          <Row gap={8}>
            <Icon name="check" size={18} color={c.up} strokeWidth={2.6} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('You’re on the list')}
            </Text>
          </Row>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('We’ll email {e} when it’s your turn, with your code to get in.', { e: me.email })}
          </Text>
          <View style={{ marginTop: 14, backgroundColor: c.inset, borderRadius: 16, padding: 14, alignItems: 'center' }}>
            <Text variant="xs" weight={700} color="sec">
              {t('Your code to share')}
            </Text>
            <Text size={30} weight={800} style={{ letterSpacing: 5, marginTop: 4 }}>
              {me.ref}
            </Text>
          </View>
          <Text variant="small" style={{ marginTop: 10 }}>
            {t('Every friend who joins with your code moves you up the list.')}
          </Text>
          {friends ? (
            <Text variant="small" weight={700} color={c.up} style={{ marginTop: 4 }}>
              {friends === 1 ? t('1 friend joined with your code') : t('{n} friends joined with your code', { n: friends })}
            </Text>
          ) : null}
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button kind="soft" icon="copy" title={t('Copy')} style={{ flex: 1 }} onPress={() => Clipboard.setStringAsync(me.ref).then(() => toast(t('Copied'), { icon: 'check' }))} />
            <Button kind="cobalt" icon="share" title={t('Share')} style={{ flex: 1 }} onPress={() => Share.share({ message: shareText(me.ref) }).catch(() => {})} />
          </Row>
        </Card>
      ) : (
        <Card>
          <Text weight={700}>{t('No code yet?')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 2, marginBottom: 10 }}>
            {t('Join the waitlist. You get your own code to share: every friend who joins with it moves you up.')}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            placeholder={t('Your email')}
            placeholderTextColor={c.sec}
            accessibilityLabel={t('Email')}
            style={field}
          />
          <TextInput
            value={friend}
            onChangeText={(v) => setFriend(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t('Friend’s code (optional)')}
            placeholderTextColor={c.sec}
            accessibilityLabel={t('Friend’s code')}
            style={[field, { marginTop: 8 }]}
          />
          <Button title={t('Join the waitlist')} loading={busy === 'join'} style={{ marginTop: 12 }} onPress={join} />
        </Card>
      )}

      <Springy onPress={() => router.push('/login')} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 14 }}>
        <Text variant="small" color="sec">
          {t('Already have an account?')}{' '}
          <Text variant="small" weight={700} color="link">
            {t('Sign in')}
          </Text>
        </Text>
      </Springy>
    </Screen>
  );
}
