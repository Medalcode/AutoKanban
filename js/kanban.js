// js/kanban.js
// Renderer for Kanban (used by index.html and app.js)
// Exports: renderKanban(containerId, data), renderErrorState(containerId, error), renderEmptyState(containerId, meta)

const PRIORITY_ORDER = { alta: 3, high: 3, media: 2, medium: 2, baja: 1, low: 1 };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'onclick') node.addEventListener('click', v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function normalizePriority(meta = {}) {
  const p = (meta.priority || meta.prioridad || '').toString().toLowerCase();
  return p || null;
}

function priorityScore(priority) {
  if (!priority) return 0;
  return PRIORITY_ORDER[priority] || 0;
}

function ensureTags(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function sortFeaturesByPriority(features) {
  return features.slice().sort((a, b) => {
    const pa = priorityScore(normalizePriority(a.metadata));
    const pb = priorityScore(normalizePriority(b.metadata));
    return pb - pa;
  });
}

function createBadge(key, value) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
  let bg = 'bg-gray-800 text-gray-200';
  if (key === 'prioridad' || key === 'priority') {
    const p = value.toString().toLowerCase();
    if (p.includes('alta') || p.includes('high')) bg = 'bg-red-600 text-white';
    else if (p.includes('media') || p.includes('medium')) bg = 'bg-yellow-500 text-black';
    else if (p.includes('baja') || p.includes('low')) bg = 'bg-green-600 text-white';
  } else if (key === 'tipo' || key === 'type') {
    bg = 'bg-indigo-600 text-white';
  } else if (key === 'tags' || key === 'tag') {
    bg = 'bg-gray-700 text-gray-100';
  }
  return el('span', { class: `${base} ${bg} mr-2 mb-2` }, `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
}

function createCard(feature) {
  const { title, done, metadata = {} } = feature;
  const card = el('article', { class: 'kanban-card bg-gray-800/60 border border-gray-700 rounded-lg p-4 shadow-sm', draggable: 'true', dataset: { id: feature.id } });
  const top = el('div', { class: 'flex items-start justify-between gap-3' });
  const titleEl = el('h3', { class: 'text-sm font-semibold leading-snug' }, title);
  const cb = el('input', { type: 'checkbox', disabled: true, class: 'w-4 h-4 mt-1' });
  if (done) cb.checked = true;
  top.append(titleEl, cb);
  card.append(top);
  const badges = el('div', { class: 'mt-3 flex flex-wrap items-center' });
  const pr = normalizePriority(metadata);
  if (pr) badges.append(createBadge('prioridad', pr));
  const tipo = metadata.tipo || metadata.type || null;
  if (tipo) badges.append(createBadge('tipo', tipo));
  const tags = ensureTags(metadata.tags || metadata.tag);
  if (tags.length) badges.append(createBadge('tags', tags));
  card.append(badges);
  return card;
}

function renderColumn(titleEmoji, titleText, features) {
  const header = el('div', { class: 'flex items-center justify-between mb-3' },
    el('h2', { class: 'text-sm font-semibold flex items-center gap-2' }, el('span', { class: 'text-lg' }, titleEmoji), titleText),
    el('span', { class: 'text-xs text-gray-300 bg-gray-800/40 px-2 py-0.5 rounded-full' }, String(features.length))
  );
  const col = el('section', { class: 'kanban-column bg-transparent rounded-md p-3', dataset: { state: titleText.toLowerCase() } }, header);
  const list = el('div', { class: 'space-y-3' });
  // placeholder used during drag
  const placeholder = el('div', { class: 'kanban-placeholder hidden border-2 border-dashed border-gray-600 rounded-md p-4 mb-3' }, 'Arrastra aquí');
  const sorted = sortFeaturesByPriority(features || []);
  if (sorted.length === 0) list.append(el('div', { class: 'text-xs text-gray-400 italic' }, 'Sin items'));
  else for (const f of sorted) list.append(createCard(f));
  col.append(placeholder, list);
  return col;
}

function renderWarningsPanel(warnings = []) {
  if (!warnings || warnings.length === 0) return null;
  const panel = el('div', { class: 'mb-4 bg-yellow-900/10 border border-yellow-700 rounded-lg' });
  const content = el('pre', { class: 'hidden p-4 text-xs font-mono text-yellow-100 overflow-auto whitespace-pre-wrap' }, warnings.join('\n'));
  const header = el('button', { class: 'w-full text-left px-4 py-3 flex items-center justify-between focus:outline-none', onclick: () => content.classList.toggle('hidden') },
    el('div', { class: 'flex items-center gap-2' }, el('span', { class: 'text-yellow-300' }, '⚠ Warnings')),
    el('small', { class: 'text-xs text-gray-300' }, `${warnings.length} items`)
  );
  panel.append(header, content);
  return panel;
}

export function renderKanban(containerId, data = {}) {
  const root = document.getElementById(containerId);
  if (!root) throw new Error(`Container not found: ${containerId}`);
  root.innerHTML = '';
  const meta = data.meta || {};
  const metaBar = el('div', { class: 'mb-4 flex items-center justify-between gap-4' },
    el('div', { class: 'text-xs text-gray-300' }, el('div', {}, `Project: ${meta.project || meta.proyecto || '-'}`), el('div', {}, `Author: ${meta.author || meta.autor || '-'}`)),
    el('div', { class: 'text-xs text-gray-400' }, new Date().toLocaleString())
  );
  // show local badge if flagged
  if (data._local) {
    const localBadge = el('span', { class: 'ml-3 text-xs text-yellow-200 bg-yellow-800/30 px-2 py-0.5 rounded' }, 'LOCAL');
    metaBar.append(localBadge);
  }
  root.append(metaBar);
  const warningsPanel = renderWarningsPanel(data.warnings || []);
  if (warningsPanel) root.append(warningsPanel);
  const grid = el('div', { class: 'grid gap-4 sm:grid-cols-1 md:grid-cols-3' });
  grid.append(renderColumn('🟡', 'Pendiente', data.pendiente || []), renderColumn('🔵', 'En Desarrollo', data.desarrollo || []), renderColumn('🟢', 'Completadas', data.completadas || []));
  root.append(grid);
}

// -- UX Handling for Empty/Error States --

export function renderErrorState(containerId, error) {
  const root = document.getElementById(containerId);
  if (!root) return;
  root.innerHTML = '';
  
  const container = el('div', { class: 'flex flex-col items-center justify-center py-20 text-center animate-pulse' });
  container.append(el('div', { class: 'text-6xl mb-4' }, '🔭'));
  container.append(el('h3', { class: 'text-xl font-bold text-red-400 mb-2' }, 'Houston, tenemos un problema'));
  
  let msg = error.message || 'Error desconocido';
  if (error.code === 404) msg = 'No encontramos el repositorio o el archivo Bitacora.md.';
  
  container.append(el('p', { class: 'text-gray-400 max-w-md mb-6' }, msg));
  
  const help = el('div', { class: 'text-xs text-gray-500' }, 
    'Verifica que el repo sea público y tenga un archivo ',
    el('code', { class: 'bg-gray-800 text-gray-300 px-1 rounded' }, 'Bitacora.md')
  );
  container.append(help);
  
  root.append(container);
}

export function renderEmptyState(containerId, meta) {
  const root = document.getElementById(containerId);
  if (!root) return;
  root.innerHTML = '';

  const container = el('div', { class: 'flex flex-col items-center justify-center py-20 text-center' });
  container.append(el('div', { class: 'text-6xl mb-4 grayscale opacity-50' }, '📝'));
  container.append(el('h3', { class: 'text-xl font-bold text-gray-200 mb-2' }, 'Tablero Vacío'));
  container.append(el('p', { class: 'text-gray-400 max-w-md mb-6' }, 
    `El archivo Bitacora.md existe, pero no detectamos tareas activas.`
  ));
  
  const hint = el('div', { class: 'text-xs text-gray-500 bg-gray-900/50 p-4 rounded-lg text-left' },
    el('p', { class: 'font-mono mb-2' }, 'Prueba agregando esto a tu Markdown:'),
    el('pre', { class: 'text-green-400' }, '## Pendiente\n- [ ] Mi primera tarea :tag:')
  );
  container.append(hint);
  
  root.append(container);
}
