# The screen scrolls inside the frame

Oct 22, 2026. Alex: "there needs to be a scroll feature on the board, it can't just keep expanding vertically." The fix is in the app's frame, so it applies to every screen.

## What happens today

`.app` is a flex column with `min-height: 100dvh`. With more content than fits, the page itself grows: the Board's rows push the tab bar down and off the screen, and the top bar scrolls away with the content. On Make, the dev panel below the card does the same.

## Decision

- **The frame is exactly one screen tall** (`height: 100dvh`, `overflow: hidden`), still one phone-width column with the safe-area padding at the top.
- **Only the middle scrolls.** `.app-main` gets `overflow-y: auto` (and `min-height: 0`, which a flex child needs to be allowed to shrink), with `overscroll-behavior-y: contain` so a scroll that reaches the end does not drag the page. The top bar and the tab bar never shrink (`flex-shrink: 0`) and never move.
- **No other layout changes.** The Board's rows, Make's card area, the status line and the strip, the sign-in form and the dev panel all live inside the scrolling middle. A screen that fits still shows the tab bar at the bottom, as the empty Board does now.

## Painters and screens

Only `apps/web/app/globals.css` changes: the `.app`, `.app-main`, `.topbar` and `.tabbar` rules. The sign-in screen uses the same frame and gains the behaviour for free. The card itself is untouched.

## What follows

- SPEC.md's chrome table: the Top bar and Tab bar rows say they stay fixed while the screen's middle scrolls.
- On iOS Safari, `100dvh` tracks the browser's toolbars; older browsers fall back to `100vh`, declared first.

## Tests

- End-to-end, in `e2e/board.spec.ts`: sign in a fresh user at phone size, save enough cards for the rows to overflow the middle (ten saves of the five fixtures), then assert the page itself cannot scroll, the middle can, and after scrolling the middle the tab bar and top bar are where they were and the first tile has moved up.
- The existing suites prove nothing else moved.

## Out of scope

Pull-to-refresh, scroll position memory between screens, infinite loading beyond the first 500 cards.
