// Combat visuals, all in pixels: dithered telegraphs, pixel projectiles, stepped slash arcs, ring bursts,
// bitmap-font damage numbers. The server decides what hits; this only draws what it describes.
import { G } from './state.js';
import { sfx } from './sfx.js';
import { TS } from '../world.js';
import { C, q, cellAt, pdisc, pring, psector, parc, pline, prect, drawText, shade } from './px.js';
import { PROJ2, VFX } from './skillfx.js';

const TYPE_COL = { slash: '#f0f4ff', pierce: '#ffe9a8', blunt: '#ffb870', arcane: '#b58cff', heal: '#7dffa0', ward: '#7fb8ff', taunt: '#ffcf6a', mark: '#ff9ad5', rage: '#ff3b3b' };
export const hooks = { shake: null };            // set by the world view
export const casts = new Map();                // who → { t, a, kind } (swing animation)
const ZCOL = { acid: ['rgba(60,200,100,.28)', 'rgba(120,255,140,.28)', 'rgba(150,255,170,.9)', '#c8ffc0'], poison: ['rgba(110,200,60,.3)', 'rgba(170,230,90,.3)', 'rgba(190,240,110,.9)', '#e0ff9a'], fire: ['rgba(240,90,30,.3)', 'rgba(255,170,50,.3)', 'rgba(255,200,90,.9)', '#ffe36b'], arrows: ['rgba(220,200,150,.22)', 'rgba(255,240,200,.22)', 'rgba(255,240,200,.8)', '#ffffff'], holy: ['rgba(255,240,140,.22)', 'rgba(255,255,200,.28)', 'rgba(255,245,170,.9)', '#ffffff'], storm: ['rgba(100,150,255,.28)', 'rgba(170,200,255,.28)', 'rgba(190,220,255,.9)', '#ffffff'] };
const list = [];                               // transient effects
export const projs = new Map();                // id → projectile (extrapolated between snapshots)
export const work = new Map();                 // "x,y" → { k, until } stations currently being worked

// Where is this entity right now (in tiles)? Effects anchored to a fighter follow them instead of staying behind.
function posOf(who) {
  if (who == null) return null; if (who === G.id) return { x: G.pos.x, y: G.pos.y };
  if (typeof who === 'string' && who[0] === 'm') { const m = G.mobs.get(+who.slice(1)); return m ? { x: m.rx ?? m.x, y: m.ry ?? m.y } : null; }
  const p = G.players.get(who); return p ? { x: p.rx ?? p.x, y: p.ry ?? p.y } : null;
}
const rnd = Math.random;
export function ingest(events) {
  const now = performance.now();
  for (const e of events ?? []) {
    switch (e.t) {
      case 'cast': casts.set(e.who, { t: now, a: e.a, kind: e.kind, ty: e.ty, ms: e.ms }); if (e.who === G.id) sfx(e.kind === 'melee' ? 'swing' : e.kind === 'proj' ? 'shoot' : 'cast', 60);
        if ((e.ms ?? 0) >= 160 && !e.q) list.push({ k: 'charge', t0: now, dur: e.ms + 60, who: e.who, ty: e.ty, kind: e.kind }); break;
      case 'dust': for (let i = 0; i < 3; i++) list.push({ k: 'bit', t0: now, dur: 260 + rnd() * 160, x: e.x + (rnd() - 0.5) * 0.4, y: e.y, vx: (rnd() - 0.5) * 1.2, vy: e.up ? -1.2 - rnd() : -0.2 - rnd() * 0.6, col: e.cols[i % e.cols.length], g: e.up ? 3 : 1 }); break;
      case 'slash': { const p = posOf(e.who), me = { x: e.x, y: e.y }; list.push({ k: 'slash', t0: now, dur: e.big ? 440 : 300, ...e, ox: p ? e.x - p.x : 0, oy: p ? e.y - p.y : 0, follow: !!p }); void me; break; }
      case 'spark': for (let i = 0; i < (e.n ?? 4); i++) { const a = (e.a ?? 0) + (rnd() - 0.5) * 2.4, sp = 1.5 + rnd() * 3.5; list.push({ k: 'bit', t0: now, dur: 220 + rnd() * 220, x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4, col: i % 3 === 0 ? '#ffffff' : (TYPE_COL[e.ty] ?? '#ffe9a8'), g: 0.5 }); }
        list.push({ k: 'star', t0: now, dur: 180, x: e.x, y: e.y, ty: e.ty, big: (e.n ?? 4) > 6 }); break;
      case 'vfx': { const d = VFX[e.id]; if (!d) break; list.push({ ...e, k: 'vfx', vid: e.id, t0: now, dur: d.dur }); if (['slap', 'jackpot', 'epilogue', 'hammer_smash', 'coldstar', 'grand', 'buyout', 'liquidation', 'allin_fire', 'wrath', 'roots', 'oblivion', 'titan_slam', 'forge_nova', 'event_horizon', 'titan_grip'].includes(e.id)) sfx('boom', 120); else if (['dice_pop', 'chain_end'].includes(e.id)) sfx('hit', 40); break; }
      case 'shake': if (e.who === G.id) hooks.shake?.(e.m ?? 1); break;
      case 'boom': list.push({ k: 'boom', t0: now, dur: 640, ...e }); sfx('boom', 120);
        for (let i = 0; i < 10; i++) { const a = rnd() * 6.28, sp = 1 + rnd() * 2.5; list.push({ k: 'bit', t0: now, dur: 420 + rnd() * 300, x: e.x + Math.cos(a) * e.r * 0.3, y: e.y + Math.sin(a) * e.r * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, col: BOOM_COL[e.g]?.[i % 3] ?? [TYPE_COL[e.ty] ?? '#fff', '#ffffff', shade(TYPE_COL[e.ty]?.length === 7 ? TYPE_COL[e.ty] : '#ffffff', 0.7)][i % 3], g: 2.2 }); }
        break;
      case 'aura': list.push({ k: 'aura', t0: now, dur: 760, ...e, follow: false }); break;
      case 'dmg': sfx(e.k === 'crit' ? 'crit' : e.k === 'player' ? 'hurt' : e.k === 'mob' ? 'hit' : 'pickup', 45); list.push({ ...e, kd: e.k, k: 'dmg', t0: now, dur: e.k === 'crit' ? 1100 : 850, jx: Math.round((rnd() - 0.5) * 12) }); break;
      case 'mobdeath': { if (e.boss) sfx('roar', 300); const n = e.boss ? 44 : 18; for (let i = 0; i < n; i++) { const a = rnd() * 6.28, s = 0.8 + rnd() * 2.2; list.push({ k: 'bit', t0: now, dur: 600 + rnd() * 300, x: e.x, y: e.y - 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, col: e.boss ? '#ffd36a' : ['#e8e0d0', '#b8a890', '#ffffff'][i % 3] }); } list.push({ k: 'ring', t0: now, dur: 520, x: e.x, y: e.y, r: e.boss ? 3 : 1.2 }); break; }
      case 'dashfx': sfx('dash', 100); { const p = posOf(e.who); list.push({ k: 'dash', t0: now, dur: 360, x: e.x, y: e.y, who: e.who, sx: p ? p.x : e.x, sy: p ? p.y : e.y }); } break;
      case 'down': list.push({ k: 'ring', t0: now, dur: 900, x: e.x, y: e.y, r: 1.8 }); break;
      case 'chest': sfx('open', 100); for (let i = 0; i < 18; i++) list.push({ k: 'bit', t0: now, dur: 800, x: e.x, y: e.y - 0.4, vx: (rnd() - 0.5) * 3, vy: -1.5 - rnd() * 2, col: ['#ffe36b', '#e0b24a', '#ffffff'][i % 3] }); list.push({ k: 'star', t0: now, dur: 300, x: e.x, y: e.y - 0.5, ty: 'pierce', big: true }); break;
      case 'work': work.set(`${e.x},${e.y}`, { k: e.k, until: now + e.ms, x: e.x, y: e.y }); break;
      default: break;
    }
  }
}
const BOOM_COL = { flame: ['#ff9a2e', '#ffe36b', '#e0451e'], frost: ['#bfe8ff', '#ffffff', '#6ab8f0'], leaf: ['#8be06a', '#e0ffc0', '#3f9a3a'], skull: ['#9ae06a', '#d8ff9a', '#4a7a2a'], void: ['#a984ff', '#e0d0ff', '#4a2a8a'], bolt: ['#ffe36b', '#ffffff', '#9ad8ff'], sun: ['#fff0a0', '#ffffff', '#ffc84a'], coin: ['#ffe36b', '#fff6c0', '#c89a3a'], drop: ['#9ae06a', '#e0ffc0', '#5aa03a'], anvil: ['#ffb870', '#fff0d0', '#8a6a4a'], star: ['#ffe9a8', '#ffffff', '#ffb84a'] };

export function syncProjectiles(arr) {
  const now = performance.now(), seen = new Set();
  for (const p of arr) { seen.add(p.id); projs.set(p.id, { ...p, t: now }); }
  for (const id of projs.keys()) if (!seen.has(id)) projs.delete(id);
}

// ── ground layer (under characters) ─────────────────────────────────────────
export function drawGround(g, mobs, zones, t) {
  for (const z of zones) {
    const x = z.x * TS, y = z.y * TS, r = z.r * TS, Z = ZCOL[z.k] ?? ZCOL.acid;
    if (z.k === 'root' || z.k === 'bloomz') continue;
    if (z.k === 'trap') { pring(g, x, y, r * 0.5, C, 'rgba(255,255,255,.25)'); for (let i = 0; i < 4; i++) cellAt(g, x + Math.cos(i * 1.57) * r * 0.3, y + Math.sin(i * 1.57) * r * 0.3, '#c8d0d8'); continue; }
    pdisc(g, x, y, r, Z[0], 0); pdisc(g, x, y, r * 0.7, Z[1], 1); pring(g, x, y, r, C, Z[2]);
    for (let i = 0; i < 6; i++) { const a = t / (z.k === 'fire' ? 180 : 400) + i * 1.1, rr = r * (0.3 + ((i * 37) % 10) / 20); cellAt(g, x + Math.cos(a) * rr, y + (z.k === 'fire' ? -((t / 40 + i * 9) % 18) + Math.sin(a) * rr * 0.4 : Math.sin(a * 1.2) * rr * 0.8), Z[3]); }
  }
  for (const m of mobs) if (m.w) telegraph(g, m);
}
// Telegraph: dithered danger zone + solid edge; the inner fill grows toward the edge until the hit lands.
function telegraph(g, m) {
  const w = m.w, p = w.p, mx = m.rx * TS, my = m.ry * TS, edge = p > 0.7 ? '#ffe36b' : '#ff4a3a', body = 'rgba(230,50,40,.30)', fill = 'rgba(255,90,60,.55)';
  if (w.k === 'melee') {
    const R = w.rg * TS, half = (w.ar * Math.PI) / 360;
    psector(g, mx, my, R, w.a, half, body, { dither: 1 }); psector(g, mx, my, R * p, w.a, half, fill, { dither: 0 }); psector(g, mx, my, R, w.a, half, edge, { ring: C });
  } else if (w.k === 'aoe') {
    const cx = (w.at === 'self' ? m.rx : w.tx) * TS, cy = (w.at === 'self' ? m.ry : w.ty) * TS, R = w.r * TS;
    pdisc(g, cx, cy, R, body, 1); pdisc(g, cx, cy, R * p, fill, 0); pring(g, cx, cy, R, C, edge);
  } else if (w.k === 'proj') {
    pline(g, mx, my, mx + Math.cos(w.a) * w.rg * TS * 0.7, my + Math.sin(w.a) * w.rg * TS * 0.7, p > 0.6 ? '#ff4a3a' : 'rgba(255,90,60,.55)');
  } else if (w.k === 'dash') {
    const L = w.ds * TS, ca = Math.cos(w.a), sa = Math.sin(w.a);
    for (let d = 0; d < L; d += C) for (let s = -TS * 0.5; s < TS * 0.5; s += C) { const on = d <= L * p; if (!on && (((d / C) + (s / C)) & 1)) continue; cellAt(g, mx + ca * d - sa * s, my + sa * d + ca * s, on ? fill : body); }
    pline(g, mx - sa * TS * 0.5, my + ca * TS * 0.5, mx - sa * TS * 0.5 + ca * L, my + ca * TS * 0.5 * 0 + sa * L + ca * TS * 0.5, edge);
    pline(g, mx + sa * TS * 0.5, my - ca * TS * 0.5, mx + sa * TS * 0.5 + ca * L, my - ca * TS * 0.5 + sa * L, edge);
  }
}

// ── air layer (over characters) ─────────────────────────────────────────────
// A tapered, three-tone pixel crescent: dark edge, bright body, white leading edge.
function crescent(g, cx, cy, R, a0, a1, thick, cols, alpha = 1) {
  const len = Math.abs(a1 - a0) * R, steps = Math.max(6, Math.ceil(len / (C * 0.7))), cells = new Map(), dir = Math.sign(a1 - a0) || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = a0 + (a1 - a0) * t, w = Math.max(C, thick * Math.pow(Math.sin(Math.PI * (0.1 + t * 0.9 * (dir > 0 ? 1 : 1))), 0.7));
    for (let r = 0; r < w; r += C) { const rr = R - r, x = q(cx + Math.cos(a) * rr), y = q(cy + Math.sin(a) * rr), d = w <= C ? 0 : r / w; cells.set(x * 9973 + y, [x, y, d < 0.2 ? cols[2] : d < 0.7 ? cols[1] : cols[0]]); }
  }
  g.globalAlpha = alpha; for (const [x, y, c] of cells.values()) { g.fillStyle = c; g.fillRect(x, y, C, C); } g.globalAlpha = 1;
}
const COL3 = { slash: ['#6f8ccc', '#e8f2ff', '#ffffff'], blunt: ['#a85a2a', '#ffb060', '#fff0c0'], pierce: ['#b08a3a', '#ffe9a8', '#ffffff'], arcane: ['#4a2a98', '#b58cff', '#f4e8ff'], mob: ['#7a1a14', '#ff6a5a', '#ffd0c8'] };
const colsFor = (e) => (e.who?.toString().startsWith('m') ? COL3.mob : e.mag ? ['#2a5aa8', '#7fc8ff', '#f0faff'] : COL3[e.ty] ?? COL3.slash);
// The current sweep angle of a slash effect (so the weapon on the character follows the same arc).
const sweepOf = (e, k) => { const half = (Math.min(e.arc, 360) * Math.PI) / 360, dir = e.dir ?? 1, full = e.arc >= 340, s0 = full ? e.a - Math.PI : e.a - dir * half, s1 = full ? e.a + Math.PI : e.a + dir * half, sw = Math.min(1, k / 0.5); return { s0, s1, cur: s0 + (s1 - s0) * sw, sw, half, full }; };

// Projectile artwork, keyed by the server's `vi`.
const trail = (g, x, y, a, n, cols, gap = 3) => { for (let i = 1; i <= n; i++) { const w = Math.sin(performance.now() / 70 + i) * 1.2; cellAt(g, x - Math.cos(a) * i * gap + Math.sin(a) * w, y - Math.sin(a) * i * gap - Math.cos(a) * w, cols[Math.min(cols.length - 1, Math.floor((i / n) * cols.length))]); } };
const PROJ = {
  arrow: (g, x, y, a, col) => { const ca = Math.cos(a), sa = Math.sin(a); pline(g, x - ca * 14, y - sa * 14, x, y, '#a67546'); pline(g, x - ca * 13, y - sa * 13 - 1, x - ca * 4, y - sa * 4 - 1, '#7a5230');
    for (const o of [-2, 2]) pline(g, x - ca * 14 + Math.sin(a) * o, y - sa * 14 - Math.cos(a) * o, x - ca * 10, y - sa * 10, '#e8e0d0'); pline(g, x - ca * 1, y - sa * 1, x + ca * 5, y + sa * 5, '#ffffff'); cellAt(g, x + ca * 6, y + sa * 6, '#c8d0d8'); trail(g, x - ca * 14, y - sa * 14, a, 4, ['rgba(255,255,255,.5)', 'rgba(255,255,255,.25)'], 4); },
  orb: (g, x, y, a, col, t) => { trail(g, x, y, a, 8, [col, shade(col.length === 7 ? col : '#b58cff', 0.6), shade(col.length === 7 ? col : '#b58cff', 0.35)]); pdisc(g, x, y, C * 3, shade(col.length === 7 ? col : '#b58cff', 0.5)); pdisc(g, x, y, C * 2.2, col); pdisc(g, x, y, C * 1.2, '#ffffff'); for (let i = 0; i < 3; i++) { const o = t / 90 + i * 2.1; cellAt(g, x + Math.cos(o) * 9, y + Math.sin(o) * 9, '#ffffff'); } },
  fire: (g, x, y, a, col, t) => { const ca = Math.cos(a), sa = Math.sin(a); for (let i = 1; i <= 8; i++) cellAt(g, x - ca * i * 3 + (Math.random() - 0.5) * 4, y - sa * i * 3 - i * 0.8 + (Math.random() - 0.5) * 4, i < 3 ? '#ffe36b' : i < 6 ? '#ff9a2e' : '#a8321a'); pdisc(g, x, y, C * 3.2, '#c0381a'); pdisc(g, x, y, C * 2.4, '#ff8a2e'); pdisc(g, x, y, C * 1.4, '#ffe36b'); cellAt(g, x - 2, y - 2, '#ffffff'); },
  ice: (g, x, y, a) => { const ca = Math.cos(a), sa = Math.sin(a); pline(g, x - ca * 12, y - sa * 12, x + ca * 7, y + sa * 7, '#6ab8f0'); pline(g, x - ca * 9, y - sa * 9 - 1, x + ca * 8, y + sa * 8 - 1, '#bfe8ff'); cellAt(g, x + ca * 9, y + sa * 9, '#ffffff'); trail(g, x - ca * 12, y - sa * 12, a, 5, ['rgba(190,232,255,.6)', 'rgba(190,232,255,.2)'], 4); },
  bolt: (g, x, y, a) => { let px = x, py = y; const ca = Math.cos(a), sa = Math.sin(a); for (let i = 0; i < 6; i++) { const nx = px - ca * 6 + (Math.random() - 0.5) * 8, ny = py - sa * 6 + (Math.random() - 0.5) * 8; pline(g, px, py, nx, ny, '#9ad8ff'); pline(g, px, py - 1, nx, ny - 1, '#ffffff'); px = nx; py = ny; } pdisc(g, x, y, C * 2, '#ffe36b'); pdisc(g, x, y, C, '#ffffff'); },
  coin: (g, x, y, a, col, t) => { const w = Math.abs(Math.sin(t / 60 + x)) , hw = Math.max(1, Math.round(w * 3)); g.fillStyle = '#9a6a1a'; g.fillRect(q(x - (hw + 1) * C), q(y - 4 * C), (hw * 2 + 2) * C, 8 * C); g.fillStyle = '#e0b24a'; g.fillRect(q(x - hw * C), q(y - 3 * C), hw * 2 * C, 6 * C); g.fillStyle = '#ffe36b'; g.fillRect(q(x - hw * C), q(y - 3 * C), hw * C, 2 * C); cellAt(g, x - 2, y - 2, '#ffffff'); trail(g, x, y, a, 4, ['rgba(255,227,107,.6)', 'rgba(255,227,107,.2)'], 4); },
  flask: (g, x, y, a, col, t) => { const sp = t / 80 + x, cx2 = Math.cos(sp) * 3, cy2 = Math.sin(sp) * 3; pdisc(g, x + cx2, y + cy2, C * 2.4, '#cfeeff'); pdisc(g, x + cx2, y + cy2, C * 1.6, col.length === 7 ? col : '#9ae06a'); cellAt(g, x - cx2, y - cy2, '#8a6a4a'); cellAt(g, x - cx2 * 1.5, y - cy2 * 1.5, '#8a6a4a'); trail(g, x, y, a, 4, [col.length === 7 ? col : '#9ae06a', 'rgba(154,224,106,.3)'], 4); },
  thorn: (g, x, y, a) => { const ca = Math.cos(a), sa = Math.sin(a); pline(g, x - ca * 8, y - sa * 8, x + ca * 6, y + sa * 6, '#3f9a3a'); pline(g, x - ca * 6, y - sa * 6 - 1, x + ca * 7, y + sa * 7 - 1, '#8be06a'); cellAt(g, x + ca * 8, y + sa * 8, '#ffffff'); trail(g, x - ca * 8, y - sa * 8, a, 3, ['#5fd06a', 'rgba(95,208,106,.3)'], 4); },
  void: (g, x, y, a, col, t) => { pdisc(g, x, y, C * 3.4, '#2a1a58'); pdisc(g, x, y, C * 2.4, '#0c0814'); pring(g, x, y, C * 3.6, C, '#a984ff'); for (let i = 0; i < 4; i++) { const o = -t / 100 + i * 1.6; cellAt(g, x + Math.cos(o) * 11, y + Math.sin(o) * 11, '#e0d0ff'); } trail(g, x, y, a, 6, ['#7a5aff', 'rgba(122,90,255,.3)'], 3); },
  wave: (g, x, y, a, col) => { crescent(g, x - Math.cos(a) * 6, y - Math.sin(a) * 6, C * 7, a - 1.0, a + 1.0, C * 4, col.length === 7 ? [shade(col, 0.45), col, '#ffffff'] : COL3.arcane); trail(g, x - Math.cos(a) * 12, y - Math.sin(a) * 12, a, 4, ['rgba(255,255,255,.35)', 'rgba(255,255,255,.1)'], 4); },
  boulder: (g, x, y, a, col, t) => { pdisc(g, x, y, C * 3.4, '#5a5654'); pdisc(g, x - 1, y - 1, C * 2.6, '#85817e'); pdisc(g, x - 3, y - 3, C * 1.2, '#b8b4b0'); trail(g, x, y, a, 5, ['rgba(140,130,120,.6)', 'rgba(140,130,120,.2)'], 4); },
  star: (g, x, y, a, col, t) => { const r = 6 + Math.sin(t / 60) * 1.5; for (let i = 0; i < 4; i++) pline(g, x, y, x + Math.cos(i * 1.57 + t / 200) * r, y + Math.sin(i * 1.57 + t / 200) * r, '#ffe9a8'); pdisc(g, x, y, C * 1.6, '#ffffff'); trail(g, x, y, a, 5, ['#ffe9a8', 'rgba(255,233,168,.3)'], 4); },
  bullet: (g, x, y, a) => { const ca = Math.cos(a), sa = Math.sin(a); pline(g, x - ca * 6, y - sa * 6, x, y, '#ffe9a8'); cellAt(g, x, y, '#ffffff'); trail(g, x - ca * 6, y - sa * 6, a, 3, ['rgba(255,233,168,.5)', 'rgba(255,233,168,.1)'], 4); },
  quill: (g, x, y, a) => { const ca = Math.cos(a), sa = Math.sin(a); pline(g, x - ca * 10, y - sa * 10, x + ca * 4, y + sa * 4, '#e8f6f0'); cellAt(g, x + ca * 5, y + sa * 5, '#aef0ff'); trail(g, x - ca * 10, y - sa * 10, a, 4, ['#2f8a8a', 'rgba(47,138,138,.2)'], 3); },
  mob: (g, x, y, a, col, t) => { pdisc(g, x, y, C * 2.8, '#7a1a14'); pdisc(g, x, y, C * 2, '#ff5a4a'); pdisc(g, x, y, C, '#ffd0c8'); trail(g, x, y, a, 5, ['#ff5a4a', 'rgba(255,90,74,.25)'], 3); },
};
Object.assign(PROJ, PROJ2);
const VCTX = { pos: posOf, get mobs() { return G.mobs; }, get players() { return G.players; } };
export function drawAir(g) {
  const wall = performance.now();
  for (const p of projs.values()) {
    const dt = (wall - p.t) / 1000, x = (p.x + p.vx * dt) * TS, y = (p.y + p.vy * dt) * TS, a = Math.atan2(p.vy, p.vx);
    const col = p.o === 'm' ? '#ff5a4a' : (p.c ?? TYPE_COL[p.ty] ?? '#ffffff'); (PROJ[p.o === 'm' ? 'mob' : p.vi] ?? PROJ[p.ty === 'pierce' ? 'arrow' : p.ty === 'arcane' ? 'orb' : 'bullet'])(g, x, y, a, col, wall, p);
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i], k = (wall - e.t0) / e.dur; if (k >= 1) { list.splice(i, 1); continue; }
    if (e.k === 'vfx') VFX[e.vid].draw(g, e, k, wall, VCTX);
    else if (e.k === 'slash') drawSlash(g, e, k, wall);
    else if (e.k === 'charge') { const p = posOf(e.who); if (!p) continue; const x = p.x * TS, y = p.y * TS + 8, R = 8 + 18 * Math.min(1, k * 1.2), col = e.ty === 'arcane' ? '#b58cff' : e.ty === 'blunt' ? '#ffb870' : '#fff0a0'; pring(g, x, y, R, C, `${col}`); for (let j = 0; j < 8; j++) { const a2 = wall / 260 + (j * Math.PI) / 4; cellAt(g, x + Math.cos(a2) * R, y + Math.sin(a2) * R * 0.6, '#ffffff'); } pdisc(g, x, y, R * 0.6 * k, 'rgba(255,255,255,.12)', 1); }
    else if (e.k === 'boom') drawBoom(g, e, k, wall);
    else if (e.k === 'aura' || e.k === 'ring') drawAura(g, e, k, wall);
    else if (e.k === 'dash') { const p = posOf(e.who), x1 = (p?.x ?? e.x) * TS, y1 = (p?.y ?? e.y) * TS; for (let j = 0; j < 7; j++) { const f = j / 7, x = e.sx * TS + (e.x - e.sx) * TS * f, y = e.sy * TS + (e.y - e.sy) * TS * f; g.globalAlpha = (1 - k) * (1 - f) * 0.5; pdisc(g, x, y + 2, C * 4, '#ffffff', 1); } g.globalAlpha = 1; for (let j = 0; j < 5; j++) pline(g, e.sx * TS + (j - 2) * 3, e.sy * TS - 14 + j * 5, x1 + (j - 2) * 3, y1 - 14 + j * 5, `rgba(255,255,255,${0.5 * (1 - k)})`); }
    else if (e.k === 'star') { const x = e.x * TS, y = e.y * TS, r = (e.big ? 16 : 10) * (k < 0.5 ? k * 2 : 1 - (k - 0.5)), col = TYPE_COL[e.ty] ?? '#fff'; for (let j = 0; j < 4; j++) { const a2 = (j * Math.PI) / 2 + (e.big ? 0.4 : 0); pline(g, x, y, x + Math.cos(a2) * r, y + Math.sin(a2) * r, '#ffffff'); } if (e.big) for (let j = 0; j < 4; j++) { const a2 = (j * Math.PI) / 2 + Math.PI / 4; pline(g, x, y, x + Math.cos(a2) * r * 0.6, y + Math.sin(a2) * r * 0.6, col.length === 7 ? col : '#ffe9a8'); } pdisc(g, x, y, C * (k < 0.4 ? 2 : 1), '#ffffff'); }
    else if (e.k === 'bit') { const dt = (wall - e.t0) / 1000; cellAt(g, (e.x + e.vx * dt) * TS, (e.y + e.vy * dt + (e.g ?? 2.2) * dt * dt) * TS, e.col); }
  }
}
// Melee swings: a tapered crescent that follows the fighter, with trailing speed lines and an impact bloom on the finisher.
function drawSlash(g, e, k, wall) {
  const p = e.follow ? posOf(e.who) : null, x = (p ? p.x + e.ox : e.x) * TS, y = (p ? p.y + e.oy : e.y) * TS, R = e.range * TS, cols = colsFor(e), sw = sweepOf(e, k);
  const fade = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45); if (fade <= 0) return;
  const big = !!e.big, thick = C * (big ? 8 : 5.5);
  if (e.ty === 'pierce' && e.arc < 100) {                                           // a thrust: a bright lance of light with a flaring tip
    const len = R * (0.4 + 0.9 * Math.min(1, k * 2.4)), ca = Math.cos(e.a), sa = Math.sin(e.a);
    for (let o = -2; o <= 2; o++) { const w = 3 - Math.abs(o); pline(g, x + ca * 8 - sa * o * 2, y + sa * 8 + ca * o * 2, x + ca * len - sa * o * 2 * (1 - 0.4), y + sa * len + ca * o * 2 * (1 - 0.4), w >= 3 ? cols[2] : w === 2 ? cols[1] : cols[0]); }
    pdisc(g, x + ca * len, y + sa * len, C * 2.4 * fade, '#ffffff'); for (let j = 0; j < 4; j++) pline(g, x + ca * len, y + sa * len, x + ca * len + Math.cos(j * 1.57 + k * 3) * 9, y + sa * len + Math.sin(j * 1.57 + k * 3) * 9, cols[1]); return;
  }
  const lo = Math.min(sw.s0, sw.cur), hi = Math.max(sw.s0, sw.cur), span = hi - lo;
  if (k < 0.5) psector(g, x, y, R * 0.96, e.a, sw.half, 'rgba(255,255,255,.16)', { dither: 1 });                // swept area
  // tail (dim) → body → head (bright)
  const segs = [[0, 0.45, 0.5, cols.map((c2) => (c2.length === 7 ? shade(c2, 0.7) : c2))], [0.3, 0.8, 0.85, cols], [0.65, 1, 1, cols]];
  const dirn = sw.cur >= sw.s0 ? 1 : -1;
  for (const [a0, a1, al, cc] of segs) { const t0 = dirn > 0 ? lo + span * a0 : hi - span * a0, t1 = dirn > 0 ? lo + span * a1 : hi - span * a1; crescent(g, x, y, R, Math.min(t0, t1), Math.max(t0, t1), thick * (0.55 + 0.45 * a1), cc, al * fade); }
  if (big) crescent(g, x, y, R - C * 5, Math.min(sw.s0, sw.cur) + 0.1, Math.max(sw.s0, sw.cur) - 0.1, C * 2, [cols[0], cols[1], cols[2]], 0.6 * fade);
  // speed lines behind the blade tip + glints along the edge
  if (sw.sw < 1) { const tx = x + Math.cos(sw.cur) * R, ty = y + Math.sin(sw.cur) * R, tn = sw.cur + dirn * Math.PI / 2; for (let j = 1; j <= 3; j++) pline(g, x + Math.cos(sw.cur - dirn * 0.18 * j) * (R + C * j * 2), y + Math.sin(sw.cur - dirn * 0.18 * j) * (R + C * j * 2), x + Math.cos(sw.cur - dirn * 0.18 * j - dirn * 0.1) * (R + C * j * 2), y + Math.sin(sw.cur - dirn * 0.18 * j - dirn * 0.1) * (R + C * j * 2), `rgba(255,255,255,${0.7 - j * 0.18})`); pdisc(g, tx, ty, C * (big ? 3.2 : 2.2), '#ffffff'); void tn; }
  for (let j = 0; j < (big ? 6 : 3); j++) { const aa = lo + span * ((j * 0.37 + k * 1.3) % 1); if (Math.sin(wall / 60 + j * 2) > 0) cellAt(g, x + Math.cos(aa) * (R + 2), y + Math.sin(aa) * (R + 2), '#ffffff'); }
  if (e.ty === 'blunt' && big && k > 0.45) { const r2 = R * 0.8 * ((k - 0.45) / 0.55) + C * 2, hx = x + Math.cos(e.a) * R * 0.8, hy = y + Math.sin(e.a) * R * 0.8; pring(g, hx, hy, r2, C, `rgba(255,200,120,${0.7 * fade})`); }
  if (e.ty === 'arcane' || e.mag) for (let j = 0; j < 5; j++) { const aa = lo + span * (j / 4); cellAt(g, x + Math.cos(aa) * (R + 6 + Math.sin(wall / 120 + j) * 3), y + Math.sin(aa) * (R + 6 + Math.sin(wall / 120 + j) * 3), j % 2 ? '#ffffff' : cols[1]); }
}
// The weapon in the fighter's hand during a swing — drawn at the fighter's CURRENT position by the world view.
export function drawSwing(g, who, X, footY) {
  const now = performance.now(); let best = null, bk = 0;
  for (const e of list) if (e.k === 'slash' && e.who === who) { const k = (now - e.t0) / e.dur; if (k < 0.62 && (!best || e.t0 > best.t0)) { best = e; bk = k; } }
  if (!best) return; const sw = sweepOf(best, bk), ang = sw.cur, ca = Math.cos(ang), sa = Math.sin(ang), cx = X, cy = footY - 14, len = Math.min(best.range * TS * 0.62, 30), ty = best.ty, mob = who.toString().startsWith('m');
  if (mob) return;
  const hx = cx + ca * 6, hy = cy + sa * 6, tx = cx + ca * (6 + len), ty2 = cy + sa * (6 + len);
  if (ty === 'blunt') { pline(g, hx, hy, tx, ty2, '#6a4528'); pline(g, hx, hy - 1, tx, ty2 - 1, '#a67546'); pdisc(g, tx, ty2, C * 2.6, '#6f7882'); pdisc(g, tx - 1, ty2 - 1, C * 1.6, '#c8d0d8'); }
  else if (ty === 'pierce') { pline(g, hx, hy, tx, ty2, '#a67546'); pline(g, tx, ty2, tx + ca * 7, ty2 + sa * 7, '#e8f0ff'); cellAt(g, tx + ca * 8, ty2 + sa * 8, '#ffffff'); }
  else if (ty === 'arcane') { pline(g, hx, hy, tx, ty2, '#6a4528'); pdisc(g, tx, ty2, C * 2.2, '#9ad8ff'); pdisc(g, tx, ty2, C * 1.1, '#ffffff'); }
  else { pline(g, hx, hy, tx, ty2, '#8a909c'); pline(g, hx, hy - 1, tx, ty2 - 1, '#e8f0ff'); cellAt(g, tx, ty2, '#ffffff'); const px = -sa, py = ca; pline(g, hx + px * 4, hy + py * 4, hx - px * 4, hy - py * 4, '#e0b24a'); }
}
// Ground bursts: a white flash, a thick shockwave with a dithered body, secondary ring and style-specific flourishes.
function drawBoom(g, e, k, wall) {
  const x = e.x * TS, y = e.y * TS, R = e.r * TS * (0.35 + 0.65 * Math.min(1, k * 1.6)), pal = BOOM_COL[e.g] ?? [TYPE_COL[e.ty] ?? '#fff', '#ffffff', shade(TYPE_COL[e.ty]?.length === 7 ? TYPE_COL[e.ty] : '#ffffff', 0.7)], fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
  if (k < 0.2) pdisc(g, x, y, R * 0.75, '#ffffff', 0); g.globalAlpha = 0.55 * fade; pdisc(g, x, y, R, pal[2], 1); pdisc(g, x, y, R * 0.7, pal[0], 1); g.globalAlpha = fade;
  pring(g, x, y, R, C * (k < 0.4 ? 3 : 2), pal[0]); pring(g, x, y, Math.max(C, R - C * 3), C, pal[1]); if (k > 0.25) pring(g, x, y, R * 0.6 * ((k - 0.25) / 0.75) + C, C, pal[1]); g.globalAlpha = 1;
  const style = e.g;
  if (e.ty === 'blunt' || style === 'anvil') for (let j = 0; j < 9; j++) { const a2 = (j / 9) * 6.283 + 0.3, r1 = R * 0.2, r2 = R * (0.55 + ((j * 37) % 10) / 40); pline(g, x + Math.cos(a2) * r1, y + Math.sin(a2) * r1 * 0.9, x + Math.cos(a2) * r2, y + Math.sin(a2) * r2 * 0.9, '#2a1a10'); }
  else if (style === 'flame') for (let j = 0; j < 10; j++) { const a2 = (j / 10) * 6.283, h = ((wall / 30 + j * 11) % 20); cellAt(g, x + Math.cos(a2) * R * 0.8, y + Math.sin(a2) * R * 0.8 - h, j % 2 ? '#ffe36b' : '#ff9a2e'); }
  else if (style === 'frost') for (let j = 0; j < 12; j++) { const a2 = (j / 12) * 6.283; pline(g, x + Math.cos(a2) * R * 0.85, y + Math.sin(a2) * R * 0.85, x + Math.cos(a2) * R * 1.1, y + Math.sin(a2) * R * 1.1, '#ffffff'); }
  else if (e.ty === 'arcane') for (let j = 0; j < 12; j++) { const a2 = (j / 12) * 6.283 + wall / 400; cellAt(g, x + Math.cos(a2) * R * 0.9, y + Math.sin(a2) * R * 0.9, j % 2 ? '#ffffff' : pal[0]); if (j % 3 === 0) pline(g, x + Math.cos(a2) * R * 0.9, y + Math.sin(a2) * R * 0.9, x + Math.cos(a2 + 0.5) * R * 0.55, y + Math.sin(a2 + 0.5) * R * 0.55, pal[1]); }
  else if (style === 'skull' || style === 'drop') for (let j = 0; j < 7; j++) cellAt(g, x + Math.cos(j * 2.4 + wall / 500) * R * 0.5, y - ((wall / 25 + j * 9) % 20) + Math.sin(j) * R * 0.3, pal[1]);
}
function drawAura(g, e, k, wall) {
  const x = e.x * TS, y = e.y * TS, R = (e.r ?? 1) * TS * (0.3 + k * 0.7), col = TYPE_COL[e.c] ?? '#fff';
  g.globalAlpha = 1 - k * 0.6; pring(g, x, y, R, C, e.k === 'aura' ? col : '#ffffff'); g.globalAlpha = 1;
  if (e.k === 'aura') { for (let j = 0; j < 7; j++) { const a2 = (j / 7) * 6.283 + k * 2, rr = R * (0.4 + 0.5 * ((j * 53) % 10) / 10); const rise = k * 22; if (e.c === 'heal') { const px = x + Math.cos(a2) * rr, py = y - rise + Math.sin(a2) * rr * 0.4; cellAt(g, px, py, '#7dffa0'); cellAt(g, px - 2, py, '#7dffa0'); cellAt(g, px + 2, py, '#7dffa0'); cellAt(g, px, py - 2, '#7dffa0'); cellAt(g, px, py + 2, '#7dffa0'); } else cellAt(g, x + Math.cos(a2) * rr, y - rise + Math.sin(a2) * rr * 0.5, j % 2 ? '#ffffff' : col); } }
}
// Damage numbers: bitmap font with outline, rising in whole-pixel steps.
export function drawNumbers(g) {
  const wall = performance.now();
  for (const e of list) {
    if (e.k !== 'dmg') continue; const k = (wall - e.t0) / e.dur, kind = e.kd;
    const col = { crit: '#ffb02e', mob: '#ffffff', player: '#ff5a4a', heal: '#7dffa0', mana: '#7fb8ff', phase: '#c8a0ff' }[kind] ?? '#fff', big = kind === 'crit';
    if (k > 0.85 && Math.floor(k * 20) % 2) continue;                              // blink out
    drawText(g, `${kind === 'heal' || kind === 'mana' ? '+' : ''}${e.v}${big ? '!' : ''}`, e.x * TS + (e.jx ?? 0), e.y * TS - Math.floor(k * 18) * C, col, { scale: big ? 2 : 1, align: 'center' });
  }
}
// Stations being worked: sparks over the anvil, bubbles over the cauldron.
export function drawWork(g, t) {
  const now = performance.now();
  for (const [key, w] of work) {
    if (now > w.until) { work.delete(key); continue; }
    const x = w.x * TS, y = w.y * TS;
    if (w.k === 'blacksmith') { const beat = Math.floor(t / 280) % 2; for (let i = 0; i < 6; i++) { const ph = ((t / 90 + i * 3.7) % 8) / 8, a = -1.2 - i * 0.5; if (beat || i < 3) cellAt(g, x + Math.cos(a) * ph * 22, y - 8 + Math.sin(a) * ph * 20 + ph * ph * 14, ph < 0.5 ? '#ffe36b' : '#ff9a2e'); } }
    else for (let i = 0; i < 5; i++) { const ph = ((t / 300 + i * 1.7) % 3) / 3; cellAt(g, x - 8 + (i * 5) % 18, y - 14 - ph * 22, ph < 0.6 ? '#9af58a' : '#e8ffe0'); }
  }
}
export { prect };
