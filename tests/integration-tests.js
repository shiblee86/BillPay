// Integration tests: multi-step workflows driven through the real DOM + global app functions,
// exercised against the exact markup from index.html (see fixture.js).

test('init() seeds 11 default bills when no saved data exists', () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OLD_STORAGE_KEY);
  init();
  assertEqual(state.bills.length, 11);
  assertEqual(state.bills[0].name, 'Rent');
});

test('header note and rail figures reflect totals after reset', () => {
  resetApp([makeBill({ amount: 100, paid: true }), makeBill({ amount: 200, paid: false })], { startingBalance: '1000', expectedIncome: '0' });
  assertEqual(el('headerNote').textContent, '2 of 2 bills have amounts · 1 paid · next due ' + shortDateLabel(fmtDateInput(new Date())));
  // balance = 1000 - 100(paid) = 900; owed = 200; projected = 700; savings = max(0, 700-900) = 0
  assertEqual(el('projectedFigure').textContent, '$700.00');
  assertEqual(el('savingsFigure').textContent, '$0');
});

test('adding a bill via the modal appends it to the Unpaid list', () => {
  resetApp([]);
  openAddModal();
  assertTrue(el('addModalOverlay').classList.contains('show'));
  el('addName').value = 'Electric Bill';
  el('addAmount').value = '40+10';
  el('addCategory').value = 'Utilities';
  el('addDueDate').value = '2026-09-15';
  submitBillModal();
  assertFalse(el('addModalOverlay').classList.contains('show'), 'modal should close on submit');
  assertEqual(state.bills.length, 1);
  assertEqual(state.bills[0].amount, 50);
  assertContains(el('unpaidListView').innerHTML, 'Electric Bill');
});

test('adding a bill with a blank amount field stores it as null, not zero', () => {
  resetApp([]);
  openAddModal();
  el('addName').value = 'Mystery Bill';
  el('addAmount').value = '';
  submitBillModal();
  assertEqual(state.bills[0].amount, null);
});

test('submitBillModal ignores submissions with a blank name', () => {
  resetApp([]);
  openAddModal();
  el('addName').value = '   ';
  submitBillModal();
  assertEqual(state.bills.length, 0);
});

test('the "⋯" button opens the edit modal pre-filled, and saving updates the bill in place', () => {
  const b = makeBill({ name: 'Old Name', amount: 50, category: 'Shopping', recurring: false });
  resetApp([b]);
  openEditModal(b.id);
  assertTrue(el('addModalOverlay').classList.contains('show'));
  assertEqual(el('addName').value, 'Old Name');
  assertEqual(el('addAmount').value, '50');
  el('addName').value = 'New Name';
  el('addAmount').value = '75';
  submitBillModal();
  assertEqual(findBill(b.id).name, 'New Name');
  assertEqual(findBill(b.id).amount, 75);
  assertFalse(el('addModalOverlay').classList.contains('show'));
});

test('deleting from the edit modal routes through the existing confirm modal', () => {
  const b = makeBill({ name: 'To Delete' });
  resetApp([b]);
  openEditModal(b.id);
  deleteFromEditModal();
  assertFalse(el('addModalOverlay').classList.contains('show'), 'edit modal should close first');
  assertTrue(el('confirmModalOverlay').classList.contains('show'));
  assertEqual(state.bills.length, 1, 'bill should still exist before confirming');
  el('confirmActionBtn').click();
  assertEqual(state.bills.length, 0);
});

test('marking a bill paid moves it from the Unpaid list into the Paid list', () => {
  const b = makeBill({ name: 'Rent', amount: 300, paid: false });
  resetApp([b], { startingBalance: '2000', expectedIncome: '0' });
  toggleBillPaid(b.id);
  assertTrue(findBill(b.id).paid);
  assertContains(el('paidListView').innerHTML, 'Rent');
  assertNotContains(el('unpaidListView').innerHTML, 'Rent');
  assertEqual(document.querySelectorAll('.paid-row').length, 1);
  assertEqual(document.querySelectorAll('.bill-row').length, 0);
  assertEqual(el('projectedFigure').textContent, '$1,700.00');
});

test('un-paying a bill (green check in Paid) moves it back to Unpaid and clears its confirmation number', () => {
  const b = makeBill({ name: 'Rent', amount: 300, paid: true, confirmationNumber: 'ABC123' });
  resetApp([b], { startingBalance: '2000', expectedIncome: '0' });
  assertContains(el('paidListView').innerHTML, 'Rent');
  toggleBillPaid(b.id);
  assertFalse(findBill(b.id).paid);
  assertEqual(findBill(b.id).confirmationNumber, '');
  assertContains(el('unpaidListView').innerHTML, 'Rent');
  assertNotContains(el('paidListView').innerHTML, 'Rent');
});

test('a bill with no amount cannot be paid, is excluded from owed/savings, and shows an "Amount needed" chip', () => {
  const priced = makeBill({ name: 'Priced', amount: 500, paid: false });
  const unpriced = makeBill({ name: 'Unpriced', amount: null, paid: false });
  resetApp([priced, unpriced], { startingBalance: '5000', expectedIncome: '0' });

  assertContains(el('unpaidListView').innerHTML, 'Amount needed');
  assertContains(el('unpaidListView').innerHTML, 'Not set');

  const { owed, projected, savings } = computeFigures();
  assertClose(owed, 500, 0.001, 'owed should only count the priced bill');
  assertClose(projected, 5000 - 500);
  assertClose(savings, 5000 - 500 - 900);

  toggleBillPaid(unpriced.id);
  assertFalse(findBill(unpriced.id).paid, 'a null-amount bill must never become payable');
});

test('a null-amount bill is excluded from the category donut total', () => {
  const priced = makeBill({ name: 'Priced', amount: 400, category: 'Housing', paid: false });
  const unpriced = makeBill({ name: 'Unpriced', amount: null, category: 'Housing', paid: false });
  resetApp([priced, unpriced]);
  const donut = computeDonut(state.bills, theme());
  assertEqual(donut.total, 400);
});

test('paying a bill that would breach the $900 floor is refused and shows the inline notice naming the bill', () => {
  const b = makeBill({ name: 'Big Bill', amount: 500, paid: false });
  resetApp([b], { startingBalance: '1000', expectedIncome: '0' }); // 1000 - 500 = 500 < 900
  toggleBillPaid(b.id);
  assertFalse(findBill(b.id).paid, 'bill should remain unpaid');
  assertEqual(el('blockedNotice').style.display, 'flex');
  assertEqual(el('blockedLine').textContent, 'Paying Big Bill ($500.00) would leave $500.00 — under your $900 floor. Left unpaid.');
  assertContains(el('unpaidListView').innerHTML, 'Big Bill', 'the bill should still be listed as unpaid');
  dismissBlocked();
  assertEqual(el('blockedNotice').style.display, 'none');
});

test('"Pay all" pays bills in order and stops at the first one that would breach the floor', () => {
  const first = makeBill({ name: 'First', amount: 700, paid: false });
  const second = makeBill({ name: 'Second', amount: 300, paid: false });
  resetApp([first, second], { startingBalance: '1000', expectedIncome: '0' });
  // Paying First: 1000-700=300 < 900 -> blocked immediately, Second never attempted.
  payAllUnpaid();
  assertFalse(findBill(first.id).paid);
  assertFalse(findBill(second.id).paid);
  assertEqual(state.blocked.name, 'First');
});

test('"Pay all" pays every affordable bill up to the one that breaches the floor', () => {
  const first = makeBill({ name: 'Small', amount: 50, paid: false });
  const second = makeBill({ name: 'Big', amount: 5000, paid: false });
  resetApp([first, second], { startingBalance: '1000', expectedIncome: '0' });
  payAllUnpaid();
  assertTrue(findBill(first.id).paid, 'the affordable bill should be paid');
  assertFalse(findBill(second.id).paid, 'the unaffordable bill should be left unpaid');
  assertEqual(state.blocked.name, 'Big');
});

test('"Pay all" never attempts bills with no amount', () => {
  const priced = makeBill({ name: 'Priced', amount: 50, paid: false });
  const unpriced = makeBill({ name: 'Unpriced', amount: null, paid: false });
  resetApp([priced, unpriced], { startingBalance: '5000', expectedIncome: '0' });
  payAllUnpaid();
  assertTrue(findBill(priced.id).paid);
  assertFalse(findBill(unpriced.id).paid);
  assertEqual(state.blocked, null);
});

test('search filters the rendered Unpaid list by name substring', () => {
  resetApp([makeBill({ name: 'Netflix' }), makeBill({ name: 'Water Bill' })]);
  el('searchBills').value = 'net';
  el('searchBills').dispatchEvent(new Event('input'));
  assertContains(el('unpaidListView').innerHTML, 'Netflix');
  assertNotContains(el('unpaidListView').innerHTML, 'Water Bill');
});

test('status filter "overdue" shows only unpaid, priced bills with a past due date', () => {
  const past = fmtDateInput(new Date(Date.now() - 5 * 86400000));
  const future = fmtDateInput(new Date(Date.now() + 5 * 86400000));
  resetApp([
    makeBill({ name: 'Overdue One', dueDate: past, amount: 50, paid: false }),
    makeBill({ name: 'Future One', dueDate: future, amount: 50, paid: false }),
    makeBill({ name: 'Paid Old One', dueDate: past, amount: 50, paid: true })
  ]);
  el('filterStatus').value = 'overdue';
  el('filterStatus').dispatchEvent(new Event('change'));
  const html = el('unpaidListView').innerHTML;
  assertContains(html, 'Overdue One');
  assertNotContains(html, 'Future One');
  assertNotContains(el('paidListView').innerHTML, 'Paid Old One', 'paid bills live in the Paid list regardless of filter match');
});

test('status filter "no-amount" shows only bills without an amount', () => {
  resetApp([makeBill({ name: 'Has Amount', amount: 50 }), makeBill({ name: 'No Amount', amount: null })]);
  el('filterStatus').value = 'no-amount';
  el('filterStatus').dispatchEvent(new Event('change'));
  const html = el('unpaidListView').innerHTML;
  assertContains(html, 'No Amount');
  assertNotContains(html, 'Has Amount');
});

test('startNewMonthConfirm keeps every bill and its name, clearing only amount, confirmationNumber and paid', () => {
  const recurring = makeBill({ name: 'Recurring', amount: 100, dueDate: '2026-03-10', paid: true, confirmationNumber: 'ABC', recurring: true, category: 'Housing' });
  const oneTimePaid = makeBill({ name: 'OneTimePaid', amount: 200, paid: true, confirmationNumber: 'XYZ', recurring: false });
  const oneTimeUnpaid = makeBill({ name: 'OneTimeUnpaid', amount: 300, paid: false, recurring: false, dueDate: '2026-05-01' });
  resetApp([recurring, oneTimePaid, oneTimeUnpaid]);
  const idsBefore = state.bills.map(b => b.id).sort();

  startNewMonthConfirm();
  assertTrue(el('confirmModalOverlay').classList.contains('show'));
  el('confirmActionBtn').click();

  assertEqual(state.bills.length, 3, 'no bill should be deleted, including paid one-time bills');
  assertEqual(state.bills.map(b => b.id).sort().join(','), idsBefore.join(','), 'the same bills should survive (by id)');
  assertEqual(state.bills.map(b => b.name).sort().join(','), 'OneTimePaid,OneTimeUnpaid,Recurring', 'every name is preserved');

  state.bills.forEach(b => {
    assertFalse(b.paid, b.name + ' should be marked unpaid');
    assertEqual(b.confirmationNumber, '', b.name + ' confirmation number should be cleared');
    assertEqual(b.amount, null, b.name + ' amount should be cleared to null');
  });

  const rolled = state.bills.find(b => b.name === 'Recurring');
  assertEqual(rolled.dueDate, '2026-04-15', 'recurring bill due date should roll forward');
  const untouched = state.bills.find(b => b.name === 'OneTimeUnpaid');
  assertEqual(untouched.dueDate, '2026-05-01', 'non-recurring bill due date is left as-is');
});

test('startNewMonthConfirm archives totals into history, capped at 12 entries', () => {
  const seedHistory = [];
  for (let i = 0; i < 12; i++) seedHistory.push({ label: 'M' + i, totalBills: 100, totalPaid: 50 });
  resetApp([makeBill({ amount: 200, paid: true })], { history: seedHistory });
  startNewMonthConfirm();
  el('confirmActionBtn').click();
  assertEqual(state.history.length, 12, 'history should stay capped at 12');
  assertEqual(state.history[state.history.length - 1].totalBills, 200);
  assertEqual(state.history[0].label, 'M1', 'oldest entry should have been dropped');
});

test('switching to calendar view hides the Unpaid/Paid lists and renders a bill chip on its due date', () => {
  const today = fmtDateInput(new Date());
  resetApp([makeBill({ name: 'CalBill', dueDate: today, paid: false })]);
  setView('calendar');
  assertEqual(el('calendarView').style.display, '');
  assertEqual(el('unpaidSection').style.display, 'none');
  assertContains(el('calendarView').innerHTML, 'CalBill');
  setView('list');
});

test('toggleTheme flips isLight, persists it, and updates CSS custom properties', () => {
  resetApp([]);
  const wasLight = state.isLight;
  toggleTheme();
  assertEqual(state.isLight, !wasLight);
  assertEqual(localStorage.getItem(THEME_KEY), state.isLight ? 'light' : 'dark');
  const expectedPrimary = (state.isLight ? LIGHT : DARK).primary;
  assertEqual(document.documentElement.style.getPropertyValue('--primary'), expectedPrimary);
  toggleTheme(); // restore
});

test('exportCSV produces a header row plus one row per bill, blank (not "null") for a missing amount', () => {
  resetApp([makeBill({ name: 'CSV Bill', amount: 42, category: 'Other', recurring: false }), makeBill({ name: 'No Amount Bill', amount: null })]);
  let captured = null;
  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return 'blob:mock'; };
  try {
    exportCSV();
  } finally {
    URL.createObjectURL = originalCreate;
  }
  assertTrue(captured instanceof Blob);
  return captured.text().then(text => {
    const lines = text.trim().split('\n');
    assertEqual(lines[0], 'Bill Name,Amount,Paid,Confirmation Number,Due Date,Category,Recurring,Status');
    assertContains(lines[1], 'CSV Bill');
    assertNotContains(lines[2], 'null');
  });
});

test('downloadBackup produces JSON containing bills (including null amounts), history, and balances', () => {
  resetApp([makeBill({ name: 'Backup Bill', amount: null })], { startingBalance: '555', expectedIncome: '10', history: [{ label: 'X', totalBills: 1, totalPaid: 1 }] });
  let captured = null;
  const originalCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return 'blob:mock'; };
  try {
    downloadBackup();
  } finally {
    URL.createObjectURL = originalCreate;
  }
  return captured.text().then(text => {
    const data = JSON.parse(text);
    assertEqual(data.startingBalance, '555');
    assertEqual(data.expectedIncome, '10');
    assertEqual(data.bills.length, 1);
    assertEqual(data.bills[0].name, 'Backup Bill');
    assertEqual(data.bills[0].amount, null);
    assertEqual(data.history.length, 1);
  });
});

test('handleImportFile replaces state from a backup JSON file and normalizes a missing amount to null', () => {
  resetApp([makeBill({ name: 'Old Bill' })]);
  const payload = {
    startingBalance: '999',
    expectedIncome: '20',
    bills: [{ name: 'Imported Bill', paid: false, dueDate: '2026-05-01', category: 'Shopping' }],
    history: [{ label: 'Imp', totalBills: 75, totalPaid: 0 }]
  };
  const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
  return new Promise((resolve, reject) => {
    handleImportFile({ target: { files: [file], value: '' } });
    setTimeout(() => {
      try {
        assertEqual(state.bills.length, 1);
        assertEqual(state.bills[0].name, 'Imported Bill');
        assertEqual(state.bills[0].amount, null, 'a missing amount field should normalize to null, not 0');
        assertTrue(!!state.bills[0].id, 'imported bill should get an id assigned');
        assertEqual(el('startingBalance').value, '999');
        assertEqual(el('expectedIncome').value, '20');
        resolve();
      } catch (e) { reject(e); }
    }, 200);
  });
});

test('init() migrates bills from the legacy app localStorage key when present', () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify({
    startingBalance: '4321.00',
    expectedIncome: '0',
    bills: [{ name: 'Legacy Bill', amount: 88, paid: true, dueDate: '2026-01-15', category: 'Housing' }]
  }));
  init();
  assertEqual(state.bills.length, 1);
  assertEqual(state.bills[0].name, 'Legacy Bill');
  assertEqual(state.bills[0].amount, 88);
  assertEqual(state.bills[0].recurring, false, 'migrated bills default recurring to false');
  assertTrue(!!state.bills[0].id);
  assertEqual(el('startingBalance').value, '4321.00');
  localStorage.removeItem(OLD_STORAGE_KEY);
});

test('persistData writes bills and balances to localStorage under the current keys', () => {
  resetApp([makeBill({ name: 'Persisted' })], { startingBalance: '321', expectedIncome: '5' });
  persistData();
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assertEqual(saved.bills[0].name, 'Persisted');
  assertEqual(saved.startingBalance, '321');
  assertEqual(saved.expectedIncome, '5');
});
