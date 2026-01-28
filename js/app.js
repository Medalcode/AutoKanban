// js/app.js
// App wiring: UI, fetch from GitHub, parse and render Kanban
// Exports initApp()

import { fetchKanbanFromGitSpy } from './api.js';
import { renderKanban } from './kanban.js';
import { saveState, loadState, clearState } from './storage.js';
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

async function loadAndRender(config, opts = {}) {
  const { onStart, onDone, onError } = opts;
  try {
    onStart && onStart();
    const res = await fetchKanbanFromGitSpy(config.owner, config.repo);
    // GITSPY response shape: { meta, kanban: { pendiente, desarrollo, completadas }, warnings }
    const data = Object.assign({}, res.kanban || {}, { meta: res.meta || {}, warnings: res.warnings || [] });
    renderKanban('kanban-root', data);
    onDone && onDone(data);
  } catch (err) {
    onError && onError(err);
  }
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

  // Read owner/repo from query params if present -> auto-fill (and auto-load)
  const params = new URLSearchParams(window.location.search);
  const qOwner = params.get('owner');
  const qRepo = params.get('repo');
  if (qOwner) ownerEl.value = qOwner;
  if (qRepo) repoEl.value = qRepo;

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

    await loadAndRender(cfg, {
      onStart: () => { showLoader(loaderEl, true); showMessage(msgEl, 'Cargando...', 'info'); },
      onDone: (parsed) => { showLoader(loaderEl, false); showMessage(msgEl, 'Carga correcta', 'info'); renderAndAttach(parsed); },
      onError: (err) => {
        showLoader(loaderEl, false);
        console.error(err);
        if (err.code === 404) showMessage(msgEl, 'Archivo no encontrado (404). Revisa owner/repo/path.', 'error');
        else if (err.code === 401) showMessage(msgEl, 'Token inválido (401). Revisa el token.', 'error');
        else if (err.code === 403) showMessage(msgEl, 'Acceso denegado o rate limit (403). Intenta con token.', 'error');
        else showMessage(msgEl, `Error: ${err.message || err}`, 'error');
      }
    });
  });

  clearLocalBtn && clearLocalBtn.addEventListener('click', () => {
    if (!currentOwner || !currentRepo) return;
    clearState(currentOwner, currentRepo);
    showLocalBadge(false);
    showMessage(msgEl, 'Estado local borrado. Recarga para usar datos remotos.', 'info');
  });

  syncBtn && syncBtn.addEventListener('click', async () => {
    if (!currentOwner || !currentRepo || !currentState) { showMessage(msgEl, 'Carga un repo antes de sincronizar', 'error'); return; }
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
  if (qOwner && qRepo) {
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
