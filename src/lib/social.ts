import { supabase } from './supabase';

export type Share = { workouts: boolean; prs: boolean; streak: boolean; weight: boolean; body: boolean; photos: boolean };
/** Nothing is shared until you choose (accounts made before this keep what they had). */
export const DEFAULT_SHARE: Share = { workouts: false, prs: false, streak: false, weight: false, body: false, photos: false };

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
  photos?: { day: string; path: string }[];
};
export type FeedItem = { id: string; user_id: string; name: string | null; username: string; kind: string; text: string; data: Record<string, unknown> | null; created_at: string; cheers: number; cheered: boolean };
export type Group = { id: string; name: string; owner: string; members: number; memberIds: string[] };
export type BoardRow = { user_id: string; name: string | null; username: string; workouts: number | null; volume: number | null };
export type ChallengeKind = 'exercise' | 'weight' | 'steps' | 'progress' | 'workouts' | 'volume';
export type Challenge = { id: string; kind: ChallengeKind; start_day: string; end_day: string; members: number; creator_name: string | null; exercise_name: string | null; my_rank: number | null };
export type ChallengeInfo = Pick<Challenge, 'id' | 'kind' | 'start_day' | 'end_day' | 'exercise_name'>;
export type ChallengeRow = { user_id: string; name: string | null; value: number; has_goal: boolean; goal: number | null };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  return { data: (data ?? null) as T | null, error };
};

export const displayName = (x: { name?: string | null; username: string }) => x.name || x.username;

export async function myFriends() {
  return (await rpc<FriendRow[]>('my_friends')).data ?? [];
}

/** Your friends, or null when they couldn't be loaded (no connection), so screens can say so instead of "no friends". */
export async function myFriendsOrNull() {
  const { data, error } = await rpc<FriendRow[]>('my_friends');
  return error ? null : (data ?? []);
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

/** A friend's profile; `failed` when it couldn't be loaded (no connection), not because you aren't friends. */
export async function friendProfileChecked(id: string) {
  const { data, error } = await rpc<FriendProfile>('friend_profile', { p_id: id });
  return { v: data, failed: !!error };
}

export async function getShare(userId: string): Promise<Share> {
  const { data } = await supabase.from('friend_share').select('workouts,prs,streak,weight,body,photos').eq('user_id', userId).maybeSingle();
  return data ? { ...DEFAULT_SHARE, ...(data as Share) } : DEFAULT_SHARE;
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
  const { data } = await supabase.from('groups').select('id,name,owner,group_members(user_id)').order('created_at', { ascending: false });
  return ((data as { id: string; name: string; owner: string; group_members: { user_id: string }[] }[]) ?? []).map((g) => {
    const ids = (g.group_members ?? []).map((m) => m.user_id);
    return { id: g.id, name: g.name, owner: g.owner, members: Math.max(1, ids.length), memberIds: ids };
  });
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

/** Workouts members shared to a group (the group has no chat). */
export async function groupFeed(group: string) {
  return (await rpc<{ id: string; user_id: string; name: string | null; text: string; created_at: string }[]>('group_feed', { p_group: group })).data ?? [];
}

/** Share a finished workout to a group. */
export async function shareWorkoutToGroup(group: string, text: string) {
  const { error } = await supabase.from('group_posts').insert({ group_id: group, text: text.slice(0, 300), kind: 'workout' });
  return !error;
}

export async function myChallenges() {
  return (await rpc<Challenge[]>('my_challenges')).data ?? [];
}

export async function createChallenge(kind: ChallengeKind, days: number, members: string[], opts?: { exercise?: string; exerciseName?: string; goal?: number | null }) {
  return (
    await rpc<string>('create_challenge', {
      p_kind: kind,
      p_days: days,
      p_members: members,
      p_exercise: opts?.exercise ?? null,
      p_exercise_name: opts?.exerciseName ?? null,
      p_goal: opts?.goal ?? null,
    })
  ).data;
}

export async function challengeBoard(id: string): Promise<ChallengeRow[]> {
  return ((await rpc<ChallengeRow[]>('challenge_board', { p_id: id })).data ?? []).map((r) => ({ ...r, value: Number(r.value), goal: r.goal == null ? null : Number(r.goal) }));
}

export async function challengeInfo(id: string) {
  const { data } = await supabase.from('challenges').select('id,kind,start_day,end_day,exercise_name').eq('id', id).maybeSingle();
  return data as ChallengeInfo | null;
}

/** Your own goal weight for a weight challenge (only you see it). */
export async function setChallengeGoal(id: string, goal: number) {
  return !!(await rpc<boolean>('set_challenge_goal', { p_id: id, p_goal: goal })).data;
}

/** Remind the others in a challenge. Once a day per challenge: 'sent' or 'already'. */
export async function nudgeChallenge(id: string) {
  return ((await rpc<string>('nudge_challenge', { p_id: id })).data ?? 'no') as 'sent' | 'already' | 'no';
}

/** Nudges friends sent you in your challenges since a time (for an in-app banner). */
export async function recentNudges(since: string) {
  return (await rpc<{ challenge_id: string; kind: ChallengeKind; exercise_name: string | null; from_id: string; from_name: string; created_at: string }[]>('my_nudges', { p_since: since })).data ?? [];
}

/** New records friends hit since a time (for an in-app banner). Only from friends who share records. */
export async function recentFriendPRs(since: string, me: string) {
  return (await feed()).filter((a) => a.kind === 'pr' && a.user_id !== me && a.created_at > since);
}

export async function leaveChallenge(id: string, userId: string) {
  const { error } = await supabase.from('challenge_members').delete().eq('challenge_id', id).eq('user_id', userId);
  return !error;
}

export const CH_TITLE: Record<ChallengeKind, string> = {
  exercise: 'Most weight added',
  weight: 'Closest to goal',
  steps: 'Most steps',
  progress: 'Most improved',
  workouts: 'Most workouts',
  volume: 'Most weight lifted',
};
export const CH_UNIT: Record<ChallengeKind, string> = { exercise: 'kg added', weight: '% to goal', steps: 'steps', progress: '% better', workouts: 'workouts', volume: 'kg' };
/** "Bench press gains", "Closest to goal"… */
export function challengeTitle(ch: { kind: ChallengeKind; exercise_name?: string | null }, t: (s: string, v?: Record<string, string | number>) => string) {
  return ch.kind === 'exercise' && ch.exercise_name ? t('{x} gains', { x: t(ch.exercise_name) }) : t(CH_TITLE[ch.kind]);
}
/** Challenges scored in percent (bars go to 100). */
export const CH_PCT: ChallengeKind[] = ['weight', 'progress'];

/** Progress photos a friend shares, as links that work for an hour. */
export async function friendPhotoUrls(paths: string[]) {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from('progress').createSignedUrls(paths, 3600);
  return (data ?? []).map((x) => x.signedUrl ?? null);
}

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

export type Showcase = { badges: { id: string; name: string; icon: string; level: number; tiers: number[]; v: number; unit: string }[]; prs: { id: string; n: string; w: number }[] };
export async function getShowcase(uid: string): Promise<Showcase> {
  const { data } = await supabase.from('profile_showcase').select('badges,prs').eq('user_id', uid).maybeSingle();
  return (data as Showcase) ?? { badges: [], prs: [] };
}
export async function saveShowcase(uid: string, s: Showcase) {
  const { error } = await supabase.from('profile_showcase').upsert({ user_id: uid, ...s, updated_at: new Date().toISOString() });
  return !error;
}
export async function friendShowcase(id: string) {
  const { data } = await supabase.rpc('friend_showcase', { p_id: id });
  return (data as Showcase | null) ?? null;
}

export const INVITE_BASE = 'https://gymi-inky.vercel.app/welcome?ref=';
export async function myReferrals() {
  const { data } = await supabase.rpc('my_referrals');
  return (data as { name: string | null; username: string; joined: string }[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Live group workouts
// ---------------------------------------------------------------------------
export type SessionMember = { user_id: string; name: string | null; username: string; level: 'Beginner' | 'Intermediate' | 'Advanced'; joined: boolean; done: Record<string, number>; updated_at: string };
export async function myGroupSessions() {
  const { data } = await supabase.rpc('my_group_sessions');
  return (data as { id: string; host: string; host_name: string | null; status: string; created_at: string; members: number; joined: boolean }[] | null) ?? [];
}
export async function setSessionStatus(id: string, status: 'live' | 'done') {
  const { data } = await supabase.rpc('set_group_session_status', { p_id: id, p_status: status });
  return !!data;
}
