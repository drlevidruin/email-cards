/** Curly and straight quotes and apostrophes read the same, and a non-breaking space is a space. One character for one character, so positions stay valid in the original. */
function plain(s: string): string {
  return s.replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"').replace(/ /g, ' ');
}

/** Where the Goal's source sentence sits in the body: exact first, then ignoring case and runs of whitespace. */
export function findQuote(body: string, quote: string | null | undefined): [number, number] | null {
  if (!quote) return null;
  const text = plain(body);
  const q = plain(quote);
  const at = text.indexOf(q);
  if (at >= 0) return [at, at + q.length];
  const words = q.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0 || !words[0]) return null;
  const m = new RegExp(words.join('\\s+'), 'i').exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}
