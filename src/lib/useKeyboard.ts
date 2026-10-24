import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent, Platform } from 'react-native';

/**
 * The keyboard's height while it's open (0 when closed), for bars pinned to the bottom of the screen. iOS only: on
 * Android the window already shrinks above the keyboard, so pinned bars move up by themselves.
 */
export function useKeyboardHeight() {
  const [h, setH] = useState(() => (Platform.OS === 'ios' && Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0));
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // From where the keyboard's top edge lands on screen (right for the floating and split keyboards too); the
    // "did" events back up the "will" ones. A keyboard already open when this mounts is the starting value.
    const set = (e: KeyboardEvent) => setH(Math.max(0, Dimensions.get('window').height - e.endCoordinates.screenY));
    const subs = [
      Keyboard.addListener('keyboardWillShow', set),
      Keyboard.addListener('keyboardDidShow', set),
      Keyboard.addListener('keyboardWillChangeFrame', set),
      Keyboard.addListener('keyboardWillHide', () => setH(0)),
      Keyboard.addListener('keyboardDidHide', () => setH(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return h;
}
