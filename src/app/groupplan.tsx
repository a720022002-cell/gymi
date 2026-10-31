import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type BoardMember, getGroupWorkout, groupBoard, groupExName, groupSessionInfo, type GroupSessionFull, isCardio, joinGroupWorkout, leaveGroupWorkout, setsOf, whenLabel } from '@/lib/groupWorkout';
import { applyTogether, noteText, type TogetherAction } from '@/lib/together';
import { useTrain } from '@/lib/train';
import { exInfo, exMuscle, muscleLabel } from '@/lib/training';
import { useSettings } from '@/theme/settings';

type Data = { id: string; g: GroupSessionFull | null; board: BoardMember[]; info: Awaited<ReturnType<typeof groupSessionInfo>>[string] | undefined };

/** A group workout you were invited to: the whole workout and everyone's sets, before you accept. */
export default function GroupPlan() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const train = useTrain();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [g, board, info] = await Promise.all([getGroupWorkout(id), groupBoard(id), groupSessionInfo([id])]);
      if (alive) setD({ id, g, board, info: info[id] });
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const data = d?.id === id ? d : null;
  if (!data)
    return (
      <Screen title={t('Group workout')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const g = data.g;
  if (!g || g.status === 'done')
    return (
      <Screen title={t('Group workout')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This group workout has ended.')}</Text>
        </Card>
      </Screen>
    );
  const host = g.host === me;
  const meRow = data.board.find((m) => m.user_id === me);
  const note = data.info?.notes?.[me];
  const accepted = !!train.plan?.togetherDone?.[id];
  const nameOf = (m: BoardMember) => (m.user_id === me ? t('You') : m.name || m.username);
  const hostRow = data.board.find((m) => m.user_id === g.host);
  const w = g.scheduled_at ? whenLabel(g.scheduled_at, t, lang) : null;
  const accept = () => {
    if (train.plan && note && !accepted) train.updatePlan(applyTogether(train.plan, id, note.action as TogetherAction, note.day));
  };

  return (
    <Screen title={t('Group workout')} back>
      <Row gap={0} style={{ justifyContent: 'center' }}>
        {data.board.map((m, i) => (
          <View key={m.user_id} style={{ marginStart: i ? -12 : 0, borderWidth: 2, borderColor: c.bg, borderRadius: 26 }}>
            <Avatar id={m.user_id} name={m.name || m.username} size={48} />
          </View>
        ))}
      </Row>
      <Text variant="h2" center style={{ marginTop: 12 }}>
        {t(data.info?.title || 'Full body')}
      </Text>
      <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
        {[w ? `${w.day}, ${w.time}` : g.status === 'live' ? t('Started already.') : '', host ? '' : t('{n} invited you.', { n: hostRow ? nameOf(hostRow) : '' })].filter(Boolean).join('. ')}
      </Text>
      {noteText(note, lang) ? (
        <Card style={{ marginTop: 16 }}>
          <Text variant="xs" weight={700} color="sec">
            {t(accepted ? 'For you' : 'If you join')}
          </Text>
          <Text variant="small" style={{ marginTop: 2 }}>
            {noteText(note, lang)}
          </Text>
        </Card>
      ) : null}
      {g.workout.map((x, i) => {
        const cardio = isCardio(x);
        const info = exInfo({ id: x.id, n: x.n, ar: x.ar, m: x.m }, lang);
        return (
          <Card key={`${x.id}-${i}`} style={i === 0 && !noteText(note, lang) ? { marginTop: 16 } : undefined}>
            <Text variant="xs" weight={700} color="sec">{`${i + 1}. ${cardio ? t('Cardio') : muscleLabel(exMuscle(x.id, info.muscle), lang, t)}`}</Text>
            <Text variant="h3">{groupExName(x, lang, t)}</Text>
            {cardio ? (
              <Text variant="small" color="sec" style={{ marginTop: 4 }}>
                {t('{n} min, everyone together', { n: x.min ?? 20 })}
              </Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {data.board.map((m) => {
                  const s = setsOf(m, x);
                  const timed = info.timed || x.type === 2;
                  return (
                    <Row key={m.user_id} gap={10} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}>
                      <Avatar id={m.user_id} name={m.name || m.username} size={28} />
                      <Text variant="small" weight={700} style={{ flex: 1 }}>
                        {nameOf(m)}
                      </Text>
                      <Text variant="small" num>
                        {timed ? t('{a} rounds × {b} s', { a: s.sets.length, b: s.reps }) : t('{a} sets × {b} reps', { a: s.sets.length, b: s.reps })}
                      </Text>
                    </Row>
                  );
                })}
              </View>
            )}
          </Card>
        );
      })}
      {meRow && !host ? (
        <View style={{ marginTop: 8 }}>
          {note && !accepted && g.scheduled_at && g.status === 'open' ? (
            <Button
              icon="check"
              title={t('Accept')}
              onPress={() => {
                accept();
                toast(t('You’re in. Your plan is updated.'), { icon: 'check' });
                router.back();
              }}
            />
          ) : null}
          <Button
            kind={note && !accepted && g.status === 'open' ? 'glass' : 'primary'}
            icon="play"
            title={t(g.status === 'live' ? 'Join now' : 'Start')}
            style={{ marginTop: 8 }}
            onPress={async () => {
              accept();
              await joinGroupWorkout(id);
              router.replace({ pathname: '/groupactive', params: { id } });
            }}
          />
          <Button
            kind="ghost"
            title={t('Not this time')}
            style={{ marginTop: 8 }}
            onPress={async () => {
              const ok = await leaveGroupWorkout(id);
              if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
              toast(t('Group workout cancelled'), { icon: 'trash' });
              router.back();
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
