/**
 * The address of a picture, only when it is safe to load: a local blob, an inline image, or this page's own server.
 * A picture loaded from another server tells that server the email was opened.
 */
export function safePreview(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:') || url.startsWith('data:image/') || url.startsWith(`${location.origin}/`)) return url;
  return undefined;
}
