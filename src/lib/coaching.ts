import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import { supabase } from './supabase';
import type { PlanEx } from './training';

/** A coach package. New packages are the 4 fixed durations in PKGS (id m1/m3/m6/m12) with on, months and inc. */
export type Package = { id: string; name: string; price: number; weeks: number; desc: string; on?: boolean; months?: number; inc?: string[] };
export type CoachCard = { id: string; name: string | null; username: string; bio: string; specialties: string[]; city: string; gym: string; price_month: number | null; years: number | null; clients: number; coach_type: string; packages: Package[]; spots: number; socials: Record<string, string>; hours: GymHours[]; headline?: string; about?: string; sessions?: number; listed?: boolean };

/** The package durations a coach can offer (design: PKGS). */
export const PKGS: [id: string, name: string, months: number][] = [
  ['m1', 'Monthly', 1],
  ['m3', '3 months', 3],
  ['m6', '6 months', 6],
  ['m12', '1 year', 12],
];
/** What a package can include (design: INCLUDES). */
export const INCLUDES = ['Custom workout plan', 'Custom meal plan', 'Chat with your coach', 'Weekly check-in', 'Video form checks', 'Monthly body review', 'Progress report', 'In-person sessions'];

/** Always the 4 fixed packages; old free-form ones move to the closest duration. */
export function normalizePackages(list: Package[] | null | undefined): Package[] {
  const old = list ?? [];
  const fixed = old.length && old.every((x) => x.months != null);
  return PKGS.map(([id, name, months]) => {
    const hit = fixed
      ? old.find((x) => x.id === id)
      : old.find((x) => {
          const w = x.weeks || 4;
          return (w <= 6 ? 'm1' : w <= 18 ? 'm3' : w <= 39 ? 'm6' : 'm12') === id;
        });
    return { id, name, months, weeks: months * 4, on: fixed ? !!hit?.on : !!hit, price: hit?.price ?? 0, desc: hit?.desc ?? '', inc: hit?.inc ?? [] };
  });
}
/** Packages a member can pick. */
export const activePackages = (list: Package[] | null | undefined) => normalizePackages(list).filter((x) => x.on);
/** Lowest price a month over the packages that are on. */
export function fromPrice(list: Package[] | null | undefined) {
  const on = activePackages(list).filter((x) => x.price > 0);
  return on.length ? Math.min(...on.map((x) => Math.round(x.price / (x.months || 1)))) : null;
}
/** Spots left before a coach is full. */
export const spotsLeft = (k: Pick<CoachCard, 'spots' | 'clients'>) => Math.max(0, k.spots - k.clients);
/** When an in-person coach is at the gym. days: 0 = Sunday … 6 = Saturday, times as "17:00". */
export type GymHours = { days: number[]; from: string; to: string };

/** One-hour meeting slots inside a coach's hours on one day. */
export function hourSlots(hours: GymHours[], day: number) {
  const out: string[] = [];
  for (const h of hours.filter((x) => x.days.includes(day))) {
    const [a, m] = h.from.split(':').map(Number);
    const [b, bm] = h.to.split(':').map(Number);
    for (let x = a; x * 60 + m + 60 <= b * 60 + bm; x++) out.push(`${String(x).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return [...new Set(out)].sort();
}

export type MyCoach = { id: string; coach_id: string; name: string | null; username: string; status: 'active' | 'requested'; kcal: number | null; protein: number | null; bio: string | null; specialties: string[] | null; gym: string | null; coach_type: string | null; hours: GymHours[]; package?: string | null; joined_at?: string | null };
export type ClientLink = { id: string; client_id: string | null; name: string | null; username: string | null; status: 'invited' | 'requested' | 'active'; code: string | null; kcal: number | null; protein: number | null; created_at: string; last_day: string | null; streak: number | null; package: string | null; program_id: string | null; meal_plan_id: string | null };
/** kind 'meet' = meeting request (meta: day 0-6, time "17:00", status pending/confirmed/declined); 'nudge' = check-in reminder. */
export type Message = { id: string; link_id: string; sender: string; text: string; created_at: string; kind?: 'text' | 'meet' | 'nudge'; meta?: { day?: number; time?: string; status?: 'pending' | 'confirmed' | 'declined' } | null };
export type CoachProfile = { bio: string; specialties: string[]; city: string; gym: string; price_month: number | null; years: number | null; listed: boolean; coach_type: string; packages: Package[]; max_clients: number; socials: Record<string, string>; hours: GymHours[]; headline?: string; about?: string; sessions?: number; auto_relist?: boolean };
export type ClientSummary = {
  name: string | null;
  username: string;
  gender: string | null;
  dob: string | null;
  height: number | null;
  plan: { goal?: number; weight?: number };
  streak: number;
  weights: { day: string; value: number }[];
  workouts: { day: string; name: string; minutes: number; volume: number; prs: { n: string; w: number }[] }[];
  food: { day: string; kcal: number; protein: number }[];
  today: { name: string; meal: string | null; kcal: number; protein: number }[];
  checkins: { day: string; sleep_h: number | null; energy: number | null; sore: number | null; score: number | null }[];
  water: { day: string; ml: number }[];
  steps?: { day: string; steps: number }[];
  /** What the client aims for: coach targets first, then the coach's meal plan, then their own plan. days = workouts a week. */
  targets?: { kcal: number; protein: number; water: number; days: number };
};

export const EMPTY_COACH: CoachProfile = { bio: '', specialties: [], city: '', gym: '', price_month: null, years: null, listed: true, coach_type: 'Personal', packages: [], max_clients: 20, socials: {}, hours: [], headline: '', about: '', sessions: 2, auto_relist: true };
export const SOCIALS: [string, string][] = [
  ['Instagram', '@yourname'],
  ['TikTok', '@yourname'],
  ['Snapchat', 'yourname'],
  ['X', '@yourname'],
  ['YouTube', '@yourchannel'],
  ['Facebook', 'facebook.com/yourpage'],
  ['Threads', '@yourname'],
  ['LinkedIn', 'linkedin.com/in/yourname'],
  ['WhatsApp', '+966 5X XXX XXXX'],
  ['Website', 'yoursite.com'],
];

export const SPECIALTIES = ['Fat loss', 'Muscle', 'Strength', 'Beginners', 'Women', 'Nutrition', 'Sports', 'Rehab'];

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  return error ? null : ((data ?? null) as T | null);
};

export const listCoaches = async () => (await rpc<CoachCard[]>('list_coaches')) ?? [];
/** One coach's page: listed coaches (also when full), your own coach, or yourself (preview). */
export const coachCard = async (id: string) => ((await rpc<CoachCard[]>('coach_card', { p_id: id })) ?? [])[0] ?? null;
export const requestCoach = async (id: string) => (await rpc<string>('request_coach', { p_coach: id })) ?? 'failed';
export const redeemCode = async (code: string) => (await rpc<string>('redeem_coach_code', { p_code: code })) ?? 'failed';
export const myCoach = async () => ((await rpc<MyCoach[]>('my_coach')) ?? [])[0] ?? null;
export const endCoaching = async (link: string) => !!(await rpc<boolean>('end_coaching', { p_link: link }));
export const coachInvite = async () => await rpc<string>('coach_invite');
export const coachList = async () => (await rpc<ClientLink[]>('coach_list')) ?? [];
export const coachRespond = async (link: string, accept: boolean) => !!(await rpc<boolean>('coach_respond', { p_link: link, p_accept: accept }));
export const clientSummary = async (client: string) => await rpc<ClientSummary>('client_summary', { p_client: client });
export const setTargets = async (link: string, kcal: number, protein: number) => !!(await rpc<boolean>('coach_set_targets', { p_link: link, p_kcal: kcal, p_protein: protein }));

export async function getNote(client: string) {
  const { data } = await supabase.from('coach_notes').select('text').eq('client_id', client).maybeSingle();
  return (data as { text: string } | null)?.text ?? '';
}
export async function saveNote(coach: string, client: string, text: string) {
  const { error } = await supabase.from('coach_notes').upsert({ coach_id: coach, client_id: client, text: text.slice(0, 2000) });
  return !error;
}

export async function messages(link: string) {
  const { data } = await supabase.from('coach_messages').select('id,link_id,sender,text,created_at,kind,meta').eq('link_id', link).order('created_at').limit(300);
  return (data as Message[]) ?? [];
}
export async function sendMessage(link: string, text: string, kind: Message['kind'] = 'text', meta?: Message['meta']) {
  const { data, error } = await supabase
    .from('coach_messages')
    .insert({ link_id: link, text: text.slice(0, 2000), kind, meta: meta ?? null })
    .select('id,link_id,sender,text,created_at,kind,meta')
    .single();
  return error ? null : (data as Message);
}
/** Coach answers a meeting request (the reply text is sent as a normal message). */
export const meetingReply = async (msg: string, ok: boolean) => !!(await rpc<boolean>('coach_meeting_reply', { p_msg: msg, p_ok: ok }));

export async function getCoachProfile(uid: string): Promise<CoachProfile | null> {
  const { data } = await supabase.from('coach_profiles').select('bio,specialties,city,gym,price_month,years,listed,coach_type,packages,max_clients,socials,hours,headline,about,sessions,auto_relist').eq('user_id', uid).maybeSingle();
  return (data as CoachProfile) ?? null;
}
export async function saveCoachProfile(uid: string, p: CoachProfile) {
  const { error } = await supabase.from('coach_profiles').upsert({ user_id: uid, ...p, updated_at: new Date().toISOString() });
  return !error;
}

export const ageOf = (dob: string | null) => {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
};

// ---------------------------------------------------------------------------
// Programs and meal plans (coach side) and what clients see
// ---------------------------------------------------------------------------
export type ProgEx = PlanEx;
export type ProgDay = { name: string; ex: ProgEx[] };
export type Program = { id: string; name: string; days: ProgDay[]; updated_at?: string };
/** One ingredient of a coach's meal, with its share of calories and macros. */
export type PlanIng = { id: string; n: string; g: number; k: number; p: number; c: number; f: number };
export type PlanMeal = { n: string; t: string; k: number; p: number; d: string; c?: number; f?: number; ing?: PlanIng[] };
export type MealPlan = { id: string; name: string; meals: PlanMeal[]; updated_at?: string };

export async function listPrograms() {
  const { data } = await supabase.from('coach_programs').select('id,name,days,updated_at').order('updated_at', { ascending: false });
  return (data as Program[]) ?? [];
}
export async function saveProgram(p: Omit<Program, 'id'> & { id?: string }) {
  const row = { name: p.name.trim().slice(0, 60) || 'Program', days: p.days, updated_at: new Date().toISOString() };
  const q = p.id ? supabase.from('coach_programs').update(row).eq('id', p.id) : supabase.from('coach_programs').insert(row);
  const { data, error } = await q.select('id,name,days,updated_at').single();
  return error ? null : (data as Program);
}
export async function deleteProgram(id: string) {
  const { error } = await supabase.from('coach_programs').delete().eq('id', id);
  return !error;
}
export async function listMealPlans() {
  const { data } = await supabase.from('coach_meal_plans').select('id,name,meals,updated_at').order('updated_at', { ascending: false });
  return (data as MealPlan[]) ?? [];
}
export async function saveMealPlan(p: Omit<MealPlan, 'id'> & { id?: string }) {
  const row = { name: p.name.trim().slice(0, 60) || 'Meal plan', meals: p.meals, updated_at: new Date().toISOString() };
  const q = p.id ? supabase.from('coach_meal_plans').update(row).eq('id', p.id) : supabase.from('coach_meal_plans').insert(row);
  const { data, error } = await q.select('id,name,meals,updated_at').single();
  return error ? null : (data as MealPlan);
}
export async function deleteMealPlan(id: string) {
  const { error } = await supabase.from('coach_meal_plans').delete().eq('id', id);
  return !error;
}
export const assign = async (link: string, program: string | null, meal: string | null) => !!(await rpc<boolean>('coach_assign', { p_link: link, p_program: program, p_meal: meal }));
/** The coach's meal plan with its daily totals (sum of the meals). */
export type CoachMealPlan = MealPlan & { kcal?: number; protein?: number };
export type CoachPlans = { link_id: string; coach_id: string; coach: string; kcal: number | null; protein: number | null; program: Program | null; meals: CoachMealPlan | null };
/** Member: the program and meal plan from your coach, with the coach's name and targets. null = no active coach. */
export const myCoachPlans = async () => await rpc<CoachPlans>('my_coach_plans');
/** Calories and protein a day for a meal plan (sum of its meals). */
export function mealPlanTotals(m: Pick<MealPlan, 'meals'> | null | undefined) {
  const meals = m?.meals ?? [];
  return { kcal: Math.round(meals.reduce((a, x) => a + (+x.k || 0), 0)), protein: Math.round(meals.reduce((a, x) => a + (+x.p || 0), 0)) };
}
/** Change just the program or just the meal plan of a client or invite, keeping the other. */
export async function assignOne(link: string, kind: 'program' | 'meal', id: string | null) {
  const l = (await coachList()).find((x) => x.id === link);
  if (!l) return false;
  return assign(link, kind === 'program' ? id : l.program_id, kind === 'meal' ? id : l.meal_plan_id);
}
export type InboxRow = { link_id: string; client_id: string; name: string | null; username: string; last_text: string | null; last_sender: string | null; last_at: string | null };
export const coachInbox = async () => (await rpc<InboxRow[]>('coach_inbox')) ?? [];
export const broadcast = async (text: string) => (await rpc<number>('coach_broadcast', { p_text: text })) ?? 0;
export const requestCoachPackage = async (id: string, pkg: string) => (await rpc<string>('request_coach_package', { p_coach: id, p_package: pkg })) ?? 'failed';

// ---------------------------------------------------------------------------
// Coach application
// ---------------------------------------------------------------------------
export type CertFile = { path: string; name: string };
export type Application = { id: string; coach_type: string; gym: string; city: string; years: string; specialties: string[]; certs: string; socials: Record<string, string>; bio: string; hours: GymHours[]; cert_files?: CertFile[]; status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; reason: string | null; created_at: string; reviewed_at: string | null };
export async function myApplication() {
  const { data } = await supabase.from('coach_applications').select('*').neq('status', 'withdrawn').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as Application) ?? null;
}
export async function applyCoach(a: Omit<Application, 'id' | 'status' | 'reason' | 'created_at' | 'reviewed_at'>) {
  const { error } = await supabase.rpc('apply_coach', { p: a });
  return !error;
}
export const withdrawApplication = async () => !!(await rpc<boolean>('withdraw_coach_application'));

/** Upload a certificate (PDF or photo) to the private coach-certs bucket under your own folder. */
export async function uploadCert(uid: string, f: { name: string; uri: string; mimeType?: string; file?: Blob }): Promise<CertFile | null> {
  try {
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    const type = f.mimeType || (ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const body = f.file ?? (await (await fetch(f.uri)).arrayBuffer());
    const path = `${uid}/${Date.now().toString(36)}.${ext.replace(/[^a-z0-9]/g, '') || 'jpg'}`;
    const { error } = await supabase.storage.from('coach-certs').upload(path, body, { contentType: type, upsert: false });
    return error ? null : { path, name: f.name.slice(0, 120) };
  } catch {
    return null;
  }
}
/** A short-lived link to open a certificate (owner or Adro team). */
export async function certUrl(path: string) {
  const { data } = await supabase.storage.from('coach-certs').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Commitment ranking, to-dos, settings and sharing (coach side)
// ---------------------------------------------------------------------------
/** Commitment parts in % over the last 30 days. */
export type CommitParts = { workouts: number; calories: number; protein: number; water: number; sleep: number; total: number; days: number };
export type RankRow = { link_id: string; client_id: string; commit: number | null; prev: number | null; parts: CommitParts | null; joined_at: string | null; last_food: string | null; last_workout: string | null; welcomed: boolean; todos: number };
/** Active clients with their 30-day commitment (best first) and the change from the 30 days before. */
export const coachRanking = async () => (await rpc<RankRow[]>('coach_ranking')) ?? [];
/** Joined in the last 7 days: ranking starts after their first week. */
export const isNewClient = (r: Pick<RankRow, 'joined_at'>, now: number) => !!r.joined_at && now - new Date(r.joined_at).getTime() < 7 * 864e5;
/** Ranked list: new clients last, then best commitment first. */
export function rankClients(rows: RankRow[], now: number) {
  return [...rows].sort((a, b) => Number(isNewClient(a, now)) - Number(isNewClient(b, now)) || (b.commit ?? -1) - (a.commit ?? -1));
}

export const TODO_DUE = ['Today', 'Tomorrow', 'Next session', 'This week'] as const;
export type Todo = { id: string; link_id: string; text: string; due: (typeof TODO_DUE)[number] | null; done: boolean; created_at: string };
export async function listTodos(link: string) {
  const { data } = await supabase.from('coach_todos').select('id,link_id,text,due,done,created_at').eq('link_id', link).order('created_at');
  return (data as Todo[]) ?? [];
}
export async function addTodo(link: string, text: string, due: Todo['due'], id?: string) {
  const row = { link_id: link, text: text.trim().slice(0, 200), due, ...(id ? { id } : {}) };
  const { data, error } = await supabase.from('coach_todos').insert(row).select('id,link_id,text,due,done,created_at').single();
  return error ? null : (data as Todo);
}
export async function setTodoDone(id: string, done: boolean) {
  const { error } = await supabase.from('coach_todos').update({ done }).eq('id', id);
  return !error;
}
export async function deleteTodo(id: string) {
  const { error } = await supabase.from('coach_todos').delete().eq('id', id);
  return !error;
}

/** Coach notification settings (design: cnotif). Times are "HH:MM"; weekly.day 0 = Sunday. */
export type CoachNotif = {
  on: boolean;
  msgs: boolean;
  meet: boolean;
  low: { on: boolean; th: number };
  missed: { on: boolean; n: number };
  nofood: { on: boolean; n: number };
  weight: { on: boolean; kg: number };
  prs: boolean;
  join: boolean;
  daily: { on: boolean; t: string };
  weekly: { on: boolean; day: number; t: string };
  gymi: boolean;
  quiet: { on: boolean; from: string; to: string };
};
export const COACH_NOTIF: CoachNotif = {
  on: true,
  msgs: true,
  meet: true,
  low: { on: true, th: 60 },
  missed: { on: true, n: 2 },
  nofood: { on: true, n: 2 },
  weight: { on: false, kg: 2 },
  prs: true,
  join: true,
  daily: { on: true, t: '20:00' },
  weekly: { on: true, day: 0, t: '09:00' },
  gymi: true,
  quiet: { on: false, from: '23:00', to: '07:00' },
};
export async function getCoachNotif(): Promise<CoachNotif> {
  const { data } = await supabase.from('coach_settings').select('notif').maybeSingle();
  const n = ((data as { notif: Partial<CoachNotif> } | null)?.notif ?? {}) as Partial<CoachNotif>;
  const d = COACH_NOTIF;
  return { ...d, ...n, low: { ...d.low, ...n.low }, missed: { ...d.missed, ...n.missed }, nofood: { ...d.nofood, ...n.nofood }, weight: { ...d.weight, ...n.weight }, daily: { ...d.daily, ...n.daily }, weekly: { ...d.weekly, ...n.weekly }, quiet: { ...d.quiet, ...n.quiet } };
}
export async function saveCoachNotif(uid: string, n: CoachNotif) {
  const { error } = await supabase.from('coach_settings').upsert({ user_id: uid, notif: n, updated_at: new Date().toISOString() });
  return !error;
}
/** Commitment under this % needs attention (the coach's "Low commitment" setting, 60 by default). */
export const lowLine = (n: CoachNotif | null) => (n?.on !== false && n?.low.on !== false ? (n?.low.th ?? 60) : 60);

/** Share text with the phone's share sheet (or the browser's); falls back to copying it. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    try {
      await Clipboard.setStringAsync(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
export async function copyText(text: string) {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
