import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { Button, Label, Segmented, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useIsAdmin } from '@/lib/admin';
import { useCoachMode } from '@/lib/coachMode';
import { useAuth } from '@/lib/auth';
import { type Application, myApplication } from '@/lib/coaching';
import { useFood } from '@/lib/food';
import { type MyInvite, myInvite, REF_GOAL } from '@/lib/invites';
import { RAMADAN_SWITCH } from '@/lib/nutrition';
import { DEFAULT_PREFS, loadPrefs, notifSummary, type Prefs } from '@/lib/reminders';
import { type ThemePref, useSettings } from '@/theme/settings';

/** "You": profile summary and the settings we need for Phase 1 testing. */
export default function You() {
  const { t } = useT();
  const s = useSettings();
  const c = s.colors;
  const { profile, logOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const admin = useIsAdmin();
  const food = useFood();
  const [, setCoachMode] = useCoachMode();
  const name = profile?.name || profile?.username || '';
  const uid = profile?.id;
  const [inv, setInv] = useState<MyInvite | null>(null);
  const [np, setNp] = useState<Prefs>(DEFAULT_PREFS);
  const [app, setApp] = useState<Application | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      myInvite().then((v) => alive && setInv(v));
      loadPrefs(uid).then((v) => alive && setNp(v));
      myApplication().then((v) => alive && setApp(v));
      return () => {
        alive = false;
      };
    }, [uid]),
  );
  const inRound = inv ? (inv.count % REF_GOAL === 0 && inv.count ? REF_GOAL : inv.count % REF_GOAL) : 0;

  return (
    <Screen title={t('You')} back>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Avatar id={uid ?? ''} name={name} size={80} url={profile?.avatar_url ?? null} />
        <Text variant="h2" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text color="sec">{`@${profile?.username ?? ''}`}</Text>
      </View>

      <Label>{t('Profile')}</Label>
      <List>
        <Item icon="trophy" title={t('Your profile')} sub={t('Badges and records friends see')} onPress={() => router.push('/profile')} chevron />
        <Item icon="lock" title={t('Account details')} sub={t('Name, username, email, phone, password')} onPress={() => router.push('/account')} chevron />
        <Item
          icon="key"
          title={t('Your invite code')}
          sub={inv?.code ? t('{c}, {a} of {b} friends joined', { c: inv.code, a: inRound, b: REF_GOAL }) : t('Get a free month for every {n} friends', { n: REF_GOAL })}
          onPress={() => router.push('/invite')}
          chevron
        />
        <Item icon="mail" title={t('Email')} value={profile?.email ?? ''} />
        <Item icon="phone" title={t('Phone number')} value={profile?.phone ?? ''} />
        <Item icon="user" title={t('Account type')} value={t(profile?.account_type === 'coach' ? 'Coach (under review)' : 'Member')} />
      </List>

      {admin ? (
        <>
          <Label>{t('Gymi team')}</Label>
          <List>
            <Item icon="key" title={t('Admin')} sub={t('Coach approvals, users and numbers')} onPress={() => router.push('/admin')} chevron />
          </List>
        </>
      ) : null}

      {profile?.account_type === 'coach' ? (
        <>
          <Label>{t('Coaching')}</Label>
          <List>
            {profile.coach_status === 'approved' ? (
              <Item icon="users" title={t('Open the coach view')} sub={t('Clients, programs and messages')} onPress={() => (setCoachMode(true), router.replace('/cclients'))} chevron />
            ) : (
              <Item
                icon="clock"
                title={t('Coach application')}
                sub={!app && profile.coach_status === 'pending' ? t('Not sent yet. Finish it now.') : t(profile.coach_status === 'rejected' ? 'Not approved. See why.' : 'Under review')}
                onPress={() => router.push(!app && profile.coach_status === 'pending' ? '/coachapply' : '/coachapp')}
                chevron
              />
            )}
            <Item icon="coach" title={t('Coach profile')} onPress={() => router.push('/cprofile')} chevron />
          </List>
        </>
      ) : (
        <>
          <Label>{t('Coaching')}</Label>
          <List>
            <Item icon="coach" title={t('My coach')} sub={t('Find a coach or enter a code')} onPress={() => router.push('/mycoach')} chevron />
          </List>
        </>
      )}

      <Label>{t('Health')}</Label>
      <List>
        {profile?.gender === 'female' ? <Item icon="drop" title={t('Cycle')} sub={t('Private. Never shared.')} onPress={() => router.push('/period')} chevron /> : null}
        <Item icon="pill" title={t('Vitamins and supplements')} onPress={() => router.push('/vitamins')} chevron />
        <Item icon="doc" title={t('Blood tests')} onPress={() => router.push('/blood')} chevron />
        <Item icon="share" title={t('Reports')} onPress={() => router.push('/report')} chevron />
      </List>

      <Label>{t('Gym Bros')}</Label>
      <List>
        <Item icon="lock" title={t('What friends can see')} onPress={() => router.push('/fprivacy')} chevron />
      </List>

      <Label>{t('App')}</Label>
      <List>
        <Item icon="heart" title={t('Your readings')} sub={t('Steps, sleep, weight and devices')} onPress={() => router.push('/devices')} chevron />
        <Item icon="bell" title={t('Notifications')} value={notifSummary(np, t)} onPress={() => router.push('/notifications')} chevron />
        <Item icon="star" title={t('Subscription')} value={t('Free plan')} onPress={() => router.push('/subscription')} chevron />
      </List>

      <Label>{t('Theme')}</Label>
      <Segmented<ThemePref>
        value={s.theme}
        options={[
          { value: 'light', label: t('Light') },
          { value: 'dark', label: t('Dark') },
          { value: 'system', label: t('System') },
        ]}
        onChange={s.setTheme}
      />

      <Label>{t('Gym weights')}</Label>
      <Segmented<'kg' | 'lb'>
        value={s.unit}
        options={[
          { value: 'kg', label: t('Kilograms (kg)') },
          { value: 'lb', label: t('Pounds (lb)') },
        ]}
        onChange={s.setUnit}
      />

      <Label>{t('Settings')}</Label>
      <List>
        <Item icon="globe" title={t('Language')} value={s.lang === 'ar' ? 'العربية' : 'English'} onPress={() => router.push('/language')} chevron />
        {RAMADAN_SWITCH ? (
          <Item
            icon="moon"
            title={t('Ramadan mode')}
            sub={t('Meals and water around iftar and suhoor')}
            right={<Toggle value={!!food.plan.ramadan} onChange={(v) => food.updatePlan({ ramadan: v })} label={t('Ramadan mode')} />}
          />
        ) : null}
        <Item
          icon="sliders"
          title={t('Reduce transparency')}
          sub={t('Turns glass solid. Easier to read.')}
          right={<Toggle value={s.reduceSetting} onChange={s.setReduce} label={t('Reduce transparency')} />}
        />
      </List>

      <Label>{t('Account')}</Label>
      <List>
        <Item icon="key" title={t('Privacy and data')} sub={t('Download or delete your data')} onPress={() => router.push('/privacy')} chevron />
        <Item icon="doc" title={t('Privacy policy')} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} chevron />
        <Item icon="book" title={t('Terms of use')} onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} chevron />
      </List>

      <Button title={t('Log out')} kind="soft" color={c.down} style={{ marginTop: 16 }} onPress={() => setConfirm(true)} />

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2" center>
          {t('Log out?')}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('Your data stays safe in your account.')}
        </Text>
        <Button
          title={t('Log out')}
          kind="danger"
          style={{ marginTop: 16 }}
          onPress={async () => {
            setConfirm(false);
            await logOut();
            router.replace('/welcome');
          }}
        />
        <Button title={t('Cancel')} kind="ghost" style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
      <Text variant="xs" color="sec" center style={{ marginTop: 16 }}>
        {`Gymi ${Constants.expoConfig?.version ?? '1.0.0'}`}
      </Text>
    </Screen>
  );
}

function List({ children }: { children: ReactNode }) {
  const { colors: c } = useSettings();
  return <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>{children}</View>;
}

function Item({
  icon,
  title,
  sub,
  value,
  right,
  onPress,
  chevron,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const { colors: c } = useSettings();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 16 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={700}>{title}</Text>
        {sub ? (
          <Text variant="xs" color="sec">
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" color="sec" numberOfLines={1} style={{ maxWidth: '50%', writingDirection: 'ltr' } as object}>
          {value}
        </Text>
      ) : null}
      {right}
      {chevron ? <Icon name="chev" size={16} color={c.sec} /> : null}
    </Pressable>
  );
}
