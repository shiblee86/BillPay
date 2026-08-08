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
function parseAmountExpr(raw){
  const sanitized = String(raw).replace(/[^0-9+\-*/.() ]/g, '');
  if (/[+\-*/]/.test(sanitized)) {
    try { return Function('"use strict";return (' + sanitized + ')')(); } catch (e) { return parseFloat(raw) || 0; }
  }
  return parseFloat(raw) || 0;
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
  shadowPrimary:'#0EA3A3', shadowAccent:'#E6432E', shadowNeutral:'#081716'
};
DARK.shadowAmber = shade(DARK.amber, -70);

const LIGHT = {
  bg:'#EAF6F6', surface1:'#FFFFFF', surface2:'#F1FAFA', surfaceRaised:'#FFFFFF',
  borderSubtle:'#CFE7E7', borderStrong:'#9FCFCF',
  textPrimary:'#0A1F1F', textSecondary:'#3B5C5C', textMuted:'#6E8C8C',
  primary:'#0EA3A3', accent:'#E6432E', amber:'#D68A00', success:'#1FAE7E', error:'#D62A2A',
  textOnPrimary:'#F4FBFB', textOnAccent:'#FFFFFF',
  shadowPrimary:'#0B8484', shadowAccent:'#C23522', shadowNeutral:'#B8D8D8'
};
LIGHT.shadowAmber = shade(LIGHT.amber, -60);

const CAT_PALETTE = [
  { bgD:'rgba(23,199,199,0.16)', bgL:'rgba(14,163,163,0.12)', colorKey:'primary' },
  { bgD:'rgba(255,92,61,0.16)', bgL:'rgba(230,67,46,0.12)', colorKey:'accent' },
  { bgD:'rgba(255,176,32,0.18)', bgL:'rgba(214,138,0,0.14)', colorKey:'amber' },
  { bgD:'rgba(47,230,167,0.16)', bgL:'rgba(31,174,126,0.12)', colorKey:'success' },
];

let state = { bills:[], isLight:false, view:'list', calOffset:0, history:[], toasts:[] };

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

function calculateBalance(bills, starting, income){
  const paid = bills.filter(b => b.paid).reduce((s,b) => s + b.amount, 0);
  return starting + income - paid;
}

function updateBillField(id, field, value){
  const b = findBill(id); if (!b) return;
  b[field] = value;
  persistData();
  render();
}
function updateBillAmount(id, raw){
  const b = findBill(id); if (!b) return;
  b.amount = parseAmountExpr(raw);
  persistData();
  render();
}
function toggleRecurring(id){
  const b = findBill(id); if (!b) return;
  b.recurring = !b.recurring;
  persistData();
  render();
}
function toggleBillPaid(id){
  const b = findBill(id); if (!b) return;
  const willBePaid = !b.paid;
  if (willBePaid) {
    const starting = parseFloat(el('startingBalance').value) || 0;
    const income = parseFloat(el('expectedIncome').value) || 0;
    const futureBalance = calculateBalance(state.bills, starting, income) - b.amount;
    if (futureBalance < MIN_BALANCE) {
      el('stopBalance').textContent = fmtCurrency(futureBalance);
      el('stopModalOverlay').classList.add('show');
      render();
      return;
    }
  }
  b.paid = willBePaid;
  persistData();
  render();
  if (willBePaid) addToast(`Paid ${b.name} for ${fmtCurrency(b.amount)}`);
}

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

function closeStopModal(){ el('stopModalOverlay').classList.remove('show'); }

function nextRecurringDueDate(oldStr){
  const old = oldStr ? parseLocalDate(oldStr) : new Date();
  const before15 = old.getDate() <= 15;
  let year = old.getFullYear(), month = old.getMonth() + 1;
  if (month > 11) { month = 0; year += 1; }
  return fmtDateInput(smartDueDateForMonth(year, month, before15));
}

function startNewMonthConfirm(){
  showConfirmModal('Start new month', "This archives this month's totals, rolls recurring bills to their next due date, and clears paid one-time bills.", () => {
    const bills = state.bills;
    const totalBills = bills.reduce((s,b)=>s+b.amount,0);
    const totalPaid = bills.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
    const label = new Date().toLocaleString('en-US', { month:'short', year:'2-digit' });
    state.history = [...state.history, { label, totalBills, totalPaid }].slice(-12);
    state.bills = bills.filter(b => b.recurring || !b.paid).map(b => b.recurring ? { ...b, paid:false, confirmationNumber:'', dueDate: nextRecurringDueDate(b.dueDate) } : b);
    persistData();
    persistHistory();
    render();
    addToast('New month started');
  });
}

function openAddModal(){
  el('addName').value = '';
  el('addAmount').value = '';
  el('addCategory').value = 'Other';
  el('addDueDate').value = fmtDateInput(getSmartDueDate());
  el('addRecurring').checked = false;
  el('addModalOverlay').classList.add('show');
}
function closeAddModal(){ el('addModalOverlay').classList.remove('show'); }
function submitAddBill(){
  const name = el('addName').value.trim();
  if (!name) return;
  const amount = parseAmountExpr(el('addAmount').value);
  const category = el('addCategory').value;
  const dueDate = el('addDueDate').value || fmtDateInput(getSmartDueDate());
  const recurring = el('addRecurring').checked;
  state.bills.push({ id: uid(), name, amount, paid:false, confirmationNumber:'', dueDate, category, recurring });
  persistData();
  closeAddModal();
  render();
  addToast(`Added "${name}" for ${fmtCurrency(amount)}`);
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
  const rows = state.bills.map(b => [b.name, b.amount, b.paid?'Yes':'No', b.confirmationNumber||'', b.dueDate||'', b.category, b.recurring?'Yes':'No', b.paid?'Paid':(b.dueDate && b.dueDate < todayStr ? 'Overdue':'Pending')]);
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
      state.bills = data.bills.map(b => ({ recurring:false, category:'Other', confirmationNumber:'', ...b, id: b.id || uid() }));
      if (data.startingBalance != null) el('startingBalance').value = data.startingBalance;
      if (data.expectedIncome != null) el('expectedIncome').value = data.expectedIncome;
      state.history = data.history || state.history;
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

function buildBillCard(b, t, rb, todayStr){
  const rbKey = rb < MIN_BALANCE ? 'danger' : rb < MIN_BALANCE+200 ? 'warning' : 'safe';
  const rbColor = { safe:t.success, warning:t.amber, danger:t.error }[rbKey];
  let dueText, dueTextColor = '#fff', dueBg = t.primary;
  if (b.paid) { dueText='Paid'; dueBg=t.success; }
  else if (!b.dueDate) { dueText='No date'; dueBg=t.textMuted; }
  else {
    const days = Math.ceil((new Date(b.dueDate) - new Date(todayStr)) / 86400000);
    if (days < 0) { dueText = `Overdue ${Math.abs(days)}d`; dueBg = t.error; }
    else if (days === 0) { dueText = 'Due today'; dueBg = t.error; }
    else if (days <= 3) { dueText = `Due in ${days}d`; dueBg = t.accent; }
    else if (days <= 7) { dueText = `Due in ${days}d`; dueBg = t.amber; dueTextColor = t.textOnAccent; }
    else { dueText = `Due in ${days}d`; dueBg = t.surface2; dueTextColor = t.textSecondary; }
  }
  const catIdx = CATEGORIES.indexOf(b.category) >= 0 ? CATEGORIES.indexOf(b.category) : 0;
  const catStyle = CAT_PALETTE[catIdx % CAT_PALETTE.length];
  const catBg = state.isLight ? catStyle.bgL : catStyle.bgD;
  const catColor = t[catStyle.colorKey];
  const cardBg = b.paid ? t.surface2 : t.surface1;
  const borderColor = b.paid ? t.borderSubtle : t.borderStrong;
  const opacity = b.paid ? 0.75 : 1;
  const catOptions = CATEGORIES.map(c => `<option value="${c}" ${c===b.category?'selected':''}>${c}</option>`).join('');

  return `
  <div class="bill-card" style="background:${cardBg};border-color:${borderColor};opacity:${opacity}">
    <div class="bill-row1">
      <input type="checkbox" ${b.paid?'checked':''} onchange="toggleBillPaid('${b.id}')">
      <input type="text" class="bill-name-input" value="${escapeHtml(b.name)}" onchange="updateBillField('${b.id}','name',this.value)">
      <span class="badge" style="background:${catBg};color:${catColor};border:2px solid ${catColor}">${escapeHtml(b.category)}</span>
      <span class="badge" style="background:${dueBg};color:${dueTextColor}">${dueText}</span>
      ${b.recurring ? '<span title="Recurring monthly">\u{1F501}</span>' : ''}
      <button class="delete-btn" onclick="deleteBillConfirm('${b.id}')">Delete</button>
    </div>
    <div class="bill-row2">
      <div class="field-box field-amount">
        <div class="field-label">AMOUNT</div>
        <input type="text" value="${b.amount}" onblur="updateBillAmount('${b.id}', this.value)">
      </div>
      <div class="field-box field-conf">
        <div class="field-label">CONFIRMATION #</div>
        <input type="text" placeholder="—" value="${escapeHtml(b.confirmationNumber||'')}" onchange="updateBillField('${b.id}','confirmationNumber',this.value)">
      </div>
      <div class="field-box">
        <div class="field-label">DUE DATE</div>
        <input type="date" value="${b.dueDate||''}" onchange="updateBillField('${b.id}','dueDate',this.value)">
      </div>
      <div class="field-box">
        <div class="field-label">CATEGORY</div>
        <select onchange="updateBillField('${b.id}','category',this.value)">${catOptions}</select>
      </div>
      <div class="field-box">
        <div class="field-label">RECURRING</div>
        <button class="recur-btn" style="background:${b.recurring?t.primary:t.surface2};color:${b.recurring?t.textOnPrimary:t.textSecondary}" onclick="toggleRecurring('${b.id}')">${b.recurring?'\u{1F501} Monthly':'One-time'}</button>
      </div>
      <div class="running-box">
        <div class="field-label">BALANCE AFTER</div>
        <div class="running-value" style="color:${rbColor}">${fmtCurrency(rb)}</div>
      </div>
    </div>
  </div>`;
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
  const bills = state.bills;
  const starting = parseFloat(el('startingBalance').value) || 0;
  const income = parseFloat(el('expectedIncome').value) || 0;
  const balanceNum = calculateBalance(bills, starting, income);
  const balanceKey = balanceNum < MIN_BALANCE ? 'danger' : balanceNum < MIN_BALANCE + 200 ? 'warning' : 'safe';
  const balanceBg = { safe:t.primary, warning:t.amber, danger:t.error }[balanceKey];
  const balanceShadow = { safe:t.shadowPrimary, warning:t.shadowAccent, danger:t.shadowAccent }[balanceKey];
  const balanceTextOn = balanceKey === 'warning' ? t.textOnAccent : (state.isLight ? t.textOnAccent : t.bg);
  const balanceStatus = { safe:'✓ Safe to continue', warning:'⚠ Close to minimum', danger:'\u{1F6D1} Stop paying bills' }[balanceKey];

  const totalBills = bills.reduce((s,b)=>s+b.amount,0);
  const totalPaid = bills.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
  const unpaidBills = bills.filter(b=>!b.paid).reduce((s,b)=>s+b.amount,0);
  const paidCount = bills.filter(b=>b.paid).length;
  const progressPct = totalBills > 0 ? (totalPaid/totalBills*100) : 0;

  el('statTotalBills').textContent = fmtCurrency(totalBills);
  el('statPaid').textContent = fmtCurrency(totalPaid);
  el('statRemaining').textContent = fmtCurrency(unpaidBills);
  el('statProgress').textContent = progressPct.toFixed(0) + '%';

  el('dueDateDescription').textContent = `Bills default to the ${new Date().getDate() <= 15 ? '15th' : 'end-of-month'} due date this cycle`;

  const bb = el('balanceBanner');
  bb.style.background = balanceBg;
  bb.style.boxShadow = `0 8px 0 ${balanceShadow}`;
  bb.classList.toggle('pulse', balanceKey === 'danger');
  el('balanceAmount').textContent = fmtCurrency(balanceNum);
  el('balanceAmount').style.color = balanceTextOn;
  el('balanceStatus').textContent = balanceStatus;
  el('balanceStatus').style.color = balanceTextOn;
  bb.querySelector('.b-label').style.color = balanceTextOn;

  el('progressPercentLabel').textContent = progressPct.toFixed(0) + '%';
  el('progressFill').style.width = progressPct + '%';
  el('progressCountLabel').textContent = `${paidCount} / ${bills.length}`;

  const hasUnpaid = bills.some(b => !b.paid);
  let savingsAmount = 0, savingsNote = '';
  if (hasUnpaid) savingsNote = 'Pay all bills first before transferring';
  else if (balanceNum > MIN_BALANCE) { savingsAmount = balanceNum - MIN_BALANCE; savingsNote = `Safe to transfer (keeping ${fmtCurrency(MIN_BALANCE)} minimum)`; }
  else savingsNote = 'All bills paid — no excess funds to transfer';
  const savingsBg = hasUnpaid ? t.surface2 : (savingsAmount > 0 ? t.success : t.surface2);
  const savingsTextOn = (hasUnpaid || savingsAmount === 0) ? t.textSecondary : t.textOnAccent;
  const sb = el('savingsBanner');
  sb.style.background = savingsBg;
  el('savingsAmount').textContent = fmtCurrency(savingsAmount);
  el('savingsAmount').style.color = savingsTextOn;
  el('savingsNote').textContent = savingsNote;
  el('savingsNote').style.color = savingsTextOn;
  sb.querySelector('.s-label').style.color = savingsTextOn;

  const cardEntries = bills.map((b,i) => [b.name, b.amount, i]).sort((a,b) => b[1]-a[1]);
  const maxCard = cardEntries.length ? cardEntries[0][1] : 1;
  el('spendingByCard').innerHTML = cardEntries.length ? cardEntries.map(([name, amt, i]) => {
    const color = t[CAT_PALETTE[i % CAT_PALETTE.length].colorKey];
    const pct = Math.max(4, maxCard ? (amt/maxCard*100) : 0);
    return `<div class="bar-row"><div class="bar-row-head"><span>${escapeHtml(name)}</span><span>${fmtCurrency(amt)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  }).join('') : `<div class="empty-note">No bills yet.</div>`;

  const historySlice = state.history.slice(-6);
  const maxHist = Math.max(1, ...historySlice.map(h => h.totalBills));
  el('monthlyTrend').innerHTML = historySlice.length ? `<div class="trend-chart">${historySlice.map(h => {
    const totalPct = Math.max(6, h.totalBills/maxHist*100);
    const paidPct = Math.max(0, h.totalPaid/maxHist*100);
    return `<div class="trend-col"><div class="trend-bar-outer" style="height:${totalPct}%"><div class="trend-bar-inner" style="height:${paidPct}%"></div></div><div class="trend-label">${escapeHtml(h.label)}</div></div>`;
  }).join('')}</div>` : `<div class="empty-note">History builds after you start a new month.</div>`;

  el('viewListBtn').classList.toggle('active', state.view === 'list');
  el('viewCalBtn').classList.toggle('active', state.view === 'calendar');

  let runningBalance = starting + income;
  const runningMap = {};
  bills.forEach(b => { if (b.paid) runningBalance -= b.amount; runningMap[b.id] = runningBalance; });

  const todayStr = fmtDateInput(new Date());
  const search = el('searchBills').value.toLowerCase();
  const filterStatus = el('filterStatus').value;
  const filtered = bills.filter(b => {
    if (!b.name.toLowerCase().includes(search)) return false;
    if (filterStatus === 'paid') return b.paid;
    if (filterStatus === 'unpaid') return !b.paid;
    if (filterStatus === 'overdue') return !b.paid && b.dueDate && b.dueDate < todayStr;
    if (filterStatus === 'due-soon') {
      if (b.paid || !b.dueDate) return false;
      const days = Math.ceil((new Date(b.dueDate) - new Date(todayStr)) / 86400000);
      return days >= 0 && days <= 3;
    }
    return true;
  });

  if (state.view === 'list') {
    el('billsListView').style.display = '';
    el('calendarView').style.display = 'none';
    el('billsListView').innerHTML = filtered.length ? filtered.map(b => buildBillCard(b, t, runningMap[b.id], todayStr)).join('') : `<div class="no-results">No bills match your search.</div>`;
  } else {
    el('billsListView').style.display = 'none';
    el('calendarView').style.display = '';
    el('calendarView').innerHTML = buildCalendar(t, bills);
  }

  el('sumTotalBills').textContent = fmtCurrency(totalBills);
  el('sumTotalPaid').textContent = fmtCurrency(totalPaid);
  el('sumUnpaidBills').textContent = fmtCurrency(unpaidBills);
  el('sumIncome').textContent = fmtCurrency(income);
  el('sumFinal').textContent = fmtCurrency(balanceNum);
  el('sumFinal').style.color = balanceNum < MIN_BALANCE ? t.error : t.textPrimary;

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
      if (d.bills && d.bills.length) bills = d.bills.map(b => ({ recurring:false, category:'Other', confirmationNumber:'', ...b, id: b.id || uid() }));
      if (d.startingBalance != null) startingBalance = String(d.startingBalance);
      if (d.expectedIncome != null) expectedIncome = String(d.expectedIncome);
    } catch(e){}
  } else {
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      try {
        const d = JSON.parse(old);
        if (d.bills && d.bills.length) {
          bills = d.bills.map(b => ({ id: uid(), name:b.name, amount:b.amount, paid:!!b.paid, confirmationNumber:b.confirmationNumber||'', dueDate:b.dueDate||smart, category:b.category||'Other', recurring:false }));
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

  el('startingBalance').addEventListener('input', () => { persistData(); render(); });
  el('expectedIncome').addEventListener('input', () => { persistData(); render(); });
  el('searchBills').addEventListener('input', render);
  el('filterStatus').addEventListener('change', render);

  render();
  if (migrated) addToast('Imported your bills from the previous tracker');

  const overdueCount = state.bills.filter(b => !b.paid && b.dueDate && b.dueDate < fmtDateInput(new Date())).length;
  if (overdueCount > 0) setTimeout(() => addToast(`You have ${overdueCount} overdue bill(s)`), 1200);
}

init();
