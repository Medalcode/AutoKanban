const fetch = require('node-fetch');
const { parseBitacora } = require('../../_lib/bitacoraParser');

// Vercel serverless handler for GET /api/repos/{owner}/{repo}/kanban
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { owner, repo } = req.query || {};
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required in path' });

  const branch = req.query.branch || 'main'; // O default branch si se pudiera detectar

  // Try to load Bitacora.md from GitHub RAW to avoid rate limits if public, or usage of API
  // Using API is safer for private repos if we have token, but here we expect usage mainly on open repos or providing token in headers?
  // The client app might send Authorization header.
  
  const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').replace('token ', '') : process.env.GITHUB_TOKEN;
  
  const path = 'Bitacora.md';
  const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  
  const headers = { 'Accept': 'application/vnd.github.v3.raw' };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const ghRes = await fetch(ghUrl, { headers });
    
    if (ghRes.status === 404) {
      return res.status(404).json({ error: 'Bitacora.md not found in repository' });
    }
    
    if (ghRes.status === 403) {
      return res.status(403).json({ error: 'Rate limit or forbidden', detail: await ghRes.text() });
    }
    
    if (!ghRes.ok) {
        return res.status(502).json({ error: 'GitHub API error', status: ghRes.status });
    }

    const mdContent = await ghRes.text();
    const parsed = parseBitacora(mdContent);
    
    return res.status(200).json({
      meta: parsed.meta,
      kanban: {
        pendiente: parsed.pendiente,
        desarrollo: parsed.desarrollo,
        completadas: parsed.completadas
      },
      warnings: parsed.warnings
    });
    
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
