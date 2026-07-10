/* ============================================================
   editor.js — on-page editor for the Polished Skin HOME page.

   Click "Edit" → click any text → "Save to site". Saving batches every
   change and POSTs it to /.netlify/functions/save, which commits the
   updated content/*.json files to the repo's main branch. (main is the
   draft branch — publish main -> live to deploy.)

   It knows which JSON field an element maps to by reading the SAME
   binding attributes content.js already renders from:
       data-h="hero.title"   -> home.json  hero.title
       data-h-para="…"        -> home.json  (multi-line)
       data-s="business.name" -> site.json  business.name
   Markdown fields (data-h-md), images (data-h-img/bg) and the composite
   footer blocks (data-s-*) are intentionally NOT touched here — those
   stay in the Sveltia CMS at /admin.

   No credential lives here. The GitHub token is only in the serverless
   function's environment; the browser just sends a password.

   Currently loaded on index.html only (home-page pilot).
   ============================================================ */
(function () {
  var SAVE_URL = '/.netlify/functions/save';
  var DRAFT_KEY = 'pse-onpage-draft';
  var PW_KEY = 'pse-onpage-pw';

  var editing = false;
  var orig = {};                              // field key -> last saved/loaded value

  // Map an element to { key, multi } using its binding attribute, or null.
  function info(el) {
    if (el.hasAttribute('data-h-para')) return { key: 'home.' + el.getAttribute('data-h-para'), multi: true };
    if (el.hasAttribute('data-h'))      return { key: 'home.' + el.getAttribute('data-h'),      multi: false };
    if (el.hasAttribute('data-s'))      return { key: 'site.' + el.getAttribute('data-s'),      multi: false };
    return null;
  }
  function fields() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-h],[data-h-para],[data-s]'))
      .filter(function (el) { return !el.closest('.oe-ui'); });
  }
  function readEl(el, multi) {
    return multi ? el.innerText.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')
                 : (el.textContent || '').trim();
  }
  function writeEl(el, v, multi) { if (multi) el.innerText = v; else el.textContent = v; }

  /* ---------- styles ---------- */
  var css = [
    '.oe-launch{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:8px;',
    'background:#16201f;color:#fff;border:none;border-radius:100px;padding:12px 20px;font:600 14px/1 Jost,system-ui,sans-serif;',
    'cursor:pointer;box-shadow:0 10px 26px rgba(20,40,38,.28);transition:.16s;}',
    '.oe-launch:hover{background:#268b82;transform:translateY(-2px);}',
    '.oe-launch[hidden],.oe-bar[hidden]{display:none!important;}',
    '.oe-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#16201f;color:#fff;',
    'display:flex;align-items:center;gap:12px;padding:12px 18px;box-shadow:0 -6px 22px rgba(0,0,0,.18);font:14px Jost,system-ui,sans-serif;}',
    '.oe-bar .hint{margin-right:auto;color:#bfe9e4;display:flex;align-items:center;gap:9px;}',
    '.oe-bar .dot{width:8px;height:8px;border-radius:50%;background:#34b3a8;animation:oepulse 1.4s infinite;}',
    '@keyframes oepulse{0%,100%{opacity:1}50%{opacity:.3}}',
    '.oe-b{border:none;border-radius:8px;padding:10px 16px;font:600 13.5px Jost,system-ui,sans-serif;cursor:pointer;transition:.15s;}',
    '.oe-save{background:#34b3a8;color:#fff;}.oe-save:hover{background:#2aa093;}.oe-save[disabled]{opacity:.5;cursor:default;}',
    '.oe-ghost{background:transparent;color:#cdddda;border:1px solid rgba(255,255,255,.28);}',
    '.oe-ghost:hover{background:rgba(255,255,255,.1);}',
    'body.oe-on [data-h],body.oe-on [data-h-para],body.oe-on [data-s]{outline:1.5px dashed rgba(52,179,168,.6);outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .15s,background .15s;}',
    'body.oe-on [data-h]:hover,body.oe-on [data-h-para]:hover,body.oe-on [data-s]:hover{outline-color:#34b3a8;background:rgba(52,179,168,.08);}',
    'body.oe-on [data-h]:focus,body.oe-on [data-h-para]:focus,body.oe-on [data-s]:focus{outline:2px solid #34b3a8;background:rgba(52,179,168,.12);}',
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
  launch.innerHTML = '✏️ Edit this page';
  document.body.appendChild(launch);

  var bar = document.createElement('div');
  bar.className = 'oe-ui oe-bar'; bar.hidden = true;
  bar.innerHTML =
    '<span class="hint"><span class="dot"></span>Click any text to edit it, then Save.</span>' +
    '<button class="oe-b oe-save" disabled>Save to site</button>' +
    '<button class="oe-b oe-ghost oe-discard">Discard changes</button>' +
    '<button class="oe-b oe-ghost oe-exit">Done</button>';
  document.body.appendChild(bar);

  var saveBtn = bar.querySelector('.oe-save');
  var discardBtn = bar.querySelector('.oe-discard');
  var exitBtn = bar.querySelector('.oe-exit');

  /* ---------- draft persistence ---------- */
  function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch (e) { return {}; } }
  function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function changed() {
    var out = {};
    fields().forEach(function (el) {
      var f = info(el); if (!f) return;
      var v = readEl(el, f.multi);
      var isChanged = v !== orig[f.key];
      el.classList.toggle('oe-changed', isChanged);
      if (isChanged) out[f.key] = v;
    });
    return out;
  }
  function refresh() {
    var diff = changed();
    var n = Object.keys(diff).length;
    saveBtn.disabled = n === 0;
    saveBtn.textContent = n ? 'Save to site (' + n + ')' : 'Save to site';
    if (n) saveDraft(diff); else clearDraft();
  }

  /* ---------- enter / exit ---------- */
  function enter() {
    editing = true;
    document.body.classList.add('oe-on');
    var draft = loadDraft();
    fields().forEach(function (el) {
      var f = info(el); if (!f) return;
      orig[f.key] = readEl(el, f.multi);
      if (draft[f.key] != null) writeEl(el, draft[f.key], f.multi);
      el.setAttribute('contenteditable', f.multi ? 'true' : 'plaintext-only');
      el.addEventListener('input', refresh);
      if (!f.multi) el.addEventListener('keydown', singleLineKeys);
    });
    launch.hidden = true; bar.hidden = false;
    refresh();
  }
  function exit() {
    editing = false;
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

  /* ---------- save ---------- */
  function save() {
    var diff = changed();
    if (!Object.keys(diff).length) { toast('No changes yet — click some text to edit.'); return; }

    var pw = sessionStorage.getItem(PW_KEY) || window.prompt('Enter the edit password to publish:');
    if (!pw) return;
    sessionStorage.setItem(PW_KEY, pw);

    saveBtn.disabled = true; var label = saveBtn.textContent; saveBtn.textContent = 'Saving…';
    fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, changes: diff })
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, ok: r.ok, body: j }; }, function () { return { status: r.status, ok: r.ok, body: {} }; }); })
      .then(function (res) {
        if (res.status === 401) { sessionStorage.removeItem(PW_KEY); toast('That password didn’t work — try again.'); return; }
        if (!res.ok) { toast('Couldn’t save: ' + (res.body.error || ('error ' + res.status))); return; }
        Object.keys(diff).forEach(function (k) { orig[k] = diff[k]; });
        clearDraft(); changed();
        toast('Saved ✓  It commits to the draft (main). Publish to make it live.');
      })
      .catch(function () { toast('Network problem — your edits are kept on this page. Try again.'); })
      .then(function () { saveBtn.textContent = label; refresh(); });
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.querySelector('.oe-toast');
    if (!t) { t = document.createElement('div'); t.className = 'oe-ui oe-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4200);
  }

  /* ---------- wire up ---------- */
  launch.addEventListener('click', enter);
  saveBtn.addEventListener('click', save);
  exitBtn.addEventListener('click', function () {
    if (Object.keys(changed()).length && !window.confirm('You have unsaved edits. Leave edit mode? (They stay as a draft on this device.)')) return;
    exit();
  });
  discardBtn.addEventListener('click', function () {
    if (!window.confirm('Discard your unsaved edits on this page?')) return;
    fields().forEach(function (el) { var f = info(el); if (f && orig[f.key] != null) writeEl(el, orig[f.key], f.multi); });
    clearDraft(); refresh();
  });
  document.addEventListener('click', function (e) {
    if (!editing) return;
    var a = e.target.closest('a');
    if (a && !a.closest('.oe-ui')) e.preventDefault();
  }, true);

  // Enable only once content.js has filled the bindings.
  if (window.PSE_CONTENT_READY) launch.hidden = false;
  else document.addEventListener('pse:loaded', function () { launch.hidden = false; });
})();
