/* music.js - generates workout music in the browser (Web Audio). No audio files needed.
 * Styles: 'beat' (energetic drums + bass), 'steady' (softer groove), 'calm' (pads for stretching), 'click' (metronome only).
 * Everything is locked to the exercise tempo, so one repetition always lands on whole beats.
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, noise = null, timer = null;
  var st = { bpm: 90, style: 'beat', vol: 0.7, step: 0, next: 0, playing: false };
  var ROOTS = [110, 87.31, 130.81, 98];            /* Am - F - C - G */
  var TRIADS = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
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
    var root = ROOTS[bar % 4], tri = TRIADS[bar % 4];
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
    var bar = Math.floor(step / 8) % 4, s = step % 8, root = ROOTS[bar], tri = TRIADS[bar], style = st.style;
    var beatLen = 60 / st.bpm;
    if (style === 'click') {
      if (s % 2 === 0) tone('square', s === 0 ? 1500 : 1000, t, 0.001, 0.25, 0.04);
      return;
    }
    if (style === 'calm') {
      if (s === 0) chord(bar, t, beatLen * 4.1, 0.05);
      if (s === 0 || s === 4) kick(t, 0.18);
      if (s === 0 || s === 3 || s === 5) tone('triangle', hz(root * 4, tri[(s + bar) % 3] + (s === 5 ? 12 : 0)), t, 0.01, 0.12, 0.7);
      return;
    }
    var hard = style === 'beat';
    if (s === 0 || s === 4) kick(t, hard ? 0.85 : 0.55);
    if (hard && (s === 3 || s === 7)) kick(t, 0.25);
    if (s === 2 || s === 6) hiss(t, 1800, hard ? 0.28 : 0.16, 0.13, true);
    hiss(t, 7000, (s % 2 ? 0.1 : 0.05) * (hard ? 1.4 : 1), 0.04);
    var bassPat = [0, 0, -1, 0, 0, -1, 7, -1];
    if (bassPat[s] >= 0 && (s % 2 === 0 || hard)) tone('triangle', hz(root, bassPat[s]), t, 0.005, hard ? 0.5 : 0.35, beatLen * 0.45, null, 600);
    if (s % 2 === 0) tone('square', hz(root * 4, tri[(s / 2 + bar) % 3]), t, 0.005, hard ? 0.07 : 0.045, 0.16, null, 2400);
    if (s === 0) chord(bar, t, beatLen * 4, hard ? 0.025 : 0.03);
  }

  function pump() {
    if (!st.playing) return;
    var stepLen = 30 / st.bpm;
    while (st.next < ctx.currentTime + 0.18) { playStep(st.step, st.next); st.next += stepLen; st.step++; }
  }

  root.HTMusic = {
    available: function () { return !!(window.AudioContext || window.webkitAudioContext); },
    start: function (bpm, style) {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      st.bpm = bpm || st.bpm; st.style = style || st.style;
      if (st.playing) return;
      st.playing = true; st.step = 0; st.next = ctx.currentTime + 0.06;
      timer = setInterval(pump, 40);
    },
    /* make the next beat 1 start now (aligns drums with the first repetition) */
    sync: function () { if (st.playing) { st.step = 0; st.next = ctx.currentTime + 0.05; } },
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
