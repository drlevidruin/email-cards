import { useSyncExternalStore } from 'react';

function watch(query: string) {
  const subscribe = (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  };
  return () => useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** A laptop or wider: the rail layout. */
export const useIsDesktop = watch('(min-width: 1024px)');
/** Wide enough for the side panel as well. */
export const useIsWide = watch('(min-width: 1280px)');
