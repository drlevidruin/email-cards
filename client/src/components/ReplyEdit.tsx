import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import './ReplyChoose.css';

interface Props {
  first: string;
  to: { name: string; email: string };
  subject: string;
  body: string;
  drafting: boolean;
  sending: boolean;
  desktop: boolean;
  onBody: (text: string) => void;
  onBack: () => void;
  onSend: () => void;
}

/** The whole reply, with its greeting and sign-off, ready to change. Send is the only way anything leaves. */
export function ReplyEdit({ first, to, subject, body, drafting, sending, desktop, onBody, onBack, onSend }: Props) {
  const box = useRef<HTMLTextAreaElement>(null);
  // On a phone the keyboard would hide the text you should read, so only an empty editor takes focus there
  useEffect(() => {
    const el = box.current;
    if (!el || drafting || !(desktop || !el.value)) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [drafting, desktop]);

  return (
    <div className="composer composer--edit">
      <header className="composer__head">
        <button className="composer__back t-subhead" onClick={onBack}>
          <ChevronLeft size={20} strokeWidth={1.75} />
          Replies
        </button>
        <h1 className="t-headline composer__title">Reply to {first}</h1>
        <button className="composer__send" disabled={!body.trim() || drafting || sending} onClick={onSend}>
          <span className="composer__send-pill t-callout">Send</span>
        </button>
      </header>
      <div className="edit__rows">
        <div className="edit__row t-subhead">
          <span className="edit__label">To</span>
          <span className="edit__value">
            {to.name} <span className="edit__addr">{to.email}</span>
          </span>
        </div>
        <div className="edit__row t-subhead">
          <span className="edit__label">Subject</span>
          <span className="edit__value">{subject}</span>
        </div>
      </div>
      <div className="edit__body">
        {drafting ? (
          <div className="composer__bars">
            <span style={{ width: '70%' }} />
            <span style={{ width: '95%' }} />
            <span style={{ width: '55%' }} />
          </div>
        ) : (
          <textarea ref={box} className="t-body edit__text" aria-label="Your reply" value={body} onChange={(e) => onBody(e.target.value)} />
        )}
      </div>
    </div>
  );
}
