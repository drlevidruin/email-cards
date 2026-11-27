import type { ReactNode } from 'react';
import type { EmailThread, GmailAccount } from '../lib/types';
import { cleanSubject, counterpart } from '../lib/stacks';
import { relativeTime } from '../lib/time';
import { useThread } from '../lib/useThread';
import { CardAnswers } from './CardAnswers';
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
  /** Show the answer rows at the foot of the card. */
  answers?: boolean;
  /** A row was pressed from the keyboard or an assistive tool: `qa` is a chip id, `@own` or `@choose`. */
  onAnswer?: (qa: string) => void;
}

/** An email as four blocks: who it is from, the ask, as much of the email as fits, and the answers. */
export function EmailCard({ thread, account, overlay, goalFirst, answers, onAnswer }: Props) {
  const full = useThread(thread.id);
  const newest = newestMessage(full);
  const kind = heroKind(thread, goalFirst);
  const who = counterpart(thread);
  const subject = kind === 'subject' ? undefined : cleanSubject(thread.subject);
  const attached = (newest?.attachments.length ?? 0) > 0;
  return (
    <article className={`card card--mail${answers ? ' card--answers' : ''}`}>
      <CardHeader name={who.name} email={who.email} account={account} age={relativeTime(thread.lastMessageAt)} subject={subject} attached={attached} />
      <Hero thread={thread} goalFirst={goalFirst} />
      <section className="cardwords">
        <div className="cardwords__label t-caption">The email</div>
        <CardBody text={newest ? newest.bodyText : thread.snippet} quote={kind === 'goal' ? thread.goalQuote : null} />
      </section>
      {answers && <CardAnswers thread={thread} onAnswer={onAnswer} />}
      {overlay}
    </article>
  );
}
