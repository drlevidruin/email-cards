import type { EmailMessage, EmailThread } from '../lib/types';

/** The newest message of a loaded thread, or undefined while it loads. */
export function newestMessage(full: EmailThread | null): EmailMessage | undefined {
  const list = full?.messages ?? [];
  return list.reduce<EmailMessage | undefined>((a, m) => (!a || new Date(m.sentAt) > new Date(a.sentAt) ? m : a), undefined);
}
