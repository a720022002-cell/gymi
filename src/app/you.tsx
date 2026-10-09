import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { Button, Label, Segmented, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type ThemePref, useSettings } from '@/theme/settings';

/** "You": profile summary and the settings we need for Phase 1 testing. */
export default function You() {
  const { t } = useT();
  const s = useSettings();
  const c = s.colors;
  const { profile, logOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const name = profile?.name || profile?.username || '';

  return (
    <Screen title={t('You')} back>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="h1" color="#FFFFFF">
            {(name[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <Text variant="h2" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text color="sec">{`@${profile?.username ?? ''}`}</Text>
      </View>

      <Label>{t('Profile')}</Label>
      <List>
        <Item icon="mail" title={t('Email')} value={profile?.email ?? ''} />
        <Item icon="phone" title={t('Phone number')} value={profile?.phone ?? ''} />
        <Item icon="user" title={t('Account type')} value={t(profile?.account_type === 'coach' ? 'Coach (under review)' : 'Member')} />
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

      <Label>{t('Settings')}</Label>
      <List>
        <Item icon="globe" title={t('Language')} value={s.lang === 'ar' ? 'العربية' : 'English'} onPress={() => router.push('/language')} chevron />
        <Item
          icon="sliders"
          title={t('Reduce transparency')}
          sub={t('Turns glass solid. Easier to read.')}
          right={<Toggle value={s.reduceSetting} onChange={s.setReduce} label={t('Reduce transparency')} />}
        />
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
