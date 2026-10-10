import * as LocalAuthentication from 'expo-local-authentication';

export const lockSupported = true;
/** Ask for Face ID / fingerprint (falls back to the phone passcode). */
export async function unlock(msg: string) {
  const has = await LocalAuthentication.hasHardwareAsync();
  const enrolled = has && (await LocalAuthentication.isEnrolledAsync());
  if (!enrolled) return true;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: msg });
  return r.success;
}
