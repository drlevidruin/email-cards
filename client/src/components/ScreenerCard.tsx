import type { ReactNode } from 'react';
import type { GmailAccount, ScreenerSender } from '../lib/types';
import { Avatar } from './Avatar';
import './Card.css';

interface Props {
  sender: ScreenerSender;
  desktop: boolean;
  account?: GmailAccount;
  overlay?: ReactNode;
}

export function ScreenerCard({ sender, desktop, account, overlay }: Props) {
  return (
    <article className="card">
      <div className="card__main">
        <div className="card__label-row">
          <div className="card__label">New sender</div>
          {account && (
            <div className="card__meta">
              <span className="card__dot" style={{ background: account.color }} />
              <span>{account.label}</span>
            </div>
          )}
        </div>
        <h2 className="card__name card__name--big">{sender.name}</h2>
        <div className="card__meta">{sender.email}</div>
        <h3 className="card__sample-subject">{sender.sampleSubject}</h3>
        {!desktop && <p className="card__sample-snippet">{sender.sampleSnippet}</p>}
        <hr className="card__rule card__rule--push" />
        <p className="card__reason">{sender.aiReason}</p>
      </div>
      {desktop && (
        <div className="card__pane">
          <div className="card__sender">
            <Avatar name={sender.name} />
            <div className="card__sender-text">
              <div className="card__name">{sender.name}</div>
              <div className="card__meta">{sender.email}</div>
            </div>
          </div>
          <h2 className="card__subject">{sender.sampleSubject}</h2>
          <p className="card__preview-body">{sender.sampleSnippet}</p>
        </div>
      )}
      {overlay}
    </article>
  );
}
