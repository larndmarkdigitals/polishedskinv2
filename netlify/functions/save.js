/* ============================================================
   save.js — serverless "commit" function for the on-page editor.

   Receives a batch of text edits from the home-page editor and commits
   the updated content/*.json files to the repo's main branch via the
   GitHub API. (main is the draft branch; publish main -> live to deploy.)

   The GitHub token NEVER reaches the browser — it lives only here as an
   environment variable. The browser sends a shared password we check.

   Required environment variables (Netlify → Site settings → Environment):
     GITHUB_TOKEN   fine-grained PAT with Contents: Read & Write on the repo
     GITHUB_REPO    "larndmarkdigitals/polishedskinv2"
     EDIT_PASSWORD  the password typed in the editor
   Optional:
     GITHUB_BRANCH  defaults to "main"

   Request body (JSON):
     { "password": "…", "changes": { "home.hero.title": "New text", … } }
   Each change key is "<file>.<dot.path>"; <file> maps to content/<file>.json.
   ============================================================ */

const API = 'https://api.github.com';

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

// Set a nested value by dotted path, creating objects/arrays as needed.
function setPath(root, path, value) {
  const parts = path.split('.');
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (node[key] == null || typeof node[key] !== 'object') {
      node[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    node = node[key];
  }
  node[parts[parts.length - 1]] = value;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const { GITHUB_TOKEN, GITHUB_REPO, EDIT_PASSWORD } = process.env;
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  if (!GITHUB_TOKEN || !GITHUB_REPO) return json(500, { error: 'Server not configured (missing GITHUB_TOKEN / GITHUB_REPO).' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid JSON.' }); }

  if (EDIT_PASSWORD && payload.password !== EDIT_PASSWORD) return json(401, { error: 'Wrong password.' });

  const changes = payload.changes;
  if (!changes || typeof changes !== 'object' || !Object.keys(changes).length) {
    return json(400, { error: 'No changes provided.' });
  }

  // Group edits by target file: { home: [[path,val],…], site: […] }
  const byFile = {};
  for (const [key, val] of Object.entries(changes)) {
    if (typeof val !== 'string') return json(400, { error: 'Values must be text.' });
    const dot = key.indexOf('.');
    if (dot < 1) return json(400, { error: 'Bad field key: ' + key });
    const file = key.slice(0, dot);
    const path = key.slice(dot + 1);
    if (!/^[a-z0-9_-]+$/i.test(file)) return json(400, { error: 'Bad file: ' + file });
    (byFile[file] = byFile[file] || []).push([path, val]);
  }

  const ghHeaders = {
    Authorization: 'Bearer ' + GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'polished-skin-editor',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const contentsUrl = (f) => `${API}/repos/${GITHUB_REPO}/contents/content/${f}.json`;

  const saved = [];
  try {
    for (const [file, edits] of Object.entries(byFile)) {
      // 1. read current file (for its content + sha)
      const getRes = await fetch(`${contentsUrl(file)}?ref=${encodeURIComponent(BRANCH)}`, { headers: ghHeaders });
      if (!getRes.ok) return json(502, { error: `Could not read content/${file}.json (${getRes.status}).` });
      const meta = await getRes.json();
      let data;
      try { data = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8')); }
      catch (e) { return json(500, { error: `content/${file}.json is not valid JSON.` }); }

      // 2. apply edits
      for (const [path, val] of edits) setPath(data, path, val);

      // 3. commit updated file
      const updated = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64');
      const putRes = await fetch(contentsUrl(file), {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Edit content/${file}.json via on-page editor`,
          content: updated,
          sha: meta.sha,
          branch: BRANCH
        })
      });
      if (!putRes.ok) {
        const detail = await putRes.text();
        return json(502, { error: `Could not save content/${file}.json (${putRes.status}).`, detail: detail.slice(0, 300) });
      }
      saved.push(file + '.json');
    }
  } catch (err) {
    return json(500, { error: 'Unexpected error: ' + (err && err.message || err) });
  }

  return json(200, { ok: true, saved });
};
