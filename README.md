# Email Cards

Email Cards is a calm, bright, zero-distraction Tinder-style Gmail client for macOS and mobile web. It turns multi-account inbox triage into one clear card at a time, backed by a local SQLite database, real multi-account Gmail sync, a Claude AI inbox assistant, and a built-in Shabbos and Yom Tov Outbound Guard.

## Live Phone & Browser Demo

Try the interactive demo directly on your phone or desktop (runs completely in-browser with local storage persistence):

- Live Demo: [https://drlevidruin.github.io/email-cards/](https://drlevidruin.github.io/email-cards/)

## 4-Way Card Gestures

Focus Mode hides clutter so you can clear email one card at a time:

- **Swipe Left (`ArrowLeft`)**: Archive (or Mute on First-Time Senders)
- **Swipe Right (`ArrowRight`)**: Reply (opens the full thread & 1-click Claude reply drawer; Approves First-Time Senders)
- **Swipe Up (`ArrowUp`)**: Bookmark / Star for quick revisiting
- **Swipe Down (`ArrowDown`)**: Snooze for later (or route First-Time Senders to Newsletters)
- **Undo (`Z`)**: Immediately puts the previous card back on top of the deck

Tap **Menu** in the top-left corner anytime to switch accounts, jump to **Browse** or **Drafts**, open **Search** (`Cmd+K`), chat with **Ask Claude** (`Cmd+J`), connect live Gmail accounts, or configure Settings.

## Running Locally on macOS (Live Gmail + Claude AI)

### 1. Install Dependencies

```bash
npm run install:all
```

### 2. Launch Locally

Double-click `start-prism.command` in Finder, or run:

```bash
npm run dev
```

- Web UI: `http://localhost:5173`
- Local API server: `http://localhost:3456`
- Local SQLite database: `~/.prism-mail/prism.db`

### 3. Connect Real Gmail Accounts

Open **Menu -> + Gmail** to connect unlimited Gmail accounts:

- **Quick Connect (App Password, 30 seconds)**: Enable 2-Step Verification on your Google Account, generate a 16-character App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), and connect over TLS (`imap.gmail.com:993` and `smtp.gmail.com:465`).
- **Google OAuth2 (Full Gmail REST API)**: Enable the Gmail API in Google Cloud Console, add Redirect URI `http://localhost:3456/api/auth/google/callback`, paste your Client ID and Client Secret once in **Connect Gmail -> Google OAuth2**, and sign in with Google.

### 4. Enable Claude AI & Shabbos Outbound Guard

Open **Menu -> Settings**:

- **Claude AI**: Paste your Anthropic API key (`sk-ant-...`) and choose Claude Sonnet 4, Opus 4, or Haiku 3.5. Bulk actions always require a dry-run preview with instant undo, and AI drafts always land in **Drafts** rather than auto-sending.
- **Shabbos & Yom Tov Outbound Guard**: Automatically holds any email sent or scheduled during Friday candle-lighting through Saturday Havdalah (and major Yom Tov dates) in your timezone, releasing it after Havdalah unless explicitly overridden.

## Building for GitHub Pages

```bash
npm run build:pages
```

Outputs a static, self-contained bundle to `client/dist` configured for `/email-cards/`.
