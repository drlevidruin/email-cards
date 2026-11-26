import type { GmailAccount } from '../lib/types';
import { Avatar } from './Avatar';
import './CardHeader.css';

interface Props {
  name: string;
  email?: string;
  account?: GmailAccount;
  /** How long ago, such as 2h. */
  age?: string;
}

/** The sender's monogram and name, with the account and age under it. */
export function CardHeader({ name, email, account, age }: Props) {
  return (
    <div className="cardhead">
      <Avatar name={name} email={email} card />
      <div className="cardhead__who">
        <div className="cardhead__name t-callout">{name}</div>
        <div className="cardhead__meta t-footnote">
          {account && (
            <>
              <span className="cardhead__dot" style={{ background: account.color }} />
              <span>{account.label}</span>
            </>
          )}
          {age && <span className="t-num">{age}</span>}
        </div>
      </div>
    </div>
  );
}
