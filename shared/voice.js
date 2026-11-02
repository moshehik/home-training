/* Spoken instructions for the exercise screen: plays the clips made by scripts/make-voice.js (assets/voice/<name>.mp3)
 * over the music, which is turned down while she speaks. One clip at a time; a clip that arrives while another is
 * playing waits for it (only the latest waiting one is kept, so the narration never falls far behind the wall text). */
(function (root) {
  var BASE = 'assets/voice/', man = null, loaded = false, cur = null, queued = null, on = true, waiters = [];
  var CHARS_PER_SEC = 9;   /* measured on the clips: the voice reads about 10 characters a second */

  function loaded_() { loaded = true; waiters.splice(0).forEach(function (f) { f(); }); }
  function loadManifest() {
    try {
      fetch(BASE + 'manifest.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (m) { man = m; }).catch(function () {}).then(loaded_);
    } catch (e) { loaded_(); }
  }
  function duck(v) { if (root.HTMusic && HTMusic.duck) HTMusic.duck(v); }
  function done(a) { if (cur !== a) return; cur = null; if (queued) { var q = queued; queued = null; play(q); } else duck(false); }
  function play(name) {
    var a = new Audio(BASE + name + '.mp3'); cur = a; duck(true);
    a.addEventListener('ended', function () { done(a); });
    a.addEventListener('error', function () { done(a); });
    var p = a.play(); if (p && p.catch) p.catch(function () { done(a); });
  }

  root.HTVoice = {
    /* the clip list loads in the background; with no list (opened as a file) every clip is simply tried */
    ready: function (fn) { if (loaded) fn(); else waiters.push(fn); },
    has: function (name) { return !man || man[name] !== undefined; },
    /* seconds a clip lasts (from the list, else estimated from the text length) */
    length: function (name, text) { return man && man[name] ? man[name] : text ? text.length / CHARS_PER_SEC : 0; },
    enabled: function () { return on; },
    enable: function (v) { on = !!v; if (!on) this.stop(); },
    say: function (name) { if (!on || !this.has(name)) return; if (cur) queued = name; else play(name); },
    stop: function () { queued = null; var a = cur; cur = null; if (a) a.pause(); duck(false); },
    pause: function () { if (cur) cur.pause(); },
    resume: function () { if (cur) { var p = cur.play(); if (p && p.catch) p.catch(function () {}); } }
  };
  loadManifest();
})(typeof window !== 'undefined' ? window : this);
