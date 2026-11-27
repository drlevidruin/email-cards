import { Fragment, type ReactNode } from 'react';
import { parseLink, shortLink, trimAddress } from './cleanText';

const ADDRESS = /https?:\/\/[^\s<>"]+/gi;

/** Plain text cut into text pieces and links. Only http:// and https:// addresses the browser can read become links; each shows its short label (the real host and the first part of the path) and opens the full address. A closing mark after one stays text. */
export function linkify(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  let n = 0;
  for (const m of text.matchAll(ADDRESS)) {
    const start = m.index ?? 0;
    const href = trimAddress(m[0]);
    const url = href ? parseLink(href) : null;
    if (!href || !url) continue;
    if (start > at) out.push(<Fragment key={`${keyBase}-t${n}`}>{text.slice(at, start)}</Fragment>);
    out.push(
      <a key={`${keyBase}-a${n}`} className="bub__link" href={url.href} target="_blank" rel="noopener noreferrer">
        {shortLink(href)}
      </a>
    );
    at = start + href.length;
    n++;
  }
  if (at < text.length || out.length === 0) out.push(<Fragment key={`${keyBase}-e`}>{text.slice(at)}</Fragment>);
  return out;
}
