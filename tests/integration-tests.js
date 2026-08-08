// Integration tests: multi-step workflows driven through the real DOM + global app functions,
// exercised against the exact markup from index.html (see fixture.js).

test('init() seeds 11 default bills when no saved data exists', () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OLD_STORAGE_KEY);
  init();
  assertEqual(state.bills.length, 11);
  assertEqual(state.bills[0].name, 'Rent');
});

test('stat cards reflect totals after reset', () => {
  resetApp([makeBill({ amount: 100, paid: true }), makeBill({ amount: 200, paid: false })]);
  assertEqual(el('statTotalBills').textContent, '$300.00');
  assertEqual(el('statPaid').textContent, '$100.00');
  assertEqual(el('statRemaining').textContent, '$200.00');
  assertEqual(el('statProgress').textContent, '33%');
});

test('adding a bill via the Add modal appends it to the rendered list', () => {
  resetApp([]);
  openAddModal();
  assertTrue(el('addModalOverlay').classList.contains('show'));
  el('addName').value = 'Electric Bill';
  el('addAmount').value = '40+10';
  el('addCategory').value = 'Utilities';
  el('addDueDate').value = '2026-09-15';
  submitAddBill();
  assertFalse(el('addModalOverlay').classList.contains('show'), 'modal should close on submit');
  assertEqual(state.bills.length, 1);
  assertEqual(state.bills[0].amount, 50);
  assertContains(el('billsListView').innerHTML, 'Electric Bill');
});

test('submitAddBill ignores submissions with a blank name', () => {
  resetApp([]);
  openAddModal();
  el('addName').value = '   ';
  submitAddBill();
  assertEqual(state.bills.length, 0);
});

test('marking a bill paid updates balance, progress, and running balance', () => {
  const b = makeBill({ name: 'Rent', amount: 300, paid: false });
  resetApp([b], { startingBalance: '2000', expectedIncome: '0' });
  toggleBillPaid(b.id);
  assertTrue(findBill(b.id).paid);
  assertEqual(el('balanceAmount').textContent, '$1,700.00');
  assertEqual(el('progressCountLabel').textContent, '1 / 1');
  assertContains(el('billsListView').innerHTML, '$1,700.00');
});

test('un-paying a bill restores the balance', () => {
  const b = makeBill({ name: 'Rent', amount: 300, paid: true });
  resetApp([b], { startingBalance: '2000', expectedIncome: '0' });
  toggleBillPaid(b.id);
  assertFalse(findBill(b.id).paid);
  assertEqual(el('balanceAmount').textContent, '$2,000.00');
});

test('paying a bill that would breach MIN_BALANCE opens the stop modal and leaves the bill unpaid', () => {
  const b = makeBill({ name: 'Big Bill', amount: 500, paid: false });
  resetApp([b], { startingBalance: '1000', expectedIncome: '0' }); // 1000 - 500 = 500 < 900
  toggleBillPaid(b.id);
  assertFalse(findBill(b.id).paid, 'bill should remain unpaid');
  assertTrue(el('stopModalOverlay').classList.contains('show'));
  assertEqual(el('stopBalance').textContent, '$500.00');
  closeStopModal();
  assertFalse(el('stopModalOverlay').classList.contains('show'));
});

test('search filters the rendered bill list by name substring', () => {
  resetApp([makeBill({ name: 'Netflix' }), makeBill({ name: 'Water Bill' })]);
  el('searchBills').value = 'net';
  el('searchBills').dispatchEvent(new Event('input'));
  assertContains(el('billsListView').innerHTML, 'Netflix');
  assertNotContains(el('billsListView').innerHTML, 'Water Bill');
});

test('status filter "overdue" shows only unpaid bills with a past due date', () => {
  const past = fmtDateInput(new Date(Date.now() - 5 * 86400000));
  const future = fmtDateInput(new Date(Date.now() + 5 * 86400000));
  resetApp([
    makeBill({ name: 'Overdue One', dueDate: past, paid: false }),
    makeBill({ name: 'Future One', dueDate: future, paid: false }),
    makeBill({ name: 'Paid Old One', dueDate: past, paid: true })
  ]);
  el('filterStatus').value = 'overdue';
  el('filterStatus').dispatchEvent(new Event('change'));
  const html = el('billsListView').innerHTML;
  assertContains(html, 'Overdue One');
  assertNotContains(html, 'Future One');
  assertNotContains(html, 'Paid Old One');
});

test('deleteBillConfirm removes the bill only after confirming', () => {
  const b = makeBill({ name: 'To Delete' });
  resetApp([b]);
  deleteBillConfirm(b.id);
  assertTrue(el('confirmModalOverlay').classList.contains('show'));
  assertEqual(state.bills.length, 1, 'bill should still exist before confirming');
  el('confirmActionBtn').click();
  assertEqual(state.bills.length, 0);
  assertFalse(el('confirmModalOverlay').classList.contains('show'));
});

test('deleteBillConfirm keeps the bill if the user cancels', () => {
  const b = makeBill({ name: 'Keep Me' });
  resetApp([b]);
  deleteBillConfirm(b.id);
  closeConfirmModal();
  assertEqual(state.bills.length, 1);
});

test('startNewMonthConfirm rolls recurring bills forward and drops paid one-time bills', () => {
  const recurring = makeBill({ name: 'Recurring', dueDate: '2026-03-10', paid: true, confirmationNumber: 'ABC', recurring: true });
  const oneTimePaid = makeBill({ name: 'OneTimePaid', paid: true, recurring: false });
  const oneTimeUnpaid = makeBill({ name: 'OneTimeUnpaid', paid: false, recurring: false });
  resetApp([recurring, oneTimePaid, oneTimeUnpaid]);
  startNewMonthConfirm();
  assertTrue(el('confirmModalOverlay').classList.contains('show'));
  el('confirmActionBtn').click();

  const names = state.bills.map(b => b.name);
  assertContains(names.join(','), 'Recurring');
  assertContains(names.join(','), 'OneTimeUnpaid');
  assertNotContains(names.join(','), 'OneTimePaid');

  const rolled = state.bills.find(b => b.name === 'Recurring');
  assertFalse(rolled.paid);
  assertEqual(rolled.confirmationNumber, '');
  assertEqual(rolled.dueDate, '2026-04-15');
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

test('switching to calendar view renders a grid with a bill chip on its due date', () => {
  const today = fmtDateInput(new Date());
  resetApp([makeBill({ name: 'CalBill', dueDate: today, paid: false })]);
  setView('calendar');
  assertEqual(el('calendarView').style.display, '');
  assertEqual(el('billsListView').style.display, 'none');
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

test('exportCSV produces a header row plus one row per bill', () => {
  resetApp([makeBill({ name: 'CSV Bill', amount: 42, category: 'Other', recurring: false })]);
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
  });
});

test('downloadBackup produces JSON containing bills, history, and balances', () => {
  resetApp([makeBill({ name: 'Backup Bill' })], { startingBalance: '555', expectedIncome: '10', history: [{ label: 'X', totalBills: 1, totalPaid: 1 }] });
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
    assertEqual(data.history.length, 1);
  });
});

test('handleImportFile replaces state from a backup JSON file', () => {
  resetApp([makeBill({ name: 'Old Bill' })]);
  const payload = {
    startingBalance: '999',
    expectedIncome: '20',
    bills: [{ name: 'Imported Bill', amount: 75, paid: false, dueDate: '2026-05-01', category: 'Shopping' }],
    history: [{ label: 'Imp', totalBills: 75, totalPaid: 0 }]
  };
  const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
  return new Promise((resolve, reject) => {
    handleImportFile({ target: { files: [file], value: '' } });
    setTimeout(() => {
      try {
        assertEqual(state.bills.length, 1);
        assertEqual(state.bills[0].name, 'Imported Bill');
        assertTrue(!!state.bills[0].id, 'imported bill should get an id assigned');
        assertEqual(el('startingBalance').value, '999');
        assertEqual(el('expectedIncome').value, '20');
        resolve();
      } catch (e) { reject(e); }
    }, 50);
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
