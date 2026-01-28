// api/_lib/kanbanToMd.js
// Convert a normalized Kanban state into a Bitacora.md markdown string

function renderFeature(f) {
  const parts = [];
  // checkbox
  parts.push(f.flags && f.flags.done ? '[x]' : '[ ]');
  // title
  parts.push(f.title || f.id || '');
  // metadata inline
  const meta = [];
  if (f.metadata && f.metadata.path) meta.push(`path: ${f.metadata.path}`);
  if (f.metadata && f.metadata.tags) meta.push(`tags: ${Array.isArray(f.metadata.tags) ? f.metadata.tags.join(',') : f.metadata.tags}`);
  if (f.id) meta.push(`id: ${f.id}`);
  if (meta.length) parts.push('| ' + meta.join(' | '));
  return `- ${parts.join(' ')} `;
}

function renderSection(titleEmoji, title, features) {
  const header = `## ${titleEmoji} ${title}\n`;
  const body = (features || []).map(renderFeature).join('\n');
  return `${header}\n${body}\n`;
}

module.exports = function kanbanToBitacora(state = {}, opts = {}) {
  const meta = state.meta || {};
  const lines = [];
  // Front matter or metadata block
  if (meta && Object.keys(meta).length) {
    lines.push('<!--');
    for (const [k, v] of Object.entries(meta)) {
      lines.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
    lines.push('-->\n');
  }

  lines.push('# Bitacora');
  lines.push('');
  lines.push(renderSection('🟡', 'Pendiente', state.pendiente || []));
  lines.push(renderSection('🔵', 'En Desarrollo', state.desarrollo || []));
  lines.push(renderSection('🟢', 'Completadas', state.completadas || []));

  // warnings (optional)
  if (state.warnings && state.warnings.length) {
    lines.push('## Warnings');
    lines.push(state.warnings.map(w => `- ${w}`).join('\n'));
  }

  return lines.join('\n');
};
