import { Platform } from 'react-native';

const AR = /[٠-٩۰-۹٫]/;

/** Arabic (and Persian) digits to 0–9, and the Arabic decimal mark to a dot. */
export const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/٫/g, '.');

/** Every text box in the app (web): Arabic digits turn into 0–9 as you type or paste.
 * Runs before React reads the box, so screens get the English digits without doing anything. */
export function installLatinDigits() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const fix = (el: EventTarget | null) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !AR.test(el.value)) return false;
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    let pos: number | null = null;
    try {
      pos = el.selectionStart;
    } catch {}
    // The prototype setter, so React notices the new value.
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, toLatinDigits(el.value));
    try {
      if (pos != null) el.setSelectionRange(pos, pos);
    } catch {}
    return true;
  };
  document.addEventListener(
    'input',
    (e) => {
      if (!(e as InputEvent).isComposing) fix(e.target);
    },
    true,
  );
  // Keyboards that compose text (some Android keyboards): fix it when the word is done.
  document.addEventListener(
    'compositionend',
    (e) => {
      if (fix(e.target)) e.target?.dispatchEvent(new Event('input', { bubbles: true }));
    },
    true,
  );
}
