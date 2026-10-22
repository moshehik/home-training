// Crops + shrinks "תמונות/שטיח למעבר.png" (a pink rug corner on a transparent background) into assets/landing/rug-edge.png,
// the layer that lies across the seam between two sections of landing.html.
// Run:  node scripts/make-rug-edge.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..');
const im = decode(path.join(root, 'תמונות', 'שטיח למעבר.png'));
const CROP_H = 830, OW = 1400, OH = Math.round(CROP_H * OW / im.w), k = im.w / OW;
const out = Buffer.alloc(OW * OH * 4);
for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
  // box filter over the source pixels (alpha-weighted so the fuzzy edge keeps its colour)
  const x0 = Math.floor(x * k), x1 = Math.max(x0 + 1, Math.floor((x + 1) * k)), y0 = Math.floor(y * k), y1 = Math.max(y0 + 1, Math.floor((y + 1) * k));
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * im.w + xx) * 4, al = im.d[i + 3]; r += im.d[i] * al; g += im.d[i + 1] * al; b += im.d[i + 2] * al; a += al; n++; }
  const o = (y * OW + x) * 4;
  if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / n; }
}
encode({ w: OW, h: OH, d: out }, path.join(root, 'assets', 'landing', 'rug-edge.png'));
console.log('rug-edge.png', OW + 'x' + OH);
