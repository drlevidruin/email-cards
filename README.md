# Email Cards

Email Cards is an email client that shows one email at a time as a card you swipe. Every card says what you need to do about it, and offers replies you can send in one tap.

## Demo

https://drlevidruin.github.io/email-cards/

The demo runs in the browser on sample mail and keeps its state in local storage. Menu, then Reset puts it back.

## How it works

Mail is sorted into six stacks:

- Needs you: mail that waits on a decision or a reply from you.
- New senders: people writing to you for the first time, held until you allow them.
- Newsletters: bulk and feed mail.
- Receipts: receipts and invoices.
- Bookmarked: cards you saved to come back to.
- Later: cards you pushed back, which return at the time you chose.

You clear a stack one card at a time with four moves:

| Move | Swipe | Key |
| --- | --- | --- |
| Done | Left | Left arrow |
| Later | Down | Down arrow |
| Bookmark | Up | Up arrow |
| Reply | Right | Right arrow or Enter |

In New senders the moves are Block (left), Newsletters (down) and Allow (right).

Every card states its Goal, the one thing the email wants from you, in large type. The subject is a small grey line above it. Each card also offers built-in replies. Tap one, or press 1, 2 or 3, to open a drafted reply you can edit before sending.

Goals, in the Menu, lists what you owe and what you are waiting on, with your bookmarked cards.

Undo brings back the last card. Press Z, or tap Undo in the message that appears after a move.

## Status

This version is the demo of the new design. The client was rebuilt on 2026-11-25. The local server (Gmail sync, database, Shabbos and Yom Tov hold) is unchanged from the first version. The screens for connecting Gmail and for the Claude key are not rebuilt yet, so running it against real mail is the next step, not this one.

## Develop

```bash
npm run install:all
VITE_STATIC_DEMO=true npm --prefix client run dev
npm run typecheck
npm run build:pages
```

`VITE_STATIC_DEMO=true` runs the client on sample mail with no server. `npm run build:pages` builds the demo for GitHub Pages. A push to `main` deploys the demo to GitHub Pages.
