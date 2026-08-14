# Handoff: Bill Payment Tracker — "Cockpit" redesign

## Overview
A redesign of the existing single-page Bill Payment Tracker (repo `shiblee86/BillPay` — `index.html` + `style.css` + `app.js`). Same job: track monthly bills against a checking balance with a hard $900 minimum floor. The redesign reorganizes the page into a persistent left rail (accounts, projected balance, savings, category pie, year strip) beside a working bill list, and fixes three problems the owner reported:

1. **Bill names had to be retyped each month.** Names are now free-text fields that persist; starting a new month clears amounts, confirmation numbers and checkmarks only.
2. **A bill with a name but no amount blocked the savings figure.** Savings is now computed continuously as `balance − bills still owed − $900 floor`, and bills with no amount are excluded from every total (shown with an amber "Amount needed" chip).
3. **Paid bills stayed in place.** Ticking a bill moves it into a Paid section at the bottom; unticking moves it back.

## About the design files
`Bill Tracker - Cockpit.dc.html` and `Bill Tracker - Current.dc.html` are **design references written as HTML prototypes**, not production code to paste in. They render standalone in a browser (they load a small runtime, `support.js`, plus Google Fonts). Recreate them in the target environment — the existing app is vanilla HTML/CSS/JS, so the natural target is the same: `index.html` + `style.css` + `app.js`, keeping the existing state shape, localStorage keys and helper functions. Do not port the prototype's runtime.

- `Bill Tracker - Current.dc.html` — faithful recreation of the app as it exists today (dark theme, list view). Use it as the "before" reference.
- `Bill Tracker - Cockpit.dc.html` — the target design, interactive: pay/unpay, live totals, floor guard.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and shadows are exact and are taken from the app's own `DARK` theme object in `app.js`. Recreate pixel-perfectly.

## Screens / Views

### 1. Main screen (only screen)
**Purpose:** see the balance, tick off bills, know how much can move to savings.

**Layout**
- Page: `background #0A1F1F`, `color #F4FBFB`, `font-family 'Nunito Sans'`, padding `28px 32px 64px`.
- Content: `max-width 1360px`, centered, `display grid`, `grid-template-columns 340px 1fr`, `gap 26px`, `align-items start`.
- Left column: `display flex; flex-direction column; gap 16px`.

**Left rail, top to bottom**
1. **Title + theme toggle.** Title "Bill Payment / Tracker" (two lines, `<br>`), Lilita One `1.5rem`, `#17C7C7`, `letter-spacing .5px`, `line-height 1.1`. Toggle: 48×48 circle, `border 2px solid #275C5C`, `background #123636`, sun glyph `☀️` `1.2rem`.
2. **Accounts card.** `background #0D2828`, `border 2px solid #275C5C`, `radius 16px`, `padding 16px`. Label "ACCOUNTS": `.72rem`, weight 800, `letter-spacing .06em`, uppercase, `#6E8C8C`, margin-bottom 10px. Three rows, `gap 8px`, `radius 10px`, `padding 11px 13px`, `font-size .92rem`: active account = `background #17C7C7`, `color #0A1F1F`, weight 800; others = `background #123636`, `color #A9C4C4`, weight 700. Content: Checking $3,455 / Savings $8,200 / Joint $640.
3. **Move to savings card (the emphasis element).** `background #2FE6A7`, `radius 20px`, `padding 22px`, `box-shadow 0 6px 0 #17A97A`. Ink color `#062119` throughout. Label uppercase `.8rem`/800. Figure: Lilita One `3.2rem`, `line-height 1.05`. Sub: `.88rem`/700 at `opacity .75` — "Live figure — no need to finish paying first." Breakdown list (`.8rem`/700, rows at `opacity .72`): Balance now / Bills still owed (−) / Minimum floor (− $900) / **Free to move** (top border `2px solid rgba(6,33,25,0.2)`, `.92rem`, full opacity). Button: full width, `background #062119`, `color #2FE6A7`, `radius 12px`, `padding 13px`, weight 800 — label "Transfer $645 to savings"; when savings is 0 it reads "Transfer unavailable" with `background rgba(6,33,25,0.25)`, `color rgba(6,33,25,0.55)`. Footnote `.76rem`/700 at `opacity .7`: "2 bills have no amount yet — not included."
4. **After every bill card.** Same card chrome as Accounts. Figure Lilita One `2rem`. Meter: 10px track `#123636`, radius 999, fill `#17C7C7` at `savings / projected`. Note `.84rem`/700 `#2FE6A7`: "$645 above your $900 floor".
5. **Where the month goes (pie).** Donut: 180×180, `border-radius 50%`, `background conic-gradient(from -90deg, <slice stops>)`; inner hole `position absolute; inset 42px; border-radius 50%; background #0D2828` containing total (Lilita One `1.35rem`) over "THIS MONTH" (`.68rem`/700, uppercase, `#6E8C8C`). Legend rows `.82rem`/700 `#A9C4C4`, `gap 9px`: 10×10 swatch (`radius 3px`), name (ellipsis), amount `#F4FBFB`, percent right-aligned 34px `#6E8C8C`. Slice colors: Credit cards `#2FE6A7`, Housing `#17C7C7`, Savings `#FFB020`, Shopping `#FF5C3D`, Insurance `#D68A00`. Slices are computed from bills that have an amount; zero-value categories are dropped.
6. **2026 so far.** 76px-tall flex row of columns, `gap 5px`; bar `width 100%`, `radius 4px 4px 0 0`, current month `#17C7C7`, past months `#275C5C`; label `.62rem`/700 `#6E8C8C`. Caption `.78rem` `#6E8C8C`.

**Main column**
- **Header row** (`align-items flex-end`, `justify-content space-between`, margin-bottom 18px): "August 2026" Lilita One `1.8rem` `#F4FBFB`; sub `.9rem` `#A9C4C4` — "9 of 11 bills have amounts · 2 paid · next due Aug 15". Right side: segmented control (`background #123636`, `padding 4px`, `radius 12px`, `border 2px solid #275C5C`; buttons `padding 7px 15px`, `radius 9px`, `.85rem`; active `background #17C7C7`, `color #0A1F1F`, weight 800; inactive transparent `#A9C4C4`) with List / Calendar / Year; then "⤓ Export CSV" ghost button (`background #123636`, `border 2px solid #275C5C`, `radius 12px`, `padding 9px 16px`, `.88rem`/700); then "+ Add bill" (`background #FF5C3D`, `color #2A0F08`, `radius 12px`, `padding 11px 18px`, weight 800, `box-shadow 0 5px 0 #E6432E`).
- **Search + filter row** (`gap 10px`, margin-bottom 20px): text input flex 1, `padding 11px 14px`, `border 2px solid #275C5C`, `radius 10px`, `background #0D2828`, placeholder "Search bills..."; select with options All bills / Unpaid / Paid / Overdue / Due soon (≤3 days) / No amount yet.
- **Floor-stop notice** (only after a blocked attempt): `background #0D2828`, `border 2px solid #FF3B3B`, `radius 14px`, `padding 14px 18px`, `gap 14px`; 🛑 at `1.5rem`; title "Stopped at your floor" Lilita One `1.1rem` `#FF3B3B`; line `.88rem` `#F4FBFB` — "Paying Credit Card G ($500.00) would leave $780.00 — under your $900 floor. Left unpaid."; dismiss button `background #F4FBFB`, `color #0A1F1F`, `radius 999px`, `padding 9px 20px`, weight 800, label "I understand".
- **Unpaid group header:** "UNPAID" `.78rem`/800, `letter-spacing .06em`, `#FF5C3D`; beside it `.8rem`/700 `#6E8C8C` "$1,910.00 · 3 due Aug 15 · 2 awaiting an amount"; right side ghost pill "Pay all 7" (`border 2px solid #275C5C`, `radius 999px`, `padding 5px 14px`, `.78rem`/700, `#A9C4C4`) which pays every row that has an amount, stopping at the floor.
- **Bill row** (`background #0D2828`, `border 2px solid` — `#FF5C3D` when due Aug 15, `#275C5C` otherwise, `radius 14px`, `padding 14px 16px`). Top line (`display flex`, `align-items center`, `gap 12px`):
  - Checkbox: 24×24, `radius 7px`, `border 2px solid #275C5C` (`#FF3B3B` if paying it would breach the floor), `background #123636`, cursor pointer; hover `border-color #2FE6A7`, `background rgba(47,230,167,0.15)`. Click = mark paid.
  - Name: free-text input, `width 190px`, weight 800, `1.02rem`, `#F4FBFB`, transparent background and border, `radius 6px`, `padding 4px 6px`; hover `border-color #275C5C`; focus `border-color #17C7C7`, `background #123636`, no outline. Placeholder "Name this bill".
  - Category pill: `.7rem`/800, `letter-spacing .03em`, uppercase, `padding 2px 9px`, `radius 999px`; color/background per category (see tokens).
  - Due pill: `.72rem`/800, `padding 3px 10px`, `radius 999px`. Due Aug 15 → `background #FF5C3D`, `color #fff`. Later date → `background #123636`, `color #A9C4C4`. No amount → `background rgba(255,176,32,0.18)`, `color #FFB020`, text "Amount needed".
  - 🔁 `.85rem` if recurring.
  - Right block: amount Lilita One `1.35rem` (`#F4FBFB`, or `#6E8C8C` reading "Not set"); under it `.75rem`/700 "leaves you $2,805" — `#6E8C8C`, `#FF3B3B` if that running balance is under the floor, or "not counted yet" in `#FFB020` when there is no amount.
  - Bottom line (`margin-top 12px`, `padding-top 12px`, `border-top 1px solid #1B4747`, `gap 10px`): 6px progress track `#123636` flex 1; then "Unpaid" `.78rem`/700 `#6E8C8C` + "Part pay" ghost pill (rows with an amount) **or** "Enter amount" pill (`background #17C7C7`, `color #0A1F1F`, `radius 999px`, `padding 5px 14px`, `.75rem`/800) for rows without; then "Attach receipt" ghost pill; then ⋯ menu button `1.05rem` `#6E8C8C`.
- **Paid group:** header "PAID" `#2FE6A7` + total. Rows are a grid `24px 1.5fr 130px 1fr`, `gap 14px`, `background #0A2222`, `border 2px solid #1B4747`, `radius 14px`, `padding 12px 16px`, `opacity .82`: green 22×22 `radius 6px` `#2FE6A7` check (click = unpay), name input (`.98rem`/700 `#A9C4C4`), amount Lilita One `1.05rem` right-aligned, and `.8rem` `#6E8C8C` right-aligned "conf 884301 · receipt attached" or "add confirmation #".
- **Footer strip:** `background #0D2828`, `border 2px dashed #275C5C`, `radius 14px`, `padding 18px`. Copy: "Click any name to rename it — free text, always editable. **Start new month** carries the names over and clears amounts, confirmation numbers and checkmarks." Buttons: "Backup" ghost (`box-shadow 0 5px 0 #081716`) and "↻ Start new month" (`background #FFB020`, `color #2A0F08`, `box-shadow 0 5px 0 #b96a00`).

### 2. Floor-guard states (documentation block at the bottom of the prototype)
Not a screen — three reference states rendered below the app for the developer: blocked row (red border, ✕ box, "Blocked by floor" pill, "would leave you $780", "$120 short of the floor. Pay part of it, or wait for income to land." + "Pay $380 instead" pill), disabled savings card, and the modal Stop dialog (`background #123636`, `border 4px solid #FF3B3B`, `radius 20px`, `padding 36px 40px`, `box-shadow 0 0 40px rgba(255,59,59,0.35)`, 🛑 at 52px, "Stop" Lilita One `1.6rem` `#FF3B3B`, amount Lilita One `1.6rem`, "I understand" pill). Implement whichever presentation you prefer — the existing app already has the modal (`#stopModalOverlay`); the inline notice is the redesign's default.

## Interactions & behavior
- **Tick a bill** → if `balance − amount < 900`, refuse: leave it unpaid, show the floor-stop notice naming the bill, its amount, and the resulting balance. Otherwise mark paid, move the row into the Paid group, recompute every figure.
- **Click the green check in Paid** → mark unpaid, move back into Unpaid, clear its confirmation number.
- **Pay all N** → attempt each unpaid row with an amount in list order; the first one that would breach the floor triggers the notice and the rest are left alone.
- **Rows without an amount** are never payable, never counted, and never block the savings figure.
- **Savings** = `max(0, balance − owed − 900)`; the transfer button disables at 0.
- **Start new month** → archive month totals, keep every bill and its name, clear `amount`, `confirmationNumber` and `paid`. (This replaces today's behavior of deleting paid one-time bills.)
- **Name inputs** commit on change; amounts should keep the existing app's expression parsing (`100+50`).
- Hover: checkbox tints mint; name inputs reveal a `#275C5C` border. No opacity hovers.

## State management
Extend the existing `state` in `app.js`:
- `bills[]`: `{ id, name, amount: number|null, category, dueDate, recurring, paid, confirmationNumber }` — `amount: null` is the "no amount yet" case (today the app coerces to 0; keep null distinct so it can be excluded from totals).
- `blocked: { name, amount, after } | null` — drives the floor-stop notice.
- Derived per render: `balance = startingBalance + expectedIncome − Σ paid amounts`; `owed = Σ unpaid amounts`; `projected = balance − owed`; `savings = max(0, projected − 900)`; per-row running balance in list order; category totals for the pie.
- Persist as today: `billTracker_v3_data`, `billTracker_v3_history`, `billTracker_v3_theme`.

## Design tokens (from `app.js` DARK, unchanged)
- Background `#0A1F1F`; surfaces `#0D2828`, `#123636`, raised `#1B4747`; paid-row surface `#0A2222`.
- Borders: subtle `#1B4747`, strong `#275C5C`.
- Text: primary `#F4FBFB`, secondary `#A9C4C4`, muted `#6E8C8C`; on-primary `#0A1F1F`, on-accent `#2A0F08`.
- Accents: primary cyan `#17C7C7` (shadow `#0EA3A3`), accent coral `#FF5C3D` (shadow `#E6432E`), amber `#FFB020` (shadow `#b96a00`), success mint `#2FE6A7` (shadow `#17A97A`, ink `#062119`), error `#FF3B3B`, neutral shadow `#081716`, deep amber `#D68A00` (pie only).
- Category pills: Housing `#17C7C7` on `rgba(23,199,199,0.16)`; Insurance & Savings `#FFB020` on `rgba(255,176,32,0.18)`; Credit Card `#2FE6A7` on `rgba(47,230,167,0.16)`; Shopping `#FF5C3D` on `rgba(255,92,61,0.16)`.
- Type: display **Lilita One**; body/UI **Nunito Sans** (400/600/700/800). Sizes used: `.62 .68 .72 .75 .78 .8 .82 .85 .88 .9 .92 .98 1.02 1.05 1.35 1.5 1.8 2 3.2 rem`.
- Radius: 6 / 7 / 10 / 12 / 14 / 16 / 20 / 999.
- Shadows: pressed-button `0 5px 0 <dim hue>`, savings card `0 6px 0 #17A97A`, stop dialog glow `0 0 40px rgba(255,59,59,0.35)`.
- Spacing rhythm: 10 / 12 / 14 / 16 / 18 / 22 / 24 / 26 px.
- Floor constant: `MIN_BALANCE = 900` (hardcoded by the owner's request — do not expose as a setting).

## Assets
None. No images, no icon set. Glyphs are emoji/text characters already used by the app: ☀️ 🌙 🔁 🛑 ✓ ✕ ⤓ ↻ ⋯. Fonts load from Google Fonts, as today.

## Files in this bundle
- `Bill Tracker - Cockpit.dc.html` — target design (interactive).
- `Bill Tracker - Current.dc.html` — recreation of today's screen, for before/after comparison.
- `support.js` — runtime the two prototypes need in order to open in a browser. Not part of the implementation.
- `CLAUDE_CODE_PROMPT.md` — a ready-to-paste prompt for Claude Code.

## Known gaps (not designed yet)
Add-bill dialog, calendar view, year view, light theme, partial payments beyond the button affordance, and receipt attachment beyond the button affordance. Ask before inventing them.
