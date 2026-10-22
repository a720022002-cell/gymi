import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ReportSheet } from '@/components/social/ReportSheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import { Button, Card, Chip, NavButton, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { meetingReply, type Message, messages, sendMessage } from '@/lib/coaching';
import { fmtTime } from '@/lib/nutrition';
import { markThreadSeen } from '@/lib/coachUnread';
import { supabase } from '@/lib/supabase';
import { DAYS } from '@/lib/training';
import { timeAgo } from '@/lib/social';
import { goBack } from '@/lib/nav';
import { useSettings } from '@/theme/settings';

const QUICK = ['Great work this week!', 'Don’t forget to log your meals.', 'How did the workout feel?'];

/** Messages between a coach and a client, with quick replies and meeting requests (design: cthread / mythread). Checks for new messages every few seconds. */
export default function Thread() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const { link, name, client } = useLocalSearchParams<{ link: string; name?: string; client?: string }>();
  const [list, setList] = useState<{ link: string; m: Message[]; coach: boolean; other: string | null; ended: boolean } | null>(null);
  const [text, setText] = useState('');
  const [report, setReport] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const [m, l] = await Promise.all([messages(link), supabase.from('coach_clients').select('coach_id,client_id,status').eq('id', link).maybeSingle()]);
    const row = l.data as { coach_id: string; client_id: string | null; status: string } | null;
    const coach = row?.coach_id === me;
    // Ended (or no longer yours): no more messages. A failed load isn't counted as ended.
    setList({ link, m, coach, other: row ? (coach ? row.client_id : row.coach_id) : null, ended: !l.error && row?.status !== 'active' });
    // Read now (Home shows new messages from your coach until you open the chat).
    markThreadSeen(link);
  }, [link, me]);

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
  const isCoach = list?.link === link && list.coach;
  const cur = list?.link === link ? list : null;
  const ended = !!cur?.ended;
  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [m.length]);

  const send = async (raw?: string) => {
    const v = (raw ?? text).trim();
    if (!v) return;
    if (raw == null) setText('');
    const r = await sendMessage(link, v);
    if (!r) {
      if (raw == null) setText(v);
      toast(t('Couldn’t send. Please try again.'), { icon: 'warn' });
      return false;
    }
    setList((x) => (x && x.link === link ? { ...x, m: [...x.m, r] } : x));
    return true;
  };
  const answer = async (x: Message, ok: boolean) => {
    if (!(await meetingReply(x.id, ok))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    await send(ok ? t('Confirmed. See you then!') : t('That time doesn’t work. Can you pick another?'));
    load();
  };

  return (
    <Screen title={name || t('Messages')} back scrollRef={scroll} right={cur?.other ? <NavButton icon="warn" label={t('Report')} onPress={() => setReport(true)} /> : undefined}>
      {client ? <Button small kind="ghost" title={t('View {n}’s progress', { n: name ?? '' })} style={{ alignSelf: 'center', marginBottom: 8 }} onPress={() => router.push({ pathname: '/client', params: { link, id: client } })} /> : null}
      {m.length ? (
        m.map((x) => {
          const mine = x.sender === me;
          return (
            <View key={x.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <View style={{ maxWidth: '82%', backgroundColor: mine ? c.cobalt : c.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 }}>
                {x.kind === 'meet' || x.kind === 'nudge' ? (
                  <Row gap={4} style={{ marginBottom: 4 }}>
                    <Icon name={x.kind === 'meet' ? 'cal' : 'bell'} size={12} color={mine ? '#FFFFFF' : c.cobalt} />
                    <Text variant="xs" weight={700} color={mine ? '#FFFFFF' : c.cobalt}>
                      {t(x.kind === 'meet' ? 'Meeting request' : 'Check-in reminder')}
                    </Text>
                  </Row>
                ) : null}
                <Text color={mine ? '#FFFFFF' : 'text'}>
                  {x.kind === 'meet' && x.meta?.time != null && x.meta.day != null ? t('Can we meet at the gym on {d} at {t}?', { d: t(DAYS[x.meta.day]), t: fmtTime(x.meta.time, lang) }) : x.text}
                </Text>
                {x.kind === 'meet' ? (
                  x.meta?.status === 'confirmed' || x.meta?.status === 'declined' ? (
                    <Text variant="xs" weight={700} color={mine ? '#FFFFFF' : x.meta.status === 'confirmed' ? 'up' : 'sec'} style={{ marginTop: 4 }}>
                      {t(x.meta.status === 'confirmed' ? 'Confirmed' : 'Asked for another time')}
                    </Text>
                  ) : isCoach && !mine && !ended ? (
                    <Row gap={6} style={{ marginTop: 8 }}>
                      <Button small title={t('Confirm')} onPress={() => answer(x, true)} />
                      <Button small kind="soft" title={t('Another time')} onPress={() => answer(x, false)} />
                    </Row>
                  ) : (
                    <Text variant="xs" weight={700} color={mine ? '#FFFFFF' : 'sec'} style={{ marginTop: 4 }}>
                      {t('Waiting for your coach to confirm')}
                    </Text>
                  )
                ) : null}
              </View>
              <Text variant="xs" color="sec" style={{ marginTop: 2, marginHorizontal: 6 }}>
                {timeAgo(x.created_at, t, lang)}
              </Text>
            </View>
          );
        })
      ) : ended ? null : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec">
            {t('No messages yet. Say hello.')}
          </Text>
        </Card>
      )}
      {ended ? (
        <Card style={{ alignItems: 'center', marginTop: 12 }}>
          <Text variant="small" weight={700} color="sec">
            {t('Coaching ended')}
          </Text>
        </Card>
      ) : null}
      {isCoach && !ended ? (
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12 }}>
          {QUICK.map((q) => (
            <Chip key={q} title={t(q)} onPress={() => send(t(q))} />
          ))}
        </Row>
      ) : null}
      {ended ? null : (
        <Row gap={8} style={{ marginTop: 12 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => send()}
            placeholder={t('Write a message…')}
            placeholderTextColor={c.sec}
            maxLength={2000}
            style={{ flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: c.card, paddingHorizontal: 16, fontSize: 16, color: c.text }}
          />
          <Button small icon="send" title={t('Send')} disabled={!text.trim()} onPress={() => send()} />
        </Row>
      )}
      <ReportSheet open={report} onClose={() => setReport(false)} user={cur?.other ?? null} name={name || t('Someone')} refId={link} onBlocked={() => goBack()} />
    </Screen>
  );
}
