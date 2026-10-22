// Cuts the palm and the pink rug out of "תמונות/אלמנטיים לדף נחיתה.png" into transparent PNGs for landing.html.
// Run:  node scripts/make-landing-parts.js
const path = require('path'), fs = require('fs');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), out = path.join(root, 'assets', 'landing');
fs.mkdirSync(out, { recursive: true });
const im = decode(path.join(root, 'תמונות', 'אלמנטיים לדף נחיתה.png'));
const { w, h, d } = im, bg = new Uint8Array(w * h), st = [];
const THR = 242, minc = i => Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]), isW = i => minc(i) >= THR;
const push = i => { if (!bg[i] && isW(i)) { bg[i] = 1; st.push(i); } };
for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
while (st.length) { const p = st.pop(), x = p % w; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (p >= w) push(p - w); if (p < w * (h - 1)) push(p + w); }
// white pockets enclosed between the palm leaves
const seen = new Uint8Array(w * h);
for (let s = 0; s < w * h; s++) {
  if (bg[s] || seen[s] || !isW(s)) continue;
  const q = [s], comp = []; seen[s] = 1;
  while (q.length) { const p = q.pop(); comp.push(p); const x = p % w; for (const t of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (t >= 0 && t < w * h && !bg[t] && !seen[t] && isW(t)) { seen[t] = 1; q.push(t); } }
  if (comp.length > 60) comp.forEach(p => { bg[p] = 1; });
}
// soft rim: erode two pixels
let a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = bg[i] ? 0 : 1;
for (let r = 0; r < 2; r++) { const b = a.slice(); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (a[i] > 0) b[i] = Math.min(a[i], a[i - 1], a[i + 1], a[i - w], a[i + w]) < 1 ? a[i] * 0.55 : a[i]; } a = b; }
function part(name, pick) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  const m = new Float32Array(w * h), lab = new Int32Array(w * h), on = i => a[i] > 0.02 && pick(i);
  let n = 0;
  for (let s = 0; s < w * h; s++) { // keep connected pieces of at least 400 pixels (drops stray specks)
    if (lab[s] || !on(s)) continue; n++; const q = [s], comp = []; lab[s] = n;
    while (q.length) { const p = q.pop(); comp.push(p); const x = p % w; for (const t of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (t >= 0 && t < w * h && !lab[t] && on(t)) { lab[t] = n; q.push(t); } }
    if (comp.length < 400) continue;
    comp.forEach(i => { m[i] = a[i]; const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, o = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const s = (y0 + y) * w + x0 + x, t = (y * cw + x) * 4; o[t] = d[s * 4]; o[t + 1] = d[s * 4 + 1]; o[t + 2] = d[s * 4 + 2]; o[t + 3] = Math.round(m[s] * 255); }
  encode({ w: cw, h: ch, d: o }, path.join(out, name + '.png')); console.log(name, cw + 'x' + ch);
}
// palm = green, rug = pink; soft-edge pixels that are neither take the majority label of their neighbours
const lbl = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) { if (a[i] <= 0.02) continue; const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; lbl[i] = (g > r && g > b) || r < 150 ? 1 : r > g * 1.1 && r > b ? 2 : 0; }
for (let pass = 0; pass < 8; pass++) {
  const nl = lbl.slice();
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x; if (a[i] <= 0.02 || lbl[i]) continue; let c1 = 0, c2 = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const l = lbl[i + dy * w + dx]; if (l === 1) c1++; else if (l === 2) c2++; }
    if (c1 || c2) nl[i] = c1 >= c2 ? 1 : 2;
  }
  lbl.set(nl);
}
part('palm', i => lbl[i] === 1);
part('rug', i => lbl[i] !== 1);
