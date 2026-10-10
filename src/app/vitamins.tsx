import { useState } from 'react';
import { View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Field } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, NavButton, Row, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { type Supplement, useHealth } from '@/lib/health';
import { fmtTime } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

type Draft = Omit<Supplement, 'id'> & { id?: string };
const EMPTY: Draft = { name: '', dose: '', unit: 'mg', freq: 'Daily', active: true, remind: false, time: '09:00' };

/** Vitamins and supplements you take, with optional reminder times (design: vitamins). */
export default function VitaminsScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const h = useHealth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const act = h.supplements.filter((v) => v.active).length;

  const quick = async (v: Supplement, patch: Partial<Supplement>) => {
    const ok = await h.saveSupplement({ ...v, ...patch });
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    if ('active' in patch) toast(patch.active ? t('{n} is active', { n: v.name }) : t('{n} paused', { n: v.name }), { icon: 'pill' });
    if (patch.remind) toast(t('Reminder on at {t}', { t: fmtTime(v.time, lang) }), { icon: 'bell' });
  };

  return (
    <Screen title={t('Vitamins')} back right={<NavButton icon="plus" label={t('Add a vitamin')} onPress={() => setDraft({ ...EMPTY })} />}>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('The switch shows what you’re taking now. Reminders are separate and optional.')}
      </Text>
      {h.supplements.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 14, marginBottom: 8, marginHorizontal: 4 }}>
            {t('{a} active, {p} paused', { a: act, p: h.supplements.length - act })}
          </Text>
          {h.supplements.map((v) => (
            <Card key={v.id} style={{ opacity: v.active ? 1 : 0.72 }}>
              <Row>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pill" size={20} color={c.cobalt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{v.name}</Text>
                  <Text variant="small" color="sec">{`${v.dose ? `${v.dose} ${v.unit}, ` : ''}${t(v.freq).toLowerCase()}`}</Text>
                </View>
                <Springy onPress={() => setDraft({ ...v })} accessibilityLabel={t('Edit {n}', { n: v.name })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={16} />
                </Springy>
                <Toggle value={v.active} onChange={(x) => quick(v, { active: x })} label={t('I’m taking this now')} />
              </Row>
              {v.active ? (
                <View style={{ backgroundColor: c.inset, borderRadius: 14, marginTop: 12, paddingHorizontal: 12 }}>
                  <Row style={{ minHeight: 44 }}>
                    <Icon name="bell" size={18} color={v.remind ? c.cobalt : c.sec} />
                    <Text variant="small" weight={700} style={{ flex: 1 }}>
                      {t('Reminder')}
                    </Text>
                    <Toggle value={v.remind} onChange={(x) => quick(v, { remind: x })} label={t('Reminder')} />
                  </Row>
                  {v.remind ? (
                    <Row style={{ minHeight: 52, borderTopWidth: 1, borderTopColor: c.line, justifyContent: 'space-between' }}>
                      <Text variant="small" weight={700}>
                        {t('Remind me at')}
                      </Text>
                      <TimeField value={v.time} onChange={(x) => quick(v, { time: x })} label={t('Remind me at')} bg={c.card} />
                    </Row>
                  ) : null}
                </View>
              ) : (
                <Text variant="small" color="sec" style={{ marginTop: 8 }}>
                  {t('Paused. Turn it on when you start taking it again.')}
                </Text>
              )}
            </Card>
          ))}
        </>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24, marginTop: 16 }}>
          <Icon name="pill" size={30} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('No vitamins yet')}
          </Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Add what you take to keep track of it.')}
          </Text>
          <Button small title={t('Add a vitamin')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setDraft({ ...EMPTY })} />
        </Card>
      )}
      <Row gap={8} style={{ alignItems: 'flex-start', marginTop: 8, paddingHorizontal: 4 }}>
        <Icon name="info" size={18} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Gymi logs what you take. It doesn’t recommend doses. Ask your doctor before starting anything new.')}
        </Text>
      </Row>
      <Text variant="xs" color="sec" center style={{ marginTop: 12 }}>
        {t('Reminder alerts come with the phone app. Your times are saved now.')}
      </Text>
      <Sheet open={!!draft} onClose={() => setDraft(null)}>
        {draft ? <VitSheet draft={draft} setDraft={setDraft} /> : null}
      </Sheet>
    </Screen>
  );
}

function VitSheet({ draft: p, setDraft }: { draft: Draft; setDraft: (d: Draft | null) => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const h = useHealth();
  const [err, setErr] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft({ ...p, ...patch });
  const save = async () => {
    if (!p.name.trim()) return setErr(true);
    const ok = await h.saveSupplement({ ...p, name: p.name.trim().slice(0, 60), dose: p.dose.trim().slice(0, 30), remind: p.active && p.remind });
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setDraft(null);
    toast(p.id ? t('{n} saved', { n: p.name.trim() }) : p.remind ? t('{n} added, reminder at {t}', { n: p.name.trim(), t: fmtTime(p.time, lang) }) : t('{n} added', { n: p.name.trim() }), { icon: 'pill' });
  };
  return (
    <View>
      <Text variant="h2">{t(p.id ? 'Edit vitamin' : 'Add a vitamin or supplement')}</Text>
      <Field label={t('Name')} value={p.name} onChangeText={(v) => (set({ name: v }), setErr(false))} placeholder={t('Vitamin D')} maxLength={60} error={err ? t('Enter a name') : undefined} />
      {!p.id ? (
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {['Vitamin D', 'Creatine', 'Magnesium', 'Iron', 'Omega-3', 'Zinc'].map((x) => (
            <Chip key={x} title={t(x)} on={p.name === t(x)} onPress={() => set({ name: t(x) })} />
          ))}
        </Row>
      ) : null}
      <Field label={t('Dose')} value={p.dose} onChangeText={(v) => set({ dose: v })} placeholder="50,000" keyboardType="decimal-pad" maxLength={30} />
      <Label>{t('Unit')}</Label>
      <Row gap={8}>
        {['IU', 'mg', 'mcg', 'g'].map((u) => (
          <Chip key={u} title={u} on={p.unit === u} onPress={() => set({ unit: u })} />
        ))}
      </Row>
      <Label>{t('How often')}</Label>
      <Row gap={8}>
        {['Daily', 'Weekly', 'Monthly'].map((u) => (
          <Chip key={u} title={t(u)} on={p.freq === u} onPress={() => set({ freq: u })} />
        ))}
      </Row>
      <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('I’m taking this now')}</Text>
          <Text variant="xs" color="sec">
            {t('Turn off to pause it without deleting')}
          </Text>
        </View>
        <Toggle value={p.active} onChange={(v) => set({ active: v })} label={t('I’m taking this now')} />
      </Card>
      {p.active ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Reminder')}</Text>
            <Text variant="xs" color="sec">
              {t('Optional')}
            </Text>
          </View>
          {p.remind ? <TimeField value={p.time} onChange={(v) => set({ time: v })} label={t('Time')} /> : null}
          <Toggle value={p.remind} onChange={(v) => set({ remind: v })} label={t('Reminder')} />
        </Card>
      ) : null}
      <Button title={t(p.id ? 'Save' : 'Add')} style={{ marginTop: 8 }} onPress={save} />
      {p.id ? (
        <Button
          kind="soft"
          icon="trash"
          color="#DC2626"
          title={t('Delete vitamin')}
          style={{ marginTop: 8 }}
          onPress={async () => {
            const gone = await h.deleteSupplement(p.id as string);
            setDraft(null);
            if (gone) toast(t('{n} deleted', { n: gone.name }), { icon: 'trash', undo: () => h.restoreSupplement(gone) });
          }}
        />
      ) : null}
    </View>
  );
}
