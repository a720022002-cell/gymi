import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type Application, certUrl, myApplication, withdrawApplication } from '@/lib/coaching';
import { useCoachMode } from '@/lib/coachMode';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

/** Coach application status (design: coachapp). */
export default function CoachApplication() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, refreshProfile } = useAuth();
  const [, setCoachMode] = useCoachMode();
  const [a, setA] = useState<Application | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshProfile().catch(() => null);
      myApplication().then((x) => alive && setA(x));
      return () => {
        alive = false;
      };
    }, [refreshProfile]),
  );
  if (a === undefined)
    return (
      <Screen title={t('Coach application')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const status = profile?.coach_status === 'approved' ? 'approved' : (a?.status ?? (profile?.coach_status === 'pending' ? 'pending' : null));
  if (!status)
    return (
      <Screen title={t('Coach application')} back>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="coach" size={34} color={c.cobalt} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t('Coach clients on Gymi')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Send their plans, check their progress and message them. Our team checks every coach first.')}
          </Text>
          <Button title={t('Apply as a coach')} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => router.push('/coachapply')} />
        </Card>
      </Screen>
    );
  const steps: [string, string, boolean, boolean][] = [
    [t('Application sent'), a ? shortDate(a.created_at.slice(0, 10), lang) : '', true, false],
    [t('Under review'), t('Usually within 2 days'), status !== 'pending', status === 'pending'],
    [t(status === 'rejected' ? 'Not approved' : 'Approved'), status === 'approved' ? t('You can take clients') : status === 'rejected' ? (a?.reason ?? '') : '', status !== 'pending', false],
  ];
  return (
    <Screen title={t('Coach application')} back>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Icon name={status === 'approved' ? 'check' : status === 'rejected' ? 'info' : 'clock'} size={40} color={status === 'approved' ? c.up : status === 'rejected' ? c.down : c.cobalt} strokeWidth={2.2} />
        <Text variant="h2" style={{ marginTop: 8 }}>
          {t(status === 'approved' ? 'You’re approved' : status === 'rejected' ? 'Not approved this time' : 'We’re reviewing it')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t(status === 'pending' ? 'We check your details. You’ll see the answer here.' : status === 'approved' ? 'Welcome to Gymi coaches.' : 'You can fix the issue and send it again.')}
        </Text>
      </View>
      <Card style={{ marginTop: 16 }}>
        {steps.map(([title, sub, done, now], i) => (
          <Row key={i} gap={12} style={{ alignItems: 'flex-start', marginTop: i ? 14 : 0 }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? (status === 'rejected' && i === 2 ? c.down : c.cobalt) : 'transparent',
                borderWidth: done ? 0 : 2,
                borderColor: now ? c.cobalt : c.line,
              }}>
              {done ? <Icon name={status === 'rejected' && i === 2 ? 'close' : 'check'} size={13} color="#FFFFFF" strokeWidth={3} /> : <Text variant="xs" weight={700} color={now ? c.cobalt : 'sec'}>{`${i + 1}`}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {title}
              </Text>
              {sub ? (
                <Text variant="xs" color="sec">
                  {sub}
                </Text>
              ) : null}
            </View>
          </Row>
        ))}
      </Card>
      {a ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
            {t('What you sent')}
          </Text>
          <List>
            <ListRow first>
              <Icon name={a.coach_type === 'Online' ? 'globe' : 'train'} size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{a.coach_type === 'Online' ? t('Online coach') : `${t(a.coach_type === 'Both' ? 'In person and online' : 'Personal coach')}${a.gym ? `, ${a.gym}` : ''}`}</Text>
                <Text variant="xs" color="sec">
                  {`${t('{n} years', { n: t(a.years) })}, ${a.specialties.map((x) => t(x)).join(', ') || t('No specialty picked')}`}
                </Text>
              </View>
            </ListRow>
            {(a.cert_files ?? []).map((f) => (
              <ListRow
                key={f.path}
                onPress={async () => {
                  const u = await certUrl(f.path);
                  if (u) Linking.openURL(u).catch(() => {});
                }}>
                <Icon name="doc" size={18} />
                <View style={{ flex: 1 }}>
                  <Text weight={700} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text variant="xs" color="sec">
                    {t('Certificate')}
                  </Text>
                </View>
              </ListRow>
            ))}
            {!(a.cert_files ?? []).length ? (
              <ListRow>
                <Icon name="doc" size={18} color={c.sec} />
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{a.certs || t('No certificate')}</Text>
                  <Text variant="xs" color="sec">
                    {a.certs ? t('Certificate') : t('Optional')}
                  </Text>
                </View>
              </ListRow>
            ) : null}
            {Object.entries(a.socials ?? {})
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <ListRow key={k}>
                  <Icon name={k === 'Website' ? 'globe' : 'share'} size={18} />
                  <View style={{ flex: 1 }}>
                    <Text weight={700}>{v}</Text>
                    <Text variant="xs" color="sec">
                      {k}
                    </Text>
                  </View>
                </ListRow>
              ))}
          </List>
        </>
      ) : null}
      {status === 'approved' ? (
        <Button title={t('Open the coach view')} onPress={() => (setCoachMode(true), router.replace('/cclients'))} />
      ) : status === 'rejected' ? (
        <Button title={t('Apply again')} onPress={() => router.push('/coachapply')} />
      ) : (
        <Button
          kind="soft"
          title={t('Withdraw application')}
          onPress={() => setConfirm(true)}
        />
      )}
      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2" center>
          {t('Withdraw your application?')}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('You can apply again any time.')}
        </Text>
        <Button
          kind="danger"
          title={t('Withdraw')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setConfirm(false);
            await withdrawApplication();
            await refreshProfile().catch(() => null);
            toast(t('Application withdrawn'), { icon: 'info' });
            router.back();
          }}
        />
        <Button kind="glass" title={t('Keep it')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
