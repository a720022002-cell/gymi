import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { shortDate } from '@/lib/progress';
import { INVITE_BASE, myReferrals } from '@/lib/social';
import { useSettings } from '@/theme/settings';

const GOAL = 3;

/** Invite friends with your own link (design: invite). Every 3 friends who join earn a free month of Pro. */
export default function Invite() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const [list, setList] = useState<{ name: string | null; username: string; joined: string }[]>([]);
  useEffect(() => {
    let alive = true;
    myReferrals().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  const link = `${INVITE_BASE}${profile?.username ?? ''}`;
  const n = list.length;
  const months = Math.floor(n / GOAL);
  const toNext = GOAL - (n % GOAL);
  const msg = t('Join me on Gymi, the fitness coach app: {l}', { l: link });
  const share = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator) await navigator.share({ text: msg });
      else if (Platform.OS !== 'web') await Share.share({ message: msg });
      else {
        await navigator.clipboard.writeText(link);
        toast(t('Link copied'), { icon: 'copy' });
      }
    } catch {}
  };
  return (
    <Screen title={t('Invite friends')} back>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Ring value={n % GOAL} max={GOAL} size={120} stroke={12}>
          <Text num size={30}>
            {`${n % GOAL}/${GOAL}`}
          </Text>
        </Ring>
        <Text variant="h3" center style={{ marginTop: 12 }}>
          {t('{n} more friends for a free month of Pro', { n: toNext })}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {months ? t('You’ve earned {n} free months. They’re used when Pro launches.', { n: months }) : t('Free months are used when Pro launches.')}
        </Text>
      </Card>
      <Card>
        <Text variant="xs" weight={700} color="sec">
          {t('Your invite link')}
        </Text>
        <Text weight={700} style={{ marginTop: 4, writingDirection: 'ltr' } as object} numberOfLines={1}>
          {link}
        </Text>
        <Row gap={8} style={{ marginTop: 12 }}>
          <Button icon="share" title={t('Share')} style={{ flex: 1 }} onPress={share} />
          <Button
            kind="glass"
            icon="copy"
            title={t('Copy')}
            style={{ flex: 1 }}
            onPress={async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast(t('Link copied'), { icon: 'copy' });
              } catch {
                toast(link, { icon: 'copy' });
              }
            }}
          />
        </Row>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Friends who joined ({n})', { n })}
      </Text>
      {list.length ? (
        <List>
          {list.map((x, i) => (
            <ListRow key={x.username} first={!i}>
              <Avatar id={x.username} name={x.name || x.username} size={36} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{x.name || x.username}</Text>
                <Text variant="small" color="sec">
                  {t('Joined {d}', { d: shortDate(x.joined.slice(0, 10), lang) })}
                </Text>
              </View>
              <Icon name="check" size={18} color={c.up} strokeWidth={2.6} />
            </ListRow>
          ))}
        </List>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t('No one yet. Friends who sign up with your link show here.')}
          </Text>
        </Card>
      )}
    </Screen>
  );
}
