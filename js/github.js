// js/github.js
// Simple GitHub REST API client for fetching a single file (contents endpoint)
// Exports: fetchBitacoraFromGitHub(config)

/**
 * Decode base64 (handles UTF-8 content)
 * @param {string} b64
 * @returns {string}
 */
function decodeBase64Unicode(b64) {
  // atob gives binary string; convert to percent-encoding then decode
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = [];
  for (let i = 0; i < bin.length; i++) bytes.push('%' + ('00' + bin.charCodeAt(i).toString(16)).slice(-2));
  return decodeURIComponent(bytes.join(''));
}

/**
 * Fetch a file (Bitacora.md) from GitHub repo via REST API v3
 * config: { owner, repo, path, branch, token }
 * Returns: { mdContent, sha }
 */
export async function fetchBitacoraFromGitHub(config) {
  const { owner, repo, path = 'Bitacora.md', branch = 'main', token } = config || {};
  if (!owner || !repo || !path) {
    throw new Error('Invalid config: owner, repo and path are required');
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;

  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(apiUrl, { headers });

  if (res.status === 404) {
    const err = new Error('File not found (404)');
    err.code = 404;
    throw err;
  }
  if (res.status === 401) {
    const err = new Error('Unauthorized (invalid token)');
    err.code = 401;
    throw err;
  }
  if (res.status === 403) {
    // Could be rate limit or forbidden
    const body = await res.json().catch(() => ({}));
    const msg = (body && body.message) ? body.message : 'Forbidden or rate limited (403)';
    const err = new Error(msg);
    err.code = 403;
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GitHub API error: ${res.status} ${body}`);
    err.code = res.status;
    throw err;
  }

  const data = await res.json();
  if (!data || !data.content) {
    const err = new Error('Unexpected API response: no content');
    err.code = 500;
    throw err;
  }

  const md = decodeBase64Unicode(data.content);
  return { mdContent: md, sha: data.sha };
}
