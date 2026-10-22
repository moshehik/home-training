// Polished metallic GOLD version of the home-page button -> assets/room/button-gold.png (half size). Same finish as make-switches.js.
// Run:  node scripts/make-gold-button.js
// Metallic room-switch buttons for the workout picker: recolours assets/room/button.png (the home-page button) in 11 tones
// from the site palette, keeping its exact shape, rim and shadow, and gives it a polished-metal finish (specular band, reflected horizon, glossy streak, brushed lines). -> assets/room/sw-0..10.png (half size)
// Run:  node scripts/make-switches.js   (after scripts/make-button.js)
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), src = decode(path.join(root, 'assets', 'room', 'button.png'));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// [light, dark] per tone - one family: pearly pink-silver metals (rose gold, blush, rose, pink gold, dusty rose, silver, platinum, silver-blue...)
const TONES = [['#ffe9a0', '#a8730f']];
const BY0 = 32, BY1 = 428, BX0 = 24, BX1 = 1495, W = src.w, H = src.h, LO = 135, HI = 204;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const g = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const mix = (p, q, k) => p + (q - p) * k;
TONES.forEach((t, n) => {
  const lt = hex(t[0]), dk = hex(t[1]), d = Buffer.from(src.d);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, a = d[i + 3], w = sm(200, 255, a);
    if (w <= 0) continue;
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const base = Math.min(1, Math.max(0, (lum - LO) / (HI - LO)));          // the original button's own light-to-dark shading (rim included)
    const v = (y - BY0) / (BY1 - BY0), u = (x - BX0) / (BX1 - BX0), ud = u - 0.14 * (v - 0.5);   // ud: the highlights lean diagonally
    // polished-metal look: a bright specular band near the top, a dark reflected horizon below the middle, a bounce of light at the bottom,
    // a glossy diagonal streak, and fine brushed lines
    let k = 0.2 + base * 0.5 + 0.62 * g(v, 0.15, 0.075) - 0.34 * g(v, 0.72, 0.07) + 0.3 * g(v, 0.9, 0.06)
      + 0.3 * g(ud, 0.2, 0.06) * (1.1 - v) + 0.16 * g(ud, 0.52, 0.025) - 0.14 * g(ud, 0.78, 0.09)
      + (hash(y) - 0.5) * 0.06 + Math.sin(x * 0.011 + hash(y) * 6.28) * 0.02;
    for (let c = 0; c < 3; c++) {
      const col = k >= 1 ? mix(lt[c], 255, Math.min(1, (k - 1) * 1.1)) : k >= 0 ? mix(dk[c], lt[c], k) : mix(dk[c], dk[c] * 0.7, Math.min(1, -k * 1.6));
      d[i + c] = Math.round(mix(d[i + c], Math.max(0, Math.min(255, col)), w));
    }
  }
  // half size (box filter on premultiplied colour)
  const w2 = W >> 1, h2 = H >> 1, o = Buffer.alloc(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const j = ((y * 2 + dy) * W + x * 2 + dx) * 4, al = d[j + 3]; r += d[j] * al; g += d[j + 1] * al; b += d[j + 2] * al; a += al; }
    const q = (y * w2 + x) * 4;
    if (a) { o[q] = Math.round(r / a); o[q + 1] = Math.round(g / a); o[q + 2] = Math.round(b / a); o[q + 3] = Math.round(a / 4); }
  }
  encode({ w: w2, h: h2, d: o }, path.join(root, 'assets', 'room', 'button-gold.png'));
});
console.log('button-gold.png', (W >> 1) + 'x' + (H >> 1) + ' | body x ' + (BX0 >> 1) + '-' + (BX1 >> 1) + ' y 16-214');
