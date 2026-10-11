// Voice input on phones with the system speech recognizer (expo-speech-recognition). Same API as speech.ts.
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export const canListen = () => {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
};

let finish: ((said: string | null) => void) | null = null;

/** Listen once. Resolves with the words, or null when nothing was heard, voice isn't allowed or isn't available. */
export async function listen(lang: 'en' | 'ar'): Promise<string | null> {
  if (!canListen()) return null;
  finish?.(null);
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
  if (!perm?.granted) return null;
  return new Promise((resolve) => {
    let said: string | null = null;
    const subs = [
      ExpoSpeechRecognitionModule.addListener('result', (e) => {
        const tx = e.results[0]?.transcript?.trim();
        if (tx) said = tx;
      }),
      ExpoSpeechRecognitionModule.addListener('error', () => done(said)),
      ExpoSpeechRecognitionModule.addListener('end', () => done(said)),
    ];
    function done(v: string | null) {
      subs.forEach((s) => s.remove());
      if (finish === done) finish = null;
      resolve(v);
    }
    finish = done;
    try {
      ExpoSpeechRecognitionModule.start({ lang: lang === 'ar' ? 'ar-SA' : 'en-US', interimResults: false, maxAlternatives: 1, continuous: false, addsPunctuation: false, iosTaskHint: 'dictation' });
    } catch {
      done(null);
    }
  });
}

/** Stop listening: whatever was heard so far is still returned. */
export const stopListening = () => {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    finish?.(null);
  }
};
