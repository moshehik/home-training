// Takes the lamp, the chair and the plant out of "תמונות/דף הבית.png" so they can be re-placed (smaller / further right) on the home screen.
// The empty room ("תמונות/חדר ריק.png", same room without any drawing) gives the exact wall and floor behind them - no guessing.
// Writes to assets/room/:
//   home-lamp-patch.png, home-furn-patch.png  - the empty wall/floor, sits over home.jpg where the lamp / chair / plant were
//   home-lamp.png, home-chair.png, home-plant.png - the line drawings alone, transparent
//   home-ext.png  - small clean copy of the wall (lamp erased), used for the room that continues past the stage edges
// Run:  node scripts/make-home-parts.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), out = path.join(root, 'assets', 'room'), pic = f => path.join(root, 'תמונות', f);
const home = decode(pic('דף הבית.png')), empty = decode(pic('חדר ריק.png')), W = home.w, H = home.h;
const lum = (d, i) => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
const LAMP = [380, 0, 690, 295], FURN = [1215, 560, 1845, 1050];

function crop(src, [x0, y0, x1, y1]) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) src.copy(d, y * w * 4, ((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4);
  return { w, h, d };
}
// the empty room, feathered on the sides that are not the screen edge
function patch(name, box, topEdge) {
  const c = crop(empty.d, box), { w, h, d } = c;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = Math.min(x, w - 1 - x, h - 1 - y, topEdge ? y : 1e9), a = Math.min(1, e / 8);
    d[(y * w + x) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a));
  }
  encode(c, path.join(out, name)); console.log(name, w + 'x' + h);
}
patch('home-lamp-patch.png', LAMP, false);
patch('home-furn-patch.png', FURN, true);
patch('ath-patch.png', [25, 529, 992, 1057], true);   // where the baked-in sport figures were (the animated ones are drawn by shared/app.js); run after make-athletes.js

// the line drawings alone: opacity = how much darker than the empty room underneath
function cut(name, box) {
  const o = crop(home.d, box), f = crop(empty.d, box);
  for (let i = 0; i < o.w * o.h; i++) {
    const bg = lum(f.d, i), dk = lum(o.d, i), a = Math.max(0, Math.min(1, (bg - dk) / (bg - 24)));
    o.d[i * 4] = 22; o.d[i * 4 + 1] = 20; o.d[i * 4 + 2] = 20; o.d[i * 4 + 3] = Math.round(a * 255);
  }
  encode(o, path.join(out, name)); console.log(name, o.w + 'x' + o.h);
}
cut('home-lamp.png', [385, 0, 680, 290]);
cut('home-chair.png', [1470, 565, 1840, 1045]);
cut('home-plant.png', [1220, 615, 1475, 1000]);

// small clean copy of the whole wall (lamp erased) for the extension past the stage edges: 4x4 averages
{
  const full = Buffer.from(home.d), [x0, y0, x1, y1] = LAMP;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) empty.d.copy(full, (y * W + x) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
  const w = W / 4, h = H / 4, d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) { let s = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s += full[((y * 4 + j) * W + x * 4 + i) * 4 + c]; d[(y * w + x) * 4 + c] = Math.round(s / 16); }
  encode({ w, h, d }, path.join(out, 'home-ext.png')); console.log('home-ext.png', w + 'x' + h);
}
