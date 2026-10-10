import { supabase } from './supabase';

export type ChatAction =
  | { type: 'food'; name: string; kcal: number; protein: number; carbs: number; fat: number; logId?: string; undone?: boolean }
  | { type: 'cardio'; kind: 'Walk' | 'Run' | 'Bike' | 'Swim'; minutes: number; intensity: number; kcal?: number; logId?: string; undone?: boolean }
  | { type: 'water'; ml: number; undone?: boolean };

export type ChatMsg = { id: string; chat_id: string; role: 'user' | 'ai'; text: string; actions: ChatAction[] | null; created_at: string };

export const newId = () =>
  (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export async function loadChats(): Promise<ChatMsg[]> {
  const { data } = await supabase.from('chat_messages').select('id,chat_id,role,text,actions,created_at').order('created_at', { ascending: false }).limit(400);
  return ((data as ChatMsg[]) ?? []).reverse();
}

export async function saveMsg(m: Omit<ChatMsg, 'id' | 'created_at'>): Promise<ChatMsg | null> {
  const { data } = await supabase.from('chat_messages').insert(m).select('id,chat_id,role,text,actions,created_at').single();
  return (data as ChatMsg) ?? null;
}

export const updateActions = (id: string, actions: ChatAction[]) => supabase.from('chat_messages').update({ actions }).eq('id', id);
export const deleteChat = (chatId: string) => supabase.from('chat_messages').delete().eq('chat_id', chatId);

/** Chats grouped and newest first: title is the first thing you asked. */
export function groupChats(msgs: ChatMsg[]) {
  const by: Record<string, ChatMsg[]> = {};
  msgs.forEach((m) => (by[m.chat_id] ??= []).push(m));
  return Object.entries(by)
    .map(([id, ms]) => ({ id, msgs: ms, last: ms[ms.length - 1].created_at, title: ms.find((m) => m.role === 'user')?.text ?? '' }))
    .sort((a, b) => b.last.localeCompare(a.last));
}
