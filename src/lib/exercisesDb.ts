import { supabase } from './supabase';
import { EX, type PlanEx } from './training';

export type DbExercise = {
  id: string;
  name_en: string;
  name_ar: string | null;
  muscle: string;
  muscles: string[];
  equipment: string;
  level: string | null;
  category: string | null;
  steps_en: string[];
  steps_ar: string[] | null;
  images: string[];
  machines: [string, string][] | null;
  timed: boolean;
  rank: number;
};

export async function searchExercises(q: string, muscle: string | null, equipment: string | null, limit = 60): Promise<DbExercise[]> {
  const { data, error } = await supabase.rpc('search_exercises', { p_query: q, p_muscle: muscle, p_equipment: equipment, p_limit: limit });
  if (error) return [];
  return data as DbExercise[];
}

export async function getExercise(id: string): Promise<DbExercise | null> {
  const { data } = await supabase.from('exercises').select('*').eq('id', id).maybeSingle();
  return (data as DbExercise) ?? null;
}

export const dbExName = (e: DbExercise, lang: 'en' | 'ar') => (lang === 'ar' && e.name_ar) || e.name_en;

/** A plan entry for an exercise. Exercises outside the common list carry their name. */
export function toPlanEx(e: DbExercise, sets = 3): PlanEx {
  const reps = e.timed ? '45' : e.equipment === 'Bodyweight' ? '12–15' : '8–12';
  if (EX[e.id]) return { id: e.id, sets, reps };
  return { id: e.id, sets, reps, n: e.name_en, ar: e.name_ar, m: e.muscle, t: e.equipment, time: e.timed };
}

export type MachineEntry = Pick<DbExercise, 'id' | 'name_en' | 'name_ar' | 'muscle' | 'equipment' | 'machines' | 'rank'>;
let machines: MachineEntry[] | null = null;

/** Every machine and cable exercise, plus the common bar ones (Smith machine and the like): what a gym photo is matched against. */
export async function machineCatalog(): Promise<MachineEntry[]> {
  if (machines) return machines;
  const { data } = await supabase
    .from('exercises')
    .select('id,name_en,name_ar,muscle,equipment,machines,rank')
    .or('equipment.in.(Machine,Cable),and(rank.eq.0,equipment.in.(Barbell,Free weight,Other))')
    .order('rank')
    .limit(400);
  if (data?.length) machines = data as MachineEntry[];
  return (data as MachineEntry[] | null) ?? [];
}
