# Claude Code prompt

Paste this into Claude Code from the root of the `BillPay` repo, with this handoff folder available.

---

Implement the "Cockpit" redesign of the Bill Payment Tracker in this repo.

**Read first, in this order:** `design_handoff_bill_tracker_cockpit/README.md` (full spec, exact tokens and measurements), then the current app — `index.html`, `style.css`, `app.js` — and `TESTING.md`. Open `design_handoff_bill_tracker_cockpit/Bill Tracker - Cockpit.dc.html` in a browser to see the target, and `Bill Tracker - Current.dc.html` to see today's screen. Those two files are **design references**, not code to copy: they run on a prototype runtime (`support.js`) that must not enter this repo.

**Target environment:** keep the app exactly as it is architecturally — vanilla `index.html` + `style.css` + `app.js`, no build step, no dependencies, no framework. Keep the existing helpers (`fmtCurrency`, `parseAmountExpr`, `parseLocalDate`, `smartDueDateForMonth`, `escapeHtml`, toasts), the `DARK`/`LIGHT` theme objects, the CSS-variable theming, and the localStorage keys (`billTracker_v3_data`, `billTracker_v3_history`, `billTracker_v3_theme`) including the migration path from the old keys.

**What changes:**

1. **Layout.** Replace the current top-to-bottom stack (stats grid, inputs grid, balance banner, progress card, savings banner, insights row, toolbar, list, summary, actions) with a two-column layout: `max-width 1360px`, `grid-template-columns 340px 1fr`, `gap 26px`. Left rail: accounts, "Move to savings", "After every bill", category donut, year strip. Right column: header, search/filter, Unpaid group, Paid group, footer strip. The README specifies every card's colors, radii, type sizes and copy.

2. **Savings is continuous.** `savings = max(0, (balance − bills still owed) − 900)`, recomputed on every change. Delete the current rule that zeroes it out while any bill is unpaid. The savings card is the visual emphasis of the page: mint `#2FE6A7` fill, `3.2rem` Lilita One figure, the four-line breakdown, and a transfer button that disables at $0.

3. **Bills with no amount.** Introduce `amount: null` as a real state distinct from 0. Such bills stay in the list with an amber "Amount needed" chip, show "Not set" instead of a figure and "not counted yet" instead of a running balance, are excluded from every total and from the pie, are not payable, and never block the savings figure. Migrate existing data: leave stored numeric amounts alone; treat missing/empty as null.

4. **Paid bills move.** Ticking a bill relocates its row into a Paid group at the bottom of the list; unticking returns it to Unpaid and clears its confirmation number. Group headers carry live totals.

5. **The $900 floor stays a hard stop** (`MIN_BALANCE = 900`, hardcoded, not a setting). If ticking a bill would take checking below it, refuse the change and show the inline floor-stop notice at the top of the list naming the bill, its amount and the resulting balance, with an "I understand" dismiss. Keep the existing `#stopModalOverlay` behavior or replace it with the inline notice — but never let a payment or transfer cross the floor. "Pay all" processes rows in order and stops at the first breach.

6. **Names are free text and permanent.** Every bill name is an inline text input, always editable, committing on change. `startNewMonth()` must keep every bill and its name and clear only `amount`, `confirmationNumber` and `paid` — it must no longer delete paid one-time bills. Archive the month's totals into history as it does today.

7. **Export CSV moves** into the header row beside "+ Add bill" (label "⤓ Export CSV"); remove the duplicate from the footer. Keep the existing CSV columns and filename pattern.

8. **Category donut** replaces the "Spending by card" bars: a CSS `conic-gradient` donut of this month's bills grouped by category, total in the hole, legend rows with amount and percent. Colors are in the README. Categories with no amount are dropped, not shown at zero.

**Keep unchanged:** the dark/light theme toggle and both palettes, the calendar view, the add-bill and confirm modals, toasts, CSV export, backup import/export, the monthly history chart data, and the smart due-date logic.

**Constraints:** every color, size, radius and shadow must come from the README (they are the app's own `DARK` values — do not invent new ones). Semantic HTML, no inline `onclick` attributes for the new code if you can attach listeners instead, and keep `escapeHtml` on any interpolated user text. Preserve accessibility basics: real `<input type="checkbox">` elements for pay toggles (styled to match the design), labels on inputs, and keyboard-reachable buttons.

**Verify:** run the existing test suites in `tests/` (`run-tests.sh`) and add cases for the new logic — null-amount exclusion from totals and savings, the floor refusal on a single tick and on "Pay all", paid/unpaid relocation, and `startNewMonth` preserving names while clearing amounts. Then check the rendered page against `Bill Tracker - Cockpit.dc.html` side by side and report any deliberate deviations.
