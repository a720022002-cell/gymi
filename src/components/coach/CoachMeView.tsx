import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CoachProfile, getCoachProfile } from '@/lib/coaching';
import { useCoachMode } from '@/lib/coachMode';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Screen } from '../Screen';
import { Avatar } from '../social/Avatar';
import { List, ListRow } from '../social/List';
import { Text } from '../Text';
import { Row } from '../ui';

/** Coach "Me" tab: profile, listing, notifications and switching back to your own training (design: cme). */
export function CoachMeView() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { session, profile } = useAuth();
  const [, setCoachMode] = useCoachMode();
  const [p, setP] = useState<CoachProfile | null>(null);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getCoachProfile(uid).then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, [uid]);
  const name = profile?.name || profile?.username || '';
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
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
        {t('Your coaching')}
      </Text>
      <List>
        {item('edit', t('Coach profile'), t('Bio, gym, specialties and social media'), () => router.push('/cprofile'), true)}
        {item('cart', t('Listing and packages'), p ? t('Up to {n} clients{l}', { n: p.max_clients, l: p.listed ? `, ${t('listed')}` : `, ${t('hidden')}` }) : null, () => router.push('/coffer'))}
        {item('bell', t('Notifications'), t('Requests, messages and quiet clients'), () => router.push('/cnotif'))}
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
