import { useEffect } from 'react';

/** Keeps --vvh and --vvtop on the page as the visible area (above the keyboard) and where it starts. A pinch zoom leaves them alone. */
export function useViewportVars(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
      raf = 0;
      if (Math.abs(vv.scale - 1) > 0.01) return;
      root.style.setProperty('--vvh', `${vv.height}px`);
      root.style.setProperty('--vvtop', `${vv.offsetTop}px`);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener('resize', queue);
    vv.addEventListener('scroll', queue);
    return () => {
      vv.removeEventListener('resize', queue);
      vv.removeEventListener('scroll', queue);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--vvtop');
    };
  }, []);
}
