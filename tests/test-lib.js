// Minimal dependency-free test harness for the Bill Tracker app.
// Runs directly in a browser (open the html file) or headlessly via run-tests.sh.
window.__tests = [];

function test(name, fn) { window.__tests.push({ name, fn }); }

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ' — ' : '') + 'expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
  }
}
function assertClose(actual, expected, epsilon, msg) {
  epsilon = epsilon == null ? 0.001 : epsilon;
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error((msg ? msg + ' — ' : '') + 'expected ~' + expected + ' but got ' + actual);
  }
}
function assertTrue(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy value'); }
function assertFalse(cond, msg) { if (cond) throw new Error(msg || 'expected falsy value'); }
function assertContains(haystack, needle, msg) {
  if (String(haystack).indexOf(needle) === -1) {
    throw new Error((msg ? msg + ' — ' : '') + JSON.stringify(haystack) + ' does not contain ' + JSON.stringify(needle));
  }
}
function assertNotContains(haystack, needle, msg) {
  if (String(haystack).indexOf(needle) !== -1) {
    throw new Error((msg ? msg + ' — ' : '') + JSON.stringify(haystack) + ' unexpectedly contains ' + JSON.stringify(needle));
  }
}

// Resets the live app (loaded via fixture.js + app.js in the same page) to a known baseline
// before each test, so tests don't leak state into one another.
function resetApp(bills, opts) {
  opts = opts || {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(OLD_STORAGE_KEY);
  localStorage.removeItem(OLD_THEME_KEY);
  state.bills = bills || [];
  state.history = opts.history || [];
  state.isLight = !!opts.isLight;
  state.view = 'list';
  state.calOffset = 0;
  state.toasts = [];
  el('startingBalance').value = opts.startingBalance != null ? opts.startingBalance : '1000';
  el('expectedIncome').value = opts.expectedIncome != null ? opts.expectedIncome : '0';
  el('searchBills').value = '';
  el('filterStatus').value = 'all';
  closeAddModal();
  closeConfirmModal();
  closeStopModal();
  render();
}

function makeBill(overrides) {
  return Object.assign({
    id: uid(), name: 'Test Bill', amount: 100, paid: false,
    confirmationNumber: '', dueDate: fmtDateInput(new Date()), category: 'Other', recurring: false
  }, overrides || {});
}

async function runAll(suiteName) {
  const results = [];
  for (const t of window.__tests) {
    try {
      await t.fn();
      results.push({ name: t.name, pass: true });
    } catch (e) {
      results.push({ name: t.name, pass: false, message: e.message, stack: e.stack });
    }
  }
  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  const summary = { suite: suiteName, total: results.length, passed, failed, failures: results.filter(r => !r.pass) };

  const out = document.getElementById('results');
  const rows = results.map(r =>
    `<div style="padding:4px 0;color:${r.pass ? '#1FAE7E' : '#D62A2A'}">${r.pass ? '✓' : '✗'} ${escapeHtmlSafe(r.name)}` +
    (r.pass ? '' : `<div style="margin-left:20px;color:#D62A2A;font-family:monospace;font-size:.85em">${escapeHtmlSafe(r.message)}</div>`) +
    `</div>`
  ).join('');
  out.innerHTML = `<h2 style="color:${failed ? '#D62A2A' : '#1FAE7E'}">${suiteName}: ${passed}/${results.length} passed</h2>` + rows;
  document.title = `${failed ? 'FAIL' : 'PASS'} (${passed}/${results.length}) — ${suiteName}`;

  const ms = document.getElementById('machine-summary');
  if (ms) ms.textContent = JSON.stringify(summary);
  console.log(`${suiteName}: ${passed}/${results.length} passed`);
  if (failed) results.filter(r => !r.pass).forEach(r => console.error(r.name + ': ' + r.message));
  return summary;
}

function escapeHtmlSafe(text) {
  const d = document.createElement('div');
  d.textContent = text == null ? '' : String(text);
  return d.innerHTML;
}
