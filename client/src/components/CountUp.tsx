import { useEffect, useState } from 'react';

/** A number that counts up from 0 over `ms`. Shows the number at once when `run` is false or motion is reduced. */
export function CountUp({ to, run, ms = 600 }: { to: number; run: boolean; ms?: number }) {
  const [n, setN] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setN(Math.round(to * (1 - (1 - p) * (1 - p))));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return <span className="t-num">{n}</span>;
}
