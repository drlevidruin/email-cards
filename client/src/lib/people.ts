import type { EmailThread } from './types';

/** The other person in a thread: whoever is not the account's own address. */
export function counterpart(thread: EmailThread): { name: string; email: string } {
  const mine = thread.accountEmail.toLowerCase();
  return (
    thread.participants.find((p) => p.email.toLowerCase() !== mine) ||
    thread.participants[0] || { name: 'Unknown', email: '' }
  );
}
