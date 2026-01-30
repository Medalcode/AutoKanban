// js/app.js
// App wiring: UI, fetch from GitHub, parse and render Kanban
// Exports initApp()

import { normalizeKanban } from './model.js';
import { fetchKanbanFromGitSpy } from './api.js';
import { renderKanban, renderErrorState, renderEmptyState } from './kanban.js';
import { saveState, loadState, clearState, setLastRepo, getLastRepo } from './storage.js';
import { enableDragAndDrop, moveCard, reorderCard } from './dragdrop.js';
import { syncToGitSpy } from './sync.js';
import { fetchHistory, renderTimeline, renderHistoricalKanban, diffKanbans } from './history.js';

function qs(id) { return document.getElementById(id); }

function showLoader(el, show = true) {
  el.classList.toggle('hidden', !show);
}

function showMessage(container, text, type = 'info') {
  container.innerText = text;
  container.className = type === 'error' ? 'text-sm text-red-400' : 'text-sm text-green-300';
}

// Data Logic: Fetch + Normalize (No UI)
async function loadKanban(owner, repo) {
  const res = await fetchKanbanFromGitSpy(owner, repo);
  return normalizeKanban(res);
}

export function initApp() {
  const ownerEl = qs('gh-owner');
  const repoEl = qs('gh-repo');
  const pathEl = qs('gh-path');
  const branchEl = qs('gh-branch');
  const tokenEl = qs('gh-token');
  const saveTokenEl = qs('gh-save-token');
  const loadBtn = qs('gh-load');
  const msgEl = qs('gh-message');
  const loaderEl = qs('gh-loader');
  const localIndicator = qs('local-indicator');
  const clearLocalBtn = qs('clear-local');
  const syncBtn = qs('gh-sync');
  const dryRunEl = qs('sync-dryrun');
  const previewEl = qs('sync-preview');

  // Populate token from localStorage if present
  const stored = localStorage.getItem('gh_token');
  if (stored) {
    tokenEl.value = stored;
    saveTokenEl.checked = true;
  }

  // UX: Auto-fill from URL or Persistence
  const params = new URLSearchParams(window.location.search);
  const qOwner = params.get('owner');
  const qRepo = params.get('repo');
  
  let shouldAutoLoad = false;

  if (qOwner && qRepo) {
    // 1. Priority: URL Query Params
    ownerEl.value = qOwner;
    repoEl.value = qRepo;
    shouldAutoLoad = true;
  } else {
    // 2. Fallback: Last visited repo
    const last = getLastRepo();
    if (last && last.owner && last.repo) {
      ownerEl.value = last.owner;
      repoEl.value = last.repo;
      // We fill inputs but don't auto-load to avoid surprises, unless desired.
      // User can simply click "Load".
    }
  }

  const readConfigFromInputs = () => ({ owner: ownerEl.value.trim(), repo: repoEl.value.trim() });

  let currentState = null;
  let currentOwner = null;
  let currentRepo = null;

  function showLocalBadge(show) {
    if (!localIndicator || !clearLocalBtn) return;
    localIndicator.classList.toggle('hidden', !show);
    clearLocalBtn.classList.toggle('hidden', !show);
  }

  function persistAndRender(state) {
    currentState = state;
    // mark as local if loaded from localStorage
    if (!currentOwner || !currentRepo) return;
    // save state to localStorage
    saveState(currentOwner, currentRepo, state);
    state._local = true;
    renderKanban('kanban-root', state);
    enableDragAndDrop('kanban-root', {
      onMove: (fromKey, toKey, cardId) => {
        const ns = moveCard(currentState, fromKey, toKey, cardId);
        persistAndRender(ns);
      },
      onReorder: (key, fromIdx, toIdx) => {
        const ns = reorderCard(currentState, key, fromIdx, toIdx);
        persistAndRender(ns);
      }
    });
    showLocalBadge(true);
  }

  loadBtn.addEventListener('click', async () => {
    msgEl.innerText = '';
    const cfg = readConfigFromInputs();
    if (!cfg.owner || !cfg.repo) {
      showMessage(msgEl, 'Owner and repo are required', 'error');
      return;
    }
    currentOwner = cfg.owner;
    currentRepo = cfg.repo;
    
    // Updates: Persist last visited & Update URL
    setLastRepo(currentOwner, currentRepo);
    const newUrl = `${window.location.pathname}?owner=${encodeURIComponent(currentOwner)}&repo=${encodeURIComponent(currentRepo)}`;
    window.history.replaceState(null, '', newUrl);

    // Persist token if requested
    if (saveTokenEl.checked && tokenEl.value.trim()) {
      localStorage.setItem('gh_token', tokenEl.value.trim());
    } else {
      localStorage.removeItem('gh_token');
    }

    // Use local state if present
    const local = loadState(cfg.owner, cfg.repo);
    if (local) {
      // attach and render local
      persistAndRender(local);
      showLoader(loaderEl, false);
      showMessage(msgEl, 'Usando estado local guardado', 'info');
      return;
    }

    // --- Controller Flow: Load -> Check -> Render ---
    try {
      // 1. UI: Start Loading
      showLoader(loaderEl, true);
      showMessage(msgEl, 'Cargando...', 'info');
      qs('kanban-root').innerHTML = ''; // Reset View

      // 2. Data: Fetch & Normalize
      // (Independent of UI state)
      const data = await loadKanban(cfg.owner, cfg.repo);

      showLoader(loaderEl, false);

      // 3. Logic & Render
      const totalItems = data.pendiente.length + data.desarrollo.length + data.completadas.length;
      if (totalItems === 0) {
        showMessage(msgEl, 'Repositorio vacío o sin tareas', 'info');
        renderEmptyState('kanban-root', data.meta);
      } else {
        showMessage(msgEl, 'Carga correcta', 'info');
        renderAndAttach(data);
      }
    } catch (err) {
      // 4. Error Handling
      showLoader(loaderEl, false);
      console.error(err);
      renderErrorState('kanban-root', err);
      
      if (err.code === 404) showMessage(msgEl, 'No encontrado (404)', 'error');
      else if (err.code === 403) showMessage(msgEl, 'Acceso denegado (403)', 'error');
      else showMessage(msgEl, 'Error al cargar', 'error');
    }
  });

  clearLocalBtn && clearLocalBtn.addEventListener('click', () => {
    if (!currentOwner || !currentRepo) return;
    clearState(currentOwner, currentRepo);
    showLocalBadge(false);
    showMessage(msgEl, 'Estado local borrado. Recarga para usar datos remotos.', 'info');
  });

  syncBtn && syncBtn.addEventListener('click', async () => {
    if (!currentOwner || !currentRepo || !currentState) { showMessage(msgEl, 'Primero carga un proyecto con el botón "Cargar proyecto"', 'error'); return; }
    const proceed = confirm('Confirmar: enviar cambios locales a GitHub via GITSPY?');
    if (!proceed) return;
    const dr = dryRunEl && dryRunEl.checked;
    const pr = previewEl && previewEl.checked;
    try {
      showLoader(loaderEl, true);
      const resp = await syncToGitSpy(currentOwner, currentRepo, currentState, { dryRun: dr, preview: pr });
      showLoader(loaderEl, false);
      if (resp.preview) {
        // show preview in console and inform user
        console.log('Preview:', resp);
        showMessage(msgEl, 'Preview generado. Revisa la consola para ver diff.', 'info');
      } else if (resp.dryRun) {
        console.log('Dry run content:', resp.new);
        showMessage(msgEl, 'Dry run: no se realizó commit. Revisa consola.', 'info');
      } else if (resp.success || resp.commit) {
        showMessage(msgEl, 'Sincronización completada. Commit creado.', 'info');
        // after success, clear local state (optional) or keep mark
        clearState(currentOwner, currentRepo);
        showLocalBadge(false);
      }
    } catch (err) {
      showLoader(loaderEl, false);
      console.error(err);
      if (err.status === 409) showMessage(msgEl, 'Conflict (409): SHA mismatch. Re-fetch and merge manually.', 'error');
      else showMessage(msgEl, `Sync error: ${err.message}`, 'error');
    }
  });

  function renderAndAttach(parsed) {
    // parsed is data with keys pendiente/desarrollo/completadas
    currentState = Object.assign({}, parsed);
    currentState._local = false;
    renderKanban('kanban-root', currentState);
    enableDragAndDrop('kanban-root', {
      onMove: (fromKey, toKey, cardId) => {
        const ns = moveCard(currentState, fromKey, toKey, cardId);
        // save locally (do not send to backend)
        saveState(currentOwner, currentRepo, ns);
        currentState = ns; currentState._local = true;
        renderKanban('kanban-root', currentState);
        showLocalBadge(true);
      },
      onReorder: (key, fromIdx, toIdx) => {
        const ns = reorderCard(currentState, key, fromIdx, toIdx);
        saveState(currentOwner, currentRepo, ns);
        currentState = ns; currentState._local = true;
        renderKanban('kanban-root', currentState);
        showLocalBadge(true);
      }
    });
  }

  // If both owner & repo were provided via querystring, auto-click load
  if (shouldAutoLoad) {
    setTimeout(() => loadBtn.click(), 200);
  }

  // Timeline toggle
  const openTimelineBtn = qs('open-timeline');
  const timelineRoot = qs('timeline-root');
  const timelineList = qs('timeline-list');
  const timelineKanban = qs('timeline-kanban');
  openTimelineBtn && openTimelineBtn.addEventListener('click', async () => {
    if (!currentOwner || !currentRepo) { showMessage(msgEl, 'Carga un repo antes de abrir timeline', 'error'); return; }
    timelineRoot.classList.toggle('hidden');
    if (!timelineRoot.classList.contains('hidden')) {
      showLoader(loaderEl, true);
      try {
        const data = await fetchHistory(currentOwner, currentRepo, { per_page: 30, includeContent: false });
        showLoader(loaderEl, false);
        const commits = data.commits || [];
        renderTimeline('timeline-list', commits, async (commit) => {
          showLoader(loaderEl, true);
          // fetch commit content (call history with includeContent for single sha)
          const detail = await fetch(`/api/repos/${encodeURIComponent(currentOwner)}/${encodeURIComponent(currentRepo)}/bitacora/history?per_page=1&includeContent=true`).then(r=>r.json());
          // Find requested commit
          const found = (detail && detail.commits || []).find(c => c.sha === commit.sha);
          if (found && found.content) {
            renderHistoricalKanban('timeline-kanban', found.content);
            // diff with current state
            const current = currentState || {};
            const pastParsed = parseBitacora(found.content);
            const d = diffKanbans(current, pastParsed);
            console.log('Diff', d);
            showLoader(loaderEl, false);
            showMessage(msgEl, `Comparación lista. Añadidos: ${d.added.length}, Eliminados: ${d.removed.length}, Movidos: ${d.moved.length}`, 'info');
          } else {
            showLoader(loaderEl, false);
            showMessage(msgEl, 'No se pudo obtener contenido del commit seleccionado.', 'error');
          }
        });
      } catch (err) {
        showLoader(loaderEl, false);
        console.error(err);
        showMessage(msgEl, 'Error al cargar historial', 'error');
      }
    }
  });
}
