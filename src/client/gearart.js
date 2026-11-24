// Large, smooth artwork of every piece of gear — used where a piece is shown big (the upgrade minigame, the anvil, the result card).
// The 16×16 icons are fine at inventory size but turn into a handful of huge blocks when enlarged; these are drawn as shaded vector shapes at
// whatever resolution is asked for (metal gradients, bevels, leather wraps, gems), so they stay sharp at any size.
//
// Every piece is designed UPRIGHT in a 100×100 box (origin in the middle) and weapons are then tilted as a whole, so a head can never end up
// at a different angle than its handle.
import { ITEMS, archOf, ARCH } from '../data.js';
import { gearPalette } from './icons.js';
import { shrink } from './px.js';

const TAU = Math.PI * 2, OUT = '#14101c';
const cache = new Map();
const lin = (g, x0, y0, x1, y1, stops) => { const r = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) r.addColorStop(o, c); return r; };
const rad = (g, x, y, r0, r1, stops) => { const r = g.createRadialGradient(x, y, r0, x, y, r1); for (const [o, c] of stops) r.addColorStop(o, c); return r; };
const metalH = (m) => [[0, m[2]], [0.25, m[0]], [0.48, m[1]], [0.72, m[0]], [1, m[2]]];          // a cylinder lit from the left
const wood = [[0, '#5a3a20'], [0.3, '#8f633a'], [0.5, '#b98650'], [0.8, '#8f633a'], [1, '#4a2e18']];
const GOLD = [[0, '#8a5a10'], [0.3, '#e0b24a'], [0.5, '#fff0a8'], [0.8, '#d0a038'], [1, '#7a4c08']];
function path(g, pts, close = true) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); }
function shape(g, pts, fill, line = OUT, lw = 1.6) { path(g, pts); g.fillStyle = fill; g.fill(); if (line) { g.lineWidth = lw; g.strokeStyle = line; g.lineJoin = 'round'; g.stroke(); } }
function rrect(g, x, y, w, h, r, fill, line = OUT, lw = 1.6) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (line) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); } }
function disc(g, x, y, r, fill, line = OUT, lw = 1.6) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); if (line) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); } }
const shine = (g, x, y, w, h, a = 0.5) => { g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) / 2); g.fill(); };
const gem = (g, x, y, r, col) => { const f = rad(g, x - r * 0.3, y - r * 0.3, 0.5, r * 1.3, [[0, '#ffffff'], [0.35, col], [1, col]]); disc(g, x, y, r, f); disc(g, x - r * 0.3, y - r * 0.3, r * 0.22, 'rgba(255,255,255,.9)', null); };
const grip = (g, x, y0, y1, w) => { rrect(g, x - w / 2, y0, w, y1 - y0, w / 2, lin(g, x - w / 2, 0, x + w / 2, 0, [[0, '#2a1810'], [0.4, '#6a4528'], [0.6, '#7a5030'], [1, '#2a1810']])); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; for (let y = y0 + 3; y < y1 - 1; y += 4) { g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y + 2); g.stroke(); } };
const pole = (g, x, y0, y1, w) => { rrect(g, x - w / 2, y0, w, y1 - y0, w / 2, lin(g, x - w / 2, 0, x + w / 2, 0, wood)); };
const band = (g, x, y, w, h = 3.4) => rrect(g, x - w / 2, y, w, h, 1, lin(g, 0, y, 0, y + h, GOLD), '#5a3a08', 1);

// ── weapons (upright; blade/head up) ──────────────────────────────────────────────────────────────────────────────────────────────────────
const W = {
  sword(g, m) {
    shape(g, [[0, -52], [8.5, -38], [8.5, 8], [-8.5, 8], [-8.5, -38]], lin(g, -8.5, 0, 8.5, 0, metalH(m)));
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-1.6, -40, 3.2, 46); shine(g, -6, -38, 2.2, 40, 0.55); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -52); g.lineTo(0, -40); g.stroke();
    shape(g, [[-24, 8], [24, 8], [27, 14], [-27, 14]], lin(g, 0, 8, 0, 14, GOLD), '#5a3a08', 1.4); disc(g, -26, 11, 3, '#e0b24a', '#5a3a08', 1); disc(g, 26, 11, 3, '#e0b24a', '#5a3a08', 1);
    grip(g, 0, 14, 38, 7); disc(g, 0, 42, 5.5, rad(g, -1.5, 40, 0.5, 7, [[0, '#fff0a8'], [1, '#b8862a']]), '#5a3a08', 1.4); gem(g, 0, 11, 2.6, '#ff5a6a');
  },
  spear(g, m) {
    pole(g, 0, -14, 52, 5); band(g, 0, -16, 9); band(g, 0, 30, 7, 2.6);
    g.fillStyle = '#b02a30'; path(g, [[-1.5, -12], [-11, -4], [-6, 8], [-1.5, 2]]); g.fill(); path(g, [[1.5, -12], [11, -4], [6, 8], [1.5, 2]]); g.fill();                  // pennant ribbons
    path(g, [[0, -54], [3, -46], [10, -34], [11, -24], [5, -16], [0, -14], [-5, -16], [-11, -24], [-10, -34], [-3, -46]]); g.fillStyle = lin(g, -11, 0, 11, 0, metalH(m)); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-1.2, -50, 2.4, 34); shine(g, -7, -38, 2, 18, 0.5);
  },
  mace(g, m) {
    pole(g, 0, -12, 50, 5.4); grip(g, 0, 24, 46, 7); band(g, 0, -14, 11); band(g, 0, 22, 10, 3);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; g.save(); g.translate(0, -32); g.rotate(a); shape(g, [[-4, -10], [0, -22], [4, -10]], lin(g, -4, 0, 4, 0, metalH(m)), OUT, 1.4); g.restore(); }
    disc(g, 0, -32, 14, rad(g, -5, -37, 1, 17, [[0, m[1]], [0.55, m[0]], [1, m[2]]])); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -32, 9, 0, TAU); g.stroke(); shine(g, -9, -40, 5, 3, 0.7);
  },
  hammer(g, m) {
    pole(g, 0, -16, 52, 6); grip(g, 0, 26, 48, 7.6); band(g, 0, 22, 11, 3);
    shape(g, [[-27, -46], [27, -46], [29, -41], [29, -19], [27, -14], [-27, -14], [-29, -19], [-29, -41]], lin(g, 0, -46, 0, -14, [[0, m[1]], [0.3, m[0]], [0.75, m[0]], [1, m[2]]]));
    rrect(g, -27, -35, 54, 9, 2, lin(g, 0, -35, 0, -26, GOLD), '#5a3a08', 1.2); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-5, -46, 10, 32); shine(g, -24, -44, 48, 2.6, 0.6);
    for (const x of [-22, 22]) { disc(g, x, -30.5, 2.2, rad(g, x - 0.6, -31.2, 0.3, 3, [[0, '#fff'], [1, m[2]]]), OUT, 0.9); }
    shape(g, [[-29, -41], [-37, -36], [-37, -24], [-29, -19]], lin(g, 0, -41, 0, -19, metalH(m)), OUT, 1.4);
    gem(g, 0, -30.5, 3.6, '#ff8a3a');
  },
  staff(g, m, c) {
    pole(g, 0, -20, 52, 5); grip(g, 0, 20, 46, 6.4); band(g, 0, 17, 9, 3);
    g.strokeStyle = lin(g, -12, 0, 12, 0, GOLD); g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-3, -20); g.bezierCurveTo(-18, -26, -17, -52, 0, -54); g.bezierCurveTo(17, -52, 18, -26, 3, -20); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 0.8; g.stroke(); band(g, 0, -22, 11, 3.4);
    const col = c ?? m[1]; g.fillStyle = rad(g, 0, -38, 2, 22, [[0, `${col}cc`], [1, `${col}00`]]); g.beginPath(); g.arc(0, -38, 22, 0, TAU); g.fill();
    disc(g, 0, -38, 9.5, rad(g, -3, -41, 0.5, 12, [[0, '#ffffff'], [0.3, col], [1, shadeHex(col, 0.45)]]), OUT, 1.4); shine(g, -5.5, -44, 4, 2.6, 0.8);
  },
  wand(g, m, c) {
    rrect(g, -2.6, -14, 5.2, 66, 2.6, lin(g, -2.6, 0, 2.6, 0, wood)); grip(g, 0, 22, 48, 6); band(g, 0, 18, 8, 3); band(g, 0, -16, 9, 3);
    const col = c ?? m[1]; g.fillStyle = rad(g, 0, -32, 1, 22, [[0, `${col}cc`], [1, `${col}00`]]); g.beginPath(); g.arc(0, -32, 22, 0, TAU); g.fill();
    shape(g, [[0, -54], [9, -38], [0, -22], [-9, -38]], lin(g, -9, -54, 9, -22, [[0, '#ffffff'], [0.3, col], [1, shadeHex(col, 0.45)]])); path(g, [[0, -54], [0, -22]], false); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.stroke(); path(g, [[-9, -38], [9, -38]], false); g.stroke();
    for (const [x, y] of [[-13, -46], [13, -30], [-12, -26]]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill(); }
  },
  rapier(g, m) {
    shape(g, [[0, -54], [3, -46], [3.6, 12], [-3.6, 12], [-3, -46]], lin(g, -3.6, 0, 3.6, 0, metalH(m))); shine(g, -2.2, -44, 1.2, 52, 0.7);
    g.strokeStyle = lin(g, -22, 0, 22, 0, GOLD); g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-24, 8); g.quadraticCurveTo(-18, 22, 0, 18); g.quadraticCurveTo(18, 22, 24, 8); g.stroke(); g.strokeStyle = OUT; g.lineWidth = 0.7; g.stroke();
    g.beginPath(); g.arc(0, 14, 11, Math.PI * 0.08, Math.PI * 0.92); g.strokeStyle = '#d0a038'; g.lineWidth = 2.4; g.stroke();
    shape(g, [[-6, 10], [6, 10], [6, 14], [-6, 14]], lin(g, 0, 10, 0, 14, GOLD), '#5a3a08', 1); grip(g, 0, 15, 38, 5.4); disc(g, 0, 42, 4.4, rad(g, -1, 40, 0.5, 6, [[0, '#fff0a8'], [1, '#b8862a']]), '#5a3a08', 1.2);
  },
  bow(g, m) {
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 8.6; g.beginPath(); g.moveTo(-8, -50); g.bezierCurveTo(-34, -26, -34, 26, -8, 50); g.stroke();
    g.strokeStyle = lin(g, -40, 0, -8, 0, [[0, '#5a3a20'], [0.5, '#b98650'], [1, '#8f633a']]); g.lineWidth = 6; g.beginPath(); g.moveTo(-8, -50); g.bezierCurveTo(-34, -26, -34, 26, -8, 50); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-10, -46); g.bezierCurveTo(-31, -24, -31, 24, -10, 46); g.stroke();
    rrect(g, -17, -9, 10, 18, 3, lin(g, 0, -9, 0, 9, [[0, '#6a4528'], [0.5, '#a07040'], [1, '#4a2e18']]), OUT, 1.2); band(g, -12, -11, 12, 2.6); band(g, -12, 8, 12, 2.6);
    g.strokeStyle = '#efe8d8'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, -50); g.lineTo(14, 0); g.lineTo(-8, 50); g.stroke();
    g.strokeStyle = '#8f633a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(14, 0); g.lineTo(-20, 0); g.stroke(); shape(g, [[-26, 0], [-18, -4.2], [-18, 4.2]], lin(g, -26, 0, -18, 0, metalH(m)), OUT, 1.1);
    g.fillStyle = '#c04040'; path(g, [[16, 0], [24, -4], [22, 0], [24, 4]]); g.fill();
  },
  pistol(g, m) {
    shape(g, [[-46, -10], [20, -10], [20, 2], [-46, 2]], lin(g, 0, -10, 0, 2, [[0, m[1]], [0.4, m[0]], [1, m[2]]])); rrect(g, -50, -12, 8, 16, 2, lin(g, 0, -12, 0, 4, metalH(m)), OUT, 1.3);
    shine(g, -44, -8, 62, 2.2, 0.6); disc(g, 6, -1, 13, rad(g, 3, -5, 1, 15, [[0, m[1]], [0.6, m[0]], [1, m[2]]])); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; disc(g, 6 + Math.cos(a) * 7.4, -1 + Math.sin(a) * 7.4, 2.2, '#14101c', null); }
    shape(g, [[18, -14], [30, -10], [34, 14], [40, 40], [24, 44], [16, 14]], lin(g, 16, 0, 40, 0, [[0, '#3a2412'], [0.4, '#8a5a34'], [1, '#4a2e18']])); disc(g, 28, 28, 2.2, '#e0b24a', OUT, 0.8);
    g.strokeStyle = m[2]; g.lineWidth = 2.2; g.beginPath(); g.arc(14, 12, 9, Math.PI * 0.1, Math.PI * 0.95); g.stroke(); shape(g, [[8, -16], [18, -14], [18, -8], [10, -8]], lin(g, 0, -16, 0, -8, metalH(m)), OUT, 1.1);
  },
};
const TILT = { sword: 1, spear: 1, mace: 1, hammer: 1, staff: 1, wand: 1, rapier: 1, bow: 0, pistol: 0 };

// ── worn pieces (upright, centred) ────────────────────────────────────────────────────────────────────────────────────────────────────────
const cloth = (g, c, x0 = -30, x1 = 30) => lin(g, x0, 0, x1, 0, [[0, shadeHex(c, 0.55)], [0.3, c], [0.5, tintHex(c, 0.28)], [0.75, c], [1, shadeHex(c, 0.5)]]);
const A = {
  head(g, m, c, style) {
    if (style === 'robe') { shape(g, [[0, -44], [22, -26], [30, 6], [34, 36], [16, 30], [10, 8], [-10, 8], [-16, 30], [-34, 36], [-30, 6], [-22, -26]], cloth(g, c)); shape(g, [[0, -12], [12, -2], [12, 18], [-12, 18], [-12, -2]], '#1c1428'); gem(g, 0, -34, 4, '#ffe36b'); g.fillStyle = '#ffe36b'; g.fillRect(-6, 2, 3, 3); g.fillRect(3, 2, 3, 3); }
    else if (style === 'coat') { shape(g, [[-30, 6], [-24, -22], [0, -34], [24, -22], [30, 6], [40, 12], [38, 22], [0, 18], [-38, 22], [-40, 12]], cloth(g, c)); path(g, [[-30, 6], [30, 6]], false); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke(); rrect(g, -3, -34, 6, 12, 2, lin(g, 0, 0, 0, 12, GOLD), '#5a3a08', 1); g.fillStyle = '#efe8d8'; path(g, [[8, -32], [20, -48], [14, -30]]); g.fill(); }
    else if (style === 'mail') { shape(g, [[-30, 4], [-26, -26], [0, -40], [26, -26], [30, 4], [34, 38], [20, 40], [14, 20], [-14, 20], [-20, 40], [-34, 38]], lin(g, -30, 0, 30, 0, metalH(m))); rrect(g, -4, -38, 8, 34, 3, lin(g, -4, 0, 4, 0, metalH(m)), OUT, 1.3); g.fillStyle = '#0c0814'; g.fillRect(-18, -8, 14, 5); g.fillRect(4, -8, 14, 5); for (let y = 24; y < 40; y += 4) for (let x = -30; x < 32; x += 6) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + ((y / 4) % 2) * 3, y, 3, 2); } }
    else { shape(g, [[-32, 38], [-34, -4], [-24, -34], [0, -44], [24, -34], [34, -4], [32, 38], [14, 40], [10, 22], [-10, 22], [-14, 40]], lin(g, -34, 0, 34, 0, metalH(m))); g.fillStyle = '#0c0814'; path(g, [[-24, -10], [24, -10], [22, 2], [-22, 2]]); g.fill(); g.strokeStyle = m[2]; g.lineWidth = 1.4; g.stroke(); rrect(g, -3, -44, 6, 30, 2, lin(g, 0, 0, 0, 30, [[0, m[1]], [1, m[2]]]), OUT, 1.2); shape(g, [[-2, -46], [2, -46], [14, -60], [0, -52], [-14, -60]], tintHex(m[1], 0.2), OUT, 1.2); shine(g, -26, -30, 6, 22, 0.35); }
  },
  chest(g, m, c, style) {
    if (style === 'robe') { shape(g, [[-18, -42], [18, -42], [26, -36], [48, -8], [40, 14], [28, 6], [30, 46], [-30, 46], [-28, 6], [-40, 14], [-48, -8], [-26, -36]], cloth(g, c, -48, 48)); shape(g, [[-6, -42], [6, -42], [8, 46], [-8, 46]], shadeHex(c, 0.6), null); rrect(g, -30, 14, 60, 6, 2, lin(g, 0, 14, 0, 20, GOLD), '#5a3a08', 1); gem(g, 0, 17, 3.4, '#ff6a8a'); g.strokeStyle = tintHex(c, 0.4); g.lineWidth = 1.6; for (const x of [-20, 20]) { g.beginPath(); g.moveTo(x, -30); g.quadraticCurveTo(x * 1.2, 10, x, 40); g.stroke(); } }
    else if (style === 'coat') { shape(g, [[-18, -42], [18, -42], [28, -36], [50, -10], [42, 12], [30, 4], [32, 46], [-32, 46], [-30, 4], [-42, 12], [-50, -10], [-28, -36]], cloth(g, c, -50, 50)); path(g, [[0, -42], [0, 46]], false); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke(); for (let y = -30; y < 36; y += 10) { disc(g, -5, y, 1.8, '#e0b24a', '#5a3a08', 0.8); disc(g, 5, y, 1.8, '#e0b24a', '#5a3a08', 0.8); } rrect(g, -32, 24, 64, 6, 2, '#3a2418', OUT, 1); rrect(g, -5, 22, 10, 10, 2, lin(g, 0, 22, 0, 32, GOLD), '#5a3a08', 1); }
    else if (style === 'mail') { shape(g, [[-20, -42], [20, -42], [32, -34], [52, -8], [42, 16], [32, 6], [34, 46], [-34, 46], [-32, 6], [-42, 16], [-52, -8], [-32, -34]], lin(g, -52, 0, 52, 0, metalH(m))); for (let y = -34; y < 46; y += 5) for (let x = -50; x < 52; x += 6) { g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + ((y / 5) % 2) * 3, y, 3.2, 2.2); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + ((y / 5) % 2) * 3, y + 2.2, 3.2, 1.2); } rrect(g, -34, 26, 68, 7, 2, '#3a2418', OUT, 1); rrect(g, -6, 24, 12, 11, 2, lin(g, 0, 24, 0, 35, GOLD), '#5a3a08', 1); path(g, [[-20, -42], [0, -26], [20, -42]], false); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); }
    else { shape(g, [[-22, -44], [22, -44], [34, -34], [54, -22], [48, 4], [34, 0], [36, 46], [-36, 46], [-34, 0], [-48, 4], [-54, -22], [-34, -34]], lin(g, -54, 0, 54, 0, metalH(m))); shape(g, [[-18, -28], [18, -28], [14, 10], [0, 24], [-14, 10]], lin(g, -18, -28, 18, 24, [[0, tintHex(m[1], 0.2)], [0.5, m[0]], [1, m[2]]]), OUT, 1.4); gem(g, 0, -4, 5, '#ff5a4a'); for (const sx of [-1, 1]) { shape(g, [[sx * 34, -34], [sx * 56, -26], [sx * 56, -8], [sx * 40, -6]], lin(g, 0, 0, sx * 56, 0, metalH(m)), OUT, 1.4); path(g, [[sx * 38, -26], [sx * 52, -22]], false); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.4; g.stroke(); } rrect(g, -36, 30, 72, 8, 2, lin(g, 0, 30, 0, 38, GOLD), '#5a3a08', 1.1); shine(g, -30, -40, 5, 60, 0.28); }
  },
  legs(g, m, c, style) {
    const f = style === 'plate' || style === 'mail' ? lin(g, -30, 0, 30, 0, metalH(m)) : cloth(g, c, -30, 30);
    shape(g, [[-28, -42], [28, -42], [30, -30], [4, 46], [-4, 46], [-30, -30]], '#00000000', null);
    shape(g, [[-30, -40], [30, -40], [32, 4], [26, 50], [4, 50], [2, -6], [-2, -6], [-4, 50], [-26, 50], [-32, 4]], f);
    rrect(g, -32, -44, 64, 10, 3, style === 'plate' || style === 'mail' ? lin(g, 0, -44, 0, -34, [[0, '#4a2e18'], [1, '#2a1810']]) : lin(g, 0, -44, 0, -34, [[0, '#3a2418'], [1, '#1c120c']]), OUT, 1.2); rrect(g, -6, -46, 12, 14, 2, lin(g, 0, -46, 0, -32, GOLD), '#5a3a08', 1);
    if (style === 'plate') for (const x of [-18, 18]) { shape(g, [[x - 11, -4], [x + 11, -4], [x + 9, 12], [x - 9, 12]], lin(g, x - 11, 0, x + 11, 0, metalH([m[1], m[1], m[0]])), OUT, 1.2); gem(g, x, 4, 2.6, '#ff5a4a'); }
    if (style === 'mail') for (let y = -30; y < 48; y += 6) for (const x of [-26, 8]) { g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + ((y / 6) % 2) * 3, y, 3.2, 2.2); }
    if (style === 'robe') { shape(g, [[-34, 18], [34, 18], [40, 50], [-40, 50]], cloth(g, c, -40, 40)); g.strokeStyle = tintHex(c, 0.4); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-34, 44); g.lineTo(34, 44); g.stroke(); }
    if (style === 'coat') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.4; for (const x of [-16, 16]) { g.beginPath(); g.moveTo(x, -26); g.lineTo(x * 1.1, 46); g.stroke(); } rrect(g, -30, 30, 26, 5, 2, '#3a2418', OUT, 0.9); rrect(g, 4, 30, 26, 5, 2, '#3a2418', OUT, 0.9); }
  },
  feet(g, m, c, style) {
    const f = style === 'plate' || style === 'mail' ? (x0) => lin(g, x0, 0, x0 + 30, 0, metalH(m)) : (x0) => cloth(g, c, x0, x0 + 30);
    for (const sx of [-1, 1]) { g.save(); g.translate(sx * 24, 0); g.scale(sx * 0.74, 0.92);
      shape(g, [[-11, -44], [11, -44], [12, 12], [30, 22], [34, 38], [-14, 38], [-14, 18]], f(-14)); rrect(g, -16, 36, 52, 9, 3, '#2a1c14', OUT, 1.2); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-8, -40, 4, 40);
      rrect(g, -12, -46, 24, 8, 3, style === 'robe' ? lin(g, 0, -46, 0, -38, GOLD) : lin(g, 0, -46, 0, -38, [[0, '#6a4528'], [1, '#3a2418']]), OUT, 1.1);
      if (style === 'plate') { shape(g, [[-12, -8], [12, -8], [10, 8], [-10, 8]], lin(g, -12, 0, 12, 0, metalH([m[1], m[1], m[0]])), OUT, 1.1); for (let k = 0; k < 3; k++) rrect(g, 6 + k * 7, 20 - k * 2, 5, 10, 2, lin(g, 0, 0, 5, 0, metalH(m)), OUT, 0.8); }
      if (style === 'coat') { g.strokeStyle = '#e0b24a'; g.lineWidth = 1.6; for (const y of [-30, -22, -14]) { g.beginPath(); g.moveTo(-9, y); g.lineTo(9, y + 3); g.stroke(); } }
      if (style === 'mail') { for (let y = -36; y < 10; y += 6) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-8, y, 3.4, 2.4); g.fillRect(2, y + 3, 3.4, 2.4); } }
      if (style === 'robe') { g.fillStyle = '#fff'; g.beginPath(); g.arc(26, 24, 2.2, 0, TAU); g.fill(); } g.restore(); }
  },
  ring(g, m, c, style, ak) {
    const col = { signet: '#ff5a4a', wardring: '#5a9aff', sagering: '#c07aff', galering: '#5af0a0' }[ak] ?? '#ffe36b';
    g.lineWidth = 17; g.strokeStyle = OUT; g.beginPath(); g.arc(0, 14, 26, 0, TAU); g.stroke(); g.lineWidth = 13; g.strokeStyle = lin(g, -26, -10, 26, 40, [[0, m[1]], [0.45, m[0]], [1, m[2]]]); g.beginPath(); g.arc(0, 14, 26, 0, TAU); g.stroke(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(0, 14, 29, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    shape(g, [[-17, -22], [17, -22], [22, -8], [0, 10], [-22, -8]], lin(g, 0, -22, 0, 10, [[0, tintHex(m[1], 0.2)], [1, m[2]]]), OUT, 1.6); gem(g, 0, -10, 12, col);
    for (const sx of [-1, 1]) for (const k of [0, 1]) disc(g, sx * 21, -14 + k * 8, 2.2, tintHex(m[1], 0.3), OUT, 0.8);
  },
  charm(g, m, c, style, ak) {
    if (ak === 'locket') { g.strokeStyle = lin(g, -40, 0, 40, 0, GOLD); g.lineWidth = 3; g.beginPath(); g.moveTo(-32, -46); g.quadraticCurveTo(-30, 8, 0, 6); g.quadraticCurveTo(30, 8, 32, -46); g.stroke(); disc(g, 0, 18, 22, rad(g, -6, 10, 2, 28, GOLD), '#5a3a08', 1.6); disc(g, 0, 18, 15, rad(g, -4, 14, 1, 17, [[0, '#ffffff'], [0.35, m[1]], [1, shadeHex(m[0], 0.5)]]), '#5a3a08', 1.2); rrect(g, -4, -8, 8, 7, 2, lin(g, 0, -8, 0, -1, GOLD), '#5a3a08', 1); shine(g, -9, 8, 6, 4, 0.8); }
    else if (ak === 'forgecharm') { shape(g, [[-34, -2], [34, -2], [38, 8], [26, 30], [-26, 30], [-38, 8]], lin(g, -38, 0, 38, 0, metalH(m))); shape(g, [[-22, -20], [22, -20], [28, -2], [-28, -2]], lin(g, 0, -20, 0, -2, [[0, m[1]], [1, m[0]]])); rrect(g, -8, -34, 16, 14, 3, lin(g, -8, 0, 8, 0, metalH(m)), OUT, 1.3); gem(g, 0, 12, 9, '#ff8a3a'); g.strokeStyle = lin(g, -40, 0, 40, 0, GOLD); g.lineWidth = 2.6; g.beginPath(); g.moveTo(-8, -34); g.quadraticCurveTo(-30, -52, -34, -2); g.moveTo(8, -34); g.quadraticCurveTo(30, -52, 34, -2); g.stroke(); }
    else { rrect(g, -42, -12, 84, 30, 10, lin(g, 0, -12, 0, 18, [[0, m[1]], [0.45, m[0]], [1, m[2]]]), OUT, 1.6); shine(g, -36, -8, 72, 4, 0.5); rrect(g, -16, -12, 32, 30, 5, lin(g, 0, -12, 0, 18, GOLD), '#5a3a08', 1.3); gem(g, 0, 3, 8, '#6aa8f0'); for (const x of [-30, 30]) for (const y of [-4, 10]) disc(g, x, y, 1.7, tintHex(m[1], 0.4), OUT, 0.6); }
  },
};
function shadeHex(h, k) { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16); return `rgb(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`; }
function tintHex(h, t) { const s = String(h); const n = s.startsWith('rgb') ? s.match(/\d+/g).map(Number) : [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]; return `rgb(${n.map((v) => Math.round(v + (255 - v) * t)).join(',')})`; }

// A piece of gear as a canvas, `px` pixels square. Optionally washed with a colour (heat, a glow, a dull shade): tint = colour, tintA = strength.
export function gearArt(id, px = 256, tint = null, tintA = 0, shadow = true) {
  const key = `${id}:${px}:${tint}:${tintA}:${shadow}`; let c = cache.get(key); if (c) return c;
  const it = ITEMS[id]; const ak = archOf(id) ?? '', style = ARCH[ak]?.style ?? ak; const pal = gearPalette(id), slot = it?.slot ?? 'weapon';
  c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.translate(px / 2, px / 2); const k = px / 112; g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round';
  // soft ground shadow
  if (shadow) { g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 52, 34, 5, 0, 0, TAU); g.fill(); }
  if (slot === 'weapon') {
    const wk = W[ak] ? ak : it?.wtype === 'slash' ? 'sword' : it?.wtype === 'pierce' ? 'spear' : it?.wtype === 'blunt' ? 'mace' : 'staff';
    g.save(); if (TILT[wk]) { g.rotate(Math.PI / 4); g.scale(1.0, 1.0); g.translate(0, 0); } W[wk](g, pal.m, pal.accent); g.restore();
  } else (A[slot] ?? A.charm)(g, pal.m, pal.cloth(style), style, ak);
  if (tint && tintA > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tintA; g.fillStyle = tint; g.fillRect(0, 0, px, px); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  cache.set(key, c); return c;
}

// ── PIXEL ART version ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The game is pixel art, so large gear is too: the shaded drawing above is averaged down onto a small grid (hard edges, no blur), its colours are
// banded into a handful of tones and it gets the same dark outline as every other sprite. The result is a `size`×`size` art-pixel sprite (default
// 48 — three times the detail of an inventory icon) that is shown at whole-number scales. Because it comes from the same drawing, a head is always
// at the same angle as its handle.
const pixCache = new Map();
export function gearPixel(id, size = 48, tint = null, tintA = 0) {
  const key = `${id}:${size}:${tint}:${tintA}`; let c = pixCache.get(key); if (c) return c;
  const big = gearArt(id, size * 4, null, 0, false), spr = shrink(big, size, size, 1);
  const g = spr.getContext('2d'), im = g.getImageData(0, 0, spr.width, spr.height), D = im.data, STEP = 32;
  for (let i = 0; i < D.length; i += 4) { if (!D[i + 3]) continue; if (D[i] < 40 && D[i + 1] < 36 && D[i + 2] < 50) continue; for (let k = 0; k < 3; k++) D[i + k] = Math.min(255, Math.round(D[i + k] / STEP) * STEP); }   // tone banding (the outline colour is kept)
  g.putImageData(im, 0, 0);
  if (tint && tintA > 0) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tintA; g.fillStyle = tint; g.fillRect(0, 0, spr.width, spr.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  pixCache.set(key, spr); return spr;
}
