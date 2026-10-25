// Re-tints the cream shaggy rug in the room's dusty-rose palette -> assets/room/rug-rose.png.   Run:  node scripts/make-rug-rose.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), src = path.join(root, 'assets', 'room', 'rug-cream.png'), im = decode(src);
const lo = [150, 98, 100], hi = [244, 206, 198];   // shadows -> highlights (dusty rose, a little deeper than the floor)
let mn = 255, mx = 0;
for (let i = 0; i < im.d.length; i += 4) if (im.d[i + 3] > 200) { const l = 0.3 * im.d[i] + 0.59 * im.d[i + 1] + 0.11 * im.d[i + 2]; mn = Math.min(mn, l); mx = Math.max(mx, l); }
const out = Buffer.from(im.d);
for (let i = 0; i < out.length; i += 4) {
  const l = 0.3 * im.d[i] + 0.59 * im.d[i + 1] + 0.11 * im.d[i + 2], k = Math.max(0, Math.min(1, (l - mn) / (mx - mn || 1)));
  for (let c = 0; c < 3; c++) out[i + c] = Math.round(lo[c] + (hi[c] - lo[c]) * k);
}
encode({ w: im.w, h: im.h, d: out }, path.join(root, 'assets', 'room', 'rug-rose.png'));
console.log('rug-rose.png', im.w + 'x' + im.h);
