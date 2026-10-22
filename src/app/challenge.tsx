import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Bar } from '@/components/Ring';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { FriendPicker } from '@/components/social/FriendPicker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, NavButton, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { useWeight } from '@/lib/units';
import {
  CH_PCT,
  CH_UNIT,
  challengeBoard,
  challengeInfo,
  type ChallengeInfo,
  challengePeople,
  type ChallengeRow,
  challengeTitle,
  daysLeft,
  deleteChallenge,
  displayName,
  inviteToChallenge,
  leaveChallenge,
  nudgeChallenge,
  type Person,
  removeChallengeMember,
  setChallengeGoal,
} from '@/lib/social';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

type Data = { id: string; info: ChallengeInfo | null; board: ChallengeRow[]; people: Person[] };

const NOTE: Record<ChallengeInfo['kind'], string> = {
  steps: 'Steps count from what each person logs in Cardio and steps.',
  workouts: 'Counts workouts finished in Adro during the challenge.',
  volume: 'Counts workouts finished in Adro during the challenge.',
  exercise: 'Kilos added to your heaviest set, compared with your best in the 90 days before the challenge.',
  weight: 'Each person is scored by how far they got from their start weight toward their own goal. Goals stay private.',
  progress: 'How much stronger each person got, compared with their best lifts in the 60 days before the challenge.',
};

/** Challenge leaderboard (design: challenge). Numbers come from what each person logged. */
export default function ChallengeScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id;
  const { today } = useFood();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [nudging, setNudging] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kick, setKick] = useState<Person | null>(null);
  const [inviting, setInviting] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const W = useWeight();

  const load = useCallback(async () => {
    const [info, board, people] = await Promise.all([challengeInfo(id), challengeBoard(id), challengePeople(id)]);
    setData({ id, info, board: board.sort((a, b) => b.value - a.value), people });
  }, [id]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const d = data?.id === id ? data : null;
  if (!d)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!d.info)
    return (
      <Screen title={t('Challenge')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This challenge isn’t available.')}</Text>
        </Card>
      </Screen>
    );
  const ch = d.info;
  const left = daysLeft(ch.end_day, today);
  const pct = CH_PCT.includes(ch.kind);
  const max = pct ? 100 : Math.max(...d.board.map((b) => b.value), 1);
  const myRow = d.board.find((b) => b.user_id === me);
  // The goal is typed in your unit (kg or lb) and saved in kg.
  const goalKg = W.toKg(Number(goal.replace(',', '.')));
  const others = d.board.length > 1;
  const owner = !!me && ch.creator === me;
  const answerKick = async () => {
    if (!kick || busy) return;
    setBusy(true);
    const ok = await removeChallengeMember(ch.id, kick.user_id);
    setBusy(false);
    setKick(null);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(kick.pending ? t('Invite taken back') : t('Removed from the challenge'), { icon: 'trophy' });
    load();
  };
  return (
    <Screen title={t('Challenge')} back right={left > 0 ? <NavButton icon="userplus" label={t('Invite friends')} onPress={() => (setPick([]), setInviting(true))} /> : undefined}>
      <View style={{ alignItems: 'center' }}>
        <Icon name="trophy" size={40} color={c.cobalt} />
        <Text variant="h1" center style={{ marginTop: 8 }}>
          {challengeTitle(ch, t)}
        </Text>
        <Text variant="small" color="sec">
          {`${shortDate(ch.start_day, lang)} – ${shortDate(ch.end_day, lang)}, `}
          {left > 0 ? t('{n} days left', { n: left }) : t('Finished')}
        </Text>
      </View>
      {ch.kind === 'weight' && myRow && !myRow.has_goal ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <Icon name="scale" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Set your goal weight to get a score. Only you see it.')}
          </Text>
          <Button small title={t('Set goal')} onPress={() => (setGoal(''), setGoalOpen(true))} />
        </Card>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Leaderboard')}
      </Text>
      {d.board.map((b, i) => {
        const mine = b.user_id === me;
        return (
          <Card key={b.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: mine ? 2 : 0, borderColor: c.cobalt }}>
            <Text num weight={700} style={{ width: 22 }}>
              {i + 1}
            </Text>
            <Avatar id={b.user_id} name={b.name || '?'} size={36} />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight={700}>{mine ? t('You') : b.name}</Text>
                <Text variant="small" weight={700} num>
                  {ch.kind === 'weight' && !b.has_goal ? t('No goal yet') : pct ? `${fmt(b.value)}${t(CH_UNIT[ch.kind])}` : `${fmt(b.value)} ${t(CH_UNIT[ch.kind])}`}
                </Text>
              </Row>
              <View style={{ marginTop: 8 }}>
                <Bar value={b.value} max={max} color={mine ? c.cobalt : c.sec} />
              </View>
            </View>
          </Card>
        );
      })}
      <Text variant="xs" color="sec" center style={{ marginTop: 4 }}>
        {t(NOTE[ch.kind])}
      </Text>
      {ch.kind === 'weight' && myRow?.goal != null ? (
        <Button small kind="ghost" title={W.words(t('Your goal: {n} kg. Change', { n: fmt(W.num(myRow.goal)) }))} style={{ alignSelf: 'center', marginTop: 4 }} onPress={() => (setGoal(String(W.num(myRow.goal ?? 0))), setGoalOpen(true))} />
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        {t('People')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {d.people.map((m, i) => (
          <Row key={`${m.user_id}${m.pending ? 'p' : ''}`} gap={12} style={{ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Avatar id={m.user_id} name={displayName(m)} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="small" weight={700} numberOfLines={1}>
                {m.user_id === me ? t('You') : displayName(m)}
              </Text>
              <Text variant="xs" color="sec">
                {m.pending ? t('Invited, waiting') : m.user_id === ch.creator ? t('Started it') : `@${m.username}`}
              </Text>
            </View>
            {owner && m.user_id !== me ? (
              <Springy accessibilityLabel={m.pending ? t('Take back invite') : t('Remove {n}', { n: displayName(m) })} onPress={() => setKick(m)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} color={c.sec} />
              </Springy>
            ) : null}
          </Row>
        ))}
      </View>
      {left > 0 && others ? (
        <Button
          kind="glass"
          icon="bell"
          title={t('Nudge friends')}
          loading={nudging}
          style={{ marginTop: 12 }}
          onPress={async () => {
            setNudging(true);
            const r = await nudgeChallenge(ch.id);
            setNudging(false);
            if (r === 'sent') toast(t('Nudge sent'), { icon: 'bell' });
            else if (r === 'already') toast(t('You already nudged today. Try again tomorrow.'), { icon: 'bell' });
            else toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          }}
        />
      ) : null}
      <Button
        kind="ghost"
        title={t('Leave challenge')}
        color={c.down}
        style={{ marginTop: 12 }}
        onPress={() => setLeaveOpen(true)}
      />
      {owner ? <Button kind="ghost" title={t('Delete challenge')} color={c.down} onPress={() => setDeleting(true)} /> : null}
      <Sheet open={deleting} onClose={() => setDeleting(false)}>
        <Text variant="h2" center>
          {t('Delete this challenge?')}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('It’s deleted for everyone in it. This can’t be undone.')}
        </Text>
        <Button
          kind="danger"
          title={t('Delete challenge')}
          loading={busy}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setBusy(true);
            const ok = await deleteChallenge(ch.id);
            setBusy(false);
            setDeleting(false);
            if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            toast(t('Challenge deleted'), { icon: 'trophy' });
            goBack();
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setDeleting(false)} />
      </Sheet>
      <Sheet open={!!kick} onClose={() => setKick(null)}>
        <Text variant="h2" center>
          {kick?.pending ? t('Take back the invite to {n}?', { n: kick ? displayName(kick) : '' }) : t('Remove {n} from the challenge?', { n: kick ? displayName(kick) : '' })}
        </Text>
        <Button kind="danger" title={kick?.pending ? t('Take back invite') : t('Remove')} loading={busy} style={{ marginTop: 16 }} onPress={answerKick} />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setKick(null)} />
      </Sheet>
      <Sheet open={inviting} onClose={() => setInviting(false)}>
        <Text variant="h2">{t('Invite to this challenge')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('They join when they accept your invite.')}
        </Text>
        <View style={{ height: 12 }} />
        <FriendPicker value={pick} onChange={setPick} exclude={d.people.map((p) => p.user_id)} />
        <Button
          title={t('Send invites')}
          disabled={!pick.length}
          onPress={async () => {
            let n = 0;
            for (const u of pick) if (await inviteToChallenge(ch.id, u)) n++;
            setInviting(false);
            load();
            if (!n) return toast(t('Couldn’t invite them. Please try again.'), { icon: 'warn' });
            if (n < pick.length) return toast(t('Invited {a} of {b}. Some couldn’t be invited.', { a: n, b: pick.length }), { icon: 'warn' });
            toast(t('Invite sent. They join when they accept.'), { icon: 'trophy' });
          }}
        />
      </Sheet>
      <Sheet open={leaveOpen} onClose={() => setLeaveOpen(false)}>
        <Text variant="h2" center>
          {t('Leave this challenge?')}
        </Text>
        <Button
          kind="danger"
          title={t('Leave challenge')}
          loading={leaving}
          style={{ marginTop: 16 }}
          onPress={async () => {
            if (!me) return;
            setLeaving(true);
            const ok = await leaveChallenge(ch.id, me);
            setLeaving(false);
            if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            setLeaveOpen(false);
            toast(t('You left the challenge'), { icon: 'trophy' });
            goBack();
          }}
        />
        <Button kind="ghost" title={t('Keep')} style={{ marginTop: 8 }} onPress={() => setLeaveOpen(false)} />
      </Sheet>
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)}>
        <Text variant="h2">{t('Your goal weight')}</Text>
        <Field
          value={goal}
          onChangeText={(v) => setGoal(v.replace(/[^0-9.,]/g, '').slice(0, 5))}
          placeholder="70"
          keyboardType="decimal-pad"
          unit={W.label}
          ltr
          hint={t('Only you see your goal. Friends set their own. Everyone is scored by how far they get toward it.')}
        />
        <Button
          title={t('Save')}
          disabled={!(goalKg >= 30 && goalKg <= 250)}
          style={{ marginTop: 12 }}
          onPress={async () => {
            const ok = await setChallengeGoal(ch.id, goalKg);
            setGoalOpen(false);
            toast(ok ? t('Saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
            load();
          }}
        />
      </Sheet>
    </Screen>
  );
}
