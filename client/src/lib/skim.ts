/**
 * Reading for a busy head. An email opens with a hello and closes with a sign-off, and neither says anything.
 * The card leaves both out, the reader fades them back, and the facts a reader hunts for (dates, times, amounts)
 * are found so the reader can set them bold.
 */

const HELLO = /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b[^.?\n]{0,40}$/i;
const NAME_COMMA = /^[A-Z][\p{L}'.-]*(?: [A-Z][\p{L}'.-]*)?,$/u;
const BYE = /^(?:best|best regards|best wishes|regards|kind regards|warm regards|warmly|thanks|thanks so much|thanks again|thank you|many thanks|cheers|sincerely|talk soon|all the best|yours|love|take care)[,.!]?$/i;
const NAME_ONLY = /^[A-Z][\p{L}'.-]*(?: [A-Z][\p{L}'.-]*)?$/u;
/** A line under a closing word that belongs to the signature: short, not a sentence, not a P.S. */
const SIGNED = /^(?!p\.?\s?s\b)(?:\S+\s+){0,5}\S*[^.?!\s]$/i;
/** A line that ends a sentence. */
const ENDS = /[.?!]["')\]]*$/;

export interface Parts {
  hello: string;
  body: string;
  bye: string;
}

/** An email as its hello line, its content and its sign-off. The three joined are the text exactly. */
export function parts(text: string): Parts {
  let a = 0;
  const lead = text.length - text.trimStart().length;
  const nl = text.indexOf('\n', lead);
  if (nl > 0) {
    const first = text.slice(lead, nl).trim();
    const words = first.split(/\s+/).length;
    // A hello is short and ends like one: "Hi Alex," and not "Hey, are you free"
    if (words <= 4 && (/[,!:]$/.test(first) || words <= 3) && (HELLO.test(first) || NAME_COMMA.test(first))) {
      a = nl;
      while (a < text.length && /\s/.test(text[a])) a++;
    }
  }
  let z = text.length;
  // Where each line starts, from the content on
  const at: number[] = [];
  for (let i = a; i < text.length; ) {
    at.push(i);
    const n = text.indexOf('\n', i);
    if (n < 0) break;
    i = n + 1;
  }
  const line = (k: number): string => text.slice(at[k], k + 1 < at.length ? at[k + 1] - 1 : text.length).trim();
  const full = at.map((_, k) => k).filter((k) => line(k) !== '');
  if (full.length >= 2) {
    // A closing word among the last four lines goes, with the signature lines under it. If anything under it reads
    // like a sentence or a P.S., that is content, and this closing word is not where the email ends.
    for (let j = Math.max(1, full.length - 4); j < full.length && z === text.length; j++) {
      if (BYE.test(line(full[j])) && full.slice(j + 1).every((k) => SIGNED.test(line(k)))) z = at[full[j]];
    }
    // Or a last line that is only a name, alone under a blank line, after a finished sentence
    const last = full[full.length - 1];
    const prev = full[full.length - 2];
    if (z === text.length && last - prev > 1 && NAME_ONLY.test(line(last)) && ENDS.test(line(prev))) z = at[last];
  }
  // Nothing but a hello and a goodbye: the email stays whole
  if (text.slice(a, z).trim() === '') return { hello: '', body: text, bye: '' };
  return { hello: text.slice(0, a), body: text.slice(a, z), bye: text.slice(z) };
}

/** The email without its hello and sign-off, for the card. */
export function skim(text: string): string {
  const body = parts(text).body.trim().replace(/\n{3,}/g, '\n\n');
  return body || text;
}

/** Dates, times and amounts. */
const FACT =
  /\$\s?\d[\d,]*(?:\.\d+)?[kKmM]?\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? \d{1,2}(?:st|nd|rd|th)?\b|\b(?:today|tomorrow|tonight)\b|\b\d+(?:\.\d+)?%/gi;

/** Where the facts are in a text, as [start, end) pairs in order. */
export function facts(text: string): [number, number][] {
  const out: [number, number][] = [];
  FACT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FACT.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out;
}
