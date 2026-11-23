// Visuals for the advancement skills (levels 35 / 55 / 80). The server sends what is on the battlefield — circling blades, rings, beams, falling
// meteors, vortices, zones, bombs on enemies, familiars and totems — and this draws it. The THEME of a skill decides the objects themselves
// (a blade is not a feather is not a coin), so a sword skill and an archer skill that use the same mechanic still look nothing alike.
import { TS } from '../world.js';

const TRAILS = new Map();
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = Math.random;
const rgba = (hex, a) => { const n = parseInt((hex ?? '#ffffff').slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const OUT = '#14101c';
const shadeHex = (hex, k) => { const n = parseInt((hex ?? '#888888').slice(1), 16); return `rgb(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`; };

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
  dice: (g, s, c) => { const r = s * 0.95; g.fillStyle = '#fbf6ea'; g.fillRect(-r, -r, r * 2, r * 2); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(-r, r * 0.55, r * 2, r * 0.45); g.lineWidth = 2; g.strokeStyle = c; g.strokeRect(-r, -r, r * 2, r * 2); g.fillStyle = '#1a1420'; for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]]) { g.beginPath(); g.arc(x * r, y * r, r * 0.17, 0, TAU); g.fill(); } },
  card: (g, s, c) => { const w = s * 1.1, h = s * 1.55; g.fillStyle = '#fbf6ea'; g.fillRect(-w, -h, w * 2, h * 2); g.lineWidth = 2; g.strokeStyle = c; g.strokeRect(-w, -h, w * 2, h * 2); g.fillStyle = c; g.beginPath(); g.moveTo(0, -h * 0.55); g.lineTo(w * 0.6, 0); g.lineTo(0, h * 0.55); g.lineTo(-w * 0.6, 0); g.closePath(); g.fill(); g.fillStyle = '#1a1420'; g.fillRect(-w * 0.8, -h * 0.85, w * 0.28, h * 0.2); },
  quill: (g, s, c) => { g.beginPath(); g.moveTo(0, s * 1.5); g.lineTo(-s * 0.1, s * 0.4); g.lineWidth = 2; g.strokeStyle = '#1a1420'; g.stroke(); g.beginPath(); g.moveTo(0, s * 0.6); g.quadraticCurveTo(s * 0.9, -s * 0.2, s * 0.15, -s * 1.5); g.quadraticCurveTo(-s * 0.7, -s * 0.2, 0, s * 0.6); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, s * 0.6); g.lineTo(s * 0.1, -s * 1.3); g.stroke(); g.fillStyle = '#1a1420'; g.fillRect(-s * 0.18, s * 1.3, s * 0.3, s * 0.3); },
  page: (g, s, c) => { g.fillStyle = '#f4ecd0'; g.fillRect(-s * 0.8, -s, s * 1.6, s * 2); g.lineWidth = 2; g.strokeStyle = c; g.strokeRect(-s * 0.8, -s, s * 1.6, s * 2); g.fillStyle = c; for (let i = 0; i < 4; i++) g.fillRect(-s * 0.55, -s * 0.65 + i * s * 0.42, s * (i === 3 ? 0.6 : 1.1), s * 0.12); },
  ink: (g, s, c) => { g.beginPath(); g.moveTo(0, -s * 1.4); g.bezierCurveTo(s * 1.1, -s * 0.1, s * 0.9, s * 1.1, 0, s * 1.1); g.bezierCurveTo(-s * 0.9, s * 1.1, -s * 1.1, -s * 0.1, 0, -s * 1.4); g.fillStyle = '#0c1418'; g.fill(); g.lineWidth = 2; g.strokeStyle = c; g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-s * 0.45, -s * 0.1, s * 0.22, s * 0.5); },
  hammer: (g, s, c) => { g.fillStyle = '#7a5a34'; g.fillRect(-s * 0.15, -s * 0.6, s * 0.3, s * 2); g.fillStyle = '#aab2bc'; g.fillRect(-s * 0.9, -s * 1.3, s * 1.8, s * 0.8); g.fillStyle = '#e8eef4'; g.fillRect(-s * 0.9, -s * 1.3, s * 1.8, s * 0.2); g.fillStyle = c; g.fillRect(-s * 0.9, -s * 0.6, s * 1.8, s * 0.1); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(-s * 0.9, -s * 1.3, s * 1.8, s * 0.8); },
  anvil: (g, s, c) => { g.fillStyle = '#4a525c'; g.fillRect(-s * 0.6, s * 0.4, s * 1.2, s * 0.6); g.fillStyle = '#9aa3ad'; g.beginPath(); g.moveTo(-s * 1.2, -s * 0.5); g.lineTo(s * 0.9, -s * 0.5); g.lineTo(s * 1.5, -s * 0.2); g.lineTo(s * 0.7, 0); g.lineTo(s * 0.5, s * 0.45); g.lineTo(-s * 0.5, s * 0.45); g.lineTo(-s * 0.3, 0); g.lineTo(-s * 1.2, 0); g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); g.fillStyle = c; g.fillRect(-s * 1.1, -s * 0.5, s * 2, s * 0.12); },
  hourglass: (g, s, c) => { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-s * 0.8, -s); g.lineTo(s * 0.8, -s); g.lineTo(0, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.8, s); g.lineTo(-s * 0.8, s); g.closePath(); g.fillStyle = c; g.fill(); g.fillStyle = '#6a5a3a'; g.fillRect(-s * 0.95, -s * 1.15, s * 1.9, s * 0.2); g.fillRect(-s * 0.95, s * 0.95, s * 1.9, s * 0.2); },
  seed: (g, s, c) => { g.beginPath(); g.ellipse(0, 0, s * 0.6, s * 1.1, 0, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1a2a14'; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(0, -s * 0.9); g.lineTo(0, s * 0.9); g.stroke(); },
  gem: (g, s, c) => { g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(s, -s * 0.3); g.lineTo(0, s * 1.2); g.lineTo(-s, -s * 0.3); g.closePath(); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(s * 0.4, -s * 0.3); g.lineTo(-s * 0.4, -s * 0.3); g.closePath(); g.fill(); },
  crown: (g, s, c) => { g.beginPath(); g.moveTo(-s, s * 0.6); g.lineTo(-s, -s * 0.5); g.lineTo(-s * 0.5, 0); g.lineTo(0, -s * 0.9); g.lineTo(s * 0.5, 0); g.lineTo(s, -s * 0.5); g.lineTo(s, s * 0.6); g.closePath(); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#8a5a10'; g.stroke(); g.fillStyle = '#ff5a6a'; g.fillRect(-s * 0.12, s * 0.1, s * 0.24, s * 0.24); },
  eye: (g, s, c) => { g.beginPath(); g.moveTo(-s * 1.3, 0); g.quadraticCurveTo(0, -s * 1.2, s * 1.3, 0); g.quadraticCurveTo(0, s * 1.2, -s * 1.3, 0); g.fillStyle = '#f4eefc'; g.fill(); g.lineWidth = 2; g.strokeStyle = c; g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.55, 0, TAU); g.fillStyle = c; g.fill(); g.fillStyle = '#0c0814'; g.beginPath(); g.arc(0, 0, s * 0.25, 0, TAU); g.fill(); },
  leaf: (g, s, c) => { g.beginPath(); g.moveTo(0, -s * 1.4); g.quadraticCurveTo(s * 1.2, -s * 0.2, 0, s * 1.3); g.quadraticCurveTo(-s * 1.2, -s * 0.2, 0, -s * 1.4); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#143a1c'; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(0, s * 1.1); g.stroke(); },
  rivet: (g, s, c) => { g.fillStyle = '#c8d0d8'; g.fillRect(-s * 0.25, -s * 1.1, s * 0.5, s * 1.9); g.fillStyle = c; g.beginPath(); g.arc(0, s * 0.9, s * 0.6, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); },
  ember: (g, s, c) => { g.fillStyle = c; g.beginPath(); g.arc(0, 0, s * 0.8, 0, TAU); g.fill(); g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(-s * 0.15, -s * 0.15, s * 0.4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,200,120,.8)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s, Math.sin(a) * s); g.lineTo(Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.5); g.stroke(); } },
};
const FALL = { meteor: 'flame', arrow: 'feather', boulder: 'rock', bomb: 'bomb', coin: 'coin', drop: 'potion', dice: 'dice', card: 'card', quill: 'quill', anvil: 'anvil', hammer: 'hammer', seed: 'seed', gem: 'gem', page: 'page', ember: 'ember', star: 'light', hourglass: 'hourglass' };
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
    case 'tome': { const fl = Math.sin(t / 160 + p.id) * 2, op = 0.5 + 0.5 * Math.sin(t / 240 + p.id); g.translate(0, -22 + bob); g.fillStyle = rgba(col, 0.18); g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill();
      g.fillStyle = '#3a2a4a'; g.fillRect(-13, -2 + fl * 0.3, 26, 11); g.fillStyle = '#f4ecd0'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-7, -9 - op * 4, -13, -5); g.lineTo(-13, 6); g.quadraticCurveTo(-7, 1, 0, 6); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(7, -9 - op * 4, 13, -5); g.lineTo(13, 6); g.quadraticCurveTo(7, 1, 0, 6); g.closePath(); g.fill();
      g.fillStyle = col; for (let i = 0; i < 3; i++) { g.fillRect(-10, -3 + i * 3, 7, 1.5); g.fillRect(3, -3 + i * 3, 7, 1.5); } g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-13, -2, 26, 11); for (let i = 0; i < 4; i++) glyph(g, 'quill', Math.cos(t / 500 + i * 1.6) * 20, -8 - Math.abs(Math.sin(t / 380 + i)) * 10, 3.5, i, col, 0.8); break; }
    case 'homunculus': { const hop = Math.abs(Math.sin(t / 150 + p.id)) * 4; g.translate(0, -hop); g.fillStyle = shadeHex(col, 0.55); g.beginPath(); g.ellipse(0, -10, 9, 10, 0, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(-1, -11, 8, 9, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-4, -15, 3, 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#0c0814'; g.fillRect(-5, -13, 3, 4); g.fillRect(2, -13, 3, 4); g.fillStyle = '#fff'; g.fillRect(-4, -13, 1, 2); g.fillRect(3, -13, 1, 2); g.fillStyle = shadeHex(col, 0.55); g.fillRect(-6, -1 + (Math.floor(t / 120) % 2), 4, 4); g.fillRect(2, -1 + (Math.floor(t / 120 + 1) % 2), 4, 4); g.save(); g.translate(9, -9); g.rotate(Math.sin(t / 200 + p.id) * 0.5); glyph(g, 'potion', 4, -4, 5, 0, '#ffd36a'); g.restore(); break; }
    case 'golem': { const st = Math.floor(t / 260) % 2; g.fillStyle = '#3a3038'; g.fillRect(-12, -6, 9, 10 + st); g.fillRect(3, -6, 9, 10 + (1 - st)); g.fillStyle = '#6a5a52'; g.fillRect(-16, -24, 32, 20); g.fillStyle = '#8a7a72'; g.fillRect(-16, -24, 32, 4); g.fillStyle = '#4a3c38'; g.fillRect(-16, -8, 32, 4); g.fillRect(-22, -22, 8, 16 + st * 2); g.fillRect(14, -22, 8, 16 + (1 - st) * 2); g.fillStyle = col; g.fillRect(-4, -18, 8, 8); g.fillStyle = '#fff3b0'; g.fillRect(-2, -16, 4, 4);
      g.fillStyle = '#5a4a44'; g.fillRect(-9, -36, 18, 13); g.fillStyle = '#8a7a72'; g.fillRect(-9, -36, 18, 3); g.fillStyle = col; g.fillRect(-6, -31, 4, 3); g.fillRect(2, -31, 4, 3); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-16, -24, 32, 20); g.strokeRect(-9, -36, 18, 13); break; }
    case 'treant': { const sw = Math.sin(t / 700 + p.id) * 2; g.fillStyle = '#4a3220'; g.fillRect(-10, -26, 20, 28); g.fillStyle = '#6a4a30'; g.fillRect(-10, -26, 6, 28); g.fillStyle = '#3a2618'; g.beginPath(); g.moveTo(-12, 2); g.lineTo(-18, 6); g.lineTo(-8, 0); g.moveTo(12, 2); g.lineTo(18, 6); g.lineTo(8, 0); g.fill();
      g.strokeStyle = '#4a3220'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9, -20); g.quadraticCurveTo(-24, -26 + sw, -26, -12 + sw); g.moveTo(9, -20); g.quadraticCurveTo(24, -26 - sw, 26, -12 - sw); g.stroke();
      for (const [bx, by, br] of [[0, -40, 17], [-14, -32, 11], [14, -33, 11], [0, -30, 10]]) { g.fillStyle = shadeHex(col, 0.6); g.beginPath(); g.arc(bx + sw, by, br, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(bx + sw - 2, by - 2, br - 3, 0, TAU); g.fill(); }
      g.fillStyle = '#ffe36b'; g.fillRect(-6, -20, 3, 4); g.fillRect(3, -20, 3, 4); g.fillStyle = '#1a1008'; g.fillRect(-4, -13, 8, 2); for (let i = 0; i < 5; i++) glyph(g, 'leaf', Math.cos(t / 900 + i * 1.3) * 22, -22 - ((t / 40 + i * 20) % 36), 3.5, i, col, 0.75); break; }
    case 'maw': { const open = 0.6 + 0.4 * Math.sin(t / 180), R = p.r > 0 ? 16 : 14; g.fillStyle = rgba(col, 0.15); g.beginPath(); g.arc(0, -14, 30 + Math.sin(t / 150) * 3, 0, TAU); g.fill(); for (let i = 0; i < 3; i++) { g.strokeStyle = rgba(col, 0.5 - i * 0.12); g.lineWidth = 3; g.beginPath(); g.arc(0, -14, 14 + ((t / 25 + i * 14) % 42), 0, TAU); g.stroke(); }
      g.fillStyle = '#0c0814'; g.beginPath(); g.arc(0, -14, R, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke(); g.beginPath(); g.ellipse(0, -14, 11, 7 * open, 0, 0, TAU); g.fillStyle = '#f4eefc'; g.fill(); g.fillStyle = col; g.beginPath(); g.arc(0, -14, 4.5, 0, TAU); g.fill(); g.fillStyle = '#0c0814'; g.beginPath(); g.arc(0, -14, 2, 0, TAU); g.fill(); break; }
    case 'furnace': { const fl = Math.sin(t / 90 + p.id); g.fillStyle = '#3a3640'; g.fillRect(-16, -26, 32, 30); g.fillStyle = '#5a5662'; g.fillRect(-16, -26, 32, 5); g.fillRect(-16, -26, 4, 30); g.fillStyle = '#2a2630'; g.fillRect(-9, -40, 18, 15); g.fillStyle = '#1a1420'; g.fillRect(-8, -16, 16, 12); g.fillStyle = col; g.fillRect(-7, -15, 14, 10); g.fillStyle = '#ffd36a'; g.fillRect(-5, -13 - fl, 10, 7); g.fillStyle = '#fff3b0'; g.fillRect(-3, -11 - fl, 6, 4);
      g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-16, -26, 32, 30); for (let i = 0; i < 6; i++) glyph(g, 'ember', Math.sin(t / 300 + i * 2) * 10, -42 - ((t / 22 + i * 17) % 40), 2.5, 0, '#ffb84a', 0.8); break; }
    case 'vault': { g.fillStyle = '#6a4a14'; g.fillRect(-18, -22, 36, 24); g.fillStyle = '#e8c04a'; g.fillRect(-18, -22, 36, 5); g.fillRect(-18, -22, 4, 24); g.fillStyle = '#b8902a'; g.fillRect(-18, -4, 36, 6); g.beginPath(); g.moveTo(-18, -22); g.quadraticCurveTo(0, -42, 18, -22); g.closePath(); g.fillStyle = '#c89a2a'; g.fill(); g.fillStyle = '#fff6c0'; g.fillRect(-3, -18, 6, 8); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-18, -22, 36, 24); g.fillStyle = '#ffd36a'; for (let i = 0; i < 5; i++) { const q = (t / 700 + i * 0.2) % 1; glyph(g, 'coin', -10 + i * 5, -30 - Math.sin(q * Math.PI) * 14, 3.2, q * 6, '#ffd36a', 0.9); } break; }
    default: g.fillStyle = col; g.beginPath(); g.arc(0, -8, 8, 0, TAU); g.fill();
  }
  g.restore();
  if (p.r > 0) { const k = (now - p.ws) / 1000, pulse = 1 + Math.sin(k * 3) * 0.03; g.save(); g.setLineDash([10, 8]); g.lineDashOffset = -t / 40; g.strokeStyle = rgba(col, 0.55); g.lineWidth = 2; g.beginPath(); g.arc(x, y, p.r * TS * pulse, 0, TAU); g.stroke(); g.fillStyle = rgba(col, 0.07); g.fill(); g.restore(); }
}

// ── transient bolts and trails (chain lightning, blinks) ──
const bolts = [];
export function scriptEvent(e) { bolts.push({ ...e, t0: performance.now() }); if (bolts.length > 60) bolts.shift(); }

export function drawScriptFx(g, pz, now, t) {
  if (TRAILS.size > 40) for (const [k, v] of TRAILS) if (now - (v.seen ?? 0) > 2000) TRAILS.delete(k);
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
          const FALLG = FALL[z.fall] ?? th, s = z.fall === 'meteor' || z.fall === 'boulder' || z.fall === 'anvil' || z.fall === 'hammer' ? 16 : z.fall === 'arrow' || z.fall === 'quill' ? 9 : 12;
          if (warn) { g.beginPath(); g.arc(x, y, z.r * TS, 0, TAU); g.strokeStyle = rgba(col, 0.45 + 0.35 * p); g.lineWidth = 2; g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]); g.fillStyle = rgba(col, 0.05 + 0.14 * p); g.fill();
            const fy = y - (1 - p) * (z.fall === 'arrow' ? 200 : 170), fx = x + (1 - p) * (z.fall === 'meteor' ? -50 : 0); glyph(g, FALLG, fx, fy, s, z.fall === 'arrow' ? Math.PI : z.fall === 'meteor' ? -0.5 : t / 150, col, 0.4 + 0.6 * p);
            if (z.fall === 'meteor') { g.strokeStyle = rgba(col, 0.35); g.lineWidth = 6; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx - 12, fy - 30); g.stroke(); } }
          else { const k = clamp(el / 0.26, 0, 1); g.beginPath(); g.arc(x, y, z.r * TS * (0.6 + 0.4 * k), 0, TAU); g.fillStyle = rgba(col, 0.6 * (1 - k)); g.fill(); g.lineWidth = 3; g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; g.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + z.id; glyph(g, FALLG, x + Math.cos(a) * z.r * TS * k * 1.2, y + Math.sin(a) * z.r * TS * k * 1.2 - 8 * k, 5, a, col, 1 - k); } }
          break;
        }
        case 'line': {
          const L = z.len * TS, W = z.w * TS, SUIT = ['#e8e8ff', '#ff6a8a', '#ffd36a', '#7affb0'], lc = th === 'card' && z.suit != null ? SUIT[z.suit] : col; g.save(); g.translate(x, y); g.rotate(z.a);
          if (z.big) { g.shadowColor = '#ffd36a'; g.shadowBlur = 24; }
          if (warn) { g.fillStyle = rgba(lc, 0.05 + 0.13 * p); g.fillRect(0, -W / 2, L, W); g.strokeStyle = rgba(z.big ? '#ffd36a' : lc, 0.6 + (z.big ? 0.3 : 0)); g.setLineDash([9, 7]); g.strokeRect(0, -W / 2, L, W); g.setLineDash([]); glyph(g, th, L * p, 0, z.big ? 13 : 8, t / 100, lc, 0.9); }
          else { g.fillStyle = rgba(z.big ? '#ffd36a' : lc, 0.75 * flick); g.fillRect(0, -W / 2, L, W); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, -W * 0.18, L, W * 0.36); for (let k = 1; k < 8; k++) glyph(g, th, k * L / 8, (rnd() - 0.5) * W * 0.6, z.big ? 9 : 6, rnd() * 6, lc, 0.9); }
          g.shadowBlur = 0; g.restore(); break;
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
        case 'mine': {
          const R = z.r * TS, arm = clamp((now - z.ws) / Math.max(1, z.we - z.ws), 0, 1), pulse = 0.5 + 0.5 * Math.sin(t / 220 + z.id), fade = clamp((z.ae - now) / 600, 0, 1);
          g.save(); g.globalAlpha = (0.35 + 0.65 * arm) * fade; g.setLineDash([5, 6]); g.lineDashOffset = -t / 50; g.strokeStyle = rgba(col, 0.25 + 0.3 * pulse); g.lineWidth = 2; g.beginPath(); g.arc(x, y, R * 0.75, 0, TAU); g.stroke(); g.setLineDash([]);
          g.fillStyle = rgba(col, 0.08 + 0.08 * pulse); g.beginPath(); g.arc(x, y, R * 0.75, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x, y + 8, 9, 3, 0, 0, TAU); g.fill();
          glyph(g, th, x, y - 3 - pulse * 2, 9 + pulse * 1.5, Math.sin(t / 400 + z.id) * 0.2, col); g.restore(); break;
        }
        case 'seeker': {
          const tr = (TRAILS.get(z.id) ?? TRAILS.set(z.id, []).get(z.id)); tr.push([x, y]); if (tr.length > 9) tr.shift(); tr.seen = now;
          const fade = clamp((now - z.ws) / 200, 0, 1) * clamp((z.ae - now) / 250, 0, 1);
          for (let k = 0; k < tr.length - 1; k++) glyph(g, th, tr[k][0], tr[k][1], 3 + k * 0.5, (z.a ?? 0) + Math.PI / 2, col, (k / tr.length) * 0.5 * fade);
          g.save(); g.shadowColor = col; g.shadowBlur = 14; glyph(g, th, x, y, 10, (z.a ?? 0) + Math.PI / 2, col, fade); g.restore(); break;
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
    const b = bolts[i], k = (nowp - b.t0) / (b.kind === 'blink' ? 500 : b.t === 'pullfx' ? 420 : b.t === 'markfx' ? 700 : 320); if (k >= 1) { bolts.splice(i, 1); continue; }
    g.save(); g.globalAlpha = 1 - k; const col = b.col ?? '#fff';
    if (b.t === 'pullfx') { const x = b.x * TS, y = b.y * TS; for (let i = 0; i < 3; i++) { const kk = (k * 1.4 + i / 3) % 1, rr = b.r * TS * (1 - kk); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.strokeStyle = rgba(col, 0.5 * (1 - kk)); g.lineWidth = 4 - kk * 2; g.stroke(); } for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = b.r * TS * (1 - ((k * 1.2 + i * 0.13) % 1)); glyph(g, b.th ?? 'spirit', x + Math.cos(a) * rr, y + Math.sin(a) * rr, 6, a, col, 0.9); } }
    else if (b.t === 'markfx') { const x = b.x * TS, y = b.y * TS, rr = b.r * TS * (0.4 + 0.6 * k); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.strokeStyle = rgba(col, 0.9 * (1 - k)); g.lineWidth = 3; g.stroke(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + k * 2; glyph(g, 'eye', x + Math.cos(a) * rr, y + Math.sin(a) * rr, 5, a, col, 0.9 * (1 - k)); } }
    else if (b.t === 'chainfx') { const x0 = b.x0 * TS, y0 = b.y0 * TS, x1 = b.x1 * TS, y1 = b.y1 * TS, n = 6, jag = Math.hypot(x1 - x0, y1 - y0) * 0.07; g.lineJoin = 'round'; for (const [w, c] of [[8, rgba(col, 0.35)], [3, '#ffffff']]) { g.beginPath(); g.moveTo(x0, y0); for (let j = 1; j < n; j++) { const u = j / n; g.lineTo(x0 + (x1 - x0) * u + (Math.sin(b.t0 + j * 7) * jag), y0 + (y1 - y0) * u + (Math.cos(b.t0 * 1.3 + j * 5) * jag)); } g.lineTo(x1, y1); g.lineWidth = w; g.strokeStyle = c; g.stroke(); } glyph(g, b.th ?? 'spirit', x1, y1, 9 * (1 - k * 0.5), k * 6, col); }
    else { const x0 = b.x0 * TS, y0 = b.y0 * TS, x1 = b.x1 * TS, y1 = b.y1 * TS; for (let j = 0; j < 7; j++) { const u = j / 6; glyph(g, b.th ?? 'spirit', x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - 10, 9 * (1 - u * 0.4), u * 5, col, (1 - u * 0.5) * 0.8); } g.beginPath(); g.moveTo(x0, y0 - 10); g.lineTo(x1, y1 - 10); g.strokeStyle = rgba(col, 0.5); g.lineWidth = 6; g.stroke(); }
    g.restore();
  }
}
