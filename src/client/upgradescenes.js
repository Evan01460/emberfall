// Scenes for the gear-upgrade minigame: the ENGRAVING table (trace the piece's own rune with a chisel), the WHETSTONE (tap along with the stone)
// and the REVEAL (the odds, the roll, and the piece flaring up or going dull).
//
// They are drawn exactly like the rest of the game — and exactly like the forge scene that comes before them: ONE art pixel is 2 canvas pixels, the
// canvas is shown at a whole-number multiple with hard pixels, every shape is made of pixels from the game's own primitives (no smooth curves, no
// gradients, no anti-aliasing), text is the game's 3×5 bitmap font, and the piece itself is its normal pixel icon at its normal size.
import { itemIcon } from './icons.js';
import { prop } from './sprites.js';
import { C, q, drawText, drawTag, pdisc, pring, pline, prect } from './px.js';
import { upColor } from '../upgrade.js';

const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const W = 176, H = 150, INK = '#0c0814';
function canvas() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'forge-stage';
  cv.style.cssText = 'width:100%;max-width:528px;image-rendering:pixelated;display:block;margin:0 auto;background:#120a14;box-shadow:inset 0 0 0 3px #3a2d52,0 0 0 3px #0c0814;touch-action:none;cursor:crosshair';
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return [cv, g];
}
const px = (g, x, y, c, w = C, h = C) => { g.fillStyle = c; g.fillRect(q(x), q(y), w, h); };
const icon = (g, id, x, y, tintCol = null, a = 0) => {                      // the piece: its normal icon at the game's normal scale (1 art pixel = 2 canvas pixels)
  const ic = itemIcon(id), w = ic.width * C, h = ic.height * C;
  if (tintCol && a > 0) { const t = document.createElement('canvas'); t.width = ic.width; t.height = ic.height; const tg = t.getContext('2d'); tg.drawImage(ic, 0, 0); tg.globalCompositeOperation = 'source-atop'; tg.globalAlpha = a; tg.fillStyle = tintCol; tg.fillRect(0, 0, t.width, t.height); g.drawImage(t, q(x), q(y), w, h); }
  else g.drawImage(ic, q(x), q(y), w, h);
};
// brick wall lit by a lamp, and the work bench — the same wall as the forge scene
function room(g, t, top = 96) {
  g.fillStyle = '#1a1018'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < top; y += 6) for (let x = ((y / 6) % 2) * 8 - 8; x < W; x += 16) { const d = Math.hypot(x + 8 - W / 2, y - 40) / 90, warm = Math.max(0, 1 - d); px(g, x, y, warm > 0.55 ? '#4a2a28' : warm > 0.25 ? '#3a2428' : '#2a1c2a', 15, 5); px(g, x, y, warm > 0.55 ? '#6a3a2c' : '#3a2a3c', 15, 1); }
  g.fillStyle = '#34202a'; g.fillRect(0, top, W, H - top); for (let x = 0; x < W; x += 8) px(g, x, top, '#4e3038', 7, 2); prect(g, 0, top + 2, W, 2, '#2a1a20');
  pdisc(g, W / 2, 34, 54, 'rgba(255,170,90,.07)', 1); pdisc(g, W / 2, 34, 34, 'rgba(255,190,110,.09)', 1);               // lamp light, dithered
  px(g, W / 2 - 1, 0, '#6a4a2a', 2, 12); px(g, W / 2 - 5, 12, '#c8a050', 10, 4); px(g, W / 2 - 3, 16, Math.floor(t / 160) % 2 ? '#ffd890' : '#ffb860', 6, 2);   // the lamp
}
const bar = (g, x, y, w, h, frac, fill, back = '#1a1224', edge = '#3a2d52') => { px(g, x - 2, y - 2, edge, w + 4, h + 4); px(g, x, y, back, w, h); const fw = q(clamp(frac, 0, 1) * w); if (fw > 0) { px(g, x, y, fill, fw, h); px(g, x, y, 'rgba(255,255,255,.35)', fw, C); } };
const spark = (g, s) => { if (s.age > s.life) return; px(g, s.x, s.y, s.c, C, C); };
const dense = (pts, step = 0.02) => { const out = []; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 0; k <= n; k++) out.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]); } return out; };
const stoneTex = (g, x, y, w, h, base, lite, dark) => { px(g, x, y, base, w, h); for (let j = 0; j < h; j += C) for (let i = 0; i < w; i += C) { const r = Math.sin((i + 3) * 12.9898 + (j + 7) * 78.233) * 43758.5453, f = r - Math.floor(r); if (f < 0.1) px(g, x + i, y + j, dark); else if (f > 0.93) px(g, x + i, y + j, lite); } px(g, x, y, lite, w, C); px(g, x, y, lite, C, h); px(g, x, y + h - C, dark, w, C); px(g, x + w - C, y, dark, C, h); };

// ── ENGRAVING: trace the piece's rune ───────────────────────────────────────────────────────────────────────────────────────────────────
export function createRuneScene(itemId, rune, { onProgress, onComplete, onTimeout } = {}) {
  const [cv, g] = canvas(), RW = 88, RH = 88, RX = 66, RY = 4, tol = rune.tol, pts = rune.pts, samples = [], trail = [], sparks = [], path = dense(pts);
  const s0 = pts[0], s1 = pts.at(-1), covered = new Uint8Array(path.length), at = ([u, v]) => [RX + u * RW, RY + v * RH];
  let pressed = false, armed = false, mx = 0.5, my = 0.5, t0 = 0, alive = true, finished = false, coveredN = 0, lastSample = 0, ptr = false, raf = 0, hint = 0, doneAt = 0, born = performance.now();
  const norm = (e) => { const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H; return [(x - RX) / RW, (y - RY) / RH]; };
  const move = (e) => { [mx, my] = norm(e); ptr = true; };
  const down = (e) => {
    e.preventDefault(); cv.setPointerCapture?.(e.pointerId); move(e); if (performance.now() - born < 500 || finished) return;
    if (!armed) { if (Math.hypot(mx - s0[0], my - s0[1]) <= 0.13) { armed = true; t0 = performance.now(); } else { hint = 1.6; return; } }
    pressed = true;
  };
  const up = () => { pressed = false; };
  cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', down); cv.addEventListener('pointerup', up); cv.addEventListener('pointerleave', up); cv.addEventListener('pointercancel', up);
  const nearPath = (u, v, r) => { for (const p of path) if (Math.hypot(u - p[0], v - p[1]) <= r) return true; return false; };
  const progress = () => coveredN / path.length;
  function step(now) {
    if (pressed && armed && !finished && now - lastSample >= 24 && samples.length < 560) {
      lastSample = now; const ok = nearPath(mx, my, tol * 1.6); samples.push([+mx.toFixed(3), +my.toFixed(3), Math.round(now - t0)]); trail.push({ u: mx, v: my, ok });
      for (let i = 0; i < path.length; i++) if (!covered[i] && Math.hypot(mx - path[i][0], my - path[i][1]) <= tol * 1.2) { covered[i] = 1; coveredN++; }
      if (rnd() < 0.8) { const [x, y] = at([mx, my]); sparks.push({ x, y, vx: (rnd() - 0.5) * 40, vy: -rnd() * 40, life: 0.35 + rnd() * 0.3, age: 0, c: ok ? '#ffd36a' : '#ff6a4a' }); }
      onProgress?.(progress(), samples.length);
      if (progress() >= 0.95 && Math.hypot(mx - s1[0], my - s1[1]) <= 0.15) { finished = true; doneAt = now; }
    }
    if (armed && !finished && now - t0 > rune.limit) { finished = true; doneAt = now; onTimeout?.(); }
    if (finished && doneAt && now - doneAt > 650) { doneAt = 0; onComplete?.(); }
    if (trail.length > 500) trail.splice(0, trail.length - 500);
  }
  function draw(now, dt) {
    room(g, now);
    stoneTex(g, RX - 6, RY - 2, RW + 12, RH + 4, '#2e2638', '#4a4058', '#1c1626');                                          // the slab
    // the groove: a thick pixel line along the rune, with a pulse of light running along it
    const gc = pts.map(at); for (let i = 1; i < gc.length; i++) pline(g, gc[i - 1][0] - C, gc[i - 1][1] - C, gc[i][0] - C, gc[i][1] - C, '#161022', 3);
    for (let i = 1; i < gc.length; i++) pline(g, gc[i - 1][0], gc[i - 1][1], gc[i][0], gc[i][1], Math.floor(now / 220) % 2 ? '#5aa0d0' : '#4a88b8', 1);
    for (let i = 0; i < path.length; i += 2) if (covered[i]) { const [x, y] = at(path[i]); px(g, x - C, y - C, '#ffd36a', 4, 4); px(g, x - C, y - C, '#fff2b0', C, C); }
    for (const t of trail) if (!t.ok) { const [x, y] = at([t.u, t.v]); px(g, x, y, '#e0502e', C, C); }
    const pulse = Math.floor(now / 250) % 2, mk = (p, col, txt) => { const [x, y] = at(p); pdisc(g, x, y, 7, '#161022'); pring(g, x, y, armed ? 7 : 8 + pulse * 2, 2, col); drawText(g, txt, x + 1, y - 5, col, { align: 'center', outline: null }); };
    mk(s0, '#8cff9a', 'S'); mk(s1, '#ff9a8c', 'E');
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += 110 * dt; s.x += s.vx * dt; s.y += s.vy * dt; spark(g, s); }
    if (ptr && !finished) { const [cx, cy] = at([mx, my]); pline(g, cx, cy, cx + 12, cy - 14, '#14101c', 3); pline(g, cx + 1, cy - 1, cx + 8, cy - 9, '#b8c0ca', 1); pline(g, cx + 8, cy - 9, cx + 13, cy - 15, '#b07a44', 1); }
    // the piece, and progress
    px(g, 6, 26, '#1c1220', 40, 40); px(g, 6, 26, '#3a2d52', 40, C); icon(g, itemId, 8, 28);          // the icon is 36×36 (16 + its outline, at 2×): a 40×40 box leaves 2px all round
    bar(g, 6, 78, 40, 6, progress(), finished ? '#6adf8a' : '#e0b24a');
    const p = progress(); drawText(g, `${Math.round(p * 100)}%`, 6, 88, '#ffd36a');
    if (armed && !finished) { const left = Math.max(0, (rune.limit - (now - t0)) / 1000); drawText(g, `${left.toFixed(0)}S`, W - 6, 6, left < 5 ? '#ff8a6a' : '#c8bcd8', { align: 'right' }); }
    drawText(g, (rune.name ?? 'RUNE'), W / 2, 102, '#9adfff', { align: 'center' });
    if (finished) drawText(g, p >= 0.95 ? 'RUNE COMPLETE' : 'TIME', W / 2, 118, p >= 0.95 ? '#8cff9a' : '#ff9a8c', { align: 'center' });
    else if (!armed) { drawText(g, hint > 0 ? 'PRESS GREEN S FIRST' : 'HOLD ON GREEN S', W / 2, 118, hint > 0 ? '#ff9a8c' : '#ffe9a8', { align: 'center' }); hint = Math.max(0, hint - dt); }
    else if (!pressed) drawText(g, 'FOLLOW THE GLOW', W / 2, 118, '#ffe9a8', { align: 'center' });
  }
  let last = performance.now();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; step(now); draw(now, dt); };
  raf = requestAnimationFrame(loop);
  return { el: cv, samples, progress, started: () => armed, elapsed: () => (armed ? performance.now() - t0 : 0), get complete() { return finished; }, finish() { return samples.map((s) => s.slice(0, 2)); }, destroy() { alive = false; cancelAnimationFrame(raf); } };
}

// ── WHETSTONE: tap along with the stone ─────────────────────────────────────────────────────────────────────────────────────────────────
// The stone slides back and forth by itself. Tap (click, Space, or an arrow key) every time it reaches an end. Each tap that comes at a
// steady pace polishes the edge a little more.
export function createPolishScene(itemId, polish, { onStroke } = {}) {
  const [cv, g] = canvas(); cv.style.cursor = 'pointer';
  const specks = Array.from({ length: 36 }, () => ({ x: 62 + rnd() * 52, y: 22 + rnd() * 34, on: true }));
  const strokes = [], mid = (polish.lo + polish.hi) / 2, sparks = []; let last = 0, alive = true, good = 0, flashT = 0, lastGood = true, raf = 0, msg = '', msgT = 0, started = 0, interacted = false;
  const beatAt = (now) => { const ph = ((now - started) / mid) % 2; return ph < 1 ? ph : 2 - ph; };   // 0 at one end, 1 at the other
  const tap = () => {
    const now = performance.now(); interacted = true; if (!started) started = now;
    if (now - last < 150) return; const dt = last ? now - last : mid; last = now; strokes.push(Math.round(now)); const ok = dt >= polish.lo && dt <= polish.hi; lastGood = ok; flashT = 0.3;
    if (ok) { good++; const n = Math.ceil(specks.length / polish.need); let k = 0; for (const s of specks) if (s.on && k < n) { s.on = false; k++; } for (let i = 0; i < 14; i++) sparks.push({ x: 62 + rnd() * 52, y: 44 + rnd() * 10, vx: (rnd() - 0.5) * 60, vy: -rnd() * 40, life: 0.45, age: 0, c: i % 2 ? '#fff2b0' : '#ffd36a' }); msg = 'SMOOTH'; }
    else { msg = dt < polish.lo ? 'TOO FAST' : 'TOO SLOW'; for (let i = 0; i < 6; i++) sparks.push({ x: 62 + rnd() * 52, y: 44 + rnd() * 10, vx: (rnd() - 0.5) * 40, vy: -rnd() * 20, life: 0.3, age: 0, c: '#a08a7a' }); }
    msgT = 0.9; onStroke?.({ ok, dt, n: strokes.length, good });
  };
  const key = (e) => { if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); if (!e.repeat) tap(); } };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); }); document.addEventListener('keydown', key);
  function draw(now, dt) {
    room(g, now);
    stoneTex(g, 24, 8, 128, 80, '#4a3020', '#6a4a30', '#2e1c12');                                                          // the work slab
    icon(g, itemId, 70, 24);                                                                                              // the piece on the slab, its normal size
    const bright = good / polish.need; if (bright > 0) pdisc(g, 88, 42, 20 + 6 * bright, 'rgba(255,242,176,.5)', 1);
    for (const s of specks) if (s.on) { px(g, s.x, s.y, '#5a3a24', 4, 2); px(g, s.x, s.y, '#7a5236', 2, 2); }
    // the stone slides to the beat on its own
    const b = started ? beatAt(now) : 0.5 + 0.5 * Math.sin(now / 400), bx = 28 + q(b * 84), atEnd = started && (b < 0.07 || b > 0.93);
    px(g, bx - 2, 66, '#14101c', 48, 22); px(g, bx, 68, '#7a808a', 44, 18); px(g, bx, 68, '#c4cad4', 44, 4); px(g, bx, 82, '#5a6068', 44, 4); px(g, bx, 72, '#9aa0aa', 44, 10);
    for (let i = 0; i < 5; i++) px(g, bx + 6 + i * 8, 76 + (i % 2) * 4, '#7a808a', 4, 2);
    for (const [ex, on] of [[24, started && b < 0.07], [152, started && b > 0.93]]) pring(g, ex, 76, on ? 10 : 8, on ? 4 : 2, on ? '#8cff9a' : 'rgba(255,220,140,.7)');
    flashT = Math.max(0, flashT - dt); if (flashT > 0) { const c = lastGood ? '#8cff9a' : '#ff8a6a'; px(g, 24, 8, c, 128, 2); px(g, 24, 86, c, 128, 2); px(g, 24, 8, c, 2, 80); px(g, 150, 8, c, 2, 80); }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += 100 * dt; s.x += s.vx * dt; s.y += s.vy * dt; spark(g, s); }
    bar(g, 8, 106, 160, 6, good / polish.need, '#e0b24a');
    drawText(g, `POLISH ${good} / ${polish.need}`, 8, 6, '#c8e8ff', { outline: INK });
    msgT = Math.max(0, msgT - dt); if (msgT > 0) drawText(g, msg, W / 2, 122, lastGood ? '#8cffa0' : '#ffb08a', { align: 'center' });
    else drawText(g, interacted ? 'TAP AT EITHER END' : 'CLICK AT AN END', W / 2, 122, atEnd ? '#8cff9a' : '#ffe9a8', { align: 'center' });
  }
  let lastT = performance.now();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; draw(now, dt); };
  raf = requestAnimationFrame(loop);
  return { el: cv, strokes, count: () => strokes.length, good: () => good, destroy() { alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', key); } };
}

// ── REVEAL: the odds, the roll, the result ──────────────────────────────────────────────────────────────────────────────────────────────
export function createRevealScene(itemId, res) {
  const [cv, g] = canvas(); cv.style.cursor = 'default';
  const t0 = performance.now(), sparks = [], rings = []; let alive = true, burst = false, raf = 0; const col = res.ok ? upColor(res.to) : '#8a8090';
  const SWEEP = 1700, HOLD = 500, an = prop('anvil', 0);
  function draw(now, dt) {
    const t = now - t0; room(g, now);
    const settle = clamp((t - SWEEP) / HOLD, 0, 1), roll = clamp(t / SWEEP, 0, 1), marker = res.roll * (1 - Math.pow(1 - roll, 3));   // the marker decelerates onto the roll
    const cx = W / 2, shake = t < SWEEP ? Math.round(Math.sin(t / 25) * (1 - roll) * 2) : 0;
    g.drawImage(an, q(cx - an.width), q(36), an.width * C, an.height * C);                                              // the anvil, 2×, like the forge scene
    if (res.ok && settle > 0) pdisc(g, cx, 22, 24 + Math.sin(t / 140) * 3, 'rgba(255,230,150,.5)', 1);
    icon(g, itemId, cx - 18 + shake, 4, settle > 0 ? (res.ok ? '#fff2b0' : '#000000') : null, settle > 0 ? 0.5 : 0);
    if (settle >= 1 && !burst) { burst = true; const SX = res.steps ?? 1; for (let i = 0; i < (res.ok ? 50 + (SX - 1) * 40 : 20); i++) sparks.push({ x: cx, y: 20, vx: (rnd() - 0.5) * 150, vy: -30 - rnd() * 100, life: 0.8 + rnd() * 0.7, age: 0, c: res.ok ? (i % 3 ? '#ffd36a' : '#ffffff') : '#6a6072', g: res.ok ? 150 : 40 }); if (res.ok) for (let i = 0; i < 3 + (SX - 1) * 3; i++) rings.push({ r: 4, d: i * 140 }); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; if (r.d > 0) { r.d -= dt * 1000; continue; } r.r += 80 * dt; if (r.r > 70) { rings.splice(i, 1); continue; } pring(g, cx, 20, r.r, 2, r.r < 40 ? '#ffe9a8' : '#a8884a'); }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; spark(g, s); }
    if (!res.ok && settle > 0) { pline(g, cx - 8, 8, cx - 2, 20, '#0c0814', 1); pline(g, cx - 2, 20, cx - 8, 32, '#0c0814', 1); pline(g, cx - 2, 20, cx + 8, 28, '#0c0814', 1); }
    if (settle >= 1) { drawText(g, res.ok ? `+${res.to}` : 'FAILED', cx, 70, res.ok ? col : '#ff9a8c', { scale: 2, align: 'center' }); if (!res.ok) drawText(g, res.dropped ? `DOWN TO +${res.to}` : 'NO CHANGE', cx, 93, '#c8bcd8', { align: 'center' }); }
    if (res.ok && (res.steps ?? 1) > 1 && settle >= 1) drawTag(g, res.steps === 2 ? 'CRITICAL FORGE X2' : 'CRITICAL FORGE X3', cx, 93 + (Math.floor(t / 160) % 2) * 2, res.steps === 3 ? '#ff9aff' : '#ffe36b', { scale: 1 });
    // the chance bar and the roll marker
    const bx = 14, bw = 148, by = 128; px(g, bx - 2, by - 2, '#3a2d52', bw + 4, 14); px(g, bx, by, '#5a2a30', bw, 10); px(g, bx, by, '#3d9a4e', q(bw * res.chance), 10); px(g, bx, by, '#8cffa0', q(bw * res.chance), C);
    for (let i = 1; i < 10; i++) px(g, bx + q((bw * i) / 10), by + 6, 'rgba(0,0,0,.4)', C, 4);
    const mxp = bx + q(bw * marker); px(g, mxp - 1, by - 5, '#ffffff', C, 20); px(g, mxp - 3, by - 8, '#ffe36b', 6, C); px(g, mxp - 1, by - 6, '#ffe36b', C, C);
    drawText(g, `SUCCESS ${(res.chance * 100).toFixed(res.chance < 0.1 ? 1 : 0)}%`, bx, by - 14, '#ffe9a8', { outline: INK }); drawText(g, `ROLL ${(marker * 100).toFixed(0)}`, bx + bw, by - 14, '#c8bcd8', { align: 'right', outline: INK });
  }
  let last = performance.now(); const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; draw(now, dt); }; raf = requestAnimationFrame(loop);
  return { el: cv, duration: SWEEP + HOLD, destroy() { alive = false; cancelAnimationFrame(raf); } };
}
