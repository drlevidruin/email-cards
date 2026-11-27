import { useLayoutEffect, useRef, useState } from 'react';
import { findQuote } from '../lib/highlight';
import './CardBody.css';

interface Props {
  text: string;
  /** The Goal's source sentence; marked in the text. */
  quote?: string | null;
}

/** The fade at the bottom covers about this much; the marked sentence must end above it when more text follows. */
const FADE = 36;

/** Where the shown text may start, earliest first: every line start above the mark, each sentence start in the mark's paragraph, then the mark. */
function starts(text: string, at: [number, number]): number[] {
  const before = text.slice(0, at[0]);
  const para = Math.max(before.lastIndexOf('\n\n') + 2, before.lastIndexOf('\n') + 1, 0);
  const out: number[] = [];
  for (let i = 0; i < para; i++) if ((i === 0 || text[i - 1] === '\n') && text[i] !== '\n') out.push(i);
  out.push(para);
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

/** Build the text from one start point in a hidden copy of the box and measure it. */
function layout(el: HTMLElement, text: string, at: [number, number], from: number, mid: boolean) {
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
  return { bottom, natural, room: (el.parentElement as HTMLElement).clientHeight };
}

/** Whether the marked sentence shows from this start (or, with wholeOnly, whether the whole email does). */
function fits(el: HTMLElement, text: string, at: [number, number], from: number, mid: boolean, wholeOnly = false): boolean {
  const { bottom, natural, room } = layout(el, text, at, from, mid);
  // The whole email shows from its first line
  const whole = from === 0 && natural <= room;
  return wholeOnly ? whole : whole || bottom <= room - FADE;
}

/** The text ends in view with at least one and a half lines of empty room under it. */
function hasRoom(el: HTMLElement, text: string, at: [number, number], from: number): boolean {
  const { natural, room } = layout(el, text, at, from, from > 0 && text[from - 1] !== '\n');
  const style = getComputedStyle(el);
  const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
  return natural <= room && room - natural >= line * 1.5;
}

/** Word starts strictly between two points. */
function wordStarts(text: string, after: number, before: number): number[] {
  const out: number[] = [];
  for (let i = after + 1; i < before; i++) if (/\s/.test(text[i - 1]) && /\S/.test(text[i])) out.push(i);
  return out;
}

/** Fewest characters an earlier start must add; a two-word scrap above the question is worse than a little room. */
const MIN_ADDED = 40;

/** The email on the card. It is clipped, never scrolled by the user; it starts at a paragraph or sentence so the marked sentence shows. */
export function CardBody({ text, quote }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  const [from, setFrom] = useState(0);
  const at = findQuote(text, quote);
  const hidden = from > 0;
  const mid = hidden && text[from - 1] !== '\n';
  // Anything hidden, above the shown start or below the last visible line, means there is more to read.
  const over = below || hidden;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      let start = 0;
      if (at) {
        const list = starts(text, at);
        // An email that fits whole shows whole, from its first line
        if (fits(el, text, at, 0, false, true)) {
          setFrom(0);
          setBelow(false);
          return;
        }
        const test = (i: number) => fits(el, text, at, list[i], list[i] > 0 && text[list[i] - 1] !== '\n');
        const test2 = (from: number) => fits(el, text, at, from, text[from - 1] !== '\n');
        // Whether the mark shows only improves as the start moves later, so search for the earliest start that fits
        let lo = 0;
        let hi = list.length - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (test(m)) hi = m;
          else lo = m + 1;
        }
        start = list[lo];
        // The email ends in view with empty room under it: start earlier, a word at a time, so the lines that lead up to the question fill the card
        if (lo > 0 && hasRoom(el, text, at, start)) {
          const words = wordStarts(text, list[lo - 1], start);
          let a = 0;
          let z = words.length;
          while (a < z) {
            const m = (a + z) >> 1;
            if (test2(words[m])) z = m;
            else a = m + 1;
          }
          if (a < words.length && start - words[a] >= MIN_ADDED) start = words[a];
        }
      }
      setFrom(start);
      setBelow(el.scrollHeight > (el.parentElement as HTMLElement).clientHeight + 2);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el.parentElement as HTMLElement);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, quote]);

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
  return (
    <div className="cardbody">
      <div className="cardbody__box t-body" ref={box}>{body}</div>
      {below && <div className="cardbody__fade" aria-hidden="true" />}
      {over && <span className="cardbody__more t-callout" data-opens>Read all</span>}
    </div>
  );
}
