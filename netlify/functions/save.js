/* ============================================================
   save.js — serverless "commit" function for the on-page editor.

   Receives a batch of text edits (possibly spanning several content files
   and several pages) and commits them ALL in a SINGLE commit to the repo's
   main branch, via the GitHub Git Data API. One publish = one commit = one
   deploy. (main is the draft branch — publish main -> live to deploy, or set
   Netlify to deploy main for save = live.)

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

  // Accept the widget value types the editor sends: text, numbers (stars),
  // toggles (booleans), and lists (arrays of strings).
  const okValue = (v) => {
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return true;
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
  };

  // Group edits by target file: { home: [[path,val],…], site: […] }
  const byFile = {};
  for (const [key, val] of Object.entries(changes)) {
    if (!okValue(val)) return json(400, { error: 'Unsupported value for ' + key });
    const dot = key.indexOf('.');
    if (dot < 1) return json(400, { error: 'Bad field key: ' + key });
    const file = key.slice(0, dot);
    const path = key.slice(dot + 1);
    if (!/^[a-z0-9_-]+$/i.test(file)) return json(400, { error: 'Bad file: ' + file });
    (byFile[file] = byFile[file] || []).push([path, val]);
  }

  const H = {
    Authorization: 'Bearer ' + GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'polished-skin-editor',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const repo = `${API}/repos/${GITHUB_REPO}`;

  async function gh(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const detail = await res.text().catch(function () { return ''; });
      const err = new Error('GitHub ' + res.status + ' at ' + url + ': ' + detail.slice(0, 200));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  try {
    // 1. current tip of the branch + its tree
    const ref = await gh(`${repo}/git/ref/heads/${encodeURIComponent(BRANCH)}`, { headers: H });
    const baseSha = ref.object.sha;
    const baseCommit = await gh(`${repo}/git/commits/${baseSha}`, { headers: H });
    const baseTree = baseCommit.tree.sha;

    // 2. for each file: read current JSON, apply its edits, upload a new blob
    const treeItems = [];
    const saved = [];
    for (const [file, edits] of Object.entries(byFile)) {
      const meta = await gh(`${repo}/contents/content/${file}.json?ref=${encodeURIComponent(BRANCH)}`, { headers: H });
      let data;
      try { data = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8')); }
      catch (e) { return json(500, { error: `content/${file}.json is not valid JSON.` }); }
      for (const [path, val] of edits) setPath(data, path, val);
      const blob = await gh(`${repo}/git/blobs`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ content: JSON.stringify(data, null, 2) + '\n', encoding: 'utf-8' })
      });
      treeItems.push({ path: `content/${file}.json`, mode: '100644', type: 'blob', sha: blob.sha });
      saved.push(file + '.json');
    }

    // 3. new tree -> new commit -> move the branch
    const tree = await gh(`${repo}/git/trees`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ base_tree: baseTree, tree: treeItems })
    });
    const commit = await gh(`${repo}/git/commits`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        message: 'Edit site content via on-page editor (' + saved.join(', ') + ')',
        tree: tree.sha,
        parents: [baseSha]
      })
    });
    await gh(`${repo}/git/refs/heads/${encodeURIComponent(BRANCH)}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({ sha: commit.sha })
    });

    return json(200, { ok: true, saved, commit: commit.sha });
  } catch (err) {
    return json(502, { error: 'Could not commit: ' + (err && err.message || err) });
  }
};
