# One of One

A photo becomes a numbered Polaroid-style card. See `SPEC.md` for the product and `CLAUDE.md` for the rules and commands.

```
CLAUDE.md                 rules and commands Claude Code loads every session
SPEC.md                   the full build spec (source of truth)
docs/superpowers/         design specs and implementation plans, one per build step
packages/card/            the card renderer: layout, DOM painter, PNG painter, fonts, intros
packages/places/          place resolution: landmark and city data, the resolver, the provider interface
apps/web/                 the Next.js app: Board, Make, chrome
e2e/                      Playwright tests, including the screen-versus-print diff
dev-photos/               your own JPEGs for /dev/variation (git-ignored; create it when you want it)
prototype/one-of-one.html the original working Make screen, kept for reference
screens/                  fourteen HTML mockups, light and dark; open in a browser
```

## Run it

```
npm install
npx playwright install chromium
npm run dev            # http://localhost:3000
npm test               # unit tests
npm run test:e2e       # browser tests
```

Work the build order in SPEC.md one step at a time. Commit after each.
