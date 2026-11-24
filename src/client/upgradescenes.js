// Scenes for the gear-upgrade minigame: the ENGRAVING table (trace the piece's own rune with a chisel), the WHETSTONE (tap along with the stone)
// and the REVEAL (the odds, the roll, and the piece flaring up or going dull). Each returns { el, ... } with a destroy().
//
// Everything is drawn at 4× the logical 240×150 size and scaled down by the browser, with smooth shapes and the large vector artwork of the piece
// (gearpix.js, hand-drawn at 32 pixels) — never a 16-pixel icon blown up into blocks — and text that stays sharp.
import { gearPixel } from './gearpix.js';
import { upColor } from '../upgrade.js';

const rnd = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), TAU = Math.PI * 2;
const W = 240, H = 150, S = 4, FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';
function canvas() {
  const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
  cv.style.cssText = 'width:100%;max-width:720px;display:block;margin:0 auto;background:#120a14;border:3px solid #3a2a40;border-radius:4px;touch-action:none;cursor:crosshair;box-sizing:border-box;';
  const g = cv.getContext('2d'); g.setTransform(S, 0, 0, S, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.lineJoin = 'round'; g.lineCap = 'round'; return [cv, g];
}
// a small caption with its own plate, sized to the text
function label(g, text, x, y, { align = 'left', color = '#ffe9a8', size = 7, weight = 700 } = {}) {
  g.font = `${weight} ${size}px ${FONT}`; g.textBaseline = 'alphabetic'; const w = g.measureText(text).width + 9, bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g.fillStyle = 'rgba(10,6,14,.72)'; g.beginPath(); g.roundRect(bx, y - size - 2.5, w, size + 6, 2.5); g.fill(); g.fillStyle = color; g.textAlign = 'left'; g.fillText(text, bx + 4.5, y);
}
function table(g, t) {
  const wall = g.createLinearGradient(0, 0, 0, 118); wall.addColorStop(0, '#1a1020'); wall.addColorStop(1, '#2a1a24'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.6; for (let y = 6; y < 118; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = ((y / 6) % 2) * 9; x < W; x += 18) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y); g.stroke(); } }
  const bench = g.createLinearGradient(0, 118, 0, H); bench.addColorStop(0, '#4a2e22'); bench.addColorStop(1, '#2a1a16'); g.fillStyle = bench; g.fillRect(0, 118, W, 32); g.fillStyle = 'rgba(255,200,150,.14)'; g.fillRect(0, 118, W, 1.2);
  const lamp = g.createRadialGradient(W / 2, 56, 4, W / 2, 56, 130); lamp.addColorStop(0, 'rgba(255,190,110,.26)'); lamp.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  g.fillStyle = '#6a4a2a'; g.fillRect(W / 2 - 0.6, 0, 1.2, 11); g.fillStyle = '#c8a050'; g.beginPath(); g.roundRect(W / 2 - 5, 11, 10, 3.2, 1); g.fill(); g.fillStyle = `rgba(255,224,150,${0.75 + 0.25 * Math.sin(t / 160)})`; g.beginPath(); g.roundRect(W / 2 - 3, 14, 6, 1.4, 0.7); g.fill();
}
// pixel-art sprites are drawn with hard edges, at whole-number multiples of their own pixels
const sprite = (g, spr, x, y, size) => { const k = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(spr, Math.round(x), Math.round(y), size * (spr.width / (spr.width - 2)), size * (spr.height / (spr.height - 2))); g.imageSmoothingEnabled = k; };
const spark = (g, s) => { g.globalAlpha = clamp(1 - s.age / s.life, 0, 1); g.fillStyle = s.c; g.beginPath(); g.arc(s.x, s.y, 1.1, 0, TAU); g.fill(); g.globalAlpha = 1; };
const dense = (pts, step = 0.02) => { const out = []; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let k = 0; k <= n; k++) out.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]); } return out; };

// ── ENGRAVING: trace the piece's rune ───────────────────────────────────────────────────────────────────────────────────────────────────
export function createRuneScene(itemId, rune, { onProgress, onComplete, onTimeout } = {}) {
  const [cv, g] = canvas(), RW = 104, RH = 104, RX = (W - RW) / 2, RY = 11, tol = rune.tol, pts = rune.pts, samples = [], trail = [], sparks = [], path = dense(pts);
  const gear = gearPixel(itemId), s0 = pts[0], s1 = pts.at(-1), covered = new Uint8Array(path.length);
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
  const nearPath = (u, v, r) => { for (const q of path) if (Math.hypot(u - q[0], v - q[1]) <= r) return true; return false; };
  const progress = () => coveredN / path.length;
  function step(now) {
    if (pressed && armed && !finished && now - lastSample >= 24 && samples.length < 560) {
      lastSample = now; const ok = nearPath(mx, my, tol * 1.6); samples.push([+mx.toFixed(3), +my.toFixed(3), Math.round(now - t0)]); trail.push({ u: mx, v: my, ok, a: 1 });
      for (let i = 0; i < path.length; i++) if (!covered[i] && Math.hypot(mx - path[i][0], my - path[i][1]) <= tol * 1.2) { covered[i] = 1; coveredN++; }
      if (rnd() < 0.8) sparks.push({ x: RX + mx * RW, y: RY + my * RH, vx: (rnd() - 0.5) * 40, vy: -rnd() * 40, life: 0.35 + rnd() * 0.3, age: 0, c: ok ? '#ffd36a' : '#ff6a4a' });
      onProgress?.(progress(), samples.length);
      if (progress() >= 0.95 && Math.hypot(mx - s1[0], my - s1[1]) <= 0.15) { finished = true; doneAt = now; }
    }
    if (armed && !finished && now - t0 > rune.limit) { finished = true; doneAt = now; onTimeout?.(); }
    if (finished && doneAt && now - doneAt > 650) { doneAt = 0; onComplete?.(); }
    if (trail.length > 700) trail.splice(0, trail.length - 700);
  }
  const poly = () => { g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo(RX + u * RW, RY + v * RH) : g.moveTo(RX + u * RW, RY + v * RH))); };
  function draw(now, dt) {
    table(g, now);
    // the piece, faint, under the slab
    g.globalAlpha = 0.3; sprite(g, gear, W / 2 - 52, 6, 104); g.globalAlpha = 1;
    g.fillStyle = 'rgba(10,6,14,.55)'; g.beginPath(); g.roundRect(RX - 6, RY - 4, RW + 12, RH + 8, 4); g.fill(); g.strokeStyle = 'rgba(120,200,255,.18)'; g.lineWidth = 0.8; g.stroke();
    // the groove to follow, with a pulse running along it
    g.lineWidth = Math.max(3, tol * RW * 2.2); g.strokeStyle = 'rgba(120,200,255,.22)'; poly(); g.stroke(); g.lineWidth = 1.1; g.strokeStyle = `rgba(190,235,255,${0.5 + 0.25 * Math.sin(now / 180)})`; poly(); g.stroke();
    // engraved so far
    g.lineWidth = Math.max(2.4, tol * RW * 1.7); for (let i = 0; i < path.length; i += 2) if (covered[i]) { g.fillStyle = 'rgba(255,208,100,.9)'; g.beginPath(); g.arc(RX + path[i][0] * RW, RY + path[i][1] * RH, g.lineWidth / 2, 0, TAU); g.fill(); }
    for (const p of trail) { p.a *= 0.995; g.fillStyle = p.ok ? `rgba(255,236,170,${0.3 + p.a * 0.4})` : `rgba(255,80,60,${0.25 + p.a * 0.3})`; g.beginPath(); g.arc(RX + p.u * RW, RY + p.v * RH, 1, 0, TAU); g.fill(); }
    // start / end markers
    const pulse = 0.5 + 0.5 * Math.sin(now / 200); const mk = (p, col, txt) => { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.arc(RX + p[0] * RW, RY + p[1] * RH, 5 + (armed ? 0 : pulse * 1.8), 0, TAU); g.stroke(); g.fillStyle = col; g.globalAlpha = 0.25; g.fill(); g.globalAlpha = 1; label(g, txt, RX + p[0] * RW, RY + p[1] * RH + (p[1] < 0.5 ? 14 : -7), { align: 'center', color: col, size: 5.5 }); };
    mk(s0, '#8cff9a', 'START'); mk(s1, '#ff9a8c', 'END');
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += 110 * dt; s.x += s.vx * dt; s.y += s.vy * dt; spark(g, s); }
    if (ptr && !finished) { const cx = RX + mx * RW, cy = RY + my * RH; g.strokeStyle = OUT; g.lineWidth = 4.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 12, cy - 14); g.stroke(); g.strokeStyle = '#a8b0ba'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 7, cy - 8.5); g.stroke(); g.strokeStyle = '#b07a44'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 7, cy - 8.5); g.lineTo(cx + 13, cy - 15); g.stroke(); }
    // status
    const p = progress();
    g.fillStyle = 'rgba(10,6,14,.7)'; g.beginPath(); g.roundRect(8, 134, 224, 7, 3.5); g.fill(); g.fillStyle = finished ? '#8cff9a' : '#ffd36a'; g.beginPath(); g.roundRect(8, 134, Math.max(2, 224 * p), 7, 3.5); g.fill();
    if (armed && !finished) { const left = Math.max(0, (rune.limit - (now - t0)) / 1000); label(g, `${left.toFixed(0)}s left`, 232, 12, { align: 'right', color: left < 5 ? '#ff8a6a' : '#c8bcd8', size: 6.5 }); }
    label(g, rune.name ?? 'Rune', 8, 12, { size: 6.5, color: '#c8e8ff' });
    if (finished) label(g, p >= 0.95 ? 'RUNE COMPLETE' : 'TIME', W / 2, 128, { align: 'center', color: p >= 0.95 ? '#8cff9a' : '#ff9a8c', size: 8 });
    else if (!armed) { label(g, hint > 0 ? 'Press the GREEN START circle first' : 'Press and hold on the green START, then trace the groove to END', W / 2, 128, { align: 'center', color: hint > 0 ? '#ff9a8c' : '#ffe9a8', size: 6.5 }); hint = Math.max(0, hint - dt); }
    else if (!pressed) label(g, 'Hold the mouse button down and follow the glow', W / 2, 128, { align: 'center', size: 6.5 });
  }
  let last = performance.now();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; step(now); draw(now, dt); };
  raf = requestAnimationFrame(loop);
  return { el: cv, samples, progress, started: () => armed, elapsed: () => (armed ? performance.now() - t0 : 0), get complete() { return finished; }, finish() { return samples.map((s) => s.slice(0, 2)); }, destroy() { alive = false; cancelAnimationFrame(raf); } };
}
const OUT = '#14101c';

// ── WHETSTONE: tap along with the stone ─────────────────────────────────────────────────────────────────────────────────────────────────
// The stone slides back and forth by itself. Tap (click, Space, or an arrow key) every time it reaches an end. Each tap that comes at a
// steady pace polishes the edge a little more.
export function createPolishScene(itemId, polish, { onStroke } = {}) {
  const [cv, g] = canvas(); cv.style.cursor = 'pointer';
  const gear = gearPixel(itemId), specks = Array.from({ length: 40 }, () => ({ x: 74 + rnd() * 92, y: 30 + rnd() * 66, s: 1.4 + rnd() * 2, on: true }));
  const strokes = [], mid = (polish.lo + polish.hi) / 2, sparks = []; let last = 0, alive = true, good = 0, flashT = 0, lastGood = true, raf = 0, msg = '', msgT = 0, started = 0, interacted = false;
  const beatAt = (now) => { const ph = ((now - started) / mid) % 2; return ph < 1 ? ph : 2 - ph; };   // 0 at one end, 1 at the other
  const tap = () => {
    const now = performance.now(); interacted = true; if (!started) started = now;
    if (now - last < 150) return; const dt = last ? now - last : mid; last = now; strokes.push(Math.round(now)); const ok = dt >= polish.lo && dt <= polish.hi; lastGood = ok; flashT = 0.3;
    if (ok) { good++; const n = Math.ceil(specks.length / polish.need); let k = 0; for (const s of specks) if (s.on && k < n) { s.on = false; k++; } for (let i = 0; i < 14; i++) sparks.push({ x: 78 + rnd() * 84, y: 70 + rnd() * 20, vx: (rnd() - 0.5) * 60, vy: -rnd() * 40, life: 0.45, age: 0, c: i % 2 ? '#fff2b0' : '#ffd36a' }); msg = 'Smooth'; }
    else { msg = dt < polish.lo ? 'Too fast - wait for the stone' : 'Too slow - tap sooner'; for (let i = 0; i < 6; i++) sparks.push({ x: 78 + rnd() * 84, y: 70 + rnd() * 20, vx: (rnd() - 0.5) * 40, vy: -rnd() * 20, life: 0.3, age: 0, c: '#a08a7a' }); }
    msgT = 0.9; onStroke?.({ ok, dt, n: strokes.length, good });
  };
  const key = (e) => { if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); if (!e.repeat) tap(); } };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); }); document.addEventListener('keydown', key);
  function draw(now, dt) {
    table(g, now);
    const slab = g.createLinearGradient(0, 18, 0, 118); slab.addColorStop(0, '#4a3020'); slab.addColorStop(1, '#3a2418'); g.fillStyle = slab; g.beginPath(); g.roundRect(40, 18, 160, 100, 4); g.fill();
    sprite(g, gear, W / 2 - 48, 24, 96);
    const bright = good / polish.need; g.globalAlpha = 0.32 * bright; g.fillStyle = '#fff2b0'; g.beginPath(); g.roundRect(66, 28, 108, 78, 8); g.fill(); g.globalAlpha = 1;
    for (const s of specks) if (s.on) { g.fillStyle = 'rgba(90,60,36,.85)'; g.beginPath(); g.ellipse(s.x, s.y, s.s, s.s * 0.7, 0.4, 0, TAU); g.fill(); }
    // the stone slides to the beat on its own
    const b = started ? beatAt(now) : 0.5 + 0.5 * Math.sin(now / 400), ease = b * b * (3 - 2 * b), bx = 58 + ease * 124, atEnd = started && (b < 0.07 || b > 0.93);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(bx, 96, 21, 4, 0, 0, TAU); g.fill();
    const st = g.createLinearGradient(0, 76, 0, 94); st.addColorStop(0, '#c4cad4'); st.addColorStop(0.5, '#8a909a'); st.addColorStop(1, '#6a7078'); g.fillStyle = st; g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.roundRect(bx - 22, 76, 44, 18, 4); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx - 19, 78, 38, 2);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(bx - 16 + i * 8, 84 + (i % 2) * 3, 4, 1.2); }
    // end markers: they light up when the stone arrives
    for (const [ex, on] of [[46, started ? b < 0.07 : false], [194, started ? b > 0.93 : false]]) { g.strokeStyle = on ? '#8cff9a' : 'rgba(255,220,140,.55)'; g.lineWidth = on ? 2.2 : 1.2; g.beginPath(); g.arc(ex, 85, on ? 8 : 6, 0, TAU); g.stroke(); if (on) { g.fillStyle = 'rgba(140,255,154,.25)'; g.fill(); } }
    flashT = Math.max(0, flashT - dt); if (flashT > 0) { g.strokeStyle = lastGood ? '#8cff9a' : '#ff8a6a'; g.lineWidth = 2; g.globalAlpha = flashT / 0.3; g.beginPath(); g.roundRect(40, 18, 160, 100, 4); g.stroke(); g.globalAlpha = 1; }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += 100 * dt; s.x += s.vx * dt; s.y += s.vy * dt; spark(g, s); }
    g.fillStyle = 'rgba(10,6,14,.7)'; g.beginPath(); g.roundRect(8, 134, 224, 7, 3.5); g.fill(); g.fillStyle = '#ffd36a'; g.beginPath(); g.roundRect(8, 134, Math.max(2, 224 * clamp(good / polish.need, 0, 1)), 7, 3.5); g.fill();
    label(g, `POLISH  ${good} / ${polish.need}`, 8, 12, { size: 6.5, color: '#c8e8ff' });
    msgT = Math.max(0, msgT - dt); if (msgT > 0) label(g, msg, W / 2, 128, { align: 'center', color: lastGood ? '#8cffa0' : '#ffb08a', size: 7.5 });
    else label(g, interacted ? 'Tap each time the stone reaches an end' : 'TAP (click / Space) when the stone reaches an end', W / 2, 128, { align: 'center', size: 6.5, color: atEnd ? '#8cff9a' : '#ffe9a8' });
  }
  let lastT = performance.now();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; draw(now, dt); };
  raf = requestAnimationFrame(loop);
  return { el: cv, strokes, count: () => strokes.length, good: () => good, destroy() { alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', key); } };
}

// ── REVEAL: the odds, the roll, the result ──────────────────────────────────────────────────────────────────────────────────────────────
export function createRevealScene(itemId, res) {
  const [cv, g] = canvas(); cv.style.cursor = 'default';
  const base = gearPixel(itemId), glow = gearPixel(itemId, 32, res.ok ? '#fff2b0' : '#000000', res.ok ? 0.55 : 0.5);
  const t0 = performance.now(), sparks = [], rings = []; let alive = true, burst = false, raf = 0; const col = res.ok ? upColor(res.to) : '#8a8090';
  const SWEEP = 1700, HOLD = 500;
  function draw(now, dt) {
    const t = now - t0; table(g, now);
    const settle = clamp((t - SWEEP) / HOLD, 0, 1), roll = clamp(t / SWEEP, 0, 1), marker = res.roll * (1 - Math.pow(1 - roll, 3));   // the marker decelerates onto the roll
    const shake = t < SWEEP ? Math.sin(t / 25) * (1 - roll) * 1.2 : 0; g.save(); g.translate(shake, 0);
    if (res.ok && settle > 0) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t / 140); sprite(g, glow, W / 2 - 40, 2, 80); g.globalAlpha = 1; }
    sprite(g, settle > 0 && !res.ok ? glow : base, W / 2 - 40, 2, 80); g.restore();
    if (settle >= 1 && !burst) { burst = true; const SX = res.steps ?? 1; for (let i = 0; i < (res.ok ? 60 + (SX - 1) * 45 : 24); i++) sparks.push({ x: W / 2, y: 40, vx: (rnd() - 0.5) * 160, vy: -30 - rnd() * 110, life: 0.8 + rnd() * 0.7, age: 0, c: res.ok ? (i % 3 ? '#ffd36a' : '#ffffff') : '#6a6072', g: res.ok ? 150 : 40 }); if (res.ok) for (let i = 0; i < 3 + (SX - 1) * 3; i++) rings.push({ r: 4, a: 0.9, d: i * 140 }); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; if (r.d > 0) { r.d -= dt * 1000; continue; } r.r += 90 * dt; r.a -= dt * 1.1; if (r.a <= 0) { rings.splice(i, 1); continue; } g.strokeStyle = `rgba(255,230,150,${r.a})`; g.lineWidth = 1.4; g.beginPath(); g.arc(W / 2, 40, r.r, 0, TAU); g.stroke(); }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > s.life) { sparks.splice(i, 1); continue; } s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; spark(g, s); }
    // the chance bar and the roll marker
    const bx = 30, bw = 180, by = 114; g.fillStyle = '#14101c'; g.beginPath(); g.roundRect(bx - 2, by - 2, bw + 4, 16, 4); g.fill(); g.fillStyle = '#5a2a30'; g.beginPath(); g.roundRect(bx, by, bw, 12, 3); g.fill();
    g.fillStyle = '#3d9a4e'; g.beginPath(); g.roundRect(bx, by, Math.max(1, bw * res.chance), 12, 3); g.fill(); g.fillStyle = '#8cffa0'; g.fillRect(bx + 1, by + 0.8, Math.max(0, bw * res.chance - 2), 1.6);
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 1; i < 10; i++) g.fillRect(bx + (bw * i) / 10 - 0.3, by + 8, 0.6, 4);
    const mxp = bx + bw * marker; g.fillStyle = '#ffffff'; g.fillRect(mxp - 1, by - 5, 2, 22); g.fillStyle = '#ffe36b'; g.beginPath(); g.moveTo(mxp - 4, by - 8); g.lineTo(mxp + 4, by - 8); g.lineTo(mxp, by - 2); g.closePath(); g.fill();
    label(g, `SUCCESS ${(res.chance * 100).toFixed(res.chance < 0.1 ? 1 : 0)}%`, bx, by - 9, { size: 7.5 }); label(g, `ROLL ${(marker * 100).toFixed(0)}`, bx + bw, by - 9, { size: 7.5, align: 'right', color: '#c8bcd8' });
    if (settle >= 1) { const txt = res.ok ? `+${res.to}` : res.dropped ? `+${res.to}  (fell ${res.dropped})` : 'FAILED'; g.textAlign = 'center'; g.font = `800 20px ${FONT}`; g.lineWidth = 3; g.strokeStyle = '#14101c'; g.strokeText(txt, W / 2, 99); g.fillStyle = col; g.fillText(txt, W / 2, 99); g.textAlign = 'left'; }
    if (res.ok && (res.steps ?? 1) > 1 && settle >= 1) { const w = res.steps === 2 ? 'CRITICAL FORGE  x2' : 'CRITICAL FORGE  x3'; label(g, w, W / 2, 26 + Math.sin(t / 120) * 1.6, { align: 'center', color: res.steps === 3 ? '#ff9aff' : '#ffe36b', size: 8.5 }); }
    if (!res.ok && settle > 0) { g.strokeStyle = `rgba(0,0,0,${0.7 * settle})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(W / 2 - 14, 18); g.lineTo(W / 2 - 4, 36); g.lineTo(W / 2 - 12, 54); g.moveTo(W / 2 - 4, 36); g.lineTo(W / 2 + 12, 48); g.stroke(); }
  }
  let last = performance.now(); const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; draw(now, dt); }; raf = requestAnimationFrame(loop);
  return { el: cv, duration: SWEEP + HOLD, destroy() { alive = false; cancelAnimationFrame(raf); } };
}
