/* doll.js - the 3D-look doll that performs the exercise (SVG, no dependencies). Same pose data and IK as figure.js, new rendering.
 *
 * A scene = { view:'side'|'front', props:[...], poses:[...] , hold:bool }
 * The figure faces +x (screen right) in side view. Floor is at y = 205 in a 400x240 viewBox.
 *
 * Pose fields (all optional, defaults = relaxed standing):
 *   h:[x,y]   hip position            t: torso lean in degrees (side: + = forward, front: + = toward screen right)
 *   n: head tilt relative to torso     f,g: near/far foot angle (side view, 90 = flat, pointing forward)
 *   Arms:  a / b = absolute wrist target [x,y] (near / far; front view: left / right)
 *          ap / bp = polar [angle, length] from shoulder, angle measured from straight down, + = forward (side) or to screen right (front)
 *   Legs:  k / l = absolute ankle target, kp / lp = polar from hip, same angle convention
 *   c: spine curl in degrees (side view). + = rounded back (flexion, chin toward chest), - = arched back (extension), 0 = straight.
 *      The doll is modelled in plasticine: the spine keeps its length while it bends (clay volume is conserved), so the shoulders
 *      come closer to the hips when the back rounds, the head follows the end of the spine, and belly folds / a shoulder-blade bump appear.
 *   lf: (front view) thigh length factor - the thigh points at the viewer when seated, so it is drawn short (e.g. 0.3)
 *   cap: caption shown while this pose is the current target,  br: 'in' | 'out' breathing cue
 *   w: relative duration of the segment that STARTS at this pose,  hd: fraction of that segment spent holding still
 * Limbs are solved with two-bone IK, so feet and hands stay planted on the floor / props.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', G = 205, RAD = Math.PI / 180;
  var UID = 0;
  var L = { torso: 56, head: 21, ua: 30, fa: 28, th: 44, sh: 42, foot: 15 };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerp2(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
  function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function pol(base, ang, len) { return [base[0] + len * Math.sin(ang * RAD), base[1] + len * Math.cos(ang * RAD)]; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  function ik(p0, p1, l1, l2, bend) {
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.sqrt(dx * dx + dy * dy), maxd = l1 + l2 - 0.01;
    var ex = p1[0], ey = p1[1];
    if (d > maxd) { var s = maxd / d; dx *= s; dy *= s; d = maxd; ex = p0[0] + dx; ey = p0[1] + dy; }
    if (d < 0.01) d = 0.01;
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    var h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    var ux = dx / d, uy = dy / d;
    return { mid: [p0[0] + ux * a - uy * h * bend, p0[1] + uy * a + ux * h * bend], end: [ex, ey] };
  }

  var SIDE_DEF = { h: [200, G - 89], t: 0, n: 0, ap: [0, 56], kp: [0, 84], f: 90, g: 90 };
  function resolveSide(p) {
    var q = Object.assign({}, SIDE_DEF, p), th = q.t * RAD, h = q.h;
    var sh = [h[0] + L.torso * Math.sin(th), h[1] - L.torso * Math.cos(th)];
    var a = q.a || pol(sh, q.ap[0], q.ap[1]);
    var b = q.b || (q.bp ? pol(sh, q.bp[0], q.bp[1]) : [a[0] + 5, a[1] - 1]);
    var k = q.k || pol(h, q.kp[0], q.kp[1]);
    var l = q.l || (q.lp ? pol(h, q.lp[0], q.lp[1]) : [k[0] + 4, k[1]]);
    return { h: h, t: q.t, n: q.n, c: q.c || 0, a: a, b: b, k: k, l: l, f: q.f, g: q.g, cap: q.cap, br: q.br, w: q.w || 1, hd: q.hd || 0 };
  }

  var FRONT_DEF = { h: [200, G - 89], t: 0, n: 0, ap: [-6, 56], bp: [6, 56], kp: [-2, 84], lp: [2, 84] };
  function frontShoulders(h, t) {
    var th = t * RAD, s = [h[0] + L.torso * Math.sin(th), h[1] - L.torso * Math.cos(th)];
    var c = Math.cos(th), sn = Math.sin(th);
    return { s: s, sl: [s[0] - 16.5 * c, s[1] - 16.5 * sn], sr: [s[0] + 16.5 * c, s[1] + 16.5 * sn] };
  }
  function resolveFront(p) {
    var q = Object.assign({}, FRONT_DEF, p), h = q.h, fs = frontShoulders(h, q.t);
    var hl = [h[0] - 10, h[1]], hr = [h[0] + 10, h[1]];
    return {
      h: h, t: q.t, n: q.n,
      a: q.a || pol(fs.sl, q.ap[0], q.ap[1]), b: q.b || pol(fs.sr, q.bp[0], q.bp[1]),
      k: q.k || pol(hl, q.kp[0], q.kp[1]), l: q.l || pol(hr, q.lp[0], q.lp[1]),
      lf: q.lf, cap: q.cap, br: q.br, w: q.w || 1, hd: q.hd || 0
    };
  }

  function mix(r0, r1, u) {
    var o = {};
    ['h', 'a', 'b', 'k', 'l'].forEach(function (key) { o[key] = lerp2(r0[key], r1[key], u); });
    ['t', 'n', 'f', 'g', 'c', 'lf'].forEach(function (key) { if (r0[key] !== undefined) o[key] = lerp(r0[key], r1[key], u); });
    /* a foot that steps FORWARD along the floor is lifted and placed (an arc, toes leading); a foot that moves backward stays down and slides, like a stance foot */
    if (r0.f !== undefined) ['k', 'l'].forEach(function (key) {
      var dx = r1[key][0] - r0[key][0];
      if (r0[key][1] >= G - 8 && r1[key][1] >= G - 8 && dx > 10) o[key] = [o[key][0], o[key][1] - 9 * Math.sin(Math.PI * u) * Math.min(1, dx / 30)];
    });
    return o;
  }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function P(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); }
  function f1(p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
  /* smooth curve through the points: straight to the first midpoint, quadratics through the middle, straight to the end */
  function smooth(pts) {
    if (pts.length < 3) return P(pts);
    var d = 'M' + f1(pts[0]) + 'L' + f1(lerp2(pts[0], pts[1], 0.5));
    for (var i = 1; i < pts.length - 1; i++) d += 'Q' + f1(pts[i]) + ' ' + f1(lerp2(pts[i], pts[i + 1], 0.5));
    return d + 'L' + f1(pts[pts.length - 1]);
  }

  /* The spine is an arc of constant length LT. Its tangent turns from (t - c/2) at the hips to (t + c/2) at the shoulders,
   * so the hip->shoulder chord keeps the direction t and c = 0 gives exactly the old straight torso. */
  var SEG = 6;
  function spinePts(h, t, c) {
    var pts = [h], p = h, step = L.torso / SEG;
    for (var i = 0; i < SEG; i++) {
      var phi = (t - c / 2 + c * (i + 0.5) / SEG) * RAD;
      p = [p[0] + step * Math.sin(phi), p[1] - step * Math.cos(phi)];
      pts.push(p);
    }
    return pts;
  }

  /* Plasticine surface: a tile of pits and thumbprint swirls, drawn once on a canvas and reused by every doll. */
  var TILE = null;
  function clayTile() {
    if (TILE !== null) return TILE;
    TILE = '';
    try {
      var W = 192, cv = document.createElement('canvas'), g;
      cv.width = cv.height = W; g = cv.getContext('2d');
      var seed = 7, rnd = function () { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      var wrap = function (x, y, fn) { for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) fn(x + i * W, y + j * W); };
      var n, x, y, r, k, a0;
      for (n = 0; n < 70; n++) {
        x = rnd() * W; y = rnd() * W; r = 0.8 + rnd() * 2.2;
        wrap(x, y, function (px, py) {
          g.fillStyle = 'rgba(90,50,45,.045)'; g.beginPath(); g.arc(px, py, r, 0, 6.2832); g.fill();
          g.fillStyle = 'rgba(255,248,240,.05)'; g.beginPath(); g.arc(px + r * 0.5, py + r * 0.5, r * 0.6, 0, 6.2832); g.fill();
        });
      }
      for (n = 0; n < 0; n++) {
        x = rnd() * W; y = rnd() * W; a0 = rnd() * 6.28;
        wrap(x, y, function (px, py) {
          for (k = 0; k < 5; k++) {
            g.strokeStyle = k % 2 ? 'rgba(255,245,235,.13)' : 'rgba(70,30,25,.09)'; g.lineWidth = 1.3;
            g.beginPath(); g.arc(px, py, 4 + k * 2.4, a0 + k * 0.35, a0 + k * 0.35 + 3.4); g.stroke();
          }
        });
      }
      TILE = cv.toDataURL('image/png');
    } catch (e) { TILE = ''; }
    return TILE;
  }

  /* ---------- ground (hidden by the page css, kept so the bare svg still has a floor) ---------- */
  function drawGround(g) {
    el('rect', { x: -20, y: G, width: 440, height: 40, 'class': 'f-ground' }, g);
    el('line', { x1: -20, y1: G, x2: 420, y2: G, 'class': 'f-floor' }, g);
  }

  function Figure(svg, scene) {
    var view = scene.view || 'side';
    var resolve = view === 'front' ? resolveFront : resolveSide;
    var poses = scene.poses.map(resolve);
    var props = scene.props || [];
    var has = function (name) { return props.some(function (p) { return p === name || (p && p.type === name); }); };
    var uid = 'dl' + (++UID), mir = 1, RS = 1;   /* RS = radius scale of the clay primitives: 1 while the props are drawn, 1.15 for the doll's body (set below) */
    svg.setAttribute('viewBox', '0 -26 400 266');
    svg.setAttribute('role', 'img');
    svg.textContent = '';

    /* ---- plasticine: every body part is one flat-coloured clay shape; a lighting filter inflates it into a soft, round, matte form ---- */
    var defs = el('defs', {}, svg);
    /* site palette (rose / mauve / ink): lit colour of each material, near side and a slightly darker far side */
    var COL = {
      skin: { near: '#efb9a0', far: '#d29c85' },
      top: { near: '#e8a3b0', far: '#c4808d' },
      pants: { near: '#8c7283', far: '#6a5260' },
      hair: { near: '#4a3b37', far: '#4a3b37' },
      ear: { near: '#e6a98f', far: '#e6a98f' }
    };
    /* the props are clay too, in the same palette family: warm wood, cream bedding, rose cushions, teal blanket, mauve cabinets */
    var PROPCOL = { wood: '#c9996d', woodDk: '#a97a55', woodIn: '#b98a60', mattress: '#f4e4de', band: '#e2c9cf', pillow: '#fff6f1', blanket: '#8fb5bf', fold: '#b9d4da',
      cushion: '#d98fa0', stone: '#eadfd8', plaster: '#e3b7b3', plasterDk: '#cf9f9f', metal: '#c8c0c6', brass: '#d6aa4f', mat: '#b79ab0', rope: '#c49a66',
      cabinet: '#cba7b6', cabDk: '#b890a2', step: '#cdb3ae', bottle: '#a8d3de', label: '#e8a3b0', cap: '#6a5260' };
    Object.keys(PROPCOL).forEach(function (k) { COL[k] = { near: PROPCOL[k], far: PROPCOL[k] }; });
    var INK = '#3a2f2d', tileUrl = clayTile(), gN = 0, lights = [], WIDE = [-30, -70, 460, 300];
    var fl = el('filter', { id: uid + 'bl', x: '-30%', y: '-300%', width: '160%', height: '700%' }, defs);
    el('feGaussianBlur', { stdDeviation: '4' }, fl);

    var root = el('g', {}, svg), stage = el('g', {}, root);
    drawGround(stage);
    clayProps();
    var bedP = props.filter(function (p) { return p && p.type === 'bed'; })[0];
    var shadow = el('ellipse', { cy: G + 3, rx: 46, ry: 5.5, fill: 'rgba(70,40,50,.30)', filter: 'url(#' + uid + 'bl)' }, stage);
    if (bedP) { shadow.setAttribute('cx', bedP.x + bedP.w / 2); shadow.setAttribute('rx', bedP.w / 2 + 6); }
    var ropeCfg = props.filter(function (p) { return p && p.type === 'rope'; })[0];
    var rope = ropeCfg ? el('path', { fill: 'none', stroke: COL.rope.near, 'stroke-width': 4.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, clayGroup(1.0, 4, WIDE).g) : null;
    if (ropeCfg) clay(clayGroup(1.2, 4.5, [ropeCfg.from[0] - 14, ropeCfg.from[1] - 14, 28, 28]), 'brass', 'near').set(circ(ropeCfg.from, 4.6));
    var spine = has('spine') ? stick() : null;

    /* A group of flat shapes: the blurred silhouette is a height map lit from the top-left (round, pillowy volume),
     * plus a faint matte sheen and a soft shadow on whatever lies beneath. std = how round, scale = how deep. */
    function clayGroup(std, scale, reg) {
      var id = uid + 'cg' + (gN++);
      var f = el('filter', reg ? { id: id, filterUnits: 'userSpaceOnUse', x: reg[0], y: reg[1], width: reg[2], height: reg[3], 'color-interpolation-filters': 'sRGB' } : { id: id, x: '-30%', y: '-30%', width: '160%', height: '160%', 'color-interpolation-filters': 'sRGB' }, defs);
      el('feGaussianBlur', { 'in': 'SourceAlpha', stdDeviation: std, result: 'b' }, f);
      var dl = el('feDiffuseLighting', { 'in': 'b', surfaceScale: scale, diffuseConstant: 1.1, 'lighting-color': '#ffffff', result: 'd' }, f);
      lights.push(el('feDistantLight', { azimuth: 225, elevation: 58 }, dl));
      el('feComposite', { 'in': 'SourceGraphic', in2: 'd', operator: 'arithmetic', k1: 0.8, k2: 0.38, k3: 0, k4: 0, result: 'lit' }, f);
      var sl = el('feSpecularLighting', { 'in': 'b', surfaceScale: scale, specularConstant: 0.3, specularExponent: 14, 'lighting-color': '#fff4ec', result: 's' }, f);
      lights.push(el('feDistantLight', { azimuth: 225, elevation: 58 }, sl));
      el('feComposite', { 'in': 's', in2: 'lit', operator: 'atop', result: 'out' }, f);
      el('feGaussianBlur', { 'in': 'SourceAlpha', stdDeviation: 2.2, result: 'sb' }, f);
      el('feOffset', { 'in': 'sb', dx: 1.2, dy: 2.4, result: 'so' }, f);
      el('feFlood', { 'flood-color': '#5a3a48', 'flood-opacity': 0.3, result: 'sf' }, f);
      el('feComposite', { 'in': 'sf', in2: 'so', operator: 'in', result: 'sd' }, f);
      var mg = el('feMerge', {}, f); el('feMergeNode', { 'in': 'sd' }, mg); el('feMergeNode', { 'in': 'out' }, mg);
      var g = el('g', { filter: 'url(#' + id + ')' }, stage), T = null;
      if (tileUrl) {
        var pid = id + 't', pt = el('pattern', { id: pid, patternUnits: 'userSpaceOnUse', width: 96, height: 96 }, defs);
        el('image', { href: tileUrl, width: 96, height: 96 }, pt);
        T = { fill: 'url(#' + pid + ')', mv: function (p) { pt.setAttribute('patternTransform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')'); } };
      }
      return { g: g, T: T };
    }
    /* a clay shape of one material inside a group, with the fingerprint texture on top; d is any number of capsules/blobs joined */
    function clay(grp, mat, side, edge) {
      var p = el('path', edge ? { fill: COL[mat][side], stroke: edge, 'stroke-width': 0.7, 'stroke-linejoin': 'round' } : { fill: COL[mat][side] }, grp.g), q = grp.T ? el('path', { fill: grp.T.fill }, grp.g) : null;
      return { set: function (d) { p.setAttribute('d', d); if (q) q.setAttribute('d', d); } };
    }

    /* ---- clay geometry: all pieces are wound the same way, so they merge into one silhouette ---- */
    RS = 1.15;   /* the doll is chunky clay: every body radius is scaled by this (the props above were drawn at 1) */
    function circ0(c, r) { return 'M' + (c[0] - r).toFixed(1) + ' ' + c[1].toFixed(1) + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r).toFixed(1) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r).toFixed(1) + ' 0Z'; }
    /* a tapered capsule from a circle (c0, r0) to a circle (c1, r1) */
    function circ(c, r) { return circ0(c, r * RS); }
    function hull(c0, r0, c1, r1) { return hullR(c0, r0 * RS, c1, r1 * RS); }
    function hullR(c0, r0, c1, r1) {
      var dx = c1[0] - c0[0], dy = c1[1] - c0[1], D = Math.sqrt(dx * dx + dy * dy);
      if (D < 0.05 || D <= Math.abs(r0 - r1)) return circ0(r0 >= r1 ? c0 : c1, Math.max(r0, r1));
      var phi = Math.atan2(dy, dx), al = Math.acos((r0 - r1) / D), a = phi + al, b = phi - al;
      function q(c, r, t) { return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]; }
      return 'M' + f1(q(c0, r0, a)) + 'L' + f1(q(c1, r1, a)) + 'A' + r1 + ' ' + r1 + ' 0 ' + (al > Math.PI / 2 ? 1 : 0) + ' 0 ' + f1(q(c1, r1, b)) +
        'L' + f1(q(c0, r0, b)) + 'A' + r0 + ' ' + r0 + ' 0 ' + (al < Math.PI / 2 ? 1 : 0) + ' 0 ' + f1(q(c0, r0, a)) + 'Z';
    }
    function dirv(a) { return [Math.cos(a), Math.sin(a)]; }

    /* A bare foot: heel, arch, ball of the foot, big toe and the other toes stepping back behind it.
     * fx = unit vector from the ankle toward the toes, up = the direction of the top of the foot. */
    function footD(A, fx, up) {
      var S0 = [A[0] - up[0] * 4.2, A[1] - up[1] * 4.2];
      function pt(f, u) { return [S0[0] + fx[0] * f + up[0] * u, S0[1] + fx[1] * f + up[1] * u]; }
      var he = pt(-3.2, 3.8), mi = pt(8.5, 2.9), ba = pt(13.2, 2.7), t1 = pt(18.8, 2.1), t2 = pt(16.7, 3.9), t3 = pt(14.7, 5.1);
      return hullR(A, 4.4, mi, 3.2) + hullR(he, 3.9, mi, 3.2) + hullR(mi, 3.2, ba, 3.0) + hullR(ba, 3.0, t1, 2.3) + circ0(t2, 1.7) + circ0(t3, 1.5);
    }

    /* A real hand: palm, four fingers (two joints each) and a thumb.
     * mode 'open' = spread fingers pressing a surface, 'relaxed' = loose and slightly curled, 'fist' = gripping (centred on `end`). */
    function handD(end, e, mode, side, wide) {
      var n = [e[1], -e[0]], ang = Math.atan2(e[1], e[0]), W, d = '';
      function pt(f, u) { return [W[0] + e[0] * f + n[0] * u, W[1] + e[1] * f + n[1] * u]; }
      if (mode === 'fist') {
        /* a closed hand around a bottle or stick: a rounded mass with four finger knuckles stacked across the front */
        W = [end[0] - e[0] * 5.5, end[1] - e[1] * 5.5];
        d = hull(W, 2.9, end, 4.9) + hull(end, 4.9, [end[0] + e[0] * 2, end[1] + e[1] * 2], 4.4);
        [-4.2, -1.4, 1.4, 4.2].forEach(function (u) { d += circ([end[0] + e[0] * 3.6 + n[0] * u, end[1] + e[1] * 3.6 + n[1] * u], 1.9); });
        return { d: d + circ([end[0] - e[0] * 1 + n[0] * 5.4 * side, end[1] - e[1] * 1 + n[1] * 5.4 * side], 2.2), ink: '' };
      }
      W = [end[0] - e[0] * 4.5, end[1] - e[1] * 4.5];
      /* a soft, slightly curved hand: wrist, palm and fingers together as ONE smooth tapering form (no spiky fingers),
       * a thumb lying along the side, and fine grooves where the fingers meet. wide < 1 = a hand seen edge-on (thinner). */
      var open = mode === 'open', cv = open ? [0, 1, 3, 5, 8] : [3, 7, 12, 18, 26], seg = [5, 4.6, 4.4, 3.8, 3.2], rad = [2.9, 4.1, 4.1, 3.7, 3.2, 2.5].map(function (r, k) { return k === 0 ? r : r * (0.78 + 0.22 * wide); });
      var P = [W], ang2 = [], aa = ang;
      for (var k = 0; k < 5; k++) { aa = ang + cv[k] * RAD; ang2.push(aa); P.push([P[k][0] + seg[k] * Math.cos(aa), P[k][1] + seg[k] * Math.sin(aa)]); }
      for (k = 0; k < 5; k++) d += hull(P[k], rad[k], P[k + 1], rad[k + 1]);
      var ink = '';
      [-1.5, 0, 1.5].forEach(function (u) {
        var line = '';
        for (var j = 2; j < 6; j++) {
          var aj = ang2[Math.min(j, 4)], nx = Math.sin(aj), ny = -Math.cos(aj), q = P[j], t = u * (rad[j] / 4.1) * wide * 1.1, shrink = j === 5 ? 0.6 : 1;
          line += (line ? 'L' : 'M') + f1([q[0] + nx * t * shrink, q[1] + ny * t * shrink]);
        }
        ink += line;
      });
      var ta = ang + side * (open ? 24 : 18) * RAD, T0 = [P[1][0] + n[0] * side * 2.6, P[1][1] + n[1] * side * 2.6], T1 = [T0[0] + 4.6 * Math.cos(ta), T0[1] + 4.6 * Math.sin(ta)], T2 = [T1[0] + 3.8 * Math.cos(ta - side * 0.12), T1[1] + 3.8 * Math.sin(ta - side * 0.12)];
      return { d: d + hull(T0, 2.4, T1, 2) + hull(T1, 2, T2, 1.5), ink: ink };
    }
    /* the hand pose: grips what is held, lies flat on a surface when the forearm points down onto one, otherwise hangs relaxed */
    var holds = has('bottle') || has('broom') || has('rope') || has('spine'), sinkP = props.filter(function (p) { return p && p.type === 'sink'; })[0];
    function handMode(mid, end) {
      if (holds) return 'fist';
      var dx = end[0] - mid[0], dy = end[1] - mid[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var onSink = sinkP && Math.abs(end[1] - (G - (sinkP.h || 88) - 4)) < 8;
      return view === 'side' && (end[1] > G - 52 || onSink) ? 'open' : 'relaxed';
    }
    /* one arm = sleeve + skin (forearm, hand). Returns the two path strings. */
    function armD(s0, mid, end, near) {
      var dx = end[0] - mid[0], dy = end[1] - mid[1], l = Math.sqrt(dx * dx + dy * dy) || 1, e = [dx / l, dy / l], mode = handMode(mid, end);
      if (mode === 'open' && !(Math.abs(dx) > 3 * Math.abs(dy) && dx < 0)) e = [1, 0];
      /* a relaxed hand hangs: it droops toward straight down instead of following the slant of the forearm */
      if (mode === 'relaxed') { var wx = e[0] * 0.35, wy = e[1] * 0.35 + 0.65, wl = Math.sqrt(wx * wx + wy * wy); e = [wx / wl, wy / wl]; }
      var wr = mode === 'fist' ? [end[0] - e[0] * 5.5, end[1] - e[1] * 5.5] : [end[0] - e[0] * 4.5, end[1] - e[1] * 4.5];
      return {
        sleeve: hull(s0, near ? 5.2 : 4.8, mid, near ? 4.2 : 3.9),
        skin: hull(mid, near ? 3.6 : 3.4, wr, near ? 2.8 : 2.6), hand: handD(end, e, mode, view === 'front' ? (near ? 1 : -1) : 1, view === 'front' ? 1 : 0.5)
      };
    }
    function legD(h0, mid, end, near, front) {
      if (front) return { pants: hull(h0, 6.4, mid, 5.4) + hull(mid, 5.4, end, 3.9) }; return { pants: hull(h0, near ? 7.8 : 7.2, mid, near ? 5.6 : 5.2) + hull(mid, near ? 5.6 : 5.2, end, near ? 3.9 : 3.7) }; }

    /* ---- clay props: the furniture and gear are made of the same plasticine as the doll ---- */
    /* rounded rectangle path; r = one radius or [top-left, top-right, bottom-right, bottom-left] */
    function rr(x, y, w, h, r) {
      var m = Math.min(w, h) / 2, c = (typeof r === 'number' ? [r, r, r, r] : r).map(function (v) { return Math.min(v, m); });
      return 'M' + (x + c[0]) + ' ' + y + 'H' + (x + w - c[1]) + 'A' + c[1] + ' ' + c[1] + ' 0 0 1 ' + (x + w) + ' ' + (y + c[1]) +
        'V' + (y + h - c[2]) + 'A' + c[2] + ' ' + c[2] + ' 0 0 1 ' + (x + w - c[2]) + ' ' + (y + h) + 'H' + (x + c[3]) +
        'A' + c[3] + ' ' + c[3] + ' 0 0 1 ' + x + ' ' + (y + h - c[3]) + 'V' + (y + c[0]) + 'A' + c[0] + ' ' + c[0] + ' 0 0 1 ' + (x + c[0]) + ' ' + y + 'Z';
    }
    function area(x, y, w, h) { return [x - 14, y - 14, w + 28, h + 28]; }
    function put(grp, mat, d) { clay(grp, mat, 'near').set(d); }
    /* a clay rod (broom handle, spine stick) whose ends are moved every frame */
    function stick() { return el('line', { stroke: COL.wood.near, 'stroke-width': 6, 'stroke-linecap': 'round' }, clayGroup(1.3, 5, WIDE).g); }

    function clayProps() {
      props.forEach(function (p) {
        if (typeof p === 'string') return;
        var k = p.type, A, B, C, x, w, h, i;
        if (k === 'bed') {
          x = p.x; w = p.w; h = p.h || 40;
          var head = p.pillow !== false, top = G - h;
          A = clayGroup(1.5, 6, area(x - 10, top - 46, w + 20, h + 50));      /* wooden frame: chunky legs, deep side rail, headboard and footboard with inset panels */
          put(A, 'woodDk', rr(x + 3, top + 28, 12, h - 28, [2, 2, 5, 5])); put(A, 'woodDk', rr(x + w - 15, top + 28, 12, h - 28, [2, 2, 5, 5]));
          put(A, 'wood', rr(x - 2, top + 18, w + 4, 13, 5));
          if (head) {
            put(A, 'wood', rr(x - 7, top - 40, 17, h + 30, [8, 8, 3, 3])); put(A, 'woodIn', rr(x - 3, top - 32, 9, 12, 4)); put(A, 'woodIn', rr(x - 3, top - 15, 9, 12, 4));
            put(A, 'wood', rr(x + w - 10, top - 17, 17, h + 8, [7, 7, 3, 3])); put(A, 'woodIn', rr(x + w - 6, top - 10, 9, 8, 3.5));
          }
          B = clayGroup(3.4, 10, area(x - 6, top - 4, w + 12, 32));           /* thick mattress: cream sheet on top, darker quilted ticking at the sides */
          put(B, 'band', rr(x + 1, top + 6, w - 2, 17, 8)); put(B, 'mattress', rr(x + 1, top, w - 2, 17, 8));
          put(B, 'cabDk', rr(x + 4, top + 15.5, w - 8, 2, 1));
          if (head) {
            C = clayGroup(3.6, 11, area(x, top - 26, 60, 36));                /* two plump pillows, one propped behind the other */
            put(C, 'mattress', rr(x + 3, top - 22, 30, 26, 12)); put(C, 'pillow', rr(x + 9, top - 14, 46, 19, 9.5));
            C = clayGroup(3.2, 9, area(x + w - 74, top - 20, 66, 30));        /* a thick striped blanket folded at the foot */
            put(C, 'blanket', rr(x + w - 70, top - 8, 58, 14, 7)); put(C, 'fold', rr(x + w - 66, top - 15, 50, 10, 5)); put(C, 'blanket', rr(x + w - 64, top - 7, 46, 1.8, 0.9));
          }
        } else if (k === 'chair') {
          x = p.x; h = p.h || 38;
          var bx = p.flip ? x + 51 : x - 2, padX = p.flip ? bx - 5 : bx + 7;
          A = clayGroup(1.6, 6, area(x - 12, G - h - 72, 82, h + 76));
          put(A, 'wood', rr(x + 3, G - h + 3, 6, h - 3, 3)); put(A, 'wood', rr(x + 46, G - h + 3, 6, h - 3, 3));
          put(A, 'woodDk', rr(x + 8, G - 15, 38, 4.5, 2.2));
          put(A, 'woodDk', rr(x - 1, G - h + 1, 56, 7, 3.5));
          put(A, 'wood', rr(bx, G - h - 68, 7, 72, [4, 4, 2, 2]));
          B = clayGroup(2.2, 7, area(x - 10, G - h - 60, 84, 70));
          put(B, 'cushion', rr(padX, G - h - 56, 5, 34, 2.5)); put(B, 'cushion', rr(x - 2, G - h - 4, 58, 8, 4));
        } else if (k === 'chairf') {
          x = p.x; h = p.h || 38;
          A = clayGroup(1.6, 6, area(x - 40, G - h - 10, 80, h + 14));
          put(A, 'wood', rr(x - 30, G - h + 3, 6, h - 3, 3)); put(A, 'wood', rr(x + 24, G - h + 3, 6, h - 3, 3));
          put(A, 'woodDk', rr(x - 26, G - 15, 52, 4.5, 2.2)); put(A, 'woodDk', rr(x - 34, G - h + 1, 68, 7, 3.5));
          B = clayGroup(2.2, 7, area(x - 40, G - h - 10, 80, 20));
          put(B, 'cushion', rr(x - 36, G - h - 4, 72, 8, 4));
        } else if (k === 'wall') {
          A = clayGroup(2.4, 8, area(p.x - 8, -40, 40, G + 46));
          put(A, 'plaster', rr(p.x, -40, 24, G + 40, 6)); put(A, 'plasterDk', rr(p.x - 4, G - 16, 28, 16, [3, 3, 0, 0]));
          if (p.handle) put(clayGroup(1.2, 4.5, area(p.x - 12, p.handle - 8, 22, 16)), 'brass', circ([p.x - 3, p.handle], 4.8));
        } else if (k === 'sink') {
          x = p.x; var st = p.h ? G - p.h : G - 88;
          A = clayGroup(1.8, 6, area(x - 6, st - 40, 84, G - st + 44));
          put(A, 'cabinet', rr(x + 1, st + 7, 68, G - st - 7, [0, 0, 3, 3])); put(A, 'cabDk', rr(x + 7, st + 17, 56, G - st - 27, 4));
          B = clayGroup(2.2, 7, area(x - 6, st - 4, 84, 18));
          put(B, 'stone', rr(x - 3, st, 76, 9, 4)); put(B, 'brass', circ([x + 14, st + 30], 2.8));
          C = clayGroup(1.2, 5, area(x + 30, st - 40, 40, 44));
          put(C, 'metal', hull([x + 58, st - 2], 3, [x + 58, st - 24], 2.7) + hull([x + 58, st - 24], 2.7, [x + 50, st - 30], 2.7) + hull([x + 50, st - 30], 2.7, [x + 44, st - 30], 2.7) + circ([x + 58, st - 2], 5));
        } else if (k === 'stairs') {
          var n = p.n || 1, rise = p.rise || 20, run = p.run || 30;
          A = clayGroup(1.9, 7, area(p.x - 4, G - rise * n - 6, n * run + (p.last || 0) + 8, rise * n + 10));
          for (i = 0; i < n; i++) put(A, 'step', rr(p.x + i * run, G - rise * (i + 1), i === n - 1 ? (p.last || run) : run, rise * (i + 1), [3.5, 3.5, 0, 0]));
          for (i = 0; i < n; i++) put(A, 'wood', rr(p.x + i * run, G - rise * (i + 1), i === n - 1 ? (p.last || run) : run, 5, [3.5, 3.5, 1.5, 1.5]));
        } else if (k === 'post') {
          var y0 = p.y0 || 60;
          A = clayGroup(1.5, 6, area(p.x - 8, y0 - 6, 24, G - y0 + 10));
          put(A, 'wood', rr(p.x, y0, 6, G - y0, 3)); put(A, 'woodDk', rr(p.x - 5, G - 6, 16, 6, 3));
        } else if (k === 'mat') {
          A = clayGroup(1.7, 6, area(p.x - 4, G - 10, p.w + 8, 14));
          put(A, 'mat', rr(p.x, G - 5, p.w, 5, 2.5));
        }
      });
    }

    /* groups, back to front: far limbs, torso with the near leg, near arm, head */
    var gFar = clayGroup(2.6, 9), gHF = clayGroup(0.6, 3), gTor = clayGroup(4.2, 15), gArm = clayGroup(2.3, 8), gHN = clayGroup(0.6, 3), gHead = clayGroup(4, 14);
    /* from the front there is no depth: both legs and both arms are "near", share one group and are lit alike */
    var FR = view === 'front', sd = FR ? 'near' : 'far', gArm2 = FR ? gArm : gFar, gHand2 = FR ? gHN : gHF;
    var fLegP, fLegS, tTop, tPants;
    var tNeck = null;
    if (FR) { tPants = clay(gTor, 'pants', 'near'); fLegP = clay(gTor, 'pants', 'near'); fLegS = clay(gTor, 'skin', 'near'); tNeck = clay(gTor, 'skin', 'near'); tTop = clay(gTor, 'top', 'near'); }
    else { fLegP = clay(gFar, 'pants', 'far'); fLegS = clay(gFar, 'skin', 'far'); tTop = clay(gTor, 'top', 'near'); tPants = clay(gTor, 'pants', 'near'); }
    /* the sleeves belong to the torso group, so the upper arm flows out of the shoulder as one clay form (no ball-and-stick joint) */
    var fArmT = clay(FR ? gTor : gArm2, 'top', sd), fArmS = clay(gArm2, 'skin', sd), fHand = clay(gHand2, 'skin', sd), fInk = el('path', { fill: 'none', stroke: '#9a6450', 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: 0.7 }, gHand2.g);
    var tSkin = clay(gTor, 'skin', 'near');
    var folds = [];   /* no crease marks: the rounded back is shown by the shape of the clay itself */
    var nArmT = clay(gTor, 'top', 'near'), nArmS = clay(gArm, 'skin', 'near'), nHand = clay(gHN, 'skin', 'near'), nInk = el('path', { fill: 'none', stroke: '#b27c66', 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: 0.7 }, gHN.g);
    var hHair = clay(gHead, 'hair', 'near'), hSkin = clay(gHead, 'skin', 'near'), hEar = clay(gHead, 'ear', 'near');
    var eyes = (view === 'side' ? [0] : [0, 1]).map(function () { return el('circle', { r: view === 'side' ? 1.9 : 1.7, fill: INK }, gHead.g); });
    var mouth = view === 'front' ? el('path', { fill: 'none', stroke: '#a85f66', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, gHead.g) : null;

    var bottles = has('bottle') ? [clayGroup(1.0, 4, [-14, -22, 28, 44]), clayGroup(1.0, 4, [-14, -22, 28, 44])].map(function (bg, bi) {
      if (bi === 0) bg.g.setAttribute('class', 'f-far-b');
      put(bg, 'bottle', rr(-4.8, -10, 9.6, 21, 3.6)); put(bg, 'bottle', rr(-3, -14, 6, 6, 2)); put(bg, 'label', rr(-4.8, -3.5, 9.6, 7, 1.5)); put(bg, 'cap', rr(-3.4, -17, 6.8, 4.4, 1.8));
      return bg.g;
    }) : [];
    /* the bottles sit behind the hands, so the fingers close in front of them */
    bottles.forEach(function (bg, bi) { stage.insertBefore(bg, bi === 0 ? gHF.g : gHN.g); });
    var broomDot = has('broom') && view === 'side' ? el('circle', { r: 4.8, fill: COL.wood.near }, clayGroup(1.2, 4.5, WIDE).g) : null;
    var broomLine = has('broom') && view === 'front' ? stick() : null;
    var bottleOn = function (g, p) { g.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')'); };

    /* head + neck + face. hc = head centre, hd = head angle (radians). The hair sits at the back of the head in profile, on top from the front. */
    var HEAD_R = 12;
    function setHead(sh, tg, hc, hd) {
      var F = [Math.cos(hd), Math.sin(hd)], U = [Math.sin(hd), -Math.cos(hd)];
      function off(f, u) { return [hc[0] + F[0] * f + U[0] * u, hc[1] + F[1] * f + U[1] * u]; }
      var back = view === 'side' ? -3.4 : 0, hairC = off(back * 1.15, 2.8);
      /* neck: a short curve continuing the end of the spine into the head */
      var ctl = [sh[0] + 9 * Math.sin(tg), sh[1] - 9 * Math.cos(tg)], mid = [0.25 * sh[0] + 0.5 * ctl[0] + 0.25 * hc[0], 0.25 * sh[1] + 0.5 * ctl[1] + 0.25 * hc[1]];
      tSkin.neck = hull(sh, 5.4, mid, 4.5) + hull(mid, 4.5, hc, 4.3);
      hHair.set(circ(hairC, 12.9));
      var skin = circ(hc, HEAD_R);
      if (view === 'side') {
        skin += circ(off(12.6, -1), 2.6);               /* nose: a clay bump on the profile */
        hEar.set(circ(off(-2.4, -0.2), 2.4));
        var e0 = off(7.2, 3.1); eyes[0].setAttribute('cx', e0[0].toFixed(1)); eyes[0].setAttribute('cy', e0[1].toFixed(1));
      } else {
        hEar.set('');
        [-1, 1].forEach(function (s, i) { var p = off(s * 5, 0.6); eyes[i].setAttribute('cx', p[0].toFixed(1)); eyes[i].setAttribute('cy', p[1].toFixed(1)); });
        var m0 = off(-3.6, -6), m1 = off(3.6, -6), mc = off(0, -9.2);
        mouth.setAttribute('d', 'M' + f1(m0) + 'Q' + f1(mc) + ' ' + f1(m1));
      }
      hSkin.set(skin);
      gHead.T && gHead.T.mv(hc);
    }
    /* creases on the inside of the bend: pinched clay folds that grow as the back rounds (or arches) */
    function setBack(sp, t, c) {
      if (!folds.length) return;
      var ac = Math.abs(c), dir = c > 0 ? 1 : -1;
      [1, 3, 5].forEach(function (i, k) {
        var a = (t - c / 2 + c * i / SEG) * RAD, nfx = Math.cos(a), nfy = Math.sin(a), ux = Math.sin(a), uy = -Math.cos(a), q = sp[i];
        var x0 = q[0] + dir * nfx * 11.5 - ux * 2, y0 = q[1] + dir * nfy * 11.5 - uy * 2;
        var x1 = q[0] + dir * nfx * 6.5 + ux * 2, y1 = q[1] + dir * nfy * 6.5 + uy * 2;
        folds[k].setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1));
        folds[k].setAttribute('opacity', ac > 10 ? Math.min(0.5, (ac - 10) / 50).toFixed(2) : 0);
      });
    }
    var TRAD = [11.4, 10, 9.4, 10.4, 11.4, 10.8, 9];     /* torso radius along the spine: hips, waist, chest, shoulders */

    function draw(r) {
      var h = r.h, sh, hd;
      if (view === 'side') {
        var th = r.t * RAD, cu = r.c || 0, sp = spinePts(h, r.t, cu);
        sh = sp[SEG];
        hd = (r.t + cu / 2 + r.n) * RAD;
        var hc = [sh[0] + (L.head + 3) * Math.sin(hd), sh[1] - (L.head + 3) * Math.cos(hd)];
        var A = ik(sh, r.a, L.ua, L.fa, 1), B = ik(sh, r.b, L.ua, L.fa, 1);
        var K = ik(h, r.k, L.th, L.sh, -1), Lg = ik(h, r.l, L.th, L.sh, -1);
        var fk = [Math.sin(r.f * RAD), Math.cos(r.f * RAD)], fg = [Math.sin(r.g * RAD), Math.cos(r.g * RAD)];
        var fl2 = legD(h, Lg.mid, Lg.end, false), fa = armD(sh, B.mid, B.end, false), nl = legD(h, K.mid, K.end, true), na = armD(sh, A.mid, A.end, true);
        fLegP.set(fl2.pants); fLegS.set(footD(Lg.end, fg, [fg[1], -fg[0]])); fArmT.set(fa.sleeve); fArmS.set(fa.skin); fHand.set(fa.hand.d); fInk.setAttribute('d', fa.hand.ink);
        var torso = '', i;
        for (i = 0; i < SEG; i++) torso += hull(sp[i], TRAD[i], sp[i + 1], TRAD[i + 1]);
        tTop.set(torso);
        tPants.set(hull(h, 10.4, lerp2(h, sp[1], 0.45), 10) + nl.pants);
        setBack(sp, r.t, cu);
        var tg = (r.t + cu / 2) * RAD;
        setHead(sh, tg, hc, hd);
        tSkin.set(footD(K.end, fk, [fk[1], -fk[0]]) + tSkin.neck);
        nArmT.set(na.sleeve); nArmS.set(na.skin); nHand.set(na.hand.d); nInk.setAttribute('d', na.hand.ink);
        gFar.T && gFar.T.mv(sh); gTor.T && gTor.T.mv(h); gArm.T && gArm.T.mv(sh);
        shadow.setAttribute('opacity', Math.max(0.25, Math.min(1, 1 - (G - Math.max(K.end[1], Lg.end[1])) / 60)));
        if (!bedP) shadow.setAttribute('cx', ((h[0] + K.end[0] + Lg.end[0]) / 3).toFixed(1));
        if (bottles.length) { bottleOn(bottles[0], B.end); bottleOn(bottles[1], A.end); }
        if (broomDot) at(broomDot, A.end);
        if (spine) {
          var u = [Math.sin(th), -Math.cos(th)], nf = [Math.cos(th), Math.sin(th)];
          spine.setAttribute('x1', h[0] - nf[0] * 8 - u[0] * 32); spine.setAttribute('y1', h[1] - nf[1] * 8 - u[1] * 32);
          spine.setAttribute('x2', sh[0] - nf[0] * 8 + u[0] * 44); spine.setAttribute('y2', sh[1] - nf[1] * 8 + u[1] * 44);
        }
        if (rope) rope.setAttribute('d', P([ropeCfg.from, A.end]) + 'M' + ropeCfg.from[0] + ' ' + ropeCfg.from[1] + 'L' + B.end[0].toFixed(1) + ' ' + B.end[1].toFixed(1));
      } else {
        var fs = frontShoulders(h, r.t), hl = [h[0] - 10, h[1]], hr = [h[0] + 10, h[1]];
        sh = fs.s; hd = (r.t + r.n) * RAD;
        var hc2 = [sh[0] + (L.head + 3) * Math.sin(hd), sh[1] - (L.head + 3) * Math.cos(hd)];
        var AL = ik(fs.sl, r.a, L.ua, L.fa, 1), AR = ik(fs.sr, r.b, L.ua, L.fa, -1);
        var lth = L.th * (r.lf || 1), KL = ik(hl, r.k, lth, L.sh, 1), KR = ik(hr, r.l, lth, L.sh, -1);
        var th0l = [h[0] - 6.5, h[1] + 8], th0r = [h[0] + 6.5, h[1] + 8];
        var rl = legD(th0r, KR.mid, KR.end, false, true), ra = armD(fs.sr, AR.mid, AR.end, false), ll = legD(th0l, KL.mid, KL.end, true, true), la = armD(fs.sl, AL.mid, AL.end, true);
        fLegP.set(''); fLegS.set(footD(KR.end, [1, 0], [0, -1])); fArmT.set(ra.sleeve); fArmS.set(ra.skin); fHand.set(ra.hand.d); fInk.setAttribute('d', ra.hand.ink);
        var m1 = lerp2(h, sh, 0.18), m2 = lerp2(h, sh, 0.55), m3 = lerp2(h, sh, 0.88);
        tTop.set(hull(m1, 9.2, m2, 9.6) + hull(m2, 9.6, m3, 10.8) + hull(m3, 10.8, sh, 6.2) + hull(fs.sl, 6.4, fs.sr, 6.4) + circ(fs.sl, 5.6) + circ(fs.sr, 5.6));
        tPants.set(hull(m1, 9.2, h, 9.2) + hull(h, 9.2, [h[0], h[1] + 6], 7.6) + ll.pants + rl.pants);
        setHead(sh, (r.t) * RAD, hc2, hd);
        tSkin.set(footD(KL.end, [-1, 0], [0, -1])); tNeck.set(tSkin.neck);
        nArmT.set(la.sleeve); nArmS.set(la.skin); nHand.set(la.hand.d); nInk.setAttribute('d', la.hand.ink);
        gFar.T && gFar.T.mv(sh); gTor.T && gTor.T.mv(h); gArm.T && gArm.T.mv(sh);
        shadow.setAttribute('opacity', 0.9);
        if (!bedP) shadow.setAttribute('cx', ((KL.end[0] + KR.end[0]) / 2).toFixed(1));
        if (bottles.length) { bottleOn(bottles[0], AR.end); bottleOn(bottles[1], AL.end); }
        if (broomLine) {
          var dx = AR.end[0] - AL.end[0], dy = AR.end[1] - AL.end[1], dl = Math.sqrt(dx * dx + dy * dy) || 1;
          broomLine.setAttribute('x1', AL.end[0] - dx / dl * 34); broomLine.setAttribute('y1', AL.end[1] - dy / dl * 34);
          broomLine.setAttribute('x2', AR.end[0] + dx / dl * 34); broomLine.setAttribute('y2', AR.end[1] + dy / dl * 34);
        }
      }
    }
    function at(b, p) { b.setAttribute('cx', p[0].toFixed(1)); b.setAttribute('cy', p[1].toFixed(1)); }

    var totalW = poses.reduce(function (s, p) { return s + p.w; }, 0);
    /* phase in [0,1) over one repetition -> pose, caption and breathing cue */
    function atPhase(phase) {
      var x = ((phase % 1) + 1) % 1 * totalW, i = 0;
      while (i < poses.length - 1 && x >= poses[i].w) { x -= poses[i].w; i++; }
      var p0 = poses[i], p1 = poses[(i + 1) % poses.length];
      var u = clamp01((x / p0.w - p0.hd) / (1 - p0.hd || 1));
      var cur = u < 0.5 ? p0 : p1;
      return { pose: mix(p0, p1, ease(u)), cap: cur.cap, br: cur.br, seg: i, f: x / p0.w };
    }
    /* hold mode: 0 -> move to last pose, then breathe in place */
    function atHold(prog, wob) {
      var r = mix(poses[0], poses[poses.length - 1], ease(clamp01(prog)));
      if (wob) r.h = [r.h[0], r.h[1] + wob];
      return { pose: r, cap: prog < 1 ? poses[0].cap : poses[poses.length - 1].cap, br: undefined };
    }
    /* mirrored by flipping the whole svg element on the compositor (rotateY): an SVG-level scale(-1,1) makes Chrome light the clay filters from behind, so the doll went black */
    function setMirror(on) { if ((mir === -1) === !!on) return; mir = on ? -1 : 1; svg.style.transform = on ? 'rotateY(180deg)' : ''; lights.forEach(function (l) { l.setAttribute('azimuth', on ? 315 : 225); }); }
    draw(poses[0]);
    return { draw: draw, atPhase: atPhase, atHold: atHold, setMirror: setMirror, count: poses.length };
  }

  root.HTDoll = { create: Figure, G: G };
})(typeof window !== 'undefined' ? window : this);
