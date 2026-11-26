# Email Cards: notes for any agent working here

## Handoff, 2026-11-26 (Claude, round 9B): every fact checks out, every screen lines up

- Demo clock (`lib/demoClock.ts`, imported first in `main.tsx`): in the static demo the page's `Date` is a subclass pinned to Tuesday Nov 24, 2026, 1:00 PM that keeps ticking. It is off for a real mailbox (hash starting `#k=`). Message times in `staticDemoData.ts` are relative (`hoursAgo`, `workTime`, which avoids Friday from 4 PM and Saturday); deadlines are absolute (`onDay(month, day, hour, min)`). Dec 12 and Jan 16 are Saturdays, so the keynote and dinner are Dec 10 and Stowe is Jan 15 to 18. `tools/sync_server.sh` after any data edit.
- Commitments detector (`lib/commitments.ts`, tests in `SCRATCH/checks/commitments-check.mjs`, 100 plus cases): token based. A sentence commits when a first-person subject (I, we, our team) meets a modal or verb of doing (will, can, am sending, taking, go with, approve). Questions, quoted lines (`>`), everything from a `wrote:` line down, greetings, and conditions without a comma (Before, If, Once, When, Until, After, Unless, As soon as) are skipped. Negations and status verbs (`I am waiting`) are not commitments. A lone `Approved`, `Yes`, `Confirmed` or `I approve` is.
- Blanks: `blanksOf(text)` lists the bracketed blanks a suggestion brings; `openBlanks(text, blanks)` counts the ones still in the draft word for word. Only those block Send and show on the pill (`Fill in 2 blanks`, `2 blanks` under 380px). Text the user typed in brackets never blocks. Send is emerald.
- Desktop deck (1024px and wider, `CardsScreen.css`): every screen on the deck (Today, a card, covers, the finish) uses one frame. Card height is `--deck-h: clamp(440px, 100dvh - 300px, 620px)`, the same for every card. The action bar sits 16px under the card. Card and bar are centered together under the title row, and `--card-top` feeds the side panel so Up next starts level with the card. Long emails use the existing fade.
- First-session teaching: only the first browser session (`isFirstSession`, `claimFirstSession`) nudges, so a reload in the same tab keeps teaching until it is done. A drag cancels a nudge for that card.

## Handoff, 2026-11-26 (Claude, round 9A): replies you can trust, and a look worth paying for

- Palette: warm neutrals in `styles/tokens.css` (canvas #F2F1ED, ink #191714, shadows `rgba(28, 25, 20, a)`). Roles: ink means go (Start, Archive all, Next, primary buttons); emerald #0B7A5A means done and sent (the Done capsule, Send, the finish check, week dots, Goal label). ink-3 is #6F6A61 (5.4:1 on white, 4.75:1 on the canvas).
- Action bar (`ActionBar`): 64px glass bar, icon and label side by side, Done is an emerald capsule. Under 380px it tightens so `Newsletter` never clips. Lit states: `is-active` while dragging toward it, `is-on` when its sheet is open.
- Progress bar (`SegmentBar`): one line, hidden on Today, full on a finish. Avatars are tinted monograms hashed from the email and are gone from lists.
- Commitments: `lib/commitments.ts` finds the sentences in a draft where the user commits (I, we, will, can, approve, send...). `ReplyEdit` shows them under `You're committing to`. Questions are skipped. Drafts hold bracketed blanks like `[day and time]`; `blanksIn` counts them; Send reads `Fill in N blanks` and stays off (Ctrl+Enter too) until none remain. Demo quick actions use only thread facts. The server prompt in `server/src/agent/intelligence.ts` says the same.
- Search: the priorities answer is built from `buildTodo` and `buildStack`, so its counts match Today and To-do. `AgentChatMessage.more` renders `and N more` that opens Needs you.
- Today (`TodayCard`): date, `N need you`, a `First up` agenda (due column, title, sender), `Sorted for you` counts, To-do and Drafts links, ink Start. Streak is gone.
- Finish (`FinishCard`, `FinishPile`): a pile of up to three mini cards with an emerald check, a moves line (`2 Done · 1 To-do`), the last seven days (`StreakStrip`), Next in ink. Moves carry a `kind` in `lib/progress.ts`.
- Later sheet: a `Before it's due` tile when the thread has a deadline, `after it's due` flagged in red, and no tile preselected on touch (`useDialog` focuses the dialog, not the first control, unless opened by keyboard).
- Receipts cover: `Archive all N`, `One at a time`, `Export CSV` (`lib/csv.ts`, file `receipts-YYYY-MM.csv`).
- Teaching: each of the four moves nudges once (`taught` in the progress log, `markTaught`). Skip says `Moved to the end of the pile`.
- `You promised` rows on To-do open the user's sent message with the promise sentence marked (`CommitmentItem.promiseQuote`, `ThreadView promise`). Demo threads wait_04 and wait_05 gained that sent message.
- After editing `staticDemoData.ts`, run `tools/sync_server.sh` so `server/src/demoData.ts` follows.

## Handoff, 2026-11-26 (Claude, round 8D): the polish pass

- First-card nudge: the Done pill is capped at outline (level 0.8, never filled) and the wash at 0.15 while the card slides 44px (`useCardGesture.ts`, `SwipeBadge.tsx`).
- `CardBody.tsx` no longer scrolls to a pixel offset. It picks the earliest start (the paragraph holding the marked sentence, then each sentence start, then the mark) whose marked sentence ends inside the box, found by measuring a hidden copy, and prefixes `… ` in ink-4 when the start is mid-paragraph. An email that fits whole shows whole from its first line. The foot shows the first attachment as a 32px chip (name truncated before its extension, size) and `and N more`.
- Desktop deck: `CardsScreen` adds `cards--live` while a deck card shows. The card is as tall as its email (440 at least, the room at most, via `container-type: size` and `cqh`), the action bar is absolute 16px above the window bottom, so it never moves. `CardBody` reads that room in `roomWithFoot`. Phone layout is unchanged.
- Up next and the side To-do (`SidePanel.tsx`) use two-line rows (Goal up to 2 lines, `Name · due`, red when `isUrgent`) and show as many as fit, up to 6, then `and N more`. The rail marks the chosen account with ink 600 and a check, and keeps the pill for the place only. To-do on desktop has `Tackle N` in the title row (`PageShell` `right`), the phone keeps the bottom button. New email has the placeholder `Write your email`.
- Finish card: one white group (`Still on your To-do` first, then the other stacks) and the primary `Next:` button at the bottom, styled like Today's Start.
- Favicon, the three PNG icons and `share.jpg` are emerald (rendered with QuickLook from the SVG). Theme color and manifest colors are `#EEF0F3`, the canvas token.
- Sample mail: `by noon tomorrow`, the AWS statement period is October, and the user's own six messages are placed inside 9 AM to 6 PM local by `workTime()` in `staticDemoData.ts` (relative to now, between the neighbouring messages). Run `tools/sync_server.sh` after editing the data.

### 8D follow-up: review fixes R1 to R23
- Reader: one exit only (a ref guards double Done); Skip has its own Undo that puts the card back (Z after E, J restores the skipped card).
- Gestures (`useCardGesture`): axis locks to the larger axis past 10px; a mouse move with no button held cancels; taps only open when the pointer barely moved; the deck resets the gesture when the top card changes.
- To-do deck and page skip snoozed threads; receipts and newsletters stacks skip anything on the To-do list; Drafts Undo keeps the draft status; resumed drafts save once and the composer reloads its text.
- Settings: Privacy section shows only in static demo mode.
- Keys: `GlobalKeys` is mounted in App for phone and desktop; `?` opens shortcuts, but not over a sheet; G-prefix waits and ignores other keys; Later sheet ignores Ctrl, Cmd, Alt digits.
- Card body: phone uses the full height only below 1024px; a whole email that fits starts at 0 (a deliberate step beyond "paragraph start is earliest"); attachments-only foot has no left margin.
- Hero: `goalFirst` shows the Goal sentence on To-do cards, including receipts.
- Reader opened from the To-do page uses `?from=goals`, back label "To-do", and the To-do page stays mounted under it; the action bar shows "On To-do" when starred.
- Toast: on desktop with an action bar it sits bottom centre of the content above the bar.
- Finish card: `.finish` grows 20px to hide the glow clip.
- Demo data: `workTime()` keeps reply times inside 9 AM to 6 PM local.

## Handoff, 2026-11-26 (Claude, round 8C): the desktop shell and the rest of the screens

- Breakpoints: `lib/useIsDesktop.ts` has `useIsDesktop` (1024px and up) and `useIsWide` (1280px and up, gates the side panel). Every CSS desktop media query is `min-width: 1024px`.
- `components/DesktopShell.tsx` wraps all routes on desktop (App.tsx `Frame`): a 248px `Rail` (new email, accounts, five stacks with counts, To-do, Drafts, All mail, Search, Settings), the content, and on deck routes at 1280 and up a 320px `SidePanel` (`Up next`, or `To-do` with `See all` on Today, the finish and the last card). The phone Menu is not shown on desktop.
- Keys: `components/useGlobalKeys.ts` is a capture-phase window listener (so `G T` never also fires the deck's To-do move), off in fields, off on the reply and new routes. `/` Search, `C` New email, `G T` To-do, `G I` Needs you, `G D` Drafts, `?` the sheet (`ShortcutsDialog`). Deck keys are in `useDeckKeys` (it stands down when any `aria-modal` is open; New senders adds A, B, N). The reader uses `useBarKeys` (E H T R, A B N). Action bar buttons show `kbd.keycap` caps on desktop.
- The swipe pill now lives in `Deck.tsx` (`SwipePills`) and holds still at the deck center while the card moves; the white wash (`SwipeWash`) stays on the card, at most 40%.
- `Toast` sits above the action bar when there is one, else 12px under the top bar or page header. `router.ts` `navigate` keeps `from` so the phone back button can name the previous place (`lib/placeName.ts`).
- Today rows and the covers are measured to fit (Today 3 to 5, covers as many as fit then `and N more`).
- `PageShell` is the one page frame: phone large title that collapses into a 52px header, desktop 720px column. `List.css` holds the grouped list, `.search` and `.seg`. All mail, Drafts, Search (`AskScreen`), New email, Settings and To-do use them. Drafts has no Send in the list; tapping resumes in the composer, the trash button deletes with a real Undo.
- The reader and plain reader on desktop sit in the content region at 680px with the action bar under the header.
- Sample mail in `lib/staticDemoData.ts` got varied sign-offs and shorter openings; the flight thread has a Goal and a due date. Facts used by Goals, highlights and drafts are unchanged.

Not checked: the server route, a real iPhone, a screen reader.

## Handoff, 2026-11-26 (Claude, round 8B): To-do, Today, composer, finish

What changed and where it lives:

- One To-do model, `client/src/lib/todo.ts`. `buildTodo(data, account)` gives `{open, waiting}`. A row is one thread: a starred, non-archived thread, or a thread with an open promise you made. The title is the promise, else the Goal, else the subject. The due time is the promise's, else the deadline's, else the open task's. Rows sort by due time, overdue first, undated last. `todoCounts` gives open, due today, overdue and waiting, and every screen reads it, so the Today card, the finish card, the menu and the To-do screen cannot disagree. Needs you leaves out any thread that is on the To-do list. The To-do stack is the open rows in the same order.
- Done now clears everything about a thread: it unstars, resolves its open promises and archives. Undo puts it all back. The static API got `reopenCommitment`, and the server got the same as `POST /commitments/:id/reopen` (not type checked, the server has no node_modules here).
- The swipe shows one centered badge (`SwipeBadge.tsx`) instead of corner stamps: a white wash and a round badge, outlined until the card is far enough to commit, then filled. The action bar button for that direction turns ink while dragging and fills once past the commit point. In the To-do stack there is no up move and no up badge.
- Today (`TodayCard.tsx`) sits on the canvas: date, `N left` or `N need you`, minutes, as many `First up` rows as fit (at least one) that open the email, `Sorted for you` counts, To-do and Drafts links, and Start or Continue. The week row (`StreakStrip`) is on the finish, not on Today. Settings has a `Show streak` switch (`lib/prefs.ts`) that hides it and the streak count.
- The To-do screen (`GoalsScreen.tsx`) lists the rows with a check. Checking is Done. A Waiting on group has Nudge. A pinned `Tackle N` opens the To-do stack.
- The finish card (`FinishCard.tsx`) has the ring, counted-up stats, a pace line, a `Still on your To-do` row, the week strip (Needs you only), a filled `Next:` button and the other stacks. The To-do row is not repeated in the list.
- The composer has two states. Choose shows the Goal, the replies, `Your draft` once there are edits, `Write my own` and an ask field. Edit shows the text full screen with Send. Picking a reply that already has text goes to Edit with no network call. Back keeps edits. Nothing is sent until Send.
- Later sheet is a 2 by 2 grid plus `Pick a date and time`. The menu is on the canvas with white groups and a bar on the current place. Newsletters and Receipts covers list the senders or vendors and fit a short phone.

Not checked: the server route, a real iPhone, a screen reader.

## Handoff, 2026-11-26 (Claude to Antigravity): the design and UX pass

Levi's feedback on the 11-25 demo: it did not feel premium, was not intuitive, leaned on the summary instead of the email, had no clear goal and gave nothing back for clearing mail. What changed and why:

- The card is the whole email, not a summary, and it no longer scrolls. It is a calm letter: the sender's monogram, name, age and due date on top, then the Goal in large type (the hero of the card) with a `Goal` label in the accent, a thin line, the subject, and the email body clipped to what fits. If the body does not fit, the last lines fade out and a `Read all` link shows at the bottom left. The sentence that makes the Goal is highlighted; if it would fall below the visible part, the body is scrolled by the code so it shows (the user never scrolls it). Attachments show as `1 attachment` at the bottom right. There are no reply buttons on the card.
- Four swipes, all handled by our own pointer code in `lib/useCardGesture.ts` (not framer drag). Nothing moves until the pointer has travelled 10px, then it locks to one axis. Right is Done, left is Later (opens the time sheet; cancelling springs the card back), up is To-do (the Goal goes on the To-do list and the card leaves the stack), down is Skip (the card goes to the back of this stack for the session and does not count as handled). New senders: right Allow, left Block, up Newsletters, down Skip. A card commits past 30% of its width, 18% of its height, or on a quick flick the same way. A tap on the card opens the email. Keys: arrows or E H T J, Enter or Space opens, R replies, Z undoes, ? lists them.
- Tapping a card opens the reader at `#/read/<id>?from=<stack>`. It slides up over the deck (the deck stays mounted underneath), shows the same header and Goal, the whole conversation with the highlight, and the same action bar. An action there acts on the email and returns to the deck with that card gone. Back returns with the card still on top. For a new sender the route also carries `&sender=<address>`.
- Bookmarked is now called To-do everywhere the user sees it. The route id is still `bookmarked` and the data is still `isStarred`. The bookmark button is gone; the To-do swipe and the To-do button replace it.
- The action bar floats at the bottom: Later, To-do, Reply, Done (Later, To-do, Done on Newsletters and Receipts; Block, Newsletters, Allow on New senders). Done is the one filled button. While a card is dragged, the button for that direction lights up. Undo is not in the top bar any more; it is in the toast, and Z still undoes. The top bar has the menu, the stack name with `3 of 12`, and Search.
- The accent is now a deep emerald (`--accent #0B7A5A`), not blue. Tokens, a type scale (`.t-display` to `.t-caption`) and the new shadows are in `tokens.css`. Icons use stroke 1.75.
- Rewards for clearing mail: a Today card opens Needs you (count, minutes, a ring, the streak, Start), a segmented bar shows one segment per card, the top bar reads `4 of 12`, and an empty stack ends on an All clear card with a ring, a check, stats and a short confetti burst. The streak counts days Needs you reached zero. Saturday is a rest day: it shows as a rest dot, is left out of the `N of M days` count and never breaks the streak.
- `client/src/lib/progress.ts` keeps all of it in localStorage by local day, as a log of today's moves (card, stack, account, reply or not, time). Past days keep only whether they were clear. Progress is per account: the Today card, ring, bar and `N of M` count the account filter you are on. The streak is not: a day counts only when Needs you is empty in every account, so clearing one account never writes an All clear day. Sample mode seeds four earlier days so the demo shows a streak. Settings Reset clears today only. Undo and a failed save take back exactly the moves of the cards they restore. Snapshot mode keeps its own key, which Remove clears.
- The finish card's stats are for that stack and filter only: handled, replies, and active time (gaps between moves, each capped at 3 minutes). The ring fill, check, confetti and streak pop run only when the user's own move empties the stack; coming back to a cleared stack, or a reload on one, shows it finished at rest.
- A one-time nudge slides the first card ever a little right, with the Done stamp at full strength, to show the swipe. It never runs with reduced motion.
- The reply composer keeps a compact Goal band on top and shows the replies in the same two-column grid. Sending, the Shabbos hold and the snapshot toast are untouched.
- Tokens: new radii, shadows and the scrim live in `tokens.css`. The menu, sheets and the other screens use them.
- The toast is white with a hairline and a float shadow, stays 6 seconds, and never sits on a button: on a phone it goes 12px above the action bar; on a desktop it stays bottom left when its measured box clears the card column and the bar, and otherwise sits above the bar. It re-measures when the deck changes and on resize.
- A New sender card has the same anatomy: the label `New sender`, the sender's address in large type and the reason under it, then the first email clipped the same way, with no highlight.

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

1. Light only. No dark mode, no dark surfaces, no cream or beige background. The canvas is the warm off-white in `client/src/styles/tokens.css` (#F2F1ED).
2. One accent color. It marks the single primary action on a screen (Reply, Send, Done) and the Goal. Nothing else is colored. Red is only for destructive actions and overdue dates.
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
