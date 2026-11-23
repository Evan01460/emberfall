// Brand-new creature art for the five new realms. None of these reuse an older shape: every one is its own silhouette,
// drawn pixel by pixel (1 art pixel = 2 world px) and animated with two frames. Each faces RIGHT; the renderer flips for left.
import { sprite, shade as shade0, tint as tint0 } from './px.js';

// px.js colour maths only understands #rrggbb, but it returns rgb(): normalise so results can be fed back in (shade(tint(..)))
const hx = (c) => { const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(c); return m ? `#${[m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('')}` : c; };
const shade = (c, k) => shade0(hx(c), k), tint = (c, to, t) => tint0(hx(c), hx(to), t);

// Light from the upper left: rim light on the lit edges, a core shadow on the far edges, a soft top-to-bottom gradient and
// checker-dithered inner bands. Applied to every creature after it is drawn, so the flat colour blocks read as volumes.
function lighting(g, w, h) {
  const im = g.getImageData(1, 1, w, h), D = im.data, out = new Uint8ClampedArray(D), A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : D[(y * w + x) * 4 + 3] > 100 ? 1 : 0);
  let y0 = h, y1 = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) {
    if (!A(x, y)) continue; const i = (y * w + x) * 4; let k = 1.06 - 0.2 * ((y - y0) / Math.max(1, y1 - y0));
    const lit = !A(x, y - 1) || !A(x - 1, y), dim = !A(x, y + 1) || !A(x + 1, y);
    if (lit && !dim) k *= 1.2; else if (dim && !lit) k *= 0.74;
    else if (!lit && !dim) { const d2 = !A(x, y + 2) || !A(x + 2, y), l2 = !A(x, y - 2) || !A(x - 2, y); if (d2 && (x + y) % 2 === 0) k *= 0.86; else if (l2 && (x + y) % 2 === 0) k *= 1.1; }
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, Math.round(D[i + c] * k + (k > 1 ? (k - 1) * 40 : 0))));
  }
  im.data.set(out); g.putImageData(im, 1, 1);
}
const mk = (w, h, fn) => (c, f) => sprite(w, h, (p, g) => { fn(p, c, f, shade(c, 0.58), tint(c, '#ffffff', 0.32), shade(c, 0.8)); lighting(g, w, h); });
const eye = (p, x, y, c = '#ffe36b') => { p.p(x, y, c); p.p(x + 1, y, c); };
// fill a triangle (membrane for wings)
const tri = (p, [ax, ay], [bx, by], [cx, cy], col) => {
  const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx)), y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay) || 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const u = ((x + 0.5 - ax) * (cy - ay) - (cx - ax) * (y + 0.5 - ay)) / d, v = ((bx - ax) * (y + 0.5 - ay) - (x + 0.5 - ax) * (by - ay)) / d; if (u >= 0 && v >= 0 && u + v <= 1) p.p(x, y, col); }
};
const DK = '#1a1420', WH = '#f4ecd8';

export const MON2 = {
  // ── SUNKEN ARCHIPELAGO ────────────────────────────────────────────────────────
  crab: mk(28, 18, (p, b, f, d, l) => {
    for (let i = 0; i < 3; i++) { p.r(8 + i * 3, 13, 1, 3 + ((i + f) % 2), d); p.r(17 + i * 3 - 3, 13, 1, 3 + ((i + f + 1) % 2), d); }
    p.ell(14, 10, 9, 5, b); p.ell(13, 8, 7, 2.6, l); p.r(6, 12, 16, 1, d); for (const [x, y] of [[10, 9], [15, 10], [18, 8]]) p.p(x, y, d);
    p.line(7, 9, 4, 6, d); p.line(21, 9, 24, 6 - f, d);
    p.r(1, 1, 3, 6, b); p.r(5, 2, 2, 5, b); p.r(2, 1, 1, 5, l); p.r(2, 6, 5, 3, b);                  // left pincer
    p.r(22, 0 - f + 1, 3, 6, b); p.r(26, 1 - f + 1, 2, 5, b); p.r(23, 1 - f + 1, 1, 5, l); p.r(22, 5 - f + 1, 5, 3, b);
    p.r(10, 3, 1, 3, d); p.r(17, 3, 1, 3, d); p.p(10, 2, WH); p.p(17, 2, WH); p.p(10, 2, DK); p.p(17, 2, DK); p.p(10, 3, '#ff4a3a'); p.p(17, 3, '#ff4a3a');
  }),
  jelly: mk(22, 28, (p, b, f, d, l) => {
    const sw = (y, i) => Math.round(Math.sin(y * 0.7 + i * 1.3 + f * 2.2) * 1.4);
    for (let i = 0; i < 5; i++) { const x = 4 + i * 3; for (let y = 14; y < 27; y++) p.p(x + sw(y, i), y, i % 2 ? b : d); p.p(x + sw(26, i), 27, l); }
    p.r(7, 13, 2, 11, tint(b, '#ffffff', 0.5)); p.r(14, 13, 2, 10, tint(b, '#ffffff', 0.5));
    p.ell(11, 8, 9, 8, d); p.ell(11, 8, 8, 7, b); p.ell(9, 5, 5, 3, l); p.ell(12, 10, 5, 3, shade(b, 0.9));
    for (const [x, y] of [[5, 11], [17, 10], [11, 12]]) p.p(x, y, l);
    p.p(7, 9, DK); p.p(8, 9, DK); p.p(14, 9, DK); p.p(15, 9, DK); p.p(7, 8, '#fff'); p.p(14, 8, '#fff'); p.r(9, 12, 4, 1, DK);
  }),
  serpent: mk(32, 26, (p, b, f, d, l) => {
    const pts = []; for (let i = 0; i < 16; i++) { const t = i / 15, x = 3 + t * 22, y = 18 - Math.sin(t * 6.2 + f * 0.9) * 4 - t * 6; pts.push([x, y]); }
    pts.forEach(([x, y], i) => { const r = 2.4 + i * 0.1; p.disc(x, y, r, i % 3 === 0 ? d : b); p.p(x - 1, y - 1, l); });
    p.p(3, 18, '#ffe36b'); p.line(0, 19, 2, 18, d);
    const [hx, hy] = pts[15];
    p.ell(hx - 4, hy - 4, 5, 8, d); p.ell(hx - 4, hy - 4, 4, 7, tint(b, '#ff4a8a', 0.4)); p.ell(hx - 4, hy - 5, 2, 4, l);       // flared hood
    p.ell(hx + 1, hy - 2, 4, 3.4, b); p.r(hx + 3, hy - 1, 4, 2, d); eye(p, hx, hy - 4, '#ff4a3a'); p.r(hx + 6, hy - 1, 2, 1, '#ff3a5a'); p.p(hx + 7, hy + (f ? 0 : 1), '#ff3a5a'); p.p(hx + 4, hy + 1, WH);
  }),
  tortoise: mk(32, 22, (p, b, f, d, l) => {
    const sh = tint(b, '#7a5a3a', 0.45), sd = shade(sh, 0.6);
    for (const x of [6, 11, 19, 24]) p.r(x, 14, 4, 6 - ((x + f) % 2), d), p.r(x - 1, 19, 5, 2, '#2a2024');
    p.ell(15, 10, 12, 9, sd); p.ell(15, 9, 11, 8, sh); p.ell(13, 6, 7, 3.4, tint(sh, '#ffffff', 0.25));
    for (const [x, y] of [[9, 8], [15, 5], [21, 8], [12, 12], [18, 12]]) { p.r(x, y, 4, 3, shade(sh, 0.8)); p.p(x, y, tint(sh, '#fff', 0.3)); }
    for (let x = 7; x < 25; x += 4) { p.r(x, 0 + (x % 8 ? 1 : 0) + 1, 2, 3, WH); }
    p.ell(28, 12, 3.4, 3, b); p.r(28, 13, 4, 2, d); eye(p, 27, 10, '#ffb84a'); p.r(2, 14, 4, 2, d); p.r(0, 15, 3, 1, d);
  }),
  harpy: mk(30, 30, (p, b, f, d, l) => {
    const wg = tint(b, '#ffffff', 0.1);
    for (let i = 0; i < 6; i++) { const ty = f ? 1 + i * 2 : 8 + i * 2; p.line(11, 13 + i, 1 + (i % 2), ty, i % 2 ? wg : d); p.line(19, 13 + i, 28 - (i % 2), ty, i % 2 ? wg : d); }
    p.r(11, 11, 8, 12, b); p.r(11, 11, 8, 2, l); p.r(10, 14, 1, 6, d); p.r(19, 14, 1, 6, d);
    p.disc(15, 7, 4, '#e8c8a8'); p.r(11, 3, 8, 3, '#7a3aa8'); p.r(10, 5, 2, 7, '#7a3aa8'); p.r(18, 5, 2, 7, '#7a3aa8'); p.p(13, 7, DK); p.p(17, 7, DK); p.r(14, 9, 3, 1, '#a04050');
    p.r(11, 22, 3, 5, '#c8a050'); p.r(16, 22, 3, 5, '#c8a050'); for (const x of [10, 12, 16, 18]) p.p(x, 27, '#e8e0c0'); p.r(12, 22, 6, 2, d);
  }),
  kraken: mk(60, 52, (p, b, f, d, l) => {
    for (let i = 0; i < 8; i++) { const ox = 6 + i * 6.8; for (let y = 30; y < 51; y++) { const w = Math.round(Math.sin(y * 0.28 + i * 1.1 + f * 1.4) * 3.2) + (i < 4 ? -1 : 1) * ((y - 30) * 0.12); p.r(ox + w, y, 4 - (y > 44 ? 2 : 0), 1, i % 2 ? b : d); if (y % 4 === 0) p.p(ox + w + 1, y, l); } }
    p.ell(30, 17, 24, 17, d); p.ell(30, 16, 23, 16, b); p.ell(26, 9, 15, 6, l); p.ell(36, 22, 12, 6, shade(b, 0.85));
    for (const [x, y] of [[12, 16], [48, 15], [20, 25], [41, 27], [30, 4]]) { p.disc(x, y, 2.2, tint(b, '#ffd0e8', 0.6)); p.p(x, y, d); }
    p.ell(30, 22, 11, 8, '#f4ecd8'); p.disc(30 + (f ? 1 : -1), 22, 6, '#ffdf5a'); p.disc(30 + (f ? 1 : -1), 22, 3.4, '#14101c'); p.p(28, 20, '#fff'); p.r(14, 12, 6, 2, d); p.r(40, 12, 6, 2, d);
    for (let i = 0; i < 7; i++) p.p(22 + i * 2, 33 + (i % 2), WH);
  }),

  // ── CLOCKWORK DOMINION ────────────────────────────────────────────────────────
  beetle: mk(28, 20, (p, b, f, d, l) => {
    for (let i = 0; i < 3; i++) { const x = 8 + i * 4; p.line(x, 13, x - 3, 17 + ((i + f) % 2), d); p.line(x + 2, 13, x + 5, 17 + ((i + f + 1) % 2), d); }
    p.ell(13, 10, 11, 7, d); p.ell(13, 9, 10, 6, b); p.r(13, 3, 1, 12, d); p.ell(10, 6, 6, 2.5, l); p.ell(16, 7, 3, 1.5, l);
    for (const [x, y] of [[8, 11], [18, 11], [11, 7], [16, 6]]) { p.disc(x, y, 1.2, '#c0a060'); p.p(x, y, DK); }
    p.ell(24, 9, 3.4, 3, d); p.line(26, 7, 28, 2, '#c0a060'); p.line(27, 2, 25, 1, '#c0a060'); eye(p, 23, 8, '#7affff'); p.r(22, 12, 3, 1, '#c0a060');
  }),
  bat: mk(32, 22, (p, b, f, d, l) => {
    const mem = tint(b, '#4a2a5a', 0.55), mem2 = shade(mem, 0.78), ty = f ? 0 : 8;
    for (const dir of [-1, 1]) { const X = (x) => 16 + dir * x;
      tri(p, [X(3), 9], [X(15), ty], [X(10), ty + 11], mem); tri(p, [X(3), 9], [X(10), ty + 11], [X(4), 16], mem2); tri(p, [X(15), ty], [X(15), ty + 6], [X(10), ty + 11], mem2);
      p.line(X(3), 9, X(15), ty, d); p.line(X(3), 9, X(10), ty + 11, d); p.line(X(3), 9, X(15), ty + 6, d); p.line(X(3), 10, X(4), 16, d); }
    p.ell(16, 11, 4, 5, b); p.ell(16, 9, 3, 2, l); p.disc(16, 6, 3.4, b); p.r(12, 1, 2, 4, d); p.r(18, 1, 2, 4, d); p.p(12, 0, d); p.p(19, 0, d); eye(p, 14, 6, '#ff4a3a'); p.p(17, 6, '#ff4a3a');
    p.p(15, 9, WH); p.p(17, 9, WH); p.r(14, 17, 1, 3, d); p.r(18, 17, 1, 3, d);
    p.disc(16, 12, 1.4, '#e0b060'); p.p(16, 12, '#fff2b0');                                          // a little brass gear on its chest
  }),
  automaton: mk(26, 34, (p, b, f, d, l) => {
    const iron = tint(b, '#8a8a98', 0.35), id = shade(iron, 0.6), il = tint(iron, '#fff', 0.3);
    p.r(6, 24, 5, 9 - (f ? 0 : 1), id); p.r(15, 24, 5, 9 - (f ? 1 : 0), id); p.r(4, 32, 8, 2, '#2a2024'); p.r(14, 32, 8, 2, '#2a2024'); p.r(7, 27, 3, 1, il); p.r(16, 27, 3, 1, il);   // pistons
    p.r(5, 10, 16, 15, iron); p.r(5, 10, 16, 2, il); p.r(5, 22, 16, 3, id);
    p.disc(13, 17, 5, '#c0a060'); p.disc(13, 17, 3.2, DK); for (let a = 0; a < 8; a++) p.p(13 + Math.round(Math.cos(a * 0.785 + f * 0.39) * 5), 17 + Math.round(Math.sin(a * 0.785 + f * 0.39) * 5), '#e8d088'); p.disc(13, 17, 1.4, '#7affff');
    p.r(0, 11, 5, 4, b); p.r(0, 14, 4, 10, iron); p.r(21, 11, 5, 4, b); p.r(22, 14, 4, 10, iron); p.r(-0, 23, 5, 5, id); p.r(21, 23, 5, 5, id); p.r(2, 17, 1, 1, '#c0a060');
    p.r(8, 2, 10, 9, iron); p.r(8, 2, 10, 1, il); p.r(9, 5, 8, 3, DK); p.r(10 + (f ? 4 : 0), 6, 3, 1, '#ff4a3a'); p.r(12, 0, 2, 3, '#c0a060'); p.p(13, -0, '#ffe36b'); p.r(8, 10, 10, 1, id);
  }),
  lantern: mk(18, 30, (p, b, f, d, l) => {
    p.r(8, 0, 2, 4, '#4a4048'); p.r(7, 3, 4, 1, '#c0a060');
    p.r(3, 4, 12, 2, '#c0a060'); p.r(3, 5, 12, 1, d); p.r(2, 22, 14, 2, '#c0a060'); p.r(3, 24, 12, 1, d);
    p.r(4, 6, 10, 16, shade(b, 0.55)); p.r(4, 6, 1, 16, '#c0a060'); p.r(13, 6, 1, 16, '#c0a060'); p.r(8, 6, 2, 16, '#6a5a3a');
    p.ell(9, 14, 3.4, 6, f ? '#ffd870' : '#ffb84a'); p.ell(9, 15, 2, 4, '#fff6c8'); p.p(9, 8 - f, '#ffd870');
    p.p(7, 13, DK); p.p(11, 13, DK); p.r(8, 17, 2, 1, DK);
    for (const [x, y] of [[1, 12 + f], [16, 10 - f], [0, 18 - f]]) p.p(x, y, '#9affff');                  // wandering sparks
    p.r(6, 25, 1, 4 + f, d); p.r(9, 25, 1, 3 + (1 - f), d); p.r(12, 25, 1, 4 + f, d);
  }),
  titan: mk(56, 66, (p, b, f, d, l) => {
    const iron = tint(b, '#8a8a98', 0.3), id = shade(iron, 0.55), il = tint(iron, '#fff', 0.3), brass = '#d0a050';
    p.r(10, 46, 12, 19 - f, id); p.r(34, 46, 12, 18 + f, id); p.r(7, 63 - f, 17, 3, '#2a2024'); p.r(32, 62 + f, 17, 3, '#2a2024'); p.r(10, 49, 12, 2, brass); p.r(34, 49, 12, 2, brass);
    p.r(8, 20, 40, 28, iron); p.r(8, 20, 40, 3, il); p.r(8, 43, 40, 5, id);
    p.disc(28, 33, 11, brass); p.disc(28, 33, 8, DK); p.disc(28, 33, 5, f ? '#ffb84a' : '#ff7a2a'); p.disc(28, 33, 2.4, '#fff2b0');
    for (let a = 0; a < 12; a++) p.r(28 + Math.round(Math.cos(a * 0.5236 + f * 0.26) * 10), 33 + Math.round(Math.sin(a * 0.5236 + f * 0.26) * 10), 2, 2, '#f0d890');
    p.r(0, 22, 10, 7, b); p.r(1, 28, 8, 17, iron); p.r(-0, 44, 10, 9, id); p.r(46, 22, 10, 7, b); p.r(47, 28, 8, 17, iron); p.r(46, 44, 10, 9, id); p.r(1, 36, 8, 2, brass); p.r(47, 36, 8, 2, brass);
    p.r(18, 4, 20, 17, iron); p.r(18, 4, 20, 2, il); p.r(21, 10, 14, 5, DK); p.r(22 + (f ? 8 : 0), 11, 5, 2, '#ff4a3a'); p.r(25, 0, 6, 5, brass); p.r(26, -0, 4, 2, '#fff2b0'); p.r(14, 12, 4, 6, id); p.r(38, 12, 4, 6, id); p.r(18, 20, 20, 2, id);
    p.r(24, 16, 8, 2, id); p.p(27, 17, WH); p.p(29, 17, WH);
  }),

  // ── SPOREWILDS ────────────────────────────────────────────────────────────────
  mushroom: mk(24, 28, (p, b, f, d, l) => {
    p.r(8, 18, 3, 8 + (f ? 0 : 1), '#d8c8a8'); p.r(13, 18, 3, 8 + (f ? 1 : 0), '#d8c8a8'); p.r(7, 26, 5, 2, '#4a3a2a'); p.r(12, 26, 5, 2, '#4a3a2a');
    p.r(6, 12, 12, 9, '#e8dcc0'); p.r(6, 12, 1, 9, '#f6eedc'); p.r(17, 12, 1, 9, '#c8b898'); p.r(6, 18, 12, 2, '#c8b898');
    p.ell(12, 8, 11, 8, d); p.ell(12, 7, 10, 7, b); p.ell(9, 4, 6, 3, l); for (const [x, y, r] of [[6, 8, 1.8], [12, 3, 1.6], [17, 7, 2], [10, 10, 1.4]]) p.disc(x, y, r, '#f6eedc');
    p.r(7, 13, 4, 2, DK); p.r(13, 13, 4, 2, DK); p.p(8, 14, '#ff4a3a'); p.p(14, 14, '#ff4a3a'); p.r(9, 18, 6, 1, DK);
    p.r(2, 14, 4, 2, '#e8dcc0'); p.r(18, 14, 4, 2, '#e8dcc0'); p.r(1, 16, 3, 3, '#c8b898'); p.r(20, 16, 3, 3, '#c8b898');
    for (const [x, y] of [[2, 6 + f], [21, 4 - f]]) p.p(x, y, l);                                      // spores
  }),
  moth: mk(32, 26, (p, b, f, d, l) => {
    const wt = tint(b, '#ffffff', 0.1);
    const wing = (dir) => { const sp = f ? 11 : 14, cx = 16 + dir * 3; p.ell(16 + dir * sp, 9, 9, 8, d); p.ell(16 + dir * sp, 9, 8, 7, wt); p.ell(16 + dir * (sp - 1), 6, 5, 3, l); p.disc(16 + dir * (sp + 1), 10, 3, '#ffe36b'); p.disc(16 + dir * (sp + 1), 10, 1.6, DK); p.p(16 + dir * sp, 9, WH); p.ell(16 + dir * (sp - 3), 17, 5, 4, shade(b, 0.85)); };
    wing(-1); wing(1);
    p.ell(16, 14, 3.4, 7, '#c8b898'); p.ell(16, 12, 2.4, 3, '#e8dcc0'); for (let y = 11; y < 20; y += 2) p.r(14, y, 5, 1, '#a89878'); p.disc(16, 6, 3, '#e8dcc0'); eye(p, 14, 6, '#ff4a3a');
    p.line(14, 4, 11, -0, d); p.line(18, 4, 21, 0, d); p.p(11, 0, l); p.p(21, 0, l); p.r(15, 21, 2, 4, d);
    for (const [x, y] of [[3, 20 + f], [28, 19 - f]]) p.p(x, y, '#d8ffa8');
  }),
  mantis: mk(28, 34, (p, b, f, d, l) => {
    p.r(11, 24, 2, 9 - f, d); p.r(15, 24, 2, 8 + f, d); p.r(9, 32 - f, 4, 1, DK); p.r(15, 31 + f, 4, 1, DK);
    p.r(10, 12, 8, 14, b); p.r(10, 12, 8, 2, l); p.r(10, 22, 8, 4, d); for (let y = 14; y < 24; y += 3) p.r(11, y, 6, 1, d);
    p.ell(16, 8, 4.5, 4, b); p.r(13, 6, 2, 3, '#14101c'); p.r(17, 6, 2, 3, '#14101c'); p.p(13, 6, '#9aff6a'); p.p(18, 6, '#9aff6a'); p.line(12, 4, 8, 0 - f, d); p.line(19, 4, 23, 0 - f, d); p.r(14, 11, 3, 1, d);
    p.line(10, 14, 4, 12, b); p.line(4, 12, 1, 20 + f, b); p.line(1, 20 + f, 2, 24, l); for (let i = 0; i < 4; i++) p.p(2 + (i % 2), 15 + i * 2 + f, '#e8e0d0');    // scythe arms
    p.line(18, 14, 24, 12 - f, b); p.line(24, 12 - f, 27, 20, b); p.line(27, 20, 26, 24, l); for (let i = 0; i < 4; i++) p.p(26 - (i % 2), 15 + i * 2, '#e8e0d0');
  }),
  toad: mk(28, 20, (p, b, f, d, l) => {
    p.r(4, 14, 4, 5 - f, d); p.r(18, 14, 4, 5 - f, d); p.r(2, 18, 6, 2, d); p.r(18, 18, 7, 2, d); p.r(10, 15, 3, 4, d); p.r(15, 15, 3, 4, d);
    p.ell(14, 10, 12, 7, d); p.ell(14, 9, 11, 6, b); p.ell(13, 6, 8, 3, l); p.r(3, 11 + f, 22, 2, '#2a1a20'); p.r(5, 13 + f, 18, 1, '#e8708a');
    for (const [x, y] of [[8, 6], [13, 4], [19, 7], [22, 10], [6, 10]]) { p.disc(x, y, 1.4, shade(b, 0.7)); p.p(x, y - 1, l); }
    p.disc(8, 3, 3, b); p.disc(19, 3, 3, b); p.disc(8, 3, 1.8, '#ffe36b'); p.disc(19, 3, 1.8, '#ffe36b'); p.r(8, 2, 1, 3, DK); p.r(19, 2, 1, 3, DK);
    p.r(24, 12, 2, 2 + f * 3, '#e8708a');
  }),
  myconid: mk(52, 64, (p, b, f, d, l) => {
    const st = '#e8dcc0', sd = '#b8a888';
    p.r(15, 46, 8, 17 - f, sd); p.r(29, 46, 8, 16 + f, sd); p.r(12, 62 - f, 12, 2, '#3a2a1a'); p.r(27, 61 + f, 12, 3, '#3a2a1a');
    p.r(11, 22, 30, 26, st); p.r(11, 22, 2, 26, '#f6eedc'); p.r(39, 22, 2, 26, sd); p.r(11, 42, 30, 5, sd);
    p.ell(26, 14, 25, 14, d); p.ell(26, 13, 24, 13, b); p.ell(18, 7, 14, 5, l);
    for (const [x, y, r] of [[8, 14, 3], [18, 5, 2.6], [30, 8, 3.2], [42, 14, 3], [24, 18, 2.4], [36, 19, 2]]) { p.disc(x, y, r, '#f6eedc'); p.p(x - 1, y - 1, WH); }
    p.r(14, 27, 9, 4, DK); p.r(29, 27, 9, 4, DK); p.r(16, 28, 4, 2, '#ff4a3a'); p.r(31, 28, 4, 2, '#ff4a3a'); p.r(20, 38, 12, 2, DK); for (let i = 0; i < 5; i++) p.r(21 + i * 2, 36, 1, 2, WH);
    p.r(2, 26, 10, 6, st); p.r(0, 30, 9, 16 + f, st); p.r(-0, 44 + f, 10, 5, sd); p.r(40, 26, 10, 6, st); p.r(43, 30, 9, 16 - f, st); p.r(42, 44 - f, 10, 5, sd);
    for (const [x, y] of [[5, 10 + f * 3], [47, 6 - f * 2], [26, -0 + 0], [12, 3 + f]]) { p.p(x, y, '#d8ffa8'); p.p(x + 1, y + 1, l); }
  }),

  // ── DRAGONBONE WASTES ─────────────────────────────────────────────────────────
  wyvern: mk(40, 34, (p, b, f, d, l) => {
    const mem = tint(b, '#8a2a3a', 0.55), bone = '#efe4c8', belly = tint(b, '#f0d8a0', 0.55);
    { const ty = f ? 0 : 7; tri(p, [17, 15], [3, ty + 1], [10, ty + 13], mem); tri(p, [17, 15], [10, ty + 13], [19, 20], shade(mem, 0.8)); tri(p, [17, 15], [12, ty - 1], [3, ty + 1], mem); p.line(17, 15, 3, ty + 1, bone); p.line(17, 15, 12, ty - 1, bone); p.line(17, 15, 10, ty + 13, bone); p.line(17, 15, 7, ty + 7, bone); }
    for (let i = 0; i < 12; i++) { const x = 15 - i * 1.15, y = 22 + i * 0.6 + Math.sin(i * 0.6 + f) * 1.4, r = Math.max(0.9, 3.4 - i * 0.22); p.disc(x, y, r, i % 3 === 0 ? d : b); }           // tail
    p.disc(1, 29, 2.2, d); p.line(0, 27, 2, 31, '#ff7a3a'); p.line(2, 27, 0, 31, '#ff7a3a');
    p.r(13, 24, 3, 7 - f, d); p.r(24, 24, 3, 6 + f, d); p.r(12, 30 - f, 6, 2, bone); p.r(23, 30 + f, 6, 2, bone); p.p(12, 31 - f, WH); p.p(23, 31 + f, WH);
    p.ell(20, 21, 10, 6.5, b); p.ell(19, 18, 8, 3, l); p.ell(21, 24, 8, 2.6, belly); for (let x = 14; x < 28; x += 3) p.r(x, 22, 2, 1, tint(belly, '#ffffff', 0.4));
    for (let i = 0; i < 6; i++) { const x = 28 + i * 1.3, y = 18 - i * 2.2; p.disc(x, y, 3 - i * 0.25, b); } p.disc(28, 17, 2, belly);   // neck
    p.ell(35, 6, 4.4, 3.4, b); p.r(35, 6, 5, 3, d); p.r(36, 8, 4, 1, belly); p.p(38, 5, '#ff7a3a'); for (const x of [36, 38]) p.p(x, 9, WH); eye(p, 33, 4, '#ffe36b'); p.line(31, 3, 27, 0, bone); p.line(33, 2, 31, -0, bone);
    for (let i = 0; i < 7; i++) p.p(16 + i * 2 + 1, 15 - Math.round(i * 0.4), bone);
  }),
  phoenix: mk(34, 34, (p, b, f, d, l) => {
    const fl = ['#ff4a1a', '#ff8a2a', '#ffc83a', '#fff0a0'];
    const wing = (dir) => { for (let i = 0; i < 7; i++) { const ty = f ? 1 + i * 2 : 8 + i * 2; p.line(17 + dir * 3, 14 + i, 17 + dir * (13 - (i % 2)), ty, fl[i % 3]); p.line(17 + dir * 3, 15 + i, 17 + dir * (11 - (i % 2)), ty + 1, fl[(i + 1) % 3]); } };
    wing(-1); wing(1);
    for (let i = 0; i < 9; i++) { const y = 22 + i, w = Math.round(Math.sin(i * 1 + f * 2) * 2); p.r(15 + w, y, 4 - (i > 5 ? 2 : 0), 1, fl[i % 4]); p.p(12 + w * 2, y, fl[(i + 2) % 3]); p.p(21 + w, y, fl[(i + 1) % 3]); }
    p.ell(17, 17, 5, 7, fl[0]); p.ell(17, 16, 4, 5, fl[1]); p.ell(17, 15, 2.4, 3, fl[3]);
    p.disc(17, 8, 4, fl[1]); p.disc(17, 8, 2.6, fl[2]); p.r(19, 8, 4, 2, '#e8b040'); p.p(22, 9, '#c88020'); p.p(18, 7, DK); p.p(19, 7, DK);
    p.line(15, 4, 12, 0 + f, fl[2]); p.line(17, 4, 17, -0, fl[3]); p.line(19, 4, 22, 0 + f, fl[2]);
    for (const [x, y] of [[3, 6 + f * 2], [30, 4 - f], [6, 28 - f], [28, 30 + f]]) p.p(x, y, fl[3]);
  }),
  salamander: mk(36, 16, (p, b, f, d, l) => {
    for (const x of [8, 13, 21, 26]) { p.r(x, 9, 2, 5 - ((x + f) % 2), d); p.r(x - 1, 13, 4, 1, d); }
    for (let i = 0; i < 14; i++) { const x = 3 + i * 2, y = 8 + Math.round(Math.sin(i * 0.7 + f * 1.2) * 1.4); p.r(x, y - 2, 3, 5 - (i < 4 ? 1 : 0), b); p.p(x + 1, y - 2, l); }
    for (const [x, y] of [[9, 7], [14, 8], [20, 6], [24, 8]]) { p.disc(x, y, 1.3, '#ffb84a'); p.p(x, y, '#fff0a0'); }
    p.r(0, 9, 4, 2, d); p.p(0, 8, '#ff7a3a'); p.ell(30, 7, 4.6, 3.6, b); p.r(31, 8, 5, 3, d); eye(p, 29, 5, '#ffe36b'); p.r(34, 9, 2, 2 + f, '#ff3a5a'); p.p(33, 10, WH);
    for (const x of [27, 30]) p.r(x, 2, 2, 2, d);
  }),
  minotaur: mk(34, 40, (p, b, f, d, l) => {
    p.r(9, 28, 6, 11 - f, d); p.r(19, 28, 6, 10 + f, d); p.r(7, 38 - f, 9, 2, '#2a2024'); p.r(18, 37 + f, 9, 3, '#2a2024'); p.r(9, 28, 6, 3, '#6a4a30'); p.r(19, 28, 6, 3, '#6a4a30');
    p.r(6, 12, 22, 18, b); p.r(6, 12, 22, 2, l); p.r(6, 26, 22, 4, '#6a4a30'); p.r(14, 14, 6, 8, l); for (const x of [10, 16, 22]) p.p(x, 18, d);
    p.r(0, 13, 7, 7, b); p.r(1, 19, 6, 11, b); p.r(27, 13, 7, 7, b); p.r(28, 19, 6, 9, b); p.r(0, 28, 7, 4, d); p.r(28, 26, 6, 4, d);
    p.line(31, 22, 31, 38, '#8a6a3a'); p.r(27, 28 + f, 8, 6, '#a8b0c0'); p.r(28, 29 + f, 6, 1, '#e8f0ff'); p.r(30, 34 + f, 2, 3, '#8a6a3a');       // axe
    p.r(9, 3, 16, 11, b); p.r(9, 3, 16, 1, l); p.r(20, 8, 8, 6, '#c8a080'); p.r(21, 11, 2, 2, DK); p.r(26, 11, 2, 2, DK); p.r(10, 6, 3, 2, DK); eye(p, 14, 6, '#ff4a3a'); eye(p, 19, 6, '#ff4a3a'); p.r(22, 13, 5, 1, WH);
    p.line(9, 4, 2, 0, WH); p.line(2, 0, 1, -0, WH); p.line(24, 4, 31, 0, WH); p.r(8, 3, 3, 3, WH); p.r(23, 3, 3, 3, WH); p.r(4, 10, 6, 6, d); p.p(5, 12, '#c0a060');
  }),
  wyrmlord: mk(76, 58, (p, b, f, d, l) => {
    const mem = tint(b, '#7a1a2a', 0.55), bone = '#efe4c8', belly = tint(b, '#f0d8a0', 0.55);
    { const ty = f ? 0 : 8; tri(p, [34, 24], [4, ty + 2], [14, ty + 22], mem); tri(p, [34, 24], [14, ty + 22], [33, 36], shade(mem, 0.78)); tri(p, [34, 24], [22, ty - 1], [4, ty + 2], mem); tri(p, [34, 24], [8, ty + 12], [4, ty + 2], shade(mem, 0.86));
      p.line(34, 24, 4, ty + 2, bone); p.line(34, 24, 22, ty - 1, bone); p.line(34, 24, 14, ty + 22, bone); p.line(34, 24, 9, ty + 11, bone); p.line(34, 24, 17, ty + 4, bone); }
    for (let i = 0; i < 18; i++) { const x = 24 - i * 1.25, y = 36 + i * 0.7 + Math.sin(i * 0.5 + f * 1.2) * 2, r = Math.max(1, 6 - i * 0.28); p.disc(x, y, r, i % 3 === 0 ? d : b); if (i % 2 === 0) p.r(x - 1, y - r - 1, 2, 2, bone); }   // tail
    p.line(2, 49, 5, 52, '#ff7a3a'); p.disc(2, 50, 3, d); p.r(0, 47, 5, 2, bone);
    p.r(24, 40, 7, 16 - f, d); p.r(46, 40, 7, 15 + f, d); p.r(21, 54 - f, 12, 3, bone); p.r(44, 53 + f, 12, 3, bone); for (const x of [22, 26, 30]) p.p(x, 56 - f, WH);
    p.ell(38, 35, 21, 12, d); p.ell(38, 33, 20, 11, b); p.ell(33, 28, 14, 5, l); p.ell(40, 41, 16, 4, belly); for (let x = 26; x < 54; x += 4) p.r(x, 41, 3, 1, tint(belly, '#ffffff', 0.45));
    for (let x = 22; x < 56; x += 4) { p.r(x, 20 + ((x + f) % 8 ? 0 : 1), 2, 5, bone); p.p(x, 19, WH); }
    for (let i = 0; i < 9; i++) { const x = 54 + i * 1.5, y = 28 - i * 2.6, r = 6 - i * 0.35; p.disc(x, y, r, i % 2 ? b : d); if (i % 2) p.disc(x - 1, y - 1, r - 2, l); }          // neck
    p.disc(60, 26, 5, belly);
    p.ell(66, 8, 9, 6.5, b); p.ell(65, 6, 7, 3, l); p.r(66, 11, 10, 6, d); p.r(66, 11, 10, 1, shade(b, 0.7)); p.r(67, 15 + f * 2, 9, 2, '#ff4a1a'); p.r(67, 14, 9, 1, '#ffb84a'); for (let x = 67; x < 75; x += 2) { p.r(x, 12, 1, 2, WH); p.r(x, 15 + f * 2 + 2 > 17 ? 17 : 17, 1, 1, WH); }
    eye(p, 63, 5, '#ffe36b'); p.p(64, 6, DK); p.p(75, 9, '#ff7a3a'); p.line(58, 2, 51, -0, bone); p.line(61, 1, 56, -1, bone); p.r(57, 0, 3, 6, bone); p.r(64, -0, 3, 4, bone); p.r(68, 1, 3, 3, bone);
    p.r(30, 26, 4, 3, '#ff7a3a'); p.r(44, 28, 5, 3, '#ff9a3a'); p.r(36, 22, 3, 2, '#ffb84a'); p.r(50, 34, 4, 3, '#ff7a3a');
  }),

  // ── STARFALL REACHES ──────────────────────────────────────────────────────────
  shardling: mk(24, 30, (p, b, f, d, l) => {
    const shard = (cx, cy, w, h, col, hi) => { p.ell(cx, cy, w, h, col); p.line(cx, cy - h, cx, cy + h, hi); p.p(cx - 1, cy - 1, '#fff'); };
    const o = f ? 1 : 0;
    shard(5, 9 + o, 2.6, 6, d, l); shard(19, 8 - o, 2.6, 6, d, l); shard(7, 21 - o, 2.4, 5, d, l); shard(17, 22 + o, 2.4, 5, d, l);
    p.ell(12, 15, 6, 11, d); p.ell(12, 15, 5, 10, b); p.line(12, 4, 12, 26, l); p.ell(10, 10, 2.5, 5, l);
    p.disc(12, 15, 3, '#ffffff'); p.disc(12, 15, 1.6, '#9ad8ff'); p.p(12, 15, DK);
    for (const [x, y] of [[1, 3 + o], [22, 3 - o], [2, 28], [22, 27]]) p.p(x, y, '#ffffff');
  }),
  stormcloud: mk(32, 28, (p, b, f, d, l) => {
    const cl = tint(b, '#9a9ab8', 0.4), cd = shade(cl, 0.62), cs = tint(cl, '#ffffff', 0.35);
    for (const [x, y, r] of [[7, 11, 6], [24, 11, 6], [16, 7, 8], [11, 14, 6], [21, 14, 6]]) p.disc(x, y, r, cd);
    for (const [x, y, r] of [[7, 10, 5], [24, 10, 5], [16, 6, 7], [11, 13, 5], [21, 13, 5]]) p.disc(x, y, r, cl);
    p.disc(13, 5, 3, cs); p.disc(22, 8, 2, cs);
    p.r(10, 9, 3, 3, DK); p.r(19, 9, 3, 3, DK); p.p(11, 10, '#ffe36b'); p.p(20, 10, '#ffe36b'); p.r(12, 14, 8, 1, DK); p.r(10, 8, 4, 1, cd); p.r(18, 8, 4, 1, cd);
    const bx = f ? 16 : 14; p.line(bx, 19, bx - 3, 23, '#ffe36b'); p.line(bx - 3, 23, bx + 1, 24, '#ffe36b'); p.line(bx + 1, 24, bx - 2, 27, '#fff6b0'); p.p(bx - 2, 27, '#fff');
    for (const x of [5, 9, 24, 28]) p.r(x, 19 + ((x + f) % 3), 1, 3, '#7ab8ff');
  }),
  owl: mk(26, 30, (p, b, f, d, l) => {
    p.r(8, 24, 3, 5, '#c8a050'); p.r(14, 24, 3, 5, '#c8a050'); for (const x of [7, 9, 14, 16]) p.p(x, 29, '#e8e0c0');
    p.ell(13, 17, 9, 9, d); p.ell(13, 16, 8, 8, b); p.ell(13, 19, 5, 6, tint(b, '#ffffff', 0.5)); for (let y = 16; y < 24; y += 2) p.r(10, y, 7, 1, shade(b, 0.8));
    const w = f ? 1 : 0; p.ell(4, 17 + w, 3.2, 7, d); p.ell(22, 17 - w, 3.2, 7, d); p.ell(4, 17 + w, 2, 6, b); p.ell(22, 17 - w, 2, 6, b);
    p.ell(13, 8, 8, 7, d); p.ell(13, 8, 7, 6, b); p.r(6, 1, 3, 6, d); p.r(17, 1, 3, 6, d); p.p(6, 0, b); p.p(19, 0, b);
    p.disc(9, 9, 3.6, '#f4e8c8'); p.disc(17, 9, 3.6, '#f4e8c8'); p.disc(9, 9, 2.2, '#ffb830'); p.disc(17, 9, 2.2, '#ffb830'); p.p(9, 9, DK); p.p(17, 9, DK); p.p(8, 8, '#fff'); p.p(16, 8, '#fff');
    p.r(12, 11, 3, 3, '#e8a030'); p.r(13, 13, 1, 1, d);
    for (const [x, y] of [[1, 5 + f * 2], [24, 3]]) p.p(x, y, '#ffffff');
  }),
  comet: mk(36, 24, (p, b, f, d, l) => {
    const t1 = tint(b, '#4a6aff', 0.55), t2 = tint(b, '#9ad8ff', 0.4), t3 = '#e8f8ff';
    tri(p, [20, 12], [0, 3 + f * 2], [0, 21 - f * 2], shade(t1, 0.7)); tri(p, [20, 12], [4, 6 + f], [4, 18 - f], t1); tri(p, [20, 12], [10, 8], [10, 16], t2); tri(p, [20, 12], [15, 10], [15, 14], t3);
    for (const [x, y] of [[2, 12], [5, 9], [4, 15], [8, 12], [1, 6 + f], [2, 17 - f]]) p.p(x, y, '#ffffff'); for (let i = 0; i < 10; i++) p.p(3 + i, 12 + Math.round(Math.sin(i + f * 2) * 4), i % 2 ? t3 : t2);
    for (let a = 0; a < 8; a++) { const an = a * 0.7854 + f * 0.39, long = a % 2 === 0; p.line(25 + Math.round(Math.cos(an) * 6), 12 + Math.round(Math.sin(an) * 6), 25 + Math.round(Math.cos(an) * (long ? 11 : 8)), 12 + Math.round(Math.sin(an) * (long ? 11 : 8)), long ? '#ffffff' : t2); }
    p.disc(25, 12, 7, shade(b, 0.7)); p.disc(25, 12, 6, b); p.disc(24, 10, 4, l); p.disc(23, 9, 2, '#ffffff');
    p.r(24, 12, 3, 2, DK); p.r(29, 12, 3, 2, DK); p.p(24, 12, '#ffe36b'); p.p(29, 12, '#ffe36b'); p.r(25, 16, 5, 1, DK); p.p(26, 17, WH); p.p(28, 17, WH);
  }),
  seraph: mk(64, 64, (p, b, f, d, l) => {
    for (const dir of [-1, 1]) { const X = (x) => 32 + dir * x, up = f ? 0 : 7;
      tri(p, [X(8), 26], [X(30), 3 + up], [X(24), 28 + up], '#f4f0ff'); tri(p, [X(8), 26], [X(24), 28 + up], [X(10), 40], tint(b, '#ffffff', 0.4)); tri(p, [X(8), 26], [X(30), 3 + up], [X(16), 10], '#ffffff');
      tri(p, [X(10), 40], [X(24), 28 + up], [X(20), 46 + up * 0.5], d);
      for (let k = 0; k < 5; k++) p.line(X(8), 26 + k * 2, X(30 - k * 3), 5 + up + k * 6, k % 2 ? l : d); }
    p.ell(32, 40, 10, 17, '#efe8ff'); p.ell(32, 40, 8, 15, b); p.r(28, 28, 8, 28, tint(b, '#fff', 0.3)); for (let y = 30; y < 54; y += 4) p.r(26, y, 12, 1, d);
    p.ell(32, 12, 8, 8, '#f6ecd8'); p.ell(32, 10, 8, 5, '#ffe9a0'); p.p(29, 12, DK); p.p(35, 12, DK); p.r(30, 16, 4, 1, '#a04050');
    p.r(22, 2, 20, 2, '#ffe36b'); p.r(24, 0, 16, 2, '#fff6c0'); p.r(22, 3, 2, 3, '#ffe36b'); p.r(40, 3, 2, 3, '#ffe36b');
    p.r(22, 30, 3, 20, '#efe8ff'); p.r(39, 30, 3, 20, '#efe8ff'); p.disc(32, 38, 3.4, '#ffffff'); p.disc(32, 38, 1.8, f ? '#9ad8ff' : '#ffd36a');
    p.line(10, 22, 8, 50, '#ffe36b'); p.disc(10, 20, 3, '#ffffff'); p.p(10, 20, '#ffe36b');
    for (const [x, y] of [[4, 4 + f * 2], [60, 8 - f], [8, 54], [56, 50 + f]]) { p.p(x, y, '#ffffff'); p.p(x + 1, y, l); }
  }),
};
