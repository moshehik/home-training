// Pose helpers shared by the lesson data files (see shared/figure.js for the pose fields).
const G = 205, BEDH = 40, D = 180 / Math.PI;
const mk = Object.assign;

const BED = { type: 'bed', x: 30, w: 320, h: BEDH };
const chairAt = x => ({ type: 'chair', x });

// Lying on the back, head on the left. s = surface height (0 floor, 40 bed).
const lieY = s => G - s - (s ? 5 : 8);
const sup = (hx, s, o) => mk({ h: [hx, lieY(s)], t: -90, n: 0, ap: [90, 56], kp: [90, 84], f: 160 }, o);
const supBent = (hx, s, o, dx = 68) => mk(sup(hx, s), { k: [hx + dx, G - s - 4], f: 90 }, o);
// Hips lifted by `rise`, shoulders staying on the surface.
const bridge = (hx, s, rise, o, dx = 68) => {
  const dxS = Math.sqrt(56 * 56 - rise * rise), t = Math.atan2(-dxS, -rise) * D;
  return mk(supBent(hx, s, {}, dx), { h: [hx, lieY(s) - rise], t, n: -90 - t }, o);
};
// On all fours. x = hip x, s = surface height.
const quad = (x, s, o) => {
  const ky = G - s - 4, hy = ky - 41;
  return mk({ h: [x, hy], t: 85, n: 0, a: [x + 56, ky], k: [x - 42, ky], f: 0 }, o);
};
// Straight-body plank / push-up: ankle A fixed, shoulder at height shY, hand at [dx from shoulder, wristY].
const plank = (ax, ay, shY, wristY, o, wdx = 0) => {
  const sx = ax + Math.sqrt(142 * 142 - (ay - shY) * (ay - shY));
  const S = [sx, shY], A = [ax, ay], H = [A[0] + (S[0] - A[0]) * 86 / 142, A[1] + (S[1] - A[1]) * 86 / 142];
  const t = Math.atan2(S[0] - H[0], -(S[1] - H[1])) * D;
  return mk({ h: H, t, n: 0, a: [sx + wdx, wristY], k: A, f: 25 }, o);
};
// Standing with feet planted at x (near foot x+4, far foot x-4).
const stand = o => mk({ h: [200, G - 89] }, o);
const planted = (x, o) => mk({ k: [x + 4, G - 4], l: [x - 4, G - 4] }, o);
// Squat with feet planted around x=200, depth 0..1.
const squat = (d, o) => mk({ h: [188 - 34 * d, G - 89 + 43 * d], t: 8 + 40 * d, n: -(4 + 20 * d), ap: [90, 56], k: [205, G - 4], l: [200, G - 4] }, o);
// Seated on a chair whose left edge is cx, facing right; hands rest on the thighs.
const seated = (cx, o) => mk({ h: [cx + 20, G - 50], t: 0, a: [cx + 46, G - 56], k: [cx + 66, G - 5], l: [cx + 70, G - 5], f: 90 }, o);
// Tempo of the segment that starts at a pose: `hold` seconds still in the pose, then `move` seconds to the next pose.
// The w values of all poses are relative, so writing them in seconds works when bpm/beats give the same total cycle.
const seg = (move, hold = 0) => ({ w: move + hold, hd: hold / (move + hold) });

module.exports = { G, BEDH, BED, chairAt, lieY, sup, supBent, bridge, quad, plank, stand, planted, squat, seated, seg, mk };
