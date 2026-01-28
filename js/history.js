// js/history.js
// Timeline UI + history fetcher and diff logic

import { parseBitacora } from '../src/bitacoraParser.js';
import { renderKanban } from './kanban.js';

export async function fetchHistory(owner, repo, opts = {}) {
  const { per_page = 20, includeContent = false } = opts;
  const url = `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/bitacora/history?per_page=${per_page}&includeContent=${includeContent}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  return res.json();
}

export function renderTimeline(containerId, commits, onSelect) {
  const root = document.getElementById(containerId);
  if (!root) return;
  root.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'space-y-2';
  for (const c of commits) {
    const li = document.createElement('li');
    li.className = 'p-3 bg-gray-800/40 border border-gray-700 rounded flex items-center justify-between cursor-pointer hover:bg-gray-700';
    const left = document.createElement('div');
    left.innerHTML = `<div class="text-sm font-medium">${escapeHtml(c.message.split('\n')[0] || '').slice(0,120)}</div><div class="text-xs text-gray-400">${c.author || 'unknown'} • ${new Date(c.date).toLocaleString()}</div>`;
    const btn = document.createElement('button');
    btn.className = 'text-xs bg-indigo-600 px-2 py-1 rounded';
    btn.innerText = 'Ver';
    btn.addEventListener('click', () => onSelect && onSelect(c));
    li.append(left, btn);
    list.appendChild(li);
  }
  root.appendChild(list);
}

function escapeHtml(s) { return (s||'').replace(/[&<>]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }

// Diff two kanban states (logical diff by feature id)
export function diffKanbans(current, past) {
  // index by id -> column
  const mapCur = {}
  for (const col of ['pendiente','desarrollo','completadas']) {
    for (const f of (current[col]||[])) mapCur[f.id || f.title] = { col, feature: f };
  }
  const mapPast = {}
  for (const col of ['pendiente','desarrollo','completadas']) {
    for (const f of (past[col]||[])) mapPast[f.id || f.title] = { col, feature: f };
  }

  const added = [], removed = [], moved = [], changed = [];

  for (const id in mapPast) {
    if (!mapCur[id]) removed.push(mapPast[id]);
    else if (mapCur[id].col !== mapPast[id].col) moved.push({ id, from: mapPast[id].col, to: mapCur[id].col });
    // check done flag change
    else if ((mapCur[id].feature.done||false) !== (mapPast[id].feature.done||false)) changed.push({ id, before: mapPast[id].feature.done, after: mapCur[id].feature.done });
  }
  for (const id in mapCur) if (!mapPast[id]) added.push(mapCur[id]);
  return { added, removed, moved, changed };
}

export function renderHistoricalKanban(containerId, mdContent) {
  const parsed = parseBitacora(mdContent);
  // render read-only
  renderKanban(containerId, parsed);
}
