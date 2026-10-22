// Trims the button sheet (תמונות/כפתור.png, full-size transparent canvas) to the button + its soft shadow -> assets/room/button.png
// Run:  node scripts/make-button.js
const path = require('path'), fs = require('fs');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), im = decode(path.join(root, 'תמונות', 'כפתור.png'));
let x0 = im.w, y0 = im.h, x1 = 0, y1 = 0, bx0 = im.w, bx1 = 0, by0 = im.h, by1 = 0;
for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
  const a = im.d[(y * im.w + x) * 4 + 3];
  if (a > 2) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (a > 250) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
}
const w = x1 - x0 + 1, h = y1 - y0 + 1, d = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) im.d.copy(d, y * w * 4, ((y0 + y) * im.w + x0) * 4, ((y0 + y) * im.w + x0 + w) * 4);
encode({ w, h, d }, path.join(root, 'assets', 'room', 'button.png'));
console.log('button.png', w + 'x' + h, '| solid body inside it: x', bx0 - x0, '-', bx1 - x0, ' y', by0 - y0, '-', by1 - y0);
