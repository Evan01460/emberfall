// The forge scene for the blacksmithing minigame, drawn in pixels: a brick wall lit by the furnace, a big anvil, a glowing billet
// that changes colour with its temperature, a smith whose arm swings a proper hammer, flying sparks, steam for the quench.
import { prop, personSprite } from './sprites.js';
import { shade } from './px.js';
const W = 176, H = 108;
const HOT = ['#3a3238', '#6a2a22', '#a8321a', '#e0451e', '#ff7a2e', '#ffc24a', '#fff2b0'];
const hotColor = (heat, i = 0) => HOT[Math.max(0, Math.min(HOT.length - 1, Math.round(heat * (HOT.length - 1) - (i > 0 ? 1 : 0))))];
const rnd = Math.random;

export function createForgeStage(opts = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'forge-stage'; cv.style.cssText = 'width:100%;max-width:528px;image-rendering:pixelated;display:block;margin:0 auto;background:#120a14;box-shadow:inset 0 0 0 3px #3a2d52,0 0 0 3px #0c0814';
  const g = cv.getContext('2d'); cv.__st = null; g.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 32; const tg = tmp.getContext('2d'); tg.imageSmoothingEnabled = false;
  const st = { heat: 0.2, fire: 0.4, swing: null, sparks: [], steam: [], flatten: 0, shake: 0, flash: 0, dip: 0, alive: true, t0: performance.now(), lastScore: 1 };
  cv.__st = st;
  const ANV = { x: 57, y: 62 }, BIL = { x: 58, y: 69 }, SM = { x: 70, y: 42 };   // BIL.y is the anvil's top face: the billet rests ON it
  // The smith is 13×21 art pixels (26×42 here): a 10px arm and a 10px hammer handle with a small head — nothing can stretch.
  // The arm is ONE straight, rigid bone (no elbow): it just swings about the shoulder, and the wrist cocks the hammer.
  const SHO = { x: SM.x + 7, y: SM.y + 19 }, ARM = 10, HANDLE = 10;
  const POSE_UP = { arm: 4.5, cant: 0.5 };                        // arm raised forward-up, hammer cocked up behind the head
  const POSE_DN = { arm: 3.2, cant: -0.6 };                       // arm reaching forward, hammer face flat on the billet
  const lerp = (a, b, k) => a + (b - a) * k;
  // swing progress p: 0 = raised, 1 = on the billet, negative = wound back
  const pAt = (now) => {
    if (st.force != null) return st.force;
    const idle = 0.04 + Math.sin(now / 420) * 0.03;
    if (!st.swing) return idle; const k = now - st.swing.t0;
    if (k < 80) return lerp(idle, -0.22, k / 80);                                  // wind back
    if (k < 135) return lerp(-0.22, 1, ((k - 80) / 55) ** 1.5);                    // fast strike
    if (!st.swing.hit) { st.swing.hit = true; impact(st.swing.score); }
    if (k < 175) return 1;                                                          // dwell on the hit
    if (k < 400) return lerp(1, idle, 1 - (1 - (k - 175) / 225) ** 2);             // rebound
    st.swing = null; return idle;
  };
  function impact(score) {
    st.lastScore = score; st.flash = 1; st.shake = score >= 0.9 ? 3 : score > 0.5 ? 2 : 1; st.flatten = Math.min(5, st.flatten + 0.9);
    const n = Math.round(10 + score * 26);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6, sp = 30 + rnd() * (60 + score * 60); st.sparks.push({ x: BIL.x + (rnd() - 0.5) * 14, y: BIL.y - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + rnd() * 0.5, age: 0, big: rnd() < 0.2 }); }
  }
  const px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const line = (x0, y0, x1, y1, c, th = 1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; px(x0 + (x1 - x0) * t - (th - 1) / 2, y0 + (y1 - y0) * t - (th - 1) / 2, c, th, th); } };

  function draw(now, dt) {
    g.save(); const sx = st.shake > 0.2 ? Math.round((rnd() - 0.5) * st.shake * 2) : 0, sy = st.shake > 0.2 ? Math.round((rnd() - 0.5) * st.shake) : 0; g.translate(sx, sy); st.shake *= 0.82;
    // brick wall, warmed by the furnace
    g.fillStyle = '#1a1018'; g.fillRect(-4, -4, W + 8, H + 8);
    for (let y = 0; y < 80; y += 6) for (let x = ((y / 6) % 2) * 8 - 8; x < W; x += 16) { const d = Math.hypot(x - 24, y - 50) / 70, warm = Math.max(0, 1 - d); px(x, y, warm > 0.5 ? '#4a2a28' : warm > 0.2 ? '#3a2428' : '#2a1c2a', 15, 5); px(x, y, warm > 0.5 ? '#6a3a2c' : '#3a2a3c', 15, 1); }
    g.fillStyle = '#2a1a1c'; g.fillRect(0, 80, W, H - 80); for (let x = 0; x < W; x += 8) px(x, 80, '#4a3030', 7, 1);
    // glow on the floor/wall from the fire and the billet
    const glow = 0.12 + st.fire * 0.2 + st.heat * 0.15; g.fillStyle = `rgba(255,120,40,${glow})`; for (let r = 40; r > 0; r -= 8) { g.globalAlpha = glow * (1 - r / 44); g.beginPath(); g.arc(BIL.x, BIL.y, r + 14, 0, 6.3); g.fill(); } g.globalAlpha = 1;
    // furnace (2x)
    const fr = Math.floor(now / 160) % 3, fur = prop('furnace', fr); g.drawImage(fur, 4, 22, fur.width * 2, fur.height * 2);
    for (let i = 0; i < 4 + st.fire * 8; i++) { const fx = 14 + ((i * 11) % 18), fy = 56 - ((now / 30 + i * 13) % 26) * (0.5 + st.fire); px(fx, fy, i % 3 ? '#ffd36a' : '#ff8a2e'); }
    // anvil (2x) with the billet on top
    const an = prop('anvil', 0); g.drawImage(an, ANV.x - an.width, ANV.y - 6, an.width * 2, an.height * 2);
    if (opts.icon) {   // an upgrade: the piece itself lies on the anvil, glowing with its heat
      tg.clearRect(0, 0, 32, 32); tg.drawImage(opts.icon, 0, 0, 32, 32); tg.globalCompositeOperation = 'source-atop'; tg.globalAlpha = Math.min(0.85, st.heat * 0.9); tg.fillStyle = hotColor(st.heat); tg.fillRect(0, 0, 32, 32); tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.25 + st.heat * 0.35; g.fillStyle = hotColor(st.heat); g.beginPath(); g.ellipse(BIL.x, BIL.y - 1, 18, 4, 0, 0, 6.3); g.fill(); g.globalAlpha = 1; g.drawImage(tmp, Math.round(BIL.x - 16), Math.round(BIL.y - 30 + st.flatten * 0.3), 32, 32);
    } else {
    const len = 22 + st.flatten * 1.6, th = Math.max(2, 5 - Math.floor(st.flatten * 0.45)), bx = BIL.x - len / 2, by = BIL.y - th;
    for (let i = 0; i < len; i++) { const e = Math.abs(i - len / 2) / (len / 2), h2 = st.heat * (1 - e * 0.35); for (let j = 0; j < th; j++) px(bx + i, by + j, hotColor(h2 + (j === 0 ? 0.08 : j === th - 1 ? -0.12 : 0))); }
    if (st.heat > 0.7) { px(bx + len / 2 - 1, by - 1, 'rgba(255,240,180,.7)', 3, 1); }
    }
    // the smith, then an arm and hammer built from bones so nothing can stretch
    const p = pAt(now), k = p < 0 ? p : Math.min(1, p), lean = k > 0.55 ? -1 : 0;   // he leans into the blow
    const sm = personSprite('blacksmith', 'l', 0, 3, '#d98a3a', {}); g.drawImage(sm, SM.x + lean, SM.y, sm.width * 2, sm.height * 2);
    const sh = { x: SHO.x + lean, y: SHO.y }, th0 = lerp(POSE_UP.arm, POSE_DN.arm, k), phi = th0 + lerp(POSE_UP.cant, POSE_DN.cant, k), OUT = '#1a1018';
    const hx = sh.x + Math.cos(th0) * ARM, hy = sh.y + Math.sin(th0) * ARM, mx = sh.x + (hx - sh.x) * 0.55, my = sh.y + (hy - sh.y) * 0.55;   // straight arm: shoulder → hand
    const ux = Math.cos(phi), uy = Math.sin(phi), tx = hx + ux * HANDLE, ty = hy + uy * HANDLE, nx = -uy, ny = ux;
    line(sh.x, sh.y, hx, hy, OUT, 5); line(hx - ux * 2, hy - uy * 2, tx, ty, OUT, 4);                           // outlines first
    line(sh.x, sh.y, mx, my, '#a8601e', 3); line(sh.x, sh.y, mx, my, '#c97a2e', 1);                             // sleeve
    line(mx, my, hx, hy, '#c98a5a', 3); line(mx, my, hx, hy, '#e0a878', 1);                                     // forearm and hand
    line(hx - ux * 2, hy - uy * 2, tx, ty, '#6a4528', 2); line(hx - ux * 2, hy - uy * 2, tx, ty, '#a67546', 1);   // wooden handle
    for (let a = -4; a <= 3; a++) for (let b = -1; b < 5; b++) if (a < -3 || a > 2 || b < 0 || b > 3) px(tx + nx * a + ux * b - 0.5, ty + ny * a + uy * b - 0.5, OUT);   // head outline
    for (let a = -3; a <= 2; a++) for (let b = 0; b < 4; b++) px(tx + nx * a + ux * b - 0.5, ty + ny * a + uy * b - 0.5, b === 3 ? '#e8f0ff' : b === 0 ? '#4a525c' : a === -3 || a === 2 ? '#6a727c' : '#9aa3ad');   // steel head
    px(hx - 1, hy - 1, '#e0a878', 3, 3); px(hx - 1, hy + 1, '#a8703e', 3, 1);                                  // fist
    // impact flash
    if (st.flash > 0.05) { const r = 4 + (1 - st.flash) * 18, c = st.lastScore >= 0.9 ? '#ffe36b' : '#ffffff'; g.globalAlpha = st.flash; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + 0.4; line(BIL.x, BIL.y - 3, BIL.x + Math.cos(a) * r, BIL.y - 3 + Math.sin(a) * r, c); } px(BIL.x - 3, BIL.y - 6, '#ffffff', 6, 6); g.globalAlpha = 1; st.flash *= 0.7; }
    // sparks
    for (let i = st.sparks.length - 1; i >= 0; i--) { const s = st.sparks[i]; s.age += dt; if (s.age > s.life) { st.sparks.splice(i, 1); continue; } s.vy += 160 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.y > 78) { s.y = 78; s.vy *= -0.35; s.vx *= 0.6; } const k = s.age / s.life; px(s.x, s.y, k < 0.35 ? '#fff6c0' : k < 0.7 ? '#ffb84a' : '#e0451e', s.big ? 2 : 1, s.big ? 2 : 1); }
    // steam from the quench
    for (let i = st.steam.length - 1; i >= 0; i--) { const s = st.steam[i]; s.age += dt; if (s.age > s.life) { st.steam.splice(i, 1); continue; } s.y -= 14 * dt; s.x += Math.sin(s.age * 5 + s.p) * 8 * dt; const k = 1 - s.age / s.life; g.globalAlpha = 0.5 * k; px(s.x, s.y, '#dce8f4', 3, 3); g.globalAlpha = 1; }
    if (st.dip > 0) { st.dip = Math.max(0, st.dip - dt); g.fillStyle = 'rgba(70,130,200,.45)'; g.fillRect(BIL.x - 20, BIL.y + 3, 40, 6); g.fillStyle = 'rgba(190,225,255,.7)'; g.fillRect(BIL.x - 20, BIL.y + 3, 40, 1); }
    g.restore();
  }
  let last = performance.now();
  const loop = (now) => { if (!st.alive) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; draw(now, dt); };
  requestAnimationFrame(loop);
  return {
    el: cv,
    setHeat(v) { st.heat = Math.max(0, Math.min(1, v)); },
    setFire(v) { st.fire = Math.max(0, Math.min(1, v)); },
    strike(score) { if (!st.swing) st.swing = { t0: performance.now(), score, hit: false }; else setTimeout(() => this.strike(score), 120); },
    quench(ok) { st.dip = 0.9; for (let i = 0; i < 26; i++) st.steam.push({ x: BIL.x + (rnd() - 0.5) * 30, y: BIL.y + 2, life: 0.8 + rnd() * 0.8, age: 0, p: rnd() * 6 }); const cool = setInterval(() => { st.heat *= 0.86; if (st.heat < 0.05) clearInterval(cool); }, 60); if (!ok) st.shake = 3; },
    destroy() { st.alive = false; },
  };
}
