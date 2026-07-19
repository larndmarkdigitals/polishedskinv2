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
  // Image slots — click to upload a new photo (resized in-browser, committed to
  // img/ on publish). data-cms-img=path, or the home/about image bindings.
  // Image slots: an <img> box (data-*-img) OR a CSS-background box (data-*-bg,
  // e.g. the before/after slider panes). Both are editable the same way.
  var IMG_SEL = '[data-cms-img],[data-h-img],[data-a-img],[data-cms-bg],[data-h-bg],[data-a-bg]';
  function imgInfo(e) {
    if (e.hasAttribute('data-cms-img')) return e.getAttribute('data-cms-img');
    if (e.hasAttribute('data-h-img'))   return 'home.'  + e.getAttribute('data-h-img');
    if (e.hasAttribute('data-a-img'))   return 'about.' + e.getAttribute('data-a-img');
    if (e.hasAttribute('data-cms-bg'))  return e.getAttribute('data-cms-bg');
    if (e.hasAttribute('data-h-bg'))    return 'home.'  + e.getAttribute('data-h-bg');
    if (e.hasAttribute('data-a-bg'))    return 'about.' + e.getAttribute('data-a-bg');
    return null;
  }
  // A slot that shows its photo as a CSS background rather than an <img>.
  function isBgSlot(e) {
    return e.hasAttribute('data-cms-bg') || e.hasAttribute('data-h-bg') || e.hasAttribute('data-a-bg')
      || /background-image/.test(e.getAttribute('style') || '');
  }
  function imgSlots() {
    return Array.prototype.slice.call(document.querySelectorAll(IMG_SEL))
      .filter(function (e) { return !e.closest('.oe-ui'); });
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
      img.onerror = function () { toast('Sorry, that image couldn’t be loaded.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function setImgPreview(elm, url) {
    if (isBgSlot(elm)) {
      elm.style.backgroundImage = 'url("' + url + '")';
      elm.style.backgroundSize = 'cover';
      elm.style.backgroundPosition = 'center';
    } else {
      var inner = elm.querySelector('img');
      if (inner) inner.src = url;
      else elm.insertAdjacentHTML('afterbegin', '<img loading="lazy" decoding="async" src="' + url + '" alt="">');
    }
    elm.classList.remove('img-ph');
    elm.classList.add('oe-has-photo');   // CSS hides the sparkle placeholder / label so only the photo shows
  }
  function newImgName() { return 'img/oe-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg'; }
  // Stage a resized dataURL for a field: write path + base64 into the draft,
  // preview it (given element + any matching on-page slot), refresh. Reused by
  // click, drag-drop, paste, the media grid, and Dropbox.
  function stageImage(fieldKey, dataUrl, previewEl) {
    if (!fieldKey) return false;
    var b64 = (String(dataUrl).split(',')[1]) || '';
    var fname = newImgName();
    var prev = getFieldSmart(fieldKey);
    var d = loadDraft();
    if (prev && d['__img:' + prev] != null) delete d['__img:' + prev];
    d['__img:' + fname] = b64;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }
    catch (e) { toast('That image is too large to stage — try a smaller photo, or Publish first.'); return false; }
    setFieldSmart(fieldKey, fname);   // path -> whole-array for collections, else per-field
    if (previewEl) setImgPreview(previewEl, dataUrl);
    imgSlots().forEach(function (s) { if (imgInfo(s) === fieldKey) setImgPreview(s, dataUrl); });
    refresh();
    return fname;
  }
  function stageFile(fieldKey, file, previewEl, done) {
    if (!file || !/^image\//.test(file.type || '')) { toast('That doesn’t look like an image file.'); return; }
    resizeImage(file, 1500, 0.82, function (dataUrl) { var n = stageImage(fieldKey, dataUrl, previewEl); if (done) done(n, dataUrl); });
  }
  function pickPhotoFor(fieldKey, previewEl, done) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', function () { var f = inp.files && inp.files[0]; if (f) stageFile(fieldKey, f, previewEl, done); });
    inp.click();
  }
  function pickPhoto(elm) { var key = imgInfo(elm); if (key != null) pickPhotoFor(key, elm, function () { toast('Photo staged — hit Publish to save it.'); }); }

  var draggingTray = null;   // a media-tray thumbnail being dragged onto a tile
  // Drag-and-drop onto an image slot or media tile. getKey() returns the field.
  function attachDrop(el, getKey, previewEl) {
    el.addEventListener('dragover', function (ev) { ev.preventDefault(); ev.stopPropagation(); el.classList.add('oe-drop'); });
    el.addEventListener('dragleave', function (ev) { ev.stopPropagation(); el.classList.remove('oe-drop'); });
    el.addEventListener('drop', function (ev) {
      ev.preventDefault(); ev.stopPropagation(); el.classList.remove('oe-drop');
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) { stageFile(getKey(), f, previewEl || el, function () { toast('Photo staged — hit Publish.'); }); }
      else if (draggingTray) { stageImage(getKey(), draggingTray.url, previewEl || el); trayRemove(draggingTray); draggingTray = null; toast('Assigned — hit Publish.'); }
    });
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
  // A record path ending in a number is a COLLECTION item (reviews.reviews.3);
  // those are edited as the whole array so add/delete/reorder stay consistent.
  function collParts(recordPath) {
    var parts = recordPath.split('.');
    if (!/^\d+$/.test(parts[parts.length - 1])) return null;
    return { collPath: parts.slice(0, -1).join('.'), idx: +parts[parts.length - 1] };
  }
  function materialize(collPath) {
    var d = loadDraft();
    if (Array.isArray(d[collPath])) return d[collPath];
    var committed = resolvePath(window.CMS_DATA || {}, collPath) || [];
    return JSON.parse(JSON.stringify(committed));   // deep clone, don't touch committed data
  }
  function saveColl(collPath, arr) { var d = loadDraft(); d[collPath] = arr; saveDraft(d); refresh(); }

  function fieldValue(recordPath, field) {
    var draft = loadDraft();
    var cp = collParts(recordPath);
    if (cp) {
      var arr = Array.isArray(draft[cp.collPath]) ? draft[cp.collPath] : (resolvePath(window.CMS_DATA || {}, cp.collPath) || []);
      var rec0 = arr[cp.idx] || {};
      var cv = rec0[field.key];
      return cv == null ? field.default : cv;
    }
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

  // Managed collections are edited as WHOLE arrays so add/delete/reorder stay
  // consistent. A key like reviews.reviews.3.text or posts.posts.3.body is routed
  // into the array; anything else (home.hero.title, business.hours…) is a plain
  // per-field draft entry.
  // Collections edited as whole arrays (add/delete/reorder). Per-site: set
  // window.CMS_COLLECTIONS in cms-schema.js. Falls back to a sensible default.
  var MANAGED_COLLS = (window.CMS_COLLECTIONS && window.CMS_COLLECTIONS.length) ? window.CMS_COLLECTIONS
    : ['reviews.reviews', 'services.services', 'packages.packages', 'posts.posts', 'gallery.gallery', 'gallery.beforeAfter'];
  function splitColl(key) {
    var parts = key.split('.');
    for (var i = parts.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(parts[i])) {
        var collPath = parts.slice(0, i).join('.');
        return MANAGED_COLLS.indexOf(collPath) >= 0 ? { collPath: collPath, idx: +parts[i], sub: parts.slice(i + 1) } : null;
      }
    }
    return null;
  }
  function setFieldSmart(key, value) {
    var sc = splitColl(key);
    if (!sc || !sc.sub.length) { setField(key, value); return; }
    var arr = materialize(sc.collPath), o = arr[sc.idx]; if (!o) return;
    for (var i = 0; i < sc.sub.length - 1; i++) { if (o[sc.sub[i]] == null) o[sc.sub[i]] = {}; o = o[sc.sub[i]]; }
    o[sc.sub[sc.sub.length - 1]] = value; saveColl(sc.collPath, arr);
  }
  function getFieldSmart(key) {
    var sc = splitColl(key), d = loadDraft();
    if (sc) {
      var arr = Array.isArray(d[sc.collPath]) ? d[sc.collPath] : (resolvePath(window.CMS_DATA || {}, sc.collPath) || []);
      var o = arr[sc.idx]; for (var i = 0; i < sc.sub.length && o != null; i++) o = o[sc.sub[i]];
      return o;
    }
    return d[key] != null ? d[key] : resolvePath(window.CMS_DATA || {}, key);
  }
  function setRecordField(recordPath, key, value) { setFieldSmart(recordPath + '.' + key, value); }
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
    '.oe-rec-ctrls{position:absolute;top:6px;right:6px;z-index:7;display:flex;gap:4px;opacity:0;transition:.15s;}',
    'body.oe-on .oe-record:hover .oe-rec-ctrls{opacity:1;}',
    '.oe-rc{width:26px;height:26px;border:none;border-radius:6px;background:#16201f;color:#fff;cursor:pointer;font:13px/1 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);}',
    '.oe-rc:hover{background:#268b82;}.oe-rc-del:hover{background:#c0563f;}',
    '.oe-add-rec{grid-column:1/-1;display:inline-flex;align-items:center;justify-content:center;margin:14px auto;padding:11px 22px;border:1.5px dashed #34b3a8;background:rgba(52,179,168,.08);color:#16201f;border-radius:10px;font:600 14px Jost,system-ui,sans-serif;cursor:pointer;}',
    '.oe-add-rec:hover{background:rgba(52,179,168,.16);}',
    'body.oe-on .oe-md-block{outline:1.5px dashed rgba(52,179,168,.55);outline-offset:4px;border-radius:6px;cursor:pointer;transition:.15s;}',
    'body.oe-on .oe-md-block:hover{outline:2px solid #34b3a8;background:rgba(52,179,168,.06);}',
    'body.oe-on .oe-md-changed{outline-color:#3a7d4a!important;}',
    'body.oe-on .faq-a{max-height:none!important;overflow:visible!important;}',  /* reveal FAQ answers to edit them */
    'body.oe-on .oe-img{position:relative;cursor:pointer;}',
    '.oe-img-cta{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(22,32,31,.42);color:#fff;font:600 13px Jost,system-ui,sans-serif;opacity:0;transition:.15s;z-index:5;border-radius:inherit;pointer-events:none;}',
    'body.oe-on .oe-img:hover .oe-img-cta{opacity:1;}',
    'body.oe-on .oe-img-changed .oe-img-cta{opacity:1;background:rgba(58,125,74,.5);}',
    '.oe-drop{outline:3px dashed #34b3a8!important;outline-offset:2px;}',
    '.oe-has-photo > svg, .oe-has-photo > .ph-label, .oe-has-photo > .ba-ph{display:none!important;}',
    '.oe-media{position:fixed;inset:0;z-index:10003;background:#f6efe6;display:none;flex-direction:column;font:14px Inter,system-ui,sans-serif;color:#2c2019;}',
    '.oe-media.show{display:flex;}',
    '.oe-media-head{display:flex;align-items:center;gap:14px;padding:16px 22px;background:#16201f;color:#fff;}',
    '.oe-media-head h3{margin:0;font:600 18px Jost,serif;}',
    '.oe-media-sub{color:#bfe9e4;font-size:13px;margin-right:auto;}',
    '.oe-media .oe-close{background:rgba(255,255,255,.14);color:#fff;}',
    '.oe-media-body{padding:20px 22px;overflow-y:auto;flex:1;}',
    '.oe-bulk{border:2px dashed #cbb89f;border-radius:12px;padding:16px;text-align:center;color:#6f5b48;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;}',
    '.oe-tray{display:flex;flex-wrap:wrap;gap:10px;}',
    '.oe-tray-h{width:100%;font-size:12.5px;color:#8a7862;margin-bottom:2px;}',
    '.oe-tray-item{position:relative;width:92px;height:92px;border-radius:8px;overflow:hidden;cursor:grab;box-shadow:0 3px 10px rgba(0,0,0,.15);}',
    '.oe-tray-item img{width:100%;height:100%;object-fit:cover;}',
    '.oe-tray-g{position:absolute;left:0;right:0;bottom:0;border:none;background:rgba(22,32,31,.72);color:#fff;font:600 11px Jost,system-ui,sans-serif;padding:3px;cursor:pointer;}',
    '.oe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-top:14px;}',
    '.oe-tile{background:#fff;border:1px solid #e7dccd;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(58,35,23,.06);}',
    '.oe-tile-img{aspect-ratio:4/3;background:#efe4d4;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;}',
    '.oe-tile-img img{width:100%;height:100%;object-fit:cover;}',
    '.oe-tile-img.img-ph::after{content:"No photo yet";color:#b0a08c;font-size:12.5px;}',
    '.oe-tile-label{padding:9px 12px 4px;font:600 12.5px Jost,system-ui,sans-serif;color:#4a3a2c;}',
    '.oe-tile-acts{padding:0 12px 11px;display:flex;gap:6px;}',
    '.oe-tb{border:1px solid #ddd0be;background:#faf6f0;color:#6f5b48;border-radius:7px;padding:5px 10px;font:600 12px Jost,system-ui,sans-serif;cursor:pointer;}',
    '.oe-tb:hover{background:#f2ece3;}',
    '.oe-crop-btn{position:absolute;top:6px;left:6px;z-index:6;border:none;width:30px;height:30px;border-radius:8px;background:rgba(22,32,31,.72);cursor:pointer;font-size:15px;line-height:1;opacity:0;transition:.15s;}',
    'body.oe-on .oe-img:hover .oe-crop-btn{opacity:1;}',
    '.oe-crop-btn:hover{background:#268b82;}',
    '.oe-crop{position:fixed;inset:0;z-index:10004;background:rgba(20,32,31,.72);display:none;align-items:center;justify-content:center;}',
    '.oe-crop.show{display:flex;}',
    '.oe-crop-box{background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4);max-width:94vw;}',
    '.oe-crop-title{font:600 14px Jost,system-ui,sans-serif;color:#2c2019;margin-bottom:12px;}',
    '.oe-crop-title span{font-weight:400;color:#9a8873;font-size:12.5px;}',
    '.oe-crop-frame{position:relative;overflow:hidden;background:#efe4d4;border-radius:8px;cursor:grab;touch-action:none;}',
    '.oe-crop-img{position:absolute;top:0;left:0;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none;}',
    '.oe-crop-zoom{display:block;width:100%;margin:14px 0;accent-color:#34b3a8;}',
    '.oe-crop-acts{display:flex;gap:10px;justify-content:flex-end;}',
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
    '<span class="hint"><span class="dot"></span>Click text to type, a card to open its editor, or a photo to change it. Move between pages freely.</span>' +
    '<button class="oe-b oe-ghost oe-photos">🖼 Photos</button>' +
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
    imgSlots().forEach(function (e) { var k = imgInfo(e); e.classList.toggle('oe-img-changed', !!(k && draft[k] != null)); });
    var n = Object.keys(draft).filter(function (k) { return k.indexOf('__img:') !== 0; }).length;   // image data keys aren't counted
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
      setRecordField(recordPath, field.key, input.value);
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
        paint(k); setRecordField(recordPath, field.key, k);
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
    input.addEventListener('change', function () { setRecordField(recordPath, field.key, input.checked); });
    lab.appendChild(input); lab.appendChild(el('span', 'oe-slider'));
    return lab;
  }
  function listWidget(recordPath, field) {
    var wrap = el('div', 'oe-listw');
    var items = (fieldValue(recordPath, field) || []).slice();
    function commit() { setRecordField(recordPath, field.key, items.slice()); }
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
    var raw = getFieldSmart(key); raw = raw == null ? '' : String(raw);
    panelTitle.textContent = 'Edit text';
    panelBody.innerHTML = '';
    var note = el('p', 'oe-hint2');
    note.textContent = 'Markdown: **bold**, *italic*, ## Heading, - list, [text](link). Saved with the next Publish.';
    panelBody.appendChild(note);
    var ta = el('textarea', 'oe-input oe-md-ta'); ta.value = raw;
    ta.addEventListener('input', function () {
      setFieldSmart(key, ta.value);
      elm.innerHTML = window.PSE_md ? window.PSE_md(ta.value) : ta.value;
    });
    panelBody.appendChild(ta);
    panel.classList.add('open'); backdrop.classList.add('show');
    setTimeout(function () { ta.focus(); }, 260);
  }

  /* ---------- collections: add / delete / reorder ---------- */
  // A blank record built from the schema defaults, so a new item is editable.
  function blankItem(type) {
    var schema = (window.CMS_SCHEMA || {})[type] || { fields: [] };
    var item = {};
    schema.fields.forEach(function (f) {
      item[f.key] = f.default != null ? f.default
        : f.type === 'stars' ? 5 : f.type === 'toggle' ? false : f.type === 'list' ? [] : '';
    });
    if ('name' in item) item.name = 'New ' + String(schema.label || type).toLowerCase();
    if (type === 'review' && 'text' in item) item.text = 'Write the review here.';
    if (type === 'service') {
      var cats = (window.CMS_DATA && window.CMS_DATA.services && window.CMS_DATA.services.categories) || [];
      item.category = (cats[0] && cats[0].name) || '';
    }
    if (type === 'post') {
      item.title = 'New blog post';
      item.slug = 'post-' + Date.now().toString(36);   // unique URL slug
      if ('tag' in item) item.tag = item.tag || 'Skincare';
      if ('excerpt' in item) item.excerpt = item.excerpt || 'A short summary shown on the blog list.';
      if ('body' in item) item.body = item.body || 'Write your post here. **Markdown** is supported.';
      if ('readTime' in item) item.readTime = item.readTime || '3 min read';
      if ('date' in item) { try { item.date = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }); } catch (e) { item.date = ''; } }
    }
    if (type === 'galleryPhoto') item.img = item.img || '';
    if (type === 'beforeAfter') { item.before = item.before || ''; item.after = item.after || ''; }
    return item;
  }
  // Structural changes reload the page (content.js re-renders from the staged
  // draft), which keeps DOM indices and the array perfectly in sync.
  function reloadResuming() {
    try { sessionStorage.setItem(ACTIVE_KEY, '1'); sessionStorage.setItem(ENABLED_KEY, '1'); } catch (e) {}
    location.reload();
  }
  function collectionOp(collPath, idx, op) {
    var arr = materialize(collPath);
    if (op === 'del') { if (!window.confirm('Delete this item? It’s removed when you Publish.')) return; arr.splice(idx, 1); }
    else if (op === 'up') { if (idx <= 0) return; var a = arr[idx - 1]; arr[idx - 1] = arr[idx]; arr[idx] = a; }
    else if (op === 'down') { if (idx >= arr.length - 1) return; var b = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = b; }
    else return;
    saveColl(collPath, arr); reloadResuming();
  }
  function collectionAdd(collPath, type) {
    var arr = materialize(collPath); arr.push(blankItem(type)); saveColl(collPath, arr); reloadResuming();
  }
  function stampCollections() {
    var groups = {};
    records().forEach(function (node) {
      var cp = collParts(node.getAttribute('data-cms-record') || ''); if (!cp) return;
      var type = node.getAttribute('data-cms-type');
      (groups[cp.collPath] = groups[cp.collPath] || { type: type, nodes: [] }).nodes.push(node);
      if (!node.querySelector(':scope > .oe-rec-ctrls')) {
        var barc = el('div', 'oe-rec-ctrls oe-ui');
        barc.innerHTML = '<button class="oe-rc" data-op="up" title="Move up">↑</button>'
          + '<button class="oe-rc" data-op="down" title="Move down">↓</button>'
          + '<button class="oe-rc oe-rc-del" data-op="del" title="Delete">✕</button>';
        barc.addEventListener('click', function (ev) {
          var b = ev.target.closest('button'); if (!b) return;
          ev.preventDefault(); ev.stopPropagation();
          collectionOp(cp.collPath, cp.idx, b.getAttribute('data-op'));
        });
        node.appendChild(barc);
      }
    });
    Object.keys(groups).forEach(function (collPath) {
      var g = groups[collPath], last = g.nodes[g.nodes.length - 1], parent = last.parentNode;
      if (parent && !parent.querySelector(':scope > .oe-add-rec[data-coll="' + collPath + '"]')) {
        var add = el('button', 'oe-add-rec oe-ui'); add.setAttribute('data-coll', collPath);
        add.textContent = '＋ Add ' + String((window.CMS_SCHEMA[g.type] || {}).label || g.type);
        add.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); collectionAdd(collPath, g.type); });
        parent.insertBefore(add, last.nextSibling);
      }
    });
  }
  function unstampCollections() {
    Array.prototype.forEach.call(document.querySelectorAll('.oe-rec-ctrls, .oe-add-rec'), function (n) { n.remove(); });
  }

  /* ---------- enter / exit ---------- */
  // Record the committed (published) value of each inline field. Runs at boot,
  // BEFORE any draft is painted on, so it's a true baseline for change detection.
  function captureBaseline() {
    fields().forEach(function (e) { var f = info(e); if (f) orig[f.key] = readEl(e, f.multi); });
  }
  // Paint staged (unpublished) edits onto the page even when NOT in edit mode, so
  // a draft survives Done + refresh + navigation. (Collections are handled by
  // content.js's overlay; this covers inline text, markdown blocks and photos.)
  function applyDraftPreview() {
    var draft = loadDraft();
    fields().forEach(function (e) { var f = info(e); if (f && draft[f.key] != null) writeEl(e, draft[f.key], f.multi); });
    mdBlocks().forEach(function (e) { var k = mdInfo(e); if (k && draft[k] != null) e.innerHTML = window.PSE_md ? window.PSE_md(draft[k]) : draft[k]; });
    imgSlots().forEach(function (e) { var k = imgInfo(e), p = k && getFieldSmart(k); if (p && draft['__img:' + p] != null) setImgPreview(e, 'data:image/jpeg;base64,' + draft['__img:' + p]); });
  }

  function enter() {
    editing = true;
    try { sessionStorage.setItem(ACTIVE_KEY, '1'); } catch (e) {}
    document.body.classList.add('oe-on');
    fields().forEach(function (e) {
      var f = info(e); if (!f) return;
      e.classList.add('oe-inline');
      e.setAttribute('contenteditable', f.multi ? 'true' : 'plaintext-only');
      e.addEventListener('input', refresh);
      if (!f.multi) e.addEventListener('keydown', singleLineKeys);
    });
    records().forEach(function (e) { e.classList.add('oe-record'); });
    mdBlocks().forEach(function (e) { e.classList.add('oe-md-block'); });
    imgSlots().forEach(function (e) {
      e.classList.add('oe-img');
      if (!e.querySelector('.oe-img-cta')) { var cta = el('div', 'oe-img-cta'); cta.textContent = '📷 Click or drop a photo'; e.appendChild(cta); }
      if (!e.querySelector('.oe-crop-btn')) {
        var cb = el('button', 'oe-ui oe-crop-btn'); cb.type = 'button'; cb.textContent = '✂️'; cb.title = 'Adjust crop';
        (function (slot) { cb.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); openCrop(imgInfo(slot), slot.offsetWidth / slot.offsetHeight, slot); }); })(e);
        e.appendChild(cb);
      }
      if (!e._oeDrop) { e._oeDrop = true; attachDrop(e, (function (slot) { return function () { return imgInfo(slot); }; })(e), e); }
    });
    stampCollections();
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
    imgSlots().forEach(function (e) { e.classList.remove('oe-img', 'oe-img-changed'); var c = e.querySelector('.oe-img-cta'); if (c) c.remove(); var cb = e.querySelector('.oe-crop-btn'); if (cb) cb.remove(); });
    unstampCollections();
    launch.hidden = false; bar.hidden = true;
  }
  function singleLineKeys(e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }

  /* ---------- publish ---------- */
  function publish() {
    var draft = syncDraft();
    var changes = {}, images = [];
    Object.keys(draft).forEach(function (k) {
      if (k.indexOf('__img:') === 0) images.push({ path: k.slice(6), content: draft[k] });
      else changes[k] = draft[k];
    });
    if (!Object.keys(changes).length && !images.length) { toast('No changes to publish yet.'); return; }
    var pw = sessionStorage.getItem(PW_KEY) || window.prompt('Enter the edit password to publish:');
    if (!pw) return;
    sessionStorage.setItem(PW_KEY, pw);
    pubBtn.disabled = true; var label = pubBtn.textContent; pubBtn.textContent = 'Publishing…';
    fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw, changes: changes, images: images }) })
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

  /* ---------- media library (Photos grid + bulk tray + Dropbox) ---------- */
  var MEDIA = window.CMS_MEDIA || { fields: [] };
  var tray = [];   // in-memory bulk uploads not yet assigned to a spot

  var mediaOverlay = el('div', 'oe-ui oe-media');
  mediaOverlay.innerHTML = '<div class="oe-media-head"><h3>Photos</h3><span class="oe-media-sub">Click, drag a file, or pick from Dropbox onto any spot. Everything saves with Publish.</span><button class="oe-close" title="Close">✕</button></div><div class="oe-media-body"></div>';
  document.body.appendChild(mediaOverlay);
  var mediaBody = mediaOverlay.querySelector('.oe-media-body');
  mediaOverlay.querySelector('.oe-close').addEventListener('click', closeMedia);

  function draftArr(collPath, data) { var d = loadDraft(); return Array.isArray(d[collPath]) ? d[collPath] : (resolvePath(data, collPath) || []); }
  function curImg(fieldKey) { return getFieldSmart(fieldKey); }
  function tileSrc(url) { var d = loadDraft(); return (url && d['__img:' + url]) ? 'data:image/jpeg;base64,' + d['__img:' + url] : (url || ''); }

  function mediaTiles() {
    var out = [], data = window.CMS_DATA || {};
    (MEDIA.fields || []).forEach(function (f) {
      if (f.key) { out.push({ key: f.key, label: f.label, url: curImg(f.key, data) }); return; }
      if (f.collection) {
        draftArr(f.collection, data).forEach(function (item, i) {
          var k = f.collection + '.' + i + '.' + (f.imgKey || 'img');
          var label = String(f.label || '').replace('{name}', item.name || '').replace('{title}', item.title || '').replace('{n}', i + 1);
          out.push({ key: k, label: label, url: curImg(k, data) });
        });
      } else if (f.pairCollection) {
        draftArr(f.pairCollection, data).forEach(function (item, i) {
          (f.keys || []).forEach(function (kk) {
            var k = f.pairCollection + '.' + i + '.' + kk;
            out.push({ key: k, label: String(f.label || '').replace('{n}', i + 1) + ' — ' + kk, url: curImg(k, data) });
          });
        });
      }
    });
    return out;
  }

  function addGalleryPhoto(dataUrl) {
    var fname = newImgName();
    var d = loadDraft(); d['__img:' + fname] = (String(dataUrl).split(',')[1]) || ''; saveDraft(d);
    var arr = materialize('gallery.gallery'); arr.push({ img: fname, treatment: '' }); saveColl('gallery.gallery', arr);
    toast('Added a gallery photo — hit Publish.');
  }

  /* ---- bulk tray ---- */
  function trayAddFile(file) { if (/^image\//.test(file.type || '')) resizeImage(file, 1500, 0.82, function (u) { tray.push({ url: u }); renderTray(); }); }
  function trayAddBlob(blob) { resizeImage(blob, 1500, 0.82, function (u) { tray.push({ url: u }); renderTray(); }); }
  function trayRemove(item) { var i = tray.indexOf(item); if (i >= 0) { tray.splice(i, 1); renderTray(); } }
  function renderTray() {
    var t = mediaBody.querySelector('.oe-tray'); if (!t) return;
    t.innerHTML = tray.length ? '<div class="oe-tray-h">Drag each onto a spot below, or “＋ Gallery” to add it to the gallery:</div>' : '';
    tray.forEach(function (item) {
      var th = el('div', 'oe-tray-item'); th.draggable = true;
      th.innerHTML = '<img src="' + item.url + '">';
      var g = el('button', 'oe-tray-g'); g.type = 'button'; g.textContent = '＋ Gallery';
      g.addEventListener('click', function () { addGalleryPhoto(item.url); trayRemove(item); });
      th.appendChild(g);
      th.addEventListener('dragstart', function () { draggingTray = item; });
      th.addEventListener('dragend', function () { setTimeout(function () { draggingTray = null; }, 60); });
      t.appendChild(th);
    });
  }

  /* ---- Dropbox chooser ---- */
  function loadDropbox(cb) {
    if (window.Dropbox && window.Dropbox.choose) return cb();
    if (!MEDIA.dropboxAppKey) { toast('Dropbox isn’t set up yet — add your app key in cms-schema.js.'); return; }
    var s = document.getElementById('dropboxjs');
    if (s) { s.addEventListener('load', cb); return; }
    s = document.createElement('script'); s.id = 'dropboxjs'; s.src = 'https://www.dropbox.com/static/api/2/dropins.js';
    s.setAttribute('data-app-key', MEDIA.dropboxAppKey);
    s.onload = cb; s.onerror = function () { toast('Couldn’t load Dropbox.'); };
    document.head.appendChild(s);
  }
  function chooseFromDropbox(fieldKey, previewEl, bulk) {
    loadDropbox(function () {
      window.Dropbox.choose({
        linkType: 'direct', multiselect: !!bulk, extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
        success: function (files) {
          files.forEach(function (fobj) {
            fetch(fobj.link).then(function (r) { return r.blob(); }).then(function (blob) {
              if (bulk) trayAddBlob(blob);
              else stageFile(fieldKey, blob, previewEl, function () { toast('From Dropbox — hit Publish.'); });
            }).catch(function () { toast('Couldn’t fetch that Dropbox file.'); });
          });
        }
      });
    });
  }

  /* ---- open / build the grid ---- */
  function openMedia() {
    mediaBody.innerHTML = '';
    var zone = el('div', 'oe-bulk');
    zone.innerHTML = '<span>⬆︎ Drop photos here to upload several at once</span>'
      + (MEDIA.dropboxAppKey ? ' <button class="oe-b oe-ghost oe-dbx-bulk" type="button">Choose from Dropbox</button>' : '');
    zone.addEventListener('dragover', function (ev) { ev.preventDefault(); zone.classList.add('oe-drop'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('oe-drop'); });
    zone.addEventListener('drop', function (ev) { ev.preventDefault(); zone.classList.remove('oe-drop'); var fs = ev.dataTransfer && ev.dataTransfer.files; if (fs) Array.prototype.forEach.call(fs, trayAddFile); });
    mediaBody.appendChild(zone);
    if (MEDIA.dropboxAppKey) zone.querySelector('.oe-dbx-bulk').addEventListener('click', function () { chooseFromDropbox(null, null, true); });

    var trayEl = el('div', 'oe-tray'); mediaBody.appendChild(trayEl); renderTray();

    var grid = el('div', 'oe-grid');
    mediaTiles().forEach(function (t) {
      var tile = el('div', 'oe-tile');
      var src = tileSrc(t.url);
      var ph = el('div', 'oe-tile-img' + (src ? '' : ' img-ph'));
      if (src) ph.innerHTML = '<img src="' + src + '" alt="">';
      var key = t.key;
      attachDrop(ph, function () { return key; }, ph);
      ph.addEventListener('click', function () { pickPhotoFor(key, ph); });
      var lab = el('div', 'oe-tile-label'); lab.textContent = t.label;
      var acts = el('div', 'oe-tile-acts');
      if (MEDIA.dropboxAppKey) { var bDbx = el('button', 'oe-tb'); bDbx.type = 'button'; bDbx.textContent = 'Dropbox'; bDbx.addEventListener('click', function () { chooseFromDropbox(key, ph); }); acts.appendChild(bDbx); }
      var bCrop = el('button', 'oe-tb'); bCrop.type = 'button'; bCrop.textContent = '✂️ Crop'; (function (kk, pp) { bCrop.addEventListener('click', function () { openCrop(kk, aspectFor(kk), pp); }); })(key, ph); acts.appendChild(bCrop);
      tile.appendChild(ph); tile.appendChild(lab); tile.appendChild(acts);
      grid.appendChild(tile);
    });
    mediaBody.appendChild(grid);
    mediaOverlay.classList.add('show');
  }
  function closeMedia() { mediaOverlay.classList.remove('show'); }

  /* ---------- crop tool (pan + zoom -> canvas crop to the frame) ---------- */
  function imgSrcFor(fieldKey) {
    var p = getFieldSmart(fieldKey); if (!p) return null;
    var d = loadDraft();
    return d['__img:' + p] ? 'data:image/jpeg;base64,' + d['__img:' + p] : p;
  }
  function aspectFor(fieldKey) {
    var a = null;
    (MEDIA.fields || []).forEach(function (f) {
      if (f.key === fieldKey) a = f.aspect;
      else if (f.collection && fieldKey.indexOf(f.collection + '.') === 0) a = f.aspect;
      else if (f.pairCollection && fieldKey.indexOf(f.pairCollection + '.') === 0) a = f.aspect;
    });
    return a || 1.5;
  }

  var cropOverlay = el('div', 'oe-ui oe-crop');
  cropOverlay.innerHTML =
    '<div class="oe-crop-box">' +
      '<div class="oe-crop-title">Adjust crop <span>— drag the photo to move, slider to zoom</span></div>' +
      '<div class="oe-crop-frame"><img class="oe-crop-img" alt=""></div>' +
      '<input type="range" class="oe-crop-zoom" min="1" max="3.5" step="0.01" value="1">' +
      '<div class="oe-crop-acts"><button class="oe-b oe-ghost oe-crop-cancel" type="button">Cancel</button><button class="oe-b oe-pub oe-crop-save" type="button">Use this crop</button></div>' +
    '</div>';
  document.body.appendChild(cropOverlay);
  var cropFrame = cropOverlay.querySelector('.oe-crop-frame');
  var cropImgEl = cropOverlay.querySelector('.oe-crop-img');
  var cropZoom = cropOverlay.querySelector('.oe-crop-zoom');
  var cropState = null, cropDrag = null;

  function applyCrop() {
    var s = cropState; if (!s) return;
    s.tx = Math.min(0, Math.max(s.fw - s.iw * s.scale, s.tx));
    s.ty = Math.min(0, Math.max(s.fh - s.ih * s.scale, s.ty));
    cropImgEl.style.width = (s.iw * s.scale) + 'px';
    cropImgEl.style.height = (s.ih * s.scale) + 'px';
    cropImgEl.style.transform = 'translate(' + s.tx + 'px,' + s.ty + 'px)';
  }
  function openCrop(fieldKey, aspect, previewEl) {
    var src = imgSrcFor(fieldKey);
    if (!src) { toast('Add a photo here first, then adjust its crop.'); return; }
    aspect = aspect || aspectFor(fieldKey);
    var img = new Image();
    img.onload = function () {
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var maxW = Math.min(560, window.innerWidth - 60), maxH = window.innerHeight - 230;
      var fw = maxW, fh = fw / aspect; if (fh > maxH) { fh = maxH; fw = fh * aspect; }
      var minScale = Math.max(fw / iw, fh / ih);
      cropFrame.style.width = fw + 'px'; cropFrame.style.height = fh + 'px';
      cropImgEl.src = src; cropZoom.value = 1;
      cropState = { fieldKey: fieldKey, previewEl: previewEl, img: img, iw: iw, ih: ih, fw: fw, fh: fh, minScale: minScale, scale: minScale, tx: (fw - iw * minScale) / 2, ty: (fh - ih * minScale) / 2 };
      applyCrop(); cropOverlay.classList.add('show');
    };
    img.onerror = function () { toast('Couldn’t load that image to crop.'); };
    img.src = src;
  }
  function closeCrop() { cropOverlay.classList.remove('show'); cropState = null; cropDrag = null; }

  cropZoom.addEventListener('input', function () {
    var s = cropState; if (!s) return;
    var cx = s.fw / 2, cy = s.fh / 2, old = s.scale;
    s.scale = s.minScale * parseFloat(cropZoom.value);
    s.tx = cx - (cx - s.tx) * (s.scale / old); s.ty = cy - (cy - s.ty) * (s.scale / old);
    applyCrop();
  });
  cropFrame.addEventListener('mousedown', function (e) { if (!cropState) return; cropDrag = { x: e.clientX, y: e.clientY, tx: cropState.tx, ty: cropState.ty }; e.preventDefault(); });
  document.addEventListener('mousemove', function (e) { if (!cropDrag || !cropState) return; cropState.tx = cropDrag.tx + (e.clientX - cropDrag.x); cropState.ty = cropDrag.ty + (e.clientY - cropDrag.y); applyCrop(); });
  document.addEventListener('mouseup', function () { cropDrag = null; });
  cropFrame.addEventListener('touchstart', function (e) { if (!cropState || !e.touches[0]) return; cropDrag = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: cropState.tx, ty: cropState.ty }; });
  cropFrame.addEventListener('touchmove', function (e) { if (!cropDrag || !cropState || !e.touches[0]) return; e.preventDefault(); cropState.tx = cropDrag.tx + (e.touches[0].clientX - cropDrag.x); cropState.ty = cropDrag.ty + (e.touches[0].clientY - cropDrag.y); applyCrop(); }, { passive: false });
  document.addEventListener('touchend', function () { cropDrag = null; });
  cropOverlay.querySelector('.oe-crop-cancel').addEventListener('click', closeCrop);
  cropOverlay.querySelector('.oe-crop-save').addEventListener('click', function () {
    var s = cropState; if (!s) return;
    var TW = 1200, TH = Math.round(TW * s.fh / s.fw);
    var sx = -s.tx / s.scale, sy = -s.ty / s.scale, sw = s.fw / s.scale, sh = s.fh / s.scale;
    var c = document.createElement('canvas'); c.width = TW; c.height = TH;
    try {
      c.getContext('2d').drawImage(s.img, sx, sy, sw, sh, 0, 0, TW, TH);
      stageImage(s.fieldKey, c.toDataURL('image/jpeg', 0.85), s.previewEl);
      closeCrop(); toast('Cropped — hit Publish to save it.');
    } catch (e) { toast('Couldn’t process that image.'); }
  });

  /* ---------- wire up ---------- */
  launch.addEventListener('click', enter);
  pubBtn.addEventListener('click', publish);
  bar.querySelector('.oe-photos').addEventListener('click', openMedia);

  // Paste an image (Cmd+V) onto the last photo spot you hovered.
  var lastImgSlot = null;
  document.addEventListener('mouseover', function (e) {
    if (!editing) return;
    var s = e.target.closest && e.target.closest(IMG_SEL);
    if (s && !s.closest('.oe-ui')) lastImgSlot = s;
  });
  document.addEventListener('paste', function (e) {
    if (!editing) return;
    var items = e.clipboardData && e.clipboardData.items; if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f && lastImgSlot) { e.preventDefault(); stageFile(imgInfo(lastImgSlot), f, lastImgSlot, function () { toast('Pasted photo staged — hit Publish.'); }); }
        return;
      }
    }
  });
  bar.querySelector('.oe-exit').addEventListener('click', function () {
    var pending = Object.keys(loadDraft()).length;
    if (pending && !window.confirm('You have ' + pending + ' unpublished change(s). Leave edit mode? (They’re kept until you publish or discard.)')) return;
    exit();
  });
  bar.querySelector('.oe-discard').addEventListener('click', function () {
    if (!window.confirm('Discard ALL unpublished changes (every page)?')) return;
    clearDraft();
    location.reload();
  });

  // One capture-phase click handler while editing: records open the panel;
  // editable links don't navigate; ordinary nav links still work (so you can
  // move between pages and keep editing).
  document.addEventListener('click', function (e) {
    if (!editing) return;
    if (e.target.closest('.oe-ui')) return;
    var imgEl = e.target.closest(IMG_SEL);          // image click = upload (takes precedence over records)
    if (imgEl) { e.preventDefault(); e.stopPropagation(); pickPhoto(imgEl); return; }
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
    captureBaseline();     // baseline from the committed render
    applyDraftPreview();   // then show any unpublished draft (survives Done + refresh)
    launch.hidden = false;
    var active = false; try { active = sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) {}
    if (active) enter();
  }
  if (window.PSE_CONTENT_READY) boot();
  else document.addEventListener('pse:loaded', boot);
})();
