/* glossary-anim.js - a small black line-art animation for every term in the "כל המושגים" list (shared/glossary.js).
 * Thin black strokes, no fills, transparent background (the animation house style).
 * A tiny stick-figure rig (side or front view) is posed by keyframes; cards that are not about the body draw their own little scene.
 * Only the cards on screen are animated (IntersectionObserver); everything else is idle.
 * API: HTGlossAnim.has(title) -> bool, HTGlossAnim.attach(listEl) animates every  svg.gt-an[data-a]  inside it, HTGlossAnim.stop(), HTGlossAnim.frame(title, u, t) -> svg markup (for tests).
 */
(function () {
  'use strict';
  var R = Math.PI / 180, G = 124, UA = 17, FA = 16, TH = 24, SH = 23, TOR = 32, HR = 7.5, NK = 4, FT = 7, PI = Math.PI;
  function as(o) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; for (var k in s) o[k] = s[k]; } return o; }
  var SD = { t: 0, c: 0, n: 0, a1: [0, 0], a2: [0, 0], l1: [0, 0], l2: [0, 0], f: [90, 90], sw: 0, hw: 0, fs: [1, 1], dx: 0 };
  var FD = as({}, SD, { sw: 14, hw: 8, a1: [-8, 8], a2: [-8, 8], f: [-80, 80] });
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }
  function xy(p) { return f1(p[0]) + ',' + f1(p[1]); }
  function pl(a) { return '<polyline points="' + a.map(xy).join(' ') + '"/>'; }
  function ln(a, b, x) { return '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '"' + (x || '') + '/>'; }
  function dash(a, b) { return ln(a, b, ' stroke-dasharray="3 4" stroke-width="1.2"'); }
  function circ(c, r, x) { return '<circle cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" r="' + f1(r) + '"' + (x || '') + '/>'; }
  function pth(d, x) { return '<path d="' + d + '"' + (x || '') + '/>'; }
  function txt(x, y, s, size, anchor) { return '<text x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '" fill="#111" stroke="none" style="font:800 ' + (size || 15) + 'px Asparagos,sans-serif">' + s + '</text>'; }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }
  function lerpv(a, b, k) { return typeof a === 'number' ? a + (b - a) * k : a.map(function (v, i) { return v + (b[i] - v) * k; }); }
  function mix(p, q, k) { var o = {}; for (var key in p) o[key] = lerpv(p[key], q[key], k); return o; }

  /* ---------------- the rig ---------------- */
  /* pose: t torso lean (0 up, + toward the right), c back rounding in px (+ round, - arched), n head tilt, a1/a2 upper arm / forearm angle, l1/l2 thigh / shin angle,
     f foot angle (limb angles are absolute, 0 = straight down, 90 = right, 180 = up; index 0 = left limb in the front view, the near limb in the side view),
     sw / hw half width of shoulders / hips (front view), fs forearm length scale, dx shift. */
  function fk(p, S) {
    var t = p.t * R, td = [Math.sin(t), -Math.cos(t)], nr = [Math.cos(t), Math.sin(t)], len = TOR - Math.abs(p.c) * 0.15, i, sg;
    var sh = [td[0] * len, td[1] * len], ctrl = [sh[0] / 2 - nr[0] * 2 * p.c, sh[1] / 2 - nr[1] * 2 * p.c];
    var hd = (p.t + p.n) * R, hu = [Math.sin(hd), -Math.cos(hd)], hn = [Math.cos(hd), Math.sin(hd)];
    var hc = [sh[0] + hu[0] * (NK + HR), sh[1] + hu[1] * (NK + HR)];
    var Sh = [], E = [], H = [], HP = [], K = [], An = [], T = [], maxY = -1e9;
    function ad(q) { if (q[1] > maxY) maxY = q[1]; return q; }
    for (i = 0; i < 2; i++) {
      sg = i ? 1 : -1;
      Sh[i] = [sh[0] + nr[0] * p.sw * sg, sh[1] + nr[1] * p.sw * sg];
      E[i] = ad([Sh[i][0] + UA * Math.sin(p.a1[i] * R), Sh[i][1] + UA * Math.cos(p.a1[i] * R)]);
      H[i] = ad([E[i][0] + FA * p.fs[i] * Math.sin(p.a2[i] * R), E[i][1] + FA * p.fs[i] * Math.cos(p.a2[i] * R)]);
      HP[i] = [nr[0] * p.hw * sg, nr[1] * p.hw * sg]; ad(HP[i]);
      K[i] = ad([HP[i][0] + TH * Math.sin(p.l1[i] * R), HP[i][1] + TH * Math.cos(p.l1[i] * R)]);
      An[i] = ad([K[i][0] + SH * Math.sin(p.l2[i] * R), K[i][1] + SH * Math.cos(p.l2[i] * R)]);
      T[i] = ad([An[i][0] + FT * Math.sin(p.f[i] * R), An[i][1] + FT * Math.cos(p.f[i] * R)]);
    }
    ad(sh); ad(Sh[0]); ad(Sh[1]);
    var anc = S.anc || 'hip', ref = anc === 'foot' ? An[0][0] : anc === 'toe' ? T[0][0] : anc === 'hand' ? H[0][0] : 0;
    var ox = 100 + p.dx - ref, oy = G - maxY;
    function m(q) { return [q[0] + ox, q[1] + oy]; }
    var J = { p: p, hip: m([0, 0]), sh: m(sh), ctrl: m(ctrl), hc: m(hc), S: Sh.map(m), E: E.map(m), H: H.map(m), HP: HP.map(m), K: K.map(m), An: An.map(m), T: T.map(m), nr: nr, hn: hn, hu: hu };
    if (J.hc[1] + HR > G) J.hc[1] = G - HR;
    J.bz = function (f, o) { var a = (1 - f) * (1 - f), b = 2 * f * (1 - f), c = f * f; return [a * J.hip[0] + b * J.ctrl[0] + c * J.sh[0] + nr[0] * (o || 0), a * J.hip[1] + b * J.ctrl[1] + c * J.sh[1] + nr[1] * (o || 0)]; };
    return J;
  }
  function figure(J, S) {
    var p = J.p, s = '', i, nb = [J.hc[0] - J.hu[0] * HR, J.hc[1] - J.hu[1] * HR];
    s += pth('M' + xy(J.hip) + ' Q' + xy(J.ctrl) + ' ' + xy(J.sh));
    if (Math.abs(p.sw) > 0.5) s += ln(J.S[0], J.S[1]);
    if (Math.abs(p.hw) > 0.5) s += ln(J.HP[0], J.HP[1]);
    s += ln(J.sh, nb) + circ(J.hc, HR);
    if (Math.abs(p.sw) < 3) { var nx = [J.hc[0] + J.hn[0] * HR, J.hc[1] + J.hn[1] * HR]; s += ln(nx, [nx[0] + J.hn[0] * 2.6, nx[1] + J.hn[1] * 2.6]); }
    for (i = 0; i < 2; i++) s += pl([J.S[i], J.E[i], J.H[i]]) + pl([J.HP[i], J.K[i], J.An[i], J.T[i]]);
    return s;
  }

  /* ---------------- props ---------------- */
  function wall(x) { var s = ln([x, 16], [x, G]), y; for (y = 28; y < G; y += 12) s += ln([x, y + 8], [x - 8, y], ' stroke-width="1"'); return s; }
  function box(x1, x2, h) { return pth('M' + x1 + ' ' + G + 'V' + (G - h) + 'H' + x2 + 'V' + G); }
  function chair(x1, x2, h) { return ln([x1, G - h], [x2, G - h]) + ln([x1 + 2, G - h], [x1 + 2, G]) + ln([x2 - 2, G - h], [x2 - 2, G]); }
  function bottle(c) { return '<rect x="' + f1(c[0] - 3.5) + '" y="' + f1(c[1] - 6) + '" width="7" height="14" rx="2.4"/><rect x="' + f1(c[0] - 1.8) + '" y="' + f1(c[1] - 9.2) + '" width="3.6" height="3.2" rx="1"/>'; }
  function holding(J, kind) {
    var s = '', i, same = dist(J.H[0], J.H[1]) < 2;
    if (kind === 'bottle') { for (i = 0; i < (same ? 1 : 2); i++) s += bottle(J.H[i]); }
    else if (kind === 'stick') {
      if (Math.abs(J.p.sw) > 3) { var d = [J.H[1][0] - J.H[0][0], J.H[1][1] - J.H[0][1]], l = dist(J.H[0], J.H[1]) || 1; d = [d[0] / l * 14, d[1] / l * 14]; s += ln([J.H[0][0] - d[0], J.H[0][1] - d[1]], [J.H[1][0] + d[0], J.H[1][1] + d[1]], ' stroke-width="2.6"'); }
      else s += circ(J.H[0], 3.4);
    }
    return s;
  }

  /* ---------------- marks: pulsing rings and dashed capsules on the body part a card is about ---------------- */
  function pts(J, name) {
    var m = /^([a-zA-Z]+)([01])?$/.exec(name), b = m[1], i = m[2], nr = J.nr;
    function two(a) { return i != null ? [a[+i]] : (dist(a[0], a[1]) < 2 ? [a[0]] : a); }
    function mid(a, b2) { return [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2]; }
    switch (b) {
      case 'shoulder': return two(J.S); case 'elbow': return two(J.E); case 'hand': return two(J.H); case 'hip': return two(J.HP);
      case 'knee': return two(J.K); case 'ankle': return two(J.An); case 'toe': return two(J.T);
      case 'heel': return two(J.An.map(function (a) { return [a[0] - 3.5, a[1] + 1.5]; }));
      case 'sh': return [J.sh]; case 'head': return [J.hc];
      case 'neck': return [[J.sh[0] + J.hu[0] * 3, J.sh[1] + J.hu[1] * 3]];
      case 'chin': return [[J.hc[0] + J.hn[0] * 6 + J.hu[0] * -3, J.hc[1] + J.hn[1] * 6 + J.hu[1] * -3]];
      case 'torso': return [J.bz(0.5, 0)]; case 'chest': return [J.bz(0.8, 3)]; case 'belly': return [J.bz(0.33, 3)];
      case 'lowback': return [J.bz(0.2, -5)]; case 'upback': return [J.bz(0.82, -5)]; case 'tail': return [[J.hip[0] - nr[0] * 5, J.hip[1] - nr[1] * 5 + 2]];
      case 'glute': return [[J.hip[0] - nr[0] * 6, J.hip[1] - nr[1] * 6]]; case 'hipF': return [[J.hip[0] + nr[0] * 6, J.hip[1] + nr[1] * 6]];
      case 'upperarm': return [mid(J.S[i ? 1 : 0], J.E[i ? 1 : 0])]; case 'forearm': return [mid(J.E[i ? 1 : 0], J.H[i ? 1 : 0])];
      case 'thigh': return [mid(J.HP[i ? 1 : 0], J.K[i ? 1 : 0])]; case 'shin': return [mid(J.K[i ? 1 : 0], J.An[i ? 1 : 0])];
    }
    return [J.hip];
  }
  function capsule(a, b, r, off) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l, px = uy, py = -ux;
    a = [a[0] + px * off, a[1] + py * off]; b = [b[0] + px * off, b[1] + py * off];
    var A1 = [a[0] + px * r, a[1] + py * r], A2 = [a[0] - px * r, a[1] - py * r], B1 = [b[0] + px * r, b[1] + py * r], B2 = [b[0] - px * r, b[1] - py * r];
    return pth('M' + xy(A1) + 'L' + xy(B1) + 'A' + r + ' ' + r + ' 0 0 0 ' + xy(B2) + 'L' + xy(A2) + 'A' + r + ' ' + r + ' 0 0 0 ' + xy(A1), ' stroke-dasharray="3 3" stroke-width="1.3"');
  }
  function marks(S, J, t) {
    var M = S.mark; if (!M) return '';
    var g = M[Math.floor(t / 1.5) % M.length], s = '', v = (t % 1.1) / 1.1, k;
    g.forEach(function (it) {
      var kind = it[0], a, b;
      if (kind === 'r' || kind === 'q') {
        pts(J, it[1]).forEach(function (q) {
          q = [q[0] + (it[2] || 0), q[1] + (it[3] || 0)];
          var r0 = kind === 'q' ? 4 : 6;
          s += circ(q, r0 + 7 * v, ' stroke-opacity="' + f1(1 - v) + '" stroke-width="1.4"') + circ(q, 2, ' stroke-width="1.3"');
        });
      } else if (kind === 's') {
        a = pts(J, it[1]); b = pts(J, it[2]);
        for (k = 0; k < Math.min(a.length, b.length); k++) s += capsule(a[k], b[k], 5.5 + 1.2 * Math.sin(t * 5), it[3] || 0);
      }
    });
    return s;
  }

  /* ---------------- timeline ---------------- */
  function poseAt(S, u) {
    if (S.gen) return as({}, S.base, S.gen(u));
    var P = S.PN, n = P.length, tot = 0, i, acc = 0, ws = [];
    for (i = 0; i < n; i++) { ws[i] = S.seg ? S.seg[i] : 1; tot += ws[i]; }
    var x = u * tot;
    for (i = 0; i < n - 1; i++) { if (x < acc + ws[i]) break; acc += ws[i]; }
    var k = Math.min(1, ((x - acc) / ws[i]) / (S.tr || 0.7));
    return mix(P[i], P[(i + 1) % n], ease(k));
  }
  function prop(a, J) {
    switch (a[0]) { case 'wall': return wall(a[1]); case 'box': return box(a[1], a[2], a[3]); case 'chair': return chair(a[1], a[2], a[3]); }
    return '';
  }
  function body(S, u, t) {
    var s = '';
    if (S.draw) return S.draw(u, t);
    var p = poseAt(S, u), J = fk(p, S);
    s += '<line x1="12" y1="' + (G + 1.5) + '" x2="188" y2="' + (G + 1.5) + '" stroke-width="1"/>';
    (S.prop || []).forEach(function (a) { s += prop(a, J); });
    s += figure(J, S);
    if (S.hold) s += holding(J, S.hold);
    s += marks(S, J, t);
    if (S.ex) s += S.ex(J, u, t, p);
    if (S.z) s = '<g transform="translate(100 ' + G + ') scale(' + S.z + ') translate(-100 -' + G + ')" stroke-width="' + f1(1.8 / S.z) + '">' + s + '</g>';
    if (S.hud) s += S.hud(J, u, t, p);
    if (S.cnt) s += txt(188, 22, '' + (Math.floor(t / S.T) % 12 + 1), 17, 'end');
    return s;
  }

  /* ---------------- ready-made poses (side view faces right) ---------------- */
  var BD = { t: -90, a1: [90, 90], a2: [90, 90], l1: [145, 145], l2: [20, 20] };                  /* on the back, knees bent */
  var BU = { t: -115, a1: [90, 90], a2: [90, 90], l1: [115, 115], l2: [15, 15] };                 /* glute bridge up */
  var Q = { t: 74, l2: [-90, -90], f: [-90, -90] };                                              /* on all fours */
  var PF = { dx: -49, t: 83, a2: [90, 90], l1: [-83, -83], l2: [-83, -83], f: [30, 30] };                  /* plank on the forearms */
  var PU = { dx: -45, t: 70, l1: [-70, -70], l2: [-70, -70], f: [30, 30] };                                /* push-up, top */
  var PD = { dx: -47, t: 83, a1: [-60, -60], a2: [67, 67], l1: [-83, -83], l2: [-83, -83], f: [30, 30] };  /* push-up, bottom */
  var PKQ = { dx: -38, t: 54, l1: [-54, -54], l2: [-120, -120], f: [-90, -90] };                          /* plank on the knees */
  var PIKE = { dx: -44, t: 105, a2: [90, 90], l1: [-62, -62], l2: [-62, -62], f: [30, 30] };
  var CH = { t: 86, c: 5, a1: [84, 84], a2: [84, 84], l1: [85, 85], l2: [-90, -90], f: [-90, -90] };   /* child's pose */
  var DBT = { t: -90, a1: [180, 180], a2: [180, 180], l1: [180, 180], l2: [90, 90] };             /* dead bug, tabletop */
  var LEG0 = { t: -90, a1: [90, 90], a2: [90, 90], l1: [90, 90], l2: [90, 90] };
  var LEG1 = { t: -90, a1: [90, 90], a2: [90, 90], l1: [180, 180], l2: [180, 180] };
  var SQ0 = { a1: [90, 90], a2: [90, 90] };
  var SQ1 = { t: 32, l1: [84, 84], l2: [-6, -6], a1: [90, 90], a2: [90, 90] };
  var CUR0 = {}, CUR1 = { a2: [165, 165] };
  var RACK = { a1: [25, 25], a2: [150, 150] };
  var BEND = { t: 62, l1: [10, 10], l2: [-5, -5], n: -30 };                                       /* torso leaned forward, knees soft */
  var F = {};                                                                                     /* front-view stand */
  var ARMS_OUT = { a1: [-90, 90], a2: [-90, 90] };
  function K(a, b) { return as({}, a, b); }

  /* helper for the generated motions */
  function walkGen(stride, arms) {
    return function (u) {
      var th = u * 2 * PI, s = Math.sin(th), c = Math.cos(th), A = stride;
      return { l1: [A * s, -A * s], l2: [A * s - 34 * Math.max(0, c), -A * s - 34 * Math.max(0, -c)], a1: [-arms * s, arms * s], a2: [-arms * s, arms * s] };
    };
  }

  /* ---------------- scenes that are not a body ---------------- */
  function sceneReps(u, t) {
    var n = Math.floor(u * 7), s = '', i, x;
    for (i = 0; i < 5; i++) { x = 40 + i * 30; s += circ([x, 62], 11, i < n ? '' : ' stroke-dasharray="2 3"'); if (i < n) s += pth('M' + (x - 5) + ' 62l4 5 7-10'); }
    if (n >= 5) s += pth('M30 88v9H170v-9') + txt(100, 118, n >= 6 ? '✓' : '', 18);
    return s;
  }
  function sceneTimer(u, t) {
    var a = u * 2 * PI, s = circ([100, 78], 44) + circ([100, 78], 38, ' stroke-width="1"') + pth('M92 28h16M100 28v6M138 40l7-7M143 28l9 9', ' stroke-width="1.8"'), i;
    for (i = 0; i < 12; i++) { var q = i * PI / 6; s += ln([100 + Math.sin(q) * 33, 78 - Math.cos(q) * 33], [100 + Math.sin(q) * 38, 78 - Math.cos(q) * 38], ' stroke-width="1.3"'); }
    s += ln([100, 78], [100 + Math.sin(a) * 30, 78 - Math.cos(a) * 30]) + circ([100, 78], 3);
    var arc = '', j; for (j = 0; j < 14; j++) { var q2 = a - j * 0.07; arc += (j ? 'L' : 'M') + f1(100 + Math.sin(q2) * 24) + ' ' + f1(78 - Math.cos(q2) * 24); }
    return s + pth(arc, ' stroke-width="1" stroke-opacity=".5"');
  }
  function sceneMetro(u, t) {
    var a = 28 * Math.sin(u * 2 * PI) * R, pv = [100, 112], e = [pv[0] + 84 * Math.sin(a), pv[1] - 84 * Math.cos(a)], w = [pv[0] + 56 * Math.sin(a), pv[1] - 56 * Math.cos(a)];
    var s = pth('M66 126L82 22H118L134 126Z') + ln([84, 126], [116, 126]) + ln(pv, e) + circ(w, 5) + circ(pv, 3) + pth('M60 48 A52 52 0 0 1 140 48', ' stroke-dasharray="2 5" stroke-width="1"');
    if (Math.abs(Math.sin(u * 2 * PI)) > 0.93) s += pth('M150 60q8 8 0 16M158 54q13 14 0 28', ' stroke-width="1.4"');
    return s;
  }
  function sceneLevels(u, t) {
    var xs = [38, 76, 114, 152], ys = [112, 90, 68, 46], s = pth('M20 124H58V102H96V80H134V58H172V124', ' stroke-width="1.8"') , lv = Math.floor(u * 4), k = u * 4 - lv, a, b, c;
    a = [xs[lv], ys[lv]]; b = lv < 3 ? [xs[lv + 1], ys[lv + 1]] : [xs[3] + 24, 118];
    k = ease(Math.min(1, k * 1.3));
    c = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - 16 * Math.sin(PI * k) - 8];
    return s + circ(c, 7) + ln([c[0], c[1] + 8], [c[0], c[1] + 8.2]);
  }
  function sceneFlame(u, t) {
    var w = Math.sin(t * 7) * 0.05, h = Math.sin(t * 5.3) * 0.07, s = '<g transform="translate(100 124) scale(' + f1(1 + w) + ' ' + f1(1 + h) + ') translate(-100 -124)">' +
      pth('M100 22C104 46 128 58 128 88C128 110 114 122 100 122C86 122 72 110 72 88C72 72 82 64 88 52C90 64 96 68 98 64C102 52 98 36 100 22Z') +
      pth('M100 70C103 84 114 90 114 102C114 112 108 118 100 118C92 118 86 112 86 102C86 92 96 88 100 70Z', ' stroke-width="1.4"') + '</g>';
    var i; for (i = 0; i < 3; i++) { var k = (t * 0.8 + i / 3) % 1; s += circ([76 + i * 24 + Math.sin(k * 9) * 4, 70 - k * 56], 1.6, ' stroke-opacity="' + f1(1 - k) + '"'); }
    return s;
  }
  function sceneStar(u, t, D) {
    var k = Math.sin(u * 2 * PI), sc = 1 + 0.07 * k, pts2 = [], i, s;
    for (i = 0; i < 10; i++) { var r = (i % 2 ? 15 : 34) * sc, q = -PI / 2 + i * PI / 5 + 0.08 * k; pts2.push([100 + Math.cos(q) * r, 68 + Math.sin(q) * r]); }
    s = '<polygon points="' + pts2.map(xy).join(' ') + '"/>';
    for (i = 0; i < 8; i++) { var q2 = i * PI / 4 + t, r1 = 46 + 4 * k, r2 = 54 + 6 * k; s += ln([100 + Math.cos(q2) * r1, 68 + Math.sin(q2) * r1], [100 + Math.cos(q2) * r2, 68 + Math.sin(q2) * r2], ' stroke-width="1.3"'); }
    var rise = (t * 0.7) % 1;
    return s + '<g opacity="' + f1(1 - rise) + '">' + txt(100, 130 - rise * 8, '+' + ((window.HT_DATA && window.HT_DATA.points) || 10), 20) + '</g>';
  }
  function sceneGrip(u, t) {
    var k = ease(0.5 + 0.5 * Math.sin(u * 2 * PI)), s = '<rect x="62" y="34" width="32" height="88" rx="10"/><rect x="71" y="22" width="14" height="12" rx="3"/>', i;
    s += pth('M104 40H132Q146 40 146 56V104Q146 120 130 120H104', ' stroke-width="1.8"');
    for (i = 0; i < 4; i++) { var xl = 100 - 50 * k, y = 44 + i * 17; s += '<rect x="' + f1(xl) + '" y="' + y + '" width="' + f1(112 - xl) + '" height="12" rx="6"/>'; }
    var tx = 112 - 40 * k; s += '<rect x="' + f1(tx) + '" y="108" width="' + f1(118 - tx) + '" height="12" rx="6"/>';
    if (k > 0.85) for (i = 0; i < 3; i++) s += ln([52 - i * 3, 52 + i * 22], [44 - i * 3, 48 + i * 22], ' stroke-width="1.3"');
    return s;
  }
  function sceneLungs(mode) {
    return function (u, t) {
      var ph = (t % 6) / 6, br = ph < 0.5 ? ease(ph * 2) : 1 - ease((ph - 0.5) * 2), k = br, s = '', side;
      if (mode === 'hypo') { br = ph < 0.3 ? 1 - ease(ph / 0.3) : ph < 0.8 ? -0.6 * ease(Math.min(1, (ph - 0.3) / 0.15)) : -0.6 * (1 - ease((ph - 0.8) / 0.2)); k = br; }
      s += pth('M92 4V24C80 28 56 30 46 44L40 124M108 4V24C120 28 144 30 154 44L160 124', ' stroke-width="1.8"');
      s += pth('M100 10V48M100 48L86 58M100 48L114 58', ' stroke-width="1.4"');
      [-1, 1].forEach(function (sd) {
        var d = 'M' + (100 + sd * 14) + ' 54C' + (100 + sd * 40) + ' 52 ' + (100 + sd * 46) + ' 86 ' + (100 + sd * 40) + ' 104Q' + (100 + sd * 26) + ' 110 ' + (100 + sd * 12) + ' 102C' + (100 + sd * 8) + ' 86 ' + (100 + sd * 10) + ' 66 ' + (100 + sd * 14) + ' 54Z';
        s += '<g transform="translate(100 104) scale(' + f1(1 + 0.14 * k) + ' ' + f1(1 + 0.08 * k) + ') translate(-100 -104)">' + pth(d, ' stroke-width="1.5"') + '</g>';
      });
      s += pth('M46 ' + f1(108 + 6 * k) + 'Q100 ' + f1(84 + 24 * k) + ' 154 ' + f1(108 + 6 * k), ' stroke-width="2"');
      s += pth('M42 118Q100 ' + f1(122 + 14 * k) + ' 158 118', ' stroke-width="1.3" stroke-dasharray="3 3"');
      if (mode === 'diaph') { var hy = 112 + 8 * k; s += '<rect x="76" y="' + f1(hy) + '" width="48" height="8" rx="4"/>'; }
      if (mode === 'in' && ph < 0.5) s += pth('M100 -6V4M95 -1L100 5L105 -1', ' stroke-width="1.6"');
      if (mode === 'hypo' && ph >= 0.3 && ph < 0.8) s += pth('M94 -4v12M106 -4v12', ' stroke-width="2.4"') + pth('M30 84H18M23 79L17 84L23 89M170 84H182M177 79L183 84L177 89', ' stroke-width="1.6"');
      if (mode === 'hypo' && ph < 0.3) s += pth('M100 6V-4M95 1L100 -5L105 1', ' stroke-width="1.6"');
      if (mode === 'out' && ph >= 0.5) s += pth('M100 6V-4M95 1L100 -5L105 1', ' stroke-width="1.6"');
      return s;
    };
  }

  /* ---------------- the terms ---------------- */
  var SP = {};
  function def(names, spec) { [].concat(names).forEach(function (n) { SP[n] = spec; }); }
  function pose(base, list) { return list.map(function (o) { return as({}, base, o); }); }
  function setup(S) {
    S.base = S.v === 'f' ? FD : SD; S.T = S.T || 3.4;
    if (S.P) S.PN = pose(S.base, S.P);
    if (S.mark && typeof S.mark[0][0] === 'string') S.mark = [S.mark];
    return S;
  }
  var STEPS = { l1: [0, 55], l2: [0, 30] };
  var CAT = { t: 74, c: 11, n: 35, l2: [-90, -90], f: [-90, -90] }, COW = { t: 74, c: -9, n: -25, l2: [-90, -90], f: [-90, -90] };
  var LYS = { t: -75, a1: [-120, -120], a2: [-60, -60] };
  var WS = { t: 0, l1: [90, 90], l2: [0, 0] };
  var STRK = { t: -10, a1: [0, 0] };
  var HINGE = { t: 68, l1: [16, 16], l2: [-6, -6], n: -30 };
  var TREE = { l1: [0, 75], l2: [0, -12], a1: [170, -170], a2: [175, -175] };
  var LEAN_R = { t: 14, a1: [170, 166], a2: [172, 168] }, LEAN_L = { t: -14, a1: [-166, -170], a2: [-168, -172] };
  var CHOP0 = { a1: [150, 150], a2: [150, 150], t: 8 }, CHOP1 = { a1: [-30, -30], a2: [-30, -30], t: -10 };
  var ELBOW = { l1: [10, 10], l2: [-5, -5] };

  /* --- the basics --- */
  def('חזרה', { anc: 'foot', P: [BD, BU], cnt: 1, T: 3.2 });
  def('סט', { draw: sceneReps, T: 4.5 });
  def('מנוחה בין סטים', { anc: 'foot', P: [{}, { t: 45, l1: [30, 30], l2: [-10, -10], a1: [-27, -27], a2: [-27, -27], n: -15 }], seg: [1, 2.4], T: 4.6,
    ex: function (J, u, t) { var k = (t * 0.5) % 1; return pth('M' + f1(J.hc[0] + 10) + ' ' + f1(J.hc[1] + 2 - k * 5) + 'q4 -3 8 0t8 0', ' stroke-opacity="' + f1(1 - k) + '" stroke-width="1.3"') + pth('M' + f1(J.hc[0] + 12) + ' ' + f1(J.hc[1] + 8 - k * 5) + 'q4 -3 8 0t8 0', ' stroke-opacity="' + f1(1 - k) + '" stroke-width="1.3"'); } });
  def('עמדת פתיחה', { anc: 'foot', P: [{ a1: [3, 3], a2: [3, 3] }, { t: 8, l1: [8, 8], l2: [-5, -5], a1: [35, 35], a2: [95, 95] }], seg: [1, 2], mark: [['r', 'hand'], ['q', 'ankle']], hold: 'bottle', T: 4 });
  def('טיימר', { draw: sceneTimer, T: 5 });
  def('כל צד בנפרד', { v: 'f', anc: 'foot', P: [{}, { l1: [-4, 40], l2: [-4, 40] }, {}, { l1: [-40, 4], l2: [-40, 4] }], T: 6, mark: [['q', 'ankle', 0, 0]] });
  def('קצב ופעימות', { draw: sceneMetro, T: 2.4 });
  def('טווח תנועה', { anc: 'foot', P: [{}, { a1: [175, 175], a2: [175, 175] }], T: 3.6,
    ex: function (J) { var c = J.S[0], s = '', i; for (i = 0; i <= 36; i++) { var a = i * 5 * R; s += (i ? 'L' : 'M') + f1(c[0] + Math.sin(a) * 36) + ' ' + f1(c[1] + Math.cos(a) * 36); } return pth(s, ' stroke-dasharray="2 4" stroke-width="1"'); } });
  def('עצירה (החזקה)', { anc: 'foot', P: [BD, BU, BU, BD], seg: [1.2, 2.5, 1.2, 0.8], T: 5.6,
    hud: function (J, u) { return u > 0.3 && u < 0.62 ? pth('M168 14v14M178 14v14', ' stroke-width="2.4"') : ''; } });
  def('איזומטרי', { anc: 'hip', P: [{}, WS, WS], seg: [1.3, 2.6, 0.9], T: 5, prop: [['wall', 92]],
    ex: function (J, u) { if (u < 0.3 || u > 0.72) return ''; var k = [J.HP[0][0] + 9, (J.HP[0][1] + J.K[0][1]) / 2 - 8], s = '', i; for (i = 0; i < 2; i++) s += pth('M' + f1(k[0] + 6 + i * 6) + ' ' + f1(k[1]) + 'l2 -4 -4 8 2 -4', ' stroke-width="1.2"'); return s + pth('M' + f1(k[0] - 6) + ' ' + f1(k[1] + 6) + 'l-3 -3 -3 6', ' stroke-width="1.2"'); } });
  def('כיווץ שריר', { anc: 'foot', P: [CUR0, CUR1], hold: 'bottle', mark: [['s', 'shoulder', 'elbow', 4.5, 0]], T: 3 });
  def('מתיחה', { v: 'f', anc: 'foot', P: [{}, LEAN_R, LEAN_L], T: 6 });
  def('גמישות', { anc: 'foot', P: [{}, { t: 84, l1: [3, 3], a1: [4, 4], a2: [4, 4], n: -15 }], seg: [1, 1.6], T: 4.6 });
  def('ניידות', { anc: 'foot', gen: function (u) { var a = u * 360; return { a1: [a, a], a2: [a, a] }; }, T: 3.4, mark: [['q', 'shoulder']],
    ex: function (J) { return circ(J.S[0], 34, ' stroke-dasharray="2 4" stroke-width="1"'); } });
  def('שיווי משקל', { v: 'f', anc: 'foot', P: [{}, TREE, K(TREE, { t: 1 }), K(TREE, { t: -1 })], seg: [1.2, 1, 1, 1], tr: 0.5, T: 6, mark: [['q', 'ankle0']] });
  def('יציבות', { anc: 'hip', P: [Q, K(Q, { a1: [90, 0], a2: [90, 0], l1: [0, -95], l2: [-90, -95], f: [-90, -90] }), K(Q, { a1: [90, 0], a2: [90, 0], l1: [0, -95], l2: [-90, -95], f: [-90, -90] })], seg: [1, 2.6, 1], T: 5.6,
    ex: function (J) { var y = (J.hip[1] + J.sh[1]) / 2 - 7; return dash([J.hip[0] - 18, y], [J.sh[0] + 26, y]) + circ([(J.hip[0] + J.sh[0]) / 2, y], 2.5); } });
  def('שליטה', { anc: 'foot', P: [SQ0, SQ1], seg: [3, 1], T: 4.8, mark: [['q', 'hip']] });
  def('תנופה', { anc: 'foot', P: [{}, K({ a1: [92, 92], a2: [92, 92], t: -20 }, {}), {}], seg: [0.7, 1, 0.7], tr: 0.9, T: 2.2, hold: 'bottle',
    ex: function (J, u) { var s = '', i; if (u > 0.05 && u < 0.4) for (i = 0; i < 3; i++) s += ln([J.H[0][0] - 12, J.H[0][1] + 8 - i * 6], [J.H[0][0] - 22, J.H[0][1] + 9 - i * 6], ' stroke-width="1.3"'); return s; }, hud: function () { return pth('M164 12l12 12M176 12l-12 12', ' stroke-width="1.8"'); } });
  def('גרסה קלה וגרסה קשה', { anc: 'foot', P: [PKQ, PKQ, PU, PU], seg: [0.8, 1, 0.8, 1.4], T: 5 });
  def('רמת קושי', { draw: sceneLevels, T: 5 });
  def('שרירים ראשיים ותומכים', { anc: 'foot', P: [CUR0, CUR1], hold: 'bottle', mark: [['s', 'shoulder', 'elbow', 4.5, 0], ['q', 'shoulder', -2, 0], ['q', 'hand']], T: 3 });
  def('קלוריות', { draw: sceneFlame, T: 4 });
  def('נקודות', { draw: sceneStar, T: 3 });
  def('שאיפה', { draw: sceneLungs('in'), T: 6 });
  def('נשיפה', { draw: sceneLungs('out'), T: 6 });
  def('נשימה סרעפתית', { draw: sceneLungs('diaph'), T: 6 });
  def(['היפופרסיב', 'ואקום', 'פתיחת צלעות'], { draw: sceneLungs('hypo'), T: 6 });

  /* --- positions and movements --- */
  def('על ארבע', { anc: 'hip', P: [Q, K(Q, { t: 72, n: 4 })], mark: [['q', 'hand'], ['q', 'knee']], T: 4 });
  def('ניטרלי', { anc: 'hip', P: [CAT, K(Q, {}), COW, K(Q, {})], seg: [1, 1, 1, 1], T: 6.5,
    ex: function (J) { return dash([J.hip[0] - 16, J.hip[1] + (J.sh[1] - J.hip[1]) * 0 ], [J.sh[0] + 8, J.sh[1] + (J.hip[1] - J.sh[1]) * 0]); } });
  def('קימור ועיגול הגב', { anc: 'hip', P: [CAT, COW], mark: [['q', 'torso']], T: 4.4 });
  def('זקוף', { anc: 'foot', P: [{ t: 14, c: 5, n: 18, a1: [4, 4] }, {}], seg: [1, 1.4], T: 4.6, ex: function (J) { return dash([100, 18], [100, G]); } });
  def('קו ישר', { anc: 'foot', P: [PIKE, PF, PF], seg: [1, 1, 1.2], T: 4.4, ex: function (J) { var a = J.sh, b = J.An[0], d = [b[0] - a[0], b[1] - a[1]], l = dist(a, b); d = [d[0] / l * 12, d[1] / l * 12]; return dash([a[0] - d[0], a[1] - d[1]], [b[0] + d[0], b[1] + d[1]]); } });
  def('מאונך ומקביל', { anc: 'hip', P: [LEG0, LEG1, LEG1], seg: [1, 1, 1], T: 4.4,
    ex: function (J, u, t, p) { return p.l1[0] > 170 ? pth('M' + f1(J.hip[0] - 10) + ' ' + f1(J.hip[1]) + 'v-10h10', ' stroke-width="1.2"') : ''; } });
  def('אלכסוני', { v: 'f', anc: 'foot', P: [CHOP0, CHOP1], T: 3.2, ex: function () { return dash([140, 28], [66, 104]) + pth('M70 94l-6 12 13-4', ' stroke-width="1.3"'); } });
  def('ברוחב הירכיים או הכתפיים', { v: 'f', anc: 'hip', P: [{ l1: [10, -10], l2: [10, -10] }, {}], seg: [1, 1.8], T: 4.4,
    ex: function (J) { var y = 134, a = J.An[0][0], b = J.An[1][0], y2 = J.HP[0][1] - 12; return ln([a, y], [b, y], ' stroke-width="1.2"') + ln([a, y - 3], [a, y + 3]) + ln([b, y - 3], [b, y + 3]) + ln([J.HP[0][0], y2], [J.HP[1][0], y2], ' stroke-width="1.2"') + ln([J.HP[0][0], y2 - 3], [J.HP[0][0], y2 + 3]) + ln([J.HP[1][0], y2 - 3], [J.HP[1][0], y2 + 3]); } });
  def('שכיבות סמיכה', { anc: 'foot', P: [PU, PD], mark: [['q', 'chest']], T: 3.2 });
  def('דחיפה, משיכה ולחיצה', { v: 'f', anc: 'foot', P: [{ a1: [-80, 80], a2: [-180, 180] }, { a1: [-172, 172], a2: [-176, 176] }], hold: 'bottle', T: 3.4 });
  def('הטיה וסיבוב', { v: 'f', anc: 'foot', P: [{}, { t: 14, a1: [8, 8], a2: [8, 8] }, { t: -14, a1: [-8, -8], a2: [-8, -8] }, {}, { sw: 2 }, { sw: -14 }, { sw: 2 }], T: 8 });
  def('אחיזה', { draw: sceneGrip, T: 3 });

  /* --- parts of the body --- */
  def('גו', { anc: 'foot', P: [{}, { t: 22 }], mark: [['s', 'hip', 'sh', 0]], T: 3.4 });
  def('ליבה', { anc: 'foot', P: [PF, K(PF, { t: 82 })], mark: [['s', 'hip', 'sh', 0]], T: 3 });
  def('ראש וצוואר', { v: 'f', anc: 'foot', P: [{ n: -20 }, { n: 20 }], mark: [['r', 'neck']], T: 3.4 });
  def('סנטר', { anc: 'foot', P: [{ n: -8 }, { n: 14 }], mark: [['r', 'chin']], T: 3 });
  def('כתף', { v: 'f', anc: 'foot', P: [{}, ARMS_OUT], mark: [['r', 'shoulder']], T: 3.4 });
  def('שכמות', { anc: 'foot', P: [{ a1: [85, 85], a2: [85, 85] }, { a1: [-40, -40], a2: [-100, -100] }], mark: [['r', 'upback']], T: 3.4 });
  def('זרוע, מרפק ואמה', { anc: 'foot', P: [CUR0, CUR1], hold: 'bottle', mark: [[['s', 'shoulder', 'elbow', 4.5, 0]], [['r', 'elbow']], [['s', 'elbow', 'hand', 0, 0]]], T: 3 });
  def('כף יד ואצבעות', { v: 'f', anc: 'foot', P: [{ a1: [-8, 140], a2: [-8, 160] }, { a1: [-8, 140], a2: [-8, 210] }, { a1: [-8, 140], a2: [-8, 160] }, { a1: [-8, 140], a2: [-8, 210] }], seg: [1, 1, 1, 1], tr: 0.9, T: 2.4, mark: [['r', 'hand1']] });
  def('חזה', { anc: 'foot', P: [{ a1: [70, 70], a2: [150, 150] }, { a1: [90, 90], a2: [90, 90] }], mark: [['r', 'chest']], T: 3 });
  def('בטן', { anc: 'foot', P: [K(BD, { a1: [100, 100], a2: [100, 100] }), K(BD, { t: -62, c: 3, a1: [100, 100], a2: [100, 100], n: 10 })], mark: [['r', 'belly']], T: 3 });
  def('גב עליון וגב תחתון', { anc: 'hip', P: [CAT, COW], mark: [[['r', 'upback']], [['r', 'lowback']]], T: 4.4 });
  var spineEx = function (J) { var s = '', i; for (i = 1; i <= 7; i++) { var f = i / 8, a = J.bz(f, -3.5), b = J.bz(f, 3.5); s += ln(a, b, ' stroke-width="1.4"'); } return s; };
  def('עמוד השדרה', { anc: 'hip', P: [CAT, COW], T: 4.4, ex: spineEx });
  def('חוליה', { anc: 'hip', P: [CAT, COW], T: 4.4, ex: function (J, u, t) { var k = (t % 2.4) / 2.4, s = spineEx(J), q = J.bz(0.1 + 0.8 * k, 0); return s + circ(q, 5, ' stroke-width="1.6"'); } });
  def('אגן', { anc: 'foot', P: [{ t: -10, c: -5, l1: [10, 10], l2: [-10, -10] }, { t: 10, c: 5, l1: [10, 10], l2: [-10, -10] }], mark: [['r', 'hip']], T: 3.4 });
  def('עצם הזנב', { anc: 'foot', P: [K(BD, { c: -3 }), K(BD, { c: 3, t: -97 })], mark: [['r', 'tail']], T: 3.4 });
  def('שרירי האגן', { anc: 'foot', P: [SQ0, SQ1], mark: [['r', 'glute']], T: 3.4 });
  def('ירך, ברך ושוק', { anc: 'hip', P: [{}, { l2: [-115, 0] }], mark: [[['s', 'hip0', 'knee0', 0, 0]], [['r', 'knee0']], [['s', 'knee0', 'ankle0', 0, 0]]], T: 3.4 });
  def('קרסול, עקב ובהונות', { anc: 'toe', P: [{}, { f: [38, 38] }], mark: [[['r', 'ankle']], [['r', 'heel']], [['r', 'toe']]], T: 3 });
  def('מפרק', { anc: 'foot', P: [CUR0, CUR1], mark: [['r', 'elbow']], T: 3,
    ex: function (J, u, t, p) { var c = J.E[0], s = '', n = Math.max(2, Math.round(p.a2[0] / 6)), i; for (i = 0; i <= n; i++) { var a = (i / n) * p.a2[0] * R; s += (i ? 'L' : 'M') + f1(c[0] + Math.sin(a) * 11) + ' ' + f1(c[1] + Math.cos(a) * 11); } return pth(s, ' stroke-width="1.1"'); } });
  def('סרעפת', { draw: sceneLungs('dia'), T: 6 });

  /* --- exercise names --- */
  def('חתול-פרה', { anc: 'hip', P: [CAT, COW], T: 4 });
  def('ציפור-כלב', { anc: 'hip', P: [Q, K(Q, { a1: [90, 0], a2: [90, 0], l1: [0, -95], l2: [-90, -95] }), Q, K(Q, { a1: [0, 90], a2: [0, 90], l1: [-95, 0], l2: [-95, -90] })], seg: [1, 1.6, 1, 1.6], T: 8 });
  def('תנוחת ילד', { anc: 'hip', P: [Q, CH, CH], seg: [1, 1, 1.6], T: 5 });
  def('פלאנק', { anc: 'foot', P: [K(Q, { dx: -33 }), PF, PF], seg: [1, 2.4, 1], T: 5 });
  def('פלאנק צד', { anc: 'foot', P: [PF, K(PF, { a1: [0, 180], a2: [90, 180], t: 80, l1: [-84, -84], l2: [-84, -84] })], T: 4.4 });
  def('דד באג', { anc: 'hip', P: [DBT, K(DBT, { a1: [-90, 180], a2: [-90, 180], l1: [180, 100], l2: [90, 100] }), DBT, K(DBT, { a1: [180, -90], a2: [180, -90], l1: [100, 180], l2: [100, 90] })], T: 6 });
  def('סופרמן', { anc: 'hip', P: [{ t: 90, a1: [90, 90], a2: [90, 90], l1: [-90, -90], l2: [-90, -90], f: [-90, -90] }, { t: 80, a1: [112, 112], a2: [112, 112], l1: [-112, -112], l2: [-112, -112], f: [-90, -90], n: -8 }], T: 3.6 });
  def('כפיפת בטן הפוכה', { anc: 'hip', P: [K(DBT, { a1: [90, 90], a2: [90, 90] }), K(DBT, { t: -100, a1: [90, 90], a2: [90, 90], l1: [200, 200], l2: [130, 130] })], T: 3.4 });
  def('אופניים באוויר', { anc: 'hip', gen: function (u) { var s = Math.sin(u * 2 * PI), c = Math.cos(u * 2 * PI); return { t: -75, a1: [-125, -125], a2: [-60, -60], l1: [150 + 28 * s, 150 - 28 * s], l2: [95 + 55 * c, 95 - 55 * c] }; }, T: 2.4 });
  def('סקוואט', { anc: 'foot', P: [SQ0, SQ1], T: 3.4 });
  def('סקוואט גביע', { anc: 'foot', P: [RACK, K(SQ1, RACK)], hold: 'bottle', T: 3.4 });
  def('סקוואט בולגרי', { anc: 'foot', P: [{ l1: [0, -30], l2: [0, -105], f: [90, -90] }, { t: 8, l1: [80, -45], l2: [-5, -167], f: [90, -90] }], prop: [['box', 38, 74, 30]], T: 3.8 });
  def('מכרע', { anc: 'foot', P: [{ l1: [0, 0], l2: [0, 0] }, { l1: [90, -22], l2: [0, -102], f: [90, 40] }], T: 3.6 });
  def('דדליפט', { anc: 'foot', P: [{}, HINGE], hold: 'bottle', T: 3.6 });
  def('דיפס', { anc: 'hand', P: [{ l1: [58, 58], l2: [58, 58], f: [140, 140] }, { a1: [-50, -50], a2: [55, 55], l1: [75, 75], l2: [75, 75], f: [140, 140] }], prop: [['chair', 66, 102, 24]], T: 3.4 });
  def('סיבוב רוסי', { anc: 'hip', P: [{ t: -28, l1: [135, 135], l2: [40, 40], f: [100, 100], a1: [85, 85], a2: [85, 85], sw: 6 }, { t: -28, l1: [135, 135], l2: [40, 40], f: [100, 100], a1: [85, 85], a2: [85, 85], sw: -6 }], hold: 'bottle', T: 2.8 });
  def('וודצ׳ופ (כריתת עץ)', { v: 'f', anc: 'foot', P: [CHOP0, CHOP1], hold: 'stick', T: 3.2 });
  def('תרסטר', { anc: 'foot', P: [K({ t: 30, l1: [78, 78], l2: [-8, -8] }, RACK), { a1: [180, 180], a2: [180, 180] }], hold: 'bottle', T: 3.6 });
  def('פולאובר', { anc: 'foot', P: [K(BD, { a1: [180, 180], a2: [180, 180] }), K(BD, { a1: [255, 255], a2: [255, 255] })], hold: 'bottle', T: 3.6 });
  def('הליכת חקלאי', { anc: 'foot', gen: walkGen(26, 6), hold: 'bottle', T: 1.6, ex: function (J, u) { var s = '', i, o = (u * 40) % 20; for (i = 0; i < 9; i++) s += ln([200 - i * 20 - o, G + 6], [200 - i * 20 - o + 8, G + 6], ' stroke-width="1"'); return s; } });
  def('בוקר טוב', { anc: 'foot', P: [{ a1: [-150, -150], a2: [60, 60] }, { t: 65, l1: [8, 8], l2: [-4, -4], a1: [-85, -85], a2: [125, 125], n: -35 }], T: 3.6 });
  def('עמידת חסידה ועמידת עץ', { v: 'f', anc: 'foot', P: [{}, TREE, TREE], seg: [1, 2.2, 1], T: 5 });
  def('הליכה עקב-אצבעות', { anc: 'foot', gen: walkGen(14, 8), T: 2.4, ex: function (J, u) { var s = '', i, o = (u * 32) % 16; for (i = 0; i < 12; i++) s += ln([200 - i * 16 - o, G + 6], [200 - i * 16 - o + 8, G + 6], ' stroke-width="1"'); return s; } });
  def('הקפת כתפיים עם מקל', { anc: 'foot', gen: function (u) { var a = 180 - 165 * Math.cos(u * 2 * PI); return { a1: [a, a], a2: [a, a] }; }, hold: 'stick', T: 4, mark: [['q', 'shoulder']] });
  def('ישיבת קיר', { anc: 'hip', P: [{}, WS, WS], seg: [1.3, 2.6, 0.9], T: 5, prop: [['wall', 92]] });
  def('הקשות רגליים', { anc: 'hip', P: [{ l1: [0, 55], l2: [0, 30] }, { l1: [55, 0], l2: [30, 0] }], prop: [['box', 124, 160, 13]], tr: 0.55, T: 1.4 });
  def('סיבובי אגן', { v: 'f', anc: 'foot', gen: function (u) { var d = Math.sin(u * 2 * PI) * 0.18; return { l1: [-d * 57 - 6, -d * 57 + 6], l2: [-d * 57 - 6, -d * 57 + 6], t: d * 30, a1: [-30, 30], a2: [-110, 110] }; }, T: 3.4, mark: [['q', 'hip']] });
  def('הרמות צד והרמות קדמיות', { v: 'f', anc: 'foot', P: [{}, { a1: [-88, 88], a2: [-88, 88] }], hold: 'bottle', T: 3 });
  def('חתירה בהטיה', { anc: 'foot', P: [K(BEND, { a1: [0, 0] }), K(BEND, { a1: [-100, -100], a2: [-5, -5] })], hold: 'bottle', T: 3 });
  def('כפיפת מרפקים', { anc: 'foot', P: [CUR0, CUR1], hold: 'bottle', T: 3 });
  def('פשיטת טריצפס מעל הראש', { anc: 'foot', P: [{ a1: [180, 180], a2: [-20, -20] }, { a1: [180, 180], a2: [-180, -180] }], hold: 'bottle', T: 3.2 });

  /* --- muscles --- */
  def('שריר האגן הגדול (גלוטאוס מקסימוס)', { anc: 'foot', P: [BD, BU], mark: [['r', 'glute']], T: 3.2 });
  def('הירך האחורית (המסטרינגס)', { anc: 'foot', P: [{}, HINGE], hold: 'bottle', mark: [['s', 'hip', 'knee', -4.5, 0]], T: 3.6 });
  def('פשטי עמוד השדרה', { anc: 'hip', P: [{ t: 90, a1: [90, 90], a2: [90, 90], l1: [-90, -90], l2: [-90, -90], f: [-90, -90] }, { t: 80, a1: [112, 112], a2: [112, 112], l1: [-112, -112], l2: [-112, -112], f: [-90, -90], n: -8 }], mark: [['s', 'lowback', 'upback', 0]], T: 3.6 });
  def('שריר הבטן הרוחבי (הליבה העמוקה)', { anc: 'hip', P: [DBT, K(DBT, { a1: [-90, 180], a2: [-90, 180], l1: [180, 100], l2: [90, 100] }), DBT, K(DBT, { a1: [180, -90], a2: [180, -90], l1: [100, 180], l2: [100, 90] })], mark: [['q', 'belly']], T: 6 });
  def('שריר הבטן הישר ("קוביות")', { anc: 'foot', P: [K(BD, { a1: [100, 100], a2: [100, 100] }), K(BD, { t: -62, c: 3, a1: [100, 100], a2: [100, 100], n: 10 })], mark: [['s', 'belly', 'chest', 0]], T: 3 });
  def('הטרפז ושרירי השכמות', { anc: 'foot', P: [{ a1: [85, 85], a2: [85, 85] }, { a1: [-40, -40], a2: [-100, -100] }], mark: [['r', 'upback'], ['q', 'neck']], T: 3.4 });
  def('מכופפי הירך (איליופסואס)', { anc: 'hip', P: [LEG0, LEG1, LEG1], seg: [1, 1, 1], mark: [['r', 'hipF']], T: 4.4 });
  def('הירך הקדמית (ארבע ראשי)', { anc: 'foot', P: [SQ0, SQ1], mark: [['s', 'hip', 'knee', 4.5, 0]], T: 3.4 });
  def('שרירי הבטן האלכסוניים', { v: 'f', anc: 'foot', P: [CHOP0, CHOP1], mark: [['r', 'belly', -11, 4], ['r', 'belly', 11, 4]], T: 3.2 });
  def('הכתף הקדמית', { anc: 'foot', P: [{}, { a1: [90, 90], a2: [90, 90] }], hold: 'bottle', mark: [['r', 'shoulder', 5, 0]], T: 3 });
  def('שרירי האגן הצדדיים (גלוטאוס מדיוס)', { v: 'f', anc: 'foot', P: [{}, { l1: [-4, 40], l2: [-4, 40] }], mark: [['r', 'hip1', 9, -2]], T: 3.4 });
  def('שריר הגב הרחב (לטיסימוס)', { v: 'f', anc: 'foot', P: [{ a1: [-172, 172], a2: [-176, 176] }, { a1: [-35, 35], a2: [-175, 175] }], hold: 'stick', mark: [['r', 'chest', -17, 12], ['r', 'chest', 17, 12]], T: 3.4 });
  def('שרירי השוק (תאומים וסוליאוס)', { anc: 'toe', P: [{}, { f: [38, 38] }], mark: [['s', 'knee', 'ankle', -4.5, 0]], T: 3 });
  def('שרירי החזה', { anc: 'foot', P: [PU, PD], mark: [['r', 'chest']], T: 3.2 });
  def('השריר התלת-ראשי (זרוע אחורית)', { anc: 'foot', P: [{ a1: [180, 180], a2: [-20, -20] }, { a1: [180, 180], a2: [-180, -180] }], hold: 'bottle', mark: [['s', 'shoulder', 'elbow', -4.5, 0]], T: 3.2 });
  def('שרירי יציבות הקרסול', { anc: 'foot', P: [{ l1: [0, 70], l2: [0, 5], t: 2 }, { l1: [0, 70], l2: [0, 5], t: -2 }], mark: [['r', 'ankle0']], T: 2.2 });
  def('שרירי השרוול המסובב (כתף עמוקים)', { v: 'f', anc: 'foot', gen: function (u) { var x = Math.sin(u * 2 * PI) * 80, s = Math.sin(x * R), sg = s < 0 ? -1 : 1, f = Math.max(0.12, Math.abs(s)); return { a1: [-4, 4], a2: [sg * 90, -sg * 90], fs: [f, f] }; }, mark: [['q', 'shoulder']], T: 3.4 });
  def('הכתף הצדדית', { v: 'f', anc: 'foot', P: [{}, { a1: [-88, 88], a2: [-88, 88] }], hold: 'bottle', mark: [['r', 'shoulder']], T: 3 });
  def('שריר המותן המרובע', { v: 'f', anc: 'foot', P: [{}, { t: 14, a1: [8, 8], a2: [8, 8] }, { t: -14, a1: [-8, -8], a2: [-8, -8] }], mark: [['r', 'belly', -12, 6], ['r', 'belly', 12, 6]], T: 5 });
  def('השריר הדו-ראשי (זרוע קדמית)', { anc: 'foot', P: [CUR0, CUR1], hold: 'bottle', mark: [['s', 'shoulder', 'elbow', 4.5, 0]], T: 3 });
  def('שרירי האמה והאחיזה', { anc: 'foot', gen: walkGen(26, 6), hold: 'bottle', mark: [['s', 'elbow', 'hand', 0, 0]], T: 1.6, ex: function (J, u) { var s = '', i, o = (u * 40) % 20; for (i = 0; i < 9; i++) s += ln([200 - i * 20 - o, G + 6], [200 - i * 20 - o + 8, G + 6], ' stroke-width="1"'); return s; } });
  def('הכתף האחורית', { anc: 'foot', P: [K(BEND, { a1: [0, 0] }), K(BEND, { a1: [-70, -70], a2: [-80, -80] })], hold: 'bottle', mark: [['r', 'shoulder', -6, -4]], T: 3 });
  def('שרירי הירך הפנימית', { v: 'f', anc: 'foot', P: [{ l1: [-28, 28], l2: [-28, 28] }, { l1: [-75, 75], l2: [0, 0] }], mark: [['s', 'hip0', 'knee0', 5, 0], ['s', 'hip1', 'knee1', -5, 0]], T: 3.6 });
  def('שרירי הצוואר', { v: 'f', anc: 'foot', P: [{ n: -20 }, { n: 20 }], mark: [['r', 'neck', -5, 0], ['r', 'neck', 5, 0]], T: 3.4 });
  def('הסרעפת ושרירי הנשימה', { draw: sceneLungs('dia'), T: 6 });
  ['חזרה', 'עצירה (החזקה)', 'על ארבע', 'ניטרלי', 'קימור ועיגול הגב', 'יציבות', 'גרסה קלה וגרסה קשה', 'שכיבות סמיכה', 'בטן', 'גב עליון וגב תחתון', 'עמוד השדרה', 'חוליה', 'עצם הזנב', 'חתול-פרה', 'ציפור-כלב', 'תנוחת ילד', 'פלאנק', 'פלאנק צד',
    'דד באג', 'סופרמן', 'כפיפת בטן הפוכה', 'אופניים באוויר', 'פולאובר', 'ליבה', 'מאונך ומקביל', 'מכופפי הירך (איליופסואס)', 'פשטי עמוד השדרה', 'שריר האגן הגדול (גלוטאוס מקסימוס)', 'שרירי החזה', 'שריר הבטן הרוחבי (הליבה העמוקה)', 'שריר הבטן הישר ("קוביות")', 'קו ישר', 'איזומטרי', 'ישיבת קיר', 'סיבוב רוסי', 'דיפס']
    .forEach(function (k) { if (SP[k]) SP[k].z = 1.3; });
  Object.keys(SP).forEach(function (k) { setup(SP[k]); });

  /* ---------------- the cards ---------------- */
  var live = [], obs = null, raf = 0, last = 0;
  function stroke() { return ' fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'; }
  function frame(title, u, t) { var S = SP[title]; return S ? body(S, u, t) : ''; }
  function render(svg, now) {
    var S = SP[svg.getAttribute('data-a')]; if (!S) return;
    var t = now / 1000, u = (t / S.T) % 1;
    svg.firstChild.innerHTML = body(S, u, t);
  }
  function loop(now) {
    raf = 0; if (!live.length) return;
    if (now - last > 30) { last = now; live.forEach(function (s) { render(s, now); }); }
    raf = requestAnimationFrame(loop);
  }
  function stop() { if (obs) { obs.disconnect(); obs = null; } live = []; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function attach(list) {
    stop();
    var els = Array.prototype.slice.call(list.querySelectorAll('svg.gt-an'));
    els.forEach(function (svg) { svg.innerHTML = '<g' + stroke() + '></g>'; render(svg, (SP[svg.getAttribute('data-a')] || { T: 3 }).T * 1000 * 0.45); });
    if (!window.IntersectionObserver) { live = els; raf = requestAnimationFrame(loop); return; }
    obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var i = live.indexOf(e.target); if (e.isIntersecting) { if (i < 0) live.push(e.target); } else if (i >= 0) live.splice(i, 1); });
      if (live.length && !raf) raf = requestAnimationFrame(loop);
    }, { root: list, rootMargin: '60px' });
    els.forEach(function (s) { obs.observe(s); });
  }
  window.HTGlossAnim = { has: function (t) { return !!SP[t]; }, attach: attach, stop: stop, frame: frame, keys: function () { return Object.keys(SP); } };
})();
