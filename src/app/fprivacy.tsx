import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { DEFAULT_SHARE, getShare, myBlocks, saveShare, type Share, unblockUser } from '@/lib/social';

const ITEMS: [keyof Share, string][] = [
  ['workouts', 'Workouts you finish'],
  ['prs', 'Personal records'],
  ['streak', 'Streaks and badges'],
  ['weight', 'Weight and trend'],
  ['body', 'Body measurements'],
  ['photos', 'Progress photos'],
];

/** What friends can see (design: fprivacy). */
export default function FriendPrivacy() {
  const { t } = useT();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [s, setS] = useState<Share | null>(null);
  // People you blocked: unblock them here.
  const [blocked, setBlocked] = useState<{ id: string; username: string | null; name: string | null }[]>([]);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    myBlocks().then((v) => alive && setBlocked(v));
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getShare(uid).then((v) => alive && setS(v));
    return () => {
      alive = false;
    };
  }, [uid]);

  const cur = s ?? DEFAULT_SHARE;
  return (
    <Screen title={t('What friends see')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Friends only see what you turn on here. You can change it any time.')}
      </Text>
      <View style={{ height: 16 }} />
      <List>
        {ITEMS.map(([k, n], i) => (
          <ListRow key={k} first={!i}>
            <Text weight={700} style={{ flex: 1 }}>
              {t(n)}
            </Text>
            <Toggle
              value={cur[k]}
              label={t(n)}
              onChange={async (v) => {
                if (!uid) return;
                const next = { ...cur, [k]: v };
                setS(next);
                if (!(await saveShare(uid, next))) toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
              }}
            />
          </ListRow>
        ))}
      </List>
      <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Food logs, sleep, health and cycle data are never shared with friends.')}
      </Text>
      {blocked.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Blocked people')}
          </Text>
          <List>
            {blocked.map((b, i) => (
              <ListRow key={b.id} first={!i}>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{b.name || (b.username ? `@${b.username}` : t('Someone'))}</Text>
                  {b.username ? <Text variant="small" color="sec">{`@${b.username}`}</Text> : null}
                </View>
                <Button
                  small
                  kind="soft"
                  title={t('Unblock')}
                  onPress={async () => {
                    if (!(await unblockUser(b.id))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                    setBlocked((xs) => xs.filter((x) => x.id !== b.id));
                    toast(t('Unblocked'), { icon: 'unlock' });
                  }}
                />
              </ListRow>
            ))}
          </List>
        </>
      ) : null}
    </Screen>
  );
}
