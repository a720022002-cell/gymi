import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n';
import { type DbExercise, dbExName, getExercise, searchExercises } from '@/lib/exercisesDb';
import { exMuscle, FILTER_MUSCLES, muscleLabel } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Field } from '../Field';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { Button, Chip, Row, Springy } from '../ui';

// Words that say nothing about the movement itself.
const PLAIN = new Set(['dumbbell', 'dumbbells', 'barbell', 'cable', 'machine', 'smith', 'seated', 'standing', 'one', 'arm', 'one-arm', 'single', 'single-arm', 'two', 'two-arm', 'alternating', 'with', 'the', 'on', 'to', 'a', 'and', 'lying', 'bands', 'band', 'kettlebell', 'plate', 'plate-loaded', 'ez', 'bar', '-']);
const words = (n: string) => n.toLowerCase().replace(/[()/,]/g, ' ').split(/\s+/).filter((w) => w && !PLAIN.has(w));

/** Exercises that work the same muscle, the closest movements first (a lateral raise suggests other lateral raises). */
async function similarTo(like: { id: string; muscle: string; name: string }): Promise<DbExercise[]> {
  const e = like.id.startsWith('custom:') ? null : await getExercise(like.id);
  const group = e ? exMuscle(e.id, e.muscle, e.muscles) : like.muscle;
  if (!FILTER_MUSCLES.includes(group)) return [];
  const all = await searchExercises('', group, null, 200);
  const mine = new Set(words(e?.name_en ?? like.name));
  const fine = e?.muscles?.[0];
  const score = (x: DbExercise) => {
    let n = 0;
    const theirs = words(x.name_en);
    for (const w of theirs) if (mine.has(w)) n += w === 'raise' || w === 'press' ? 1 : 3;
    // Front, side and rear work different parts of the shoulder.
    for (const w of ['rear', 'front', 'reverse']) if (theirs.includes(w) !== mine.has(w)) n -= 3;
    if (fine && x.muscles?.[0] === fine) n += 1;
    if (x.rank === 0) n += 2;
    return n;
  };
  return all
    .filter((x) => x.id !== like.id && x.category !== 'stretching')
    .map((x) => ({ x, n: score(x) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map((y) => y.x);
}

/** Search the exercise list to add or replace one (design: SH.expick). When replacing, exercises for the same muscle come first; "Other exercise" opens the full search. */
export function ExercisePicker({
  open,
  title,
  replacing,
  like,
  exclude,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  replacing?: boolean;
  like?: { id: string; muscle: string; name: string } | null;
  exclude?: string[];
  onClose: () => void;
  onPick: (e: DbExercise) => void;
}) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [all, setAll] = useState(false);
  const [similar, setSimilar] = useState<{ id: string; list: DbExercise[] } | null>(null);
  const showSimilar = !!like && !all;
  const [q, setQ] = useState('');
  const [m, setM] = useState<string | null>(null);
  const [results, setResults] = useState<DbExercise[]>([]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const loading = doneKey !== `${m}|${q}`;
  const latest = useRef(0);

  useEffect(() => {
    if (!open || showSimilar) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      const r = await searchExercises(q, m, null, q ? 60 : 80);
      if (id === latest.current) {
        setResults(r);
        setDoneKey(`${m}|${q}`);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, m, open, showSimilar]);

  const likeId = like?.id;
  useEffect(() => {
    if (!open || !like || all || similar?.id === like.id) return;
    let alive = true;
    similarTo(like).then((list) => alive && setSimilar({ id: like.id, list }));
    return () => {
      alive = false;
    };
    // `like` is a new object each render; its id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, likeId, all, similar?.id]);

  const close = () => {
    setAll(false);
    onClose();
  };
  const pick = (e: DbExercise) => {
    setAll(false);
    onPick(e);
  };
  const row = (e: DbExercise, i: number) => (
    <Springy key={e.id} onPress={() => pick(e)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={700} numberOfLines={1}>
          {dbExName(e, lang)}
        </Text>
        <Text variant="xs" color="sec" numberOfLines={1}>
          {[muscleLabel(exMuscle(e.id, e.muscle, e.muscles), lang, t), t(e.equipment), e.machines?.[0] ? (lang === 'ar' ? e.machines[0][1] : e.machines[0][0]) : null].filter(Boolean).join(t(', '))}
        </Text>
      </View>
      <Icon name={replacing ? 'swap' : 'plus'} size={18} color={c.cobalt} strokeWidth={2.2} />
    </Springy>
  );

  if (showSimilar) {
    const sim = similar?.id === like.id ? similar.list.filter((e) => !exclude?.includes(e.id)) : null;
    return (
      <Sheet open={open} onClose={close}>
        <Text variant="h2">{title}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('Same muscle as {x}', { x: like.name })}
        </Text>
        <Button kind="soft" icon="search" title={t('Other exercise')} color={c.text} style={{ marginTop: 12 }} onPress={() => setAll(true)} />
        <View style={{ marginTop: 12, minHeight: 240 }}>
          {!sim ? (
            <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
          ) : sim.length ? (
            <View style={{ backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>{sim.map(row)}</View>
          ) : (
            <Text color="sec" center style={{ marginTop: 30 }}>
              {t('No exercises match.')}
            </Text>
          )}
        </View>
      </Sheet>
    );
  }

  const list = results.filter((e) => !exclude?.includes(e.id));
  return (
    <Sheet open={open} onClose={close}>
      <Text variant="h2">{title}</Text>
      <Field value={q} onChangeText={setQ} placeholder={t('Search exercises')} autoCorrect={false} />
      <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
        {[null, ...FILTER_MUSCLES].map((x) => (
          <Chip key={x ?? 'all'} title={x ? muscleLabel(x, lang, t) : t('All')} on={m === x} onPress={() => setM(x)} />
        ))}
      </Row>
      <View style={{ marginTop: 10, minHeight: 240 }}>
        {loading && !list.length ? (
          <ActivityIndicator color={c.cobalt} style={{ marginTop: 30 }} />
        ) : list.length ? (
          <View style={{ backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
            {list.map(row)}
          </View>
        ) : (
          <Text color="sec" center style={{ marginTop: 30 }}>
            {t('No exercises match.')}
          </Text>
        )}
      </View>
    </Sheet>
  );
}
