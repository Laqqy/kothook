# KOTH dapp — Design Redesign

**Date:** 2026-05-15
**Scope:** Full visual overhaul of the dapp (`/`, `/throne-room`, `/chronicle`)
**Tonal anchor:** Gothic Illuminated Manuscript

## Motivation

The current dapp is technically sound but visually restrained — dark ink + bronze
+ gold-pale + a humanist serif (Newsreader). The user feedback was: *"скучно и
неинтересно, без вайба KOTH и рыцарей и средневековья."* The mechanics already
evoke a medieval throne game; the surface does not match.

We're not adding a feature. We're swapping the foundational aesthetic so the
surface telegraphs the same fantasy the smart contracts encode.

## What's wrong with the current look (carry-forward problems)

These came out of brainstorming and stay binding:

1. **Contrast / readability.** Stone-on-vellum gets close to WCAG AA but body
   text (`text-stone`, `text-stone-soft`) sits below 4.5:1 on `bg-ink`. Acceptable
   for hero metadata, not for the swap widget or the chronicle.
2. **`Abdicate` is dangerously casual.** It uses the same shape and weight as
   `Acquire`. Selling can drop you out of the throne; the UI should not let that
   happen as a casual mis-click.
3. **Decay bar is too subtle.** The gold gradient looks ambient, not urgent. A
   reign losing its head should feel like one.
4. **`Forfeit Writ` naming is opaque.** Throne-Room "Option B" landed on showing
   claimed + unclaimed reigns; the unclaimed action needs a name that says what
   it does in two words.
5. **Mobile.** Hero `text-[7rem]` overflows below ~420px. Swap widget needs a
   single-column variant.

## Tonal direction

**Gothic illuminated manuscript** — the inside of a medieval codex, not the
outside of a cathedral. Concretely:

| Element              | Anchor                                                       |
|----------------------|--------------------------------------------------------------|
| Background           | Warm midnight ink with slight blue undertone (`#0c0a18`)     |
| Cards / panels       | Dark vellum (`#181226`) with gold filigree frame             |
| Headings (display)   | **Cinzel** — carved Roman caps, stately, evokes inscription  |
| Body / serif         | **EB Garamond** — warm humanist, reads like a printed codex  |
| Mono / data          | JetBrains Mono (keep)                                        |
| Primary accent       | Gold leaf — richer than current `#f5a524`, slightly orange   |
| Cool accent          | Lapis blue (`#1a3a8a` → bright `#4a6cc7`) — manuscript blue  |
| Danger               | Vermilion / wax red (`#c1272d` → bright `#e63946`)           |
| Parchment text       | Warm cream (`#f0e2bf`)                                       |

Rejected directions and why:
- *Dark Souls grimdark*: too edgy, mismatches the playful "Royal Decree" tone.
- *Heraldic/tournament*: clashes with the ledger/parchment metaphor.
- *Fairytale*: undermines the on-chain seriousness; this is a game where you can
  lose ETH.

## Section-by-section changes

### Global (`globals.css`, `layout.tsx`)

- New `@theme` palette: introduce `--color-lapis`, `--color-lapis-bright`,
  `--color-vermilion`, `--color-vermilion-bright`, `--color-gold-leaf`,
  `--color-parchment-cream`. Keep names that work (`ink`, `parchment`, `gold`)
  but retune values.
- Replace Newsreader + Manrope in `layout.tsx` with **Cinzel** (`--font-cinzel`)
  + **EB Garamond** (`--font-garamond`). Keep `--font-jetbrains` for mono.
- Update `--font-display` → Cinzel, `--font-body` → Garamond.
- New utility classes:
  - `.illuminated` — drop-cap style for the first letter of a section title
  - `.vellum-card` — dark-vellum surface with gold filigree border (uses
    SVG-data-URI background for the corner ornament)
  - `.wax-seal` — vermilion gradient circle with raised border (used as the
    confirmation token for Abdicate)
- Keep existing animations (`reveal`, `reveal-ink`, `reveal-stamp`, `throb`,
  `drain-pulse`, `marquee`).

### Ornaments (`_components/ornaments.tsx`)

- Replace simple corner bracket in `CornerOrnament` with a real filigree
  flourish (4-point with scroll terminations).
- Add `WaxSeal({ char })` — a vermilion circle with the king's reign Roman
  numeral pressed into it. Used inline next to confirmed coronations and as the
  Abdicate confirmation step.
- Add `Initial({ char })` — illuminated drop cap, framed in a lapis square with
  gold leaf interior and a small fleur-de-lis flourish behind the letter.
- Beef up `Crown`: add internal jewel cross-hatch + base coronet band.

### Hero (`_components/hero.tsx`)

- Headline gets an **Initial drop cap** on the first letter of the reign-word
  (or "T" of "Throne Vacant" when empty).
- "Engraved into stone" address tablet → "Inscribed in the codex": vellum-card
  surface, lapis border, gold-leaf shimmer on the address. Keep the copy button
  (move to wax-seal style).
- **Decay bar** becomes alarming:
  - Color: `vermilion → flame → gold` (flames rising as time depletes — left to
    right is fuel remaining)
  - When < 25% remains: pulse becomes faster (`drain-pulse-urgent`) and bar
    width adds a flicker via `box-shadow`
  - Add a `Hourglass` icon next to the time readout
- Stat strip: switch from 2 cards in a bronze grid → 2 vellum cards with lapis
  divider between them. Numbers in Cinzel.

### Swap Widget (`_components/swap-widget.tsx`)

- **Tabs**: keep two-state (Acquire / Abdicate) but make the visual contrast
  loud. Acquire = gold-leaf border when active. Abdicate = vermilion-edge.
- **Acquire flow** unchanged structurally. Coronation button gains a brighter
  glow (`box-shadow: 0 0 0 1px gold, 0 0 32px gold/0.5`) and a small wax-seal
  badge "*will crown thee*" when `willCrown && !needsApprove`.
- **Abdicate flow** gets a confirmation interstitial when the seller is the
  reigning king (selling will dethrone):
  - Replace the single button with a two-step pattern:
    `[Renounce the Crown]` → reveals a `wax-seal` confirmation card with a
    `[Hold the wax to seal]` press-and-hold button (700ms).
  - Press-and-hold prevents fat-finger dethrones, and physicalises the wax-seal
    metaphor.
- **`Forfeit Writ`** → renamed to **`Reclaim Lost Tribute`** everywhere in
  copy + a hover tooltip explaining the 1-hour timer.

### Throne Room

- Reign cards become vellum-cards with a wax-seal showing reign №.
- Claimed reigns: faded (opacity 60%), wax seal greyed-out.
- Unclaimed reigns: full color, vermilion `Reclaim Lost Tribute` button on
  bottom edge of the card.

### Chronicle

- Active reign ("Living Crown") gets a large illuminated-initial treatment.
- "The Fallen" grid: each reign is a folio — gold filigree border, wax seal
  with reign number, NFT pair rendered inline in the lower half.
- Reason badge becomes a small vermilion wax stamp.

## Accessibility + mobile

- All text on `bg-ink` audited for ≥ 4.5:1 contrast. `text-stone` raised from
  `#847a6e` to `#9c9082` to clear the bar.
- Tap targets ≥ 44px (currently `MAX` button is 22px tall — bump).
- Hero `<h1>`: shift from `text-7xl md:text-8xl lg:text-[7rem]` to
  `text-5xl sm:text-6xl md:text-7xl lg:text-8xl` so 360px viewport is safe.
- Swap widget: at `< 640px`, drop the two-column layout (Hero + Widget) to
  stacked.

## Non-goals

- New mechanics. Smart contracts unchanged.
- New routes. `/`, `/throne-room`, `/chronicle` only.
- Animation overhaul. Existing reveal/throb/drain stay; we add `drain-pulse-urgent`.
- Component library migration. Still vanilla Tailwind + small ornament set.

## Risks

- **Cinzel** at small sizes can look thin and lose legibility — body must stay
  Garamond, Cinzel only for headers ≥ 16px.
- **Gold leaf** can read as "yellow text" on bad monitors — gradient + shimmer
  saves it, never solid `text-gold` on `bg-ink` for body text.
- Vermilion for Abdicate is high-stakes — the press-and-hold gate exists
  precisely to slow down the obvious "red = scary, click harder" reaction.

## Open questions deliberately deferred

- Burn / Pyre infographics page — separate redesign pass after this lands.
- Theme toggle (light parchment mode) — not in this scope.
- Custom font hosting (currently using Google Fonts via Next.js font loader) —
  fine for now.

## Acceptance

- All three primary routes render cleanly on desktop + mobile (360 / 768 / 1280).
- Decay bar visibly different at &gt; 50%, 25–50%, &lt; 25% remaining.
- Abdicate-while-king cannot fire from a single click.
- Contrast checker (WebAIM) passes AA for every text/background pair on the
  rendered page.
- `bun --filter dapp run lint` clean.
- `bun --filter dapp run typecheck` clean (or `tsc -p dapp/tsconfig.json --noEmit`).
