// Scenes for the gear-upgrade minigame, drawn in pixels: the ENGRAVING table (trace a glowing rune with a chisel), the WHETSTONE (polish in an even
// rhythm) and the REVEAL (the odds, the roll, and the piece either flaring up or going dull). Each returns { el, ... } with a destroy().
import { itemIcon } from './icons.js';
import { shade } from './px.js';
import { upColor } from '../upgrade.js';

const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const W = 240, H = 150;
function canvas() { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.style.cssText = 'width:100%;max-width:720px;image-rendering:pixelated;display:block;margin:0 auto;background:#120a14;box-shadow:inset 0 0 0 3px #3a2a40;touch-action:none;cursor:crosshair;'; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; return [cv, g]; }
const px = (g, x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
// the piece, big, optionally tinted by a colour (heat) and with a glowing outline
function gearImg(id, scale, tint, tintA = 0) {
  const ic = itemIcon(id), c = document.createElement('canvas'); c.width = ic.width * scale; c.height = ic.height * scale; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(ic, 0, 0, c.width, c.height);
  if (tint && tintA > 0) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tintA; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  return c;
}
// a small caption with its own background, sized to the text
function label(g, text, x, y, { align = 'left', color = '#ffe9a8', size = 7 } = {}) {
  g.font = `${size}px monospace`; const w = Math.ceil(g.measureText(text).width) + 8, bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(Math.round(bx), y - size - 2, w, size + 5); g.fillStyle = color; g.textAlign = 'left'; g.fillText(text, Math.round(bx) + 4, y);
}
function table(g, t, accent = '#2a1c2c') {
  g.fillStyle = '#150c18'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 6) for (let x = ((y / 6) % 2) * 9 - 9; x < W; x += 18) px(g, x, y, y < 30 ? '#241628' : accent, 17, 5);
  g.fillStyle = '#34202a'; g.fillRect(0, 118, W, 32); for (let x = 0; x < W; x += 12) px(g, x, 118, '#4e3038', 11, 1);   // a workbench
  // lamp light
  const gr = g.createRadialGradient(W / 2, 60, 6, W / 2, 60, 130); gr.addColorStop(0, 'rgba(255,190,110,.20)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#6a4a2a'; g.fillRect(W / 2 - 1, 0, 2, 12); px(g, W / 2 - 5, 12, '#c8a050', 10, 3); px(g, W / 2 - 3, 15, `rgba(255,220,140,${0.7 + 0.3 * Math.sin(t / 160)})`, 6, 1);
}

// ── ENGRAVING: a rune to trace ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function createRuneScene(itemId, rune, { onProgress } = {}) {
  const [cv, g] = canvas(), RX = 44, RY = 18, RW = 152, RH = 96, tol = rune.tol, pts = rune.pts, samples = [], trail = [], sparks = [];
  const gear = gearImg(itemId, 8), dense = []; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.02)); for (let k = 0; k <= n; k++) dense.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]); }
  const covered = new Uint8Array(dense.length); let pressed = false, mx = 0.5, my = 0.5, t0 = 0, alive = true, done = false, coveredN = 0, lastSample = 0, offPath = 0, ptr = false, raf = 0;
  const norm = (e) => { const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H; return [(x - RX) / RW, (y - RY) / RH]; };
  const move = (e) => { [mx, my] = norm(e); ptr = true; };
  const down = (e) => { e.preventDefault(); cv.setPointerCapture?.(e.pointerId); pressed = true; if (!t0) t0 = performance.now(); move(e); };
  const up = () => { pressed = false; };
  cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', down); cv.addEventListener('pointerup', up); cv.addEventListener('pointerleave', up); cv.addEventListener('pointercancel', up);
  const onPath = (u, v, r) => { let best = 9; for (const q of dense) best = Math.min(best, Math.hypot(u - q[0], v - q[1])); return best <= r; };
  function step(now) {
    if (pressed && t0 && now - lastSample >= 28 && samples.length < 560) {
      lastSample = now; const ok = onPath(mx, my, tol * 1.6); samples.push([+mx.toFixed(3), +my.toFixed(3), Math.round(now - t0)]); trail.push({ u: mx, v: my, ok, a: 1 });
      if (!ok) offPath++; for (let i = 0; i < dense.length; i++) if (!covered[i] && Math.hypot(mx - dense[i][0], my - dense[i][1]) <= tol * 1.2) { covered[i] = 1; coveredN++; }
      if (rnd() < 0.7) sparks.push({ x: RX + mx * RW, y: RY + my * RH, vx: (rnd() - 0.5) * 50, vy: -rnd() * 50, life: 0.3 + rnd() * 0.3, age: 0, c: ok ? '#ffd36a' : '#ff6a4a' });
      onProgress?.(coveredN / dense.length, offPath);
    }
    if (trail.length > 700) trail.splice(0, trail.length - 700);
  }
  function draw(now, dt) {
    table(g, now); g.drawImage(gear, Math.round(W / 2 - gear.width / 2), 14);
    // darken the surface a little so the rune reads
    g.fillStyle = 'rgba(10,6,14,.45)'; g.fillRect(RX - 6, RY - 4, RW + 12, RH + 8);
    // the rune to follow: a dim groove with a bright pulse running along it
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(3, tol * RW * 1.1); g.strokeStyle = 'rgba(120,200,255,.28)'; g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo(RX + u * RW, RY + v * RH) : g.moveTo(RX + u * RW, RY + v * RH))); g.stroke();
    g.lineWidth = 1; g.strokeStyle = `rgba(190,235,255,${0.55 + 0.25 * Math.sin(now / 180)})`; g.stroke();
    for (let i = 0; i < dense.length; i += 3) if (covered[i]) px(g, RX + dense[i][0] * RW - 1, RY + dense[i][1] * RH - 1, '#ffd36a', 3, 3);
    // start / end markers
    const s0 = pts[0], s1 = pts.at(-1); g.strokeStyle = '#8cff9a'; g.lineWidth = 1; g.strokeRect(RX + s0[0] * RW - 5, RY + s0[1] * RH - 5, 10, 10); g.strokeStyle = '#ff9a8c'; g.strokeRect(RX + s1[0] * RW - 5, RY + s1[1] * RH - 5, 10, 10);
    // the engraved trail
    for (const p of trail) { p.a *= 0.995; px(g, RX + p.u * RW - 1, RY + p.v * RH - 1, p.ok ? `rgba(255,200,90,${0.35 + p.a * 0.4})` : `rgba(255,80,60,${0.25 + p.a * 0.3})`, 3, 3); }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += 120 * dt; s.x += s.vx * dt; s.y += s.vy * dt; px(g, s.x, s.y, s.c, 2, 2); }
    // the chisel
    if (ptr) { const cx = RX + mx * RW, cy = RY + my * RH; g.strokeStyle = '#14101c'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 14, cy - 16); g.stroke(); g.strokeStyle = '#9aa3ad'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 8, cy - 9); g.stroke(); g.strokeStyle = '#a67546'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 8, cy - 9); g.lineTo(cx + 15, cy - 17); g.stroke(); px(g, cx - 1, cy - 1, pressed ? '#fff2b0' : '#c8d0d8', 3, 3); }
    if (!pressed && !t0) label(g, 'HOLD THE MOUSE AT THE GREEN START', W / 2, 136, { align: 'center' });
  }
  let last = performance.now();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; step(now); draw(now, dt); };
  raf = requestAnimationFrame(loop);
  return { el: cv, samples, progress: () => coveredN / dense.length, started: () => !!t0, elapsed: () => (t0 ? performance.now() - t0 : 0), finish() { done = true; return samples.map((s) => s.slice(0, 2)); }, destroy() { alive = false; cancelAnimationFrame(raf); }, get done() { return done; } };
}

// ── WHETSTONE: polish in an even rhythm ─────────────────────────────────────────────────────────────────────────────────────────────────
export function createPolishScene(itemId, polish, { onStroke } = {}) {
  const [cv, g] = canvas(); cv.style.cursor = 'ew-resize';
  const gear = gearImg(itemId, 9), specks = Array.from({ length: 46 }, () => ({ x: 70 + rnd() * 100, y: 28 + rnd() * 74, s: 2 + Math.floor(rnd() * 3), on: true }));
  const strokes = []; let sx = 0.5, dir = 0, turnX = 0.5, last = 0, alive = true, good = 0, flashT = 0, lastGood = true, raf = 0, ptr = false; const sparks = [];
  const mid = (polish.lo + polish.hi) / 2;
  const registerStroke = (now) => {
    if (now - last < 180) return; const dt = last ? now - last : mid; last = now; strokes.push(Math.round(now)); const ok = dt >= polish.lo && dt <= polish.hi; lastGood = ok; flashT = 0.35;
    if (ok) { good++; const n = Math.ceil(specks.length / polish.need); let k = 0; for (const s of specks) if (s.on && k < n) { s.on = false; k++; } for (let i = 0; i < 12; i++) sparks.push({ x: 60 + rnd() * 120, y: 70 + rnd() * 20, vx: (rnd() - 0.5) * 60, vy: -rnd() * 40, life: 0.4, age: 0, c: i % 2 ? '#fff2b0' : '#ffd36a' }); }
    else for (let i = 0; i < 6; i++) sparks.push({ x: 60 + rnd() * 120, y: 70 + rnd() * 20, vx: (rnd() - 0.5) * 40, vy: -rnd() * 20, life: 0.3, age: 0, c: '#a08a7a' });
    onStroke?.({ ok, dt, n: strokes.length, good });
  };
  const move = (e) => { const r = cv.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width, 0, 1); ptr = true; const d = x - sx; sx = x; if (Math.abs(d) < 1e-4) return; const nd = Math.sign(d); if (!dir) { dir = nd; turnX = x; return; } if (nd === dir) { if ((x - turnX) * dir > 0.34) { /* a full pass */ } } else { if (Math.abs(x - turnX) > 0.34) registerStroke(performance.now()); dir = nd; turnX = x; } };
  const key = (e) => { if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); if (!e.repeat) registerStroke(performance.now()); sx = e.code === 'ArrowLeft' ? 0.25 : 0.75; ptr = true; } };
  cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture?.(e.pointerId); move(e); }); document.addEventListener('keydown', key);
  function draw(now, dt) {
    table(g, now); g.fillStyle = '#3a2418'; g.fillRect(40, 20, 160, 100); g.fillStyle = '#4a3020'; g.fillRect(42, 22, 156, 96); g.drawImage(gear, Math.round(W / 2 - gear.width / 2), 28);
    const bright = good / polish.need; g.globalAlpha = 0.25 * bright; g.fillStyle = '#fff2b0'; g.fillRect(70, 28, 100, 74); g.globalAlpha = 1;
    for (const s of specks) if (s.on) px(g, s.x, s.y, '#6a4a30', s.s, s.s - 1);
    // the stone
    const bx = 40 + sx * 160 - 22; g.fillStyle = '#14101c'; g.fillRect(bx - 1, 76, 46, 18); g.fillStyle = '#8a8f98'; g.fillRect(bx, 77, 44, 16); g.fillStyle = '#b8bec8'; g.fillRect(bx, 77, 44, 3); g.fillStyle = '#6a7078'; g.fillRect(bx, 90, 44, 3);
    for (let i = 0; i < 6; i++) px(g, bx + 4 + i * 7, 83 + (i % 2) * 3, '#9aa0aa', 3, 1);
    // rhythm guide: a pulse that swells once per ideal stroke
    const ph = ((now % mid) / mid), r = 5 + Math.abs(Math.sin(ph * Math.PI)) * 6; g.strokeStyle = flashT > 0 ? (lastGood ? '#8cff9a' : '#ff8a6a') : 'rgba(255,220,140,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, 134, r, 0, 6.3); g.stroke();
    flashT = Math.max(0, flashT - dt);
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += 100 * dt; s.x += s.vx * dt; s.y += s.vy * dt; px(g, s.x, s.y, s.c, 2, 2); }
    label(g, `STROKES ${strokes.length} / ${polish.need}  GOOD ${good}`, 4, 12);
    if (!ptr && !strokes.length) label(g, 'SWEEP LEFT AND RIGHT TO THE PULSE  (or press < >)', W / 2, 110, { align: 'center' });
  }
  let lastT = performance.now();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; draw(now, dt); };
  raf = requestAnimationFrame(loop);
  return { el: cv, strokes, count: () => strokes.length, good: () => good, destroy() { alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', key); } };
}

// ── REVEAL: the odds, the roll, the result ──────────────────────────────────────────────────────────────────────────────────────────────
export function createRevealScene(itemId, res) {
  const [cv, g] = canvas(); cv.style.cursor = 'default'; const base = gearImg(itemId, 9), glow = gearImg(itemId, 9, res.ok ? '#fff2b0' : '#000000', res.ok ? 0.55 : 0.5);
  const t0 = performance.now(), sparks = [], rings = []; let alive = true, burst = false, raf = 0; const col = res.ok ? upColor(res.to) : '#8a8090';
  const SWEEP = 1700, HOLD = 500;
  function draw(now, dt) {
    const t = now - t0; table(g, now);
    const settle = clamp((t - SWEEP) / HOLD, 0, 1), roll = clamp(t / SWEEP, 0, 1), marker = res.roll * (1 - Math.pow(1 - roll, 3));   // the marker decelerates onto the roll
    // the piece
    const shake = t < SWEEP ? Math.sin(t / 25) * (1 - roll) * 1.2 : 0; g.save(); g.translate(Math.round(shake), 0);
    if (res.ok && settle > 0) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t / 140); g.drawImage(glow, Math.round(W / 2 - base.width / 2), 8); g.globalAlpha = 1; }
    g.drawImage(settle > 0 && !res.ok ? glow : base, Math.round(W / 2 - base.width / 2), 8);
    g.restore();
    if (settle >= 1 && !burst) { burst = true; for (let i = 0; i < (res.ok ? 60 : 24); i++) sparks.push({ x: W / 2, y: 50, vx: (rnd() - 0.5) * 160, vy: -30 - rnd() * 110, life: 0.8 + rnd() * 0.7, age: 0, c: res.ok ? (i % 3 ? '#ffd36a' : '#ffffff') : '#6a6072', g: res.ok ? 150 : 40 }); if (res.ok) for (let i = 0; i < 3; i++) rings.push({ r: 4, a: 1, d: i * 120 }); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; if (r.d > 0) { r.d -= dt * 1000; continue; } r.r += 90 * dt; r.a -= dt * 1.1; if (r.a <= 0) { rings.splice(i, 1); continue; } g.strokeStyle = `rgba(255,230,150,${r.a})`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, 50, r.r, 0, 6.3); g.stroke(); }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; px(g, s.x, s.y, s.c, 2, 2); }
    // the chance bar and the roll marker
    const bx = 30, bw = 180, by = 112; g.fillStyle = '#14101c'; g.fillRect(bx - 2, by - 2, bw + 4, 16); g.fillStyle = '#5a2a30'; g.fillRect(bx, by, bw, 12); g.fillStyle = '#3d9a4e'; g.fillRect(bx, by, bw * res.chance, 12); g.fillStyle = '#8cffa0'; g.fillRect(bx, by, bw * res.chance, 2);
    for (let i = 1; i < 10; i++) px(g, bx + (bw * i) / 10, by + 8, 'rgba(0,0,0,.35)', 1, 4);
    const mxp = bx + bw * marker; g.fillStyle = '#ffffff'; g.fillRect(Math.round(mxp) - 1, by - 5, 3, 22); g.fillStyle = '#ffe36b'; g.beginPath(); g.moveTo(mxp - 4, by - 7); g.lineTo(mxp + 4, by - 7); g.lineTo(mxp, by - 1); g.fill();
    label(g, `SUCCESS ${(res.chance * 100).toFixed(res.chance < 0.1 ? 1 : 0)}%`, bx, by - 8, { size: 8 }); label(g, `ROLL ${(marker * 100).toFixed(0)}`, bx + bw, by - 8, { size: 8, align: 'right', color: '#c8bcd8' });
    if (settle >= 1) { g.textAlign = 'center'; g.font = 'bold 18px monospace'; g.fillStyle = '#14101c'; g.fillText(res.ok ? `+${res.to}` : res.dropped ? `+${res.to}  (fell ${res.dropped})` : 'FAILED', W / 2 + 1, 99); g.fillStyle = col; g.fillText(res.ok ? `+${res.to}` : res.dropped ? `+${res.to}  (fell ${res.dropped})` : 'FAILED', W / 2, 98); g.textAlign = 'left'; }
    // cracks for a failure
    if (!res.ok && settle > 0) { g.strokeStyle = `rgba(0,0,0,${0.7 * settle})`; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 14, 22); g.lineTo(W / 2 - 4, 40); g.lineTo(W / 2 - 12, 58); g.moveTo(W / 2 - 4, 40); g.lineTo(W / 2 + 12, 52); g.stroke(); }
  }
  let last = performance.now(); const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; draw(now, dt); }; raf = requestAnimationFrame(loop);
  return { el: cv, duration: SWEEP + HOLD, destroy() { alive = false; cancelAnimationFrame(raf); } };
}
void shade;
