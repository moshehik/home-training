// Crops the timer plate out of תמונות/פס.png and wipes its painted colon (the page draws its own, yellow, colon with the digits)
// -> assets/room/clock-plate.png.   Run:  node scripts/make-clock-plate.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), im = decode(path.join(root, 'תמונות', 'פס.png'));
let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.d[(y * im.w + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const w = x1 - x0 + 1, h = y1 - y0 + 1, d = Buffer.alloc(w * h * 4), dark = [26, 28, 35];
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const s = ((y + y0) * im.w + x + x0) * 4, o = (y * w + x) * 4;
  const r = im.d[s], g = im.d[s + 1], b = im.d[s + 2], a = im.d[s + 3];
  const pink = a > 10 && r > 150 && g < 140 && b < 160 && r - g > 60;   // the colon's pink; the plate frame is tan (r-g ~ 30)
  d[o] = pink ? dark[0] : r; d[o + 1] = pink ? dark[1] : g; d[o + 2] = pink ? dark[2] : b; d[o + 3] = a;
}
// soften the leftover anti-aliased rim of the colon: any pixel inside the plate that is brighter than the face but not frame-coloured
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (x < 40 || x > w - 40 || y < 40 || y > h - 40) continue;
  const o = (y * w + x) * 4;
  if (d[o + 3] > 10 && (d[o] > 40 || d[o + 1] > 40 || d[o + 2] > 50)) { d[o] = dark[0]; d[o + 1] = dark[1]; d[o + 2] = dark[2]; }
}
encode({ w, h, d }, path.join(root, 'assets', 'room', 'clock-plate.png'));
console.log('clock-plate.png', w + 'x' + h);
