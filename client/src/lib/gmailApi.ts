/**
 * The one door to Gmail. It sends only GET requests, only to four kinds of address, with only the
 * Authorization header. Nothing that changes mail can pass through it. Pure: `fetch` is passed in.
 */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const ID = '[A-Za-z0-9_-]+';
const ALLOWED = [
  /^users\/me\/profile$/,
  /^users\/me\/threads\?labelIds=INBOX&maxResults=50$/,
  new RegExp(`^users/me/threads/${ID}\\?format=full$`),
  new RegExp(`^users/me/messages/${ID}/attachments/${ID}$`),
];

export function isAllowedPath(path: string): boolean {
  return ALLOWED.some((re) => re.test(path));
}

export type GetResult = { status: 'ok'; json: unknown } | { status: 'unauthorized' | 'forbidden' | 'missing' | 'later' | 'failed' };

const defaultSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** GET one allowed path. With `retry`, a 429 or 5xx is retried after 1, 2 then 4 seconds, and then gives up ('later'). */
export async function gmailGet(
  fetchFn: FetchFn,
  base: string,
  path: string,
  token: string,
  opts: { retry?: boolean; sleep?: (ms: number) => Promise<void> } = {}
): Promise<GetResult> {
  if (!isAllowedPath(path)) throw new Error('Not an allowed Gmail request');
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetchFn(`${base}/${path}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      return { status: 'failed' };
    }
    if (res.status === 401) return { status: 'unauthorized' };
    if (res.status === 403) return { status: 'forbidden' };
    if (res.status === 404) return { status: 'missing' };
    if (res.status === 429 || res.status >= 500) {
      if (!opts.retry || attempt >= 3) return { status: 'later' };
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) return { status: 'failed' };
    try {
      return { status: 'ok', json: await res.json() };
    } catch {
      return { status: 'failed' };
    }
  }
}
