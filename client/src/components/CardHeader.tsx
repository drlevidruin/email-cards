import { Paperclip } from 'lucide-react';
import type { GmailAccount } from '../lib/types';
import { Avatar } from './Avatar';
import './CardHeader.css';

interface Props {
  name: string;
  email?: string;
  account?: GmailAccount;
  /** How long ago, such as 2h. */
  age?: string;
  /** The subject, for line two. Without it, the account and age sit under the name. */
  subject?: string;
  /** The email has an attachment. */
  attached?: boolean;
}

/** The sender's monogram and name. With a subject: the account and age at the right of the name, the subject under it. */
export function CardHeader({ name, email, account, age, subject, attached }: Props) {
  const meta = (
    <div className="cardhead__meta t-footnote">
      {account && (
        <>
          <span className="cardhead__dot" style={{ background: account.color }} />
          <span>{account.label}</span>
        </>
      )}
      {age && <span className="t-num">{age}</span>}
    </div>
  );
  return (
    <div className="cardhead">
      <Avatar name={name} email={email} card />
      <div className="cardhead__who">
        {subject !== undefined ? (
          <>
            <div className="cardhead__line">
              <div className="cardhead__name t-callout">{name}</div>
              {meta}
            </div>
            <div className="cardhead__subject t-subhead">
              {attached && <Paperclip className="cardhead__clip" size={14} strokeWidth={1.75} aria-label="Has an attachment" />}
              <span className="cardhead__subject-text">{subject}</span>
            </div>
          </>
        ) : (
          <>
            <div className="cardhead__name t-callout">{name}</div>
            {meta}
          </>
        )}
      </div>
    </div>
  );
}
