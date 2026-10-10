import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { profileComplete, useAuth } from '@/lib/auth';
import { claimReferral } from '@/lib/social';

export const REF_KEY = 'gymi.ref.v1';

/** If you opened someone's invite link before signing up, tell the server who invited you (once). */
export function ReferralClaim() {
  const { session, profile } = useAuth();
  const ready = !!session && profileComplete(profile);
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.getItem(REF_KEY)
      .then(async (ref) => {
        if (!ref) return;
        await claimReferral(ref);
        await AsyncStorage.removeItem(REF_KEY);
      })
      .catch(() => {});
  }, [ready]);
  return null;
}
