import { supabase } from './supabase';

export type ChatAction =
  | { type: 'food'; name: string; kcal: number; protein: number; carbs: number; fat: number; logId?: string; undone?: boolean }
  | { type: 'cardio'; kind: 'Walk' | 'Run' | 'Bike' | 'Swim'; minutes: number; intensity: number; kcal?: number; logId?: string; undone?: boolean }
  | { type: 'water'; ml: number; logId?: string; undone?: boolean }
  | { type: 'sleep'; hours: number; prev?: number | null; undone?: boolean }
  | { type: 'weight'; kg: number; prev?: number | null; undone?: boolean };

/** A small chart or card under a coach reply. Charts are drawn from your real data. */
export type ChatCard = { type: 'weight' } | { type: 'calories' } | { type: 'sleep' } | { type: 'meal'; name: string; kcal: number; protein: number };

export type ChatMsg = { id: string; chat_id: string; role: 'user' | 'ai'; text: string; actions: ChatAction[] | null; card?: ChatCard | null; created_at: string };

export const newId = () =>
  (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export async function loadChats(): Promise<ChatMsg[]> {
  const { data } = await supabase.from('chat_messages').select('id,chat_id,role,text,actions,card,created_at').order('created_at', { ascending: false }).limit(400);
  return ((data as ChatMsg[]) ?? []).reverse();
}

export async function saveMsg(m: Omit<ChatMsg, 'id' | 'created_at'>): Promise<ChatMsg | null> {
  const { data } = await supabase.from('chat_messages').insert(m).select('id,chat_id,role,text,actions,card,created_at').single();
  return (data as ChatMsg) ?? null;
}

export const updateActions = (id: string, actions: ChatAction[]) => supabase.from('chat_messages').update({ actions }).eq('id', id);
export const deleteChat = (chatId: string) => supabase.from('chat_messages').delete().eq('chat_id', chatId);

/** Put a deleted chat back (Undo). */
export async function restoreChat(msgs: ChatMsg[]) {
  const { error } = await supabase.from('chat_messages').insert(msgs.map(({ id, chat_id, role, text, actions, card, created_at }) => ({ id, chat_id, role, text, actions, card: card ?? null, created_at })));
  return !error;
}

/** Check a card the AI sent; anything unknown is dropped. */
export function cleanCard(c: unknown): ChatCard | null {
  const x = c as Record<string, unknown> | null;
  if (!x || typeof x !== 'object') return null;
  if (x.type === 'weight' || x.type === 'calories' || x.type === 'sleep') return { type: x.type };
  if (x.type === 'meal' && typeof x.name === 'string' && Number(x.kcal) > 0) return { type: 'meal', name: x.name.slice(0, 60), kcal: Math.round(Number(x.kcal)), protein: Math.round(Number(x.protein) || 0) };
  return null;
}

/** When the AI sends no card, pick one from what was asked. */
export function guessCard(q: string): ChatCard | null {
  const s = q.toLowerCase();
  if (/progress|how am i doing|how.?s it going|my weight|lost|gained|تقدم|وزني/.test(s)) return { type: 'weight' };
  if (/slept|sleep|recover|نوم|نمت/.test(s) && !/\d/.test(s)) return { type: 'sleep' };
  if (/calorie|how much (did|have) i eat|سعرات/.test(s)) return { type: 'calories' };
  return null;
}

// ---------------------------------------------------------------------------
// Coach memory: a short summary kept between chats
// ---------------------------------------------------------------------------
export async function loadMemory(): Promise<string> {
  const { data } = await supabase.from('coach_memory').select('summary').maybeSingle();
  return (data as { summary: string } | null)?.summary ?? '';
}

export async function saveMemory(uid: string, summary: string) {
  const clean = summary.trim().slice(0, 1500);
  if (!clean) return;
  await supabase.from('coach_memory').upsert({ user_id: uid, summary: clean, updated_at: new Date().toISOString() });
}

/** "Today", "Yesterday" or a date, for chat history headings. */
export function dayHeading(iso: string, today: string, yesterday: string, lang: 'en' | 'ar') {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', ...(key.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) }).format(d);
}

/** Chats grouped and newest first: title is the first thing you asked. */
export function groupChats(msgs: ChatMsg[]) {
  const by: Record<string, ChatMsg[]> = {};
  msgs.forEach((m) => (by[m.chat_id] ??= []).push(m));
  return Object.entries(by)
    .map(([id, ms]) => ({ id, msgs: ms, last: ms[ms.length - 1].created_at, title: ms.find((m) => m.role === 'user')?.text ?? '' }))
    .sort((a, b) => b.last.localeCompare(a.last));
}
