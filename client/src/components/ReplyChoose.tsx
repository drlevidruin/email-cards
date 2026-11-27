import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, PenLine } from 'lucide-react';
import type { QuickActionChip } from '../lib/types';
import { stripReply } from '../lib/replyText';
import { blanksOf } from '../lib/commitments';
import { goBack } from '../router';
import { BlankText } from './BlankText';
import { Avatar } from './Avatar';
import { DueLine } from './Hero';
import './ReplyChoose.css';

interface Props {
  first: string;
  to: { name: string; email: string };
  goal?: string | null;
  due?: string | null;
  chips: QuickActionChip[];
  /** The user's own edits, kept from the editor. */
  yours: string;
  drafting: boolean;
  onPick: (chip: QuickActionChip) => void;
  onYours: () => void;
  onOwn: () => void;
  onAsk: (instruction: string) => void;
}

/** A suggestion's text: three lines at most, fading out over the last line when it runs longer. */
function Suggestion({ text, blanks }: { text: string; blanks: string[] }) {
  const el = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const measure = () => el.current && setCut(el.current.scrollHeight > el.current.clientHeight + 1);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);
  return (
    <>
      <span ref={el} className={`t-subhead choose__body${cut ? ' is-cut' : ''}`}>
        <BlankText text={text} blanks={blanks} />
      </span>
      {blanks.length > 0 && <span className="t-footnote choose__blank">{`${blanks.length} ${blanks.length === 1 ? 'blank' : 'blanks'} to fill`}</span>}
    </>
  );
}

/** Every suggested reply, in full, before anything is chosen. Choosing one opens it to edit; nothing is sent from here. */
export function ReplyChoose({ first, to, goal, due, chips, yours, drafting, onPick, onYours, onOwn, onAsk }: Props) {
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
          <Avatar name={to.name} email={to.email} card />
          <div className="choose__who">
            <div className="t-callout choose__name">{to.name}</div>
            <div className="t-footnote choose__addr">{to.email}</div>
          </div>
        </div>
        {goal && (
          <div className="choose__goal">
            <DueLine label={due} />
            <p className="t-callout voice choose__goal-text">{goal}</p>
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
                  <Suggestion text={stripReply(yours)} blanks={[]} />
                </button>
              </li>
            )}
            {chips.map((c) => (
              <li key={c.id}>
                <button className="choose__card" onClick={() => onPick(c)}>
                  <span className="t-headline">{c.label}</span>
                  <Suggestion text={c.draftBody ? stripReply(c.draftBody) : c.draftHint ?? ''} blanks={c.draftBody ? blanksOf(c.draftBody) : []} />
                </button>
              </li>
            ))}
            <li>
              <button className="choose__own" onClick={onOwn}>
                <PenLine size={20} strokeWidth={1.75} />
                <span className="t-headline">Write my own</span>
              </button>
            </li>
          </ul>
        )}
        <form
          className="composer__ask"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text) return;
            setAsk('');
            onAsk(text);
          }}
        >
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Or say what to write" aria-label="Say what to write" />
          {text && (
            <button type="submit" className="composer__ask-go" aria-label="Write reply">
              <ArrowUp size={18} strokeWidth={1.75} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
