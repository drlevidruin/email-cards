# Email Cards: notes for any agent working here

## Handoff, 10H and 10I (2026-11-27): a green table, white cards, lime for the one thing to do

- Why: Levi rejected the quiet beige card as bland and the 10G colour blocks as cheap, and lifted every design constraint for one more try.
- The stage: `.cards` is `--brand-deep` with a soft glow; words on the table take cream inks through one rule in `screens/CardsScreen.css` (the top bar, the hint, the moves, Today), and paper on the table (`.today__stack`, a card) takes the `--p-*` paper inks back. Never turn the inks on `.cards` itself: the menu and the Later sheet are its children.
- The card: one white sheet, no tinted zones, no chips, no subject line on a goal card; a 29px serif ask, one hairline, the excerpt a step quieter with the asking sentence in full ink over a lime underline.
- Answers: the first ready reply is the one lime button (--signal with --on-signal words), a second is a quiet grey button (--surface-2), "Write my own" a quiet line; the class names and `data-answer` are unchanged because the deck's gesture reads them.
- Lime: every main button is lime (.btn--primary, the first answer on a card, the solid disc, Start on Today, the welcome, How it works and All clear buttons, Done in the reader). Nothing else is.
- New senders: the card's headline is the question "Allow <name>?", which the lime Allow disc answers.
- 10J (same day, after four ADHD readers looked at the screens): one lime answer per card, not two; the line under the asking sentence is thinner (22% of the line); every monogram is one tone (--brand-deep with cream initials, no per-sender hues); the deadline line is 14px with its dot on the card and in the reader; the names under the discs are 13px full cream; on a phone the reader's text fades out above its bar; the first sample email (Maya) is one short paragraph so it shows whole on its card.
- 10K (reviewer's finding): lib/skim.ts only treats a closing word as the sign-off when every line under it is a signature line (short, not a sentence, not a P.S.), and a bare last line as a name only when it is one or two words under a finished sentence. If the Goal's sentence is not in the skimmed text, the card and the reader show the email whole. Known limit: a one or two word capitalised last line under a blank line ("Main Office") is still read as a name. The cases are in the check script quoted in the commit that added this line.
- Moves: `ActionBar` has two looks, `actionbar--deck` (round cream discs with an arrow each, on the table) and `actionbar--read` (a white dock of word buttons in the reader).
- Reading: `lib/skim.ts` splits an email into hello, content and sign-off; the card shows the content only, the reader fades the other two and sets dates, times and amounts bold (`tv__fact`).
- The browser's bars are green whenever the deck shows (`useBrandChrome(!covered)`).

## Handoff, 2026-11-27 (Claude, round 10G): the card in blocks, one colour per job

Levi, on the live card on his phone: "The colors are terrible its hard to read. See seperretion. Too much of the same on the page. Don't see lines separating parts like its meant to help my adhd brain. This looks bland and hard to see at once."
- The page is a cool light grey (#E6E9EF) with near-black ink. Nothing is beige.
- A mail card (`card--mail`) is four blocks with real lines between them.
- Block one is the `cardhead` band, tinted in the account's colour, with the account as a pill.
- Block two is the ask on white, with the deadline as a chip.
- Block three is `cardwords` on `--surface-2`, with its label and the yellow `--mark` on the sentence that asks.
- Block four is the answers: ready replies are green, your own is white.
- The bar is a white dock of tinted buttons. Each move has role tokens (`--later`, `--todo`, `--skip`, `--done`, `--stop`, each with a `-soft`), and the swipe stamps use the same tones.
- The progress line is emerald.

## Handoff, 2026-11-26 (Claude, round 10D): one draft, a calmer start, honest empty piles

10E (after the last review):
- Your own draft is any draft of that email with status `draft`, whoever wrote it first (`myDrafts`).
- Leaving a draft exactly as stored saves nothing and says nothing (`ReplyComposer.tsx`).
- A reply that went out is marked sent right after `sendDraft`, before the archive call.
- Undo and a change of pile teach no lesson (`useCardPointer` takes `nextId` and `pile`).
- Tab from a fill-in to its own Add no longer adds behind your back (`BlankRows.tsx`).

10F (returning visitors):
- The sample store key is now v4 (`lib/freshSample.ts`). A browser holding an older sample is started over once at load: older sample stores and `email_cards_progress_v1` are removed, a private inbox is untouched. Whenever the sample mail changes in a way a first visit depends on, raise the key's version.

- One-draft rule: each email has at most one unsent draft of yours. Leaving the reply screen saves changed text into it (or makes it) with one "Saved to Drafts" notice; unchanged or empty saves and deletes nothing. Send removes your draft for that email. Code is `lib/myDraft.ts` and `ReplyComposer.tsx`; a ready answer from a card only remembers your draft, it never replaces it.
- Fill-ins: Add keeps focus and jumps to the next open fill-in. Cancel and Back drop typed-but-not-added text with no draft. The stale Send press uses a 1 second window (`pressedAt`) in `ReplyEdit.tsx`.
- Card lessons live in a page-long map by card id (`lessonFor` in `lib/onboarding.ts`), cleared by Start over. `useBrandChrome` follows the media query while a green screen is up.
- New sample starting state: Jordan and Elena are starred (they move to To-do with the other heavy approvals) and urgency changed for Hannah (82), the offsite vote (77) and Mateo (75), so Needs you opens on everyday mail: Maya, Sam, Hannah, Daniel, Devon (offsite), Mateo, Devon (build), Marcus, Tessa, Claire. To-do holds six open, two due today. Both data files are synced.
- 10D-2: Send does nothing only for a press that was really remembered (`pressedAt.current > 0` and under 1 second), so the first Send in a page's first second now sends. The venue vote email (`thr_ref_01`) is shortened so the question and both venues fit on the card at 402 by 714; subject, title, deadline and replies unchanged.
- Empty piles: an unworked pile that is not Needs you shows a plain title (Later "Nothing saved for later.", New senders "No new senders.", Newsletters "No newsletters waiting.", Receipts "No receipts waiting.") with no week strip. `finishInfo` now lists Needs you first whenever it still has cards. To-do keeps "All clear." as its fallback.
- Done wording: "It's out of your inbox, kept in All mail." and the How it works row. Note the email sits under the Archived tab in All mail, not the default Inbox tab.
- Found and left: `ReplyComposer.tsx` is 309 lines. After "Write my own" then Cancel, Maya's pointer line is hidden because that tap taught the lesson. Agent drafts (`drf_01`, `drf_02`) stay in Drafts when a different reply is sent. The rig cannot press Backspace, so type-then-delete was not run. Headless shots are not a real browser; the fresh offsite shot clips the last line under the fade (virtual time measuring), the returning shot is right.

## Handoff, 2026-11-26 (Claude, round 10C-2): no card with a hole in it

- `CardBody`: after the usual binary search picks the start, if that start is not the first candidate and the email ends in view with at least 1.5 lines of room under it (line height from the box's computed style), a second binary search runs over the word starts between the candidate before and the chosen one, and takes the earliest where the marked sentence still ends above the fade. It is kept only if it adds 40 or more characters (`MIN_ADDED`). `layout()` is the shared measuring copy; `fits()` and `hasRoom()` use it. Jordan, Daniel and Devon now fill the card with the lines leading up to the question.
- Sample data (both files, synced): Daniel's `Offer two times` reads `I can do 30 minutes next week: [first time] or [second time].`
- Harness: `review10b/d-h3.html` and `d-shoot.sh` (adds `elena`, `hannah`, `two-both`). Headless Chrome on virtual time needs a budget of 40000 for `skipto` scenarios and can measure the card before the pointer line shrinks it (Jordan's first-session shot shows the last line under the fade; a real pane at 402 by 714 measured the mark ending 12px above the fade line).

## Handoff, 2026-11-26 (Claude, round 10C): the first minute, and the review's fixes

- Welcome says what the app is for: headline `Clear your inbox, one email at a time.` (two `.welcome__line` spans, 34px on phones, 32px under 600px tall), a new paragraph (phone and laptop wording differ), the note under the button is 14px on 20px in `--on-brand-2`. Link preview: `tools/share.html` and `client/public/share.jpg` remade, both description tags in `client/index.html` changed. `--on-brand-pressed` (#E6E3DA) is now one token used by the welcome, How and finish buttons.
- Sample data (`staticDemoData.ts`, synced to `server/src/demoData.ts` with `tools/sync_server.sh`): new thread `thr_dec_00b`, Sam Ortiz, `Thanks for Sunday`, urgency 90, no ready answers, no deadline (`deadlineLabel: null`). Devon's `thr_dec_05` is now urgency 73. Needs you order at 10C (10D changed it, see above): Maya, Sam, Jordan, Elena, Daniel, Hannah, Devon, then the Remind cards.
- One accent rule: a row is emerald only when the card has a ready answer (`hasReady()` and `answerRows()` in `components/CardAnswers.tsx`). The lone `Write a reply` row and the short-window `Reply` row are quiet unless a ready answer exists. `CardsScreen` has `topRows` (the card shows rows, so keys 1, 2 and R work) and `topAnswers` (rows and a ready answer: Done is ink, the pointer may teach `answer`).
- `CardBody.starts()`: the shown text may start at any line start above the mark, so the lines before a question fill the card. At 390 by 664 Devon's card has room for the question only (the Build B paragraph is four lines, the blank line and the two-line mark do not fit with the fade); at 844 the Build lines show.
- Reply fill-ins: `BlankRows` adds what is typed when the field loses focus, on Add and on Return (`enterKeyHint="done"`); `Add` is an ink button once there is text. `onFill` takes pairs and a `quiet` flag (quiet adds do not move focus). `ReplyEdit` Send is `aria-disabled` while a fill-in is open: the press is remembered on pointer down (`pressedOpen`) because the field's blur closes the fill-in before the click, and that click only adds what is typed and puts the cursor in an empty field. It never sends in that press.
- Side list: `Rail.tsx` shows names only; each row has the line as a `title` (`NavRow` `title` prop). Menu and How it works keep their lines. Rule 5 text updated.
- `useBrandChrome` also sets `document.body.style.background` under 1024px wide (Safari on iOS 26 takes its bars from the body) and puts it back with the rest. Not checked in real Safari.
- Review fixes: `ReplyComposer` `Write my own` reopens the person's unsent draft for the thread and Cancel updates it (an empty editor leaves none); notices use `lib/noticeName.ts` (`noticeWho`: first name only on Needs you and To-do cards from a person, else the full name: `Done: Quiet Editorial Digests`); `storeActions` `toast` can be a function run after the save works (first-Done wording is used up only then); `Toast.tsx` keeps `To-do` on one line (`.toast__word`) and its unreachable pointer branch is gone; `useCardPointer` hides any pointer whose move is now taught; `useDeckKeys` ignores `e.repeat` except Z; `HowScreen` Escape listens in the capture phase and does nothing while a dialog is open; `skip()` takes the item; `ShortcutsDialog` lists `Open an answer 1 2` and `Write my own R` under Cards (the old `Reply R` row is gone); `Deck` calls `markTapped()` in `CardAnswers` when its tap handler acts on a row, and a row's own click acts unless that mark is under 700ms old (replaces the `event.detail === 0` test); leftovers in `Deck.tsx` and `CardsScreen.tsx` (now under 300 lines) cleaned.
- Trip hazards: `ReplyComposer.tsx` is about 300 lines, split it next time. Sam's card has no due line, so the card has no red or green line above the big line; Today shows it under `Anytime`. A held key sends repeats with `e.repeat`; harnesses that fake keys must not set it. Headless Chrome on virtual time catches a toast only if the capture lands inside its 6 seconds.

## Handoff, 2026-11-26 (Claude, round 10B-2): the pages around the deck

- Green field: `All clear.` (`FinishCard`, `CardsScreen` `cards--clear`) and `How it works` (`screens/HowScreen.tsx`, route `#/how`, a `PAGES` entry in `App.tsx`) sit on `--brand-deep` like the welcome. On a laptop only the middle column goes green; the rail and side panel stay. `components/useBrandChrome.ts` (moved out of `Welcome.tsx`, now counts its users) greens the browser bar and overscroll.
- How it works replaces the welcome replay: `again` mode, `showWelcomeAgain`, `closeWelcomeAgain` and the `Got it` label are gone from `Welcome` and `lib/welcome.ts`. The menu and the rail open `#/how` in any inbox. `Got it` and Escape call `goBack()`.
- Contents rows: `NavRow` (menu, rail) takes `list` (a serif numeral column, empty for a pile with nothing in it) and `hint` (one line under the name). `lib/navHints.ts` holds the eight names and lines (`PLACES`) used by the menu, the rail and How it works; `useHint()` returns the line in the first session only. `TodayCard` links and `FinishCard` rows use the same numeral-first row.
- Menu footer: `Sample inbox` and `Start over` (was `Reset`). Welcome note, How it works and the editor strip say the demo is a made-up inbox that cannot see your email. `ReplyEdit` has the sample line on a full-width `--canvas` strip under the top bar.
- To-do page: `Draft reminder` and `Reminded` (was Nudge and Nudged). Sample headlines say `Remind Marcus about the itemized quote`, `Remind Tessa about the net IRR table`, `Remind Claire about the clean markup`, in both data files. The chooser's headline uses `voice`.
- Fixes to 10B-1: `navigate()` ignores a push to the path already showing; the pointer never teaches what the person just did (`onDirection` marks the move, `answer()` marks `answer`); button words in the pointer never break (`.pointer__word`).
- Housekeeping: `lib/onboarding.ts` holds welcomed, first Done, taught moves and first session (moved out of `lib/progress.ts`, which exports `readLog`, `writeLog` and `Log` for it).
- Rule 1 widened (Levi, 2026-11-26: be brave): the green field is now for the app's own moments, which are the welcome, All clear and How it works. Everything you work in stays light. Undo: drop `cards--clear` and make `HowScreen` use `--canvas` and the ink colours.
- Rule 5 widened (Levi, 2026-11-26: be brave): first-session help also covers the one line under each pile name in the menu and the rail. Undo: stop passing `hint` in `Menu.tsx` and `Rail.tsx`.

## Handoff, 2026-11-26 (Claude, round 10B-1): the card answers, the bar moves, the stamp lands

- Card: header line one is the sender and, at the right, account and age; line two is the subject with a 14px paperclip when the email has a file (`CardHeader` `subject` and `attached`; no subject prop keeps the old header, used for subject-hero cards, New senders and the reader). The bold subject, the attachment chip and the foot row are gone from the card; `Read all` sits bottom right over the fade in `CardBody` (`FADE` is 36). New senders keep their bold subject (`ScreenerCard`).
- Answers: `components/CardAnswers.tsx` and `.css`. Needs you and To-do thread cards show the first two `replyActions` and `Write my own` (`Write a reply` when none, one `Reply` row under 600px tall). A row's path is `answerPath()`: `/reply/<id>?qa=<chip>&direct=1&from=deck`, `?own=1&direct=1&from=deck`, or the chooser. `direct` makes the editor open at once with that answer, Cancel at the top left, and Escape and Cancel go back to the deck (`ReplyComposer`, `ReplyEdit` `cancel`). Keys 1, 2 and R (`answerForKey`, `useDeckKeys` `onAnswer`).
- Taps: the card holds the pointer, so `useCardGesture` hands the tap event to `Deck`, which finds `[data-answer]` under the finger with `document.elementFromPoint`. Rows also have an `onClick` that acts only when `event.detail === 0`. The check is `row.closest('.deck__card--top')`, not the `card` ref: after a card change the ref pointed at a stale element and every row tap opened the reader.
- Bar (`ActionBar`): deck bars are arrows plus words (`Later To-do Skip Done`; To-do deck without To-do; New senders `Block Newsletter Skip Allow`). `reader` prop gives the reader's word-only bar with Reply. `answers` prop makes Done ink on a card with rows; Done is emerald on Newsletters and Receipts, Allow always. Skip is `BAR_KEY.skip = J`. The top bar's Skip button is gone and Search is back on phone deck screens. `lib/deckConfig.ts` holds each deck's variant, moves and stamp words (`CardsScreen` was at its line limit).
- Stamps: `SwipeBadge.tsx` renders `SwipeStamps` inside the top card's overlay, so they ride and tilt with it. A bar or key press shows the stamp solid; Later holds it solid under the sheet and `Deck.release` fades it (`hold` value). The self-moving nudge, `SwipePills`, `nudge`, `onNudged` and `teach` are removed.
- Pointers: `answer` first on the first card with rows, then right, left, up, down, open (`CardPointer` text in the app's voice, `pointerText`). New senders has `s-right`, `s-left`, `s-up` in the progress log and teaches them the first time that deck is met, in any session. Seeds that should show no pointers need all of them (`panel/round4/phone.html` now has them).
- Notices name the sender (`whose()` in `storeActions.ts`), sit at the top over the top bar on deck screens (`Toast.tsx` `place()`), and a send in the sample inbox adds a lighter second line (`sentToast`, split on a line break). The count reads `N left` and stays put on a Skip.
- Sample data (both files, synced): `Approve Option B on the packaging proof`; ready answers `Remind Marcus about the quote`, `Remind Tessa`, `Remind Claire`.
- Short phones: under 700px tall the card tightens its padding so the email keeps four lines. Headless Chrome on virtual time can measure `CardBody` before layout settles and show an older start; a real browser at 390 by 664 starts at the marked sentence.
- Not done: the Dones, Skips and Later toasts name the sender only for thread cards; the Reader's To-do toast reads the same way. No test of VoiceOver on the rows.

## Handoff, 2026-11-26 (Claude, round 10A): a stranger gets it in five seconds

- First run: `Welcome.tsx`, `Welcome.css`, `WelcomePicture.tsx` and `lib/welcome.ts` draw a full screen on the deep green `--brand-deep` (headline in the serif, the card picture with Done, Later, To-do and Skip, one button). It shows only in the sample inbox (`lib/sample.ts`: static demo and not a snapshot) and only until the progress log (`email_cards_progress_v1`) has `welcomed: true`. `index.html` has a small inline script that paints the page green before React loads when the log is not welcomed, so there is no white flash (`boot-welcome`, removed when Welcome mounts).
- Hand-off to the first card: the button sets `welcomed`, goes to `/cards/needs-you`, starts that stack (`session.todayDone = true`, `markStart`) and slides up over 420ms. Today is skipped on a true first visit. While the screen is up, `App.tsx` wraps the app in an `inert` `display: contents` div and `lib/welcome.ts` swallows keys in the capture phase (Escape closes the reopened welcome, Enter presses its button, Tab passes, all else is stopped). Reopening is `How it works` in the menu (phone) and rail (laptop), which shows the welcome with `Got it`.
- First Done: `firstDone` in the progress log. `takeFirstDone()` returns true once and the Done toast then reads `Done. It's out of your inbox.`; later Dones read `Done`.
- Pointers: `useCardPointer.ts` and `CardPointer.tsx`, one line under the top card. `nextPointer` picks the first move not yet taught, in the order right, left, up, down, then `open`. The pointer is pinned to the card it arrived with (so it does not change mid-card) and the move is written to `taught` in the log when that card leaves. Doing any move marks it taught, so a person who already knows a move never sees it. Once `open` is taught there is no pointer. Skip is a button in the top bar (right slot) while the deck shows more than one card and down is still untaught. `resetOnboarding()` (called by `resetSessions`) clears welcomed, firstDone, nudged, taught and firstSession.
- Serif (`--font-display`, class `.voice`, system serif stack, no font file): welcome headline, Hero goal text, finish title, the Today count and goal, and the picture card. Everything else stays in the system sans. `text-wrap: balance` on the Hero text and the ask lines.
- Sample inbox lines: `Sample inbox` before the date on Today and in the menu footer, `Sample inbox. Nothing is really sent.` under the header of the Send screen (`ReplyEdit.tsx`, `.edit__sample`).
- Sample data (both data files): new first thread `thr_dec_00`, Maya Chen, `Dad's 70th: dinner on Sunday?`, due today 6:00 PM, with two quick replies. Four asks reworded: `Review the packaging proof and approve Option B`, `Approve the $2,850 kitchen change order`, `Pick which version to present Thursday`, `Send Daniel two times to meet next week`. `lib/commitments.ts` now shows only the committing clause of a sentence like `X, and I'll call him` (`committingPart`); `commitments-check.mjs` has Maya's two replies.
- Link preview: `tools/share.html` is the source of `public/share.jpg` (1200 by 630); description and og:description, theme-color and the manifest colors updated. To remake: copy the page into `client/dist/`, load it from the served build in headless Chrome at 1200 by 630, and convert with `sips -s format jpeg -s formatOptions 88`.
- Reduced motion: the welcome picture loop and the pointer fade are off, the labels sit at full opacity, and the leave animation is a fade.
- Deviation from the brief: focus does not start on the welcome button. Autofocus put a focus ring on that button and, through the programmatic focus, a green ring on dialogs opened later. Keys are swallowed instead, and the button is the first Tab stop.
- Old harnesses: `panel/round4/phone.html` and `design/shot.html` now seed `welcomed`, `firstDone` and all five taught moves so their scenarios start where they used to. `progress.ts` is over 300 lines; split it next time it grows.

## Handoff, 2026-11-26 (Claude, round 9E): Undo you can count on

- A toast can be `sticky` (`storeTypes.ts`): no timer; it clears on the next message, on Undo, or on `hashchange`. `archiveAll` sets it through `CommitSpec.sticky`, so `Archived 9 receipts` with Undo stays up until the person acts or leaves the pile. Undo and Z still reverse the whole bulk archive in one step.
- Every other undoable toast draws `.toast__time`, a 2px line in white at 40 percent that runs out over `TOAST_MS` (6000, the same constant as the timer). Not on sticky toasts, and hidden under reduced motion. The toast is keyed by id, so the line restarts with each new message.
- The blank field's focus is a 1.5px emerald edge drawn with `box-shadow` on the field, with no outline ring.
- Sample data: Jordan's thread is `Solis Health: Packaging Press Proof & Serif Lockup`, matching the solishealth.com address, in both data files.

## Handoff, 2026-11-26 (Claude, round 9D): only the deck is paper

- Today: the deck card is one white card with a shadow and no stack edges. The three pile tiles and `Sorted for you` are gone. New senders, Newsletters, Receipts, To-do and Drafts are rows on the canvas (`TodayCard`, `.today__links`), each hidden at zero. `Stack.tsx`, `FinishPile` and `CountUp` are deleted. The only edges left are the live deck's card behind the top card (`Deck.tsx`).
- Finish is type: `All clear` (`t-display`), `N handled in ...`, and the result line from `movesLine` in `FinishCard.tsx` (`2 moved to Needs you · 1 to Newsletters · 1 blocked`; only the first move says `moved`, zero parts are left out). No kicker, no pace line, no card. The toast rides above `.finish__primary`.
- Action bar: four equal buttons on the canvas, no pill, no fill. Done (and Allow) are emerald, the rest ink. A drag past the commit point still fills the button it is heading for.
- Later sheet is a list (`laterrow` in `Sheet.css`): name left, time right in ink-3, `after it's due` in red, 52px rows, no icons. Nudge is a transparent secondary button with a hairline, 44px tall.
- Blanks: `BlankText` shows each open blank as its own words on `--accent-line` (radius `--radius-xs`, 4px) in the Choose previews, the committing quotes, the Drafts preview and the editor. `ReplyEdit` shows the body as a div in the textarea's exact type until the body is tapped (caret goes to the end) or the last blank is filled with Add; then it is the textarea. Brackets show again in the textarea.
- Words: Choose field is `Or say what to write`. Search answers `Two are due today, and ten emails need you.` Jordan's Goal was `Review the die-line and approve Option B`; round 10A reworded it.
- Shot harness (`scratchpad/panel/round4/phone.html`): headless Chrome on virtual time starves `requestAnimationFrame`, so card flights never finished and later keys were ignored. The harness now drives animation frames from timers in the app's window and sends keys to the frame's body.

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

## Handoff, 2026-11-26 (Claude, round 9C): the desk, not a template

- Only cards are paper. `components/Stack.tsx` draws the paper with a stack edge for the deck, the Today card and the three piles. Lists, To-do, Drafts, All mail, Search and the rail sit on the canvas with hairlines.
- Trust fixes: Search names and counts come from the real threads and say 12 after two senders are allowed. Deciding on a new sender updates the piles. To-do shows only promises you made, and Waiting on holds what others owe you. Labels and highlights were shortened.
- Today is one card, an Up next line, the three piles and two link rows. Cards show their due line in green, red only when due today or overdue.
- Search answers in a sentence, then Due today and Needs you lists.
- A reply with a blank to fill shows one row for it, with Add. Send stays off until every blank is filled.
- Toasts sit at the bottom. The rail and menu have an account picker. CSV has an Account column after Date.
- Data changes live in both `client/src/lib/staticDemoData.ts` and `server/src/demoData.ts`.
- Not checked: a real iPhone, a screen reader, the server route.

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

1. Light only. No dark mode, no dark surfaces, no cream or beige background. The canvas is the warm off-white in `client/src/styles/tokens.css` (#F2F1ED). Changed on purpose (Levi, 2026-11-26: onboarding is crucial and cannot be complicated; be brave on the look): the app is still light on the #F2F1ED canvas; the green field `--brand-deep` is for the app's own moments, which are the welcome, All clear and How it works; everything you work in stays light. Widened again (Levi, 2026-11-26: be brave). To undo: set `--brand-deep` to the canvas colour and the `--on-brand` tokens to the ink colours. Changed on purpose (Levi, 2026-11-27: "be brave. Change anything. Change colors"): the deck is a deep green table (--brand-deep) with white cards on it; every other screen stays light. Undo: remove the background on .cards and the on-table ink rule in screens/CardsScreen.css, and give the deck's moves a light style.
2. One accent color. The accent marks the one thing a screen most wants from you: the answers on a card that has them, and the primary button everywhere else (Send, Done on a card with no answers, Allow). The Goal keeps its accent. The Done and Allow stamps are also emerald. Red is only for destructive actions and overdue dates. Changed on purpose (Levi, 2026-11-26: be brave): before this, the accent marked only the single primary action (Reply, Send, Done) and the Goal. To undo: make the answer rows' icons `--ink-3` and set Done in the deck bar to `--accent` again (drop the `answers` prop in `ActionBar`). Changed on purpose (Levi, 2026-11-27: "Be brave with the color scheme and buttons"): two greens and one signal. Emerald (--accent) is for words and small marks on paper. Lime (--signal) is the one loud colour and has one rule: it is on the one thing a screen wants done (its main button), on the progress line, and under the sentence that asks. The colour-per-job tints of the earlier 11-27 pass are gone (Levi: "This looks so cheap"). Undo: set --signal to --accent and --on-signal to #fff.
3. Two voices, both system fonts, three weights, the sizes in the token file. No uppercase eyebrow labels, no gradient text, no sparkle icons, no emoji, no badges or chips as decoration. Changed on purpose (Levi, 2026-11-27): no chips on a card. The deadline is one plain line with a dot. Changed on purpose (Levi, 2026-11-26: onboarding is crucial and cannot be complicated; be brave on the look): the system sans for controls, lists and the email; the system serif (`--font-display`, class `.voice`) for the app's own words in the places listed in the round 10A handoff. To undo: set `--font-display` to `var(--font)`.
4. Each action appears once on a screen. If a move is on the action bar, it is not also a button on the card and a row in a menu.
5. No helper text: no subtitles explaining a screen, no hints, no onboarding tips, no empty-state paragraphs. A label says what the thing is and stops. Changed on purpose (Levi, 2026-11-26: onboarding is crucial and cannot be complicated; be brave on the look): unchanged, except for the first run (the welcome, and one pointer per card in the first session, gone for good after it) the one line under each pile name in the phone menu in the first session (Levi, 2026-11-26: be brave; the laptop side list shows names only and carries each line as a hover title), and the two sample-inbox lines (`Sample inbox` on Today, `Nothing is really sent` by Send). To undo: remove `Welcome`, `CardPointer` and the `.edit__sample` line, and leave `welcomed` true.
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
