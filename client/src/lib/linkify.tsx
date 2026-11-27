import { Fragment, type ReactNode } from 'react';

const ADDRESS = /https?:\/\/[^\s<>"]+/gi;
const TRAIL_MARKS = '.,)!?;:';

/** Plain text cut into text pieces and links. Only http:// and https:// addresses become links; a closing mark after one stays text. */
export function linkify(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(ADDRESS)) {
    const start = m.index ?? 0;
    // Trim the end with a loop: a pattern anchored at the end is slow on a very long run of marks
    let href = m[0];
    while (href.length > 0 && TRAIL_MARKS.includes(href[href.length - 1])) href = href.slice(0, -1);
    if (!/^https?:\/\/[^\s/]/i.test(href)) continue;
    if (start > at) out.push(<Fragment key={`${keyBase}-t${n}`}>{text.slice(at, start)}</Fragment>);
    out.push(
      <a key={`${keyBase}-a${n}`} className="bub__link" href={href} target="_blank" rel="noopener noreferrer">
        {href}
      </a>
    );
    at = start + href.length;
    n++;
  }
  if (at < text.length || out.length === 0) out.push(<Fragment key={`${keyBase}-e`}>{text.slice(at)}</Fragment>);
  return out;
}
