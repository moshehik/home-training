/* app.js - the room. One stage (1920x1080, scaled to the window); every screen is a corner of the same room.
 * Routes (hash):  #/  home   #/lessons   #/lesson/N   #/ex/N/I   #/ex/N/I/note   #/ex/N/I/muscles   #/ex/N/I/go
 * Reads window.HT_DATA (shared/data.js, written by src/build.js).
 */
(function () {
  'use strict';
  var D = window.HT_DATA, LESSONS = D.lessons, A = 'assets/room/';
  var stage = document.getElementById('stage'), NS = 'http://www.w3.org/2000/svg';

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mmss(s) { s = Math.max(0, Math.ceil(s - 1e-6)); return Math.floor(s / 60) + ':' + pad(s % 60); }
  function mins(s) { return 'כ-' + Math.max(1, Math.round(s / 60)) + ' דק׳'; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function px(n) { return Math.round(n) + 'px'; }
  var store = {
    g: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    s: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var points = function () { return +store.g('ht-points') || 0; };
  var isDone = function (id) { return !!store.g('ht-done-' + id); };
  function findLesson(n) { return LESSONS.filter(function (l) { return l.n === +n; })[0]; }
  function findEx(id) { var p = id.split('-'), L = findLesson(+p[0]); return L && { L: L, E: L.exercises[+p[1] - 1] }; }

  /* handwriting reveal: every letter is wiped in, right to left, one after another */
  /* key words of a step (action verbs, directions, tempo, breath, the body part to work with): shown bold while the rest fades,
   * when a long step goes by too fast to be read whole */
  var KW_STOP = /^(בלי|אחרי|שלי|אלי|כמו|אפילו|כאילו)$/, KW_WORD = /^(ימין|שמאל|ימינה|שמאלה|למעלה|למטה|לאט|מהר|קדימה|אחורה|הצידה|ישר|חזק|שנייה|שלוש|בספירה|בשאיפה|בנשיפה|שאיפה|נשיפה|מזרן|אגן|בטן|ברך|ברכיים|עקבים|רגל|רגליים|יד|ידיים|ראש|כתפיים|גב|מרפק|ירך|בקבוק|בקבוקים|כיסא|קיר)$/;
  function isKey(w) {
    var c = w.replace(/[^א-ת]/g, '');
    if (c.length < 2 || KW_STOP.test(c)) return false;
    var b = c.replace(/^ו(?=.{3})/, '');
    return (b.length >= 4 && /י$/.test(b)) || KW_WORD.test(b) || KW_WORD.test(b.replace(/^[הלמ](?=.{3})/, ''));
  }
  function write(text, gap, delay, emph) {
    var i = 0;
    var html = String(text).split(/(\s+)/).map(function (w) {
      if (/^\s+$/.test(w)) { i += 1; return ' '; }
      return '<span class="ww' + (emph ? (isKey(w) ? ' kw' : ' dim') : '') + '">' + Array.from(w).map(function (c) { return '<span class="wl" style="--i:' + (i++) + '">' + esc(c) + '</span>'; }).join('') + '</span>';
    }).join('');
    return '<span style="--gap:' + (gap || 75) + 'ms;--d:' + (delay || 0) + 's">' + html + '</span>';
  }
  function fitFont(len, max, width, k) { return Math.min(max, Math.round(width / (Math.max(len, 4) * (k || 0.36)))); }

  /* ---------- stage scaling ---------- */
  /* the room continues past the 1920x1080 stage: its edge pixels are stretched outward, so there are no margins in any window shape */
  var extW = document.createElement('div'), ext = document.createElement('div');
  extW.id = 'extw'; ext.id = 'ext'; extW.appendChild(ext); stage.parentNode.insertBefore(extW, stage);
  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = extW.style.transform = 'translate(' + (innerWidth - 1920 * s) / 2 + 'px,' + (innerHeight - 1080 * s) / 2 + 'px) scale(' + s + ')';
    var r = $('#rotate');
    if (r) r.hidden = !(innerHeight > innerWidth * 1.1 && !store.g('ht-rot'));
  }
  addEventListener('resize', fit); fit();
  $('#rotateOk').addEventListener('click', function () { store.s('ht-rot', '1'); $('#rotate').hidden = true; });

  /* ---------- toolbar ---------- */
  var bar = document.createElement('div');
  bar.id = 'bar';
  var ic = function (d) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  var ICONS = {
    back: ic('<path d="M4 12h16"/><path d="M14 6l6 6-6 6"/>'),
    home: ic('<path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    lessons: ic('<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3.5 9v6"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/>'),
    last: ic('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7.5V12l3 2"/>'),
    gloss: ic('<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/><path d="M9.5 8.5h5"/>'),
    star: '<svg class="ic star" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2 6.6 20.1l1-6.1L3.2 9.7l6.1-.9z"/></svg>'
  };
  bar.innerHTML = '<button type="button" data-a="back">' + ICONS.back + 'חזרה</button><button type="button" data-a="home">' + ICONS.home + 'ראשי</button><button type="button" data-a="lessons">' + ICONS.lessons + 'תרגילים</button><button type="button" data-a="last">' + ICONS.last + 'התרגיל האחרון</button><button type="button" data-a="gloss">' + ICONS.gloss + 'מושגים</button><span class="sep"></span><span class="pts">' + ICONS.star + '<span><b id="ptsN">0</b> נקודות</span></span>';
  stage.appendChild(bar);
  var cur = null;
  function updateBar(pop) {
    $('#ptsN', bar).textContent = points();
    var l = store.g('ht-last');
    $('[data-a=last]', bar).disabled = !(l && findEx(l));
    $('[data-a=back]', bar).disabled = !cur || !cur.parent;
    if (pop) { var p = $('.pts', bar); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    var a = b.dataset.a;
    if (a === 'back') { if (cur.onBack && cur.onBack()) return; if (cur.parent) location.hash = cur.parent; }
    else if (a === 'home') location.hash = '#/';
    else if (a === 'lessons') location.hash = '#/lessons';
    else if (a === 'gloss') HTGlossary.open();
    else if (a === 'last') { var l = findEx(store.g('ht-last')); if (l) location.hash = '#/ex/' + l.L.n + '/' + l.E.i; }
  });

  /* ---------- screen plumbing ---------- */
  function scr() { var d = document.createElement('div'); d.className = 'scr'; return d; }
  var loops = [];
  function loop(fn) { var o = { on: true }; function f(t) { if (!o.on) return; fn(t); requestAnimationFrame(f); } requestAnimationFrame(f); loops.push(o); return o; }
  function show(s) {
    if (cur) { cur.destroy && cur.destroy(); var old = cur.el; old.classList.add('out'); setTimeout(function () { old.remove(); }, 260); }
    loops.forEach(function (o) { o.on = false; }); loops = [];
    cur = s; stage.insertBefore(s.el, bar); updateBar();
    var bg = $('.bg', s.el); if (bg && bg.style.backgroundImage) { ext.style.borderImageSource = bg.dataset.ext ? 'url(' + A + bg.dataset.ext + ')' : bg.style.backgroundImage; ext.style.borderImageSlice = bg.dataset.ext ? '1 fill' : ''; }
    s.start && s.start();
  }
  var rect = function (cls, img, x, y, w, h, extra) { return '<div class="img ' + (cls || '') + '" style="left:' + px(x) + ';top:' + px(y) + ';width:' + px(w) + ';height:' + px(h) + ';background-image:url(' + A + img + ');' + (extra || '') + '"></div>'; };
  var logoLink = '<a class="logo-link" href="#/" aria-label="לדף הבית"></a>';
  function mountDoll(parent, scene, left, top, s) {
    var d = document.createElement('div'); d.className = 'doll';
    d.style.cssText = 'left:' + px(left) + ';top:' + px(top) + ';width:' + px(400 * s) + ';height:' + px(266 * s);
    var svg = document.createElementNS(NS, 'svg'); d.appendChild(svg); parent.appendChild(d);
    return HTDoll.create(svg, scene);
  }
  /* looping demonstration of the exercise */
  function demo(fig, E, t, slow) {
    if (E.hold > 0) {
      var k = slow ? 2 : 1, x = t % (7 * k), a = 2 * k, b = 5 * k;
      return fig.atHold(x < a ? x / a : x < b ? 1 : 1 - (x - b) / a, x >= a && x < b ? Math.sin(t * 2.2 / k) * 0.8 : 0);
    }
    var cyc = E.beats * 60 / E.bpm;
    /* slow = the explanation on the "how to" screen: reading pace (about 2.6s per pose), not the exercise tempo */
    return fig.atPhase(t / (slow ? Math.max(cyc * 2.5, fig.count * 2.6) : cyc));
  }
  function setChip(chip, r) {
    if (!chip) return;
    var key = (r.cap || '') + '|' + (r.br || '');
    if (chip._k === key) return; chip._k = key;
    chip.innerHTML = (r.cap ? '<span>' + esc(r.cap) + '</span>' : '') + (r.br ? '<span class="br ' + r.br + '" data-gl="breath" title="מה זה שאיפה ונשיפה?">' + (r.br === 'in' ? 'שאיפה' : 'נשיפה') + '</span>' : '');
  }

  /* ================= HOME ================= */
  /* Intro (once per visit): the wall is empty -> the logo is written in with a glint -> shrinks to the top right ->
   * the welcome is painted onto the wall -> "מי אני?" is painted in another colour. A click skips to the end. */
  var introPlayed = false;
  var ease = { io: function (k) { return 0.5 - Math.cos(Math.PI * k) / 2; }, cubic: function (k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; } };
  /* wall brightness under each box (home.jpg sampled coarsely) -> light ink on a dark wall, dark ink on a light wall */
  function wallLum(boxes, cb, img) {
    var im = new Image();
    function fallback() { cb(boxes.map(function () { return 0.7; })); }
    im.onload = function () {
      try {
        var c = document.createElement('canvas'), g; c.width = 96; c.height = 54; g = c.getContext('2d'); g.drawImage(im, 0, 0, 96, 54);
        cb(boxes.map(function (b) {
          var d = g.getImageData(b[0] / 20 | 0, b[1] / 20 | 0, Math.max(1, b[2] / 20 | 0), Math.max(1, b[3] / 20 | 0)).data, s = 0;
          for (var i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          return s / (d.length / 4) / 255;
        }));
      } catch (e) { fallback(); }
    };
    im.onerror = fallback;
    im.src = A + (img || 'home.jpg');
  }
  /* split every .tx into one .ln per rendered line, so each line can be painted from right to left */
  function layoutLines(box) {
    $$('.tx', box).forEach(function (t) {
      t.dataset.t = t.dataset.t || t.textContent.trim();
      t.innerHTML = t.dataset.t.split(/\s+/).map(function (w) { return '<span class="w">' + esc(w) + '</span>'; }).join(' ');
      var lines = [], last = null;
      $$('.w', t).forEach(function (s) { if (last === null || Math.abs(s.offsetTop - last) > 6) { lines.push([]); last = s.offsetTop; } lines[lines.length - 1].push(s.textContent); });
      t.innerHTML = lines.map(function (l) { return '<span class="ln" style="--w:-9" data-t="' + esc(l.join(' ')) + '">' + esc(l.join(' ')) + '</span>'; }).join('');
    });
  }

  /* the plaster-paint filter the wall texts use (home + the workout picker) */
  var PAINT_SVG = '<svg width="0" height="0" style="position:absolute"><filter id="paint" x="-3%" y="-8%" width="106%" height="116%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.8 1.3" result="a"/><feComposite in="d" in2="a" operator="in"/></filter></svg>';
  /* a promise-based tween; isDead()/isSkipped() let the owning screen stop it or fast-forward to the end */
  function mkTween(isDead, isSkipped) {
    return function (ms, fn, ez) {
      return new Promise(function (res) {
        var t0 = null;
        (function f(t) {
          if (isDead()) return;
          if (t0 === null) t0 = t;
          var k = isSkipped() ? 1 : Math.min(1, (t - t0) / ms);
          fn(ez ? ez(k) : k);
          if (k < 1) requestAnimationFrame(f); else res();
        })(performance.now());
      });
    };
  }
  /* paint every .ln of a box onto the wall, one line after another, right to left */
  function paintLines(box, tween) {
    var chain = Promise.resolve();
    $$('.ln', box).forEach(function (ln) {
      chain = chain.then(function () {
        return tween(Math.max(450, ln.offsetWidth / 0.55), function (k) { var w = -9 + k * 112; ln.style.setProperty('--w', w); ln.style.setProperty('--g', k < 1 ? w - 7 : -40); }, ease.io);
      }).then(function () { return tween(110, function () {}); });
    });
    return chain;
  }
  /* the pendant lamp (lit by adding .lamp-on to the screen) */
  function lampHtml(x, y) { return '<div class="lampglow" style="left:' + (x - 167) + 'px;top:' + (y - 104) + 'px"></div>' + rect('soft', 'home-lamp.png', x, y, 184, 180); }
  /* armchair + plant at the right side (the armchair nudged 18px further right than on the home page) */
  var sideFurniture = '<div class="fshadow" style="left:1420px;top:989px;width:175px;height:26px"></div><div class="fshadow" style="left:1608px;top:1020px;width:330px;height:36px"></div>' + rect('soft', 'home-plant.png', 1404, 693, 207, 312) + rect('soft', 'home-chair.png', 1594, 629, 319, 414);

  /* the same pair, smaller and lower so the second row of switches (down to y~692) never touches them */
  var sideFurnitureLow = '<div class="fshadow" style="left:1484px;top:989px;width:140px;height:22px"></div><div class="fshadow" style="left:1662px;top:1020px;width:264px;height:32px"></div>' + rect('soft', 'home-plant.png', 1468, 755, 166, 250) + rect('soft', 'home-chair.png', 1658, 712, 255, 331);

  /* The three sport figures: loose parts cut from the element sheet (scripts/make-athletes.js), each figure keeps
   * performing its own move in place (run / toss-and-catch / dribble). Part boxes are in sheet pixels: [x, y, w, h, pivot x, pivot y]. */
  var ATH = {
    thrower: { parts: { thigh: [132, 847, 71, 77, 50, 20], leg: [105, 869, 128, 152, 80, 20], hand: [250, 808, 75, 76, 10, 40], head: [231, 738, 57, 54, 28, 50], arm: [160, 701, 62, 96, 50, 88] }, ball: [217, 693, 40, 40] },
    runner: { parts: { armB: [330, 725, 112, 113, 100, 60], body: [248, 845, 205, 176, 100, 30], head: [454, 737, 65, 68, 30, 60], armF: [474, 791, 113, 97, 20, 20] } },
    bender: { parts: { body: [544, 851, 162, 190, 36, 150], head: [610, 794, 55, 55, 27, 50] }, ball: [695, 828, 52, 52] }
  };
  var ATH_X = 108, ATH_Y = 1037, ATH_K = 1.2, ATH_AT = [14, 1035];   /* sheet origin (bottom-left of the group), scale, and where it stands in the room */
  function athletesHtml() {
    function part(f, name, b) { return '<img class="ap ' + f + '-' + name + '" alt="" src="' + A + 'ath/' + f + '-' + name + '.png" style="left:' + (b[0] - ATH_X) + 'px;top:' + (b[1] - ATH_Y) + 'px;width:' + b[2] + 'px;height:' + b[3] + 'px' + (b[4] != null ? ';transform-origin:' + b[4] + 'px ' + b[5] + 'px' : '') + '">'; }
    var h = '<div class="aths" style="left:' + ATH_AT[0] + 'px;top:' + ATH_AT[1] + 'px;transform:scale(' + ATH_K + ')">';
    Object.keys(ATH).forEach(function (f, i) {
      var F = ATH[f], inner = '';
      Object.keys(F.parts).forEach(function (n) { inner += part(f, n, F.parts[n]); });
      h += '<div class="af ' + f + '" style="--i:' + i + '"><div class="ab">' + inner + '</div>' + (F.ball ? part(f, 'ball', [F.ball[0], F.ball[1], F.ball[2], F.ball[3], F.ball[2] / 2, F.ball[3]]) : '') + '</div>';
    });
    return h + '</div>';
  }

  function homeScreen() {
    var el = scr(), dead = false, skipped = false, done = false;
    var LW = 920, LH = 372, LX = 500, LY = 150, SC = 0.45, FX = 1920 - 60 - LW * SC, FY = 28;   /* logo: intro box -> final top-right box */
    var B1 = [200, 245, 1520, 190], B2 = [300, 465, 1280, 135], GAP = 85;                                       /* where the two texts are painted */
    el.innerHTML = '<div class="bg" data-ext="home-ext.png" style="background-image:url(' + A + 'home.jpg)"></div>' + rect('', 'home-patch.png', 872, 118, 919, 403) + rect('', 'home-lamp-patch.png', 380, 0, 311, 296) + rect('', 'home-furn-patch.png', 1215, 560, 631, 491) + rect('soft', 'home-lamp.png', 190, 0, 184, 180) + '<div class="fshadow" style="left:1372px;top:988px;width:190px;height:26px"></div><div class="fshadow" style="left:1618px;top:1022px;width:300px;height:36px"></div>' + rect('soft', 'home-plant.png', 1355, 681, 215, 324) + rect('soft', 'home-chair.png', 1608, 648, 305, 395) + rect('', 'ath-patch.png', 25, 529, 968, 529) + '<div class="lampglow" style="left:23px"></div>' + athletesHtml() +
      PAINT_SVG +
      '<div class="hlogo" id="hlogo"><div class="hl-ink"></div><div class="hl-glint"></div></div>' +
      '<div class="paint" id="p1" style="left:' + B1[0] + 'px;top:' + B1[1] + 'px;width:' + B1[2] + 'px;font-size:60px;line-height:.9"><p class="tx">' + esc(D.home.lead) + '</p></div>' +
      '<div class="paint" id="p2" style="left:' + B2[0] + 'px;top:' + B2[1] + 'px;width:' + B2[2] + 'px;line-height:.9"><p class="tx" style="font-size:72px">מי אני?</p><p class="tx" style="font-size:42px;line-height:.95;margin-top:26px">' + esc(D.home.bio) + '</p></div>' +
      '<button type="button" class="hgo" id="start" style="left:975px;top:850px"><span class="in-row"><span>בואי נתחיל</span><svg viewBox="0 0 40 16" aria-hidden="true"><path d="M39 8H3M10 1.5 3 8l7 6.5"/></svg></span></button>';
    var logo = $('#hlogo', el), p1 = $('#p1', el), p2 = $('#p2', el), btn = $('#start', el);
    logo.style.cssText = 'left:' + LX + 'px;top:' + LY + 'px;width:' + LW + 'px;height:' + LH + 'px';
    function place(k) { logo.style.transform = 'translate(' + (FX - LX) * k + 'px,' + (FY - LY) * k + 'px) scale(' + (1 - (1 - SC) * k) + ')'; }

    var tween = mkTween(function () { return dead; }, function () { return skipped; });
    /* once the writing is on the wall, every letter reacts when the pointer passes over it */
    function liveLetters() {
      if (el.classList.contains('letters-on')) return;
      $$('.ln', el).forEach(function (ln) {
        ln.innerHTML = (ln.dataset.t.match(/[^\s][֑-ׇ]*|\s/g) || []).map(function (c) { return /\s/.test(c) ? ' ' : '<span class="lt">' + esc(c) + '</span>'; }).join('');
      });
      el.classList.add('letters-on');
    }
    el.addEventListener('mouseover', function (e) {
      var t = e.target;
      if (!t.classList || !t.classList.contains('lt') || t.classList.contains('hop')) return;
      t.style.setProperty('--r', (Math.random() * 24 - 12).toFixed(1) + 'deg');
      t.classList.add('hop');
      setTimeout(function () { t.classList.remove('hop'); }, 700);
    });
    /* the logo: a sign that swings from its top corner while a glint sweeps across it */
    var logoBusy = false;
    logo.addEventListener('mouseenter', function () {
      if (!done || logoBusy || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      logoBusy = true; logo.classList.add('wow');
      var t0 = null;
      (function f(t) {
        if (dead) return;
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / 1100);
        logo.style.setProperty('--s', -20 + 150 * ease.io(k));
        if (k < 1) requestAnimationFrame(f); else logo.style.setProperty('--s', -40);
      })(performance.now());
      setTimeout(function () { logo.classList.remove('wow'); logoBusy = false; }, 1400);
    });
    /* a slow glint keeps passing over the logo once it is in place */
    var glinting = false;
    function glintLoop() {
      if (glinting || dead) return; glinting = true;
      (function pass() {
        var t0 = null;
        (function f(t) {
          if (dead) return;
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / 3200);
          logo.style.setProperty('--s', -12 + 124 * ease.io(k));
          if (k < 1) requestAnimationFrame(f); else { logo.style.setProperty('--s', -40); setTimeout(pass, 2600); }
        })(performance.now());
      })();
    }
    function finish() {
      done = true; setTimeout(glintLoop, 1200); logo.style.setProperty('--p', 120); logo.style.setProperty('--s', -40); place(1);
      $$('.ln', el).forEach(function (ln) { ln.style.setProperty('--w', 112); });
      btn.classList.add('in'); el.classList.add('aths-on', 'lamp-on'); liveLetters();
    }
    function intro() {
      introPlayed = true;
      tween(650, function () {})
        .then(function () { return tween(2300, function (k) { var p = -14 + 114 * k; logo.style.setProperty('--p', p); logo.style.setProperty('--s', p - 6); }, ease.io); })
        .then(function () { return Promise.all([tween(1900, function (k) { logo.style.setProperty('--s', 94 + 34 * k); }, ease.io), tween(1150, place, ease.cubic)]); })
        .then(function () { logo.style.setProperty('--s', -40); setTimeout(glintLoop, 1500); return tween(450, function () {}); })
        .then(function () { return paintLines(p1, tween); })
        .then(function () { return tween(550, function () {}); })
        .then(function () { return paintLines(p2, tween); })
        .then(function () { return tween(350, function () {}); })
        .then(function () { if (!dead) { el.classList.add('aths-on', 'lamp-on'); btn.classList.add('in'); done = true; liveLetters(); } });
    }

    el.addEventListener('click', function (e) {
      if (e.target.closest('#start')) { location.hash = '#/lessons'; return; }
      if (!done && !skipped) { skipped = true; setTimeout(finish, 80); }
    });
    return {
      el: el, parent: null, destroy: function () { dead = true; },
      start: function () {
        var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('50px "OH Noa Price"', 'אבגד'), document.fonts.load('50px "OH Noa Price"', '8,.!?')]).then(function () { return document.fonts.ready; }).catch(function () {}) : Promise.resolve();
        fonts.then(function () {
          if (dead) return;
          layoutLines(el);
          var y2 = p1.offsetTop + p1.offsetHeight + GAP;
          p2.style.top = y2 + 'px';
          wallLum([B1, B2], function (l) {
            p1.style.setProperty('--ink', l[0] < 0.45 ? '#fff3ec' : '#4a3b3a');
            p2.style.setProperty('--ink', l[1] < 0.45 ? '#ffe7ae' : '#a3304f');
            if (introPlayed || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) finish(); else intro();
          });
        });
      }
    };
  }

  /* ================= ROOM OF SWITCHES (workout picker + a workout's exercises) ================= */
  /* The empty pink room, in the home page's style: a lit pendant lamp, the armchair and plant at the side, the title painted onto
   * the wall, and one metallic wall switch per item (button.png recoloured in 12 palette tones - scripts/make-switches.js).
   * cfg: { key, parent, p1:{text,size}, p2, p3:{head,body,size,width}, g:{BW,BH,GX,GY,COLS,X0,Y0,CW}, items:[{href,title,tip,num,sub,led}] } */
  var roomPlayed = {};
  function switchRoom(cfg) {
    var el = scr(), dead = false, skipped = false, done = false, g = cfg.g, items = cfg.items, P = cfg.p3;
    var h = '<div class="bg" data-ext="empty-ext.png" style="background-image:url(' + A + 'empty.jpg)"></div>' + lampHtml(215, 0) + (cfg.low ? sideFurnitureLow : sideFurniture) + PAINT_SVG + logoLink +
      '<div class="paint" id="p1" style="left:' + g.X0 + 'px;top:120px;width:' + g.CW + 'px;font-size:' + cfg.p1.size + 'px;line-height:.9"><p class="tx">' + esc(cfg.p1.text) + '</p></div>' +
      '<div class="paint" id="p2" style="left:' + g.X0 + 'px;top:240px;width:' + g.CW + 'px;line-height:.9"><p class="tx" style="font-size:40px">' + esc(cfg.p2) + '</p></div>';
    var rows = Math.ceil(items.length / g.COLS);
    items.forEach(function (it, idx) {
      var row = Math.floor(idx / g.COLS), col = idx % g.COLS, n = row === rows - 1 ? items.length - row * g.COLS : g.COLS;
      var x = (g.BX0 != null ? g.BX0 : g.X0) + ((row === rows - 1 && n < g.COLS && g.LCW ? g.LCW : (g.BCW || g.CW)) - (n * g.GX - (g.GX - g.BW))) / 2 + (n - 1 - col) * g.GX, y = g.Y0 + row * g.GY;   /* RTL: first switch on the right */
      var sk = g.BW / 316, tw = g.BW * 0.62;
      h += '<button type="button" class="sw" data-href="' + it.href + '" aria-label="' + esc(it.tip) + '" style="left:' + px(x) + ';top:' + px(y) + ';width:' + g.BW + 'px;height:' + g.BH + 'px;background-image:url(' + A + 'sw-' + (idx % 12) + '.png);--d:' + (idx * 0.09).toFixed(2) + 's">' +
        '<span class="sw-tip" aria-hidden="true">' + esc(it.tip) + '</span><span class="sw-body"><span class="sw-knob"><span class="sw-num">' + it.num + '</span><span class="sw-led' + (it.led ? ' ' + it.led : '') + '"></span></span><span class="sw-txt"><span class="sw-nm" style="font-size:' + fitFont(it.title.length, Math.round(26 * sk), tw, 0.5) + 'px">' + esc(it.title) + '</span>' +
        '<span class="sw-sub" style="font-size:' + fitFont(it.sub.length, Math.round(19 * sk), tw, 0.46) + 'px">' + esc(it.sub) + '</span></span></span></button>';
    });
    h += '<div class="paint" id="p3" style="left:20px;top:' + (P.top || 700) + 'px;width:' + (P.width || 1300) + 'px;padding-top:30px;line-height:.95"><p class="tx" style="font-size:' + (P.headSize || 46) + 'px;line-height:1">' + esc(P.head) + '</p><p class="tx" style="font-size:' + P.size + 'px;margin-top:6px;text-wrap:balance">' + esc(P.body) + '</p></div>';
    el.innerHTML = h;
    var p1 = $('#p1', el), p2 = $('#p2', el), p3 = $('#p3', el), tween = mkTween(function () { return dead; }, function () { return skipped; });
    function finish() { done = true; roomPlayed[cfg.key] = true; $$('.ln', el).forEach(function (ln) { ln.style.setProperty('--w', 112); ln.style.setProperty('--g', -40); }); el.classList.add('lamp-on', 'sw-on', 'sw-quick'); }
    function fitTip(e) {   /* keep the tooltip inside the 1920px stage (it wraps to two lines when long) */
      var b = e.target.closest && e.target.closest('.sw'), t = b && b.querySelector('.sw-tip');
      if (!t) return;
      var w = t.offsetWidth, cx = parseFloat(b.style.left) + b.offsetWidth / 2, x = Math.min(Math.max(cx - w / 2, 16), 1920 - 16 - w);
      t.style.setProperty('--sx', (x - (cx - w / 2)) + 'px');
    }
    el.addEventListener('mouseover', fitTip); el.addEventListener('focusin', fitTip);
    el.addEventListener('click', function (e) {
      var m = e.target.closest('.sw');
      if (m && done) { location.hash = m.dataset.href; return; }
      if (!done && !skipped) { skipped = true; setTimeout(finish, 80); }
    });
    return {
      el: el, parent: cfg.parent, destroy: function () { dead = true; },
      start: function () {
        var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('50px "OH Noa Price"', 'אבגד'), document.fonts.load('50px "OH Noa Price"', '8,.!?')]).then(function () { return document.fonts.ready; }).catch(function () {}) : Promise.resolve();
        fonts.then(function () {
          if (dead) return;
          layoutLines(el);
          p2.style.top = (p1.offsetTop + p1.offsetHeight + 34) + 'px';
          $$('.ln', el).forEach(function (ln) { ln.style.marginInline = 'auto'; });
          wallLum([[g.X0 + 600, 120, 700, 200], [g.X0 + 600, 290, 700, 80], [20, (P.top || 700) + 30, 1300, 200]], function (l) {
            p1.style.setProperty('--ink', l[0] < 0.45 ? '#fff3ec' : '#4a3b3a');
            p2.style.setProperty('--ink', l[1] < 0.45 ? '#ffe7ae' : '#a3304f');
            p3.style.setProperty('--ink', l[2] < 0.45 ? '#fff3ec' : '#7b4a58');
            if (roomPlayed[cfg.key] || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { finish(); return; }
            roomPlayed[cfg.key] = true;
            tween(450, function () {})
              .then(function () { return paintLines(p1, tween); })
              .then(function () { return tween(350, function () {}); })
              .then(function () { return paintLines(p2, tween); })
              .then(function () { return tween(250, function () {}); })
              .then(function () { return paintLines(p3, tween); })
              .then(function () { if (!dead && !done) { el.classList.add('lamp-on'); return tween(1500, function (k) { $$('.ln', p1).forEach(function (ln) { ln.style.setProperty('--g', -9 + k * 121); }); }, ease.io); } })
              .then(function () { $$('.ln', p1).forEach(function (ln) { ln.style.setProperty('--g', -40); }); return tween(250, function () {}); })
              .then(function () { if (!dead && !done) { el.classList.add('sw-on'); done = true; } });
          }, 'empty.jpg');
        });
      }
    };
  }

  /* step 2: choose a workout */
  function lessonsScreen() {
    var total = LESSONS.reduce(function (a, L) { return a + L.exercises.length; }, 0);
    return switchRoom({
      key: 'lessons', parent: '#/',
      p1: { text: 'בחרי אימון', size: 115 },
      p2: LESSONS.length + ' אימונים · ' + total + ' תרגילים · לכל אימון ציוד אחר מהבית',
      p3: { head: 'לפני שאת מתחילה:', body: D.home.safety, size: 38, top: 790 },
      g: LESSONS.length > 12 ? { BW: 372, BH: 133, GX: 376, GY: 137, COLS: 5, X0: 10, Y0: 340, CW: 1900, BX0: 20, BCW: 1872, LCW: 1680 }   /* 13+ switches: 5 per row across the room; the two full rows end above the armchair (y<629), the short last row is centred in LCW so it stays left of the plant */
        : { BW: 388, BH: 139, GX: 392, GY: 142, COLS: 4, X0: 10, Y0: 340, CW: 1900, BX0: 20, BCW: 1544 },   /* 12 switches as 4+4+4, kept left of the plant and armchair */
      items: LESSONS.map(function (L) {
        var dn = L.exercises.filter(function (e) { return isDone(e.id); }).length, full = dn === L.exercises.length;
        return { href: '#/lesson/' + L.n, title: L.title, sub: L.eqName + ' · ' + L.exercises.length + ' תרגילים', num: L.n, led: full ? 'full' : dn ? 'part' : '',
          tip: mins(L.sec) + ' · ' + L.level + (dn ? ' · בוצעו ' + dn + '/' + L.exercises.length : '') };
      })
    });
  }

  /* step 3: a workout's exercises - the same room, slightly larger switches */
  function prepSize(len, w, h) {   /* largest handwriting size (<=64px) whose wrapped lines still fit the wall strip: ~.7em per char, .95 line height */
    for (var s = 64; s > 30; s -= 2) if (Math.ceil(len * 0.7 * s / w) * s * 0.95 <= h) return s;
    return 30;
  }
  function lessonScreen(L) {
    var pl = L.prep.length, n = L.exercises.length;
    var cols = Math.max(3, Math.min(5, Math.ceil(n / 2)));   /* two balanced rows, as wide as the room allows */
    var bw = Math.min(430, Math.floor(1890 / cols) - 4), bh = Math.round(bw * 0.358), gx = bw + 4, gy = bh + 9;
    return switchRoom({
      key: 'lesson', parent: '#/lessons',
      p1: { text: L.title, size: fitFont(L.title.length, 115, 1500, 0.42) },
      p2: L.eqName + ' · רמה: ' + L.level + ' · ' + mins(L.sec) + (L.tag ? ' · ' + L.tag : ''),
      p3: { head: 'מה להכין:', headSize: 68, body: L.prep, size: prepSize(pl, 1340, 250), width: 1340 },
      g: { BW: bw, BH: bh, GX: gx, GY: gy, COLS: cols, X0: 10, Y0: 375, CW: 1900 }, low: true,
      items: L.exercises.map(function (E) {
        return { href: '#/ex/' + L.n + '/' + E.i, title: E.name, sub: E.dose + ' · ' + mmss(E.sec), num: E.i, led: isDone(E.id) ? 'full' : '',
          tip: E.level + (E.balance ? ' · שיווי משקל' : '') + (isDone(E.id) ? ' · בוצע' : '') };
      })
    });
  }

  /* ================= HOW TO (room, rug, doll, instructions) ================= */
  function howScreen(L, E) {
    var el = scr(), step = -1;
    /* one box per instruction; `rng` = the part of one repetition (0..1) the doll demonstrates while that box is up (the opening
     * pose is a still, a step plays its share of the cycle back and forth). Boxes without `rng` play the whole exercise. */
    var ns = E.steps.length, pm = E.scene.poses.length;
    /* what the doll does for a step: rest (opening pose) / go (to the effort pose) / top (stay there) / back (return). Read from how the sentence starts. */
    function stepKind(t, k) {
      t = t.replace(/^ב(שאיפה|נשיפה)[, ]*/, '');
      if (/^(עצרי|החזיקי|הישארי|שמרי)|לפי הטיימר/.test(t)) return 'top';
      if (/^(הורידי|שחררי|חזרי|החזירי|ירדי|עלי בעדינות|שאפי לאט)|וחזרי|והחזירי/.test(t)) return 'back';
      if (/^(החליפי|סיימי|כל החזרות)/.test(t) || (k === 0 && ns >= 4 && /^(התחילי|שאפי|עמדי|התכוננ)/.test(t))) return 'rest';
      return 'go';
    }
    function stepRng(t, k) {
      if (pm > 2 && !(E.hold > 0)) return [k * pm / ns, (k + 1) * pm / ns, ''];
      var kd = stepKind(t, k), end = E.hold > 0 ? 0 : 2;
      return kd === 'rest' ? [0, 0, kd] : kd === 'go' ? [0, 1, kd] : kd === 'top' ? [1, 1, kd] : [1, end, kd];
    }
    var ins = [{ t: 'עמדת פתיחה', h: '<p>' + esc(E.start) + '</p>', rng: [0, 0] }]
      .concat(E.steps.map(function (st, k) { return { t: 'שלב ' + (k + 1), h: '<p>' + esc(st) + '</p>', rng: stepRng(st, k) }; }))
      .concat([
        { t: 'נשימה', h: '<p>' + esc(E.breath) + '</p>' },
        { t: 'גרסה קלה יותר', h: '<p>' + esc(E.easier) + '</p>', nocap: true },
        { t: 'גרסה קשה יותר', h: '<p>' + esc(E.harder) + '</p>', nocap: true }
      ]);
    /* the home page's room: lit pendant lamp, armchair + plant, the title painted onto the wall, the gold home-page button */
    var fs = fitFont(E.name.length, 115, 1000, 0.42), dead = false, skipped = false, done = false;
    var arrow = '<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M39 8H3M10 1.5 3 8l7 6.5"/></svg>';
    el.innerHTML = '<div class="bg" data-ext="empty-ext.png" style="background-image:url(' + A + 'empty.jpg)"></div>' + lampHtml(215, 0) + sideFurniture + PAINT_SVG + logoLink +
      rect('', 'rug-round.png', 65, 700, 910, 318) +
      '<div class="paint" id="p1" style="left:420px;top:80px;width:1000px;font-size:' + fs + 'px;line-height:.9"><p class="tx">' + esc(E.name) + '</p></div>' +
      '<div class="paint" id="p2" style="left:420px;top:230px;width:1000px;line-height:.9;transition:opacity .4s"><p class="tx" style="font-size:72px">איך לעשות את זה?</p></div>' +
      '<button type="button" class="hbig" id="instrBtn" style="left:820px;top:560px;width:760px"><span class="tx">הוראות</span>' + arrow + '</button>' +
      '<div id="box"></div>';
    var fig, t0 = performance.now(), tStep = t0, p1 = $('#p1', el), p2 = $('#p2', el), btn = $('#instrBtn', el);
    var tween = mkTween(function () { return dead; }, function () { return skipped; });
    var s = { el: el, parent: '#/lesson/' + L.n, destroy: function () { dead = true; } };
    function finish() { done = true; roomPlayed.how = true; $$('.ln', el).forEach(function (ln) { ln.style.setProperty('--w', 112); ln.style.setProperty('--g', -40); }); el.classList.add('lamp-on'); btn.classList.add('in'); }
    s.start = function () {
      fig = mountDoll(el, E.scene, 520 - 200 * 2.6, 857 - 231 * 2.6, 2.6);
      $('.doll', el).style.zIndex = 2;
      loop(function (now) { var r = stepDemo(now); fig.draw(r.pose); });
      var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('50px "OH Noa Price"', 'אבגד'), document.fonts.load('50px "OH Noa Price"', '8,.!?')]).then(function () { return document.fonts.ready; }).catch(function () {}) : Promise.resolve();
      fonts.then(function () {
        if (dead) return;
        layoutLines(el);
        p2.style.top = (p1.offsetTop + p1.offsetHeight + 26) + 'px';
        $$('.ln', el).forEach(function (ln) { ln.style.marginInline = 'auto'; });
        wallLum([[420, 80, 1000, 150], [420, 230, 1000, 90]], function (l) {
          p1.style.setProperty('--ink', l[0] < 0.45 ? '#fff3ec' : '#4a3b3a');
          p2.style.setProperty('--ink', l[1] < 0.45 ? '#ffe7ae' : '#a3304f'); btn.style.setProperty('--ink', l[1] < 0.45 ? '#ffe7ae' : '#a3304f');
          if (roomPlayed.how || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { finish(); return; }
          roomPlayed.how = true;
          tween(450, function () {})
            .then(function () { return paintLines(p1, tween); })
            .then(function () { return tween(450, function () {}); })
            .then(function () { return paintLines(p2, tween); })
            .then(function () { if (!dead && !done) { el.classList.add('lamp-on'); btn.classList.add('in'); done = true; } });
        }, 'empty.jpg');
      });
    };
    /* the doll for the box that is up: the opening pose as a still, a step = its share of the cycle played back and forth with a rest at each end */
    function stepDemo(now) {
      var it = step >= 0 ? ins[step] : null, t = (now - tStep) / 1000;
      if (!it || !it.rng) { var r = demo(fig, E, (now - t0) / 1000, true); return { pose: r.pose, cap: it && it.nocap ? '' : r.cap }; }
      var a = it.rng[0], b = it.rng[1], kind = it.rng[2], x = (t % 6) / 6, k = x < .15 ? 0 : x < .45 ? ease.io((x - .15) / .3) : x < .75 ? 1 : x < .95 ? 1 - ease.io((x - .75) / .2) : 0, u = a + (b - a) * k, r2;
      r2 = E.hold > 0 ? fig.atHold(u, kind === 'top' ? Math.sin(t * 2.2) * 0.8 : 0) : fig.atIdx(u);
      return { pose: r2.pose, cap: '' };
    }
    /* the doll and its props over a whole cycle as [right, top, bottom] boxes (stage px), so the instruction box can keep clear of them */
    var shapes = null;
    function sceneReach(bottom) {
      if (!shapes) {
        var sr = stage.getBoundingClientRect(), k = sr.width / 1920, d = $('.doll', el), n = 8;
        shapes = [];
        for (var j = 0; j <= n; j++) {
          fig.draw((E.hold > 0 ? fig.atHold(j / n, 0) : fig.atPhase(j / n)).pose);
          $$('path,rect,circle,ellipse,polygon', d).forEach(function (e) {
            if (e.closest('defs,filter,mask,clipPath')) return;
            var r = e.getBoundingClientRect();
            if (r.width >= 1) shapes.push([(r.right - sr.left) / k, (r.top - sr.top) / k, (r.bottom - sr.top) / k]);
          });
        }
      }
      return shapes.reduce(function (m, q) { return q[2] > 232 && q[1] < bottom ? Math.max(m, q[0]) : m; }, 0);
    }
    function render() {
      var box = $('#box', el); tStep = performance.now();
      if (step < 0) { box.innerHTML = ''; btn.style.display = ''; p2.style.opacity = 1; return; }
      btn.style.display = 'none'; p2.style.opacity = 0;
      var it = ins[step], last = step === ins.length - 1, dots = ins.map(function (_, k) { return '<i style="width:16px;height:16px;border-radius:50%;display:inline-block;margin-inline-start:10px;background:' + (k === step ? '#d6a01a' : 'rgba(110,80,80,.25)') + '"></i>'; }).join('');
      var go = function (d, label, st, cls, back) { return '<button type="button" class="hgo in ' + (cls || '') + '" data-go="' + d + '" style="position:relative;flex:none;' + (st || '') + '"><span class="in-row">' + (back ? arrow + '<span>' + label + '</span>' : '<span>' + label + '</span>' + arrow) + '</span></button>'; };
      box.innerHTML = '<div class="blob b-pale how-blob" style="left:820px;top:232px;width:760px"><h3>' + it.t + '</h3>' + HTGlossary.mark(it.h) + '</div>' +
        '<div class="abs" id="hbtns" style="left:820px;top:770px;width:760px;display:flex;flex-direction:column;align-items:center;gap:6px">' +
        '<span>' + dots + '</span>' +
        '<div style="display:flex;direction:rtl;gap:24px">' +
        go('prev', 'לשלב הקודם', step > 0 ? '' : 'visibility:hidden', 'prev', true) +
        (last ? go('note', 'שניה לפני שאת מתחילה', 'font-size:25px') : go('next', 'המשיכי')) +
        '</div></div>';
      /* narrow the box from the left wherever the scene reaches into it (the box grows taller when narrower, so measure twice) */
      var bl = $('.how-blob', box);
      for (var pass = 0; pass < 2; pass++) {
        var bx = Math.max(820, Math.min(Math.ceil(sceneReach(232 + bl.offsetHeight) + 30), 980));
        bl.style.left = bx + 'px'; bl.style.width = (1580 - bx) + 'px';
      }
    }
    s.onBack = function () { if (step >= 0) { step--; render(); return true; } return false; };
    el.addEventListener('click', function (e) {
      if (e.target.closest('#instrBtn') && done) { step = 0; render(); return; }
      var b = e.target.closest('[data-go]');
      if (!b) { if (!done && !skipped) { skipped = true; setTimeout(finish, 80); } return; }
      if (b.dataset.go === 'next') { step++; render(); }
      else if (b.dataset.go === 'prev') { step--; render(); }
      else location.hash = '#/ex/' + L.n + '/' + E.i + '/note';
    });
    return s;
  }

  /* ================= A SECOND BEFORE WE START ================= */
  function noteScreen(L, E) {
    var el = scr(), sel = -1, read = {}, dead = false, skipped = false, done = false;
    var notes = [
      { b: 'שימי לב', cls: 'b-purple', t: 'שימי לב:', h: '<ul>' + E.focus.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' },
      { b: 'ממה להיזהר', cls: 'b-orange', t: 'היזהרי מ:', h: '<ul>' + E.avoid.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' },
      { b: 'חשוב לדעת', cls: 'b-rose', t: 'חשוב שתדעי:', h: '<ul><li>' + esc(E.about) + '</li><li>' + esc(E.breath) + '</li></ul>' }
    ];
    var arrow = '<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M39 8H3M10 1.5 3 8l7 6.5"/></svg>';
    var gold = function (attr, label, left, top, st) { return '<button type="button" class="hgo" ' + attr + ' style="left:' + left + 'px;top:' + top + 'px;' + (st || '') + '"><span class="in-row"><span>' + label + '</span>' + (attr.indexOf('data-i') < 0 ? arrow : '') + '</span></button>'; };
    /* the home page's room, with the cream shaggy rug on the floor */
    var h = '<div class="bg" data-ext="empty-ext.png" style="background-image:url(' + A + 'empty.jpg)"></div>' + lampHtml(215, 0) + sideFurniture + PAINT_SVG + logoLink +
      rect('', 'rug-cream.png', 40, 740, 1300, 335) +
      '<div class="paint" id="p1" style="left:420px;top:80px;width:1000px;font-size:115px;line-height:.9"><p class="tx">שניה לפני שאת מתחילה</p></div>' +
      '<div class="paint" id="p2" style="left:420px;top:230px;width:1000px;line-height:.9"><p class="tx" style="font-size:56px">לחצי על כל כפתור וקראי</p></div>';
    notes.forEach(function (n, i) { h += gold('data-i="' + i + '"', n.b, 1075 - i * 360, 340); });
    h += '<div id="nbox"></div>' +
      gold('data-go="go"', 'לתרגיל', 1050, 905) + gold('data-go="muscles"', 'קבלי מוטיבציה', 690, 905);
    el.innerHTML = h;
    var p1 = $('#p1', el), p2 = $('#p2', el), btns = $$('.hgo', el), tween = mkTween(function () { return dead; }, function () { return skipped; });
    function finish() { done = true; roomPlayed.note = true; $$('.ln', el).forEach(function (ln) { ln.style.setProperty('--w', 112); ln.style.setProperty('--g', -40); }); el.classList.add('lamp-on'); btns.forEach(function (b) { b.classList.add('in'); }); }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'), g = e.target.closest('[data-go]');
      if (!done) { if (!skipped) { skipped = true; setTimeout(finish, 80); } return; }
      if (b) {
        sel = +b.dataset.i; read[sel] = true;
        btns.forEach(function (x) { if (x.dataset.i == null) return; var i = +x.dataset.i; x.classList.toggle('on', i === sel); $('span', x).textContent = notes[i].b + (read[i] ? ' ✓' : ''); });
        var n = notes[sel];
        $('#nbox', el).innerHTML = '<div class="blob how-blob ' + n.cls + '" style="left:330px;top:490px;width:1100px"><h3>' + n.t + '</h3>' + HTGlossary.mark(n.h) + '</div>';
      } else if (g) location.hash = '#/ex/' + L.n + '/' + E.i + '/' + g.dataset.go;
    });
    return {
      el: el, parent: '#/ex/' + L.n + '/' + E.i, destroy: function () { dead = true; },
      start: function () {
        var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('50px "OH Noa Price"', 'אבגד'), document.fonts.load('50px "OH Noa Price"', '8,.!?')]).then(function () { return document.fonts.ready; }).catch(function () {}) : Promise.resolve();
        fonts.then(function () {
          if (dead) return;
          layoutLines(el);
          p2.style.top = (p1.offsetTop + p1.offsetHeight + 26) + 'px';
          $$('.ln', el).forEach(function (ln) { ln.style.marginInline = 'auto'; });
          wallLum([[420, 80, 1000, 150], [420, 230, 1000, 90]], function (l) {
            p1.style.setProperty('--ink', l[0] < 0.45 ? '#fff3ec' : '#4a3b3a');
            p2.style.setProperty('--ink', l[1] < 0.45 ? '#ffe7ae' : '#a3304f');
            if (roomPlayed.note || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { finish(); return; }
            roomPlayed.note = true;
            tween(450, function () {})
              .then(function () { return paintLines(p1, tween); })
              .then(function () { return tween(450, function () {}); })
              .then(function () { return paintLines(p2, tween); })
              .then(function () { if (!dead && !done) { el.classList.add('lamp-on'); btns.forEach(function (b) { b.classList.add('in'); }); done = true; } });
          }, 'empty.jpg');
        });
      }
    };
  }

  /* ================= MUSCLES + CALORIES ================= */
  function musclesScreen(L, E) {
    var el = scr(), sel = 0, dead = false, skipped = false, done = false;
    var perMin = Math.round(E.kcal * 600 / E.sec) / 10;
    var slimMirror = E.slim && E.slim.length ? E.slim.slice(0, 2).join(' · ') : 'אין הרזיה: גמישות ושחרור';
    /* the room's wall and lamp, the big wall mirror flush against the right edge, texts painted in Noa Price */
    var h = '<div class="bg" data-ext="empty-ext.png" style="background-image:url(' + A + 'empty.jpg)"></div>' + lampHtml(215, 0) + PAINT_SVG +
      rect('', 'vase.png', 28, 478, 252, 450) +
      rect('', 'rug-cream.png', 60, 962, 1400, 360) + '<div class="mirror-big"></div>' +
      '<div class="paint" id="p1" style="left:376px;top:130px;width:954px;font-size:96px;line-height:.9"><p class="tx">השרירים שאת מפעילה:</p></div>';
    E.mus.forEach(function (m, i) {
      h += '<button type="button" class="hgo mb" data-i="' + i + '" style="left:' + px(1440 - 346 - i * 358) + ';top:250px"><span class="in-row"><span>' + esc(m.name) + '</span></span></button>';
    });
    h += '<div id="dbox"></div>' +
      /* the mirror's texts: one column, spread evenly from the top of the mirror down to the brain, centred */
      '<div class="mtext">' +
      '<div class="paint" id="p2" style="font-size:62px;line-height:.9"><p class="tx">את שורפת כאן</p></div>' +
      '<div class="paint later" style="font-size:60px;line-height:1;white-space:nowrap">כ-<span id="kc">0</span> קלוריות!</div>' +
      '<div class="paint later" style="font-size:38px;line-height:1.05;white-space:nowrap">בערך ' + perMin + ' קלוריות<br>בכל דקת תרגול</div>' +
      '<div class="paint later" style="font-size:44px;line-height:1">החלק שיירזה:</div>' +
      '<div class="paint later" style="font-size:38px;line-height:1.05;width:330px">' + esc(slimMirror) + '</div>' +
      '<div class="kcal-note later">הערכה לאישה במשקל ממוצע</div>' +
      '</div>' +
      '<div class="mglow" id="mglow"></div>' + rect('', 'brain-chair.png', 1573, 789, 281, 291, 'z-index:1') +
      '<div class="muscle" id="muscle"><img src="' + A + 'brain.png" alt=""><span class="sweat"></span></div>' +
      '<button type="button" class="pill gold" id="go" style="left:' + px(1330 - 320) + ';top:856px;width:320px">לתרגיל ←</button>';
    el.innerHTML = h;
    function pick(i) {
      sel = i; var m = E.mus[i];
      $$('.mb', el).forEach(function (b, k) { b.classList.toggle('on', k === i); });
      var body = m.items ? '<div class="dgl">' + m.items.map(function (x) { return '<b>' + esc(x.name) + '</b><span>' + esc(x.desc) + '</span>'; }).join('') + '</div>' : '<p>' + esc(m.desc) + '</p>';
      $('#dbox', el).innerHTML = '<div class="detail" style="left:376px;top:398px;width:954px"><h3>' + esc(m.full || m.name) + '</h3>' + body + '</div>';
      var mu = $('#muscle', el); mu.classList.remove('pump'); void mu.offsetWidth; mu.classList.add('pump');
      var gl = $('#mglow', el); gl.classList.add('on'); clearTimeout(gl._t); gl._t = setTimeout(function () { gl.classList.remove('on'); }, 2200);
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.mb'); if (b) return pick(+b.dataset.i);
      if (e.target.closest('#go')) location.hash = '#/ex/' + L.n + '/' + E.i + '/go';
    });
    var s = { el: el, parent: '#/ex/' + L.n + '/' + E.i + '/note', destroy: function () { dead = true; } };
    var tween = mkTween(function () { return dead; }, function () { return skipped; }), p1 = $('#p1', el), kc = $('#kc', el);
    function finish() {
      if (done) return;
      done = true; roomPlayed.muscles = true;
      $$('.ln', el).forEach(function (ln) { ln.style.setProperty('--w', 112); ln.style.setProperty('--g', -40); });
      el.classList.add('lamp-on', 'shown'); $$('.mb', el).forEach(function (b) { b.classList.add('in'); });
      var t0 = performance.now();
      loop(function (now) { var p = Math.min(1, Math.max(0, (now - t0 - 300) / 1500)); kc.textContent = Math.round(E.kcal * (1 - Math.pow(1 - p, 3))); });
    }
    el.addEventListener('click', function () { if (!done && !skipped) { skipped = true; setTimeout(finish, 80); } });
    s.start = function () {
      var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('50px "OH Noa Price"', 'אבגד'), document.fonts.load('50px "OH Noa Price"', '8,.!?')]).then(function () { return document.fonts.ready; }).catch(function () {}) : Promise.resolve();
      fonts.then(function () {
        if (dead) return;
        layoutLines(el);
        wallLum([[376, 66, 954, 150]], function (l) {
          p1.style.setProperty('--ink', l[0] < 0.45 ? '#fff3ec' : '#4a3b3a');
          if (roomPlayed.muscles || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { finish(); return; }
          roomPlayed.muscles = true;
          tween(300, function () {})
            .then(function () { return paintLines(p1, tween); })
            .then(function () { return paintLines($('#p2', el), tween); })
            .then(function () { if (!dead) finish(); });
        }, 'empty.jpg');
      });
    };
    return s;
  }

  /* ================= LET'S GO (timer, music, doll) ================= */
  var SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  var SEGL = { a: [8, 6, 36, 6], b: [40, 10, 40, 46], c: [40, 54, 40, 90], d: [8, 94, 36, 94], e: [4, 54, 4, 90], f: [4, 10, 4, 46], g: [8, 50, 36, 50] };
  function sevenSeg(str) {
    var x = 0, out = '';
    Array.from(str).forEach(function (ch) {
      if (ch === ':') { out += '<circle cx="' + (x + 8) + '" cy="32" r="4.5" fill="#2a2a2a"/><circle cx="' + (x + 8) + '" cy="68" r="4.5" fill="#2a2a2a"/>'; x += 22; return; }
      var on = SEG[ch];
      'abcdefg'.split('').forEach(function (k) { var l = SEGL[k]; out += '<line x1="' + (x + l[0]) + '" y1="' + l[1] + '" x2="' + (x + l[2]) + '" y2="' + l[3] + '" stroke="#2a2a2a" stroke-width="6" stroke-linecap="round" opacity="' + (on.indexOf(k) >= 0 ? 1 : 0.07) + '"/>'; });
      x += 54;
    });
    var w = x - 10; return '<svg viewBox="0 0 ' + w + ' 100" preserveAspectRatio="xMidYMid meet" style="direction:ltr">' + out + '</svg>';
  }

  function goScreen(L, E) {
    var el = scr(), scene = E.scene;
    HTMusic.theme(L.n);   /* each lesson has its own music */
    store.s('ht-last', E.id); updateBar();
    var next = L.exercises[E.i];
    /* the home page's room: lit pendant lamp, armchair + plant, the title and the instructions painted onto the wall in Noa Price */
    var dead = false, skipped = false, done = false;
    el.innerHTML = '<div class="bg" data-ext="empty-ext.png" style="background-image:url(' + A + 'empty.jpg)"></div>' + lampHtml(215, 0) + sideFurniture + PAINT_SVG + logoLink +
      rect('', 'rug-jute.png', 640, 830, 520, 110) +
      '<div class="paint" id="p1" style="left:420px;top:80px;width:1000px;font-size:115px;line-height:.9"><p class="tx">התחילי!!!</p></div>' +
      '<div class="wallbox" id="wallbox"><div class="wall paint" id="wall"></div><div class="paint breath" id="breath" data-gl="breath" title="מה זה שאיפה ונשיפה?"></div></div>' +
      '<button type="button" class="hot" id="spk" aria-label="מוזיקה" style="left:40px;top:640px;width:230px;height:258px;background:url(' + A + 'speaker.png) 0 0/100% 100% no-repeat"></button>' +
      '<div class="tip l" id="spkTip" style="left:280px;top:700px;width:130px">לחצי כאן להפעלת מוזיקה</div>' +
      '<div class="clock" id="clock" role="button" aria-label="טיימר"><div class="face"></div><div id="digits"></div><div class="cl" id="cl">' + E.dose + '</div></div>' +
      '<div class="tip u" id="clkTip" style="left:1490px;top:420px;width:370px">לחצי על השעון להפעלת הטיימר</div>' +
      '<div class="status" style="top:335px"><div class="chip stat" id="stat"></div><div style="display:flex;gap:8px"><button type="button" class="hgo in sm" id="pz" style="display:none"><span class="in-row"><span>עצרי</span></span></button><button type="button" class="hgo in sm" id="skip"><span class="in-row"><span>דלגי</span></span></button><button type="button" class="hgo in sm" id="reset"><span class="in-row"><span>מההתחלה</span></span></button></div></div>' +
      '<button type="button" class="hgo in" id="tohow" data-nav="#/ex/' + L.n + '/' + E.i + '" style="left:795px;top:955px;width:330px"><span class="in-row"><span>חזרה להוראות</span><svg viewBox="0 0 40 16" aria-hidden="true"><path d="M39 8H3M10 1.5 3 8l7 6.5"/></svg></span></button>' +
      '<div class="go-acts" id="acts" style="left:420px;top:915px;width:1000px;justify-content:center"></div>';
    var $e = function (id) { return el.querySelector('#' + id); };
    var fig, wall = $e('wall'), wallbox = $e('wallbox'), breath = $e('breath'), stat = $e('stat'), digits = $e('digits'), clock = $e('clock');
    var s = { el: el, parent: '#/ex/' + L.n + '/' + E.i + '/note' };

    /* ---- timeline ---- */
    var cycle = E.beats * 60 / E.bpm, isHold = E.hold > 0, HOLD_MOVE = 2, PREP = 5, SWITCH = 5;
    var plan = [{ type: 'prep', dur: PREP }], sides = E.sides ? ['ימין', 'שמאל'] : [null];
    for (var st = 1; st <= E.sets; st++) {
      sides.forEach(function (side, si) {
        plan.push({ type: 'work', set: st, side: side, flip: si === 1, dur: isHold ? E.hold : E.reps * cycle });
        if (E.sides && si === 0) plan.push({ type: 'switch', set: st, dur: SWITCH });
      });
      if (st < E.sets) plan.push({ type: 'rest', set: st, dur: E.rest });
    }
    var total = plan.reduce(function (a, p) { return a + p.dur; }, 0);
    var run = { i: -1, t: 0, running: false, last: 0, done: false }, started = false, musicWant = false, lastBeep = -1, idleT0 = performance.now(), timer = null;
    var wallKey = '', lastDigits = '', brKey = '', rafAt = 0, fbTimer = null;

    /* The instruction on the wall keeps the exercise's own rhythm: in a repetition exercise the steps are spread over the
     * repetition and change with the doll's movement; in a hold the steps that lead into the pose are shown while the
     * doll settles, the "hold" step stays for the whole hold and the steps after it (lower down / switch legs) only in
     * the last seconds. */
    var nSteps = E.steps.length, stepLen = Math.max(3, cycle * Math.max(1, Math.ceil(3 / cycle)));
    /* the steps follow the doll's own movement: with two poses (out and back) the last step is the way back and all the
     * earlier ones are spread over the way out - a pause at the far pose (hd) still belongs to the way out, so a step such
     * as "עוצרים שנייה למעלה" is read while the doll really pauses; with more poses every pose gets an equal share */
    var PAUSE = /עצר|עציר|ספר|סופר|החזק|החזיק|מחזיק/, pauseStep = -1;   /* the step read during the pause at the far pose: the one that says to stop / count / hold */
    for (var pk = nSteps - 2; pk >= 0 && pauseStep < 0; pk--) if (PAUSE.test(E.steps[pk])) pauseStep = pk;
    if (pauseStep < 0) pauseStep = PAUSE.test(E.steps[nSteps - 1]) ? nSteps - 1 : Math.max(0, nSteps - 2);
    function stepOf(r) {
      var S = fig.count, f = r.f || 0;
      if (S === 2) {
        if (r.seg === 1) return r.hold ? pauseStep : nSteps - 1;
        return Math.min(nSteps - 2, Math.floor(f * (nSteps - 1)));
      }
      return Math.min(nSteps - 1, Math.floor((r.seg + f) / S * nSteps));
    }
    /* hold: H = the step that says "hold for the timer" (else the last one); the steps before it get up to 3 s each
     * (never more than 40% of the hold together), the steps after it the last 3 s each (never more than 20% together) */
    var holdH = (function () { var h = -1; E.steps.forEach(function (s, k) { if (/טיימר|הדקה/.test(s)) h = k; }); return h < 0 ? nSteps - 1 : h; })();
    var preLen = holdH ? Math.min(3, E.hold * 0.4 / holdH) : 0, postN = nSteps - 1 - holdH, postLen = postN ? Math.min(3, E.hold * 0.2 / postN) : 0;
    /* a step stays on the wall ~cycle/steps seconds (in a hold the lead-in and closing steps get preLen / postLen, the hold step the whole hold); reading takes ~0.4 s a word */
    /* repetitions: one instruction at a time, each on the wall for at least REPSTEP seconds. When the doll's own movement already
     * gives every step that long the steps follow it (above); otherwise they run one after the other on a clock of their own,
     * a step per REPSTEP seconds, however fast the doll repeats - so they are never squeezed into a fraction of the movement */
    var REPSTEP = 3, followDoll = null, repStep = Math.max(REPSTEP, cycle / nSteps);
    function stepsFollowDoll() {
      if (followDoll === null) {
        var n = 120, cnt = [], j, k;
        for (k = 0; k < nSteps; k++) cnt[k] = 0;
        for (j = 0; j < n; j++) cnt[stepOf(fig.atPhase(j / n))]++;
        followDoll = cnt.every(function (c) { return c * cycle / n >= REPSTEP; });
      }
      return followDoll;
    }
    function fastStep(k) {
      var shown = isHold ? (k === holdH ? 1e9 : k < holdH ? preLen : postLen) : stepsFollowDoll() ? cycle / nSteps : repStep;
      return E.steps[k].split(/\s+/).length * 0.4 > shown;
    }
    function stepAt(wt) {
      if (wt < preLen * holdH) return Math.floor(wt / preLen);
      var left = E.hold - wt;
      if (postN && left < postLen * postN) return nSteps - 1 - Math.max(0, Math.min(postN - 1, Math.floor(left / postLen)));
      return holdH;
    }
    /* in a hold the doll breathes with the exercise's breath cycle (bpm/beats): in for the first half, out for the second */
    function holdBreath(wt) {
      var t = (wt - HOLD_MOVE) % cycle;
      return { br: t < cycle / 2 ? 'in' : 'out', wob: -0.8 * Math.sin(2 * Math.PI * t / cycle) };
    }

    /* the highest point the doll and its props reach over a whole cycle (stage px): the wall text must end above it */
    var dollTop = null;
    function sceneTop() {
      if (dollTop === null) {
        var sr = stage.getBoundingClientRect(), k = sr.width / 1920, d = $('.doll', el), n = 8;
        dollTop = 1e9;
        for (var j = 0; j <= n; j++) {
          fig.draw((isHold ? fig.atHold(j / n, 0) : fig.atPhase(j / n)).pose);
          $$('path,rect,circle,ellipse,polygon', d).forEach(function (e) {
            if (e.closest('defs,filter,mask,clipPath')) return;
            var r = e.getBoundingClientRect();
            if (r.width >= 1) dollTop = Math.min(dollTop, (r.top - sr.top) / k);
          });
        }
      }
      return dollTop;
    }
    function fitWall() {   /* shrink the wall text until the doll's head no longer touches it */
      var sr = stage.getBoundingClientRect(), k = sr.width / 1920, lim = sceneTop() - 12, fs = parseFloat(getComputedStyle(wall).fontSize);
      while (fs > 30 && (wallbox.getBoundingClientRect().bottom - sr.top) / k > lim) { fs -= 2; wall.style.fontSize = fs + 'px'; }
    }
    function setWall(key, text, big, dur, emph) {   /* the wall text appears whole at once, not written letter by letter */
      if (key === wallKey) return; wallKey = key;
      wallbox.classList.toggle('hasbr', /^w\d/.test(key));   /* during the work the breath line is written under the instruction, so it reserves room */
      wall.className = 'wall paint now' + (big ? ' big' : '');
      wall.style.fontSize = typeof big === 'number' ? big + 'px' : '';
      /* the text is written in over the first half of its time on the wall */
      wall.innerHTML = write(text, big === true ? 90 : big ? 22 : dur ? Math.min(40, Math.max(8, Math.round(dur * 450 / text.length))) : 22, 0, emph);
      fitWall();
    }
    function setBreath(br) {   /* in / out, written on the wall under the instruction */
      if (br === brKey) return; brKey = br;
      breath.className = 'paint breath' + (br ? ' ' + br : '');
      breath.textContent = br === 'in' ? 'שאיפה' : br === 'out' ? 'נשיפה' : '';
    }
    function setDigits(txt) { if (txt !== lastDigits) { lastDigits = txt; digits.innerHTML = sevenSeg(txt); } }
    function remaining() { if (!started) return total; if (run.done) return 0; var r = 0; for (var j = run.i + 1; j < plan.length; j++) r += plan[j].dur; return r + Math.max(plan[run.i].dur - run.t, 0); }
    function tips() {
      var sp = HTMusic.isPlaying(), ck = started && !run.done;
      $e('spkTip').textContent = sp ? 'מוזיקה פועלת · לחצי לעצירה' : 'לחצי כאן להפעלת מוזיקה';
      $e('spk').classList.toggle('playing', sp);
      $e('clkTip').textContent = !started ? 'לחצי על השעון להפעלת הטיימר' : run.done ? 'סיימת! לחצי לתחילה מחדש' : run.running ? 'הטיימר רץ · לחצי להשהיה' : 'בהשהיה · לחצי להמשך';
      clock.classList.toggle('run', ck && run.running);
      var pz = $e('pz'); pz.style.display = ck ? '' : 'none'; pz.querySelector('span span').textContent = run.running ? 'עצרי' : 'המשיכי';
    }
    function statusText() {
      if (!started) return '';
      var p = plan[run.i];
      if (run.done) return 'כל הכבוד!';
      if (p.type === 'prep') return 'התכוני לעמדת הפתיחה';
      if (p.type === 'rest') return 'מנוחה · הסט הבא ' + (p.set + 1) + ' מתוך ' + E.sets;
      if (p.type === 'switch') return 'עברי לצד השני';
      var txt = 'סט ' + p.set + ' מתוך ' + E.sets + (p.side ? ' · צד ' + p.side : '');
      if (!isHold) txt += ' · חזרה ' + Math.min(Math.floor(run.t / cycle) + 1, E.reps) + '/' + E.reps;
      return txt;
    }
    function render() {
      setDigits(mmss(remaining()));
      var t = statusText(); if (stat._t !== t) { stat._t = t; stat.textContent = t; }
      $e('cl').textContent = !started ? E.dose : plan[Math.max(run.i, 0)].type === 'work' ? 'סט ' + plan[run.i].set + '/' + E.sets : run.done ? 'סיום' : plan[run.i].type === 'rest' ? 'מנוחה' : 'התכוני';
    }

    /* ---- drawing (doll + wall text) ---- */
    function frame(now) {
      var ph = plan[run.i], r;
      if (!started) {
        r = demo(fig, E, (now - idleT0) / 1000); fig.setMirror(false);
        setWall('idle', 'מוכנה? לחצי על השעון כדי להתחיל');
      } else if (run.done) {
        r = fig.atHold(0, Math.sin(now / 900) * 0.6); fig.setMirror(false); setWall('done', 'כל הכבוד! סיימת את התרגיל', false);
      } else if (ph.type === 'work') {
        var wt = run.running ? run.t + Math.min(Math.max(performance.now() - run.last, 0) / 1000, 0.2) : run.t, si;
        if (isHold) { var prog = wt / HOLD_MOVE, hb = prog >= 1 ? holdBreath(wt) : null; r = fig.atHold(prog, hb ? hb.wob : 0); if (hb) r.br = hb.br; }
        else r = fig.atPhase(wt / cycle);
        si = isHold ? stepAt(wt) : stepsFollowDoll() ? stepOf(r) : Math.floor(wt / repStep) % nSteps;
        if (!isHold && !followDoll) { var bm = /שאפ|שאיפ|נשפ|נשיפ/.exec(E.steps[si]); r.br = bm ? (bm[0].charAt(0) === 'ש' ? 'in' : 'out') : ''; }   /* the instruction is on its own clock, so the breath cue follows its words, not the doll */
        fig.setMirror(!!ph.flip);
        setWall('w' + run.i + '.' + si, E.steps[si], false, stepLen, fastStep(si));
      } else {
        r = fig.atHold(0, Math.sin(now / 900) * 0.6);
        var nx = plan[run.i + 1], nw = nx && nx.type === 'work' ? nx : ph;
        fig.setMirror(ph.type === 'switch' ? true : !!(nw && nw.flip && ph.type !== 'rest'));
        if (ph.type === 'prep') setWall('prep', E.start, E.start.length > 100 ? 56 : 66);
        else if (ph.type === 'switch') setWall('sw' + run.i, 'עברי לצד השני', true);
        else setWall('rest' + run.i, 'נוחי ונשמי');
      }
      fig.draw(r.pose);
      /* the instruction and the breath (in / out) are both written on the wall, the breath under the instruction */
      setBreath(started && !run.done && ph.type === 'work' ? (r.br || '') : '');
      render(); tips();
    }

    /* ---- timer logic ---- */
    function enter(i) {
      run.i = i; run.t = 0; lastBeep = -1;
      if (plan[i].type === 'work') HTMusic.sync();
      if (i > 0) HTMusic.tick(true);
    }
    function tick() {
      if (!run.running) return;
      var now = performance.now(), dt = Math.min((now - run.last) / 1000, 1.5); run.last = now; run.t += dt;
      var p = plan[run.i], left = p.dur - run.t;
      if (p.type !== 'work' && left <= 3 && left > 0 && Math.ceil(left) !== lastBeep) { lastBeep = Math.ceil(left); HTMusic.tick(false); }
      if (run.t >= p.dur) { if (run.i + 1 >= plan.length) finish(); else enter(run.i + 1); }
    }
    function musicStyle() { return E.music; }
    /* seconds into the current repetition, so the music's first beat of each bar falls on the start of a repetition */
    function beatOffset() {
      if (!started) return ((performance.now() - idleT0) / 1000) % cycle;
      var p = plan[run.i];
      return p && p.type === 'work' && !isHold ? (run.t + Math.max(performance.now() - run.last, 0) / 1000) % cycle : 0;
    }
    function finish() {
      run.running = false; run.done = true;
      HTMusic.tick(true); setTimeout(function () { HTMusic.tick(true); }, 220);
      HTMusic.stop(); musicWant = false;
      var acts = $e('acts'); $e('tohow').classList.add('hid');   /* the bottom row is taken by the finish buttons */
      acts.innerHTML = '<button type="button" class="pill gold rel" id="didit" style="height:100px;font-size:42px;padding:0 60px;animation:breathe 1.6s ease-in-out infinite">עשיתי את זה!</button>';
    }
    function award() {
      var first = !isDone(E.id);
      if (first) { store.s('ht-points', points() + D.points); store.s('ht-done-' + E.id, '1'); }
      updateBar(true);
      var t = document.createElement('div'); t.className = 'toast';
      t.innerHTML = first ? '+' + D.points + ' נקודות!<small>סה״כ: ' + points() + ' · כל הכבוד!</small>' : 'כל הכבוד!<small>הנקודות של התרגיל הזה כבר נספרו</small>';
      el.appendChild(t); setTimeout(function () { t.remove(); }, 2700);
      var arrow = '<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M39 8H3M10 1.5 3 8l7 6.5"/></svg>';
      $e('acts').innerHTML = (next ? '<button type="button" class="hgo in" data-nav="#/ex/' + L.n + '/' + next.i + '"><span class="in-row"><span>לתרגיל הבא</span>' + arrow + '</span></button>' : '') +
        '<button type="button" class="hgo in" data-nav="#/lesson/' + L.n + '"><span class="in-row"><span>חזרה לאימון</span></span></button>';
    }
    function startRun() {
      started = true; run.done = false; run.running = true; run.last = performance.now(); $e('acts').innerHTML = ''; $e('tohow').classList.remove('hid');
      if (musicWant) { HTMusic.stop(); HTMusic.start(E.bpm, musicStyle()); }
      enter(0);
    }
    function resetRun() {
      started = false; run.running = false; run.done = false; run.i = -1; run.t = 0; HTMusic.resume(); HTMusic.stop(); musicWant = false;
      $e('acts').innerHTML = ''; $e('tohow').classList.remove('hid'); idleT0 = performance.now(); wallKey = '';
    }
    function togglePause() {
      if (run.running) { run.running = false; HTMusic.pause(); }
      else { run.running = true; run.last = performance.now(); HTMusic.resume(); }
    }
    clock.addEventListener('click', function () {
      HTMusic.unlock();
      if (!started || run.done) { startRun(); return; }
      togglePause();
    });
    $e('pz').addEventListener('click', function () { if (started && !run.done) togglePause(); });
    $e('spk').addEventListener('click', function () {
      HTMusic.unlock();
      if (HTMusic.isPlaying()) { HTMusic.stop(); musicWant = false; }
      else { musicWant = true; HTMusic.start(E.bpm, musicStyle(), beatOffset()); }
    });
    $e('skip').addEventListener('click', function () { if (!started || run.done) return; if (run.i + 1 >= plan.length) finish(); else enter(run.i + 1); });
    $e('reset').addEventListener('click', resetRun);
    var tween = mkTween(function () { return dead; }, function () { return skipped; }), p1 = $('#p1', el);
    function finishIntro() { done = true; roomPlayed.go = true; $$('.ln', el).forEach(function (ln) { ln.style.setProperty('--w', 112); ln.style.setProperty('--g', -40); }); el.classList.add('lamp-on'); }
    el.addEventListener('click', function (e) {
      if (!done && !skipped) { skipped = true; setTimeout(finishIntro, 80); }
      if (e.target.closest('#didit')) return award();
      var n = e.target.closest('[data-nav]'); if (n) location.hash = n.dataset.nav;
    });

    s.start = function () {
      fig = mountDoll(el, scene, 900 - 200 * 2.8, 880 - 231 * 2.8, 2.8);
      $('.doll', el).style.zIndex = 2;
      loop(function (t) { rafAt = performance.now(); frame(t); }); timer = setInterval(tick, 100);
      /* animation frames stop while the window is covered or throttled, but the timer and the music keep running: keep the doll and the wall in step with them */
      fbTimer = setInterval(function () { if (performance.now() - rafAt > 80) frame(performance.now()); }, 33);
      var fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('50px "OH Noa Price"', 'אבגד'), document.fonts.load('50px "OH Noa Price"', '8,.!?')]).then(function () { return document.fonts.ready; }).catch(function () {}) : Promise.resolve();
      fonts.then(function () {
        if (dead) return;
        layoutLines(el);
        $$('.ln', el).forEach(function (ln) { ln.style.marginInline = 'auto'; });
        wallLum([[420, 80, 1000, 150], [470, 215, 900, 200]], function (l) {
          p1.style.setProperty('--ink', l[0] < 0.45 ? '#fff3ec' : '#4a3b3a');
          wall.style.setProperty('--ink', l[1] < 0.45 ? '#ffe7ae' : '#a3304f');
          if (roomPlayed.go || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { finishIntro(); return; }
          roomPlayed.go = true;
          tween(350, function () {})
            .then(function () { return paintLines(p1, tween); })
            .then(function () { if (!dead && !done) { el.classList.add('lamp-on'); done = true; } });
        }, 'empty.jpg');
      });
    };
    s.destroy = function () { dead = true; clearInterval(timer); clearInterval(fbTimer); HTMusic.resume(); HTMusic.stop(); };
    s.pause = function () { if (started && run.running && !run.done) { run.running = false; HTMusic.pause(); } };   /* the concepts window opens over a running workout */
    return s;
  }

  HTGlossary.onOpen = function () { if (cur && cur.pause) cur.pause(); };

  /* ================= router ================= */
  function route() {
    var p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean), L, E;
    window.scrollTo(0, 0);
    if (!p.length) return show(homeScreen());
    if (p[0] === 'lessons') return show(lessonsScreen());
    if (p[0] === 'lesson' && (L = findLesson(p[1]))) return show(lessonScreen(L));
    if (p[0] === 'ex' && (L = findLesson(p[1])) && (E = L.exercises[+p[2] - 1])) {
      if (p[3] === 'note') return show(noteScreen(L, E));
      if (p[3] === 'muscles') return show(musclesScreen(L, E));
      if (p[3] === 'go') return show(goScreen(L, E));
      return show(howScreen(L, E));
    }
    location.hash = '#/';
  }
  addEventListener('hashchange', route);
  route();
})();
