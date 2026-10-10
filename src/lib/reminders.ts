import type { Reminder } from './reminders.shared';

export * from './reminders.shared';

/** Web: reminders need the phone app. */
export const remindersSupported = false;
export async function scheduleReminders(_r: Reminder[], _ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  return 'unsupported';
}
export function listenReminderTaps(_go: (route: string) => void) {
  return () => {};
}
