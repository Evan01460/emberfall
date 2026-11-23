// Pixel icons (16×16 art px) for items, skills, classes and UI. Replaces every emoji.
import { sprite, shade, tint } from './px.js';
import { ITEMS, SKILLS, BASICS, CLASSES } from '../data.js';
import { basicOf } from '../loadout.js';

const cache = new Map();
const memo = (k, fn) => { let v = cache.get(k); if (!v) { v = fn(); cache.set(k, v); } return v; };
const TYPE = { slash: '#e8f0ff', pierce: '#ffe9a8', blunt: '#ffb870', arcane: '#b58cff' };
const METAL = { iron: ['#9aa3ad', '#c8d0d8', '#6f7882'], steel: ['#b8cce8', '#e8f2ff', '#7a90b8'], shadow: ['#9a7ae0', '#d0baff', '#5a3ab0'] };
const tier = (id) => (id.startsWith('hollow_') ? 'shadow' : id.startsWith('steel_') ? 'steel' : 'iron');
const wd = ['#8f633a', '#a67546', '#6a4528'];

const sword = (p, m) => { p.line(3, 13, 12, 3, m[0]); p.line(4, 13, 13, 3, m[1]); p.line(2, 14, 4, 12, '#6a4528'); p.r(2, 10, 1, 1, '#e0b24a'); p.line(3, 11, 6, 14, '#e0b24a'); p.p(13, 2, '#ffffff'); };
const spear = (p, m) => { p.line(2, 14, 12, 4, wd[0]); p.line(3, 14, 13, 4, wd[1]); p.r(11, 1, 3, 5, m[0]); p.r(12, 0, 1, 4, m[1]); p.p(12, 0, '#ffffff'); p.p(10, 4, m[2]); p.p(14, 5, m[2]); };
const bow = (p, m) => { p.line(9, 1, 5, 4, wd[0]); p.line(5, 4, 4, 8, wd[0]); p.line(4, 8, 5, 12, wd[0]); p.line(5, 12, 9, 15, wd[0]); p.line(10, 1, 6, 4, wd[1]); p.line(6, 4, 5, 8, wd[1]); p.line(5, 8, 6, 12, wd[1]); p.line(6, 12, 10, 15, wd[1]); p.line(10, 1, 10, 15, '#e8e0d0'); p.line(3, 8, 14, 8, wd[2]); p.r(13, 7, 2, 3, m[0]); p.p(14, 8, '#ffffff'); p.r(2, 7, 2, 1, '#c8d0d8'); p.r(2, 9, 2, 1, '#c8d0d8'); p.p(9, 1, m[1]); p.p(9, 15, m[1]); };
const mace = (p, m) => { p.line(2, 14, 9, 7, wd[0]); p.line(3, 14, 10, 7, wd[1]); p.disc(11, 5, 3.5, m[0]); p.disc(10, 4, 2, m[1]); for (const [x, y] of [[11, 0], [15, 5], [11, 9], [7, 5]]) p.p(x, y, m[2]); p.p(10, 3, '#ffffff'); };
const staff = (p, c) => { p.line(3, 14, 11, 6, wd[0]); p.line(4, 14, 12, 6, wd[1]); p.disc(12, 4, 3, c); p.disc(11, 3, 1.5, tint(c, '#ffffff', 0.6)); p.p(14, 1, '#ffffff'); p.p(15, 6, c); };
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
function gearIcon(id) {
  const it = ITEMS[id], t = tier(id), m = METAL[t];
  if (it.slot === 'weapon') return id.includes('bow') ? (p) => bow(p, m) : it.wtype === 'slash' ? (p) => sword(p, m) : it.wtype === 'pierce' ? (p) => spear(p, m) : it.wtype === 'blunt' ? (p) => mace(p, m) : (p) => staff(p, t === 'shadow' ? '#a984ff' : '#8ad8ff');
  if (it.slot === 'armor') return (p) => coat(p, t === 'shadow' ? '#5a3a9a' : t === 'steel' ? '#8aa0c8' : id.includes('mail') ? '#7a8a98' : '#8a5a38', id.includes('plate') || id.includes('aegis') ? 'plate' : id.includes('mail') ? 'mail' : 'leather');
  return id.includes('locket') ? (p) => locket(p, t === 'shadow' ? '#a984ff' : '#4a90e0') : (p) => band(p, '#6fc08b');
}
const tomeIcon = (p, sid) => { const c = CLASSES[SKILLS[sid].cls[0]]?.color ?? '#8a7ab0'; p.r(2, 2, 12, 12, shade(c, 0.55)); p.r(3, 3, 10, 10, c); p.r(2, 2, 12, 1, tint(c, '#ffffff', 0.5)); p.r(2, 2, 1, 12, shade(c, 0.4)); p.r(11, 3, 2, 10, '#e8dcc0'); p.r(5, 5, 4, 1, '#e0b24a'); p.r(5, 7, 4, 1, '#e0b24a'); p.r(5, 9, 3, 1, '#e0b24a'); p.p(6, 11, '#e0b24a'); };
export function itemIcon(id) {
  return memo(`i:${id}`, () => sprite(16, 16, (p) => { const it = ITEMS[id]; if (!it) return p.r(4, 4, 8, 8, '#888'); (ITEM[id] ?? (it.skill ? (q) => tomeIcon(q, it.skill) : it.k === 'gear' ? gearIcon(id) : (q) => bottle(q, '#888')))(p); }));
}

// ── skill icons: shape by kind, colour by damage type ───────────────────────
function skillArt(p, sk) {
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
  blacksmith: (p) => { p.r(2, 9, 12, 3, '#9aa3ad'); p.r(2, 9, 12, 1, '#c8d0d8'); p.r(5, 12, 6, 3, '#6f7882'); p.line(3, 8, 11, 1, wd[0]); p.r(9, 0, 5, 3, '#8a909c'); p.r(9, 0, 5, 1, '#c8d0d8'); },
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
