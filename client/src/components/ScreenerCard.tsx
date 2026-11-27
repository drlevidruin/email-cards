import type { ReactNode } from 'react';
import type { GmailAccount, ScreenerSender } from '../lib/types';
import { skim } from '../lib/skim';
import { useThread } from '../lib/useThread';
import { CardBody } from './CardBody';
import { CardHeader } from './CardHeader';
import { SenderHero } from './Hero';
import { newestMessage } from './useNewest';
import './Card.css';

interface Props {
  sender: ScreenerSender;
  account?: GmailAccount;
  overlay?: ReactNode;
}

/** A first-time sender, on the same anatomy as an email: who, why it is new, then their first email. */
export function ScreenerCard({ sender, account, overlay }: Props) {
  const full = useThread(sender.threadIds?.[0]);
  const first = newestMessage(full);
  return (
    <article className="card card--mail">
      <CardHeader name={sender.name} email={sender.email} account={account} />
      <SenderHero sender={sender} />
      <section className="cardwords">
        <h2 className="card__subject t-headline">{full ? full.subject : sender.sampleSubject}</h2>
        <CardBody text={skim(first ? first.bodyText : sender.sampleSnippet)} />
      </section>
      {overlay}
    </article>
  );
}
