/* The landing page's cinematic layer: preloader, smooth scrolling, the hero
   pull back, tickers, the manifesto fill, tilting cards, the pinned
   capability chapter, the sector rail, the delivery rule, magnetic buttons,
   a cursor and the footer wordmark.

   What it writes is a class or a custom property on a <section> (or on
   <html>), plus short lived inline values on cards it re queries every frame.
   The admin panel repaints the nodes inside sections, so nothing is kept that
   points at an original node for long. Every pin is CSS sticky, switched on
   by a class; nothing here wraps an element in a spacer.

   It stands down for a reader who asked for less motion, and if a library
   failed to load the page simply stays as the stylesheet leaves it. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function done() { root.classList.remove('pl', 'pl-out'); }
  if (reduce || !window.gsap || !window.ScrollTrigger) { done(); return; }

  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  root.classList.add('lx');
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- smooth scrolling ---------- */
  var lenis = null, capGo = null;
  if (window.Lenis) {
    try {
      lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, anchors: { offset: 0 } });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } catch (e) { lenis = null; }
  }
  var menu = $('#mmenu');
  if (menu && lenis) {
    new MutationObserver(function () {
      if (menu.getAttribute('data-open') === 'true') lenis.stop(); else lenis.start();
    }).observe(menu, { attributes: true, attributeFilter: ['data-open'] });
  }
  /* the quick links under the hero pick a capability, then ask for a native
     smooth scroll that the smooth scroller would cut short. The page's own
     handler has already run (it was bound first); this takes over the travel. */
  if (lenis) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-go]');
      if (!a || !e.defaultPrevented) return;
      var svc = $('#services');
      if (!svc) return;
      var t = $('.tab[data-cap="' + a.getAttribute('data-go') + '"]');
      setTimeout(function () {
        if (capGo && t) capGo(t); else lenis.scrollTo(svc, { offset: 0, force: true });
      }, 0);
    });
  }

  /* ---------- preloader ---------- */
  function heroIn() { root.classList.add('hero-in'); }
  if (root.classList.contains('pl')) {
    if (lenis) lenis.stop();
    var n = $('.pl-n'), bar = $('.plr'), shown = 0, target = 0, ready = false;
    var t0 = performance.now();
    var loaded = function () { ready = true; };
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(function (r) { if (document.readyState === 'complete') r(); else window.addEventListener('load', r); })
    ]).then(loaded);
    setTimeout(loaded, 3200);
    (function step() {
      var el = performance.now() - t0;
      target = ready ? 100 : Math.min(88, el / 20);
      shown += (target - shown) * 0.12;
      if (target === 100 && shown > 99.4) shown = 100;
      if (n) n.textContent = String(Math.round(shown)).padStart(3, '0');
      if (bar) bar.style.setProperty('--pl', (shown / 100).toFixed(3));
      if (shown < 100 || el < 1300) { requestAnimationFrame(step); return; }
      try { sessionStorage.setItem('hs-pl', '1'); } catch (e) {}
      root.classList.add('pl-out');
      setTimeout(heroIn, 350);
      setTimeout(function () { done(); if (lenis) lenis.start(); ST.refresh(); }, 1400);
    })();
  } else {
    requestAnimationFrame(function () { requestAnimationFrame(heroIn); });
  }

  /* ---------- header: glass once scrolled, away on the way down ---------- */
  var head = $('.head');
  if (head) {
    ST.create({
      start: 0, end: 'max',
      onUpdate: function (s) {
        var y = s.scroll();
        head.classList.toggle('is-hidden', s.direction === 1 && y > 240);
      }
    });
  }

  /* ---------- reading progress ---------- */
  var prog = document.createElement('div');
  prog.className = 'lx-progress';
  prog.setAttribute('aria-hidden', 'true');
  document.body.appendChild(prog);
  ST.create({ start: 0, end: 'max', onUpdate: function (s) { prog.style.setProperty('--progress', s.progress.toFixed(4)); } });

  /* ---------- hero pull back ---------- */
  var hero = $('.hero');
  if (hero) {
    ST.create({
      trigger: hero, start: 'top top', end: 'bottom top',
      onUpdate: function (s) { hero.style.setProperty('--hp', s.progress.toFixed(4)); }
    });
  }

  /* ---------- tickers, driven by scroll velocity ---------- */
  function fillCapTicker() {
    var t = $('.ticker-cap .ticker-track');
    var names = $$('#services .tab').map(function (b) { return b.textContent.trim(); }).filter(Boolean);
    if (!t || !names.length) return;
    t.innerHTML = '';
    names.forEach(function (x) {
      var s = document.createElement('span'); s.textContent = x; t.appendChild(s);
      t.appendChild(document.createElement('i'));
    });
  }
  fillCapTicker();
  var tabsBox = $('#services .tablist');
  if (tabsBox) new MutationObserver(function () { fillCapTicker(); setupTickers(); }).observe(tabsBox, { childList: true });

  var tickers = [];
  function setupTickers() {
    tickers.forEach(function (k) { k.tw.kill(); });
    tickers = [];
    $$('.ticker').forEach(function (tk, i) {
      var track = $('.ticker-track', tk);
      if (!track) return;
      /* one copy of the set, doubled until it covers two screens */
      if (!track.dataset.base) track.dataset.base = track.innerHTML;
      track.innerHTML = track.dataset.base;
      var guard = 0;
      while (track.scrollWidth < window.innerWidth * 1.1 && guard++ < 8) track.innerHTML += track.dataset.base;
      track.innerHTML += track.innerHTML;
      var odd = i % 2 === 1;
      var tw = gsap.fromTo(track, { xPercent: odd ? -50 : 0 }, { xPercent: odd ? 0 : -50, ease: 'none', duration: 38 + i * 6, repeat: -1 });
      tickers.push({ tw: tw, dir: 1 });
    });
  }
  setupTickers();
  ST.create({
    start: 0, end: 'max',
    onUpdate: function (s) {
      var v = s.getVelocity(), boost = 1 + Math.min(Math.abs(v) / 450, 6);
      tickers.forEach(function (k) {
        gsap.to(k.tw, { timeScale: boost * (v < 0 ? -1 : 1) * k.dir, duration: .2, overwrite: true });
        gsap.to(k.tw, { timeScale: (v < 0 ? -1 : 1) * k.dir, duration: 1.2, delay: .25 });
      });
    }
  });

  /* ---------- chapter tabs ---------- */
  $$('main > section.sect').forEach(function (sec) {
    ST.create({ trigger: sec, start: 'top 82%', once: true, onEnter: function () { sec.classList.add('is-on'); } });
  });

  /* ---------- manifesto fill ---------- */
  var about = $('#about'), pri = $('#about .priority');
  if (about && pri) {
    ST.create({
      trigger: pri, start: 'top 85%', end: 'bottom 45%',
      onUpdate: function (s) { about.style.setProperty('--mp', s.progress.toFixed(4)); }
    });
  }

  /* ---------- tilting mandate cards ---------- */
  var grid = $('#about .cond-grid');
  if (grid && fine) {
    grid.addEventListener('pointermove', function (e) {
      var c = e.target.closest('.cond');
      if (!c || !c.classList.contains('in')) return;
      var r = c.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.classList.add('tilt');
      c.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      c.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    });
    grid.addEventListener('pointerout', function (e) {
      var c = e.target.closest('.cond');
      if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--ry', '0deg'); c.style.setProperty('--rx', '0deg'); }
    });
  }

  /* ---------- the capability chapter ----------
     On a wide screen the section grows one step per practice area and the
     tabs stick; scrolling selects the area. Selection goes through a click on
     the tab, so the page's own tab logic stays the only thing that decides
     what a selected tab means. Clicking a tab scrolls to its step. */
  var svc = $('#services');
  var mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (min-height: 700px)', function () {
    if (!svc || !$('#services .tabs')) return;
    var tabs = function () { return $$('#services .tab'); };
    root.classList.add('pin-on');
    var cur = -1, driving = false;
    function count() { svc.style.setProperty('--cap-n', Math.max(tabs().length - 1, 1)); }
    count();
    if (tabsBox) new MutationObserver(count).observe(tabsBox, { childList: true });
    var trig = ST.create({
      trigger: svc, end: 'bottom bottom',
      start: function () {
        /* the panel may have removed the section since this was set up */
        var t = $('#services .tabs');
        return t ? 'top+=' + Math.max(0, t.offsetTop - 110) + ' top' : 'top top';
      },
      invalidateOnRefresh: true,
      onUpdate: function (s) {
        var list = tabs(), k = list.length;
        if (!k || !document.body.contains(svc)) return;
        var f = s.progress * k, i = clamp(Math.floor(f), 0, k - 1);
        svc.style.setProperty('--tp', clamp(f - i, 0, 1).toFixed(3));
        if (i !== cur) {
          cur = i;
          if (list[i].getAttribute('aria-selected') !== 'true') { driving = true; list[i].click(); driving = false; }
        }
      }
    });
    capGo = function (t) {
      var i = tabs().indexOf(t), k = tabs().length;
      if (i < 0 || !lenis) return;
      cur = i;
      var y = trig.start + (trig.end - trig.start) * ((i + .05) / k);
      lenis.scrollTo(y, { duration: 1.2, force: true });
    };
    function onTab(e) {
      if (driving) return;
      var t = e.target.closest && e.target.closest('.tab');
      if (t) capGo(t);
    }
    tabsBox && tabsBox.addEventListener('click', onTab);
    return function () {
      root.classList.remove('pin-on');
      capGo = null;
      trig.kill();
      tabsBox && tabsBox.removeEventListener('click', onTab);
    };
  });

  /* ---------- the sector rail ---------- */
  var sectors = $('#sectors');
  mm.add('(min-width: 1024px) and (min-height: 640px)', function () {
    var mosaic = $('#sectors .mosaic');
    if (!sectors || !mosaic) return;
    root.classList.add('rail-on');
    var count = document.createElement('div');
    count.className = 'rail-count';
    count.setAttribute('aria-hidden', 'true');
    count.innerHTML = '<span class="rc-a">01</span><b></b><span class="rc-b">06</span>';
    mosaic.parentNode.appendChild(count);
    var dist = 0;
    function measure() {
      if (!document.body.contains(mosaic)) { dist = 0; return; }
      sectors.style.setProperty('--rx-p', 0);
      var vw = document.documentElement.clientWidth;
      var left = mosaic.getBoundingClientRect().left;
      dist = Math.max(0, mosaic.scrollWidth - (vw - left) + left);
      sectors.style.setProperty('--rail', dist + 'px');
    }
    measure();
    var trig = ST.create({
      trigger: sectors, start: 'top top', end: 'bottom bottom', invalidateOnRefresh: true,
      onRefreshInit: measure,
      onUpdate: function (s) {
        var p = s.progress, x = p * dist;
        sectors.style.setProperty('--rx-p', x.toFixed(1));
        sectors.style.setProperty('--rp', p.toFixed(4));
        var cards = $$('.scard', mosaic), vw = window.innerWidth, k = cards.length;
        var a = $('.rc-a', count), b = $('.rc-b', count);
        if (b) b.textContent = String(k).padStart(2, '0');
        if (a) a.textContent = String(clamp(Math.round(p * (k - 1)) + 1, 1, k)).padStart(2, '0');
        cards.forEach(function (c) {
          var r = c.getBoundingClientRect();
          var d = clamp(((r.left + r.width / 2) - vw / 2) / vw, -1, 1);
          c.style.setProperty('--bend', (d * -14).toFixed(2) + 'deg');
          c.style.setProperty('--sc', (1 - Math.abs(d) * .06).toFixed(3));
          c.style.setProperty('--shift', (d * -8).toFixed(2));
        });
      }
    });
    return function () {
      root.classList.remove('rail-on');
      count.remove();
      sectors.style.removeProperty('--rail');
      $$('.scard', mosaic).forEach(function (c) { c.style.removeProperty('--bend'); c.style.removeProperty('--sc'); c.style.removeProperty('--shift'); });
      trig.kill();
    };
  });

  /* ---------- products floor ---------- */
  var products = $('#products');
  if (products) {
    ST.create({ trigger: products, start: 'top bottom', end: 'bottom bottom',
      onUpdate: function (s) { products.style.setProperty('--sp-p', s.progress.toFixed(4)); } });
  }

  /* ---------- the delivery rule ---------- */
  var proc = $('#process'), stagesBox = $('#process .stages');
  if (proc && stagesBox) {
    ST.create({
      trigger: stagesBox, start: 'top 78%', end: 'bottom 55%',
      onUpdate: function (s) {
        proc.style.setProperty('--pr', s.progress.toFixed(4));
        var st = $$('.stage', stagesBox), k = st.length;
        st.forEach(function (el, i) { el.classList.toggle('lit', s.progress >= (i / k) - 0.001 && s.progress > 0); });
      }
    });
  }

  /* ---------- engagement: a light that follows the pointer ---------- */
  var book = $('#book');
  if (book && fine) {
    book.addEventListener('pointermove', function (e) {
      var r = book.getBoundingClientRect();
      book.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      book.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }

  /* ---------- magnetic buttons ---------- */
  if (fine) {
    $$('.hero .btn, .hero .btn-ghost, #book .btn').forEach(function (b) {
      var xTo = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3.out' });
      var yTo = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3.out' });
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * .3);
        yTo((e.clientY - r.top - r.height / 2) * .4);
      });
      b.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ---------- cursor ---------- */
  if (fine) {
    var cur = document.createElement('div');
    cur.className = 'cur';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<span>View</span>';
    document.body.appendChild(cur);
    var cx = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3.out' });
    var cy = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3.out' });
    window.addEventListener('pointermove', function (e) {
      cx(e.clientX); cy(e.clientY);
      cur.classList.add('on');
      var t = e.target;
      var view = t.closest && t.closest('.scard, .panel-media');
      var hot = !view && t.closest && t.closest('a, button, [role="tab"]');
      cur.classList.toggle('view', !!view);
      cur.classList.toggle('hot', !!hot);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
  }

  /* ---------- footer wordmark, letter by letter ---------- */
  var foot = $('.foot');
  if (foot) {
    var mark = document.createElement('div');
    mark.className = 'foot-mark';
    mark.setAttribute('aria-hidden', 'true');
    'HaveStack'.split('').forEach(function (ch) { var s = document.createElement('span'); s.textContent = ch; mark.appendChild(s); });
    foot.appendChild(mark);
    foot.classList.add('has-mark');
    var letters = $$('span', mark);
    ST.create({
      trigger: foot, start: 'top bottom', end: 'bottom bottom',
      onUpdate: function (s) {
        letters.forEach(function (l, i) {
          var p = clamp(s.progress * 1.6 - i * 0.06, 0, 1);
          l.style.setProperty('--fm', (1 - Math.pow(1 - p, 3)).toFixed(3));
        });
      }
    });
    letters.forEach(function (l) { l.style.setProperty('--fm', 0); });
  }

  /* ---------- keep measurements honest ---------- */
  function refresh() { ST.refresh(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh);
  var main = $('main');
  if (main && window.ResizeObserver) {
    var pending = 0, last = main.offsetHeight;
    new ResizeObserver(function () {
      var h = main.offsetHeight;
      if (Math.abs(h - last) < 2) return;
      last = h;
      clearTimeout(pending);
      pending = setTimeout(refresh, 200);
    }).observe(main);
  }
  var resizeT = 0;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(setupTickers, 250); });
})();
