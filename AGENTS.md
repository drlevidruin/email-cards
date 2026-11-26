# Email Cards: notes for any agent working here

## Handoff, 2026-11-25 (Claude to Antigravity)

Antigravity built the first version of this app. On 2026-11-25 Levi asked Claude to take it further because the first version read as "vibe coded and confusing". Claude rebuilt the client as a demo of the new design (Levi: "Don't actually build it yet but make the demo", phone first). This note is how you find out; read it before changing anything.

What changed:

- The whole client UI was replaced. The old `client/src/components/**` (deck, pulse, stream, vault, constellation, shell, modals) and Tailwind are gone. The new client is plain CSS with one token file, a hash router and one store.
- The cards screen shows one card and four moves. Every card states its Goal (the one thing the email needs) and offers built-in replies: finished, written replies that open ready to send.
- Mail is split into finite stacks with a finish line: Needs you, New senders, Newsletters, Receipts, Bookmarked, Later.
- New screens: Goals (Bookmarked, You owe, Waiting on), All mail, Drafts, Ask Claude, New email, Settings. Each has its own hash route, so back and reload work.
- The phone is the first screen that matters. Desktop is a real layout too (two-pane card, keyboard moves), not the phone layout stretched.
- The demo's built-in replies are real written replies now, not a hint pasted into a template.
- The link has a share card (Open Graph image), a web manifest and icons.

Not done yet, on purpose (Levi asked for the demo first):

- The screens for connecting Gmail and for the Claude key are not rebuilt. The server routes for them still exist.
- The server's Claude client still names three retired models (`claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-3-5-haiku-20241022`), so no Claude feature can run against the real API until it moves to current models (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`) and drops `temperature`, which they reject.

What did not change: everything under `server/` except the demo mail's reply text; `client/src/lib/api.ts` and the static demo API keep their shape. The launcher was renamed from `start-prism.command` to `start-email-cards.command`.

Where things are in the client: `client/src/screens/` holds one file per route, `client/src/components/` the card, deck, action bar, sheets and composer, `client/src/lib/` the stack rules (`stacks.ts`), due labels (`time.ts`), goals and the demo API, and `client/src/store.tsx` with `storeActions.ts` the one store. Routes are listed in `client/src/App.tsx`.

Checked before this shipped: every screen at 390 and 1440 wide in a desktop browser, and two code reviews. Not checked: a real iPhone (touch, the on-screen keyboard, home-screen mode) and a screen reader.

## What this app is

Email, one card at a time. Levi's words: "one card at a time nothing else on screen will be so helpful for adhd brains". The card is the product. Everything else stays behind the menu until asked for.

## Design rules (Levi's, not suggestions)

1. Light only. No dark mode, no dark surfaces, no cream or beige background. The canvas is the cool grey in `client/src/styles/tokens.css`.
2. One accent color. It marks the single primary action on a screen (Reply, Send) and the Goal. Nothing else is colored. Red is only for destructive actions and overdue dates.
3. One font family (the system font), three weights, the sizes in the token file. No uppercase eyebrow labels, no gradient text, no sparkle icons, no emoji, no badges or chips as decoration.
4. Each action appears once on a screen. If a move is on the action bar, it is not also a button on the card and a row in a menu.
5. No helper text: no subtitles explaining a screen, no hints, no onboarding tips, no empty-state paragraphs. A label says what the thing is and stops.
6. No em dashes anywhere, in the UI, the demo mail, the prompts or the docs.
7. Phone and desktop are both first-class. Check every change at 390 wide and at 1440 wide before calling it done. Touch targets are at least 44px.
8. Every screen and every open item has a hash route. Back goes back; reload stays put.
9. Anything that changes mail can be undone from the toast, or asks first when it cannot.
10. Nothing is sent without Levi pressing Send. Claude drafts; it does not send. Outgoing mail is held over Shabbos and Yom Tov.

## Code rules

- New colors, sizes, radii and shadows go in `tokens.css` first, and only if an existing token does not fit.
- Reuse the existing components (`PageShell`, `Sheet`, `Toast`, the list styles, `ThreadView`) before making a new one. Keep files under about 300 lines.
- No CSS framework, no UI kit, no new icon set (lucide-react only).
- Before pushing: `npm run typecheck` and `npm run build:pages`. A push to `main` deploys the demo to https://drlevidruin.github.io/email-cards/.

## Leaving a note back

If you change something the other agent should know about, add a dated entry under a `## Handoff` heading at the top of this file, newest first, and keep it to what changed and why.
