import { useState } from 'react';
import type { Chat } from '../lib/chats';
import { isLiveMode } from '../lib/liveMode';
import { getInitials } from '../lib/utils';
import { logoSrc } from '../lib/pictures';
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
  const logo = logoSrc(email);
  const [bad, setBad] = useState<string | null>(null);
  if (logo && bad !== logo) {
    return (
      <span className={`avatar avatar--logo${small ? ' avatar--small' : ''}${card ? ' avatar--card' : ''}`} aria-hidden="true">
        <img src={logo} alt="" decoding="async" onError={() => setBad(logo)} />
      </span>
    );
  }
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

/** The smallest logo, in pixels across, that is used. A smaller one looks blurry, so the initials stay. */
const LOGO_MIN_PX = 48;

/** A company's logo from its domain, live mode only. It shows only once it has loaded at 48 pixels or more across; until then, and if it fails, the initials. */
function CompanyAvatar({ name, email, domain, small }: { name: string; email: string; domain: string; small?: boolean }) {
  const [state, setState] = useState<'wait' | 'ok' | 'bad'>('wait');
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  return (
    <span className={`avatar avatar--hue avatar--company${small ? ' avatar--small' : ''}`} style={{ background: hueOf(email || name), color: '#FFFFFF' }} aria-hidden="true">
      {getInitials(name)}
      {state !== 'bad' && (
        <img
          className="avatar__logo"
          src={src}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          style={state === 'ok' ? undefined : { visibility: 'hidden' }}
          onLoad={(e) => setState(e.currentTarget.naturalWidth >= LOGO_MIN_PX ? 'ok' : 'bad')}
          onError={() => setState('bad')}
        />
      )}
    </span>
  );
}

/** A chat's avatar: a pair for a group, the company's logo for a company chat, else the person's initials. */
export function ChatAvatar({ chat, small }: { chat: Chat; small?: boolean }) {
  if (chat.isGroup) return <AvatarPair people={chat.people} small={small} />;
  if (chat.isCompany && chat.domain) {
    if (isLiveMode()) return <CompanyAvatar name={chat.name} email={chat.email} domain={chat.domain} small={small} />;
    // The sample and the private copy use their bundled logos, looked up by any address in the chat
    const logoEmail = chat.people.find((p) => logoSrc(p.email))?.email ?? chat.email;
    return <Avatar name={chat.name} email={logoEmail} tone="hue" small={small} />;
  }
  return <Avatar name={chat.name} email={chat.email} tone="hue" small={small} />;
}
