import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/Toast';
import { useT } from '@/i18n';
import { appleScan } from '@/lib/appleScan';
import { takePendingBarcode } from '@/lib/pending';
import { lookupProduct } from '@/lib/products';

/** A scanned product as one ingredient: its name, one serving in grams, and its numbers per 100 g. */
export type ScannedFood = { id?: string; n: string; g: number; per: { k: number; p: number; c: number; f: number } };

/**
 * Scan a barcode to add a product as an ingredient. `scan()` opens the scanner; when you come back, the product is
 * looked up and handed to `onFound` (one serving), or `onMissing` runs so you can add it with your own numbers.
 */
export function useScanProduct(onFound: (f: ScannedFood) => void, onMissing: () => void) {
  const { t, lang } = useT();
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  // The latest callbacks, so the screen can use its current state.
  const cb = useRef({ onFound, onMissing });
  useEffect(() => {
    cb.current = { onFound, onMissing };
  });
  const lookup = useCallback(
    (code: string) => {
      setScanning(true);
      lookupProduct(code, lang)
        .catch(() => null)
        .then((p) => {
          setScanning(false);
          if (!p) {
            toast(t('We couldn’t find this product. Add it with your own numbers.'), { icon: 'info' });
            return cb.current.onMissing();
          }
          const n = [p.name, p.brand && !p.name.includes(p.brand) ? p.brand : null].filter(Boolean).join(', ');
          cb.current.onFound({ id: p.id, n, g: Math.round(p.size), per: { k: p.k, p: p.p, c: p.c, f: p.f } });
          toast(t('Added {name}', { name: n }), { icon: 'check' });
        });
    },
    [lang, t, toast],
  );
  // A code from the barcode screen (phones that can't run Apple's scanner).
  useFocusEffect(
    useCallback(() => {
      const code = takePendingBarcode();
      if (code) lookup(code);
    }, [lookup]),
  );
  // iPhone: Apple's own scanner straight away; elsewhere our barcode screen, which hands the code back.
  const scan = async () => {
    if (!(await appleScan(lookup))) router.push({ pathname: '/barcode', params: { pick: '1' } });
  };
  return { scanning, scan };
}
