import type { EmailThread } from './types';
import type { StackId } from './stacks';
import { counterpart } from './people';
import { firstName } from './utils';

/** A first word that is not a person's name: an article, or the role a company sends from. */
const NOT_A_NAME = /^(the|a|an|team|your|no-reply|noreply|info|support|billing|hello|help|admin|sales|service|accounts?|news|notifications?|mail|updates?|customer|orders?)$/i;

/** How a notice names the sender of a thread: `first` is set (`Maya`) only on Needs you and To-do cards from a person; everyone else is named in full. */
export function noticeWho(t: EmailThread, stack: StackId | null): { first: string | null; full: string } {
  const full = counterpart(t).name || 'This sender';
  const word = firstName(full);
  const mine = stack === 'needs-you' || stack === 'bookmarked' || (stack === null && t.bucket !== 'feed' && t.bucket !== 'paper_trail' && !t.receiptInfo);
  return { first: mine && word !== 'there' && !NOT_A_NAME.test(word) ? word : null, full };
}
