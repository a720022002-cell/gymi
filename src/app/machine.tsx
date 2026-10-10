import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Thinking } from '@/components/food/Thinking';
import { Icon, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { type DbExercise, dbExName, searchExercises, toPlanEx } from '@/lib/exercisesDb';
import { type Photo, takePhoto } from '@/lib/photo';
import { useTrain } from '@/lib/train';
import { DAYS_LONG, type Equipment, type Muscle, muscleLabel, MUSCLES, type PlanEx, workoutMinutes } from '@/lib/training';
import { useSettings } from '@/theme/settings';

type Found = { known: boolean; name: string; name_ar?: string; group: Muscle; works?: string; works_ar?: string; equipment: Equipment; sets?: number; reps?: string; search?: string };

/** Unknown machine: take a photo, the AI names it, you add it to a workout (design: machinecam). */
export default function MachineScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<AiError | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [match, setMatch] = useState<DbExercise | null>(null);
  const [own, setOwn] = useState(false);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<Muscle | null>(null);
  const workouts = Object.keys(train.plan?.workouts ?? {});
  const [target, setTarget] = useState<string | null>(train.todayName ?? workouts[0] ?? null);

  const snap = async (camera: boolean) => {
    const p = await takePhoto(camera);
    if (!p) return;
    setPhoto(p);
    setBusy(true);
    setErr(null);
    setFound(null);
    setMatch(null);
    setOwn(false);
    const { result, error } = await askAI<Found>('machine', { lang, image: p.base64, mime: p.mime });
    if (error || !result) {
      setBusy(false);
      return setErr(error ?? 'failed');
    }
    setFound(result);
    setName(result.known ? result.name : '');
    setGroup(result.group ?? null);
    if (result.known) {
      // Use the matching exercise from our list when there is one (pictures and steps come with it).
      const list = await searchExercises(result.search || result.name, null, null, 5);
      const words = (result.search || result.name).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const hit = list.find((e) => words.every((w) => e.name_en.toLowerCase().includes(w))) ?? list.find((e) => e.rank === 0) ?? null;
      setMatch(hit);
    } else setOwn(true);
    setBusy(false);
  };

  const add = (pe: PlanEx, label: string) => {
    const p = train.plan;
    if (!p || !target) return;
    const W = p.workouts[target] ?? { ex: [], focus: '', min: 0 };
    if (W.ex.some((x) => x.id === pe.id)) return toast(t('{x} is already in {w}', { x: label, w: t(target) }), { icon: 'info' });
    const ex = [...W.ex, pe];
    train.updatePlan({ workouts: { ...p.workouts, [target]: { ...W, ex, min: workoutMinutes(ex) } } });
    toast(t('{x} added to {w}', { x: label, w: t(target) }), { ai: true });
    router.back();
  };

  const addFound = () => {
    if (!found) return;
    if (match) return add({ ...toPlanEx(match), sets: Math.round(found.sets || 3), reps: /\d/.test(found.reps ?? '') ? String(found.reps).slice(0, 7) : '10–12' }, dbExName(match, lang));
    addOwn(found.name, found.name_ar);
  };

  const addOwn = (n: string, ar?: string) => {
    const nm = n.trim().slice(0, 40);
    const reps = found && /\d/.test(found.reps ?? '') ? String(found.reps).slice(0, 7) : '10–12';
    if (!nm || !group) return;
    const id = `custom:${nm.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-')}`;
    add({ id, sets: Math.round(found?.sets || 3), reps, n: nm, ar: ar ?? (lang === 'ar' ? nm : null), m: group, t: found?.equipment ?? 'Machine' }, nm);
  };

  const pickers = (
    <View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8 }}>
        {t('Add to')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {workouts.map((w) => {
          const day = train.week.findIndex((d) => d.w === w);
          return <Chip key={w} title={`${t(w)}${day >= 0 ? ` · ${t(DAYS_LONG[day])}` : ''}`} on={target === w} onPress={() => setTarget(w)} />;
        })}
      </Row>
    </View>
  );

  if (!train.setupDone)
    return (
      <Screen title={t('Unknown machine?')} back>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text variant="h3" center>
            {t('Set up your training plan first')}
          </Text>
          <Button title={t('Set up training')} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => router.replace('/train')} />
        </Card>
      </Screen>
    );

  return (
    <Screen title={t('Unknown machine?')} back>
      {!photo ? (
        <View style={{ alignItems: 'center', paddingTop: 20 }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size={48} color={c.cobalt} />
          </View>
          <Text variant="h2" center style={{ marginTop: 16 }}>
            {t('Take a photo of the machine')}
          </Text>
          <Text color="sec" center style={{ marginTop: 6 }}>
            {t('I’ll tell you what it is, which muscles it works, and add it to your plan.')}
          </Text>
          <Button icon="camera" title={t('Take a photo')} style={{ marginTop: 24, alignSelf: 'stretch' }} onPress={() => snap(true)} />
          <Button kind="glass" icon="doc" title={t('Choose a photo')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => snap(false)} />
        </View>
      ) : (
        <View>
          <View style={{ alignItems: 'center' }}>
            <Image source={{ uri: photo.uri }} style={{ width: 200, height: 200, borderRadius: 24 }} contentFit="cover" />
          </View>
          {busy ? (
            <View style={{ paddingTop: 20 }}>
              <Thinking message={t('Recognizing the machine')} />
            </View>
          ) : err ? (
            <Card style={{ marginTop: 16, alignItems: 'center', paddingVertical: 20 }}>
              <Text center>{t(aiErrorText(err))}</Text>
              <Button small kind="soft" title={t('Name it myself')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setOwn(true)} />
            </Card>
          ) : found && !own ? (
            <View>
              <Row gap={12} style={{ marginTop: 18 }}>
                <Mark size={28} color={c.cobalt} stroke={6} />
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700} color="sec">
                    {t('I think this is a')}
                  </Text>
                  <Text variant="h2">{match ? dbExName(match, lang) : lang === 'ar' && found.name_ar ? found.name_ar : found.name}</Text>
                </View>
              </Row>
              <Card style={{ marginTop: 16 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="small" color="sec">
                    {t('Works')}
                  </Text>
                  <Text variant="small" weight={700} style={{ flex: 1, textAlign: lang === 'ar' ? 'left' : 'right' }}>
                    {(lang === 'ar' ? found.works_ar : found.works) || muscleLabel(found.group, lang, t)}
                  </Text>
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <Text variant="small" color="sec">
                    {t('Start with')}
                  </Text>
                  <Text variant="small" weight={700}>
                    {t('{s} × {r} at a weight you could do 2 more times', { s: Math.round(found.sets || 3), r: /\d/.test(found.reps ?? '') ? found.reps! : '10–12' })}
                  </Text>
                </Row>
              </Card>
              {pickers}
              <Button title={target ? t('Add to {w}', { w: t(target) }) : t('Add to log')} disabled={!target} style={{ marginTop: 16 }} onPress={addFound} />
              <Button kind="glass" icon="edit" title={t('Not right? Name it myself')} style={{ marginTop: 8 }} onPress={() => setOwn(true)} />
              <Button kind="ghost" title={t('Take another photo')} style={{ marginTop: 4 }} onPress={() => snap(true)} />
            </View>
          ) : null}
          {own ? (
            <View>
              <Text variant="h2" style={{ marginTop: 18 }}>
                {t('Name this exercise')}
              </Text>
              <Text variant="small" color="sec" style={{ marginTop: 4 }}>
                {t('Tell me what it is and which muscles it works. I’ll add it to your plan.')}
              </Text>
              <Field label={t('Exercise name')} value={name} onChangeText={setName} placeholder={t('For example: Seated chest press')} maxLength={40} />
              <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8 }}>
                {t('Main muscle')}
              </Text>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {MUSCLES.map((m) => (
                  <Chip key={m} title={muscleLabel(m, lang, t)} on={group === m} onPress={() => setGroup(m)} />
                ))}
              </Row>
              {pickers}
              <Button title={t('Add exercise')} disabled={!name.trim() || !group || !target} style={{ marginTop: 16 }} onPress={() => addOwn(name)} />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
