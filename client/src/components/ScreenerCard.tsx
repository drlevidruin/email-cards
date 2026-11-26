import type { ReactNode } from 'react';
import type { GmailAccount, ScreenerSender } from '../lib/types';
import { useThread } from '../lib/useThread';
import { CardEmail } from './CardEmail';
import './Card.css';

interface Props {
  sender: ScreenerSender;
  account?: GmailAccount;
  desktop: boolean;
  overlay?: ReactNode;
}

/** A first-time sender, on the same card anatomy as an email: a neutral band on top, then their first email. */
export function ScreenerCard({ sender, account, desktop, overlay }: Props) {
  const full = useThread(sender.threadIds?.[0]);
  return (
    <article className="card">
      <header className="card__band">
        <div className="card__label-row">
          <div className="card__label">New sender</div>
          {account && (
            <div className="card__meta">
              <span className="card__dot" style={{ background: account.color }} />
              <span>{account.label}</span>
            </div>
          )}
        </div>
        <h2 className="card__name">{sender.name}</h2>
        <div className="card__address">{sender.email}</div>
        <p className="card__reason">{sender.aiReason}</p>
      </header>
      {full ? (
        <CardEmail key={full.id} thread={full} full={full} desktop={desktop} bookmark={null} headline hideSender noHighlight />
      ) : (
        <div className="card__main">
          <h3 className="card__sample-subject">{sender.sampleSubject}</h3>
          <p className="card__sample-snippet">{sender.sampleSnippet}</p>
        </div>
      )}
      {overlay}
    </article>
  );
}
