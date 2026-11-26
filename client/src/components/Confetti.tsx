import { useEffect, useRef } from 'react';
import './Confetti.css';

const COLORS = ['--accent', '--ink', '--confetti-1', '--confetti-2'];
const PIECES = 70;
const MS = 1500;

/** A short burst on a canvas. Nothing with reduced motion. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const colors = COLORS.map((c) => css.getPropertyValue(c).trim());
    const ox = w / 2;
    const oy = h * 0.3;
    const pieces = Array.from({ length: PIECES }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = 5 + Math.random() * 8;
      return {
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        s: 5 + Math.random() * 5, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        c: colors[i % colors.length], round: i % 3 === 0,
      };
    });
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = now - t0;
      ctx.clearRect(0, 0, w, h);
      if (t >= MS) return;
      const fade = t > MS - 400 ? (MS - t) / 400 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
