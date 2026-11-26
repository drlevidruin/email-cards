import type { ReactNode } from 'react';
import type { EmailThread, GmailAccount } from '../lib/types';
import { cleanSubject, counterpart } from '../lib/stacks';
import { relativeTime } from '../lib/time';
import { useThread } from '../lib/useThread';
import { CardBody } from './CardBody';
import { CardHeader } from './CardHeader';
import { Hero, heroKind } from './Hero';
import { newestMessage } from './useNewest';
import './Card.css';

interface Props {
  thread: EmailThread;
  /** Show the account label under the sender name. */
  account?: GmailAccount;
  overlay?: ReactNode;
  /** The To-do deck: show the Goal even on a receipt. */
  goalFirst?: boolean;
}

/** A calm letter: who it is from, the Goal, the subject and as much of the email as fits. */
export function EmailCard({ thread, account, overlay, goalFirst }: Props) {
  const full = useThread(thread.id);
  const newest = newestMessage(full);
  const kind = heroKind(thread, goalFirst);
  return (
    <article className="card">
      <CardHeader name={counterpart(thread).name} email={counterpart(thread).email} account={account} age={relativeTime(thread.lastMessageAt)} />
      <Hero thread={thread} goalFirst={goalFirst} />
      <hr className="card__rule" />
      {kind !== 'subject' && <h2 className="card__subject t-headline">{cleanSubject(thread.subject)}</h2>}
      <CardBody text={newest ? newest.bodyText : thread.snippet} quote={kind === 'goal' ? thread.goalQuote : null} attachments={newest?.attachments ?? []} />
      {overlay}
    </article>
  );
}
