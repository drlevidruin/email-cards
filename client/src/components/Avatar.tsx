import { getInitials } from '../lib/utils';
import './Avatar.css';

const HUES = ['#D9534A', '#C77A14', '#3A8F5C', '#2F86B8', '#7A5AC2', '#C2497F', '#1E9A8C', '#5B6FCB'];

/** A stable colour for an address. */
export function hueOf(email: string): string {
  let h = 2166136261;
  for (const ch of email.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return HUES[h % HUES.length];
}

/** A sender's initials on the table's green. One tone for everyone: the name beside it says who. With tone="hue", one of eight solid colours picked from the address. */
export function Avatar({ name, email, small, card, tone }: { name: string; email?: string; small?: boolean; card?: boolean; tone?: 'hue' }) {
  return (
    <span
      className={`avatar${small ? ' avatar--small' : ''}${card ? ' avatar--card' : ''}${tone ? ' avatar--hue' : ''}`}
      style={tone === 'hue' ? { background: hueOf(email || name), color: '#FFFFFF' } : undefined}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

/** A group's avatar: the first two people overlapped in the space one avatar takes. */
export function AvatarPair({ people, small }: { people: { name: string; email: string }[]; small?: boolean }) {
  const [a, b] = people;
  if (!a) return null;
  return (
    <span className={`avatarpair${small ? ' avatarpair--small' : ''}`} aria-hidden="true">
      <span className="avatarpair__a avatar avatar--hue" style={{ background: hueOf(a.email || a.name), color: '#FFFFFF' }}>
        {getInitials(a.name).slice(0, 1)}
      </span>
      {b && (
        <span className="avatarpair__b avatar avatar--hue" style={{ background: hueOf(b.email || b.name), color: '#FFFFFF' }}>
          {getInitials(b.name).slice(0, 1)}
        </span>
      )}
    </span>
  );
}
