import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type ChatMsg, deleteChat, groupChats, loadChats, newId } from '@/lib/coach';
import { useSettings } from '@/theme/settings';

/** Past chats with the coach (design: chathistory). */
export default function ChatHistory() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [all, setAll] = useState<ChatMsg[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadChats().then(setAll);
  }, []);

  const s = q.trim().toLowerCase();
  const chats = groupChats(all ?? []).filter((g) => !s || g.msgs.some((m) => m.text.toLowerCase().includes(s)));
  const when = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const open = (id: string) => router.replace({ pathname: '/coach', params: { chat: id } });

  return (
    <Screen title={t('Chat history')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Your past chats with the coach. Tap one to open it.')}
      </Text>
      <Field value={q} onChangeText={setQ} placeholder={t('Search your chats')} />
      <View style={{ marginTop: 16 }}>
        {!all ? (
          <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
        ) : chats.length ? (
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {chats.map((g, i) => {
              const last = [...g.msgs].reverse().find((m) => m.role === 'ai') ?? g.msgs[g.msgs.length - 1];
              return (
                <Row key={g.id} gap={10} style={{ paddingVertical: 12, paddingStart: 14, paddingEnd: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <Springy onPress={() => open(g.id)} style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', minWidth: 0 }}>
                    <Mark size={26} color={c.cobalt} stroke={5} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text weight={700} numberOfLines={1} style={{ flex: 1 }}>
                          {g.title || t('New chat')}
                        </Text>
                        <Text variant="xs" color="sec">
                          {when(g.last)}
                        </Text>
                      </Row>
                      <Text variant="small" color="sec" numberOfLines={2}>
                        {last.text}
                      </Text>
                    </View>
                  </Springy>
                  <Springy
                    onPress={async () => {
                      setAll((xs) => (xs ?? []).filter((m) => m.chat_id !== g.id));
                      await deleteChat(g.id);
                      toast(t('Chat deleted'), { icon: 'trash' });
                    }}
                    accessibilityLabel={t('Delete chat')}
                    style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={17} color={c.sec} />
                  </Springy>
                </Row>
              );
            })}
          </View>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Icon name="search" size={30} color={c.sec} />
            <Text variant="h3" style={{ marginTop: 8 }}>
              {t(s ? 'No chats found' : 'No chats yet')}
            </Text>
          </Card>
        )}
      </View>
      <Button icon="edit" title={t('New chat')} style={{ marginTop: 16 }} onPress={() => open(newId())} />
    </Screen>
  );
}
