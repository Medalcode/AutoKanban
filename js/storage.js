// js/storage.js
// localStorage helpers for AutoKanban

const LS_PREFIX = 'autokanban_state_v1';
const LS_LAST_REPO = 'autokanban_last_repo';

export function storageKey(owner, repo) {
  return `${LS_PREFIX}:${owner}:${repo}`;
}

export function saveState(owner, repo, state) {
  if (!owner || !repo || !state) return;
  const payload = { savedAt: new Date().toISOString(), owner, repo, state };
  try {
    localStorage.setItem(storageKey(owner, repo), JSON.stringify(payload));
  } catch (e) {
    console.warn('saveState failed', e);
  }
}

export function loadState(owner, repo) {
  try {
    const raw = localStorage.getItem(storageKey(owner, repo));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.state ? parsed.state : null;
  } catch (e) {
    console.warn('loadState failed', e);
    return null;
  }
}

export function clearState(owner, repo) {
  try { localStorage.removeItem(storageKey(owner, repo)); } catch (e) { }
}

// --- Persistence for User Preferences (Last visited repo) ---

export function setLastRepo(owner, repo) {
  if (!owner || !repo) return;
  try {
    localStorage.setItem(LS_LAST_REPO, JSON.stringify({ owner, repo }));
  } catch (e) {
    console.warn('setLastRepo failed', e);
  }
}

export function getLastRepo() {
  try {
    const raw = localStorage.getItem(LS_LAST_REPO);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
