/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_DEMO?: string;
  readonly VITE_BASE_PATH?: string;
  /** Live Gmail: the Google OAuth client id. Public. Without it, live mode does not exist. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** The web.app build: live mode is always on. Pages builds leave it unset. */
  readonly VITE_LIVE_DEFAULT?: string;
  /** Tests only: a mock of Google's sign-in address. The deploy never sets it. */
  readonly VITE_GOOGLE_AUTH_URL?: string;
  /** Tests only: a mock of the Gmail address. The deploy never sets it. */
  readonly VITE_GMAIL_API_BASE?: string;
}
