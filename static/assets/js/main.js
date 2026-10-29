/* Dynabyt Technologies — site behaviour. Vanilla JS, no dependencies. */
(function () {
  'use strict';
  var d = document;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  /* ---- sticky header shadow ---- */
  var header = $('.site-header');
  function onScroll() { if (header) header.classList.toggle('is-stuck', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- mobile menu ---- */
  var menuBtn = $('.menu-btn'), menu = $('#mobile-menu');
  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    d.body.classList.toggle('menu-open', open);
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    window.matchMedia('(min-width: 981px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });
  }

  /* ---- desktop services submenu (keyboard + touch) ---- */
  var sub = $('.has-sub');
  if (sub) {
    var tog = $('.sub-toggle', sub);
    tog.addEventListener('click', function () {
      var open = sub.classList.toggle('open');
      tog.setAttribute('aria-expanded', String(open));
    });
    d.addEventListener('click', function (e) { if (!sub.contains(e.target)) { sub.classList.remove('open'); tog.setAttribute('aria-expanded', 'false'); } });
    sub.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { sub.classList.remove('open'); tog.setAttribute('aria-expanded', 'false'); tog.focus(); }
    });
  }

  /* ---- scroll reveal ---- */
  var revealEls = $$('.reveal');
  $$('.stagger').forEach(function (p) {
    $$('.reveal', p).forEach(function (el, i) { el.style.setProperty('--rd', (i * 0.07).toFixed(2) + 's'); });
  });
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- portfolio filters ---- */
  var bar = $('.filter-bar');
  if (bar) {
    var cards = $$('.project-card'), btns = $$('.filter-btn', bar), empty = $('#filter-empty'), live = $('#filter-live');
    var labels = {};
    btns.forEach(function (b) { labels[b.dataset.filter] = b.firstChild.textContent.trim(); });
    var apply = function (f, push) {
      var n = 0;
      cards.forEach(function (c) {
        var show = f === 'all' || (c.dataset.cats || '').split(' ').indexOf(f) > -1;
        c.hidden = !show;
        if (show) { n++; c.classList.add('in'); }
      });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filter === f)); });
      if (empty) {
        empty.hidden = n !== 0;
        var t = $('[data-empty-cat]', empty); if (t) t.textContent = labels[f] || '';
      }
      if (live) live.textContent = n + (n === 1 ? ' project' : ' projects') + ' shown' + (f === 'all' ? '' : ' in ' + (labels[f] || f));
      if (push && history.replaceState) history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.filter, true); }); });
    var h = location.hash.replace('#', '');
    if (h && btns.some(function (b) { return b.dataset.filter === h; })) apply(h, false);
  }

  /* ---- case-study table of contents scroll-spy ---- */
  var toc = $$('.cs-toc a');
  if (toc.length && 'IntersectionObserver' in window) {
    var map = {};
    toc.forEach(function (a) { var id = a.getAttribute('href').slice(1); var el = d.getElementById(id); if (el) map[id] = a; });
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { toc.forEach(function (a) { a.classList.remove('active'); }); map[e.target.id].classList.add('active'); }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { spy.observe(d.getElementById(id)); });
  }

  /* ---- enquiry form ---- */
  var form = $('#enquiry-form');
  if (form) {
    var status = $('#form-status'), btn = $('button[type=submit]', form);
    var setStatus = function (kind, msg) {
      status.className = 'form-status show form-status--' + kind;
      status.textContent = msg;
      status.setAttribute('role', kind === 'err' ? 'alert' : 'status');
      status.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      status.focus();
    };
    var clearErrors = function () {
      $$('.field-error', form).forEach(function (s) { s.textContent = ''; });
      $$('[aria-invalid]', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    };
    var showErrors = function (errs) {
      var first = null;
      Object.keys(errs).forEach(function (k) {
        var inp = form.elements[k]; var out = $('[data-error-for="' + k + '"]', form);
        if (out) out.textContent = errs[k];
        if (inp) { inp.setAttribute('aria-invalid', 'true'); first = first || inp; }
      });
      if (first) first.focus();
    };
    form.addEventListener('submit', function (e) {
      if (!window.fetch) return; // graceful fallback: normal POST
      e.preventDefault();
      clearErrors();
      status.className = 'form-status';
      if (!form.checkValidity()) {
        // Use browser messages for missing required fields, but render them in our own UI.
        var errs = {};
        $$('input, select, textarea', form).forEach(function (el) {
          if (el.name && !el.checkValidity()) errs[el.name] = el.validationMessage;
        });
        showErrors(errs);
        return;
      }
      btn.disabled = true; form.classList.add('is-loading');
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json', 'X-Requested-With': 'fetch' }, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (res) {
          if (res.j && res.j.ok) {
            form.reset();
            setStatus('ok', res.j.message);
            if (window.gtag) window.gtag('event', 'generate_lead', { method: 'contact_form' });
          } else {
            if (res.j && res.j.errors) showErrors(res.j.errors);
            setStatus('err', (res.j && res.j.message) || 'Something went wrong. Please try again.');
          }
        })
        .catch(function () { setStatus('err', 'We could not reach the server. Please check your connection and try again.'); })
        .then(function () { btn.disabled = false; form.classList.remove('is-loading'); });
    });
    // Preselect service from ?service=
    var q = new URLSearchParams(location.search).get('service');
    if (q && form.elements.service) { Array.prototype.forEach.call(form.elements.service.options, function (o) { if (o.value === q) form.elements.service.value = q; }); }
  }

  /* ---- analytics consent (only active when GA4_ID is configured) ---- */
  var ga = d.body.getAttribute('data-ga4'), banner = $('#consent');
  function loadGA() {
    if (!ga || window.__gaLoaded) return; window.__gaLoaded = true;
    var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga); d.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', ga, { anonymize_ip: true });
  }
  if (ga && banner) {
    var saved = null; try { saved = localStorage.getItem('dyn-consent'); } catch (e) {}
    if (saved === 'accept') loadGA(); else if (!saved) banner.hidden = false;
    $$('[data-consent]', banner).forEach(function (b) {
      b.addEventListener('click', function () {
        try { localStorage.setItem('dyn-consent', b.dataset.consent); } catch (e) {}
        banner.hidden = true; if (b.dataset.consent === 'accept') loadGA();
      });
    });
  }
})();
