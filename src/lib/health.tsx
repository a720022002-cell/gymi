import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { useFood } from './food';
import { addDays } from './nutrition';
import type { Photo } from './photo';
import { selectAll, supabase } from './supabase';

export type Checkin = {
  day: string;
  sleep_h: number | null;
  sleep_q: number | null;
  bed: string | null;
  wake: string | null;
  energy: number | null;
  sore: number | null;
  score: number | null;
  /** Every sleep in the day (night and naps); sleep_h is their sum. */
  sleep_parts?: SleepPart[] | null;
};
export type SleepPart = { bed: string; wake: string };

export const MEAS = ['waist', 'chest', 'arm', 'neck', 'shoulders', 'hips', 'thigh', 'calf', 'forearm', 'bf'] as const;
export type MeasKind = 'weight' | (typeof MEAS)[number];
/** Name, unit, and whether smaller is better (design: MEAS). */
export const MEAS_INFO: Record<(typeof MEAS)[number], [string, string, boolean, number]> = {
  waist: ['Waist', 'cm', true, 85],
  chest: ['Chest', 'cm', false, 100],
  arm: ['Arm', 'cm', false, 34],
  neck: ['Neck', 'cm', false, 39],
  shoulders: ['Shoulders', 'cm', false, 120],
  hips: ['Hips', 'cm', true, 98],
  thigh: ['Thigh', 'cm', false, 58],
  calf: ['Calf', 'cm', false, 38],
  forearm: ['Forearm', 'cm', false, 30],
  bf: ['Body fat', '%', true, 20],
};

export type Measure = { day: string; kind: MeasKind; value: number };
export type ProgressPhoto = { id: string; day: string; path: string };
export type Supplement = { id: string; name: string; dose: string; unit: string; freq: string; active: boolean; remind: boolean; time: string };
export type BloodValue = { name: string; value: number | string; unit: string; low?: number | null; high?: number | null; flag: -1 | 0 | 1 };
export type BloodTest = { id: string; day: string; title: string; values: BloodValue[]; file_path?: string | null; file_name?: string | null; file_mime?: string | null };
/** A lab report file (PDF or photo) to keep with the values. */
export type HealthFile = { base64: string; mime: string; name: string };
/** What you ate and drank each day (for streaks, commitment and reports). */
export type DayTotals = { k: number; p: number; w: number };

type Health = {
  ready: boolean;
  checkins: Checkin[];
  todayCheckin: Checkin | null;
  /** Save today's check-in, or another day's (`on`). */
  saveCheckin: (patch: Partial<Omit<Checkin, 'day'>>, on?: string) => Promise<boolean>;
  measures: Measure[];
  weights: Measure[];
  /** Log today's weight, or another day's (`on`). Only today's updates your targets. */
  logWeight: (kg: number, on?: string) => Promise<boolean>;
  /** Remove one day's weight (used by Undo in the coach chat). */
  deleteWeight: (day: string) => Promise<void>;
  /** Correct or delete (null) one day's weigh-in. When it's your latest, targets and profile follow the corrected weight. */
  fixWeight: (day: string, kg: number | null) => Promise<boolean>;
  saveMeasures: (vals: Partial<Record<MeasKind, number>>) => Promise<boolean>;
  photos: ProgressPhoto[];
  addPhoto: (p: Photo) => Promise<boolean>;
  deletePhoto: (id: string) => Promise<void>;
  photoUrls: (paths: string[]) => Promise<Record<string, string>>;
  supplements: Supplement[];
  saveSupplement: (s: Omit<Supplement, 'id'> & { id?: string }) => Promise<boolean>;
  deleteSupplement: (id: string) => Promise<Supplement | null>;
  restoreSupplement: (s: Supplement) => Promise<void>;
  blood: BloodTest[];
  addBlood: (b: Omit<BloodTest, 'id'>, file?: HealthFile | null) => Promise<BloodTest | null>;
  /** A link to open a saved lab report file (valid for an hour). */
  bloodFileUrl: (path: string) => Promise<string | null>;
  deleteBlood: (id: string) => Promise<void>;
  /** Food and water per day for the last 120 days, today included (live). */
  days: Record<string, DayTotals>;
  /** Daily check-in sheet. */
  checkinOpen: boolean;
  setCheckinOpen: (v: boolean) => void;
};

const Ctx = createContext<Health | null>(null);
const HISTORY = 120;

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function HealthProvider({ children }: PropsWithChildren) {
  const { session, updateProfile } = useAuth();
  const userId = session?.user.id;
  const food = useFood();
  const today = food.today;
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = !!userId && readyFor === `${userId}:${today}`;
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [blood, setBlood] = useState<BloodTest[]>([]);
  const [past, setPast] = useState<Record<string, DayTotals>>({});
  const [checkinOpen, setCheckinOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const from = addDays(today, -HISTORY);
      const [c, m, ph, s, b, f] = await Promise.all([
        supabase.from('checkins').select('day,sleep_h,sleep_q,bed,wake,energy,sore,score,sleep_parts').gte('day', from).order('day'),
        selectAll<Measure>((a, z) => supabase.from('measurements').select('day,kind,value').order('day').order('kind').range(a, z)),
        supabase.from('progress_photos').select('id,day,path').order('day'),
        supabase.from('supplements').select('id,name,dose,unit,freq,active,remind,time').order('created_at'),
        supabase.from('blood_tests').select('id,day,title,values,file_path,file_name,file_mime').order('day', { ascending: false }),
        // One row per day (single logs would go over the database's 1000-row limit).
        supabase.rpc('my_day_totals').gte('day', from).lt('day', today),
      ]);
      if (!alive) return;
      const num = <T extends Record<string, unknown>>(rows: T[] | null, keys: (keyof T)[]) =>
        (rows ?? []).map((r) => {
          const o = { ...r };
          keys.forEach((k) => (o[k] = (o[k] == null ? null : Number(o[k])) as T[keyof T]));
          return o;
        });
      setCheckins(num(c.data as Checkin[] | null, ['sleep_h']));
      setMeasures(num(m.data as Measure[] | null, ['value']));
      setPhotos((ph.data as ProgressPhoto[]) ?? []);
      setSupplements((s.data as Supplement[]) ?? []);
      setBlood((b.data as BloodTest[]) ?? []);
      const d: Record<string, DayTotals> = {};
      for (const r of (f.data as { day: string; kcal: number; protein: number; ml: number }[] | null) ?? []) d[r.day] = { k: Number(r.kcal), p: Number(r.protein), w: Number(r.ml) };
      setPast(d);
      setReadyFor(`${userId}:${today}`);
    })();
    return () => {
      alive = false;
    };
  }, [userId, today]);

  // The Food page can show an earlier day. Its live numbers belong to that day, and today keeps the last numbers seen for today.
  const loaded = food.loadedDay === food.day;
  const live = loaded && (food.logs.length || food.water) ? { k: food.eaten.k, p: food.eaten.p, w: food.water } : null;
  const [todayLive, setTodayLive] = useState<{ day: string; key: string; v: DayTotals | null } | null>(null);
  const liveKey = live ? `${live.k}:${live.p}:${live.w}` : '';
  // Remember today's numbers while the Food page shows today (updated during render, React's pattern for this).
  if (food.isToday && loaded && (todayLive?.day !== today || todayLive.key !== liveKey)) setTodayLive({ day: today, key: liveKey, v: live });
  const days = useMemo(() => {
    const d = { ...past };
    if (food.day !== today) {
      if (live) d[food.day] = live;
      else if (loaded) delete d[food.day];
      const t = todayLive?.day === today ? todayLive.v : null;
      if (t) d[today] = t;
    } else if (live) d[today] = live;
    else if (!loaded && todayLive?.day === today && todayLive.v) d[today] = todayLive.v;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, today, food.day, loaded, liveKey, todayLive]);

  const todayCheckin = checkins.find((x) => x.day === today) ?? null;

  const saveCheckin = useCallback(
    async (patch: Partial<Omit<Checkin, 'day'>>, on = today) => {
      if (!userId) return false;
      const prev = checkins.find((x) => x.day === on);
      const row: Checkin = { day: on, sleep_h: null, sleep_q: null, bed: null, wake: null, energy: null, sore: null, score: null, ...prev, ...patch };
      setCheckins((xs) => [...xs.filter((x) => x.day !== on), row].sort((a, b) => a.day.localeCompare(b.day)));
      const { error } = await supabase.from('checkins').upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() });
      return !error;
    },
    [userId, today, checkins],
  );

  const putMeasures = useCallback(
    async (vals: Partial<Record<MeasKind, number>>, on = today) => {
      if (!userId) return false;
      const rows = Object.entries(vals)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([kind, v]) => ({ user_id: userId, day: on, kind: kind as MeasKind, value: Math.round((v as number) * 10) / 10 }));
      if (!rows.length) return true;
      setMeasures((xs) => [...xs.filter((x) => !(x.day === on && rows.some((r) => r.kind === x.kind))), ...rows.map(({ day, kind, value }) => ({ day, kind, value }))].sort((a, b) => a.day.localeCompare(b.day)));
      const { error } = await supabase.from('measurements').upsert(rows, { onConflict: 'user_id,day,kind' });
      return !error;
    },
    [userId, today],
  );

  const applyWeight = food.applyWeight;
  const logWeight = useCallback(
    async (kg: number, on = today) => {
      const ok = await putMeasures({ weight: kg }, on);
      if (ok && on === today) {
        // Targets follow your weight: this week's average when there are other weigh-ins, otherwise this one.
        const week = [...measures.filter((m) => m.kind === 'weight' && m.day >= addDays(today, -6) && m.day !== today).map((m) => m.value), kg];
        await applyWeight(week.reduce((a, b) => a + b, 0) / week.length, kg).catch(() => false);
        updateProfile({ weight_kg: Math.round(kg * 10) / 10 }).catch(() => {});
      }
      return ok;
    },
    [putMeasures, updateProfile, measures, today, applyWeight],
  );

  const deleteWeight = useCallback(async (day: string) => {
    setMeasures((xs) => xs.filter((x) => !(x.kind === 'weight' && x.day === day)));
    await supabase.from('measurements').delete().eq('kind', 'weight').eq('day', day);
  }, []);

  const fixWeight = useCallback(
    async (day: string, kg: number | null) => {
      const ws = measures.filter((m) => m.kind === 'weight');
      const wasLatest = ws.at(-1)?.day === day;
      if (kg == null) {
        const { error } = await supabase.from('measurements').delete().eq('kind', 'weight').eq('day', day);
        if (error) return false;
        setMeasures((xs) => xs.filter((x) => !(x.kind === 'weight' && x.day === day)));
      } else if (!(await putMeasures({ weight: kg }, day))) return false;
      if (wasLatest) {
        // Your latest weight changed: targets use this week's average of what's left, and your profile the newest one.
        const left = ws.filter((m) => m.day !== day).map((m) => ({ day: m.day, value: m.value }));
        if (kg != null) left.push({ day, value: kg });
        left.sort((a, b) => a.day.localeCompare(b.day));
        const latest = left.at(-1);
        if (latest) {
          const week = left.filter((m) => m.day >= addDays(latest.day, -6)).map((m) => m.value);
          await updateProfile({ weight_kg: Math.round(latest.value * 10) / 10 }).catch(() => {});
          await applyWeight(week.reduce((a, b) => a + b, 0) / week.length, latest.value).catch(() => false);
        }
      }
      return true;
    },
    [measures, putMeasures, applyWeight, updateProfile],
  );

  const addPhoto = useCallback(
    async (p: Photo) => {
      if (!userId) return false;
      const path = `${userId}/${today}-${Date.now()}.jpg`;
      const up = await supabase.storage.from('progress').upload(path, b64ToBytes(p.base64), { contentType: p.mime, upsert: false });
      if (up.error) return false;
      const { data, error } = await supabase.from('progress_photos').insert({ day: today, path }).select('id,day,path').single();
      if (error || !data) return false;
      setPhotos((xs) => [...xs, data as ProgressPhoto]);
      return true;
    },
    [userId, today],
  );

  const deletePhoto = useCallback(
    async (id: string) => {
      const ph = photos.find((x) => x.id === id);
      setPhotos((xs) => xs.filter((x) => x.id !== id));
      await supabase.from('progress_photos').delete().eq('id', id);
      if (ph) await supabase.storage.from('progress').remove([ph.path]);
    },
    [photos],
  );

  const photoUrls = useCallback(async (paths: string[]) => {
    if (!paths.length) return {};
    const { data } = await supabase.storage.from('progress').createSignedUrls(paths, 3600);
    return Object.fromEntries((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path as string, x.signedUrl as string])) as Record<string, string>;
  }, []);

  const saveSupplement = useCallback(async (s: Omit<Supplement, 'id'> & { id?: string }) => {
    const { id, ...rest } = s;
    const q = id ? supabase.from('supplements').update(rest).eq('id', id) : supabase.from('supplements').insert(rest);
    const { data, error } = await q.select('id,name,dose,unit,freq,active,remind,time').single();
    if (error || !data) return false;
    setSupplements((xs) => (id ? xs.map((x) => (x.id === id ? (data as Supplement) : x)) : [...xs, data as Supplement]));
    return true;
  }, []);

  const deleteSupplement = useCallback(
    async (id: string) => {
      const s = supplements.find((x) => x.id === id) ?? null;
      setSupplements((xs) => xs.filter((x) => x.id !== id));
      await supabase.from('supplements').delete().eq('id', id);
      return s;
    },
    [supplements],
  );

  const restoreSupplement = useCallback(async (s: Supplement) => {
    const { id: _id, ...rest } = s;
    const { data } = await supabase.from('supplements').insert(rest).select('id,name,dose,unit,freq,active,remind,time').single();
    if (data) setSupplements((xs) => [...xs, data as Supplement]);
  }, []);

  const addBlood = useCallback(
    async (b: Omit<BloodTest, 'id'>, file?: HealthFile | null) => {
      let extra = {};
      // The file itself goes to the private "health-files" bucket, in your own folder.
      if (file && userId) {
        const ext = file.mime === 'application/pdf' ? 'pdf' : file.mime === 'image/png' ? 'png' : 'jpg';
        const path = `${userId}/${b.day}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from('health-files').upload(path, b64ToBytes(file.base64), { contentType: file.mime, upsert: false });
        if (!up.error) extra = { file_path: path, file_name: file.name.slice(0, 160), file_mime: file.mime };
      }
      const { data, error } = await supabase.from('blood_tests').insert({ ...b, ...extra }).select('id,day,title,values,file_path,file_name,file_mime').single();
      if (error || !data) return null;
      setBlood((xs) => [data as BloodTest, ...xs].sort((x, y) => y.day.localeCompare(x.day)));
      return data as BloodTest;
    },
    [userId],
  );

  const bloodFileUrl = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from('health-files').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }, []);

  const deleteBlood = useCallback(
    async (id: string) => {
      const b = blood.find((x) => x.id === id);
      setBlood((xs) => xs.filter((x) => x.id !== id));
      await supabase.from('blood_tests').delete().eq('id', id);
      if (b?.file_path) await supabase.storage.from('health-files').remove([b.file_path]);
    },
    [blood],
  );

  const weights = useMemo(() => measures.filter((m) => m.kind === 'weight'), [measures]);

  const value = useMemo<Health>(
    () => ({
      ready,
      checkins,
      todayCheckin,
      saveCheckin,
      measures,
      weights,
      logWeight,
      deleteWeight,
      fixWeight,
      saveMeasures: putMeasures,
      photos,
      addPhoto,
      deletePhoto,
      photoUrls,
      supplements,
      saveSupplement,
      deleteSupplement,
      restoreSupplement,
      blood,
      addBlood,
      bloodFileUrl,
      deleteBlood,
      days,
      checkinOpen,
      setCheckinOpen,
    }),
    [checkinOpen, ready, checkins, todayCheckin, saveCheckin, measures, weights, logWeight, deleteWeight, fixWeight, putMeasures, photos, addPhoto, deletePhoto, photoUrls, supplements, saveSupplement, deleteSupplement, restoreSupplement, blood, addBlood, bloodFileUrl, deleteBlood, days],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHealth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useHealth must be used inside HealthProvider');
  return v;
}

/** Hours between two "HH:MM" times, across midnight. */
export function sleepHours(bed: string, wake: string) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let m = wh * 60 + wm - (bh * 60 + bm);
  if (m <= 0) m += 1440;
  return Math.round((m / 60) * 100) / 100;
}
