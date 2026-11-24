// Pixel icons (16×16 art px) for items, skills, classes and UI. Replaces every emoji.
import { sprite, shade, tint } from './px.js';
import { ITEMS, SKILLS, BASICS, CLASSES, tierOf, archOf, ARCH } from '../data.js';
import { EXP_TIERS, EXP_POTIONS } from '../expansion.js';
import { basicOf } from '../loadout.js';

const cache = new Map();
const memo = (k, fn) => { let v = cache.get(k); if (!v) { v = fn(); cache.set(k, v); } return v; };
const TYPE = { slash: '#e8f0ff', pierce: '#ffe9a8', blunt: '#ffb870', arcane: '#b58cff' };
export const METAL = { iron: ['#9aa3ad', '#c8d0d8', '#6f7882'], steel: ['#b8cce8', '#e8f2ff', '#7a90b8'], shadow: ['#9a7ae0', '#d0baff', '#5a3ab0'], sun: ['#e0b24a', '#fff0a8', '#a07a1e'], moon: ['#cfe3f8', '#ffffff', '#7aa0d0'], cinder: ['#ff8a4a', '#ffd0a0', '#a04020'], aether: ['#6af0d0', '#d8fff0', '#2a9a88'] };
for (const t of EXP_TIERS) METAL[t.id] = t.metal;
const tier = (id) => { const td = tierOf(id); if (td) return td === 'hollow' ? 'shadow' : td; return tierByPrefix(id); };
const tierByPrefix = (id) => (id.startsWith('hollow_') ? 'shadow' : id.startsWith('steel_') || id === 'steel_plate' ? 'steel' : id.startsWith('sun_') ? 'sun' : id.startsWith('moon_') ? 'moon' : id.startsWith('cinder_') ? 'cinder' : id.startsWith('aether_') ? 'aether' : 'iron');
const wd = ['#8f633a', '#a67546', '#6a4528'];

const sword = (p, m) => { for (let x = 2; x <= 4; x++) p.p(x, 15 - x, x % 2 ? wd[0] : wd[1]); p.p(1, 14, '#e0b24a');   // pommel and grip
  for (let k = -2; k <= 2; k++) p.p(5 + k, 10 + k, Math.abs(k) === 2 ? '#a07a1e' : '#e0b24a');                                  // the cross-guard, square to the blade
  for (let x = 6; x <= 13; x++) { p.p(x, 15 - x, m[0]); if (x <= 12) { p.p(x, 14 - x, m[1]); p.p(x, 16 - x, m[2]); } } p.p(14, 1, '#ffffff'); };   // a 3-wide blade: light edge, body, dark edge
// Diagonal weapons. On a pixel grid only a ONE-pixel-wide diagonal (the line x+y = 15, the icon's own anti-diagonal) has a true centre line, so the
// handle is that single line (the outline makes it look 3 wide) and every head is built in the same rotated frame (u along the handle, v across it)
// around a centre ON that line - hx+hy = 16 - so the head is an exact mirror image either side of the handle and nothing is clipped by the canvas.
const diag = (p, cx, cy, u0, u1, halfW, col) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx - dy) / Math.SQRT2, v = (dx + dy) / Math.SQRT2, t = (u - u0) / (u1 - u0); if (t < 0 || t > 1) continue; const hw = typeof halfW === 'function' ? halfW(t) : halfW; if (Math.abs(v) <= hw) { const c = col(t, v / Math.max(0.01, hw), u); if (c) p.p(x, y, c); } } };
const shaft = (p, x1) => { for (let x = 1; x <= x1; x++) p.p(x, 15 - x, x % 2 ? wd[0] : wd[1]); p.p(0, 15, wd[2]); p.p(1, 14, wd[2]); };
const spear = (p, m) => { shaft(p, 8);
  diag(p, 9.5, 6.5, 0, 7.6, (t) => 2.9 * Math.min(1, (1 - t) * 2.2) * (t < 0.12 ? 0.6 : 1), (t, k) => (k < -0.35 ? m[1] : k > 0.35 ? m[2] : m[0]));
  diag(p, 9.5, 6.5, -1, 0.1, 1.9, () => '#e0b24a'); p.p(13, 2, '#ffffff'); };
const bow = (p, m) => { p.line(9, 1, 5, 4, wd[0]); p.line(5, 4, 4, 8, wd[0]); p.line(4, 8, 5, 12, wd[0]); p.line(5, 12, 9, 15, wd[0]); p.line(10, 1, 6, 4, wd[1]); p.line(6, 4, 5, 8, wd[1]); p.line(5, 8, 6, 12, wd[1]); p.line(6, 12, 10, 15, wd[1]); p.line(10, 1, 10, 15, '#e8e0d0'); p.line(3, 8, 14, 8, wd[2]); p.r(13, 7, 2, 3, m[0]); p.p(14, 8, '#ffffff'); p.r(2, 7, 2, 1, '#c8d0d8'); p.r(2, 9, 2, 1, '#c8d0d8'); p.p(9, 1, m[1]); p.p(9, 15, m[1]); };
const hammer = (p, m) => { shaft(p, 7);
  diag(p, 9.5, 6.5, -2.3, 2.3, 4.7, (t, k, u) => (u > 1.3 ? m[1] : u < -1.3 ? m[2] : k < -0.55 ? m[1] : k > 0.55 ? m[2] : m[0]));
  diag(p, 9.5, 6.5, -3.1, -2.3, 3.2, () => '#e0b24a'); p.p(11, 4, '#ffffff'); };
const wand = (p, m) => { shaft(p, 9);
  diag(p, 11.5, 4.5, -2.2, 3.4, (t) => 2.6 * Math.sin(Math.PI * (0.1 + t * 0.8)), (t, k, u) => (u > 1 ? m[1] : k < -0.45 ? m[1] : k > 0.45 ? m[2] : m[0])); p.p(12, 3, '#ffffff'); };
const rapier = (p, m) => { for (let x = 2; x <= 4; x++) p.p(x, 15 - x, x % 2 ? wd[0] : wd[1]); p.p(1, 14, '#e0b24a');
  for (let k = -2; k <= 2; k++) p.p(5 + k, 10 + k, '#e0b24a'); p.p(6, 10, m[2]); p.p(5, 11, m[2]); p.p(6, 9, m[2]); p.p(4, 10, m[2]);   // a swept hand guard
  for (let x = 6; x <= 14; x++) p.p(x, 15 - x, x % 2 ? m[0] : m[1]); p.p(15, 0, '#ffffff'); };
const pistol = (p, m) => { p.r(2, 5, 10, 3, m[0]); p.r(2, 5, 10, 1, m[1]); p.r(11, 4, 3, 5, m[2]); p.r(3, 8, 3, 6, wd[0]); p.r(3, 8, 1, 6, wd[1]); p.r(7, 8, 2, 3, m[2]); p.p(13, 4, '#ffffff'); p.r(6, 3, 2, 2, m[2]); };
const robe = (p, c) => { const d = shade(c, 0.6), l = tint(c, '#ffffff', 0.35); p.r(4, 2, 8, 3, d); p.r(5, 2, 6, 1, l); p.r(3, 5, 10, 9, c); p.r(3, 5, 10, 1, l); p.r(1, 5, 3, 8, c); p.r(12, 5, 3, 8, c); p.r(7, 5, 2, 9, d); p.r(2, 13, 12, 1, d); p.r(6, 8, 4, 1, '#e0b24a'); p.p(8, 3, '#ffffff'); };

// ── helmets, leggings, boots and rings ─────────────────────────────────────────────────────────────────────────────────────────────────────
const helmIcon = (p, c, style, m) => { const d = shade(c, 0.6), l = tint(c, '#ffffff', 0.35);
  if (style === 'robe') { p.r(4, 3, 8, 9, c); p.r(5, 2, 6, 1, c); p.r(6, 1, 4, 1, c); p.r(3, 8, 2, 6, c); p.r(11, 8, 2, 6, c); p.r(6, 6, 4, 5, '#1c1428'); p.r(5, 3, 3, 1, l); p.r(3, 13, 10, 1, d); p.p(7, 8, '#ffe36b'); p.p(9, 8, '#ffe36b'); p.p(8, 1, '#ffffff'); }
  else if (style === 'coat') { p.r(3, 5, 10, 5, c); p.r(4, 3, 8, 2, c); p.r(2, 9, 12, 2, d); p.r(3, 5, 10, 1, l); p.r(7, 2, 2, 1, '#e0b24a'); p.r(5, 6, 1, 3, d); p.r(10, 6, 1, 3, d); p.p(8, 3, '#ffffff'); }
  else if (style === 'mail') { p.r(3, 3, 10, 8, c); p.r(4, 2, 8, 1, c); p.r(3, 3, 10, 1, l); p.r(2, 9, 12, 4, d); p.r(3, 9, 10, 3, c); p.r(7, 3, 2, 6, d); p.r(4, 10, 1, 1, l); p.r(6, 11, 1, 1, l); p.r(9, 11, 1, 1, l); p.r(11, 10, 1, 1, l); p.p(6, 6, '#14101c'); p.p(9, 6, '#14101c'); }
  else { p.r(3, 2, 10, 12, c); p.r(4, 1, 8, 1, c); p.r(3, 2, 10, 1, l); p.r(3, 2, 1, 12, l); p.r(12, 2, 1, 12, d); p.r(4, 6, 8, 2, '#14101c'); p.r(4, 6, 8, 1, '#3a2a40'); p.r(7, 8, 2, 5, d); p.r(7, 1, 2, 4, m?.[1] ?? l); p.r(5, 12, 6, 2, d); p.p(5, 3, '#ffffff'); } };
const legsIcon = (p, c, style, m) => { const d = shade(c, 0.6), l = tint(c, '#ffffff', 0.3);
  p.r(3, 2, 10, 3, shade(c, 0.8)); p.r(3, 2, 10, 1, l); p.r(7, 5, 2, 9, '#14101c'); p.r(3, 5, 4, 9, c); p.r(9, 5, 4, 9, c); p.r(3, 5, 1, 9, l); p.r(9, 5, 1, 9, l); p.r(6, 5, 1, 9, d); p.r(12, 5, 1, 9, d); p.r(3, 13, 4, 1, d); p.r(9, 13, 4, 1, d); p.r(7, 2, 2, 2, '#e0b24a');
  if (style === 'mail') for (let y = 6; y < 13; y += 2) { p.p(4 + (y % 4 ? 1 : 0), y, l); p.p(10 + (y % 4 ? 1 : 0), y, l); }
  if (style === 'plate') { p.r(3, 7, 4, 2, m?.[1] ?? l); p.r(9, 7, 4, 2, m?.[1] ?? l); p.r(3, 9, 4, 1, d); p.r(9, 9, 4, 1, d); }
  if (style === 'robe') { p.r(2, 10, 12, 4, c); p.r(2, 10, 12, 1, l); p.r(2, 13, 12, 1, d); p.r(7, 5, 2, 9, d); p.r(7, 2, 2, 2, '#e0b24a'); } };
const bootsIcon = (p, c, style, m) => { const d = shade(c, 0.6), l = tint(c, '#ffffff', 0.3), sole = '#2a2024';
  const boot = (x, flip) => { p.r(x + 1, 2, 4, 9, c); p.r(x, 9, 6, 3, c); p.r(x + (flip ? -1 : 2), 11, 5, 2, c); p.r(x, 12, 7, 1, sole); p.r(x + 1, 2, 1, 9, l); p.r(x + 1, 3, 4, 1, d);
    if (style === 'plate') { p.r(x, 5, 6, 2, m?.[1] ?? l); p.r(x, 9, 6, 1, d); } if (style === 'mail') { p.p(x + 2, 5, l); p.p(x + 3, 7, l); } if (style === 'robe') { p.r(x + 1, 2, 4, 1, '#e0b24a'); p.p(x + 4, 11, '#ffffff'); } if (style === 'coat') { p.r(x + 1, 4, 4, 1, '#e0b24a'); p.r(x + 1, 6, 4, 1, d); } };
  boot(1, false); boot(9, false); };
const RINGGEM = { signet: '#ff5a4a', wardring: '#5a9aff', sagering: '#c07aff', galering: '#5af0a0' };
const ringIcon = (p, c, kind, m) => { const g = RINGGEM[kind] ?? '#ffe36b'; p.disc(8, 10, 5.5, shade(c, 0.55)); p.disc(8, 10, 4.5, c); p.disc(8, 10, 2.6, '#14101c'); p.r(5, 7, 3, 1, tint(c, '#ffffff', 0.6)); p.r(6, 3, 4, 4, shade(g, 0.5)); p.r(7, 2, 2, 5, g); p.r(6, 4, 4, 2, g); p.p(7, 3, tint(g, '#ffffff', 0.7)); p.p(8, 2, '#ffffff'); if (kind === 'signet') p.r(7, 4, 2, 1, '#ffd0c0'); void m; };
const oreIcon = (p, a, b, g) => { p.ell(8, 9, 6.5, 5.5, a); p.ell(7, 8, 4.5, 3.5, b); for (const [x, y] of [[4, 7], [9, 5], [10, 10], [6, 11]]) { p.r(x, y, 2, 2, g); p.p(x, y, '#ffffff'); } };
const ingotIcon = (p, a, l, d) => { p.r(2, 7, 12, 6, a); p.r(2, 7, 12, 2, l); p.r(2, 12, 12, 1, d); p.r(4, 5, 8, 2, a); p.p(5, 8, '#ffffff'); };
const mace = (p, m) => { shaft(p, 7); p.disc(10.5, 5.5, 3.3, m[0]); p.disc(9.5, 4.5, 1.8, m[1]); for (const [x, y] of [[7, 3], [12, 8], [9, 1], [14, 6], [13, 2]]) p.p(x, y, m[2]); p.p(9, 4, '#ffffff'); };
const staff = (p, c) => { shaft(p, 8); diag(p, 11.5, 4.5, -4.6, -3, 2.4, () => '#e0b24a'); p.disc(11.5, 4.5, 3.3, c); p.disc(10.5, 3.5, 1.5, tint(c, '#ffffff', 0.6)); p.p(10, 3, '#ffffff'); };
const coat = (p, c, kind) => { const d = shade(c, 0.6), l = tint(c, '#ffffff', 0.3); p.r(3, 3, 10, 11, c); p.r(3, 3, 10, 1, l); p.r(1, 3, 3, 7, c); p.r(12, 3, 3, 7, c); p.r(1, 3, 3, 1, l); p.r(12, 3, 3, 1, l); p.r(6, 2, 4, 3, shade(c, 0.5)); p.r(7, 3, 2, 8, d); p.r(3, 11, 10, 1, '#3a2a20'); p.p(8, 11, '#e0b24a');
  if (kind === 'mail') for (let y = 5; y < 11; y += 2) for (let x = 4; x < 12; x += 2) p.p(x + (y % 4 ? 1 : 0), y, l);
  if (kind === 'plate') { p.r(0, 2, 4, 3, l); p.r(12, 2, 4, 3, l); p.r(5, 5, 6, 5, l); p.r(7, 6, 2, 3, d); } };
const locket = (p, c) => { p.line(3, 1, 8, 8, '#c89a3a'); p.line(13, 1, 8, 8, '#c89a3a'); p.disc(8, 10, 4, '#c89a3a'); p.disc(8, 10, 3, c); p.disc(7, 9, 1.2, tint(c, '#ffffff', 0.7)); };
const band = (p, c) => { p.r(2, 5, 12, 6, c); p.r(2, 5, 12, 1, tint(c, '#ffffff', 0.4)); p.r(4, 7, 8, 2, '#17101a'); p.r(7, 5, 2, 6, '#e0b24a'); p.r(2, 10, 12, 1, shade(c, 0.6)); };
const bottle = (p, c, big = false) => { p.r(6, 1, 4, 3, '#8a6a4a'); p.r(7, 3, 2, 2, '#cfeeff'); p.ell(8, 10, big ? 5.5 : 4.5, 5, '#cfeeff'); p.ell(8, 11, big ? 4.5 : 3.5, 4, c); p.r(5, 9, 6, 1, tint(c, '#ffffff', 0.5)); p.p(5, 7, '#ffffff'); p.p(6, 7, '#ffffff'); };

const ITEM = {
  iron_ore: (p) => { p.ell(8, 9, 6, 5, '#85817e'); p.ell(7, 8, 4, 3, '#a8a4a0'); for (const [x, y] of [[4, 6], [9, 6], [10, 10], [6, 11]]) { p.r(x, y, 2, 2, '#e0a060'); p.p(x, y, '#ffe0a0'); } },
  coal: (p) => { for (const [x, y, r] of [[5, 10, 3.5], [11, 10, 3.5], [8, 6, 3.5]]) p.disc(x, y, r, '#1c1c22'); for (const [x, y] of [[4, 9], [10, 9], [7, 5]]) { p.p(x, y, '#5a5a66'); p.p(x + 1, y + 1, '#44444e'); } },
  hide: (p) => { p.ell(8, 8, 7, 5, '#8a5a38'); p.ell(7, 7, 5, 3, '#a8704a'); p.r(1, 11, 3, 3, '#8a5a38'); p.r(12, 11, 3, 3, '#8a5a38'); p.p(5, 6, '#5a3a22'); p.p(10, 9, '#5a3a22'); },
  herb: (p) => { for (const [x, h] of [[4, 9], [7, 12], [10, 10]]) { p.r(x, 14 - h, 1, h, '#2d6b34'); p.ell(x - 1, 14 - h, 2, 1.6, '#55a252'); p.ell(x + 2, 14 - h + 3, 2, 1.4, '#3a8040'); } p.p(12, 4, '#ffffff'); p.p(3, 3, '#f0d0ff'); },
  ink: (p) => { bottle(p, '#1c1830'); p.p(7, 8, '#6a5aa0'); },
  parchment: (p) => { p.r(3, 3, 10, 11, '#e8dcc0'); p.r(2, 2, 12, 2, '#d0c098'); p.r(2, 13, 12, 2, '#d0c098'); for (let i = 0; i < 4; i++) p.r(4, 6 + i * 2, 8 - (i % 2) * 2, 1, '#8a7a5a'); },
  sunsteel_ore: (p) => { p.ell(8, 9, 6.5, 5.5, '#9a8250'); p.ell(7, 8, 4.5, 3.5, '#c0a468'); for (const [x, y] of [[4, 7], [9, 5], [10, 10], [6, 11]]) { p.r(x, y, 2, 2, '#ffd04a'); p.p(x, y, '#fff6c0'); } },
  moonsilver_ore: (p) => oreIcon(p, '#7a90a8', '#b8d0e8', '#e8f6ff'), moonsilver_ingot: (p) => ingotIcon(p, '#b8d0e8', '#ffffff', '#5a7898'),
  cinder_ore: (p) => oreIcon(p, '#6a3a2a', '#a05a38', '#ff8a2e'), cinder_ingot: (p) => ingotIcon(p, '#d8602a', '#ffc08a', '#7a2a10'),
  aether_ore: (p) => oreIcon(p, '#2a6a60', '#4ab8a0', '#8affe8'), aether_ingot: (p) => ingotIcon(p, '#4ad8b8', '#d8fff0', '#1a6a58'),
  sunsteel_ingot: (p) => { p.r(2, 7, 12, 6, '#d8a040'); p.r(2, 7, 12, 2, '#ffe08a'); p.r(2, 12, 12, 1, '#8a5a1a'); p.r(4, 5, 8, 2, '#e8b858'); p.p(5, 8, '#ffffff'); },
  frostbloom: (p) => { p.r(7, 7, 2, 8, '#5a8aa0'); p.ell(4, 12, 3, 1.5, '#7ab0c8'); p.ell(12, 11, 3, 1.5, '#7ab0c8'); p.disc(8, 5, 3.6, '#a8d8ff'); p.disc(8, 5, 2.2, '#e8f8ff'); p.p(8, 5, '#ffffff'); },
  frost_elixir: (p) => bottle(p, '#7fd8ff', true),
  heartwood_seed: (p) => { p.ell(8, 9, 4.5, 5.5, '#6a4a2a'); p.ell(7, 8, 3, 3.5, '#8a6a3a'); p.r(7, 1, 2, 4, '#5fd06a'); p.p(9, 2, '#9af0b0'); p.p(6, 3, '#9af0b0'); p.p(6, 7, '#c8ffc0'); },
  titan_core: (p) => { p.disc(8, 8, 6, '#6f7882'); p.disc(8, 8, 5, '#ff7a2e'); p.disc(8, 8, 3, '#ffe36b'); p.disc(7, 7, 1, '#ffffff'); for (const [x, y] of [[2, 3], [13, 4], [3, 13], [13, 12]]) p.p(x, y, '#ffb84a'); },
  philosophers_stone: (p) => { p.disc(8, 8, 6, '#a07a1e'); p.disc(8, 8, 5, '#e0b24a'); p.disc(8, 8, 3, '#ffe36b'); p.p(6, 6, '#ffffff'); p.p(10, 10, '#ff9ad5'); p.p(5, 10, '#7fd8ff'); },
  torn_page: (p) => { p.r(3, 2, 10, 12, '#e8dcc0'); for (let i = 0; i < 5; i++) p.r(3 + i * 2, 13 + (i % 2), 2, 1, '#e8dcc0'); p.r(3, 2, 10, 1, '#fff6e0'); for (let i = 0; i < 4; i++) p.r(4, 5 + i * 2, 7, 1, '#8a7a5a'); p.p(11, 4, '#8c2f40'); p.p(12, 5, '#8c2f40'); },
  iron_ingot: (p) => { p.r(2, 7, 12, 6, '#9aa3ad'); p.r(4, 4, 8, 3, '#c8d0d8'); p.r(2, 7, 12, 1, '#e8f0f8'); p.r(2, 12, 12, 1, '#6f7882'); p.p(5, 5, '#ffffff'); },
  steel_ingot: (p) => { p.r(2, 7, 12, 6, '#b8cce8'); p.r(4, 4, 8, 3, '#e8f2ff'); p.r(2, 7, 12, 1, '#ffffff'); p.r(2, 12, 12, 1, '#7a90b8'); p.p(5, 5, '#ffffff'); },
  hollow_ingot: (p) => { p.r(2, 7, 12, 6, '#7a56d8'); p.r(4, 4, 8, 3, '#a984ff'); p.r(2, 7, 12, 1, '#d0baff'); p.r(2, 12, 12, 1, '#4a2a90'); p.p(5, 5, '#ffffff'); },
  leather: (p) => { p.r(2, 4, 12, 9, '#a8704a'); p.ell(2, 8, 2, 4.5, '#8a5a38'); p.ell(14, 8, 2, 4.5, '#c08a5a'); p.r(2, 4, 12, 1, '#c08a5a'); p.r(2, 12, 12, 1, '#6a4528'); p.r(6, 3, 1, 10, '#6a4528'); p.r(10, 3, 1, 10, '#6a4528'); },
  starmetal: (p) => { p.r(7, 0, 2, 16, '#e0d0ff'); p.r(0, 7, 16, 2, '#e0d0ff'); p.r(5, 5, 6, 6, '#a0b8ff'); p.r(6, 3, 4, 10, '#c8d4ff'); p.r(3, 6, 10, 4, '#c8d4ff'); p.r(7, 7, 2, 2, '#ffffff'); },
  hollow_ichor: (p) => { p.ell(8, 10, 4.5, 5, '#8c1f3a'); p.r(7, 2, 2, 4, '#8c1f3a'); p.r(6, 5, 4, 2, '#8c1f3a'); p.ell(7, 9, 2, 3, '#e0344a'); p.p(6, 8, '#ffb0c0'); },
  hollow_ore: (p) => { p.r(3, 13, 10, 2, '#2e2948'); for (const [x, b, h, w] of [[5, 13, 9, 4], [10, 13, 11, 5], [8, 14, 6, 3]]) for (let y = 0; y < h; y++) p.r(x - Math.floor(w / 2), b - y, Math.max(1, w - Math.floor(y / 3)), 1, y % 3 ? '#7a56d8' : '#a984ff'); p.p(10, 3, '#ffffff'); },
  ghostbloom: (p) => { p.r(7, 8, 2, 7, '#5a8a9a'); p.ell(4, 12, 3, 1.5, '#7ab0c0'); p.ell(12, 11, 3, 1.5, '#7ab0c0'); p.disc(8, 5, 4, '#c8b0ff'); p.disc(8, 5, 2.6, '#f0e8ff'); p.disc(8, 5, 1, '#a984ff'); },
  echo_shard: (p) => { for (let y = 0; y < 14; y++) { const w = Math.max(1, 6 - Math.abs(y - 6)); p.r(8 - Math.floor(w / 2), 1 + y, w, 1, y % 3 ? '#4a90e0' : '#7ac0ff'); } p.p(7, 4, '#ffffff'); p.p(8, 3, '#d0f0ff'); },
  hollow_key: (p) => { p.disc(4, 4, 3, '#e0b24a'); p.disc(4, 4, 1.2, '#17101a'); p.r(6, 5, 8, 2, '#e0b24a'); p.r(6, 5, 8, 1, '#ffe36b'); p.r(11, 7, 2, 3, '#e0b24a'); p.r(8, 7, 2, 2, '#e0b24a'); p.p(3, 3, '#fff6c0'); },
  heal_potion: (p) => bottle(p, '#e0344a'), calm_tonic: (p) => bottle(p, '#3ac0b0'), light_vial: (p) => bottle(p, '#ffe36b'),
  ghost_elixir: (p) => bottle(p, '#c8f0ff', true), clarity_draught: (p) => bottle(p, '#9a6af0', true),
  lantern_salve: (p) => { p.r(3, 7, 10, 7, '#8a6a4a'); p.r(3, 7, 10, 1, '#b0905a'); p.r(2, 5, 12, 2, '#6a4528'); p.r(7, 1, 2, 4, '#ffcf4a'); p.p(7, 0, '#ffe36b'); p.p(8, 1, '#ff9a2e'); p.r(5, 9, 6, 3, '#ffe36b'); p.p(6, 9, '#fff6c0'); },
};
// colour of a worn piece: cloth, leather or metal depending on the style and the metal tier
export const styleColor = (t, style) => style === 'robe' ? ({ shadow: '#6a3ab0', steel: '#4a6ab8', sun: '#d8b040', moon: '#8ab0e0', cinder: '#c0502a', aether: '#3ac0a8' }[t] ?? METAL[t]?.[0] ?? '#5a4a9a')
  : t === 'shadow' ? '#5a3a9a' : t === 'steel' ? '#8aa0c8' : METAL[t] && EXP_TIERS.some((x) => x.id === t) ? METAL[t][0] : style === 'mail' || style === 'plate' ? (METAL[t]?.[0] ?? '#7a8a98') : '#8a5a38';
export function gearIcon(id) {
  const it = ITEMS[id], t = tier(id), m = METAL[t] ?? METAL.iron, ak = archOf(id), A = ARCH[ak] ?? {};
  const wk = ak ?? (id.includes('bow') ? 'bow' : it.wtype === 'slash' ? 'sword' : it.wtype === 'pierce' ? 'spear' : it.wtype === 'blunt' ? 'mace' : 'staff');
  if (it.slot === 'weapon') {
    const stf = t === 'shadow' ? '#a984ff' : t === 'sun' ? '#ffd36a' : t === 'moon' ? '#bfe0ff' : t === 'cinder' ? '#ff8a4a' : t === 'aether' ? '#6af0d0' : m[1];
    return ({ bow: (p) => bow(p, m), hammer: (p) => hammer(p, m), wand: (p) => wand(p, m), rapier: (p) => rapier(p, m), pistol: (p) => pistol(p, m), sword: (p) => sword(p, m), spear: (p) => spear(p, m), mace: (p) => mace(p, m), staff: (p) => staff(p, stf) }[wk] ?? ((p) => sword(p, m)));
  }
  const style = A.style ?? (ak === 'robe' ? 'robe' : ak === 'coat' ? 'coat' : ak === 'mail' ? 'mail' : ak === 'plate' ? 'plate' : id.includes('robe') ? 'robe' : id.includes('plate') || id.includes('aegis') ? 'plate' : id.includes('mail') ? 'mail' : 'coat'), col = styleColor(t, style);
  if (it.slot === 'chest') return style === 'robe' ? (p) => robe(p, col) : (p) => coat(p, col, style === 'coat' ? 'leather' : style);
  if (it.slot === 'head') return (p) => helmIcon(p, col, style, m);
  if (it.slot === 'legs') return (p) => legsIcon(p, col, style, m);
  if (it.slot === 'feet') return (p) => bootsIcon(p, col, style, m);
  if (it.slot === 'ring') return (p) => ringIcon(p, m[0], ak, m);
  const cc = { shadow: '#a984ff', steel: '#6aa8f0', sun: '#ffd36a', moon: '#bfe0ff', cinder: '#ff8a4a', aether: '#6af0d0' }[t] ?? METAL[t]?.[1];
  return ak === 'forgecharm' ? (p) => { p.r(3, 9, 10, 4, m[0]); p.r(3, 9, 10, 1, m[1]); p.r(5, 6, 6, 3, m[2]); p.r(4, 13, 8, 1, m[2]); p.p(8, 4, '#ffffff'); p.p(8, 5, cc ?? '#ff9f6b'); } : ak === 'locket' ? (p) => locket(p, cc ?? '#4a90e0') : (p) => band(p, cc ?? '#6fc08b');
}
const tomeIcon = (p, sid) => { const c = CLASSES[SKILLS[sid].cls[0]]?.color ?? '#8a7ab0'; p.r(2, 2, 12, 12, shade(c, 0.55)); p.r(3, 3, 10, 10, c); p.r(2, 2, 12, 1, tint(c, '#ffffff', 0.5)); p.r(2, 2, 1, 12, shade(c, 0.4)); p.r(11, 3, 2, 10, '#e8dcc0'); p.r(5, 5, 4, 1, '#e0b24a'); p.r(5, 7, 4, 1, '#e0b24a'); p.r(5, 9, 3, 1, '#e0b24a'); p.p(6, 11, '#e0b24a'); };
for (const t of EXP_TIERS) { ITEM[t.ore] = (p) => oreIcon(p, t.ore3[0], t.ore3[1], t.ore3[2]); ITEM[t.ing] = (p) => ingotIcon(p, t.metal[0], t.metal[1], t.metal[2]); }
for (const p of EXP_POTIONS) ITEM[p.id] = (q) => bottle(q, p.color, !!p.pct && p.pct >= 0.45 || !!p.mpPct && p.mpPct >= 0.5);
export function itemIcon(id) {
  return memo(`i:${id}`, () => {
    const draw = (p) => { const it = ITEMS[id]; if (!it) return p.r(4, 4, 8, 8, '#888'); (ITEM[id] ?? (it.skill ? (q) => tomeIcon(q, it.skill) : it.k === 'gear' ? gearIcon(id) : (q) => bottle(q, '#888')))(p); };
    // every item sits in the middle of its square: measure what was drawn and shift it by whole art pixels so its bounding box is centred
    const raw = sprite(16, 16, draw, { outline: null }), d = raw.getContext('2d').getImageData(0, 0, 16, 16).data; let x0 = 16, x1 = -1, y0 = 16, y1 = -1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (d[(y * 16 + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return sprite(16, 16, () => {});
    const dx = Math.floor((16 - (x1 - x0 + 1)) / 2) - x0, dy = Math.floor((16 - (y1 - y0 + 1)) / 2) - y0;
    return sprite(16, 16, (p, g) => { g.drawImage(raw, dx, dy); });
  });
}

// ── skill icons: shape by kind, colour by damage type ───────────────────────

// ── script skills (advancements, hidden/mythic ranks): a big motif for the skill's theme + a little badge for its main mechanic ──────────────────
const MOTIF = {
  blade: (p, c) => { p.line(3, 13, 13, 3, '#e8f0ff'); p.line(4, 13, 14, 3, '#ffffff'); p.line(2, 12, 5, 15, c); p.line(1, 14, 3, 12, '#6a4528'); p.p(13, 2, '#fff'); },
  rune: (p, c) => { p.r(2, 2, 12, 12, shade(c, 0.5)); p.r(3, 3, 10, 10, '#17101a'); p.line(4, 4, 11, 11, c); p.line(11, 4, 4, 11, c); p.r(7, 2, 2, 12, tint(c, '#fff', 0.4)); p.r(2, 7, 12, 2, tint(c, '#fff', 0.4)); },
  rock: (p, c) => { p.r(3, 5, 10, 9, c); p.r(5, 3, 7, 3, c); p.r(3, 5, 10, 1, tint(c, '#fff', 0.35)); p.r(3, 12, 10, 2, shade(c, 0.55)); p.p(6, 8, shade(c, 0.6)); p.p(9, 10, shade(c, 0.6)); },
  shield: (p, c) => { p.r(3, 2, 10, 8, c); p.r(4, 10, 8, 2, c); p.r(6, 12, 4, 2, c); p.r(3, 2, 10, 1, tint(c, '#fff', 0.5)); p.r(7, 3, 2, 9, '#fff'); p.r(4, 6, 8, 2, '#fff'); },
  light: (p, c) => { p.disc(8, 8, 3.4, '#fff6c0'); p.disc(8, 8, 2, '#fff'); for (const [x, y] of [[8, 0], [8, 14], [0, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) p.r(x, y, 2, 2, c); },
  sun: (p, c) => { p.disc(8, 8, 4.5, c); p.disc(8, 8, 3, '#fff6c0'); for (const [x, y] of [[7, 0], [7, 14], [0, 7], [14, 7], [2, 2], [12, 2], [2, 12], [12, 12]]) p.r(x, y, 2, 2, c); },
  flame: (p, c) => { p.r(5, 7, 6, 7, c); p.r(6, 4, 4, 4, c); p.r(7, 2, 2, 3, c); p.r(6, 9, 4, 5, '#ffd36a'); p.r(7, 11, 2, 3, '#fff6c0'); p.r(4, 9, 1, 3, shade(c, 0.7)); p.r(11, 8, 1, 4, shade(c, 0.7)); },
  ember: (p, c) => { p.disc(8, 9, 4.5, c); p.disc(7, 8, 2.8, '#ffd36a'); p.disc(7, 8, 1.2, '#fff6c0'); for (const [x, y] of [[3, 3], [12, 2], [13, 6], [2, 7]]) p.p(x, y, '#ffb84a'); },
  soul: (p, c) => { p.r(4, 3, 8, 9, c); p.r(5, 2, 6, 1, c); for (const x of [4, 7, 10]) p.r(x, 12, 2, 2, c); p.r(4, 3, 8, 1, tint(c, '#fff', 0.5)); p.r(5, 6, 2, 3, '#0c0814'); p.r(9, 6, 2, 3, '#0c0814'); },
  petal: (p, c) => { for (const [x, y] of [[8, 2], [3, 6], [13, 6], [5, 12], [11, 12]]) p.disc(x, y + 1, 2.6, c); p.disc(8, 8, 2.2, '#fff0a0'); },
  thorn: (p, c) => { for (const x of [3, 7, 11]) { p.line(x, 14, x + 1, 2, c); p.line(x + 1, 14, x + 2, 2, shade(c, 0.7)); p.p(x + 1, 1, '#fff'); } },
  feather: (p, c) => { p.line(3, 14, 13, 2, '#fff'); for (let i = 0; i < 6; i++) { p.line(4 + i * 1.6, 13 - i * 1.8, 8 + i * 1.6, 12 - i * 1.8, c); p.line(4 + i * 1.6, 13 - i * 1.8, 1 + i * 1.6, 11 - i * 1.8, shade(c, 0.7)); } },
  bolt: (p, c) => { p.r(8, 1, 4, 3, c); p.r(6, 4, 4, 3, c); p.r(4, 7, 8, 2, c); p.r(6, 9, 3, 3, c); p.r(5, 12, 3, 3, c); p.p(10, 2, '#fff'); },
  wind: (p, c) => { for (const [y, w] of [[3, 10], [7, 12], [11, 9]]) { p.r(2, y, w, 2, c); p.r(2 + w, y - 1, 2, 1, c); p.r(2 + w + 1, y, 1, 3, c); } p.p(4, 3, '#fff'); },
  spirit: (p, c) => { p.disc(8, 8, 6, shade(c, 0.6)); p.disc(8, 8, 4.5, c); p.disc(8, 8, 2.2, '#fff'); },
  bomb: (p, c) => { p.disc(7, 10, 5, '#22202c'); p.disc(6, 9, 3, '#3a3844'); p.line(9, 5, 12, 2, '#c8a070'); p.r(12, 0, 3, 3, '#ffe36b'); p.p(13, 1, '#fff'); },
  gear: (p, c) => { p.disc(8, 8, 5.5, c); p.disc(8, 8, 2.5, '#17101a'); for (const [x, y] of [[7, 0], [7, 14], [0, 7], [14, 7], [2, 2], [12, 2], [2, 12], [12, 12]]) p.r(x, y, 2, 2, c); p.r(4, 4, 2, 1, tint(c, '#fff', 0.5)); },
  void: (p, c) => { p.disc(8, 8, 6.5, c); p.disc(8, 8, 4.8, '#0c0814'); p.disc(8, 8, 2.4, shade(c, 0.5)); p.p(5, 5, '#fff'); p.p(11, 11, tint(c, '#fff', 0.5)); },
  eye: (p, c) => { p.r(1, 6, 14, 5, '#f4eefc'); p.r(3, 4, 10, 9, '#f4eefc'); p.r(1, 6, 14, 1, c); p.disc(8, 8, 3.6, c); p.disc(8, 8, 1.8, '#0c0814'); p.p(7, 7, '#fff'); },
  coin: (p, c) => { p.disc(8, 8, 6, '#b8862a'); p.disc(8, 8, 5, c); p.disc(8, 8, 3.2, tint(c, '#fff', 0.45)); p.r(7, 5, 2, 6, '#b8862a'); p.p(5, 5, '#fff'); },
  crown: (p, c) => { p.r(2, 7, 12, 6, c); p.r(2, 4, 2, 4, c); p.r(7, 2, 2, 6, c); p.r(12, 4, 2, 4, c); p.r(2, 7, 12, 1, tint(c, '#fff', 0.5)); p.r(2, 12, 12, 2, '#b8862a'); p.p(8, 9, '#ff5a6a'); p.p(4, 9, '#6ad0ff'); p.p(12, 9, '#6adf8a'); },
  potion: (p, c) => { p.r(6, 1, 4, 4, '#e8f0ff'); p.r(5, 5, 6, 1, '#e8f0ff'); p.disc(8, 10, 5, c); p.disc(8, 10, 4, tint(c, '#fff', 0.15)); p.r(5, 9, 2, 3, 'rgba(255,255,255,.7)'); p.p(10, 12, shade(c, 0.6)); },
  gem: (p, c) => { p.r(5, 2, 6, 2, tint(c, '#fff', 0.5)); p.r(3, 4, 10, 3, c); p.r(4, 7, 8, 2, c); p.r(5, 9, 6, 2, shade(c, 0.8)); p.r(7, 11, 2, 2, shade(c, 0.6)); p.r(5, 4, 2, 3, tint(c, '#fff', 0.6)); },
  dice: (p, c) => { p.r(2, 2, 12, 12, '#fbf6ea'); p.r(2, 12, 12, 2, '#d8cfb8'); p.r(2, 2, 12, 1, '#fff'); for (const [x, y] of [[4, 4], [10, 4], [7, 7], [4, 10], [10, 10]]) p.r(x, y, 2, 2, '#1a1420'); p.r(2, 2, 1, 12, c); p.r(13, 2, 1, 12, c); },
  card: (p, c) => { p.r(3, 1, 10, 14, '#fbf6ea'); p.r(3, 1, 10, 1, '#fff'); p.r(3, 14, 10, 1, '#d8cfb8'); p.line(8, 4, 11, 8, c); p.line(11, 8, 8, 12, c); p.line(8, 12, 5, 8, c); p.line(5, 8, 8, 4, c); p.r(7, 6, 2, 4, c); p.r(4, 2, 2, 2, c); p.r(10, 12, 2, 2, c); },
  page: (p, c) => { p.r(3, 1, 10, 14, '#f4ecd0'); p.r(3, 1, 10, 1, '#fff'); p.r(3, 14, 10, 1, '#c8b890'); for (const y of [4, 6, 8, 10]) p.r(5, y, y === 10 ? 4 : 6, 1, c); p.r(11, 1, 2, 3, shade(c, 0.7)); },
  quill: (p, c) => { p.line(3, 14, 13, 2, c); p.line(4, 14, 14, 2, '#fff'); for (let i = 0; i < 5; i++) { p.line(5 + i * 1.8, 12 - i * 2, 9 + i * 1.8, 11 - i * 2, c); p.line(5 + i * 1.8, 12 - i * 2, 3 + i * 1.8, 9 - i * 2, shade(c, 0.7)); } p.r(2, 13, 2, 2, '#1a1420'); },
  ink: (p, c) => { p.r(6, 2, 4, 3, '#0c1418'); p.r(4, 5, 8, 8, '#0c1418'); p.r(5, 4, 6, 1, '#0c1418'); p.r(6, 13, 4, 1, '#0c1418'); p.r(4, 5, 8, 1, c); p.r(4, 6, 1, 6, c); p.r(6, 7, 2, 3, 'rgba(255,255,255,.5)'); },
  hammer: (p, c) => { p.line(3, 14, 10, 6, '#7a5a34'); p.line(4, 14, 11, 6, '#a07a4a'); p.r(7, 1, 8, 5, '#aab2bc'); p.r(7, 1, 8, 1, '#e8eef4'); p.r(7, 5, 8, 1, '#6f7882'); p.r(7, 3, 8, 1, c); },
  hourglass: (p, c) => { p.r(3, 1, 10, 2, '#6a5a3a'); p.r(3, 13, 10, 2, '#6a5a3a'); p.r(4, 3, 8, 2, 'rgba(255,255,255,.4)'); p.r(5, 5, 6, 2, 'rgba(255,255,255,.4)'); p.r(7, 7, 2, 2, c); p.r(5, 9, 6, 2, c); p.r(4, 11, 8, 2, c); },
  seed: (p, c) => { p.disc(8, 8, 4.2, c); p.disc(8, 10, 3, shade(c, 0.7)); p.line(8, 3, 8, 13, '#fff'); p.p(6, 6, '#fff'); p.line(8, 3, 11, 1, '#5fd06a'); p.p(12, 1, '#9af0b0'); },
  leaf: (p, c) => { p.r(4, 3, 8, 9, c); p.r(5, 2, 6, 1, c); p.r(6, 12, 4, 1, c); p.line(8, 2, 8, 14, '#fff'); p.line(8, 6, 5, 4, shade(c, 0.6)); p.line(8, 8, 11, 6, shade(c, 0.6)); p.r(4, 3, 8, 1, tint(c, '#fff', 0.4)); },
};
const BADGE = {
  orbit: (p, c) => { p.disc(2, 2, 2, c); p.p(2, 2, '#17101a'); p.p(4, 0, '#fff'); }, rings: (p, c) => { p.disc(2, 2, 2.5, c); p.disc(2, 2, 1.2, '#17101a'); }, beams: (p, c) => { p.line(0, 4, 4, 0, c); p.line(0, 2, 2, 0, c); p.line(2, 4, 4, 2, c); },
  rain: (p, c) => { for (const x of [0, 2, 4]) { p.p(x, 0 + (x % 4 ? 1 : 0), c); p.p(x, 2 + (x % 4 ? 1 : 0), c); p.p(x, 4, c); } }, lanes: (p, c) => { p.r(0, 0, 5, 1, c); p.r(0, 2, 5, 1, c); p.r(0, 4, 5, 1, c); },
  chain: (p, c) => { p.line(0, 4, 2, 0, c); p.line(2, 0, 3, 4, c); p.line(3, 4, 4, 0, c); }, vortex: (p, c) => { p.r(0, 0, 5, 1, c); p.r(4, 0, 1, 4, c); p.r(1, 4, 4, 1, c); p.r(1, 2, 1, 2, c); p.r(2, 2, 2, 1, c); },
  leap: (p, c) => { p.r(2, 0, 1, 5, c); p.p(1, 1, c); p.p(3, 1, c); p.p(0, 2, c); p.p(4, 2, c); }, blink: (p, c) => { p.p(0, 2, c); p.p(1, 2, c); p.p(3, 2, c); p.p(4, 2, c); p.p(2, 0, c); p.p(2, 4, c); },
  summon: (p, c) => { p.disc(2, 1, 1.2, c); p.r(1, 2, 3, 3, c); }, totem: (p, c) => { p.r(1, 0, 3, 5, c); p.r(0, 4, 5, 1, c); p.p(2, 1, '#17101a'); }, wall: (p, c) => { p.r(1, 0, 3, 5, c); p.r(2, 0, 1, 5, '#fff'); },
  bombs: (p, c) => { p.disc(2, 3, 2, c); p.p(3, 0, '#ffe36b'); }, zone: (p, c) => { p.r(0, 1, 5, 3, c); p.r(1, 0, 3, 5, c); p.r(1, 2, 3, 1, '#17101a'); }, nova: (p, c) => { p.r(2, 0, 1, 5, c); p.r(0, 2, 5, 1, c); p.p(1, 1, c); p.p(3, 3, c); p.p(3, 1, c); p.p(1, 3, c); },
  buff: (p, c) => { p.r(2, 0, 1, 1, c); p.r(1, 1, 3, 1, c); p.r(0, 2, 5, 1, c); p.r(2, 3, 1, 2, c); }, heal: (p, c) => { p.r(2, 0, 1, 5, '#5fe08a'); p.r(0, 2, 5, 1, '#5fe08a'); }, shots: (p, c) => { p.line(0, 2, 4, 2, c); p.p(3, 1, c); p.p(3, 3, c); },
  pull: (p, c) => { p.p(0, 0, c); p.p(1, 1, c); p.p(4, 0, c); p.p(3, 1, c); p.p(0, 4, c); p.p(1, 3, c); p.p(4, 4, c); p.p(3, 3, c); p.p(2, 2, '#fff'); }, mark: (p, c) => { p.r(2, 0, 1, 2, c); p.r(2, 3, 1, 2, c); p.r(0, 2, 2, 1, c); p.r(3, 2, 2, 1, c); },
  mine: (p, c) => { p.disc(2, 2, 2.4, c); p.p(2, 2, '#17101a'); p.p(2, 0, '#ffe36b'); }, seekers: (p, c) => { p.line(0, 4, 2, 2, c); p.line(2, 2, 4, 3, c); p.p(4, 3, '#fff'); p.p(0, 0, c); },
};
function scriptArt(p, sk) {
  const c = sk.col ?? '#ffd36a'; (MOTIF[sk.theme] ?? MOTIF.spirit)(p, c);
  const kinds = (sk.steps ?? []).filter((s) => BADGE[s.t]), main = kinds.slice().sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0] ?? kinds[0];
  if (main) { p.r(10, 10, 6, 6, '#17101a'); p.r(10, 10, 6, 1, shade(c, 0.5)); const q = { ...p, p: (x, y, col) => p.p(x + 10.5 | 0, y + 10.5 | 0, col), r: (x, y, w, h, col) => p.r(x + 10.5 | 0, y + 10.5 | 0, w, h, col), disc: (x, y, r, col) => p.disc(x + 10.5, y + 10.5, r, col), line: (a, b, cc, d, col) => p.line(a + 10.5 | 0, b + 10.5 | 0, cc + 10.5 | 0, d + 10.5 | 0, col) }; BADGE[main.t](q, tint(c, '#ffffff', 0.35)); }
}
function skillArt(p, sk) {
  if (sk.kind === 'script') return scriptArt(p, sk);
  const c = sk.col ?? TYPE[sk.type] ?? '#fff', d = shade(c, 0.6);
  switch (sk.kind) {
    case 'melee': { p.line(3, 13, 12, 4, '#c8d0d8'); p.line(4, 13, 13, 4, '#ffffff'); p.line(2, 14, 4, 12, '#6a4528'); const n = sk.arc > 150 ? 6 : 3; for (let i = 0; i < n; i++) { const a = -2.4 + i * 0.5; p.p(Math.round(8 + Math.cos(a) * 7), Math.round(8 + Math.sin(a) * 7), c); p.p(Math.round(8 + Math.cos(a) * 6), Math.round(8 + Math.sin(a) * 6), d); } if (sk.hits > 1) { p.line(2, 4, 6, 8, c); p.line(10, 12, 14, 14, c); } break; }
    case 'proj': { const n = Math.min(3, sk.count ?? 1); for (let i = 0; i < n; i++) { const y = 8 + (i - (n - 1) / 2) * 4; p.line(1, y, 12, y - (n > 1 ? (i - 1) * 2 : 0), d); p.disc(13, y - (n > 1 ? (i - 1) * 2 : 0), 2, c); p.p(12, y - 1 - (n > 1 ? (i - 1) * 2 : 0), '#ffffff'); } if (sk.pierce) p.line(3, 8, 15, 8, '#ffffff'); break; }
    case 'aoe': { p.disc(8, 8, 6.5, d); p.disc(8, 8, 5, '#17101a'); p.disc(8, 8, 3.5, c); p.disc(8, 8, 1.5, '#ffffff'); for (const [x, y] of [[8, 0], [8, 15], [0, 8], [15, 8], [2, 2], [13, 2], [2, 13], [13, 13]]) p.p(x, y, c); break; }
    case 'dash': { p.r(7, 5, 5, 6, '#7a5a3a'); p.r(6, 10, 8, 3, '#6a4528'); p.r(7, 5, 5, 1, '#a67546'); for (let i = 0; i < 3; i++) p.r(0 + i, 5 + i * 3, 5 - i, 1, c); break; }
    case 'guard': { p.r(3, 2, 10, 9, '#4a6ab8'); p.r(5, 11, 6, 2, '#4a6ab8'); p.r(7, 13, 2, 2, '#4a6ab8'); p.r(3, 2, 10, 1, '#8aa8f0'); p.r(7, 3, 2, 9, '#e0e8ff'); p.r(4, 6, 8, 2, '#e0e8ff'); break; }
    case 'heal': if (sk.shield) { p.disc(8, 8, 6.5, '#3a6ac0'); p.disc(8, 8, 5, '#7fb8ff'); p.disc(7, 7, 2.5, '#d0e8ff'); } else { p.r(6, 2, 4, 12, '#3ac060'); p.r(2, 6, 12, 4, '#3ac060'); p.r(7, 3, 2, 10, '#9af0b0'); p.r(3, 7, 10, 2, '#9af0b0'); } break;
    case 'taunt': { p.r(2, 3, 12, 8, '#e0b24a'); p.r(7, 11, 3, 3, '#e0b24a'); p.r(7, 4, 2, 4, '#17101a'); p.r(7, 9, 2, 1, '#17101a'); break; }
    case 'mark': { p.disc(8, 8, 6.5, '#e070b0'); p.disc(8, 8, 5, '#17101a'); p.disc(8, 8, 3, '#ff9ad5'); p.disc(8, 8, 1, '#ffffff'); p.r(7, 0, 2, 3, '#ff9ad5'); p.r(7, 13, 2, 3, '#ff9ad5'); p.r(0, 7, 3, 2, '#ff9ad5'); p.r(13, 7, 3, 2, '#ff9ad5'); break; }
    case 'buff': { p.r(5, 4, 6, 9, '#c8402f'); p.r(5, 4, 6, 1, '#ff7a6a'); p.r(7, 1, 2, 4, '#ffe36b'); p.r(3, 6, 2, 3, '#c8402f'); p.r(11, 6, 2, 3, '#c8402f'); for (const [x, y] of [[2, 3], [13, 3], [8, 0]]) p.p(x, y, c); break; }
    case 'trap': { p.r(2, 10, 12, 3, '#6f7882'); for (let i = 0; i < 5; i++) { p.r(2 + i * 3, 6, 1, 4, '#c8d0d8'); p.p(2 + i * 3, 5, '#ffffff'); } p.r(2, 13, 12, 1, '#3a3a44'); break; }
    case 'field': { p.disc(8, 9, 6.5, d); p.disc(8, 9, 5.2, '#17101a'); p.disc(8, 9, 3.6, c); for (const [x, y] of [[4, 4], [12, 5], [8, 2], [3, 10], [13, 11]]) { p.p(x, y, '#ffffff'); } break; }
    default: p.disc(8, 8, 5, c);
  }
  if (sk.g && GLYPH[sk.g]) { p.r(8, 8, 8, 8, '#17101a'); GLYPH[sk.g](p, 9, 9); }
}
const GLYPH = {
  flame: (p, x, y) => { p.r(x + 1, y + 3, 4, 3, '#ff7a2e'); p.r(x + 2, y + 1, 2, 3, '#ff7a2e'); p.p(x + 2, y + 4, '#ffe36b'); p.p(x + 3, y + 4, '#ffe36b'); },
  frost: (p, x, y) => { p.r(x + 2, y, 1, 6, '#bfe8ff'); p.r(x, y + 2, 6, 1, '#bfe8ff'); p.p(x + 1, y + 1, '#fff'); p.p(x + 4, y + 4, '#fff'); p.p(x + 4, y + 1, '#fff'); p.p(x + 1, y + 4, '#fff'); },
  leaf: (p, x, y) => { p.r(x + 1, y + 1, 4, 3, '#5fd06a'); p.r(x + 2, y + 4, 2, 1, '#5fd06a'); p.line(x, y + 5, x + 4, y + 1, '#2d6b34'); },
  bolt: (p, x, y) => { p.r(x + 3, y, 2, 2, '#ffe36b'); p.r(x + 2, y + 2, 2, 2, '#ffe36b'); p.r(x + 1, y + 4, 3, 1, '#ffe36b'); p.p(x + 1, y + 5, '#ffe36b'); },
  void: (p, x, y) => { p.disc(x + 3, y + 3, 3, '#a984ff'); p.disc(x + 3, y + 3, 1.7, '#0c0814'); },
  skull: (p, x, y) => { p.r(x + 1, y, 5, 4, '#e8e0d0'); p.r(x + 2, y + 4, 3, 2, '#e8e0d0'); p.p(x + 2, y + 2, '#0c0814'); p.p(x + 4, y + 2, '#0c0814'); },
  sun: (p, x, y) => { p.disc(x + 3, y + 3, 1.8, '#ffe36b'); for (const [dx, dy] of [[3, 0], [3, 6], [0, 3], [6, 3]]) p.p(x + dx, y + dy, '#ffe36b'); },
  coin: (p, x, y) => { p.disc(x + 3, y + 3, 3, '#e0b24a'); p.disc(x + 3, y + 3, 1.6, '#ffe36b'); },
  anvil: (p, x, y) => { p.r(x, y + 1, 7, 2, '#9aa3ad'); p.r(x + 2, y + 3, 3, 2, '#6f7882'); p.r(x + 1, y + 5, 5, 1, '#4a525c'); },
  drop: (p, x, y) => { p.r(x + 2, y, 2, 2, '#7fd8ff'); p.r(x + 1, y + 2, 4, 3, '#7fd8ff'); p.r(x + 2, y + 5, 2, 1, '#7fd8ff'); },
  star: (p, x, y) => { p.r(x + 3, y, 1, 7, '#ffe9a8'); p.r(x, y + 3, 7, 1, '#ffe9a8'); p.p(x + 2, y + 2, '#fff'); p.p(x + 4, y + 4, '#fff'); },
  eye: (p, x, y) => { p.r(x, y + 2, 7, 3, '#e8e0d0'); p.r(x + 2, y + 1, 3, 5, '#e8e0d0'); p.r(x + 3, y + 2, 1, 3, '#2a1a30'); },
  wind: (p, x, y) => { p.r(x, y + 1, 5, 1, '#d0f0ff'); p.r(x + 2, y + 3, 5, 1, '#d0f0ff'); p.r(x, y + 5, 4, 1, '#d0f0ff'); },
  shield: (p, x, y) => { p.r(x + 1, y, 5, 4, '#7fa8ff'); p.r(x + 2, y + 4, 3, 1, '#7fa8ff'); p.r(x + 3, y + 1, 1, 3, '#fff'); },
  fang: (p, x, y) => { p.r(x + 1, y, 2, 5, '#e8e0d0'); p.r(x + 4, y, 2, 5, '#e8e0d0'); p.p(x + 1, y + 5, '#e8e0d0'); p.p(x + 5, y + 5, '#e8e0d0'); },
};
export const skillIcon = (id) => memo(`s:${id}`, () => sprite(16, 16, (p) => skillArt(p, SKILLS[id])));
export const basicIcon = (me) => memo(`b:${me.classId}:${me.asc?.path ?? ''}`, () => sprite(16, 16, (p) => skillArt(p, { ...basicOf(me), arc: 100 })));

// ── class emblems ───────────────────────────────────────────────────────────
const CLS = {
  warrior: (p) => { sword(p, METAL.iron); p.r(9, 9, 5, 5, '#c8402f'); p.r(9, 9, 5, 1, '#ff7a6a'); p.r(10, 14, 3, 1, '#c8402f'); },
  mage: (p) => { staff(p, '#8ad8ff'); p.r(1, 12, 6, 2, '#3d4aa8'); p.r(2, 10, 4, 2, '#4a5ac0'); p.r(3, 8, 2, 2, '#4a5ac0'); },
  archer: (p) => { for (let y = 1; y < 15; y++) p.p(Math.round(4 + Math.sin((y - 1) / 14 * Math.PI) * 6), y, '#8a5a2b'); p.line(4, 1, 4, 14, '#e8e0d0'); p.line(5, 8, 15, 8, '#c8d0d8'); p.r(13, 6, 2, 4, '#c8d0d8'); p.p(15, 8, '#ffffff'); p.r(1, 7, 3, 2, '#6fc08b'); },
  blacksmith: (p) => { p.r(2, 9, 12, 3, '#9aa3ad'); p.r(2, 9, 12, 1, '#c8d0d8'); p.r(5, 12, 6, 3, '#6f7882'); p.line(2, 8, 10, 2, wd[0]); diag(p, 11.2, 2.2, -1.6, 1.6, 3.6, (t, k, u) => (u > 0.4 ? '#c8d0d8' : k > 0.5 ? '#6f7882' : '#8a909c')); },
  alchemist: (p) => { bottle(p, '#5fd06a', true); p.p(5, 3, '#c8ffc0'); p.p(10, 2, '#c8ffc0'); },
  merchant: (p) => { p.r(7, 2, 2, 11, '#e0b24a'); p.r(2, 4, 12, 1, '#e0b24a'); p.r(1, 5, 4, 1, '#c89a3a'); p.r(11, 5, 4, 1, '#c89a3a'); p.r(3, 6, 1, 3, '#c89a3a'); p.r(12, 6, 1, 3, '#c89a3a'); p.r(2, 9, 3, 1, '#e0b24a'); p.r(11, 9, 3, 1, '#e0b24a'); p.r(4, 13, 8, 2, '#8a5a1e'); },
  desperado: (p) => { p.r(2, 1, 12, 14, '#e8e0d0'); p.r(2, 1, 12, 1, '#ffffff'); p.disc(8, 7, 3.5, '#17101a'); p.r(7, 9, 2, 4, '#17101a'); p.r(3, 2, 2, 2, '#b04080'); p.r(11, 12, 2, 2, '#b04080'); },
  apostle: (p) => { p.r(7, 8, 2, 7, '#6a4528'); p.disc(8, 5, 5, '#2d6b34'); p.disc(7, 4, 3.5, '#55a252'); p.disc(6, 3, 1.5, '#9af0b0'); p.r(4, 14, 8, 1, '#6a4528'); p.p(2, 13, '#6a4528'); p.p(13, 13, '#6a4528'); },
  void_sovereign: (p) => { p.r(2, 9, 12, 4, '#3a2a6a'); for (const x of [2, 5, 8, 11]) p.r(x, 5, 2, 5, '#7a5aff'); p.p(3, 4, '#e0d0ff'); p.p(9, 4, '#e0d0ff'); p.p(6, 3, '#e0d0ff'); p.r(2, 9, 12, 1, '#a984ff'); p.r(7, 10, 2, 2, '#0c0814'); },
  titan_forgemaster: (p) => { p.r(7, 5, 2, 10, '#6a4528'); p.r(2, 1, 12, 5, '#8a909c'); p.r(2, 1, 12, 1, '#c8d0d8'); p.r(2, 5, 12, 1, '#4a525c'); p.p(4, 3, '#ff7a2e'); p.p(11, 3, '#ff7a2e'); },
  philosopher: (p) => { p.disc(8, 8, 6, '#a07a1e'); p.disc(8, 8, 5, '#e0b24a'); p.disc(8, 8, 3, '#ffe36b'); p.p(6, 6, '#ffffff'); p.p(10, 10, '#ff9ad5'); p.p(5, 10, '#7fd8ff'); },
  gilded: (p) => { p.r(2, 7, 12, 6, '#e0b24a'); for (const x of [2, 6, 10]) p.r(x, 3, 3, 5, '#ffe36b'); p.r(2, 7, 12, 1, '#fff6c0'); p.p(8, 10, '#c0392b'); p.p(4, 10, '#4a90e0'); p.p(12, 10, '#4a90e0'); },
  archivist: (p) => { p.r(1, 3, 14, 10, '#2f8a8a'); p.r(2, 4, 6, 8, '#e8f6f0'); p.r(8, 4, 6, 8, '#d8eee8'); p.r(7, 3, 2, 10, '#1a5a5a'); for (let i = 0; i < 3; i++) { p.r(3, 6 + i * 2, 4, 1, '#8aa8a0'); p.r(9, 6 + i * 2, 4, 1, '#8aa8a0'); } },
  soulsmith: (p) => { CLS.blacksmith(p); p.p(2, 2, '#ff9f6b'); p.p(13, 4, '#ffcf8a'); p.p(1, 5, '#ff9f6b'); },
  broker: (p) => { p.ell(8, 8, 7, 4.5, '#e8e8ff'); p.ell(8, 8, 5.5, 3.5, '#17101a'); p.disc(8, 8, 3, '#9a9ac8'); p.disc(8, 8, 1.4, '#ffffff'); p.p(7, 7, '#ffffff'); },
  transmuter: (p) => { bottle(p, '#c070f0', true); p.p(4, 3, '#e8c8ff'); p.p(11, 5, '#e8c8ff'); p.p(8, 1, '#ffffff'); },
};
export const classIcon = (id) => memo(`c:${id}`, () => sprite(16, 16, (p) => (CLS[id] ?? CLS.warrior)(p)));

// ── UI icons ────────────────────────────────────────────────────────────────
const UI = {
  lock: (p) => { p.r(4, 7, 8, 7, '#6a5a80'); p.r(4, 7, 8, 1, '#9a8ab8'); p.r(5, 3, 1, 5, '#9a8ab8'); p.r(10, 3, 1, 5, '#9a8ab8'); p.r(6, 2, 4, 1, '#9a8ab8'); p.p(8, 10, '#17101a'); p.p(8, 11, '#17101a'); },
  bag: (p) => { p.r(3, 5, 10, 9, '#8a5a38'); p.r(3, 5, 10, 1, '#c08a5a'); p.r(5, 2, 6, 3, '#6a4528'); p.r(6, 3, 4, 1, '#17101a'); p.r(7, 8, 2, 3, '#e0b24a'); p.r(3, 12, 10, 2, '#6a4528'); },
  book: (p) => { p.r(2, 2, 12, 12, '#7a2e3a'); p.r(2, 2, 12, 1, '#b0485a'); p.r(4, 3, 9, 10, '#e8dcc0'); p.r(2, 2, 2, 12, '#5a1a28'); for (let i = 0; i < 4; i++) p.r(5, 5 + i * 2, 6, 1, '#8a7a5a'); },
  people: (p) => { p.disc(5, 5, 2.5, '#f0c8a0'); p.r(2, 8, 7, 6, '#6f8ad8'); p.disc(11, 6, 2.5, '#e0b088'); p.r(8, 9, 7, 5, '#c8402f'); },
  help: (p) => { p.disc(8, 8, 7, '#4a6ab8'); p.disc(8, 8, 5.5, '#6f8ad8'); p.r(6, 4, 4, 2, '#ffffff'); p.r(9, 5, 2, 3, '#ffffff'); p.r(7, 7, 2, 2, '#ffffff'); p.r(7, 10, 2, 2, '#ffffff'); },
  power: (p) => { p.disc(8, 9, 5.5, '#c8402f'); p.disc(8, 9, 3.7, '#17101a'); p.r(7, 1, 2, 7, '#ffffff'); },
  coin: (p) => { p.disc(8, 8, 6.5, '#c89a3a'); p.disc(8, 8, 5.2, '#ffe36b'); p.r(7, 4, 2, 8, '#c89a3a'); p.p(5, 5, '#fff6c0'); },
  heart: (p) => { p.disc(5, 6, 3.2, '#e0344a'); p.disc(11, 6, 3.2, '#e0344a'); for (let y = 8; y < 15; y++) p.r(2 + Math.max(0, y - 8), y, 12 - Math.max(0, y - 8) * 2, 1, '#e0344a'); p.p(4, 4, '#ffb0c0'); },
  mana: (p) => { p.ell(8, 10, 4.5, 5, '#3a6ac0'); p.r(7, 2, 2, 4, '#3a6ac0'); p.r(6, 5, 4, 2, '#3a6ac0'); p.p(6, 8, '#9ac0ff'); },
  skull: (p) => { p.ell(8, 7, 6, 5.5, '#e8e0c8'); p.r(5, 11, 6, 4, '#e8e0c8'); p.r(4, 6, 3, 3, '#17101a'); p.r(9, 6, 3, 3, '#17101a'); p.r(7, 9, 2, 2, '#17101a'); p.r(6, 13, 1, 2, '#17101a'); p.r(9, 13, 1, 2, '#17101a'); },
  customer: (p) => { p.r(3, 4, 10, 10, '#b0782e'); p.r(5, 2, 6, 3, '#8a5a1e'); p.r(6, 3, 4, 1, '#17101a'); p.disc(8, 9, 2.5, '#ffe36b'); p.p(7, 8, '#fff6c0'); },
  chest: (p) => { p.r(1, 6, 14, 8, '#8f633a'); p.r(1, 3, 14, 4, '#a67546'); p.r(1, 8, 14, 1, '#5a5a66'); p.r(7, 6, 2, 4, '#e0b24a'); },
  gate: (p) => { p.r(1, 1, 14, 14, '#5d5f68'); p.r(3, 3, 10, 12, '#0e0a1c'); for (const [x, y] of [[5, 6], [9, 9], [7, 12], [11, 5]]) p.p(x, y, '#a984ff'); },
  scroll: (p) => ITEM.parchment(p),
  forge: (p) => { p.r(2, 9, 12, 3, '#9aa3ad'); p.r(2, 9, 12, 1, '#c8d0d8'); p.r(5, 12, 6, 3, '#6f7882'); },
  cauldron: (p) => { p.ell(8, 10, 7, 5, '#2a2a34'); p.ell(8, 7, 5, 2, '#5fd06a'); p.r(2, 5, 12, 2, '#555566'); },
  stall: (p) => { for (let i = 0; i < 4; i++) p.r(i * 4, 2, 4, 5, i % 2 ? '#e8e0d0' : '#c0392b'); p.r(0, 7, 16, 7, '#8f633a'); },
  sparkle: (p) => { p.r(7, 1, 2, 14, '#e0d0ff'); p.r(1, 7, 14, 2, '#e0d0ff'); p.r(6, 6, 4, 4, '#ffffff'); },
  star: (p) => { p.r(7, 1, 2, 14, '#ffe36b'); p.r(1, 7, 14, 2, '#ffe36b'); p.r(5, 5, 6, 6, '#fff6c0'); },
  arrow_up: (p) => { p.r(7, 3, 2, 11, '#6fc08b'); p.r(5, 5, 6, 1, '#6fc08b'); p.r(4, 7, 8, 1, '#6fc08b'); p.r(3, 9, 10, 1, '#6fc08b'); },
  arrow_down: (p) => { p.r(7, 2, 2, 11, '#e0645a'); p.r(5, 10, 6, 1, '#e0645a'); p.r(4, 8, 8, 1, '#e0645a'); p.r(3, 6, 10, 1, '#e0645a'); },
  swords: (p) => { sword(p, METAL.iron); p.line(13, 13, 4, 4, '#c8d0d8'); },
  hammer: (p) => { p.line(3, 14, 11, 6, wd[0]); p.r(8, 1, 7, 5, '#8a909c'); p.r(8, 1, 7, 1, '#c8d0d8'); },
  flask: (p) => bottle(p, '#5fd06a', true),
  anvil: (p) => { p.r(2, 5, 12, 3, '#9aa3ad'); p.r(0, 6, 3, 2, '#9aa3ad'); p.r(5, 8, 6, 4, '#6f7882'); p.r(3, 12, 10, 2, '#4a525c'); },
  scales: (p) => CLS.merchant(p),
  eye: (p) => CLS.broker(p),
  key: (p) => ITEM.hollow_key(p),
  dpad_u: (p) => { for (let i = 0; i < 6; i++) p.r(8 - i, 4 + i * 1.5 | 0, 1 + i * 2, 2, '#e8e0d0'); },
  dpad_d: (p) => { for (let i = 0; i < 6; i++) p.r(8 - i, 12 - (i * 1.5 | 0), 1 + i * 2, 2, '#e8e0d0'); },
  dpad_l: (p) => { for (let i = 0; i < 6; i++) p.r(4 + (i * 1.5 | 0), 8 - i, 2, 1 + i * 2, '#e8e0d0'); },
  dpad_r: (p) => { for (let i = 0; i < 6; i++) p.r(12 - (i * 1.5 | 0), 8 - i, 2, 1 + i * 2, '#e8e0d0'); },
};
export const uiIcon = (name) => memo(`u:${name}`, () => sprite(16, 16, (p) => (UI[name] ?? UI.star)(p)));

// DOM helper: a crisp pixel icon element
const urls = new WeakMap();
export function iconEl(canvas, size = 24, cls = '') {
  let u = urls.get(canvas); if (!u) { u = canvas.toDataURL(); urls.set(canvas, u); }
  const img = document.createElement('img'); img.src = u; img.className = `pxi ${cls}`; img.width = img.height = size; img.draggable = false; img.alt = ''; img.style.width = img.style.height = `${size}px`; return img;
}
export const item = (id, size = 24) => iconEl(itemIcon(id), size);
export const skill = (id, size = 28) => iconEl(skillIcon(id), size);
export const cls = (id, size = 24) => iconEl(classIcon(id), size);
export const ui = (name, size = 20) => iconEl(uiIcon(name), size);

export const dataUrl = (canvas) => { let u = urls.get(canvas); if (!u) { u = canvas.toDataURL(); urls.set(canvas, u); } return u; };

export const flaskIcon = (form) => memo(`f:${form}`, () => sprite(16, 16, (p) => { const c = { draught: '#ffd36a', flask: '#9ae06a', essence: '#b58cff' }[form] ?? '#ffd36a'; bottle(p, c, form !== 'draught'); if (form === 'essence') { p.p(3, 3, '#e0d0ff'); p.p(12, 5, '#e0d0ff'); p.p(8, 0, '#ffffff'); } if (form === 'flask') { p.p(8, 0, '#ff9a2e'); p.p(9, 1, '#ffe36b'); } }));
