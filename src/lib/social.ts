import { supabase } from './supabase';

export type Share = { workouts: boolean; prs: boolean; streak: boolean; weight: boolean; body: boolean };
export const DEFAULT_SHARE: Share = { workouts: true, prs: true, streak: true, weight: false, body: false };

export type FriendRow = {
  friendship_id: string;
  id: string;
  username: string;
  name: string | null;
  status: 'pending' | 'accepted';
  incoming: boolean;
  streak: number | null;
  last_workout: string | null;
  last_day: string | null;
};
export type Found = { id: string; username: string; name: string | null; relation: 'self' | 'friends' | 'sent' | 'received' | 'none' };
export type FriendProfile = {
  id: string;
  username: string;
  name: string | null;
  share: Share;
  streak?: number;
  week?: number;
  workouts?: { name: string; day: string; minutes: number; volume: number }[];
  prs?: { n: string; w: number }[];
  weights?: { day: string; value: number }[];
  body?: Record<string, number>;
};
export type FeedItem = { id: string; user_id: string; name: string | null; username: string; kind: string; text: string; data: Record<string, unknown> | null; created_at: string; cheers: number; cheered: boolean };
export type Group = { id: string; name: string; owner: string; members: number };
export type BoardRow = { user_id: string; name: string | null; username: string; workouts: number | null; volume: number | null };
export type Challenge = { id: string; kind: 'steps' | 'workouts' | 'volume'; start_day: string; end_day: string; members: number; creator_name: string | null };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  return { data: (data ?? null) as T | null, error };
};

export const displayName = (x: { name?: string | null; username: string }) => x.name || x.username;

export async function myFriends() {
  return (await rpc<FriendRow[]>('my_friends')).data ?? [];
}

export async function findUser(username: string) {
  const { data } = await rpc<Found[]>('find_user', { p_username: username });
  return data?.[0] ?? null;
}

export async function sendRequest(to: string) {
  const { error } = await supabase.from('friendships').insert({ addressee: to });
  return !error;
}

export async function acceptRequest(friendshipId: string) {
  const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  return !error;
}

export async function removeFriendship(friendshipId: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  return !error;
}

export async function friendProfile(id: string) {
  return (await rpc<FriendProfile>('friend_profile', { p_id: id })).data;
}

export async function getShare(userId: string): Promise<Share> {
  const { data } = await supabase.from('friend_share').select('workouts,prs,streak,weight,body').eq('user_id', userId).maybeSingle();
  return (data as Share) ?? DEFAULT_SHARE;
}

export async function saveShare(userId: string, s: Share) {
  const { error } = await supabase.from('friend_share').upsert({ user_id: userId, ...s });
  return !error;
}

export async function feed() {
  return (await rpc<FeedItem[]>('feed', { p_limit: 50 })).data ?? [];
}

export async function cheer(activityId: string, on: boolean) {
  const q = on ? supabase.from('cheers').insert({ activity_id: activityId }) : supabase.from('cheers').delete().eq('activity_id', activityId);
  const { error } = await q;
  return !error;
}

export async function postActivity(kind: 'workout' | 'pr' | 'streak' | 'badge' | 'post', text: string, data?: Record<string, unknown>) {
  const { error } = await supabase.from('activities').insert({ kind, text: text.slice(0, 300), data: data ?? null });
  return !error;
}

/** Share a finished workout (and new records) with friends, if you allow it. */
export async function shareWorkout(userId: string, w: { name: string; minutes: number; volume: number; prs: { n: string; w: number }[] }) {
  const s = await getShare(userId);
  if (s.workouts) await postActivity('workout', w.name, { minutes: w.minutes, volume: Math.round(w.volume) });
  if (s.prs) for (const p of w.prs.slice(0, 3)) await postActivity('pr', p.n, { w: p.w });
}

export async function myGroups(): Promise<Group[]> {
  const { data } = await supabase.from('groups').select('id,name,owner,group_members(count)').order('created_at', { ascending: false });
  return ((data as { id: string; name: string; owner: string; group_members: { count: number }[] }[]) ?? []).map((g) => ({ id: g.id, name: g.name, owner: g.owner, members: g.group_members?.[0]?.count ?? 1 }));
}

export async function createGroup(name: string, members: string[]) {
  return (await rpc<string>('create_group', { p_name: name, p_members: members })).data;
}

export async function addGroupMember(group: string, user: string) {
  return !!(await rpc<boolean>('add_group_member', { p_group: group, p_user: user })).data;
}

export async function leaveGroup(group: string, userId: string) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', group).eq('user_id', userId);
  return !error;
}

export async function groupBoard(group: string) {
  return (await rpc<BoardRow[]>('group_board', { p_group: group })).data ?? [];
}

export async function groupFeed(group: string) {
  return (await rpc<{ id: string; user_id: string; name: string | null; text: string; created_at: string }[]>('group_feed', { p_group: group })).data ?? [];
}

export async function postToGroup(group: string, text: string) {
  const { error } = await supabase.from('group_posts').insert({ group_id: group, text: text.slice(0, 300) });
  return !error;
}

export async function myChallenges() {
  return (await rpc<Challenge[]>('my_challenges')).data ?? [];
}

export async function createChallenge(kind: Challenge['kind'], days: number, members: string[]) {
  return (await rpc<string>('create_challenge', { p_kind: kind, p_days: days, p_members: members })).data;
}

export async function challengeBoard(id: string) {
  return ((await rpc<{ user_id: string; name: string | null; value: number }[]>('challenge_board', { p_id: id })).data ?? []).map((r) => ({ ...r, value: Number(r.value) }));
}

export async function challengeInfo(id: string) {
  const { data } = await supabase.from('challenges').select('id,kind,start_day,end_day').eq('id', id).maybeSingle();
  return data as Pick<Challenge, 'id' | 'kind' | 'start_day' | 'end_day'> | null;
}

export async function leaveChallenge(id: string, userId: string) {
  const { error } = await supabase.from('challenge_members').delete().eq('challenge_id', id).eq('user_id', userId);
  return !error;
}

export const CH_TITLE: Record<Challenge['kind'], string> = { steps: 'Most steps', workouts: 'Most workouts', volume: 'Most weight lifted' };
export const CH_UNIT: Record<Challenge['kind'], string> = { steps: 'steps', workouts: 'workouts', volume: 'kg' };

/** Colour for someone's avatar, the same every time. */
export function avatarColor(id: string) {
  const colors = ['#3355FF', '#15803D', '#B45309', '#7C3AED', '#DB2777', '#0EA5E9', '#C2410C', '#52525B'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/** "2 h ago", "Yesterday", "Oct 3". */
export function timeAgo(iso: string, t: (s: string, v?: Record<string, string | number>) => string, lang: 'en' | 'ar') {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return t('Just now');
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) });
  if (s < 172800) return t('Yesterday');
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** Days left in a challenge, counting today. */
export const daysLeft = (end: string, today: string) => Math.max(0, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 864e5) + 1);
