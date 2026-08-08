import { useEffect, useState } from 'react';

/**
 * Returns true once the component has mounted on the client. Useful for
 * gating browser-only logic (Telegram SDK, viewport) and avoiding hydration
 * mismatches when the same code can render on a server in the future.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
