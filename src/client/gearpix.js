// Large gear art, drawn BY HAND IN PIXELS (32×32 art pixels — twice the detail of an inventory icon). Nothing here is smoothed, blurred or averaged:
// every pixel is placed on purpose with a tone ramp (dark → base → light → highlight, light from the upper left), a dark outline added around the
// shape, and chunky banding instead of gradients.
//
// Diagonal pieces (swords, spears, hammers ...) are built in the handle's own rotated frame on the pixel grid: `u` runs along the handle towards the
// top right, `v` across it. Anything attached to the handle — a hammer head, a spear point, a crossguard — is a shape in that same frame, so it is
// always at the same angle as the handle.
import { sprite, shade, tint } from './px.js';
import { ITEMS, archOf, ARCH } from '../data.js';
import { gearPalette } from './icons.js';

const SQ = Math.SQRT2, N = 32, C = 15.5;
const WOOD = ['#3a2412', '#6a4528', '#8f633a', '#b98650'];
const GOLD = ['#7a4c08', '#b8862a', '#e0b24a', '#fff0a8'];
const LEATHER = ['#2a1810', '#4a2e1c', '#6a4528', '#8f633a'];
const ramp = (c) => [shade(c, 0.5), shade(c, 0.75), c, tint(c, '#ffffff', 0.4)];      // dark, shadow, base, light
const mramp = (m) => [shade(m[2], 0.75), m[2], m[0], m[1]];                             // a metal's four tones
const WH = '#ffffff';

// pixels of a shape in the handle's frame: u along (towards top-right), v across (positive = down-right = the shaded side)
function rot(p, u0, u1, hw, col, cx = C, cy = C) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx - dy) / SQ, v = (dx + dy) / SQ; if (u < u0 || u > u1) continue;
    const t = (u - u0) / (u1 - u0), h = typeof hw === 'function' ? hw(t, u) : hw; if (Math.abs(v) > h) continue; const c = col(t, v / Math.max(0.01, h), u, v); if (c) p.p(x, y, c);
  }
}
const at = (u, v) => [Math.round(C + (u + v) / SQ), Math.round(C + (v - u) / SQ)];       // (u, v) → pixel
const tone = (k, R) => (k < -0.55 ? R[3] : k < -0.12 ? R[2] : k < 0.5 ? R[1] : R[0]);   // lit upper-left edge, dark lower-right edge
const shaft = (p, u0, u1, hw = 1.2) => rot(p, u0, u1, hw, (t, k) => tone(k, WOOD));
const dot = (p, u, v, r, c) => { const [x, y] = at(u, v); p.disc(x + 0.5, y + 0.5, r, c); };

// ═══ weapons ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const W = {
  sword(p, m) {
    const M = mramp(m);
    rot(p, -9, 21, (t) => (t > 0.86 ? 3.1 * (1 - (t - 0.86) / 0.14) + 0.4 : 3.1), (t, k, u, v) => (Math.abs(v) < 0.55 && t > 0.05 && t < 0.84 ? M[0] : tone(k, M)));        // blade with a fuller
    rot(p, 20, 22, 1, () => WH);
    rot(p, -12, -9.4, 7.4, (t, k) => tone(k, GOLD)); dot(p, -10.7, -7.4, 1.5, GOLD[3]); dot(p, -10.7, 7.4, 1.5, GOLD[2]); dot(p, -10.7, 0, 1.2, '#ff5a6a');      // crossguard + gem
    rot(p, -19, -12, 1.8, (t, k, u) => (Math.floor(u) % 2 ? LEATHER[2] : LEATHER[0]));                                                                          // wrapped grip
    dot(p, -21.2, 0, 2.3, GOLD[2]); dot(p, -21.6, -0.8, 1, GOLD[3]);
  },
  spear(p, m) {
    const M = mramp(m);
    shaft(p, -23, 9, 1.3);
    rot(p, 5, 8, 2, (t, k) => tone(k, GOLD)); [[-1, 1], [1, 1], [0, 1.4]].forEach(([s, w], i) => { dot(p, 3.5 - i * 1.2, s * 3.2, 1.3, i === 2 ? '#8a1a22' : '#c02a32'); void w; });          // gold collar + a red tassel
    rot(p, 8, 23, (t) => 4.2 * Math.sin(Math.PI * Math.pow(t, 0.62)) * 0.95 + 0.3, (t, k, u, v) => (Math.abs(v) < 0.5 && t > 0.1 && t < 0.85 ? M[0] : tone(k, M)));         // leaf-shaped blade
    rot(p, 22.4, 23.6, 0.6, () => WH);
  },
  mace(p, m) {
    const M = mramp(m);
    shaft(p, -22, 6, 1.3); rot(p, -13, -9, 1.7, (t, k, u) => (Math.floor(u) % 2 ? LEATHER[2] : LEATHER[0])); rot(p, 3.5, 6, 2.4, (t, k) => tone(k, GOLD));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39, [x, y] = at(12.5 + Math.cos(a) * 8.2, Math.sin(a) * 8.2); p.p(x, y, M[2]); p.p(x + Math.round(Math.cos(a)), y + Math.round(Math.sin(a)), M[3]); }
    const [hx, hy] = at(12.5, 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - (hx + 0.5), dy = y + 0.5 - (hy + 0.5), d = Math.hypot(dx, dy); if (d > 6.6) continue; const l = (-dx - dy) / (d + 0.001) * (d / 7); p.p(x, y, d > 5.7 ? M[0] : l > 0.55 ? M[3] : l > 0.1 ? M[2] : l > -0.45 ? M[1] : M[0]); }
    p.p(hx - 2, hy - 3, WH); p.p(hx - 3, hy - 2, WH); p.p(hx, hy, M[0]); p.p(hx + 1, hy, M[0]);
  },
  hammer(p, m) {
    const M = mramp(m);
    shaft(p, -23, 12, 1.5); rot(p, -14, -9, 1.9, (t, k, u) => (Math.floor(u) % 2 ? LEATHER[2] : LEATHER[0])); rot(p, -9, -7.5, 2.6, (t, k) => tone(k, GOLD));
    rot(p, 9, 17.5, 8.4, (t, k, u, v) => (u > 16.2 ? M[3] : u < 10.2 ? M[0] : Math.abs(v) > 7.2 ? M[0] : tone(k, M)));                                          // the head: a rectangle in the handle's frame
    rot(p, 12.2, 14.4, 8.4, (t, k) => tone(k, GOLD));                                                                                                             // gold band
    for (const v of [-6, 6]) dot(p, 13.3, v, 0.9, WH);
    dot(p, 13.3, 0, 1.6, '#ff8a3a'); rot(p, 17.4, 19, 5.2, (t, k) => tone(k, M));                                                                                  // gem + striking face
    rot(p, 6, 9, 5, (t, k) => tone(k, M));                                                                                                                           // the hammer's neck where the head meets the shaft
  },
  staff(p, m, acc) {
    const M = mramp(m), G = ramp(acc);
    shaft(p, -23, 9, 1.3); rot(p, -14, -9, 1.7, (t, k, u) => (Math.floor(u) % 2 ? LEATHER[2] : LEATHER[0])); rot(p, 6.5, 9, 2.4, (t, k) => tone(k, GOLD));
    for (const s of [-1, 1]) for (let t = 0; t < 7; t++) { const [x, y] = at(9 + t * 1.5, s * (2.4 + Math.sin(t / 6 * Math.PI) * 3.4)); p.p(x, y, GOLD[2]); p.p(x + (s > 0 ? 0 : 1), y, GOLD[1]); }   // the cradle
    const [hx, hy] = at(16.2, 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - (hx + 0.5), dy = y + 0.5 - (hy + 0.5), d = Math.hypot(dx, dy); if (d > 4.6) continue; const l = (-dx - dy) / (d + 0.001) * (d / 4.6); p.p(x, y, d > 3.8 ? G[0] : l > 0.5 ? WH : l > 0 ? G[3] : G[2]); }
    for (const [dx, dy] of [[-6, -1], [5, -5], [-2, 6], [7, 3]]) p.p(hx + dx, hy + dy, G[3]); void M;
  },
  wand(p, m, acc) {
    const G = ramp(acc);
    shaft(p, -20, 8, 1.1); rot(p, -13, -9, 1.5, (t, k, u) => (Math.floor(u) % 2 ? LEATHER[2] : LEATHER[0])); rot(p, 6.5, 8.5, 2.1, (t, k) => tone(k, GOLD));
    rot(p, 8.5, 21, (t) => 4.4 * Math.sin(Math.PI * (0.06 + t * 0.9)), (t, k, u, v) => (Math.abs(v) < 0.4 && t > 0.1 && t < 0.9 ? WH : tone(k, [G[0], G[1], G[2], G[3]])));      // a faceted diamond
    const [sx, sy] = at(25, 4); p.p(sx, sy, WH); const [tx, ty] = at(13, -8); p.p(tx, ty, G[3]); void m;
  },
  rapier(p, m) {
    const M = mramp(m);
    rot(p, -7, 22, (t) => 1.3 - t * 0.6, (t, k, u, v) => (Math.abs(v) < 0.35 ? M[0] : tone(k, M))); rot(p, 21, 23, 0.5, () => WH);
    rot(p, -9.5, -7.5, 5, (t, k) => tone(k, GOLD));                                                                                                                 // guard bar
    for (let a = 0; a <= 8; a++) { const th = Math.PI * (a / 8), [x, y] = at(-9 - Math.sin(th) * 4.5, Math.cos(th) * 7); p.p(x, y, GOLD[2]); p.p(x + 1, y, GOLD[1]); }   // the swept cup
    rot(p, -17, -10, 1.3, (t, k, u) => (Math.floor(u) % 2 ? LEATHER[2] : LEATHER[0])); dot(p, -19.4, 0, 2, GOLD[2]); dot(p, -19.8, -0.7, 0.8, GOLD[3]);
  },
  bow(p, m) {
    const M = mramp(m);
    const arcx = (y) => 9 + Math.round(Math.pow((y - 15.5) / 14.5, 2) * 9);                                                                                          // the limb: a parabola, in pixels
    for (let y = 1; y < 31; y++) { const x = arcx(y); p.r(x - 3, y, 3, 1, WOOD[2]); p.p(x - 3, y, WOOD[3]); p.p(x - 1, y, WOOD[0]); }
    p.r(5, 12, 6, 8, LEATHER[2]); p.r(5, 12, 6, 1, LEATHER[3]); p.r(5, 19, 6, 1, LEATHER[0]); for (const y of [13, 16, 18]) p.r(5, y, 6, 1, LEATHER[1]);   // the grip
    for (let y = 1; y < 31; y++) { const x = y < 16 ? 13 + Math.round((y - 1) * 4.3 / 14) : 17 - Math.round((y - 16) * 4.3 / 14); p.p(Math.min(x, 17), y, '#e8e0cc'); }  // the string, drawn back
    p.r(7, 15, 18, 1, WOOD[2]); p.r(7, 16, 18, 1, WOOD[0]);                                                                                                         // the arrow
    p.r(24, 13, 4, 5, M[2]); p.p(27, 15, WH); p.p(28, 15, WH); p.r(24, 13, 4, 1, M[3]); p.r(24, 17, 4, 1, M[0]);
    p.r(6, 13, 2, 1, '#c04040'); p.r(6, 18, 2, 1, '#c04040'); p.r(8, 14, 1, 1, '#c04040'); p.r(8, 17, 1, 1, '#c04040');
  },
  pistol(p, m) {
    const M = mramp(m);
    p.r(2, 9, 21, 4, M[2]); p.r(2, 9, 21, 1, M[3]); p.r(2, 12, 21, 1, M[0]); p.r(0, 8, 3, 6, M[1]); p.r(0, 8, 3, 1, M[3]); p.p(1, 10, WH);                                  // barrel + muzzle
    p.disc(16, 15, 6.5, M[1]); p.disc(15.5, 14.5, 5, M[2]); p.disc(15, 14, 2.4, M[3]);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.p(Math.round(16 + Math.cos(a) * 4.2), Math.round(15 + Math.sin(a) * 4.2), M[0]); }                               // the cylinder's chambers
    p.r(21, 6, 6, 4, M[1]); p.r(21, 6, 6, 1, M[3]); p.r(25, 4, 3, 3, M[2]);                                                                                           // the hammer
    for (let i = 0; i < 12; i++) { const y = 15 + i; p.r(24 + Math.floor(i / 3), y, 6 - Math.floor(i / 6), 1, i % 4 === 0 ? WOOD[1] : WOOD[2]); p.p(24 + Math.floor(i / 3), y, WOOD[3]); }   // the grip
    p.r(18, 18, 6, 1, M[0]); p.r(18, 18, 1, 5, M[0]); p.r(18, 22, 6, 1, M[0]); p.p(21, 20, M[3]); p.p(26, 22, GOLD[2]);
  },
};
const TILT = new Set(['sword', 'spear', 'mace', 'hammer', 'staff', 'wand', 'rapier']);

// ═══ worn pieces ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// a horizontal run of pixels centred on the middle, shaded from the left (light) to the right (dark)
function span(p, y, hw, R, extra = 0) {
  const x0 = Math.round(16 - hw), x1 = Math.round(16 + hw) - 1;
  for (let x = x0; x <= x1; x++) { const l = x - x0, r = x1 - x; p.p(x, y, l === 0 ? R[3] : l < 2 ? R[2] : r === 0 ? R[0] : r < 2 + extra ? R[1] : R[2]); }
}
const shape = (p, y0, hws, R, extra = 0) => hws.forEach((hw, i) => span(p, y0 + i, hw, R, extra));
const sym = (p, x, y, w, h, c) => { p.r(x, y, w, h, c); p.r(N - x - w, y, w, h, c); };            // a rectangle and its mirror image
const sp = (p, x, y, c) => { p.p(x, y, c); p.p(N - 1 - x, y, c); };
const belt = (p, y, hw) => { p.r(16 - hw, y, hw * 2, 3, LEATHER[1]); p.r(16 - hw, y, hw * 2, 1, LEATHER[3]); p.r(16 - hw, y + 2, hw * 2, 1, LEATHER[0]); p.r(14, y - 1, 4, 5, GOLD[2]); p.r(14, y - 1, 4, 1, GOLD[3]); p.r(15, y + 1, 2, 1, GOLD[0]); };
const chain = (p, x0, y0, x1, y1, light) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 3 === 0) p.p(x, y, light); };

const A = {
  head(p, m, c, style) {
    const M = mramp(m), R = ramp(c);
    if (style === 'robe') {
      shape(p, 2, [2, 4, 6, 7, 8, 9, 9, 10, 10, 10, 10, 10, 10, 10, 11, 11, 12, 12, 13, 13, 13, 13, 12, 12, 12], R);
      p.r(11, 9, 10, 12, '#1c1428'); p.r(12, 8, 8, 1, '#1c1428'); p.r(12, 21, 8, 1, '#241a34'); p.r(12, 8, 8, 1, R[0]);
      p.p(13, 13, '#ffe36b'); p.p(14, 13, '#ffe36b'); p.p(17, 13, '#ffe36b'); p.p(18, 13, '#ffe36b'); p.p(13, 14, '#a8801e'); p.p(18, 14, '#a8801e');
      p.r(15, 3, 2, 3, GOLD[2]); p.p(15, 3, GOLD[3]); p.r(7, 20, 2, 5, R[3]); p.r(2, 24, 28, 1, R[0]);
    } else if (style === 'coat') {
      shape(p, 9, [5, 7, 8, 9, 10, 10, 10, 10], R); p.r(5, 17, 22, 3, R[1]); p.r(3, 17, 26, 1, R[0]); shape(p, 18, [13, 14, 14], [R[0], R[0], R[1], R[1]]);
      p.r(6, 12, 20, 1, R[0]); for (let x = 7; x < 26; x += 3) p.p(x, 11, R[0]);                                                                                  // stitching
      p.r(15, 9, 2, 3, GOLD[2]); p.p(15, 9, GOLD[3]); for (let i = 0; i < 6; i++) { p.p(20 + i, 8 - i, '#efe8d8'); p.p(21 + i, 8 - i, '#c8c0b0'); }                 // a feather
    } else if (style === 'mail') {
      shape(p, 3, [4, 6, 8, 9, 10, 10, 10, 10, 10, 10, 10, 10], M.slice(0)); sym(p, 4, 15, 5, 12, M[1]); chain(p, 4, 15, 9, 26, M[3]); chain(p, 23, 15, 28, 26, M[3]);
      p.r(10, 15, 12, 11, '#14101c'); p.r(11, 15, 10, 1, M[0]); p.r(15, 3, 2, 17, M[2]); p.r(15, 3, 1, 17, M[3]); p.r(15, 3, 2, 1, WH);                                // the nasal bar down the middle
      p.p(12, 18, '#ffe36b'); p.p(19, 18, '#ffe36b'); p.p(12, 19, '#a8801e'); p.p(19, 19, '#a8801e'); for (let x = 6; x < 26; x += 2) p.p(x, 14, M[3]);
    } else {
      shape(p, 5, [4, 6, 7, 8, 9, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 10, 10, 10, 9, 9], M);
      p.r(7, 13, 18, 3, '#14101c'); p.r(7, 13, 18, 1, '#3a2a40'); p.r(8, 12, 16, 1, M[0]); p.r(15, 5, 2, 8, M[0]);                                                // the visor slit and the ridge
      for (const [x, y] of [[9, 19], [11, 20], [9, 22], [11, 23]]) { sp(p, x, y, '#14101c'); }
      p.r(14, 0, 4, 5, '#c02a32'); p.r(15, 0, 2, 5, '#e84a52'); p.r(13, 4, 6, 1, GOLD[2]); sym(p, 5, 6, 2, 2, M[3]);                                            // a crest
    }
  },
  chest(p, m, c, style) {
    const M = mramp(m), R = style === 'robe' || style === 'coat' ? ramp(c) : M;
    if (style === 'robe') {
      shape(p, 3, [3, 4, 9, 12, 13, 13, 13, 12, 12, 11, 11, 10, 10, 10, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12], R);
      sym(p, 0, 9, 4, 10, R[1]); sym(p, 1, 10, 2, 8, R[2]); sym(p, 0, 18, 4, 2, R[0]); p.r(13, 3, 6, 3, R[0]); p.r(15, 4, 2, 24, R[0]);                              // sleeves, a deep collar and the front seam
      p.r(5, 17, 22, 2, GOLD[2]); p.r(5, 17, 22, 1, GOLD[3]); p.r(5, 18, 22, 1, GOLD[0]); p.r(14, 16, 4, 4, '#ff5a7a'); p.p(14, 16, WH); for (let y = 21; y < 29; y += 3) sym(p, 8, y, 1, 2, R[3]);
    } else if (style === 'coat') {
      shape(p, 3, [4, 5, 9, 12, 13, 13, 13, 12, 12, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12], R);
      sym(p, 0, 9, 4, 11, R[1]); sym(p, 1, 10, 2, 9, R[2]); p.r(15, 3, 2, 26, R[0]); sym(p, 9, 3, 4, 4, R[0]); belt(p, 21, 11);
      for (let y = 9; y < 21; y += 3) { p.p(13, y, GOLD[2]); p.p(18, y, GOLD[2]); p.p(13, y + 1, GOLD[0]); p.p(18, y + 1, GOLD[0]); }
      sym(p, 4, 12, 4, 1, R[0]); sym(p, 4, 25, 8, 1, R[0]);
    } else if (style === 'mail') {
      shape(p, 3, [4, 5, 9, 12, 13, 14, 14, 13, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12], M);
      sym(p, 0, 9, 4, 11, M[1]); chain(p, 4, 6, 27, 26, M[3]); chain(p, 1, 9, 3, 19, M[3]); p.r(14, 3, 4, 3, M[0]); belt(p, 22, 12);
      for (let y = 6; y < 22; y += 3) for (let x = 5; x < 27; x += 3) if ((x + y) % 2 === 0) p.p(x, y, M[0]);
    } else {
      shape(p, 4, [4, 6, 8, 10, 12, 13, 13, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12], M);
      for (const [dx] of [[0]]) { p.disc(4.5, 9, 4.6, M[1]); p.disc(27.5, 9, 4.6, M[0]); p.disc(4, 8, 3, M[2]); p.disc(27, 8, 3, M[2]); p.disc(3, 7, 1.2, M[3]); p.disc(26, 7, 1.2, M[3]); void dx; }
      sym(p, 0, 12, 3, 8, M[1]); sym(p, 0, 12, 1, 8, M[3]);                                                                                                         // the arms
      shape(p, 9, [5, 6, 7, 7, 8, 8, 8, 8, 7, 7, 6, 5, 4, 3], [M[0], M[1], M[3], M[3]]); p.r(15, 9, 2, 14, M[1]);
      p.disc(15.5, 15.5, 3.2, '#8a1a22'); p.disc(15, 15, 2.2, '#e84a52'); p.p(14, 14, WH);                                                                           // a gem set in the breastplate
      p.r(4, 24, 24, 3, GOLD[2]); p.r(4, 24, 24, 1, GOLD[3]); p.r(4, 26, 24, 1, GOLD[0]); sym(p, 4, 4, 5, 1, M[3]);
    }
  },
  legs(p, m, c, style) {
    const M = mramp(m), R = style === 'robe' || style === 'coat' ? ramp(c) : M;
    if (style === 'robe') {
      shape(p, 3, [11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14], R);
      for (let y = 8; y < 29; y++) { p.p(9, y, R[0]); p.p(22, y, R[0]); p.p(15, y, R[1]); p.p(16, y, R[0]); }
      p.r(2, 26, 28, 2, GOLD[2]); p.r(2, 26, 28, 1, GOLD[3]); p.r(2, 27, 28, 1, GOLD[0]); belt(p, 3, 11);
    } else {
      belt(p, 3, 11);
      const leg = (x0) => { for (let y = 7; y < 29; y++) { const w = y < 20 ? 11 : 10 - Math.floor((y - 20) / 4); for (let i = 0; i < w; i++) { const x = x0 + i, l = i, r = w - 1 - i; p.p(x, y, l === 0 ? R[3] : l < 2 ? R[2] : r === 0 ? R[0] : r < 2 ? R[1] : R[2]); } } };
      leg(4); leg(17);
      sym(p, 4, 6, 11, 1, R[0]);
      if (style === 'plate') { sym(p, 4, 14, 11, 5, M[3]); sym(p, 4, 14, 11, 1, WH); sym(p, 4, 18, 11, 1, M[0]); sym(p, 8, 15, 3, 2, '#e84a52'); sym(p, 4, 25, 11, 3, M[1]); sym(p, 4, 25, 11, 1, M[3]); }
      if (style === 'mail') { for (const x0 of [4, 17]) chain(p, x0 + 1, 8, x0 + 9, 27, M[3]); sym(p, 4, 26, 11, 2, M[0]); }
      if (style === 'coat') { sym(p, 7, 14, 5, 4, R[1]); sym(p, 7, 14, 5, 1, R[3]); sym(p, 7, 17, 5, 1, R[0]); for (const x of [8, 22]) for (let y = 8; y < 27; y += 3) p.p(x - 3, y, R[0]); sym(p, 4, 26, 11, 2, LEATHER[1]); }
    }
  },
  feet(p, m, c, style) {
    const M = mramp(m), R = style === 'robe' || style === 'coat' ? ramp(c) : M;
    const boot = (x0, mir) => {
      const px = (x, y, col) => p.p(mir ? N - 1 - x : x, y, col), rect = (x, y, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col); };
      for (let y = 3; y < 22; y++) for (let x = 4; x < 12; x++) { const l = x - 4, r = 11 - x; px(x, y, l === 0 ? R[3] : l < 2 ? R[2] : r === 0 ? R[0] : r < 2 ? R[1] : R[2]); }              // the shaft
      for (let y = 20; y < 27; y++) for (let x = 2; x < 14 - Math.max(0, 22 - y - 2); x++) { const l = x - 2, r = 13 - x; px(x, y, y === 20 ? R[3] : l === 0 ? R[3] : r === 0 ? R[0] : y > 24 ? R[1] : R[2]); }   // the foot, toe to the outside
      rect(1, 26, 13, 3, '#2a1c14'); rect(1, 26, 13, 1, '#4a3424'); rect(1, 28, 13, 1, '#14101c');                                                                    // the sole
      rect(3, 3, 9, 3, style === 'robe' ? GOLD[2] : LEATHER[1]); rect(3, 3, 9, 1, style === 'robe' ? GOLD[3] : LEATHER[3]);                                           // the cuff
      if (style === 'plate') { rect(3, 8, 9, 3, M[3]); rect(3, 8, 9, 1, WH); rect(3, 10, 9, 1, M[0]); for (let k = 0; k < 3; k++) { rect(6 + k * 2, 20 - 0, 2, 2, M[3]); } }
      if (style === 'mail') for (let y = 7; y < 19; y += 3) for (let x = 5; x < 11; x += 3) px(x + (y % 2), y, M[3]);
      if (style === 'coat') { for (const y of [8, 11, 14]) { rect(4, y, 8, 1, GOLD[2]); px(11, y + 1, GOLD[0]); } rect(2, 21, 12, 1, R[0]); }
      if (style === 'robe') { px(12, 22, WH); px(3, 12, R[3]); px(3, 15, R[3]); }
      void x0;
    };
    boot(0, false); boot(0, true);
  },
  ring(p, m, c, style, ak) {
    const M = mramp(m), col = { signet: '#e84a52', wardring: '#4a8aff', sagering: '#b86aff', galering: '#4af09a' }[ak] ?? '#ffe36b', G = ramp(col);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - 16, dy = y + 0.5 - 19, d = Math.hypot(dx, dy); if (d > 10.5 || d < 5.6) continue; const l = (-dx - dy) / (d + 0.001); p.p(x, y, d > 9.6 ? M[0] : d < 6.6 ? M[0] : l > 0.55 ? M[3] : l > 0.05 ? M[2] : l > -0.5 ? M[1] : M[0]); }
    // the setting: a four-claw bezel and a cut stone (a diamond of pixels, each facet its own tone)
    p.r(11, 5, 10, 10, M[1]); p.r(11, 5, 10, 1, M[3]); p.r(11, 14, 10, 1, M[0]); p.r(10, 6, 1, 3, M[3]); p.r(21, 6, 1, 3, M[0]);
    for (let y = 0; y < 8; y++) { const hw = y < 4 ? 1 + y * 1.1 : 5.2 - (y - 4) * 1.3, x0 = Math.round(16 - hw), x1 = Math.round(16 + hw) - 1; for (let x = x0; x <= x1; x++) p.p(x, 5 + y + 1, x < 15 ? (y < 4 ? G[3] : G[2]) : x < 17 ? G[2] : G[0]); }
    p.p(14, 7, WH); p.p(15, 6, WH); p.p(13, 8, G[3]); sym(p, 9, 5, 2, 2, M[2]); p.p(10, 5, M[3]);
  },
  charm(p, m, c, style, ak) {
    const M = mramp(m);
    if (ak === 'locket') {
      for (let t = 0; t < 14; t++) { const y = t, xl = 5 + Math.round(Math.pow(t / 14, 1.6) * 8), xr = N - 1 - xl; p.p(xl, y, GOLD[2]); p.p(xl + 1, y, GOLD[0]); p.p(xr, y, GOLD[2]); p.p(xr - 1, y, GOLD[0]); }
      p.disc(16, 22, 9, GOLD[0]); p.disc(15.5, 21.5, 8, GOLD[1]); p.disc(15, 21, 7, GOLD[2]); p.disc(16, 22, 6, GOLD[0]); p.disc(16, 22, 5.2, M[2]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x + 0.5 - 16, dy = y + 0.5 - 22, d = Math.hypot(dx, dy); if (d > 5.2) continue; const l = (-dx - dy) / (d + 0.001) * (d / 5.2); p.p(x, y, l > 0.55 ? WH : l > 0.1 ? M[3] : l > -0.4 ? M[2] : M[1]); }
      p.r(14, 11, 4, 3, GOLD[2]); p.r(14, 11, 4, 1, GOLD[3]);
    } else if (ak === 'forgecharm') {
      for (let t = 0; t < 12; t++) { const xl = 6 + Math.round(Math.pow(t / 12, 1.5) * 7); p.p(xl, t, GOLD[2]); p.p(N - 1 - xl, t, GOLD[2]); p.p(xl + 1, t, GOLD[0]); p.p(N - 2 - xl, t, GOLD[0]); }
      shape(p, 12, [12, 13, 14, 14, 14, 13, 12, 10, 9, 8, 8, 8, 9, 10, 11], M); sym(p, 2, 16, 4, 3, M[2]); p.r(11, 12, 10, 2, M[3]);
      p.disc(16, 19, 4.2, '#8a3a10'); p.disc(15.5, 18.5, 3.4, '#ff8a3a'); p.disc(15, 18, 1.6, '#ffe0a0'); p.p(14, 17, WH);
    } else {
      sym(p, 0, 12, 4, 10, M[1]); p.r(3, 11, 26, 12, M[2]); p.r(3, 11, 26, 2, M[3]); p.r(3, 21, 26, 2, M[0]); p.r(3, 13, 26, 1, M[1]);
      for (const x of [6, 10, 22, 26]) { p.p(x, 16, M[3]); p.p(x, 17, M[0]); }
      p.r(10, 9, 12, 16, GOLD[2]); p.r(10, 9, 12, 2, GOLD[3]); p.r(10, 23, 12, 2, GOLD[0]); p.r(9, 11, 1, 12, GOLD[1]);
      p.disc(16, 17, 4.6, '#1a3a8a'); p.disc(15.5, 16.5, 3.8, '#4a8aff'); p.disc(15, 16, 1.8, '#c8e0ff'); p.p(13, 14, WH);
    }
  },
};

// A piece of gear as a 32×32 pixel sprite (+1px outline). tint/tintA wash it with a colour (heat, a glow, a dull shade).
const cache = new Map();
export function gearPixel(id, size = 32, tint = null, tintA = 0) {
  const key = `${id}:${tint}:${tintA}`; let c = cache.get(key); if (c) return c;
  const it = ITEMS[id], ak = archOf(id) ?? '', style = ARCH[ak]?.style ?? ak, pal = gearPalette(id), slot = it?.slot ?? 'weapon';
  c = sprite(N, N, (p) => {
    if (slot === 'weapon') {
      const wk = W[ak] ? ak : it?.wtype === 'slash' ? 'sword' : it?.wtype === 'pierce' ? 'spear' : it?.wtype === 'blunt' ? 'mace' : 'staff'; W[wk](p, pal.m, pal.accent);
    } else (A[slot] ?? A.charm)(p, pal.m, pal.cloth(style), style, ak);
  });
  if (tint && tintA > 0) { const g = c.getContext('2d'); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tintA; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  cache.set(key, c); void size; void TILT; return c;
}
