import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { FriendPicker } from '@/components/social/FriendPicker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, NavButton, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { fmt } from '@/lib/nutrition';
import { addGroupMember, type BoardRow, displayName, groupBoard, groupFeed, leaveGroup, postToGroup, timeAgo } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

type Post = { id: string; user_id: string; name: string | null; text: string; created_at: string };

/** A group: progress together, volume board and the group feed (design: group). */
export default function GroupScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ id: string; name: string; board: BoardRow[]; posts: Post[] } | null>(null);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [g, board, posts] = await Promise.all([supabase.from('groups').select('name').eq('id', id).maybeSingle(), groupBoard(id), groupFeed(id)]);
    setData({ id, name: (g.data as { name: string } | null)?.name ?? '', board, posts });
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
  const goal = d.board.length * 3;
  const tot = d.board.reduce((a, b) => a + Math.min(3, b.workouts ?? 0), 0);
  const vol = [...d.board].sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
  const nm = (r: { user_id: string; name: string | null; username?: string }) => (r.user_id === me ? t('You') : r.name || r.username || '');

  return (
    <Screen title={d.name} back right={<NavButton icon="userplus" label={t('Add members')} onPress={() => (setPick([]), setAdding(true))} />}>
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
        <Button kind="glass" icon="users" title={t('Train together')} style={{ flex: 1 }} onPress={() => router.push('/together')} />
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
              {m.volume == null ? t('Private') : `${fmt(Number(m.volume))} ${t('kg')}`}
            </Text>
          </Row>
        ))}
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Group feed')}
      </Text>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Write to the group…')}
          placeholderTextColor={c.sec}
          maxLength={300}
          style={{ flex: 1, minHeight: 40, fontSize: 15, color: c.text }}
        />
        <Button
          small
          icon="send"
          title={t('Post')}
          disabled={!text.trim()}
          onPress={async () => {
            if (await postToGroup(d.id, text.trim())) {
              setText('');
              load();
            } else toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          }}
        />
      </Card>
      {d.posts.length ? (
        d.posts.map((p) => (
          <Card key={p.id}>
            <Row gap={10}>
              <Avatar id={p.user_id} name={p.name || '?'} size={32} />
              <View style={{ flex: 1 }}>
                <Text variant="small" weight={700}>
                  {p.user_id === me ? t('You') : p.name}
                </Text>
                <Text variant="xs" color="sec">
                  {timeAgo(p.created_at, t, lang)}
                </Text>
              </View>
            </Row>
            <Text variant="small" style={{ marginTop: 8 }}>
              {p.text}
            </Text>
          </Card>
        ))
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec">
            {t('No posts yet. Say hi to the group.')}
          </Text>
        </Card>
      )}
      <Button
        kind="soft"
        title={t('Leave group')}
        color={c.down}
        style={{ marginTop: 8 }}
        onPress={async () => {
          await leaveGroup(d.id, me);
          toast(t('You left the group'), { icon: 'users' });
          router.back();
        }}
      />
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <Text variant="h2">{t('Add to {n}', { n: d.name })}</Text>
        <View style={{ height: 12 }} />
        <FriendPicker value={pick} onChange={setPick} exclude={d.board.map((b) => b.user_id)} />
        <Button
          title={t('Add')}
          disabled={!pick.length}
          onPress={async () => {
            for (const u of pick) await addGroupMember(d.id, u);
            setAdding(false);
            toast(t('Added to the group'), { icon: 'users' });
            load();
          }}
        />
      </Sheet>
    </Screen>
  );
}
