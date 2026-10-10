import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { PartnerCycles } from '@/components/social/PartnerCycles';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, NavButton, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useAuth } from '@/lib/auth';
import { shortDate } from '@/lib/progress';
import {
  acceptRequest,
  CH_TITLE,
  daysLeft,
  cheer,
  type Challenge,
  displayName,
  feed,
  type FeedItem,
  findUser,
  type Found,
  type FriendRow,
  type Group,
  myChallenges,
  myFriends,
  myGroups,
  myGroupSessions,
  removeFriendship,
  sendRequest,
  timeAgo,
} from '@/lib/social';
import { useSettings } from '@/theme/settings';

type Tab = 'friends' | 'groups' | 'activity';

/** Gym Bros: friends, groups and challenges, and your friends' activity (design: friends). */
export default function Friends() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [live, setLive] = useState<Awaited<ReturnType<typeof myGroupSessions>>>([]);

  const load = useCallback(async () => {
    const [f, g, c, a, ls] = await Promise.all([myFriends(), myGroups(), myChallenges(), feed(), myGroupSessions()]);
    setLive(ls);
    setFriends(f);
    setGroups(g);
    setChallenges(c);
    setItems(a);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen title={t('Gym Bros')} large tabs right={<NavButton icon="userplus" label={t('Add a friend')} onPress={() => setAdding(true)} />}>
      {live.map((x) => (
        <Card key={x.id} onPress={() => router.push({ pathname: '/groupactive', params: { id: x.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.gAi }}>
          <Icon name="users" size={22} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{x.joined ? t('Group workout in progress') : t('{n} invited you to train together', { n: x.host_name ?? '' })}</Text>
            <Text variant="small" color="sec">
              {t('{n} people', { n: x.members })}
            </Text>
          </View>
          <Text variant="small" weight={700} color="link">
            {t(x.joined ? 'Open' : 'Join')}
          </Text>
        </Card>
      ))}
      <Segmented<Tab>
        value={tab}
        options={[
          { value: 'friends', label: t('Friends') },
          { value: 'groups', label: t('Groups') },
          { value: 'activity', label: t('Activity') },
        ]}
        onChange={setTab}
      />
      <View style={{ height: 16 }} />
      {tab === 'friends' ? (
        <FriendsTab friends={friends} reload={load} onAdd={() => setAdding(true)} />
      ) : tab === 'groups' ? (
        <GroupsTab groups={groups} challenges={challenges} hasFriends={!!friends?.some((f) => f.status === 'accepted')} />
      ) : (
        <ActivityTab items={items} setItems={setItems} />
      )}
      <AddFriendSheet open={adding} onClose={() => setAdding(false)} onChanged={load} />
    </Screen>
  );
}

function SecHead({ title }: { title: string }) {
  return (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
      {title}
    </Text>
  );
}

function FriendsTab({ friends, reload, onAdd }: { friends: FriendRow[] | null; reload: () => void; onAdd: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  if (!friends) return null;
  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming);
  const sent = friends.filter((f) => f.status === 'pending' && !f.incoming);
  return (
    <View>
      {incoming.length ? (
        <>
          <SecHead title={t('Friend requests')} />
          <List>
            {incoming.map((f, i) => (
              <ListRow key={f.friendship_id} first={!i}>
                <Avatar id={f.id} name={displayName(f)} size={40} />
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{displayName(f)}</Text>
                  <Text variant="small" color="sec">{`@${f.username}`}</Text>
                </View>
                <Button
                  small
                  title={t('Accept')}
                  onPress={async () => {
                    if (await acceptRequest(f.friendship_id)) toast(t('You and {n} are now friends', { n: displayName(f) }), { icon: 'users' });
                    reload();
                  }}
                />
                <Springy
                  accessibilityLabel={t('Decline')}
                  onPress={async () => {
                    await removeFriendship(f.friendship_id);
                    reload();
                  }}
                  style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={18} color={c.sec} />
                </Springy>
              </ListRow>
            ))}
          </List>
        </>
      ) : null}
      <PartnerCycles />
      {accepted.length ? (
        <>
          <SecHead title={t('Friends')} />
          <List>
            {accepted.map((f, i) => (
              <ListRow key={f.friendship_id} first={!i} onPress={() => router.push({ pathname: '/friend', params: { id: f.id } })}>
                <Avatar id={f.id} name={displayName(f)} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={700} numberOfLines={1}>
                    {displayName(f)}{' '}
                    <Text variant="small" color="sec">{`@${f.username}`}</Text>
                  </Text>
                  <Text variant="small" color="sec" numberOfLines={1}>
                    {f.last_workout && f.last_day ? t('{w}, {d}', { w: t(f.last_workout), d: shortDate(f.last_day, lang) }) : t('No workouts to show')}
                  </Text>
                </View>
                {f.streak ? (
                  <Row gap={2}>
                    <Icon name="flame" size={16} color={c.cobalt} />
                    <Text variant="small" weight={700} num>
                      {f.streak}
                    </Text>
                  </Row>
                ) : null}
                <Icon name="chev" size={18} color={c.sec} />
              </ListRow>
            ))}
          </List>
        </>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="users" size={34} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('No friends yet')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Add friends by their exact username. Train together, cheer each other on and start challenges.')}
          </Text>
          <Button small icon="userplus" title={t('Add a friend')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={onAdd} />
        </Card>
      )}
      {sent.length ? (
        <>
          <SecHead title={t('Requests sent')} />
          <List>
            {sent.map((f, i) => (
              <ListRow key={f.friendship_id} first={!i}>
                <Avatar id={f.id} name={displayName(f)} size={36} />
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{displayName(f)}</Text>
                  <Text variant="small" color="sec">
                    {t('@{u}, waiting', { u: f.username })}
                  </Text>
                </View>
                <Button
                  small
                  kind="soft"
                  title={t('Cancel')}
                  onPress={async () => {
                    await removeFriendship(f.friendship_id);
                    reload();
                  }}
                />
              </ListRow>
            ))}
          </List>
        </>
      ) : null}
      <List>
        <ListRow first onPress={() => router.push('/fprivacy')}>
          <Icon name="lock" size={20} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('What friends can see')}</Text>
            <Text variant="small" color="sec">
              {t('Choose what you share')}
            </Text>
          </View>
          <Icon name="chev" size={18} color={c.sec} />
        </ListRow>
        <ListRow onPress={() => router.push('/together')}>
          <Icon name="users" size={20} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Train together')}</Text>
            <Text variant="small" color="sec">
              {t('One workout, the right sets for each level')}
            </Text>
          </View>
          <Icon name="chev" size={18} color={c.sec} />
        </ListRow>
      </List>
    </View>
  );
}

function GroupsTab({ groups, challenges, hasFriends }: { groups: Group[]; challenges: Challenge[]; hasFriends: boolean }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { today } = useFood();
  const need = () => toast(t('Add a friend first'), { icon: 'info' });
  return (
    <View>
      <SecHead title={t('Groups')} />
      {groups.length ? (
        <List>
          {groups.map((g, i) => (
            <ListRow key={g.id} first={!i} onPress={() => router.push({ pathname: '/group', params: { id: g.id } })}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="users" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text weight={700}>{g.name}</Text>
                <Text variant="small" color="sec">
                  {t('{n} members', { n: g.members })}
                </Text>
              </View>
              <Icon name="chev" size={18} color={c.sec} />
            </ListRow>
          ))}
        </List>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Icon name="users" size={30} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('No groups yet')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Make a group with your gym friends to train and compete together.')}
          </Text>
        </Card>
      )}
      <Button kind="glass" icon="plus" title={t('New group')} onPress={() => (hasFriends ? router.push('/newgroup') : need())} />

      <SecHead title={t('Challenges')} />
      {challenges.map((ch) => {
        const left = daysLeft(ch.end_day, today);
        return (
          <Card key={ch.id} onPress={() => router.push({ pathname: '/challenge', params: { id: ch.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={6}>
                <Icon name="trophy" size={16} color={c.cobalt} />
                <Text variant="xs" weight={700} color="sec">
                  {t('Challenge')}
                </Text>
              </Row>
              <Text variant="small" weight={700} color="sec">
                {left > 0 ? t('{n} days left', { n: left }) : t('Ended {d}', { d: shortDate(ch.end_day, lang) })}
              </Text>
            </Row>
            <Text variant="h3" style={{ marginTop: 8 }}>
              {t(CH_TITLE[ch.kind])}
            </Text>
            <Text variant="small" color="sec">
              {t('{n} people', { n: ch.members })}
            </Text>
          </Card>
        );
      })}
      <Button icon="trophy" title={t('New challenge')} onPress={() => (hasFriends ? router.push('/newchallenge') : need())} />
    </View>
  );
}

function ActivityTab({ items, setItems }: { items: FeedItem[] | null; setItems: (f: FeedItem[]) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  if (!items) return null;
  if (!items.length)
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Icon name="heart" size={30} color={c.sec} />
        <Text variant="h3" style={{ marginTop: 8 }}>
          {t('Nothing here yet')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('When you or your friends finish workouts and hit records, it shows up here.')}
        </Text>
      </Card>
    );
  const text = (a: FeedItem) => {
    if (a.kind === 'workout') return t('finished {w}', { w: t(a.text) });
    if (a.kind === 'pr') return t('hit a new record: {x} {w} kg', { x: a.text, w: String(a.data?.w ?? '') });
    return a.text;
  };
  return (
    <View>
      {items.map((a) => {
        const mine = a.user_id === session?.user.id;
        return (
          <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar id={a.user_id} name={displayName(a)} size={38} />
            <View style={{ flex: 1 }}>
              <Text variant="small">
                <Text variant="small" weight={700}>
                  {mine ? t('You') : displayName(a)}
                </Text>{' '}
                {text(a)}
              </Text>
              <Text variant="xs" color="sec">
                {timeAgo(a.created_at, t, lang)}
                {a.cheers ? `, ${a.cheers === 1 ? t('1 cheer') : t('{n} cheers', { n: a.cheers })}` : ''}
              </Text>
            </View>
            {!mine ? (
              <Button
                small
                kind={a.cheered ? 'cobalt' : 'soft'}
                icon="heart"
                title={t(a.cheered ? 'Cheered' : 'Cheer')}
                onPress={async () => {
                  const on = !a.cheered;
                  setItems(items.map((x) => (x.id === a.id ? { ...x, cheered: on, cheers: x.cheers + (on ? 1 : -1) } : x)));
                  const ok = await cheer(a.id, on);
                  if (ok && on) toast(t('You cheered {n} on. {n} will see it.', { n: displayName(a) }), { icon: 'heart' });
                }}
              />
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

function AddFriendSheet({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ q: string; f: Found | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = q.trim().toLowerCase().replace(/^@/, '');
  const search = async () => {
    if (clean.length < 3) return;
    setBusy(true);
    const f = await findUser(clean);
    setBusy(false);
    setRes({ q: clean, f });
  };
  const r = res?.q === clean ? res : null;
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Add a friend')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Type their full username. For privacy, people can only be found by their exact username.')}
      </Text>
      <Row gap={8} style={{ marginTop: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 14, direction: 'ltr' } as object}>
          <Text weight={700} color="sec" size={16}>
            @
          </Text>
          <UsernameInput value={q} onChange={setQ} onSubmit={search} />
        </View>
        <Button small title={t('Find')} loading={busy} disabled={clean.length < 3} onPress={search} />
      </Row>
      {r ? (
        r.f ? (
          <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar id={r.f.id} name={displayName(r.f)} size={40} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{displayName(r.f)}</Text>
              <Text variant="small" color="sec">{`@${r.f.username}`}</Text>
            </View>
            {r.f.relation === 'self' ? (
              <Text variant="small" color="sec">
                {t('That’s you.')}
              </Text>
            ) : r.f.relation === 'friends' ? (
              <Text variant="small" weight={700} color="up">
                {t('Friends')}
              </Text>
            ) : r.f.relation === 'sent' ? (
              <Text variant="small" weight={700} color="sec">
                {t('Requested')}
              </Text>
            ) : r.f.relation === 'received' ? (
              <Text variant="small" weight={700} color="link">
                {t('Wants to be friends')}
              </Text>
            ) : (
              <Button
                small
                title={t('Add')}
                onPress={async () => {
                  const ok = await sendRequest(r.f!.id);
                  if (ok) {
                    toast(t('Friend request sent to @{u}', { u: r.f!.username }), { icon: 'users' });
                    setRes({ q: clean, f: { ...r.f!, relation: 'sent' } });
                    onChanged();
                  } else toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                }}
              />
            )}
          </Card>
        ) : (
          <Card style={{ marginTop: 12, alignItems: 'center' }}>
            <Text variant="small" color="sec" center>
              {t('No one with the username @{u}. Check the spelling.', { u: clean })}
            </Text>
          </Card>
        )
      ) : null}
      <View style={{ height: 1, backgroundColor: c.line, marginVertical: 16 }} />
      <Row>
        <View style={{ flex: 1 }}>
          <Text variant="small" color="sec">
            {t('Your username')}
          </Text>
          <Text weight={700}>{`@${profile?.username ?? ''}`}</Text>
        </View>
        <Button
          small
          kind="glass"
          icon="copy"
          title={t('Copy')}
          onPress={async () => {
            try {
              await navigator.clipboard.writeText(`@${profile?.username ?? ''}`);
              toast(t('Username copied. Send it to your friends.'), { icon: 'copy' });
            } catch {
              toast(`@${profile?.username ?? ''}`, { icon: 'copy' });
            }
          }}
        />
      </Row>
    </Sheet>
  );
}

function UsernameInput({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const { colors: c } = useSettings();
  const { t } = useT();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.toLowerCase().replace(/[^a-z0-9._@]/g, '').replace(/^@/, ''))}
      onSubmitEditing={onSubmit}
      placeholder={t('username')}
      placeholderTextColor={c.sec}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={20}
      style={{ flex: 1, height: 48, fontSize: 16, color: c.text, marginStart: 2 }}
    />
  );
}
