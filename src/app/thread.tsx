import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type Message, messages, sendMessage } from '@/lib/coaching';
import { timeAgo } from '@/lib/social';
import { useSettings } from '@/theme/settings';

/** Messages between a coach and a client. Checks for new messages every few seconds. */
export default function Thread() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const { link, name, client } = useLocalSearchParams<{ link: string; name?: string; client?: string }>();
  const [list, setList] = useState<{ link: string; m: Message[] } | null>(null);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const m = await messages(link);
    setList({ link, m });
  }, [link]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (alive) await load();
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [load]);

  const m = list?.link === link ? list.m : [];
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [m.length]);

  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    const r = await sendMessage(link, v);
    if (!r) {
      setText(v);
      return toast(t('Couldn’t send. Please try again.'), { icon: 'warn' });
    }
    setList({ link, m: [...m, r] });
  };

  return (
    <Screen title={name || t('Messages')} back scrollRef={scroll}>
      {client ? <Button small kind="ghost" title={t('View {n}’s progress', { n: name ?? '' })} style={{ alignSelf: 'center', marginBottom: 8 }} onPress={() => router.push({ pathname: '/client', params: { link, id: client } })} /> : null}
      {m.length ? (
        m.map((x) => {
          const mine = x.sender === me;
          return (
            <View key={x.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <View style={{ maxWidth: '82%', backgroundColor: mine ? c.cobalt : c.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text color={mine ? '#FFFFFF' : 'text'}>{x.text}</Text>
              </View>
              <Text variant="xs" color="sec" style={{ marginTop: 2, marginHorizontal: 6 }}>
                {timeAgo(x.created_at, t, lang)}
              </Text>
            </View>
          );
        })
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec">
            {t('No messages yet. Say hello.')}
          </Text>
        </Card>
      )}
      <Row gap={8} style={{ marginTop: 12 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder={t('Write a message…')}
          placeholderTextColor={c.sec}
          maxLength={2000}
          style={{ flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: c.card, paddingHorizontal: 16, fontSize: 16, color: c.text }}
        />
        <Button small icon="send" title={t('Send')} disabled={!text.trim()} onPress={send} />
      </Row>
    </Screen>
  );
}
