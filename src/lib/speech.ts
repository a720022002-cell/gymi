// Voice input with the browser's speech recognition (Chrome, Safari on iPhone). Returns what was said.
type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function Recognition(): (new () => Rec) | null {
  const g = globalThis as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export const canListen = () => !!Recognition();

let current: Rec | null = null;

/** Listen once. Resolves with the words, or null when nothing was heard or voice isn't available. */
export function listen(lang: 'en' | 'ar'): Promise<string | null> {
  const R = Recognition();
  if (!R) return Promise.resolve(null);
  current?.stop();
  return new Promise((resolve) => {
    const r = new R();
    current = r;
    r.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let said: string | null = null;
    r.onresult = (e) => (said = e.results[0]?.[0]?.transcript ?? null);
    r.onerror = () => {};
    r.onend = () => {
      current = null;
      resolve(said);
    };
    try {
      r.start();
    } catch {
      resolve(null);
    }
  });
}

export const stopListening = () => current?.stop();
