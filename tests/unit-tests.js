// Unit tests: pure/utility functions from app.js, exercised in isolation.

test('pad2 pads single digits', () => {
  assertEqual(pad2(5), '05');
  assertEqual(pad2(12), '12');
});

test('fmtDateInput formats as YYYY-MM-DD', () => {
  assertEqual(fmtDateInput(new Date(2026, 0, 5)), '2026-01-05');
  assertEqual(fmtDateInput(new Date(2026, 11, 31)), '2026-12-31');
});

test('smartDueDateForMonth returns 15th when before15 is true', () => {
  const d = smartDueDateForMonth(2026, 2, true); // March 2026
  assertEqual(fmtDateInput(d), '2026-03-15');
});

test('smartDueDateForMonth returns min(30, lastDay) when before15 is false', () => {
  assertEqual(fmtDateInput(smartDueDateForMonth(2026, 3, false)), '2026-04-30'); // April has 30 days
  assertEqual(fmtDateInput(smartDueDateForMonth(2026, 0, false)), '2026-01-30'); // January has 31 -> capped at 30
  assertEqual(fmtDateInput(smartDueDateForMonth(2026, 1, false)), '2026-02-28'); // Feb 2026 has 28 -> capped at 28
});

test('getSmartDueDate matches smartDueDateForMonth for the real current date', () => {
  const now = new Date();
  const expected = smartDueDateForMonth(now.getFullYear(), now.getMonth(), now.getDate() <= 15);
  assertEqual(fmtDateInput(getSmartDueDate()), fmtDateInput(expected));
});

test('fmtCurrency formats positive amounts with thousands separators', () => {
  assertEqual(fmtCurrency(1234.5), '$1,234.50');
  assertEqual(fmtCurrency(0), '$0.00');
  assertEqual(fmtCurrency(1000000), '$1,000,000.00');
});

test('fmtCurrency formats negative amounts with a leading minus before the dollar sign', () => {
  assertEqual(fmtCurrency(-42.1), '-$42.10');
});

test('fmtCurrency treats non-numeric input as zero', () => {
  assertEqual(fmtCurrency('not a number'), '$0.00');
  assertEqual(fmtCurrency(undefined), '$0.00');
});

test('parseAmountExpr parses plain numbers', () => {
  assertEqual(parseAmountExpr('120'), 120);
  assertEqual(parseAmountExpr('12.5'), 12.5);
});

test('parseAmountExpr evaluates arithmetic with correct operator precedence', () => {
  assertEqual(parseAmountExpr('100+50'), 150);
  assertEqual(parseAmountExpr('10+5*2'), 20); // multiplication before addition
  assertEqual(parseAmountExpr('(10+5)*2'), 30);
});

test('parseAmountExpr sanitizes non-numeric/operator characters before evaluating', () => {
  assertEqual(parseAmountExpr('1+1abc'), 2); // letters stripped, evaluates as "1+1"
  assertEqual(parseAmountExpr('$1+$1'), 2); // dollar signs stripped
});

test('parseAmountExpr falls back to 0 for unparsable input', () => {
  assertEqual(parseAmountExpr('abc'), 0);
  assertEqual(parseAmountExpr(''), 0);
});

test('uid returns unique, string-prefixed ids', () => {
  const a = uid(), b = uid();
  assertTrue(a.startsWith('b'), 'uid should start with "b"');
  assertTrue(a !== b, 'two calls should not collide');
});

test('escapeHtml neutralizes markup', () => {
  assertEqual(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assertEqual(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
});

test('escapeHtml handles null/undefined as empty string', () => {
  assertEqual(escapeHtml(null), '');
  assertEqual(escapeHtml(undefined), '');
});

test('shade darkens a hex color and clamps channels at 0', () => {
  assertEqual(shade('#FFB020', -70), '#b96a00');
  assertEqual(shade('#000000', -50), '#000000'); // clamps, cannot go below 0
});

test('shade brightens a hex color and clamps channels at 255', () => {
  assertEqual(shade('#000000', 50), '#323232');
  assertEqual(shade('#FFFFFF', 50), '#ffffff'); // clamps, cannot exceed 255
});

test('calculateBalance subtracts only paid bills from starting + income', () => {
  const bills = [makeBill({ amount: 100, paid: true }), makeBill({ amount: 50, paid: false }), makeBill({ amount: 25, paid: true })];
  assertClose(calculateBalance(bills, 1000, 200), 1000 + 200 - 125);
});

test('calculateBalance with no bills equals starting + income', () => {
  assertClose(calculateBalance([], 500, 100), 600);
});

test('nextRecurringDueDate rolls a before-15th date to the 15th of next month', () => {
  assertEqual(nextRecurringDueDate('2026-03-10'), '2026-04-15');
});

test('nextRecurringDueDate rolls an after-15th date to month-end (capped at 30) of next month', () => {
  assertEqual(nextRecurringDueDate('2026-03-20'), '2026-04-30');
  assertEqual(nextRecurringDueDate('2026-01-20'), '2026-02-28'); // Feb 2026, capped at actual last day
});

test('nextRecurringDueDate rolls December into January of the following year', () => {
  assertEqual(nextRecurringDueDate('2026-12-10'), '2027-01-15');
});

test('nextRecurringDueDate is immune to UTC/local timezone skew on the 1st of the month', () => {
  // Regression guard: new Date('2026-06-01') parses as UTC midnight, which in any
  // timezone west of UTC reads back as May 31st via local getDate()/getMonth() — that
  // used to push this into the wrong month (June 30th) instead of July 15th.
  assertEqual(nextRecurringDueDate('2026-06-01'), '2026-07-15');
});

test('parseLocalDate reads YYYY-MM-DD as local calendar fields, not UTC', () => {
  const d = parseLocalDate('2026-06-01');
  assertEqual(d.getFullYear(), 2026);
  assertEqual(d.getMonth(), 5); // June, 0-indexed
  assertEqual(d.getDate(), 1);
});

test('CATEGORIES has the expected fixed order (badge colors index off this)', () => {
  assertEqual(CATEGORIES.join(','), 'Housing,Utilities,Insurance,Credit Card,Subscription,Shopping,Savings,Other');
});

test('MIN_BALANCE is 900', () => {
  assertEqual(MIN_BALANCE, 900);
});

test('DARK and LIGHT theme tokens define every required key', () => {
  const requiredKeys = ['bg','surface1','surface2','surfaceRaised','borderSubtle','borderStrong','textPrimary','textSecondary','textMuted','primary','accent','amber','success','error','textOnPrimary','textOnAccent','shadowPrimary','shadowAccent','shadowNeutral','shadowAmber'];
  requiredKeys.forEach(k => {
    assertTrue(typeof DARK[k] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(DARK[k]), 'DARK.' + k + ' should be a hex color');
    assertTrue(typeof LIGHT[k] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(LIGHT[k]), 'LIGHT.' + k + ' should be a hex color');
  });
});

test('CAT_PALETTE has exactly 4 entries referencing valid theme color keys', () => {
  assertEqual(CAT_PALETTE.length, 4);
  CAT_PALETTE.forEach(p => {
    assertTrue(p.colorKey in DARK, 'colorKey ' + p.colorKey + ' should exist on theme objects');
  });
});
