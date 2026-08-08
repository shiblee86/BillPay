// Writes the exact same DOM structure as ../index.html so app.js can run completely
// unmodified against it. Loaded via <script src> (not fetch/iframe) so it works under
// file:// with no local server required. Keep this in sync with index.html's <body>.
document.write(`
<div id="app-fixture">
<div class="page">
  <div class="wrap">
    <div class="header-row">
      <div>
        <div class="title">Bill Payment Tracker</div>
        <div class="subtitle" id="dueDateDescription"></div>
      </div>
      <button class="icon-btn" id="themeToggleBtn" onclick="toggleTheme()" title="Toggle theme">&#9728;&#65039;</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Monthly bills</div><div class="stat-value" id="statTotalBills">$0</div></div>
      <div class="stat-card"><div class="stat-label">Paid this month</div><div class="stat-value" id="statPaid" style="color:var(--success)">$0</div></div>
      <div class="stat-card"><div class="stat-label">Remaining</div><div class="stat-value" id="statRemaining" style="color:var(--accent)">$0</div></div>
      <div class="stat-card"><div class="stat-label">Progress</div><div class="stat-value" id="statProgress">0%</div></div>
    </div>

    <div class="inputs-grid">
      <div class="input-card balance">
        <label>Starting balance</label>
        <input type="number" step="0.01" id="startingBalance">
      </div>
      <div class="input-card income">
        <label>Expected income (payroll, etc.)</label>
        <input type="number" step="0.01" id="expectedIncome">
      </div>
    </div>

    <div class="balance-banner" id="balanceBanner">
      <div class="b-label">Current balance</div>
      <div class="b-amount" id="balanceAmount">$0.00</div>
      <div class="b-status" id="balanceStatus"></div>
    </div>

    <div class="progress-card">
      <div class="progress-head"><span>Payment progress</span><span id="progressPercentLabel">0%</span></div>
      <div class="progress-track"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
      <div class="progress-sub"><span>Bills paid</span><span id="progressCountLabel">0 / 0</span></div>
    </div>

    <div class="savings-banner" id="savingsBanner">
      <div class="s-label">Available to transfer to savings</div>
      <div class="s-amount" id="savingsAmount">$0.00</div>
      <div id="savingsNote"></div>
    </div>

    <div class="insights-row">
      <div class="insight-card">
        <div class="insight-title">Spending by card</div>
        <div id="spendingByCard"></div>
      </div>
      <div class="insight-card">
        <div class="insight-title">Monthly trend</div>
        <div id="monthlyTrend"></div>
      </div>
    </div>

    <div class="toolbar">
      <div class="segmented">
        <button id="viewListBtn" onclick="setView('list')">List</button>
        <button id="viewCalBtn" onclick="setView('calendar')">Calendar</button>
      </div>
      <div class="filters">
        <input type="text" id="searchBills" placeholder="Search bills...">
        <select id="filterStatus">
          <option value="all">All bills</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="due-soon">Due soon (&le;3 days)</option>
        </select>
      </div>
    </div>

    <div class="bills-list" id="billsListView"></div>
    <div class="calendar-card" id="calendarView" style="display:none"></div>

    <div class="summary-card">
      <div class="summary-row"><span>Total bills</span><span id="sumTotalBills">$0.00</span></div>
      <div class="summary-row"><span>Paid so far</span><span id="sumTotalPaid" style="color:var(--success)">$0.00</span></div>
      <div class="summary-row"><span>Unpaid bills</span><span id="sumUnpaidBills" style="color:var(--accent)">$0.00</span></div>
      <div class="summary-row"><span>Expected income</span><span id="sumIncome" style="color:var(--success)">$0.00</span></div>
      <div class="summary-row final"><span>Final balance</span><span id="sumFinal">$0.00</span></div>
    </div>

    <div class="actions-grid">
      <button class="btn btn-accent" onclick="openAddModal()">+ Add bill</button>
      <button class="btn btn-reward" onclick="startNewMonthConfirm()">&#8635; Start new month</button>
      <button class="btn btn-ghost" onclick="document.getElementById('fileInput').click()">Import backup</button>
      <button class="btn btn-ghost" onclick="exportCSV()">Export CSV</button>
      <button class="btn btn-primary" onclick="downloadBackup()">Download backup</button>
    </div>
    <input type="file" id="fileInput" accept=".json" style="display:none" onchange="handleImportFile(event)">
  </div>
</div>

<div class="modal-overlay" id="addModalOverlay">
  <div class="modal-card add">
    <div class="modal-title">Add a bill</div>
    <label class="field-label2">Name</label>
    <input type="text" id="addName">
    <label class="field-label2">Amount</label>
    <input type="text" id="addAmount" placeholder="e.g. 120 or 100+20">
    <label class="field-label2">Category</label>
    <select id="addCategory"></select>
    <label class="field-label2">Due date</label>
    <input type="date" id="addDueDate">
    <label class="modal-checkbox-row"><input type="checkbox" id="addRecurring" style="width:18px;height:18px;margin:0;"> Repeats monthly</label>
    <div class="modal-btn-row">
      <button class="btn-cancel" onclick="closeAddModal()">Cancel</button>
      <button class="btn-add-submit" onclick="submitAddBill()">Add bill</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="confirmModalOverlay">
  <div class="modal-card confirm">
    <div class="modal-title" id="confirmTitle"></div>
    <div style="color:var(--text-secondary); margin-bottom:22px;" id="confirmMessage"></div>
    <div class="modal-btn-row">
      <button class="btn-cancel" onclick="closeConfirmModal()">Cancel</button>
      <button class="btn-confirm-danger" id="confirmActionBtn">Confirm</button>
    </div>
  </div>
</div>

<div class="stop-overlay" id="stopModalOverlay">
  <div class="stop-card">
    <div class="stop-icon">&#128721;</div>
    <div class="stop-title">Stop</div>
    <div class="stop-msg">You've reached your minimum balance.</div>
    <div class="stop-balance" id="stopBalance"></div>
    <button class="stop-btn" onclick="closeStopModal()">I understand</button>
  </div>
</div>

<div class="toast-stack" id="toastStack"></div>
</div>
`);
