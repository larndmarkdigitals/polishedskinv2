/* ============================================================
   editor.js — in-browser inline editor for Polished Skin.
   Click "Edit" (top right) → click any text to type, or click any
   photo area to upload an image → "Save changes".

   Edits are saved in THIS browser only (localStorage) as a live draft —
   they do NOT rewrite the site files or publish to other visitors. For
   permanent changes, edit the content/*.js files and add real photos to img/.

   NOTE: edits are keyed to each element's ORIGINAL text (content-addressed),
   not its position — so adding/reordering sections won't scramble saved edits.
   ============================================================ */
(function () {
  var PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var TKEY = 'pse-edit-v2:' + PAGE;   // text overrides (v2 = content-addressed)
  var IKEY = 'pse-img-v2:' + PAGE;    // image overrides

  /* ---- Web3Forms config -----------------------------------------------
     "Send to developer" emails the edits straight to the developer's inbox
     via Web3Forms (web3forms.com) — the same service the EV Works site uses.
     Paste your Web3Forms ACCESS KEY below (from your web3forms.com dashboard;
     it's the same key per inbox, so you can reuse the one from EV Works).
     Until it's filled in, the button safely falls back to downloading a
     .txt file the client can email manually.                              */
  var WEB3FORMS_KEY = '844ac78c-8186-4b9f-9d0c-9e23bff589c6';

  function emailConfigured() { return WEB3FORMS_KEY.indexOf('YOUR_') !== 0; }

  var TEXT_SEL = [
    'h1', 'h2', 'h3', 'h4', '.eyebrow', '.pill', 'blockquote', 'p', 'li',
    '.btn', '.foot-h', '.cat-sub', '.sci-step h4', '.mr-name', '.mr-desc',
    '.post-tag', '.svc-link', '.tst-by .n', '.tst-by .svc', '.by', '.foot-contact',
    '.faq-q span', '.pkg-tag', '.pkg-desc'
  ].join(',');
  var IMG_SEL = '.hero-photo, .about-img, .svc-img, .post-img, .ba-img, .bap-photo, .gal-photo';

  var editing = false;
  var origText = {};
  var pendingImg = {};
  var imgData = loadJSON(IKEY);

  // one-time cleanup of the old position-keyed data that caused jumbling
  try { localStorage.removeItem('pse-edits:' + PAGE); localStorage.removeItem('pse-imgs:' + PAGE); } catch (e) {}

  function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } }
  function textEls() {
    return Array.prototype.slice.call(document.querySelectorAll(TEXT_SEL))
      .filter(function (el) { return !el.closest('.pse-ui'); });
  }
  function imgSlots() {
    return Array.prototype.slice.call(document.querySelectorAll(IMG_SEL))
      .filter(function (el) { return !el.closest('.pse-ui'); });
  }

  // small stable hash of an element's source content
  function hash(str) { var h = 5381, i = str.length; while (i) { h = (h * 33) ^ str.charCodeAt(--i); } return (h >>> 0).toString(36); }
  function sigOf(el) { return el.tagName.toLowerCase() + ':' + hash((el.innerHTML || '').replace(/\s+/g, ' ').trim()); }

  // assign each editable element a content key (run BEFORE overrides are applied)
  function assignKeys() {
    var counts = {};
    textEls().forEach(function (el) {
      var base = sigOf(el);
      var n = counts[base] = (counts[base] || 0) + 1;
      var key = base + '#' + n;
      el.setAttribute('data-ec-key', key);
      origText[key] = el.innerHTML;
    });
  }

  function applyText() {
    assignKeys();
    var data = loadJSON(TKEY);
    textEls().forEach(function (el) {
      var k = el.getAttribute('data-ec-key');
      if (k && data[k] != null) el.innerHTML = data[k];
    });
  }
  function applyImages() {
    var slots = imgSlots();
    Object.keys(imgData).forEach(function (k) { var i = +k; if (slots[i]) setPhoto(slots[i], imgData[i]); });
  }
  function setPhoto(el, url) {
    var inner = el.querySelector('img');
    if (inner) { inner.src = url; }
    else {
      el.style.backgroundImage = 'url("' + url + '")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
    el.classList.add('pse-has-photo');
  }

  /* ---- styles ---- */
  var css = ''
    + '.pse-launch[hidden],.pse-bar[hidden]{display:none!important;}'
    + '.pse-launch{position:fixed;top:92px;right:20px;z-index:9999;display:inline-flex;align-items:center;gap:7px;'
    + 'background:#16201f;color:#fff;border:none;border-radius:100px;padding:10px 16px;font-size:13.5px;'
    + 'font-family:Jost,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 22px rgba(20,40,38,.22);transition:.18s;}'
    + '.pse-launch:hover{background:#268b82;transform:translateY(-1px);}'
    + '.pse-bar{position:fixed;top:0;left:0;right:0;z-index:10000;background:#16201f;color:#fff;'
    + 'display:flex;align-items:center;gap:14px;padding:12px 22px;box-shadow:0 6px 20px rgba(0,0,0,.18);}'
    + '.pse-bar .pse-hint{font-size:14px;color:#bfe9e4;margin-right:auto;display:flex;align-items:center;gap:8px;}'
    + '.pse-bar .pse-dot{width:8px;height:8px;border-radius:50%;background:#34b3a8;animation:psepulse 1.4s infinite;}'
    + '@keyframes psepulse{0%,100%{opacity:1}50%{opacity:.35}}'
    + '.pse-b{border:none;border-radius:8px;padding:10px 18px;font-size:13.5px;font-family:Jost,system-ui,sans-serif;cursor:pointer;transition:.15s;}'
    + '.pse-save{background:#34b3a8;color:#fff;}.pse-save:hover{background:#2aa093;}'
    + '.pse-ghost{background:transparent;color:#cdddda;border:1px solid rgba(255,255,255,.25);}'
    + '.pse-ghost:hover{background:rgba(255,255,255,.08);}'
    + 'body.pse-editing .pse-editable{outline:1.5px dashed rgba(52,179,168,.55);outline-offset:3px;border-radius:3px;transition:outline-color .15s,background .15s;}'
    + 'body.pse-editing .pse-editable:hover{outline-color:#34b3a8;background:rgba(52,179,168,.07);}'
    + 'body.pse-editing .pse-editable:focus{outline:2px solid #34b3a8;background:rgba(52,179,168,.10);}'
    + '.pse-photo-slot{position:relative;cursor:pointer;}'
    + '.pse-photo-cta{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;'
    + 'background:rgba(22,32,31,.48);color:#fff;font-family:Jost,system-ui,sans-serif;font-size:14px;opacity:0;transition:.18s;z-index:6;border-radius:inherit;}'
    + '.pse-photo-slot:hover .pse-photo-cta{opacity:1;}'
    + '.pse-photo-cta svg{width:24px;height:24px;}'
    + '.pse-has-photo>svg,.pse-has-photo .ph-label,.pse-has-photo .ba-ph{display:none!important;}'
    + '.pse-has-photo{background-image:none;}'
    + '.pse-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);z-index:10001;'
    + 'background:#16201f;color:#fff;padding:12px 22px;border-radius:100px;font-size:14px;font-family:Jost,system-ui,sans-serif;'
    + 'opacity:0;transition:.3s;box-shadow:0 10px 30px rgba(0,0,0,.25);}'
    + '.pse-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}'
    + '@media(max-width:760px){.pse-launch{top:auto;bottom:18px;right:18px;}.pse-bar{flex-wrap:wrap;gap:8px;}.pse-bar .pse-hint{width:100%;margin:0;}}';
  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  /* ---- UI ---- */
  var launch = document.createElement('button');
  launch.className = 'pse-launch';
  launch.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg> Edit';
  document.body.appendChild(launch);

  var bar = document.createElement('div');
  bar.className = 'pse-ui pse-bar'; bar.hidden = true;
  bar.innerHTML =
      '<span class="pse-hint"><span class="pse-dot"></span>Click any text to edit it, or any photo to upload, then Save.</span>'
    + '<button class="pse-b pse-save">Save changes</button>'
    + '<button class="pse-b pse-ghost pse-cancel">Cancel</button>'
    + '<button class="pse-b pse-ghost pse-revert">Revert to original</button>'
    + '<button class="pse-b pse-ghost pse-export">Send changes to developer</button>';
  document.body.appendChild(bar);

  var saveBtn = bar.querySelector('.pse-save');
  var cancelBtn = bar.querySelector('.pse-cancel');
  var revertBtn = bar.querySelector('.pse-revert');
  var exportBtn = bar.querySelector('.pse-export');
  var PHOTO_CTA = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><path d="M3 8a2 2 0 012-2h2l1.5-2h7L18 6h1a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="3.2"/></svg><span>Click to upload photo</span>';

  function enter() {
    editing = true; pendingImg = {};
    document.body.classList.add('pse-editing');
    textEls().forEach(function (el) { el.setAttribute('contenteditable', 'true'); el.spellcheck = true; el.classList.add('pse-editable'); });
    imgSlots().forEach(function (el, i) {
      el.classList.add('pse-photo-slot');
      var cta = document.createElement('div'); cta.className = 'pse-photo-cta'; cta.innerHTML = PHOTO_CTA;
      cta.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); pickPhoto(i, el); });
      el.appendChild(cta);
    });
    launch.hidden = true; bar.hidden = false;
  }
  function exit() {
    editing = false;
    document.body.classList.remove('pse-editing');
    textEls().forEach(function (el) { el.removeAttribute('contenteditable'); el.classList.remove('pse-editable'); });
    imgSlots().forEach(function (el) { el.classList.remove('pse-photo-slot'); var c = el.querySelector('.pse-photo-cta'); if (c) c.remove(); });
    launch.hidden = false; bar.hidden = true;
  }

  function pickPhoto(i, el) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      resizeImage(f, 1200, 0.78, function (url) { pendingImg[i] = url; setPhoto(el, url); });
    });
    inp.click();
  }
  function resizeImage(file, max, quality, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(c.toDataURL('image/jpeg', quality)); } catch (e) { cb(reader.result); }
      };
      img.onerror = function () { alert('Sorry, that image could not be loaded.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function doSave() {
    // Merge over what's already stored — never replace the whole object.
    // If a page's HTML changed in a later deploy, its content-hash keys won't
    // match, but we must keep any previously-saved edits rather than drop them.
    var t = loadJSON(TKEY);
    textEls().forEach(function (el) { var k = el.getAttribute('data-ec-key'); if (k) t[k] = el.innerHTML; });
    Object.keys(pendingImg).forEach(function (k) { imgData[k] = pendingImg[k]; });
    try {
      localStorage.setItem(TKEY, JSON.stringify(t));
      localStorage.setItem(IKEY, JSON.stringify(imgData));
      exit(); toast('Changes saved ✓');
    } catch (e) { toast('Photos too large to save in-browser — use smaller images, or add them to the img folder.'); }
  }

  // Drop this browser's saved drafts for the current page so it renders
  // straight from the published site files again (the "original"). Handy for
  // checking how the live copy actually looks once edits have been applied to
  // the real files. Only clears THIS page's local edits — never the files.
  function doRevert() {
    if (!confirm('Revert ' + PAGE + ' to the original published copy?\n\n'
      + 'This clears the text and photo edits saved in THIS browser for this page '
      + 'and reloads. It does not change the website files, and cannot be undone.')) return;
    try {
      localStorage.removeItem(TKEY);
      localStorage.removeItem(IKEY);
    } catch (e) {}
    location.reload();
  }

  // Collect every uploaded photo from this browser: [{page, slot, url}, ...]
  function gatherImages() {
    var out = [];
    for (var j = 0; j < localStorage.length; j++) {
      var ik = localStorage.key(j);
      if (ik.indexOf('pse-img-v2:') !== 0) continue;
      var page = ik.slice('pse-img-v2:'.length);
      var data; try { data = JSON.parse(localStorage.getItem(ik) || '{}'); } catch (e) { continue; }
      Object.keys(data).forEach(function (slot) { out.push({ page: page, slot: slot, url: data[slot] }); });
    }
    return out;
  }

  // includeImageData: when true, embeds the full photo data URLs in the report
  // (so they arrive by email). When false, just notes that photos exist.
  function buildReport(includeImageData) {
    var lines = ['Polished Skin - content edits', 'Generated ' + new Date().toLocaleString(), '',
      'HOW TO USE: in the website files, find each OLD line and replace it with the NEW line.', ''];
    var prefix = 'pse-edit-v2:';
    var any = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(prefix) !== 0) continue;
      var page = k.slice(prefix.length);
      var data; try { data = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { continue; }
      var ckeys = Object.keys(data);
      if (!ckeys.length) continue;
      any = true;
      lines.push('===== PAGE: ' + page + ' =====', '');
      ckeys.forEach(function (ck, idx) {
        var oldT = (page === PAGE && origText[ck] != null) ? origText[ck] : '(open this page to see the original)';
        lines.push((idx + 1) + '.', 'OLD: ' + oldT, 'NEW: ' + data[ck], '');
      });
    }
    if (!any) lines.push('(No saved text edits found in this browser yet.)');

    var imgs = gatherImages();
    if (imgs.length) {
      lines.push('', '===== PHOTOS (' + imgs.length + ') =====', '');
      if (includeImageData) {
        imgs.forEach(function (im, idx) {
          lines.push('PHOTO ' + (idx + 1) + ' — page: ' + im.page + ', slot: ' + im.slot,
            'Paste this whole data: line into a browser address bar to view/save the image:',
            'data: ' + im.url, '');
        });
      } else {
        lines.push('(' + imgs.length + ' photo(s) were uploaded but are too large to email automatically —'
          + ' please ask the client to send the image files separately.)');
      }
    }
    return lines.join('\n');
  }
  function download(name, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }
  // Web3Forms rejects very large JSON bodies, so cap how much photo data we
  // try to email. Below this, photos ride along in the message; above it we
  // send text-only (reliable) and note the photos must come separately.
  var MAX_EMAIL_BYTES = 700000;

  function doExport() {
    // Capture any in-progress typing on THIS page, but MERGE it over what's
    // already stored so previously-saved edits are never overwritten/reset.
    if (editing) {
      var t = loadJSON(TKEY);
      textEls().forEach(function (el) { var k = el.getAttribute('data-ec-key'); if (k) t[k] = el.innerHTML; });
      try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {}
    }

    var report = buildReport(true);
    if (report.length > MAX_EMAIL_BYTES) report = buildReport(false); // photos too big — keep email reliable

    // Not configured yet → fall back to downloading a file the client can
    // email by hand, so the edits are never lost.
    if (!emailConfigured()) {
      download('polished-skin-edits.txt', report);
      toast('Saved a file to your Downloads — email it to your developer');
      return;
    }

    var label = exportBtn.textContent;
    exportBtn.disabled = true; exportBtn.textContent = 'Sending…';
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: 'Polished Skin — content edits (' + PAGE + ')',
        from_name: 'Polished Skin editor',
        page: PAGE,
        date: new Date().toLocaleString(),
        message: report
      })
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (!data || !data.success) throw new Error('send failed');
      toast('Sent to your developer ✓');
    }).catch(function () {
      // network / credential problem → never lose the edits: download instead
      download('polished-skin-edits.txt', report);
      toast('Could not send — saved a file to Downloads instead. Email it to your developer.');
    }).then(function () {
      exportBtn.disabled = false; exportBtn.textContent = label;
    });
  }

  function toast(msg) {
    var el = document.createElement('div'); el.className = 'pse-toast'; el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 350); }, 2400);
  }

  launch.addEventListener('click', enter);
  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', function () { location.reload(); });
  revertBtn.addEventListener('click', doRevert);
  exportBtn.addEventListener('click', doExport);
  document.addEventListener('click', function (e) {
    if (!editing) return;
    var a = e.target.closest('a');
    if (a && !a.closest('.pse-ui')) e.preventDefault();
  }, true);

  // Content now renders asynchronously (content.js fetches JSON), so wait for
  // it before applying saved drafts — otherwise dynamically rendered elements
  // (service cards, reviews, treatment article…) wouldn't get edit keys.
  function initOverrides() { applyText(); applyImages(); }
  if (window.PSE_CONTENT_READY) initOverrides();
  else document.addEventListener('pse:loaded', initOverrides);
})();
