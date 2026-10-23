// The live cardio session in progress, wherever you are in the app (the screen, another tab, the Lock Screen): time
// with pauses, heart rate and time in each zone, GPS distance, how hard it feels, and the coach's latest tip. Kept on
// the phone, so a session survives the app being closed and opened again.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { type CardioGoal, type CardioKind, type Line, rpeZone } from './cardioCoach';
import { hrZone } from './devices';
import type { GpsPoint } from './cardioGps';
import type { HrSource, HrStatus, SavedSensor } from './hrTypes';
import { type SportId, sportKcal } from './sports';
import { heartKcal } from './training';

export type CardioTip = Line & { /** An AI tip's own text (already in your language). */ text?: string; ai?: boolean; at: number };

export type CardioSessionState = {
  id: string;
  sport: SportId;
  kind: CardioKind;
  planMin: number | null;
  /** Target zone (1–5) and the highest that's safe today. */
  target: number;
  cap: number;
  planId: string | null;
  source: HrSource;
  sensor: SavedSensor | null;
  gps: boolean;
  speak: boolean;
  /** Goal and who you are, for tips (kept so the Lock Screen and a reopened app coach the same way). */
  goal: CardioGoal;
  preg: boolean;
  nursing: boolean;
  readiness: number | null;
  age: number;
  female: boolean;
  weight: number;
  injuries: string[];
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  endedAt: number | null;
  /** Latest heart rate and when it was measured. */
  hr: number | null;
  hrAt: number | null;
  hrMax: number;
  /** Heart rate × seconds and seconds measured, for the time-weighted average. */
  hrSum: number;
  hrSec: number;
  /** Readings of the last 3 minutes [time, bpm], for the average zone of stop-and-go sports. */
  hrRecent: [number, number][];
  /** Seconds in zones 1–5. */
  zones: number[];
  /** Metres, last GPS point counted, and recent [time, metres] for the current pace. */
  dist: number;
  lastPt: GpsPoint | null;
  recent: [number, number][];
  /** How hard it feels (1–10), when there's no heart rate; with the seconds at each, for the summary. */
  rpe: number | null;
  rpeSec: number;
  rpeSum: number;
  rpeAt: number | null;
  tip: CardioTip | null;
  aiCalls: number;
  /** Sets or rounds done (racket, combat), when the current one started, and the end of the rest between them. */
  rounds: number;
  /** Racket sports and volleyball: the current set's score [you, them] and the finished sets' scores. */
  score?: [number, number];
  setScores?: [number, number][];
  roundAt: number | null;
  restUntil: number | null;
  hrStatus: HrStatus;
  gpsStatus: 'off' | 'waiting' | 'live' | 'denied' | 'unavailable';
  /** After Finish: the saved cardio log's id (null while saving or when it was too short), and the end note. */
  savedId: string | null;
  saveState: 'none' | 'saving' | 'saved' | 'failed' | 'short';
  note: CardioTip | null;
};

const KEY = 'adro.cardioLive.v1';
let state: CardioSessionState | null = null;
const subs = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(now = false) {
  const write = () => {
    saveTimer = null;
    (state ? AsyncStorage.setItem(KEY, JSON.stringify(state)) : AsyncStorage.removeItem(KEY)).catch(() => {});
  };
  if (now) {
    if (saveTimer) clearTimeout(saveTimer);
    return write();
  }
  if (!saveTimer) saveTimer = setTimeout(write, 5000);
}

function set(next: CardioSessionState | null, flush = false) {
  state = next;
  subs.forEach((f) => f());
  persist(flush);
}
const patch = (p: Partial<CardioSessionState>, flush = false) => state && set({ ...state, ...p }, flush);

/** A session from before the app was closed is picked up again. */
export const cardioLoaded = AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!v || state) return;
    const s = JSON.parse(v) as CardioSessionState;
    // One left open for over 12 hours (forgotten) is ended at its last moment.
    if (!s.endedAt && Date.now() - s.startedAt > 12 * 3600_000) s.endedAt = s.pausedAt ?? s.startedAt + 3 * 3600_000;
    set({ ...s, hrStatus: 'off', gpsStatus: s.gps ? 'waiting' : 'off', lastPt: null });
  })
  .catch(() => {});

export const getCardio = () => state;
export function useCardioSession() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
}

/** Moving time in ms (pauses left out). */
export function movingMs(s: CardioSessionState, now = Date.now()) {
  const end = s.endedAt ?? s.pausedAt ?? now;
  return Math.max(0, end - s.startedAt - s.pausedMs);
}

export type StartConfig = Pick<CardioSessionState, 'sport' | 'kind' | 'planMin' | 'target' | 'cap' | 'planId' | 'source' | 'sensor' | 'gps' | 'speak' | 'goal' | 'preg' | 'nursing' | 'readiness' | 'age' | 'female' | 'weight' | 'injuries'>;

export function startCardio(c: StartConfig) {
  const now = Date.now();
  set(
    {
      ...c,
      id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      startedAt: now,
      pausedAt: null,
      pausedMs: 0,
      endedAt: null,
      hr: null,
      hrAt: null,
      hrMax: 0,
      hrSum: 0,
      hrSec: 0,
      hrRecent: [],
      zones: [0, 0, 0, 0, 0],
      dist: 0,
      lastPt: null,
      recent: [],
      rpe: null,
      rpeSec: 0,
      rpeSum: 0,
      rpeAt: null,
      tip: null,
      aiCalls: 0,
      rounds: 0,
      roundAt: now,
      restUntil: null,
      hrStatus: c.source === 'none' ? 'off' : 'connecting',
      gpsStatus: c.gps ? 'waiting' : 'off',
      savedId: null,
      saveState: 'none',
      note: null,
    },
    true,
  );
}

/** Close the RPE stretch up to now (time at the current effort counts toward the average). */
function rpeUpTo(s: CardioSessionState, now: number): Partial<CardioSessionState> {
  if (s.rpe == null || s.rpeAt == null || s.pausedAt || s.endedAt) return { rpeAt: now };
  const dt = Math.max(0, now - s.rpeAt) / 1000;
  return { rpeSec: s.rpeSec + dt, rpeSum: s.rpeSum + s.rpe * dt, rpeAt: now };
}

export function pauseCardio() {
  if (!state || state.pausedAt || state.endedAt) return;
  const now = Date.now();
  patch({ ...rpeUpTo(state, now), pausedAt: now, lastPt: null }, true);
}
export function resumeCardio() {
  if (!state || !state.pausedAt || state.endedAt) return;
  const now = Date.now();
  patch({ pausedMs: state.pausedMs + (now - state.pausedAt), pausedAt: null, rpeAt: now, lastPt: null }, true);
}
export function finishCardio() {
  if (!state || state.endedAt) return;
  const now = Date.now();
  const s = state;
  const p = s.pausedAt ? {} : rpeUpTo(s, now);
  // A pause before Finish ends it at the pause (the paused time isn't part of it).
  patch({ ...p, endedAt: s.pausedAt ?? now, saveState: 'saving' }, true);
}
export function clearCardio() {
  set(null, true);
}

/** A new heart rate reading. The time since the one before goes to that one's zone (gaps over 15 s aren't counted). */
export function addHr(bpm: number, at: number) {
  const s = state;
  if (!s || s.endedAt) return;
  if (s.hrAt != null && at <= s.hrAt) return;
  const recent = [...(s.hrRecent ?? []).filter(([t]) => t >= at - 180_000), [at, bpm] as [number, number]];
  const p: Partial<CardioSessionState> = { hr: bpm, hrAt: at, hrMax: s.pausedAt ? s.hrMax : Math.max(s.hrMax, bpm), hrRecent: recent.slice(-240) };
  if (s.hr != null && s.hrAt != null && !s.pausedAt && at > s.startedAt) {
    const dt = Math.min(15_000, at - Math.max(s.hrAt, s.startedAt)) / 1000;
    if (dt > 0) {
      const zones = [...s.zones];
      zones[hrZone(s.hr, s.age) - 1] += dt;
      Object.assign(p, { zones, hrSum: s.hrSum + s.hr * dt, hrSec: s.hrSec + dt });
    }
  }
  patch(p);
}

const R = 6371000;
function meters(a: GpsPoint, b: GpsPoint) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** New GPS points: distance between good points (within 35 m accuracy, not faster than the sport allows). */
export function addPoints(pts: GpsPoint[]) {
  const s = state;
  if (!s || s.endedAt || !s.gps) return;
  if (s.pausedAt) return void (s.gpsStatus !== 'live' && patch({ gpsStatus: 'live' }));
  const fast = s.sport === 'Bike' ? 25 : 12;
  let last = s.lastPt;
  let dist = s.dist;
  const recent = [...s.recent];
  for (const p of [...pts].sort((a, b) => a.at - b.at)) {
    if (p.at < s.startedAt || (p.acc != null && p.acc > 35)) continue;
    if (last && p.at <= last.at) continue;
    if (last) {
      const d = meters(last, p);
      const dt = (p.at - last.at) / 1000;
      if (dt > 0 && d / dt > fast) continue;
      // Standing still, GPS drifts a few metres: tiny moves aren't counted.
      if (d < 2) continue;
      dist += d;
    }
    last = p;
    recent.push([p.at, dist]);
  }
  while (recent.length > 2 && recent[0][0] < (last?.at ?? 0) - 45_000) recent.shift();
  patch({ dist, lastPt: last, recent: recent.slice(-60), gpsStatus: 'live' });
}

/** Current speed (m/s) from the last ~30 s of GPS, or null. */
export function speedNow(s: CardioSessionState, now = Date.now()) {
  if (!s.recent.length || s.pausedAt) return null;
  const end = s.recent[s.recent.length - 1];
  if (now - end[0] > 20_000) return 0;
  const start = s.recent.find(([t]) => t >= end[0] - 30_000) ?? s.recent[0];
  const dt = (end[0] - start[0]) / 1000;
  return dt >= 8 ? (end[1] - start[1]) / dt : null;
}

export function setRpe(v: number) {
  const s = state;
  if (!s || s.endedAt) return;
  const now = Date.now();
  patch({ ...rpeUpTo(s, now), rpe: Math.max(1, Math.min(10, Math.round(v))), rpeAt: now });
}

export const setTip = (tip: CardioTip) => patch({ tip });

/** A set or round is done: the rest timer starts (`rest` seconds). */
export function endRound(rest: number) {
  const s = state;
  if (!s || s.endedAt) return;
  const sc = s.score ?? [0, 0];
  // A set with a score keeps it; a set left at 0–0 just counts.
  const setScores = sc[0] || sc[1] ? [...(s.setScores ?? []), sc] : (s.setScores ?? []);
  patch({ rounds: s.rounds + 1, roundAt: null, restUntil: Date.now() + rest * 1000, score: [0, 0], setScores }, true);
}
/** Score of the current set: +1 (or −1 to undo) for you (0) or them (1). */
export function addScore(side: 0 | 1, by: 1 | -1 = 1) {
  const s = state;
  if (!s || s.endedAt) return;
  const sc: [number, number] = [...(s.score ?? [0, 0])] as [number, number];
  sc[side] = Math.max(0, Math.min(99, sc[side] + by));
  patch({ score: sc });
}
/** Every set's score so far, the current one too when it has points: "6-4, 3-6, 2-1". Null when nothing was scored. */
export function scoreText(s: Pick<CardioSessionState, 'score' | 'setScores'>) {
  const all = [...(s.setScores ?? []), ...(s.score && (s.score[0] || s.score[1]) ? [s.score] : [])];
  return all.length ? all.map(([a, b]) => `${a}-${b}`).join(', ') : null;
}
/** The next set or round starts (rest over or skipped). */
export function startRound() {
  const s = state;
  if (!s || s.endedAt) return;
  patch({ roundAt: Date.now(), restUntil: null }, true);
}
export const countAi = () => state && patch({ aiCalls: state.aiCalls + 1 });
export const setHrStatus = (hrStatus: HrStatus) => state && state.hrStatus !== hrStatus && patch({ hrStatus });
export const setGpsStatus = (gpsStatus: CardioSessionState['gpsStatus']) => state && state.gpsStatus !== gpsStatus && patch({ gpsStatus });
export const setSpeak = (speak: boolean) => patch({ speak });
export const setSaved = (p: Pick<CardioSessionState, 'saveState'> & Partial<Pick<CardioSessionState, 'savedId'>>) => patch(p, true);
export const setNote = (note: CardioTip) => patch({ note }, true);

/** Average heart rate (time-weighted), or null without readings. */
export const avgHr = (s: CardioSessionState) => (s.hrSec >= 30 ? Math.round(s.hrSum / s.hrSec) : null);
/** Average effort (1–10) from what you tapped, or null. */
export const avgRpe = (s: CardioSessionState) => (s.rpeSec >= 30 ? Math.round((s.rpeSum / s.rpeSec) * 10) / 10 : s.rpe);

/** Easy (0), moderate (1) or hard (2) for the cardio log, from the average zone (heart rate, or how hard it felt). */
export function sessionIntensity(s: CardioSessionState) {
  const a = avgHr(s);
  const r = avgRpe(s);
  const z = a ? hrZone(a, s.age) : r != null ? rpeZone(r) : s.target;
  return z <= 2 ? 0 : z === 3 ? 1 : 2;
}

/** Calories so far: from heart rate when measured (Keytel, kept near the sport's estimate), otherwise from the sport's METs. */
export function sessionKcal(s: CardioSessionState, now = Date.now()) {
  const min = movingMs(s, now) / 60000;
  const guess = sportKcal(s.sport, sessionIntensity(s), s.weight, min);
  const a = avgHr(s);
  return a ? heartKcal({ avgHr: a, minutes: min, weightKg: s.weight, age: s.age, female: s.female, guess }) : guess;
}

/** "12:05" or "1:02:05". */
export function clockText(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
/** Kilometres with two decimals ("3.42"). */
export const kmText = (m: number) => (m / 1000).toFixed(2);
/** Pace per km ("6:05") for running and walking, or speed in km/h ("24.3") for the bike; null when not moving. */
export function paceText(speed: number | null, sport: SportId): { value: string; unit: 'km/h' | '/km' } | null {
  if (speed == null || speed < 0.5) return null;
  if (sport === 'Bike') return { value: (speed * 3.6).toFixed(1), unit: 'km/h' };
  const sec = Math.round(1000 / speed);
  if (sec > 60 * 30) return null;
  return { value: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, unit: '/km' };
}
