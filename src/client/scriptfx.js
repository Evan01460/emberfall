// Visuals for the advancement skills (levels 35 / 55 / 80). The server sends what is on the battlefield — circling blades, rings, beams, falling
// meteors, vortices, zones, bombs on enemies, familiars and totems — and this draws it. The THEME of a skill decides the objects themselves
// (a blade is not a feather is not a coin), so a sword skill and an archer skill that use the same mechanic still look nothing alike.
import { TS } from '../world.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = Math.random;
const rgba = (hex, a) => { const n = parseInt((hex ?? '#ffffff').slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const OUT = '#14101c';

// ── glyphs: small objects drawn around a centre at size s (≈ pixels), rotated by r ───────────────────────────────────────────────────────
const G = {
  blade: (g, s, c) => { g.beginPath(); g.moveTo(0, -s * 1.5); g.lineTo(s * 0.45, 0); g.lineTo(0, s * 1.1); g.lineTo(-s * 0.45, 0); g.closePath(); g.fillStyle = '#eef6ff'; g.fill(); g.lineWidth = 2; g.strokeStyle = c; g.stroke(); g.fillStyle = c; g.fillRect(-s * 0.5, s * 0.9, s, s * 0.3); },
  rune: (g, s, c) => { g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); g.beginPath(); g.moveTo(-s * 0.5, -s * 0.5); g.lineTo(s * 0.5, s * 0.5); g.moveTo(s * 0.5, -s * 0.5); g.lineTo(-s * 0.5, s * 0.5); g.stroke(); g.fillStyle = '#fff'; g.fillRect(-2, -2, 4, 4); },
  flame: (g, s, c) => { g.beginPath(); g.moveTo(0, -s * 1.5); g.quadraticCurveTo(s * 1.1, -s * 0.2, s * 0.5, s * 0.7); g.quadraticCurveTo(0, s * 1.2, -s * 0.5, s * 0.7); g.quadraticCurveTo(-s * 1.1, -s * 0.2, 0, -s * 1.5); g.fillStyle = c; g.fill(); g.beginPath(); g.moveTo(0, -s * 0.5); g.quadraticCurveTo(s * 0.5, s * 0.1, 0, s * 0.8); g.quadraticCurveTo(-s * 0.5, s * 0.1, 0, -s * 0.5); g.fillStyle = '#fff3b0'; g.fill(); },
  soul: (g, s, c) => { g.beginPath(); g.arc(0, -s * 0.3, s * 0.7, Math.PI, 0); g.lineTo(s * 0.7, s * 0.8); g.lineTo(s * 0.3, s * 0.4); g.lineTo(0, s * 0.9); g.lineTo(-s * 0.3, s * 0.4); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fillStyle = rgba(c, 0.85); g.fill(); g.fillStyle = '#0c0814'; g.fillRect(-s * 0.38, -s * 0.4, s * 0.25, s * 0.3); g.fillRect(s * 0.13, -s * 0.4, s * 0.25, s * 0.3); },
  petal: (g, s, c) => { for (let i = 0; i < 5; i++) { g.save(); g.rotate((i / 5) * TAU); g.beginPath(); g.ellipse(0, -s * 0.7, s * 0.35, s * 0.7, 0, 0, TAU); g.fillStyle = c; g.fill(); g.restore(); } g.fillStyle = '#fff0a0'; g.beginPath(); g.arc(0, 0, s * 0.3, 0, TAU); g.fill(); },
  feather: (g, s, c) => { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, s * 1.4); g.lineTo(0, -s * 1.4); g.stroke(); g.fillStyle = c; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, i * s * 0.35); g.lineTo(s * 0.8, i * s * 0.35 - s * 0.5); g.lineTo(0, i * s * 0.35 - s * 0.1); g.lineTo(-s * 0.8, i * s * 0.35 - s * 0.5); g.closePath(); g.fill(); } },
  gear: (g, s, c) => { g.fillStyle = c; for (let i = 0; i < 8; i++) { g.save(); g.rotate((i / 8) * TAU); g.fillRect(-s * 0.2, -s * 1.15, s * 0.4, s * 0.45); g.restore(); } g.beginPath(); g.arc(0, 0, s * 0.85, 0, TAU); g.fill(); g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, s * 0.35, 0, TAU); g.fill(); },
  potion: (g, s, c) => { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-s * 0.25, -s * 1.1, s * 0.5, s * 0.5); g.beginPath(); g.arc(0, s * 0.2, s * 0.8, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-s * 0.4, -s * 0.1, s * 0.25, s * 0.25); },
  coin: (g, s, c) => { g.beginPath(); g.ellipse(0, 0, s * 0.9, s * 0.9, 0, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 3; g.strokeStyle = '#b8862a'; g.stroke(); g.fillStyle = '#fff6c0'; g.fillRect(-s * 0.15, -s * 0.55, s * 0.3, s * 1.1); },
  wind: (g, s, c) => { g.strokeStyle = c; g.lineWidth = 3; g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * s * 0.15, i * s * 0.55, s * (0.9 - Math.abs(i) * 0.25), Math.PI * 0.1, Math.PI * 1.35); g.stroke(); } },
  light: (g, s, c) => { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = i % 2 ? s * 0.4 : s * 1.3; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, s * 0.35, 0, TAU); g.fill(); },
  bomb: (g, s, c) => { g.beginPath(); g.arc(0, s * 0.2, s * 0.85, 0, TAU); g.fillStyle = '#22202c'; g.fill(); g.lineWidth = 2; g.strokeStyle = c; g.stroke(); g.strokeStyle = '#c8a070'; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.2, -s * 0.6); g.lineTo(s * 0.6, -s * 1.1); g.stroke(); g.fillStyle = '#ffe36b'; g.fillRect(s * 0.5, -s * 1.3, 5, 5); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(-s * 0.5, -s * 0.2, s * 0.3, s * 0.3); },
  thorn: (g, s, c) => { g.fillStyle = c; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * s * 0.7 - s * 0.3, s * 0.9); g.lineTo(i * s * 0.7, -s * (1.2 - Math.abs(i) * 0.3)); g.lineTo(i * s * 0.7 + s * 0.3, s * 0.9); g.closePath(); g.fill(); } },
  spirit: (g, s, c) => { g.beginPath(); g.arc(0, 0, s * 0.8, 0, TAU); g.fillStyle = rgba(c, 0.55); g.fill(); g.beginPath(); g.arc(0, 0, s * 0.4, 0, TAU); g.fillStyle = '#fff'; g.fill(); },
  bolt: (g, s, c) => { g.beginPath(); g.moveTo(s * 0.3, -s * 1.4); g.lineTo(-s * 0.7, s * 0.2); g.lineTo(-s * 0.05, s * 0.2); g.lineTo(-s * 0.4, s * 1.4); g.lineTo(s * 0.8, -s * 0.4); g.lineTo(s * 0.1, -s * 0.4); g.closePath(); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); },
  rock: (g, s, c) => { g.beginPath(); g.moveTo(-s, s * 0.4); g.lineTo(-s * 0.6, -s * 0.8); g.lineTo(s * 0.3, -s); g.lineTo(s, -s * 0.1); g.lineTo(s * 0.6, s * 0.8); g.closePath(); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-s * 0.5, -s * 0.6, s * 0.5, s * 0.3); },
  shield: (g, s, c) => { g.beginPath(); g.moveTo(-s, -s); g.lineTo(s, -s); g.lineTo(s, s * 0.2); g.lineTo(0, s * 1.2); g.lineTo(-s, s * 0.2); g.closePath(); g.fillStyle = rgba(c, 0.85); g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); },
  sun: (g, s, c) => { g.fillStyle = c; for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * TAU); g.fillRect(-s * 0.12, -s * 1.4, s * 0.24, s * 0.5); g.restore(); } g.beginPath(); g.arc(0, 0, s * 0.8, 0, TAU); g.fill(); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(0, 0, s * 0.45, 0, TAU); g.fill(); },
  void: (g, s, c) => { g.beginPath(); g.arc(0, 0, s * 0.9, 0, TAU); g.fillStyle = c; g.fill(); g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fillStyle = '#0c0814'; g.fill(); },
};
const FALL = { meteor: 'flame', arrow: 'feather', boulder: 'rock', bomb: 'bomb', coin: 'coin', drop: 'potion' };
function glyph(g, th, x, y, s, rot, col, a = 1) { g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = a; (G[th] ?? G.spirit)(g, s, col); g.restore(); }

// ── familiars and totems ──
function drawPet(g, p, now, t) {
  const x = p.x * TS, y = p.y * TS, col = p.col ?? '#ffd36a', f = Math.cos(p.a ?? 0) < 0 ? -1 : 1, bob = Math.sin(t / 130 + p.id) * 2;
  g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 6, 12, 4, 0, 0, TAU); g.fill();
  const r = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(px * f - (f < 0 ? w : 0), py, w, h); };
  switch (p.kind) {
    case 'wolf': { const leg = Math.floor(t / 110) % 2 ? 2 : -2; r(-12, -10 + bob, 20, 9, '#8a8f98'); r(-12, -10 + bob, 20, 3, '#b8bec8'); r(6, -14 + bob, 9, 9, '#8a8f98'); r(13, -10 + bob, 4, 3, '#4a4f58'); r(8, -17 + bob, 3, 4, '#6a6f78'); r(12, -17 + bob, 3, 4, '#6a6f78'); r(10, -12 + bob, 2, 2, '#ffe36b'); r(-16, -12 + bob, 5, 3, '#8a8f98'); r(-9, -1, 3, 6 + leg, '#6a6f78'); r(3, -1, 3, 6 - leg, '#6a6f78'); r(-3, -1, 3, 6 - leg, '#5a5f68'); r(8, -1, 3, 6 + leg, '#5a5f68'); break; }
    case 'mule': { const leg = Math.floor(t / 140) % 2 ? 1 : -1; r(-13, -13 + bob, 24, 11, '#a07a4a'); r(-13, -13 + bob, 24, 3, '#c09a6a'); r(7, -20 + bob, 9, 10, '#a07a4a'); r(8, -26 + bob, 3, 7, '#8a6a3a'); r(12, -26 + bob, 3, 7, '#8a6a3a'); r(14, -14 + bob, 3, 3, '#4a3a2a'); r(-4, -17 + bob, 10, 5, '#c8402f'); r(-11, -2, 3, 8 + leg, '#6a4a2a'); r(5, -2, 3, 8 - leg, '#6a4a2a'); r(-2, -2, 3, 8 - leg, '#5a3a1a'); r(9, -2, 3, 8 + leg, '#5a3a1a'); break; }
    case 'shade': { g.globalAlpha = 0.9; g.fillStyle = rgba(col, 0.65); g.beginPath(); g.arc(0, -14 + bob, 10, Math.PI, 0); g.lineTo(10, 2 + bob); for (let i = 0; i < 4; i++) g.lineTo(10 - (i + 1) * 5, i % 2 ? 2 + bob : 8 + bob + Math.sin(t / 90 + i) * 2); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(-5, -16 + bob, 3, 4); g.fillRect(2, -16 + bob, 3, 4); g.globalAlpha = 1; break; }
    case 'banner': { const w = Math.sin(t / 220) * 3; g.fillStyle = '#6a4a2a'; g.fillRect(-2, -34, 4, 38); g.fillStyle = col; g.beginPath(); g.moveTo(2, -34); g.lineTo(26 + w, -30); g.lineTo(18 + w, -22); g.lineTo(26 + w, -14); g.lineTo(2, -16); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.fillRect(8, -28, 6, 6); break; }
    case 'turret': { const a = p.a ?? 0; g.fillStyle = '#5a6068'; g.fillRect(-9, -6, 18, 10); g.fillStyle = '#8a929c'; g.fillRect(-9, -6, 18, 3); g.save(); g.translate(0, -8); g.rotate(a); g.fillStyle = '#c8d0d8'; g.fillRect(0, -3, 16, 6); g.fillStyle = OUT; g.fillRect(14, -2, 4, 4); g.restore(); g.fillStyle = col; g.beginPath(); g.arc(0, -8, 5, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); break; }
    case 'anvil': { g.fillStyle = '#4a525c'; g.fillRect(-12, -2, 24, 6); g.fillStyle = '#9aa3ad'; g.fillRect(-16, -12, 32, 8); g.fillRect(-8, -16, 16, 6); g.fillStyle = col; g.fillRect(-14, -12, 28, 2); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-16, -12, 32, 8); break; }
    case 'wagon': { g.fillStyle = '#7a5a34'; g.fillRect(-22, -22, 44, 16); g.fillStyle = '#a07a4a'; g.fillRect(-22, -22, 44, 4); g.fillStyle = '#e8dcc0'; g.beginPath(); g.moveTo(-20, -22); g.quadraticCurveTo(0, -42, 20, -22); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); for (const wx of [-14, 14]) { g.beginPath(); g.arc(wx, -4, 7, 0, TAU); g.fillStyle = '#5a3a1a'; g.fill(); g.strokeStyle = '#c8a070'; g.stroke(); g.save(); g.translate(wx, -4); g.rotate(t / 400); g.fillStyle = '#c8a070'; g.fillRect(-1, -6, 2, 12); g.fillRect(-6, -1, 12, 2); g.restore(); } break; }
    default: g.fillStyle = col; g.beginPath(); g.arc(0, -8, 8, 0, TAU); g.fill();
  }
  g.restore();
  if (p.r > 0) { const k = (now - p.ws) / 1000, pulse = 1 + Math.sin(k * 3) * 0.03; g.save(); g.setLineDash([10, 8]); g.lineDashOffset = -t / 40; g.strokeStyle = rgba(col, 0.55); g.lineWidth = 2; g.beginPath(); g.arc(x, y, p.r * TS * pulse, 0, TAU); g.stroke(); g.fillStyle = rgba(col, 0.07); g.fill(); g.restore(); }
}

// ── transient bolts and trails (chain lightning, blinks) ──
const bolts = [];
export function scriptEvent(e) { bolts.push({ ...e, t0: performance.now() }); if (bolts.length > 60) bolts.shift(); }

export function drawScriptFx(g, pz, now, t) {
  if (pz?.length) {
    g.save();
    for (const z of pz) {
      if (z.k === 'pet') continue;
      const col = z.col ?? '#ffd36a', th = z.th ?? 'spirit', x = z.x * TS, y = z.y * TS, warn = now < z.we, p = clamp((now - z.ws) / Math.max(1, z.we - z.ws), 0, 1), el = (now - z.we) / 1000, flick = 0.8 + 0.2 * Math.sin(t / 60 + z.id);
      switch (z.k) {
        case 'orbit': {
          const tt = (now - z.ws) / 1000, appear = clamp(tt / 0.25, 0, 1), fade = clamp((z.ae - now) / 400, 0, 1), s = Math.max(7, z.r * TS * 0.55);
          g.lineWidth = 2; g.strokeStyle = rgba(col, 0.25 * appear * fade); g.beginPath(); g.arc(x, y, z.R * TS, 0, TAU); g.stroke();
          for (let i = 0; i < z.n; i++) { const a = (i / z.n) * TAU + z.spin * tt, bx = x + Math.cos(a) * z.R * TS * appear, by = y + Math.sin(a) * z.R * TS * appear;
            for (let k = 1; k <= 4; k++) { const a2 = a - Math.sign(z.spin) * k * 0.12; glyph(g, th, x + Math.cos(a2) * z.R * TS * appear, y + Math.sin(a2) * z.R * TS * appear, s * (1 - k * 0.15), a2 + Math.PI / 2 * Math.sign(z.spin), col, (0.22 - k * 0.04) * fade); }
            glyph(g, th, bx, by, s, a + Math.PI / 2 * Math.sign(z.spin), col, fade); }
          break;
        }
        case 'ring': {
          if (warn) { g.beginPath(); g.arc(x, y, 14 + p * 10, 0, TAU); g.strokeStyle = rgba(col, 0.4 + 0.4 * p); g.lineWidth = 2; g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]); break; }
          const r = z.speed * el; if (r > z.r) break; g.lineWidth = z.w * TS; g.strokeStyle = rgba(col, 0.38); g.beginPath(); g.arc(x, y, r * TS, 0, TAU); g.stroke(); g.lineWidth = z.w * TS * 0.28; g.strokeStyle = 'rgba(255,255,255,.85)'; g.stroke();
          for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + el * 0.8; glyph(g, th, x + Math.cos(a) * r * TS, y + Math.sin(a) * r * TS, 7, a + Math.PI / 2, col, 0.9); }
          break;
        }
        case 'beams': {
          const tt = (now - z.ws) / 1000;
          for (let i = 0; i < z.n; i++) { const a = z.a + (i / z.n) * TAU + z.spin * tt, L = z.len * TS, W = z.w * TS; g.save(); g.translate(x, y); g.rotate(a);
            if (warn) { g.strokeStyle = rgba(col, 0.5); g.setLineDash([8, 8]); g.strokeRect(0, -W / 2, L, W); g.setLineDash([]); } else { const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(1, rgba(col, 0.25)); g.fillStyle = gr; g.fillRect(0, -W / 2, L, W); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, -W * 0.14, L, W * 0.28); for (let k = 1; k < 7; k++) glyph(g, th, k * L / 7, 0, 6, k + t / 100, col, 0.9); }
            g.restore(); }
          glyph(g, th, x, y, 10, t / 200, col); break;
        }
        case 'circle': {
          const FALLG = FALL[z.fall] ?? th, s = z.fall === 'meteor' || z.fall === 'boulder' ? 16 : z.fall === 'arrow' ? 9 : 12;
          if (warn) { g.beginPath(); g.arc(x, y, z.r * TS, 0, TAU); g.strokeStyle = rgba(col, 0.45 + 0.35 * p); g.lineWidth = 2; g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]); g.fillStyle = rgba(col, 0.05 + 0.14 * p); g.fill();
            const fy = y - (1 - p) * (z.fall === 'arrow' ? 200 : 170), fx = x + (1 - p) * (z.fall === 'meteor' ? -50 : 0); glyph(g, FALLG, fx, fy, s, z.fall === 'arrow' ? Math.PI : z.fall === 'meteor' ? -0.5 : t / 150, col, 0.4 + 0.6 * p);
            if (z.fall === 'meteor') { g.strokeStyle = rgba(col, 0.35); g.lineWidth = 6; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx - 12, fy - 30); g.stroke(); } }
          else { const k = clamp(el / 0.26, 0, 1); g.beginPath(); g.arc(x, y, z.r * TS * (0.6 + 0.4 * k), 0, TAU); g.fillStyle = rgba(col, 0.6 * (1 - k)); g.fill(); g.lineWidth = 3; g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; g.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + z.id; glyph(g, FALLG, x + Math.cos(a) * z.r * TS * k * 1.2, y + Math.sin(a) * z.r * TS * k * 1.2 - 8 * k, 5, a, col, 1 - k); } }
          break;
        }
        case 'line': {
          const L = z.len * TS, W = z.w * TS; g.save(); g.translate(x, y); g.rotate(z.a);
          if (warn) { g.fillStyle = rgba(col, 0.05 + 0.13 * p); g.fillRect(0, -W / 2, L, W); g.strokeStyle = rgba(col, 0.6); g.setLineDash([9, 7]); g.strokeRect(0, -W / 2, L, W); g.setLineDash([]); glyph(g, th, L * p, 0, 8, t / 100, col, 0.9); }
          else { g.fillStyle = rgba(col, 0.75 * flick); g.fillRect(0, -W / 2, L, W); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, -W * 0.18, L, W * 0.36); for (let k = 1; k < 8; k++) glyph(g, th, k * L / 8, (rnd() - 0.5) * W * 0.6, 6, rnd() * 6, col, 0.9); }
          g.restore(); break;
        }
        case 'vortex': {
          const R = z.r * TS, tt = (now - z.ws) / 1000, collapse = clamp((z.ae - now) / 500, 0, 1); g.fillStyle = rgba(col, 0.1); g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
          for (let arm = 0; arm < 4; arm++) { g.beginPath(); for (let k = 0; k <= 40; k++) { const u = k / 40, a = arm * TAU / 4 + tt * 3.2 + u * 5, rr = R * (1 - u * 0.92) * (0.35 + 0.65 * collapse); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.strokeStyle = rgba(col, 0.55); g.lineWidth = 3; g.stroke(); }
          for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + tt * 2.5, rr = R * (0.2 + 0.8 * ((i * 0.37 + tt * 0.6) % 1)); glyph(g, th, x + Math.cos(a + rr / 40) * rr, y + Math.sin(a + rr / 40) * rr, 6, a, col, 0.85); }
          glyph(g, 'void', x, y, 12 + Math.sin(t / 80) * 2, 0, col); break;
        }
        case 'zone': {
          const R = z.r * TS, fade = clamp((z.ae - now) / 500, 0, 1) * clamp((now - z.ws) / 200, 0, 1), tt = (now - z.ws) / 1000;
          g.beginPath(); g.arc(x, y, R, 0, TAU); g.fillStyle = rgba(col, 0.1 * fade); g.fill(); g.setLineDash([12, 8]); g.lineDashOffset = -t / 30; g.strokeStyle = rgba(col, 0.7 * fade); g.lineWidth = 3; g.stroke(); g.setLineDash([]);
          if (z.effect === 'aegis') { g.beginPath(); g.arc(x, y, R, 0, TAU); const gr = g.createRadialGradient(x, y, R * 0.4, x, y, R); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.38 * fade)); g.fillStyle = gr; g.fill(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + tt * 0.5; glyph(g, th, x + Math.cos(a) * R, y + Math.sin(a) * R, 8, a + Math.PI / 2, col, 0.9 * fade); } }
          else for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + i, rr = R * ((i * 0.31 + tt * 0.35) % 1), up = ((tt * 0.7 + i * 0.13) % 1); glyph(g, th, x + Math.cos(a) * rr, y + Math.sin(a) * rr - up * 26, 6, a + tt, col, (1 - up) * fade); }
          if (z.effect === 'slow') for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, rr = R * (0.3 + 0.7 * ((i * 0.37) % 1)); glyph(g, 'thorn', x + Math.cos(a) * rr, y + Math.sin(a) * rr, 5, a, col, 0.9 * fade); }
          break;
        }
        case 'wall': {
          const dx = Math.cos(z.a), dy = Math.sin(z.a), run = z.speed * (z.ae - z.we) / 1000, ph = warn ? 0 : z.speed * el; g.save(); g.translate(x, y); g.rotate(z.a);
          g.fillStyle = rgba(col, 0.05); g.fillRect(0, -z.span * TS / 2, run * TS, z.span * TS); const wx = ph * TS - z.w * TS / 2; g.fillStyle = rgba(col, 0.65 * flick); g.fillRect(wx, -z.span * TS / 2, z.w * TS, z.span * TS); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(wx + z.w * TS * 0.35, -z.span * TS / 2, z.w * TS * 0.3, z.span * TS);
          g.restore(); for (let i = 0; i < 9; i++) { const q = (i / 8 - 0.5) * z.span * TS; glyph(g, th, x + dx * ph * TS - dy * q, y + dy * ph * TS + dx * q, 7, z.a + i, col, 0.9); } break;
        }
        case 'bomb': {
          const k = warn ? p : 1; if (!warn) { const f = clamp(el / 0.35, 0, 1); g.beginPath(); g.arc(x, y, z.r * TS * (0.5 + f), 0, TAU); g.fillStyle = rgba(col, 0.55 * (1 - f)); g.fill(); break; }
          g.beginPath(); g.arc(x, y, z.r * TS, 0, TAU); g.strokeStyle = rgba(col, 0.35 + 0.4 * k); g.lineWidth = 2; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
          g.beginPath(); g.arc(x, y, z.r * TS * (1 - k * 0.9), 0, TAU); g.strokeStyle = rgba(col, 0.9); g.lineWidth = 3; g.stroke(); glyph(g, th === 'bomb' ? 'bomb' : th, x, y - 30 + Math.sin(t / 90) * 2, 10, 0, col);
          g.fillStyle = '#fff'; g.font = "bold 12px 'Pixel', monospace"; g.textAlign = 'center'; g.fillText(Math.max(0, (z.we - now) / 1000).toFixed(1), x, y - 46); g.textAlign = 'left'; break;
        }
        default: break;
      }
    }
    for (const z of pz) if (z.k === 'pet') drawPet(g, z, now, t);
    g.restore();
  }
  // bolts and trails
  const nowp = performance.now();
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], k = (nowp - b.t0) / (b.kind === 'blink' ? 500 : 320); if (k >= 1) { bolts.splice(i, 1); continue; }
    g.save(); g.globalAlpha = 1 - k; const col = b.col ?? '#fff';
    if (b.t === 'chainfx') { const x0 = b.x0 * TS, y0 = b.y0 * TS, x1 = b.x1 * TS, y1 = b.y1 * TS, n = 6, jag = Math.hypot(x1 - x0, y1 - y0) * 0.07; g.lineJoin = 'round'; for (const [w, c] of [[8, rgba(col, 0.35)], [3, '#ffffff']]) { g.beginPath(); g.moveTo(x0, y0); for (let j = 1; j < n; j++) { const u = j / n; g.lineTo(x0 + (x1 - x0) * u + (Math.sin(b.t0 + j * 7) * jag), y0 + (y1 - y0) * u + (Math.cos(b.t0 * 1.3 + j * 5) * jag)); } g.lineTo(x1, y1); g.lineWidth = w; g.strokeStyle = c; g.stroke(); } glyph(g, b.th ?? 'spirit', x1, y1, 9 * (1 - k * 0.5), k * 6, col); }
    else { const x0 = b.x0 * TS, y0 = b.y0 * TS, x1 = b.x1 * TS, y1 = b.y1 * TS; for (let j = 0; j < 7; j++) { const u = j / 6; glyph(g, b.th ?? 'spirit', x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - 10, 9 * (1 - u * 0.4), u * 5, col, (1 - u * 0.5) * 0.8); } g.beginPath(); g.moveTo(x0, y0 - 10); g.lineTo(x1, y1 - 10); g.strokeStyle = rgba(col, 0.5); g.lineWidth = 6; g.stroke(); }
    g.restore();
  }
}
