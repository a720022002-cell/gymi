import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Label, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { NCAT_INFO, NCATS, remindersSupported } from '@/lib/reminders';
import { catSummary, useReminderPrefs } from '@/lib/remindersPrefs';
import { useSettings } from '@/theme/settings';

/** Notifications: a master switch, 8 reminder types (tap one for its options) and quiet hours (design: notifications). */
export default function NotificationsScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { prefs: p, save } = useReminderPrefs();

  const put = async (next: typeof p, ask = false) => {
    const r = await save(next, ask);
    if (r === 'denied' && ask) toast(t('Turn on notifications for Adro in your phone settings.'), { icon: 'bell' });
  };

  return (
    <Screen title={t('Notifications')} back>
      {!remindersSupported ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="info" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Reminders arrive on the phone app. Your choices here are saved on this device only, so set them again in the phone app.')}
          </Text>
        </Card>
      ) : null}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Allow notifications')}</Text>
          <Text variant="small" color="sec">
            {t('Turn off to pause everything')}
          </Text>
        </View>
        <Toggle value={p.on} onChange={(v) => put({ ...p, on: v }, v)} label={t('Allow notifications')} />
      </Card>
      {p.on ? null : (
        <Text variant="small" color="sec" center style={{ marginBottom: 12 }}>
          {t('All reminders are paused. Your choices below are kept.')}
        </Text>
      )}
      <View style={{ opacity: p.on ? 1 : 0.5 }}>
        <List>
          {NCATS.map((k, i) => (
            <ListRow key={k} first={!i}>
              <Pressable onPress={() => router.push({ pathname: '/notif', params: { type: k } })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }} accessibilityRole="button">
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={NCAT_INFO[k].icon} size={18} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={700}>{t(NCAT_INFO[k].name)}</Text>
                  <Text variant="small" color="sec" numberOfLines={2}>
                    {p[k].on ? catSummary(k, p, t, lang) : t('Off')}
                  </Text>
                </View>
                <Icon name="chev" size={16} color={c.sec} />
              </Pressable>
              <Toggle value={p[k].on} onChange={(v) => put({ ...p, [k]: { ...p[k], on: v }, ...(v ? { on: true } : {}) }, v)} label={t(NCAT_INFO[k].name)} />
            </ListRow>
          ))}
        </List>
      </View>
      <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Tap a type to choose how often it reminds you and which sound it plays. If you don’t hear sounds, turn off your phone’s silent mode.')}
      </Text>

      <Label>{t('Quiet hours')}</Label>
      <List>
        <ListRow first>
          <Icon name="moon" size={18} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Don’t disturb me')}</Text>
            <Text variant="small" color="sec">
              {p.quiet.on ? t('No reminders in these hours. Vitamins still remind you.') : t('Off')}
            </Text>
          </View>
          <Toggle value={p.quiet.on} onChange={(v) => put({ ...p, quiet: { ...p.quiet, on: v } })} label={t('Don’t disturb me')} />
        </ListRow>
        {p.quiet.on ? (
          <ListRow>
            <Row gap={8} style={{ flex: 1, flexWrap: 'wrap' }}>
              <Text variant="xs" weight={700} color="sec">
                {t('From')}
              </Text>
              <TimeField value={p.quiet.from} onChange={(v) => put({ ...p, quiet: { ...p.quiet, from: v } })} label={t('From')} />
              <Text variant="xs" weight={700} color="sec">
                {t('to')}
              </Text>
              <TimeField value={p.quiet.to} onChange={(v) => put({ ...p, quiet: { ...p.quiet, to: v } })} label={t('Until')} />
            </Row>
          </ListRow>
        ) : null}
      </List>
      {remindersSupported ? <Button kind="glass" icon="bell" title={t('Turn on notifications')} style={{ marginTop: 8 }} onPress={() => put(p, true)} /> : null}
    </Screen>
  );
}
