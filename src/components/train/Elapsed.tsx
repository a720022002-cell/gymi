import { useEffect, useState } from 'react';

import { Text } from '../Text';

/** Minutes and seconds since a workout started, ticking every second. */
export function Elapsed({ start }: { start: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - start) / 1000));
  return (
    <Text variant="small" weight={700} color="sec" num>
      {`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
    </Text>
  );
}
