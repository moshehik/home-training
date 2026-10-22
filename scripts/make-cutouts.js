// Cuts the loose elements out of the two sheets in "תמונות" (3.png, 4.png) into transparent PNGs in assets/room/.
// Run:  node scripts/make-cutouts.js
const path = require('path'), fs = require('fs');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), src = f => path.join(root, 'תמונות', f), out = path.join(root, 'assets', 'room');
fs.mkdirSync(out, { recursive: true });
const sheets = { 3: decode(src('3.png')), 4: decode(src('4.png')) };

function crop(img, [x0, y0, x1, y1]) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1, d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) img.d.copy(d, y * w * 4, ((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4);
  return { w, h, d };
}
const lum = (d, i) => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
const minc = (d, i) => Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);

// Line art: white becomes transparent, darkness becomes opacity (keeps the anti-aliased edges).
function ink(im) {
  for (let i = 0; i < im.w * im.h; i++) {
    const a = Math.min(255, (255 - lum(im.d, i)) * 1.15);
    im.d[i * 4] = 22; im.d[i * 4 + 1] = 20; im.d[i * 4 + 2] = 20; im.d[i * 4 + 3] = a;
  }
  return im;
}
// Photo / colour objects on white: flood the white from the border, keep the biggest piece, soften the rim.
function flood(im, { keep = true, thr = 246, rim = 2, holes = 0 } = {}) {
  const { w, h, d } = im, bg = new Uint8Array(w * h), st = [];
  const isW = i => minc(d, i) >= thr;
  const push = i => { if (!bg[i] && isW(i)) { bg[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const p = st.pop(), x = p % w; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (p >= w) push(p - w); if (p < w * (h - 1)) push(p + w); }
  if (holes) { // enclosed white pockets bigger than `holes` pixels are background too (eyes and teeth are smaller)
    const seen = new Uint8Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (bg[s] || seen[s] || !isW(s)) continue;
      const q = [s], comp = []; seen[s] = 1;
      while (q.length) { const p = q.pop(); comp.push(p); const x = p % w; for (const t of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (t >= 0 && t < w * h && !bg[t] && !seen[t] && isW(t)) { seen[t] = 1; q.push(t); } }
      if (comp.length > holes) comp.forEach(p => { bg[p] = 1; });
    }
  }
  if (keep) { // keep only the biggest connected non-background component
    const lab = new Int32Array(w * h); let best = 0, bestN = 0, n = 0;
    for (let s = 0; s < w * h; s++) {
      if (bg[s] || lab[s]) continue; n++; let c = 0; const q = [s]; lab[s] = n;
      while (q.length) { const p = q.pop(); c++; const x = p % w; for (const t of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (t >= 0 && t < w * h && !bg[t] && !lab[t]) { lab[t] = n; q.push(t); } }
      if (c > bestN) { bestN = c; best = n; }
    }
    for (let i = 0; i < w * h; i++) if (!bg[i] && lab[i] !== best) bg[i] = 1;
  }
  let a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = bg[i] ? 0 : 1;
  for (let r = 0; r < rim; r++) { // erode by one pixel with a soft step
    const b = a.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (a[i] > 0) b[i] = Math.min(a[i], a[i - 1], a[i + 1], a[i - w], a[i + w]) < 1 ? a[i] * 0.55 : a[i]; }
    a = b;
  }
  for (let i = 0; i < w * h; i++) d[i * 4 + 3] = Math.round(a[i] * 255);
  return im;
}
// A single-colour brush stroke on white.
function tint(im) {
  let best = 255, bi = 0; for (let i = 0; i < im.w * im.h; i++) { const l = lum(im.d, i); if (l < best) { best = l; bi = i; } }
  const c = [im.d[bi * 4], im.d[bi * 4 + 1], im.d[bi * 4 + 2]];
  for (let i = 0; i < im.w * im.h; i++) { const a = Math.max(0, Math.min(1, (255 - lum(im.d, i)) / (255 - best))); im.d[i * 4] = c[0]; im.d[i * 4 + 1] = c[1]; im.d[i * 4 + 2] = c[2]; im.d[i * 4 + 3] = Math.round(a * 255); }
  return im;
}
// Rounded-rectangle mask (drops the printed shadow that surrounds the mirror in the sheet).
function roundMask(im, r, inset = 0) {
  const { w, h, d } = im;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.min(Math.max(x, r + inset), w - 1 - r - inset), cy = Math.min(Math.max(y, r + inset), h - 1 - r - inset);
    const dist = Math.hypot(x - cx, y - cy) - r; const a = Math.max(0, Math.min(1, 0.5 - dist));
    const i = y * w + x; d[i * 4 + 3] = Math.round(d[i * 4 + 3] * a);
  }
  return im;
}
// Blank out the printed digits of the clock so a live timer can be drawn on the face.
function blankClock(im) {
  const { w, h, d } = im;
  // face colour = sample of the cream face, between the digits and the edge
  const fi = (Math.round(h * 0.5) * w + Math.round(w * 0.06)) * 4, face = [d[fi], d[fi + 1], d[fi + 2]];
  const x0 = Math.round(w * 0.2), x1 = Math.round(w * 0.88), y0 = Math.round(h * 0.12), y1 = Math.round(h * 0.93);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; d[i] = face[0]; d[i + 1] = face[1]; d[i + 2] = face[2]; d[i + 3] = 255; }
  return im;
}

// Clear everything right of x0 and below y0 (stray bits of a neighbouring object).
function dropCorner(im, x0, y0) {
  for (let y = y0; y < im.h; y++) for (let x = x0; x < im.w; x++) im.d[(y * im.w + x) * 4 + 3] = 0;
  return im;
}

const jobs = [
  ['broom', 3, [142, 53, 286, 321], ink],
  ['lamp', 3, [379, 0, 678, 362], ink],
  ['rug-round', 3, [39, 408, 605, 605], im => flood(im)],
  ['rug-shaggy', 3, [780, 627, 1262, 1037], im => flood(im)],
  ['chair', 3, [1478, 572, 1832, 1036], ink],
  ['mirror', 4, [33, 50, 462, 488], im => roundMask(im, 20)],
  ['vase', 4, [608, 77, 848, 507], ink],
  ['speaker', 4, [891, 43, 1230, 423], im => dropCorner(ink(im), 270, 350)], // the crop box also catches a corner of the jute rug below the speaker
  ['clock', 4, [1431, 52, 1872, 234], im => blankClock(flood(im, { rim: 1 }))],
  ['rug-jute', 4, [1173, 366, 1908, 520], im => flood(im)],
  ['rug-cream', 4, [69, 709, 1474, 1070], im => flood(im)],
  ['brush', 4, [465, 574, 1231, 604], tint],
  ['brain', 4, [1545, 540, 1874, 788], im => flood(im, { rim: 1, holes: 700 })],
  ['brain-chair', 4, [1570, 789, 1850, 1079], ink],
];
jobs.forEach(([name, sheet, box, fn]) => { const im = fn(crop(sheets[sheet], box)); encode(im, path.join(out, name + '.png')); console.log(name, im.w + 'x' + im.h, (fs.statSync(path.join(out, name + '.png')).size / 1024) | 0, 'KB'); });

// The logo sheet is a full-size transparent canvas: trim it to the artwork.
{
  const lg = decode(src('לוגו.png')); let x0 = lg.w, y0 = lg.h, x1 = 0, y1 = 0;
  for (let y = 0; y < lg.h; y++) for (let x = 0; x < lg.w; x++) if (lg.d[(y * lg.w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const im = crop(lg, [x0 - 6, y0 - 6, x1 + 6, y1 + 6]); encode(im, path.join(out, 'logo.png')); console.log('logo', im.w + 'x' + im.h);
}
