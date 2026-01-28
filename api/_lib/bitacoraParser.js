// api/_lib/bitacoraParser.js
// Parser para Bitacora.md -> objeto Kanban
// CommonJS implementation for Vercel functions

function tokenizeLines(mdContent) {
  if (typeof mdContent !== 'string') {
    throw new TypeError('mdContent must be a string');
  }
  mdContent = mdContent.replace(/^\uFEFF/, '');
  mdContent = mdContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = mdContent.split('\n');
  return rawLines.map((raw, idx) => ({ number: idx + 1, raw, trimmed: raw.trim() }));
}

function parseGlobalMetadata(lines, warnings = []) {
  const meta = {};
  const restStart = (() => {
    for (let i = 0; i < lines.length; i++) {
        const { number, raw, trimmed } = lines[i];
        if (trimmed === '' || /^#{1,6}\s+/.test(trimmed)) return i;
        const m = /^([\w-]+)\s*:\s*(.+)$/.exec(trimmed);
        if (!m) return i;
        const key = m[1].toLowerCase();
        const value = m[2].trim();
        if (key in meta) {
        warnings.push(`Duplicate global metadata key "${key}" ignored at line ${number}`);
        } else {
        meta[key] = value;
        }
    }
    return lines.length;
  })();

  const restLines = lines.slice(restStart);
  return { meta, restLines };
}

function groupSections(lines) {
  const SECTION_MAP = {
    '## 🟡 Pendiente': 'pendiente',
    '## 🔵 En Desarrollo': 'desarrollo',
    '## 🟢 Completadas': 'completadas',
  };

  const sections = { pendiente: [], desarrollo: [], completadas: [] };
  let current = null;
  for (const line of lines) {
    const t = line.trimmed;
    let matched = null;
    for (const header in SECTION_MAP) {
      if (t === header || t.startsWith(header + ' ' ) || t.startsWith(header + '\t')) {
        matched = SECTION_MAP[header];
        break;
      }
    }
    if (matched) {
      current = matched;
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }
  return sections;
}

function parseFeatureLine(line, section, warnings = []) {
  const { number, raw, trimmed } = line;
  const m = /^\s*-\s*\[( |x|X)\]\s+(.+)$/.exec(raw);
  if (!m) {
    warnings.push(`Invalid feature line at ${number}: "${raw.trim()}"`);
    return null;
  }
  const checkbox = m[1];
  const rest = m[2].trim();
  const done = checkbox.toLowerCase() === 'x';

  const parts = rest.split('|').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    warnings.push(`Invalid feature line at ${number}: missing title`);
    return null;
  }
  const title = parts[0];
  const metadata = {};

  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const mv = /^([\w-]+)\s*:\s*(.+)$/.exec(seg);
    if (!mv) {
      warnings.push(`Malformed metadata segment at ${number}: "${seg}"`);
      continue;
    }
    const key = mv[1].toLowerCase();
    const valueRaw = mv[2].trim();
    if (key in metadata) {
      warnings.push(`Duplicate feature metadata key "${key}" ignored at line ${number}`);
      continue;
    }
    if (key === 'tags') {
      const arr = valueRaw.split(',').map(s => s.trim()).filter(Boolean);
      metadata[key] = arr;
    } else if (valueRaw.includes(',')) {
      metadata[key] = valueRaw.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      metadata[key] = valueRaw;
    }
  }

  return { title, done, metadata };
}

function parseBitacora(mdContent) {
  const warnings = [];
  const lines = tokenizeLines(mdContent);
  const { meta, restLines } = parseGlobalMetadata(lines, warnings);
  const sections = groupSections(restLines);

  const result = {
    meta,
    pendiente: [],
    desarrollo: [],
    completadas: [],
    warnings,
  };

  for (const sec of ['pendiente', 'desarrollo', 'completadas']) {
    for (const line of sections[sec]) {
      if (!line.trimmed.startsWith('-')) continue;
      const parsed = parseFeatureLine(line, sec, warnings);
      if (parsed) result[sec].push(parsed);
    }
  }

  return result;
}

module.exports = {
  tokenizeLines,
  parseGlobalMetadata,
  groupSections,
  parseFeatureLine,
  parseBitacora
};
