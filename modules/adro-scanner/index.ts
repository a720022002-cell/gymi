import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import { Platform, type ViewProps } from 'react-native';

export type AppleScannerProps = ViewProps & {
  /** Scanning while true (default). */
  active?: boolean;
  /** The phone's torch. */
  torch?: boolean;
  /** A barcode was read: its digits and kind. */
  onCode?: (e: { nativeEvent: { data: string; type: string } }) => void;
  /** This phone (or this moment) can't run Apple's scanner: show our own camera instead. */
  onUnavailable?: (e: { nativeEvent: { reason: string } }) => void;
};

let view: ComponentType<AppleScannerProps> | null = null;
if (Platform.OS === 'ios') {
  try {
    view = requireNativeView<AppleScannerProps>('AdroScanner');
  } catch {
    view = null;
  }
}

/** Apple's barcode scanner inside our screen (iPhone app builds that include it), else null. */
export const AppleScannerView = view;
