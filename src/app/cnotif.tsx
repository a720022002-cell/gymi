import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/ui';
import { useT } from '@/i18n';

type P = { requests: boolean; messages: boolean; quiet: boolean; summary: boolean };
const DEF: P = { requests: true, messages: true, quiet: true, summary: false };
const KEY = 'gymi.coachNotif.v1';
const ITEMS: [keyof P, string, string][] = [
  ['requests', 'New client requests', 'When someone asks you to coach them'],
  ['messages', 'Messages from clients', 'Every new message'],
  ['quiet', 'Quiet clients', 'When a client hasn’t logged for 3 days'],
  ['summary', 'Daily summary', 'Every evening, how your clients did today'],
];

/** Coach notification settings (design: cnotif). Alerts arrive on the phone app. */
export default function CoachNotif() {
  const { t } = useT();
  const [p, setP] = useState<P>(DEF);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((v) => alive && v && setP({ ...DEF, ...JSON.parse(v) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const set = (k: keyof P, v: boolean) => {
    const next = { ...p, [k]: v };
    setP(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };
  return (
    <Screen title={t('Notifications')} back>
      <List>
        {ITEMS.map(([k, n, d], i) => (
          <ListRow key={k} first={!i}>
            <Text style={{ flex: 1 }}>
              <Text weight={700}>{t(n)}</Text>
              {'\n'}
              <Text variant="small" color="sec">
                {t(d)}
              </Text>
            </Text>
            <Toggle value={p[k]} onChange={(v) => set(k, v)} label={t(n)} />
          </ListRow>
        ))}
      </List>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Alerts arrive on the phone app. Your choices are saved now.')}
      </Text>
    </Screen>
  );
}
