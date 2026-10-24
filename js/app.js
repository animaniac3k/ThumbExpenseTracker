/* =========================================================================
   LIFECYCLE INITIALIZATION, PWA, NAVIGATION & KEYBOARD
   ========================================================================= */
window.addEventListener('DOMContentLoaded', () => {
  initPWA();
  loadState();
  applyCurrencySymbolToDOM();
  buildCategoryPills();
  updateThemeCategoryUI();
  refreshInputDisplay();
  renderTotals();
  renderHistoryView();
  setupSwipeGestures();
  setupPhysicalKeyboard();
  loadR2Config();
});

function initPWA() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch(err => console.warn('Service worker registration note:', err));
  }
}

/* =========================================================================
   SWIPE & SCREEN SWITCHER NAVIGATION
   ========================================================================= */
function switchScreen(idx) {
  if (idx === currentScreenIdx) return;
  triggerHaptic(8);
  currentScreenIdx = idx;

  const slider = document.getElementById('screensSlider');
  if (slider) {
    slider.style.transform = `translateX(-${currentScreenIdx * 50}%)`;
  }

  document.getElementById('tabCapture')?.classList.toggle('active', currentScreenIdx === 0);
  document.getElementById('tabHistory')?.classList.toggle('active', currentScreenIdx === 1);

  if (currentScreenIdx === 1) {
    renderHistoryView();
  }
}

function setupSwipeGestures() {
  const viewport = document.getElementById('viewport');
  const slider = document.getElementById('screensSlider');
  if (!viewport || !slider) return;

  let startX = 0;
  let startY = 0;
  let currentDeltaX = 0;
  let isHorizontal = false;
  let isTouching = false;
  let startedOnTxItem = false;

  viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('#catCarousel') || e.target.closest('input') || e.target.closest('.modal-backdrop')) {
      return;
    }
    startedOnTxItem = Boolean(e.target.closest('.tx-item'));
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentDeltaX = 0;
    isHorizontal = false;
    isTouching = true;
    slider.classList.add('no-anim');
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - startX;
    const diffY = touch.clientY - startY;

    // On History screen, leftward swipe on a transaction card is reserved for swipe-to-delete
    if (currentScreenIdx === 1 && startedOnTxItem && diffX < 0) {
      isTouching = false;
      slider.classList.remove('no-anim');
      slider.style.transform = `translateX(-${currentScreenIdx * 50}%)`;
      return;
    }

    if (!isHorizontal) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        isHorizontal = true;
      } else if (Math.abs(diffY) > 10) {
        isTouching = false;
        slider.classList.remove('no-anim');
        return;
      }
    }

    if (isHorizontal) {
      currentDeltaX = diffX;
      const baseOffset = -currentScreenIdx * 50;
      let percentDelta = (diffX / viewport.clientWidth) * 50;
      if ((currentScreenIdx === 0 && diffX > 0) || (currentScreenIdx === 1 && diffX < 0)) {
        percentDelta *= 0.3;
      }
      slider.style.transform = `translateX(${baseOffset + percentDelta}%)`;
    }
  }, { passive: true });

  const endTouch = () => {
    if (!isTouching) return;
    isTouching = false;
    slider.classList.remove('no-anim');

    const threshold = 55;
    if (currentDeltaX < -threshold && currentScreenIdx === 0) {
      switchScreen(1);
    } else if (currentDeltaX > threshold && currentScreenIdx === 1) {
      switchScreen(0);
    } else {
      slider.style.transform = `translateX(-${currentScreenIdx * 50}%)`;
    }
    currentDeltaX = 0;
  };

  viewport.addEventListener('touchend', endTouch);
  viewport.addEventListener('touchcancel', endTouch);
}

/* =========================================================================
   OPTIONS MODAL & KEYBOARD CONTROLS
   ========================================================================= */
function openModal() {
  updateLastSyncLabel();
  document.getElementById('optionsModal')?.classList.add('open');
}

function closeModal() {
  document.getElementById('optionsModal')?.classList.remove('open');
}

function closeModalOnBackdrop(e) {
  if (e.target.id === 'optionsModal') {
    closeModal();
  }
}

function isAnyModalOpen() {
  return Boolean(
    document.getElementById('optionsModal')?.classList.contains('open') ||
    document.getElementById('editModal')?.classList.contains('open')
  );
}

function setupPhysicalKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeEditModal();
      return;
    }

    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return;
    }
    if (isAnyModalOpen()) {
      return;
    }

    if (e.key >= '0' && e.key <= '9' && currentScreenIdx === 0) {
      pressDigit(e.key);
    } else if (e.key === '.' && currentScreenIdx === 0) {
      pressDigit('.');
    } else if (e.key === 'Backspace' && currentScreenIdx === 0) {
      pressBackspace();
    } else if (e.key === 'Enter' && currentScreenIdx === 0) {
      commitRecord();
    } else if (e.key === 'ArrowRight') {
      switchScreen(1);
    } else if (e.key === 'ArrowLeft') {
      switchScreen(0);
    }
  });
}
