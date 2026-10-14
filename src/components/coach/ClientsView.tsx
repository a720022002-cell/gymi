import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, NavButton, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  activePackages,
  type ClientLink,
  coachInvite,
  coachList,
  type CoachNotif,
  type CoachProfile,
  coachRanking,
  coachRespond,
  getCoachNotif,
  getCoachProfile,
  isNewClient,
  listMealPlans,
  listPrograms,
  lowLine,
  type MealPlan,
  type Program,
  rankClients,
  type RankRow,
} from '@/lib/coaching';
import { syncCoachAlerts } from '@/lib/coachNotify';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

import { CommitValue, Medal } from './Commit';
import { InviteSheet } from './Invite';

const HIDE_START = 'gymi.coachStart.hidden.v1';
const nowMs = () => Date.now();
const daysSince = (day: string | null, now: number) => (day ? Math.floor((now - new Date(`${day}T12:00:00`).getTime()) / 864e5) : 999);

type Data = { list: ClientLink[]; rank: RankRow[]; progs: Program[]; meals: MealPlan[]; prof: CoachProfile | null; notif: CoachNotif; hide: boolean; now: number };

/** Coach: clients ranked by commitment, who needs attention, invites and new requests (design: clients). */
export function ClientsView({ tab }: { tab?: boolean }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session } = useAuth();
  const uid = session?.user.id;
  const approved = profile?.account_type === 'coach' && profile.coach_status === 'approved';
  const [d, setD] = useState<Data | null>(null);
  const [f, setF] = useState<'rank' | 'need' | 'inv'>('rank');
  const [invite, setInvite] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const [list, rank, progs, meals, prof, notif, hide] = await Promise.all([
      coachList(),
      coachRanking(),
      listPrograms(),
      listMealPlans(),
      getCoachProfile(uid),
      getCoachNotif(),
      AsyncStorage.getItem(HIDE_START).catch(() => null),
    ]);
    setD({ list, rank, progs, meals, prof, notif, hide: hide === '1', now: nowMs() });
    return notif;
  }, [uid]);
  useFocusEffect(
    useCallback(() => {
      if (!approved) return;
      load().then((n) => {
        if (n)
          syncCoachAlerts(n, {
            dailyTitle: t('Daily summary'),
            dailyBody: t('See who trained and who logged food today.'),
            weeklyTitle: t('Weekly ranking'),
            weeklyBody: t('Your clients ranked by commitment this week.'),
          }).catch(() => {});
      });
    }, [approved, load, t]),
  );

  if (!approved)
    return (
      <Screen title={t('Clients')} back={!tab} large={tab} tabs={tab}>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="clock" size={30} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('Coach application under review')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Once our team approves you, you can invite clients here. You can fill in your coach profile now.')}
          </Text>
          <Button small title={t('Edit coach profile')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.push('/cprofile')} />
        </Card>
      </Screen>
    );

  const newInvite = async () => {
    const code = await coachInvite();
    if (!code) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    await load();
    const l = (await coachList()).find((x) => x.code === code);
    if (l) setInvite(l.id);
  };
  const right = <NavButton icon="plus" label={t('Add a client')} onPress={newInvite} />;
  if (!d)
    return (
      <Screen title={t('Clients')} back={!tab} large={tab} tabs={tab} right={right}>
        <Thinking message={t('Loading')} />
      </Screen>
    );

  const { list, rank, now, notif } = d;
  const byLink = new Map(list.map((x) => [x.id, x]));
  const req = list.filter((x) => x.status === 'requested');
  const inv = list.filter((x) => x.status === 'invited');
  const act = list.filter((x) => x.status === 'active');
  const ranked = rankClients(rank, now);
  const old = ranked.filter((r) => !isNewClient(r, now) && r.commit != null);
  const avg = old.length ? Math.round(old.reduce((a, r) => a + (r.commit ?? 0), 0) / old.length) : 0;
  const th = lowLine(notif);
  const noFood = (r: RankRow) => notif.on && notif.nofood.on && !isNewClient(r, now) && daysSince(r.last_food, now) >= notif.nofood.n;
  const low = old.filter((r) => (r.commit ?? 0) < th);
  const need = ranked.filter((r) => low.includes(r) || noFood(r));
  const nameOf = (r: RankRow) => {
    const l = byLink.get(r.link_id);
    return l?.name || l?.username || '?';
  };
  const welcome = ranked.filter((r) => isNewClient(r, now) && !r.welcomed);
  const max = d.prof?.max_clients ?? 20;
  const full = act.length >= max;
  const steps: [boolean, string, string, () => void][] = [
    [!!d.prof && (activePackages(d.prof.packages).length > 0 || !!d.prof.headline), t('Set up your page and packages'), t('So clients can find and join you'), () => router.push('/coffer')],
    [d.progs.length > 0, t('Make your first program'), t('A workout plan you can send to clients'), () => router.push('/cprog')],
    [list.length > 0, t('Invite your first client'), t('Send them a sign-up code'), newInvite],
  ];
  const done = steps.filter((s) => s[0]).length;
  const rows = f === 'rank' ? ranked : f === 'need' ? need : [];
  const coachName = profile?.name || profile?.username || '';
  const invLink = invite ? (byLink.get(invite) ?? null) : null;

  return (
    <Screen title={t('Clients')} back={!tab} large={tab} tabs={tab} right={right}>
      {!d.hide && done < 3 ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Get started as a coach')}</Text>
            <Text variant="xs" weight={700} color="sec">
              {t('{a} of {b}', { a: done, b: 3 })}
            </Text>
          </Row>
          {steps.map(([ok, title, sub, go], i) => (
            <Springy key={title} accessibilityLabel={title} onPress={go} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? c.cobalt : 'transparent', borderWidth: ok ? 0 : 2, borderColor: c.line }}>
                {ok ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : <Text variant="xs" weight={700} color="sec">{`${i + 1}`}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="small" weight={700} color={ok ? 'sec' : 'text'} style={ok ? { textDecorationLine: 'line-through' } : undefined}>
                  {title}
                </Text>
                <Text variant="xs" color="sec">
                  {sub}
                </Text>
              </View>
              {ok ? null : <Icon name="chev" size={16} color={c.sec} />}
            </Springy>
          ))}
          <Button
            small
            kind="ghost"
            title={t('Hide this')}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              AsyncStorage.setItem(HIDE_START, '1').catch(() => {});
              setD({ ...d, hide: true });
            }}
          />
        </Card>
      ) : null}
      {req.map((x) => (
        <Card key={x.id}>
          <Row>
            <Avatar id={x.client_id ?? x.id} name={x.name || x.username || '?'} size={40} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('{n} wants to join', { n: x.name || x.username || '' })}</Text>
              <Text variant="small" color="sec">
                {x.package ? t('{p} package', { p: t(x.package) }) : `@${x.username}`}
              </Text>
            </View>
          </Row>
          <Row gap={8} style={{ marginTop: 10 }}>
            <Button
              small
              title={t('Accept')}
              style={{ flex: 1 }}
              onPress={async () => {
                if (!(await coachRespond(x.id, true))) toast(t(full ? 'All your spots are full. Add spots in Listing and packages first.' : 'They already joined another coach.'), { icon: 'info' });
                load();
              }}
            />
            <Button
              small
              kind="soft"
              title={t('Decline')}
              style={{ flex: 1 }}
              onPress={async () => {
                await coachRespond(x.id, false);
                load();
              }}
            />
          </Row>
        </Card>
      ))}
      {welcome.map((r) => {
        const l = byLink.get(r.link_id);
        return (
          <Card key={r.link_id} onPress={() => router.push({ pathname: '/thread', params: { link: r.link_id, name: nameOf(r), client: r.client_id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="users" size={20} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(l?.package ? '{n} subscribed' : '{n} joined', { n: nameOf(r) })}</Text>
              <Text variant="small" color="sec">
                {l?.package ? t('{p} package. Tap to welcome them.', { p: t(l.package) }) : t('Joined with your code. Tap to welcome them.')}
              </Text>
            </View>
            <Icon name="chev" size={18} color={c.sec} />
          </Card>
        );
      })}
      <Springy accessibilityLabel={t('Listing and packages')} onPress={() => router.push('/coffer')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 4, marginBottom: 10 }}>
        <Icon name="users" size={14} color={full ? c.down : c.cobalt} />
        <Text variant="small" weight={700}>
          {t('{a} of {b} spots used', { a: act.length, b: max })}
          {full ? t(', hidden from Find a coach') : ''}
        </Text>
        <Icon name="chev" size={14} color={c.sec} />
      </Springy>
      <Row gap={8}>
        {(
          [
            [String(act.length), t('Active clients'), false],
            [`${avg}%`, t('Avg commitment'), false],
            [String(need.length), t('Need attention'), need.length > 0],
          ] as [string, string, boolean][]
        ).map(([a, b, warn]) => (
          <View key={b} style={{ flex: 1, backgroundColor: c.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' }}>
            <Text num size={22} color={warn ? c.down : 'text'}>
              {a}
            </Text>
            <Text variant="xs" weight={700} color="sec" center>
              {b}
            </Text>
          </View>
        ))}
      </Row>
      {low.length ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
          <Icon name="warn" size={20} color={c.down} />
          <Text variant="small" style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {low.slice(0, 3).map(nameOf).join(t(' and '))}
            </Text>
            {` ${t(low.length > 1 ? 'are under {n}% this month. A quick message helps.' : 'is under {n}% this month. A quick message helps.', { n: th })}`}
          </Text>
        </Card>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <Segmented<'rank' | 'need' | 'inv'>
          value={f}
          options={[
            { value: 'rank', label: t('Ranking') },
            { value: 'need', label: t('Need attention') },
            { value: 'inv', label: t('Invited ({n})', { n: inv.length }) },
          ]}
          onChange={setF}
        />
      </View>
      {f === 'rank' ? (
        <Text variant="xs" color="sec" style={{ marginHorizontal: 4, marginTop: 10 }}>
          {t('Ranked by commitment over the last 30 days: workouts, calories, protein, water and sleep.')}
        </Text>
      ) : null}
      <View style={{ height: 10 }} />
      {f !== 'inv' ? (
        rows.length ? (
          <List>
            {rows.map((r, i) => {
              const l = byLink.get(r.link_id);
              const isNew = isNewClient(r, now);
              const lastDay = [r.last_food, r.last_workout].filter(Boolean).sort().at(-1) ?? null;
              const sub =
                f === 'need' && noFood(r)
                  ? t('No food logged for {n} days', { n: Math.min(daysSince(r.last_food, now), 99) })
                  : lastDay
                    ? t('Last logged {d}', { d: shortDate(lastDay, lang) })
                    : t('Nothing logged yet');
              return (
                <ListRow key={r.link_id} first={!i} onPress={() => router.push({ pathname: '/client', params: { link: r.link_id, id: r.client_id } })}>
                  {f === 'rank' ? <Medal i={i} /> : null}
                  <Avatar id={r.client_id} name={nameOf(r)} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Row gap={6}>
                      <Text weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {nameOf(r)}
                      </Text>
                      {r.todos ? (
                        <View style={{ backgroundColor: c.inset, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text size={10} weight={700}>
                            {t('{n} to-do', { n: r.todos })}
                          </Text>
                        </View>
                      ) : null}
                    </Row>
                    <Text variant="xs" color="sec" numberOfLines={1}>
                      {l?.package ? `${t(l.package)} · ${sub}` : sub}
                    </Text>
                  </View>
                  {isNew || r.commit == null ? (
                    <Text variant="xs" weight={700} color={c.cobalt}>
                      {t('New')}
                    </Text>
                  ) : (
                    <CommitValue v={r.commit} trend={r.prev != null ? r.commit - r.prev : null} />
                  )}
                </ListRow>
              );
            })}
          </List>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text variant="small" color="sec" center>
              {f === 'need' ? t('Everyone is above {n}%. Nice.', { n: th }) : t('No clients yet. Tap + to make an invite code and send it to a client.')}
            </Text>
          </Card>
        )
      ) : inv.length ? (
        <List>
          {inv.map((x, i) => (
            <ListRow key={x.id} first={!i} onPress={() => router.push({ pathname: '/client', params: { link: x.id, id: '' } })}>
              <Icon name="key" size={18} color={c.cobalt} />
              <View style={{ flex: 1 }}>
                <Text num weight={700} style={{ letterSpacing: 1 }}>
                  {x.code}
                </Text>
                <Text variant="xs" color="sec">
                  {t('Code {c}, waiting to join', { c: x.code ?? '' })}
                </Text>
              </View>
              <Text variant="xs" weight={700} color="sec">
                {t('Invited')}
              </Text>
              <Icon name="chev" size={16} color={c.sec} />
            </ListRow>
          ))}
        </List>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text variant="small" color="sec" center>
            {t('No pending invites.')}
          </Text>
        </Card>
      )}
      <Button kind="glass" icon="plus" title={t('Invite a client')} style={{ marginTop: 4 }} onPress={newInvite} />
      <InviteSheet link={invLink} coach={coachName} progs={d.progs} meals={d.meals} onChange={load} onClose={() => setInvite(null)} />
    </Screen>
  );
}

export default function Clients() {
  return <ClientsView />;
}
