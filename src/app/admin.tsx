import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ErrorText, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { type AdminStats, adminStats, type AdminUser, adminUsers, coachQueue, type CoachQueueRow, decideCoach, useIsAdmin } from '@/lib/admin';
import { fmt } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

type Tab = 'overview' | 'coaches' | 'users';

/** Gymi team page: numbers, coach applications and users. Only admins can open it (checked on the server too). */
export default function Admin() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const admin = useIsAdmin();
  const [tab, setTab] = useState<Tab>('overview');
  if (!admin)
    return (
      <Screen title={t('Admin')} back>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="lock" size={30} color={c.sec} />
          <Text color="sec" center style={{ marginTop: 8 }}>
            {t('Only the Gymi team can open this page.')}
          </Text>
          <Button small kind="soft" title={t('Go home')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.replace('/home')} />
        </Card>
      </Screen>
    );
  return (
    <Screen title={t('Admin')} back>
      <Segmented<Tab>
        value={tab}
        options={[
          { value: 'overview', label: t('Overview') },
          { value: 'coaches', label: t('Coaches') },
          { value: 'users', label: t('Users') },
        ]}
        onChange={setTab}
      />
      <View style={{ height: 14 }} />
      {tab === 'overview' ? <Overview go={setTab} /> : tab === 'coaches' ? <Coaches /> : <Users />}
    </Screen>
  );
}

function Overview({ go }: { go: (t: Tab) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [s, setS] = useState<AdminStats | null>(null);
  useEffect(() => {
    let alive = true;
    adminStats().then((v) => alive && setS(v));
    return () => {
      alive = false;
    };
  }, []);
  if (!s) return <Thinking message={t('Loading')} />;
  const tiles: [string, number, string][] = [
    ['users', s.users, 'Users'],
    ['userplus', s.new_week, 'New this week'],
    ['bolt', s.active_today, 'Active today'],
    ['coach', s.coaches, 'Approved coaches'],
    ['train', s.workouts_week, 'Workouts this week'],
    ['food', s.meals_week, 'Meals logged this week'],
    ['sparkle', s.ai_today, 'AI requests today'],
  ];
  return (
    <View>
      {s.pending ? (
        <Card onPress={() => go('coaches')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: c.cobalt }}>
          <Icon name="clock" size={22} color={c.cobalt} />
          <Text weight={700} style={{ flex: 1 }}>
            {t('{n} coaches waiting for review', { n: s.pending })}
          </Text>
          <Icon name="chev" size={18} color={c.sec} />
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {tiles.map(([i, v, l]) => (
          <View key={l} style={{ width: '48.5%', backgroundColor: c.card, borderRadius: 20, padding: 14, marginBottom: 10 }}>
            <Icon name={i as never} size={18} color={c.cobalt} />
            <Text num size={24} style={{ marginTop: 6 }}>
              {fmt(Number(v))}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(l)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Coaches() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [list, setList] = useState<CoachQueueRow[] | null>(null);
  const [f, setF] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [open, setOpen] = useState<CoachQueueRow | null>(null);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState('');
  const load = useCallback(async () => setList(await coachQueue()), []);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);
  if (!list) return <Thinking message={t('Loading')} />;
  const rows = list.filter((x) => x.coach_status === f);
  const decide = async (approve: boolean) => {
    if (!open) return;
    if (!approve && !reason.trim()) return;
    const ok = await decideCoach(open.user_id, approve, approve ? undefined : reason.trim());
    toast(ok ? t(approve ? '{n} is now an approved coach' : '{n} was not approved', { n: open.name || open.username }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
    setOpen(null);
    setReject(false);
    setReason('');
    load();
  };
  return (
    <View>
      <Row gap={8} style={{ marginBottom: 12 }}>
        {(['pending', 'approved', 'rejected'] as const).map((k) => (
          <Chip key={k} title={`${t(k === 'pending' ? 'Waiting' : k === 'approved' ? 'Approved' : 'Not approved')} (${list.filter((x) => x.coach_status === k).length})`} on={f === k} onPress={() => setF(k)} />
        ))}
      </Row>
      {rows.length ? (
        <List>
          {rows.map((x, i) => (
            <ListRow key={x.user_id} first={!i} onPress={() => setOpen(x)}>
              <Avatar id={x.user_id} name={x.name || x.username} size={40} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{x.name || x.username}</Text>
                <Text variant="small" color="sec" numberOfLines={1}>
                  {`@${x.username} · ${shortDate((x.applied ?? x.joined).slice(0, 10), lang)}`}
                </Text>
              </View>
              <Icon name="chev" size={18} color={c.sec} />
            </ListRow>
          ))}
        </List>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('Nothing here.')}</Text>
        </Card>
      )}
      <Sheet open={!!open} onClose={() => (setOpen(null), setReject(false))}>
        {open ? (
          <View>
            <Row>
              <Avatar id={open.user_id} name={open.name || open.username} size={48} />
              <View style={{ flex: 1 }}>
                <Text variant="h2">{open.name || open.username}</Text>
                <Text variant="small" color="sec">{`@${open.username}`}</Text>
              </View>
            </Row>
            <Card style={{ marginTop: 12 }}>
              {(
                [
                  ['Email', open.email],
                  ['Phone', open.phone],
                  ['How they coach', open.coach_type],
                  ['Gym', open.gym],
                  ['City', open.city],
                  ['Years coaching', open.years],
                  ['Specialties', open.specialties?.map((s) => t(s)).join(', ')],
                  ['Certificates', open.certs],
                  ['Social media', open.socials ? Object.entries(open.socials).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') : null],
                  ['About', open.bio],
                  ['Reason given', open.reason],
                ] as [string, string | null | undefined][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <View key={k} style={{ marginTop: 8 }}>
                    <Text variant="xs" weight={700} color="sec">
                      {t(k)}
                    </Text>
                    <Text variant="small">{v}</Text>
                  </View>
                ))}
              {!open.app_id ? (
                <Text variant="small" color="sec" style={{ marginTop: 8 }}>
                  {t('Signed up as a coach without filling the application form.')}
                </Text>
              ) : null}
            </Card>
            {reject ? (
              <View>
                <Text weight={700}>{t('Why not? They will see this.')}</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={300}
                  placeholder={t('For example: The certificate photo is not readable. Please upload a clearer copy.')}
                  placeholderTextColor={c.sec}
                  style={{ marginTop: 8, minHeight: 80, borderRadius: 14, backgroundColor: c.card, padding: 12, fontSize: 15, color: c.text, textAlignVertical: 'top' }}
                />
                <ErrorText>{reason.trim() ? null : t('Write a short reason.')}</ErrorText>
                <Button kind="danger" title={t('Send decision')} disabled={!reason.trim()} style={{ marginTop: 8 }} onPress={() => decide(false)} />
              </View>
            ) : (
              <>
                {open.coach_status !== 'approved' ? <Button icon="check" title={t('Approve coach')} onPress={() => decide(true)} /> : null}
                <Button kind="soft" title={t(open.coach_status === 'approved' ? 'Remove coach approval' : 'Don’t approve')} color={c.down} style={{ marginTop: 8 }} onPress={() => setReject(true)} />
              </>
            )}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function Users() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ q: string; list: AdminUser[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => adminUsers(q.trim()).then((list) => alive && setRes({ q, list })), 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [q]);
  return (
    <View>
      <Row gap={8} style={{ height: 48, borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 14, marginBottom: 12 }}>
        <Icon name="search" size={18} color={c.sec} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('Search by name, username or email')} placeholderTextColor={c.sec} autoCapitalize="none" style={{ flex: 1, height: 46, fontSize: 16, color: c.text }} />
      </Row>
      {!res ? (
        <Thinking message={t('Loading')} />
      ) : (
        <List>
          {res.list.map((u, i) => (
            <ListRow key={u.id} first={!i}>
              <Avatar id={u.id} name={u.name || u.username} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight={700} numberOfLines={1}>
                  {u.name || u.username}
                  {u.is_admin ? <Text variant="xs" weight={700} color={c.cobalt}>{`  ${t('Admin')}`}</Text> : null}
                </Text>
                <Text variant="xs" color="sec" numberOfLines={1}>{`@${u.username} · ${u.email ?? ''}`}</Text>
                <Text variant="xs" color="sec">
                  {`${t(u.account_type === 'coach' ? (u.coach_status === 'approved' ? 'Coach' : 'Coach (under review)') : 'Member')} · ${t('Joined {d}', { d: shortDate(u.joined.slice(0, 10), lang) })}${u.last_day ? ` · ${t('Last logged {d}', { d: shortDate(u.last_day, lang) })}` : ''}`}
                </Text>
              </View>
            </ListRow>
          ))}
        </List>
      )}
    </View>
  );
}
