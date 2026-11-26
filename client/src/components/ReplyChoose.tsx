import { useState } from 'react';
import { ArrowUp, PenLine } from 'lucide-react';
import type { QuickActionChip } from '../lib/types';
import { stripReply } from '../lib/replyText';
import { goBack } from '../router';
import { Avatar } from './Avatar';
import './ReplyChoose.css';

interface Props {
  first: string;
  to: { name: string; email: string };
  goal?: string | null;
  chips: QuickActionChip[];
  /** The user's own edits, kept from the editor. */
  yours: string;
  drafting: boolean;
  onPick: (chip: QuickActionChip) => void;
  onYours: () => void;
  onOwn: () => void;
  onAsk: (instruction: string) => void;
}

/** Every suggested reply, in full, before anything is chosen. Choosing one opens it to edit; nothing is sent from here. */
export function ReplyChoose({ first, to, goal, chips, yours, drafting, onPick, onYours, onOwn, onAsk }: Props) {
  const [ask, setAsk] = useState('');
  const text = ask.trim();
  return (
    <div className="composer composer--choose">
      <header className="composer__head">
        <button className="composer__cancel t-subhead" onClick={goBack}>
          Cancel
        </button>
        <h1 className="t-headline composer__title">Reply to {first}</h1>
      </header>
      <div className="choose__scroll">
        <div className="choose__to">
          <Avatar name={to.name} card />
          <div className="choose__who">
            <div className="t-callout choose__name">{to.name}</div>
            <div className="t-footnote choose__addr">{to.email}</div>
          </div>
        </div>
        {goal && (
          <div className="choose__goal">
            <span className="t-caption choose__goal-label">Goal</span>
            <p className="t-callout choose__goal-text">{goal}</p>
          </div>
        )}
        {drafting ? (
          <div className="composer__bars">
            <span style={{ width: '70%' }} />
            <span style={{ width: '95%' }} />
            <span style={{ width: '55%' }} />
          </div>
        ) : (
          <ul className="choose__list">
            {yours && (
              <li>
                <button className="choose__card" onClick={onYours}>
                  <span className="t-headline">Your draft</span>
                  <span className="t-subhead choose__body">{stripReply(yours)}</span>
                </button>
              </li>
            )}
            {chips.map((c) => (
              <li key={c.id}>
                <button className="choose__card" onClick={() => onPick(c)}>
                  <span className="t-headline">{c.label}</span>
                  <span className="t-subhead choose__body">{c.draftBody ? stripReply(c.draftBody) : c.draftHint}</span>
                </button>
              </li>
            ))}
            <li>
              <button className="choose__card choose__card--own" onClick={onOwn}>
                <PenLine size={20} strokeWidth={1.75} />
                <span className="t-headline">Write my own</span>
              </button>
            </li>
          </ul>
        )}
      </div>
      <form
        className="composer__ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text) return;
          setAsk('');
          onAsk(text);
        }}
      >
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Tell Claude what to say" aria-label="Tell Claude what to say" />
        <button type="submit" className="composer__ask-go" aria-label="Write reply" disabled={!text}>
          <ArrowUp size={20} strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
