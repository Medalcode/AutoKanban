// js/api.js
// Cliente para la API pública de GitSpy
// Centraliza la comunicación HTTP y manejo de errores
// Exports: fetchKanbanFromGitSpy(owner, repo)

export const BASE_API_URL = 'https://git-spy-tau.vercel.app';

/**
 * Obtiene el tablero Kanban desde la API pública de GitSpy.
 * Maneja errores de red, HTTP 4xx/5xx y respuestas JSON inválidas.
 */
export async function fetchKanbanFromGitSpy(owner, repo) {
  if (!owner || !repo) throw new Error('Owner y Repo son obligatorios');

  // Construcción de la URL usando la constante base
  const url = `${BASE_API_URL}/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/kanban`;

  let res;
  try {
    res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  } catch (networkErr) {
    // Error de red (DNS, timeout, offline)
    console.error('Network error fetching Kanban:', networkErr);
    throw new Error(`Error de conexión al obtener Kanban: ${networkErr.message}`);
  }

  // Manejo de errores HTTP
  if (!res.ok) {
    let errorDetail = '';
    try {
      // Intentamos parsear el cuerpo de la respuesta como JSON
      const errorJson = await res.json();
      errorDetail = errorJson.error || errorJson.message || JSON.stringify(errorJson);
    } catch (jsonErr) {
      // Si falla el parseo JSON, intentamos obtener texto plano
      try {
        errorDetail = await res.text();
      } catch (textErr) {
        errorDetail = res.statusText; // Fallback final
      }
    }

    // Normalizar mensajes de error comunes
    const err = new Error(`GitSpy API Error (${res.status}): ${errorDetail}`);
    err.code = res.status;
    
    if (res.status === 404) err.message = 'Repositorio o Kanban no encontrado (404). Verifica que el repo sea público o exista.';
    if (res.status === 403) err.message = 'Acceso denegado o límite de API excedido (403).';

    throw err;
  }

  // Parseo de la respuesta exitosa
  try {
    const data = await res.json();
    return data;
  } catch (parseErr) {
    console.error('Invalid JSON response:', parseErr);
    throw new Error('La API devolvió una respuesta con formato inválido.');
  }
}
