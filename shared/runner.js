/* runner.js - wires an exercise page together: animation, workout timer, music.
 * Reads window.EX (the exercise data written into each page by the build script).
 */
(function () {
  'use strict';
  var EX = window.EX, $ = function (id) { return document.getElementById(id); };
  var fig = HTFigure.create($('stage'), EX.scene);
  var beatSec = 60 / EX.bpm, cycle = EX.beats * beatSec;       /* seconds per repetition */
  var isHold = EX.hold > 0;
  var HOLD_MOVE = 2;                                             /* seconds to move into a held pose */
  var PREP = 5, SWITCH = 5;

  function fmt(s) { s = Math.max(0, Math.ceil(s - 1e-6)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ---- build the timeline of phases ---- */
  var plan = [{ type: 'prep', dur: PREP }];
  var sides = EX.sides ? ['ימין', 'שמאל'] : [null];
  for (var s = 1; s <= EX.sets; s++) {
    sides.forEach(function (side, si) {
      plan.push({ type: 'work', set: s, side: side, flip: si === 1, dur: isHold ? EX.hold : EX.reps * cycle });
      if (EX.sides && si === 0) plan.push({ type: 'switch', set: s, dur: SWITCH });
    });
    if (s < EX.sets) plan.push({ type: 'rest', set: s, dur: EX.rest });
  }
  var total = plan.reduce(function (a, p) { return a + p.dur; }, 0);

  var run = { i: -1, t: 0, running: false, last: 0, done: false, musicOn: true };
  var musicStyle = EX.music, started = false;

  /* ---- DOM ---- */
  var elPhase = $('phase'), elTime = $('time'), elSub = $('sub'), elDots = $('dots'), elCap = $('cap'), elBr = $('br'), elTotal = $('totalLeft');
  var btnGo = $('go'), btnSkip = $('skip'), btnReset = $('reset');
  var elMusic = $('musicStyle'), elVol = $('vol');
  var dotEls = [];
  for (var i = 0; i < plan.length; i++) if (plan[i].type === 'work') {
    var d = document.createElement('span'); d.className = 'dot'; d.title = 'סט ' + plan[i].set + (plan[i].side ? ' – ' + plan[i].side : '');
    elDots.appendChild(d); dotEls.push({ el: d, idx: i });
  }
  $('totalAll').textContent = fmt(total);

  function setCaption(cap, br) {
    elCap.textContent = cap || '';
    elBr.textContent = br === 'in' ? 'שאיפה' : br === 'out' ? 'נשיפה' : '';
    elBr.className = 'br ' + (br || '');
  }

  /* ---- drawing the figure ---- */
  var idleT0 = performance.now();
  function frame(now) {
    var ph = plan[run.i], r;
    if (!started || run.done) {                       /* demo loop before start */
      var tt = (now - idleT0) / 1000;
      if (isHold) {
        var c = HOLD_MOVE * 2 + 3, x = tt % c;
        r = fig.atHold(x < HOLD_MOVE ? x / HOLD_MOVE : x < HOLD_MOVE + 3 ? 1 : 1 - (x - HOLD_MOVE - 3) / HOLD_MOVE, x >= HOLD_MOVE && x < HOLD_MOVE + 3 ? Math.sin(tt * 2.2) * 0.8 : 0);
      } else r = fig.atPhase(tt / cycle);
      fig.setMirror(false);
    } else if (ph.type === 'work') {
      var wt = run.running ? run.t + Math.min((now - run.last) / 1000, 0.2) : run.t;
      if (isHold) {
        var prog = wt / HOLD_MOVE;
        r = fig.atHold(prog, prog >= 1 ? Math.sin(wt * 2.2) * 0.8 : 0);
      } else r = fig.atPhase(wt / cycle);
      fig.setMirror(!!ph.flip);
    } else {
      r = fig.atHold(0, Math.sin(now / 900) * 0.6);
      var nx = plan[run.i + 1], nw = nx && nx.type === 'work' ? nx : ph;
      fig.setMirror(ph.type === 'switch' ? true : !!(nw && nw.flip && ph.type !== 'rest'));
    }
    fig.draw(r.pose);
    if (!started || run.done || ph.type === 'work') setCaption(r.cap, r.br);
    else setCaption(ph.type === 'rest' ? 'נוחו ונשמו' : ph.type === 'switch' ? 'עוברים לצד השני' : 'מתכוננים לעמדת הפתיחה', '');
    requestAnimationFrame(frame);
  }

  /* ---- timer logic ---- */
  var lastBeepSec = -1, lastRep = -1;
  function enter(i) {
    run.i = i; run.t = 0; lastBeepSec = -1; lastRep = -1;
    var p = plan[i];
    if (p.type === 'work') HTMusic.sync();
    if (i > 0) HTMusic.tick(true);
    render();
  }
  function render() {
    var p = plan[run.i];
    var remain = Math.max(p.dur - run.t, 0);
    dotEls.forEach(function (d) {
      d.el.className = 'dot' + (d.idx < run.i ? ' done' : d.idx === run.i ? ' now' : '');
    });
    var rem = 0;
    for (var j = run.i + 1; j < plan.length; j++) rem += plan[j].dur;
    elTotal.textContent = fmt(rem + remain);
    if (p.type === 'prep') { elPhase.textContent = 'התכוננו'; elTime.textContent = fmt(remain); elSub.textContent = 'קחו את עמדת הפתיחה'; }
    else if (p.type === 'rest') { elPhase.textContent = 'מנוחה'; elTime.textContent = fmt(remain); elSub.textContent = 'הסט הבא: ' + (p.set + 1) + ' מתוך ' + EX.sets; }
    else if (p.type === 'switch') { elPhase.textContent = 'החלפת צד'; elTime.textContent = fmt(remain); elSub.textContent = 'עכשיו צד שמאל'; }
    else {
      elPhase.textContent = 'סט ' + p.set + ' מתוך ' + EX.sets + (p.side ? ' · צד ' + p.side : '');
      if (isHold) { elTime.textContent = fmt(remain); elSub.textContent = 'החזיקו את התנוחה'; }
      else {
        var rep = Math.min(Math.floor(run.t / cycle) + 1, EX.reps);
        elTime.textContent = rep + ' / ' + EX.reps; elSub.textContent = 'חזרות · נשארו ' + fmt(remain);
      }
    }
  }
  function tickLoop() {
    var now = performance.now();
    if (run.running) {
      var dt = Math.min((now - run.last) / 1000, 1.5); run.last = now; run.t += dt;
      var p = plan[run.i];
      var left = p.dur - run.t;
      if (p.type !== 'work' && left <= 3 && Math.ceil(left) !== lastBeepSec && left > 0) { lastBeepSec = Math.ceil(left); HTMusic.tick(false); }
      if (p.type === 'work' && !isHold) {
        var rp = Math.floor(run.t / cycle);
        if (rp !== lastRep) { lastRep = rp; }
      }
      if (run.t >= p.dur) {
        if (run.i + 1 >= plan.length) finish(); else enter(run.i + 1);
      } else render();
    }
  }
  function finish() {
    run.running = false; run.done = true; started = false;
    HTMusic.tick(true); setTimeout(function () { HTMusic.tick(true); }, 220);
    if (musicOn()) HTMusic.stop();
    elPhase.textContent = 'כל הכבוד!'; elTime.textContent = '✓'; elSub.textContent = 'סיימת את התרגיל';
    dotEls.forEach(function (d) { d.el.className = 'dot done'; });
    elTotal.textContent = '0:00'; btnGo.textContent = 'שוב'; btnGo.dataset.state = 'done';
    document.dispatchEvent(new CustomEvent('ex-finished'));
    try { localStorage.setItem('ht-done-' + EX.id, '1'); } catch (e) {}
  }

  function musicOn() { return elMusic.value !== 'off'; }
  function applyMusic() {
    var v = elMusic.value;
    if (v === 'off') { HTMusic.stop(); return; }
    HTMusic.set(EX.bpm, v === 'auto' ? EX.music : v);
    if (run.running || started) HTMusic.start(EX.bpm, v === 'auto' ? EX.music : v);
  }
  elMusic.addEventListener('change', function () {
    applyMusic();
    if (elMusic.value !== 'off' && started === false && !run.done) { /* preview music while idle */ HTMusic.start(EX.bpm, elMusic.value === 'auto' ? EX.music : elMusic.value); idleT0 = performance.now(); }
    else if (elMusic.value !== 'off' && !HTMusic.isPlaying()) HTMusic.start(EX.bpm, elMusic.value === 'auto' ? EX.music : elMusic.value);
  });
  elVol.addEventListener('input', function () { HTMusic.volume(parseFloat(elVol.value)); });

  btnGo.addEventListener('click', function () {
    HTMusic.unlock();
    if (!started) {                                     /* start (or restart) */
      started = true; run.done = false; run.running = true; run.last = performance.now(); btnGo.dataset.state = 'run';
      btnGo.textContent = 'השהה';
      if (musicOn()) { HTMusic.stop(); HTMusic.start(EX.bpm, elMusic.value === 'auto' ? EX.music : elMusic.value); }
      enter(0);
    } else if (run.running) {
      run.running = false; btnGo.textContent = 'המשך'; HTMusic.pause();
    } else {
      run.running = true; run.last = performance.now(); btnGo.textContent = 'השהה'; HTMusic.resume();
    }
  });
  btnSkip.addEventListener('click', function () {
    if (!started) return;
    if (run.i + 1 >= plan.length) finish(); else enter(run.i + 1);
  });
  btnReset.addEventListener('click', function () {
    started = false; run.running = false; run.done = false; run.i = 0; run.t = 0; HTMusic.stop(); HTMusic.resume();
    btnGo.textContent = 'התחל תרגיל'; btnGo.dataset.state = 'idle'; initialRender(); idleT0 = performance.now();
  });

  function initialRender() {
    elPhase.textContent = 'מוכנים?'; elTime.textContent = fmt(total); elSub.textContent = 'זמן כולל לתרגיל';
    elTotal.textContent = fmt(total);
    dotEls.forEach(function (d) { d.el.className = 'dot'; });
  }
  initialRender();
  requestAnimationFrame(frame);
  setInterval(tickLoop, 100);
})();
