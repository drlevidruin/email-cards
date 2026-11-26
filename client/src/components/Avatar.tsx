import { getInitials } from '../lib/utils';
import './Avatar.css';

/** Six muted hues. A sender's address picks one, so the same person always looks the same. */
const HUES = ['#9C4A2E', '#8A6514', '#3C5A7D', '#74466F', '#276A72', '#5F5A52'];

function hueFor(key: string): string {
  let h = 2166136261;
  for (const ch of key.trim().toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return HUES[(h >>> 0) % HUES.length];
}

/** The hue at 12% over white, as a solid color. */
function wash(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(255 - (255 - c) * 0.12);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export function Avatar({ name, email, small, card }: { name: string; email?: string; small?: boolean; card?: boolean }) {
  const hue = hueFor(email || name);
  return (
    <span className={`avatar${small ? ' avatar--small' : ''}${card ? ' avatar--card' : ''}`} style={{ background: wash(hue), color: hue }} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
