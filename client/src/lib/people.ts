import type { EmailThread } from './types';

/** The other person in a thread: whoever is not the account's own address. */
export function counterpart(thread: EmailThread): { name: string; email: string } {
  const mine = thread.accountEmail.toLowerCase();
  return (
    thread.participants.find((p) => p.email.toLowerCase() !== mine) ||
    thread.participants[0] || { name: 'Unknown', email: '' }
  );
}

export interface Person { name: string; email: string }

/** Everyone on a thread except my own addresses, in the thread's order, one entry per address. */
export function othersOf(thread: EmailThread, mine: Set<string>): Person[] {
  const own = new Set([...mine].map((a) => a.toLowerCase()));
  own.add(thread.accountEmail.toLowerCase());
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of thread.participants) {
    const e = (p.email || '').toLowerCase();
    if (!e || own.has(e) || seen.has(e)) continue;
    seen.add(e);
    out.push({ name: p.name || p.email, email: p.email });
  }
  if (out.length === 0) {
    const c = counterpart(thread);
    if (c.email) out.push({ name: c.name || c.email, email: c.email });
  }
  return out;
}

const first = (name: string) => (name || '').replace(/,.*$/, '').trim().split(/\s+/)[0] || name;

/** "Jordan", "Jordan, Priya", "Jordan, Priya, Sam", "Jordan, Priya +2": first names, three at most. */
export function groupName(people: Person[]): string {
  const names = people.map((p) => first(p.name || p.email));
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
