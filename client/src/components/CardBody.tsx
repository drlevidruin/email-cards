import { ChevronRight, Paperclip } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { EmailAttachment } from '../lib/types';
import { findQuote } from '../lib/highlight';
import { formatBytes } from '../lib/utils';
import './CardBody.css';

interface Props {
  text: string;
  /** The Goal's source sentence; marked in the text. */
  quote?: string | null;
  attachments: EmailAttachment[];
}

/** The fade at the bottom covers about this much; the marked sentence must end above it when more text follows. */
const FADE = 28;
/** The foot row (36px) and the 4px above it. */
const FOOT = 40;

/** Where the shown text may start, earliest first: the paragraph that holds the mark, each sentence start after it, then the mark. */
function starts(text: string, at: [number, number]): number[] {
  const before = text.slice(0, at[0]);
  const para = Math.max(before.lastIndexOf('\n\n') + 2, before.lastIndexOf('\n') + 1, 0);
  const out = [para];
  const re = /[.!?]["')\]]*\s+/g;
  const seg = text.slice(para, at[0]);
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg))) {
    const i = para + m.index + m[0].length;
    if (i > out[out.length - 1] && i < at[0]) out.push(i);
  }
  if (at[0] > out[out.length - 1]) out.push(at[0]);
  return out;
}

/** The room the text has: the box's height, less the foot (Read all, the file chip) when it is not already showing. */
function roomWithFoot(el: HTMLElement, footShown: boolean): number {
  const wrap = el.parentElement as HTMLElement;
  return wrap.clientHeight - (footShown ? 0 : FOOT);
}

/** Build the text from one start point in a hidden copy of the box and say whether the marked sentence shows. */
function fits(el: HTMLElement, text: string, at: [number, number], from: number, mid: boolean, footShown: boolean, alwaysFoot: boolean, wholeOnly = false): boolean {
  const copy = document.createElement('div');
  copy.className = el.className;
  copy.setAttribute('aria-hidden', 'true');
  copy.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;height:auto;overflow:visible;width:${el.clientWidth}px`;
  const mark = document.createElement('mark');
  mark.className = 'cardbody__mark';
  mark.textContent = text.slice(at[0], at[1]);
  copy.append(document.createTextNode((mid ? '\u2026 ' : '') + text.slice(from, at[0])), mark, document.createTextNode(text.slice(at[1])));
  el.parentElement?.appendChild(copy);
  const bottom = mark.offsetTop + mark.offsetHeight;
  const natural = copy.offsetHeight;
  copy.remove();
  const room = roomWithFoot(el, footShown);
  // The whole email shows, and no foot is needed unless a file chip brings one
  const whole = from === 0 && natural <= (alwaysFoot ? room : room + FOOT);
  return wholeOnly ? whole : whole || bottom <= room - FADE;
}

/** The email on the card. It is clipped, never scrolled by the user; it starts at a paragraph or sentence so the marked sentence shows. */
export function CardBody({ text, quote, attachments }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  const [from, setFrom] = useState(0);
  const at = findQuote(text, quote);
  const hidden = from > 0;
  const mid = hidden && text[from - 1] !== '\n';
  // Anything hidden, above the shown start or below the last visible line, means there is more to read.
  const over = below || hidden;
  const footShown = over || attachments.length > 0;
  const foot = useRef(footShown);
  foot.current = footShown;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      let start = 0;
      if (at) {
        const list = starts(text, at);
        const always = attachments.length > 0;
        // An email that fits whole shows whole, from its first line
        if (fits(el, text, at, 0, false, foot.current, always, true)) {
          setFrom(0);
          setBelow(false);
          return;
        }
        const test = (i: number) => fits(el, text, at, list[i], list[i] > 0 && text[list[i] - 1] !== '\n', foot.current, always);
        // Whether the mark shows only improves as the start moves later, so search for the earliest start that fits
        let lo = 0;
        let hi = list.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (test(m)) hi = m;
          else lo = m + 1;
        }
        start = list[lo];
      }
      setFrom(start);
      setBelow(el.scrollHeight > (el.parentElement as HTMLElement).clientHeight + 2);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el.parentElement as HTMLElement);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, quote, attachments.length]);

  // After the text is laid out from its start, see whether anything is left below
  useLayoutEffect(() => {
    const el = box.current;
    const wrap = el?.parentElement;
    if (el && wrap) setBelow(el.scrollHeight > wrap.clientHeight + 2);
  });

  const lead = mid ? <span className="cardbody__lead">{'\u2026 '}</span> : null;
  const body = at && at[0] >= from ? (
    <>
      {lead}
      {text.slice(from, at[0])}
      <mark className="cardbody__mark">{text.slice(at[0], at[1])}</mark>
      {text.slice(at[1])}
    </>
  ) : (
    <>
      {lead}
      {text.slice(from)}
    </>
  );
  const first = attachments[0];
  const extra = attachments.length - 1;
  const dot = first ? first.filename.lastIndexOf('.') : -1;
  const stem = first ? (dot > 0 ? first.filename.slice(0, dot) : first.filename) : '';
  const ext = first && dot > 0 ? first.filename.slice(dot) : '';

  return (
    <>
      <div className="cardbody">
        <div className="cardbody__box t-body" ref={box}>{body}</div>
        {below && <div className="cardbody__fade" aria-hidden="true" />}
      </div>
      {(over || first) && (
        <div className="cardbody__foot">
          {over && (
            <span className="cardbody__more t-callout" data-opens>
              Read all
              <ChevronRight size={16} strokeWidth={1.75} />
            </span>
          )}
          {first && (
            <span className={`cardbody__files${over ? '' : ' cardbody__files--solo'}`}>
              <span className="cardbody__chip t-footnote" title={first.filename}>
                <Paperclip size={16} strokeWidth={1.75} />
                <span className="cardbody__name"><span className="cardbody__stem">{stem}</span>{ext}</span>
                <span className="cardbody__size">{formatBytes(first.sizeBytes)}</span>
              </span>
              {extra > 0 && <span className="cardbody__rest t-footnote">and {extra} more</span>}
            </span>
          )}
        </div>
      )}
    </>
  );
}
