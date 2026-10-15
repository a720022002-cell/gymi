// Dates shown in the app's language (always with 0-9 digits).

/** A weekday's first letter in the app's language (0 = Sunday): S M T … or ح ن ث … */
export const weekdayLetter = (day: number, lang: 'en' | 'ar') =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'narrow' }).format(new Date(2026, 9, 4 + day, 12));
