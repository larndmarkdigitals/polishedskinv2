/* Polished Skin — interactions */
(function () {
  // Sticky nav shadow
  var nav = document.getElementById('nav');
  function onScroll() { if (nav) nav.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  var burger = document.querySelector('.burger');
  var menu = document.querySelector('.mobile-menu');
  if (burger && menu) {
    burger.addEventListener('click', function () { menu.classList.toggle('open'); });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.remove('open'); });
    });
  }

  // Scroll reveal — exposed so dynamically rendered content can be revealed too
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null;

  window.PSEinitReveal = function () {
    var reveals = document.querySelectorAll('.reveal:not(.in)');
    if (!io) { reveals.forEach(function (el) { el.classList.add('in'); }); return; }
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 0.08 + 's';
      io.observe(el);
    });
  };

  window.PSEinitReveal();

  // Before / after comparison sliders
  function initBA(el) {
    var dragging = false;
    function setFromX(clientX) {
      var r = el.getBoundingClientRect();
      var p = ((clientX - r.left) / r.width) * 100;
      p = Math.max(0, Math.min(100, p));
      el.style.setProperty('--pos', p + '%');
    }
    el.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      setFromX(e.clientX);
    });
    el.addEventListener('pointermove', function (e) { if (dragging) setFromX(e.clientX); });
    el.addEventListener('pointerup', function () { dragging = false; });
    el.addEventListener('pointercancel', function () { dragging = false; });
    var circle = el.querySelector('.ba-circle');
    if (circle) {
      circle.addEventListener('keydown', function (e) {
        var cur = parseFloat(getComputedStyle(el).getPropertyValue('--pos')) || 50;
        if (e.key === 'ArrowLeft') { el.style.setProperty('--pos', Math.max(0, cur - 4) + '%'); e.preventDefault(); }
        if (e.key === 'ArrowRight') { el.style.setProperty('--pos', Math.min(100, cur + 4) + '%'); e.preventDefault(); }
      });
    }
  }
  Array.prototype.forEach.call(document.querySelectorAll('.ba-slider'), initBA);
})();
