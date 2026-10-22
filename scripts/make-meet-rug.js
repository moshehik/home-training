// Turns the cream shaggy texture "תמונות/שטיח למי אני (1).png" into a floor rug in perspective (fuzzy edge) for the "נעים להכיר" section.
// Run:  node scripts/make-meet-rug.js
const path = require('path');
const { decode, encode } = require('./png');
const root = path.join(__dirname, '..');
const tex = decode(path.join(root, 'תמונות', 'שטיח למי אני (1).png'));
const W = 1500, H = 440, INSET = 0.1, PAD = 14;
const out = Buffer.alloc(W * H * 4);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const noise = (x, y, s) => { const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
for (let y = 0; y < H; y++) {
  const fy = (y - PAD) / (H - 2 * PAD), ins = INSET * W * (1 - Math.min(1, Math.max(0, fy)));
  for (let x = 0; x < W; x++) {
    const l = PAD + ins, r = W - PAD - ins, t = PAD, b = H - PAD;
    // slanted side edges: horizontal distance scaled by the slope so the fuzz has the same width everywhere
    const dx = Math.min(x - l, r - x) * 0.93, dy = Math.min(y - t, b - y);
    let dist = Math.min(dx, dy);
    const fur = (noise(x, y, 5) - 0.5) * 16 + (noise(x, y, 17) - 0.5) * 14 + (hash(x, y) - 0.5) * 6;
    const alpha = sm(-2, 11, dist + fur);
    if (alpha <= 0) continue;
    const u = (x - l) / (r - l), v = (y - t) / (b - t);
    const sx = Math.min(tex.w - 1, Math.max(0, Math.round(u * tex.w))), sy = Math.min(tex.h - 1, Math.max(0, Math.round(v * tex.h)));
    const si = (sy * tex.w + sx) * 4, o = (y * W + x) * 4;
    // far edge a touch darker (pile in shade), the front lip a little lighter + an inner shadow near the edge so the rug has thickness
    const shade = 1 - 0.1 * (1 - sm(0, 40, y - t)) - 0.14 * (1 - sm(0, 22, dist)) + 0.04 * sm(b - 60, b, y);
    out[o] = Math.min(255, tex.d[si] * shade); out[o + 1] = Math.min(255, tex.d[si + 1] * shade * 0.985); out[o + 2] = Math.min(255, tex.d[si + 2] * shade * 0.99); out[o + 3] = Math.round(alpha * 255);
  }
}
encode({ w: W, h: H, d: out }, path.join(root, 'assets', 'landing', 'rug-meet.png'));
console.log('rug-meet.png', W + 'x' + H);
