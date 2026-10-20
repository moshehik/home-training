/* figure.js - stick-figure exercise animator (SVG), no dependencies.
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
 *   cap: caption shown while this pose is the current target,  br: 'in' | 'out' breathing cue
 *   w: relative duration of the segment that STARTS at this pose,  hd: fraction of that segment spent holding still
 * Limbs are solved with two-bone IK, so feet and hands stay planted on the floor / props.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', G = 205, RAD = Math.PI / 180;
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
    return { h: h, t: q.t, n: q.n, a: a, b: b, k: k, l: l, f: q.f, g: q.g, cap: q.cap, br: q.br, w: q.w || 1, hd: q.hd || 0 };
  }

  var FRONT_DEF = { h: [200, G - 89], t: 0, n: 0, ap: [-6, 56], bp: [6, 56], kp: [-5, 84], lp: [5, 84] };
  function frontShoulders(h, t) {
    var th = t * RAD, s = [h[0] + L.torso * Math.sin(th), h[1] - L.torso * Math.cos(th)];
    var c = Math.cos(th), sn = Math.sin(th);
    return { s: s, sl: [s[0] - 19 * c, s[1] - 19 * sn], sr: [s[0] + 19 * c, s[1] + 19 * sn] };
  }
  function resolveFront(p) {
    var q = Object.assign({}, FRONT_DEF, p), h = q.h, fs = frontShoulders(h, q.t);
    var hl = [h[0] - 10, h[1]], hr = [h[0] + 10, h[1]];
    return {
      h: h, t: q.t, n: q.n,
      a: q.a || pol(fs.sl, q.ap[0], q.ap[1]), b: q.b || pol(fs.sr, q.bp[0], q.bp[1]),
      k: q.k || pol(hl, q.kp[0], q.kp[1]), l: q.l || pol(hr, q.lp[0], q.lp[1]),
      cap: q.cap, br: q.br, w: q.w || 1, hd: q.hd || 0
    };
  }

  function mix(r0, r1, u) {
    var o = {};
    ['h', 'a', 'b', 'k', 'l'].forEach(function (key) { o[key] = lerp2(r0[key], r1[key], u); });
    ['t', 'n', 'f', 'g'].forEach(function (key) { if (r0[key] !== undefined) o[key] = lerp(r0[key], r1[key], u); });
    return o;
  }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function P(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); }

  /* ---------- static props ---------- */
  function drawProps(g, props) {
    el('rect', { x: -20, y: G, width: 440, height: 40, 'class': 'f-ground' }, g);
    el('line', { x1: -20, y1: G, x2: 420, y2: G, 'class': 'f-floor' }, g);
    (props || []).forEach(function (p) {
      if (typeof p === 'string') return;
      if (p.type === 'bed') {
        var x = p.x, w = p.w, h = p.h || 40;
        el('rect', { x: x + 6, y: G - h + 12, width: 6, height: h - 12, 'class': 'f-prop' }, g);
        el('rect', { x: x + w - 12, y: G - h + 12, width: 6, height: h - 12, 'class': 'f-prop' }, g);
        el('rect', { x: x, y: G - h, width: w, height: 13, rx: 5, 'class': 'f-mattress' }, g);
        if (p.pillow !== false) el('rect', { x: x + 4, y: G - h - 6, width: 34, height: 7, rx: 3.5, 'class': 'f-pillow' }, g);
      } else if (p.type === 'chair') {
        var cx = p.x, sh = p.h || 38;
        el('rect', { x: cx + 3, y: G - sh, width: 4, height: sh, 'class': 'f-prop' }, g);
        el('rect', { x: cx + 47, y: G - sh, width: 4, height: sh, 'class': 'f-prop' }, g);
        el('rect', { x: p.flip ? cx + 51 : cx - 2, y: G - sh - 62, width: 5, height: 62, rx: 2, 'class': 'f-prop' }, g);
        el('rect', { x: cx - 2, y: G - sh - 4, width: 58, height: 6, rx: 3, 'class': 'f-seat' }, g);
      } else if (p.type === 'chairf') {
        var fx = p.x, fh = p.h || 38;
        el('rect', { x: fx - 30, y: G - fh, width: 4, height: fh, 'class': 'f-prop' }, g);
        el('rect', { x: fx + 26, y: G - fh, width: 4, height: fh, 'class': 'f-prop' }, g);
        el('rect', { x: fx - 36, y: G - fh - 4, width: 72, height: 6, rx: 3, 'class': 'f-seat' }, g);
      } else if (p.type === 'wall') {
        el('rect', { x: p.x, y: 0, width: 24, height: G, 'class': 'f-wall' }, g);
        el('line', { x1: p.x, y1: 0, x2: p.x, y2: G, 'class': 'f-prop-line' }, g);
        if (p.handle) { el('circle', { cx: p.x - 3, cy: p.handle, r: 4, 'class': 'f-seat' }, g); }
      } else if (p.type === 'sink') {
        var sx = p.x, top = p.h ? G - p.h : G - 88;
        el('rect', { x: sx, y: top + 8, width: 70, height: G - top - 8, 'class': 'f-prop' }, g);
        el('rect', { x: sx - 2, y: top, width: 74, height: 8, rx: 2, 'class': 'f-seat' }, g);
        el('path', { d: 'M' + (sx + 58) + ' ' + top + 'v-24q0-6 -8-6h-6', 'class': 'f-prop-line', fill: 'none' }, g);
      } else if (p.type === 'rope') {
        /* drawn dynamically each frame */
      } else if (p.type === 'stairs') {
        var sn = p.n || 1, sr = p.rise || 20, sw = p.run || 30;
        for (var si = 0; si < sn; si++) {
          var sWid = si === sn - 1 ? (p.last || sw) : sw, sTop = G - sr * (si + 1);
          el('rect', { x: p.x + si * sw, y: sTop, width: sWid, height: sr * (si + 1), 'class': 'f-prop' }, g);
          el('rect', { x: p.x + si * sw, y: sTop, width: sWid, height: 4, 'class': 'f-seat' }, g);
        }
      } else if (p.type === 'post') {
        el('rect', { x: p.x, y: p.y0 || 60, width: 5, height: G - (p.y0 || 60), rx: 2, 'class': 'f-prop' }, g);
      } else if (p.type === 'mat') {
        el('rect', { x: p.x, y: G - 3, width: p.w, height: 3, rx: 1.5, 'class': 'f-seat' }, g);
      }
    });
  }

  function Figure(svg, scene) {
    var view = scene.view || 'side';
    var resolve = view === 'front' ? resolveFront : resolveSide;
    var poses = scene.poses.map(resolve);
    var props = scene.props || [];
    var has = function (name) { return props.some(function (p) { return p === name || (p && p.type === name); }); };
    svg.setAttribute('viewBox', '0 -26 400 266');
    svg.setAttribute('role', 'img');
    svg.textContent = '';
    var root = el('g', {}, svg), stage = el('g', {}, root);
    drawProps(stage, props);
    var ropeCfg = props.filter(function (p) { return p && p.type === 'rope'; })[0];
    var rope = ropeCfg ? el('path', { 'class': 'f-rope', fill: 'none' }, stage) : null;
    var ropeDot = ropeCfg ? el('circle', { cx: ropeCfg.from[0], cy: ropeCfg.from[1], r: 4, 'class': 'f-seat' }, stage) : null;
    var spine = has('spine') ? el('line', { 'class': 'f-broom' }, stage) : null;
    var farLeg = el('path', { 'class': 'f-far f-limb' }, stage);
    var farArm = el('path', { 'class': 'f-far f-limb' }, stage);
    var body = el('path', { 'class': 'f-body' }, stage);
    var extra = view === 'front' ? [el('path', { 'class': 'f-body f-thin' }, stage), el('path', { 'class': 'f-body f-thin' }, stage)] : [];
    var nearLeg = el('path', { 'class': 'f-near f-limb' }, stage);
    var nearArm = el('path', { 'class': 'f-near f-limb' }, stage);
    var neck = el('path', { 'class': 'f-body f-thin' }, stage);
    var head = el('circle', { r: 10.5, 'class': 'f-head' }, stage);
    var bottles = has('bottle') ? [el('g', { 'class': 'f-bottle f-far-b' }, stage), el('g', { 'class': 'f-bottle' }, stage)] : [];
    bottles.forEach(function (b) {
      el('rect', { x: -4.5, y: -11, width: 9, height: 21, rx: 3, 'class': 'f-bottle-body' }, b);
      el('rect', { x: -2.5, y: -15, width: 5, height: 5, rx: 1.5, 'class': 'f-bottle-cap' }, b);
    });
    var broomDot = has('broom') && view === 'side' ? el('circle', { r: 4.6, 'class': 'f-broom-dot' }, stage) : null;
    var broomLine = has('broom') && view === 'front' ? el('line', { 'class': 'f-broom' }, stage) : null;
    var bottleOn = function (g, p) { g.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')'); };

    function draw(r) {
      var h = r.h, sh, hd;
      if (view === 'side') {
        var th = r.t * RAD;
        sh = [h[0] + L.torso * Math.sin(th), h[1] - L.torso * Math.cos(th)];
        hd = (r.t + r.n) * RAD;
        var hc = [sh[0] + L.head * Math.sin(hd), sh[1] - L.head * Math.cos(hd)];
        var A = ik(sh, r.a, L.ua, L.fa, 1), B = ik(sh, r.b, L.ua, L.fa, 1);
        var K = ik(h, r.k, L.th, L.sh, -1), Lg = ik(h, r.l, L.th, L.sh, -1);
        var tk = [K.end[0] + L.foot * Math.sin(r.f * RAD), K.end[1] + L.foot * Math.cos(r.f * RAD)];
        var tl = [Lg.end[0] + L.foot * Math.sin(r.g * RAD), Lg.end[1] + L.foot * Math.cos(r.g * RAD)];
        body.setAttribute('d', P([h, sh]));
        farArm.setAttribute('d', P([sh, B.mid, B.end]));
        farLeg.setAttribute('d', P([h, Lg.mid, Lg.end, tl]));
        nearLeg.setAttribute('d', P([h, K.mid, K.end, tk]));
        nearArm.setAttribute('d', P([sh, A.mid, A.end]));
        neck.setAttribute('d', P([sh, hc]));
        head.setAttribute('cx', hc[0]); head.setAttribute('cy', hc[1]);
        if (bottles.length) { bottleOn(bottles[0], B.end); bottleOn(bottles[1], A.end); }
        if (broomDot) { broomDot.setAttribute('cx', A.end[0]); broomDot.setAttribute('cy', A.end[1]); }
        if (spine) {
          var u = [Math.sin(th), -Math.cos(th)], nf = [Math.cos(th), Math.sin(th)];
          spine.setAttribute('x1', h[0] - nf[0] * 8 - u[0] * 32); spine.setAttribute('y1', h[1] - nf[1] * 8 - u[1] * 32);
          spine.setAttribute('x2', sh[0] - nf[0] * 8 + u[0] * 44); spine.setAttribute('y2', sh[1] - nf[1] * 8 + u[1] * 44);
        }
        if (rope) {
          rope.setAttribute('d', P([ropeCfg.from, A.end]) + 'M' + ropeCfg.from[0] + ' ' + ropeCfg.from[1] + 'L' + B.end[0].toFixed(1) + ' ' + B.end[1].toFixed(1));
        }
      } else {
        var fs = frontShoulders(h, r.t), hl = [h[0] - 10, h[1]], hr = [h[0] + 10, h[1]];
        sh = fs.s; hd = (r.t + r.n) * RAD;
        var hc2 = [sh[0] + L.head * Math.sin(hd), sh[1] - L.head * Math.cos(hd)];
        var AL = ik(fs.sl, r.a, L.ua, L.fa, 1), AR = ik(fs.sr, r.b, L.ua, L.fa, -1);
        var KL = ik(hl, r.k, L.th, L.sh, 1), KR = ik(hr, r.l, L.th, L.sh, -1);
        body.setAttribute('d', P([h, sh]));
        extra[0].setAttribute('d', P([fs.sl, fs.sr]));
        extra[1].setAttribute('d', P([hl, hr]));
        farLeg.setAttribute('d', P([hr, KR.mid, KR.end, [KR.end[0] + 10, KR.end[1]]]));
        nearLeg.setAttribute('d', P([hl, KL.mid, KL.end, [KL.end[0] - 10, KL.end[1]]]));
        farArm.setAttribute('d', P([fs.sr, AR.mid, AR.end]));
        nearArm.setAttribute('d', P([fs.sl, AL.mid, AL.end]));
        neck.setAttribute('d', P([sh, hc2]));
        head.setAttribute('cx', hc2[0]); head.setAttribute('cy', hc2[1]);
        if (bottles.length) { bottleOn(bottles[0], AR.end); bottleOn(bottles[1], AL.end); }
        if (broomLine) {
          var dx = AR.end[0] - AL.end[0], dy = AR.end[1] - AL.end[1], dl = Math.sqrt(dx * dx + dy * dy) || 1;
          broomLine.setAttribute('x1', AL.end[0] - dx / dl * 34); broomLine.setAttribute('y1', AL.end[1] - dy / dl * 34);
          broomLine.setAttribute('x2', AR.end[0] + dx / dl * 34); broomLine.setAttribute('y2', AR.end[1] + dy / dl * 34);
        }
      }
    }

    var totalW = poses.reduce(function (s, p) { return s + p.w; }, 0);
    /* phase in [0,1) over one repetition -> pose, caption and breathing cue */
    function atPhase(phase) {
      var x = ((phase % 1) + 1) % 1 * totalW, i = 0;
      while (i < poses.length - 1 && x >= poses[i].w) { x -= poses[i].w; i++; }
      var p0 = poses[i], p1 = poses[(i + 1) % poses.length];
      var u = clamp01((x / p0.w - p0.hd) / (1 - p0.hd || 1));
      var r = mix(p0, p1, ease(u));
      var cur = u < 0.5 ? p0 : p1;
      return { pose: r, cap: cur.cap, br: cur.br };
    }
    function poseIndex(i) { return poses[Math.max(0, Math.min(poses.length - 1, i))]; }
    /* hold mode: 0 -> move to last pose, then breathe in place */
    function atHold(prog, wob) {
      var r = mix(poses[0], poses[poses.length - 1], ease(clamp01(prog)));
      if (wob) r.h = [r.h[0], r.h[1] + wob];
      return { pose: r, cap: prog < 1 ? poses[0].cap : poses[poses.length - 1].cap, br: undefined };
    }
    function setMirror(on) { root.setAttribute('transform', on ? 'translate(400 0) scale(-1 1)' : ''); }
    draw(poses[0]);
    return { draw: draw, atPhase: atPhase, atHold: atHold, poseAt: poseIndex, setMirror: setMirror, count: poses.length };
  }

  root.HTFigure = { create: Figure, G: G };
})(typeof window !== 'undefined' ? window : this);
