// js/sync.js
// Frontend helper to sync local kanban state to GITSPY server endpoint

export async function syncToGitSpy(owner, repo, state, opts = {}) {
  const { dryRun = false, preview = false, branch = 'main', message } = opts || {};
  const url = `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/bitacora`;
  const body = { state, dryRun, preview, branch };
  if (message) body.message = message;

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json && json.error ? json.error : `Sync failed: ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}
