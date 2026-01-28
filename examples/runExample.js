// examples/runExample.js
// Ejemplo de uso del parser (ES modules)
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseBitacora } from '../src/bitacoraParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, 'Bitacora.md');
const content = await readFile(file, 'utf8');
const result = parseBitacora(content);
console.log(JSON.stringify(result, null, 2));
