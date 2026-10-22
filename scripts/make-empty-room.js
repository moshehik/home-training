// Small smoothed copy of the empty room (4x4 averages) that continues the room past the stage edges, like home-ext.png does for the home page
// -> assets/room/empty-ext.png.   Run:  node scripts/make-empty-room.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), im = decode(path.join(root, 'תמונות', 'חדר ריק.png')), w = im.w >> 2, h = im.h >> 2, d = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const s = [0, 0, 0];
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) { const i = ((y * 4 + dy) * im.w + x * 4 + dx) * 4; for (let c = 0; c < 3; c++) s[c] += im.d[i + c]; }
  for (let c = 0; c < 3; c++) d[(y * w + x) * 4 + c] = Math.round(s[c] / 16);
  d[(y * w + x) * 4 + 3] = 255;
}
encode({ w, h, d }, path.join(root, 'assets', 'room', 'empty-ext.png'));
console.log('empty-ext.png', w + 'x' + h);
