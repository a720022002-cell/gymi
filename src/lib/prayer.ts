// Iftar (sunset, Maghrib) and suhoor end (Fajr, Umm al-Qura: sun 18.5° below the horizon), worked out offline.
// Sun position from the standard low-precision formulas (about a minute of error), like praytimes.org.

export type City = { n: string; lat: number; lon: number; tz: number };

/** Saudi and Gulf cities. tz = hours from UTC (no daylight saving in the Gulf). */
export const CITIES: City[] = [
  { n: 'Riyadh', lat: 24.7136, lon: 46.6753, tz: 3 },
  { n: 'Jeddah', lat: 21.4858, lon: 39.1925, tz: 3 },
  { n: 'Makkah', lat: 21.3891, lon: 39.8579, tz: 3 },
  { n: 'Madinah', lat: 24.5247, lon: 39.5692, tz: 3 },
  { n: 'Dammam', lat: 26.4207, lon: 50.0888, tz: 3 },
  { n: 'Khobar', lat: 26.2172, lon: 50.1971, tz: 3 },
  { n: 'Al Ahsa', lat: 25.3833, lon: 49.5833, tz: 3 },
  { n: 'Taif', lat: 21.2703, lon: 40.4158, tz: 3 },
  { n: 'Tabuk', lat: 28.3835, lon: 36.5662, tz: 3 },
  { n: 'Buraidah', lat: 26.3592, lon: 43.9818, tz: 3 },
  { n: 'Hail', lat: 27.5114, lon: 41.7208, tz: 3 },
  { n: 'Abha', lat: 18.2164, lon: 42.5053, tz: 3 },
  { n: 'Jazan', lat: 16.8892, lon: 42.5511, tz: 3 },
  { n: 'Najran', lat: 17.4924, lon: 44.1277, tz: 3 },
  { n: 'Yanbu', lat: 24.0895, lon: 38.0618, tz: 3 },
  { n: 'Dubai', lat: 25.2048, lon: 55.2708, tz: 4 },
  { n: 'Abu Dhabi', lat: 24.4539, lon: 54.3773, tz: 4 },
  { n: 'Sharjah', lat: 25.3463, lon: 55.4209, tz: 4 },
  { n: 'Kuwait City', lat: 29.3759, lon: 47.9774, tz: 3 },
  { n: 'Doha', lat: 25.2854, lon: 51.531, tz: 3 },
  { n: 'Manama', lat: 26.2285, lon: 50.586, tz: 3 },
  { n: 'Muscat', lat: 23.588, lon: 58.3829, tz: 4 },
];

export const DEFAULT_CITY = 'Riyadh';

/** Find a city by name (any case, ignores "city"); falls back to Riyadh. */
export function cityOf(name?: string | null): City {
  const k = (name ?? '').trim().toLowerCase().replace(/\s+city$/, '');
  return CITIES.find((c) => c.n.toLowerCase() === k || c.n.toLowerCase().replace(/\s+city$/, '') === k) ?? CITIES[0];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => ((a % b) + b) % b;

/** Sun declination (degrees) and equation of time (hours) for a Julian day. */
function sun(jd: number) {
  const d = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * d, 360);
  const q = fix(280.459 + 0.98564736 * d, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * d;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - ra };
}

function julian(y: number, m: number, d: number) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

const hhmm = (h: number) => {
  const m = Math.round(fix(h, 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Local clock time (hours) when the sun is `angle` degrees below the horizon, before (-1) or after (+1) noon. */
function timeAt(c: City, jd: number, angle: number, dir: -1 | 1) {
  const { decl, eqt } = sun(jd);
  const noon = fix(12 - eqt, 24);
  const cosH = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(c.lat))) / (Math.cos(rad(decl)) * Math.cos(rad(c.lat)));
  const h = deg(Math.acos(Math.max(-1, Math.min(1, cosH)))) / 15;
  return noon + dir * h + c.tz - c.lon / 15;
}

/** Fajr (suhoor ends) and Maghrib (iftar) as "HH:MM" for a city on a day ("YYYY-MM-DD"). */
export function fastTimes(city: string | null | undefined, day: string) {
  const c = cityOf(city);
  const [y, m, d] = day.split('-').map(Number);
  // First guess at local noon, then refine once at each time's own moment (UTC).
  const jd = julian(y, m, d);
  let fajr = timeAt(c, jd + 0.5 - c.lon / 360, 18.5, -1);
  let maghrib = timeAt(c, jd + 0.5 - c.lon / 360, 0.833, 1);
  fajr = timeAt(c, jd + (fajr - c.tz) / 24, 18.5, -1);
  maghrib = timeAt(c, jd + (maghrib - c.tz) / 24, 0.833, 1);
  return { city: c.n, fajr: hhmm(fajr), maghrib: hhmm(maghrib) };
}

/** Add minutes to "HH:MM". */
export function addMin(t: string, min: number) {
  const [h, m] = t.split(':').map(Number);
  return hhmm((h * 60 + m + min) / 60);
}
