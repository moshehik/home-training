// Fills the armchair line drawing into a solid silhouette (assets/room/home-chair-fill.png) - used as the mask of the glint
// that sweeps over the armchair (a bare line drawing has too little surface for a glint to show).
// Gaps in the outline are closed by dilating, the outside is flood-filled from the border, everything else is the chair.
// Run:  node scripts/make-chair-fill.js
const path = require('path');
const { decode, encode } = require('./png');
const out = path.join(__dirname, '..', 'assets', 'room');
const src = decode(path.join(out, 'home-chair.png')), W = src.w, H = src.h, R = 5;
const ink = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (src.d[i * 4 + 3] > 40) ink[i] = 1;
const wall = new Uint8Array(W * H);   /* ink dilated by R: the outline with its gaps closed */
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink[y * W + x])
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && dx * dx + dy * dy <= R * R) wall[yy * W + xx] = 1;
  }
const outside = new Uint8Array(W * H), st = [];
const push = (x, y) => { const i = y * W + x; if (!wall[i] && !outside[i]) { outside[i] = 1; st.push(i); } };
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (st.length) {
  const i = st.pop(), x = i % W, y = (i / W) | 0;
  if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1);
}
const d = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { if (!outside[i]) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; } }
encode({ w: W, h: H, d }, path.join(out, 'home-chair-fill.png'));
console.log('ok');
