import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type Bro, BRO_LEVELS, broLevel, cachedLook, groupBros, groupPct, loadMyLook, myCrew, rememberLook, saveMyBro } from '@/lib/bro';
import type { Group } from '@/lib/social';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Card, Row, Springy } from '../ui';
import { GymBro } from './GymBro';

/** You, from what's on this phone: your 30-day commitment (saved so friends see the same) and your character's look. */
function useMe() {
  const { session, profile } = useAuth();
  const pct = useStreaks().c30.pct;
  const uid = session?.user.id;
  const [look, setLook] = useState<unknown>(() => cachedLook(uid));
  useEffect(() => {
    if (uid) saveMyBro(uid, pct).catch(() => {});
  }, [uid, pct]);
  // Read again on coming back (after dressing it).
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      const have = cachedLook(uid);
      if (have !== undefined) setLook(have);
      else loadMyLook(uid).then(setLook).catch(() => {});
    }, [uid]),
  );
  return { uid, pct, look, female: profile?.gender === 'female', username: profile?.username ?? '' };
}

/** "Customize": dress your character. */
function Customize() {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Springy onPress={() => router.push('/bro-edit')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: c.inset }}>
      <Icon name="edit" size={14} color={c.cobalt} />
      <Text variant="small" weight={700} color={c.cobalt}>
        {t('Customize')}
      </Text>
    </Springy>
  );
}

const pctText = (p: number | null) => (p == null ? '–' : `${p}%`);

/** Above "Gym Bros" on Friends and Activity: you and your friends as cartoons that get stronger with commitment. */
export function CrewBox({ onAdd }: { onAdd: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const me = useMe();
  const [crew, setCrew] = useState<Bro[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      myCrew().then((x) => {
        if (!alive) return;
        setCrew(x);
        const mine = x?.find((b) => b.user_id === me.uid);
        if (me.uid && mine?.look) rememberLook(me.uid, mine.look);
      });
      return () => {
        alive = false;
      };
    }, [me.uid]),
  );
  // You first (with today's number), then friends by commitment.
  const friends = (crew ?? []).filter((x) => x.user_id !== me.uid).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  const people: Bro[] = [{ user_id: me.uid ?? 'me', username: me.username, name: null, gender: me.female ? 'female' : 'male', pct: me.pct, look: me.look ?? crew?.find((b) => b.user_id === me.uid)?.look }, ...friends];
  const lvl = broLevel(me.pct);
  return (
    <Card style={{ marginBottom: 6 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text weight={700}>{t('Your crew')}</Text>
        <Customize />
      </Row>
      <Text variant="small" color="sec">
        {lvl ? t('You’re level {n}: {l}. Stay committed and your character gets stronger.', { n: lvl, l: t(BRO_LEVELS[lvl - 1]) }) : t('Stay committed and your character gets stronger.')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingTop: 12, alignItems: 'flex-end', flexGrow: 1, justifyContent: friends.length < 3 ? 'center' : 'flex-start' }}>
        {people.map((p, i) => (
          <Springy
            key={p.user_id}
            onPress={() => (i ? router.push({ pathname: '/friend', params: { id: p.user_id } }) : router.push({ pathname: '/progress', params: { tab: 'streaks', sub: '0' } }))}
            accessibilityRole="button"
            accessibilityLabel={`${p.name || p.username}, ${pctText(p.pct)}`}
            style={{ alignItems: 'center' }}>
            <GymBro pct={p.pct} female={p.gender === 'female'} look={p.look} username={p.username} height={i ? 150 : 175} />
            <Text variant="xs" weight={700} color={i ? 'text' : c.cobalt} style={{ marginTop: 4 }}>
              {i ? pctText(p.pct) : `${t('You')} · ${pctText(p.pct)}`}
            </Text>
          </Springy>
        ))}
        {friends.length ? null : (
          <Springy onPress={onAdd} accessibilityRole="button" accessibilityLabel={t('Add a friend')} style={{ alignItems: 'center', justifyContent: 'center', width: 96, height: 120, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line }}>
            <Icon name="userplus" size={22} color={c.sec} />
            <Text variant="xs" weight={700} color="sec" center style={{ marginTop: 6 }}>
              {t('Add friends to see them here')}
            </Text>
          </Springy>
        )}
      </ScrollView>
    </Card>
  );
}

/** A group as a ring: it fills with the members' average commitment. */
function GroupRing({ g, pct, size }: { g: Group; pct: number | null; size: number }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const sw = 7;
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  return (
    <Springy onPress={() => router.push({ pathname: '/group', params: { id: g.id } })} accessibilityRole="button" accessibilityLabel={`${g.name}, ${pctText(pct)}`} style={{ alignItems: 'center', width: size }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill={c.inset} stroke={c.line} strokeWidth={sw} />
          {pct ? <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.cobalt} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
        </Svg>
        <Icon name="users" size={20} color={c.cobalt} />
        <Text weight={700} center numberOfLines={2} style={{ fontSize: 13, marginTop: 4, paddingHorizontal: 14 }}>
          {g.name}
        </Text>
        <Text variant="xs" color="sec">
          {t('{n} members', { n: g.members })}
        </Text>
      </View>
      <Text variant="xs" weight={700} color="sec" style={{ marginTop: 6 }}>
        {t('Group {n}', { n: pctText(pct) })}
      </Text>
    </Springy>
  );
}

/** Above "Gym Bros" on Groups: your character next to the groups you're in, each filled with its members' commitment. */
export function GroupBox({ groups, hasFriends, onAdd }: { groups: Group[]; hasFriends: boolean; onAdd: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const me = useMe();
  const ids = groups.map((g) => g.id).join(',');
  const [avg, setAvg] = useState<Record<string, number | null>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(ids ? ids.split(',').map(async (id) => [id, await groupBros(id)] as const) : []).then((rows) => {
      if (alive) setAvg(Object.fromEntries(rows.map(([id, xs]) => [id, xs ? groupPct(xs) : null])));
    });
    return () => {
      alive = false;
    };
  }, [ids]);
  return (
    <Card style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <GymBro pct={me.pct} female={me.female} look={me.look} username={me.username} height={175} />
        <Text variant="xs" weight={700} color={c.cobalt} style={{ marginTop: 4 }}>{`${t('You')} · ${pctText(me.pct)}`}</Text>
        <View style={{ marginTop: 8 }}>
          <Customize />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        {groups.length ? (
          groups.map((g) => <GroupRing key={g.id} g={g} pct={avg[g.id] ?? null} size={groups.length > 1 ? 112 : 132} />)
        ) : (
          <Springy onPress={() => (hasFriends ? router.push('/newgroup') : onAdd())} accessibilityRole="button" accessibilityLabel={t('New group')} style={{ alignItems: 'center', justifyContent: 'center', width: 132, height: 132, borderRadius: 66, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line }}>
            <Icon name="plus" size={22} color={c.sec} />
            <Text variant="xs" weight={700} color="sec" center style={{ marginTop: 6, paddingHorizontal: 10 }}>
              {t(hasFriends ? 'Make a group' : 'Add a friend first')}
            </Text>
          </Springy>
        )}
      </ScrollView>
    </Card>
  );
}
