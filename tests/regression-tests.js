// Regression tests: pin exact values/formulas from the design handoff and past fixes so
// they can't silently drift during future refactors. Each test names the thing it guards.

test('[storage keys] current + legacy localStorage key names have not changed', () => {
  // Changing these silently strands every existing user's saved data.
  assertEqual(STORAGE_KEY, 'billTracker_v3_data');
  assertEqual(HISTORY_KEY, 'billTracker_v3_history');
  assertEqual(THEME_KEY, 'billTracker_v3_theme');
  assertEqual(OLD_STORAGE_KEY, 'billTrackerData');
  assertEqual(OLD_THEME_KEY, 'darkMode');
});

test('[balance thresholds] MIN_BALANCE=900 and warning band is exactly 200 wide', () => {
  const bills = [];
  // danger: < 900
  resetApp(bills, { startingBalance: '899.99', expectedIncome: '0' });
  assertContains(el('balanceStatus').textContent, 'Stop paying bills');
  // exactly at minimum is safe-from-danger (warning band starts here)
  resetApp(bills, { startingBalance: '900', expectedIncome: '0' });
  assertContains(el('balanceStatus').textContent, 'Close to minimum');
  // just under the top of the warning band
  resetApp(bills, { startingBalance: '1099.99', expectedIncome: '0' });
  assertContains(el('balanceStatus').textContent, 'Close to minimum');
  // at/above minimum+200 is safe
  resetApp(bills, { startingBalance: '1100', expectedIncome: '0' });
  assertContains(el('balanceStatus').textContent, 'Safe to continue');
});

test('[balance banner colors] shadow color formula matches the handoff exactly (warning uses shadowAccent, not shadowAmber)', () => {
  resetApp([], { startingBalance: '1000', expectedIncome: '0', isLight: false }); // warning band
  assertEqual(el('balanceBanner').style.boxShadow, expectedBoxShadow(DARK.shadowAccent));

  resetApp([], { startingBalance: '500', expectedIncome: '0', isLight: false }); // danger
  assertEqual(el('balanceBanner').style.boxShadow, expectedBoxShadow(DARK.shadowAccent));

  resetApp([], { startingBalance: '5000', expectedIncome: '0', isLight: false }); // safe
  assertEqual(el('balanceBanner').style.boxShadow, expectedBoxShadow(DARK.shadowPrimary));
});

test('[balance banner text color] textOn formula: warning always textOnAccent; safe/danger use theme.bg in dark and textOnAccent in light', () => {
  // dark theme
  resetApp([], { startingBalance: '5000', expectedIncome: '0', isLight: false }); // safe
  assertEqual(el('balanceAmount').style.color, hexToRgbForCompare(DARK.bg));
  resetApp([], { startingBalance: '500', expectedIncome: '0', isLight: false }); // danger
  assertEqual(el('balanceAmount').style.color, hexToRgbForCompare(DARK.bg));
  resetApp([], { startingBalance: '1000', expectedIncome: '0', isLight: false }); // warning
  assertEqual(el('balanceAmount').style.color, hexToRgbForCompare(DARK.textOnAccent));

  // light theme
  resetApp([], { startingBalance: '5000', expectedIncome: '0', isLight: true }); // safe
  assertEqual(el('balanceAmount').style.color, hexToRgbForCompare(LIGHT.textOnAccent));
  resetApp([], { startingBalance: '500', expectedIncome: '0', isLight: true }); // danger
  assertEqual(el('balanceAmount').style.color, hexToRgbForCompare(LIGHT.textOnAccent));
});

test('[savings banner] bg/text formula matches handoff: unpaid bills => neutral, surplus => success, all-paid-no-surplus => neutral', () => {
  resetApp([makeBill({ amount: 100, paid: false })], { startingBalance: '5000', expectedIncome: '0', isLight: false });
  assertEqual(el('savingsBanner').style.background, hexToRgbForCompare(DARK.surface2), 'unpaid bills -> neutral bg');

  resetApp([makeBill({ amount: 100, paid: true })], { startingBalance: '5000', expectedIncome: '0', isLight: false });
  assertEqual(el('savingsBanner').style.background, hexToRgbForCompare(DARK.success), 'surplus after all paid -> success bg');

  resetApp([makeBill({ amount: 5000 - 900, paid: true })], { startingBalance: '5000', expectedIncome: '0', isLight: false });
  // balance now == MIN_BALANCE exactly => not > MIN_BALANCE => no surplus
  assertEqual(el('savingsBanner').style.background, hexToRgbForCompare(DARK.surface2), 'all paid, no surplus -> neutral bg');
});

test('[due-status thresholds] boundaries at 0, 3, and 7 days match the handoff exactly', () => {
  const today = new Date();
  const dayOffset = (n) => fmtDateInput(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  resetApp([
    makeBill({ name: 'Overdue', dueDate: dayOffset(-1), paid: false }),
    makeBill({ name: 'Today', dueDate: dayOffset(0), paid: false }),
    makeBill({ name: 'Soon3', dueDate: dayOffset(3), paid: false }),
    makeBill({ name: 'Amber7', dueDate: dayOffset(7), paid: false }),
    makeBill({ name: 'Later8', dueDate: dayOffset(8), paid: false })
  ]);
  const html = el('billsListView').innerHTML;
  assertContains(html, 'Overdue 1d');
  assertContains(html, 'Due today');
  assertContains(html, 'Due in 3d');
  assertContains(html, 'Due in 7d');
  assertContains(html, 'Due in 8d');
});

test('[running balance] computed over the full unfiltered bill list in original order, not the search/filter-narrowed list', () => {
  const bills = [
    makeBill({ name: 'AAA First', amount: 100, paid: true }),
    makeBill({ name: 'BBB Second', amount: 200, paid: true }),
    makeBill({ name: 'CCC Third', amount: 300, paid: true })
  ];
  resetApp(bills, { startingBalance: '10000', expectedIncome: '0' });
  el('searchBills').value = 'ccc'; // narrow the visible list down to just the third bill
  el('searchBills').dispatchEvent(new Event('input'));
  // Running balance after "CCC Third" must still reflect ALL three bills paid in order
  // (10000 - 100 - 200 - 300 = 9400), not just itself (which would wrongly show 9700).
  assertContains(el('billsListView').innerHTML, '$9,400.00');
  assertNotContains(el('billsListView').innerHTML, '$9,700.00');
});

test('[category color cycling] category badge color cycles through CAT_PALETTE by CATEGORIES index mod 4', () => {
  // "Insurance" is CATEGORIES index 2 -> CAT_PALETTE[2] -> amber colorKey
  const b = makeBill({ name: 'Cycle Test', category: 'Insurance' });
  resetApp([b], { isLight: false });
  const expectedColor = DARK[CAT_PALETTE[2].colorKey];
  assertContains(el('billsListView').innerHTML, `color:${expectedColor}`);
});

test('[recurring rollover] non-recurring+paid is dropped, non-recurring+unpaid is kept unchanged, recurring always survives reset', () => {
  const keepUnpaid = makeBill({ name: 'KeepUnpaid', recurring: false, paid: false, amount: 42 });
  const dropPaid = makeBill({ name: 'DropPaid', recurring: false, paid: true });
  const recurringWasUnpaid = makeBill({ name: 'RecurringUnpaid', recurring: true, paid: false, dueDate: '2026-06-01' });
  resetApp([keepUnpaid, dropPaid, recurringWasUnpaid]);
  startNewMonthConfirm();
  el('confirmActionBtn').click();

  const byName = Object.fromEntries(state.bills.map(b => [b.name, b]));
  assertTrue('KeepUnpaid' in byName);
  assertEqual(byName.KeepUnpaid.amount, 42);
  assertFalse('DropPaid' in byName);
  assertTrue('RecurringUnpaid' in byName);
  assertFalse(byName.RecurringUnpaid.paid);
  assertEqual(byName.RecurringUnpaid.dueDate, '2026-07-15');
});

test('[history cap] Start New Month never lets history exceed 12 entries', () => {
  const seed = [];
  for (let i = 0; i < 12; i++) seed.push({ label: 'H' + i, totalBills: 10, totalPaid: 10 });
  resetApp([makeBill({ amount: 10, paid: true })], { history: seed });
  startNewMonthConfirm();
  el('confirmActionBtn').click();
  assertEqual(state.history.length, 12);
});

test('[security] parseAmountExpr cannot execute arbitrary JS beyond arithmetic', () => {
  window.__pwned = undefined;
  const result = parseAmountExpr('1+1;window.__pwned=true');
  assertFalse(window.__pwned, 'sanitizer must strip semicolons/assignment so no side effect runs');
  assertTrue(typeof result === 'number' && isFinite(result), 'should still resolve to a finite number');
});

test('[CSV export] fields containing commas are quoted', () => {
  resetApp([makeBill({ name: 'Comma, Bill', amount: 10 })]);
  let captured = null;
  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return 'blob:mock'; };
  try { exportCSV(); } finally { URL.createObjectURL = originalCreate; }
  return captured.text().then(text => {
    assertContains(text, '"Comma, Bill"');
  });
});

test('[amount math] operator precedence relied on by the app matches standard JS semantics', () => {
  assertEqual(parseAmountExpr('10+5*2'), 20, 'must NOT evaluate left-to-right as (10+5)*2=30');
});

// Compares an inline JS-assigned hex color against a computed rgb() string, since
// element.style.color normalizes hex to rgb() once set in a real browser.
function hexToRgbForCompare(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xFF, g = (num >> 8) & 0xFF, b = num & 0xFF;
  return `rgb(${r}, ${g}, ${b})`;
}
// Same idea for the boxShadow shorthand: the browser reorders to "<color> <offsets>"
// and appends px units once it's parsed the assigned string.
function expectedBoxShadow(hex) {
  return `${hexToRgbForCompare(hex)} 0px 8px 0px`;
}
