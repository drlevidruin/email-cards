import type { EmailAttachment } from './types';
import { safePreview } from './safePreview';
import { snapshotData } from './snapshot';
import { parseImageDataUrl } from './pictureData';

// One blob address per picture, made the first time it is shown. Kept in memory only, never in storage.
const made = new Map<string, string | null>();
// The Blob behind each picture, kept so a share can start inside the tap with nothing to wait for
const blobs = new Map<string, Blob>();

function blobFrom(cacheKey: string, dataUrl: string | undefined): string | undefined {
  const hit = made.get(cacheKey);
  if (hit !== undefined) return hit ?? undefined;
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    made.set(cacheKey, null);
    return undefined;
  }
  try {
    const raw = atob(parsed.base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const blob = new Blob([bytes], { type: parsed.type });
    blobs.set(cacheKey, blob);
    const url = URL.createObjectURL(blob);
    made.set(cacheKey, url);
    return url;
  } catch {
    made.set(cacheKey, null);
    return undefined;
  }
}

/** The address a picture tag can show for an attachment: its safe preview, else the saved picture from the snapshot. */
export function pictureSrc(a: EmailAttachment): string | undefined {
  const safe = safePreview(a.previewUrl);
  if (safe) return safe;
  const dataUrl = snapshotData()?.pictures?.[a.id];
  return dataUrl ? blobFrom(`p:${a.id}`, dataUrl) : undefined;
}

/** A company's logo for its chat avatar, by lowercase address. */
export function logoSrc(email?: string): string | undefined {
  if (!email) return undefined;
  const key = email.toLowerCase();
  const dataUrl = snapshotData()?.logos?.[key];
  return dataUrl ? blobFrom(`l:${key}`, dataUrl) : undefined;
}

/** The picture's Blob when it is ready now, else undefined. A snapshot picture is ready as soon as it has been shown. */
export function pictureBlob(a: EmailAttachment): Blob | undefined {
  const dataUrl = snapshotData()?.pictures?.[a.id];
  if (dataUrl) {
    blobFrom(`p:${a.id}`, dataUrl);
    return blobs.get(`p:${a.id}`);
  }
  return blobs.get(`v:${a.id}`);
}

/** Fetches a picture that has only a preview address (the sample's, or one picked this visit) and keeps its Blob for pictureBlob. Call it when the picture shows, never inside a tap. */
export async function loadPictureBlob(a: EmailAttachment): Promise<Blob | undefined> {
  const ready = pictureBlob(a);
  if (ready) return ready;
  const src = safePreview(a.previewUrl);
  if (!src) return undefined;
  try {
    const blob = await (await fetch(src)).blob();
    blobs.set(`v:${a.id}`, blob);
    return blob;
  } catch {
    return undefined;
  }
}
