// js/dragdrop.js
// Implements HTML5 Drag & Drop glue and pure state transformation helpers

// Pure: moveCard(state, fromKey, toKey, cardId) -> newState
export function moveCard(state, fromKey, toKey, cardId) {
  const keys = ['pendiente', 'desarrollo', 'completadas'];
  if (!state || !cardId) return state;
  const copy = { pendiente: (state.pendiente || []).slice(), desarrollo: (state.desarrollo || []).slice(), completadas: (state.completadas || []).slice(), meta: state.meta, warnings: state.warnings };
  if (!keys.includes(fromKey) || !keys.includes(toKey)) return copy;
  const fromArr = copy[fromKey] || [];
  const idx = fromArr.findIndex(f => f.id === cardId);
  if (idx === -1) return copy;
  const [card] = fromArr.splice(idx, 1);
  copy[toKey].push(card);
  return copy;
}

// Pure: reorderCard(state, key, fromIndex, toIndex) -> newState
export function reorderCard(state, key, fromIndex, toIndex) {
  const copy = { pendiente: (state.pendiente || []).slice(), desarrollo: (state.desarrollo || []).slice(), completadas: (state.completadas || []).slice(), meta: state.meta, warnings: state.warnings };
  const arr = copy[key];
  if (!arr || fromIndex < 0 || toIndex < 0 || fromIndex >= arr.length || toIndex > arr.length) return copy;
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, item);
  return copy;
}

// Attach DnD handlers to container; callbacks: onMove(fromKey,toKey,cardId), onReorder(key,fromIdx,toIdx)
export function enableDragAndDrop(rootId, callbacks = {}) {
  const root = document.getElementById(rootId);
  if (!root) return;

  let draggingEl = null;
  let draggingId = null;

  function findColumnEl(el) {
    while (el && el !== root) { if (el.classList && el.classList.contains('kanban-column')) return el; el = el.parentNode; }
    return null;
  }

  function getCardsInColumn(col) {
    return Array.from(col.querySelectorAll('.kanban-card'));
  }

  function showPlaceholder(col, afterEl) {
    const ph = col.querySelector('.kanban-placeholder');
    if (!ph) return;
    ph.classList.remove('hidden');
    const list = col.querySelector('div.space-y-3');
    if (afterEl == null) list.insertBefore(ph, list.firstChild);
    else list.insertBefore(ph, afterEl.nextSibling);
  }

  function hideAllPlaceholders() {
    root.querySelectorAll('.kanban-placeholder').forEach(p => p.classList.add('hidden'));
  }

  root.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest && ev.target.closest('.kanban-card');
    if (!card) return;
    draggingEl = card;
    draggingId = card.dataset.id;
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', draggingId); } catch (e) {}
    card.classList.add('opacity-60');
  });

  root.addEventListener('dragend', (ev) => {
    if (draggingEl) draggingEl.classList.remove('opacity-60');
    draggingEl = null; draggingId = null;
    hideAllPlaceholders();
  });

  root.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    const col = findColumnEl(ev.target);
    if (!col) return;
    const cards = getCardsInColumn(col).filter(c => c !== draggingEl);
    let afterEl = null;
    for (const c of cards) {
      const rect = c.getBoundingClientRect();
      if (ev.clientY < rect.top + rect.height / 2) { afterEl = c; break; }
    }
    showPlaceholder(col, afterEl);
  });

  root.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const col = findColumnEl(ev.target);
    if (!col) return;
    const toKeyRaw = col.dataset.state || '';
    const toKey = mapTitleToKey(toKeyRaw);
    const cardId = ev.dataTransfer.getData('text/plain') || (draggingEl && draggingEl.dataset.id);
    if (!cardId) return;

    // find source column
    const srcCol = root.querySelector(`.kanban-card[data-id="${cardId}"]`); // element or null
    let fromKey = null;
    if (srcCol) {
      const sc = findColumnEl(srcCol);
      if (sc) fromKey = mapTitleToKey(sc.dataset.state || '');
    }

    // compute target index for reorder
    const list = col.querySelector('div.space-y-3');
    const children = Array.from(list.children).filter(n => n.classList && n.classList.contains('kanban-card'));
    let toIndex = children.length; // default append
    // if placeholder present, compute insertion index
    const ph = col.querySelector('.kanban-placeholder');
    if (ph && !ph.classList.contains('hidden')) {
      const before = ph.nextSibling;
      const idx = children.indexOf(before);
      toIndex = idx === -1 ? children.length : idx;
    }

    hideAllPlaceholders();

    if (fromKey && fromKey !== toKey) {
      callbacks.onMove && callbacks.onMove(fromKey, toKey, cardId);
    } else if (fromKey && fromKey === toKey) {
      // compute fromIndex
      const srcColEl = root.querySelector(`.kanban-column[data-state="${srcCol ? mapTitleToKey(findColumnEl(srcCol).dataset.state) : ''}"]`);
      const srcList = findColumnEl(draggingEl) ? findColumnEl(draggingEl).querySelector('div.space-y-3') : null;
      const srcChildren = srcList ? Array.from(srcList.children).filter(n => n.classList && n.classList.contains('kanban-card')) : [];
      const fromIndex = srcChildren.findIndex(c => c.dataset.id === cardId);
      callbacks.onReorder && callbacks.onReorder(toKey, fromIndex, toIndex);
    }
  });

  function mapTitleToKey(text) {
    if (!text) return text;
    const t = text.toString().toLowerCase();
    if (t.includes('pend')) return 'pendiente';
    if (t.includes('desarrollo') || t.includes('desar')) return 'desarrollo';
    if (t.includes('complet') || t.includes('complete')) return 'completadas';
    return t;
  }
}
