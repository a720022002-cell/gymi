import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { reminderTexts, type State } from '@/components/period/shared';
import { FriendPicker } from '@/components/social/FriendPicker';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  type CycleReminders,
  DEFAULT_PARTNER_SHARE,
  cycleNow,
  type CycleSettings,
  DEFAULT_CYCLE,
  deleteAllCycle,
  getPartner,
  type Partner,
  partnerSummary,
  savePartner,
  setAnon as setAnonMode,
  saveSettings,
} from '@/lib/cycle';
import { lockSupported } from '@/lib/biolock';
import { cycleRemindersSupported, scheduleCycleReminders } from '@/lib/cycleReminders';
import { INVITE_BASE } from '@/lib/social';
import { useFood } from '@/lib/food';
import { useSettings } from '@/theme/settings';

export function SettingsSheet({ st, uid, onDone }: { st: State; uid: string; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { profile } = useAuth();
  const { colors: c } = useSettings();
  const [s, setS] = useState<CycleSettings>(st.settings ?? DEFAULT_CYCLE);
  const [del, setDel] = useState(false);
  const [anon, setAnonState] = useState(st.anon);
  const [anonBusy, setAnonBusy] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerLoaded, setPartnerLoaded] = useState(false);
  const { today } = useFood();
  useEffect(() => {
    let alive = true;
    getPartner().then((p) => {
      if (!alive) return;
      setPartner(p);
      setPartnerLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <View>
      <Text variant="h2">{t('Cycle settings')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Used until you have a few periods logged. Then Adro uses your real averages.')}
      </Text>
      <Text weight={700} style={{ marginTop: 16 }}>
        {t('Usual cycle length (days)')}
      </Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => setS({ ...s, cycle_len: Math.max(18, s.cycle_len - 1) })} onPlus={() => setS({ ...s, cycle_len: Math.min(90, s.cycle_len + 1) })} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {s.cycle_len}
          </Text>
        </Stepper>
      </Card>
      <Text weight={700}>{t('Usual period length (days)')}</Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => setS({ ...s, period_len: Math.max(1, s.period_len - 1) })} onPlus={() => setS({ ...s, period_len: Math.min(10, s.period_len + 1) })} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {s.period_len}
          </Text>
        </Stepper>
      </Card>
      {s.mode !== 'preg' && s.mode !== 'post' ? (
        <>
          <Label>{t('Reminders')}</Label>
          <List>
            {(
              [
                ['period', 'Period coming', '2 days before'],
                ['fertile', 'Fertile window', 'When it starts'],
                ['log', 'Daily log reminder', 'Every evening at 9:00 PM'],
              ] as const
            ).map(([k, a, b], i) => (
              <ListRow key={k} first={!i}>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{t(a)}</Text>
                  <Text variant="xs" color="sec">
                    {t(b)}
                  </Text>
                </View>
                <Toggle
                  value={!!s.reminders?.[k]}
                  label={t(a)}
                  onChange={async (v) => {
                    const r: CycleReminders = { ...s.reminders, [k]: v };
                    setS({ ...s, reminders: r });
                    if (!v) return;
                    const n = cycleNow(st.periods, s, today);
                    const res = await scheduleCycleReminders(r, n ? { next: n.next, fertileFrom: n.fertileFrom, cycle: n.cycle } : null, reminderTexts(t), null, true);
                    if (res === 'denied') toast(t('Turn on notifications for Adro in your phone settings.'), { icon: 'bell' });
                  }}
                />
              </ListRow>
            ))}
          </List>
          {!cycleRemindersSupported ? (
            <Text variant="xs" color="sec" style={{ marginHorizontal: 4, marginTop: -4 }}>
              {t('Reminders work in the Adro phone app.')}
            </Text>
          ) : null}
        </>
      ) : null}
      <Label>{t('Privacy')}</Label>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Anonymous mode')}</Text>
          <Text variant="xs" color="sec">
            {t('Cycle data is kept only on this phone, not on our server. It won’t move to a new phone and partner sharing turns off.')}
          </Text>
        </View>
        <Toggle
          value={anon}
          onChange={async (v) => {
            setAnonBusy(true);
            const ok = await setAnonMode(uid, v);
            setAnonBusy(false);
            if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            setAnonState(v);
            toast(t(v ? 'Anonymous mode on. Cycle data is now only on this phone.' : 'Anonymous mode off. Cycle data is saved to your account again.'), { icon: 'lock' });
          }}
          label={t('Anonymous mode')}
        />
      </Card>
      {anonBusy ? <Thinking message={t('Moving your cycle data')} /> : null}
      {lockSupported ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Lock with Face ID')}</Text>
            <Text variant="xs" color="sec">
              {t('Ask for Face ID or your fingerprint to open cycle tracking')}
            </Text>
          </View>
          <Toggle value={!!s.lock} onChange={(v) => setS({ ...s, lock: v })} label={t('Lock with Face ID')} />
        </Card>
      ) : null}
      {/* "Use temperature from my watch" (temp_watch) stays hidden until predictions use it. */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Hidden from Gym Bros and coaches')}</Text>
          <Text variant="xs" color="sec">
            {t('Friends, groups and coaches never see cycle data.')}
          </Text>
        </View>
        <Icon name="lock" size={18} color="#15803D" />
      </Card>
      {!anon ? (
        <>
          <Label>{t('Share with my partner')}</Label>
          <Card>
            <Text variant="small" color="sec">
              {t('Pick one friend from Gym Bros. They see only what you choose, never your logs.')}
            </Text>
            <View style={{ marginTop: 10 }}>
              <FriendPicker value={partner ? [partner.partner_id] : []} onChange={(v) => setPartner(v.length ? { partner_id: v[v.length - 1], share: partner?.share ?? DEFAULT_PARTNER_SHARE } : null)} />
            </View>
            {partner ? (
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    ['phase', 'Phase'],
                    ['period', 'Period dates'],
                    ['fertile', 'Fertile window'],
                    ['mood', 'Mood'],
                    ['sym', 'Symptoms'],
                    ['preg', 'Pregnancy'],
                  ] as const
                ).map(([k, l]) => (
                  <Chip key={k} title={t(l)} on={!!partner.share[k]} onPress={() => setPartner({ ...partner, share: { ...partner.share, [k]: !partner.share[k] } })} />
                ))}
              </Row>
            ) : null}
            <View style={{ height: 1, backgroundColor: c.line, marginVertical: 12 }} />
            <Text variant="small" color="sec">
              {t('Partner not on Adro yet? Send them a link. After they join, add each other as friends and pick them here.')}
            </Text>
            <Button
              small
              kind="glass"
              icon="copy"
              title={t('Copy invite link')}
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
              onPress={async () => {
                const u = profile?.username ?? '';
                const msg = t('Join me on Adro and add me as a friend: @{u} {link}', { u, link: `${INVITE_BASE}${encodeURIComponent(u)}` });
                try {
                  await Clipboard.setStringAsync(msg);
                  toast(t('Invite link copied'), { icon: 'copy' });
                } catch {
                  toast(msg, { icon: 'copy' });
                }
              }}
            />
          </Card>
        </>
      ) : null}
      <Button
        title={t('Save')}
        onPress={async () => {
          const ok = await saveSettings(uid, anon ? { ...s, temp_watch: false } : s);
          if (!anon && partnerLoaded) await savePartner(uid, partner, partner ? partnerSummary(cycleNow(st.periods, s, today), partner.share, s.mode, st.logs[today], today) : null);
          toast(ok ? t('Saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          onDone();
        }}
      />
      {del ? (
        <Button
          kind="danger"
          title={t('Yes, delete all cycle data')}
          style={{ marginTop: 8 }}
          onPress={async () => {
            await deleteAllCycle(uid);
            toast(t('Cycle data deleted'), { icon: 'trash' });
            onDone();
          }}
        />
      ) : (
        <Button kind="ghost" title={t('Delete cycle data')} color="#DC2626" style={{ marginTop: 8 }} onPress={() => setDel(true)} />
      )}
    </View>
  );
}
