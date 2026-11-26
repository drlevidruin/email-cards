/**
 * The sentences of a reply that commit the user, so they see what they are about to promise.
 *
 * A sentence commits when a first-person subject (I, I'm, I'll, I've, we, we'll, we're, we've, let's, our team)
 * is followed, with no other word between, by what makes a promise:
 *   - a modal: will, can, shall ("I will", "I can", "we'll gladly send"), or
 *   - one of approve, confirm, agree, accept, sign, pay, send, transfer, book, schedule, promise, cover,
 *     wire, upload, release ("I approve"), or "go with" ("Let's go with Build B"), or
 *   - "am/are" and "happy to", "glad to", "ready to", "going to", "taking" or "in" ("I'm happy to meet",
 *     "We are taking the full allocation", "I am in for the lift pass").
 * One adverb may sit before the modal or the verb ("we'll gladly", "I also approve").
 * A form of be followed by an -ing verb is a status, not a promise ("I am still confirming").
 * A negation right after the subject or the modal ("I can't", "I will not", "I no longer") is a refusal.
 * "count me in" and sentences that start with Approved, Confirmed, Agreed or Yes also commit.
 *
 * A sentence that opens with Before, If, Once, When, Until, After, Unless or As soon as loses that clause
 * (up to its first comma) before the test. Questions, quoted lines (">" and everything after a "wrote:" line),
 * greetings and sign-offs are skipped. Sentences are never split after Dr., Mr., Ms., Mrs., St., a.m., p.m.,
 * e.g., i.e., a month abbreviation or a single capital letter.
 *
 * Test cases (input -> commits?) live in a throwaway script outside the repo; a few of them:
 *   "I approve Addendum B with the $4,200 AV lighting cap."   -> yes
 *   "Let's go with Build B, the CSS shader."                  -> yes
 *   "I can't make it Thursday."                               -> no
 *   "Before I approve Option B, I need one change."           -> no
 *   "I need them to confirm the figure."                      -> no
 *   "I am still confirming Q4 reserve liquidity."             -> no
 *   "Our team will deliver the files Monday."                 -> yes
 */

const SUBJECTS = new Set(["i", "we", "let's", "i'm", "we're", "i'll", "we'll", "i've", "we've"]);
const MODALS = new Set(['will', 'can', 'shall']);
const VERBS = new Set(
  ('approve approves approved confirm confirms confirmed agree agrees agreed accept accepts accepted sign signs signed ' +
    'pay pays paid send sends sent transfer transfers transferred book books booked schedule schedules scheduled ' +
    'promise promises promised cover covers covered wire wires wired upload uploads uploaded release releases released').split(' ')
);
const ADVERBS = new Set(['also', 'just', 'now', 'still', 'hereby', 'both']);
const EAGER = new Set(['happy', 'glad', 'ready', 'able', 'going', 'about', 'pleased', 'delighted']);
const OPENERS = new Set(['approved', 'confirmed', 'agreed', 'yes']);
const CLAUSE = /^(before|if|once|when|until|after|unless|as soon as)\b/i;
const NEGATIVE = new Set(['not', 'never', 'cannot', 'no']);
const GREET_WORD = /^(hi|hello|hey|dear|good (morning|afternoon|evening)|best|thanks|thank you|regards|warmly|cheers|sincerely|kind regards|best regards|many thanks)\b/i;
const ABBREV = /(?:^|[\s(])(?:dr|mr|ms|mrs|st|a\.m|p\.m|e\.g|i\.e|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|[a-z])\.$/i;

const isAdverb = (w: string) => ADVERBS.has(w) || (w.length > 3 && w.endsWith('ly'));
const isNegative = (w: string) => NEGATIVE.has(w) || w.endsWith("n't");

function tokens(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9$]+|[^a-z0-9'$]+$/g, ''))
    .filter(Boolean);
}

/** Whether the first-person subject at `i` carries a promise. */
function promiseAt(t: string[], i: number): boolean {
  const w = t[i];
  let j = i + 1;
  let be = false;
  if (w === 'i' && t[j] === 'am') {
    be = true;
    j += 1;
  } else if (w === 'we' && t[j] === 'are') {
    be = true;
    j += 1;
  } else if (w === "i'm" || w === "we're") be = true;
  if (isNegative(t[j] ?? '')) return false;
  let modal = w === "i'll" || w === "we'll";
  const next = t[j] ?? '';
  if (isAdverb(next) && !isNegative(next)) j += 1;
  const verb = t[j] ?? '';
  if (isNegative(verb)) return false;
  if (be) {
    if (verb === 'in') return t[j + 1] !== 'the';
    if (verb === 'taking') return true;
    if (EAGER.has(verb) && t[j + 1] === 'to') return true;
    return false;
  }
  if (!modal && MODALS.has(verb)) {
    modal = true;
    j += 1;
    if (isAdverb(t[j] ?? '') && !isNegative(t[j] ?? '')) j += 1;
    if (isNegative(t[j] ?? '')) return false;
  }
  if (modal) return true;
  if (verb === 'go' && t[j + 1] === 'with') return true;
  return VERBS.has(verb);
}

function commits(sentence: string): boolean {
  let s = sentence.trim();
  if (CLAUSE.test(s)) {
    const comma = s.indexOf(',');
    if (comma < 0) return false;
    s = s.slice(comma + 1).trim();
  }
  const t = tokens(s);
  if (t.length === 0) return false;
  if (OPENERS.has(t[0])) return true;
  if (/\bcount me in\b/i.test(s)) return true;
  for (let i = 0; i < t.length; i += 1) {
    if (SUBJECTS.has(t[i]) && promiseAt(t, i)) return true;
    if (t[i] === 'our' && t[i + 1] === 'team' && t[i + 2] && (MODALS.has(t[i + 2]) || VERBS.has(t[i + 2]))) return true;
  }
  return false;
}

/** The sentences of one line, never split after an abbreviation, a single capital letter or a decimal point. */
function sentences(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /[.!?]["')\]]*\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const head = line.slice(start, m.index + 1);
    if (m[0][0] === '.' && ABBREV.test(head)) continue;
    out.push(line.slice(start, m.index + m[0].length).trim());
    start = m.index + m[0].length;
  }
  if (start < line.length) out.push(line.slice(start).trim());
  return out;
}

/** A line that is only a greeting or a sign-off: four words or fewer ending with a comma, or a short line on its own. */
function isGreeting(line: string): boolean {
  if (!GREET_WORD.test(line)) return false;
  const words = line.split(/\s+/).length;
  if (words <= 4 && /,$/.test(line)) return true;
  return words <= 3 && !/[.!?]$/.test(line);
}

export function commitmentsIn(body: string, max = 3): string[] {
  const found: string[] = [];
  const lines = body.replace(/[‘’]/g, "'").split(/\n+/);
  for (const raw of lines) {
    const line = raw.trim();
    if (/wrote:/i.test(line)) break;
    if (!line || line.startsWith('>') || isGreeting(line)) continue;
    // A lone word the way a short reply starts, such as "Approved", counts; a lone name does not
    if (line.split(/\s+/).length <= 2 && !/[.!?]$/.test(line) && !/^(approved|yes|confirmed|agreed|i approve)$/i.test(line)) continue;
    for (const s of sentences(line)) {
      if (!s || /\?["')\]]*$/.test(s)) continue;
      if (commits(s)) found.push(s);
      if (found.length >= max) return found;
    }
  }
  return found;
}

const BLANK = /\[[^[\]\n]+\]/g;

/** The `[blanks]` a suggestion or an agent draft put in, with their exact text. */
export function blanksOf(text: string): string[] {
  return text.match(BLANK) ?? [];
}

/** How many of those blanks are still in the text, word for word. Brackets the user typed never count. */
export function openBlanks(text: string, blanks: string[]): number {
  let n = 0;
  for (const b of new Set(blanks)) n += text.split(b).length - 1;
  return n;
}

/** The blanks still in the text, each once, in the order they appear. */
export function openBlankList(text: string, blanks: string[]): string[] {
  return [...new Set(blanks)].filter((b) => text.includes(b)).sort((a, b) => text.indexOf(a) - text.indexOf(b));
}

/** A blank's words as a label: `[the change you need]` becomes `The change you need`. */
export function blankLabel(blank: string): string {
  const words = blank.replace(/^\[|\]$/g, '').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A blank's words for running text: `[The change you need]` or `[the change you need]` becomes `the change you need`. */
export function blankWords(blank: string): string {
  const words = blank.replace(/^\[|\]$/g, '').trim();
  return words.charAt(0).toLowerCase() + words.slice(1);
}
