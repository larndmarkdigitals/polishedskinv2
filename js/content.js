/* ============================================================
   content.js — fetches the JSON content files and renders them into pages.
   You normally don't need to touch this file.
   Edit the content/*.json files (or the /admin editor, once set up) instead.

   IMPORTANT: content now loads via fetch(), so the site must be viewed over
   HTTP — a static host (Netlify), or locally `python3 -m http.server` inside
   this folder. Opening the .html files directly with file:// will block the
   fetches and the page will look empty.
   ============================================================ */
(function () {
  var SPARK = '<svg viewBox="0 0 24 24" fill="#34b3a8"><path d="M12 0c.9 6.2 4.9 10.2 11.1 11.1C16.9 12 12.9 16 12 22.2 11.1 16 7.1 12 .9 11.1 7.1 10.2 11.1 6.2 12 0Z"/></svg>';
  var MARK = '<svg class="mark" viewBox="0 0 24 24" fill="#34b3a8" opacity=".85"><path d="M12 0c.9 6.2 4.9 10.2 11.1 11.1C16.9 12 12.9 16 12 22.2 11.1 16 7.1 12 .9 11.1 7.1 10.2 11.1 6.2 12 0Z"/></svg>';
  var GBADGE = '<div class="gbadge"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 01-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9z"/><path fill="#34A853" d="M12 23c2.9 0 5.3-1 7.1-2.6l-3.6-2.7c-1 .7-2.3 1.1-3.5 1.1-2.7 0-5-1.8-5.8-4.3H2.4v2.8A11 11 0 0012 23z"/><path fill="#FBBC05" d="M6.2 14.5a6.6 6.6 0 010-4.2V7.5H2.4a11 11 0 000 9.8z"/><path fill="#EA4335" d="M12 5.5c1.5 0 2.9.5 4 1.5l3-3A11 11 0 002.4 7.5l3.8 2.8C7 7.3 9.3 5.5 12 5.5z"/></svg>Verified Google Review</div>';
  var STARS = '<div class="stars">★★★★★</div>';
  var BOOK = "https://polishedskineugene.glossgenius.com/services";

  // populated from the JSON files before render() runs
  var S = [], SC = [], R = [], P = [], T = [], PK = [], FAQ = [], GBA = [], GAL = [], HOME = {}, SITE = {}, ABOUT = {};

  // Markdown -> HTML (from js/md.js); falls back to raw text if not loaded.
  function md(s) { return window.PSE_md ? window.PSE_md(s) : (s || ''); }

  function svcImg(s, cls) {
    return s && s.img
      ? '<div class="' + cls + '"><img loading="lazy" decoding="async" src="' + s.img + '" alt="' + s.name + '"></div>'
      : '<div class="' + cls + ' img-ph">' + SPARK + '</div>';
  }

  function svcCard(s) {
    // No price on the home page — pricing lives on the Services page only.
    var link = s.link || 'services.html';
    var label = s.link ? 'Learn more →' : 'View details →';
    var lead = s.tagline ? '<strong>' + s.tagline + '</strong><br>' : '';
    return '<div class="svc-card reveal">' + svcImg(s, 'svc-img') +
      '<div class="svc-body"><h3>' + s.name + '</h3><p>' + lead + (s.blurb || '') + '</p>' +
      '<div class="svc-meta"><a href="' + link + '" class="svc-link">' + label + '</a></div></div></div>';
  }

  function menuRow(s) {
    var dur = s.duration ? '<div class="mr-dur">' + s.duration + '</div>' : '';
    var learn = s.link ? '<a class="mr-learn" href="' + s.link + '">Learn more →</a>' : '';
    return '<div class="menu-row"><div><div class="mr-name">' + s.name + '</div>' +
      '<div class="mr-desc">' + (s.desc || s.blurb || '') + '</div>' + dur + learn +
      '</div><div class="mr-price">' + (s.price || 'Inquire') + '</div></div>';
  }

  function revCard(r) {
    var initial = (r.name || '?').trim().charAt(0).toUpperCase();
    return '<div class="tst-card reveal">' + STARS +
      '<p>"' + r.text + '"</p>' +
      '<div class="tst-by"><div class="tst-av">' + initial + '</div>' +
      '<div><div class="n">' + r.name + '</div><div class="svc">' + (r.service || '') + '</div></div></div></div>';
  }

  function postCard(p) {
    var img = p.img
      ? '<div class="post-img"><img loading="lazy" decoding="async" src="' + p.img + '" alt=""></div>'
      : '<div class="post-img img-ph">' + SPARK + '</div>';
    var meta = (p.date ? p.date + ' · ' : '') + (p.readTime || '');
    return '<a class="post-card reveal" href="post.html?slug=' + encodeURIComponent(p.slug) + '">' +
      img + '<div class="post-body"><div class="post-tag">' + p.tag + '</div>' +
      '<h3>' + p.title + '</h3><p>' + p.excerpt + '</p>' +
      '<div class="post-meta">' + meta + '</div></div></a>';
  }

  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }

  /* ---- data-attribute bindings (home page + shared footer/business) ---- */
  function resolvePath(obj, path) {
    return path.split('.').reduce(function (o, k) { return (o == null) ? undefined : o[k]; }, obj);
  }
  function eachAttr(attr, cb) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), cb);
  }
  function bind(root, attr, apply) {
    eachAttr(attr, function (el) {
      var v = resolvePath(root, el.getAttribute(attr));
      if (v != null) apply(el, v);
    });
  }

  // Drop an uploaded photo into a placeholder box (replaces the .img-ph art).
  function setImg(el, v) {
    if (!v) return;
    el.innerHTML = '<img loading="lazy" decoding="async" src="' + v + '" alt="' + (el.getAttribute('data-alt') || '') + '">';
    el.classList.remove('img-ph');
  }
  // Set a photo as a CSS background (used by the before/after slider panes).
  function setBg(el, v) {
    if (!v) return;
    el.style.backgroundImage = 'url("' + v + '")';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    var ph = el.querySelector('.ba-ph'); if (ph) ph.style.display = 'none';
  }

  function applyHome(H) {
    if (!H) return;
    bind(H, 'data-h', function (el, v) { el.textContent = v; });
    bind(H, 'data-h-para', function (el, v) { el.innerHTML = String(v).replace(/\n/g, '<br>'); });
    bind(H, 'data-h-md', function (el, v) {
      var html = md(v);
      if (el.hasAttribute('data-lead')) html = html.replace(/^<p>/, '<p class="lead">');
      el.innerHTML = html;
    });
    bind(H, 'data-h-img', setImg);
    bind(H, 'data-h-bg', setBg);
  }

  function applyAbout(A) {
    if (!A) return;
    bind(A, 'data-a', function (el, v) { el.textContent = v; });
    bind(A, 'data-a-img', setImg);
  }

  function applySite(SITE) {
    if (!SITE) return;
    var b = SITE.business || {}, f = SITE.footer || {};
    bind(SITE, 'data-s', function (el, v) { el.textContent = v; });
    var tel = function () {
      return '<a href="tel:' + (b.phoneDigits || '') + '">' + (b.phone || '') + '</a>';
    };
    eachAttr('data-s-footvisit', function (el) {
      el.innerHTML = (b.addressLine || '') + '<br>' + (b.cityStateZip || '') + '<br>' + tel() + '<br><br>' +
        (b.hoursNote || '') + '<br>' + (b.closedNote || '') + '<br><br>' +
        '<a href="' + BOOK + '" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600;">' + (f.bookLink || 'Book online →') + '</a>';
    });
    eachAttr('data-s-visitcontact', function (el) {
      el.innerHTML = '<strong>' + (b.name || '') + '</strong><br>' + (b.addressLine || '') + '<br>' + (b.cityStateZip || '') + '<br>' + tel();
    });
    eachAttr('data-s-hours', function (el) {
      el.innerHTML = (b.hours || []).map(function (h) {
        return '<div class="hours-row' + (h.closed ? ' closed' : '') + '"><span class="day">' + h.day + '</span><span class="time">' + h.time + '</span></div>';
      }).join('');
    });
  }

  function render() {
    /* ---- HOME page copy + shared footer/business info ---- */
    applyHome(HOME);
    applySite(SITE);
    applyAbout(ABOUT);

    /* ---- HOME: featured services (up to 4) ---- */
    var featSvc = S.filter(function (s) { return s.featured; });
    if (!featSvc.length) featSvc = S;
    set('home-services', featSvc.slice(0, 4).map(svcCard).join(''));

    /* ---- HOME: featured review (big quote) ---- */
    var fr = R.filter(function (r) { return r.featured; })[0] || R[0];
    if (fr) {
      set('featured-review-home', MARK + '<blockquote>"' + fr.text + '"</blockquote>' +
        STARS + '<div class="by">' + fr.name + ' <span>· ' + fr.service + '</span></div>' + GBADGE);
      set('featured-review', MARK + '<blockquote>"' + fr.text + '"</blockquote>' +
        STARS + '<div class="by">' + fr.name + ' <span>· ' + fr.service + '</span></div>');
    }

    /* ---- HOME: review grid (3) ---- */
    set('home-reviews', R.slice(0, 3).map(revCard).join(''));

    /* ---- SERVICES: full grouped menu ---- */
    if (document.getElementById('menu-list')) {
      var cats = SC.length ? SC : (function () {
        var seen = [], out = [];
        S.forEach(function (s) { if (seen.indexOf(s.category) < 0) { seen.push(s.category); out.push({ name: s.category, sub: '' }); } });
        return out;
      })();
      var html = cats.map(function (c) {
        var rows = S.filter(function (s) { return s.category === c.name; }).map(menuRow).join('');
        if (!rows) return '';
        return '<div class="menu-cat reveal"><h3>' + c.name + '</h3>' +
          (c.sub ? '<p class="cat-sub">' + c.sub + '</p>' : '') + rows + '</div>';
      }).join('');
      set('menu-list', html);
    }

    /* ---- TESTIMONIALS: all reviews ---- */
    set('all-reviews', R.map(revCard).join(''));

    /* ---- GALLERY: before/after pairs + photo grid ---- */
    function photoSlot(cls, src, tag) {
      var inner = src ? '<img loading="lazy" decoding="async" src="' + src + '" alt="' + (tag || '') + '">' : SPARK;
      var t = tag ? '<span class="bap-tag">' + tag + '</span>' : '';
      return '<div class="' + cls + (src ? '' : ' img-ph') + '">' + inner + t + '</div>';
    }
    function baPair(p) {
      return '<div class="ba-pair reveal"><div class="bap-row">' +
        photoSlot('bap-photo', p.before, 'Before') +
        photoSlot('bap-photo', p.after, 'After') +
        '</div><div class="bap-cap">' + (p.treatment || '') + '</div></div>';
    }
    function galItem(g) {
      var inner = g.img ? '<img loading="lazy" decoding="async" src="' + g.img + '" alt="' + (g.treatment || '') + '">' : SPARK;
      return '<div class="gal-item reveal"><div class="gal-photo' + (g.img ? '' : ' img-ph') + '">' + inner +
        '</div><div class="gal-cap">' + (g.treatment || '') + '</div></div>';
    }
    set('ba-gallery', GBA.map(baPair).join(''));
    set('photo-gallery', GAL.map(galItem).join(''));

    /* ---- BLOG: list ---- */
    set('blog-list', P.map(postCard).join(''));

    /* ---- POST: single article ---- */
    var article = document.getElementById('post-article');
    if (article) {
      var slug = (new URLSearchParams(location.search)).get('slug');
      var post = P.filter(function (p) { return p.slug === slug; })[0] || P[0];
      if (post) {
        document.title = post.title + ' — Polished Skin Eugene';
        set('post-tag', post.tag);
        set('post-title', post.title);
        set('post-meta', (post.date ? post.date + ' · ' : '') + (post.readTime || ''));
        var hero = document.getElementById('post-hero-img');
        if (hero) {
          hero.innerHTML = post.img ? '<img loading="lazy" decoding="async" src="' + post.img + '" alt="">' : SPARK;
          if (!post.img) hero.classList.add('img-ph');
        }
        // keep the larger "lead" styling on the first paragraph
        article.innerHTML = md(post.body).replace(/^<p>/, '<p class="post-lead">');
      }
    }

    /* ---- PACKAGES (Treatment Plans) ---- */
    if (document.getElementById('packages-list')) {
      set('packages-list', PK.map(pkgCard).join(''));
    }
    function pkgCard(p) {
      var ribbon = p.popular ? '<span class="pkg-ribbon">Most Popular</span>' : '';
      var inc = (p.includes || []).map(function (i) { return '<li>' + i + '</li>'; }).join('');
      return '<div class="pkg-card reveal' + (p.popular ? ' pkg-pop' : '') + '">' + ribbon +
        '<h3>' + p.name + '</h3><p class="pkg-tag">' + p.tagline + '</p>' +
        '<p class="pkg-desc">' + p.desc + '</p>' +
        '<div class="pkg-for"><span>Best for:</span> ' + p.forWho + '</div>' +
        '<ul class="pkg-inc">' + inc + '</ul>' +
        '<div class="pkg-foot"><span class="pkg-note">' + (p.note || '') + '</span>' +
        '<a class="btn btn-primary" href="' + BOOK + '" target="_blank" rel="noopener">Book</a></div></div>';
    }

    /* ---- FAQ (accordion) ---- */
    if (document.getElementById('faq-list')) {
      set('faq-list', FAQ.map(function (f) {
        return '<div class="faq-item"><button class="faq-q" aria-expanded="false">' +
          '<span>' + f.q + '</span><span class="faq-ic"></span></button>' +
          '<div class="faq-a"><div class="faq-a-in">' + md(f.a) + '</div></div></div>';
      }).join(''));
      Array.prototype.forEach.call(document.querySelectorAll('.faq-q'), function (btn) {
        btn.addEventListener('click', function () {
          var item = btn.parentElement;
          var open = item.classList.toggle('open');
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      });
    }

    /* ---- TREATMENT: single detail page ---- */
    function factItem(label, val) {
      return val ? '<div class="t-fact"><span class="t-fact-l">' + label + '</span><span class="t-fact-v">' + val + '</span></div>' : '';
    }
    var tEl = document.getElementById('treatment-article');
    if (tEl) {
      var tslug = (new URLSearchParams(location.search)).get('slug');
      var t = T.filter(function (x) { return x.slug === tslug; })[0] || T[0];
      if (t) {
        document.title = t.name + ' — Polished Skin Eugene';
        set('t-crumb', t.name);
        set('t-name', t.name);
        set('t-tagline', t.tagline);
        var bookText = 'Book Your ' + t.name + ' Treatment';
        Array.prototype.forEach.call(document.querySelectorAll('.t-book-btn'), function (b) { b.textContent = bookText; });
        if (t.facts) set('t-facts', factItem('Time', t.facts.duration) + factItem('Downtime', t.facts.downtime) + factItem('Plan', t.facts.series) + factItem('Best for', t.facts.bestFor) + factItem('Suitable for', t.facts.suitableFor));
        var th = document.getElementById('t-hero-img');
        if (th) { th.innerHTML = t.img ? '<img loading="lazy" decoding="async" src="' + t.img + '" alt="' + t.name + '">' : SPARK; if (!t.img) th.classList.add('img-ph'); }
        var body = String(t.lead || '').split(/\n{2,}/).filter(Boolean)
          .map(function (p) { return '<p class="post-lead">' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
        (t.sections || []).forEach(function (s) { body += '<h2>' + s.h + '</h2>' + md(s.body); });
        if (t.benefits && t.benefits.length) {
          body += '<h2>' + (t.benefitsTitle || 'Benefits') + '</h2><ul class="t-benefits">' + t.benefits.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>';
        }
        (t.closingSections || []).forEach(function (s) { body += '<h2>' + s.h + '</h2>' + md(s.body); });
        tEl.innerHTML = body;
      }
    }
  }

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function ready() {
    window.PSE_CONTENT_READY = true;
    document.dispatchEvent(new CustomEvent('pse:loaded'));
    // re-run reveal animations on freshly rendered elements
    if (window.PSEinitReveal) window.PSEinitReveal();
  }

  Promise.all([
    getJSON('content/services.json').catch(function () { return {}; }),
    getJSON('content/reviews.json').catch(function () { return {}; }),
    getJSON('content/posts.json').catch(function () { return {}; }),
    getJSON('content/treatments.json').catch(function () { return {}; }),
    getJSON('content/packages.json').catch(function () { return {}; }),
    getJSON('content/faq.json').catch(function () { return {}; }),
    getJSON('content/gallery.json').catch(function () { return {}; }),
    getJSON('content/home.json').catch(function () { return {}; }),
    getJSON('content/site.json').catch(function () { return {}; }),
    getJSON('content/about.json').catch(function () { return {}; })
  ]).then(function (res) {
    var sv = res[0] || {}; SC = sv.categories || []; S = sv.services || [];
    R = (res[1] || {}).reviews || [];
    P = (res[2] || {}).posts || [];
    T = (res[3] || {}).treatments || [];
    PK = (res[4] || {}).packages || [];
    FAQ = (res[5] || {}).faq || [];
    var g = res[6] || {}; GBA = g.beforeAfter || []; GAL = g.gallery || [];
    HOME = res[7] || {};
    SITE = res[8] || {};
    ABOUT = res[9] || {};
    try { render(); } catch (e) { if (window.console) console.error('content render failed', e); }
    ready();
  });
})();
