import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The keyboard's height while it's open (0 when closed), for bars pinned to the bottom of the screen. iOS only: on
 * Android the window already shrinks above the keyboard, so pinned bars move up by themselves.
 */
export function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}
