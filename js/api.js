// js/api.js
// Simple client for the GITSPY kanban endpoint
// Exports: fetchKanbanFromGitSpy(owner, repo)

export async function fetchKanbanFromGitSpy(owner, repo) {
  if (!owner || !repo) throw new Error('owner and repo are required');
  
  // Usar ruta relativa para que funcione en el mismo despliegue de Vercel
  const base = '/api';
  
  // Nota: La ruta de la funcion es /repos/..., asi que concatenamos
  // API final: /api/repos/...
  const url = `${base}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/kanban`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (res.status === 404) {
    const err = new Error('Repo not found (404)');
    err.code = 404;
    throw err;
  }
  if (res.status === 403) {
    const err = new Error('Forbidden or rate limited (403)');
    err.code = 403;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`GITSPY API error: ${res.status} ${text}`);
    err.code = res.status;
    throw err;
  }

  const data = await res.json();
  // Expecting { meta, kanban: { pendiente, desarrollo, completadas }, warnings }
  return data;
}
