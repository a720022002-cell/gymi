import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { broadcast, coachInbox, type InboxRow } from '@/lib/coaching';
import { timeAgo } from '@/lib/social';
import { useSettings } from '@/theme/settings';

import { Thinking } from '../food/Thinking';
import { Screen } from '../Screen';
import { Sheet } from '../Sheet';
import { Avatar } from '../social/Avatar';
import { List, ListRow } from '../social/List';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card } from '../ui';

/** Coach: one conversation per client, newest first, and a message to everyone (design: cmsg). */
export function MessagesView() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [all, setAll] = useState(false);
  const [text, setText] = useState('');
  const load = useCallback(async () => setRows(await coachInbox()), []);
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 15000);
      return () => clearInterval(id);
    }, [load]),
  );
  return (
    <Screen title={t('Messages')} large tabs>
      {!rows ? (
        <Thinking message={t('Loading')} />
      ) : rows.length ? (
        <List>
          {rows.map((r, i) => {
            const unread = !!r.last_sender && r.last_sender !== me;
            return (
              <ListRow key={r.link_id} first={!i} onPress={() => router.push({ pathname: '/thread', params: { link: r.link_id, name: r.name || r.username, client: r.client_id } })}>
                <Avatar id={r.client_id} name={r.name || r.username} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={700}>{r.name || r.username}</Text>
                  <Text variant="small" color="sec" numberOfLines={1}>
                    {r.last_text ? `${r.last_sender === me ? t('You: ') : ''}${r.last_text}` : t('No messages yet')}
                  </Text>
                </View>
                {r.last_at ? (
                  <Text variant="xs" color="sec">
                    {timeAgo(r.last_at, t, lang)}
                  </Text>
                ) : null}
                {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.cobalt }} /> : null}
              </ListRow>
            );
          })}
        </List>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec" center>
            {t('No clients yet. When clients join, your conversations show here.')}
          </Text>
        </Card>
      )}
      {rows?.length ? <Button kind="glass" icon="send" title={t('Message all clients')} onPress={() => setAll(true)} /> : null}
      <Sheet open={all} onClose={() => setAll(false)}>
        <Text variant="h2">{t('Message all clients')}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          placeholder={t('For example: The gym is closed Friday. Do the home workout instead.')}
          placeholderTextColor={c.sec}
          style={{ marginTop: 12, minHeight: 100, borderRadius: 16, backgroundColor: c.card, padding: 14, fontSize: 16, color: c.text, textAlignVertical: 'top' }}
        />
        <Button
          title={t('Send')}
          disabled={!text.trim()}
          style={{ marginTop: 12 }}
          onPress={async () => {
            const n = await broadcast(text.trim());
            setAll(false);
            setText('');
            toast(t('Sent to {n} clients', { n }), { icon: 'send' });
            load();
          }}
        />
      </Sheet>
    </Screen>
  );
}
