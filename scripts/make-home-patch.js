// Home wall without the baked-in logo: fills the logo's area of "תמונות/דף הבית.png" from the wall around it
// and writes it as a feathered transparent patch (assets/room/home-patch.png) that sits over home.jpg.
// Run:  node scripts/make-home-patch.js
const path = require('path'), fs = require('fs');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..');
const img = decode(path.join(root, 'תמונות', 'דף הבית.png'));
const X0 = 872, Y0 = 118, X1 = 1790, Y1 = 520, F = 26;           // fill box + feather width
const W = img.w, px = (x, y, c) => img.d[(y * W + x) * 4 + c];
const avg = (xs, ys, c) => { let s = 0; for (const x of xs) for (const y of ys) s += px(x, y, c); return s / (xs.length * ys.length); };
const rng = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const w = X1 - X0 + 1, h = Y1 - Y0 + 1, d = Buffer.alloc(w * h * 4);
const colsL = rng(X0 - 6, X0 - 2), colsR = rng(X1 + 2, X1 + 6), rowsT = rng(Y0 - 6, Y0 - 2), rowsB = rng(Y1 + 2, Y1 + 6);
for (let c = 0; c < 3; c++) {
  const L = [], R = [], T = [], B = [];
  for (let y = 0; y < h; y++) { L[y] = avg(colsL, rng(Math.max(0, Y0 + y - 3), Y0 + y + 3), c); R[y] = avg(colsR, rng(Y0 + y - 3, Y0 + y + 3), c); }
  for (let x = 0; x < w; x++) { T[x] = avg(rng(X0 + x - 3, Math.min(W - 1, X0 + x + 3)), rowsT, c); B[x] = avg(rng(X0 + x - 3, Math.min(W - 1, X0 + x + 3)), rowsB, c); }
  const c00 = T[0], c10 = T[w - 1], c01 = B[0], c11 = B[w - 1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = x / (w - 1), t = y / (h - 1);
    const H = L[y] * (1 - s) + R[y] * s, V = T[x] * (1 - t) + B[x] * t;
    const bil = c00 * (1 - s) * (1 - t) + c10 * s * (1 - t) + c01 * (1 - s) * t + c11 * s * t;
    d[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(H + V - bil)));
  }
}
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const e = Math.min(x, y, w - 1 - x, h - 1 - y), a = Math.min(1, e / F);
  d[(y * w + x) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a));
}
encode({ w, h, d }, path.join(root, 'assets', 'room', 'home-patch.png'));
console.log('home-patch', w + 'x' + h, 'at', X0, Y0, (fs.statSync(path.join(root, 'assets', 'room', 'home-patch.png')).size / 1024) | 0, 'KB');
