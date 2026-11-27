// Pure: no imports. Reads picture addresses out of an email's html, one tag at a time, never loading anything.

export interface MailImage {
  src: string;
  alt: string;
}

export const MAX_IMAGES = 4;
const MAX_SRC = 2048;
const MIN_SIDE = 80;
// A tracking pixel, spacer, icon, logo or social button, by its address or its alt text
const NOT_A_PICTURE = /pixel|track|beacon|spacer|spacerx|blank\.|1x1|\bopen\.(?:gif|png)|\bicon|logo|badge|social|facebook|twitter|instagram|linkedin|youtube|pinterest|tiktok|emoji/i;

const attr = (attrs: string, name: string): string | undefined => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : undefined;
};

const unescapeAmp = (s: string) => s.replace(/&amp;/gi, '&').replace(/&#0*38;|&#x0*26;/gi, '&');

/** The picture addresses of an email's html, up to 4, in document order: https only, no user or password, at most 2,048 characters, nothing under 80 across or tall, no tracking pixels, spacers, icons, logos or social buttons. */
export function extractImages(html: string): MailImage[] {
  const out: MailImage[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<img\s([^<>]*)>/gi)) {
    if (out.length >= MAX_IMAGES) break;
    const attrs = m[1];
    const raw = attr(attrs, 'src');
    if (!raw || raw.length > MAX_SRC * 2) continue;
    const src = unescapeAmp(raw.trim());
    if (src.length > MAX_SRC || !/^https:\/\//i.test(src)) continue;
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) continue;
    const alt = unescapeAmp((attr(attrs, 'alt') ?? '').trim()).slice(0, 200);
    if (NOT_A_PICTURE.test(src) || NOT_A_PICTURE.test(alt)) continue;
    const side = (n: string) => {
      const v = attr(attrs, n);
      return v !== undefined && /^\s*\d{1,5}(?:px)?\s*$/i.test(v) ? parseInt(v, 10) : undefined;
    };
    const w = side('width');
    const h = side('height');
    if ((w !== undefined && w < MIN_SIDE) || (h !== undefined && h < MIN_SIDE)) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({ src, alt });
  }
  return out;
}
