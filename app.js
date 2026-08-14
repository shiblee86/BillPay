const CATEGORIES = ['Housing','Utilities','Insurance','Credit Card','Subscription','Shopping','Savings','Other'];
const MIN_BALANCE = 900;
const STORAGE_KEY = 'billTracker_v3_data';
const HISTORY_KEY = 'billTracker_v3_history';
const THEME_KEY = 'billTracker_v3_theme';
const OLD_STORAGE_KEY = 'billTrackerData';
const OLD_THEME_KEY = 'darkMode';

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtDateInput(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
// `new Date('YYYY-MM-DD')` parses as UTC midnight; reading local getDate()/getMonth() back
// off that in any timezone west of UTC returns the previous calendar day. Parse manually
// as local-time fields instead whenever we need to read the date back apart.
function parseLocalDate(str){
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function smartDueDateForMonth(year, month, before15){
  if (before15) return new Date(year, month, 15);
  const lastDay = new Date(year, month+1, 0).getDate();
  return new Date(year, month, Math.min(30, lastDay));
}
function getSmartDueDate(){
  const t = new Date();
  return smartDueDateForMonth(t.getFullYear(), t.getMonth(), t.getDate() <= 15);
}
function fmtCurrency(n){
  n = Number(n) || 0;
  const neg = n < 0;
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '$' + abs;
}
// Whole-dollar shorthand used throughout the rail cards: "$645.00" -> "$645", but
// "$644.50" is left alone. Mirrors the design reference's own `short()` helper exactly.
function short(n){ return fmtCurrency(n).replace('.00',''); }
function shortDateLabel(dateStr){
  if (!dateStr) return '';
  return parseLocalDate(dateStr).toLocaleString('en-US', { month:'short', day:'numeric' });
}
function parseAmountExpr(raw){
  const sanitized = String(raw).replace(/[^0-9+\-*/.() ]/g, '');
  if (/[+\-*/]/.test(sanitized)) {
    try { return Function('"use strict";return (' + sanitized + ')')(); } catch (e) { return parseFloat(raw) || 0; }
  }
  return parseFloat(raw) || 0;
}
// Same expression parsing, but a blank field means "no amount yet" (null), not zero.
function parseAmountOrNull(raw){
  const trimmed = String(raw == null ? '' : raw).trim();
  if (trimmed === '') return null;
  return parseAmountExpr(raw);
}
// Used when loading bills from any source (current save, legacy save, imported backup):
// keep real stored numbers as-is, but treat missing/blank/non-numeric as null rather
// than silently coercing to 0.
function normalizeAmount(v){
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function uid(){ return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function escapeHtml(text){ const d = document.createElement('div'); d.textContent = text == null ? '' : text; return d.innerHTML; }
function shade(hex, amt){
  const num = parseInt(hex.replace('#',''), 16);
  let r = (num>>16) + amt, g = ((num>>8)&0xFF) + amt, b = (num&0xFF) + amt;
  r = Math.min(255,Math.max(0,r)); g = Math.min(255,Math.max(0,g)); b = Math.min(255,Math.max(0,b));
  return '#' + (0x1000000 + r*0x10000 + g*0x100 + b).toString(16).slice(1);
}

const DARK = {
  bg:'#0A1F1F', surface1:'#0D2828', surface2:'#123636', surfaceRaised:'#1B4747',
  borderSubtle:'#1B4747', borderStrong:'#275C5C',
  textPrimary:'#F4FBFB', textSecondary:'#A9C4C4', textMuted:'#6E8C8C',
  primary:'#17C7C7', accent:'#FF5C3D', amber:'#FFB020', success:'#2FE6A7', error:'#FF3B3B',
  textOnPrimary:'#0A1F1F', textOnAccent:'#2A0F08',
  shadowPrimary:'#0EA3A3', shadowAccent:'#E6432E', shadowNeutral:'#081716',
  shadowSuccess:'#17A97A', ink:'#062119', paidSurface:'#0A2222'
};
DARK.shadowAmber = shade(DARK.amber, -70);

const LIGHT = {
  bg:'#EAF6F6', surface1:'#FFFFFF', surface2:'#F1FAFA', surfaceRaised:'#FFFFFF',
  borderSubtle:'#CFE7E7', borderStrong:'#9FCFCF',
  textPrimary:'#0A1F1F', textSecondary:'#3B5C5C', textMuted:'#6E8C8C',
  primary:'#0EA3A3', accent:'#E6432E', amber:'#D68A00', success:'#1FAE7E', error:'#D62A2A',
  textOnPrimary:'#F4FBFB', textOnAccent:'#FFFFFF',
  shadowPrimary:'#0B8484', shadowAccent:'#C23522', shadowNeutral:'#B8D8D8',
  shadowSuccess:'#17A97A', ink:'#062119'
};
LIGHT.paidSurface = LIGHT.surface2;
LIGHT.shadowAmber = shade(LIGHT.amber, -60);

const CAT_PALETTE = [
  { bgD:'rgba(23,199,199,0.16)', bgL:'rgba(14,163,163,0.12)', colorKey:'primary' },
  { bgD:'rgba(255,92,61,0.16)', bgL:'rgba(230,67,46,0.12)', colorKey:'accent' },
  { bgD:'rgba(255,176,32,0.18)', bgL:'rgba(214,138,0,0.14)', colorKey:'amber' },
  { bgD:'rgba(47,230,167,0.16)', bgL:'rgba(31,174,126,0.12)', colorKey:'success' },
];
// Fixed semantic category colors from the Cockpit handoff (badges/pills). Categories not
// listed here (Utilities, Subscription, Other) fall back to the cycling CAT_PALETTE above.
const CAT_COLORS = {
  'Housing':     { colorKey:'primary', bg:'rgba(23,199,199,0.16)' },
  'Insurance':   { colorKey:'amber',   bg:'rgba(255,176,32,0.18)' },
  'Savings':     { colorKey:'amber',   bg:'rgba(255,176,32,0.18)' },
  'Credit Card': { colorKey:'success', bg:'rgba(47,230,167,0.16)' },
  'Shopping':    { colorKey:'accent',  bg:'rgba(255,92,61,0.16)' }
};
function categoryStyle(category, t){
  const c = CAT_COLORS[category];
  if (c) return { color: t[c.colorKey], bg: c.bg };
  const idx = Math.max(0, CATEGORIES.indexOf(category));
  const p = CAT_PALETTE[idx % CAT_PALETTE.length];
  return { color: t[p.colorKey], bg: state.isLight ? p.bgL : p.bgD };
}
// "Deep amber", pie-only per the handoff — deliberately not theme-swapped (the README
// gives one literal hex with no light-theme variant), used only to keep the Insurance
// slice visually distinct from the Savings slice, which shares the regular amber token.
const PIE_INSURANCE_COLOR = '#D68A00';
const PIE_CAT_ORDER = [
  { key:'Credit Card', name:'Credit cards', colorKey:'success' },
  { key:'Housing', name:'Housing', colorKey:'primary' },
  { key:'Savings', name:'Savings', colorKey:'amber' },
  { key:'Shopping', name:'Shopping', colorKey:'accent' },
  { key:'Insurance', name:'Insurance', colorHex: PIE_INSURANCE_COLOR }
];

let state = { bills:[], isLight:false, view:'list', calOffset:0, history:[], toasts:[], blocked:null };
let editingBillId = null;

function el(id){ return document.getElementById(id); }
function theme(){ return state.isLight ? LIGHT : DARK; }
function findBill(id){ return state.bills.find(b => b.id === id); }

function applyTheme(){
  const t = theme();
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--surface1', t.surface1);
  root.setProperty('--surface2', t.surface2);
  root.setProperty('--surface-raised', t.surfaceRaised);
  root.setProperty('--border-subtle', t.borderSubtle);
  root.setProperty('--border-strong', t.borderStrong);
  root.setProperty('--text-primary', t.textPrimary);
  root.setProperty('--text-secondary', t.textSecondary);
  root.setProperty('--text-muted', t.textMuted);
  root.setProperty('--primary', t.primary);
  root.setProperty('--accent', t.accent);
  root.setProperty('--amber', t.amber);
  root.setProperty('--success', t.success);
  root.setProperty('--error', t.error);
  root.setProperty('--text-on-primary', t.textOnPrimary);
  root.setProperty('--text-on-accent', t.textOnAccent);
  root.setProperty('--shadow-primary', t.shadowPrimary);
  root.setProperty('--shadow-accent', t.shadowAccent);
  root.setProperty('--shadow-neutral', t.shadowNeutral);
  root.setProperty('--shadow-amber', t.shadowAmber);
  root.setProperty('--shadow-success', t.shadowSuccess);
  root.setProperty('--ink', t.ink);
  root.setProperty('--paid-surface', t.paidSurface);
  el('themeToggleBtn').textContent = state.isLight ? '\u{1F319}' : '☀️';
  el('themeToggleBtn').title = state.isLight ? 'Switch to dark' : 'Switch to light';
}

function toggleTheme(){
  state.isLight = !state.isLight;
  localStorage.setItem(THEME_KEY, state.isLight ? 'light' : 'dark');
  render();
}

function setView(v){ state.view = v; render(); }

function persistData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    bills: state.bills,
    startingBalance: el('startingBalance').value,
    expectedIncome: el('expectedIncome').value
  }));
}
function persistHistory(){ localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history)); }

function addToast(msg){
  const id = uid();
  state.toasts.push({ id, msg });
  renderToasts();
  setTimeout(() => { state.toasts = state.toasts.filter(t => t.id !== id); renderToasts(); }, 3000);
}
function renderToasts(){
  el('toastStack').innerHTML = state.toasts.map(t => `<div class="toast">${escapeHtml(t.msg)}</div>`).join('');
}
function notAvailableYet(feature){ addToast(feature + " isn't available yet"); }

// Only paid bills with a real amount count against the balance; null-amount bills are
// never payable in the first place, but this stays defensive against odd imported data.
function calculateBalance(bills, starting, income){
  const paid = bills.filter(b => b.paid && b.amount != null).reduce((s,b) => s + b.amount, 0);
  return starting + income - paid;
}

// Single source of truth for the headline figures, used by render() and by anything
// (like the transfer button's click handler) that needs a fresh read outside of render.
function computeFigures(){
  const bills = state.bills;
  const starting = parseFloat(el('startingBalance').value) || 0;
  const income = parseFloat(el('expectedIncome').value) || 0;
  const balance = calculateBalance(bills, starting, income);
  const owed = bills.filter(b => !b.paid && b.amount != null).reduce((s,b) => s + b.amount, 0);
  const projected = balance - owed;
  const savings = Math.max(0, projected - MIN_BALANCE);
  return { bills, starting, income, balance, owed, projected, savings };
}

function updateBillField(id, field, value){
  const b = findBill(id); if (!b) return;
  b[field] = value;
  persistData();
  render();
}
function updateBillAmount(id, raw){
  const b = findBill(id); if (!b) return;
  b.amount = parseAmountOrNull(raw);
  persistData();
  render();
}

// Attempts to mark one bill paid against the *current* balance. Returns true on success.
// On failure it refuses the change and records state.blocked for the inline notice —
// it does not render or persist itself, so callers (single tick, Pay all) can batch.
function attemptPay(id){
  const b = findBill(id);
  if (!b || b.paid || b.amount == null) return true;
  const { balance } = computeFigures();
  const after = balance - b.amount;
  if (after < MIN_BALANCE) {
    state.blocked = { name: b.name, amount: b.amount, after };
    return false;
  }
  b.paid = true;
  state.blocked = null;
  return true;
}

function toggleBillPaid(id){
  const b = findBill(id); if (!b) return;
  if (b.paid) {
    b.paid = false;
    b.confirmationNumber = '';
    persistData();
    render();
    return;
  }
  if (b.amount == null) return;
  const ok = attemptPay(id);
  persistData();
  render();
  if (ok) addToast(`Paid ${b.name} for ${fmtCurrency(b.amount)}`);
}

function payAllUnpaid(){
  const ids = state.bills.filter(b => !b.paid && b.amount != null).map(b => b.id);
  for (const id of ids) {
    if (!attemptPay(id)) break;
  }
  persistData();
  render();
}

function dismissBlocked(){ state.blocked = null; render(); }

function showConfirmModal(title, message, action){
  el('confirmTitle').textContent = title;
  el('confirmMessage').textContent = message;
  const btn = el('confirmActionBtn');
  btn.onclick = () => { action(); closeConfirmModal(); };
  el('confirmModalOverlay').classList.add('show');
}
function closeConfirmModal(){ el('confirmModalOverlay').classList.remove('show'); }

function deleteBillConfirm(id){
  const b = findBill(id); if (!b) return;
  showConfirmModal('Delete bill', `Delete "${b.name}"? This can't be undone.`, () => {
    state.bills = state.bills.filter(x => x.id !== id);
    persistData();
    render();
    addToast('Bill deleted');
  });
}

function nextRecurringDueDate(oldStr){
  const old = oldStr ? parseLocalDate(oldStr) : new Date();
  const before15 = old.getDate() <= 15;
  let year = old.getFullYear(), month = old.getMonth() + 1;
  if (month > 11) { month = 0; year += 1; }
  return fmtDateInput(smartDueDateForMonth(year, month, before15));
}

function startNewMonthConfirm(){
  showConfirmModal('Start new month', "This archives this month's totals, rolls recurring bills to their next due date, and clears amounts, confirmation numbers and paid checkmarks for every bill.", () => {
    const bills = state.bills;
    const totalBills = bills.reduce((s,b) => s + (b.amount || 0), 0);
    const totalPaid = bills.filter(b => b.paid).reduce((s,b) => s + (b.amount || 0), 0);
    const label = new Date().toLocaleString('en-US', { month:'short', year:'2-digit' });
    state.history = [...state.history, { label, totalBills, totalPaid }].slice(-12);
    state.bills = bills.map(b => ({
      ...b,
      paid: false,
      confirmationNumber: '',
      amount: null,
      dueDate: b.recurring ? nextRecurringDueDate(b.dueDate) : b.dueDate
    }));
    state.blocked = null;
    persistData();
    persistHistory();
    render();
    addToast('New month started');
  });
}

function openAddModal(){
  editingBillId = null;
  el('addModalTitle').textContent = 'Add a bill';
  el('addModalSubmitBtn').textContent = 'Add bill';
  el('addModalDeleteBtn').style.display = 'none';
  el('addName').value = '';
  el('addAmount').value = '';
  el('addCategory').value = 'Other';
  el('addDueDate').value = fmtDateInput(getSmartDueDate());
  el('addRecurring').checked = false;
  el('addModalOverlay').classList.add('show');
}
function openEditModal(id){
  const b = findBill(id); if (!b) return;
  editingBillId = id;
  el('addModalTitle').textContent = 'Edit bill';
  el('addModalSubmitBtn').textContent = 'Save changes';
  el('addModalDeleteBtn').style.display = '';
  el('addName').value = b.name;
  el('addAmount').value = b.amount == null ? '' : String(b.amount);
  el('addCategory').value = b.category;
  el('addDueDate').value = b.dueDate || '';
  el('addRecurring').checked = !!b.recurring;
  el('addModalOverlay').classList.add('show');
}
function closeAddModal(){ el('addModalOverlay').classList.remove('show'); editingBillId = null; }
function submitBillModal(){
  const name = el('addName').value.trim();
  if (!name) return;
  const amount = parseAmountOrNull(el('addAmount').value);
  const category = el('addCategory').value;
  const dueDate = el('addDueDate').value || fmtDateInput(getSmartDueDate());
  const recurring = el('addRecurring').checked;
  if (editingBillId) {
    const b = findBill(editingBillId);
    if (b) Object.assign(b, { name, amount, category, dueDate, recurring });
    persistData();
    closeAddModal();
    render();
    addToast(`Updated "${name}"`);
  } else {
    state.bills.push({ id: uid(), name, amount, paid:false, confirmationNumber:'', dueDate, category, recurring });
    persistData();
    closeAddModal();
    render();
    addToast(amount == null ? `Added "${name}"` : `Added "${name}" for ${fmtCurrency(amount)}`);
  }
}
function deleteFromEditModal(){
  if (!editingBillId) return;
  const id = editingBillId;
  closeAddModal();
  deleteBillConfirm(id);
}

function downloadBlob(content, type, filename){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
function exportCSV(){
  const headers = ['Bill Name','Amount','Paid','Confirmation Number','Due Date','Category','Recurring','Status'];
  const todayStr = fmtDateInput(new Date());
  const rows = state.bills.map(b => [
    b.name,
    b.amount == null ? '' : b.amount,
    b.paid ? 'Yes' : 'No',
    b.confirmationNumber || '',
    b.dueDate || '',
    b.category,
    b.recurring ? 'Yes' : 'No',
    b.paid ? 'Paid' : (b.amount == null ? 'No amount' : (b.dueDate && b.dueDate < todayStr ? 'Overdue' : 'Pending'))
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => typeof v === 'string' && v.includes(',') ? `"${v}"` : v).join(',')).join('\n');
  downloadBlob(csv, 'text/csv', `bill_tracker_export_${todayStr}.csv`);
  addToast('CSV exported');
}
function downloadBackup(){
  const data = { startingBalance: el('startingBalance').value, expectedIncome: el('expectedIncome').value, bills: state.bills, history: state.history };
  downloadBlob(JSON.stringify(data, null, 2), 'application/json', `bill_tracker_backup_${fmtDateInput(new Date())}.json`);
  addToast('Backup downloaded');
}
function handleImportFile(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.bills || !Array.isArray(data.bills)) { addToast('Invalid backup file'); return; }
      state.bills = data.bills.map(b => ({ recurring:false, category:'Other', confirmationNumber:'', ...b, id: b.id || uid(), amount: normalizeAmount(b.amount) }));
      if (data.startingBalance != null) el('startingBalance').value = data.startingBalance;
      if (data.expectedIncome != null) el('expectedIncome').value = data.expectedIncome;
      state.history = data.history || state.history;
      state.blocked = null;
      persistData();
      persistHistory();
      render();
      addToast('Backup imported');
    } catch (err) { addToast('Error reading backup file'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function calNav(delta){ state.calOffset += delta; render(); }

function buildUnpaidRow(b, t, runAfter, todayStr, smartStr, balanceNow){
  const cs = categoryStyle(b.category, t);
  const hasAmount = b.amount != null;
  const wouldBreach = hasAmount && (balanceNow - b.amount < MIN_BALANCE);
  const dueThisCycle = hasAmount && b.dueDate === smartStr;
  let dueLabelText, dueBg, dueColor;
  if (!hasAmount) { dueLabelText = 'Amount needed'; dueBg = 'rgba(255,176,32,0.18)'; dueColor = t.amber; }
  else if (!b.dueDate) { dueLabelText = 'No date'; dueBg = t.surface2; dueColor = t.textSecondary; }
  else if (dueThisCycle) { dueLabelText = 'Due ' + shortDateLabel(b.dueDate); dueBg = t.accent; dueColor = '#fff'; }
  else { dueLabelText = 'Due ' + shortDateLabel(b.dueDate); dueBg = t.surface2; dueColor = t.textSecondary; }
  const cardBorder = dueThisCycle ? t.accent : t.borderStrong;
  const boxBorder = wouldBreach ? t.error : t.borderStrong;
  const amountColor = hasAmount ? t.textPrimary : t.textMuted;
  const runLabel = hasAmount ? ('leaves you ' + short(runAfter)) : 'not counted yet';
  const runColor = hasAmount ? (runAfter < MIN_BALANCE ? t.error : t.textMuted) : t.amber;
  const ampId = 'amt-' + b.id;
  const bottomRight = hasAmount
    ? `<span class="row-tag">Unpaid</span><button class="ghost-pill" type="button" onclick="notAvailableYet('Partial payments')">Part pay</button>`
    : `<button class="filled-pill" type="button" onclick="document.getElementById('${ampId}').focus()">Enter amount</button>`;

  return `
  <div class="bill-row" style="border:2px solid ${cardBorder}">
    <div class="bill-row-top">
      <label class="unpaid-check-wrap" title="Mark paid">
        <input type="checkbox" onchange="toggleBillPaid('${b.id}')">
        <span class="unpaid-check-box" style="border-color:${boxBorder}"></span>
      </label>
      <input type="text" class="row-name-input" value="${escapeHtml(b.name)}" placeholder="Name this bill" onchange="updateBillField('${b.id}','name',this.value)">
      <span class="pill" style="color:${cs.color};background:${cs.bg}">${escapeHtml(b.category)}</span>
      <span class="due-pill" style="background:${dueBg};color:${dueColor}">${dueLabelText}</span>
      ${b.recurring ? '<span title="Repeats monthly">\u{1F501}</span>' : ''}
      <div class="row-right">
        <div class="row-amount-wrap">
          ${hasAmount ? `<span class="row-amount-prefix" style="color:${amountColor}">$</span>` : ''}
          <input type="text" id="${ampId}" class="row-amount-input" style="color:${amountColor}" value="${hasAmount ? Number(b.amount).toFixed(2) : ''}" placeholder="Not set" onblur="updateBillAmount('${b.id}', this.value)">
        </div>
        <div class="row-run-label" style="color:${runColor}">${runLabel}</div>
      </div>
    </div>
    <div class="bill-row-bottom">
      <div class="row-progress-track"></div>
      ${bottomRight}
      <button class="ghost-pill" type="button" onclick="notAvailableYet('Receipt attachment')">Attach receipt</button>
      <button class="more-btn" type="button" title="Edit bill" onclick="openEditModal('${b.id}')">&#8943;</button>
    </div>
  </div>`;
}

function buildPaidRow(b, t){
  return `
  <div class="paid-row">
    <label class="paid-check-wrap" title="Mark unpaid">
      <input type="checkbox" checked onchange="toggleBillPaid('${b.id}')">
      <span class="paid-check-box">&#10003;</span>
    </label>
    <div class="paid-name-row">
      <input type="text" class="paid-name-input" value="${escapeHtml(b.name)}" onchange="updateBillField('${b.id}','name',this.value)">
      ${b.recurring ? '<span title="Repeats monthly">\u{1F501}</span>' : ''}
    </div>
    <div class="paid-amount">${fmtCurrency(b.amount)}</div>
    <input type="text" class="paid-conf-input" placeholder="add confirmation #" value="${escapeHtml(b.confirmationNumber||'')}" onchange="updateBillField('${b.id}','confirmationNumber',this.value)">
  </div>`;
}

function computeDonut(bills, t){
  const order = PIE_CAT_ORDER.map(c => ({ key:c.key, name:c.name, color: c.colorHex || t[c.colorKey] }));
  const slices = order.map(c => ({
    name: c.name, color: c.color,
    amount: bills.filter(b => b.category === c.key && b.amount != null).reduce((s,b) => s + b.amount, 0)
  })).filter(c => c.amount > 0);
  const total = slices.reduce((s,c) => s + c.amount, 0);
  let acc = 0;
  const stops = slices.map(c => {
    const from = acc / total * 100; acc += c.amount;
    return `${c.color} ${from.toFixed(2)}% ${(acc/total*100).toFixed(2)}%`;
  }).join(', ');
  const background = slices.length ? `conic-gradient(from -90deg, ${stops})` : t.surface2;
  const legendHtml = slices.length
    ? slices.map(c => `<div class="donut-legend-row"><span class="donut-swatch" style="background:${c.color}"></span><span class="donut-legend-name">${escapeHtml(c.name)}</span><span class="donut-legend-amt">${short(c.amount)}</span><span class="donut-legend-pct">${Math.round(c.amount/total*100)}%</span></div>`).join('')
    : `<div class="empty-note">No categorized spending yet.</div>`;
  return { background, total: slices.length ? total : 0, legendHtml };
}

function computeYearStrip(t){
  const hist = state.history;
  if (!hist.length) return { barsHtml: `<div class="empty-note">History builds after you start a new month.</div>`, caption: '' };
  const max = Math.max(1, ...hist.map(h => h.totalBills));
  const barsHtml = hist.map((h, i) => {
    const isCurrent = i === hist.length - 1;
    const heightPct = Math.max(6, h.totalBills / max * 100);
    return `<div class="year-col"><div class="year-bar" style="height:${heightPct}%;background:${isCurrent ? t.primary : t.borderStrong}"></div><div class="year-bar-label">${escapeHtml(h.label)}</div></div>`;
  }).join('');
  const avg = hist.reduce((s,h) => s + h.totalBills, 0) / hist.length;
  const highest = hist.reduce((a,b) => b.totalBills > a.totalBills ? b : a, hist[0]);
  const caption = `Average ${short(avg)} a month · highest ${escapeHtml(highest.label)}`;
  return { barsHtml, caption };
}

function buildCalendar(t, bills){
  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + state.calOffset, 1);
  const year = target.getFullYear(), month = target.getMonth();
  const monthLabel = target.toLocaleString('en-US', { month:'long', year:'numeric' });
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const startWeekday = target.getDay();
  const todayStr = fmtDateInput(new Date());
  const cells = [];
  for (let i=0;i<startWeekday;i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weekdays = ['S','M','T','W','T','F','S'];
  let html = `<div class="cal-head"><button class="cal-nav-btn" onclick="calNav(-1)">‹</button><div class="cal-month-label">${monthLabel}</div><button class="cal-nav-btn" onclick="calNav(1)">›</button></div>`;
  html += `<div class="cal-weekdays">${weekdays.map(w => `<div class="cal-weekday">${w}</div>`).join('')}</div>`;
  for (let i=0;i<cells.length;i+=7){
    const week = cells.slice(i,i+7);
    html += `<div class="cal-week">${week.map(d => {
      if (d === null) return `<div class="cal-day" style="background:transparent;border-color:transparent"></div>`;
      const dateStr = fmtDateInput(new Date(year, month, d));
      const isToday = dateStr === todayStr;
      const dayBills = bills.filter(b => b.dueDate === dateStr);
      const chips = dayBills.map(b => {
        const color = b.paid ? t.success : (dateStr < todayStr ? t.error : t.primary);
        return `<div class="cal-chip" style="background:${color}">${escapeHtml(b.name)}</div>`;
      }).join('');
      return `<div class="cal-day" style="background:${isToday?t.surfaceRaised:t.surface2}"><div class="cal-day-num" style="color:${isToday?t.primary:t.textSecondary}">${d}</div>${chips}</div>`;
    }).join('')}</div>`;
  }
  return html;
}

function render(){
  applyTheme();
  const t = theme();
  const { bills, balance, owed, projected, savings } = computeFigures();

  // Move to savings
  el('savingsFigure').textContent = short(savings);
  el('savingsBalanceNow').textContent = short(balance);
  el('savingsOwed').textContent = '− ' + short(owed);
  el('savingsFloorLine').textContent = '− ' + short(MIN_BALANCE);
  el('savingsFreeToMove').textContent = short(savings);
  const transferBtn = el('transferBtn');
  transferBtn.disabled = savings <= 0;
  if (savings > 0) {
    transferBtn.textContent = `Transfer ${short(savings)} to savings`;
    transferBtn.style.background = t.ink;
    transferBtn.style.color = t.success;
  } else {
    transferBtn.textContent = 'Transfer unavailable';
    transferBtn.style.background = 'rgba(6,33,25,0.25)';
    transferBtn.style.color = 'rgba(6,33,25,0.55)';
  }
  const noAmountCountAll = bills.filter(b => !b.paid && b.amount == null).length;
  el('savingsFootnote').textContent = noAmountCountAll
    ? `${noAmountCountAll} bill${noAmountCountAll === 1 ? '' : 's'} ${noAmountCountAll === 1 ? 'has' : 'have'} no amount yet — not included.`
    : 'Every bill has an amount.';

  // After every bill
  el('projectedFigure').textContent = fmtCurrency(projected);
  const floorPct = Math.max(0, Math.min(100, Math.round(savings / Math.max(1, projected) * 100)));
  el('projectedMeterFill').style.width = floorPct + '%';
  el('projectedNote').textContent = savings > 0 ? `${short(savings)} above your ${short(MIN_BALANCE)} floor` : `At your ${short(MIN_BALANCE)} floor`;

  // Where the month goes
  const donut = computeDonut(bills, t);
  el('donutGradient').style.background = donut.background;
  el('donutTotal').textContent = short(donut.total);
  el('donutLegend').innerHTML = donut.legendHtml;

  // Year strip
  const year = computeYearStrip(t);
  el('yearStripLabel').textContent = new Date().getFullYear() + ' so far';
  el('yearStripBars').innerHTML = year.barsHtml;
  el('yearStripCaption').textContent = year.caption;

  // Header
  el('monthLabel').textContent = new Date().toLocaleString('en-US', { month:'long', year:'numeric' });
  const withAmount = bills.filter(b => b.amount != null).length;
  const paidCountAll = bills.filter(b => b.paid).length;
  const upcoming = bills.filter(b => !b.paid && b.amount != null && b.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0];
  el('headerNote').textContent = `${withAmount} of ${bills.length} bills have amounts · ${paidCountAll} paid` + (upcoming ? ` · next due ${shortDateLabel(upcoming.dueDate)}` : '');

  el('viewListBtn').classList.toggle('active', state.view === 'list');
  el('viewCalBtn').classList.toggle('active', state.view === 'calendar');
  el('viewYearBtn').classList.remove('active');

  // Floor-stop notice
  const blocked = state.blocked;
  el('blockedNotice').style.display = blocked ? 'flex' : 'none';
  if (blocked) {
    el('blockedLine').textContent = `Paying ${blocked.name} (${fmtCurrency(blocked.amount)}) would leave ${fmtCurrency(blocked.after)} — under your ${short(MIN_BALANCE)} floor. Left unpaid.`;
  }

  // Running balance in original, unfiltered bill order (unpaid rows only).
  let run = balance;
  const runningMap = {};
  bills.forEach(b => {
    if (b.paid) return;
    runningMap[b.id] = run;
    if (b.amount != null) run -= b.amount;
  });

  const todayStr = fmtDateInput(new Date());
  const smartStr = fmtDateInput(getSmartDueDate());
  const search = el('searchBills').value.toLowerCase();
  const filterStatus = el('filterStatus').value;
  const matches = (b) => {
    if (!b.name.toLowerCase().includes(search)) return false;
    if (filterStatus === 'paid') return b.paid;
    if (filterStatus === 'unpaid') return !b.paid;
    if (filterStatus === 'overdue') return !b.paid && b.amount != null && b.dueDate && b.dueDate < todayStr;
    if (filterStatus === 'due-soon') {
      if (b.paid || b.amount == null || !b.dueDate) return false;
      const days = Math.ceil((parseLocalDate(b.dueDate) - parseLocalDate(todayStr)) / 86400000);
      return days >= 0 && days <= 3;
    }
    if (filterStatus === 'no-amount') return b.amount == null;
    return true;
  };

  if (state.view === 'list') {
    el('calendarView').style.display = 'none';

    const unpaidAll = bills.filter(b => !b.paid);
    const paidAll = bills.filter(b => b.paid);
    const unpaidFiltered = unpaidAll.filter(matches);
    const paidFiltered = paidAll.filter(matches);

    const dueThisCycleCount = unpaidAll.filter(b => b.amount != null && b.dueDate === smartStr).length;
    const noAmountUnpaid = unpaidAll.filter(b => b.amount == null).length;
    el('unpaidSection').style.display = unpaidAll.length ? 'block' : 'none';
    el('unpaidMeta').textContent = `${fmtCurrency(owed)} · ${dueThisCycleCount} due ${shortDateLabel(smartStr)}` + (noAmountUnpaid ? ` · ${noAmountUnpaid} awaiting an amount` : '');
    el('payAllBtn').textContent = unpaidAll.length === 1 ? 'Pay it' : `Pay all ${unpaidAll.length}`;
    el('unpaidListView').innerHTML = unpaidFiltered.length
      ? unpaidFiltered.map(b => buildUnpaidRow(b, t, runningMap[b.id], todayStr, smartStr, balance)).join('')
      : (unpaidAll.length ? `<div class="empty-note">No unpaid bills match your search.</div>` : '');

    const paidSumAll = paidAll.reduce((s,b) => s + (b.amount || 0), 0);
    el('paidSection').style.display = paidAll.length ? 'block' : 'none';
    el('paidMeta').textContent = fmtCurrency(paidSumAll);
    el('paidListView').innerHTML = paidFiltered.length
      ? paidFiltered.map(b => buildPaidRow(b, t)).join('')
      : (paidAll.length ? `<div class="empty-note">No paid bills match your search.</div>` : '');

    el('noResultsNote').style.display = bills.length === 0 ? 'block' : 'none';
  } else {
    el('unpaidSection').style.display = 'none';
    el('paidSection').style.display = 'none';
    el('noResultsNote').style.display = 'none';
    el('calendarView').style.display = '';
    el('calendarView').innerHTML = buildCalendar(t, bills);
  }

  renderToasts();
}

function populateCategorySelect(){
  el('addCategory').innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
}

function init(){
  populateCategorySelect();
  const smart = fmtDateInput(getSmartDueDate());
  let bills = [
    { id: uid(), name:'Rent', amount:1500.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Housing', recurring:true },
    { id: uid(), name:'Renters Insurance', amount:45.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Insurance', recurring:true },
    { id: uid(), name:'Credit Card A', amount:650.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:false },
    { id: uid(), name:'Credit Card B', amount:210.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:true },
    { id: uid(), name:'Credit Card C', amount:180.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:false },
    { id: uid(), name:'Credit Card D', amount:40.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:false },
    { id: uid(), name:'Credit Card E', amount:95.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:false },
    { id: uid(), name:'Credit Card F', amount:30.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:false },
    { id: uid(), name:'Credit Card G', amount:500.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Credit Card', recurring:false },
    { id: uid(), name:'Online Shopping', amount:75.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Shopping', recurring:false },
    { id: uid(), name:'Savings Transfer', amount:200.00, paid:false, confirmationNumber:'', dueDate:smart, category:'Savings', recurring:true }
  ];
  let startingBalance = '5000.00', expectedIncome = '0';
  let migrated = false;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      if (d.bills && d.bills.length) bills = d.bills.map(b => ({ recurring:false, category:'Other', confirmationNumber:'', ...b, id: b.id || uid(), amount: normalizeAmount(b.amount) }));
      if (d.startingBalance != null) startingBalance = String(d.startingBalance);
      if (d.expectedIncome != null) expectedIncome = String(d.expectedIncome);
    } catch(e){}
  } else {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      try {
        const d = JSON.parse(old);
        if (d.bills && d.bills.length) {
          bills = d.bills.map(b => ({ id: uid(), name:b.name, amount: normalizeAmount(b.amount), paid:!!b.paid, confirmationNumber:b.confirmationNumber||'', dueDate:b.dueDate||smart, category:b.category||'Other', recurring:false }));
          migrated = true;
        }
        if (d.startingBalance != null) startingBalance = String(d.startingBalance);
        if (d.expectedIncome != null) expectedIncome = String(d.expectedIncome);
      } catch(e){}
    }
  }

  el('startingBalance').value = startingBalance;
  el('expectedIncome').value = expectedIncome;
  state.bills = bills;
  state.blocked = null;

  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch(e){}
  state.history = history;

  let isLight = false;
  const themeSaved = localStorage.getItem(THEME_KEY);
  if (themeSaved) isLight = themeSaved === 'light';
  else {
    const oldDark = localStorage.getItem(OLD_THEME_KEY);
    if (oldDark != null) isLight = oldDark !== 'true';
  }
  state.isLight = isLight;

  persistData();

  el('themeToggleBtn').addEventListener('click', toggleTheme);
  el('viewListBtn').addEventListener('click', () => setView('list'));
  el('viewCalBtn').addEventListener('click', () => setView('calendar'));
  el('viewYearBtn').addEventListener('click', () => addToast("Year view isn't available yet"));
  el('exportCsvBtn').addEventListener('click', exportCSV);
  el('addBillBtn').addEventListener('click', openAddModal);
  el('dismissBlockedBtn').addEventListener('click', dismissBlocked);
  el('payAllBtn').addEventListener('click', payAllUnpaid);
  el('importBackupBtn').addEventListener('click', () => el('fileInput').click());
  el('downloadBackupBtn').addEventListener('click', downloadBackup);
  el('startNewMonthBtn').addEventListener('click', startNewMonthConfirm);
  el('addModalCancelBtn').addEventListener('click', closeAddModal);
  el('addModalSubmitBtn').addEventListener('click', submitBillModal);
  el('addModalDeleteBtn').addEventListener('click', deleteFromEditModal);
  el('confirmCancelBtn').addEventListener('click', closeConfirmModal);
  el('fileInput').addEventListener('change', handleImportFile);
  el('transferBtn').addEventListener('click', () => {
    const { savings } = computeFigures();
    if (savings > 0) addToast(`Marked ${short(savings)} ready to move to savings`);
  });

  el('startingBalance').addEventListener('input', () => { persistData(); render(); });
  el('expectedIncome').addEventListener('input', () => { persistData(); render(); });
  el('searchBills').addEventListener('input', render);
  el('filterStatus').addEventListener('change', render);

  render();
  if (migrated) addToast('Imported your bills from the previous tracker');

  const overdueCount = state.bills.filter(b => !b.paid && b.amount != null && b.dueDate && b.dueDate < fmtDateInput(new Date())).length;
  if (overdueCount > 0) setTimeout(() => addToast(`You have ${overdueCount} overdue bill(s)`), 1200);
}

init();
