/* אייקון הלשונית: נקודה שמתחלפת כל הזמן בין אפור לורוד */
(function () {
  var COLORS = ['#8c8c8c', '#e8528a'], i = 0, urls = [];
  try {
    COLORS.forEach(function (col) {
      var c = document.createElement('canvas');
      c.width = c.height = 64;
      var x = c.getContext('2d');
      x.fillStyle = col;
      x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fill();
      urls.push(c.toDataURL('image/png'));
    });
    document.querySelectorAll('link[rel~="icon"]').forEach(function (l) { l.remove(); });
    var link = document.createElement('link');
    link.rel = 'icon'; link.type = 'image/png';
    document.head.appendChild(link);
    (function tick() { link.href = urls[i++ % 2]; setTimeout(tick, 700); })();
  } catch (e) {}
})();
