/* ============================================================
   editor.js — site-wide on-page editor for Polished Skin.

   Two ways to edit, one shared draft, one "Publish changes" button:

   1. INLINE — click any plain page copy (hero, headings, paragraphs) and
      type. Fields are found via the binding attributes content.js renders
      from: data-h (home.json), data-h-para (multi-line), data-s (site.json),
      data-a (about.json), data-cms (dynamic lists).

   2. SIDE PANEL — click a "record" (a review, a service, a package, the
      business info/hours) and a panel slides in from the right with all of
      that record's fields as proper controls (text, star rating, toggles,
      lists, an hours grid). A record is marked in the HTML with
        data-cms-record="<file>.<path.to.object>"   e.g. reviews.reviews.3
        data-cms-type="<type>"                       e.g. review
      and the fields/widgets come from window.CMS_SCHEMA (see js/cms-schema.js).

   Edits from BOTH modes accumulate across every page in one localStorage
   draft and commit together in a single commit via /.netlify/functions/save.

   REUSE: this file is site-agnostic. To use it on another site, copy it,
   write a cms-schema.js, and stamp records/bindings in that site's content.js.
   No credential lives here — the GitHub token is only in the function's env.
   ============================================================ */
(function () {
  var SAVE_URL = '/.netlify/functions/save';
  var DRAFT_KEY = 'pse-oe-draft';
  var ACTIVE_KEY = 'pse-oe-active';
  var ENABLED_KEY = 'pse-onpage-enabled';
  var PW_KEY = 'pse-oe-pw';

  var SEL = '[data-h],[data-h-para],[data-s],[data-a],[data-cms]';
  var editing = false;
  var orig = {};

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch (e) { return {}; } }
  function saveDraft(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ---- inline field helpers ---- */
  function info(elm) {
    if (elm.hasAttribute('data-cms'))    return { key: elm.getAttribute('data-cms'),               multi: elm.hasAttribute('data-cms-multiline') };
    if (elm.hasAttribute('data-h-para')) return { key: 'home.'  + elm.getAttribute('data-h-para'), multi: true };
    if (elm.hasAttribute('data-h'))      return { key: 'home.'  + elm.getAttribute('data-h'),      multi: false };
    if (elm.hasAttribute('data-a'))      return { key: 'about.' + elm.getAttribute('data-a'),      multi: false };
    if (elm.hasAttribute('data-s'))      return { key: 'site.'  + elm.getAttribute('data-s'),      multi: false };
    return null;
  }
  // Inline fields = bound elements that are NOT inside a record (records use the panel).
  function fields() {
    return Array.prototype.slice.call(document.querySelectorAll(SEL))
      .filter(function (e) { return !e.closest('.oe-ui') && !e.closest('[data-cms-record]'); });
  }
  function records() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-cms-record]'))
      .filter(function (e) { return !e.closest('.oe-ui'); });
  }
  // Markdown blocks — larger rich-text passages edited as their Markdown source
  // in a panel (data-cms-md=path, or the home/about markdown bindings).
  var MD_SEL = '[data-cms-md],[data-h-md],[data-a-md]';
  function mdInfo(e) {
    if (e.hasAttribute('data-cms-md')) return e.getAttribute('data-cms-md');
    if (e.hasAttribute('data-h-md'))   return 'home.'  + e.getAttribute('data-h-md');
    if (e.hasAttribute('data-a-md'))   return 'about.' + e.getAttribute('data-a-md');
    return null;
  }
  function mdBlocks() {
    return Array.prototype.slice.call(document.querySelectorAll(MD_SEL))
      .filter(function (e) { return !e.closest('.oe-ui') && !e.closest('[data-cms-record]'); });
  }
  function readEl(e, multi) {
    return multi ? e.innerText.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') : (e.textContent || '').trim();
  }
  function writeEl(e, v, multi) { if (multi) e.innerText = v; else e.textContent = v; }

  /* ---- record data lookup ---- */
  function resolvePath(root, path) {
    var parts = path.split('.'), o = root;
    for (var i = 0; i < parts.length && o != null; i++) o = o[parts[i]];
    return o;
  }
  function recordData(recordPath) { return resolvePath(window.CMS_DATA || {}, recordPath); }
  function fieldValue(recordPath, field) {
    var draft = loadDraft();
    var rec = recordData(recordPath) || {};
    if (field.type === 'hours') {
      var hrs = rec[field.key] || [];
      return hrs.map(function (h, i) {
        var tk = recordPath + '.' + field.key + '.' + i + '.time';
        var ck = recordPath + '.' + field.key + '.' + i + '.closed';
        return { day: h.day, time: draft[tk] != null ? draft[tk] : h.time, closed: draft[ck] != null ? draft[ck] : h.closed };
      });
    }
    var key = recordPath + '.' + field.key;
    if (draft[key] != null) return draft[key];
    var v = rec[field.key];
    return v == null ? field.default : v;
  }
  function setField(key, value) { var d = loadDraft(); d[key] = value; saveDraft(d); refresh(); }
  function liveText(key, value) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cms="' + key + '"]'), function (n) { n.textContent = value; });
  }

  /* ---------- styles ---------- */
  var css = [
    '.oe-launch{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:8px;background:#16201f;color:#fff;border:none;border-radius:100px;padding:12px 20px;font:600 14px/1 Jost,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 26px rgba(20,40,38,.28);transition:.16s;}',
    '.oe-launch:hover{background:#268b82;transform:translateY(-2px);}',
    '.oe-launch[hidden],.oe-bar[hidden]{display:none!important;}',
    '.oe-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#16201f;color:#fff;display:flex;align-items:center;gap:12px;padding:12px 18px;box-shadow:0 -6px 22px rgba(0,0,0,.18);font:14px Jost,system-ui,sans-serif;flex-wrap:wrap;}',
    '.oe-bar .hint{margin-right:auto;color:#bfe9e4;display:flex;align-items:center;gap:9px;}',
    '.oe-bar .dot{width:8px;height:8px;border-radius:50%;background:#34b3a8;animation:oepulse 1.4s infinite;}',
    '@keyframes oepulse{0%,100%{opacity:1}50%{opacity:.3}}',
    '.oe-b{border:none;border-radius:8px;padding:10px 16px;font:600 13.5px Jost,system-ui,sans-serif;cursor:pointer;transition:.15s;}',
    '.oe-pub{background:#34b3a8;color:#fff;}.oe-pub:hover{background:#2aa093;}.oe-pub[disabled]{opacity:.5;cursor:default;}',
    '.oe-ghost{background:transparent;color:#cdddda;border:1px solid rgba(255,255,255,.28);}.oe-ghost:hover{background:rgba(255,255,255,.1);}',
    'body.oe-on .oe-inline{outline:1.5px dashed rgba(52,179,168,.6);outline-offset:3px;border-radius:3px;cursor:text;transition:.15s;}',
    'body.oe-on .oe-inline:hover{outline-color:#34b3a8;background:rgba(52,179,168,.08);}',
    'body.oe-on .oe-inline:focus{outline:2px solid #34b3a8;background:rgba(52,179,168,.12);}',
    'body.oe-on .oe-record{outline:1.5px dashed rgba(176,125,74,.55);outline-offset:4px;border-radius:6px;cursor:pointer;transition:.15s;position:relative;}',
    'body.oe-on .oe-record:hover{outline:2px solid #b07d4a;background:rgba(176,125,74,.06);}',
    'body.oe-on .oe-record-changed{outline-color:#3a7d4a!important;}',
    'body.oe-on .oe-md-block{outline:1.5px dashed rgba(52,179,168,.55);outline-offset:4px;border-radius:6px;cursor:pointer;transition:.15s;}',
    'body.oe-on .oe-md-block:hover{outline:2px solid #34b3a8;background:rgba(52,179,168,.06);}',
    'body.oe-on .oe-md-changed{outline-color:#3a7d4a!important;}',
    '.oe-md-ta{min-height:280px;font:13.5px/1.6 ui-monospace,Menlo,monospace;}',
    'body.oe-on .oe-changed{outline-color:#3a7d4a!important;background:rgba(58,125,74,.09)!important;}',
    /* panel */
    '.oe-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(20,32,31,.32);opacity:0;pointer-events:none;transition:.2s;}',
    '.oe-backdrop.show{opacity:1;pointer-events:auto;}',
    '.oe-panel{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:92vw;z-index:10001;background:#fff;box-shadow:-14px 0 40px rgba(20,32,31,.22);transform:translateX(100%);transition:transform .24s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;font:14px Inter,system-ui,sans-serif;color:#2c2019;}',
    '.oe-panel.open{transform:translateX(0);}',
    '.oe-phead{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid #eee2d5;}',
    '.oe-phead h3{margin:0;font:600 17px Jost,serif;color:#16201f;flex:1;}',
    '.oe-close{border:none;background:#f2ece3;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;color:#6f5b48;}',
    '.oe-close:hover{background:#e7dccd;}',
    '.oe-pbody{padding:16px 20px;overflow-y:auto;flex:1;}',
    '.oe-field{margin-bottom:16px;}',
    '.oe-label{display:block;font:600 12.5px Jost,sans-serif;letter-spacing:.02em;color:#6f5b48;margin-bottom:6px;}',
    '.oe-input{width:100%;border:1px solid #ddd0be;border-radius:8px;padding:9px 11px;font:14px Inter,sans-serif;color:#2c2019;background:#fff;box-sizing:border-box;}',
    '.oe-input:focus{outline:none;border-color:#34b3a8;box-shadow:0 0 0 3px rgba(52,179,168,.15);}',
    'textarea.oe-input{min-height:88px;resize:vertical;line-height:1.5;}',
    '.oe-stars{display:flex;gap:4px;font-size:26px;line-height:1;}',
    '.oe-star{color:#e0d5c4;cursor:pointer;transition:.1s;}.oe-star.on{color:#e6b422;}.oe-star:hover{transform:scale(1.12);}',
    '.oe-switch{position:relative;display:inline-block;width:44px;height:25px;}',
    '.oe-switch input{opacity:0;width:0;height:0;}',
    '.oe-slider{position:absolute;inset:0;background:#d9ccbb;border-radius:25px;transition:.2s;cursor:pointer;}',
    '.oe-slider:before{content:"";position:absolute;height:19px;width:19px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s;}',
    '.oe-switch input:checked + .oe-slider{background:#34b3a8;}',
    '.oe-switch input:checked + .oe-slider:before{transform:translateX(19px);}',
    '.oe-list-row{display:flex;gap:8px;margin-bottom:8px;}',
    '.oe-x{border:none;background:#f2ece3;color:#a5765a;width:34px;border-radius:8px;cursor:pointer;flex:none;}.oe-x:hover{background:#ecdccd;}',
    '.oe-add{border:1px dashed #cbb89f;background:none;color:#6f5b48;border-radius:8px;padding:8px;width:100%;cursor:pointer;font:600 13px Jost,sans-serif;}.oe-add:hover{background:#faf6f0;}',
    '.oe-hrow{display:flex;align-items:center;gap:10px;margin-bottom:9px;}',
    '.oe-hrow .oe-day{width:82px;font:600 12.5px Jost,sans-serif;color:#4a3a2c;flex:none;}',
    '.oe-hrow .oe-input{flex:1;}',
    '.oe-hclosed{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#8a7862;flex:none;}',
    '.oe-hint2{font-size:12px;color:#9a8873;margin:-6px 0 14px;}',
    '.oe-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%) translateY(16px);z-index:10002;background:#16201f;color:#fff;padding:12px 20px;border-radius:100px;font:14px Jost,sans-serif;opacity:0;transition:.3s;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:90vw;text-align:center;}',
    '.oe-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}'
  ].join('');
  var st = el('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- UI: launch button + bottom bar ---------- */
  var launch = el('button', 'oe-ui oe-launch'); launch.hidden = true;
  launch.innerHTML = '✏️ Edit this site'; document.body.appendChild(launch);

  var bar = el('div', 'oe-ui oe-bar'); bar.hidden = true;
  bar.innerHTML =
    '<span class="hint"><span class="dot"></span>Click plain text to type, or click a review / service / hours to open its editor. Move between pages freely.</span>' +
    '<button class="oe-b oe-pub" disabled>Publish changes</button>' +
    '<button class="oe-b oe-ghost oe-discard">Discard all</button>' +
    '<button class="oe-b oe-ghost oe-exit">Done</button>';
  document.body.appendChild(bar);
  var pubBtn = bar.querySelector('.oe-pub');

  /* ---------- UI: side panel ---------- */
  var backdrop = el('div', 'oe-ui oe-backdrop'); document.body.appendChild(backdrop);
  var panel = el('div', 'oe-ui oe-panel');
  panel.innerHTML = '<div class="oe-phead"><h3 class="oe-ptitle">Edit</h3><button class="oe-close" title="Close">✕</button></div><div class="oe-pbody"></div>';
  document.body.appendChild(panel);
  var panelTitle = panel.querySelector('.oe-ptitle');
  var panelBody = panel.querySelector('.oe-pbody');
  panel.querySelector('.oe-close').addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });

  /* ---------- draft sync + counts ---------- */
  function syncDraft() {
    var draft = loadDraft();
    fields().forEach(function (e) {
      var f = info(e); if (!f) return;
      var v = readEl(e, f.multi);
      var changed = v !== orig[f.key];
      e.classList.toggle('oe-changed', changed);
      if (changed) draft[f.key] = v; else delete draft[f.key];
    });
    saveDraft(draft);
    return draft;
  }
  function refresh() {
    var draft = syncDraft();
    records().forEach(function (e) {
      var rp = e.getAttribute('data-cms-record') + '.';
      var has = Object.keys(draft).some(function (k) { return k.indexOf(rp) === 0; });
      e.classList.toggle('oe-record-changed', has);
    });
    mdBlocks().forEach(function (e) { var k = mdInfo(e); e.classList.toggle('oe-md-changed', !!(k && draft[k] != null)); });
    var n = Object.keys(draft).length;
    pubBtn.disabled = n === 0;
    pubBtn.textContent = n ? 'Publish changes (' + n + ')' : 'Publish changes';
  }

  /* ---------- panel widgets ---------- */
  function textWidget(recordPath, field, multi) {
    var input = document.createElement(multi ? 'textarea' : 'input');
    if (!multi) input.type = 'text';
    input.className = 'oe-input';
    var v = fieldValue(recordPath, field); input.value = v == null ? '' : v;
    input.addEventListener('input', function () {
      setField(recordPath + '.' + field.key, input.value);
      liveText(recordPath + '.' + field.key, input.value);
    });
    return input;
  }
  function starsWidget(recordPath, field, recordEl) {
    var wrap = el('div', 'oe-stars');
    var cur = Math.max(1, Math.min(5, Math.round(+fieldValue(recordPath, field) || 5)));
    function paint(n) { Array.prototype.forEach.call(wrap.children, function (s, i) { s.classList.toggle('on', i < n); }); }
    for (var k = 1; k <= 5; k++) (function (k) {
      var s = el('span', 'oe-star'); s.textContent = '★';
      s.addEventListener('click', function () {
        paint(k); setField(recordPath + '.' + field.key, k);
        var st2 = recordEl && recordEl.querySelector('.stars'); if (st2) st2.textContent = new Array(k + 1).join('★');
      });
      wrap.appendChild(s);
    })(k);
    paint(cur);
    return wrap;
  }
  function toggleWidget(recordPath, field) {
    var lab = el('label', 'oe-switch');
    var input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!fieldValue(recordPath, field);
    input.addEventListener('change', function () { setField(recordPath + '.' + field.key, input.checked); });
    lab.appendChild(input); lab.appendChild(el('span', 'oe-slider'));
    return lab;
  }
  function listWidget(recordPath, field) {
    var wrap = el('div', 'oe-listw');
    var items = (fieldValue(recordPath, field) || []).slice();
    function commit() { setField(recordPath + '.' + field.key, items.slice()); }
    function draw() {
      wrap.innerHTML = '';
      items.forEach(function (it, idx) {
        var row = el('div', 'oe-list-row');
        var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'oe-input'; inp.value = it;
        inp.addEventListener('input', function () { items[idx] = inp.value; commit(); });
        var rm = el('button', 'oe-x'); rm.type = 'button'; rm.textContent = '✕';
        rm.addEventListener('click', function () { items.splice(idx, 1); commit(); draw(); });
        row.appendChild(inp); row.appendChild(rm); wrap.appendChild(row);
      });
      var add = el('button', 'oe-add'); add.type = 'button'; add.textContent = '+ Add item';
      add.addEventListener('click', function () { items.push(''); commit(); draw(); });
      wrap.appendChild(add);
    }
    draw();
    return wrap;
  }
  function hoursWidget(recordPath, field) {
    var wrap = el('div', 'oe-hoursw');
    (fieldValue(recordPath, field) || []).forEach(function (h, i) {
      var row = el('div', 'oe-hrow');
      var day = el('span', 'oe-day'); day.textContent = h.day;
      var time = document.createElement('input'); time.type = 'text'; time.className = 'oe-input'; time.value = h.time; time.disabled = !!h.closed;
      time.addEventListener('input', function () { setField(recordPath + '.' + field.key + '.' + i + '.time', time.value); });
      var cw = el('label', 'oe-hclosed');
      var lab = el('span', 'oe-switch');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!h.closed;
      cb.addEventListener('change', function () {
        setField(recordPath + '.' + field.key + '.' + i + '.closed', cb.checked);
        time.disabled = cb.checked;
        if (cb.checked) { time.value = 'Closed'; setField(recordPath + '.' + field.key + '.' + i + '.time', 'Closed'); }
      });
      lab.appendChild(cb); lab.appendChild(el('span', 'oe-slider'));
      cw.appendChild(el('span')).textContent = 'Closed'; cw.appendChild(lab);
      row.appendChild(day); row.appendChild(time); row.appendChild(cw);
      wrap.appendChild(row);
    });
    return wrap;
  }
  function buildWidget(recordPath, field, recordEl) {
    if (field.type === 'textarea') return textWidget(recordPath, field, true);
    if (field.type === 'stars') return starsWidget(recordPath, field, recordEl);
    if (field.type === 'toggle') return toggleWidget(recordPath, field);
    if (field.type === 'list') return listWidget(recordPath, field);
    if (field.type === 'hours') return hoursWidget(recordPath, field);
    return textWidget(recordPath, field, false);
  }

  function openPanel(recordEl) {
    var type = recordEl.getAttribute('data-cms-type');
    var recordPath = recordEl.getAttribute('data-cms-record');
    var schema = (window.CMS_SCHEMA || {})[type];
    if (!schema) { toast('No editor is defined for “' + type + '”.'); return; }
    panelTitle.textContent = 'Edit ' + (schema.label || type);
    panelBody.innerHTML = '';
    var note = el('p', 'oe-hint2'); note.textContent = 'Changes are saved to your draft and go out with the next Publish.';
    panelBody.appendChild(note);
    schema.fields.forEach(function (field) {
      var row = el('div', 'oe-field');
      var lab = el('label', 'oe-label'); lab.textContent = field.label; row.appendChild(lab);
      row.appendChild(buildWidget(recordPath, field, recordEl));
      panelBody.appendChild(row);
    });
    panel.classList.add('open'); backdrop.classList.add('show');
  }
  function closePanel() { panel.classList.remove('open'); backdrop.classList.remove('show'); }

  // Edit a larger text passage as its Markdown source. Live-renders as you type.
  function openMdPanel(elm) {
    var key = mdInfo(elm); if (key == null) return;
    var draft = loadDraft();
    var raw = draft[key] != null ? draft[key] : resolvePath(window.CMS_DATA || {}, key);
    raw = raw == null ? '' : String(raw);
    panelTitle.textContent = 'Edit text';
    panelBody.innerHTML = '';
    var note = el('p', 'oe-hint2');
    note.textContent = 'Markdown: **bold**, *italic*, ## Heading, - list, [text](link). Saved with the next Publish.';
    panelBody.appendChild(note);
    var ta = el('textarea', 'oe-input oe-md-ta'); ta.value = raw;
    ta.addEventListener('input', function () {
      setField(key, ta.value);
      elm.innerHTML = window.PSE_md ? window.PSE_md(ta.value) : ta.value;
    });
    panelBody.appendChild(ta);
    panel.classList.add('open'); backdrop.classList.add('show');
    setTimeout(function () { ta.focus(); }, 260);
  }

  /* ---------- enter / exit ---------- */
  function enter() {
    editing = true;
    try { sessionStorage.setItem(ACTIVE_KEY, '1'); } catch (e) {}
    document.body.classList.add('oe-on');
    var draft = loadDraft();
    fields().forEach(function (e) {
      var f = info(e); if (!f) return;
      orig[f.key] = readEl(e, f.multi);
      if (draft[f.key] != null) writeEl(e, draft[f.key], f.multi);
      e.classList.add('oe-inline');
      e.setAttribute('contenteditable', f.multi ? 'true' : 'plaintext-only');
      e.addEventListener('input', refresh);
      if (!f.multi) e.addEventListener('keydown', singleLineKeys);
    });
    records().forEach(function (e) { e.classList.add('oe-record'); });
    mdBlocks().forEach(function (e) { e.classList.add('oe-md-block'); });
    launch.hidden = true; bar.hidden = false;
    refresh();
  }
  function exit() {
    editing = false;
    try { sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {}
    document.body.classList.remove('oe-on');
    closePanel();
    fields().forEach(function (e) {
      e.removeAttribute('contenteditable');
      e.classList.remove('oe-inline', 'oe-changed');
      e.removeEventListener('input', refresh);
      e.removeEventListener('keydown', singleLineKeys);
    });
    records().forEach(function (e) { e.classList.remove('oe-record', 'oe-record-changed'); });
    mdBlocks().forEach(function (e) { e.classList.remove('oe-md-block', 'oe-md-changed'); });
    launch.hidden = false; bar.hidden = true;
  }
  function singleLineKeys(e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }

  /* ---------- publish ---------- */
  function publish() {
    var draft = syncDraft();
    if (!Object.keys(draft).length) { toast('No changes to publish yet.'); return; }
    var pw = sessionStorage.getItem(PW_KEY) || window.prompt('Enter the edit password to publish:');
    if (!pw) return;
    sessionStorage.setItem(PW_KEY, pw);
    pubBtn.disabled = true; var label = pubBtn.textContent; pubBtn.textContent = 'Publishing…';
    fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw, changes: draft }) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, ok: r.ok, body: j }; }, function () { return { status: r.status, ok: r.ok, body: {} }; }); })
      .then(function (res) {
        if (res.status === 401) { sessionStorage.removeItem(PW_KEY); toast('That password didn’t work — try again.'); return; }
        if (!res.ok) { toast('Couldn’t publish: ' + (res.body.error || ('error ' + res.status))); return; }
        fields().forEach(function (e) { var f = info(e); if (f && draft[f.key] != null) orig[f.key] = draft[f.key]; });
        clearDraft(); closePanel(); refresh();
        toast('Published ✓  Committed to the draft (main). It goes live on your next deploy.');
      })
      .catch(function () { toast('Network problem — your edits are kept. Try Publish again.'); })
      .then(function () { pubBtn.textContent = label; refresh(); });
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = document.querySelector('.oe-toast');
    if (!t) { t = el('div', 'oe-ui oe-toast'); document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4600);
  }

  /* ---------- wire up ---------- */
  launch.addEventListener('click', enter);
  pubBtn.addEventListener('click', publish);
  bar.querySelector('.oe-exit').addEventListener('click', function () {
    var pending = Object.keys(loadDraft()).length;
    if (pending && !window.confirm('You have ' + pending + ' unpublished change(s). Leave edit mode? (They’re kept until you publish or discard.)')) return;
    exit();
  });
  bar.querySelector('.oe-discard').addEventListener('click', function () {
    if (!window.confirm('Discard ALL unpublished changes (every page)?')) return;
    var draft = loadDraft();
    clearDraft();
    fields().forEach(function (e) { var f = info(e); if (f && orig[f.key] != null) writeEl(e, orig[f.key], f.multi); });
    closePanel(); refresh();
  });

  // One capture-phase click handler while editing: records open the panel;
  // editable links don't navigate; ordinary nav links still work (so you can
  // move between pages and keep editing).
  document.addEventListener('click', function (e) {
    if (!editing) return;
    if (e.target.closest('.oe-ui')) return;
    var rec = e.target.closest('[data-cms-record]');
    if (rec) { e.preventDefault(); e.stopPropagation(); openPanel(rec); return; }
    var mb = e.target.closest(MD_SEL);
    if (mb && !mb.closest('.oe-ui')) { e.preventDefault(); e.stopPropagation(); openMdPanel(mb); return; }
    var a = e.target.closest('a');
    if (a && (a.matches(SEL) || a.closest(SEL))) e.preventDefault();
  }, true);

  /* ---------- reveal / auto-resume ---------- */
  function editModeRequested() {
    if ((location.hash || '').toLowerCase() === '#edit') { try { sessionStorage.setItem(ENABLED_KEY, '1'); } catch (e) {} return true; }
    try { return sessionStorage.getItem(ENABLED_KEY) === '1'; } catch (e) { return false; }
  }
  function boot() {
    if (!editModeRequested()) return;
    launch.hidden = false;
    var active = false; try { active = sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) {}
    if (active) enter();
  }
  if (window.PSE_CONTENT_READY) boot();
  else document.addEventListener('pse:loaded', boot);
})();
