// Full-screen PIXEL-ART cinematics: a promotion for ASCENDING, a grander one for each HIDDEN class, and a unique long sequence for every
// MYTHIC class. Everything is drawn on a 320×180 canvas that is scaled up with whole-pixel blocks, in the same style as the game:
//   · hand-shaded sprites with dark outlines and 3-4 tone palettes (no translucent smears — fades and glows use ordered dithering),
//   · text rendered crisp (anti-aliasing is thresholded away),
//   · the real character sprites, enlarged by whole numbers.
// Driven by the server's `cine` message. A click or Esc skips it once it has been running for a moment.
import { sfx } from './sfx.js';
import { personSprite } from './sprites.js';
import { CLASSES } from '../data.js';

const W = 320, H = 180, TAU = Math.PI * 2;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a), ease = (x) => x * x * (3 - 2 * x), clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x, y, lvl) => BAYER[((y & 3) << 2) | (x & 3)] < lvl * 16;   // ordered dither: true for roughly `lvl` of the pixels
let active = null; const waiters = [];
export const cinematicActive = () => !!active;
export const afterCinematic = (fn) => { if (active) waiters.push(fn); else fn(); };

// ── sprite sheets drawn from text ────────────────────────────────────────────────────────────────────────────────────────────────
const cache = new Map();
function sprite(rows, pal) {
  const key = rows.join('|') + JSON.stringify(pal); let cv = cache.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = rows[0].length; cv.height = rows.length; const g = cv.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } })); cache.set(key, cv); return cv;
}
function squash(cv, w, key) { // a coin turning: nearest-neighbour column resample
  const k = `${key}:${w}`; let o = cache.get(k); if (o) return o; o = document.createElement('canvas'); o.width = Math.max(1, w); o.height = cv.height; const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let x = 0; x < o.width; x++) g.drawImage(cv, Math.floor((x / o.width) * cv.width), 0, 1, cv.height, x, 0, 1, cv.height); cache.set(k, o); return o;
}
const COIN = sprite(['..ooo..', '.ollgo.', 'olgggdo', 'ogggddo', 'ogggddo', '.oddddo', '..ooo..'], { o: '#6a4a10', g: '#ffd04a', l: '#fff6c0', d: '#c8902a' });
const COIN_FRAMES = [7, 5, 3, 1, 3, 5].map((w) => squash(COIN, w, 'coin'));
const starSpr = (col) => sprite(['..l..', '..l..', 'lllll', '..l..', '..l..'], { l: col });
const STAR = starSpr('#ffffff');
const PETAL = sprite(['.p.', 'ppp', '.p.'], { p: '#ffb8d8' }), PETAL2 = sprite(['.p.', 'ppp', '.p.'], { p: '#c8ffd0' });
const CARD = sprite(['ooooooo', 'owwwwwo', 'owrwrwo', 'owrrrwo', 'owwrwwo', 'owwwwwo', 'owwwwwo', 'owwwwwo', 'owwwwwo', 'ooooooo'], { o: '#3a1a2a', w: '#f4eadc', r: '#e0306a' });
const PAGE = sprite(['ooooooo', 'owwwwdo', 'owkkkwo', 'owwwwwo', 'owkkkkd', 'owwwwwo', 'owkkwwo', 'owwwwwo', 'ooooooo'], { o: '#3a3a30', w: '#efe6d0', d: '#b8ac90', k: '#2a4a50' });
const flask = (liq) => sprite(['...ooo...', '...owo...', '...owo...', '..owwwo..', '.owwwwwo.', 'owwwwwwwo', 'owLLLLLwo', 'oLLLLLLLo', 'oLLhLLLLo', 'oLLLLLLLo', '.oLLLLLo.', '..ooooo..'], { o: '#1a1a2a', w: '#dfe8ff', L: liq, h: '#ffffff' });
const EMBER = sprite(['yy', 'yo'], { y: '#ffe08a', o: '#ff7a2a' }), EMBER_C = sprite(['yy', 'yo'], { y: '#e8f6ff', o: '#8ac8ff' });
const FLASK_COLORS = ['#c070ff', '#ff70c0', '#70c0ff', '#70ffc0', '#ffd070', '#ff9070'];

// ── the canvas wrapper ────────────────────────────────────────────────────────────────────────────────────────────────────────────
class Ctx {
  constructor(g) { this.g = g; this.ps = []; this.img = g.createImageData(W, H); this.u32 = new Uint32Array(this.img.data.buffer); this.glyphs = new Map(); }
  // background layer (written per pixel): colour fill, glows, dithered bands — all opaque
  begin(color) { const [r, g, b] = hex(color), v = (255 << 24) | (b << 16) | (g << 8) | r; this.u32.fill(v); }
  put(x, y, rgb) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; this.u32[y * W + x] = (255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]; }
  glow(cx, cy, r, color, strength = 1, sy = 1) { const rgb = hex(color); for (let y = Math.max(0, (cy - r * sy) | 0); y < Math.min(H, cy + r * sy); y++) for (let x = Math.max(0, (cx - r) | 0); x < Math.min(W, cx + r); x++) { const d = Math.hypot((x - cx) / r, (y - cy) / (r * sy)); if (d < 1 && dith(x, y, (1 - d) * strength)) this.put(x, y, rgb); } }
  band(y0, y1, color, lvl, off = 0) { const rgb = hex(color); for (let y = y0 | 0; y < y1; y++) for (let x = 0; x < W; x++) if (dith(x + off, y, lvl)) this.put(x, y, rgb); }
  vignette(strength) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)); if (d > 0.7 && dith(x, y, (d - 0.7) * 1.6 * strength)) this.u32[y * W + x] = 0xff000000; } }
  flush() { this.g.putImageData(this.img, 0, 0); }
  // crisp primitives (everything below is opaque pixels)
  px(x, y, c, w = 1, h = 1) { this.g.fillStyle = c; this.g.fillRect(Math.round(x), Math.round(y), w, h); }
  line(x0, y0, x1, y1, c, th = 1) { let x = Math.round(x0), y = Math.round(y0); const X = Math.round(x1), Y = Math.round(y1), dx = Math.abs(X - x), dy = -Math.abs(Y - y), sx = x < X ? 1 : -1, sy = y < Y ? 1 : -1; let e = dx + dy, n = 0; for (;;) { this.px(x - ((th - 1) >> 1), y - ((th - 1) >> 1), c, th, th); if ((x === X && y === Y) || ++n > 800) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x += sx; } if (e2 <= dx) { e += dx; y += sy; } } }
  ring(cx, cy, r, c, step = 1, from = 0, to = TAU, dash = 0) { const n = Math.max(16, Math.round(r * 5)); let last = ''; for (let i = 0; i <= n; i++) { if (dash && ((i / dash) | 0) % 2) continue; const a = from + (to - from) * (i / n), x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r), k = x + ',' + y; if (k !== last) this.px(x, y, c, step, step); last = k; } }
  discShaded(cx, cy, r, pal) { // pal: [outline, dark, mid, light, highlight] — lit from the upper-left, dithered between tones
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d > r + 0.2) continue; if (d > r - 1) { this.px(cx + x, cy + y, pal[0]); continue; } const l = clamp01(0.55 - (x * 0.55 + y * 0.75) / (r * 1.6)), idx = 1 + Math.min(3, Math.floor(l * 4.4 + (dith(cx + x, cy + y, 0.5) ? 0.35 : 0))); this.px(cx + x, cy + y, pal[idx]); } }
  bevel(x, y, w, h, pal) { // pal: [outline, light, mid, dark]
    if (w < 3 || h < 3) return; this.px(x, y, pal[0], w, h); this.px(x + 1, y + 1, pal[2], w - 2, h - 2); this.px(x + 1, y + 1, pal[1], w - 2, 1); this.px(x + 1, y + 1, pal[1], 1, h - 2); this.px(x + 1, y + h - 2, pal[3], w - 2, 1); this.px(x + w - 2, y + 1, pal[3], 1, h - 2); }
  tri(cx, top, w, h, pal) { for (let r = 0; r < h; r++) { const ww = Math.max(1, Math.round((w * (r + 1)) / h)), x = Math.round(cx - ww / 2); this.px(x, top + r, pal[0], ww, 1); if (ww > 3) { this.px(x + 1, top + r, pal[1], Math.ceil((ww - 2) / 2), 1); this.px(x + 1 + Math.ceil((ww - 2) / 2), top + r, pal[3], Math.floor((ww - 2) / 2), 1); } } }
  img_(cv, x, y, s = 1) { const g = this.g; g.imageSmoothingEnabled = false; g.drawImage(cv, Math.round(x), Math.round(y), cv.width * s, cv.height * s); }
  hero(id, cx, feet, scale, color, bob = 0) {
    const cls = CLASSES[id]; if (!cls) return; const key = `hero:${id}:${color}`; let sp = this.glyphs.get(key);
    if (!sp) { const base = personSprite(id, 'd', 0, 3, cls.color, {}), sil = document.createElement('canvas'); sil.width = base.width; sil.height = base.height; const s = sil.getContext('2d'); s.drawImage(base, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = color; s.fillRect(0, 0, sil.width, sil.height); sp = { base, sil }; this.glyphs.set(key, sp); }
    const w = sp.base.width * scale, h = sp.base.height * scale, x = Math.round(cx - w / 2), y = Math.round(feet - h + bob), g = this.g; g.imageSmoothingEnabled = false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) g.drawImage(sp.sil, x + dx * 2, y + dy * 2, w, h); g.drawImage(sp.base, x, y, w, h); }
  // crisp text: draw once with the browser, throw the anti-aliasing away (alpha threshold) and keep a hard-edged pixel mask
  text(str, x, y, size, color, align = 'center') {
    const key = `${str}|${size}|${color}`; let o = this.glyphs.get(key);
    if (!o) { const t = document.createElement('canvas'), g = t.getContext('2d', { willReadFrequently: true }); g.font = `${size}px Pixel, monospace`; const w = Math.ceil(g.measureText(str).width) + 4, h = size + 6; t.width = w; t.height = h; g.font = `${size}px Pixel, monospace`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(str, 2, h / 2 + 1);
      const d = g.getImageData(0, 0, w, h), [r, gg, b] = hex(color); for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i + 3] > 120; d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = on ? 255 : 0; } g.putImageData(d, 0, 0);
      const ol = document.createElement('canvas'); ol.width = w + 2; ol.height = h + 2; const og = ol.getContext('2d'); og.imageSmoothingEnabled = false; for (const [dx, dy] of [[0, 1], [1, 0], [2, 1], [1, 2], [0, 0], [2, 2], [0, 2], [2, 0]]) og.drawImage(t, dx, dy); og.globalCompositeOperation = 'source-in'; og.fillStyle = '#05030a'; og.fillRect(0, 0, w + 2, h + 2); og.globalCompositeOperation = 'source-over'; og.drawImage(t, 1, 1);
      o = { cv: ol, w, h }; this.glyphs.set(key, o); }
    const gx = align === 'center' ? Math.round(x - o.w / 2) : align === 'right' ? Math.round(x - o.w) : Math.round(x); this.g.imageSmoothingEnabled = false; this.g.drawImage(o.cv, gx - 1, Math.round(y - o.h / 2) - 1); }
  spawn(o) { this.ps.push({ life: 1, age: 0, g: 0, vx: 0, vy: 0, ...o }); }
  step(dt) { for (let i = this.ps.length - 1; i >= 0; i--) { const p = this.ps[i]; p.age += dt; if (p.age > p.life) { this.ps.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt + (p.sway ? Math.sin(p.age * 3 + p.seed) * p.sway * dt : 0); const k = p.age / p.life; if (k > 0.7 && !dith(Math.round(p.x), Math.round(p.y), 1 - (k - 0.7) / 0.3)) continue; if (p.spr) { const f = p.frames ? p.frames[Math.floor((p.age * 7 + (p.seed || 0)) % p.frames.length)] : p.spr; this.img_(f, p.x - f.width / 2, p.y - f.height / 2); } else this.px(p.x, p.y, p.color, p.size ?? 1, p.size ?? 1); } }
  flash(a, c = '#ffffff') { const [r, g, b] = hex(c), lvl = clamp01(a), v = (255 << 24) | (b << 16) | (g << 8) | r; this.flushed = true; const d = this.g.getImageData(0, 0, W, H), u = new Uint32Array(d.data.buffer); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dith(x, y, lvl)) u[y * W + x] = v; this.g.putImageData(d, 0, 0); }
}
const dust = (c, n, o) => { for (let i = 0; i < n; i++) c.spawn(o()); };

// ── title card shared by all sequences ─────────────────────────────────────────────────────────────────────────────────────────
function title(c, t, t0, big, small, color, sub, hero = null) {
  const k = seg(t, t0, t0 + 0.9); if (k <= 0) return; const dy = hero ? -32 : 0;
  if (hero) c.hero(hero, W / 2, 178, 4, color, Math.round(Math.sin(t * 2.4) * 1.5));
  if (k > 0.1) c.text(small, W / 2, 62 + dy, 9, '#d8cdbd');
  if (k > 0.3) c.text(big, W / 2, 84 + dy, 22, color);
  const w = Math.round(40 + 160 * ease(seg(t, t0 + 0.2, t0 + 1.3))); c.px(W / 2 - w / 2, 96 + dy, color, w, 1); c.px(W / 2 - w / 2, 97 + dy, '#05030a', w, 1);
  if (sub && seg(t, t0 + 0.6, t0 + 1.6) > 0.5) c.text(sub, W / 2, 106 + dy, 9, '#efe6d8');
}
const sparkles = (c, n, x0, x1, y0, y1, colors, life = 2) => { for (let i = 0; i < n; i++) if (Math.random() < 0.6) { const col = colors[(Math.random() * colors.length) | 0]; c.spawn({ x: rnd(x0, x1), y: rnd(y0, y1), vx: rnd(-6, 6), vy: rnd(-34, -8), life: rnd(life * 0.6, life), spr: starSpr(col) }); } };

// ── ASCENSION (≈6 s): a column of light, rising rings, the character lifted into it, then the new path's name ────────────────────────
function ascend(c, t, o) {
  const col = o.color ?? '#ffd36a', k = ease(seg(t, 0, 1.6)); c.begin('#0a0714');
  c.band(0, H, '#14102a', 0.35); c.band(0, H, '#241a48', 0.12, 2);
  const bw = Math.round(8 + 26 * k); for (let x = Math.round(W / 2 - bw / 2); x < W / 2 + bw / 2; x++) for (let y = 0; y < H; y++) { const edge = Math.abs(x - W / 2) / (bw / 2); c.put(x, y, hex(edge < 0.45 ? '#fff6e0' : dith(x, y, 0.65) ? col : '#2a2048')); }
  c.glow(W / 2, 150, 70, col, 0.9, 0.5); c.vignette(0.7); c.flush();
  for (let i = 0; i < 5; i++) { const r = Math.round((t * 44 + i * 28) % 140); if (r > 4) { c.ring(W / 2, 150, r, col, 1, 0, TAU, 4); c.ring(W / 2, 150, r * 0.6, '#ffffff', 1, 0, TAU, 7); } }
  if (t < 2.8) c.hero(o.cls, W / 2, 150 - ease(seg(t, 0.4, 2.8)) * 30, 3, '#ffffff', Math.round(Math.sin(t * 5)));
  sparkles(c, 2, W / 2 - 16, W / 2 + 16, 150, 160, ['#ffffff', col, '#fff6c0']);
  c.step(0.016); if (t > 2.6 && t < 2.9) c.flash((2.9 - t) / 0.3);
  title(c, t, 2.8, o.name ?? 'ASCENDED', o.tag ?? 'YOU HAVE ASCENDED', col, o.sub, o.cls);
}

// ── HIDDEN CLASSES (≈8 s): a rotating sigil, a motif of its own, the world cracking open, the new hero steps out ───────────────────
const MOTIF = {
  archivist: { col: '#8ad8d0', bg: '#06141a', tag: 'THE PAGE TURNS' }, desperado: { col: '#ff6aa8', bg: '#16060f', tag: 'ALL IN' }, soulsmith: { col: '#ff9f6b', bg: '#14080a', tag: 'THE COLD FORGE ANSWERS' },
  broker: { col: '#e8e8ff', bg: '#0a0a16', tag: 'TOMORROW IS A RUMOUR' }, transmuter: { col: '#d0a0ff', bg: '#0c0618', tag: 'THE GREAT WORK' },
};
function hidden(c, t, o) {
  const M = MOTIF[o.id] ?? MOTIF.archivist, col = o.color ?? M.col, sig = ease(seg(t, 0, 2.2)), cx = W / 2, cy = H / 2 + 6; c.begin(M.bg);
  c.band(0, H, '#0e0a1c', 0.3); c.glow(cx, cy, 90 * sig + 4, col, 0.55); c.vignette(0.8); c.flush();
  for (let i = 0; i < 4; i++) c.ring(cx, cy, Math.round(20 + i * 18 + sig * 10), col, 1, t * (i % 2 ? -0.6 : 0.5), t * (i % 2 ? -0.6 : 0.5) + TAU * (0.55 + i * 0.1), i % 2 ? 3 : 0);
  for (let i = 0; i < 12; i++) { const an = t * 0.5 + (i / 12) * TAU; c.px(cx + Math.cos(an) * 56 - 1, cy + Math.sin(an) * 56 - 1, col, 3, 3); c.line(cx + Math.cos(an) * 46, cy + Math.sin(an) * 46, cx + Math.cos(an) * 52, cy + Math.sin(an) * 52, col); }
  if (o.id === 'archivist') { if (Math.random() < 0.3) c.spawn({ x: rnd(8, W - 8), y: -10, vy: rnd(18, 36), life: 6, spr: PAGE, sway: 40, seed: rnd(0, 6) }); if (Math.random() < 0.5) c.spawn({ x: rnd(0, W), y: -4, vy: rnd(60, 110), life: 3, color: '#2a6a70', size: 1 }); c.text('A', cx, cy, 14, col); }
  if (o.id === 'desperado') { for (let i = 0; i < 6; i++) { const an = t * 1.2 + (i / 6) * TAU, x = cx + Math.cos(an) * 84, y = cy + Math.sin(an) * 34, w = Math.max(1, Math.round(Math.abs(Math.cos(t * 5 + i)) * 7)); c.img_(squash(CARD, w, 'card'), x - w / 2, y - 5); } if (Math.random() < 0.4) c.spawn({ x: rnd(60, 260), y: 176, vx: rnd(-14, 14), vy: rnd(-120, -70), life: 1.9, g: 150, spr: COIN, frames: COIN_FRAMES, seed: rnd(0, 6) }); }
  if (o.id === 'soulsmith') { const ph = (t * 1.4) % 1, sw = ph < 0.5 ? ease(ph / 0.5) : 1 - ease((ph - 0.5) / 0.5), hx = cx + 30 - sw * 22, hy = 84 + sw * 46;
    c.bevel(cx - 30, 150, 60, 9, ['#14181c', '#e0e8f0', '#8a929c', '#4a525c']); c.bevel(cx - 14, 158, 28, 7, ['#14181c', '#c8d0d8', '#6a727c', '#3a424c']); c.bevel(cx - 22, 164, 44, 8, ['#14181c', '#aab2bc', '#5a626c', '#2a323c']); c.bevel(cx - 42, 150, 14, 5, ['#14181c', '#e0e8f0', '#8a929c', '#4a525c']);
    c.line(hx + 22, hy + 36, hx + 8, hy + 12, '#2a1808', 5); c.line(hx + 22, hy + 36, hx + 8, hy + 12, '#8f633a', 3); c.line(hx + 21, hy + 35, hx + 7, hy + 11, '#c89a60', 1); c.bevel(hx - 2, hy, 28, 16, ['#14181c', '#e8f0ff', '#8a929c', '#3a424c']); c.px(hx + 2, hy + 5, '#ffffff', 2, 2); c.px(hx + 20, hy + 9, '#ffffff', 2, 2);
    if (ph > 0.48 && ph < 0.54) dust(c, 10, () => ({ x: cx + rnd(-10, 10), y: 148, vx: rnd(-110, 110), vy: rnd(-150, -40), life: rnd(0.8, 1.5), g: 260, spr: Math.random() < 0.5 ? EMBER : EMBER_C })); }
  if (o.id === 'broker') { for (let i = 0; i < 17; i++) { const x = 24 + i * 16, v = Math.round((16 + 38 * Math.abs(Math.sin(i * 0.7 + t * 1.2)) + i * 2) * sig), up = i % 3 !== 0, pal = up ? ['#0f2a1a', '#8af0a8', '#3a9a5a', '#1f5a34'] : ['#2a0f12', '#f08a8a', '#c04a4a', '#7a2428']; c.px(x + 4, 160 - v - 8, '#e8e8ff', 1, 8); c.bevel(x, 160 - v, 10, v, pal); }
    if (Math.random() < 0.4) c.spawn({ x: rnd(0, W), y: -6, vy: rnd(30, 70), life: 4, spr: COIN, frames: COIN_FRAMES, seed: rnd(0, 6) }); }
  if (o.id === 'transmuter') { for (let i = 0; i < 6; i++) { const x = 38 + i * 48, y = 150 - ((t * 20 + i * 17) % 70); c.img_(flask(FLASK_COLORS[i]), x, y, 1); } const g2 = seg(t, 1.5, 4.5), pc = `rgb(${Math.round(150 + 105 * g2)},${Math.round(120 + 90 * g2)},${Math.round(190 - 130 * g2)})`; c.ring(cx, cy, 30, pc, 2); for (let i = 0; i < 3; i++) { const a0 = t * 0.8 + (i * TAU) / 3, a1 = a0 + TAU / 3; c.line(cx + Math.cos(a0) * 30, cy + Math.sin(a0) * 30, cx + Math.cos(a1) * 30, cy + Math.sin(a1) * 30, '#ffd36a'); } }
  const crack = ease(seg(t, 3.2, 4.2)), fade = 1 - seg(t, 4.7, 5.6);
  if (crack > 0 && fade > 0) for (let i = 0; i < 9; i++) { const an = (i / 9) * TAU + 0.3, r = crack * 190; let x = cx, y = cy; for (let s = 0; s < 14; s++) { const nx = cx + Math.cos(an + Math.sin(s * 2 + i) * 0.15) * ((r * (s + 1)) / 14), ny = cy + Math.sin(an + Math.cos(s * 3 + i) * 0.15) * ((r * (s + 1)) / 14); if (dith(s, i, fade)) { c.line(x, y, nx, ny, '#ffffff', 1); c.px(x, y + 1, col, 1, 1); } x = nx; y = ny; } }
  c.step(0.016); if (t > 4.2 && t < 4.7) c.flash((4.7 - t) / 0.5, col);
  title(c, t, 4.7, o.name ?? 'HIDDEN CLASS', M.tag, col, o.sub, o.id);
}

// ── MYTHIC CLASSES (≈10 s): five unique sequences ──────────────────────────────────────────────────────────────────────────────────
const LEAF = [['#0e3a1a', '#1f6a34', '#3aa850', '#7ae890', '#d8ffe0'], ['#0e3a2a', '#1f6a4a', '#3aa87a', '#7ae8b8', '#d8fff0']];
const BARK = ['#1a0e06', '#4a2e16', '#6a4524', '#8f6334'];
const MYTH = {
  // Yggdrasil's Apostle — the world-tree grows out of the dark: shaded trunk and boughs, leaf-clumps, falling petals, an aurora of dithered light
  apostle(c, t, o) {
    c.begin('#03100a'); for (let i = 0; i < 4; i++) { const y0 = 18 + i * 14; for (let x = 0; x < W; x++) { const yy = y0 + Math.round(Math.sin(x * 0.04 + t * 0.8 + i) * 7); c.put(x, yy, hex(i % 2 ? '#2aa86a' : '#6adf8a')); c.put(x, yy + 1, hex(i % 2 ? '#1a6a44' : '#2aa86a')); if (i < 2) c.put(x, yy + 2, hex('#0f4a2c')); } }
    c.glow(W / 2, 150, 90, '#2aa86a', 0.75, 0.9); c.band(166, H, '#0a2a14', 1); c.vignette(0.75); c.flush();
    const grow = ease(seg(t, 0.4, 5.2)), tx = W / 2, ty = 170, leaves = [];
    const bough = (x, y, ang, len, depth) => { const k = clamp01(grow * (1.5 + depth * 0.2) - (5 - depth) * 0.16); if (k <= 0 || len < 3) return; const L = len * k, x2 = x + Math.cos(ang) * L, y2 = y + Math.sin(ang) * L, th = Math.max(1, depth > 4 ? 6 : depth > 3 ? 4 : depth > 1 ? 3 : 2);
      c.line(x, y, x2, y2, BARK[0], th + 2); c.line(x, y, x2, y2, BARK[2], th); c.line(x - 1, y, x2 - 1, y2, BARK[3], Math.max(1, th - 2)); c.line(x + 1, y, x2 + 1, y2, BARK[1], 1);
      if (k > 0.85) { if (depth <= 3) leaves.push([x2, y2, depth]); bough(x2, y2, ang - 0.52 + Math.sin(t * 0.9 + depth) * 0.03, len * 0.74, depth - 1); bough(x2, y2, ang + 0.52 + Math.sin(t * 0.9 + depth) * 0.03, len * 0.74, depth - 1); } };
    for (let i = 0; i < 7; i++) { const a = Math.PI / 2 + (i - 3) * 0.42, rl = 38 * grow; c.line(tx, ty - 2, tx + Math.cos(a) * rl, ty + 2 + Math.abs(Math.sin(a)) * 6 * grow, BARK[0], 4); c.line(tx, ty - 2, tx + Math.cos(a) * rl, ty + 2 + Math.abs(Math.sin(a)) * 6 * grow, BARK[1], 2); }
    bough(tx, ty, -Math.PI / 2, 50, 6);
    leaves.sort((a, b) => a[1] - b[1]).forEach(([x, y, d], i) => { const r = 6 + (d === 0 ? 4 : d === 1 ? 3 : d === 2 ? 2 : 0) + ((i * 7) % 3), sw = Math.sin(t * 1.3 + i); for (const [ox, oy, rr] of [[-r * 0.8, r * 0.5, r - 2], [r * 0.8, r * 0.4, r - 2], [0, -r * 0.3, r]]) c.discShaded(Math.round(x + ox + sw), Math.round(y + oy), Math.max(3, Math.round(rr)), LEAF[(i + (ox > 0 ? 1 : 0)) % 2]); });
    if (Math.random() < 0.55 && grow > 0.5) c.spawn({ x: rnd(80, 240), y: rnd(20, 70), vx: rnd(-8, 4), vy: rnd(10, 22), life: 5, spr: Math.random() < 0.5 ? PETAL : PETAL2, sway: 30, seed: rnd(0, 6) });
    sparkles(c, 1, 60, 260, 120, 176, ['#fffbb0', '#c8ffd0'], 3);
    c.step(0.016); if (t > 5.2 && t < 5.7) c.flash((5.7 - t) / 0.5, '#c8ffd0'); title(c, t, 5.7, o.name, 'THE WORLD TREE CHOOSES YOU', '#6adf8a', o.sub, o.id);
  },
  // Void Sovereign — the stars are drawn into a hole in the sky; an accretion disc burns; a spiked crown of nothing forms
  void_sovereign(c, t, o) {
    const cx = W / 2, cy = H / 2 + 6, hole = Math.round(5 + 24 * ease(seg(t, 0.5, 4))); c.begin('#030208');
    for (let i = 0; i < 90; i++) { const a = i * 2.399 + t * 0.2, r0 = 40 + ((i * 53) % 150), k = seg(t, 0.3, 5), r = r0 * (1 - ease(k)) + hole, an = a + (1 - r / 190) * 7 * k; const x = cx + Math.cos(an) * r, y = cy + Math.sin(an) * r * 0.7; c.put(x, y, hex(i % 4 ? '#c8c0ff' : '#ffffff')); if (r > hole + 14) c.put(x - Math.cos(an + 1.57) * 2, y - Math.sin(an + 1.57) * 1.4, hex('#6a5ac8')); }
    for (let y = -22; y <= 22; y++) for (let x = -90; x <= 90; x++) { const d = Math.hypot(x / 90, y / 22); if (d > 0.3 && d < 1) { const lvl = (1 - d) * (hole / 29) * 1.2; if (dith(cx + x, cy + y, lvl)) c.put(cx + x, cy + y, hex(d < 0.55 ? '#ffb86a' : d < 0.8 ? '#c85aff' : '#5a3aa8')); } }
    c.glow(cx, cy, hole + 26, '#6a3ac8', 0.8); for (let y = -hole; y <= hole; y++) for (let x = -hole; x <= hole; x++) if (x * x + y * y <= hole * hole) c.put(cx + x, cy + y, [0, 0, 0]); c.vignette(0.9); c.flush();
    if (t > 4) { const k = ease(seg(t, 4, 6.2)), by = cy - 34; const pal = ['#1a0a38', '#9a7aff', '#2a1058', '#0a0418']; c.bevel(cx - 46, by + 14, 92, 9, pal); for (let i = 0; i < 9; i++) { const x = cx - 40 + i * 10, h = Math.round(((i % 2 ? 14 : 26) + (i === 4 ? 14 : 0)) * k); if (h > 1) { c.tri(x, by + 14 - h, 10, h, pal); c.px(x - 1, by + 12 - h, '#e8e0ff', 3, 3); } } for (let i = 0; i < 3; i++) if (Math.random() < 0.5) { let x = rnd(60, 260), y = 0; while (y < by) { const nx = x + rnd(-8, 8), ny = y + rnd(8, 14); c.line(x, y, nx, ny, '#e8e0ff'); c.line(x + 1, y, nx + 1, ny, '#6a4ac8'); x = nx; y = ny; } } }
    c.step(0.016); if (t > 6.1 && t < 6.6) c.flash((6.6 - t) / 0.5, '#b8a0ff'); title(c, t, 6.7, o.name, 'A CROWN CUT FROM NOTHING', '#9a7aff', o.sub, o.id);
  },
  // Titan Forgemaster — a colossal hammer drops onto a titan's anvil; molten fissures race across the world
  titan_forgemaster(c, t, o) {
    const cx = W / 2, hit = t >= 3, swing = ease(seg(t, 0.5, 3)), hy = Math.round(hit ? 106 : 10 + swing * 96); c.begin('#120604'); c.band(110, H, '#2a1008', 0.5); c.glow(cx, 128, 80, '#ff5a1a', hit ? 0.9 : 0.35, 0.5); c.vignette(0.8); c.flush();
    c.bevel(cx - 78, 134, 156, 20, ['#0a0604', '#8a6a58', '#5a4034', '#2a1c16']); c.bevel(cx - 56, 114, 112, 22, ['#0a0604', '#9a7a68', '#6a5044', '#32221a']); c.bevel(cx - 40, 102, 80, 14, ['#0a0604', '#b09080', '#7a6054', '#3a2a22']); c.bevel(cx - 86, 100, 44, 10, ['#0a0604', '#b09080', '#7a6054', '#3a2a22']);
    c.line(cx + 34, -6, cx + 2, hy - 2, '#1a0e06', 9); c.line(cx + 34, -6, cx + 2, hy - 2, '#6a4524', 7); c.line(cx + 32, -6, cx, hy - 2, '#8f6334', 3); c.line(cx + 37, -6, cx + 5, hy - 2, '#3a2410', 1);
    c.bevel(cx - 30, hy - 6, 60, 28, ['#0a0e12', '#e8f0ff', '#8a929c', '#3a424c']); c.px(cx - 24, hy, '#ffffff', 3, 3); c.px(cx + 20, hy, '#ffffff', 3, 3); c.bevel(cx - 36, hy - 2, 8, 20, ['#0a0e12', '#c8d0d8', '#6a727c', '#32383e']);
    if (hit) { const k = t - 3; for (let i = 0; i < 12; i++) { const an = -Math.PI + (i / 11) * Math.PI, len = Math.min(1, k * 1.7) * (80 + (i % 3) * 44); let x = cx, y = 104; for (let s = 0; s < 10; s++) { const nx = x + (Math.cos(an) * len) / 10 + ((i * 7 + s * 3) % 5) - 2, ny = y + ((Math.sin(an) * len) / 10) * 0.5 + 4 * Math.abs(Math.cos(an)); c.line(x, y, nx, ny, '#7a1a08', 4); c.line(x, y, nx, ny, '#ff5a1a', 2); c.line(x, y, nx, ny, '#ffe08a', 1); x = nx; y = ny; } }
      if (k < 0.6 || Math.random() < 0.35) dust(c, 5, () => ({ x: cx + rnd(-30, 30), y: 100, vx: rnd(-130, 130), vy: rnd(-170, -40), life: rnd(1, 2), g: 220, spr: EMBER })); }
    c.step(0.016); if (hit && t - 3 < 0.14) c.flash(1 - (t - 3) / 0.14, '#ffe0a0');
    title(c, t, 5.2, o.name, 'THE FIRST FORGE IS LIT', '#ff8a2a', o.sub, o.id);
  },
  // Philosopher's Heir — a transmutation circle turns lead to gold; a golden flask rises from the work
  philosopher(c, t, o) {
    const cx = W / 2, cy = H / 2 + 4, g = seg(t, 1.5, 5.5); c.begin('#0b0a10');
    for (let y = 0; y < H; y += 12) for (let x = 0; x < W; x += 12) { const d = Math.hypot(x - cx, y - cy) / 200, m = clamp01(g * 1.5 - d), pal = m > 0.66 ? ['#ffe9a8', '#e0b24a', '#a07a1e'] : m > 0.33 ? ['#9a8a5a', '#7a6a3a', '#4a3e22'] : ['#4a4a56', '#34343e', '#22222a']; for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const edge = j === 0 || i === 0; c.put(x + i, y + j, hex(edge ? pal[2] : j < 3 && i < 11 ? pal[0] : pal[1])); } }
    c.glow(cx, cy, 80, '#ffd36a', g * 0.8); c.vignette(0.8); c.flush();
    const R = Math.round(56 * ease(seg(t, 0, 2))); c.ring(cx, cy, R, '#ffd36a', 2); c.ring(cx, cy, Math.round(R * 0.82), '#c8a040'); c.ring(cx, cy, Math.round(R * 1.1), '#8a6a20', 1, 0, TAU, 5);
    for (const n of [3, 4]) for (let i = 0; i < n; i++) { const a0 = t * (n === 3 ? 0.6 : -0.5) + (i / n) * TAU, a1 = a0 + TAU / n, r2 = R * 0.82; c.line(cx + Math.cos(a0) * r2, cy + Math.sin(a0) * r2, cx + Math.cos(a1) * r2, cy + Math.sin(a1) * r2, n === 3 ? '#ffe9a8' : '#c8a040'); }
    for (let i = 0; i < 8; i++) { const an = t * 0.4 + (i / 8) * TAU; c.px(cx + Math.cos(an) * R * 1.1 - 2, cy + Math.sin(an) * R * 1.1 - 2, '#fff0b0', 5, 5); c.px(cx + Math.cos(an) * R * 1.1 - 1, cy + Math.sin(an) * R * 1.1 - 1, '#ffd36a', 3, 3); }
    const rise = ease(seg(t, 3, 6)), fy = cy + 34 - rise * 46; c.img_(flask('#ffd36a'), cx - 14, fy - 18, 3);
    sparkles(c, 2, cx - 50, cx + 50, cy - 20, cy + 50, ['#ffd36a', '#ffffff', '#fff0b0'], 2.6);
    c.step(0.016); if (t > 5.6 && t < 6.1) c.flash((6.1 - t) / 0.5, '#fff0b0'); title(c, t, 6.2, o.name, 'LEAD BECOMES GOLD', '#ffd36a', o.sub, o.id);
  },
  // Gilded Sovereign — a storm of spinning coins piles up into a hoard and a jewelled crown assembles on top while the ledger counts
  gilded(c, t, o) {
    const cx = W / 2; c.begin('#100c04'); c.glow(cx, 110, 110, '#e0b24a', 0.55 * seg(t, 0, 4), 0.8); c.vignette(0.75); c.flush();
    const rate = t < 5 ? 0.35 + t * 0.12 : 0.25; for (let i = 0; i < 3; i++) if (Math.random() < rate) c.spawn({ x: rnd(0, W), y: -6, vx: rnd(-6, 6), vy: rnd(70, 130), life: 2.2, spr: COIN, frames: COIN_FRAMES, seed: rnd(0, 6) });
    const pile = ease(seg(t, 0.5, 5)); for (let row = 0; row < 9; row++) { const rowY = 176 - row * 4, half = Math.round((150 - row * 14) * pile); if (half < 4) continue; for (let x = cx - half; x < cx + half; x += 6) { const k = ((x * 7 + row * 13) | 0) & 3; c.img_(COIN_FRAMES[k === 3 ? 1 : 0], x + (row % 2) * 3 + ((x * 5) & 1), rowY - 4); } }
    const k = t < 6.7 ? ease(seg(t, 3.5, 6.2)) : 0, cy = 62; // the crown flashes out as the title card lands
    if (k > 0) { const gold = ['#5a3a08', '#fff0a8', '#e0b24a', '#a07418'];
      c.bevel(cx - 56, cy + 12, 112, 14, gold); for (let i = 0; i < 5; i++) { const x = cx - 48 + i * 24, h = Math.round((i % 2 ? 26 : 40) * k); if (h > 2) { c.tri(x, cy + 12 - h, 18, h, gold); c.discShaded(Math.round(x), Math.round(cy + 6 - h), 5, i % 2 ? ['#3a0a0a', '#a02020', '#e04a3a', '#ff8a7a', '#ffd0c8'] : ['#0a1a3a', '#2a5ac0', '#4a8af0', '#8ac0ff', '#e0f0ff']); } }
      for (const [gx, col2] of [[-28, '#ff5a6a'], [0, '#6ad8ff'], [28, '#6aff9a']]) { const x = cx + gx * 1.6, y = cy + 19; c.px(x - 1, y - 3, '#1a1a1a', 3, 7); c.px(x - 3, y - 1, '#1a1a1a', 7, 3); c.px(x - 1, y - 2, col2, 3, 5); c.px(x - 2, y - 1, col2, 5, 3); c.px(x - 1, y - 2, '#ffffff', 1, 1); } }
    const digits = Math.floor(1000 * Math.pow(seg(t, 0.5, 6.4), 2) * 38); c.text(`${digits.toLocaleString()}g`, 10, 12, 12, '#fff0a8', 'left');
    sparkles(c, 1, cx - 50, cx + 50, cy - 24, cy + 20, ['#ffffff', '#fff0a8', '#ffd04a'], 1.6);
    c.step(0.016); if (t > 6.2 && t < 6.7) c.flash((6.7 - t) / 0.5, '#fff0a8'); title(c, t, 6.8, o.name, 'THE MARKET BOWS', '#ffe36b', o.sub, o.id);
  },
};

// ── player ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const LEN = { ascend: 6.4, hidden: 8.4, mythic: 10.4 };
export function playCinematic(o) {
  if (active) return; const scene = o.kind === 'mythic' ? MYTH[o.id] : o.kind === 'hidden' ? hidden : ascend;
  if (!scene) return;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'cinematic';
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;image-rendering:pixelated;background:#000;z-index:90;cursor:pointer;opacity:0;transition:opacity .5s';
  document.body.append(cv); requestAnimationFrame(() => { cv.style.opacity = '1'; });
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const c = new Ctx(g), start = performance.now(), total = (LEN[o.kind] ?? 7) * 1000; let done = false, raf = 0;
  sfx('secret', 600); setTimeout(() => sfx('secret', 900), 1800); if (o.kind !== 'ascend') setTimeout(() => sfx('anvil', 100), 3200);
  const hint = document.createElement('div'); hint.textContent = 'click to skip'; hint.style.cssText = 'position:fixed;right:14px;bottom:10px;z-index:91;color:#8a8099;font:12px Pixel,monospace;opacity:0;transition:opacity .6s'; document.body.append(hint); setTimeout(() => { hint.style.opacity = '1'; }, 1500);
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true); cv.style.opacity = '0'; hint.remove(); setTimeout(() => { cv.remove(); active = null; for (const f of waiters.splice(0)) f(); }, 500); };
  const key = (e) => { if (e.key === 'Escape' && performance.now() - start > 1200) { e.stopPropagation(); finish(); } };
  addEventListener('keydown', key, true); cv.addEventListener('click', () => { if (performance.now() - start > 1200) finish(); });
  const loop = (now) => { const t = (now - start) / 1000; if (c.ps.length > 400) c.ps.splice(0, 100); scene(c, t, o); if (now - start > total) return finish(); raf = requestAnimationFrame(loop); };
  active = { cv, finish }; raf = requestAnimationFrame(loop);
}
export const skipCinematic = () => active?.finish();
