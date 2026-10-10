import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, NavButton, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type ClientLink, coachInvite, coachList, coachRespond, endCoaching } from '@/lib/coaching';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

/** Coach: requests, clients and invite codes (design: clients). */
export function ClientsView({ tab }: { tab?: boolean }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const approved = profile?.account_type === 'coach' && profile.coach_status === 'approved';
  const [list, setList] = useState<ClientLink[] | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const load = useCallback(async () => setList(await coachList()), []);
  useFocusEffect(
    useCallback(() => {
      if (approved) load();
    }, [approved, load]),
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

  const invite = async () => {
    const v = await coachInvite();
    if (!v) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setCode(v);
    load();
  };
  const req = (list ?? []).filter((x) => x.status === 'requested');
  const act = (list ?? []).filter((x) => x.status === 'active');
  const inv = (list ?? []).filter((x) => x.status === 'invited');

  return (
    <Screen title={t('Clients')} back={!tab} large={tab} tabs={tab} right={<NavButton icon="userplus" label={t('Invite a client')} onPress={invite} />}>
      {!list ? (
        <Thinking message={t('Loading')} />
      ) : (
        <>
          {req.length ? (
            <>
              <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
                {t('New requests')}
              </Text>
              <List>
                {req.map((x, i) => (
                  <ListRow key={x.id} first={!i}>
                    <Avatar id={x.client_id ?? x.id} name={x.name || x.username || '?'} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text weight={700}>{x.name || x.username}</Text>
                      <Text variant="small" color="sec">{`@${x.username}${x.package ? ` · ${x.package}` : ''}`}</Text>
                    </View>
                    <Button
                      small
                      title={t('Accept')}
                      onPress={async () => {
                        if (!(await coachRespond(x.id, true))) toast(t('They already joined another coach.'), { icon: 'info' });
                        load();
                      }}
                    />
                    <Button
                      small
                      kind="soft"
                      title={t('Decline')}
                      onPress={async () => {
                        await coachRespond(x.id, false);
                        load();
                      }}
                    />
                  </ListRow>
                ))}
              </List>
            </>
          ) : null}
          <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
            {t('{n} clients', { n: act.length })}
          </Text>
          {act.length ? (
            <List>
              {act.map((x, i) => (
                <ListRow key={x.id} first={!i} onPress={() => router.push({ pathname: '/client', params: { link: x.id, id: x.client_id ?? '' } })}>
                  <Avatar id={x.client_id ?? x.id} name={x.name || x.username || '?'} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text weight={700}>{x.name || x.username}</Text>
                    <Text variant="small" color="sec">
                      {x.last_day ? t('Last logged {d}', { d: shortDate(x.last_day, lang) }) : t('Nothing logged yet')}
                    </Text>
                  </View>
                  {x.streak ? (
                    <Row gap={2}>
                      <Icon name="flame" size={16} color={c.cobalt} />
                      <Text variant="small" weight={700} num>
                        {x.streak}
                      </Text>
                    </Row>
                  ) : null}
                  <Icon name="chev" size={18} color={c.sec} />
                </ListRow>
              ))}
            </List>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text variant="small" color="sec" center>
                {t('No clients yet. Tap + to make an invite code and send it to a client.')}
              </Text>
            </Card>
          )}
          {inv.length ? (
            <>
              <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
                {t('Invite codes not used yet')}
              </Text>
              <List>
                {inv.map((x, i) => (
                  <ListRow key={x.id} first={!i}>
                    <Icon name="key" size={18} color={c.cobalt} />
                    <Text num weight={700} style={{ flex: 1, letterSpacing: 1 }}>
                      {x.code}
                    </Text>
                    <Button
                      small
                      kind="soft"
                      title={t('Delete')}
                      onPress={async () => {
                        await endCoaching(x.id);
                        load();
                      }}
                    />
                  </ListRow>
                ))}
              </List>
            </>
          ) : null}
          <Button kind="glass" icon="userplus" title={t('Invite a client')} onPress={invite} />
          <Button kind="ghost" icon="edit" title={t('Edit coach profile')} style={{ marginTop: 4 }} onPress={() => router.push('/cprofile')} />
        </>
      )}
      <Sheet open={!!code} onClose={() => setCode(null)}>
        <View style={{ alignItems: 'center' }}>
          <Icon name="key" size={34} color={c.cobalt} />
          <Text variant="h2" style={{ marginTop: 8 }}>
            {t('Invite code')}
          </Text>
          <Text num size={34} style={{ marginTop: 12, letterSpacing: 3 }}>
            {code}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
            {t('Send this code to your client. They enter it in Gymi under You, then Find a coach. It works once.')}
          </Text>
        </View>
        <Button
          icon="copy"
          title={t('Copy code')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            try {
              await navigator.clipboard.writeText(code ?? '');
              toast(t('Code copied'), { icon: 'copy' });
            } catch {
              toast(code ?? '', { icon: 'copy' });
            }
          }}
        />
        <Button kind="ghost" title={t('Done')} style={{ marginTop: 8 }} onPress={() => setCode(null)} />
      </Sheet>
    </Screen>
  );
}

export default function Clients() {
  return <ClientsView />;
}
