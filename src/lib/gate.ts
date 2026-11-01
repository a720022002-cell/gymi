import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * Invite-only launch (supabase/migrations/20261209000000_waitlist_gate.sql). Before signing in, the app asks for a
 * code unless this phone already got in, or the team switched the gate off. Anyone signed in is never stopped.
 */
const OPEN = 'adro.gate.open.v1';
const WAIT = 'adro.gate.wait.v1';

export type Waiting = { email: string; ref: string };
let opened: boolean | null = null;
const subs = new Set<() => void>();

/** 'open' (go on to the app) or 'closed' (show the gate). Locked unless the server says the gate is off (or this phone got in). */
export async function gateState(): Promise<'open' | 'closed'> {
  if (opened == null) opened = (await AsyncStorage.getItem(OPEN).catch(() => null)) === '1';
  if (opened) return 'open';
  const { data, error } = await supabase.rpc('gate_on');
  if (error) return 'closed';
  return data === true ? 'closed' : 'open';
}
export function useGate() {
  const [s, setS] = useState<'loading' | 'open' | 'closed'>(opened ? 'open' : 'loading');
  useEffect(() => {
    let alive = true;
    const check = () => gateState().then((v) => alive && setS(v));
    check();
    subs.add(check);
    return () => {
      alive = false;
      subs.delete(check);
    };
  }, []);
  return s;
}

/** Try a code. true: the app opens on this phone from now on. */
export async function tryCode(code: string) {
  const { data, error } = await supabase.rpc('gate_try', { p_code: code.trim() });
  if (error || data !== true) return false;
  opened = true;
  await AsyncStorage.setItem(OPEN, '1').catch(() => {});
  subs.forEach((f) => f());
  return true;
}

/** Join the waitlist: your own code to share comes back (null if it didn't work). */
export async function joinWaitlist(email: string, friendCode: string, lang: 'en' | 'ar'): Promise<string | null> {
  const { data, error } = await supabase.rpc('waitlist_join', { p_email: email.trim(), p_ref: friendCode.trim() || null, p_lang: lang });
  if (error || typeof data !== 'string') return null;
  await AsyncStorage.setItem(WAIT, JSON.stringify({ email: email.trim().toLowerCase(), ref: data })).catch(() => {});
  return data;
}
export async function myWaiting(): Promise<Waiting | null> {
  const v = await AsyncStorage.getItem(WAIT).catch(() => null);
  try {
    return v ? (JSON.parse(v) as Waiting) : null;
  } catch {
    return null;
  }
}
/** How many friends joined with your code. */
export async function friendsJoined(ref: string) {
  const { data } = await supabase.rpc('waitlist_friends', { p_ref: ref });
  return typeof data === 'number' ? data : 0;
}

// The team's dashboard.
export type WaitRow = { id: string; email: string; lang: string; ref: string; ref_by: string | null; created_at: string; invite: string | null; invited_at: string | null; emailed_at: string | null; used_at: string | null; friends: number };
export type GateCode = { code: string; label: string; max: number | null; uses: number; active: boolean };
export type WaitBoard = { on: boolean; codes: GateCode[]; total: number; today: number; week: number; from_friends: number; invited: number; opened: number; list: WaitRow[] };
export async function waitBoard() {
  const { data, error } = await supabase.rpc('admin_waitlist');
  return error ? null : (data as WaitBoard);
}
export const setGateOn = async (on: boolean) => !(await supabase.rpc('admin_gate_set', { p_on: on })).error;
export const saveGateCode = async (code: string, label: string, max: number | null, active = true) =>
  !(await supabase.rpc('admin_gate_code', { p_code: code, p_label: label, p_max: max, p_active: active })).error;
/** Let people in: personal codes, then the email with their code. How many got the email. */
export async function letIn(ids: string[]) {
  const { error } = await supabase.rpc('admin_waitlist_invite', { p_ids: ids });
  if (error) return null;
  const { data } = await supabase.functions.invoke('gate', { body: { ids } });
  return (data as { sent?: number } | null)?.sent ?? 0;
}
