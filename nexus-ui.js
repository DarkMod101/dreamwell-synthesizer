/* Dream Binder · responsive UI and accessibility controller
 * UI-only. Does not alter oscillator, piano, choir, presets, or note lifecycle.
 */
(() => {
  'use strict';
  const overlay = document.getElementById('presetBrowserOverlay');
  if (!overlay) return;
  const dialog = overlay.querySelector('.preset-browser');
  const manager = document.getElementById('dbPresetManager');
  const toggle = document.getElementById('dbManagerToggle');
  const scroller = document.getElementById('dbLibraryScroll');
  const close = document.getElementById('closePresetBrowser');
  let returnFocus = null;
  const isOpen = () => !overlay.classList.contains('hidden');

  function setManagerVisible(open, focus = false) {
    if (!manager || !toggle) return;
    manager.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide tools' : 'Manage sounds';
    if (open && focus) {
      manager.scrollIntoView({block:'nearest',behavior:'instant'});
      document.getElementById('presetNameInput')?.focus({preventScroll:true});
    }
  }
  toggle?.addEventListener('click', () => setManagerVisible(manager.hidden, manager.hidden));
  document.getElementById('quickSavePreset')?.addEventListener('click', () => {
    setManagerVisible(true);
    requestAnimationFrame(() => {
      scroller?.scrollTo({top:0,behavior:'instant'});
      document.getElementById('presetNameInput')?.focus({preventScroll:true});
    });
  });
  // My Presets opens the management tools. Other banks keep the current state.
  document.querySelectorAll('.preset-browser-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.bank === 'user') setManagerVisible(true);
      requestAnimationFrame(() => { if (scroller) scroller.scrollTop = 0; });
      syncState();
    });
  });

  function syncState() {
    const open = isOpen();
    document.body.classList.toggle('db-library-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    dialog?.classList.toggle('db-atlas-active', Boolean(document.querySelector('.preset-browser-tab[data-bank="atlas"].active-bank')));
    if (open) {
      if (!returnFocus || !returnFocus.isConnected) returnFocus = document.activeElement;
      if (!overlay.contains(document.activeElement)) close?.focus({preventScroll:true});
    } else if (returnFocus) {
      const element = returnFocus;
      returnFocus = null;
      if (element.isConnected) element.focus({preventScroll:true});
    }
  }
  new MutationObserver(syncState).observe(overlay, {attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close?.click();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = [...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),label.preset-import-btn,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden');
    if (!elements.length) return;
    const first = elements[0];
    const last = elements[elements.length-1];
    if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
  });
  syncState();
})();
