// Pure: no imports. Every pattern is bounded or stops at a fixed character, so broken input is read in one pass.

// "[Sale up to $50 off] (https://...)", "words (https://...)" and "words <https://...>" keep the words and the address, without the brackets
const BRACKET_LINK = /\[([^[\]\n]{1,300})\]\s{0,3}\(((?:https?:\/\/|mailto:)[^\s()]{0,2048})\)/gi;
const PAREN_LINK = /\s{0,3}\(((?:https?:\/\/|mailto:)[^\s()]{0,2048})\)/gi;
const ANGLE_LINK = /\s{0,3}<((?:https?:\/\/|mailto:)[^\s<>]{0,2048})>/gi;
// "[image: Google]" and "[cid:abc@x]"
const MARKER = /\[(?:image|cid):[^[\]\n]{0,300}\]/gi;
const RULE_CHAR = /^[=\-_*~#]$/;
// A first line that is only a "view in browser" phrase, then at most punctuation or one link
const BROWSER_PHRASE = /^[\s\W]{0,6}(?:view\s(?:this\s)?(?:email|message|newsletter)?\s?(?:in|on)\s(?:your\s|a\s)?(?:web\s)?browser|having\strouble\s(?:viewing|reading|seeing)\sthis\s(?:email|message)|trouble\s(?:viewing|reading)\sthis\s(?:email|message)|can'?t\s(?:see|read|view)\sthis\s(?:email|message)|view\sonline|open\sin\sbrowser)/i;

const isHttp = (s: string) => /^https?:\/\//i.test(s);

/** An address compared loosely: no scheme, no www, no trailing slashes, lower case. */
function looseKey(u: string): string {
  let k = u.toLowerCase().replace(/^(?:https?:\/\/|mailto:)/, '');
  if (k.startsWith('www.')) k = k.slice(4);
  let end = k.length;
  while (end > 0 && k[end - 1] === '/') end -= 1;
  return k.slice(0, end);
}

/** The last word before a position, looking back a bounded way. */
function wordBefore(str: string, at: number): string {
  const head = str.slice(Math.max(0, at - 2100), at).trimEnd();
  const sp = Math.max(head.lastIndexOf(' '), head.lastIndexOf('\t'));
  return sp < 0 ? head : head.slice(sp + 1);
}

/** What stays of "words <address>": the address alone, or nothing when the words before it already are that address. */
function keepAddress(target: string, before: string): string {
  const addr = isHttp(target) ? target : target.replace(/^mailto:/i, '').split('?')[0];
  if (addr === '') return '';
  if (looseKey(before) === looseKey(addr)) return '';
  return before === '' ? addr : ` ${addr}`;
}

/** A line made only of five or more of one of = - _ * ~ #, with spaces around. */
function isRule(line: string): boolean {
  const t = line.trim();
  if (t.length < 5 || !RULE_CHAR.test(t[0])) return false;
  for (let i = 1; i < t.length; i += 1) if (t[i] !== t[0]) return false;
  return true;
}

/** A line that is only a "view in browser" phrase, then nothing or punctuation or one link. */
function isBrowserLine(t: string): boolean {
  const m = BROWSER_PHRASE.exec(t);
  if (!m) return false;
  const rest = t.slice(m[0].length).trim();
  if (rest === '') return true;
  const words = rest.split(/\s+/);
  const link = words.length === 1 && /^[<(\[]?https?:\/\/\S*[>)\]]?$/i.test(words[0]);
  return link || /^[\s\W]*$/.test(rest);
}

/** The text of an email as people want to read it: markers, bare links in brackets, rules and "view in browser" lines gone, at most one blank line in a row. */
export function cleanEmailText(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let firstSeen = false;
  for (const raw of lines) {
    if (isRule(raw)) continue;
    let l = raw
      .replace(MARKER, '')
      .replace(BRACKET_LINK, (_w, words: string, target: string) => (looseKey(words) === looseKey(target) ? '' : `${words} `) + keepAddress(target, ''))
      .replace(PAREN_LINK, (_w, target: string, off: number, str: string) => keepAddress(target, wordBefore(str, off)))
      .replace(ANGLE_LINK, (_w, target: string, off: number, str: string) => keepAddress(target, wordBefore(str, off)));
    const t = l.trim();
    if (t !== '' && !firstSeen) {
      firstSeen = true;
      if (t.length < 2500 && isBrowserLine(t)) continue;
    }
    l = l.trimEnd();
    if (l === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(l);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** An address read as a link, or null: only http and https, with a host. The parser's href is what a link opens. */
export function parseLink(href: string): URL | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return null;
  return u;
}

/** An address as a link shows it: the real host without www (never a user or password) and the first part of the path, no query ("auraframes.com/shop-frames"). */
export function shortLink(href: string): string {
  const u = parseLink(href);
  if (!u) return href;
  const host = u.hostname.replace(/^www\./i, '');
  let end = u.pathname.length;
  while (end > 0 && u.pathname[end - 1] === '/') end -= 1;
  const path = u.pathname.slice(0, end);
  const short = path.length > 24 ? path.slice(0, 24).replace(/\/[^/]*$/, '') || path.slice(0, 24) : path;
  return host + short;
}

const ADDRESS = /https?:\/\/[^\s<>"]+/gi;
const TRAIL_MARKS = '.,)!?;:';

/** The address at the start of `raw` without the closing marks after it, or null when it is not a link. */
export function trimAddress(raw: string): string | null {
  let end = raw.length;
  while (end > 0 && TRAIL_MARKS.includes(raw[end - 1])) end -= 1;
  const href = raw.slice(0, end);
  return parseLink(href) ? href : null;
}

/** Plain text with every address replaced by its short label (for list previews). */
export function shortenLinks(text: string): string {
  let out = '';
  let at = 0;
  for (const m of text.matchAll(ADDRESS)) {
    const start = m.index ?? 0;
    const href = trimAddress(m[0]);
    if (!href) continue;
    out += text.slice(at, start) + shortLink(href);
    at = start + href.length;
  }
  return at === 0 ? text : out + text.slice(at);
}

/** Whether the address at text[start, end) is alone on its line. */
export function aloneOnLine(text: string, start: number, end: number): boolean {
  let a = start;
  while (a > 0 && text[a - 1] !== '\n') {
    if (!/\s/.test(text[a - 1])) return false;
    a -= 1;
  }
  let b = end;
  while (b < text.length && text[b] !== '\n') {
    if (!/\s/.test(text[b])) return false;
    b += 1;
  }
  return true;
}

/** A subject, or an empty string for none ("(no subject)" is none). */
export function realSubject(subject: string | undefined | null): string {
  const t = (subject ?? '').trim();
  return /^\(no subject\)$/i.test(t) ? '' : t;
}
