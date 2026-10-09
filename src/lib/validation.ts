// Form rules copied from docs/index.html. Messages are English keys; screens translate them.
import { COUNTRIES, type Country } from './countries';

export const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

export function usernameError(u: string): string {
  if (!u) return 'Pick a username. Friends use it to find you.';
  if (u.length < 3) return 'Use at least 3 characters.';
  if (u.length > 20) return 'Use 20 characters or fewer.';
  if (!/^[a-z]/.test(u)) return 'Start with a letter.';
  if (/[._]$/.test(u)) return 'Don’t end with a dot or underscore.';
  if (/[._]{2}/.test(u)) return 'Don’t use two dots or underscores in a row.';
  return '';
}

export const cleanUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9._]/g, '');

export function passwordError(v: string): string {
  if (!v || v.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'Use at least one letter and one number.';
  return '';
}

export const emailError = (v: string) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? '' : 'Enter a valid email, like name@example.com.');

export const country = (iso: string): Country => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0];

export const phoneDigits = (v: string) => toLatinDigits(v).replace(/\D/g, '').replace(/^0+/, '');

export function formatLocalPhone(iso: string, digits: string) {
  const c = country(iso);
  let out = '';
  let k = 0;
  for (const ch of c.mask) {
    if (k >= digits.length) break;
    out += ch === ' ' ? ' ' : digits[k++];
  }
  return (out + digits.slice(k)).trim();
}

export const fullPhone = (iso: string, digits: string) => `+${country(iso).code} ${formatLocalPhone(iso, digits)}`;

/** Returns [kind, message, vars] for the line under the phone field. */
export function phoneMessage(iso: string, digits: string, final = false): ['ok' | 'bad' | '', string, Record<string, string | number>?] {
  const c = country(iso);
  if (!digits) return final ? ['bad', 'Enter your phone number.'] : ['', 'We’ll send a code to check it’s yours.'];
  if (c.starts && digits[0] !== c.starts) return ['bad', '{country} mobile numbers start with {d}.', { country: c.en, d: c.starts }];
  if (digits.length > c.len)
    return ['bad', 'Too many digits. {country} numbers have {n} digits after +{code}.', { country: c.en, n: c.len, code: c.code }];
  if (digits.length < c.len)
    return final
      ? ['bad', 'Too short. {country} numbers have {n} digits.', { country: c.en, n: c.len }]
      : ['', c.len - digits.length > 1 ? '{n} more digits' : '1 more digit', { n: c.len - digits.length }];
  return ['ok', fullPhone(iso, digits)];
}

export type Dob = { y: number; m: number; d: number };

export function ageFrom(b: Dob, today = new Date()) {
  let a = today.getFullYear() - b.y;
  const m = today.getMonth() + 1;
  if (m < b.m || (m === b.m && today.getDate() < b.d)) a--;
  return a;
}

export const dobToIso = (b: Dob) => `${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;

export const daysIn = (m: number, y: number) => new Date(y, m, 0).getDate();

export function heightError(v: string) {
  const h = Number(v);
  return h >= 120 && h <= 230 ? '' : 'Height must be 120 to 230 cm.';
}

export function weightError(v: string) {
  if (!v) return 'Enter your weight.';
  const w = parseFloat(v);
  return w >= 30 && w <= 250 ? '' : 'Weight must be 30 to 250 kg.';
}

/** Keep only digits (and one decimal point for weight), converting Arabic digits. */
export function cleanNumber(v: string, decimal: boolean) {
  let s = toLatinDigits(v).replace(/[٫,]/g, '.');
  s = s.replace(decimal ? /[^\d.]/g : /[^\d]/g, '');
  if (decimal) s = s.replace(/(\..*)\./g, '$1').replace(/(\.\d).*/, '$1');
  return s.slice(0, decimal ? 5 : 3);
}
