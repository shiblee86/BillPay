# Handoff: Smart Bill Payment Tracker (redesign)

## Overview
A personal finance dashboard for tracking monthly bills (mostly credit cards), balances, and payment progress. Redesigned from a dated purple-gradient utility app into a modern dashboard styled on the Turbo Math design system's teal/graphite + cyan/coral/amber visual language, with added functionality: recurring bill rollover, a due-date calendar, and spending insights.

## About the Design Files
The bundled file (`Bill Tracker.dc.html`) is a **design reference built in HTML** (a "Design Component" — our internal prototyping format, streamed/interpreted by our own runtime, NOT a standard web page). It is a working, interactive prototype showing exact layout, styling, copy, and behavior — but it is not production code. Your task is to **recreate this design in the target codebase's actual environment** (React, Vue, native, etc., whichever the project already uses — or the best choice if none exists yet), using that environment's own component patterns, state management, and build tooling. Do not attempt to embed or ship the HTML file itself.

To read the file: open it in a browser or text editor. The `<div style="...">` inline styles carry all colors/spacing/typography info directly — treat those as your styling source of truth. The `class Component extends DCLogic` script block (bottom of file) contains all business logic (calculations, state transitions, formatting) in plain JavaScript — port this logic directly, it is framework-agnostic.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy are final. Recreate pixel-close using your codebase's component library / styling system, substituting in its existing button/input/modal primitives where equivalent rather than copying inline styles verbatim.

## Screens / Views
Single dashboard page (no routing). Sections top to bottom:

1. **Header** — Title "Bill Payment Tracker" (Lilita One, ~32px) + due-date subtitle (Nunito Sans, ~15px, secondary text color). Right-aligned circular icon button toggles light/dark theme (☀️/🌙).
2. **Stat cards row** — 4-column responsive grid (`repeat(auto-fit, minmax(200px,1fr))`, 16px gap). Each card: surface-1 background, 2px border-strong border, 16px radius, 18-20px padding. Label (13-14px, secondary, bold) + big value (Lilita One, ~26px). Cards: Monthly bills, Paid this month (success color), Remaining (accent color), Progress (%).
3. **Balance & income inputs** — 2-column grid, 16px gap. Each: surface-1 card, colored border (primary for balance, success for income), label + numeric input (surface-2 background, border-strong border, 10px radius, bold 18px text).
4. **Current balance banner** — Full-width card, 20px radius, 28px padding, centered text. Background color and text-on-color flip based on balance state: `primary` color when balance ≥ min+200 ("safe"), `amber` when within $200 of minimum ("warning"), `error` red when below minimum ("danger", pulses via `pulseWarn` keyframe scale 1↔1.015 over 2s). Shows label, big amount (Lilita One 45px), status line.
5. **Payment progress card** — surface-1 card with a labeled progress bar (cyan gradient fill, pill-radius, 20px height, border-strong 2px border) and a "Bills paid: N / total" row below.
6. **Savings transfer banner** — Full-width card. Success-green background when there's a safe surplus to transfer; neutral surface-2 background when bills are unpaid or no surplus. Shows transferable amount + explanatory note.
7. **Insights row** — 2-column grid (1.3fr / 1fr):
   - **Spending by card**: horizontal bar list, one row per bill, sorted by amount descending. Each row: label + amount above a 10px-tall pill-shaped bar (surface-2 track, colored fill cycling through 4 palette colors: cyan/coral/amber/mint).
   - **Monthly trend**: grouped bar chart from archived month-end history (see Data model). Each month is a bar (outlined in primary color, height scaled to that month's total bills) with an inset filled bar (success color, height scaled to amount paid) and a month label below. Empty state message when no history exists yet.
8. **View toggle + search/filter bar** — Segmented "List / Calendar" toggle (pill-shaped container, active segment filled with primary color). Search input + status filter dropdown (All / Unpaid / Paid / Overdue / Due soon ≤3 days).
9. **Bills list (List view)** — Vertical stack of cards (not a rigid table — built to reflow on narrow widths). Each bill card:
   - Row 1: checkbox, editable name (inline text input), category badge (pill, colored per palette), due-status badge (color-coded: red=overdue/due today, coral=due ≤3 days, amber=due ≤7 days, neutral=later, green=paid), 🔁 icon if recurring, red "Delete" button pinned right.
   - Row 2 (wrapping flex row of labeled fields): Amount (editable, math expressions like `100+50` supported), Confirmation # (monospace, editable), Due date (date picker), Category (select dropdown), Recurring toggle button ("🔁 Monthly" / "One-time"), running balance-after-this-bill (color-coded safe/warning/danger).
   - Paid bills: reduced opacity (0.75), muted border.
10. **Bills list (Calendar view)** — Month grid (7 columns, prev/next month nav, month/year label in Lilita One). Each day cell shows the date number and small colored chips for bills due that day (color = green if paid, red if overdue, cyan if upcoming). Today's cell is highlighted with the raised surface color.
11. **Summary panel** — Simple label/value rows: Total bills, Paid so far, Unpaid bills, Expected income, Final balance (bold, larger, colored red if below minimum).
12. **Action buttons row** — Responsive grid of 5 buttons: "+ Add bill" (accent/coral), "↻ Start new month" (reward/amber), "Import backup" (ghost), "Export CSV" (ghost), "Download backup" (primary/cyan). All buttons use the "pressed game button" interaction: colored drop shadow that collapses and the button translates down 2-7px on press.
13. **Modals** (overlay `rgba(4,10,10,0.7-0.75)` scrim, centered card):
    - **Add bill modal**: form with Name, Amount, Category select, Due date, "Repeats monthly" checkbox, Cancel/Add buttons.
    - **Generic confirm modal**: title + message + Cancel/Confirm (red) buttons — reused for delete-bill and start-new-month confirmations.
    - **Stop modal**: shown when marking a bill paid would drop the balance below the $900 minimum. Red-bordered, 🛑 icon, pulsing animation, shows the balance that would result, single "I understand" dismiss button.
14. **Toasts** — Bottom-right stack, one per action confirmation (e.g. "Paid X for $Y", "Backup imported"), auto-dismiss after 3s, slide-in from the right.

## Interactions & Behavior
- **Dark/light theme toggle**: swaps an entire color-token object (see Design Tokens) driving every inline style; persisted to `localStorage`.
- **Toggle bill paid**: recalculates balance; if it would fall below $900, opens the Stop modal instead and reverts the checkbox.
- **Editable bill fields**: name/confirmation-number/due-date/category update on change; amount updates on blur and supports simple arithmetic expressions (`+ - * /`), sanitized then evaluated.
- **Recurring toggle**: per-bill boolean flag, no immediate recalculation needed beyond the icon/label.
- **Start new month**: confirm dialog, then: archives current totals (`{label, totalBills, totalPaid}`, label = short month/year) to a history array (kept to last 12 entries) for the trend chart; for each bill — if recurring, reset `paid=false`, clear confirmation #, roll `dueDate` to next month using the same "15th before, else month-end" smart-date rule; if not recurring and already paid, remove it from the list; if not recurring and unpaid, leave unchanged.
- **Delete bill**: confirm dialog before removing.
- **Search/filter**: client-side filter over the bill list by name substring and status (all/unpaid/paid/overdue/due-soon-≤3-days).
- **Calendar nav**: prev/next month arrows shift a month offset from today; bills are plotted on their exact `dueDate`.
- **CSV export**: downloads bill list (name, amount, paid, confirmation #, due date, category, recurring, computed status) as a `.csv`.
- **Backup export/import**: downloads/reads a `.json` containing starting balance, expected income, bills, and history — importing replaces current state.
- **Keyboard/animations**: modal entrance `modalIn` (translateY -30px→0 + fade, ~250ms ease-out); toast entrance `toastIn` (slide from right + fade, 250ms); balance banner `pulseWarn` when in danger state (scale 1↔1.015, 2s infinite).

## State Management
- `bills`: array of `{ id, name, amount:number, paid:bool, confirmationNumber, dueDate:'YYYY-MM-DD', category, recurring:bool }`.
- `startingBalance`, `expectedIncome`: numeric strings from the two top inputs.
- `history`: array of `{ label, totalBills, totalPaid }`, most recent last, capped at 12, built by "Start new month".
- `isLight`: boolean theme flag, persisted.
- `search`, `filterStatus`: list view controls.
- `view`: `'list' | 'calendar'`, `calOffset`: integer months from current month.
- `addModal`, `confirmModal`, `stopModal`: transient UI state for the three modal types.
- `toasts`: array of `{ id, msg }` with individual 3s auto-expiry timers.
- Persistence: `bills` + `startingBalance` + `expectedIncome` → localStorage on every edit; `history` → localStorage on month rollover; theme → localStorage on toggle. No backend — this is a fully client-side, single-user tool.
- Derived every render (pure functions of state, not stored): current balance, balance status (safe/warning/danger vs. `MIN_BALANCE = 900`), per-bill running balance after that bill in list order, payment progress %, spending-by-card breakdown, monthly trend chart scaling.

## Design Tokens
Two full palettes, swapped by the theme toggle (see `DARK` / `LIGHT` objects in the script):

**Dark (default)**
- Backgrounds: `bg #0A1F1F`, `surface1 #0D2828`, `surface2 #123636`, `surfaceRaised #1B4747`
- Borders: `borderSubtle #1B4747`, `borderStrong #275C5C`
- Text: `textPrimary #F4FBFB`, `textSecondary #A9C4C4`, `textMuted #6E8C8C`
- Action: `primary #17C7C7` (cyan), `accent #FF5C3D` (coral), `amber #FFB020`, `success #2FE6A7` (mint), `error #FF3B3B`
- On-color text: `textOnPrimary #0A1F1F`, `textOnAccent #2A0F08`
- Button shadow colors: `shadowPrimary #0EA3A3`, `shadowAccent #E6432E`, `shadowNeutral #081716`

**Light**
- Backgrounds: `bg #EAF6F6`, `surface1 #FFFFFF`, `surface2 #F1FAFA`, `surfaceRaised #FFFFFF`
- Borders: `borderSubtle #CFE7E7`, `borderStrong #9FCFCF`
- Text: `textPrimary #0A1F1F`, `textSecondary #3B5C5C`, `textMuted #6E8C8C`
- Action: `primary #0EA3A3`, `accent #E6432E`, `amber #D68A00`, `success #1FAE7E`, `error #D62A2A`
- On-color text: `textOnPrimary #F4FBFB`, `textOnAccent #FFFFFF`
- Button shadow colors: `shadowPrimary #0B8484`, `shadowAccent #C23522`

**Category/card palette** (cycles through in order): cyan, coral, amber, mint — each with a translucent background (16-18% opacity in dark, 12-14% in light) for pill badges.

**Typography**
- Display font: `Lilita One` (Google Font) — titles, big numbers, modal headings.
- Body font: `Nunito Sans` (Google Font) — everything else.
- Scale used: 13-15px (labels/secondary), 16-18px (body/inputs), 20-26px (card values), 32px (page title), 45px (balance amount).

**Spacing / shape**
- Radius: 8px (inputs/small), 10-14px (cards, secondary), 16-20px (panels/modals), pill (999px) for badges/segmented control/progress bar.
- Card padding: 18-32px depending on size. Grid/flex gaps: 8-24px.
- Borders: 1-2px on inputs, 2px on cards, 3-4px on modals (amber/primary/error depending on modal type).

## Assets
No images or custom icons. Uses native emoji for status/action glyphs (🛑 🔁 ↻ ☀️ 🌙) and CSS for all charts/badges (no SVG illustrations). Fonts loaded via the Turbo Math design system's Google Fonts import (Lilita One, Nunito Sans) — reference `_ds/.../tokens/fonts.css` in this project, or load the same two families directly from Google Fonts in the target codebase.

## Files
- `Bill Tracker.dc.html` — the full design reference (markup + inline styles + JS logic class), open in a browser to view/interact with it.
