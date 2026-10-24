/* =========================================================================
   HISTORY SCREEN: FILTERING, SWIPE-TO-DELETE & ENTRY EDITING
   ========================================================================= */
let editingTxId = null;
let editingCatId = 'coffee';

function applyTimeFilter(flt) {
  triggerHaptic(8);
  activeHistoryFilter = flt;
  ['all', 'today', 'week', 'month'].forEach(f => {
    const el = document.getElementById('flt-' + f);
    if (el) el.classList.toggle('active', f === flt);
  });
  renderHistoryView();
}

function onSearchChange() {
  const input = document.getElementById('historySearch');
  historySearchQuery = input ? input.value.toLowerCase().trim() : '';
  renderHistoryView();
}

function renderHistoryView() {
  const container = document.getElementById('historyFeed');
  const empty = document.getElementById('historyEmptyNotice');
  if (!container || !empty) return;
  container.innerHTML = '';

  const { now, startToday, startWeek, startMonth } = getTimeBoundaries();

  const filtered = expenses.filter(item => {
    let inTime = true;
    if (activeHistoryFilter === 'today') inTime = item.timestamp >= startToday;
    if (activeHistoryFilter === 'week') inTime = item.timestamp >= startWeek;
    if (activeHistoryFilter === 'month') inTime = item.timestamp >= startMonth;
    if (!inTime) return false;

    if (historySearchQuery) {
      const cat = CATEGORIES.find(c => c.id === item.category);
      const catLabel = cat ? cat.label.toLowerCase() : '';
      const noteMatch = (item.note || '').toLowerCase().includes(historySearchQuery);
      const catMatch = catLabel.includes(historySearchQuery);
      return noteMatch || catMatch;
    }
    return true;
  });

  const totalFilteredSum = filtered.reduce((acc, curr) => acc + curr.amount, 0);
  const countLabel = document.getElementById('filteredCountLabel');
  if (countLabel) {
    countLabel.textContent = `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`;
  }
  const sumLabel = document.getElementById('filteredSumLabel');
  if (sumLabel) {
    sumLabel.textContent = `${currencySymbol}${totalFilteredSum.toFixed(2)}`;
  }

  if (filtered.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(tx => {
    const cat = CATEGORIES.find(c => c.id === tx.category) || CATEGORIES[6];
    const dateObj = new Date(tx.timestamp);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sameYear = dateObj.getFullYear() === now.getFullYear();
    const dateStr = dateObj.toLocaleDateString([], sameYear
      ? { month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' }
    );

    const wrap = document.createElement('div');
    wrap.className = 'tx-swipe-wrap';

    wrap.innerHTML = `
      <div class="tx-swipe-bg" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>Delete</span>
      </div>
    `;

    const item = document.createElement('div');
    item.className = 'tx-item';
    item.style.setProperty('--cat-color', cat.color);
    item.style.setProperty('--cat-bg', cat.bg);

    item.innerHTML = `
      <div class="tx-left">
        <div class="tx-icon-pill">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${cat.svg}
          </svg>
        </div>
        <div class="tx-meta">
          <span class="tx-category-badge">${cat.label}</span>
          <span class="tx-note">${escapeHTML(tx.note)}</span>
          <span class="tx-time">${dateStr} • ${timeStr}</span>
        </div>
      </div>

      <div class="tx-right">
        <span class="tx-amount">${currencySymbol}${tx.amount.toFixed(2)}</span>
        <button type="button" class="tx-action-btn" aria-label="Edit entry" title="Edit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
      </div>
    `;

    attachItemInteractions(wrap, item, tx.id);
    wrap.appendChild(item);
    container.appendChild(wrap);
  });
}

function attachItemInteractions(wrapEl, itemEl, txId) {
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let swipingLeft = false;
  let gestureDecided = false;
  let touchMoved = false;

  itemEl.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    deltaX = 0;
    swipingLeft = false;
    gestureDecided = false;
    touchMoved = false;
  }, { passive: true });

  itemEl.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      touchMoved = true;
    }

    if (!gestureDecided) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        gestureDecided = true;
        // Swipe left deletes the item; swipe right bubbles to viewport to switch back to Capture
        if (dx < 0) {
          swipingLeft = true;
          itemEl.classList.add('swiping');
        }
      } else if (Math.abs(dy) > 10) {
        gestureDecided = true;
        swipingLeft = false;
      }
    }

    if (swipingLeft) {
      e.stopPropagation();
      deltaX = Math.min(0, dx);
      // Slight resistance past -110px
      const visualX = deltaX < -110 ? -110 + (deltaX + 110) * 0.35 : deltaX;
      itemEl.style.transform = `translateX(${visualX}px)`;
    }
  }, { passive: true });

  const finishSwipe = () => {
    if (!swipingLeft) return;
    itemEl.classList.remove('swiping');
    const deleteThreshold = -75;
    if (deltaX <= deleteThreshold) {
      triggerHaptic(18);
      itemEl.style.transform = 'translateX(-105%)';
      setTimeout(() => {
        removeTx(txId);
      }, 170);
    } else {
      itemEl.style.transform = 'translateX(0)';
    }
    swipingLeft = false;
    deltaX = 0;
  };

  itemEl.addEventListener('touchend', finishSwipe);
  itemEl.addEventListener('touchcancel', finishSwipe);

  itemEl.addEventListener('click', () => {
    if (touchMoved) return;
    openEditModal(txId);
  });
}

function removeTx(id) {
  triggerHaptic(15);
  const target = expenses.find(x => x.id === id);
  if (!target) return;

  const backupItem = { ...target };
  expenses = expenses.filter(x => x.id !== id);
  deletedMap[id] = Date.now();
  saveState();
  renderTotals();
  renderHistoryView();

  showToast(`Removed ${currencySymbol}${backupItem.amount.toFixed(2)}`, () => {
    delete deletedMap[backupItem.id];
    expenses.push(backupItem);
    saveState();
    renderTotals();
    renderHistoryView();
    triggerHaptic(10);
    showToast('Restored entry');
  });
}

/* =========================================================================
   EDIT TRANSACTION MODAL
   ========================================================================= */
function toLocalDateTimeInputValue(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openEditModal(id) {
  const tx = expenses.find(x => x.id === id);
  if (!tx) return;

  triggerHaptic(10);
  editingTxId = tx.id;
  editingCatId = tx.category;

  document.getElementById('editAmountInput').value = tx.amount.toFixed(2);
  document.getElementById('editNoteInput').value = tx.note || '';
  document.getElementById('editDateInput').value = toLocalDateTimeInputValue(tx.timestamp);

  renderEditCategoryButtons();
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  editingTxId = null;
  const modal = document.getElementById('editModal');
  if (modal) modal.classList.remove('open');
}

function closeEditModalOnBackdrop(e) {
  if (e.target.id === 'editModal') {
    closeEditModal();
  }
}

function renderEditCategoryButtons() {
  const container = document.getElementById('editCatContainer');
  if (!container) return;
  container.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `edit-cat-Grid-btn ${cat.id === editingCatId ? 'selected' : ''}`;
    btn.style.setProperty('--cat-color', cat.color);
    btn.style.setProperty('--cat-bg', cat.bg);
    btn.onclick = () => {
      triggerHaptic(8);
      editingCatId = cat.id;
      renderEditCategoryButtons();
    };
    btn.innerHTML = `
      <span class="pill-dot"></span>
      <span>${cat.label}</span>
    `;
    container.appendChild(btn);
  });
}

function saveEditedTx() {
  if (!editingTxId) return;
  const idx = expenses.findIndex(x => x.id === editingTxId);
  if (idx === -1) {
    closeEditModal();
    return;
  }

  const rawAmount = parseFloat(document.getElementById('editAmountInput').value);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    showToast('Please enter a valid amount');
    return;
  }

  const rawDate = document.getElementById('editDateInput').value;
  const parsedTime = rawDate ? new Date(rawDate).getTime() : NaN;
  const finalTimestamp = Number.isFinite(parsedTime) ? parsedTime : expenses[idx].timestamp;

  const catObj = CATEGORIES.find(c => c.id === editingCatId) || CATEGORIES[0];
  const noteRaw = document.getElementById('editNoteInput').value.trim();

  expenses[idx] = {
    ...expenses[idx],
    amount: Math.round(rawAmount * 100) / 100,
    category: editingCatId,
    note: noteRaw || catObj.label,
    timestamp: finalTimestamp,
    updatedAt: Date.now()
  };

  saveState();
  renderTotals();
  renderHistoryView();
  closeEditModal();
  triggerHaptic([12, 40, 12]);
  showToast('Entry updated');
}

function deleteFromEditModal() {
  if (!editingTxId) return;
  const idToRemove = editingTxId;
  closeEditModal();
  removeTx(idToRemove);
}
