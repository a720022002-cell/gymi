import type { Reminder } from './reminders.shared';

export * from './reminders.shared';

/** Web: reminders need the phone app. */
export const remindersSupported = false;
export async function scheduleReminders(_r: Reminder[], _ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  return 'unsupported';
}
export async function notifPermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  return 'unsupported';
}
export async function askNotifPermission() {
  return false;
}
/** Nothing is scheduled on the web. */
export async function cancelAllReminders() {}
export function listenReminderTaps(_go: (route: string) => void) {
  return () => {};
}
