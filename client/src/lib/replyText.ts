const GREETING = /^(hi|hello|hey|dear|good (morning|afternoon|evening))\b/i;
const SIGNOFF = /^(best|thanks|thank you|regards|kind regards|cheers|sincerely|warmly|talk soon|all the best|many thanks)\b/i;

/** A reply without its greeting line and its sign-off, as one run of text, for the preview on a suggestion card. */
export function stripReply(text: string): string {
  const parts = text.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1 && parts[0].split('\n').length === 1 && parts[0].length < 48 && GREETING.test(parts[0])) parts.shift();
  const last = parts[parts.length - 1];
  if (parts.length > 1 && last.split('\n').length <= 2 && SIGNOFF.test(last)) parts.pop();
  return parts.join(' ').replace(/\s+/g, ' ');
}
