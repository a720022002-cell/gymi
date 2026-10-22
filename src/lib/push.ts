/** Web: no push notifications (messages show when you open Adro). */
export const pushSupported = false;

export type PushSettings = { messages: boolean; quiet: { on: boolean; from: string; to: string } | null };

export async function registerPush(_s: PushSettings): Promise<boolean> {
  return false;
}
export async function unregisterPush() {}
export function listenPushTaps(_go: (route: string) => void) {
  return () => {};
}
