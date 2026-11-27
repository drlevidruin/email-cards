// Pure: no imports. Every pattern is bounded or stops at a fixed character, so broken input is read in one pass.

// "[Sale up to $50 off] (https://...)" keeps only the words
const BRACKET_LINK = /\[([^[\]\n]{1,300})\]\s{0,3}\((?:https?:\/\/|mailto:)[^\s()]{0,2048}\)/gi;
// "words (https://...)" and "words <https://...>" keep only the words
const PAREN_LINK = /\s{0,3}\((?:https?:\/\/|mailto:)[^\s()]{0,2048}\)/gi;
const ANGLE_LINK = /\s{0,3}<(?:https?:\/\/|mailto:)[^\s<>]{0,2048}>/gi;
// "[image: Google]" and "[cid:abc@x]"
const MARKER = /\[(?:image|cid):[^[\]\n]{0,300}\]/gi;
const RULE_CHAR = /^[=\-_*~#]$/;
const BROWSER_LINE = /^[\s\W]{0,6}(?:view\s(?:this\s)?(?:email|message|newsletter)?\s?(?:in|on)\s(?:your\s|a\s)?(?:web\s)?browser|having\strouble\s(?:viewing|reading|seeing)\sthis\s(?:email|message)|trouble\s(?:viewing|reading)\sthis\s(?:email|message)|can'?t\s(?:see|read|view)\sthis\s(?:email|message)|view\sonline|open\sin\sbrowser)/i;

/** A line made only of five or more of one of = - _ * ~ #, with spaces around. */
function isRule(line: string): boolean {
  const t = line.trim();
  if (t.length < 5 || !RULE_CHAR.test(t[0])) return false;
  for (let i = 1; i < t.length; i += 1) if (t[i] !== t[0]) return false;
  return true;
}

/** The text of an email as people want to read it: markers, bare links in brackets, rules and "view in browser" lines gone, at most one blank line in a row. */
export function cleanEmailText(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let firstSeen = false;
  for (const raw of lines) {
    if (isRule(raw)) continue;
    let l = raw.replace(MARKER, '').replace(BRACKET_LINK, '$1').replace(PAREN_LINK, '').replace(ANGLE_LINK, '');
    const t = l.trim();
    if (t !== '' && !firstSeen) {
      firstSeen = true;
      if (t.length < 120 && BROWSER_LINE.test(t)) continue;
    }
    l = l.replace(/[ \t]+$/, '');
    if (l === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(l);
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** An address as a link shows it: the host without www and the first part of the path, no query ("auraframes.com/shop-frames"). */
export function shortLink(href: string): string {
  const m = /^https?:\/\/([^\s/?#]+)([^\s?#]*)/i.exec(href);
  if (!m) return href;
  const host = m[1].replace(/^www\./i, '');
  const path = m[2].replace(/\/+$/, '');
  const short = path.length > 24 ? path.slice(0, 24).replace(/\/[^/]*$/, '') || path.slice(0, 24) : path;
  return host + short;
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
