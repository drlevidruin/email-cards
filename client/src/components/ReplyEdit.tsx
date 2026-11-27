import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { commitmentsIn, openBlankList } from '../lib/commitments';
import { isSampleInbox } from '../lib/sample';
import { BlankText } from './BlankText';
import { BlankRows, type BlankRowsHandle, type Fill } from './BlankRows';
import './ReplyChoose.css';

interface Props {
  first: string;
  to: { name: string; email: string };
  subject: string;
  body: string;
  /** The blanks the draft itself put in, word for word. Only these hold Send back. */
  blanks: string[];
  drafting: boolean;
  sending: boolean;
  desktop: boolean;
  onBody: (text: string) => void;
  /** Opened from a card row: the top left says `Cancel` and leaves for the deck. */
  cancel?: boolean;
  onBack: () => void;
  onSend: () => void;
}

/** The whole reply, with its greeting and sign-off, ready to change. Send is the only way anything leaves. */
export function ReplyEdit({ first, to, subject, body, blanks: draftBlanks, drafting, sending, desktop, onBody, cancel, onBack, onSend }: Props) {
  const box = useRef<HTMLTextAreaElement>(null);
  const open = openBlankList(body, draftBlanks);
  const blanks = open.length;
  // While a blank is open and the body has not been tapped, the body shows as text with the blanks as tokens
  const [tapped, setTapped] = useState(false);
  const rendered = blanks > 0 && !tapped;
  const toBody = useRef(false);
  const tap = () => {
    toBody.current = true;
    setTapped(true);
  };
  const wrap = useRef<HTMLDivElement>(null);
  // After Add, focus goes to the next blank's field, or to the end of the draft when none are left
  const refocus = useRef(false);
  // What the reply commits you to, recomputed 300ms after typing stops
  const [commits, setCommits] = useState(() => commitmentsIn(body));
  useEffect(() => {
    const t = window.setTimeout(() => setCommits(commitmentsIn(body)), 300);
    return () => window.clearTimeout(t);
  }, [body]);
  // A draft with blanks opens on the first blank's field. Otherwise, on a phone the keyboard would hide the text you should read, so only an empty editor takes focus there
  const opened = useRef(false);
  useEffect(() => {
    if (drafting || opened.current) return;
    opened.current = true;
    const field = wrap.current?.querySelector<HTMLInputElement>('.blank__input');
    if (field) return field.focus();
    const el = box.current;
    if (!el || !(desktop || !el.value)) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [drafting, desktop]);
  useEffect(() => {
    if (!refocus.current && !toBody.current) return;
    const own = toBody.current;
    refocus.current = false;
    toBody.current = false;
    const field = own ? null : wrap.current?.querySelector<HTMLInputElement>('.blank__input');
    if (field) return field.focus();
    const el = box.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [body, rendered]);
  const fill: Fill = (pairs, quiet) => {
    if (!quiet) refocus.current = true;
    onBody(pairs.reduce((text, [blank, value]) => text.split(blank).join(value), body));
  };
  // Send while a fill-in is open only adds what is typed; the press is remembered at pointer down, because the field's blur
  // adds the fill-in and closes it before the click arrives, and that click must not send.
  const rows = useRef<BlankRowsHandle>(null);
  const pressedAt = useRef(0);
  const press = () => {
    // The remembered press counts for about a second, so a press that slid off Send cannot make a later one do nothing
    const was = (pressedAt.current > 0 && performance.now() - pressedAt.current < 1000) || blanks > 0;
    pressedAt.current = 0;
    if (!was) return onSend();
    rows.current?.addTyped();
    // An empty fill-in gets the cursor, once the typed ones have been added
    window.setTimeout(() => wrap.current?.querySelector<HTMLInputElement>('.blank__input')?.focus(), 0);
  };

  return (
    <div className="composer composer--edit" ref={wrap}>
      <header className="composer__head">
        {cancel ? (
          <button className="composer__cancel t-subhead" onMouseDown={(e) => e.preventDefault()} onClick={onBack}>
            Cancel
          </button>
        ) : (
          <button className="composer__back t-subhead" onMouseDown={(e) => e.preventDefault()} onClick={onBack}>
            <ChevronLeft size={20} strokeWidth={1.75} />
            Replies
          </button>
        )}
        <h1 className="t-headline composer__title">Reply to {first}</h1>
        <button
          className="composer__send"
          disabled={!body.trim() || drafting || sending}
          aria-disabled={blanks > 0 || undefined}
          onPointerDown={() => (pressedAt.current = blanks > 0 ? performance.now() : 0)}
          onClick={press}
        >
          <span className="composer__send-pill t-callout">Send</span>
        </button>
      </header>
      {isSampleInbox() && <p className="t-subhead edit__sample">Sample inbox. Nothing is really sent.</p>}
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
      {!drafting && <BlankRows ref={rows} blanks={open} onFill={fill} />}
      {commits.length > 0 && !drafting && (
        <div className="edit__commits">
          <div className="t-footnote edit__commits-label">You're committing to</div>
          <ul>
            {commits.map((c, i) => (
              <li key={c} className="t-footnote edit__commit">
                <span className="edit__dot" />
                <span className="edit__quote">
                  {'\u201C'}
                  <BlankText text={c} blanks={draftBlanks} />
                  {'\u201D'}
                </span>
                {i === 0 && commits.length > 1 && <span className="edit__more">{`+${commits.length - 1}`}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="edit__body">
        {drafting ? (
          <div className="composer__bars">
            <span style={{ width: '70%' }} />
            <span style={{ width: '95%' }} />
            <span style={{ width: '55%' }} />
          </div>
        ) : rendered ? (
          <div
            className="t-body edit__text edit__text--shown"
            role="textbox"
            aria-label="Your reply"
            aria-multiline="true"
            tabIndex={0}
            onClick={tap}
            onKeyDown={(e) => {
              if (e.key.length === 1 || e.key === 'Enter') {
                e.preventDefault();
                tap();
              }
            }}
          >
            <BlankText text={body} blanks={draftBlanks} />
          </div>
        ) : (
          <textarea ref={box} className="t-body edit__text" aria-label="Your reply" value={body} onChange={(e) => onBody(e.target.value)} />
        )}
      </div>
    </div>
  );
}
