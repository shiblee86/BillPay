# Design Guide — How the App Looks, and Why

This explains the look and feel of the Bill Payment Tracker in plain language — no design background needed.

## Where the look came from

This app's appearance was based on a design plan (found in the `design_handoff_bill_tracker` folder) that uses a style called "Turbo Math" — a modern, friendly, teal-and-graphite look with bright accent colors. The goal was to feel less like a dry spreadsheet and more like a clean, modern app that's pleasant to check every day.

## Dark mode and light mode

The app has two full color themes, and you can switch between them any time with the sun/moon button in the top corner:

- **Dark mode** (the default) — a deep teal-green background, easy on the eyes, good for evening use.
- **Light mode** — a bright, clean white/pale-teal background, good for daytime or well-lit rooms.

Whichever one you pick is remembered automatically, so you don't have to choose again next time.

## The colors, and what they mean

The app uses color on purpose — not just for decoration, but to tell you something at a glance:

- 🟦 **Teal/Cyan** — the app's main color. Used for buttons, highlights, and to mean "things are fine."
- 🟧 **Coral (orange-red)** — used for the "Add bill" button and for bills that are due very soon.
- 🟨 **Amber (gold/yellow)** — means "getting close to a limit, pay attention."
- 🟩 **Mint green** — means "good/success," like a bill that's already paid, or money safely saved.
- 🟥 **Red** — means "stop, this needs attention," like an overdue bill or a balance that's dropped too low.

This same red/amber/green system is used consistently everywhere in the app — the balance banner, the due-date tags on bills, and the running balance shown on each bill card all use the same colors to mean the same things, so once you learn the pattern, you can understand the whole app at a glance.

## Category tags

Each bill's category badge (like "Housing" or "Credit Card") cycles through four soft, translucent colors — teal, coral, amber, and mint — just to make the list easier to visually scan, not to signal anything urgent.

## Fonts

Two fonts are used, each doing a different job:
- **Lilita One** — a big, bold, rounded font used for the page title, large dollar amounts, and pop-up headings. It's meant to feel friendly and easy to read at a glance.
- **Nunito Sans** — a clean, simple, everyday font used for regular text, labels, and buttons — the kind of font that's comfortable to read for longer stretches.

## Shapes and spacing

- **Rounded corners** everywhere — cards, buttons, boxes — nothing is sharp-edged, which gives the app a softer, more approachable feel.
- **Pill-shaped badges** (fully rounded ends) are used for small tags, like category labels and due-date warnings.
- Plenty of **breathing room** (space) between sections, so the page doesn't feel crowded even though it shows a lot of information.

## Buttons that feel "pressable"

The main action buttons (Add bill, Start new month, Download backup, and so on) have a small 3D effect — a colored shadow underneath that "collapses" when you click, and the button itself moves down slightly. It's a small touch meant to make clicking feel satisfying, a bit like pressing a real button.

## Layout, top to bottom

The page is organized in a deliberate order, from the information you check first to the things you do last:
1. Title and theme switch
2. Quick numbers (bills, paid, remaining, progress)
3. Your balance and income
4. Your current balance (the big, color-coded banner)
5. Progress bar
6. Savings suggestion
7. Charts (spending breakdown and monthly trend)
8. Your bill list (or calendar)
9. A short summary
10. Action buttons

This top-to-bottom order mirrors how most people naturally think about their bills: "What's the big picture? What's my balance? Now let me look at the details."
