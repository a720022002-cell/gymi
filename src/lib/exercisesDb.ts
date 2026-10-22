import { supabase } from './supabase';
import { EX, type Muscle, type PlanEx } from './training';

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
  // Your own exercises keep their main muscle (Biceps, Abs…) for muscle recovery.
  const pri = isCustom(e.id) ? e.muscles?.[0] : undefined;
  return { id: e.id, sets, reps, n: e.name_en, ar: e.name_ar, m: e.muscle, t: e.equipment, time: e.timed, ...(pri ? { pri } : {}) };
}

/** Exercises you made yourself (no pictures or steps). */
export const isCustom = (id: string) => id.startsWith('custom:');
export type CustomKind = 'weighted' | 'bodyweight' | 'timed';
/** The muscles you can pick for your own exercise, and the group and main muscle each one counts as. */
export const CUSTOM_MUSCLES: [label: string, group: Muscle, fine: string | null][] = [
  ['Chest', 'Chest', 'Chest'],
  ['Back', 'Back', 'Back'],
  ['Shoulders', 'Shoulders', null],
  ['Biceps', 'Arms', 'Biceps'],
  ['Triceps', 'Arms', 'Triceps'],
  ['Forearms', 'Arms', 'Forearms'],
  ['Legs', 'Legs', null],
  ['Glutes', 'Legs', 'Glutes'],
  ['Core', 'Core', 'Abs'],
];

/** Your own exercise as a list entry: a name, a muscle and its type. No photo needed. */
export function customExercise(x: { name: string; muscle: string; kind: CustomKind; lang: 'en' | 'ar' }): DbExercise {
  const name = x.name.trim().replace(/\s+/g, ' ').slice(0, 40);
  const m = CUSTOM_MUSCLES.find((y) => y[0] === x.muscle) ?? CUSTOM_MUSCLES[0];
  return {
    id: `custom:${name.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')}`,
    name_en: name,
    name_ar: x.lang === 'ar' ? name : null,
    muscle: m[1],
    muscles: m[2] ? [m[2]] : [],
    equipment: x.kind === 'weighted' ? 'Free weight' : 'Bodyweight',
    level: null,
    category: null,
    steps_en: [],
    steps_ar: null,
    images: [],
    machines: null,
    timed: x.kind === 'timed',
    rank: 99,
  };
}

/** One of your own exercises already in a plan, as a list entry (to pick it again). */
export function customFromPlan(x: PlanEx): DbExercise {
  return {
    id: x.id,
    name_en: x.n ?? x.id.slice(7),
    name_ar: x.ar ?? null,
    muscle: x.m ?? 'Other',
    muscles: x.pri ? [x.pri] : [],
    equipment: x.t ?? 'Other',
    level: null,
    category: null,
    steps_en: [],
    steps_ar: null,
    images: [],
    machines: null,
    timed: !!x.time,
    rank: 99,
  };
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
