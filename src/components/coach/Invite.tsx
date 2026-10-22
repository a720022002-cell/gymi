import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { inviteUrl } from '@/lib/links';
import { assign, type ClientLink, copyText, type MealPlan, type Program, shareText } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Label, Row, Springy } from '../ui';

/** The code with Copy and Share (design: addclient / pending client). */
export function InviteCode({ code, coach }: { code: string; coach: string }) {
  const { t } = useT();
  const toast = useToast();
  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22, marginTop: 16 }}>
        <Text num size={34} style={{ letterSpacing: 3 }}>
          {code}
        </Text>
        <Text variant="xs" weight={700} color="sec" style={{ marginTop: 8 }}>
          {t('One person per code')}
        </Text>
      </Card>
      <Row gap={10}>
        <Button
          kind="glass"
          icon="copy"
          title={t('Copy')}
          style={{ flex: 1 }}
          onPress={async () => toast((await copyText(code)) ? t('Code copied') : code, { icon: 'copy' })}
        />
        <Button
          icon="share"
          title={t('Share')}
          style={{ flex: 1 }}
          onPress={async () => {
            const r = await shareText(`${t('{c} invited you to coaching on Adro. Open Adro, go to Find a coach and enter this code: {k}', { c: coach, k: code })} ${inviteUrl(code, 'coach')}`);
            if (r === 'copied') toast(t('Invite text copied'), { icon: 'copy' });
          }}
        />
      </Row>
    </View>
  );
}

/** Pick a program and meal plan for an invite; they apply when the client joins (design: addclient). */
export function InvitePlans({ link, progs, meals, onChange, onNew }: { link: ClientLink; progs: Program[]; meals: MealPlan[]; onChange: () => void; onNew?: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const set = async (p: string | null, m: string | null) => {
    if (!(await assign(link.id, p, m))) toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    onChange();
  };
  const make = (k: 'progedit' | 'mealedit') => {
    onNew?.();
    router.push({ pathname: k === 'progedit' ? '/progedit' : '/mealedit', params: { assign: link.id } });
  };
  const newChip = (k: 'progedit' | 'mealedit') => (
    <Springy accessibilityLabel={t('Make a new one')} onPress={() => make(k)} style={{ height: 36, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.cobalt, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name="plus" size={13} color={c.cobalt} strokeWidth={2.6} />
      <Text variant="small" weight={700} color={c.cobalt}>
        {t('Make a new one')}
      </Text>
    </Springy>
  );
  return (
    <View>
      <Text weight={700} style={{ marginTop: 20, marginHorizontal: 4 }}>
        {t('Plans to start with (optional)')}
      </Text>
      <Text variant="small" color="sec" style={{ marginHorizontal: 4, marginTop: 2 }}>
        {t('You can also do this after they join.')}
      </Text>
      <Label>{t('Workout program')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip title={t('AI plans it')} on={!link.program_id} onPress={() => set(null, link.meal_plan_id)} />
        {progs.map((x) => (
          <Chip key={x.id} title={x.name} on={link.program_id === x.id} onPress={() => set(x.id, link.meal_plan_id)} />
        ))}
        {newChip('progedit')}
      </Row>
      <Label>{t('Meal plan')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip title={t('AI plans it')} on={!link.meal_plan_id} onPress={() => set(link.program_id, null)} />
        {meals.map((x) => (
          <Chip key={x.id} title={x.name} on={link.meal_plan_id === x.id} onPress={() => set(link.program_id, x.id)} />
        ))}
        {newChip('mealedit')}
      </Row>
    </View>
  );
}

/** Invite a client: a new code, how to send it, and plans to start with (design: addclient). */
export function InviteSheet({ link, coach, progs, meals, onChange, onClose }: { link: ClientLink | null; coach: string; progs: Program[]; meals: MealPlan[]; onChange: () => void; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Sheet open={!!link} onClose={onClose}>
      {link ? (
        <View>
          <View style={{ alignItems: 'center' }}>
            <Icon name="key" size={34} color={c.cobalt} />
            <Text variant="h2" style={{ marginTop: 8 }}>
              {t('Their sign-up code')}
            </Text>
            <Text variant="small" color="sec" center style={{ marginTop: 6 }}>
              {t('Send this code to your client. They enter it in Adro under You, then Find a coach. It works once.')}
            </Text>
          </View>
          <InviteCode code={link.code ?? ''} coach={coach} />
          <InvitePlans link={link} progs={progs} meals={meals} onChange={onChange} onNew={onClose} />
          <Button title={t('Done')} style={{ marginTop: 20 }} onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}
