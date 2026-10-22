// Each day's goals as they were (daily_goals), so changing a goal doesn't re-judge earlier days.
//
// The rule: a row holds the day's base goals (calories and protein as shown, coach's and pregnancy extra included,
// and the plan's water). Day-specific extras (calories moved to or from the day, cardio, the watch's extra movement,
// a training day's extra water) are added on top from that day's own logs, as before. Today always uses your live
// goals. An earlier day uses its own row, else the latest earlier row (goals stay until you change them), else your
// current goals (days from before snapshots existed).
import { supabase } from './supabase';

export type DayGoals = { kcal: number; protein: number; water: number };
export type GoalRow = DayGoals & { day: string };

const num = (v: unknown) => Math.round(Number(v) || 0);
const row = (r: Record<string, unknown>): GoalRow => ({ day: String(r.day), kcal: num(r.kcal), protein: num(r.protein), water: num(r.water) });

/**
 * Rows from `from` to `to` (oldest first), plus the latest one before `from` (it still counts for the first days).
 * Empty when they can't be read (no connection, or the table isn't there yet): days then use your current goals.
 */
export async function loadGoalRows(from: string, to: string): Promise<GoalRow[]> {
  try {
    const [inRange, before] = await Promise.all([
      supabase.from('daily_goals').select('day,kcal,protein,water').gte('day', from).lte('day', to).order('day').limit(1000),
      supabase.from('daily_goals').select('day,kcal,protein,water').lt('day', from).order('day', { ascending: false }).limit(1),
    ]);
    if (inRange.error) return [];
    return [...((before.data as Record<string, unknown>[] | null) ?? []), ...((inRange.data as Record<string, unknown>[] | null) ?? [])].map(row);
  } catch {
    return [];
  }
}

/** The goals that counted on a day: its own row, else the latest earlier one (rows oldest first). */
export function goalsOn(rows: GoalRow[] | null | undefined, day: string): DayGoals | null {
  if (!rows?.length) return null;
  let hit: GoalRow | null = null;
  for (const r of rows) {
    if (r.day > day) break;
    hit = r;
  }
  return hit && hit.kcal > 0 ? hit : null;
}

/** Save today's goals (quietly: a missing table or no connection just skips it). */
export async function saveDayGoals(userId: string, day: string, g: DayGoals) {
  try {
    await supabase.from('daily_goals').upsert({ user_id: userId, day, kcal: num(g.kcal), protein: num(g.protein), water: num(g.water), updated_at: new Date().toISOString() });
  } catch {}
}
