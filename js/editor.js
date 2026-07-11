/* ============================================================
   editor.js — site-wide on-page editor for Polished Skin.

   Click "Edit" (only appears when you open a page with #edit) → click any
   text on ANY page to change it → your edits accumulate as you move around
   the site → hit "Publish changes" once and everything commits together in
   a single commit to the repo's main branch. (main is the draft branch —
   publish main -> live to deploy, OR set Netlify to deploy main for
   save = live.)

   It knows which JSON field an element maps to by reading the binding
   attribute content.js already renders from:
       data-h="hero.title"        -> home.json   hero.title
       data-h-para="…"             -> home.json   (multi-line)
       data-s="business.name"      -> site.json   business.name
       data-a="story.heading"      -> about.json  story.heading
       data-cms="services.services.3.name" -> that file/path (dynamic lists)
   Markdown fields (data-h-md), images and composite footer blocks are left
   to the Sveltia CMS at /admin.

   No credential lives here. The GitHub token is only in the serverless
   function's environment; the browser just sends a password.
   ============================================================ */
(function () {
  var SAVE_URL = '/.netlify/functions/save';
  var DRAFT_KEY = 'pse-oe-draft';        // pending edits across ALL pages { path: value }
  var ACTIVE_KEY = 'pse-oe-active';       // "edit mode is on" — persists across navigation
  var ENABLED_KEY = 'pse-onpage-enabled'; // "#edit was seen this session"
  var PW_KEY = 'pse-oe-pw';

  var SEL = '[data-h],[data-h-para],[data-s],[data-a],[data-cms]';
  var editing = false;
  var orig = {};                          // this page's baseline: key -> committed value

  // Map an element to { key, multi } using its binding attribute, or null.
  function info(el) {
    if (el.hasAttribute('data-cms'))    return { key: el.getAttribute('data-cms'),          multi: el.hasAttribute('data-cms-multiline') };
    if (el.hasAttribute('data-h-para')) return { key: 'home.'  + el.getAttribute('data-h-para'), multi: true };
    if (el.hasAttribute('data-h'))      return { key: 'home.'  + el.getAttribute('data-h'),      multi: false };
    if (el.hasAttribute('data-a'))      return { key: 'about.' + el.getAttribute('data-a'),      multi: false };
    if (el.hasAttribute('data-s'))      return { key: 'site.'  + el.getAttribute('data-s'),      multi: false };
    return null;
  }
  function fields() {
    return Array.prototype.slice.call(document.querySelectorAll(SEL))
      .filter(function (el) { return !el.closest('.oe-ui'); });
  }
  function readEl(el, multi) {
    return multi ? el.innerText.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')
                 : (el.textContent || '').trim();
  }
  function writeEl(el, v, multi) { if (multi) el.innerText = v; else el.textContent = v; }

  function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch (e) { return {}; } }
  function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ---------- styles ---------- */
  var css = [
    '.oe-launch{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:8px;',
    'background:#16201f;color:#fff;border:none;border-radius:100px;padding:12px 20px;font:600 14px/1 Jost,system-ui,sans-serif;',
    'cursor:pointer;box-shadow:0 10px 26px rgba(20,40,38,.28);transition:.16s;}',
    '.oe-launch:hover{background:#268b82;transform:translateY(-2px);}',
    '.oe-launch[hidden],.oe-bar[hidden]{display:none!important;}',
    '.oe-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#16201f;color:#fff;',
    'display:flex;align-items:center;gap:12px;padding:12px 18px;box-shadow:0 -6px 22px rgba(0,0,0,.18);font:14px Jost,system-ui,sans-serif;flex-wrap:wrap;}',
    '.oe-bar .hint{margin-right:auto;color:#bfe9e4;display:flex;align-items:center;gap:9px;}',
    '.oe-bar .dot{width:8px;height:8px;border-radius:50%;background:#34b3a8;animation:oepulse 1.4s infinite;}',
    '@keyframes oepulse{0%,100%{opacity:1}50%{opacity:.3}}',
    '.oe-b{border:none;border-radius:8px;padding:10px 16px;font:600 13.5px Jost,system-ui,sans-serif;cursor:pointer;transition:.15s;}',
    '.oe-pub{background:#34b3a8;color:#fff;}.oe-pub:hover{background:#2aa093;}.oe-pub[disabled]{opacity:.5;cursor:default;}',
    '.oe-ghost{background:transparent;color:#cdddda;border:1px solid rgba(255,255,255,.28);}',
    '.oe-ghost:hover{background:rgba(255,255,255,.1);}',
    'body.oe-on [data-h],body.oe-on [data-h-para],body.oe-on [data-s],body.oe-on [data-a],body.oe-on [data-cms]{',
    'outline:1.5px dashed rgba(52,179,168,.6);outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .15s,background .15s;}',
    'body.oe-on [data-h]:hover,body.oe-on [data-h-para]:hover,body.oe-on [data-s]:hover,body.oe-on [data-a]:hover,body.oe-on [data-cms]:hover{outline-color:#34b3a8;background:rgba(52,179,168,.08);}',
    'body.oe-on [data-h]:focus,body.oe-on [data-h-para]:focus,body.oe-on [data-s]:focus,body.oe-on [data-a]:focus,body.oe-on [data-cms]:focus{outline:2px solid #34b3a8;background:rgba(52,179,168,.12);}',
    'body.oe-on .oe-changed{outline-color:#3a7d4a!important;background:rgba(58,125,74,.09)!important;}',
    '.oe-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%) translateY(16px);z-index:10000;',
    'background:#16201f;color:#fff;padding:12px 20px;border-radius:100px;font:14px Jost,system-ui,sans-serif;',
    'opacity:0;transition:.3s;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:90vw;text-align:center;}',
    '.oe-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}'
  ].join('');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- UI ---------- */
  var launch = document.createElement('button');
  launch.className = 'oe-ui oe-launch'; launch.hidden = true;
  launch.innerHTML = '✏️ Edit this site';
  document.body.appendChild(launch);

  var bar = document.createElement('div');
  bar.className = 'oe-ui oe-bar'; bar.hidden = true;
  bar.innerHTML =
    '<span class="hint"><span class="dot"></span>Click any text to edit it. Move between pages freely — changes are kept until you publish.</span>' +
    '<button class="oe-b oe-pub" disabled>Publish changes</button>' +
    '<button class="oe-b oe-ghost oe-discard">Discard all</button>' +
    '<button class="oe-b oe-ghost oe-exit">Done</button>';
  document.body.appendChild(bar);

  var pubBtn = bar.querySelector('.oe-pub');
  var discardBtn = bar.querySelector('.oe-discard');
  var exitBtn = bar.querySelector('.oe-exit');

  // Fold this page's current edits into the shared draft (leaving other pages'
  // pending edits untouched), then return the whole draft.
  function syncDraft() {
    var draft = loadDraft();
    fields().forEach(function (el) {
      var f = info(el); if (!f) return;
      var v = readEl(el, f.multi);
      var changed = v !== orig[f.key];
      el.classList.toggle('oe-changed', changed);
      if (changed) draft[f.key] = v; else delete draft[f.key];
    });
    saveDraft(draft);
    return draft;
  }
  function refresh() {
    var draft = syncDraft();
    var n = Object.keys(draft).length;
    pubBtn.disabled = n === 0;
    pubBtn.textContent = n ? 'Publish changes (' + n + ')' : 'Publish changes';
  }

  /* ---------- enter / exit ---------- */
  function enter() {
    editing = true;
    try { sessionStorage.setItem(ACTIVE_KEY, '1'); } catch (e) {}
    document.body.classList.add('oe-on');
    var draft = loadDraft();
    fields().forEach(function (el) {
      var f = info(el); if (!f) return;
      orig[f.key] = readEl(el, f.multi);
      if (draft[f.key] != null) writeEl(el, draft[f.key], f.multi);   // show pending edits
      el.setAttribute('contenteditable', f.multi ? 'true' : 'plaintext-only');
      el.addEventListener('input', refresh);
      if (!f.multi) el.addEventListener('keydown', singleLineKeys);
    });
    launch.hidden = true; bar.hidden = false;
    refresh();
  }
  function exit() {
    editing = false;
    try { sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {}
    document.body.classList.remove('oe-on');
    fields().forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.classList.remove('oe-changed');
      el.removeEventListener('input', refresh);
      el.removeEventListener('keydown', singleLineKeys);
    });
    launch.hidden = false; bar.hidden = true;
  }
  function singleLineKeys(e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }

  /* ---------- publish (commit the whole draft at once) ---------- */
  function publish() {
    var draft = syncDraft();
    if (!Object.keys(draft).length) { toast('No changes to publish yet.'); return; }

    var pw = sessionStorage.getItem(PW_KEY) || window.prompt('Enter the edit password to publish:');
    if (!pw) return;
    sessionStorage.setItem(PW_KEY, pw);

    pubBtn.disabled = true; var label = pubBtn.textContent; pubBtn.textContent = 'Publishing…';
    fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, changes: draft })
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, ok: r.ok, body: j }; }, function () { return { status: r.status, ok: r.ok, body: {} }; }); })
      .then(function (res) {
        if (res.status === 401) { sessionStorage.removeItem(PW_KEY); toast('That password didn’t work — try again.'); return; }
        if (!res.ok) { toast('Couldn’t publish: ' + (res.body.error || ('error ' + res.status))); return; }
        // Everything committed. This page's fields become the new baseline; the
        // shared draft (all pages) is cleared.
        fields().forEach(function (el) { var f = info(el); if (f && draft[f.key] != null) orig[f.key] = draft[f.key]; });
        clearDraft(); refresh();
        toast('Published ✓  Committed to the draft (main). It goes live on your next deploy.');
      })
      .catch(function () { toast('Network problem — your edits are kept. Try Publish again.'); })
      .then(function () { pubBtn.textContent = label; refresh(); });
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.querySelector('.oe-toast');
    if (!t) { t = document.createElement('div'); t.className = 'oe-ui oe-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4600);
  }

  /* ---------- wire up ---------- */
  launch.addEventListener('click', enter);
  pubBtn.addEventListener('click', publish);
  exitBtn.addEventListener('click', function () {
    var pending = Object.keys(loadDraft()).length;
    if (pending && !window.confirm('You have ' + pending + ' unpublished change(s) saved as a draft. Leave edit mode? (They’re kept until you publish or discard.)')) return;
    exit();
  });
  discardBtn.addEventListener('click', function () {
    if (!window.confirm('Discard ALL unpublished changes (across every page)?')) return;
    clearDraft();
    fields().forEach(function (el) { var f = info(el); if (f && orig[f.key] != null) writeEl(el, orig[f.key], f.multi); });
    refresh();
  });

  // While editing: let normal links (nav/footer) navigate so you can edit other
  // pages, but don't navigate away when you click an editable link (edit it).
  document.addEventListener('click', function (e) {
    if (!editing) return;
    var a = e.target.closest('a');
    if (!a || a.closest('.oe-ui')) return;
    if (a.matches(SEL) || a.closest(SEL)) e.preventDefault();
  }, true);

  /* ---------- reveal / auto-resume ---------- */
  // The Edit button is hidden from normal visitors. It appears only when edit
  // mode is requested by visiting any page with "#edit". Once seen, it stays on
  // for the session, so you can navigate the site and keep editing.
  function editModeRequested() {
    if ((location.hash || '').toLowerCase() === '#edit') {
      try { sessionStorage.setItem(ENABLED_KEY, '1'); } catch (e) {}
      return true;
    }
    try { return sessionStorage.getItem(ENABLED_KEY) === '1'; } catch (e) { return false; }
  }
  function boot() {
    if (!editModeRequested()) return;
    launch.hidden = false;
    var active = false; try { active = sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) {}
    if (active) enter();   // resume editing seamlessly after navigating
  }

  if (window.PSE_CONTENT_READY) boot();
  else document.addEventListener('pse:loaded', boot);
})();
