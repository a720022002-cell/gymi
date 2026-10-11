import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { FreeMonthAlert } from '@/components/FreeMonthAlert';
import { Icon } from '@/components/Icon';
import { InviteCodeSheet } from '@/components/InviteCodeSheet';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { inviteText, type MyInvite, myInvite, REF_GOAL } from '@/lib/invites';
import { shortDate } from '@/lib/progress';
import { myReferrals } from '@/lib/social';
import { useSettings } from '@/theme/settings';

/** Invite friends with your personal code (design: invite). Every 5 friends who join earn a free month of Pro. */
export default function Invite() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [inv, setInv] = useState<MyInvite | null>(null);
  const [list, setList] = useState<{ name: string | null; username: string; joined: string }[]>([]);
  const [enter, setEnter] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      myInvite().then((v) => alive && setInv(v));
      myReferrals().then((l) => alive && setList(l));
      return () => {
        alive = false;
      };
    }, []),
  );
  const code = inv?.code ?? '';
  const n = inv?.count ?? list.length;
  const inRound = n % REF_GOAL === 0 && n ? REF_GOAL : n % REF_GOAL;
  const toNext = REF_GOAL - (n % REF_GOAL);
  const earned = inv?.months ?? Math.floor(n / REF_GOAL);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      toast(t('Code copied'), { icon: 'copy' });
    } catch {
      toast(code, { icon: 'copy' });
    }
  };
  const share = async () => {
    const msg = inviteText(code, t);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator) await navigator.share({ text: msg });
      else if (Platform.OS !== 'web') await Share.share({ message: msg });
      else {
        await Clipboard.setStringAsync(msg);
        toast(t('Invite text copied'), { icon: 'copy' });
      }
    } catch {}
  };

  return (
    <Screen title={t('Invite friends')} back>
      <Card style={{ alignItems: 'center', paddingVertical: 22, backgroundColor: c.inset }}>
        <Text variant="small" weight={700} color="sec">
          {t('Your invite code')}
        </Text>
        <Text num size={32} style={{ marginTop: 8, letterSpacing: 2.5, writingDirection: 'ltr' } as object}>
          {code || '…'}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
          {t('Friends type it when they sign up. You’re added as Gym Bros right away.')}
        </Text>
        <Row gap={8} style={{ marginTop: 12, alignSelf: 'stretch' }}>
          <Button small kind="glass" icon="copy" title={t('Copy code')} disabled={!code} style={{ flex: 1, alignSelf: 'stretch' }} onPress={copy} />
          <Button small icon="share" title={t('Share invite')} disabled={!code} style={{ flex: 1, alignSelf: 'stretch' }} onPress={share} />
        </Row>
      </Card>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text weight={700}>{toNext === REF_GOAL && n ? t('Reward unlocked!') : t('{n} more to a free month', { n: toNext })}</Text>
          <Text num>{`${inRound} / ${REF_GOAL}`}</Text>
        </Row>
        <Row gap={6} style={{ marginTop: 12 }}>
          {Array.from({ length: REF_GOAL }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: i < inRound ? c.cobalt : c.track }} />
          ))}
        </Row>
        <Text variant="small" color="sec" style={{ marginTop: 12 }}>
          {t('Every {n} friends who join with your code gives you 1 month of Gymi Premium free.', { n: REF_GOAL })}
        </Text>
        {earned ? (
          <Row gap={10} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, padding: 12 }}>
            <Icon name="check" size={20} color={c.up} strokeWidth={2.6} />
            <Text variant="small" style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {earned > 1 ? t('{n} free months earned.', { n: earned }) : t('1 free month earned.')}
              </Text>{' '}
              {t('Added to your subscription.')}
            </Text>
          </Row>
        ) : null}
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Joined with your code ({n})', { n: list.length })}
      </Text>
      {list.length ? (
        <List>
          {list.map((x, i) => (
            <ListRow key={x.username} first={!i}>
              <Avatar id={x.username} name={x.name || x.username} size={36} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{x.name || x.username}</Text>
                <Text variant="xs" color="sec">
                  {t('Joined {d}', { d: shortDate(x.joined.slice(0, 10), lang) })}
                </Text>
              </View>
              <Icon name="check" size={16} color={c.up} strokeWidth={2.4} />
            </ListRow>
          ))}
        </List>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t('No one yet. Share your code to start.')}
          </Text>
        </Card>
      )}
      <Button kind="glass" icon="key" title={t('Got a code from a friend?')} style={{ marginTop: 8 }} onPress={() => setEnter(true)} />
      <InviteCodeSheet open={enter} cancel onDone={() => setEnter(false)} />
      {inv ? <FreeMonthAlert months={inv.months} /> : null}
    </Screen>
  );
}
