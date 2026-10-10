import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { DEFAULT_SHARE, getShare, saveShare, type Share } from '@/lib/social';

const ITEMS: [keyof Share, string][] = [
  ['workouts', 'Workouts you finish'],
  ['prs', 'Personal records'],
  ['streak', 'Streaks'],
  ['weight', 'Weight and trend'],
  ['body', 'Body measurements'],
];

/** What friends can see (design: fprivacy). */
export default function FriendPrivacy() {
  const { t } = useT();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [s, setS] = useState<Share | null>(null);

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
    </Screen>
  );
}
