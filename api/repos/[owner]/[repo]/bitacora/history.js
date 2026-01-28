const fetch = require('node-fetch');

// Simple in-memory cache shared across warm invocations
const CACHE = {};

function cacheKey(owner, repo, perPage, includeContent) {
  return `${owner}/${repo}:${perPage}:${includeContent}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { owner, repo } = req.query || {};
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo required in path' });

  const per_page = parseInt(req.query.per_page || '20', 10) || 20;
  const includeContent = req.query.includeContent === 'true' || req.query.includeContent === '1';
  const ttl = parseInt(process.env.HISTORY_TTL || '60', 10) * 1000;

  const allowed = process.env.ALLOWED_REPOS;
  if (allowed) {
    const ok = allowed.split(',').map(s => s.trim()).includes(`${owner}/${repo}`);
    if (!ok) return res.status(403).json({ error: 'This repo is not allowed' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured: missing GITHUB_TOKEN' });

  const key = cacheKey(owner, repo, per_page, includeContent);
  const now = Date.now();
  if (CACHE[key] && (now - CACHE[key].ts) < ttl) {
    return res.status(200).json({ cached: true, fetchedAt: new Date(CACHE[key].ts).toISOString(), commits: CACHE[key].data });
  }

  try {
    const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=Bitacora.md&per_page=${per_page}`;
    const commitsResp = await fetch(commitsUrl, { headers: { Accept: 'application/vnd.github.v3+json', Authorization: `token ${token}` } });
    if (!commitsResp.ok) {
      const txt = await commitsResp.text().catch(() => '');
      return res.status(502).json({ error: 'GitHub API error listing commits', detail: txt });
    }
    const commitsList = await commitsResp.json();

    const commits = [];
    for (const c of commitsList) {
      const item = {
        sha: c.sha,
        author: (c.commit && c.commit.author && c.commit.author.name) || (c.author && c.author.login) || null,
        date: (c.commit && c.commit.author && c.commit.author.date) || null,
        message: (c.commit && c.commit.message) || '',
      };
      if (includeContent) {
        // fetch file content at this commit
        const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/Bitacora.md?ref=${c.sha}`;
        const contentResp = await fetch(contentUrl, { headers: { Accept: 'application/vnd.github.v3+json', Authorization: `token ${token}` } });
        if (contentResp.ok) {
          const contentData = await contentResp.json();
          const text = contentData && contentData.content ? Buffer.from(contentData.content, 'base64').toString('utf8') : null;
          item.content = text;
        } else {
          item.content = null;
        }
      }
      commits.push(item);
    }

    CACHE[key] = { ts: Date.now(), data: commits };
    return res.status(200).json({ cached: false, fetchedAt: new Date().toISOString(), commits });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
};
