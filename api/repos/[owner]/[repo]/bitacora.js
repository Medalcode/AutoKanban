const fetch = require('node-fetch');
const kanbanToBitacora = require('../../_lib/kanbanToMd');

// Vercel serverless handler for POST /api/repos/{owner}/{repo}/bitacora
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { owner, repo } = req.query || {};
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required in path' });

  const body = req.body || {};
  const state = body.state;
  const branch = body.branch || 'main';
  const dryRun = body.dryRun === true || body.dryRun === 'true';
  const preview = body.preview === true || body.preview === 'true';
  const message = body.message || 'chore: update Bitacora via AUTOKANBAN';

  if (!state || !state.pendiente || !state.desarrollo || !state.completadas) {
    return res.status(400).json({ error: 'Invalid payload: state with pendiente/desarrollo/completadas required' });
  }

  const allowed = process.env.ALLOWED_REPOS; // format: owner/repo,owner2/repo2
  if (allowed) {
    const ok = allowed.split(',').map(s => s.trim()).includes(`${owner}/${repo}`);
    if (!ok) return res.status(403).json({ error: 'This repo is not allowed to be modified' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured: missing GITHUB_TOKEN' });

  const path = 'Bitacora.md';
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;

  // fetch current file
  const curResp = await fetch(getUrl, { headers: { Accept: 'application/vnd.github.v3+json', Authorization: `token ${token}` } });
  if (curResp.status === 404) return res.status(404).json({ error: 'Bitacora.md not found' });
  if (!curResp.ok) {
    const txt = await curResp.text().catch(() => '');
    return res.status(502).json({ error: 'GitHub API error', detail: txt });
  }
  const curData = await curResp.json();
  const curSha = curData.sha;
  const curContent = Buffer.from(curData.content || '', 'base64').toString('utf8');

  // generate new content
  const newContent = kanbanToBitacora(state || {});

  if (preview) {
    return res.status(200).json({ preview: true, old: curContent, new: newContent });
  }

  if (dryRun) {
    return res.status(200).json({ dryRun: true, new: newContent });
  }

  // proceed to commit
  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const payload = {
    message,
    content: Buffer.from(newContent, 'utf8').toString('base64'),
    sha: curSha,
    branch
  };

  const putResp = await fetch(putUrl, { method: 'PUT', headers: { Accept: 'application/vnd.github.v3+json', Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

  if (putResp.status === 409) {
    // conflict/sha mismatch
    const latest = await fetch(getUrl, { headers: { Accept: 'application/vnd.github.v3+json', Authorization: `token ${token}` } });
    const latestData = latest.ok ? await latest.json() : null;
    return res.status(409).json({ error: 'Conflict: SHA mismatch', latest: latestData });
  }

  if (!putResp.ok) {
    const txt = await putResp.text().catch(() => '');
    return res.status(502).json({ error: 'Failed to update file', detail: txt });
  }

  const result = await putResp.json();
  return res.status(200).json({ success: true, commit: result.commit });
};
