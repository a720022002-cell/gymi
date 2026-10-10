import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { BadgeIcon } from '@/components/progress/Streaks';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { badgeLevel } from '@/lib/progress';
import { getShowcase, saveShowcase, type Showcase } from '@/lib/social';
import { useTrain } from '@/lib/train';
import { EX } from '@/lib/training';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

const LVN = ['Locked', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

/** Your profile: what friends see, with up to 3 badges and 5 records you pick (design: profile). */
export default function Profile() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session } = useAuth();
  const uid = session?.user.id ?? '';
  const train = useTrain();
  const s = useStreaks();
  const [sc, setSc] = useState<Showcase | null>(null);
  const [pick, setPick] = useState<'badges' | 'prs' | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      getShowcase(uid).then((v) => alive && setSc(v));
      return () => {
        alive = false;
      };
    }, [uid]),
  );
  const name = profile?.name || profile?.username || '';
  const exName = (id: string) => (EX[id] ? (lang === 'ar' ? EX[id].ar : EX[id].en) : (train.logs.flatMap((l) => l.exercises).find((x) => x.id === id)?.n ?? id));
  const unlocked = s.badges.filter((b) => badgeLevel(b) > 0);
  const records = Object.entries(train.best).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  const cur = sc ?? { badges: [], prs: [] };
  // Keep pinned badges up to date with your real level.
  const shown = cur.badges.map((b) => s.badges.find((x) => x.id === b.id) ?? null).filter(Boolean) as typeof s.badges;

  const save = async () => {
    const next: Showcase =
      pick === 'badges'
        ? { ...cur, badges: sel.map((id) => s.badges.find((b) => b.id === id)!).filter(Boolean).map((b) => ({ id: b.id, name: b.name, icon: b.icon, level: badgeLevel(b), tiers: b.tiers, v: b.v, unit: b.unit })) }
        : { ...cur, prs: sel.map((id) => ({ id, n: exName(id), w: train.best[id] })) };
    setSc(next);
    setPick(null);
    toast((await saveShowcase(uid, next)) ? t(pick === 'badges' ? 'Badges updated on your profile' : 'Records updated on your profile') : t('Couldn’t save. Please try again.'), { icon: 'trophy' });
  };

  return (
    <Screen title={t('Profile')} back>
      <View style={{ alignItems: 'center' }}>
        <Avatar id={uid} name={name} size={84} />
        <Text variant="h1" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text weight={700} color="sec">{`@${profile?.username ?? ''}`}</Text>
        {s.overall ? (
          <Row gap={4} style={{ marginTop: 4 }}>
            <Icon name="flame" size={16} color={c.cobalt} />
            <Text variant="small" color="sec">
              {t('{n}-day streak', { n: s.overall })}
            </Text>
          </Row>
        ) : null}
      </View>
      <Row style={{ justifyContent: 'space-between', marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        <Text variant="h3">{t('Badges')}</Text>
        <Button small kind="ghost" title={t('Edit')} onPress={() => (setSel(cur.badges.map((b) => b.id)), setPick('badges'))} />
      </Row>
      {shown.length ? (
        <Row gap={16} style={{ justifyContent: 'center' }}>
          {shown.map((b) => (
            <View key={b.id} style={{ width: 80, alignItems: 'center' }}>
              <BadgeIcon b={b} size={56} />
              <Text variant="xs" weight={700} center style={{ marginTop: 8 }}>
                {t(b.name)}
              </Text>
              <Text variant="xs" color="sec">
                {t(LVN[badgeLevel(b)])}
              </Text>
            </View>
          ))}
        </Row>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t(unlocked.length ? 'Pick up to 3 badges to show your friends.' : 'Unlock badges by training and logging. Then show them here.')}
          </Text>
        </Card>
      )}
      <Row style={{ justifyContent: 'space-between', marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        <Text variant="h3">{t('Personal records')}</Text>
        <Button small kind="ghost" title={t('Edit')} onPress={() => (setSel(cur.prs.map((p) => p.id)), setPick('prs'))} />
      </Row>
      {cur.prs.length ? (
        <List>
          {cur.prs.map((p, i) => (
            <ListRow key={p.id} first={!i}>
              <Icon name="trophy" size={18} color={c.cobalt} />
              <Text weight={700} style={{ flex: 1 }}>
                {exName(p.id)}
              </Text>
              <Text num weight={700}>{`${train.best[p.id] ?? p.w} ${t('kg')}`}</Text>
            </ListRow>
          ))}
        </List>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t(records.length ? 'Pick up to 5 records to show your friends.' : 'Finish a workout to set your first records.')}
          </Text>
        </Card>
      )}
      <List>
        <ListRow first onPress={() => router.push('/account')}>
          <Icon name="lock" size={18} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Account details')}</Text>
            <Text variant="small" color="sec">
              {t('Name, username, email, phone, password')}
            </Text>
          </View>
          <Icon name="chev" size={16} color={c.sec} />
        </ListRow>
        <ListRow onPress={() => router.push('/fprivacy')}>
          <Icon name="users" size={18} />
          <Text weight={700} style={{ flex: 1 }}>
            {t('What friends can see')}
          </Text>
          <Icon name="chev" size={16} color={c.sec} />
        </ListRow>
      </List>
      <Sheet open={!!pick} onClose={() => setPick(null)}>
        <Text variant="h2">{t(pick === 'badges' ? 'Badges on your profile' : 'Records on your profile')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t(pick === 'badges' ? 'Pick up to 3.' : 'Pick up to 5. They show in the order you pick them.')}
        </Text>
        <View style={{ height: 12 }} />
        <List>
          {(pick === 'badges' ? unlocked.map((b) => [b.id, t(b.name), t(LVN[badgeLevel(b)])] as const) : records.map(([id, w]) => [id, exName(id), `${w} ${t('kg')}`] as const)).map(([id, n, sub], i) => {
            const at = sel.indexOf(id);
            const max = pick === 'badges' ? 3 : 5;
            return (
              <ListRow
                key={id}
                first={!i}
                onPress={() => (at >= 0 ? setSel(sel.filter((x) => x !== id)) : sel.length >= max ? toast(t('You can show {n}. Remove one first.', { n: max }), { icon: 'info' }) : setSel([...sel, id]))}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: at >= 0 ? c.cobalt : 'transparent', borderWidth: at >= 0 ? 0 : 2, borderColor: c.line }}>
                  {at >= 0 ? <Text variant="xs" weight={700} color="#FFFFFF">{`${at + 1}`}</Text> : null}
                </View>
                <Text weight={at >= 0 ? 700 : 500} style={{ flex: 1 }}>
                  {n}
                </Text>
                <Text variant="small" color="sec">
                  {sub}
                </Text>
              </ListRow>
            );
          })}
        </List>
        <Button title={t('Save ({a} of {b})', { a: sel.length, b: pick === 'badges' ? 3 : 5 })} onPress={save} />
      </Sheet>
    </Screen>
  );
}
