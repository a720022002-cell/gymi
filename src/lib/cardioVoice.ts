// Spoken coaching during a live cardio session (expo-speech: the phone's own voices, the browser's on the web). The
// text is already translated with t(), so Arabic tips are read by an Arabic voice. On iPhone the system's own audio
// session is used, so music is lowered while it speaks and comes back after.
import * as Speech from 'expo-speech';

let last = '';
let lastAt = 0;

/** Say a line (a newer line cuts off one still being read). The same line twice within 20 s is skipped. */
export function say(text: string, lang: 'en' | 'ar') {
  const s = text.replace(/[⁦⁩]/g, '').trim();
  if (!s) return;
  if (s === last && Date.now() - lastAt < 20_000) return;
  last = s;
  lastAt = Date.now();
  try {
    Speech.stop().catch(() => {});
    Speech.speak(s, { language: lang === 'ar' ? 'ar-SA' : 'en-US', rate: lang === 'ar' ? 0.95 : 1, useApplicationAudioSession: false });
  } catch {}
}

export function hush() {
  try {
    Speech.stop().catch(() => {});
  } catch {}
}
