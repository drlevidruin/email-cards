// Pure: no imports but types and people.ts, so a check can run it under node.
import type { EmailThread } from './types';
import { othersOf, type Person } from './people.ts';

const TWO_PART = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.au', 'co.il', 'org.il', 'ac.il', 'co.jp', 'com.br', 'co.nz', 'co.za', 'co.in',
]);

const FREE_EXACT = new Set([
  'gmail.com', 'googlemail.com', 'ymail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'proton.me', 'protonmail.com', 'pm.me', 'mail.com', 'zoho.com', 'fastmail.com', 'hey.com',
]);
// yahoo.*, hotmail.*, gmx.*, yandex.* on any suffix
const FREE_FIRST = new Set(['yahoo', 'hotmail', 'gmx', 'yandex']);

/** The organization's registrable domain of an address (`news@e.lofta.com` gives `lofta.com`), or null for a free mail domain or no domain. */
export function registrableDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const host = email.slice(at + 1).trim().toLowerCase().replace(/\.+$/, '');
  const parts = host.split('.');
  if (parts.length < 2 || parts.some((p) => p === '')) return null;
  const take = TWO_PART.has(parts.slice(-2).join('.')) ? 3 : 2;
  if (parts.length < take) return null;
  const domain = parts.slice(-take).join('.');
  if (FREE_EXACT.has(domain) || FREE_FIRST.has(parts[parts.length - take])) return null;
  return domain;
}

const SUFFIX_WORD = /\.(?:com|net|org|co|io|ai|app|us|biz|info|edu|gov|tv|me)$/i;

const words = (name: string): string[] =>
  name
    .split(/\s+/)
    .map((w) => w.replace(SUFFIX_WORD, ''))
    .filter((w) => w !== '');

const real = (name: string): string => (name && !name.includes('@') ? name.trim() : '');

const titleCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The chat's name from its senders (newest last): one shared display name, else their shared leading words, else the newest sender's name, else the domain's main label. */
export function companyName(senders: { name: string }[], domain: string): string {
  const names = senders.map((s) => real(s.name)).filter(Boolean);
  const distinct = [...new Set(names)];
  if (distinct.length === 1) return distinct[0];
  if (distinct.length > 1) {
    const lists = distinct.map(words);
    const lead: string[] = [];
    for (let i = 0; i < lists[0].length; i += 1) {
      const w = lists[0][i];
      if (lists.every((l) => l[i] !== undefined && l[i].toLowerCase() === w.toLowerCase())) lead.push(w);
      else break;
    }
    if (lead.length > 0) return lead.join(' ');
    return distinct[distinct.length - 1];
  }
  return titleCase(domain.split('.')[0] ?? domain);
}

export interface OrgInput {
  threads: EmailThread[];
  /** My own addresses, lower case. */
  mine: (t: EmailThread) => Set<string>;
  /** Addresses the owner muted in the screener, lower case. */
  muted: Set<string>;
  /** A thread that is a mailing, an update or a receipt (sample data has no headers, so this is its evidence). */
  isUpdate: (t: EmailThread) => boolean;
  /** An address that looks like a mailing system (noreply, news@, a mail.shop.com host). */
  looksBulk: (email: string) => boolean;
}

export interface Group {
  key: string;
  people: Person[];
  threads: EmailThread[];
  company: boolean;
  domain?: string;
}

/** The key one address chat has: one address, or "g:" and the sorted addresses. */
export function keyOfPeople(people: { email: string }[]): string {
  const list = [...new Set(people.map((p) => p.email.toLowerCase()).filter(Boolean))].sort();
  return list.length >= 2 ? `g:${list.join(',')}` : list[0] ?? '';
}

/**
 * Splits threads into chats. An address is a company sender when any thread says so (its own sender list, or, for data with no
 * headers, a mailing, update or receipt thread, or a mailing-looking address). All company senders of one organization share a
 * chat `o:<domain>`. People, group conversations and free mail domains keep their own chats.
 */
export function groupThreads(input: OrgInput): Map<string, Group> {
  const { threads, mine, muted, isUpdate, looksBulk } = input;
  const others = new Map<string, Person[]>();
  const company = new Set<string>();
  for (const t of threads) {
    const people = othersOf(t, mine(t));
    others.set(t.id, people);
    if (people.length !== 1) continue;
    const addr = people[0].email.toLowerCase();
    const says = t.companySenders ? t.companySenders.map((a) => a.toLowerCase()).includes(addr) : isUpdate(t);
    if (says || looksBulk(addr)) company.add(addr);
  }
  const groups = new Map<string, Group>();
  for (const t of threads) {
    const people = others.get(t.id) ?? [];
    const key = keyOfPeople(people);
    if (!key) continue;
    if (people.length < 2 && muted.has(key)) continue;
    const addr = people.length === 1 ? people[0].email.toLowerCase() : '';
    const domain = addr && company.has(addr) ? registrableDomain(addr) : null;
    if (domain) {
      const ck = `o:${domain}`;
      const g = groups.get(ck) ?? { key: ck, people: [], threads: [], company: true, domain };
      if (!g.people.some((p) => p.email.toLowerCase() === addr)) g.people.push(people[0]);
      g.threads.push(t);
      groups.set(ck, g);
      continue;
    }
    const g = groups.get(key) ?? { key, people, threads: [], company: false };
    g.threads.push(t);
    groups.set(key, g);
  }
  return groups;
}
