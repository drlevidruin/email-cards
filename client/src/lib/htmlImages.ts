// Pure: no imports. Reads picture addresses out of an email's html, one tag at a time, never loading anything.

export interface MailImage {
  src: string;
  alt: string;
}

export const MAX_IMAGES = 4;
const MAX_SRC = 2048;
const MIN_SIDE = 80;
// A tracking pixel, spacer, icon, logo or social button, by its address or its alt text. Words match whole: digits, _ and - are
// separators, letters are not ("company-logo.png" and "icon2x.png" go; "blogo-shoes.jpg", "iconic-bag.jpg" and "soundtrack" stay)
const WORD = '(?:track|tracking|tracker|beacon|spacer|spacerx|icon|logo|badge|social|facebook|twitter|instagram|linkedin|youtube|pinterest|tiktok|emoji)s?';
const NOT_A_PICTURE = new RegExp(`(?<![a-z])${WORD}(?![a-z])|(?<![a-z])blank\\.|(?<![0-9])1x1(?![0-9])|(?<![a-z])open\\.(?:gif|png)`, 'i');
// "pixel" is checked in the address only: an alt of "Pixel 9" is a phone
const PIXEL = /(?<![a-z])pixels?(?![a-z])/i;
const HIDDEN = /(?:^|[;\s])(?:display\s*:\s*none|visibility\s*:\s*hidden)/i;

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
    if (NOT_A_PICTURE.test(src) || NOT_A_PICTURE.test(alt) || PIXEL.test(src)) continue;
    const style = attr(attrs, 'style') ?? '';
    if (HIDDEN.test(style)) continue;
    const side = (n: string) => {
      const v = attr(attrs, n);
      return v !== undefined && /^\s*\d{1,5}(?:px)?\s*$/i.test(v) ? parseInt(v, 10) : undefined;
    };
    const w = side('width');
    const h = side('height');
    if ((w !== undefined && w < MIN_SIDE) || (h !== undefined && h < MIN_SIDE)) continue;
    const small = (n: string) => {
      const m = new RegExp(`(?:^|[;\\s])${n}\\s*:\\s*(\\d{1,5})px`, 'i').exec(style);
      return !!m && parseInt(m[1], 10) < MIN_SIDE;
    };
    if (small('width') || small('height')) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({ src, alt });
  }
  return out;
}
