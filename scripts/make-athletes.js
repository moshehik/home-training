// The three sport figures of the home page. Cuts their loose parts out of "תמונות/3.png" (transparent PNGs in
// assets/room/ath/) so they can be animated, and writes assets/room/ath-patch.png: the wall/floor of home.jpg
// with the baked-in (static) figures painted out, filled row by row from the wall around them.
// Run:  node scripts/make-athletes.js
const path = require('path'), fs = require('fs');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..'), out = path.join(root, 'assets', 'room');
fs.mkdirSync(path.join(out, 'ath'), { recursive: true });
const s3 = decode(path.join(root, 'תמונות', '3.png')), home = decode(path.join(root, 'תמונות', 'דף הבית.png'));
const W = s3.w, H = s3.h;

// parts = connected non-white blobs of the sheet (ids from a scan of the region), grouped by figure
const R = [90, 670, 780, 1050];
const lab = new Int32Array(W * H), blobs = [];
const nw = (x, y) => { const i = (y * W + x) * 4; return Math.min(s3.d[i], s3.d[i + 1], s3.d[i + 2]) < 236; };
let n = 0;
for (let y = R[1]; y <= R[3]; y++) for (let x = R[0]; x <= R[2]; x++) {
  if (lab[y * W + x] || !nw(x, y)) continue; n++;
  const q = [[x, y]], px = []; lab[y * W + x] = n; let r = 0, g = 0, b = 0, a = [1e9, 1e9, -1, -1];
  while (q.length) {
    const [cx, cy] = q.pop(); px.push(cy * W + cx); const i = (cy * W + cx) * 4; r += s3.d[i]; g += s3.d[i + 1]; b += s3.d[i + 2];
    a = [Math.min(a[0], cx), Math.min(a[1], cy), Math.max(a[2], cx), Math.max(a[3], cy)];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx >= R[0] && nx <= R[2] && ny >= R[1] && ny <= R[3] && !lab[ny * W + nx] && nw(nx, ny)) { lab[ny * W + nx] = n; q.push([nx, ny]); } }
  }
  if (px.length > 80) blobs.push({ id: n, px, bbox: a, col: [r / px.length | 0, g / px.length | 0, b / px.length | 0] });
}
const byBox = (x0, y0) => blobs.find(b => b.bbox[0] === x0 && b.bbox[1] === y0);
const FIG = {
  thrower: { ball: [220, 696], arm: [163, 704], head: [234, 741], hand: [253, 811], thigh: [135, 850], leg: [108, 872] },
  runner: { armB: [333, 728], head: [457, 740], armF: [477, 794], body: [251, 848] },
  bender: { head: [613, 797], ball: [698, 831], body: [547, 854] },
};
const meta = {};
for (const f in FIG) {
  meta[f] = {};
  for (const p in FIG[f]) {
    const b = byBox(...FIG[f][p]); if (!b) throw new Error('missing ' + f + '.' + p);
    const [x0, y0, x1, y1] = b.bbox, P = 3, w = x1 - x0 + 1 + 2 * P, h = y1 - y0 + 1 + 2 * P, d = Buffer.alloc(w * h * 4);
    const inb = new Uint8Array(W * H); b.px.forEach(i => { inb[i] = 1; });
    const range = 255 - Math.min(...b.col);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = x0 - P + x, sy = y0 - P + y; let near = false;     // anti-aliased rim: within 2px of the blob
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { if (inb[(sy + dy) * W + sx + dx]) { near = true; break; } }
      if (!near) continue;
      const i = (sy * W + sx) * 4, a = Math.max(0, Math.min(1, (255 - Math.min(s3.d[i], s3.d[i + 1], s3.d[i + 2])) / range * 1.0));
      const o = (y * w + x) * 4; d[o] = b.col[0]; d[o + 1] = b.col[1]; d[o + 2] = b.col[2]; d[o + 3] = Math.round(a * 255);
    }
    encode({ w, h, d }, path.join(out, 'ath', f + '-' + p + '.png'));
    meta[f][p] = { x: x0 - P, y: y0 - P, w, h, cx: ((x0 + x1) / 2) | 0, cy: ((y0 + y1) / 2) | 0 };
  }
}
fs.writeFileSync(path.join(out, 'ath', 'meta.json'), JSON.stringify(meta));

// ---- register the sheet figures onto the baked-in ones in the home picture (scale + shift, per figure)
function mask(f) { const m = new Uint8Array(W * H); for (const p in FIG[f]) byBox(...FIG[f][p]).px.forEach(i => { m[i] = 1; }); return m; }
function register(f) {
  const m = mask(f), col = {}, pts = [];
  const blob = byBox(...Object.values(FIG[f])[0]); const c0 = blob.col;
  for (let y = R[1]; y <= R[3]; y += 2) for (let x = R[0]; x <= R[2]; x += 2) {
    const i = y * W + x; if (!m[i]) continue;
    if (m[i - 4] && m[i + 4] && m[i - 4 * W] && m[i + 4 * W]) pts.push([x, y]);   // interior only
  }
  const cols = {}; for (const p in FIG[f]) cols[p] = byBox(...FIG[f][p]).col;
  const ok = [];
  for (let s = 1.44; s <= 1.54; s += 0.005) for (let dx = -14; dx <= 14; dx++) for (let dy = -14; dy <= 14; dy++) {
    const tx = -129 + dx, ty = -504 + dy; let e = 0, c = 0;
    for (let k = 0; k < pts.length; k += 3) {
      const [x, y] = pts[k], hx = Math.round(x * s + tx), hy = Math.round(y * s + ty), i = (hy * W + hx) * 4; if (hy >= H || hy < 0) continue;
      const col = s3.d.slice((y * W + x) * 4, (y * W + x) * 4 + 3);
      e += Math.abs(home.d[i] - col[0]) + Math.abs(home.d[i + 1] - col[1]) + Math.abs(home.d[i + 2] - col[2]); c++;
    }
    e /= c; ok.push({ e, s, tx, ty });
  }
  const lo = Math.min(...ok.map(o => o.e)), top = ok.filter(o => o.e <= lo + 0.6), avg = k => top.reduce((a, o) => a + o[k], 0) / top.length;
  return { e: lo, n: top.length, s: avg('s'), tx: avg('tx'), ty: avg('ty') };
}
const reg = {}; for (const f in FIG) { reg[f] = register(f); console.log(f, reg[f]); }
fs.writeFileSync(path.join(out, 'ath', 'reg.json'), JSON.stringify(reg));

// ---- paint the baked-in figures out of the home picture
const S = 1.4925, TX = -127, TY = -501, DIL = 9;
const hm = new Uint8Array(W * H);
for (const f in FIG) { const m = mask(f); for (let y = R[1]; y <= R[3]; y++) for (let x = R[0]; x <= R[2]; x++) if (m[y * W + x]) {
  const hx = Math.round(x * S + TX), hy = Math.round(y * S + TY);
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = hx + dx, Y = hy + dy; if (X >= 0 && X < W && Y >= 0 && Y < H) hm[Y * W + X] = 1; }
} }
let M = hm;                                            // dilate (square, separable)
for (let pass = 0; pass < 2; pass++) {
  const a = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M[y * W + x]) for (let k = -DIL; k <= DIL; k++) { const X = pass ? x : x + k, Y = pass ? y + k : y; if (X >= 0 && X < W && Y >= 0 && Y < H) a[Y * W + X] = 1; }
  M = a;
}
let X0 = W, Y0 = H, X1 = 0, Y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M[y * W + x]) { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Y0 = Math.min(Y0, y); Y1 = Math.max(Y1, y); }
const fill = new Float32Array(W * H * 3);
for (let y = Y0; y <= Y1; y++) {
  for (let x = X0; x <= X1; x++) {
    if (!M[y * W + x] || (x > X0 && M[y * W + x - 1])) continue;
    let e = x; while (e <= X1 && M[y * W + e]) e++;       // masked run [x, e)
    for (let c = 0; c < 3; c++) {
      let l = 0, r = 0, nl = 0, nr = 0;
      for (let k = 1; k <= 4; k++) { if (x - k >= 0) { l += home.d[(y * W + x - k) * 4 + c]; nl++; } if (e - 1 + k < W) { r += home.d[(y * W + e - 1 + k) * 4 + c]; nr++; } }
      l = nl ? l / nl : r / nr; r = nr ? r / nr : l;
      for (let i = x; i < e; i++) { const t = (i - x + 1) / (e - x + 1); fill[(y * W + i) * 3 + c] = l * (1 - t) + r * t; }
    }
  }
}
for (let pass = 0; pass < 3; pass++) {                  // soften the row-by-row streaks vertically, inside the mask only
  const g = fill.slice();
  for (let y = Y0 + 1; y < Y1; y++) for (let x = X0; x <= X1; x++) if (M[y * W + x] && M[(y - 1) * W + x] && M[(y + 1) * W + x]) for (let c = 0; c < 3; c++) {
    const i = (y * W + x) * 3 + c; g[i] = (fill[i - W * 3] + 2 * fill[i] + fill[i + W * 3]) / 4;
  }
  fill.set(g);
}
const pw = X1 - X0 + 1, ph = Y1 - Y0 + 1, pd = Buffer.alloc(pw * ph * 4);
for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
  const i = (Y0 + y) * W + X0 + x; if (!M[i]) continue;
  let near = 0, cnt = 0;                                // feather: alpha falls off over the last 3px of the mask
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = X0 + x + dx, Y = Y0 + y + dy; if (X >= 0 && X < W && Y >= 0 && Y < H) { cnt++; near += M[Y * W + X]; } }
  const o = (y * pw + x) * 4; pd[o] = fill[i * 3]; pd[o + 1] = fill[i * 3 + 1]; pd[o + 2] = fill[i * 3 + 2]; pd[o + 3] = Math.round(255 * Math.min(1, (near / cnt) * 1.6));
}
encode({ w: pw, h: ph, d: pd }, path.join(out, 'ath-patch.png'));
console.log('ath-patch', pw + 'x' + ph, 'at', X0, Y0, (fs.statSync(path.join(out, 'ath-patch.png')).size / 1024) | 0, 'KB');
fs.writeFileSync(path.join(out, 'ath', 'patch.json'), JSON.stringify({ x: X0, y: Y0, w: pw, h: ph }));
