// js/model.js
// Data contract definitions and normalization logic for AutoKanban
// Ensures the frontend is resilient to backend API changes or malformed data.

/**
 * @typedef {Object} Feature
 * @property {string} id - Unique identifier (or generated fallback)
 * @property {string} title - The main text of the task
 * @property {boolean} done - Completion status
 * @property {Object} metadata - Arbitrary metadata (tags, priority, etc.)
 */

/**
 * @typedef {Object} KanbanData
 * @property {Object} meta - Global board metadata
 * @property {string[]} warnings - List of parse warnings or errors
 * @property {Feature[]} pendiente - Tasks in "Pendiente" column
 * @property {Feature[]} desarrollo - Tasks in "En Desarrollo" column
 * @property {Feature[]} completadas - Tasks in "Completadas" column
 */

/**
 * Normalizes raw API data into a strict KanbanData contract.
 * Fills missing fields with defaults and sanitizes inputs.
 * 
 * @param {any} data - Raw data payload from API
 * @returns {KanbanData} - Safe, predictable data object
 */
const logWarn = (code, msg, data) => {
  console.warn(`[AutoKanban Warn] ${code}: ${msg}`, data || '');
};

/**
 * Normalizes raw API data into a strict KanbanData contract.
 * Fills missing fields with defaults and sanitizes inputs.
 * 
 * @param {any} data - Raw data payload from API
 * @returns {KanbanData} - Safe, predictable data object
 */
export function normalizeKanban(data) {
  // 1. Ensure root object exists
  if (!data || typeof data !== 'object') {
    logWarn('INVALID_ROOT', 'Received null or non-object root data', data);
    data = {};
  }
  const safeData = data;

  // 2. Normalize columns (defensive array check)
  // AutoKanban specifically expects these 3 columns.
  const columns = ['pendiente', 'desarrollo', 'completadas'];
  const normalizedColumns = {};
  
  // Detect unknown columns in source for logging
  const sourceColumns = safeData.kanban ? Object.keys(safeData.kanban) : Object.keys(safeData);
  const unknownCols = sourceColumns.filter(k => !columns.includes(k) && k !== 'meta' && k !== 'warnings' && k !== 'kanban');
  if (unknownCols.length > 0) {
    logWarn('UNKNOWN_COLUMNS', `Ignored extra columns: ${unknownCols.join(', ')}`);
  }

  columns.forEach(col => {
    // Check if column exists in kanban object or root (depending on API nesting)
    // The API usually returns { kanban: { pendiente: [] } } or just flat { pendiente: [] }
    // We check both for robustness.
    const rawCol = (safeData.kanban && safeData.kanban[col]) || safeData[col];
    
    if (Array.isArray(rawCol)) {
      normalizedColumns[col] = rawCol.map(item => normalizeFeature(item, col));
    } else {
      if (rawCol !== undefined) {
         logWarn('INVALID_COLUMN_TYPE', `Column '${col}' is not an array`, rawCol);
      }
      normalizedColumns[col] = [];
    }
  });

  // 3. Normalize Metadata
  let meta = {};
  if (safeData.meta && typeof safeData.meta === 'object') {
     meta = safeData.meta;
  } else if (safeData.meta !== undefined) {
     logWarn('INVALID_META', 'Meta field is not an object', safeData.meta);
  }

  // 4. Normalize Warnings
  const warnings = Array.isArray(safeData.warnings) ? safeData.warnings
                 : (typeof safeData.warnings === 'string' ? [safeData.warnings] : []);

  // Assemble final object
  return {
    meta,
    warnings,
    pendiente: normalizedColumns.pendiente,
    desarrollo: normalizedColumns.desarrollo,
    completadas: normalizedColumns.completadas
  };
}

/**
 * Normalizes a single feature item.
 * @param {any} item 
 * @param {string} contextCol - Name of the column for logging context
 * @returns {Feature}
 */
function normalizeFeature(item, contextCol) {
  if (!item || typeof item !== 'object') {
    logWarn('INVALID_ITEM', `Found non-object item in column '${contextCol}'`, item);
    return { id: `err-${Math.random()}`, title: '(Invalid Item)', done: false, metadata: {} };
  }

  const id = String(item.id || `unknown-${Math.random().toString(36).substr(2, 9)}`);
  
  let title = item.title;
  if (!title || typeof title !== 'string') {
     logWarn('MISSING_TITLE', `Item in '${contextCol}' has no title`, item);
     title = 'Untitled Task';
  }

  let metadata = {};
  if (item.metadata && typeof item.metadata === 'object') {
    metadata = item.metadata;
  } else if (item.metadata) {
    logWarn('INVALID_METADATA', `Item '${title}' has invalid metadata`, item.metadata);
  }

  return {
    id,
    title,
    done: Boolean(item.done),
    metadata
  };
}
