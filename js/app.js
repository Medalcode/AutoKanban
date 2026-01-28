// js/app.js
// App wiring: UI, fetch from GitHub, parse and render Kanban
// Exports initApp()

import { fetchBitacoraFromGitHub } from './github.js';
import { parseBitacora } from '../src/bitacoraParser.js';
import { renderKanban } from './kanban.js';

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
    const { mdContent } = await fetchBitacoraFromGitHub(config);
    const parsed = parseBitacora(mdContent);
    renderKanban('kanban-root', parsed);
    onDone && onDone(parsed);
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

  // Populate token from localStorage if present
  const stored = localStorage.getItem('gh_token');
  if (stored) {
    tokenEl.value = stored;
    saveTokenEl.checked = true;
  }

  const readConfigFromInputs = () => ({
    owner: ownerEl.value.trim(),
    repo: repoEl.value.trim(),
    path: pathEl.value.trim() || 'Bitacora.md',
    branch: branchEl.value.trim() || 'main',
    token: tokenEl.value.trim() || undefined
  });

  loadBtn.addEventListener('click', async () => {
    msgEl.innerText = '';
    const cfg = readConfigFromInputs();
    if (!cfg.owner || !cfg.repo) {
      showMessage(msgEl, 'Owner and repo are required', 'error');
      return;
    }

    // Persist token if requested
    if (saveTokenEl.checked && tokenEl.value.trim()) {
      localStorage.setItem('gh_token', tokenEl.value.trim());
    } else {
      localStorage.removeItem('gh_token');
    }

    await loadAndRender(cfg, {
      onStart: () => { showLoader(loaderEl, true); showMessage(msgEl, 'Cargando...', 'info'); },
      onDone: (parsed) => { showLoader(loaderEl, false); showMessage(msgEl, 'Carga correcta', 'info'); },
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
}
