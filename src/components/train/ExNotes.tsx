import { TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { fontFor, Text } from '@/components/Text';
import { Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type LastNote, NOTE_MAX } from '@/lib/train';
import type { Cut } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

type T = ReturnType<typeof useT>['t'];

/** Last time's notes in one line: the exercise note, then set notes ("Set 2: narrow grip"). */
export function lastNoteText(n: LastNote, t: T) {
  return [n.note, ...n.sets.map((s) => `${t('Set {n}', { n: s.n })}: ${s.note}`)].filter(Boolean).join(' · ');
}

/** "Last time: shoulder hurt" under an exercise's name. Nothing when last time had no note. */
export function LastNoteLine({ note, style }: { note?: LastNote | null; style?: object }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const text = note ? lastNoteText(note, t) : '';
  if (!text) return null;
  return (
    <Row gap={6} style={[{ marginTop: 4, alignItems: 'flex-start' }, style]}>
      <View style={{ marginTop: 2 }}>
        <Icon name="edit" size={14} color={c.sec} />
      </View>
      <Text variant="small" color="sec" style={{ flex: 1 }}>
        {t('Last time: {x}', { x: text })}
      </Text>
    </Row>
  );
}

/** "Deload week: 80 → 50 kg, 4 → 3 sets" (or "Lighter day: …"), in your weight unit. Parts that didn't change are left out. */
export function cutText(cut: Cut, deload: boolean, t: T, W: ReturnType<typeof useWeight>) {
  const parts = [
    cut.w > 0 && cut.toW !== cut.w ? W.words(t('{a} → {b} kg', { a: W.show(cut.w), b: W.show(cut.toW) })) : '',
    cut.toSets !== cut.sets ? t('{a} → {b} sets', { a: cut.sets, b: cut.toSets }) : '',
  ].filter(Boolean);
  if (!parts.length) return '';
  return t(deload ? 'Deload week: {x}' : 'Lighter day: {x}', { x: parts.join(' · ') });
}

/** The lighter day or deload week's change on one exercise, as a small line. */
export function CutLine({ cut, deload, style }: { cut?: Cut | null; deload: boolean; style?: object }) {
  const { t } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const text = cut ? cutText(cut, deload, t, W) : '';
  if (!text) return null;
  return (
    <Row gap={6} style={[{ marginTop: 4 }, style]}>
      <Icon name="bolt" size={14} color={c.cobalt} />
      <Text variant="small" color="sec" style={{ flex: 1 }}>
        {text}
      </Text>
    </Row>
  );
}

/** A one-line note box (at most NOTE_MAX characters), like "narrow grip". */
export function NoteInput({ value, onChange, placeholder, autoFocus, onDone }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; onDone?: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\n/g, ' ').slice(0, NOTE_MAX))}
        placeholder={placeholder}
        placeholderTextColor={c.sec}
        maxLength={NOTE_MAX}
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onDone}
        onBlur={onDone}
        accessibilityLabel={t('Note')}
        style={{ minHeight: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontFamily: fontFor('manrope', 500), fontSize: 16, color: c.text, outlineStyle: 'none' } as object}
      />
      {/* How many characters are left, once it gets close. */}
      {value.length >= NOTE_MAX - 30 ? (
        <Text variant="xs" color="sec" style={{ marginTop: 4, alignSelf: 'flex-end' }}>
          {`${value.length}/${NOTE_MAX}`}
        </Text>
      ) : null}
    </View>
  );
}
