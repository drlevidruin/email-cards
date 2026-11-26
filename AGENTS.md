# Email Cards: notes for any agent working here

## Handoff, 2026-11-26 (Claude to Antigravity): the design and UX pass

Levi's feedback on the 11-25 demo: it did not feel premium, was not intuitive, leaned on the summary instead of the email, had no clear goal and gave nothing back for clearing mail. What changed and why:

- The card is now the whole email, not a summary. A Goal band on top never scrolls (the Goal, a due date, the bookmark). Under it the real email scrolls on its own, with the sentence that makes the Goal highlighted. Built-in replies sit at the bottom as a two-column grid on a phone and wrapping pills on a desktop. Nothing scrolls sideways.
- The four swipes are gone. Right is Done, left is Later (it opens the time sheet). New senders swipe left to Block and right to Allow. Bookmark and the Newsletters move are buttons. The action bar shows the same moves, once each (Later, Reply, Done; Later, Done; Block, Newsletters, Allow).
- Rewards for clearing mail: a Today card opens Needs you (count, minutes, a ring, the streak, Start), a segmented bar shows one segment per card, the top bar reads `4 of 12`, and an empty stack ends on an All clear card with a ring, a check, stats and a short confetti burst. The streak counts days Needs you reached zero and skips Saturdays.
- `client/src/lib/progress.ts` keeps all of it in localStorage by local day, as a log of today's moves (card, stack, account, reply or not, time). Past days keep only whether they were clear. Progress is per account: the Today card, ring, bar and `N of M` count the account filter you are on. The streak is not: a day counts only when Needs you is empty in every account, so clearing one account never writes an All clear day. Sample mode seeds four earlier days so the demo shows a streak. Settings Reset clears today only. Undo and a failed save take back exactly the moves of the cards they restore. Snapshot mode keeps its own key, which Remove clears.
- The finish card's stats are for that stack and filter only: handled, replies, and active time (gaps between moves, each capped at 3 minutes). The ring fill, check, confetti and streak pop run only when the user's own move empties the stack; coming back to a cleared stack, or a reload on one, shows it finished at rest.
- A one-time nudge slides the first card ever a little right, with the Done stamp at full strength, to show the swipe. It never runs with reduced motion.
- The reply composer keeps a compact Goal band on top and shows the replies in the same two-column grid. Sending, the Shabbos hold and the snapshot toast are untouched.
- Tokens: new radii, shadows and the scrim live in `tokens.css`. The menu, sheets and the other screens use them.
- The toast never sits on a button. On a phone it goes 12px above the reply tray of the card that stays on top, else above the action bar, else low. On a desktop it stays bottom left when its measured box clears the card column and the bar, and otherwise sits above the tray like a phone. It re-measures when the top card changes and on resize.
- A New sender card shows the sender's first email under the neutral band (the sample subject and snippet only if it does not load), with the reason line in the band. It has no reply tray and no bookmark.

Not checked: a real iPhone (touch, haptics do nothing on iPhone, the on-screen keyboard) and a screen reader.

## Handoff, 2026-11-25 (Claude to Antigravity)

Antigravity built the first version of this app. On 2026-11-25 Levi asked Claude to take it further because the first version read as "vibe coded and confusing". Claude rebuilt the client as a demo of the new design (Levi: "Don't actually build it yet but make the demo", phone first). This note is how you find out; read it before changing anything.

What changed:

- The whole client UI was replaced. The old `client/src/components/**` (deck, pulse, stream, vault, constellation, shell, modals) and Tailwind are gone. The new client is plain CSS with one token file, a hash router and one store.
- (Replaced on 11-26: the card is the whole email with two swipes. See the entry above.) The cards screen showed one card and four moves. Every card states its Goal (the one thing the email needs) and offers built-in replies: finished, written replies that open ready to send.
- Mail is split into finite stacks with a finish line: Needs you, New senders, Newsletters, Receipts, Bookmarked, Later.
- New screens: Goals (Bookmarked, You owe, Waiting on), All mail, Drafts, Ask Claude, New email, Settings. Each has its own hash route, so back and reload work.
- The phone is the first screen that matters. Desktop is a real layout too (two-pane card, keyboard moves), not the phone layout stretched.
- The demo's built-in replies are real written replies now, not a hint pasted into a template.
- The link has a share card (Open Graph image), a web manifest and icons.

Not done yet, on purpose (Levi asked for the demo first):

- Real mail gets no highlighted sentence until the server returns `goalQuote`, an exact sentence from the newest message, alongside the Goal. Today only the sample mail has it.
- The screens for connecting Gmail and for the Claude key are not rebuilt. The server routes for them still exist.
- The server's Claude client still names three retired models (`claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-3-5-haiku-20241022`), so no Claude feature can run against the real API until it moves to current models (`claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`) and drops `temperature`, which they reject.

What did not change: everything under `server/` except the demo mail's reply text; `client/src/lib/api.ts` and the static demo API keep their shape. The launcher was renamed from `start-prism.command` to `start-email-cards.command`.

Where things are in the client: `client/src/screens/` holds one file per route, `client/src/components/` the card, deck, action bar, sheets and composer, `client/src/lib/` the stack rules (`stacks.ts`), due labels (`time.ts`), goals and the demo API, and `client/src/store.tsx` with `storeActions.ts` the one store. Routes are listed in `client/src/App.tsx`.

Checked before this shipped: every screen at 390 and 1440 wide in a desktop browser, and two code reviews. Not checked: a real iPhone (touch, the on-screen keyboard, home-screen mode) and a screen reader.

## What this app is

Email, one card at a time, with a goal on each card, the whole email under it, and a small reward for clearing the stack. Levi's words: "one card at a time nothing else on screen will be so helpful for adhd brains". The card is the product. Everything else stays behind the menu until asked for.

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

## Private snapshot mode

The public site shows sample mail. A link ending `#k=<key>` shows one private dataset instead (`client/src/lib/snapshot.ts`).

- The dataset is one file, `snapshot.bin`, encrypted with AES-256-GCM by `tools/encrypt-snapshot.mjs`. The key lives only in the link and in a key file outside this repo.
- `snapshot.bin` is never committed (it is in `.gitignore`). It is published as the file of the GitHub release `snapshot-data`, and the Pages workflow copies it into the build when that release exists.
- To publish or replace one: encrypt, then `gh release upload snapshot-data snapshot.bin --clobber` (or `gh release create snapshot-data snapshot.bin` the first time), then run the Pages workflow.
- To take it down: delete the release and its tag, then run the Pages workflow. The site then answers 404 for the file, and the app clears what it saved on a device the next time it opens there. Settings has `Remove` for doing that by hand.
- In this mode nothing is sent. Send toasts read `Snapshot. Nothing was sent.`
- Never commit a readable dataset or a key, and never paste either into an issue, a log or a chat with an outside service.
