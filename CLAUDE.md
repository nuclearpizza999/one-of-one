# One of One

A photo becomes a numbered Polaroid-style card: place, date and coordinates read from EXIF, a number counting the public cards made at that place. Private board, storyboards shared by link, prints. No feed, no likes, no editing of the card.

Read `SPEC.md` before any design or architecture decision. It is the source of truth; this file only carries the rules that must hold in every session.

## Reference material

- `SPEC.md`: product, card geometry, variation, metadata pipeline, numbering, screens, data model, privacy, build order, open decisions.
- `prototype/one-of-one.html`: working Make screen. Port the card CSS, `renderPrint()`, `placeFor()`, `fmtDate()`, `fmtCoords()` and the `INTROS` registry. Do not port its page chrome or its intro picker.
- `screens/`: fourteen HTML mockups (seven screens, light and dark). Open them in a browser for layout, spacing and icons. They match SPEC.md as of Oct 21, 2026.

## Rules that never bend

- The card's layout and type are immutable. No filters, fonts, stickers, layouts or user-chosen borders. Only the derived border variation and intro differ between cards, and users never pick them.
- Card dimensions are percentages of card width (see the table in SPEC.md). Screen and print render from one shared function and must be pixel-equivalent.
- The photo is cropped in exactly one place: the square thumbnails on the Board and Storyboard grids. Everywhere else it is shown whole.
- The card number is assigned server-side in one transaction when a card goes public: one per card, next in sequence for that place, never reissued, never computed on the client.
- Another user's EXIF coordinates are never served by the API. Public cards expose only the venue's public coordinates or a place centroid, at Area or City precision.
- Chrome is icons first; words only where an icon would be ambiguous (place and venue names, numbers, size, paper, Plain / Border, Area / City, storyboard titles). Every icon-only control has an aria-label.
- The tab bar has three slots: Board, empty, Make. The middle slot is reserved for Guide in phase two. There is no map.

## Stack (suggested in SPEC.md; confirm before scaffolding)

Next.js app, Postgres with PostGIS, object storage for photos, `exifr` for EXIF in the browser, a places and geocoding API for venue and neighborhood lookup.

## Conventions

- Keep the card renderer as a standalone package with no app imports, so the print pipeline can call it.
- Fonts: EB Garamond 600 for the card caption only (400 for the coordinates line); Archivo 500 for app chrome.
- Light and dark themes change the wall and chrome only; the card is identical in both.
- Prefer a short status line in plain words over modal errors when metadata is missing.

## Build and test commands

Add these once the project is scaffolded, then run `/init` to let Claude Code fill in what it discovers.
