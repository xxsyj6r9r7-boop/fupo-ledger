(function () {
  'use strict';

  const STORAGE_KEY = 'fupo-ledger-records-v1';

  const CATEGORIES = [
    { id: 'food', name: '餐食/果蔬', icon: '🍱' },
    { id: 'snack', name: '零食', icon: '🍪' },
    { id: 'daily', name: '日用', icon: '🧴' },
    { id: 'pet', name: '宠物', icon: '🐾' },
    { id: 'comm', name: '通讯', icon: '📶' },
    { id: 'fun', name: '娱乐', icon: '🎬' },
    { id: 'study', name: '学习', icon: '📖' },
    { id: 'transport', name: '交通', icon: '🚇' },
    { id: 'clothes', name: '衣服', icon: '👔' },
    { id: 'other', name: '其他', icon: '📌' },
  ];

  const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseYMD(str) {
    const [y, m, day] = str.split('-').map(Number);
    return { y, m, day };
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function formatMoney(n) {
    const x = Number(n) || 0;
    return x.toFixed(2);
  }

  function sumBy(records, pred) {
    return records.reduce((s, r) => (pred(r) ? s + (Number(r.amount) || 0) : s), 0);
  }

  function monthKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }

  function wallNow() {
    return new Date();
  }

  /** 本月：自然月（以今天所在月为准） */
  function isInCurrentCalendarMonth(dateStr) {
    const d = wallNow();
    const prefix = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    return dateStr.startsWith(prefix);
  }

  /** 上月：相对今天的上一个自然月 */
  function isInLastCalendarMonth(dateStr) {
    const d = wallNow();
    const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const prefix = `${last.getFullYear()}-${pad2(last.getMonth() + 1)}`;
    return dateStr.startsWith(prefix);
  }

  /** 本年累计：今年 1 月 1 日 ～ 今天（含） */
  function isYearToDate(dateStr) {
    const { y, m, day } = parseYMD(dateStr);
    const now = wallNow();
    const yEnd = now.getFullYear();
    const mEnd = now.getMonth() + 1;
    const dEnd = now.getDate();
    if (y !== yEnd) return false;
    const t = m * 100 + day;
    const end = mEnd * 100 + dEnd;
    return t <= end && m >= 1 && day >= 1;
  }

  function categoryMonthTotal(records, catId) {
    return sumBy(records, (r) => r.category === catId && isInCurrentCalendarMonth(r.date));
  }

  function el(id) {
    return document.getElementById(id);
  }

  let records = loadRecords();
  let selectedCategory = null;
  let editingId = null;

  const entryDate = el('entry-date');
  const categoryGrid = el('category-grid');
  const entryForm = el('entry-form');
  const selectedCatLabel = el('selected-cat-label');
  const amountInput = el('amount-input');
  const noteInput = el('note-input');
  const dayRecordsList = el('day-records-list');
  const dayRecordsEmpty = el('day-records-empty');
  const dayRecordsDate = el('day-records-date');

  const sumDay = el('sum-day');
  const sumMonth = el('sum-month');
  const sumLastMonth = el('sum-last-month');
  const sumYear = el('sum-year');

  const filterYear = el('filter-year');
  const filterMonth = el('filter-month');
  const filterDay = el('filter-day');
  const recordsGroups = el('records-groups');
  const recordsEmpty = el('records-empty');
  const recordsCount = el('records-count');

  function renderCategoryGrid() {
    categoryGrid.innerHTML = '';
    CATEGORIES.forEach((c) => {
      const monthSum = categoryMonthTotal(records, c.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-btn' + (selectedCategory === c.id ? ' selected' : '');
      btn.dataset.cat = c.id;
      btn.innerHTML = `
        <span class="cat-icon" aria-hidden="true">${c.icon}</span>
        <span class="cat-name">${c.name}</span>
        <span class="cat-month-sum">本月 ¥${formatMoney(monthSum)}</span>
      `;
      btn.addEventListener('click', () => {
        selectedCategory = c.id;
        entryForm.classList.remove('hidden');
        selectedCatLabel.textContent = `${c.icon} ${c.name}`;
        renderCategoryGrid();
        amountInput.focus();
      });
      categoryGrid.appendChild(btn);
    });
  }

  function getSelectedDate() {
    return entryDate.value || todayStr();
  }

  function updateSummaries() {
    const sel = getSelectedDate();

    const dayTotal = sumBy(records, (r) => r.date === sel);
    sumDay.textContent = formatMoney(dayTotal);

    const monthTotal = sumBy(records, (r) => isInCurrentCalendarMonth(r.date));
    sumMonth.textContent = formatMoney(monthTotal);

    const lastMonthTotal = sumBy(records, (r) => isInLastCalendarMonth(r.date));
    sumLastMonth.textContent = formatMoney(lastMonthTotal);

    const ytd = sumBy(records, (r) => isYearToDate(r.date));
    sumYear.textContent = formatMoney(ytd);
  }

  function renderDayRecords() {
    const sel = getSelectedDate();
    dayRecordsDate.textContent = `（${sel}）`;
    const list = records.filter((r) => r.date === sel).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    dayRecordsList.innerHTML = '';
    if (list.length === 0) {
      dayRecordsEmpty.classList.remove('hidden');
    } else {
      dayRecordsEmpty.classList.add('hidden');
      list.forEach((r) => {
        const cat = catMap[r.category] || { name: r.category, icon: '❔' };
        const isEdit = editingId === r.id;
        const li = document.createElement('li');
        li.className = 'record-item' + (isEdit ? ' edit-mode' : '');
        if (!isEdit) {
          li.innerHTML = `
            <div class="record-item-main">
              <div class="record-item-title">${cat.icon} ${cat.name}</div>
              ${r.note ? `<div class="record-item-note">${escapeHtml(r.note)}</div>` : ''}
            </div>
            <div class="record-item-amount">¥${formatMoney(r.amount)}</div>
            <div class="record-item-actions">
              <button type="button" class="btn small ghost" data-edit="${r.id}">修改金额</button>
              <button type="button" class="btn small danger" data-del="${r.id}">删除</button>
            </div>
          `;
          li.querySelector('[data-edit]').addEventListener('click', () => {
            editingId = r.id;
            renderDayRecords();
          });
          li.querySelector('[data-del]').addEventListener('click', () => {
            if (confirm('确定删除这条记录？')) {
              records = records.filter((x) => x.id !== r.id);
              saveRecords(records);
              editingId = null;
              refreshAll();
            }
          });
        } else {
          li.innerHTML = `
            <div class="edit-fields">
              <label><span class="sr-only">金额</span><input type="number" data-f="amt" min="0" step="0.01" value="${formatMoney(r.amount)}" /></label>
              <label><span class="sr-only">备注</span><input type="text" data-f="note" maxlength="120" value="${escapeHtml(r.note || '')}" /></label>
              <div class="record-item-actions">
                <button type="button" class="btn small primary" data-save="${r.id}">保存</button>
                <button type="button" class="btn small ghost" data-cancel>取消</button>
              </div>
            </div>
          `;
          li.querySelector('[data-save]').addEventListener('click', () => {
            const amt = parseFloat(li.querySelector('[data-f="amt"]').value);
            const note = li.querySelector('[data-f="note"]').value.trim();
            if (Number.isNaN(amt) || amt < 0) {
              alert('请输入有效的金额。');
              return;
            }
            const idx = records.findIndex((x) => x.id === r.id);
            if (idx !== -1) {
              records[idx] = { ...records[idx], amount: amt, note };
              saveRecords(records);
            }
            editingId = null;
            refreshAll();
          });
          li.querySelector('[data-cancel]').addEventListener('click', () => {
            editingId = null;
            renderDayRecords();
          });
        }
        dayRecordsList.appendChild(li);
      });
    }
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function refreshAll() {
    renderCategoryGrid();
    updateSummaries();
    renderDayRecords();
    populateFilters();
    renderRecordsPage();
  }

  el('confirm-entry').addEventListener('click', () => {
    if (!selectedCategory) {
      alert('请先选择一个分类。');
      return;
    }
    const amt = parseFloat(amountInput.value);
    if (Number.isNaN(amt) || amt < 0) {
      alert('请输入有效的金额。');
      return;
    }
    const note = noteInput.value.trim();
    const date = getSelectedDate();
    records.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      date,
      category: selectedCategory,
      amount: amt,
      note,
      createdAt: Date.now(),
    });
    saveRecords(records);
    amountInput.value = '';
    noteInput.value = '';
    refreshAll();
  });

  el('clear-selection').addEventListener('click', () => {
    selectedCategory = null;
    entryForm.classList.add('hidden');
    renderCategoryGrid();
  });

  entryDate.addEventListener('change', () => {
    editingId = null;
    refreshAll();
  });

  function switchPage(name) {
    const appRoot = document.getElementById('app');
    appRoot.classList.toggle('ledger-tab', name === 'ledger');
    appRoot.classList.toggle('records-tab', name === 'records');

    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.page === name;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    el('page-ledger').classList.toggle('active', name === 'ledger');
    el('page-ledger').hidden = name !== 'ledger';
    el('page-records').classList.toggle('active', name === 'records');
    el('page-records').hidden = name !== 'records';
    if (name === 'records') populateFilters();
    renderRecordsPage();
  }

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  function distinctYears() {
    const set = new Set();
    records.forEach((r) => set.add(parseYMD(r.date).y));
    return Array.from(set).sort((a, b) => b - a);
  }

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function populateFilters() {
    const savedY = filterYear.value;
    const savedM = filterMonth.value;
    const savedD = filterDay.value;

    const years = distinctYears();
    filterYear.innerHTML = '<option value="">全部年份</option>';
    years.forEach((y) => {
      const o = document.createElement('option');
      o.value = String(y);
      o.textContent = `${y}年`;
      filterYear.appendChild(o);
    });
    if (savedY && years.includes(Number(savedY))) filterYear.value = savedY;

    const ySel = filterYear.value;
    filterMonth.innerHTML = '<option value="">全部月份</option>';
    if (ySel) {
      for (let m = 1; m <= 12; m++) {
        const o = document.createElement('option');
        o.value = pad2(m);
        o.textContent = `${m}月`;
        filterMonth.appendChild(o);
      }
      if (savedM && Number(savedM) >= 1 && Number(savedM) <= 12) filterMonth.value = savedM;
    }

    const mSel = filterMonth.value;
    filterDay.innerHTML = '<option value="">全部日期</option>';
    if (ySel && mSel) {
      const max = daysInMonth(Number(ySel), Number(mSel));
      for (let d = 1; d <= max; d++) {
        const o = document.createElement('option');
        o.value = pad2(d);
        o.textContent = `${d}日`;
        filterDay.appendChild(o);
      }
      if (savedD) {
        const dn = Number(savedD);
        if (dn >= 1 && dn <= max) filterDay.value = savedD;
      }
    }
  }

  filterYear.addEventListener('change', () => {
    filterMonth.value = '';
    filterDay.value = '';
    populateFilters();
    renderRecordsPage();
  });

  filterMonth.addEventListener('change', () => {
    filterDay.value = '';
    populateFilters();
    renderRecordsPage();
  });

  filterDay.addEventListener('change', () => {
    renderRecordsPage();
  });

  el('reset-filters').addEventListener('click', () => {
    filterYear.value = '';
    filterMonth.value = '';
    filterDay.value = '';
    populateFilters();
    renderRecordsPage();
  });

  function filterRecordsList() {
    const y = filterYear.value;
    const m = filterMonth.value;
    const d = filterDay.value;
    return records.filter((r) => {
      const { y: ry, m: rm, day: rd } = parseYMD(r.date);
      if (y && String(ry) !== y) return false;
      if (m) {
        if (!y) return false;
        if (pad2(rm) !== m) return false;
      }
      if (d) {
        if (!y || !m) return false;
        if (pad2(rd) !== d) return false;
      }
      return true;
    });
  }

  function formatGroupTitle(dateStr) {
    const [yy, mm, dd] = dateStr.split('-');
    const w = ['日', '一', '二', '三', '四', '五', '六'];
    const dt = new Date(Number(yy), Number(mm) - 1, Number(dd));
    const week = w[dt.getDay()];
    return `${yy}年${Number(mm)}月${Number(dd)}日 星期${week}`;
  }

  function renderRecordsPage() {
    if (el('page-records').hidden) return;

    let list = filterRecordsList().slice();
    list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    recordsCount.textContent = `共 ${list.length} 条记录，合计 ¥${formatMoney(list.reduce((s, r) => s + (Number(r.amount) || 0), 0))}`;

    const byDate = new Map();
    list.forEach((r) => {
      if (!byDate.has(r.date)) byDate.set(r.date, []);
      byDate.get(r.date).push(r);
    });

    recordsGroups.innerHTML = '';
    if (list.length === 0) {
      recordsEmpty.classList.remove('hidden');
    } else {
      recordsEmpty.classList.add('hidden');
      const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
      dates.forEach((dateStr) => {
        const group = document.createElement('div');
        group.className = 'record-group';
        const title = document.createElement('h3');
        title.className = 'record-group-title';
        title.textContent = formatGroupTitle(dateStr);
        group.appendChild(title);
        const ul = document.createElement('ul');
        ul.className = 'record-list';
        byDate.get(dateStr).forEach((r) => {
          const cat = catMap[r.category] || { name: r.category, icon: '❔' };
          const isEdit = editingId === r.id;
          const li = document.createElement('li');
          li.className = 'record-item' + (isEdit ? ' edit-mode' : '');
          if (!isEdit) {
            li.innerHTML = `
              <div class="record-item-main">
                <div class="record-item-title">${cat.icon} ${cat.name}</div>
                ${r.note ? `<div class="record-item-note">${escapeHtml(r.note)}</div>` : ''}
              </div>
              <div class="record-item-amount">¥${formatMoney(r.amount)}</div>
              <div class="record-item-actions">
                <button type="button" class="btn small ghost" data-edit-r="${r.id}">修改</button>
                <button type="button" class="btn small danger" data-del-r="${r.id}">删除</button>
              </div>
            `;
            li.querySelector('[data-edit-r]').addEventListener('click', () => {
              editingId = r.id;
              renderRecordsPage();
            });
            li.querySelector('[data-del-r]').addEventListener('click', () => {
              if (confirm('确定删除？')) {
                records = records.filter((x) => x.id !== r.id);
                saveRecords(records);
                editingId = null;
                refreshAll();
              }
            });
          } else {
            li.innerHTML = `
              <div class="edit-fields">
                <label><span class="sr-only">金额</span><input type="number" data-f="amt" min="0" step="0.01" value="${formatMoney(r.amount)}" /></label>
                <label><span class="sr-only">备注</span><input type="text" data-f="note" maxlength="120" value="${escapeHtml(r.note || '')}" /></label>
                <div class="record-item-actions">
                  <button type="button" class="btn small primary" data-save-r="${r.id}">保存</button>
                  <button type="button" class="btn small ghost" data-cancel-r>取消</button>
                </div>
              </div>
            `;
            li.querySelector('[data-save-r]').addEventListener('click', () => {
              const amt = parseFloat(li.querySelector('[data-f="amt"]').value);
              const note = li.querySelector('[data-f="note"]').value.trim();
              if (Number.isNaN(amt) || amt < 0) {
                alert('请输入有效金额。');
                return;
              }
              const idx = records.findIndex((x) => x.id === r.id);
              if (idx !== -1) {
                records[idx] = { ...records[idx], amount: amt, note };
                saveRecords(records);
              }
              editingId = null;
              refreshAll();
            });
            li.querySelector('[data-cancel-r]').addEventListener('click', () => {
              editingId = null;
              renderRecordsPage();
            });
          }
          ul.appendChild(li);
        });
        group.appendChild(ul);
        recordsGroups.appendChild(group);
      });
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  entryDate.value = todayStr();
  refreshAll();
})();
