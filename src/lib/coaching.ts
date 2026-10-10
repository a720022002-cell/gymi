import { supabase } from './supabase';
import type { PlanEx } from './training';

export type Package = { id: string; name: string; price: number; weeks: number; desc: string };
export type CoachCard = { id: string; name: string | null; username: string; bio: string; specialties: string[]; city: string; gym: string; price_month: number | null; years: number | null; clients: number; coach_type: string; packages: Package[]; spots: number; socials: Record<string, string> };
export type MyCoach = { id: string; coach_id: string; name: string | null; username: string; status: 'active' | 'requested'; kcal: number | null; protein: number | null; bio: string | null; specialties: string[] | null };
export type ClientLink = { id: string; client_id: string | null; name: string | null; username: string | null; status: 'invited' | 'requested' | 'active'; code: string | null; kcal: number | null; protein: number | null; created_at: string; last_day: string | null; streak: number | null; package: string | null; program_id: string | null; meal_plan_id: string | null };
export type Message = { id: string; link_id: string; sender: string; text: string; created_at: string };
export type CoachProfile = { bio: string; specialties: string[]; city: string; gym: string; price_month: number | null; years: number | null; listed: boolean; coach_type: string; packages: Package[]; max_clients: number; socials: Record<string, string> };
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
};

export const EMPTY_COACH: CoachProfile = { bio: '', specialties: [], city: '', gym: '', price_month: null, years: null, listed: true, coach_type: 'Personal', packages: [], max_clients: 20, socials: {} };
export const SOCIALS: [string, string][] = [
  ['Instagram', '@yourname'],
  ['TikTok', '@yourname'],
  ['Snapchat', 'yourname'],
  ['X', '@yourname'],
  ['YouTube', '@yourchannel'],
  ['WhatsApp', '+966 5X XXX XXXX'],
  ['Website', 'yoursite.com'],
];

export const SPECIALTIES = ['Fat loss', 'Muscle', 'Strength', 'Beginners', 'Women', 'Nutrition', 'Sports', 'Rehab'];

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  return error ? null : ((data ?? null) as T | null);
};

export const listCoaches = async () => (await rpc<CoachCard[]>('list_coaches')) ?? [];
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
  const { data } = await supabase.from('coach_messages').select('id,link_id,sender,text,created_at').eq('link_id', link).order('created_at').limit(300);
  return (data as Message[]) ?? [];
}
export async function sendMessage(link: string, text: string) {
  const { data, error } = await supabase.from('coach_messages').insert({ link_id: link, text: text.slice(0, 2000) }).select('id,link_id,sender,text,created_at').single();
  return error ? null : (data as Message);
}

export async function getCoachProfile(uid: string): Promise<CoachProfile | null> {
  const { data } = await supabase.from('coach_profiles').select('bio,specialties,city,gym,price_month,years,listed,coach_type,packages,max_clients,socials').eq('user_id', uid).maybeSingle();
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
export type PlanMeal = { n: string; t: string; k: number; p: number; d: string };
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
export const myCoachPlans = async () => await rpc<{ program: Program | null; meals: MealPlan | null }>('my_coach_plans');
export type InboxRow = { link_id: string; client_id: string; name: string | null; username: string; last_text: string | null; last_sender: string | null; last_at: string | null };
export const coachInbox = async () => (await rpc<InboxRow[]>('coach_inbox')) ?? [];
export const broadcast = async (text: string) => (await rpc<number>('coach_broadcast', { p_text: text })) ?? 0;
export const requestCoachPackage = async (id: string, pkg: string) => (await rpc<string>('request_coach_package', { p_coach: id, p_package: pkg })) ?? 'failed';

// ---------------------------------------------------------------------------
// Coach application
// ---------------------------------------------------------------------------
export type Application = { id: string; coach_type: string; gym: string; city: string; years: string; specialties: string[]; certs: string; socials: Record<string, string>; bio: string; status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; reason: string | null; created_at: string; reviewed_at: string | null };
export async function myApplication() {
  const { data } = await supabase.from('coach_applications').select('*').neq('status', 'withdrawn').order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as Application) ?? null;
}
export async function applyCoach(a: Omit<Application, 'id' | 'status' | 'reason' | 'created_at' | 'reviewed_at'>) {
  const { error } = await supabase.rpc('apply_coach', { p: a });
  return !error;
}
export const withdrawApplication = async () => !!(await rpc<boolean>('withdraw_coach_application'));
