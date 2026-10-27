# One of One — build spec for Claude Code

Oct 3, 2026 · @Alex

## What it is

One of One turns a photo into a numbered gallery card: the photo on a Polaroid-style white mat with the place and date on the wide bottom strip, read from the photo's own metadata, and a number counting the cards made at that place. Cards live on a personal board, can be grouped into storyboards and sent as a link, and can be ordered as physical prints. A human-curated city guide, read through other people's cards, lets anyone tap a restaurant or spot and get directions.

The card's layout and type never change, and nobody can edit them: no filters, fonts, stickers or layouts. Only the border varies (texture, finish, motion), and it is assigned from the photo's own facts, never chosen. The restraint is the brand; everything else in the product serves that one object.

What it is not: a photo editor, a social feed with likes or follows, or a check-in app. The public side is a human-curated city guide of places worth photographing or eating at, read through other people's cards. There is no map screen.

## The card

All dimensions are a percentage of the card's outer width (call it W), so the card scales identically from a phone screen to a 12-inch print. The reference is the Seoul card from the original mock, measured from the image.

| Element | Value |
| --- | --- |
| Frame | none. On screen, a 1px #e6e6e6 hairline on the light wall and a soft shadow (0 2% 7% of W, black at 14%) so the card reads as an object; nothing on the dark wall; nothing in the print file |
| Mat | white (#fff) under the border texture, 5% of W on top, left and right |
| Photo | 90% of W wide, native aspect ratio, never cropped, never filtered |
| Caption strip | 16% of W tall, below the photo, like a Polaroid's bottom border |
| Caption type | EB Garamond semibold (600), 3.0% of W, line height 1.2, color #111 |
| Caption position | hung under the photo: the first line's box starts 2.4% of W below the photo, the others stack directly beneath it, so a two-line caption sits where a three-line one does |
| Line 1 (left) | place, e.g. Seoul, South Korea |
| Line 2 (left) | date, e.g. July 1st, 2026 (full month, ordinal day, four-digit year) |
| Line 3 (left) | coordinates, e.g. 37.5563° N, 126.9236° E: four decimals, regular weight (400), color #333; omitted when the photo has no GPS |
| Number (right) | # plus the place count, on the last line's baseline, tabular figures |
| Text inset | 3% of W from the photo's left and right edges |

Rules:

- Portrait, landscape and square photos all work; only the card's height changes. The caption strip stays 16% of W.
- The place line truncates with an ellipsis at 72% of the photo width; it never wraps.
- Export renders at the photo's native resolution (cap 4800 px photo width) to PNG. 300 dpi at 12 inches needs a 3600 px photo, so the cap keeps iPhone and Fuji files full-size.
- Card background, mat and border variation are the only colors in the design system. The app around the card is a white wall in light mode and a black wall in dark mode; the card itself does not change between them.

## Card variation

Layout and type are fixed on every card; only the border varies, the way a trading-card set varies its frame and foil while the text stays put. The border is the whole mat: the white around the photo and the caption strip beneath it. Every texture covers all of it, and the photo is the one area nothing touches. The aim is that no two cards look alike, so the name is literal.

- What varies: border texture (paper grain, edge wear, foil gradient), a finish tier, and a small border motion on screen. The photo, caption font, sizes and positions never change, and the caption keeps a contrast floor: the darkest colour a texture can put under it stays at least 4.5:1 against the caption ink (#111) and 3:1 against the coordinates ink (#333). The preset palettes clear the floor as written; a palette sampled from a photo is lightened until it does. A test enforces it.
- Colour (decided Oct 26, 2026). Every card takes the photo's own colour, sampled from the pixels that touch the mat, as a light wash over the whole mat under the texture, strong enough to see at phone size and under the caption contrast floor. Warm and Cool are nudges of that colour, never colours of their own. The only fixed colours a design draws are the white mat, white light in the sheen, and the neutral grey a photo with no colour gets.
- Assigned, never chosen. Variation is derived from facts the app already has, so there is no customization UI and nothing to game by picking:
  - the sun's height at the photo's place and moment, from EXIF GPS, capture time and time zone, and the season in the photo's own hemisphere (a golden-hour photo gets a warmer colour; without GPS, the hour alone and no season)
  - camera or lens from EXIF (a Fuji body gets its own look)
  - number tier (low numbers earn foil or animated edges)
  - place type (restaurant, landmark, nature)
  - The one exception (decided Oct 24, 2026): the founders may restyle their own cards through a design panel, a database flag on their user row that only an operator sets; everyone else's cards keep the assigned design.
- Deterministic. The same photo always gets the same card: the variation is a function of the photo's own facts, the inputs above, and is re-derived when the number is assigned. The card id does not enter it (decided Oct 26, 2026).
- Procedural first. Textures are generated in code, seeded by a hash of the photo's facts (file size, pixel size, capture time, camera), with a small hand-made set for the rare tiers. No illustration pipeline per card.
- Facts first, chance later. For now every visible difference between two cards comes from the photo's facts, so a card's look says something true about its photo and cannot be rerolled by picking the photo again. Chance, a per-card seed that makes two cards of one photo or two near-identical photos differ, is a later priority (decided Oct 26, 2026).
- Tilt shine, next. After the type look (each card's colour and motifs read from the photo, being designed Oct 26, 2026), the next refinement is a foil shine that moves as the phone tilts, on screen only and never on prints. iPhone browsers ask permission before a page can read tilt, so the shine starts on a tap; reduced-motion users get none.
- Revealed by the intro. Rise, Develop and Flip are the moment you see what the card got.
- Print. Motion is screen-only. Every variation has a static version, and textures must hold up at print resolution so screen and print still match.
- Not for sale. No random packs and no paid variations.

## Metadata pipeline

The caption is pre-filled from EXIF and confirmed by the user, never silently wrong. Read DateTimeOriginal (fallback CreateDate, then file modification time) and GPSLatitude/GPSLongitude.

Place resolution runs top-down and stops at the first hit:

1. Venue: a named restaurant, café, shop or trailhead within about 75 m, from a places API. Caption reads "Zuni Café, San Francisco". The user confirms the match, since a neighbor can be closer than the place they photographed.
2. Landmark: within the landmark's radius (250 to 1500 m depending on size). Caption reads "Golden Gate Bridge, San Francisco".
3. Neighborhood: a named neighborhood from a reverse-geocoder (Mapbox, Google, or Nominatim). Caption reads "Marin, California" or "Hongdae, Seoul".
4. City: nearest city with population over 60,000, within 60 km. Caption reads "Seoul, South Korea" (US cities use the state: "San Francisco, California").
5. No match: the place line stays blank with the hint "Where was this?" until the user types a name; the coordinates line still carries the position, so the card never shows coordinates twice.

The prototype ships tiers 2, 4 and 5 offline (28 landmarks, 10,379 cities). Tiers 1 and 3 (venue and neighborhood) need a places or geocoding API; venue is the first backend call to add, because it powers directions.

When metadata is missing, the status line says why in plain words (screenshot, forwarded photo, location sync off) and the caption lines are editable in place. Fujifilm and other mirrorless bodies only carry GPS when the phone-sync app was running; their date is always present. RAW files (RAF, CR3, DNG) are not supported in the browser; the native app should accept them and extract the embedded JPEG preview plus EXIF.

The place a card belongs to is stored as a place id, not a string, so renaming a place or merging two never breaks counts.

A venue place also stores its own public coordinates, and those, not the photo's EXIF, are what the directions handoff uses.

The coordinates line shows the photo's real EXIF position on the owner's own card and prints. On a public card it is rendered from what the card already exposes: the venue's public coordinates when the card is matched to a venue, otherwise the derived point at the precision chosen at share time (the place centroid for Area or City). The line never leaks more than the map pin does.

## Numbering

The number on a card is its position in the sequence of public cards at that place, assigned the moment the card goes public. Private cards show no number until shared, so drafts and tests never inflate a place.

- One number per card. A second Seoul card by the same person gets the next number, not a repeat; the count is of cards, not people.
- The count is per place id in the hierarchy above, so #1 at the Golden Gate Bridge and #1 in San Francisco are different numbers.
- Numbers are never reissued. Deleting a card leaves a gap.
- Assignment is a single atomic increment on the place record (a transaction or a Postgres sequence per place), never computed client-side.
- Early numbers are the growth hook: seeding a city with friends hands them the low numbers, which they have a reason to tell people about. Low numbers also earn the rarer border finishes (see Card variation).

The prototype counts locally in the browser per place label; the real count lives on the server.

## Screens

Seven screens and a sign-in screen, icon-only navigation. The tab bar has three slots: Board, an empty middle slot, Make. Guide takes the middle slot in phase two. Sketches are in `screens/` (open any file in a browser; light and dark versions of each of the seven). Each screen links to the next.

| Screen | What it does | Notes for the build |
| --- | --- | --- |
| 1 Make | Pick a photo, see the card fill itself, then the assigned intro reveals its border; a three-cell strip: replay intro, add to board (filled), print | Empty state is the blank mat with "Tap to add a photo". The number slot stays blank until the card is public. Caption lines edit in place. No intro picker: the intro is assigned with the variation, and replay plays the same one again. Add to board saves the card to your board, private and unnumbered, and returns to the Board (decided Oct 22, 2026). Top bar: 1/1 mark left, × to cancel right. |
| 2 Add to board | Sheet over the opened card: place and the number you will get; a pin-icon strip for precision (Area default, City), always shown, venue cards included; one filled button with the grid-plus icon | The only place the number is assigned, and the step that makes a card public. Opens from the opened card's strip, not from Make (decided Oct 22, 2026; the mockup still draws it over Make). No guide tag in v1; the sheet only numbers the card. Area means neighborhood. |
| 3 Board | Your own cards as rows of whole photos: each row packs as many as fit at a base height and is rescaled to run margin to margin, so row heights vary and nothing is cropped; 2px gutters in the wall colour, no mats or captions; storyboards reachable from here; card count in the top bar | Tap opens the full card (mat, caption, number, border) with the same action strip as Make and a Back arrow in the top bar. Newest first, left to right then down. The space left at the end of the last row shows the 1/1 mark in one of six designs (fraction, diagonal, wordmark, stacked, pattern, cropped), which flick through on open and land on a random one (decided Oct 22, 2026). |
| 4 Storyboard | An ordered set of your own cards with a title, in the same rows of whole photos; drag to reorder; a two-cell strip: add cards, copy share link (filled) | Own cards only in v1. The link opens without an account and is not listed anywhere. ← returns to Board. |
| 5 Shared card | What a friend sees from a link: the full card, then a one-row strip with the venue name and a navigation arrow that opens Apple Maps on iOS and Google Maps elsewhere | No account, no tab bar; the link previews as the card image. Directions use the venue's public coordinates; cards without a venue show the strip with no arrow. |
| 6 Print | Card preview, size strip (5 × 7, 8 × 10, 11 × 14), paper strip (Matte, Luster), border strip (Plain, Border), price, filled bag button | Print file is the export PNG at native resolution; the mat is part of the print. Border prints the card's static border texture; Plain prints the white mat only. ← goes back. |
| 7 Guide (phase two) | A city's human-curated picks: a single column of full cards, each with a strip beneath carrying the venue name and the directions arrow; city name in the top bar; the pin icon fills the middle tab slot | A curator picks from public cards in the city. Cards not picked never appear and are never marked. No likes, follows or ranking by popularity. |

The sketches match this table as of Oct 21, 2026, except the Board, which became rows of whole photos on Oct 22, 2026, and the sheet, which moved to the opened card.

Sign-in: the app opens on a sign-in screen and nothing else shows until you are in. One field for the email, a six-digit code sent to it and typed back, no passwords. The code rather than a tapped link, because a link opens in whatever browser the mail app launches. Google and Apple sign-in can be added later; the account stays the email.

### Chrome design system

Hairlines, a grotesk in small capitals, and thin-line icons; the card is the only object with any weight.

| Token | Value |
| --- | --- |
| Ground | #ffffff light, #000000 dark |
| Ink | #000000 light, #ffffff dark |
| Muted | #6b6b6b light, #8d8d8d dark; counts and inactive tabs |
| Rules | 1px solid ink: under the top bar, over the tab bar, around and inside strips, on sheet tops |
| Chrome type | Archivo 500 (fallback Helvetica Neue, Helvetica, Arial); 11px uppercase with 0.12em letter-spacing for strip and bar text; 13px uppercase 0.1em for place names; 30px regular for the number on the sheet |
| Icons | inline SVG on a 24 viewBox drawn at 22px, 1.5px stroke, round caps, ink color, aria-label on every icon-only control. Set: grid, pin, plus, ×, ←, replay, grid-plus, printer, bag, navigation arrow, link (fork and knife, car and street return with guide tags in phase two) |
| Strips | equal cells inside a 1px rule with 1px dividers, 44px tall; the selected cell fills with ink and its content inverts |
| Buttons | 48 to 52px tall, square corners; primary fills with ink, secondary is a 1px rule |
| Top bar | 48px, 1/1 wordmark at 13px left, one 44px icon target right; fixed at the top of the screen while the screen's middle scrolls |
| Tab bar | 84px with a 1px top rule; three 48 × 44px slots: grid, an empty slot, plus (the pin icon fills the middle slot as Guide in phase two); active in ink with a 1px underline, inactive muted; fixed at the bottom of the screen while the screen's middle scrolls (decided Oct 22, 2026) |
| Rows | whole photos at a base height of clamp(120px, 36vw, 240px), packed as many to a row as fit and rescaled to the margins, 2px gutters in the ground colour, no borders; the last row stays left-aligned at the base height. Nothing is cropped. Storyboards use the same rows |
| Fields | 48px tall, 1px rule, chrome type, the label above in strip text style; used on the sign-in screen |
| Card | unchanged in both themes: Polaroid-style white mat, no frame, EB Garamond 600 caption on the bottom strip, plus the derived border variation |

Icons first, words where an icon would be ambiguous. Words in the chrome so far: place and venue names, numbers, size, paper and border values (Plain / Border), Area / City, storyboard titles. Add a word rather than a cryptic icon; keep it to one or two, uppercase, in the strip style.

## Data model

Seven tables carry the product. Counts and guide listings are derived from cards, places and curator picks.

| Table | Fields | Notes |
| --- | --- | --- |
| users | id, handle, created\_at | No profiles, bios or follows in v1. |
| places | id, kind (venue, landmark, neighborhood, city), name, region, lat, lng, radius\_m, parent\_id, card\_count, provider\_ref | Hierarchy via parent\_id (venue or landmark → neighborhood → city). A venue's lat and lng are its own public coordinates, used for directions. card\_count is the counter the card number comes from. |
| cards | id, user\_id, place\_id, original\_path, rendition\_path, thumb\_path, photo\_w, photo\_h, taken\_at, date\_source, caption\_place, caption\_date, caption\_coords, exif\_lat, exif\_lng, camera, precision (city, neighborhood), number, variation (texture, tone, palette, tier, motion), intro, variation\_seed, share\_token, is\_public, created\_at, published\_at | caption\_\* are the strings as shown, editable. number is null until is\_public. exif\_lat/lng are never served to other users; directions use the venue's coordinates, never the card's. variation and intro are derived from EXIF, place type and number tier, and re-derived when the number is assigned; users cannot edit them. guide\_tag arrives in phase two. |
| prints | id, card\_id, user\_id, size, paper, border (plain, border), vendor\_order\_id, status, price\_cents, created\_at | status follows the vendor: created, submitted, printed, shipped, delivered. |
| storyboards | id, user\_id, title, share\_token, created\_at | Own cards only in v1. Shared by link, listed nowhere. |
| storyboard\_cards | storyboard\_id, card\_id, position | A card can sit in several storyboards. |
| guide\_picks | id, card\_id, city\_place\_id, curator\_id, position, picked\_at | A curator's pick for a city's guide. No pick, no listing; unpicked cards carry no status. Phase two. |

Storage: original photo in object storage (private), plus a 2048 px rendition and a 512 px thumbnail, both re-encoded by the owner's phone without EXIF when the card is saved, private until the card is public. The card PNG for link previews is drawn by the owner's phone from step 6 whenever the card's content changes (numbered, precision changed) and stored at preview size; prints are drawn from the original at order time, since a full-resolution PNG runs to tens of megabytes. Nothing is rendered on the server.

The card number is a single transaction: insert the card as public, increment places.card\_count, write the resulting value to cards.number.

## Intro animations

Each card is assigned one intro, the way its border is, and plays it when first revealed and whenever the user taps replay. There is no picker. Intros are a registry, so a new one is a data entry plus one stylesheet, never a code change to the card.

```markdown
INTROS = [
  { id: "rise",    label: "Rise",    numberAt: 1700, total: 2300 },
  { id: "develop", label: "Develop", numberAt: 2300, total: 3000 },
  { id: "flip",    label: "Flip",    numberAt: 1500, total: 2000 }
]
```

- The intro only moves the frame, the photo's reveal and the caption's opacity. It never changes the card's layout, colors or type; it is where the border variation is first revealed.
- numberAt is when the count-up starts; total is when the card is fully settled and controls are enabled.
- The intro is derived from the same seed as the variation and stored on the card, so it never changes. New intros ship on a cadence (one every few weeks) and only cards made after a release can receive them.
- Reduced-motion users get the final frame with no animation.

Shipped so far: Rise (card lifts from below, photo wipes up, caption fades in), Develop (photo resolves from white like a developing print) and Flip (the card starts face down, a blank white back, and turns over on its vertical axis to reveal the front; built with a 3D flip, a back face pseudo-element and backface-visibility hidden on the front).

## Print service

Use a print-on-demand vendor with an API rather than printing in-house: the order is a PNG, a size and a paper, and the vendor handles paper stock, fulfilment and shipping. Candidates with public APIs: Prodigi, Printful, Gelato. Pick on three things: print-quality matte stock, a borderless option, and per-order pricing that leaves margin at the 8×10 price point.

MVP flow:

1. User picks size and paper on the Print screen; the app renders the card PNG at native resolution and uploads it.
2. The server creates a vendor order with the PNG, the size, the paper and the shipping address, and stores the vendor order id on the prints row.
3. Vendor webhooks update prints.status; the user sees the status on the card.

Sizes follow the photo's aspect ratio; the mat is printed, not added by the vendor, so the print looks exactly like the screen. The border variation is optional on prints: the Print screen's Plain / Border strip chooses between the white mat alone and the card's static border texture; animation is screen-only. Offer three sizes at launch and add framing only once prints have demand.

## Privacy rules

A public card can reveal where someone lives, parks or shoots, so location precision is a per-card choice made at share time, never a global setting applied silently.

- Private cards keep exact EXIF coordinates and are visible only to their owner.
- Public cards default to neighborhood precision; City is an explicit choice on the Add to board sheet, offered on every card, venue matches included. A card matched to a venue shows the venue name at Area precision and the city alone at City precision.
- The API never returns exif\_lat/exif\_lng for another user's card. Directions use the matched venue's own public coordinates.
- Exact pins for non-venue spots (a car spot is a specific curb) are out of scope for v1: the map is gone, and venue cards hand off to the venue's own location.
- Public renditions are re-encoded without EXIF. The original with full metadata stays private.
- Changing a card's precision after sharing is allowed and re-derives the public place line; it never changes the number.

## Guide (phase two)

The public side is a human-curated guide per city, not a feed. A curator who knows the city picks cards of restaurants and spots worth the trip; a pick shows the card, the venue name, the number and the directions arrow.

- A card is public once it has a number. Public cards are not browsable by strangers except as guide picks or through a link.
- In v1 there is no guide tag; every public card in a city is visible to its curator. Phase two adds a tag strip on the Add to board sheet (restaurants, car spots, street) so people can flag what a card is for, still with no separate submit step.
- A card that is not picked never shows a status; it simply does not appear. Nothing says "not featured".
- No likes, follows, ratings or popularity ranking. The order is the curator's.
- Start with one or two cities where you or a friend with real local knowledge curate. The curator has to know the places, because a photo cannot show whether the food is good.
- The Board is visible only to its owner; storyboards and single cards are shared only by link.

## Build order

Suggested stack: a Next.js (or Expo, if native from day one) front end, Postgres with PostGIS for places and cards, object storage for photos, exifr for EXIF in the browser, a places and geocoding API (Mapbox or Google) for venue and neighborhood lookup. Keep the card renderer as one pure function (card spec in, PNG out) shared by the app and the print pipeline.

1. Card renderer as a package: takes a photo, place string, date string, number and variation; returns the on-screen card and the static print PNG. Port the prototype's canvas export and make screen and print match: one layout function feeds both painters, and a screenshot diff test with a small tolerance for text anti-aliasing proves it.
2. Variation system: deterministic derivation from EXIF, place type and number tier; procedural textures seeded by the photo's facts; border motion on screen only; a static version of every variation for print.
3. Make screen with the metadata pipeline: EXIF read, place resolution (landmarks and cities offline; venues and neighborhoods via a places API), editable caption, three intros assigned by seed.
4. Accounts and the private board: upload, store, the 3-across grid of square crops, open a card.
5. Add to board: precision choice, atomic numbering on a places table. This is the first moment the number exists.
6. Storyboards and share links: ordered sets of your own cards, a link that opens without an account, and the directions arrow handing off to Apple Maps or Google Maps for venue cards.
7. Prints: vendor integration, order and status.
8. Guide (phase two): curator tooling, the guide\_picks table and the Guide tab, once one or two cities have a local curator.

Seeding: before step 8 ships, you and friends share cards in one or two cities so the guide opens with enough to pick from and the low numbers are taken by people who will talk about them.

## Existing prototype

`prototype/one-of-one.html` is a single self-contained page (416 KB, most of it the city list) that already does the Make screen end to end: photo picker, EXIF read with exifr 7.1.3, place resolution against 28 landmarks and 10,379 cities, caption formatting, local per-place numbering, three intros, and a canvas export of the card at native resolution. Drop it next to this spec; Claude Code should read it before building step 1. Its own UI (Garamond chrome, status line, text buttons) predates the icon direction in Screens: port the card, the pipeline and the export, not the page around them.

What carries over as-is:

- The card geometry and type: no frame, 5cqw mat, 19.2cqw caption strip with the caption bottom-aligned 3.6cqw up, 3.4cqw EB Garamond 600, 3cqw text inset. Container-query units mean the card is one CSS block at any size.
- `renderPrint()`: the canvas export. Same numbers in px per 1% of width, so screen and print match.
- `placeFor()`: the landmark-then-city lookup and the coordinate fallback, plus the `LANDMARKS` and `CITIES` data.
- `fmtDate()`: the "July 1st, 2026" format.
- The `INTROS` registry and its CSS classes.

What gets replaced:

- `nextNumber()` counts in localStorage; the server owns numbering.
- No accounts, board, storyboards, share links or prints; the page is the Make screen only.
- Venue and neighborhood places need a places API; the prototype skips those tiers.
- The prototype has an intro picker (Rise / Develop / Flip), kept as a way to preview each intro; the product assigns one per card.
- The downloads call is specific to the claude.ai artifact host; a normal app saves or shares the PNG directly.

## Open decisions

- [x] Web app first or native first? Decided Oct 21, 2026: web first. Native reads RAW previews and full EXIF from the camera roll, but web ships faster and already works; a native app can reuse the renderer package later.
- [x] What "add to board" means for a card the user wants to keep private. Decided Oct 22, 2026: Add to board on Make saves the card privately and unnumbered; the sheet that numbers it and makes it public opens from the opened card.
- [ ] Guide tags (phase two): a fixed list (Restaurants, Car spots, Street) or free text with curation? Car spots and Street have no venue to hand off directions to.
- [ ] Variation: which EXIF and place inputs map to which tiers, and how rare the top tier is. Settle after generating textures for about 50 real photos.
- [ ] Variation by chance (later priority): whether a per-card seed should vary the border's details once the photo's facts carry the visible differences, and how to keep picking a photo again from rerolling its look.
- [ ] Guide curators: who curates the first one or two cities.
- [ ] Places data: check what the places provider's terms let you store as venue records.
- [ ] Print vendor: pick after ordering one test print, with a static border texture, from two candidates.
- [ ] Name conflict check on "One of One" before the app store listing; "1/1" is also common edition jargon in art and NFT circles, so check the mark too.

Decided Oct 21, 2026: the map is gone and Guide takes its tab slot in phase two; the board stays a 3-across grid of square crops, the only cropped view in the product; precision is Area / City on every card, no Exact; the intro is assigned, not picked; no guide tag in v1; each public card gets the next number, even a second card by the same person; a photo that matches nothing gets a blank place line with a hint; the border variation is an option on prints (Plain / Border); directions open the platform's maps app; web first, with the card renderer as a standalone package a native app can reuse; the owner's phone draws the card PNG and the server stores it, with no server rendering.

Decided Oct 22, 2026: the border covers the whole mat, the white around the photo and the caption strip, and never the photo. Until then foil, wear and the sheen sat on a band two units wide at the card's edge, which was invisible at phone size. "Caption contrast is never reduced" became the contrast floor in Card variation. Also decided Oct 22, 2026: Supabase (hosted free tier, the same open-source stack as the exit) carries accounts, Postgres and photo storage; sign-in comes first, by email and a six-digit code; Add to board saves privately and the number comes later from the opened card; the Board is rows of whole photos packed to fit and rescaled to the margins, so nothing in the product crops a photo; the card id is made at pick time and seeds the variation; prints come last in the build order. Later on Oct 22, 2026, after comparing five renders: the caption is smaller (3.0% of W, line height 1.2) and hangs under the photo (first line 2.4% of W below it) on a 16% strip, replacing the 3.4% type resting 3.6% above the bottom edge of a 19.2% strip.

Decided Oct 26, 2026: the variation is derived from the photo's facts alone. The card id no longer seeds it, replacing the Oct 22 decision that it does, so the same photo always gets the same card and picking it again cannot reroll the look. Chance, a per-card seed that varies the border so two cards of one photo differ, is a later priority. Cards already saved keep the design they were saved with.
