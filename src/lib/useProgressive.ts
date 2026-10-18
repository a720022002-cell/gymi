import { useEffect, useState } from 'react';

/**
 * How many rows of a long list to show: the first `first` right away, then `step` more every frame until all are
 * shown, so a screen with hundreds of rows opens fast. A new `key` (new search or filter) starts again.
 */
export function useProgressive(key: string, total: number, first = 30, step = 60) {
  const [s, setS] = useState({ key, n: first });
  const n = s.key === key ? s.n : first;
  useEffect(() => {
    if (n >= total) return;
    const id = setTimeout(() => setS({ key, n: n + step }), 16);
    return () => clearTimeout(id);
  }, [key, n, total, step]);
  return n;
}
