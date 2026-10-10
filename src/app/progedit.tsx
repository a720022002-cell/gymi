import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { ExercisePicker } from '@/components/train/ExercisePicker';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { deleteProgram, listPrograms, type Program, saveProgram } from '@/lib/coaching';
import { toPlanEx } from '@/lib/exercisesDb';
import { exInfo } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const NEW: Program = { id: '', name: '', days: [{ name: 'Day 1', ex: [] }] };

/** Coach: make or edit a workout program (design: progedit). */
export default function ProgramEdit() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [p, setP] = useState<Program | null>(id ? null : NEW);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    listPrograms().then((l) => alive && setP(l.find((x) => x.id === id) ?? NEW));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!p)
    return (
      <Screen title={t('Workout program')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const setDay = (i: number, patch: Partial<Program['days'][number]>) => setP({ ...p, days: p.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const field = { borderBottomWidth: 1.5, borderBottomColor: c.line, borderStyle: 'dashed' as const, fontSize: 16, fontFamily: 'Manrope_700Bold', color: c.text, paddingVertical: 4 };
  return (
    <Screen title={t('Workout program')} back>
      <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 6 }}>
        {t('Program name')}
      </Text>
      <TextInput value={p.name} onChangeText={(v) => setP({ ...p, name: v.slice(0, 60) })} placeholder={t('For example: Fat loss, 3 days')} placeholderTextColor={c.sec} style={{ height: 50, borderRadius: 16, backgroundColor: c.card, paddingHorizontal: 14, fontSize: 16, color: c.text, marginBottom: 12 }} />
      {p.days.map((d, di) => (
        <Card key={di}>
          <Row gap={8}>
            <TextInput value={d.name} onChangeText={(v) => setDay(di, { name: v.slice(0, 30) })} style={[field, { flex: 1 }]} />
            {p.days.length > 1 ? (
              <Springy accessibilityLabel={t('Remove day')} onPress={() => setP({ ...p, days: p.days.filter((_, j) => j !== di) })} style={{ width: 32, alignItems: 'center' }}>
                <Icon name="trash" size={16} color={c.down} />
              </Springy>
            ) : null}
          </Row>
          {d.ex.map((x, i) => (
            <Row key={`${x.id}${i}`} gap={6} style={{ marginTop: 10 }}>
              <Text variant="small" weight={700} style={{ flex: 1 }} numberOfLines={1}>
                {exInfo(x, lang).name}
              </Text>
              <Springy accessibilityLabel={t('Less')} onPress={() => setDay(di, { ex: d.ex.map((y, j) => (j === i ? { ...y, sets: Math.max(1, y.sets - 1) } : y)) })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="minus" size={12} strokeWidth={2.4} />
              </Springy>
              <Text num size={14} style={{ width: 18, textAlign: 'center' }}>
                {x.sets}
              </Text>
              <Springy accessibilityLabel={t('More')} onPress={() => setDay(di, { ex: d.ex.map((y, j) => (j === i ? { ...y, sets: Math.min(8, y.sets + 1) } : y)) })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={12} strokeWidth={2.4} />
              </Springy>
              <TextInput
                value={x.reps}
                onChangeText={(v) => setDay(di, { ex: d.ex.map((y, j) => (j === i ? { ...y, reps: v.slice(0, 7) } : y)) })}
                accessibilityLabel={t('Reps')}
                style={{ width: 58, height: 34, borderRadius: 8, backgroundColor: c.inset, textAlign: 'center', fontFamily: 'Sora_600SemiBold', fontSize: 13, color: c.text }}
              />
              <Springy accessibilityLabel={t('Remove')} onPress={() => setDay(di, { ex: d.ex.filter((_, j) => j !== i) })} style={{ width: 28, alignItems: 'center' }}>
                <Icon name="close" size={14} color={c.sec} />
              </Springy>
            </Row>
          ))}
          <Button small kind="ghost" icon="plus" title={t('Add exercise')} style={{ marginTop: 8 }} onPress={() => setPick(di)} />
        </Card>
      ))}
      <Button kind="soft" icon="plus" title={t('Add a day')} onPress={() => setP({ ...p, days: [...p.days, { name: t('Day {n}', { n: p.days.length + 1 }), ex: [] }] })} />
      <Button
        title={t('Save')}
        loading={busy}
        disabled={!p.name.trim() || !p.days.some((d) => d.ex.length)}
        style={{ marginTop: 16 }}
        onPress={async () => {
          setBusy(true);
          const r = await saveProgram({ ...p, id: p.id || undefined });
          setBusy(false);
          if (!r) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Program saved. Clients on it see the changes.'), { icon: 'check' });
          router.back();
        }}
      />
      {p.id ? (
        <Button
          kind="ghost"
          icon="trash"
          title={t('Delete program')}
          color={c.down}
          style={{ marginTop: 8 }}
          onPress={async () => {
            await deleteProgram(p.id);
            toast(t('Program deleted'), { icon: 'trash' });
            router.back();
          }}
        />
      ) : null}
      <View style={{ height: 20 }} />
      <ExercisePicker
        open={pick != null}
        title={t('Add an exercise')}
        exclude={pick != null ? p.days[pick].ex.map((x) => x.id) : []}
        onClose={() => setPick(null)}
        onPick={(e) => {
          if (pick == null) return;
          setDay(pick, { ex: [...p.days[pick].ex, toPlanEx(e)] });
          setPick(null);
        }}
      />
    </Screen>
  );
}
