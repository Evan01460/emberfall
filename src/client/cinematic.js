// Full-screen pixel cinematics: a short promotion for ASCENDING, a grander one for each HIDDEN class, and a unique long sequence for every
// MYTHIC class. They are drawn on a small canvas (320×180) scaled up with crisp pixels, driven by the server's `cine` message, and
// can be skipped with a click or Esc once they have been running for a moment.
import { sfx } from './sfx.js';
import { personSprite } from './sprites.js';
import { CLASSES } from '../data.js';

const W = 320, H = 180, TAU = Math.PI * 2;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a), ease = (x) => x * x * (3 - 2 * x), clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
let active = null; const waiters = [];
export const cinematicActive = () => !!active;
export const afterCinematic = (fn) => { if (active) waiters.push(fn); else fn(); };

// ── tiny toolkit ────────────────────────────────────────────────────────────────────────────────────────────────────────────
class Ctx {
  constructor(g) { this.g = g; this.ps = []; }
  px(x, y, c, w = 1, h = 1, a = 1) { const g = this.g; g.globalAlpha = a; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); g.globalAlpha = 1; }
  line(x0, y0, x1, y1, c, th = 1, a = 1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const k = n ? i / n : 0; this.px(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, c, th, th, a); } }
  ring(cx, cy, r, c, th = 1, a = 1, from = 0, to = TAU) { const n = Math.max(12, Math.round(r * 2.4)); for (let i = 0; i < n; i++) { const an = from + (to - from) * (i / n); this.px(cx + Math.cos(an) * r, cy + Math.sin(an) * r, c, th, th, a); } }
  disc(cx, cy, r, c, a = 1) { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); this.px(cx - w, cy + y, c, w * 2 + 1, 1, a); } }
  text(s, x, y, size, c, align = 'center', a = 1) { const g = this.g; g.save(); g.globalAlpha = a; g.font = `${size}px Pixel, monospace`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(s, Math.round(x) + 1, Math.round(y) + 1); g.fillStyle = c; g.fillText(s, Math.round(x), Math.round(y)); g.restore(); }
  spawn(o) { this.ps.push({ life: 1, age: 0, g: 0, size: 1, ...o }); }
  step(dt) { for (let i = this.ps.length - 1; i >= 0; i--) { const p = this.ps[i]; p.age += dt; if (p.age > p.life) { this.ps.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; this.px(p.x, p.y, p.color, p.size, p.size, 1 - Math.pow(p.age / p.life, 1.6)); } }
  // The character sprite itself (the same pixel-art person the world shows), enlarged with whole-pixel scaling and a coloured outline.
  hero(id, cx, feet, scale, color, a = 1, bob = 0) {
    const cls = CLASSES[id]; if (!cls) return; const key = `${id}:${color}`; let sp = HEROES.get(key);
    if (!sp) { const base = personSprite(id, 'd', 0, 3, cls.color, {}), sil = document.createElement('canvas'); sil.width = base.width; sil.height = base.height; const s = sil.getContext('2d'); s.drawImage(base, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = color; s.fillRect(0, 0, sil.width, sil.height); sp = { base, sil }; HEROES.set(key, sp); }
    const g = this.g, w = sp.base.width * scale, h = sp.base.height * scale, x = Math.round(cx - w / 2), y = Math.round(feet - h + bob); g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = a;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) g.drawImage(sp.sil, x + dx * 2, y + dy * 2, w, h);
    g.drawImage(sp.base, x, y, w, h); g.restore();
  }
  vignette(a) { const g = this.g; const gr = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 190); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  flash(a, c = '#ffffff') { this.px(0, 0, c, W, H, clamp01(a)); }
}
const bg = (c, col) => { c.px(0, 0, col, W, H); };
const HEROES = new Map();

// ── shared finale: the title card ─────────────────────────────────────────────────────────────────────────────────────────────
function title(c, t, t0, big, small, color, sub, hero = null) {
  const k = seg(t, t0, t0 + 0.8); if (k <= 0) return;
  if (hero) c.hero(hero, W / 2, 178, 4, color, k, Math.round(Math.sin(t * 2.4) * 1.5));
  const dy = hero ? -32 : 0;
  c.text(small, W / 2, 62 + dy, 9, '#d8cdbd', 'center', k);
  c.text(big, W / 2, 84 + dy, 22, color, 'center', k);
  if (sub) c.text(sub, W / 2, 106 + dy, 9, '#efe6d8', 'center', seg(t, t0 + 0.6, t0 + 1.6));
  const w = 60 + 140 * ease(seg(t, t0 + 0.2, t0 + 1.2)); c.px(W / 2 - w / 2, 96 + dy, color, w, 1, k * 0.9);
}

// ── ASCENSION (≈5 s): a pillar of light, rising rings, a flash and the new path's name ───────────────────────────────────────────────
function ascend(c, t, o) {
  bg(c, '#0a0714'); const col = o.color ?? '#ffd36a', k = ease(seg(t, 0, 1.6));
  for (let i = 0; i < 60; i++) { const x = (i * 97) % W, y = (i * 53 + t * 18 * (1 + (i % 3))) % H; c.px(x, H - y, '#3a3060', 1, 1, 0.5); }
  const beam = 10 + 26 * k; c.px(W / 2 - beam / 2, 0, col, beam, H, 0.18 + 0.12 * Math.sin(t * 8)); c.px(W / 2 - beam / 4, 0, '#ffffff', beam / 2, H, 0.28 * k);
  for (let i = 0; i < 5; i++) { const r = ((t * 46 + i * 28) % 140); c.ring(W / 2, 128, r, col, 1, 1 - r / 140); c.ring(W / 2, 128, r * 0.6, '#ffffff', 1, (1 - r / 140) * 0.6); }
  const lift = ease(seg(t, 0.4, 2.8)) * 30; if (t < 2.8) c.hero(o.cls, W / 2, 150 - lift, 3, '#ffffff', 1, Math.round(Math.sin(t * 5)));
  if (Math.random() < 0.8) c.spawn({ x: W / 2 + rnd(-14, 14), y: 150, vx: rnd(-6, 6), vy: rnd(-70, -30), life: rnd(1.2, 2.2), color: Math.random() < 0.5 ? col : '#ffffff', size: Math.random() < 0.2 ? 2 : 1 });
  if (t > 2.6 && t < 2.9) c.flash((2.9 - t) / 0.3);
  title(c, t, 2.8, o.name ?? 'ASCENDED', o.tag ?? 'YOU HAVE ASCENDED', col, o.sub, o.cls);
}

// ── HIDDEN CLASSES (≈7 s): a shared shattering reveal with a motif of its own per class ──────────────────────────────────────────────
const MOTIF = {
  archivist: { col: '#8ad8d0', bg: '#06141a', tag: 'THE PAGE TURNS' },
  desperado: { col: '#ff6aa8', bg: '#16060f', tag: 'ALL IN' },
  soulsmith: { col: '#ff9f6b', bg: '#14080a', tag: 'THE COLD FORGE ANSWERS' },
  broker:    { col: '#e8e8ff', bg: '#0a0a16', tag: 'TOMORROW IS A RUMOUR' },
  transmuter: { col: '#d0a0ff', bg: '#0c0618', tag: 'THE GREAT WORK' },
};
function hidden(c, t, o) {
  const M = MOTIF[o.id] ?? MOTIF.archivist, col = o.color ?? M.col; bg(c, M.bg);
  // rotating sigil
  const sig = ease(seg(t, 0, 2.2)), cx = W / 2, cy = H / 2 + 6;
  for (let i = 0; i < 4; i++) c.ring(cx, cy, 20 + i * 18 + sig * 10, col, 1, 0.45 * sig, t * (i % 2 ? -0.6 : 0.5), t * (i % 2 ? -0.6 : 0.5) + TAU * (0.55 + i * 0.1));
  for (let i = 0; i < 12; i++) { const an = t * 0.5 + (i / 12) * TAU; c.px(cx + Math.cos(an) * 56, cy + Math.sin(an) * 56, col, 2, 2, 0.9 * sig); c.line(cx + Math.cos(an) * 46, cy + Math.sin(an) * 46, cx + Math.cos(an) * 52, cy + Math.sin(an) * 52, col, 1, 0.6 * sig); }
  // per-class motif
  if (o.id === 'archivist') { if (Math.random() < 0.35) { const px0 = rnd(0, W - 6), py0 = -8, vy0 = rnd(20, 44); for (let r = 0; r < 7; r++) c.spawn({ x: px0, y: py0 + r, vx: 0, vy: vy0, life: 4, color: r % 3 === 1 ? '#8a9a90' : '#efe6d0', size: 1 }), c.spawn({ x: px0 + 1, y: py0 + r, vx: 0, vy: vy0, life: 4, color: r % 3 === 1 ? '#8a9a90' : '#efe6d0', size: 1 }), c.spawn({ x: px0 + 2, y: py0 + r, vx: 0, vy: vy0, life: 4, color: '#efe6d0', size: 1 }), c.spawn({ x: px0 + 3, y: py0 + r, vx: 0, vy: vy0, life: 4, color: '#efe6d0', size: 1 }), c.spawn({ x: px0 + 4, y: py0 + r, vx: 0, vy: vy0, life: 4, color: '#d8cdb0', size: 1 }); } if (Math.random() < 0.6) c.spawn({ x: rnd(0, W), y: -4, vx: 0, vy: rnd(40, 90), life: 3, color: '#1a3a40', size: 1 }); for (let i = 0; i < 5; i++) c.line(60 + i * 50, 150 - Math.sin(t * 3 + i) * 6, 70 + i * 50, 140, '#c8fff0', 1, 0.4 * sig); }
  if (o.id === 'desperado') { for (let i = 0; i < 6; i++) { const an = t * 1.2 + (i / 6) * TAU, x = cx + Math.cos(an) * 80, y = cy + Math.sin(an) * 34, w = Math.abs(Math.cos(t * 5 + i)) * 10 + 1; c.px(x - w / 2, y - 7, '#f4eadc', w, 14, sig); c.px(x - w / 2, y - 7, '#ff2a6a', w, 2, sig); } if (Math.random() < 0.5) c.spawn({ x: rnd(60, 260), y: 170, vx: rnd(-10, 10), vy: rnd(-90, -50), life: 1.6, color: '#ffd36a', size: 2, g: 90 }); }
  if (o.id === 'soulsmith') { const hit = Math.floor(t * 1.4); if (Math.floor((t + 0.05) * 1.4) !== hit || (t * 1.4) % 1 < 0.04) for (let i = 0; i < 8; i++) c.spawn({ x: cx, y: 150, vx: rnd(-90, 90), vy: rnd(-120, -30), life: 1.3, color: Math.random() < 0.5 ? '#ffe08a' : '#bfe8ff', size: Math.random() < 0.3 ? 2 : 1, g: 220 }); for (const [x, y, w, h, col2] of [[-34, 146, 14, 5, '#7a828c'], [-34, 146, 14, 1, '#c8d0d8'], [-24, 146, 54, 8, '#6a727c'], [-24, 146, 54, 2, '#e0e8f0'], [-14, 154, 34, 6, '#4a525c'], [-18, 160, 42, 5, '#3a424c'], [-24, 165, 54, 6, '#2a323c']]) c.px(cx + x, y, col2, w, h);
  const sw = Math.abs(Math.sin(t * 1.4 * Math.PI)), hx = cx + 34 - sw * 30, hy = 96 + sw * 40; c.line(hx + 22, hy + 30, hx + 6, hy + 10, '#8f633a', 3); c.line(hx + 22, hy + 30, hx + 6, hy + 10, '#c89a60', 1); for (const [x, y, w, h, col2] of [[0, 0, 22, 14, '#4a525c'], [0, 0, 22, 3, '#e0e8f0'], [0, 11, 22, 3, '#2a323c'], [-3, 3, 3, 8, '#6a727c']]) c.px(hx + x, hy + y, col2, w, h); }
  if (o.id === 'broker') { let y0 = 150; for (let i = 0; i < 18; i++) { const x = 20 + i * 15, v = 20 + 40 * Math.abs(Math.sin(i * 0.7 + t * 1.2)) + i * 2; c.px(x, y0 - v, i % 3 ? '#6fc08b' : '#e0645a', 5, v * sig, 0.7); c.px(x + 2, y0 - v - 8, '#e8e8ff', 1, 8, 0.7); } if (Math.random() < 0.5) c.spawn({ x: rnd(0, W), y: -4, vx: 0, vy: rnd(30, 70), life: 3.5, color: '#ffe36b', size: 2 }); }
  if (o.id === 'transmuter') { for (let i = 0; i < 7; i++) { const x = 40 + i * 40, y = 150 - ((t * 24 + i * 17) % 80); c.disc(x, y, 3 + (i % 3), `hsl(${280 + i * 12 + t * 20}, 70%, 70%)`, 0.55); } const g = seg(t, 1.5, 4.5); c.ring(cx, cy, 30, `rgb(${Math.round(120 + 135 * g)},${Math.round(120 + 90 * g)},${Math.round(130 - 60 * g)})`, 2, 0.9); for (let i = 0; i < 3; i++) { const a0 = t * 0.8 + i * TAU / 3, a1 = a0 + TAU / 3; c.line(cx + Math.cos(a0) * 30, cy + Math.sin(a0) * 30, cx + Math.cos(a1) * 30, cy + Math.sin(a1) * 30, '#ffd36a', 1, 0.8 * g); } }
  // the shatter: cracks race across the screen and the world breaks open
  const crack = ease(seg(t, 3.2, 4.2)); if (crack > 0) for (let i = 0; i < 9; i++) { const an = (i / 9) * TAU + 0.3, r = crack * 190; let x = cx, y = cy; for (let s = 0; s < 14; s++) { const nx = cx + Math.cos(an + Math.sin(s * 2 + i) * 0.15) * (r * (s + 1) / 14), ny = cy + Math.sin(an + Math.cos(s * 3 + i) * 0.15) * (r * (s + 1) / 14); c.line(x, y, nx, ny, '#ffffff', 1, 0.8 * (1 - seg(t, 4.7, 5.6))); x = nx; y = ny; } }
  if (t > 4.2 && t < 4.7) c.flash((4.7 - t) / 0.5, col);
  title(c, t, 4.7, o.name ?? 'HIDDEN CLASS', M.tag, col, o.sub, o.id);
  c.vignette(0.55);
}

// ── MYTHIC CLASSES (≈10 s): five unique sequences ────────────────────────────────────────────────────────────────────────────────
const MYTH = {
  // Yggdrasil's Apostle: a world-tree grows from the dark, branches reaching, petals falling, aurora overhead
  apostle(c, t, o) {
    bg(c, '#04100a'); const col = '#6adf8a';
    for (let i = 0; i < 4; i++) { const y = 30 + i * 12 + Math.sin(t * 0.8 + i) * 6; for (let x = 0; x < W; x += 2) c.px(x, y + Math.sin(x * 0.04 + t + i) * 8, i % 2 ? '#2aa86a' : '#6adf8a', 2, 2, 0.12 + 0.05 * i); }
    const grow = ease(seg(t, 0.5, 5)), tx = W / 2, ty = 168;
    const branch = (x, y, ang, len, depth) => { if (depth < 0 || len < 2) return; const k = clamp01(grow * (1.6 + depth * 0.25) - (5 - depth) * 0.2); if (k <= 0) return; const L = len * k, x2 = x + Math.cos(ang) * L, y2 = y + Math.sin(ang) * L; c.line(x, y, x2, y2, depth > 3 ? '#5a3a1e' : depth > 1 ? '#6a4a28' : '#8a6a38', Math.max(1, Math.round(depth * 0.9))); if (k > 0.9) { if (depth <= 1) for (let j = 0; j < 3; j++) c.px(x2 + rnd(-4, 4), y2 + rnd(-4, 4), j % 2 ? '#6adf8a' : '#c8ffd0', 2, 2, 0.9); branch(x2, y2, ang - 0.5 + Math.sin(t + depth) * 0.04, len * 0.72, depth - 1); branch(x2, y2, ang + 0.5 + Math.sin(t + depth) * 0.04, len * 0.72, depth - 1); } };
    branch(tx, ty, -Math.PI / 2, 46, 6); for (let i = 0; i < 7; i++) { const a = Math.PI / 2 + (i - 3) * 0.4; c.line(tx, ty, tx + Math.cos(a) * 36 * grow, ty + Math.abs(Math.sin(a)) * 8 * grow + 4, '#5a3a1e', 2); }
    if (Math.random() < 0.8) c.spawn({ x: rnd(80, 240), y: rnd(10, 70), vx: rnd(-10, 6), vy: rnd(8, 22), life: 4, color: Math.random() < 0.5 ? '#ffc8e0' : '#c8ffd0', size: 2 }); if (Math.random() < 0.5) c.spawn({ x: rnd(0, W), y: H, vx: rnd(-4, 4), vy: rnd(-26, -10), life: 5, color: '#ffffaa', size: 1 });
    if (t > 5 && t < 5.5) c.flash((5.5 - t) / 0.5, '#c8ffd0'); title(c, t, 5.6, o.name, 'THE WORLD TREE CHOOSES YOU', col, o.sub, o.id); c.vignette(0.5);
  },
  // Void Sovereign: the stars are drawn into a hole in the sky and a crown of nothing forms
  void_sovereign(c, t, o) {
    bg(c, '#030208'); const col = '#9a7aff', cx = W / 2, cy = H / 2;
    for (let i = 0; i < 140; i++) { const a = i * 2.399, r0 = 30 + ((i * 53) % 150), k = seg(t, 0.3, 5), r = r0 * (1 - ease(k)) + 3, an = a + (1 - r / 190) * 6 * k; c.px(cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.75, i % 4 ? '#c8c0ff' : '#ffffff', 1, 1, 0.3 + 0.7 * (1 - r / 190)); }
    const hole = 6 + 26 * ease(seg(t, 0.5, 4)); c.disc(cx, cy, hole + 3, '#3a1a7a', 0.7); c.disc(cx, cy, hole, '#000000'); for (let i = 0; i < 3; i++) c.ring(cx, cy, hole + 6 + i * 4, col, 1, 0.5 - i * 0.12, t * (2 - i * 0.5), t * (2 - i * 0.5) + 4);
    if (t > 4) { const k = ease(seg(t, 4, 6.2)); for (let i = 0; i < 9; i++) { const x = cx - 40 + i * 10, h = (i % 2 ? 14 : 26) + (i === 4 ? 12 : 0); c.px(x, cy - 30 - h * k, '#0a0418', 8, h * k + 8); c.px(x, cy - 30 - h * k, col, 8, 2, k); c.px(x + 3, cy - 30 - h * k - 2, '#ffffff', 2, 2, k); } c.px(cx - 44, cy - 24, col, 88, 3, k); c.px(cx - 44, cy - 24, '#0a0418', 88, 1, k); for (let i = 0; i < 4; i++) if (Math.random() < 0.4) { const x = rnd(0, W); c.line(x, 0, x + rnd(-30, 30), cy - 34, '#c8b8ff', 1, rnd(0.3, 0.9)); } }
    if (t > 6.1 && t < 6.6) c.flash((6.6 - t) / 0.5, '#b8a0ff'); title(c, t, 6.7, o.name, 'A CROWN CUT FROM NOTHING', col, o.sub, o.id); c.vignette(0.6);
  },
  // Titan Forgemaster: a colossal hammer falls on a titan's anvil and molten cracks run across the world
  titan_forgemaster(c, t, o) {
    bg(c, '#120604'); const col = '#ff8a2a', cx = W / 2;
    const swing = ease(seg(t, 0.5, 3)), hit = t >= 3, y = 20 + (hit ? 100 : swing * 100);
    c.px(cx - 70, 150, '#4a3228', 140, 30); c.px(cx - 50, 130, '#5a4034', 100, 22); c.px(cx - 36, 120, '#6a5044', 72, 10); c.px(cx - 80, 118, '#7a6054', 40, 8);
    c.line(cx + 30, 0, cx, y, '#8f633a', 6); c.px(cx - 26, y - 6, '#9aa3ad', 52, 26); c.px(cx - 26, y - 6, '#e0e8f0', 52, 3); c.px(cx - 26, y + 17, '#4a525c', 52, 3);
    if (hit) { const k = t - 3; if (k < 0.12) c.flash(1 - k / 0.12, '#ffe0a0'); for (let i = 0; i < 12; i++) { const an = -Math.PI + (i / 11) * Math.PI, len = Math.min(1, k * 1.6) * (80 + (i % 3) * 40); let x = cx, yy = 122; for (let s = 0; s < 10; s++) { const nx = x + Math.cos(an) * len / 10 + rnd(-3, 3), ny = yy + Math.sin(an) * len / 10 * 0.5 + 4 * Math.abs(Math.cos(an)); c.line(x, yy, nx, ny, '#ff5a1a', 2, 0.9); c.line(x, yy, nx, ny, '#ffe08a', 1, 0.9); x = nx; yy = ny; } } if (k < 0.5 || Math.random() < 0.3) for (let i = 0; i < 6; i++) c.spawn({ x: cx + rnd(-30, 30), y: 118, vx: rnd(-120, 120), vy: rnd(-160, -40), life: rnd(1, 2), color: Math.random() < 0.5 ? '#ffe08a' : '#ff7a2a', size: Math.random() < 0.3 ? 2 : 1, g: 200 }); c.px(0, 168, '#ff5a1a', W, 12, 0.25 + 0.15 * Math.sin(t * 6)); }
    title(c, t, 5.2, o.name, 'THE FIRST FORGE IS LIT', col, o.sub, o.id); c.vignette(0.5);
  },
  // Philosopher's Heir: a transmutation circle turns lead to gold and a golden flask rises
  philosopher(c, t, o) {
    bg(c, '#0b0a10'); const col = '#ffd36a', cx = W / 2, cy = H / 2 + 4, g = seg(t, 1.5, 5.5);
    for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) { const d = Math.hypot(x - cx, y - cy) / 200, m = clamp01((g * 1.4) - d); const r = Math.round(60 + 170 * m), gr = Math.round(62 + 120 * m), b = Math.round(70 - 20 * m); c.px(x, y, `rgb(${r},${gr},${b})`, 11, 11, 0.35); }
    const R = 56 * ease(seg(t, 0, 2)); c.ring(cx, cy, R, col, 2, 0.9); c.ring(cx, cy, R * 0.82, col, 1, 0.7);
    for (const n of [3, 4]) for (let i = 0; i < n; i++) { const a0 = t * (n === 3 ? 0.6 : -0.5) + (i / n) * TAU, a1 = a0 + TAU / n; c.line(cx + Math.cos(a0) * R * 0.82, cy + Math.sin(a0) * R * 0.82, cx + Math.cos(a1) * R * 0.82, cy + Math.sin(a1) * R * 0.82, n === 3 ? '#ffe9a8' : '#c8a040', 1, 0.9); }
    const rise = ease(seg(t, 3, 6)); const fy = cy + 30 - rise * 44; c.px(cx - 5, fy - 14, '#d8e0f0', 10, 6, 0.9); c.px(cx - 11, fy - 8, '#ffd36a', 22, 22, 0.95); c.px(cx - 11, fy - 8, '#fff6c0', 22, 3); c.px(cx - 7, fy + 14, '#a07a1e', 14, 3);
    if (Math.random() < 0.9) c.spawn({ x: cx + rnd(-50, 50), y: cy + rnd(-30, 40), vx: rnd(-6, 6), vy: rnd(-40, -10), life: 2.5, color: Math.random() < 0.5 ? '#ffd36a' : '#ffffff', size: Math.random() < 0.3 ? 2 : 1 });
    if (t > 5.6 && t < 6.1) c.flash((6.1 - t) / 0.5, '#fff0b0'); title(c, t, 6.2, o.name, 'LEAD BECOMES GOLD', col, o.sub, o.id); c.vignette(0.45);
  },
  // Gilded Sovereign: a storm of coins piles up and forms a crown while the ledger counts upward
  gilded(c, t, o) {
    bg(c, '#100c04'); const col = '#ffe36b', cx = W / 2;
    const rate = t < 5 ? 0.5 + t * 0.18 : 0.4; for (let i = 0; i < 4; i++) if (Math.random() < rate) c.spawn({ x: rnd(0, W), y: -4, vx: rnd(-6, 6), vy: rnd(70, 140), life: 2, color: Math.random() < 0.3 ? '#fff6c0' : '#ffd04a', size: Math.random() < 0.4 ? 3 : 2 });
    const pile = ease(seg(t, 0.5, 5)); for (let x = 0; x < W; x += 3) { const h = pile * (28 + 22 * Math.sin(x * 0.05) + 12 * Math.sin(x * 0.17)); c.px(x, H - h, ((x / 3) | 0) % 5 ? '#e0b24a' : '#fff0a8', 3, h, 1); }
    const k = ease(seg(t, 3.5, 6.2)), cy = 52 - 4 * k; for (let i = 0; i < 5; i++) { const x = cx - 40 + i * 20, h = (i % 2 ? 22 : 34) * k; c.px(x - 5, cy - h, '#ffd04a', 10, h + 22 * k); c.px(x - 5, cy - h, '#fff6c0', 10, 2, k); c.disc(Math.round(x), Math.round(cy - h - 3), 4, '#ff5a3a', k); } c.px(cx - 48, cy + 14 * k, '#e0b24a', 96, 10 * k); c.px(cx - 48, cy + 14 * k, '#fff6c0', 96, 2, k);
    const n = Math.floor(1000 * Math.pow(seg(t, 0.5, 6.4), 2) * 38); c.text(`${n.toLocaleString()}g`, W / 2, 20, 12, '#fff0a8', 'center', 0.9);
    if (t > 6.2 && t < 6.7) c.flash((6.7 - t) / 0.5, '#fff0a8'); title(c, t, 6.8, o.name, 'THE MARKET BOWS', col, o.sub, o.id); c.vignette(0.4);
  },
};

// ── player ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const LEN = { ascend: 6.4, hidden: 8.4, mythic: 10.4 };
export function playCinematic(o) {
  if (active) return; const scene = o.kind === 'mythic' ? MYTH[o.id] : o.kind === 'hidden' ? (c, t, x) => hidden(c, t, x) : (c, t, x) => ascend(c, t, x);
  if (!scene) return;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'cinematic';
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;image-rendering:pixelated;background:#000;z-index:90;cursor:pointer;opacity:0;transition:opacity .5s';
  document.body.append(cv); requestAnimationFrame(() => { cv.style.opacity = '1'; });
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const c = new Ctx(g), start = performance.now(), total = (LEN[o.kind] ?? 7) * 1000; let last = start, done = false, raf = 0;
  sfx('secret', 600); setTimeout(() => sfx('secret', 900), 1800); if (o.kind !== 'ascend') setTimeout(() => sfx('anvil', 100), 3200);
  const hint = document.createElement('div'); hint.textContent = 'click to skip'; hint.style.cssText = 'position:fixed;right:14px;bottom:10px;z-index:91;color:#8a8099;font:12px Pixel,monospace;opacity:0;transition:opacity .6s'; document.body.append(hint); setTimeout(() => { hint.style.opacity = '1'; }, 1500);
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true); cv.style.opacity = '0'; hint.remove(); setTimeout(() => { cv.remove(); active = null; for (const f of waiters.splice(0)) f(); }, 500); };
  const key = (e) => { if (e.key === 'Escape' && performance.now() - start > 1200) { e.stopPropagation(); finish(); } };
  addEventListener('keydown', key, true); cv.addEventListener('click', () => { if (performance.now() - start > 1200) finish(); });
  const loop = (now) => { const t = (now - start) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now; scene(c, t, o); c.step(dt); if (now - start > total) return finish(); raf = requestAnimationFrame(loop); };
  active = { cv, finish }; raf = requestAnimationFrame(loop);
}
export const skipCinematic = () => active?.finish();
