import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type ChatMsg, dayHeading, deleteChat, groupChats, loadChats, newId, restoreChat } from '@/lib/coach';
import { useFood } from '@/lib/food';
import { addDays } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** Past chats with the coach, by day (design: chathistory). */
export default function ChatHistory() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { today } = useFood();
  const { open: openId } = useLocalSearchParams<{ open?: string }>();
  const [all, setAll] = useState<ChatMsg[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadChats().then(setAll);
  }, []);

  const s = q.trim().toLowerCase();
  const chats = groupChats(all ?? []).filter((g) => !s || g.msgs.some((m) => m.text.toLowerCase().includes(s)));
  const when = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const groups: { head: string; chats: typeof chats }[] = [];
  chats.forEach((g) => {
    const head = dayHeading(g.last, today, addDays(today, -1), lang);
    const last = groups.at(-1);
    if (last?.head === head) last.chats.push(g);
    else groups.push({ head, chats: [g] });
  });
  const remove = async (id: string) => {
    const gone = (all ?? []).filter((m) => m.chat_id === id);
    setAll((xs) => (xs ?? []).filter((m) => m.chat_id !== id));
    await deleteChat(id);
    toast(t('Chat deleted'), {
      icon: 'trash',
      undo: async () => {
        setAll((xs) => [...(xs ?? []), ...gone].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        if (!(await restoreChat(gone))) toast(t('Couldn’t bring it back. Please try again.'), { icon: 'warn' });
      },
    });
  };
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
          groups.map(({ head, chats: list }) => (
            <View key={head}>
              <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
                {head === 'Today' || head === 'Yesterday' ? t(head) : head}
              </Text>
              <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
                {list.map((g, i) => {
                  const last = [...g.msgs].reverse().find((m) => m.role === 'ai') ?? g.msgs[g.msgs.length - 1];
                  const isOpen = g.id === openId;
                  return (
                    <Row key={g.id} gap={10} style={{ paddingVertical: 12, paddingStart: 14, paddingEnd: 6, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                      <Springy onPress={() => open(g.id)} style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', minWidth: 0 }}>
                        <Mark size={26} color={isOpen ? c.cobalt : c.sec} stroke={5} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Row style={{ justifyContent: 'space-between' }}>
                            <Text weight={700} numberOfLines={1} style={{ flex: 1 }}>
                              {g.title || t('New chat')}
                            </Text>
                            {isOpen ? (
                              <Text variant="xs" weight={700} color={c.cobalt}>
                                {t('Open')}
                              </Text>
                            ) : (
                              <Text variant="xs" color="sec">
                                {when(g.last)}
                              </Text>
                            )}
                          </Row>
                          <Text variant="small" color="sec" numberOfLines={2}>
                            {last.text}
                          </Text>
                        </View>
                      </Springy>
                      <Springy onPress={() => remove(g.id)} accessibilityLabel={t('Delete chat')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="trash" size={17} color={c.sec} />
                      </Springy>
                    </Row>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Icon name="search" size={30} color={c.sec} />
            <Text variant="h3" style={{ marginTop: 8 }}>
              {t(s ? 'No chats found' : 'No chats yet')}
            </Text>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t(s ? 'Try a different word.' : 'Ask your coach anything to start.')}
            </Text>
          </Card>
        )}
      </View>
      <Button icon="edit" title={t('New chat')} style={{ marginTop: 16 }} onPress={() => open(newId())} />
    </Screen>
  );
}
