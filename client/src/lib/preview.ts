// Pure: no imports, so a check can run it under node.
/** The most characters a list row keeps of an email. The row shows two lines, so the rest would only cost layout time. */
export const PREVIEW_MAX = 200;

/** The first `max` characters, never splitting a surrogate pair (an emoji stays whole or goes). */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  const code = text.charCodeAt(max - 1);
  return text.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max);
}

/** One line of at most PREVIEW_MAX characters. The input is cut first, so a 30,000 character body is not scanned. */
export function oneLine(text: string): string {
  return cutText(cutText(text, PREVIEW_MAX * 6).replace(/\s+/g, ' ').trim(), PREVIEW_MAX);
}
