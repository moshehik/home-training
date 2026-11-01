/* music.js - generates workout music in the browser (Web Audio). No audio files needed.
 * Styles: 'wild' (loudest: stormy party groove), 'beat' (energetic drums + bass), 'steady' (softer groove), 'calm' (pads for stretching), 'click' (metronome only).
 * Everything is locked to the exercise tempo, so one repetition always lands on whole beats.
 * Every exercise gets its own tune: HTMusic.theme(lesson, exerciseIndex) picks a different drum groove, bass line, chord
 * progression, key, chord style, lead instrument and a freshly composed 8-bar melody (seeded, so it is the same every time).
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, noise = null, timer = null;
  var st = { bpm: 90, style: 'beat', vol: 0.7, step: 0, next: 0, playing: false };
  var seedN = 2, seedI = 0, tune = null;
  /* chord shapes (semitones above the chord root) */
  var Q = { M: [0, 4, 7], m: [0, 3, 7], s: [0, 5, 7], d7: [0, 4, 7, 10], m7: [0, 3, 7, 10] };

  /* chord progressions: mode of the tune + 4 chords [semitones above the tonic, shape] */
  var PROGS = [
    { mode: 'M', c: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']] },       /* I V vi IV */
    { mode: 'm', c: [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M']] },     /* i VII VI VII */
    { mode: 'M', c: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']] },       /* I vi IV V */
    { mode: 'm', c: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']] },      /* i VI III VII */
    { mode: 'M', c: [[0, 'M'], [5, 'M'], [7, 'M'], [5, 'M']] },       /* I IV V IV */
    { mode: 'm', c: [[0, 'm'], [5, 'm'], [10, 'M'], [3, 'M']] },      /* i iv VII III */
    { mode: 'M', c: [[0, 'M'], [10, 'M'], [5, 'M'], [0, 'M']] },      /* I bVII IV I (mixolydian) */
    { mode: 'm', c: [[0, 'm7'], [5, 'd7'], [0, 'm7'], [7, 'd7']] },   /* blues-minor i7 IV7 */
    { mode: 'M', c: [[0, 'M'], [4, 'm'], [5, 'M'], [7, 'M']] },       /* I iii IV V */
    { mode: 'm', c: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']] },      /* Andalusian i VII VI V */
    { mode: 'M', c: [[5, 'M'], [0, 'M'], [7, 'M'], [9, 'm']] },       /* IV I V vi */
    { mode: 'm', c: [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']] },       /* i VI iv V */
    { mode: 'M', c: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']] },       /* I IV vi V */
    { mode: 'm', c: [[0, 'm'], [7, 'm'], [8, 'M'], [10, 'M']] },      /* i v VI VII */
    { mode: 'M', c: [[0, 'd7'], [5, 'd7'], [0, 'd7'], [7, 'd7']] },   /* dominant-7 shuffle */
    { mode: 'M', c: [[2, 'm7'], [7, 'd7'], [0, 'M'], [9, 'm7']] }     /* ii V I vi */
  ];
  var PENT = { M: [0, 2, 4, 7, 9], m: [0, 3, 5, 7, 10] };
  var KEYS = [0, 2, -2, 3, 5, -3, 7, -5, 4, -4, 1, 6];

  function mk(a) { var o = {}; (a || []).forEach(function (p) { o[p] = 1; }); return o; }
  /* drum grooves on a sixteenth grid (0-15 per bar). e = energetic enough for 'wild'; st = chord-stab positions */
  function G(name, o) {
    return { name: name, k: mk(o.k), sn: mk(o.sn), cl: mk(o.cl), gh: mk(o.gh), hh: mk(o.hh), oh: mk(o.oh), pc: mk(o.pc), cg: mk(o.cg),
             sw: o.sw || 0, e: !!o.e, st: o.st || [2, 6, 10, 14] };
  }
  var EV = [0, 2, 4, 6, 8, 10, 12, 14], ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  var GROOVES = [
    G('four-on-floor', { k: [0, 4, 8, 12], cl: [4, 12], oh: [2, 6, 10, 14], hh: [3, 7, 11, 15], e: 1 }),
    G('rock',          { k: [0, 8, 10], sn: [4, 12], hh: EV, st: [0, 8] }),
    G('dembow',        { k: [0, 4, 8, 12], sn: [3, 6, 11, 14], hh: [2, 10], e: 1, st: [6, 14] }),
    G('breakbeat',     { k: [0, 5, 10], sn: [4, 12], gh: [7, 9, 15], hh: EV, e: 1, st: [0, 5, 10] }),
    G('disco',         { k: [0, 4, 8, 12], sn: [4, 12], oh: [2, 6, 10, 14], hh: [1, 3, 5, 7, 9, 11, 13, 15], e: 1 }),
    G('funk',          { k: [0, 3, 6, 10], sn: [4, 12], gh: [7, 9, 15], hh: ALL, e: 1, st: [3, 10] }),
    G('half-time',     { k: [0, 10], sn: [8], hh: EV.concat([15]), st: [0, 10] }),
    G('latin',         { k: [0, 8], pc: [0, 3, 6, 10, 12], cg: [4, 7, 12, 15], hh: [2, 6, 10, 14], sw: 0.05, st: [3, 10] }),
    G('march',         { k: [0, 8], sn: [4, 6, 12, 14, 15], st: [0, 8] }),
    G('oom-pah',       { k: [0, 8], sn: [4, 12], hh: [2, 6, 10, 14], st: [4, 12] }),
    G('shuffle',       { k: [0, 8], sn: [4, 12], hh: EV, sw: 0.3, st: [2, 10] })
  ];
  /* bass lines: [position (sixteenths), chord tone (0 root, 1 third, 2 fifth, 3 octave, 4 seventh), length (sixteenths)] */
  var BASS = [
    [[0, 0, 12], [8, 2, 6]],                                                                           /* long root, fifth */
    [[0, 0, 2], [2, 3, 2], [4, 0, 2], [6, 3, 2], [8, 0, 2], [10, 3, 2], [12, 0, 2], [14, 3, 2]],       /* octave pump */
    [[0, 0, 3], [4, 1, 3], [8, 2, 3], [12, 1, 3]],                                                     /* walking */
    [[0, 0, 2], [3, 0, 1], [6, 3, 2], [10, 2, 2], [11, 1, 1], [14, 0, 2]],                             /* funk */
    [[2, 2, 3], [6, 0, 4], [10, 2, 3], [14, 0, 2]],                                                    /* tumbao */
    [[0, 0, 6], [6, 0, 2], [8, 2, 6], [14, 0, 2]],                                                     /* dembow */
    [[0, 0, 3], [8, 2, 3]],                                                                            /* oom-pah */
    [[0, 0, 3], [3, 0, 2], [6, 0, 2], [10, 2, 3], [14, 4, 2]],                                         /* syncopated */
    [[0, 0, 4], [4, 0, 4], [8, 3, 4], [12, 2, 4]]                                                      /* steady quarters */
  ];
  /* melody rhythms (note starts on the sixteenth grid) */
  var RHY = {
    straight: [0, 4, 8, 12], syncop: [0, 3, 6, 8, 11, 14], eighths: EV, dotted: [0, 6, 8, 14], sparse: [0, 8], long: [0, 6, 12],
    riff: [0, 2, 3, 6, 8, 10, 11, 14], hook: [0, 1, 2, 4, 8, 9, 10, 12], answer: [0, 4, 6, 8, 12]
  };

  /* lead instruments: f = frequency, t = start, l = note length (s), v = loudness */
  var VOICES = {
    pluck:   function (f, t, l, v) { tone('triangle', f, t, 0.004, v * 1.3, Math.min(0.28, l + 0.06), null, 3200); tone('sine', f * 2, t, 0.004, v * 0.3, 0.1, null, 3000); },
    square:  function (f, t, l, v) { tone('square', f, t, 0.006, v * 0.8, Math.max(0.1, l * 0.9), null, 2000); },
    saw:     function (f, t, l, v) { var d = Math.max(0.12, l * 0.95); tone('sawtooth', f, t, 0.008, v * 0.65, d, null, 2600); tone('sawtooth', f * 1.006, t, 0.008, v * 0.45, d, null, 2600); },
    bell:    function (f, t, l, v) { tone('sine', f, t, 0.003, v * 1.2, 0.7); tone('sine', f * 2.76, t, 0.003, v * 0.35, 0.35); },
    marimba: function (f, t, l, v) { tone('sine', f, t, 0.002, v * 1.5, 0.22); tone('sine', f * 4, t, 0.002, v * 0.4, 0.06); },
    organ:   function (f, t, l, v) { var d = Math.max(0.15, l); tone('sine', f, t, 0.02, v, d); tone('sine', f * 2, t, 0.02, v * 0.5, d); tone('sine', f * 3, t, 0.02, v * 0.25, d); },
    flute:   function (f, t, l, v) { var d = Math.max(0.25, l); tone('sine', f, t, 0.05, v * 1.3, d); tone('triangle', f * 2, t, 0.06, v * 0.15, d); },
    chip:    function (f, t, l, v) { tone('square', f, t, 0.002, v * 0.7, 0.09, null, 4000); tone('square', f * 2, t + 0.045, 0.002, v * 0.4, 0.07, null, 4000); }
  };
  var VNAMES_CALM = ['bell', 'flute', 'organ', 'marimba'];
  var VNAMES = ['pluck', 'square', 'saw', 'chip', 'marimba', 'bell', 'organ', 'flute'];
  var VNAMES_WILD = ['saw', 'square', 'chip', 'pluck', 'marimba'];

  function hz(base, semis) { return base * Math.pow(2, semis / 12); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  /* the i-th of a list; the stride is coprime to the list length, so exercises of one lesson never repeat a choice */
  function pick(list, i, n, a) { var K = list.length; while (gcd(a, K) !== 1) a++; return list[(a * i + n) % K]; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* compose the 8-bar melody: bars 0-3 first phrase, 4-7 second phrase; each phrase = motif, answer, motif again, closing bar */
  function compose(prog, rnd, style) {
    var pent = PENT[prog.mode], pool = [];
    for (var o = 0; o < 2; o++) pent.forEach(function (s) { pool.push(s + 12 * o); });
    pool.push(24);
    var names = style === 'calm' ? ['long', 'sparse', 'dotted', 'straight']
      : style === 'wild' ? ['eighths', 'riff', 'syncop', 'hook', 'dotted']
      : ['straight', 'syncop', 'eighths', 'dotted', 'riff', 'hook', 'long', 'answer'];
    function rhythm() { return RHY[names[Math.floor(rnd() * names.length)]]; }
    function snap(idx, bar) {
      var ch = prog.c[bar % 4], pcs = Q[ch[1]].map(function (s) { return (ch[0] + s) % 12; }), best = idx, bd = 99;
      for (var d = -2; d <= 2; d++) {
        var j = idx + d; if (j < 0 || j >= pool.length) continue;
        if (pcs.indexOf(pool[j] % 12) >= 0 && Math.abs(d) < bd) { best = j; bd = Math.abs(d); }
      }
      return best;
    }
    function bar(rh, start, bn, dir, close) {
      var idx = start, out = [];
      rh.forEach(function (p, k) {
        if (k) idx += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)] + (dir > 0 ? (rnd() < 0.35 ? 1 : 0) : -(rnd() < 0.35 ? 1 : 0));
        idx = Math.max(0, Math.min(pool.length - 1, idx));
        if (p === 0 || p === 8 || (close && k === rh.length - 1)) idx = snap(idx, bn);
        out.push({ p: p, n: pool[idx], l: (k + 1 < rh.length ? rh[k + 1] : 16) - p });
      });
      return { notes: out, last: idx };
    }
    var bars = [];
    for (var ph = 0; ph < 2; ph++) {
      var r1 = rhythm(), r2 = rnd() < 0.5 ? r1 : rhythm(), r3 = RHY[rnd() < 0.5 ? 'long' : 'sparse'];
      var a = bar(r1, 2 + Math.floor(rnd() * 8), ph * 4, 1), b = bar(r2, a.last, ph * 4 + 1, -1);
      var d = bar(r3, b.last, ph * 4 + 3, -1, true);
      bars.push(a.notes, b.notes, a.notes, d.notes);   /* the 3rd bar repeats the 1st: that is the hook */
    }
    return bars;
  }

  function build(n, i, style) {
    var rnd = rng(n * 101 + i * 17 + 7), prog = pick(PROGS, i, n, 5);
    var gl = style === 'wild' ? GROOVES.filter(function (g) { return g.e; }) : GROOVES;
    var vl = style === 'calm' ? VNAMES_CALM : style === 'wild' ? VNAMES_WILD : VNAMES;
    var cm = style === 'wild' ? ['stab', 'pad', 'stab'] : style === 'calm' ? ['pad'] : style === 'steady' ? ['pad', 'none', 'pad'] : ['pad', 'stab', 'none', 'stab'];
    var g = pick(gl, i, n * 3, 3);
    return {
      prog: prog, g: g, bass: pick(BASS, i, n * 2, 5), voice: pick(vl, i, n, 3), chordMode: pick(cm, i, n, 1),
      tonic: 110 * Math.pow(2, pick(KEYS, i, n, 5) / 12), bassWave: pick(['triangle', 'sawtooth', 'square'], i, n, 1),
      mel: compose(prog, rnd, style), dbl: style === 'wild' && rnd() < 0.5
    };
  }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = st.vol;
    var comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    var len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    return true;
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f, t, a, peak, dec, dest, filt) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    env(g, t, a, peak, dec);
    if (filt) { var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); fl.connect(g); }
    else o.connect(g);
    g.connect(dest || master);
    o.start(t); o.stop(t + a + dec + 0.05);
    return o;
  }
  function kick(t, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    env(g, t, 0.005, v, 0.28); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.4);
  }
  function hiss(t, hp, peak, dec, bp) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = hp; if (bp) f.Q.value = 0.9;
    env(g, t, 0.002, peak, dec); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
  }
  /* a soft pad on a chord */
  function pad(rootHz, tri, t, dur, peak) {
    tri.forEach(function (s) {
      [-6, 6].forEach(function (det) {
        var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = hz(rootHz * 2, s); o.detune.value = det;
        fl.type = 'lowpass'; fl.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }
  function stab(rootHz, tri, t, peak) { tri.forEach(function (s) { tone('sawtooth', hz(rootHz * 2, s), t, 0.003, peak, 0.1, null, 2400); }); }

  var LV = { steady: 0.6, beat: 1, wild: 1.25 };

  /* one eighth-note step = two sixteenths; 8 steps per bar, 8 bars per tune */
  function playStep(step, t) {
    var bar = Math.floor(step / 8) % 8, s = step % 8, c = bar % 4, style = st.style, beatLen = 60 / st.bpm, half = 15 / st.bpm, T = tune, g = T.g;
    if (s % 2 && style !== 'click') t += (style === 'calm' ? 0 : g.sw) * 30 / st.bpm;   /* swing: only the off-beats are delayed */
    if (style === 'click') {
      if (s % 2 === 0) tone('square', s === 0 ? 1500 : 1000, t, 0.001, 0.25, 0.04);
      return;
    }
    var ch = T.prog.c[c], rootHz = T.tonic * Math.pow(2, ch[0] / 12), tri = Q[ch[1]], p0 = s * 2;
    var tones = [tri[0], tri[1], tri[2], 12, tri[3] !== undefined ? tri[3] : tri[2] + 3];
    var lv = LV[style] || 1, calm = style === 'calm', wild = style === 'wild';
    var mv = calm ? 0.05 : style === 'steady' ? 0.06 : wild ? 0.085 : 0.075;
    for (var sub = 0; sub < 2; sub++) {
      var p = p0 + sub, tt = t + (sub ? half : 0);
      /* drums */
      if (calm) {
        if (p === 0 || p === 8) kick(tt, 0.16);
      } else {
        if (g.k[p]) kick(tt, 0.85 * lv);
        if (g.sn[p]) { hiss(tt, 1800, 0.3 * lv, 0.13, true); tone('triangle', 190, tt, 0.002, 0.18 * lv, 0.07); }
        if (g.cl[p]) { hiss(tt, 1500, 0.4 * lv, 0.15, true); hiss(tt + 0.012, 2600, 0.25 * lv, 0.1, true); }
        if (g.gh[p]) hiss(tt, 1800, 0.1 * lv, 0.05, true);
        if (g.hh[p]) hiss(tt, 8000, 0.08 * lv * (p % 4 === 2 ? 1.4 : 1), 0.035);
        if (g.oh[p]) hiss(tt, 6000, 0.14 * lv, 0.14);
        if (g.pc[p]) { tone('sine', 2500, tt, 0.001, 0.12 * lv, 0.05); tone('square', 840, tt, 0.001, 0.03 * lv, 0.06, null, 2000); }
        if (g.cg[p]) tone('sine', 250 + (p % 3) * 40, tt, 0.002, 0.2 * lv, 0.13);
        if (wild && p % 2) hiss(tt, 9000, 0.06, 0.025);
        if (wild && bar === 7 && s >= 4) hiss(tt, 1800, 0.3 + s * 0.03, 0.07, true);   /* snare-roll fill into the next loop */
      }
      /* bass */
      T.bass.forEach(function (b) {
        if (b[0] !== p) return;
        tone(T.bassWave, hz(calm ? rootHz / 2 : rootHz, tones[b[1]]), tt, 0.006, calm ? 0.28 : T.bassWave === 'triangle' ? 0.5 : 0.38, Math.max(0.1, b[2] * half * 0.9), null, 600);
      });
      /* chords */
      if (T.chordMode === 'pad' && p === 0) pad(rootHz, tri, tt, beatLen * 4.05, calm ? 0.05 : 0.03);
      if (T.chordMode === 'stab' && !calm && g.st.indexOf(p) >= 0) stab(rootHz, tri, tt, wild ? 0.055 : 0.045);
      /* melody */
      T.mel[bar].forEach(function (nt) {
        if (nt.p !== p) return;
        var f = hz(T.tonic * 4, nt.n);
        VOICES[T.voice](f, tt, nt.l * half, mv);
        if (T.dbl) VOICES[T.voice](f * 2, tt, nt.l * half, mv * 0.4);
      });
    }
  }

  function pump() {
    if (!st.playing) return;
    var stepLen = 30 / st.bpm;
    while (st.next < ctx.currentTime + 0.18) { playStep(st.step, st.next); st.next += stepLen; st.step++; }
  }

  root.HTMusic = {
    available: function () { return !!(window.AudioContext || window.webkitAudioContext); },
    /* offset = seconds into the bar to start from, so the beat lines up with an animation that is already running */
    start: function (bpm, style, offset) {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      st.bpm = bpm || st.bpm; st.style = style || st.style;
      if (st.playing) return;
      tune = build(seedN, seedI, st.style);
      var sl = 30 / st.bpm, o = (offset || 0) % (sl * 8), k = Math.floor(o / sl);
      st.playing = true; st.step = k ? k + 1 : 0; st.next = ctx.currentTime + 0.06 + (k ? sl - (o - k * sl) : 0);
      timer = setInterval(pump, 40);
    },
    /* make the next beat 1 start now (aligns drums with the first repetition) */
    sync: function () { if (st.playing) { st.step = 0; st.next = ctx.currentTime + 0.05; } },
    /* pick the tune of exercise i (0-based) of lesson n: its own groove, bass, chords, key, instrument and melody */
    theme: function (n, i) { seedN = (n | 0) || 2; seedI = i | 0; },
    set: function (bpm, style) {
      st.bpm = bpm || st.bpm;
      if (style && style !== st.style) { st.style = style; if (st.playing) tune = build(seedN, seedI, st.style); }
    },
    stop: function () { st.playing = false; clearInterval(timer); timer = null; },
    pause: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    volume: function (v) { st.vol = v; if (master) master.gain.value = v; },
    isPlaying: function () { return st.playing; },
    /* short cue sounds for the timer */
    tick: function (high) { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); tone('sine', high ? 1320 : 880, ctx.currentTime, 0.002, 0.35, high ? 0.45 : 0.12); },
    unlock: function () { if (init() && ctx.state === 'suspended') ctx.resume(); },
    /* for tests: describe the tune that exercise i of lesson n would get in a style */
    describe: function (n, i, style) {
      var T = build(n, i, style);
      return { groove: T.g.name, bass: BASS.indexOf(T.bass), voice: T.voice, chords: T.chordMode, prog: PROGS.indexOf(T.prog), key: Math.round(12 * Math.log(T.tonic / 110) / Math.LN2), mel: T.mel[0].map(function (x) { return x.p + ':' + x.n; }).join(' ') };
    }
  };
})(typeof window !== 'undefined' ? window : this);
