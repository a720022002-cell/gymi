import { supabase } from './supabase';

export type CoachCard = { id: string; name: string | null; username: string; bio: string; specialties: string[]; city: string; gym: string; price_month: number | null; years: number | null; clients: number };
export type MyCoach = { id: string; coach_id: string; name: string | null; username: string; status: 'active' | 'requested'; kcal: number | null; protein: number | null; bio: string | null; specialties: string[] | null };
export type ClientLink = { id: string; client_id: string | null; name: string | null; username: string | null; status: 'invited' | 'requested' | 'active'; code: string | null; kcal: number | null; protein: number | null; created_at: string; last_day: string | null; streak: number | null };
export type Message = { id: string; link_id: string; sender: string; text: string; created_at: string };
export type CoachProfile = { bio: string; specialties: string[]; city: string; gym: string; price_month: number | null; years: number | null; listed: boolean };
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
  const { data } = await supabase.from('coach_profiles').select('bio,specialties,city,gym,price_month,years,listed').eq('user_id', uid).maybeSingle();
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
