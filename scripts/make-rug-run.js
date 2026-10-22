// Carries the hero rug (assets/landing/rug.png) down the "נעים להכיר" section without stretching its fur:
//   rug-top.png = the rug's far edge and first rows, untouched (rows 0..MID0 of rug.png).
//   rug-mid.png = body of the rug. Rows are read from the middle band of rug.png (its first rows are the ones that follow rug-top.png, so the
//                 two join without a seam) and then ping-pong tiled; each row is re-registered
//                 between the rug's left and right edge so the silhouette widens slowly, like the stretched shape would.
//   rug-end.png = the fluffy front lip, at its native size.
// CSS stretches rug-mid.png a little further to the section height.
// Run:  node scripts/make-rug-run.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..', 'assets', 'landing');
const src = decode(path.join(root, 'rug.png'));
const MID0 = Math.round(src.h * 0.52), MID1 = Math.round(src.h * 0.74), END0 = Math.round(src.h * 0.86), MIDH = 1000;   // texture comes from rows MID0..MID1 (the calm part, no dark corner patch)
const A = (x, y) => (x < 0 || x >= src.w ? 0 : src.d[(y * src.w + x) * 4 + 3]);
// left / right edge of the rug on each source row, then a straight-line fit over the band
const edge = y => { let l = 0, r = src.w - 1; while (l < src.w && A(l, y) < 128) l++; while (r > 0 && A(r, y) < 128) r--; return [l, r]; };
const fit = ys => { const n = ys.length, mx = ys.reduce((a, p) => a + p[0], 0) / n, my = ys.reduce((a, p) => a + p[1], 0) / n; let sxy = 0, sxx = 0; ys.forEach(p => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; }); const b = sxy / sxx; return y => my + b * (y - mx); };
const ls = [], rs = [];
for (let y = MID0; y < END0; y++) { const [l, r] = edge(y); ls.push([y, l]); rs.push([y, r]); }
const Ls = fit(ls), Rs = fit(rs);
// the straight-line fit is a few px off the real edge on the seam row: start from the real edge and ease onto the fit
const avg = (side, y0) => { let a = 0; for (let y = y0; y < y0 + 6; y++) a += edge(y)[side]; return a / 6; };
const dL = avg(0, MID0) - Ls(MID0), dR = avg(1, MID0) - Rs(MID0), ease = y => Math.max(0, 1 - y / 160);
// silhouette: it keeps the rug's own slope at both ends (no kink where it joins the hero part and the front lip) and barely
// widens in between, so the sides of the long rug stay nearly straight
const profile = f => {
  const D = f(END0) - f(MID0), s0 = (D / (END0 - MID0)), h = 60, w = Array.from({ length: MIDH }, (_, y) => Math.exp(-y / h) + Math.exp(-(MIDH - 1 - y) / h));
  const A = w.reduce((a, b) => a + b, 0), smin = (D - s0 * A) / (MIDH - A), out = [];
  let x = f(MID0);
  for (let y = 0; y < MIDH; y++) { out.push(x); x += smin + (s0 - smin) * w[y]; }
  return out;
};
const lo = profile(Ls), ro = profile(Rs);
const out = Buffer.alloc(src.w * MIDH * 4), span = MID1 - MID0;
for (let y = 0; y < MIDH; y++) {
  const k = y % (2 * span), ty = MID0 + (k < span ? k : 2 * span - 1 - k);   // ping-pong through the band, 1 source row per output row
  const Lo = lo[y] + dL * ease(y), Ro = ro[y] + dR * ease(y);
  const Lt = Ls(ty), Rt = Rs(ty);
  for (let x = 0; x < src.w; x++) {
    const u = (x - Lo) / (Ro - Lo), sx = Math.round(Lt + u * (Rt - Lt));
    if (sx < 0 || sx >= src.w) continue;
    const si = (ty * src.w + sx) * 4, o = (y * src.w + x) * 4;
    out[o] = src.d[si]; out[o + 1] = src.d[si + 1]; out[o + 2] = src.d[si + 2]; out[o + 3] = src.d[si + 3];
  }
}
encode({ w: src.w, h: MIDH, d: out }, path.join(root, 'rug-mid.png'));
const topBuf = Buffer.alloc(src.w * MID0 * 4);
src.d.copy(topBuf, 0, 0, src.w * MID0 * 4);
encode({ w: src.w, h: MID0, d: topBuf }, path.join(root, 'rug-top.png'));
const endH = src.h - END0, end = Buffer.alloc(src.w * endH * 4);
for (let y = 0; y < endH; y++) src.d.copy(end, y * src.w * 4, (END0 + y) * src.w * 4, (END0 + y + 1) * src.w * 4);
encode({ w: src.w, h: endH, d: end }, path.join(root, 'rug-end.png'));
console.log('edge fit', Ls(MID0).toFixed(1), Ls(END0).toFixed(1), Rs(MID0).toFixed(1), Rs(END0).toFixed(1));
