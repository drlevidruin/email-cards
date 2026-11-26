import { useEffect, useState } from 'react';

/** iOS does not shrink the layout viewport for the keyboard, so follow the visual viewport. */
export function useVisualViewport(): { h: number; top: number } | null {
  const [vh, setVh] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => setVh({ h: vv.height, top: vv.offsetTop });
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);
  return vh;
}
