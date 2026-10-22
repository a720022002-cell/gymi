import { useState } from "react";
import { TextInput, View } from "react-native";

import { useT } from "@/i18n";
import { toLatinDigits } from "@/lib/latinDigits";
import { cleanNote, type LoggedEx, type WorkoutLog } from "@/lib/train";
import { EX } from "@/lib/training";
import { useWeight } from "@/lib/units";
import { loggedExName } from "@/lib/workoutHistory";
import { useSettings } from "@/theme/settings";

import { Icon } from "../Icon";
import { fontFor, Text } from "../Text";
import { Button, Row, Springy } from "../ui";
import { NoteInput } from "./ExNotes";

/** `kg`, `shown`: the saved weight and how it showed, so an unchanged weight stays exactly the same (lb rounding). */
type Draft = {
  id: string;
  ex: LoggedEx;
  /** Your note on the exercise, and on each set (only sets that had one can be changed here). */
  note: string;
  sets: { w: string; r: string; kg: number; shown: string; note?: string }[];
}[];

/** Change a past workout: weight and reps of each set, take off a set or a whole exercise. Weights in your unit. */
export function EditLog({
  log,
  onSave,
  onCancel,
}: {
  log: WorkoutLog;
  onSave: (exercises: LoggedEx[]) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const [draft, setDraft] = useState<Draft>(() =>
    log.exercises.map((ex, i) => ({
      id: `${ex.id}-${i}`,
      ex,
      note: ex.note ?? "",
      sets: ex.sets.map((s) => {
        const shown = s.w ? String(W.num(s.w)) : "";
        return { w: shown, r: String(s.r), kg: s.w, shown, ...(s.note != null ? { note: s.note } : {}) };
      }),
    })),
  );
  const num = (v: string) =>
    Math.max(
      0,
      Number(
        toLatinDigits(v)
          .replace(",", ".")
          .replace(/[^\d.]/g, ""),
      ) || 0,
    );
  const setVal = (i: number, j: number, k: "w" | "r", v: string) =>
    setDraft((d) =>
      d.map((x, a) =>
        a === i
          ? {
              ...x,
              sets: x.sets.map((s, b) =>
                b === j
                  ? {
                      ...s,
                      [k]: toLatinDigits(v)
                        .replace(",", ".")
                        .replace(/[^\d.]/g, "")
                        .slice(0, 6),
                    }
                  : s,
              ),
            }
          : x,
      ),
    );
  const setNote = (i: number, j: number | null, v: string) =>
    setDraft((d) =>
      d.map((x, a) =>
        a !== i
          ? x
          : j == null
            ? { ...x, note: v }
            : { ...x, sets: x.sets.map((s, b) => (b === j ? { ...s, note: v } : s)) },
      ),
    );
  const dropSet = (i: number, j: number) =>
    setDraft((d) =>
      d
        .map((x, a) =>
          a === i ? { ...x, sets: x.sets.filter((_, b) => b !== j) } : x,
        )
        .filter((x) => x.sets.length),
    );
  const dropEx = (i: number) => setDraft((d) => d.filter((_, a) => a !== i));
  const left = draft.filter((x) => x.sets.some((s) => num(s.r) > 0)).length;

  const input = {
    width: 64,
    height: 36,
    borderRadius: 8,
    backgroundColor: c.inset,
    textAlign: "center",
    fontFamily: fontFor("sora", 600),
    color: c.text,
    outlineStyle: "none",
  } as object;

  return (
    <View style={{ gap: 10 }}>
      {draft.map((x, i) => {
        const timed = !!(x.ex.time || EX[x.ex.id]?.time);
        const name = loggedExName(x.ex, lang);
        return (
          <View
            key={x.id}
            style={{ backgroundColor: c.card, borderRadius: 22, padding: 16 }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Text weight={700} style={{ flex: 1 }}>
                {name}
              </Text>
              <Springy
                onPress={() => dropEx(i)}
                accessibilityRole="button"
                accessibilityLabel={t("Remove {x}", { x: name })}
                style={{ padding: 6 }}
              >
                <Icon name="trash" size={18} color={c.down} />
              </Springy>
            </Row>
            <View style={{ marginTop: 8 }}>
              <NoteInput
                value={x.note}
                onChange={(v) => setNote(i, null, v)}
                placeholder={t("Add note")}
              />
            </View>
            <Row gap={8} style={{ marginTop: 8, paddingStart: 52 }}>
              <Text
                variant="xs"
                weight={700}
                color="sec"
                style={{ width: 64, textAlign: "center" }}
              >
                {W.label}
              </Text>
              <Text
                variant="xs"
                weight={700}
                color="sec"
                style={{ width: 64, textAlign: "center" }}
              >
                {t(timed ? "Seconds" : "Reps")}
              </Text>
            </Row>
            {x.sets.map((s, j) => (
              <View key={j}>
                <Row gap={8} style={{ marginTop: 6 }}>
                  <Text variant="small" color="sec" style={{ width: 44 }}>
                    {t("Set {n}", { n: j + 1 })}
                  </Text>
                  <TextInput
                    value={s.w}
                    onChangeText={(v) => setVal(i, j, "w", v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={c.sec}
                    accessibilityLabel={`${t("Set {n}", { n: j + 1 })}, ${W.label}`}
                    style={input}
                  />
                  <TextInput
                    value={s.r}
                    onChangeText={(v) => setVal(i, j, "r", v)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={c.sec}
                    accessibilityLabel={`${t("Set {n}", { n: j + 1 })}, ${t(timed ? "Seconds" : "Reps")}`}
                    style={input}
                  />
                  <View style={{ flex: 1 }} />
                  <Springy
                    onPress={() => dropSet(i, j)}
                    accessibilityRole="button"
                    accessibilityLabel={t("Remove set {n}", { n: j + 1 })}
                    style={{ padding: 6 }}
                  >
                    <Icon name="close" size={16} color={c.sec} />
                  </Springy>
                </Row>
                {s.note != null ? (
                  <View style={{ marginTop: 6, marginStart: 52 }}>
                    <NoteInput
                      value={s.note}
                      onChange={(v) => setNote(i, j, v)}
                      placeholder={t("Note for this set")}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}
      {!left ? (
        <Text variant="small" color="sec" center>
          {t("Nothing left in this workout. Delete it instead.")}
        </Text>
      ) : null}
      <Button
        icon="check"
        title={t("Save changes")}
        disabled={!left}
        onPress={() =>
          onSave(
            draft.map(({ ex: { note: _n, ...ex }, note, sets }) => ({
              ...ex,
              ...(cleanNote(note) ? { note: cleanNote(note) } : {}),
              // Weights back to kg; a set with no reps is dropped.
              sets: sets
                .map((s) => ({
                  w:
                    s.w === s.shown
                      ? s.kg
                      : Math.round(W.toKg(num(s.w)) * 100) / 100,
                  r: Math.round(num(s.r)),
                  ...(cleanNote(s.note) ? { note: cleanNote(s.note) } : {}),
                }))
                .filter((s) => s.r > 0),
            })),
          )
        }
      />
      <Button kind="ghost" title={t("Cancel")} onPress={onCancel} />
    </View>
  );
}
