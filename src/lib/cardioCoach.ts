// The cardio coach's rules for a live session: what to aim for by goal (and pregnancy, recovery, age, injuries), the
// heart rate zones, interval phases and the short tips shown and spoken while you move. Works offline, costs nothing.
// Every tip is an English key for t() (with {vars}), so the spoken Arabic is the same translation the screen shows.
import { hrZone, maxHeartRate } from './devices';
import { type SportId, sportInfo } from './sports';

export type CardioGoal = 'cut' | 'maintain' | 'gain';
export type CardioKind = 'steady' | 'intervals';
/** A line for t(): the English key and its values. */
export type Line = { key: string; vars?: Record<string, string | number> };

export type CoachCtx = {
  goal: CardioGoal;
  preg: boolean;
  nursing: boolean;
  /** Today's recovery score (0–100), or null when unknown. */
  readiness: number | null;
  age: number;
  injuries: string[];
  sport: SportId;
};

/** Food plan goal (0–1 bulk, 2 maintain, 3–4 cut) as the cardio coach's goal. */
export const goalOf = (foodGoal: number | null | undefined): CardioGoal => (foodGoal == null ? 'maintain' : foodGoal <= 1 ? 'gain' : foodGoal >= 3 ? 'cut' : 'maintain');

/** Zone colors 1–5 (easy blue-gray → red), the same in light and dark. */
export const ZONE_COLORS = ['#94A3B8', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'];
export const ZONE_NAMES = ['Very easy', 'Easy', 'Steady', 'Hard', 'Max'];

/** The average zone over the last few minutes (stop-and-go sports), from [time, bpm] readings. */
export function avgZone(readings: [number, number][], age: number, now: number, windowMs = 150_000) {
  const xs = readings.filter(([t]) => t >= now - windowMs).map(([, v]) => v);
  if (xs.length < 3) return null;
  return hrZone(xs.reduce((a, v) => a + v, 0) / xs.length, age);
}

/** Heart rate range of a zone (share of your highest: 50–60, 60–70, 70–80, 80–90, 90–100%). */
export function zoneBpm(zone: number, age: number): [number, number] {
  const max = maxHeartRate(age);
  const z = Math.max(1, Math.min(5, zone));
  return [Math.round(max * (0.4 + z * 0.1)), Math.round(max * (0.5 + z * 0.1))];
}
/** How hard it should feel (1–10) for a zone, when there's no heart rate. */
export const zoneRpe = (zone: number): [number, number] => ([[2, 3], [3, 4], [5, 6], [7, 8], [9, 10]] as [number, number][])[Math.max(1, Math.min(5, zone)) - 1];
/** The zone that matches how hard it feels (1–10). */
export const rpeZone = (rpe: number) => (rpe <= 3 ? 1 : rpe <= 4 ? 2 : rpe <= 6 ? 3 : rpe <= 8 ? 4 : 5);

/** Highest zone that's safe today: pregnancy and after birth 3, low recovery 2, 65 and older 4. */
export function maxZone(x: Pick<CoachCtx, 'preg' | 'nursing' | 'readiness' | 'age'>) {
  if (x.preg || x.nursing) return 3;
  if (x.readiness != null && x.readiness < 40) return 2;
  if (x.age >= 65) return 4;
  return 5;
}

/** What the coach recommends for today: target zone, minutes, steady or intervals, and why (shown before you start). */
export function recommend(x: CoachCtx): { zone: number; minutes: number; kind: CardioKind; why: Line; extra: Line | null } {
  const cap = maxZone(x);
  const info = sportInfo(x.sport);
  const z = (n: number) => Math.max(1, Math.min(cap, n));
  const knee = x.injuries.includes('Knee') && (info.impact || x.sport === 'Stairs' || info.group === 'Racket sports');
  const extra: Line | null =
    (x.preg || x.nursing) && info.contact
      ? { key: 'Pregnancy and after birth: contact sports and falls aren’t safe now. Walking, swimming, bike or yoga are better.' }
      : (x.preg || x.nursing) && info.impact
        ? { key: 'Pregnancy and after birth: avoid jumping and high impact. Keep it gentle.' }
        : knee
          ? { key: 'Your knee: bike, swim, row or elliptical are kinder than this today.' }
          : x.injuries.includes('Lower back')
            ? { key: 'Your lower back: stand tall and keep your core tight.' }
            : x.injuries.includes('Shoulder') && (info.group === 'Racket sports' || info.group === 'Combat' || x.sport === 'Swim' || x.sport === 'Volleyball')
              ? { key: 'Your shoulder: warm it up well and stop if it hurts.' }
              : null;
  const mins = Math.min(info.minutes, 60);
  if (x.preg) return { zone: z(Math.min(info.zone, 2)), minutes: Math.min(mins, 30), kind: 'steady', why: { key: 'Pregnancy: keep it easy enough to talk in full sentences, never above zone 3.' }, extra };
  if (x.nursing) return { zone: z(Math.min(info.zone, 2)), minutes: Math.min(mins, 25), kind: 'steady', why: { key: 'After birth: easy pace only until your doctor clears you for more.' }, extra };
  if (x.readiness != null && x.readiness < 40) return { zone: z(1), minutes: Math.min(mins, 20), kind: 'steady', why: { key: 'Your recovery is {n} today: a short, very easy session helps you recover.', vars: { n: x.readiness } }, extra };
  if (x.readiness != null && x.readiness < 60) return { zone: z(Math.min(info.zone, 2)), minutes: Math.min(mins, 25), kind: 'steady', why: { key: 'Your recovery is {n} today: keep it easy in zone 2.', vars: { n: x.readiness } }, extra };
  if (info.group === 'Mind and body') return { zone: 1, minutes: info.minutes, kind: 'steady', why: { key: 'Yoga and Pilates: slow breathing, zone 1 to 2. Great for recovery on any goal.' }, extra };
  if (info.intermittent) {
    const why: Line =
      x.goal === 'cut'
        ? { key: 'Stop-and-go sport: keep moving between points and plays. Total active time burns the most.' }
        : x.goal === 'gain'
          ? { key: 'Fun and good for your heart. Don’t overdo it before leg day.' }
          : { key: 'Spikes to zone 4 to 5 are normal here. Aim for an average around zone 3 and recover in the breaks.' };
    return { zone: z(info.zone), minutes: info.minutes, kind: 'steady', why, extra };
  }
  if (x.sport === 'HIIT') return { zone: z(4), minutes: 20, kind: 'intervals', why: { key: 'HIIT: short hard pushes in zone 4, then easy rest. Quality over quantity.' }, extra };
  if (x.goal === 'cut') return { zone: z(2), minutes: Math.max(mins, 40), kind: 'steady', why: { key: 'For fat loss: mostly zone 2, where your body burns the most fat. Add short zone 4 pushes if you choose intervals.' }, extra };
  if (x.goal === 'gain') return { zone: z(2), minutes: Math.min(mins, 20), kind: 'steady', why: { key: 'Building muscle: keep cardio short and easy so your legs recover for lifting.' }, extra };
  return { zone: z(Math.max(2, Math.min(info.zone, 3))), minutes: mins, kind: 'steady', why: { key: 'For heart health: a zone 2 base, with a few zone 4 pushes now and then.' }, extra };
}

// ---------------------------------------------------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------------------------------------------------
export type Phase = { phase: 'warm' | 'work' | 'rest' | 'cool' | 'free'; left: number; round: number; rounds: number; work: number; rest: number };

/** Work and rest seconds for a sport (HIIT 30/30, others 60 hard / 120 easy). */
export const intervalSecs = (sport: SportId): [number, number] => (sport === 'HIIT' || sport === 'JumpRope' ? [30, 30] : sport === 'Walk' ? [60, 90] : [60, 120]);

/**
 * Where an interval session is at `sec` seconds of moving time: warm-up (5 min, 3 for HIIT), work/rest rounds, then a
 * 3-minute cool-down before the planned end. Without planned minutes the rounds just keep going.
 */
export function phaseAt(sec: number, plannedMin: number | null, sport: SportId): Phase {
  const [work, rest] = intervalSecs(sport);
  const warm = sport === 'HIIT' ? 180 : 300;
  const cool = 180;
  const total = plannedMin ? plannedMin * 60 : null;
  const span = work + rest;
  const rounds = total ? Math.max(1, Math.floor((total - warm - cool) / span)) : 0;
  if (sec < warm) return { phase: 'warm', left: warm - sec, round: 0, rounds, work, rest };
  const t = sec - warm;
  const round = Math.floor(t / span) + 1;
  if (rounds && round > rounds) {
    const end = total as number;
    return { phase: sec < end ? 'cool' : 'free', left: Math.max(0, end - sec), round: rounds, rounds, work, rest };
  }
  const inRound = t % span;
  return inRound < work ? { phase: 'work', left: work - inRound, round, rounds, work, rest } : { phase: 'rest', left: span - inRound, round, rounds, work, rest };
}

/** The zone to be in right now: the work zone on a push, zone 2 on rest, warm-up and cool-down. */
export function zoneNow(target: number, cap: number, kind: CardioKind, ph: Phase | null) {
  if (kind !== 'intervals' || !ph) return Math.min(target, cap);
  if (ph.phase === 'work') return Math.min(Math.max(target, 4), cap);
  return Math.min(2, cap);
}

/**
 * What the screen says about your effort right now: speed up, ease off or right in the zone. For stop-and-go sports
 * `zone` is the whole session's average and spikes above the target are fine (only above the safe zone isn't).
 */
export function guidance(zone: number | null, want: number, cap: number, intermittent = false): { line: Line; tone: 'up' | 'ok' | 'down' } | null {
  if (zone == null) return null;
  if (zone > cap) return { line: { key: 'Slow down: stay at zone {z} or below today', vars: { z: cap } }, tone: 'down' };
  if (intermittent) {
    if (zone < want - 1) return { line: { key: 'Keep moving between points and plays' }, tone: 'up' };
    return { line: { key: 'Whole session so far: about zone {z} on average. Good work rate', vars: { z: zone } }, tone: 'ok' };
  }
  if (zone > want) return { line: { key: 'Ease off a little: aim for zone {z}', vars: { z: want } }, tone: 'down' };
  if (zone < want) return { line: { key: 'Speed up a little: aim for zone {z}', vars: { z: want } }, tone: 'up' };
  return { line: { key: 'Right in zone {z}. Keep this pace', vars: { z: want } }, tone: 'ok' };
}

// ---------------------------------------------------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------------------------------------------------
const SPORT_TIPS: Record<SportId, string[]> = {
  Run: ['Run tall, relax your shoulders and take short, quick steps.', 'Land under your hips, not out in front of you.', 'Relax your hands and breathe from your belly.'],
  Walk: ['Walk tall and swing your arms to go a bit faster.', 'Push off with your toes and keep your steps quick.', 'Look ahead, not down, and keep your shoulders loose.'],
  Hike: ['Short steps uphill, and lean slightly forward.', 'Go easy downhill: small steps protect your knees.', 'Drink a little every 15 to 20 minutes.'],
  Bike: ['Keep a smooth cadence, about 80 to 90 turns a minute.', 'Shift to an easier gear instead of grinding.', 'Relax your grip and keep your knees in line with your feet.'],
  Swim: ['Breathe out under water, then turn to breathe in.', 'Long, relaxed strokes; kick from the hips, not the knees.', 'Keep your head down and your hips high.'],
  Row: ['Legs, then body, then arms. Reverse it on the way back.', 'Push with your legs: they do most of the work.', 'Keep your back straight and your shoulders down.'],
  Elliptical: ['Stand tall and don’t lean on the handles.', 'Push through your heels to work your legs more.', 'Keep a steady rhythm you can hold.'],
  Stairs: ['Stand tall and use the rails lightly, not to hold your weight.', 'Full steps, pushing through your whole foot.', 'Slow down if your form breaks.'],
  JumpRope: ['Small, light jumps on the balls of your feet.', 'Turn the rope with your wrists, elbows close to your body.', 'Rest when your form breaks, then go again.'],
  HIIT: ['Full effort on work, deep slow breaths on rest.', 'Good form beats speed. Slow down if it breaks.', 'Land softly and keep your core tight.'],
  Padel: ['Stay light on your feet and split-step before each shot.', 'Recover between points: slow breaths through your nose.', 'Drink water between sets.', 'Bend your knees, not your back, for low balls.'],
  Tennis: ['Stay light on your feet and split-step as they hit.', 'Recover between points: slow breaths, shake out your arms.', 'Drink water at every change of ends.', 'Turn your shoulders, and let your legs power the shot.'],
  Squash: ['Get back to the T after every shot.', 'Recover between rallies with slow, deep breaths.', 'Drink water between games.', 'Bend your knees and keep your eyes on the ball.'],
  Badminton: ['Stay on your toes and return to the middle after each shot.', 'Recover between rallies: slow breaths.', 'Drink water between games.', 'Lunge with your knee over your foot, not past it.'],
  Football: ['Sprints and spikes to zone 4 to 5 are normal. Recover while the ball is away.', 'Drink water at every break.', 'Keep moving at an easy jog instead of standing still.'],
  Basketball: ['Sprints and spikes to zone 4 to 5 are normal. Recover on free throws.', 'Drink water at every timeout.', 'Land softly from jumps, knees over your toes.'],
  Volleyball: ['Stay low and ready between points.', 'Land softly from jumps, on both feet.', 'Drink water between sets.'],
  Boxing: ['Hands up, chin down, breathe out on every punch.', 'Stay on the balls of your feet and keep moving.', 'Rest fully between rounds: slow, deep breaths.'],
  MartialArts: ['Breathe out with each strike or throw.', 'Stay relaxed until the moment of effort.', 'Drink water between rounds.'],
  Yoga: ['Slow breaths in and out through your nose.', 'Move with your breath, never into pain.', 'Relax your jaw and shoulders.'],
  Pilates: ['Breathe out as you work, keep your core gently tight.', 'Slow and controlled beats fast.', 'Keep your neck long and relaxed.'],
  Other: ['Keep a steady effort you can hold.', 'Relax your shoulders and breathe deeply.', 'Stop if anything hurts.'],
};
const GOAL_TIPS: Record<CardioGoal, string[]> = {
  cut: ['Zone 2 is where your body burns the most fat. Keep a pace you could talk at.', 'Slow and steady wins on a cut: stay in zone 2.', 'Every easy minute adds up. Consistency beats speed.'],
  gain: ['Keep it easy: your legs need to recover for lifting.', 'Short, easy cardio helps your heart without taking from your gains.'],
  maintain: ['Zone 2 builds your base. A few zone 4 pushes make your heart stronger.', 'A pace you can hold and still talk is perfect for your heart.'],
};
const STOP_GO_TIPS: Record<CardioGoal, string[]> = {
  cut: ['Keep moving between points: total active time burns the most.', 'Walk around between plays instead of standing still.'],
  gain: ['Don’t overdo it before leg day: ease up if your legs feel heavy.', 'Have fun, but keep a little in the tank for lifting.'],
  maintain: ['Hard bursts and easy breaks: great for your heart.', 'Recover in the breaks so your next burst is strong.'],
};
const PREG_TIPS = ['Talk test: you should be able to talk in full sentences.', 'Sip water, and stop if you feel dizzy, short of breath or any pain.', 'Easy and steady is perfect. No need to push today.'];

/** A rule tip for this moment of the session (rotates through the sport's, the goal's and safety tips). */
export function ruleTip(x: CoachCtx & { n: number; sec: number; plannedMin: number | null; kind: CardioKind }): Line {
  const info = sportInfo(x.sport);
  const min = Math.floor(x.sec / 60);
  if (x.plannedMin) {
    const left = x.plannedMin - min;
    if (left === 5 && x.plannedMin >= 15) return { key: '5 minutes left. Finish strong.' };
    if (min === Math.floor(x.plannedMin / 2) && x.plannedMin >= 10) return { key: 'Halfway there. Keep it up!' };
    if (left <= 0) return { key: 'You hit your planned time. Cool down easy for 2 to 3 minutes.' };
  }
  if (min > 0 && min % 20 === 0) return { key: 'Take a sip of water.' };
  const pool: string[] = [
    ...(x.preg || x.nursing ? PREG_TIPS : []),
    ...(x.readiness != null && x.readiness < 50 ? ['Your recovery is low today: easy pace only.'] : []),
    ...(x.injuries.includes('Knee') ? ['Your knee: keep it smooth, no sudden stops or jumps.'] : []),
    ...(x.injuries.includes('Lower back') ? ['Your lower back: stand tall and keep your core tight.'] : []),
    ...(x.goal === 'cut' && x.kind === 'intervals' ? ['Short zone 4 pushes burn extra. Then back to easy.'] : []),
    ...(info.group === 'Mind and body' ? [] : info.intermittent ? STOP_GO_TIPS[x.preg || x.nursing ? 'maintain' : x.goal] : GOAL_TIPS[x.preg || x.nursing ? 'maintain' : x.goal]),
    ...SPORT_TIPS[x.sport],
  ];
  // Alternate safety and goal tips with form tips, so it doesn't repeat the same kind twice in a row.
  return { key: pool[x.n % pool.length] };
}

/** The cue when an interval phase starts. */
export function phaseCue(p: Phase): Line | null {
  if (p.phase === 'work') return { key: 'Push now: {n} seconds hard. Round {r}', vars: { n: p.work, r: p.round } };
  if (p.phase === 'rest') return { key: 'Easy now: recover for {n} seconds', vars: { n: p.rest } };
  if (p.phase === 'cool') return { key: 'Cool down: easy pace until the end' };
  if (p.phase === 'warm') return { key: 'Warm up easy for {n} minutes', vars: { n: Math.round(p.left / 60) } };
  return null;
}

/** A short note for the summary when the AI isn't used: how the time in zones went for your goal. */
export function ruleNote(x: { goal: CardioGoal; zones: number[]; minutes: number; target: number; hasHr: boolean; preg: boolean; intermittent?: boolean; rounds?: number; counter?: string }): Line {
  if (x.intermittent && x.rounds) return { key: x.counter === 'Round' ? '{n} minutes and {r} rounds done. Drink water and stretch your legs and shoulders.' : '{n} minutes and {r} sets done. Drink water and stretch your legs and shoulders.', vars: { n: x.minutes, r: x.rounds } };
  if (!x.hasHr)
    return {
      key: x.minutes === 1 ? 'Nice work: 1 minute done. A heart rate sensor makes the coaching more exact next time.' : 'Nice work: {n} minutes done. A heart rate sensor makes the coaching more exact next time.',
      vars: { n: x.minutes },
    };
  const total = x.zones.reduce((a, v) => a + v, 0) || 1;
  const inT = x.zones[x.target - 1] / total;
  const high = (x.zones[3] + x.zones[4]) / total;
  if (x.preg && x.zones[3] + x.zones[4] > 60) return { key: 'You went above zone 3 for a while. Next time slow down a little: easy is best now.' };
  if (inT >= 0.6) return { key: 'Great control: {p}% of the time in zone {z}. Exactly right for your goal.', vars: { p: Math.round(inT * 100), z: x.target } };
  if (x.intermittent) return { key: 'Good session: {a}% of it hard (zone 4 to 5), {b}% easy. Recover well and drink water.', vars: { a: Math.round(high * 100), b: Math.round(((x.zones[0] + x.zones[1]) / total) * 100) } };
  if (x.goal === 'cut' && high > 0.4) return { key: 'A lot of it was hard (zone 4 to 5). For fat loss, slow down to zone 2 next time.' };
  if (x.goal === 'gain' && x.minutes > 40) return { key: 'Good session. On a muscle-building plan, keep cardio shorter so your legs recover.' };
  return { key: '{p}% of the time in zone {z}. Next time try to stay in it a bit longer.', vars: { p: Math.round(inT * 100), z: x.target } };
}
