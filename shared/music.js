/* music.js - generates workout music in the browser (Web Audio). No audio files needed.
 * Styles: 'beat' (energetic drums + bass), 'steady' (softer groove), 'calm' (pads for stretching), 'click' (metronome only).
 * Everything is locked to the exercise tempo, so one repetition always lands on whole beats.
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, noise = null, timer = null;
  var st = { bpm: 90, style: 'beat', vol: 0.7, step: 0, next: 0, playing: false };
  /* chord shapes (semitones above the root) */
  var Q = { M: [0, 4, 7], m: [0, 3, 7], s: [0, 5, 7], d7: [0, 4, 7, 10], m7: [0, 3, 7, 10] };
  /* one theme per lesson: r = chord roots (Hz, 4 bars), q = chord shapes, b = bass pattern over 8 eighths (-1 = rest),
   * lead = lead waveform, sw = swing (share of an eighth that off-beats are delayed), ex = extra kick steps in 'beat' */
  var THEMES = [
    { r: [130.81, 87.31, 98, 110],         q: ['M', 'M', 'M', 'm'],     b: [0, -1, 0, -1, 7, -1, 0, -1],     lead: 'triangle', sw: 0,    ex: [3, 7] },     /* 1  C major, bright morning */
    { r: [110, 87.31, 130.81, 98],         q: ['m', 'M', 'M', 'M'],     b: [0, 0, -1, 0, 0, -1, 7, -1],     lead: 'square',   sw: 0,    ex: [3, 7] },     /* 2  A minor, classic */
    { r: [146.83, 98, 146.83, 130.81],     q: ['m', 'M', 'm', 'M'],     b: [0, -1, 7, -1, 0, -1, 10, -1],   lead: 'sawtooth', sw: 0.18, ex: [3, 7] },     /* 3  D dorian, relaxed groove */
    { r: [82.41, 130.81, 98, 73.42],       q: ['m', 'M', 'M', 'M'],     b: [0, 0, 0, -1, 0, 12, 0, -1],    lead: 'sawtooth', sw: 0,    ex: [3] },        /* 4  E minor, driving rock */
    { r: [98, 130.81, 146.83, 82.41],      q: ['d7', 'd7', 'd7', 'm7'], b: [0, -1, 12, 0, -1, 7, -1, 10],   lead: 'square',   sw: 0.25, ex: [3, 6] },     /* 5  G funk */
    { r: [87.31, 116.54, 130.81, 73.42],   q: ['M', 'M', 'M', 'm'],     b: [0, -1, 0, 7, -1, 0, 7, -1],     lead: 'triangle', sw: 0.1,  ex: [7] },        /* 6  F major, sunny */
    { r: [110, 146.83, 164.81, 110],       q: ['m7', 'd7', 'd7', 'm7'], b: [0, -1, 3, -1, 5, -1, 7, -1],    lead: 'sawtooth', sw: 0.3,  ex: [3, 7] },     /* 7  A blues shuffle */
    { r: [116.54, 155.56, 174.61, 98],     q: ['M', 'M', 'M', 'm'],     b: [0, 0, -1, 7, 0, -1, 12, -1],    lead: 'square',   sw: 0,    ex: [7] },        /* 8  Bb major, march */
    { r: [130.81, 103.83, 155.56, 116.54], q: ['m', 'M', 'M', 'M'],     b: [0, 0, 12, 0, 0, 12, 0, 12],    lead: 'sawtooth', sw: 0,    ex: [3, 5, 7] },  /* 9  C minor, hard dance */
    { r: [146.83, 110, 123.47, 98],        q: ['s', 'M', 'm', 'M'],     b: [0, -1, -1, -1, 7, -1, -1, -1], lead: 'sine',     sw: 0,    ex: [7] },        /* 10 D, floating */
    { r: [164.81, 98, 146.83, 130.81],     q: ['m', 'M', 'M', 'M'],     b: [0, -1, 0, 7, -1, 0, -1, 7],    lead: 'triangle', sw: 0.12, ex: [3, 7] },     /* 11 E minor, folk */
    { r: [98, 164.81, 130.81, 146.83],     q: ['s', 'm', 's', 'M'],     b: [0, -1, -1, 7, -1, -1, 0, -1],  lead: 'sine',     sw: 0,    ex: [7] },        /* 12 G sus, airy */
    { r: [103.83, 87.31, 138.59, 155.56],  q: ['M', 'm', 'M', 'M'],     b: [0, -1, -1, -1, -1, -1, -1, -1], lead: 'sine',    sw: 0,    ex: [] },         /* 13 Ab, deep calm */
    { r: [110, 146.83, 130.81, 98],        q: ['s', 'M', 'M', 'M'],     b: [0, -1, -1, 7, -1, -1, 0, -1],  lead: 'triangle', sw: 0,    ex: [7] },        /* 14 A sus, soft and steady */
    { r: [130.81, 98, 110, 87.31],         q: ['M', 'M', 'm', 'M'],     b: [0, -1, 0, -1, 7, -1, 5, -1],    lead: 'triangle', sw: 0.1,  ex: [3, 7] },     /* 15 C major, light and flowing */
    { r: [110, 130.81, 146.83, 98],        q: ['m', 'M', 'M', 'M'],     b: [0, 0, 12, 0, 0, 12, 7, 12],    lead: 'sawtooth', sw: 0,    ex: [3, 5, 7] }   /* 16 A minor, driving interval */
  ];
  var th = THEMES[1];
  function hz(base, semis) { return base * Math.pow(2, semis / 12); }

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
    var o = ctx.createOscillator(), g = ctx.createGain(), out = g;
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
  function chord(bar, t, dur, peak) {
    var root = th.r[bar % 4], tri = Q[th.q[bar % 4]];
    tri.forEach(function (s) {
      [-6, 6].forEach(function (det) {
        var o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = hz(root * 2, s); o.detune.value = det;
        fl.type = 'lowpass'; fl.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
      });
    });
  }

  /* one eighth-note step; 8 steps per bar, 4 bars per chord loop */
  function playStep(step, t) {
    var bar = Math.floor(step / 8) % 4, s = step % 8, root = th.r[bar], tri = Q[th.q[bar]], style = st.style;
    var beatLen = 60 / st.bpm;
    if (s % 2 && style !== 'click') t += th.sw * 30 / st.bpm;   /* swing: only the off-beats are delayed, the beats stay put */
    if (style === 'click') {
      if (s % 2 === 0) tone('square', s === 0 ? 1500 : 1000, t, 0.001, 0.25, 0.04);
      return;
    }
    if (style === 'calm') {
      if (s === 0) chord(bar, t, beatLen * 4.1, 0.05);
      if (s === 0 || s === 4) kick(t, 0.18);
      if (s === 0 || s === 3 || s === 5) tone('triangle', hz(root * 4, tri[(s + bar) % tri.length] + (s === 5 ? 12 : 0)), t, 0.01, 0.12, 0.7);
      return;
    }
    var hard = style === 'beat';
    if (s === 0 || s === 4) kick(t, hard ? 0.85 : 0.55);
    if (hard && th.ex.indexOf(s) >= 0) kick(t, 0.25);
    if (s === 2 || s === 6) hiss(t, 1800, hard ? 0.28 : 0.16, 0.13, true);
    hiss(t, 7000, (s % 2 ? 0.1 : 0.05) * (hard ? 1.4 : 1), 0.04);
    var bassPat = th.b;
    if (bassPat[s] >= 0 && (s % 2 === 0 || hard)) tone('triangle', hz(root, bassPat[s]), t, 0.005, hard ? 0.5 : 0.35, beatLen * 0.45, null, 600);
    if (s % 2 === 0) tone(th.lead, hz(root * 4, tri[(s / 2 + bar) % tri.length]), t, 0.005, (hard ? 0.07 : 0.045) * (th.lead === 'sawtooth' ? 0.6 : th.lead === 'sine' ? 1.4 : 1), 0.16, null, 2400);
    if (s === 0) chord(bar, t, beatLen * 4, hard ? 0.025 : 0.03);
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
      var sl = 30 / st.bpm, o = (offset || 0) % (sl * 8), k = Math.floor(o / sl);
      st.playing = true; st.step = k ? k + 1 : 0; st.next = ctx.currentTime + 0.06 + (k ? sl - (o - k * sl) : 0);
      timer = setInterval(pump, 40);
    },
    /* make the next beat 1 start now (aligns drums with the first repetition) */
    sync: function () { if (st.playing) { st.step = 0; st.next = ctx.currentTime + 0.05; } },
    /* pick the theme of lesson n (1-13); exercises outside any lesson keep the default */
    theme: function (n) { th = THEMES[(((n | 0) || 2) - 1) % THEMES.length]; },
    set: function (bpm, style) { st.bpm = bpm || st.bpm; if (style) st.style = style; },
    stop: function () { st.playing = false; clearInterval(timer); timer = null; },
    pause: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    volume: function (v) { st.vol = v; if (master) master.gain.value = v; },
    isPlaying: function () { return st.playing; },
    /* short cue sounds for the timer */
    tick: function (high) { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); tone('sine', high ? 1320 : 880, ctx.currentTime, 0.002, 0.35, high ? 0.45 : 0.12); },
    unlock: function () { if (init() && ctx.state === 'suspended') ctx.resume(); }
  };
})(typeof window !== 'undefined' ? window : this);
