import type { GmailAccount } from '../lib/types';
import { dueText, isHot } from '../lib/time';
import { Avatar } from './Avatar';
import './CardHeader.css';

interface Props {
  name: string;
  account?: GmailAccount;
  /** How long ago, such as 2h. */
  age?: string;
  due?: string | null;
}

/** The sender's monogram and name, with the account and age under it and the due date at the right. */
export function CardHeader({ name, account, age, due }: Props) {
  return (
    <div className="cardhead">
      <Avatar name={name} card />
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
      {due && <span className={`cardhead__due t-footnote${isHot(due) ? ' cardhead__due--hot' : ''}`}>{dueText(due)}</span>}
    </div>
  );
}
