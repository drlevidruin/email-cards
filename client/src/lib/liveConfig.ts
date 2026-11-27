/// <reference types="vite/client" />
/** Build-time settings for live Gmail. The client id is public. The two address overrides are for tests against a mock; the deploy never sets them. */
export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
export const AUTH_URL: string = import.meta.env.VITE_GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
export const GMAIL_API: string = import.meta.env.VITE_GMAIL_API_BASE || 'https://gmail.googleapis.com/gmail/v1';
/** The only permission the app ever asks for: read mail. It cannot send, change or delete anything. */
export const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const REDIRECT_URI: string = window.location.origin + import.meta.env.BASE_URL;
