// Every sport and activity Adro can coach live (and the cardio plan can schedule), with what the coach needs to know
// about each: its group, METs for calories without heart rate, the "kind" it's saved as in cardio_logs (older app
// versions only know Walk, Run, Bike, Swim and Other), GPS, intervals, stop-and-go effort, and sets or rounds.
// The ids are stable English keys (used in links, saved logs and t()).
import type { IconName } from '@/components/Icon';

export type SportId =
  | 'Run'
  | 'Walk'
  | 'Hike'
  | 'Bike'
  | 'Swim'
  | 'Row'
  | 'Elliptical'
  | 'Stairs'
  | 'JumpRope'
  | 'HIIT'
  | 'Padel'
  | 'Tennis'
  | 'Squash'
  | 'Badminton'
  | 'Football'
  | 'Basketball'
  | 'Volleyball'
  | 'Boxing'
  | 'MartialArts'
  | 'Yoga'
  | 'Pilates'
  | 'Other';

export type SportGroup = 'Cardio' | 'Racket sports' | 'Team sports' | 'Combat' | 'Mind and body' | 'Other';

export type SportInfo = {
  id: SportId;
  /** The name to show, through t() ("Jump rope", "Martial arts"). */
  name: string;
  group: SportGroup;
  icon: IconName;
  /** METs at a moderate effort (Compendium of Physical Activities). */
  met: number;
  kind: 'Walk' | 'Run' | 'Bike' | 'Swim' | 'Other';
  /** Outdoors: distance and pace from GPS. */
  gps: boolean;
  /** Can be done as work/rest intervals. */
  intervals: boolean;
  /** Stop-and-go (points, plays, rounds): heart rate spikes are normal, so effort is judged on a few minutes' average. */
  intermittent: boolean;
  /** Sets (volleyball) or rounds (combat) to count, with a rest timer; rounds can have a set length. Racket sports
   * have none: just play, the session keeps time and heart rate. */
  counter: { label: 'Set' | 'Round'; rest: number; roundSec?: number } | null;
  /** Contact or fall risk, or jumping and high impact: not in pregnancy. */
  contact?: boolean;
  impact?: boolean;
  /** The zone the coach aims for by default, and a usual length in minutes. */
  zone: number;
  minutes: number;
};

export const SPORT_GROUPS: SportGroup[] = ['Cardio', 'Racket sports', 'Team sports', 'Combat', 'Mind and body', 'Other'];

const base = { gps: false, intervals: false, intermittent: false, counter: null, zone: 2, minutes: 30 } as const;
export const SPORTS: SportInfo[] = [
  { ...base, id: 'Run', name: 'Run', group: 'Cardio', icon: 'run', met: 9, kind: 'Run', gps: true, intervals: true, impact: true },
  { ...base, id: 'Walk', name: 'Walk', group: 'Cardio', icon: 'walk', met: 3.5, kind: 'Walk', gps: true, intervals: true, minutes: 40 },
  { ...base, id: 'Hike', name: 'Hike', group: 'Cardio', icon: 'walk', met: 6, kind: 'Walk', gps: true, minutes: 60 },
  { ...base, id: 'Bike', name: 'Bike', group: 'Cardio', icon: 'bike', met: 7, kind: 'Bike', gps: true, intervals: true, minutes: 40 },
  { ...base, id: 'Swim', name: 'Swim', group: 'Cardio', icon: 'drop', met: 7.5, kind: 'Swim', intervals: true },
  { ...base, id: 'Row', name: 'Row', group: 'Cardio', icon: 'pulse', met: 7, kind: 'Other', intervals: true, minutes: 25 },
  { ...base, id: 'Elliptical', name: 'Elliptical', group: 'Cardio', icon: 'bolt', met: 5, kind: 'Other', intervals: true },
  { ...base, id: 'Stairs', name: 'Stairs', group: 'Cardio', icon: 'up', met: 8.8, kind: 'Other', intervals: true, minutes: 20 },
  { ...base, id: 'JumpRope', name: 'Jump rope', group: 'Cardio', icon: 'timer', met: 11, kind: 'Other', intervals: true, impact: true, zone: 3, minutes: 15 },
  { ...base, id: 'HIIT', name: 'HIIT', group: 'Cardio', icon: 'flame', met: 8, kind: 'Other', intervals: true, impact: true, zone: 4, minutes: 20 },
  { ...base, id: 'Padel', name: 'Padel', group: 'Racket sports', icon: 'trophy', met: 7, kind: 'Other', intermittent: true, zone: 3, minutes: 90 },
  { ...base, id: 'Tennis', name: 'Tennis', group: 'Racket sports', icon: 'trophy', met: 7.3, kind: 'Other', intermittent: true, zone: 3, minutes: 60 },
  { ...base, id: 'Squash', name: 'Squash', group: 'Racket sports', icon: 'trophy', met: 9, kind: 'Other', intermittent: true, contact: true, zone: 3, minutes: 45 },
  { ...base, id: 'Badminton', name: 'Badminton', group: 'Racket sports', icon: 'trophy', met: 5.5, kind: 'Other', intermittent: true, zone: 3, minutes: 60 },
  { ...base, id: 'Football', name: 'Football', group: 'Team sports', icon: 'users', met: 7, kind: 'Other', intermittent: true, contact: true, impact: true, zone: 3, minutes: 90 },
  { ...base, id: 'Basketball', name: 'Basketball', group: 'Team sports', icon: 'users', met: 6.5, kind: 'Other', intermittent: true, contact: true, impact: true, zone: 3, minutes: 60 },
  { ...base, id: 'Volleyball', name: 'Volleyball', group: 'Team sports', icon: 'users', met: 4, kind: 'Other', intermittent: true, counter: { label: 'Set', rest: 120 }, impact: true, zone: 3, minutes: 60 },
  { ...base, id: 'Boxing', name: 'Boxing', group: 'Combat', icon: 'bolt', met: 7.8, kind: 'Other', intermittent: true, counter: { label: 'Round', rest: 60, roundSec: 180 }, contact: true, zone: 4, minutes: 30 },
  { ...base, id: 'MartialArts', name: 'Martial arts', group: 'Combat', icon: 'body', met: 7.5, kind: 'Other', intermittent: true, counter: { label: 'Round', rest: 60, roundSec: 180 }, contact: true, zone: 3, minutes: 45 },
  { ...base, id: 'Yoga', name: 'Yoga', group: 'Mind and body', icon: 'body', met: 2.5, kind: 'Other', zone: 1, minutes: 45 },
  { ...base, id: 'Pilates', name: 'Pilates', group: 'Mind and body', icon: 'body', met: 3, kind: 'Other', zone: 1, minutes: 45 },
  { ...base, id: 'Other', name: 'Other', group: 'Other', icon: 'flame', met: 6, kind: 'Other' },
];

export const sportInfo = (s: SportId): SportInfo => SPORTS.find((x) => x.id === s) ?? SPORTS[SPORTS.length - 1];

/** The sport for a name from a link, the plan or a watch ("run", "Cycling", "padel"…), or null when it isn't one. */
export function sportFrom(name?: string | null): SportId | null {
  const s = String(name ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!s) return null;
  const hit = SPORTS.find((x) => x.id.toLowerCase() === s || x.name.toLowerCase().replace(/\s+/g, '') === s);
  if (hit) return hit.id;
  const rules: [RegExp, SportId][] = [
    [/padel/, 'Padel'],
    [/squash/, 'Squash'],
    [/badminton/, 'Badminton'],
    [/tennis/, 'Tennis'],
    [/soccer|football/, 'Football'],
    [/basket/, 'Basketball'],
    [/volley/, 'Volleyball'],
    [/box|kickbox/, 'Boxing'],
    [/martial|karate|judo|taekwondo|jiujitsu|bjj|mma|wrestl/, 'MartialArts'],
    [/yoga/, 'Yoga'],
    [/pilates/, 'Pilates'],
    [/jumprope|skipping|rope/, 'JumpRope'],
    [/hik/, 'Hike'],
    [/cycl|bik|spin/, 'Bike'],
    [/rowing|rower/, 'Row'],
    [/stair|stepper/, 'Stairs'],
    [/jog|run/, 'Run'],
    [/walk/, 'Walk'],
    [/swim/, 'Swim'],
    [/ellip|crosstrain/, 'Elliptical'],
    [/hiit|interval/, 'HIIT'],
  ];
  return rules.find(([re]) => re.test(s))?.[1] ?? null;
}

/** Calories from the sport's METs (no heart rate): easy, moderate or hard. */
export const sportKcal = (s: SportId, intensity: number, weightKg: number, minutes: number) => Math.round(sportInfo(s).met * ([0.8, 1, 1.25][intensity] ?? 1) * weightKg * (minutes / 60));
