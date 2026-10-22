/* demo.js - looping animation and music button for the instructions page (no timer). Uses window.EX. */
(function () {
  'use strict';
  var EX = window.EX, $ = function (id) { return document.getElementById(id); };
  var fig = HTFigure.create($('stage'), EX.scene);
  var cycle = EX.beats * 60 / EX.bpm, t0 = performance.now();
  var hold = EX.hold > 0;
  setInterval(function () {
    var t = (performance.now() - t0) / 1000, r;
    if (hold) {
      var x = t % 7;
      r = fig.atHold(x < 2 ? x / 2 : x < 5 ? 1 : 1 - (x - 5) / 2, x >= 2 && x < 5 ? Math.sin(t * 2.2) * 0.8 : 0);
    } else r = fig.atPhase(t / cycle);
    fig.draw(r.pose);
    $('cap').textContent = r.cap || '';
    var br = $('br'); br.textContent = r.br === 'in' ? 'שאיפה' : r.br === 'out' ? 'נשיפה' : ''; br.className = 'br ' + (r.br || '');
  }, 33);
  var btn = $('musicBtn');
  function sync() { btn.textContent = HTMusic.isPlaying() ? 'עצרי מוזיקה' : 'נגני מוזיקה'; }
  btn.addEventListener('click', function () {
    HTMusic.unlock();
    if (HTMusic.isPlaying()) HTMusic.stop(); else HTMusic.start(EX.bpm, EX.music);
    sync();
  });
  $('vol').addEventListener('input', function () { HTMusic.volume(parseFloat(this.value)); });
  sync();
})();
