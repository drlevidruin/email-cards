/** The pure parts of the saved pictures: reading a data URL, and leaving pictures out of what is saved on a device. */

const DATA_URL = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export interface ParsedImage {
  type: string;
  base64: string;
}

/** The type and base64 text of a jpeg, png, gif or webp data URL. Anything else (svg, other schemes, text that is not base64) gives null. */
export function parseImageDataUrl(url: unknown): ParsedImage | null {
  if (typeof url !== 'string') return null;
  const m = DATA_URL.exec(url);
  if (!m) return null;
  return { type: m[1], base64: m[2] };
}

/** The dataset without the fields that hold picture data, so a copy that is saved never carries them. */
export function withoutPictures<T extends { pictures?: unknown; logos?: unknown }>(data: T): Omit<T, 'pictures' | 'logos'> {
  const { pictures: _pictures, logos: _logos, ...rest } = data;
  void _pictures;
  void _logos;
  return rest;
}

/** The box a single picture takes in a bubble: its own shape between 3:4 (tall) and 2:1 (wide), or null when its size is not known. */
export function pictureRatio(width?: number, height?: number): number | null {
  if (!width || !height || width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  return Math.min(2, Math.max(0.75, width / height));
}

/** A file's size in words. An unknown size (0) gives an empty text, so the row shows only the kind. */
export function sizeWords(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The line under a file's name: the kind, then the size when it is known. */
export function kindLine(kind: string, bytes: number): string {
  const size = sizeWords(bytes);
  return size ? `${kind}, ${size}` : kind;
}

/** Whether an attachment is a file someone attached. An inline picture from the body is not. */
export function isAttachedFile(a: { inline?: boolean; mimeType: string }): boolean {
  return !(a.inline && a.mimeType.startsWith('image/'));
}

/** What the chat list shows for an email with no words: Photo, 2 photos, or the first attached file's name. */
export function attachmentLine(list: { inline?: boolean; mimeType: string; filename: string }[]): string {
  if (list.length === 0) return '';
  const files = list.filter(isAttachedFile);
  const pics = list.filter((a) => a.mimeType.startsWith('image/'));
  if (files.every((a) => a.mimeType.startsWith('image/'))) return pics.length === 1 ? 'Photo' : `${pics.length} photos`;
  return files.find((a) => !a.mimeType.startsWith('image/'))?.filename ?? files[0].filename;
}
