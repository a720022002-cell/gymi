import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useT } from '@/i18n';
import { askAI } from '@/lib/ai';
import { useAiConsent } from '@/lib/aiConsent';
import { guidance, type Line, phaseAt, phaseCue, rpeZone, ruleNote, ruleTip, zoneNow } from '@/lib/cardioCoach';
import { startGps, stopGps } from '@/lib/cardioGps';
import {
  addHr,
  addPoints,
  avgHr,
  avgRpe,
  type CardioSessionState,
  clockText,
  countAi,
  endRound,
  finishCardio,
  getCardio,
  kmText,
  movingMs,
  paceText,
  pauseCardio,
  resumeCardio,
  sessionIntensity,
  sessionKcal,
  setGpsStatus,
  setHrStatus,
  setNote,
  setSaved,
  setTip,
  scoreText,
  speedNow,
  startRound,
  useCardioSession,
} from '@/lib/cardioSession';
import { hush, say } from '@/lib/cardioVoice';
import { hrZone } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { streamHeartRate } from '@/lib/liveHr';
import { supabase } from '@/lib/supabase';
import { sportInfo } from '@/lib/sports';
import { onCardioAction, syncCardioActivity } from '@/lib/widgetSync';
import { useSettings } from '@/theme/settings';
import type { CardioActivityProps } from '@/widgets/CardioActivity';

/** SF Symbols for the Live Activity. */
const SYMBOL: Record<string, CardioActivityProps['icon']> = {
  Run: 'figure.run',
  Walk: 'figure.walk',
  Bike: 'figure.outdoor.cycle',
  Swim: 'figure.pool.swim',
  Row: 'figure.rower',
  Elliptical: 'figure.elliptical',
  Stairs: 'figure.stair.stepper',
  HIIT: 'figure.highintensity.intervaltraining',
  Hike: 'figure.hiking',
  JumpRope: 'figure.jumprope',
  Padel: 'figure.racquetball',
  Tennis: 'figure.tennis',
  Squash: 'figure.squash',
  Badminton: 'figure.badminton',
  Football: 'figure.soccer',
  Basketball: 'figure.basketball',
  Volleyball: 'figure.volleyball',
  Boxing: 'figure.boxing',
  MartialArts: 'figure.martial.arts',
  Yoga: 'figure.yoga',
  Pilates: 'figure.pilates',
  Other: 'heart.fill',
};

/** Heart rate zone right now: from a fresh reading (under 15 s old), else from how hard it feels, else null. */
export function zoneOf(s: CardioSessionState, now = Date.now()) {
  if (s.hr != null && s.hrAt != null && now - s.hrAt < 15_000) return hrZone(s.hr, s.age);
  return s.rpe != null ? rpeZone(s.rpe) : null;
}

/**
 * What the session screen and the Lock Screen both show: the zone to be in, the zone you're in, and the coach's effort
 * line. Stop-and-go sports (padel, football, boxing…) are judged on the whole session so far (average heart rate, or how
 * hard it felt on average), not on any one spike.
 */
export function sessionGuide(s: CardioSessionState, now = Date.now()) {
  const sec = movingMs(s, now) / 1000;
  const loose = sportInfo(s.sport).intermittent;
  const ph = s.kind === 'intervals' ? phaseAt(sec, s.planMin, s.sport) : null;
  const want = zoneNow(s.target, s.cap, s.kind, ph);
  const zone = zoneOf(s, now);
  // Whole session: from 2 minutes of heart rate, or from how hard it felt on average; until then, right now.
  const whole = s.hrSec >= 120 && avgHr(s) != null ? hrZone(avgHr(s)!, s.age) : s.source === 'none' && s.rpeSec >= 120 && avgRpe(s) != null ? rpeZone(avgRpe(s)!) : null;
  const judged = loose ? (whole ?? zone) : zone;
  return { sec, ph, want, zone, judged, loose, g: guidance(judged, want, s.cap, loose) };
}

/** Your last sessions of this sport (before this one), so the coach can compare and set a target to beat. */
type PastSession = { daysAgo: number; min: number; km?: number; paceMinKm?: string; speedKmh?: number; avgHr?: number; zone2Min?: number; hardMin?: number; score?: string };
const pastCache = new Map<string, Promise<PastSession[]>>();
function loadPast(s: CardioSessionState): Promise<PastSession[]> {
  const hit = pastCache.get(s.id);
  if (hit) return hit;
  const p = (async () => {
    const { data, error } = await supabase
      .from('cardio_logs')
      .select('created_at,minutes,avg_hr,distance_m,zones,score')
      .eq('sport', s.sport)
      .lt('created_at', new Date(s.startedAt).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return (data as { created_at: string; minutes: number; avg_hr: number | null; distance_m: number | null; zones: number[] | null; score: string | null }[]).map((r) => {
      const km = r.distance_m ? Math.round(r.distance_m / 10) / 100 : undefined;
      const pace = km && r.minutes ? r.minutes / km : null;
      return {
        daysAgo: Math.max(0, Math.round((s.startedAt - new Date(r.created_at).getTime()) / 864e5)),
        min: r.minutes,
        ...(km ? { km } : {}),
        ...(pace ? (s.sport === 'Bike' ? { speedKmh: Math.round((km! / r.minutes) * 600) / 10 } : { paceMinKm: `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')}` }) : {}),
        ...(r.avg_hr ? { avgHr: r.avg_hr } : {}),
        ...(r.zones ? { zone2Min: Math.round((r.zones[1] ?? 0) / 60), hardMin: Math.round(((r.zones[3] ?? 0) + (r.zones[4] ?? 0)) / 60) } : {}),
        ...(r.score ? { score: r.score } : {}),
      };
    });
  })().catch(() => []);
  pastCache.set(s.id, p);
  return p;
}

/** The session as the AI sees it (numbers only, nothing that names the person), with your past sessions of this sport and what the coach already said. */
function aiData(s: CardioSessionState, phase: 'start' | 'half' | 'change' | 'end', past: PastSession[] = [], said: string[] = []) {
  const now = s.endedAt ?? Date.now();
  const { sec, want, zone } = sessionGuide(s, now);
  const sp = phase === 'end' ? (s.dist > 0 ? s.dist / Math.max(1, sec) : null) : speedNow(s, now);
  const pace = paceText(sp, s.sport);
  const fresh = s.hr != null && s.hrAt != null && now - s.hrAt < 15_000;
  return {
    sport: s.sport,
    phase,
    minute: Math.round(sec / 60),
    plannedMin: s.planMin,
    kind: s.kind,
    hr: phase === 'end' ? avgHr(s) : fresh ? s.hr : null,
    hrMax: phase === 'end' && s.hrMax ? s.hrMax : undefined,
    zone,
    targetZone: want,
    maxZone: s.cap,
    zonesMin: s.hrSec >= 30 ? s.zones.map((v) => Math.round(v / 6) / 10) : null,
    ...(pace ? (pace.unit === 'km/h' ? { speedKmh: +pace.value } : { paceMinKm: pace.value }) : {}),
    distKm: s.gps && s.dist > 0 ? Math.round(s.dist / 10) / 100 : null,
    rpe: s.source === 'none' ? avgRpe(s) : null,
    sportGroup: sportInfo(s.sport).group,
    stopAndGo: sportInfo(s.sport).intermittent || undefined,
    avgZoneWholeSession: sportInfo(s.sport).intermittent ? sessionGuide(s, now).judged : undefined,
    ...(scoreText(s) ? { score: scoreText(s) } : {}),
    ...(sportInfo(s.sport).counter ? { [sportInfo(s.sport).counter?.label === 'Round' ? 'roundsDone' : 'setsDone']: s.rounds } : {}),
    goal: s.goal,
    readiness: s.readiness,
    age: s.age,
    injuries: s.injuries,
    pregnancy: s.preg ? 'pregnant' : s.nursing ? 'after birth' : undefined,
    ...(past.length ? { pastSessions: past } : {}),
    ...(said.length ? { alreadySaid: said.slice(-6) } : {}),
  };
}

type Coach = { id: string; said: string[]; started: boolean; lastTipAt: number; n: number; lastPhase: string | null; lastZone: number | null; offSince: number | null; lastGuideAt: number; aiStart: boolean; aiHalf: boolean; aiChange: boolean };
const freshCoach = (id: string): Coach => ({ id, said: [], started: false, lastTipAt: 0, n: 0, lastPhase: null, lastZone: null, offSince: null, lastGuideAt: 0, aiStart: false, aiHalf: false, aiChange: false });

/**
 * The live cardio session, whatever screen you're on (mounted once in the root layout): reads heart rate and GPS,
 * coaches with rule tips (and up to 4 AI tips, when AI is allowed), speaks them, keeps the Lock Screen up to date and
 * handles its buttons, and saves the session when it ends. Renders nothing.
 */
export function CardioLive() {
  const { t, lang } = useT();
  const s = useCardioSession();
  const food = useFood();
  const consent = useAiConsent().value;
  const { liveActivity } = useSettings();
  const live = !!s && !s.endedAt;
  const id = s?.id ?? null;
  const source = s?.source ?? 'none';
  const sensorId = s?.sensor?.id;
  const sensorName = s?.sensor?.name;
  const startedAt = s?.startedAt;
  const gps = !!s?.gps;

  // Latest values for timers and listeners that are set up once per session.
  const latest = useRef({ t, lang, consent, food });
  useEffect(() => {
    latest.current = { t, lang, consent, food };
  });
  const coach = useRef<Coach>(freshCoach(''));

  // Heart rate from the sensor or the watch.
  useEffect(() => {
    if (!live || source === 'none') return;
    return streamHeartRate(source, { sensor: sensorId ? { id: sensorId, name: sensorName ?? '' } : null, since: startedAt }, addHr, (st) => setHrStatus(st));
  }, [live, id, source, sensorId, sensorName, startedAt]);

  // GPS for outdoor sports (also while locked).
  useEffect(() => {
    if (!live || !gps) return;
    let on = true;
    const { t } = latest.current;
    startGps(addPoints, { title: t('Cardio session running'), body: t('Adro is measuring your distance and pace.') }).then((r) => {
      if (on && r !== 'ok') setGpsStatus(r === 'denied' ? 'denied' : 'unavailable');
    });
    return () => {
      on = false;
      stopGps();
    };
  }, [live, id, gps]);

  // The coach: every second, a cue when an interval phase starts, the effort line spoken when the zone changes or you stay
  // off target, a rule tip about every 75 s, and AI tips at the start, about halfway and after a big change.
  useEffect(() => {
    if (!live || !id) return;
    if (coach.current.id !== id) coach.current = freshCoach(id);
    const show = (line: Line, now: number) => {
      const c = coach.current;
      const { t, lang } = latest.current;
      setTip({ ...line, at: now });
      c.lastTipAt = now;
      c.said.push(t(line.key, line.vars));
      if (getCardio()?.speak) say(t(line.key, line.vars), lang);
    };
    const ai = (phase: 'start' | 'half' | 'change') => {
      const s0 = getCardio();
      const { consent, lang } = latest.current;
      // Only when AI was already allowed (no question pops up mid-run), and one call is kept for the end note.
      if (!s0 || consent !== 'yes' || s0.aiCalls >= 3) return;
      countAi();
      loadPast(s0)
        .then((past) => askAI<{ tip: string }>('cardio_tip', { lang, data: aiData(getCardio() ?? s0, phase, past, coach.current.said) }))
        .then((r) => {
        const s1 = getCardio();
        const tip = r.result?.tip?.trim();
        if (!tip || !s1 || s1.id !== id || s1.endedAt) return;
        const now = Date.now();
        setTip({ key: '', text: tip, ai: true, at: now });
        coach.current.lastTipAt = now;
        coach.current.said.push(tip);
        if (s1.speak) say(tip, latest.current.lang);
      });
    };
    const tick = () => {
      const s = getCardio();
      if (!s || s.id !== id || s.endedAt || s.pausedAt) return;
      const c = coach.current;
      const now = Date.now();
      const { sec, ph, judged: zone, loose, g } = sessionGuide(s, now);
      // Sets and rounds: a timed round (boxing) ends by itself; when the rest is over the next one starts.
      const counter = sportInfo(s.sport).counter;
      if (counter) {
        if (s.restUntil && now >= s.restUntil) {
          startRound();
          show(counter.label === 'Round' ? { key: 'Round {n}: go!', vars: { n: s.rounds + 1 } } : { key: 'Break over: set {n}. Stay light on your feet.', vars: { n: s.rounds + 1 } }, now);
          return;
        }
        if (counter.roundSec && s.roundAt && !s.restUntil && now - s.roundAt >= counter.roundSec * 1000) {
          endRound(counter.rest);
          show({ key: 'Round {n} done: rest {s} seconds. Breathe slow and deep.', vars: { n: s.rounds + 1, s: counter.rest } }, now);
          return;
        }
      }
      const ctx = { goal: s.goal, preg: s.preg, nursing: s.nursing, readiness: s.readiness, age: s.age, injuries: s.injuries, sport: s.sport };
      const cue = ph && ph.phase !== c.lastPhase ? phaseCue(ph) : null;
      if (ph) c.lastPhase = ph.phase;
      if (cue) show(cue, now);
      else if (!c.started || now - c.lastTipAt >= 75_000) show(ruleTip({ ...ctx, n: c.n++, sec, plannedMin: s.planMin, kind: s.kind }), now);
      else if (!loose && zone != null && c.lastZone != null && zone !== c.lastZone && g && s.speak && now - c.lastGuideAt > 20_000 && now - c.lastTipAt > 10_000) {
        // A new zone: say where to go (the screen shows it all the time).
        say(latest.current.t(g.line.key, g.line.vars), latest.current.lang);
        c.lastGuideAt = now;
      }
      c.started = true;
      if (zone != null) c.lastZone = zone;
      c.offSince = g && g.tone !== 'ok' ? (c.offSince ?? now) : null;
      // Off target for a while: said again, at most every 90 s.
      if (s.speak && g && c.offSince && now - c.offSince > 30_000 && now - c.lastGuideAt > 90_000 && now - c.lastTipAt > 15_000) {
        say(latest.current.t(g.line.key, g.line.vars), latest.current.lang);
        c.lastGuideAt = now;
      }
      if (!c.aiStart) {
        c.aiStart = true;
        ai('start');
      } else if (!c.aiHalf && sec >= (s.planMin ? s.planMin * 30 : 15 * 60)) {
        c.aiHalf = true;
        ai('half');
      } else if (!c.aiChange && c.offSince && now - c.offSince > 120_000) {
        c.aiChange = true;
        ai('change');
      }
    };
    tick();
    // Every second (round timers need it); tips and speech are spaced out by time inside.
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [live, id]);

  // Lock Screen and Dynamic Island (iPhone): at most every 5 s, right away when paused, resumed or the tip changes.
  const lastSync = useRef({ at: 0, key: '' });
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!s || s.endedAt || !liveActivity) {
      syncCardioActivity(null);
      return;
    }
    const now = Date.now();
    const key = `${s.pausedAt}|${s.tip?.at}|${s.speak}`;
    const due = now - lastSync.current.at >= 5000 || key !== lastSync.current.key;
    const send = () => {
      const cur = getCardio();
      if (!cur || cur.endedAt) return;
      const at = Date.now();
      lastSync.current = { at, key: `${cur.pausedAt}|${cur.tip?.at}|${cur.speak}` };
      const { zone, g } = sessionGuide(cur, at);
      const fresh = cur.hr != null && cur.hrAt != null && at - cur.hrAt < 15_000;
      const pace = paceText(speedNow(cur, at), cur.sport);
      const tipText = cur.tip ? (cur.tip.text ?? t(cur.tip.key, cur.tip.vars)) : '';
      syncCardioActivity({
        sport: t(sportInfo(cur.sport).name),
        icon: SYMBOL[cur.sport] ?? 'heart.fill',
        from: cur.startedAt + cur.pausedMs,
        paused: !!cur.pausedAt,
        elapsed: clockText(movingMs(cur, at)),
        hr: fresh ? String(cur.hr) : '',
        zoneText: fresh && zone ? t('Zone {z}', { z: zone }) : '',
        zone: fresh && zone ? zone : 0,
        dist: cur.gps && cur.dist > 0 ? `${kmText(cur.dist)} ${t('km')}` : '',
        pace: pace ? `${pace.value} ${t(pace.unit)}` : '',
        tip: g && g.tone !== 'ok' && fresh ? t(g.line.key, g.line.vars) : tipText,
        tipTone: g && fresh ? g.tone : 'ok',
        L: { pause: t('Pause'), resume: t('Resume'), finish: t('Finish'), paused: t('Paused') },
      });
    };
    if (due) return send();
    const tm = setTimeout(send, 5000 - (now - lastSync.current.at));
    return () => clearTimeout(tm);
  }, [s, liveActivity, t, lang]);

  // Pause, Resume and Finish on the Lock Screen (iOS 17+).
  useEffect(() => onCardioAction((a) => (a === 'c-pause' ? pauseCardio() : a === 'c-resume' ? resumeCardio() : finishCardio())), []);

  // Finished (here or on the Lock Screen): saved as today's cardio, then the coach's note for the summary.
  const saving = useRef<string | null>(null);
  const saveState = s?.saveState;
  useEffect(() => {
    const cur = getCardio();
    // Once per try: a failed save goes back to "saving" when you tap Try again.
    if (!cur || !cur.endedAt || cur.saveState !== 'saving') {
      saving.current = null;
      return;
    }
    if (saving.current === cur.id) return;
    saving.current = cur.id;
    hush();
    (async () => {
      const { t, lang, consent, food } = latest.current;
      const minutes = Math.round(movingMs(cur) / 60000);
      if (minutes < 1) return setSaved({ saveState: 'short' });
      const a = avgHr(cur);
      const info = sportInfo(cur.sport);
      const row = await food.addCardio(
        {
          kind: info.kind,
          name: info.kind === 'Other' && cur.sport !== 'Other' ? t(info.name) : null,
          minutes: Math.min(600, minutes),
          intensity: sessionIntensity(cur),
          kcal: Math.min(5000, Math.max(0, sessionKcal(cur))),
          avg_hr: a,
          max_hr: cur.hrMax >= 30 ? cur.hrMax : null,
          distance_m: cur.gps && cur.dist > 0 ? Math.round(cur.dist) : null,
          zones: a ? cur.zones.map((v) => Math.round(v)) : null,
          sport: cur.sport,
          source: cur.source,
          plan_ref: cur.planId,
          score: scoreText(cur),
          started_at: new Date(cur.startedAt).toISOString(),
        },
        food.today,
        // The watch saves its own workout to Apple Health: no second copy.
        { health: cur.source !== 'apple' },
      );
      if (!row) return setSaved({ saveState: 'failed' });
      setSaved({ saveState: 'saved', savedId: row.id });
      if (row.kind === 'Walk' && food.isToday) food.addSteps(row.minutes * 110);
      // The end note: from the AI when allowed and a call is left, otherwise the coach's own.
      let text: string | null = null;
      let ai = false;
      if (consent === 'yes' && cur.aiCalls < 4) {
        countAi();
        const r = await askAI<{ tip: string }>('cardio_tip', { lang, data: aiData(cur, 'end', await loadPast(cur), coach.current.said) });
        text = r.result?.tip?.trim() || null;
        ai = !!text;
      }
      const line = ruleNote({ goal: cur.goal, zones: cur.zones, minutes, target: cur.target, hasHr: !!a, preg: cur.preg || cur.nursing, intermittent: info.intermittent, rounds: cur.rounds, counter: info.counter?.label });
      setNote(ai && text ? { key: '', text, ai: true, at: Date.now() } : { ...line, at: Date.now() });
      supabase
        .from('cardio_logs')
        .update({ ai_note: (text ?? t(line.key, line.vars)).slice(0, 300) })
        .eq('id', row.id)
        .then(
          () => {},
          () => {},
        );
    })();
  }, [saveState, id]);

  return null;
}
