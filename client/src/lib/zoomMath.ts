// Pure maths for the picture viewer. Positions are measured from the centre of the stage,
// and the picture is drawn with translate(x, y) scale(s) about its own centre.

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;
export const DISMISS_DISTANCE = 120;
/** A pinch let go below this scale snaps back to 1x, so a picture that looks fitted is fitted. */
export const PINCH_SNAP = 1.1;
/** A move older than this at touchend does not count as a flick (ms). */
export const FLICK_WINDOW_MS = 100;

export type View = { s: number; x: number; y: number };
export type Point = { x: number; y: number };
/** The picture's size at 1x and the size of the stage it sits centred in. */
export type Box = { iw: number; ih: number; sw: number; sh: number };

export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number.isFinite(s) ? s : MIN_SCALE));

/** How far the picture may move from the centre on one axis so its edges never pull in past the stage's edges. */
export function maxPan(picture: number, stage: number, s: number): number {
  return Math.max(0, (picture * s - stage) / 2);
}

export function clampView(v: View, b: Box): View {
  const s = clampScale(v.s);
  if (s <= MIN_SCALE) return { s: MIN_SCALE, x: 0, y: 0 };
  const mx = maxPan(b.iw, b.sw, s);
  const my = maxPan(b.ih, b.sh, s);
  return { s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}

/** Change the scale so the spot under `at` stays under it. */
export function zoomAround(v: View, at: Point, nextScale: number, b: Box): View {
  const s2 = clampScale(nextScale);
  const k = s2 / v.s;
  return clampView({ s: s2, x: at.x - k * (at.x - v.x), y: at.y - k * (at.y - v.y) }, b);
}

/** A pinch: the picture as it was when the two fingers went down, the fingers' middle then and now, and how far apart they are now against then. */
export function pinchView(start: View, from: Point, to: Point, ratio: number, b: Box): View {
  const s2 = clampScale(start.s * ratio);
  const k = s2 / start.s;
  return clampView({ s: s2, x: to.x - k * (from.x - start.x), y: to.y - k * (from.y - start.y) }, b);
}

/** A double tap: zoom in to 2.5x at the point, or back out when already zoomed. */
export function doubleTapView(v: View, at: Point, b: Box): View {
  return v.s > 1.05 ? { s: 1, x: 0, y: 0 } : zoomAround(v, at, DOUBLE_TAP_SCALE, b);
}

/** The view when a pinch ends or is cancelled: back to 1x when it is below 1.1x, else as it is. */
export function pinchEndView(v: View): View {
  return v.s < PINCH_SNAP ? { s: 1, x: 0, y: 0 } : v;
}

/** The speed of a drag's last move (px per ms) as it counts at touchend: 0 when the last move is older than 100ms. */
export function flickSpeed(vy: number, lastMoveAt: number, endAt: number): number {
  return endAt - lastMoveAt > FLICK_WINDOW_MS ? 0 : vy;
}

/** Let go of a downward drag: close past 120px, or on a quick flick (pixels per millisecond). */
export function shouldDismiss(dy: number, velocity: number): boolean {
  return dy > DISMISS_DISTANCE || (dy > 30 && velocity > 0.6);
}

/** How opaque the dark background stays after the picture has been dragged down `dy`. */
export function backdropOpacity(dy: number): number {
  return Math.min(1, Math.max(0.15, 1 - Math.max(0, dy) / 320));
}

const EXT_FOR_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

/** The file extension that matches a picture's real type, or null when unknown. */
export const extForType = (mime: string): string | null => EXT_FOR_TYPE[mime.toLowerCase().split(';')[0].trim()] ?? null;

/** The name a shared picture gets: its own name, with the extension swapped for the one that matches the type. */
export function shareFileName(filename: string, mime: string): string {
  const ext = extForType(mime);
  const clean = filename.replace(/[\\/\u0000-\u001f]/g, '').trim() || 'picture';
  const m = /^(.*?)\.([A-Za-z0-9]{1,5})$/.exec(clean);
  const base = m && m[1] ? m[1] : clean;
  const have = m ? m[2].toLowerCase() : '';
  if (!ext) return clean;
  if (have === ext || (ext === 'jpg' && have === 'jpeg')) return clean;
  return `${base}.${ext}`;
}
