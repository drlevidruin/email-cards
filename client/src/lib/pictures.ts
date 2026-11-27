import type { EmailAttachment } from './types';
import { safePreview } from './safePreview';
import { snapshotData } from './snapshot';
import { parseImageDataUrl } from './pictureData';
import { useSyncExternalStore } from 'react';
import { GMAIL_API } from './liveConfig';
import { isLiveMode, liveStopped } from './liveMode';
import { goodToken } from './liveAuth';
import { gmailGet } from './gmailApi';
import { base64urlBytes } from './gmailParse';
import { liveAttachmentSource } from './staticDemoApi';

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

// ---- Live Gmail pictures: downloaded one by one, only when their bubble is drawn, kept in memory only
const LIVE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const LIVE_MAX_BYTES = 6 * 1024 * 1024;
const LIVE_AT_ONCE = 3;
const liveState = new Map<string, 'loading' | 'ready' | 'failed'>();
// A picture that could not be fetched for now (no token, signed out, slow down) is not asked for again before this time
const RETRY_MS = 30_000;
const retryAt = new Map<string, number>();
const liveQueue: EmailAttachment[] = [];
let liveActive = 0;
let liveVersion = 0;
const liveListeners = new Set<() => void>();
const liveBump = () => {
  liveVersion += 1;
  liveListeners.forEach((l) => l());
};

/** An attachment of a live Gmail message: its id has the `gmailMessageId~pPartId` form. */
export const isLivePicture = (a: EmailAttachment): boolean => isLiveMode() && a.id.includes('~');

/** Whether a live attachment may be shown as a picture: jpeg, png, gif or webp, up to 6 MB, and not one that failed. */
export function livePictureOk(a: EmailAttachment): boolean {
  return LIVE_TYPES.has(a.mimeType.toLowerCase()) && a.sizeBytes <= LIVE_MAX_BYTES && liveState.get(a.id) !== 'failed';
}

/** Draws again when a live picture arrives or fails. */
export function usePictureVersion(): number {
  return useSyncExternalStore(
    (l) => {
      liveListeners.add(l);
      return () => {
        liveListeners.delete(l);
      };
    },
    () => liveVersion
  );
}

/** Gives the state back to ask again later: true when something on screen changed. */
function later(a: EmailAttachment): boolean {
  liveState.delete(a.id);
  retryAt.set(a.id, Date.now() + RETRY_MS);
  scheduleRedraw();
  return false;
}

// One shared redraw for every picture waiting to be asked again, not one timer per picture
let redrawTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRedraw(): void {
  if (redrawTimer !== null) return;
  redrawTimer = setTimeout(() => {
    redrawTimer = null;
    liveBump();
  }, RETRY_MS + 50);
}

// Back online: drawn pictures that waited for the network ask again
if (typeof window !== 'undefined') window.addEventListener('online', () => liveBump());

/** One download per picture at a time: a second ask for the same key waits for the first. Returns true when the picture's state changed. */
const inFlight = new Map<string, Promise<boolean>>();
function downloadLive(a: EmailAttachment): Promise<boolean> {
  const running = inFlight.get(a.id);
  if (running) return running;
  const p = fetchLive(a).finally(() => inFlight.delete(a.id));
  inFlight.set(a.id, p);
  return p;
}

async function fetchLive(a: EmailAttachment): Promise<boolean> {
  const src = liveAttachmentSource(a.id);
  const token = src ? goodToken(src.email) : null;
  // Nothing to sign in with yet: try again later
  if (!src || !token) return later(a);
  if (navigator.onLine === false) return later(a);
  let threw = false;
  const got = await gmailGet((u, i) => window.fetch(u, i).catch((e: unknown) => {
    threw = true;
    throw e;
  }), GMAIL_API, `users/me/messages/${encodeURIComponent(src.messageId)}/attachments/${encodeURIComponent(src.attachmentId)}`, token);
  // Signed out for now, or Gmail asked to slow down: not a failure of the picture
  // A network error (the fetch itself threw) is not a failure of the picture either
  if (threw || got.status === 'unauthorized' || got.status === 'later') return later(a);
  const data = got.status === 'ok' ? (got.json as { data?: unknown } | null)?.data : undefined;
  const bytes = typeof data === 'string' ? base64urlBytes(data) : null;
  if (!bytes || bytes.length === 0 || bytes.length > LIVE_MAX_BYTES) {
    liveState.set(a.id, 'failed');
    return true;
  }
  const blob = new Blob([bytes as unknown as BlobPart], { type: a.mimeType.toLowerCase() });
  // Disconnect or a removed message may have come while this downloaded
  if (liveStopped()) return false;
  blobs.set(`v:${a.id}`, blob);
  made.set(`p:${a.id}`, URL.createObjectURL(blob));
  liveState.set(a.id, 'ready');
  return true;
}

function pump(): void {
  while (liveActive < LIVE_AT_ONCE && liveQueue.length > 0) {
    const a = liveQueue.shift()!;
    liveActive += 1;
    void downloadLive(a)
      .catch(() => {
        liveState.set(a.id, 'failed');
        return true;
      })
      .then((changed) => {
        liveActive -= 1;
        if (changed) liveBump();
        pump();
      });
  }
}

/** Asks for a live picture's download. Call it when the picture's bubble is drawn. Anything else (not a picture type, too big, already asked, tried a moment ago) does nothing. */
export function requestLivePicture(a: EmailAttachment): void {
  if (!isLivePicture(a) || !livePictureOk(a) || liveState.has(a.id)) return;
  // Offline: nothing is asked and nothing is marked, the online event draws again
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (Date.now() < (retryAt.get(a.id) ?? 0)) return;
  liveState.set(a.id, 'loading');
  liveQueue.push(a);
  pump();
}

function revokeLive(id: string): void {
  const url = made.get(`p:${id}`);
  if (url) URL.revokeObjectURL(url);
  made.delete(`p:${id}`);
  blobs.delete(`v:${id}`);
  liveState.delete(id);
  retryAt.delete(id);
}

/** Frees the pictures of messages that are no longer in the saved store (and forgets their state). */
export function pruneLivePictures(hasMessage: (gmailMessageId: string) => boolean): void {
  const ids = new Set<string>();
  for (const k of made.keys()) if (k.startsWith('p:') && k.includes('~')) ids.add(k.slice(2));
  for (const id of liveState.keys()) ids.add(id);
  let freed = false;
  for (const id of ids) {
    if (hasMessage(id.slice(0, id.indexOf('~')))) continue;
    revokeLive(id);
    freed = true;
  }
  if (freed) liveBump();
}

/** Frees every live picture: Disconnect and Reset. */
export function revokeLivePictures(): void {
  liveQueue.length = 0;
  const ids = new Set<string>();
  for (const k of made.keys()) if (k.startsWith('p:') && k.includes('~')) ids.add(k.slice(2));
  for (const id of liveState.keys()) ids.add(id);
  for (const id of ids) revokeLive(id);
  liveBump();
}

/** The address a picture tag can show for an attachment: its safe preview, else the saved picture from the snapshot. */
export function pictureSrc(a: EmailAttachment): string | undefined {
  if (a.remoteSrc) return isLiveMode() && /^https:\/\//i.test(a.remoteSrc) ? a.remoteSrc : undefined;
  if (isLivePicture(a)) return made.get(`p:${a.id}`) ?? undefined;
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
