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

  // 2. Normalize columns
  const columnsMap = {
    'pendiente': ['pendiente', 'pending', 'todo'],
    'desarrollo': ['desarrollo', 'in_progress', 'doing', 'wip'],
    'completadas': ['completadas', 'completed', 'done']
  };
  const normalizedColumns = { pendiente: [], desarrollo: [], completadas: [] };

  // DETECT: Relational Format (GitSpy v2)
  // { kanban: { features: [...], states: { pending: [...ids...] } } }
  if (safeData.kanban && Array.isArray(safeData.kanban.features) && safeData.kanban.states) {
    const featureMap = new Map();
    safeData.kanban.features.forEach(f => {
      if (f && f.id) featureMap.set(f.id, f);
    });

    Object.keys(columnsMap).forEach(targetCol => {
      const possibleKeys = columnsMap[targetCol];
      // Find which key exists in 'states'
      const stateKey = possibleKeys.find(k => safeData.kanban.states[k]);
      
      if (stateKey && Array.isArray(safeData.kanban.states[stateKey])) {
        // Hydrate IDs to Objects
        normalizedColumns[targetCol] = safeData.kanban.states[stateKey]
          .map(id => {
            const f = featureMap.get(id);
            // If feature not found by ID (weird), create a placeholder or skip?
            // Better to show it as missing or try to find it in raw?
            // Actually, let's normalize the feature object found
            return f ? normalizeFeature(f, targetCol) : null;
          })
          .filter(Boolean);
      }
    });

  } else {
    // FALLBACK: Legacy/Simple Format (Nested Arrays)
    // { kanban: { pendiente: [...] } }
    Object.keys(columnsMap).forEach(targetCol => {
        const possibleKeys = columnsMap[targetCol];
        let foundData = null;
        
        // Search in data.kanban or root
        for (const key of possibleKeys) {
            if (safeData.kanban && Array.isArray(safeData.kanban[key])) {
                foundData = safeData.kanban[key]; break;
            }
            if (Array.isArray(safeData[key])) {
                foundData = safeData[key]; break;
            }
        }

        if (foundData) {
            normalizedColumns[targetCol] = foundData.map(item => normalizeFeature(item, targetCol));
        } else {
             // Just empty, maybe log if strict
             // logWarn('EMPTY_OR_MISSING_COL', `Column '${targetCol}' not found`);
        }
    });
  }

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
