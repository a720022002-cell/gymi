import { useEffect, useState } from 'react';

import type { IconName } from '@/components/Icon';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type AdminStats = { users: number; new_week: number; active_today: number; coaches: number; pending: number; workouts_week: number; meals_week: number; ai_today: number };
export type CoachQueueRow = {
  user_id: string; name: string | null; username: string; email: string | null; phone: string | null; coach_status: 'pending' | 'approved' | 'rejected' | null; joined: string;
  app_id: string | null; coach_type: string | null; gym: string | null; city: string | null; years: string | null; specialties: string[] | null; certs: string | null; socials: Record<string, string> | null; bio: string | null; applied: string | null; reason: string | null;
  cert_files?: { path: string; name: string }[]; hours?: { days: number[]; from: string; to: string }[];
};
/** Reasons the team can pick when a coach isn't approved (design: adminreject). */
export const REJECT_REASONS = ['Certificate not readable', 'Certificate not recognized', 'Missing gym details', 'Not enough experience'];
export type AdminUser = { id: string; name: string | null; username: string; email: string | null; account_type: string; coach_status: string | null; joined: string; last_day: string | null; is_admin: boolean };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  return error ? null : (data as T);
};

export const adminStats = () => rpc<AdminStats>('admin_stats');
export const coachQueue = async () => (await rpc<CoachQueueRow[]>('admin_coach_queue')) ?? [];
export const decideCoach = async (user: string, approve: boolean, reason?: string) => !!(await rpc<boolean>('admin_decide_coach', { p_user: user, p_approve: approve, p_reason: reason ?? null }));
export const adminUsers = async (q: string) => (await rpc<AdminUser[]>('admin_users', { p_q: q })) ?? [];

/** Is the logged-in person a Adro admin? (checked on the server) */
export function useIsAdmin() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [v, setV] = useState<{ uid: string; admin: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase.rpc('is_admin').then(({ data }) => alive && setV({ uid, admin: !!data }));
    return () => {
      alive = false;
    };
  }, [uid]);
  return !!uid && v?.uid === uid && v.admin;
}

// ---------------------------------------------------------------------------
// Accounting: purchases by the three partners and how each one is split
// ---------------------------------------------------------------------------
export type Partner = { id: string; name: string; user_id: string | null };
export type Share = { partner_id: string; amount: number; settled: boolean };
export type Expense = {
  id: string; day: string; title: string; category: string; amount: number; currency: 'SAR' | 'USD'; paid_by: string | null;
  bought: boolean; split: 'equal' | 'custom' | 'one'; note: string; created_by: string | null; shares: Share[];
};
export const EXPENSE_CATEGORIES: [string, string][] = [
  ['Servers & hosting', 'globe'],
  ['AI', 'sparkle'],
  ['Domain', 'globe'],
  ['Design', 'edit'],
  ['Marketing & ads', 'share'],
  ['App store fees', 'download'],
  ['Devices', 'phone'],
  ['Legal & company', 'doc'],
  ['Office', 'coffee'],
  ['Other', 'more'],
];
/** Money with 2 decimals only when needed: 1,250 or 12.50 */
export const sar = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 });
export const catIcon = (c: string) => (EXPENSE_CATEGORIES.find((x) => x[0] === c)?.[1] ?? 'more') as IconName;
/** 1 USD in SAR (pegged rate). */
export const USD_SAR = 3.75;
export const toSar = (amount: number, currency: string) => (currency === 'USD' ? amount * USD_SAR : amount);

export async function listPartners() {
  const { data } = await supabase.from('partners').select('id,name,user_id').order('sort');
  return (data as Partner[]) ?? [];
}
export async function listExpenses() {
  const { data } = await supabase
    .from('expenses')
    .select('id,day,title,category,amount,currency,paid_by,bought,split,note,created_by,expense_shares(partner_id,amount,settled)')
    .order('day', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  return ((data as (Omit<Expense, 'shares'> & { expense_shares: Share[] })[]) ?? []).map(({ expense_shares, ...e }) => ({
    ...e,
    amount: Number(e.amount),
    shares: (expense_shares ?? []).map((s) => ({ ...s, amount: Number(s.amount) })),
  }));
}
/** Save a purchase and replace its split. */
export async function saveExpense(e: Omit<Expense, 'id' | 'created_by'> & { id?: string }) {
  const { shares, ...row } = e;
  const body = { ...row, title: row.title.trim().slice(0, 120), note: row.note.trim().slice(0, 500), updated_at: new Date().toISOString() };
  const r = row.id ? await supabase.from('expenses').update(body).eq('id', row.id).select('id').single() : await supabase.from('expenses').insert(body).select('id').single();
  if (r.error || !r.data) return null;
  const id = (r.data as { id: string }).id;
  await supabase.from('expense_shares').delete().eq('expense_id', id);
  if (shares.length) {
    const { error } = await supabase.from('expense_shares').insert(shares.map((s) => ({ expense_id: id, partner_id: s.partner_id, amount: Math.round(s.amount * 100) / 100, settled: s.settled })));
    if (error) return null;
  }
  return id;
}
export const deleteExpense = async (id: string) => !(await supabase.from('expenses').delete().eq('id', id)).error;
export const setShareSettled = async (id: string, partner: string, settled: boolean) =>
  !(await supabase.from('expense_shares').update({ settled }).eq('expense_id', id).eq('partner_id', partner)).error;

/** Equal split of an amount between people, with the cents going to the first ones. */
export function equalShares(amount: number, people: string[]): Share[] {
  if (!people.length) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / people.length);
  return people.map((p, i) => ({ partner_id: p, amount: (base + (i < cents - base * people.length ? 1 : 0)) / 100, settled: false }));
}

/**
 * Who paid what, what each person's part costs, and who still owes whom (in SAR).
 * Only bought purchases count. A share is "settled" when that person has paid the buyer back.
 */
export function balances(partners: Partner[], expenses: Expense[]) {
  const paid: Record<string, number> = {};
  const part: Record<string, number> = {};
  const net: Record<string, number> = {};
  for (const p of partners) paid[p.id] = part[p.id] = net[p.id] = 0;
  for (const e of expenses) {
    if (!e.bought || !e.paid_by) continue;
    const k = e.currency === 'USD' ? USD_SAR : 1;
    paid[e.paid_by] = (paid[e.paid_by] ?? 0) + e.amount * k;
    for (const s of e.shares) {
      part[s.partner_id] = (part[s.partner_id] ?? 0) + s.amount * k;
      if (s.partner_id === e.paid_by || s.settled) continue;
      net[s.partner_id] = (net[s.partner_id] ?? 0) - s.amount * k;
      net[e.paid_by] = (net[e.paid_by] ?? 0) + s.amount * k;
    }
  }
  // Fewest payments to settle everything: biggest debtor pays biggest creditor.
  const owe = Object.entries(net).filter(([, v]) => v < -0.005).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const get = Object.entries(net).filter(([, v]) => v > 0.005).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const settle: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < owe.length && j < get.length) {
    const x = Math.min(owe[i].v, get[j].v);
    settle.push({ from: owe[i].id, to: get[j].id, amount: Math.round(x * 100) / 100 });
    owe[i].v -= x;
    get[j].v -= x;
    if (owe[i].v < 0.005) i++;
    if (get[j].v < 0.005) j++;
  }
  return { paid, part, net, settle };
}

// ---------------------------------------------------------------------------
// AI costs and server stats
// ---------------------------------------------------------------------------
export type AiCosts = {
  total: { calls: number; errors: number; cost: number; prompt: number; completion: number; users: number };
  days: { day: string; calls: number; cost: number }[];
  tasks: { task: string; calls: number; cost: number; tokens: number }[];
  models: { model: string; calls: number; cost: number }[];
  errors: { at: string; task: string; error: string | null }[];
};
export const aiCosts = (from: string, to: string) => rpc<AiCosts>('admin_ai_costs', { p_from: from, p_to: to });
export type AiCredits = { connected: boolean; credits?: number | null; used?: number | null; key_usage?: number | null; key_limit?: number | null; model?: string };
export async function aiCredits() {
  const { data, error } = await supabase.functions.invoke('ai', { body: { task: 'admin_credits' } });
  return error ? null : ((data as { result: AiCredits }).result ?? null);
}
export type ServerStats = {
  db_bytes: number; storage: { bucket: string; files: number; bytes: number }[]; users: number; new_7d: number; active_today: number; active_30d: number;
  ai_today: number; ai_errors_today: number; tables: { name: string; rows: number; bytes: number }[]; version: string;
};
export const serverStats = () => rpc<ServerStats>('admin_server_stats');
