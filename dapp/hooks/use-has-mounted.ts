'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` only after the component has mounted on the client.
 * Use this to gate any display value that depends on wagmi / wallet state
 * so that the first client render matches the SSR output and React doesn't
 * throw a hydration mismatch.
 */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
