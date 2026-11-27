export interface Recipients { to: string[]; cc: string[]; bcc: string[] }
export interface ReplyPlan { rec: Recipients; /** I was bcc'd on the email being answered. */ bccd: boolean }

interface Msg { fromEmail: string; toEmails: string[]; ccEmails?: string[]; isOutbound: boolean; sentAt: string }

const low = (a: string) => a.trim().toLowerCase();
const uniq = (list: string[], skip: Set<string>) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of list.map(low)) {
    if (!a || skip.has(a) || seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out;
};
const time = (iso: string) => new Date(iso).getTime();
const newest = (list: Msg[]) => list.reduce<Msg | undefined>((a, m) => (!a || time(m.sentAt) > time(a.sentAt) ? m : a), undefined);

/** Who a reply goes to, by the newest email in the thread. Everyone goes in To. All addresses come back lower case, no repeats, never one of mine. */
export function replyPlan(messages: Msg[], fallback: string[], mine: Set<string>, isUpdate: boolean): ReplyPlan {
  const own = new Set([...mine].map(low));
  const plan = (to: string[], bccd = false): ReplyPlan => ({ rec: { to, cc: [], bcc: [] }, bccd });
  const last = newest(messages);
  if (!last) return plan(uniq(fallback, own));
  const named = [...last.toEmails, ...(last.ccEmails ?? [])];
  if (last.isOutbound) {
    // I wrote last: the same people again
    const again = uniq(named, own);
    return again.length ? plan(again) : plan(uniq(fallback, own));
  }
  const sender = uniq([last.fromEmail], own);
  if (sender.length === 0) return plan(uniq(fallback, own));
  const onIt = named.map(low).some((a) => own.has(a));
  // Not named on it: I was bcc'd, or it is a newsletter sent to a list. Either way only the sender hears back.
  if (named.length > 0 && !onIt) return plan(sender, !isUpdate);
  return plan(uniq([last.fromEmail, ...named], own));
}
