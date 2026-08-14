// Regression tests: pin exact values/formulas from the Cockpit design handoff and past
// fixes so they can't silently drift during future refactors. Each test names the thing
// it guards.

test('[storage keys] current + legacy localStorage key names have not changed', () => {
  // Changing these silently strands every existing user's saved data.
  assertEqual(STORAGE_KEY, 'billTracker_v3_data');
  assertEqual(HISTORY_KEY, 'billTracker_v3_history');
  assertEqual(THEME_KEY, 'billTracker_v3_theme');
  assertEqual(OLD_STORAGE_KEY, 'billTrackerData');
  assertEqual(OLD_THEME_KEY, 'darkMode');
});

test('[floor boundary] the $900 floor refuses at 899.99 remaining and allows exactly 900', () => {
  const bill899 = makeBill({ name: 'B', amount: 100.01 });
  resetApp([bill899], { startingBalance: '1000', expectedIncome: '0' }); // 1000-100.01=899.99
  toggleBillPaid(bill899.id);
  assertFalse(findBill(bill899.id).paid, '899.99 remaining must be refused');
  assertTrue(state.blocked !== null);

  const bill900 = makeBill({ name: 'B', amount: 100 });
  resetApp([bill900], { startingBalance: '1000', expectedIncome: '0' }); // 1000-100=900 exactly
  toggleBillPaid(bill900.id);
  assertTrue(findBill(bill900.id).paid, 'exactly 900 remaining must be allowed (boundary is a hard floor, not "under or at")');
  assertEqual(state.blocked, null);
});

test('[continuous savings] savings is computed as max(0, balance − owed − 900) even while bills are still unpaid — the redesign\'s core change', () => {
  // Old behavior gated savings at 0 until every bill was paid; the Cockpit redesign must not do that.
  const paid = makeBill({ name: 'Paid', amount: 500, paid: true });
  const unpaid = makeBill({ name: 'Unpaid', amount: 300, paid: false });
  resetApp([paid, unpaid], { startingBalance: '5000', expectedIncome: '0' });
  // balance = 5000 - 500 = 4500; owed = 300; projected = 4200; savings = 4200 - 900 = 3300
  const fig = computeFigures();
  assertClose(fig.balance, 4500);
  assertClose(fig.owed, 300);
  assertClose(fig.projected, 4200);
  assertClose(fig.savings, 3300, 0.001, 'savings must be nonzero despite an unpaid bill remaining');
  assertEqual(el('savingsFigure').textContent, '$3,300');
});

test('[continuous savings] clamps to 0 (never negative) when projected balance is below the floor', () => {
  const unpaid = makeBill({ name: 'Big', amount: 4000, paid: false });
  resetApp([unpaid], { startingBalance: '4500', expectedIncome: '0' }); // projected = 500, well under 900
  const fig = computeFigures();
  assertTrue(fig.projected < MIN_BALANCE);
  assertEqual(fig.savings, 0);
  assertEqual(el('savingsFigure').textContent, '$0');
  assertTrue(el('transferBtn').disabled);
});

test('[projected meter] floor percentage formula matches the handoff exactly: round(savings / max(1, projected) * 100), clamped 0-100', () => {
  resetApp([makeBill({ amount: 1000, paid: false })], { startingBalance: '3000', expectedIncome: '0' });
  // projected = 2000, savings = 1100 -> pct = round(1100/2000*100) = 55
  assertEqual(el('projectedMeterFill').style.width, '55%');
});

test('[transfer button] enabled state uses ink-on-success colors; disabled state uses the literal dimmed rgba colors from the handoff', () => {
  resetApp([], { startingBalance: '5000', expectedIncome: '0' }); // large surplus -> enabled
  const btn = el('transferBtn');
  assertFalse(btn.disabled);
  assertEqual(btn.style.background, hexToRgbForCompare(DARK.ink));
  assertEqual(btn.style.color, hexToRgbForCompare(DARK.success));

  resetApp([makeBill({ amount: 4500, paid: false })], { startingBalance: '4500', expectedIncome: '0' }); // savings = 0
  assertTrue(btn.disabled);
  assertEqual(btn.style.background, 'rgba(6, 33, 25, 0.25)');
  assertEqual(btn.style.color, 'rgba(6, 33, 25, 0.55)');
});

test('[due pill] simplified two-state system: "this cycle" (smart due date) is accent-colored, any other date is neutral, and a missing amount always overrides to "Amount needed"', () => {
  const smartStr = fmtDateInput(getSmartDueDate());
  const laterStr = fmtDateInput(new Date(new Date(smartStr).getTime() + 20 * 86400000));
  resetApp([
    makeBill({ name: 'ThisCycle', amount: 50, dueDate: smartStr }),
    makeBill({ name: 'Later', amount: 50, dueDate: laterStr }),
    makeBill({ name: 'NoAmountButDueNow', amount: null, dueDate: smartStr })
  ]);
  const html = el('unpaidListView').innerHTML;
  assertContains(html, `background:${DARK.accent};color:#fff`, 'this-cycle due pill should be accent-colored');
  assertContains(html, 'Amount needed', 'a missing amount always shows "Amount needed" even if the due date is this cycle');
});

test('[running balance] computed over the full unfiltered bill list in original order, not the search-narrowed list', () => {
  const bills = [
    makeBill({ name: 'AAA First', amount: 100, paid: false }),
    makeBill({ name: 'BBB Second', amount: 200, paid: false }),
    makeBill({ name: 'CCC Third', amount: 300, paid: false })
  ];
  resetApp(bills, { startingBalance: '10000', expectedIncome: '0' });
  el('searchBills').value = 'ccc'; // narrow the visible list down to just the third bill
  el('searchBills').dispatchEvent(new Event('input'));
  // Running total after "CCC Third" must still reflect it being third in line behind the other
  // two unpaid bills (10000 - 100 - 200 = 9700 before it), not treat it as if it were first (10000).
  assertContains(el('unpaidListView').innerHTML, 'leaves you $9,700');
  assertNotContains(el('unpaidListView').innerHTML, 'leaves you $10,000');
});

test('[category colors] the five named categories use the fixed semantic map from the handoff, not the cycling fallback', () => {
  assertEqual(categoryStyle('Housing', DARK).color, DARK.primary);
  assertEqual(categoryStyle('Insurance', DARK).color, DARK.amber);
  assertEqual(categoryStyle('Savings', DARK).color, DARK.amber);
  assertEqual(categoryStyle('Credit Card', DARK).color, DARK.success);
  assertEqual(categoryStyle('Shopping', DARK).color, DARK.accent);
});

test('[category colors] categories outside the fixed map still fall back to the pre-existing cycling CAT_PALETTE', () => {
  const idx = CATEGORIES.indexOf('Utilities');
  const expected = CAT_PALETTE[idx % CAT_PALETTE.length];
  assertEqual(categoryStyle('Utilities', DARK).color, DARK[expected.colorKey]);
});

test('[pie-only deep amber] the donut\'s Insurance slice uses the fixed #D68A00, distinct from its own badge color (theme amber)', () => {
  const bill = makeBill({ name: 'Ins', amount: 200, category: 'Insurance' });
  const donut = computeDonut([bill], DARK);
  assertContains(donut.legendHtml, `background:${PIE_INSURANCE_COLOR}`);
  assertNotContains(donut.legendHtml, `background:${DARK.amber}`, 'the pie slice must not reuse the row-badge amber, or it would be indistinguishable from Savings');
});

test('[startNewMonth no longer deletes bills] a paid, non-recurring bill survives Start New Month — this inverts the old app\'s behavior on purpose', () => {
  const paidOneTime = makeBill({ name: 'PaidOneTime', amount: 200, paid: true, recurring: false });
  resetApp([paidOneTime]);
  startNewMonthConfirm();
  el('confirmActionBtn').click();
  assertEqual(state.bills.length, 1, 'the bill must still exist — it must NOT be deleted the way the pre-Cockpit app used to');
  assertEqual(state.bills[0].name, 'PaidOneTime');
  assertFalse(state.bills[0].paid);
  assertEqual(state.bills[0].amount, null);
});

test('[history cap] Start New Month never lets history exceed 12 entries', () => {
  const seed = [];
  for (let i = 0; i < 12; i++) seed.push({ label: 'H' + i, totalBills: 10, totalPaid: 10 });
  resetApp([makeBill({ amount: 10, paid: true })], { history: seed });
  startNewMonthConfirm();
  el('confirmActionBtn').click();
  assertEqual(state.history.length, 12);
});

test('[null amount is never payable] attemptPay/toggleBillPaid/payAllUnpaid all treat amount:null as unpayable, not a floor breach', () => {
  const b = makeBill({ name: 'NoAmount', amount: null, paid: false });
  resetApp([b], { startingBalance: '100', expectedIncome: '0' }); // balance is already under the floor
  assertTrue(attemptPay(b.id), 'attemptPay should report success (no-op) rather than blocking, since there is nothing to pay');
  assertEqual(state.blocked, null, 'a null-amount bill must never trigger the floor-stop notice');
  toggleBillPaid(b.id);
  assertFalse(findBill(b.id).paid);
  payAllUnpaid();
  assertFalse(findBill(b.id).paid);
  assertEqual(state.blocked, null);
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
// element.style.color / .style.background normalize hex to rgb() once set in a real browser.
function hexToRgbForCompare(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xFF, g = (num >> 8) & 0xFF, b = num & 0xFF;
  return `rgb(${r}, ${g}, ${b})`;
}
