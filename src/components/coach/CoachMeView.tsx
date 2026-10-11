import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type ClientLink, coachList, type CoachNotif, type CoachProfile, getCoachNotif, getCoachProfile } from '@/lib/coaching';
import { useCoachMode } from '@/lib/coachMode';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Screen } from '../Screen';
import { Avatar } from '../social/Avatar';
import { List, ListRow } from '../social/List';
import { Text } from '../Text';
import { Button, Row } from '../ui';
import { hoursText } from './GymHours';
import { SocialRow } from './Socials';

/** Coach "Me" tab: profile, listing, notifications and switching back to your own training (design: cme). */
export function CoachMeView() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const { session, profile } = useAuth();
  const [, setCoachMode] = useCoachMode();
  const [p, setP] = useState<CoachProfile | null>(null);
  const [l, setL] = useState<ClientLink[]>([]);
  const [n, setN] = useState<CoachNotif | null>(null);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    Promise.all([getCoachProfile(uid), coachList(), getCoachNotif()]).then(([v, list, nt]) => {
      if (!alive) return;
      setP(v);
      setL(list);
      setN(nt);
    });
    return () => {
      alive = false;
    };
  }, [uid]);
  const name = profile?.name || profile?.username || '';
  const used = l.filter((x) => x.status === 'active').length;
  const notifSummary = !n
    ? null
    : !n.on
      ? t('Off')
      : t('{n} of 11 on', { n: [n.msgs, n.meet, n.prs, n.join, n.gymi, n.low.on, n.missed.on, n.nofood.on, n.weight.on, n.daily.on, n.weekly.on].filter(Boolean).length });
  const item = (icon: IconName, title: string, sub: string | null, onPress: () => void, first?: boolean) => (
    <ListRow first={first} onPress={onPress}>
      <Icon name={icon} size={20} />
      <View style={{ flex: 1 }}>
        <Text weight={700}>{title}</Text>
        {sub ? (
          <Text variant="small" color="sec">
            {sub}
          </Text>
        ) : null}
      </View>
      <Icon name="chev" size={16} color={c.sec} />
    </ListRow>
  );
  return (
    <Screen title={t('Me')} large tabs>
      <View style={{ alignItems: 'center', marginBottom: 12 }}>
        <Avatar id={uid ?? 'me'} name={name} size={80} />
        <Text variant="h2" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text variant="small" color="sec">
          {p ? t(p.coach_type === 'Online' ? 'Online coach' : p.coach_type === 'Both' ? 'In person and online' : 'Personal coach') : t('Coach')}
          {p?.gym ? `, ${p.gym}` : ''}
        </Text>
        {p?.specialties.length ? (
          <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {p.specialties.map((s) => (
              <View key={s} style={{ backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text variant="xs" weight={700}>
                  {t(s)}
                </Text>
              </View>
            ))}
          </Row>
        ) : null}
        {p?.bio ? (
          <Text variant="small" center style={{ marginTop: 8, maxWidth: 300 }}>
            {p.bio}
          </Text>
        ) : (
          <Button small kind="ghost" icon="edit" title={t('Add a bio')} style={{ marginTop: 4, alignSelf: 'center' }} onPress={() => router.push('/cprofile')} />
        )}
        <SocialRow value={p?.socials} center />
        {p && p.coach_type !== 'Online' && p.hours?.length ? (
          <Row gap={6} style={{ marginTop: 8, justifyContent: 'center' }}>
            <Icon name="clock" size={14} color={c.sec} />
            <Text variant="small" color="sec">
              {t('At the gym: {h}', { h: hoursText(p.hours, t, lang) })}
            </Text>
          </Row>
        ) : null}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
        {t('Your coaching')}
      </Text>
      <List>
        {item('edit', t('Coach profile'), t('Photo, bio, gym and specialties'), () => router.push('/cprofile'), true)}
        {item('cart', t('Listing and packages'), p ? `${t('{a} of {b} spots', { a: used, b: p.max_clients })}${p.listed && used < p.max_clients ? t(', listed') : t(', hidden')}` : null, () => router.push('/coffer'))}
        {item('key', t('Invite codes'), t('{n} waiting to join', { n: l.filter((x) => x.status === 'invited').length }), () => router.push('/cclients'))}
        {item('bell', t('Notifications'), notifSummary, () => router.push('/cnotif'))}
      </List>
      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
        {t('App')}
      </Text>
      <List>
        {item('train', t('Switch to my own training'), t('Use Gymi as a member too'), () => {
          setCoachMode(false);
          router.replace('/home');
        }, true)}
        {item('gear', t('Settings'), t('Theme, language, account'), () => router.push('/you'))}
      </List>
    </Screen>
  );
}
