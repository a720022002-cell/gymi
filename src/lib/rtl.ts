import { I18nManager, Platform } from 'react-native';

/**
 * The style key that lands on this side of the screen. In Arabic the phone app runs right to left, and React Native
 * then swaps `left` and `right` in styles (and text alignment) by itself; the web doesn't. So code that picks a side
 * for Arabic ("right" in Arabic) goes through this, or the phone would swap it back to the wrong side.
 */
export const side = (s: 'left' | 'right'): 'left' | 'right' => (Platform.OS !== 'web' && I18nManager.isRTL ? (s === 'left' ? 'right' : 'left') : s);
