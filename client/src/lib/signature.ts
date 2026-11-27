/** A line of a signature block: short, and not a sentence. */
const SHORT = /^(?:\S+\s+){0,7}\S*[^.?!\s]$/;

/**
 * The text without a signature block at its end. The block is the last paragraph when its first line is the
 * sender's own name (alone, or followed by a comma and a title) and every line under it is short and not a
 * sentence. Only a block of one to five lines goes, and only when something is left above it.
 */
export function dropSignature(text: string, name: string): string {
  const who = name.trim().toLowerCase();
  if (!who) return text;
  const cut = text.lastIndexOf('\n\n');
  if (cut < 0) return text;
  const above = text.slice(0, cut).trimEnd();
  const block = text.slice(cut).trim().split('\n').map((l) => l.trim());
  if (!above || block.length > 5 || block.some((l) => l === '')) return text;
  const first = block[0].toLowerCase();
  const first1 = who.split(/\s+/)[0];
  const isName = first === who || first === first1 || (first.startsWith(who) && /^[,\s]/.test(first.slice(who.length)));
  if (block.some((l) => /^p\.?\s?s\b/i.test(l))) return text;
  if (!isName || !block.slice(1).every((l) => SHORT.test(l))) return text;
  return above;
}
