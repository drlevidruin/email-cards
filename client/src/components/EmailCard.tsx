import type { ReactNode } from 'react';
import { isAttachedFile } from '../lib/pictureData';
import type { EmailThread, GmailAccount } from '../lib/types';
import { cleanSubject, counterpart } from '../lib/stacks';
import { findQuote } from '../lib/highlight';
import { skim } from '../lib/skim';
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

/** An email on one sheet: who it is from, the ask, as much of the email as fits (without its hello and sign-off), and the answers. */
export function EmailCard({ thread, account, overlay, goalFirst, answers, onAnswer }: Props) {
  const full = useThread(thread.id);
  const newest = newestMessage(full);
  const kind = heroKind(thread, goalFirst);
  const who = counterpart(thread);
  const attached = (newest?.attachments.filter(isAttachedFile).length ?? 0) > 0;
  const raw = newest ? newest.bodyText : thread.snippet;
  const cut = skim(raw);
  // The sentence the Goal came from must be on the card: if skimming cut it away, the card shows the email whole
  const skimmed = kind === 'goal' && !findQuote(cut, thread.goalQuote) && findQuote(raw, thread.goalQuote) ? raw : cut;
  // The card's headline is the subject: an email that opens by repeating it loses that first line
  const title = cleanSubject(thread.subject).trim().toLowerCase();
  const firstLine = skimmed.split('\n', 1)[0];
  const words = kind === 'subject' && title && firstLine.trim().toLowerCase() === title ? skimmed.slice(firstLine.length).trimStart() || skimmed : skimmed;
  return (
    <article className={`card card--mail${answers ? ' card--answers' : ''}`}>
      <CardHeader name={who.name} email={who.email} account={account} age={relativeTime(thread.lastMessageAt)} attached={attached} />
      <Hero thread={thread} goalFirst={goalFirst} />
      <section className="cardwords">
        <CardBody text={words} quote={kind === 'goal' ? thread.goalQuote : null} />
      </section>
      {answers && <CardAnswers thread={thread} onAnswer={onAnswer} />}
      {overlay}
    </article>
  );
}
