import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type LoggedEx, useTrain, type WorkoutLog } from '@/lib/train';
import { type BuiltEx, exInfo, workoutKcal, workoutTitle } from '@/lib/training';

import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Chip, Label, Row } from '../ui';
import { EditLog } from './EditLog';

const MINUTES = [30, 45, 60, 75, 90];

/**
 * Trained without your phone: mark today's workout done (how long it took), or add your sets now. The sets start
 * from today's plan with your last weights, so you only change what was different.
 */
export function NoPhoneSheet({ open, onClose, name, ex }: { open: boolean; onClose: () => void; name: string; ex: BuiltEx[] }) {
  const { t } = useT();
  const toast = useToast();
  const train = useTrain();
  const { profile } = useAuth();
  const [minutes, setMinutes] = useState(60);
  const [sets, setSets] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setSets(false);
    onClose();
  };
  const save = async (exercises: LoggedEx[]) => {
    if (busy) return;
    setBusy(true);
    let volume = 0;
    let done = 0;
    for (const x of exercises) {
      done += x.sets.length;
      if (!x.time) x.sets.forEach((s) => (volume += s.w * s.r));
    }
    const res = await train.addLog({
      day: train.today,
      name: name.slice(0, 40),
      started_at: new Date(Date.now() - minutes * 60000).toISOString(),
      minutes,
      volume: Math.round(volume * 10) / 10,
      sets_done: done,
      kcal: workoutKcal(minutes, Number(profile?.weight_kg ?? 80)),
      exercises,
      prs: [],
      ups: 0,
      downs: 0,
    });
    setBusy(false);
    if (!res) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    close();
    toast(t('{w} saved. Nice work.', { w: workoutTitle(name, t) }), { icon: 'check' });
  };

  // Today's plan as a workout to edit: each exercise's sets with your last weight and the planned reps.
  const draft: WorkoutLog = {
    id: 'draft',
    day: train.today,
    name,
    started_at: new Date().toISOString(),
    minutes,
    volume: 0,
    sets_done: 0,
    kcal: 0,
    prs: [],
    ups: 0,
    downs: 0,
    exercises: ex.map((x) => {
      const info = exInfo(x, 'en');
      const timed = info.timed || !!x.time;
      const reps = parseInt(String(x.reps), 10) || 10;
      return {
        id: x.id,
        n: info.name,
        ...(info.muscle !== 'Other' ? { m: info.muscle } : {}),
        ...(timed ? { time: true } : {}),
        sets: Array.from({ length: Math.max(1, x.sets) }, (_, i) => ({ w: timed ? 0 : (x.last[i]?.w ?? x.last[x.last.length - 1]?.w ?? x.target ?? 0), r: reps })),
      };
    }),
  };

  return (
    <Sheet open={open} onClose={close}>
      {sets ? (
        <View>
          <Text variant="h2">{t('Your sets')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 8 }}>
            {t('From today’s plan with your last weights. Change what was different, or take off what you skipped.')}
          </Text>
          <EditLog log={draft} onCancel={() => setSets(false)} onSave={save} />
        </View>
      ) : (
        <View>
          <Text variant="h2">{t('Trained without your phone?')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Log it, so your week, streak and progress stay right.')}
          </Text>
          <Label>{t('How long?')}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {MINUTES.map((m) => (
              <Chip key={m} title={t('{n} min', { n: m })} on={minutes === m} onPress={() => setMinutes(m)} />
            ))}
          </Row>
          <Button icon="edit" title={t('Add my sets')} style={{ marginTop: 18 }} onPress={() => setSets(true)} />
          <Button kind="glass" icon="check" title={t('Just mark it done')} loading={busy} style={{ marginTop: 8 }} onPress={() => save([])} />
        </View>
      )}
    </Sheet>
  );
}
