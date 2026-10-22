import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { GroupWorkoutsCard } from '@/components/train/GroupWorkoutsCard';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { FriendPicker } from '@/components/social/FriendPicker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, NavButton, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/nutrition';
import { addGroupMember, type BoardRow, deleteGroup, displayName, groupBoard, groupFeed, groupPeople, leaveGroup, type Person, removeGroupMember, timeAgo } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

type Post = { id: string; user_id: string; name: string | null; text: string; created_at: string };

/** A group: progress together, the volume board, workouts members shared, and Train together requests (design: group). */
export default function GroupScreen() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ id: string; name: string; owner: string | null; board: BoardRow[]; posts: Post[]; people: Person[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kick, setKick] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [g, board, posts, people] = await Promise.all([supabase.from('groups').select('name,owner').eq('id', id).maybeSingle(), groupBoard(id), groupFeed(id), groupPeople(id)]);
    const row = g.data as { name: string; owner: string } | null;
    setData({ id, name: row?.name ?? '', owner: row?.owner ?? null, board, posts, people });
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
  // The other members, for this group's Train together requests (kept stable so the list isn't reloaded on every render).
  const memberKey = (d?.board ?? []).map((b) => b.user_id).filter((u) => u !== me).join(',');
  const memberIds = useMemo(() => (memberKey ? memberKey.split(',') : []), [memberKey]);
  if (!d)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const goal = d.board.length * 3;
  const tot = d.board.reduce((a, b) => a + Math.min(3, b.workouts ?? 0), 0);
  const vol = [...d.board].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
  const nm = (r: { user_id: string; name: string | null; username?: string }) => (r.user_id === me ? t('You') : r.name || r.username || '');
  const owner = !!me && d.owner === me;
  const answerKick = async () => {
    if (!kick || busy) return;
    setBusy(true);
    const ok = await removeGroupMember(d.id, kick.user_id);
    setBusy(false);
    setKick(null);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(kick.pending ? t('Invite taken back') : t('Removed from the group'), { icon: 'users' });
    load();
  };

  return (
    <Screen title={d.name} back right={<NavButton icon="userplus" label={t('Invite friends')} onPress={() => (setPick([]), setAdding(true))} />}>
      <View style={{ alignItems: 'center' }}>
        <Row gap={0}>
          {d.board.slice(0, 6).map((m, i) => (
            <View key={m.user_id} style={{ marginStart: i ? -12 : 0, borderWidth: 2, borderColor: c.bg, borderRadius: 30 }}>
              <Avatar id={m.user_id} name={displayName(m)} size={48} />
            </View>
          ))}
        </Row>
        <Text variant="h2" style={{ marginTop: 12 }}>
          {d.name}
        </Text>
        <Text variant="small" color="sec">
          {t('{n} members', { n: d.board.length })}
        </Text>
      </View>
      <Row gap={10} style={{ marginTop: 16 }}>
        <Button icon="trophy" title={t('Group challenge')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/newchallenge', params: { group: d.board.filter((b) => b.user_id !== me).map((b) => b.user_id).join(',') } })} />
        <Button kind="glass" icon="users" title={t('Train together')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/together', params: { members: d.board.filter((b) => b.user_id !== me).map((b) => b.user_id).join(',') } })} />
      </Row>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Progress together')}
      </Text>
      <Card>
        <Row>
          <Ring value={tot} max={goal} size={72} stroke={8}>
            <Text num size={18}>
              {tot}
            </Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('{a} of {b} workouts this week', { a: tot, b: goal })}</Text>
            <Text variant="small" color="sec">
              {goal - tot > 0 ? t('Everyone together. {n} more to hit the group goal.', { n: goal - tot }) : t('Group goal reached.')}
            </Text>
          </View>
        </Row>
        {d.board.map((m) => (
          <Row key={m.user_id} gap={10} style={{ marginTop: 10 }}>
            <Avatar id={m.user_id} name={displayName(m)} size={28} />
            <Text variant="small" weight={700} style={{ width: 70 }} numberOfLines={1}>
              {nm(m)}
            </Text>
            <View style={{ flex: 1 }}>{m.workouts == null ? <Text variant="xs" color="sec">{t('Private')}</Text> : <Bar value={Math.min(3, m.workouts)} max={3} color={m.user_id === me ? c.cobalt : c.sec} />}</View>
            <Text variant="small" weight={700} num style={{ width: 30, textAlign: 'right' }}>
              {m.workouts == null ? '' : `${Math.min(3, m.workouts)}/3`}
            </Text>
          </Row>
        ))}
      </Card>
      <Card>
        <Text weight={700}>{t('Volume this week')}</Text>
        {vol.map((m, i) => (
          <Row key={m.user_id} gap={10} style={{ marginTop: 8 }}>
            <Text num weight={700} style={{ width: 16 }}>
              {i + 1}
            </Text>
            <Text variant="small" weight={700} style={{ flex: 1 }}>
              {nm(m)}
            </Text>
            <Text variant="small" weight={700} color="sec" num>
              {m.volume == null ? t('Private') : `${fmt(W.num(Number(m.volume)))} ${W.label}`}
            </Text>
          </Row>
        ))}
      </Card>
      {d.posts.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Shared workouts')}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
            {d.posts.map((p, i) => (
              <Row key={p.id} gap={12} style={{ alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Avatar id={p.user_id} name={p.name || '?'} size={32} />
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text variant="small" weight={700}>
                      {p.user_id === me ? t('You') : p.name}
                    </Text>
                    <Text variant="xs" color="sec">
                      {timeAgo(p.created_at, t, lang)}
                    </Text>
                  </Row>
                  <Text variant="small" style={{ marginTop: 2 }}>
                    {p.text}
                  </Text>
                </View>
              </Row>
            ))}
          </View>
        </>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Members')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {d.people.map((m, i) => (
          <Row key={`${m.user_id}${m.pending ? 'p' : ''}`} gap={12} style={{ paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Avatar id={m.user_id} name={displayName(m)} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="small" weight={700} numberOfLines={1}>
                {nm(m)}
              </Text>
              <Text variant="xs" color="sec">
                {m.pending ? t('Invited, waiting') : m.user_id === d.owner ? t('Owner') : `@${m.username}`}
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
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Train together requests')}
      </Text>
      <GroupWorkoutsCard title={false} members={memberIds} empty={t('No group workouts planned. Tap Train together to invite the group.')} />
      <Button
        kind="soft"
        title={t('Leave group')}
        color={c.down}
        style={{ marginTop: 8 }}
        onPress={() => setLeaving(true)}
      />
      {owner ? <Button kind="ghost" title={t('Delete group')} color={c.down} style={{ marginTop: 8 }} onPress={() => setDeleting(true)} /> : null}
      <Sheet open={deleting} onClose={() => setDeleting(false)}>
        <Text variant="h2" center>
          {t('Delete {n}?', { n: d.name })}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('The group is deleted for everyone, with its shared workouts. This can’t be undone.')}
        </Text>
        <Button
          kind="danger"
          title={t('Delete group')}
          loading={busy}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setBusy(true);
            const ok = await deleteGroup(d.id);
            setBusy(false);
            setDeleting(false);
            if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            toast(t('Group deleted'), { icon: 'users' });
            goBack();
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setDeleting(false)} />
      </Sheet>
      <Sheet open={!!kick} onClose={() => setKick(null)}>
        <Text variant="h2" center>
          {kick?.pending ? t('Take back the invite to {n}?', { n: kick ? displayName(kick) : '' }) : t('Remove {n} from the group?', { n: kick ? displayName(kick) : '' })}
        </Text>
        <Button kind="danger" title={kick?.pending ? t('Take back invite') : t('Remove')} loading={busy} style={{ marginTop: 16 }} onPress={answerKick} />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setKick(null)} />
      </Sheet>
      <Sheet open={leaving} onClose={() => setLeaving(false)}>
        <Text variant="h2" center>
          {t('Leave {n}?', { n: d.name })}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {owner && d.people.some((p) => !p.pending && p.user_id !== me) ? t('Another member becomes the owner. You can be invited back by a member.') : t('You can be invited back by a member.')}
        </Text>
        <Button
          kind="danger"
          title={t('Leave group')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            const ok = await leaveGroup(d.id, me);
            setLeaving(false);
            if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            toast(t('You left the group'), { icon: 'users' });
            goBack();
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setLeaving(false)} />
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <Text variant="h2">{t('Invite to {n}', { n: d.name })}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('They join when they accept your invite.')}
        </Text>
        <View style={{ height: 12 }} />
        <FriendPicker value={pick} onChange={setPick} exclude={[...d.board.map((b) => b.user_id), ...d.people.map((p) => p.user_id)]} />
        <Button
          title={t('Send invites')}
          disabled={!pick.length}
          onPress={async () => {
            let added = 0;
            for (const u of pick) if (await addGroupMember(d.id, u)) added++;
            setAdding(false);
            load();
            if (!added) return toast(t('Couldn’t invite them. Please try again.'), { icon: 'warn' });
            if (added < pick.length) return toast(t('Invited {a} of {b}. Some couldn’t be invited.', { a: added, b: pick.length }), { icon: 'warn' });
            toast(t('Invite sent. They join when they accept.'), { icon: 'users' });
          }}
        />
      </Sheet>
    </Screen>
  );
}
