/* ============================================================
   留灯 · 交互
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var escAttr = function (s) { return esc(s).replace(/\n/g, ' '); };
  var nf = new Intl.NumberFormat('zh-CN');
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var CN_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var FORMAL = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾',
    '拾壹', '拾贰', '拾叁', '拾肆', '拾伍', '拾陆', '拾柒', '拾捌', '拾玖', '贰拾'];
  var SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  var LS = {
    entries: 'liudeng.entries',
    name: 'liudeng.name',
    future: 'liudeng.future',
    entered: 'liudeng.entered',
    pass: 'liudeng.pass'
  };

  function parseISO(iso) {
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return toISO(new Date()); }
  function addDays(iso, n) {
    var d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function daysBetween(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / 86400000);
  }
  function cnYear(y) {
    return String(y).split('').map(function (c) { return CN_DIGITS[Number(c)] || c; }).join('');
  }
  function cnDate(iso) {
    var d = parseISO(iso);
    var day = window.CHINESE_NUMERALS[d.getDate()] || d.getDate();
    return cnYear(d.getFullYear()) + '年' + window.MONTH_NAMES[d.getMonth()] + day + '日';
  }
  function fmtDate(iso) {
    var p = String(iso).split('-');
    return p[0] + '.' + pad(p[1]) + '.' + pad(p[2]);
  }
  function weekday(iso) { return WEEK[parseISO(iso).getDay()]; }
  function monthKey(iso) { return String(iso).slice(0, 7); }
  function seasonOf(month) {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }
  function truncate(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '……' : s;
  }
  function charCount(text) {
    return (text || []).join('').replace(/\s/g, '').length;
  }
  function formalNumeral(n) {
    return FORMAL[n] || window.CHINESE_NUMERALS[n] || String(n);
  }

  /* ---------- 数据 ---------- */
  function normalizeEntries(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (e, i) {
      if (!e || !e.date) return null;
      var iso = String(e.date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      var text = [];
      if (Array.isArray(e.text)) {
        text = e.text.map(function (p) { return String(p).trim(); }).filter(Boolean);
      } else if (typeof e.text === 'string') {
        text = e.text.split(/\n+/).map(function (p) { return p.trim(); }).filter(Boolean);
      }
      if (!text.length) return null;
      var image = null;
      if (e.image && e.image.src) {
        image = {
          src: String(e.image.src),
          alt: e.image.alt || '',
          caption: e.image.caption || '',
          ratio: e.image.ratio ? String(e.image.ratio) : ''
        };
      }
      return {
        id: e.id || ('x' + i),
        date: iso,
        time: e.time ? String(e.time).slice(0, 5) : '',
        title: String(e.title || '无题').trim(),
        weather: e.weather ? String(e.weather) : '',
        place: e.place ? String(e.place) : '',
        mood: e.mood ? String(e.mood) : '',
        tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
        layout: e.layout === 'wide' || e.layout === 'quote' ? e.layout : 'default',
        quote: e.quote ? String(e.quote) : '',
        note: e.note ? String(e.note) : '',
        image: image,
        text: text
      };
    }).filter(Boolean).sort(function (a, b) {
      return (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time);
    }).map(function (e, i) {
      e.id = e.id || ('x' + i);
      e._index = i;
      return e;
    });
  }

  function loadEntries() {
    try {
      var raw = localStorage.getItem(LS.entries);
      if (raw) {
        var parsed = JSON.parse(raw);
        var normalized = normalizeEntries(Array.isArray(parsed) ? parsed : parsed.entries);
        if (normalized.length) return normalized;
      }
    } catch (e) {}
    return normalizeEntries(window.SAMPLE_ENTRIES);
  }

  var entries = loadEntries();
  var currentIndex = -1;
  var soundMode = 0;
  var started = false;
  var overlayOpen = false;
  var lastFocus = null;
  var idleTimer = null;
  var toastTimer = null;
  var futureOpened = false;

  /* ---------- 缓存节点 ---------- */
  var boot = $('#boot');
  var enterBtn = $('#enterBtn');
  var journey = $('#journey');
  var journeyBody = $('#journeyBody');
  var threadProgress = $('#threadProgress');
  var incenseAsh = $('#incenseAsh');
  var incenseEmber = $('#incenseEmber');
  var incenseLabel = $('#incenseLabel');
  var hudMeta = $('#hudMeta');
  var greeting = $('#greeting');
  var prologueStats = $('#prologueStats');
  var epilogueStats = $('#epilogueStats');
  var prologueYear = $('#prologueYear');
  var epilogueMeta = $('#epilogueMeta');
  var footerYear = $('#footerYear');
  var nameInput = $('#nameInput');
  var drawerName = $('#drawerName');
  var soundBtn = $('#soundBtn');
  var soundLabel = $('#soundLabel');
  var starBtn = $('#starBtn');
  var starMap = $('#starmap');
  var starField = $('#starField');
  var starLines = $('#starLines');
  var starClose = $('#starClose');
  var letterLayer = $('#letterLayer');
  var paper = $('#paper');
  var letterDate = $('#letterDate');
  var letterMeta = $('#letterMeta');
  var letterTitle = $('#letterTitle');
  var letterBody = $('#letterBody');
  var letterNote = $('#letterNote');
  var letterTags = $('#letterTags');
  var letterSeal = $('#letterSeal');
  var letterIndex = $('#letterIndex');
  var prevEntry = $('#prevEntry');
  var nextEntry = $('#nextEntry');
  var drawer = $('#drawer');
  var drawerBtn = $('#drawerBtn');
  var importText = $('#importText');
  var importFile = $('#importFile');
  var importSave = $('#importSave');
  var importReset = $('#importReset');
  var importReplace = $('#importReplace');
  var importExport = $('#importExport');
  var futureStage = $('#futureStage');
  var toastEl = $('#toast');
  var idleWhisper = $('#idleWhisper');
  var cursorGlow = $('#cursorGlow');
  var dust = $('#dust');
  var mugBtn = $('#mugBtn');
  var prologueContent = $('.prologue__content');

  /* ---------- 小工具 ---------- */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3400);
  }

  function getName() {
    try {
      var saved = localStorage.getItem(LS.name);
      if (saved) return saved;
    } catch (e) {}
    return (window.SITE && window.SITE.owner) || '';
  }
  function setName(v) {
    try {
      if (v) localStorage.setItem(LS.name, v);
      else localStorage.removeItem(LS.name);
    } catch (e) {}
    nameInput.value = v;
    drawerName.value = v;
    updateGreeting();
  }
  function timeGreeting() {
    var h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 8) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    if (h < 23) return '晚上好';
    return '夜深了';
  }
  function updateGreeting() {
    var name = getName();
    greeting.textContent = name ? timeGreeting() + '，' + name : timeGreeting() + '，欢迎回家';
  }
  function updateClock() {
    var d = new Date();
    hudMeta.textContent = (window.SITE.campus || '紫金港') + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- 统计 ---------- */
  function statsData() {
    if (!entries.length) return { count: 0, days: 0, chars: 0 };
    var first = entries[0].date;
    var last = entries[entries.length - 1].date;
    return {
      count: entries.length,
      days: daysBetween(first, last) + 1,
      chars: entries.reduce(function (sum, e) { return sum + charCount(e.text); }, 0)
    };
  }

  function statsHTML() {
    var s = statsData();
    return '' +
      '<div class="stat"><span class="stat__num" data-count="' + s.count + '">0</span><span class="stat__label">篇日记</span></div>' +
      '<div class="stat"><span class="stat__num" data-count="' + s.days + '">0</span><span class="stat__label">天</span></div>' +
      '<div class="stat"><span class="stat__num" data-count="' + s.chars + '">0</span><span class="stat__label">个字</span></div>';
  }

  function animateStats(root) {
    if (!root) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('[data-count]', root).forEach(function (el) {
      var target = Number(el.getAttribute('data-count')) || 0;
      if (reduced) { el.textContent = nf.format(target); return; }
      var start = performance.now();
      var dur = 1500;
      function tick(now) {
        var t = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = nf.format(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- 序 / 尾声 ---------- */
  function renderFrontMatter() {
    var s = statsData();
    prologueStats.innerHTML = statsHTML();
    epilogueStats.innerHTML = statsHTML();
    animateStats(prologueStats);
    animateStats(epilogueStats);

    if (entries.length) {
      var years = [];
      entries.forEach(function (e) {
        var y = e.date.slice(0, 4);
        if (years.indexOf(y) === -1) years.push(y);
      });
      prologueYear.textContent = years.length > 1
        ? cnYear(years[0]) + '—' + cnYear(years[years.length - 1])
        : cnYear(years[0]);
      var last = entries[entries.length - 1];
      var lm = parseISO(last.date).getMonth() + 1;
      epilogueMeta.textContent = cnYear(last.date.slice(0, 4)) + ' · ' + SEASON_CN[seasonOf(lm)];
      footerYear.textContent = last.date.slice(0, 4);
    }
    nameInput.value = getName();
    drawerName.value = getName();
    updateGreeting();
    updateClock();
  }

  /* ---------- 时间线 ---------- */
  function groupByMonth(list) {
    var map = {};
    var order = [];
    list.forEach(function (e) {
      var k = monthKey(e.date);
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(e);
    });
    order.sort();
    return order.map(function (k) { return { key: k, items: map[k] }; });
  }

  var INDENTS = [0, 34, 10, 50, 18, 0, 42, 8];
  var WIDTHS = [520, 560, 486, 600, 540, 505];

  var ASPECTS = {
    landscape_4_3: '4 / 3',
    landscape_16_9: '16 / 9',
    portrait_4_3: '3 / 4',
    portrait_16_9: '9 / 16',
    square: '1 / 1',
    square_hd: '1 / 1'
  };
  function aspectOf(src) {
    var m = String(src).match(/image_size=([a-z0-9_]+)/i);
    return (m && ASPECTS[m[1]]) || '';
  }

  function entryFigure(e) {
    if (!e.image) return '';
    var ar = e.image.ratio || aspectOf(e.image.src);
    return '<figure class="entry__figure">' +
      '<img src="' + escAttr(e.image.src) + '" alt="' + escAttr(e.image.alt) + '" loading="lazy" ' +
      (ar ? 'style="aspect-ratio:' + ar + '" ' : '') +
      'onerror="this.closest(\'figure\').style.display=\'none\'">' +
      (e.image.caption ? '<figcaption>' + esc(e.image.caption) + '</figcaption>' : '') +
      '</figure>';
  }

  function entryHTML(e, iInChapter) {
    var layout = e.layout || 'default';
    var isQuote = layout === 'quote';
    var isWide = layout === 'wide';
    var indent = isWide || isQuote ? 0 : INDENTS[iInChapter % INDENTS.length];
    var width = isWide ? 720 : isQuote ? 700 : WIDTHS[iInChapter % WIDTHS.length];
    var quote = e.quote || e.text[0] || '';
    var excerpt = truncate(e.text[0] || '', isWide ? 92 : 78);
    var meta = [];
    if (e.weather) meta.push('<span>' + esc(e.weather) + '</span>');
    if (e.place) meta.push('<i></i><span>' + esc(e.place) + '</span>');
    if (e.mood) meta.push('<i></i><span>' + esc(e.mood) + '</span>');
    var figure = entryFigure(e);

    return '<article class="entry ' + (isWide ? 'entry--wide ' : '') + (isQuote ? 'entry--quote ' : '') + '"' +
      ' data-index="' + e._index + '" tabindex="0" role="button" aria-label="打开日记：' + escAttr(e.title) + '"' +
      ' style="--indent:' + indent + 'px;--w:' + width + 'px;--d:' + ((iInChapter % 3) * 90) + 'ms">' +
      '<span class="entry__tick" aria-hidden="true"><i></i></span>' +
      (isWide && e.image ? figure : '') +
      '<p class="entry__date"><b>' + esc(fmtDate(e.date)) + '</b><span>' + esc(weekday(e.date)) + '</span>' +
      (e.time ? '<span>' + esc(e.time) + '</span>' : '') + '</p>' +
      '<h3 class="entry__title">' + esc(e.title) + '</h3>' +
      (isQuote ? '<p class="entry__quote">' + esc(quote) + '</p>' : '') +
      (!isWide && e.image ? figure : '') +
      (!isQuote ? '<p class="entry__excerpt">' + esc(excerpt) + '</p>' : '') +
      '<p class="entry__meta">' + meta.join('') + '</p>' +
      '<span class="entry__more">展开这一页 →</span>' +
      '</article>';
  }

  function renderJourney() {
    var groups = groupByMonth(entries);
    var html = '';
    groups.forEach(function (g, gi) {
      var meta = (window.CHAPTER_META && window.CHAPTER_META[g.key]) || {};
      var d = parseISO(g.key + '-01');
      var year = d.getFullYear();
      var month = d.getMonth() + 1;
      var season = seasonOf(month);
      var chars = g.items.reduce(function (sum, e) { return sum + charCount(e.text); }, 0);
      var whisper = meta.whisper || ('这个月，你写下了 ' + g.items.length + ' 篇。');
      var label = meta.label || '';

      html += '<section class="chapter" data-month="' + g.key + '" data-label="' + escAttr(label || month + '月') + '" data-season="' + season + '">';
      if (meta.image) {
        html += '<div class="chapter__bg" style="background-image:url(\'' + escAttr(meta.image) + '\')"></div>';
      }
      html += '<div class="chapter__head">' +
        '<span class="chapter__numeral" aria-hidden="true">' + formalNumeral(gi + 1) + '</span>' +
        '<div class="chapter__text reveal">' +
        '<p class="eyebrow">' + cnYear(year) + ' · ' + SEASON_CN[season] + '</p>' +
        (label ? '<p class="chapter__label">' + esc(label) + '</p>' : '') +
        '<h2 class="chapter__title">' + window.MONTH_NAMES[month - 1] + '</h2>' +
        '<p class="chapter__whisper">' + esc(whisper) + '</p>' +
        '<p class="chapter__count">' + g.items.length + ' 篇 · ' + nf.format(chars) + ' 字</p>' +
        '</div></div>';
      html += '<div class="chapter__entries">';
      g.items.forEach(function (e, i) { html += entryHTML(e, i); });
      html += '</div><div class="chapter__end"><span></span></div></section>';
    });
    journeyBody.innerHTML = html;

    initReveal();
    initEntryClicks();
    initParallax();
    updateScroll();
  }

  var revealIO = null;
  function initReveal() {
    if (revealIO) revealIO.disconnect();
    revealIO = new IntersectionObserver(function (items) {
      items.forEach(function (item) {
        if (item.isIntersecting) {
          item.target.classList.add('is-in');
          revealIO.unobserve(item.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    $$('.entry, .reveal', journeyBody).forEach(function (el) { revealIO.observe(el); });
  }

  function initEntryClicks() {
    $$('.entry', journeyBody).forEach(function (el) {
      var idx = Number(el.getAttribute('data-index'));
      el.addEventListener('click', function () { openLetter(idx); });
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          openLetter(idx);
        }
      });
    });
  }

  /* ---------- 滚动 ---------- */
  var parallaxEls = [];
  var scrollTicking = false;

  function initParallax() {
    parallaxEls = $$('.chapter__bg');
  }

  function updateScroll() {
    var vh = window.innerHeight || 800;
    var rect = journey.getBoundingClientRect();
    var p = clamp((-rect.top + vh * 0.38) / Math.max(1, rect.height), 0, 1);
    threadProgress.style.transform = 'scaleY(' + p + ')';
    var pct = (p * 100).toFixed(2) + '%';
    incenseAsh.style.height = pct;
    incenseEmber.style.top = pct;
    var smoke = $('.incense__smoke');
    if (smoke) smoke.style.top = pct;

    var chapters = $$('.chapter', journeyBody);
    var current = null;
    for (var i = 0; i < chapters.length; i++) {
      var r = chapters[i].getBoundingClientRect();
      if (r.top < vh * 0.52) current = chapters[i];
    }
    if (current) {
      var label = current.getAttribute('data-label') || '';
      if (incenseLabel.textContent !== label) incenseLabel.textContent = label;
      var season = current.getAttribute('data-season');
      if (season && document.body.dataset.season !== season) document.body.dataset.season = season;
    }

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      var sy = window.scrollY || 0;
      if (prologueContent) prologueContent.style.opacity = clamp(1 - sy / (vh * 0.82), 0, 1);
      if (prologueYear) prologueYear.style.transform = 'translate3d(0,' + Math.min(sy * 0.12, 180) + 'px,0)';
      parallaxEls.forEach(function (el) {
        var pr = el.parentElement.getBoundingClientRect();
        if (pr.bottom < -80 || pr.top > vh + 80) return;
        var q = (pr.top + pr.height / 2 - vh / 2) / vh;
        el.style.transform = 'translate3d(0,' + (q * 26).toFixed(2) + 'px,0) scale(1.06)';
      });
    }
  }

  function onScroll() {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(function () {
        updateScroll();
        scrollTicking = false;
      });
    }
  }

  /* ---------- 信 ---------- */
  function buildPaperFigure(img) {
    var fig = document.createElement('figure');
    fig.className = 'paper__figure';
    var image = document.createElement('img');
    image.src = img.src;
    image.alt = img.alt || '';
    image.loading = 'lazy';
    var ar = img.ratio || aspectOf(img.src);
    if (ar) image.style.aspectRatio = ar;
    image.addEventListener('error', function () { fig.style.display = 'none'; });
    fig.appendChild(image);
    if (img.caption) {
      var cap = document.createElement('figcaption');
      cap.textContent = img.caption;
      fig.appendChild(cap);
    }
    return fig;
  }

  function populateLetter(e) {
    letterDate.textContent = cnDate(e.date) + ' · ' + weekday(e.date) + (e.time ? ' · ' + e.time : '');
    letterMeta.textContent = [e.weather, e.place, e.mood].filter(Boolean).join(' · ');
    letterTitle.textContent = e.title;

    letterBody.innerHTML = '';
    e.text.forEach(function (p, i) {
      var el = document.createElement('p');
      el.textContent = p;
      letterBody.appendChild(el);
      if (i === 0 && e.image) letterBody.appendChild(buildPaperFigure(e.image));
    });

    if (e.note) {
      letterNote.textContent = e.note;
      letterNote.hidden = false;
    } else {
      letterNote.textContent = '';
      letterNote.hidden = true;
    }

    var tags = e.tags && e.tags.length ? e.tags : [e.mood, e.weather].filter(Boolean);
    letterTags.innerHTML = tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    letterSeal.textContent = '记';
    letterIndex.textContent = (currentIndex + 1) + ' / ' + entries.length;
    prevEntry.disabled = currentIndex <= 0;
    nextEntry.disabled = currentIndex >= entries.length - 1;
  }

  function openLetter(index, focusTarget) {
    if (!entries[index]) return;
    if (!starMap.hidden) closeStarMap(true);
    if (!drawer.hidden) closeDrawer(true);
    currentIndex = index;
    if (focusTarget) lastFocus = focusTarget;
    else if (!overlayOpen) lastFocus = document.activeElement;
    populateLetter(entries[index]);
    letterLayer.hidden = false;
    document.body.classList.add('is-reading');
    overlayOpen = true;
    paper.scrollTop = 0;
    paper.style.animation = 'none';
    void paper.offsetHeight;
    paper.style.animation = '';
    var closeBtn = $('.paper__close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    hideIdle();
  }

  function closeLetter(skipFocus) {
    if (letterLayer.hidden) return;
    letterLayer.hidden = true;
    overlayOpen = false;
    document.body.classList.remove('is-reading');
    currentIndex = -1;
    if (!skipFocus) restoreFocus();
  }

  function stepLetter(dir) {
    var next = currentIndex + dir;
    if (next < 0 || next >= entries.length) return;
    currentIndex = next;
    populateLetter(entries[next]);
    paper.scrollTop = 0;
    paper.style.animation = 'none';
    void paper.offsetHeight;
    paper.style.animation = '';
  }

  function restoreFocus() {
    if (lastFocus && document.documentElement.contains(lastFocus) && lastFocus.offsetParent !== null) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    } else if (starBtn) {
      try { starBtn.focus({ preventScroll: true }); } catch (e) {}
    }
    lastFocus = null;
  }

  /* ---------- 星图 ---------- */
  var starBgBuilt = false;

  function buildStarBg() {
    if (starBgBuilt) return;
    starBgBuilt = true;
    var bg = $('.starmap__bg');
    if (!bg) return;
    for (var i = 0; i < 150; i++) {
      var s = document.createElement('span');
      s.style.left = rand(1, 99).toFixed(2) + '%';
      s.style.top = rand(1, 99).toFixed(2) + '%';
      var size = rand(1, 2.2);
      s.style.width = size.toFixed(1) + 'px';
      s.style.height = size.toFixed(1) + 'px';
      s.style.opacity = rand(.15, .6).toFixed(2);
      s.style.animationDuration = rand(3, 9).toFixed(1) + 's';
      s.style.animationDelay = (-rand(0, 9)).toFixed(1) + 's';
      bg.appendChild(s);
    }
  }

  function renderStarmap() {
    $$('.star, .star__month', starField).forEach(function (n) { n.remove(); });
    starLines.innerHTML = '';
    if (!entries.length) return;

    var n = entries.length;
    var points = [];
    var monthsSeen = {};
    var months = [];

    entries.forEach(function (e, i) {
      var x = n === 1 ? 50 : 6 + (i / (n - 1)) * 88;
      var y = 50 + Math.sin(i * 0.82) * 21 + ((i % 4) - 1.5) * 3.6;
      y = clamp(y, 16, 84);
      points.push({ x: x, y: y, e: e });

      var k = monthKey(e.date);
      if (!monthsSeen[k]) {
        monthsSeen[k] = true;
        months.push({ key: k, x: x, date: e.date });
      }

      var star = document.createElement('button');
      star.type = 'button';
      star.className = 'star';
      star.style.left = x.toFixed(2) + '%';
      star.style.top = y.toFixed(2) + '%';
      star.style.setProperty('--size', (5 + Math.min(5, Math.round(charCount(e.text) / 180))) + 'px');
      star.style.setProperty('--d', (i * 26) + 'ms');
      star.setAttribute('aria-label', fmtDate(e.date) + ' ' + e.title);
      var lab = document.createElement('span');
      lab.className = 'star__label';
      lab.textContent = fmtDate(e.date) + ' · ' + e.title;
      star.appendChild(lab);
      star.addEventListener('click', function () {
        closeStarMap(true);
        setTimeout(function () { openLetter(i, starBtn); }, 260);
      });
      starField.appendChild(star);
    });

    if (points.length > 1) {
      var d = points.map(function (p, i) {
        return (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
      }).join(' ');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      starLines.appendChild(path);
    }

    months.forEach(function (m) {
      var el = document.createElement('span');
      el.className = 'star__month';
      el.style.left = m.x.toFixed(2) + '%';
      el.style.top = '2%';
      el.textContent = window.MONTH_NAMES[parseISO(m.date).getMonth()];
      starField.appendChild(el);
    });
  }

  function openStarMap() {
    if (!starMap.hidden) return;
    buildStarBg();
    renderStarmap();
    lastFocus = document.activeElement;
    starMap.hidden = false;
    document.body.classList.add('is-reading');
    overlayOpen = true;
    hideIdle();
    try { starClose.focus({ preventScroll: true }); } catch (e) {}
  }

  function closeStarMap(skipFocus) {
    if (starMap.hidden) return;
    starMap.hidden = true;
    overlayOpen = false;
    document.body.classList.remove('is-reading');
    if (!skipFocus) restoreFocus();
  }

  /* ---------- 抽屉 / 导入 ---------- */
  function openDrawer() {
    if (!drawer.hidden) return;
    lastFocus = document.activeElement;
    importText.value = importText.value || '';
    drawerName.value = getName();
    drawer.hidden = false;
    document.body.classList.add('is-reading');
    overlayOpen = true;
    hideIdle();
    var closeBtn = $('.drawer__close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }
  function closeDrawer(skipFocus) {
    if (drawer.hidden) return;
    drawer.hidden = true;
    overlayOpen = false;
    document.body.classList.remove('is-reading');
    if (!skipFocus) restoreFocus();
  }

  function parseImportedText(text) {
    var raw = String(text || '').trim();
    if (!raw) return [];
    if (raw.charAt(0) === '[' || raw.charAt(0) === '{') {
      try {
        var data = JSON.parse(raw);
        return normalizeEntries(Array.isArray(data) ? data : data.entries);
      } catch (e) { return []; }
    }

    raw = raw.replace(/\r\n/g, '\n');
    raw = raw.replace(/\n\s*[-—–·]{3,}\s*\n/g, '\n@@SPLIT@@\n');
    raw = raw.replace(/\n(?=\d{4}[-./年]\d{1,2}[-./月]\d{1,2}日?[\s|｜])/g, '\n@@SPLIT@@\n');
    var blocks = raw.split('@@SPLIT@@').map(function (b) { return b.trim(); }).filter(Boolean);

    var list = [];
    blocks.forEach(function (block, idx) {
      var lines = block.split('\n');
      var header = (lines.shift() || '').trim();
      var m = header.match(/^(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})日?/);
      if (!m) return;
      var iso = m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
      var rest = header.slice(m[0].length).trim();
      var time = '';
      var tm = rest.match(/^(\d{1,2}):(\d{2})/);
      if (tm) {
        time = pad(tm[1]) + ':' + tm[2];
        rest = rest.slice(tm[0].length).trim();
      }
      rest = rest.replace(/^[|｜·\-—\s]+/, '');
      var parts = rest.split(/\s*[|｜]\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
      var title = parts.shift() || '无题';
      var weather = parts[0] || '';
      var place = parts[1] || '';
      var mood = parts[2] || '';
      var bodyText = lines.join('\n').trim();
      var paras = bodyText.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!paras.length) paras = [title];
      list.push({
        id: 'import-' + idx,
        date: iso,
        time: time,
        title: title,
        weather: weather,
        place: place,
        mood: mood,
        tags: [],
        text: paras
      });
    });
    return normalizeEntries(list);
  }

  function saveEntries(list, message) {
    entries = normalizeEntries(list);
    entries.forEach(function (e, i) { e._index = i; });
    try {
      localStorage.setItem(LS.entries, JSON.stringify(entries.map(function (e) {
        var copy = {};
        Object.keys(e).forEach(function (k) { if (k !== '_index') copy[k] = e[k]; });
        return copy;
      })));
    } catch (e) {
      toast('浏览器存储空间不够了。');
      return;
    }
    renderFrontMatter();
    renderJourney();
    renderFuture();
    if (!starMap.hidden) renderStarmap();
    toast(message || '收好了。');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function entryKey(e) {
    return e.date + '|' + (e.time || '') + '|' + (e.title || '');
  }

  function handleImport() {
    var parsed = parseImportedText(importText.value);
    if (!parsed.length) {
      toast('没太读懂。每一篇的第一行，要写 2026-09-18。');
      return;
    }

    var replace = importReplace.checked;
    var next = parsed;
    var added = parsed.length;

    if (!replace && entries.length) {
      var seen = {};
      entries.forEach(function (e) { seen[entryKey(e)] = true; });
      var fresh = parsed.filter(function (e) {
        var k = entryKey(e);
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
      next = entries.concat(fresh);
      added = fresh.length;
    }

    closeDrawer(true);
    saveEntries(next, replace
      ? ('收好了。现在时间线上是这 ' + parsed.length + ' 篇。')
      : ('收好了。新添了 ' + added + ' 篇，一共 ' + next.length + ' 篇。'));
  }

  function exportEntries() {
    var data = {
      exportedAt: new Date().toISOString(),
      site: window.SITE,
      entries: entries.map(function (e) {
        var copy = {};
        Object.keys(e).forEach(function (k) { if (k !== '_index') copy[k] = e[k]; });
        return copy;
      })
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '留灯-日记备份-' + todayISO().replace(/-/g, '') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast('备份已经放到你的下载里。');
  }

  /* ---------- 给未来的信 ---------- */
  function getFuture() {
    try {
      var raw = localStorage.getItem(LS.future);
      if (!raw) return null;
      var f = JSON.parse(raw);
      if (f && f.text && f.openAt) return f;
    } catch (e) {}
    return null;
  }
  function setFuture(f) {
    try { localStorage.setItem(LS.future, JSON.stringify(f)); } catch (e) {}
  }
  function clearFuture() {
    try { localStorage.removeItem(LS.future); } catch (e) {}
  }

  function renderFuture() {
    if (!futureStage) return;
    futureStage.innerHTML = '';
    var f = getFuture();

    if (!f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'envelope';
      btn.innerHTML = '<span class="envelope__body"></span>' +
        '<span class="envelope__text">写一封给未来的信</span>' +
        '<span class="envelope__sub">封好，放在这里。时间到了再打开。</span>';
      btn.addEventListener('click', showFutureForm);
      futureStage.appendChild(btn);
      return;
    }

    var today = todayISO();
    var left = daysBetween(today, f.openAt);
    var sealed = document.createElement('div');
    sealed.className = 'future__sealed';
    sealed.innerHTML = '<p class="hand">已封存</p>' +
      '<p class="future__count">写于 ' + fmtDate(f.sealedAt || today) + ' · 将在 ' + fmtDate(f.openAt) + ' 打开</p>' +
      '<p class="future__count">' + (left > 0 ? '还有 ' + left + ' 天。它会替你记着。' : '时间到了。可以拆开了。') + '</p>';

    if (left <= 0) {
      var openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'future__open';
      openBtn.textContent = futureOpened ? '收起来' : '拆开';
      openBtn.addEventListener('click', function () {
        futureOpened = !futureOpened;
        renderFuture();
      });
      sealed.appendChild(openBtn);
    }
    futureStage.appendChild(sealed);

    if (futureOpened && left <= 0) {
      var letter = document.createElement('div');
      letter.className = 'future__letter';
      String(f.text).split(/\n/).filter(Boolean).forEach(function (line) {
        var p = document.createElement('p');
        p.textContent = line;
        letter.appendChild(p);
      });
      futureStage.appendChild(letter);
    }
  }

  function showFutureForm() {
    futureStage.innerHTML = '';
    var today = todayISO();
    var def = addDays(today, 100);
    var wrap = document.createElement('form');
    wrap.className = 'future__form';
    wrap.innerHTML = '<label for="futureText">现在的你，想说什么</label>' +
      '<textarea id="futureText" placeholder="不用写得很好。想到什么，就写什么。"></textarea>' +
      '<label class="future__date-label" for="futureDate">什么时候打开</label>' +
      '<input id="futureDate" type="date" value="' + def + '" min="' + addDays(today, 1) + '">' +
      '<button class="btn btn--solid" type="submit">封好</button>';
    wrap.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = $('#futureText', wrap).value.trim();
      var openAt = $('#futureDate', wrap).value;
      if (!text) { toast('还没写呢。'); return; }
      if (!openAt || daysBetween(today, openAt) < 1) { toast('选一个以后的日期吧。'); return; }
      setFuture({ text: text, openAt: openAt, sealedAt: today });
      futureOpened = false;
      renderFuture();
      toast('封好了。它会替你记着。');
    });
    futureStage.appendChild(wrap);
    setTimeout(function () {
      var t = $('#futureText', wrap);
      if (t) t.focus({ preventScroll: true });
    }, 120);
  }

  /* ---------- 声音 ---------- */
  var audioCtx = null;
  var ambient = null;

  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function stopAmbient() {
    if (!ambient) return;
    var a = ambient;
    ambient = null;
    try {
      a.gain.gain.cancelScheduledValues(audioCtx.currentTime);
      a.gain.gain.setTargetAtTime(0, audioCtx.currentTime, .25);
      setTimeout(function () {
        try { a.src.stop(); } catch (e) {}
      }, 1200);
    } catch (e) {}
  }

  function startAmbient(mode) {
    var ctx = ensureAudio();
    if (!ctx) { toast('这个浏览器不太想出声。'); return; }
    stopAmbient();
    var seconds = 3;
    var buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var last = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      if (mode === 'rain') {
        data[i] = white * .36;
      } else {
        last = (last + .022 * white) / 1.02;
        data[i] = last * 3.4;
      }
    }
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = mode === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = mode === 'rain' ? 1500 : 380;
    filter.Q.value = mode === 'rain' ? .4 : .7;
    var gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(mode === 'rain' ? .045 : .06, ctx.currentTime, .8);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    ambient = { src: src, gain: gain, mode: mode };
  }

  function updateSoundUI() {
    var names = ['声音', '雨声', '风声'];
    soundLabel.textContent = names[soundMode];
    soundBtn.classList.toggle('is-on', soundMode > 0);
    soundBtn.setAttribute('aria-label', soundMode === 0 ? '打开房间的声音' : '切换声音');
  }

  function cycleSound() {
    soundMode = (soundMode + 1) % 3;
    if (soundMode === 0) {
      stopAmbient();
    } else {
      startAmbient(soundMode === 1 ? 'rain' : 'wind');
    }
    updateSoundUI();
  }

  /* ---------- 环境细节 ---------- */
  function buildDust() {
    if (!dust) return;
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('span');
      var size = rand(1, 3);
      s.style.left = rand(2, 98).toFixed(2) + '%';
      s.style.top = rand(18, 96).toFixed(2) + '%';
      s.style.width = size.toFixed(1) + 'px';
      s.style.height = size.toFixed(1) + 'px';
      s.style.opacity = rand(.2, .7).toFixed(2);
      s.style.animationDuration = rand(15, 32).toFixed(1) + 's';
      s.style.animationDelay = (-rand(0, 30)).toFixed(1) + 's';
      dust.appendChild(s);
    }
  }

  function initCursorGlow() {
    if (!cursorGlow) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    var tx = -1000, ty = -1000, x = -1000, y = -1000, running = false;
    function loop() {
      x += (tx - x) * .08;
      y += (ty - y) * .08;
      cursorGlow.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%)';
      if (Math.abs(tx - x) > .5 || Math.abs(ty - y) > .5) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX;
      ty = e.clientY;
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
  }

  function hideIdle() {
    idleWhisper.classList.remove('is-on');
    clearTimeout(idleTimer);
  }
  function resetIdle() {
    hideIdle();
    if (!document.body.classList.contains('is-entered')) return;
    idleTimer = setTimeout(function () {
      if (!overlayOpen) {
        idleWhisper.classList.add('is-on');
        setTimeout(function () { idleWhisper.classList.remove('is-on'); }, 5200);
      }
    }, 42000);
  }

  /* ---------- 进入 ---------- */
  function enterRoom(silent) {
    if (started) return;
    started = true;
    try { localStorage.setItem(LS.entered, '1'); } catch (e) {}
    document.body.classList.remove('is-locked');
    document.body.classList.add('is-entered');
    if (!silent) {
      boot.classList.add('is-lit');
      setTimeout(function () { boot.classList.add('is-out'); }, 850);
      setTimeout(function () { boot.style.display = 'none'; }, 2600);
    }
    resetIdle();
  }

  /* ---------- 初始化 ---------- */
  function bindEvents() {
    if (enterBtn) enterBtn.addEventListener('click', function (e) { e.stopPropagation(); enterRoom(false); });
    if (boot) boot.addEventListener('click', function () { enterRoom(false); });

    nameInput.addEventListener('change', function () {
      var v = nameInput.value.trim();
      setName(v);
      if (v) toast('记住了，' + v + '。');
    });
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    });
    drawerName.addEventListener('change', function () {
      var v = drawerName.value.trim();
      setName(v);
      if (v) toast('记住了，' + v + '。');
    });

    soundBtn.addEventListener('click', cycleSound);
    starBtn.addEventListener('click', openStarMap);
    starClose.addEventListener('click', function () { closeStarMap(false); });
    drawerBtn.addEventListener('click', openDrawer);

    $$('[data-close]', letterLayer).forEach(function (el) {
      el.addEventListener('click', function () { closeLetter(false); });
    });
    prevEntry.addEventListener('click', function () { stepLetter(-1); });
    nextEntry.addEventListener('click', function () { stepLetter(1); });

    $$('[data-drawer-close]', drawer).forEach(function (el) {
      el.addEventListener('click', function () { closeDrawer(false); });
    });
    importSave.addEventListener('click', handleImport);
    importExport.addEventListener('click', exportEntries);
    importReset.addEventListener('click', function () {
      if (!window.confirm('回到最初的那 62 篇？你现在导入的内容会被替换。')) return;
      try { localStorage.removeItem(LS.entries); } catch (e) {}
      closeDrawer(true);
      saveEntries(window.SAMPLE_ENTRIES, '最初的那 62 篇，回来了。');
    });
    importFile.addEventListener('change', function () {
      var file = importFile.files && importFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        importText.value = String(reader.result || '');
        toast('读到了。确认后点「收进抽屉」。');
      };
      reader.readAsText(file, 'utf-8');
      importFile.value = '';
    });

    mugBtn.addEventListener('click', function () {
      var lines = ['茶还热着。', '窗外在下雨。', '坐一会儿吧。', '不着急。'];
      toast(lines[Math.floor(Math.random() * lines.length)]);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!letterLayer.hidden) { closeLetter(false); return; }
        if (!starMap.hidden) { closeStarMap(false); return; }
        if (!drawer.hidden) { closeDrawer(false); return; }
      }
      if (!letterLayer.hidden) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); stepLetter(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); stepLetter(1); }
      }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { updateScroll(); }, { passive: true });
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, resetIdle, { passive: true });
    });
    setInterval(updateClock, 30000);
  }

  function initGate() {
    var code = (window.SITE && window.SITE.passcode) || '';
    if (!code) {
      document.documentElement.classList.add('unlocked');
      return;
    }
    var saved = '';
    try { saved = localStorage.getItem(LS.pass) || ''; } catch (e) {}
    if (saved === code) {
      document.documentElement.classList.add('unlocked');
      return;
    }

    var gateEl = $('#gate');
    var input = $('#gateInput');
    var err = $('#gateErr');
    var form = $('#gateForm');
    if (!gateEl || !input || !form) return;
    document.documentElement.classList.remove('unlocked');

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = input.value.trim();
      if (v === code) {
        try { localStorage.setItem(LS.pass, code); } catch (e) {}
        err.textContent = '';
        input.blur();
        document.documentElement.classList.add('unlocked');
      } else {
        gateEl.classList.remove('is-wrong');
        void gateEl.offsetWidth;
        gateEl.classList.add('is-wrong');
        err.textContent = v ? '不对。再想想。' : '要先写下口令。';
        input.value = '';
        input.focus();
      }
    });

    setTimeout(function () { input.focus(); }, 520);
  }

  function init() {
    initGate();
    updateGreeting();
    updateClock();
    buildDust();
    initCursorGlow();
    bindEvents();
    updateSoundUI();
    renderFrontMatter();
    renderJourney();
    renderFuture();

    var returning = document.documentElement.classList.contains('returning');
    if (returning) {
      enterRoom(true);
      if (!sessionStorage.getItem('liudeng.welcome')) {
        try { sessionStorage.setItem('liudeng.welcome', '1'); } catch (e) {}
        setTimeout(function () { toast('灯一直为你留着。'); }, 1300);
      }
    } else {
      document.body.classList.add('is-locked');
    }
    updateScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
