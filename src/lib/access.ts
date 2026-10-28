import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

/** Your access, from the server (public.my_access): subscribed (or a gift, or free months from invites), the free trial, or free. */
export type Access = {
  tier: 'sub' | 'trial' | 'free';
  /** When it ends (trial end, paid time, or free months); null when it doesn't. */
  until: string | null;
  why: 'paid' | 'gift' | 'invites' | 'trial' | 'free' | 'admin';
  photos_today: number;
  chats_today: number;
};

/** The free trial: 3 photos and 4 coach messages a day for 7 days. */
export const TRIAL = { photos: 3, chats: 4, days: 7 };

let cache: Access | null = null;
const subs = new Set<(a: Access | null) => void>();

/** Reads your access again (after buying, restoring or a day passing) and tells every screen showing it. */
export async function refreshAccess() {
  const { data, error } = await supabase.rpc('my_access');
  cache = error || !data ? null : (data as Access);
  subs.forEach((f) => f(cache));
  return cache;
}

export function useAccess() {
  const [a, setA] = useState<Access | null>(cache);
  useEffect(() => {
    subs.add(setA);
    refreshAccess().catch(() => {});
    return () => {
      subs.delete(setA);
    };
  }, []);
  const refresh = useCallback(() => refreshAccess().catch(() => null), []);
  return { access: a, refresh };
}

/** Whole days left until a date (at least 0). */
export const daysLeft = (until: string | null) => (until ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000)) : 0);
