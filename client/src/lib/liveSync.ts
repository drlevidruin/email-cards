import type { EmailMessage, EmailThread } from './types';
import { gmailGet, type FetchFn } from './gmailApi.ts';
import { parseThread, type LiveAccountInfo, type RawThread } from './gmailParse.ts';

/** One round of reading an account's inbox. Pure: no window, no storage; `fetch` and `sleep` are passed in. */
export interface SyncDeps {
  fetch: FetchFn;
  base: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type SyncOutcome = 'ok' | 'unauthorized' | 'forbidden' | 'later' | 'failed';

export interface SyncChanges {
  outcome: SyncOutcome;
  changed: { thread: EmailThread; messages: EmailMessage[] }[];
  /** Ids of saved threads that are no longer in the inbox list. Empty unless the list itself was read. */
  goneIds: string[];
  /** How many threads the inbox list named. */
  listed: number;
  /** Thread requests made, for the checks. */
  requests: number;
}

export const MAX_AT_ONCE = 4;
/** Gmail allows 250 units a second for each user and a thread costs 10, so thread requests start at most this far apart. */
export const START_GAP_MS = 100;

/**
 * Lists the inbox, then fetches only the threads that are new or whose history id changed, four at a time.
 * `known` maps each saved thread id (account prefix included) to its saved history id.
 * 401 or 403 stop at once and change nothing. 429 or 5xx wait 1, 2 and 4 seconds, then give up this round with what was read.
 */
export async function fetchChanges(
  deps: SyncDeps,
  account: LiveAccountInfo,
  token: string,
  mine: string[],
  known: Map<string, string | undefined>
): Promise<SyncChanges> {
  const empty = (outcome: SyncOutcome): SyncChanges => ({ outcome, changed: [], goneIds: [], listed: 0, requests: 0 });
  const opts = { retry: true, sleep: deps.sleep };
  const list = await gmailGet(deps.fetch, deps.base, 'users/me/threads?labelIds=INBOX&maxResults=50', token, opts);
  if (list.status !== 'ok') return empty(list.status === 'missing' ? 'failed' : list.status);
  const named = ((list.json as { threads?: { id?: string; historyId?: string }[] } | null)?.threads ?? []).filter((t): t is { id: string; historyId?: string } => typeof t?.id === 'string');
  const listedIds = new Set(named.map((t) => `${account.id}~${t.id}`));
  const todo = named.filter((t) => {
    const id = `${account.id}~${t.id}`;
    return !known.has(id) || known.get(id) !== t.historyId;
  });

  const out: SyncChanges = { outcome: 'ok', changed: [], goneIds: [], listed: named.length, requests: 0 };
  let stop: SyncOutcome | null = null;
  let next = 0;
  const now = deps.now ?? Date.now;
  const pause = deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  let slot = 0;
  const worker = async () => {
    while (stop === null && next < todo.length) {
      const t = todo[next++];
      out.requests += 1;
      // Starts are spread out: each takes the next free tenth of a second
      const at = Math.max(now(), slot);
      slot = at + START_GAP_MS;
      if (at > now()) await pause(at - now());
      const got = await gmailGet(deps.fetch, deps.base, `users/me/threads/${encodeURIComponent(t.id)}?format=full`, token, opts);
      if (got.status === 'ok') {
        try {
          out.changed.push(parseThread(got.json as RawThread, account, mine));
        } catch {
          // A thread that cannot be read is left out this round
        }
      } else if (got.status === 'unauthorized' || got.status === 'forbidden' || got.status === 'later') stop = got.status;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_AT_ONCE, todo.length) }, worker));

  if (stop === 'unauthorized' || stop === 'forbidden') return { ...empty(stop), requests: out.requests };
  out.goneIds = [...known.keys()].filter((id) => id.startsWith(`${account.id}~`) && !listedIds.has(id));
  if (stop === 'later') out.outcome = 'later';
  return out;
}
