# Testing Guide — How We Make Sure the App Works

You don't need to know anything technical to read this. It simply explains, in plain language, how we check that the Bill Payment Tracker works correctly — both today, and after any future changes.

## Why bother testing at all?

This app deals with your money — your balance, your bills, whether something's been paid. If a change to the app accidentally broke the math, or made a button stop working, you might not notice right away — and that's exactly the kind of mistake that matters. So instead of just trusting that everything still works after a change, we have the computer automatically re-check hundreds of little things, every time, in seconds. That collection of automatic checks is called a **test suite**.

Think of it like a pilot's pre-flight checklist — not because anyone expects something to be wrong, but because checking is fast, cheap, and catches problems before they matter.

## The three kinds of checks

We use three different types of tests, each checking a different level of the app:

### 1. Unit tests — "Does this one small piece of math work?"

These check the smallest building blocks on their own — one at a time, in isolation. For example:
- Does the app correctly turn the number `1234.5` into `"$1,234.50"`?
- Does typing `100+50` into the amount box correctly add up to `150`?
- Does the "roll this bill to next month" logic pick the right date?

There are **28 unit tests**, and they're a bit like checking that a calculator gives the right answer to `2 + 2` before you trust it with your taxes.

### 2. Integration tests — "Do the pieces work correctly together?"

These check real, complete actions, the same way you'd actually use the app — clicking buttons, typing into boxes, and checking that the right thing shows up on screen afterward. For example:
- If you add a bill through the "Add bill" form, does it actually show up in your list?
- If you check off a bill as paid, does your balance go down by the right amount, and does a confirmation message appear?
- If paying a bill would drop your balance too low, does the warning pop-up actually appear, and does the bill correctly stay unpaid?
- If you click "Start new month," do repeating bills correctly roll forward, and do already-paid one-time bills correctly disappear?

There are **20 integration tests** — think of these as testing not just that the calculator's buttons work, but that pressing "5 + 3 = " on the actual calculator gives you "8" on the screen.

### 3. Regression tests — "Did something that used to work quietly break?"

"Regression" just means "a thing that used to work, breaking again." These tests lock in specific, exact behavior we've decided is important — including things that were bugs in the past — so that even a well-meaning future change can't accidentally bring the old problem back without the tests immediately catching it.

For example, one of these tests locks in that the app always keeps a **$900 safety cushion**, and that the "getting close to my limit" warning always kicks in within **$200** of that cushion — so if a future change ever nudged those numbers, the test would fail immediately and loudly, instead of someone quietly losing that safety net without realizing it.

There are **13 regression tests**.

## All 61 tests currently pass ✅

As of the most recent check, every single test in all three suites passes — 28 + 20 + 13 = **61 out of 61**.

## A real bug these tests caught

While writing the regression tests, one of them actually caught a genuine, real bug — a good example of exactly why this kind of checking is worth having.

**The problem:** When a repeating bill (like a monthly subscription) rolled over to next month, the app calculated its next due date using a shortcut that, depending on which time zone your computer is set to, could sometimes read the date one day earlier than it should. In some cases, that off-by-one-day mistake was enough to push the bill into the wrong month entirely — for example, a bill due on June 1st might have incorrectly rolled forward to June 30th instead of July 15th.

**How it was found:** A regression test specifically checked a bill due on the 1st of the month rolling forward — and the app's actual answer didn't match the expected one.

**The fix:** The date-reading logic was corrected to always read the date using your computer's local calendar, instead of a method that could shift by time zone. A new test was added specifically to make sure this exact mistake can never quietly come back.

This is exactly the value of having tests: they don't just confirm things you already believe are fine — they sometimes catch things nobody noticed yet.

## How to actually run the tests

You don't need to know how to code to run them:

- **Easiest way:** Open the `tests` folder, and double-click any of `unit.html`, `integration.html`, or `regression.html`. It opens in your web browser and automatically shows a list of checkmarks (✓) or X's (✗) for every test, plus a pass/fail count at the top.
- **For a quick yes/no answer from someone technical:** There's a script at `tests/run-tests.sh` that runs all three suites at once and prints a simple summary — no extra software installation needed beyond a normal web browser.

## What this means for you

You don't need to run these tests yourself, and you don't need to understand how they work under the hood. What matters is this: every important calculation and every important safety check in this app — the $900 cushion, the balance math, saving your data correctly, rolling bills forward correctly — has an automatic check standing guard over it, so that future updates to the app are far less likely to quietly break something you rely on.
