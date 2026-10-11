import type { CycleReminders } from './cycle';

export type CyclePlan = { next: string; fertileFrom: string; cycle: number } | null;

/** Web: cycle reminders need the phone app. */
export const cycleRemindersSupported = false;
export async function scheduleCycleReminders(_r: CycleReminders, _plan: CyclePlan, _texts: CycleReminderTexts, _visit?: string | null, _ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  return 'unsupported';
}
export type CycleReminderTexts = { period: string; fertile: string; log: string; visit: string; title: string };
