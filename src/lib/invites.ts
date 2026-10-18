import AsyncStorage from '@react-native-async-storage/async-storage';

import { siteUrl } from './config';
import { supabase } from './supabase';

/** A free month of Pro for every 5 friends who join with your code (design: REF_GOAL). */
export const REF_GOAL = 5;

/** `count`: friends who joined and have used Gymi on 2 days (they count toward free months); `waiting`: joined, not yet. */
export type MyInvite = { code: string | null; count: number; waiting?: number; months: number };
/** 'slow': too many wrong codes in the last hour (they're limited, so codes can't be guessed). */
export type ClaimResult = { status: 'ok' | 'friends' | 'requested' | 'bad' | 'self' | 'auth' | 'failed' | 'slow'; name?: string | null; username?: string; referral?: boolean };

/** Your personal code ("OMAR-7K2QXP"), how many friends joined with it and the free months earned. */
export async function myInvite(): Promise<MyInvite> {
  const { data } = await supabase.rpc('my_invite');
  return (data as MyInvite | null) ?? { code: null, count: 0, months: 0 };
}

/**
 * Use a friend's invite code (or username): it sends them a friend request to accept. 'friends' = you're Gym Bros now
 * (they had already asked you, or you were friends), 'requested' = request sent. `referral`: it counted toward their free month.
 */
export async function claimInvite(code: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_invite', { p_code: code.trim() });
  if (error || !data) return { status: 'failed' };
  return data as ClaimResult;
}

/** The link friends open: it carries your code and fills it in for them. */
export const inviteLink = (code: string) => `${siteUrl()}/welcome?ref=${encodeURIComponent(code)}`;

/** Text for Share invite (design: shareInvite). */
export const inviteText = (code: string, t: (s: string, v?: Record<string, string | number>) => string) =>
  t('Join me on Gymi, the AI fitness coach. Use my code {c} when you sign up to send me a friend request.', { c: code }) + ` ${inviteLink(code)}`;

/** Free months you've already been told about, so "You earned a free month!" shows once. */
const SEEN = (uid: string) => `gymi.freemonths.seen.v1.${uid}`;
export async function newFreeMonths(uid: string, months: number) {
  try {
    const seen = Number((await AsyncStorage.getItem(SEEN(uid))) ?? '-1');
    await AsyncStorage.setItem(SEEN(uid), String(months));
    // First time on this phone: just remember, don't celebrate old months.
    return seen >= 0 && months > seen;
  } catch {
    return false;
  }
}
