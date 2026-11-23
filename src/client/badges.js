// The little class plate shown above every player: an emblem and the class name, fancier the rarer the class.
//   base class      — a plain shield on a dark plate
//   ascended        — a winged star on a silver-blue plate, showing the PATH name (Pyromancer, Brute …)
//   hidden class    — a faceted gem on a plate with a shimmer running round its border and drifting sparkles
//   mythic class    — a jewelled crown on a gold plate with a pulsing glow, a shimmering name and rising embers
// A title (a feat the player chose to show off) floats above it. Everything is drawn in whole art pixels and stays small.
import { C, q, cellAt, drawText, textWidth, shade, tint, sprite } from './px.js';
import { CLASSES, PATHS } from '../data.js';

const SHORT = { apostle: 'APOSTLE', void_sovereign: 'VOID SOVEREIGN', titan_forgemaster: 'FORGEMASTER', philosopher: 'PHILOSOPHER', gilded: 'GILDED SOVEREIGN' };
export const tierOf = (p) => (CLASSES[p.c]?.mythic ? 'mythic' : CLASSES[p.c]?.hidden ? 'hidden' : p.as && PATHS[p.as] ? 'ascended' : 'base');
export const labelOf = (p) => { const c = CLASSES[p.c]; if (!c) return ''; if (c.mythic) return SHORT[p.c] ?? c.name.toUpperCase(); if (!c.hidden && p.as && PATHS[p.as]) return PATHS[p.as].name.toUpperCase(); return c.name.toUpperCase(); };
export const TITLE_COL = { common: '#d8cdbd', rare: '#7fc8ff', epic: '#c890ff', legendary: '#ffd36a' };

const EMB = {
  base: ['lcccd', 'lcccd', 'lcccd', '.ccd.', '..d..'],
  ascended: ['..s..', '.sls.', 'slcls', '.scds', '..s..'],
  hidden: ['.lll.', 'lwccd', 'lcccd', '.ccd.', '..d..'],
  mythic: ['g.g.g', 'ggggg', 'gcwcg', 'ddddd'],
};
const cache = new Map();
const emblem = (tier, col) => { const k = `${tier}${col}`; let s = cache.get(k); if (s) return s; const rows = EMB[tier], pal = { o: '#14101c', c: col, d: shade(col, 0.5), l: tint(col, '#ffffff', 0.45), w: '#ffffff', s: '#c8d8f0', g: '#ffd36a' };
  s = sprite(rows[0].length, rows.length, (p) => p.rows(0, 0, rows, tier === 'mythic' ? { ...pal, d: '#a07418' } : pal), { outline: null }); cache.set(k, s); return s; };

function plate(g, x, yBottom, w, h, border, bg, border2) { const X = q(x - w / 2), Y = q(yBottom - h); g.fillStyle = border; g.fillRect(X - C, Y - C, w + 2 * C, h + 2 * C); g.fillStyle = bg; g.fillRect(X, Y, w, h); if (border2) { g.fillStyle = border2; g.fillRect(X + C, Y + C, w - 2 * C, C); g.fillRect(X + C, Y + h - 2 * C, w - 2 * C, C); } return [X, Y]; }

// Draws the plate with its bottom edge at yBottom. Returns the y of its top so the title can sit above it.
export function drawBadge(g, p, X, yBottom, t) {
  const c = CLASSES[p.c]; if (!c) return yBottom; const tier = tierOf(p), text = labelOf(p), col = c.color ?? '#c8c8d8', em = emblem(tier, col), tw = textWidth(text, 1), ew = em.width * C, w = ew + tw + 4 * C, h = 5 * C + 2 * C;
  const wave = (Math.sin(t / 260) + 1) / 2;
  let border = '#4a3a5a', bg = '#1a1424', b2 = null, txt = '#d8cdbd';
  if (tier === 'ascended') { border = '#8aa8d0'; bg = '#141c30'; b2 = '#3a5280'; txt = '#d8ecff'; }
  else if (tier === 'hidden') { border = wave > 0.5 ? '#d9c2ff' : '#b04080'; bg = '#1c0f2a'; b2 = '#6a2a6a'; txt = '#f0d8ff'; }
  else if (tier === 'mythic') { border = wave > 0.5 ? '#fff0a0' : '#e0b24a'; bg = '#2a1c08'; b2 = '#a07418'; txt = '#ffe9a8'; }
  if (tier === 'mythic') { for (let i = 0; i < 3; i++) { const a = (t / 900 + i * 2.1) % 6.28; g.globalAlpha = 0.35 + 0.25 * wave; g.fillStyle = '#ffd36a'; g.fillRect(q(X - w / 2 - C - 3 * C + (Math.cos(a) + 1) * (w / 2 + 3 * C)), q(yBottom - h - 2 * C - (Math.sin(a * 1.3) + 1) * 3 * C), C, C); } g.globalAlpha = 1; }
  const [px, py] = plate(g, X, yBottom, w, h, border, bg, b2);
  g.imageSmoothingEnabled = false; g.drawImage(em, px + C, q(py + (h - em.height * C) / 2), ew, em.height * C);
  if (tier === 'mythic') { const sh = Math.floor(t / 140) % (text.length + 4); for (let i = 0; i < text.length; i++) drawText(g, text[i], px + ew + 2 * C + i * 4 * C, py + (h - 5 * C) / 2, Math.abs(i - sh) < 2 ? '#ffffff' : '#ffd36a', { outline: null }); }
  else drawText(g, text, px + ew + 2 * C, py + (h - 5 * C) / 2, txt, { outline: null });
  if (tier === 'hidden') { for (let i = 0; i < 3; i++) { const ph = ((t / 700 + i / 3) % 1), sx = px + ph * w, sy = py - ph * 6 - C; g.globalAlpha = 1 - ph; cellAt(g, sx, sy, i % 2 ? '#ffffff' : '#e0a0ff'); g.globalAlpha = 1; } const k = Math.floor((t / 90) % (2 * (w / C + 2))); const edge = k < w / C ? px + k * C : px + w - (k - w / C) * C; cellAt(g, edge, py - C, '#ffffff'); }
  if (tier === 'ascended') { cellAt(g, px - C * 2, py + h / 2, '#c8d8f0'); cellAt(g, px + w + C, py + h / 2, '#c8d8f0'); }
  return py - C;
}
export function drawTitle(g, text, X, yBottom, color) { if (!text) return; drawText(g, text, X, yBottom - 5 * C, color, { scale: 1, align: 'center', outline: '#0c0814' }); }
