// Boss hazards on the floor: a warning that fills up, then a bright strike. Everything is drawn from the server's hazard records and the
// server clock, so what you see is exactly what will hurt (see src/server/bosses.js for the geometry rules).
import { TS } from '../world.js';
import { ELEMENT_COLOR, orbPos } from '../server/bosses.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function drawHazards(g, haz, now, t) {
  if (!haz?.length) return;
  g.save();
  for (const h of haz) {
    if (now < h.ws - 40) continue;
    const col = ELEMENT_COLOR[h.el] ?? '#ff7a3a', warning = now < h.we, p = clamp((now - h.ws) / Math.max(1, h.we - h.ws), 0, 1), x = h.x * TS, y = h.y * TS, flick = 0.82 + 0.18 * Math.sin(t / 55 + h.id);
    const fillA = warning ? 0.07 + 0.2 * p : 0.55 * flick, edge = warning ? rgba(col, 0.55 + 0.35 * p) : '#ffffff';
    g.lineWidth = warning ? 2 : 3; g.setLineDash(warning ? [8, 6] : []);
    const outline = () => { g.strokeStyle = edge; g.stroke(); };
    switch (h.k) {
      case 'circle': {
        g.beginPath(); g.arc(x, y, h.r * TS, 0, TAU); g.fillStyle = rgba(col, fillA); g.fill(); outline();
        if (warning) { g.beginPath(); g.arc(x, y, h.r * TS * p, 0, TAU); g.fillStyle = rgba(col, 0.28); g.fill(); } else { g.beginPath(); g.arc(x, y, h.r * TS * 0.55, 0, TAU); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); }
        break;
      }
      case 'donut': {
        g.beginPath(); g.arc(x, y, h.r * TS, 0, TAU); g.arc(x, y, h.r0 * TS, 0, TAU, true); g.fillStyle = rgba(col, fillA); g.fill('evenodd'); g.beginPath(); g.arc(x, y, h.r * TS, 0, TAU); outline();
        g.beginPath(); g.arc(x, y, h.r0 * TS, 0, TAU); g.strokeStyle = warning ? 'rgba(140,255,170,.8)' : 'rgba(140,255,170,.35)'; g.stroke();
        if (warning) { g.beginPath(); g.arc(x, y, (h.r0 + (h.r - h.r0) * p) * TS, 0, TAU); g.strokeStyle = rgba(col, 0.7); g.setLineDash([]); g.lineWidth = 4; g.stroke(); }
        break;
      }
      case 'beams': {
        const t0 = (now - h.ws) / 1000;
        for (let i = 0; i < h.n; i++) {
          const a = h.a + (i / h.n) * TAU + h.spin * t0, L = h.len * TS, W = h.w * TS; g.save(); g.translate(x, y); g.rotate(a);
          if (warning) { g.fillStyle = rgba(col, 0.1 + 0.12 * p); g.fillRect(0, -W / 2, L, W); g.strokeStyle = rgba(col, 0.55); g.setLineDash([10, 8]); g.strokeRect(0, -W / 2, L, W); }
          else { const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(1, rgba(col, 0.45)); g.fillStyle = gr; g.fillRect(0, -W / 2, L, W); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(0, -W * 0.14, L, W * 0.28); }
          g.restore();
        }
        g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fillStyle = rgba(col, 0.8); g.fill();
        break;
      }
      case 'line': {
        const L = h.len * TS, W = h.w * TS; g.save(); g.translate(x, y); g.rotate(h.a);
        g.fillStyle = rgba(col, warning ? 0.08 + 0.2 * p : 0.7 * flick); g.fillRect(0, -W / 2, L, W); g.strokeStyle = edge; g.strokeRect(0, -W / 2, L, W);
        if (warning) { g.fillStyle = rgba(col, 0.3); g.fillRect(0, -W / 2, L * p, W); } else { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, -W * 0.15, L, W * 0.3); }
        g.restore(); break;
      }
      case 'cone': {
        g.beginPath(); g.moveTo(x, y); g.arc(x, y, h.len * TS, h.a - h.arc / 2, h.a + h.arc / 2); g.closePath(); g.fillStyle = rgba(col, fillA); g.fill(); outline();
        if (warning) { g.beginPath(); g.moveTo(x, y); g.arc(x, y, h.len * TS * p, h.a - h.arc / 2, h.a + h.arc / 2); g.closePath(); g.fillStyle = rgba(col, 0.3); g.fill(); }
        break;
      }
      case 'wall': {
        const dx = Math.cos(h.a), dy = Math.sin(h.a), run = h.speed * (h.ae - h.we) / 1000, ph = warning ? 0 : h.speed * (now - h.we) / 1000;
        g.save(); g.translate(x, y); g.rotate(h.a);
        // the path it will sweep
        g.fillStyle = rgba(col, warning ? 0.05 + 0.08 * p : 0.05); g.fillRect(0, -h.span * TS / 2, run * TS, h.span * TS);
        g.strokeStyle = rgba(col, 0.4); g.setLineDash([12, 10]); g.strokeRect(0, -h.span * TS / 2, run * TS, h.span * TS);
        // the gap, drawn as a lit corridor
        g.fillStyle = 'rgba(140,255,170,.18)'; g.fillRect(0, (h.gapAt - h.gapW / 2) * TS, run * TS, h.gapW * TS);
        const wx = ph * TS - h.w * TS / 2, WW = h.w * TS, seg = (a0, a1) => { g.fillStyle = rgba(col, warning ? 0.1 + 0.25 * p : 0.8 * flick); g.fillRect(wx, a0 * TS, WW, (a1 - a0) * TS); g.strokeStyle = edge; g.setLineDash([]); g.strokeRect(wx, a0 * TS, WW, (a1 - a0) * TS); };
        seg(-h.span / 2, h.gapAt - h.gapW / 2); seg(h.gapAt + h.gapW / 2, h.span / 2);
        g.restore(); void dx; void dy; break;
      }
      case 'spots': {
        const R = h.r * TS; g.beginPath(); g.rect(x - R, y - R, R * 2, R * 2); for (const [sx, sy, sr] of h.safe) { g.moveTo(sx * TS + sr * TS, sy * TS); g.arc(sx * TS, sy * TS, sr * TS, 0, TAU, true); }
        g.fillStyle = rgba(col, warning ? 0.05 + 0.3 * p : 0.65 * flick); g.fill('evenodd');
        for (const [sx, sy, sr] of h.safe) { g.beginPath(); g.arc(sx * TS, sy * TS, sr * TS, 0, TAU); g.strokeStyle = `rgba(150,255,180,${0.6 + 0.3 * Math.sin(t / 150)})`; g.lineWidth = 4; g.setLineDash([]); g.stroke(); g.fillStyle = 'rgba(140,255,170,.12)'; g.fill(); }
        break;
      }
      case 'tiles': {
        const S = h.size * TS, X0 = x - (h.cols * S) / 2, Y0 = y - (h.rows * S) / 2;
        for (let cy = 0; cy < h.rows; cy++) for (let cx = 0; cx < h.cols; cx++) { const bad = h.bad.includes(cy * h.cols + cx), px = X0 + cx * S, py = Y0 + cy * S; if (bad) { g.fillStyle = rgba(col, fillA); g.fillRect(px, py, S, S); if (warning) { g.fillStyle = rgba(col, 0.25); g.fillRect(px, py + S * (1 - p), S, S * p); } g.strokeStyle = edge; g.strokeRect(px + 1, py + 1, S - 2, S - 2); } else { g.strokeStyle = 'rgba(140,255,170,.28)'; g.setLineDash([]); g.strokeRect(px + 2, py + 2, S - 4, S - 4); } }
        break;
      }
      case 'orb': {
        const o = orbPos(h, now), ox = o.x * TS, oy = o.y * TS, r = h.r * TS;
        if (warning && h.go !== undefined) { g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(h.go) * 12 * TS, oy + Math.sin(h.go) * 12 * TS); g.strokeStyle = rgba(col, 0.28); g.lineWidth = 2; g.setLineDash([6, 8]); g.stroke(); }
        g.setLineDash([]); const gr = g.createRadialGradient(ox, oy, 2, ox, oy, r * 1.6); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.45, rgba(col, 0.9)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(ox, oy, r * 1.6, 0, TAU); g.fill();
        break;
      }
      case 'ring': {
        if (warning) { g.beginPath(); g.arc(x, y, 1.4 * TS * (0.4 + p), 0, TAU); g.strokeStyle = rgba(col, 0.5 + 0.4 * p); g.lineWidth = 3; g.setLineDash([]); g.stroke(); break; }
        const r = h.speed * (now - h.we) / 1000; if (r > h.r) break;
        g.setLineDash([]); g.beginPath(); g.arc(x, y, r * TS, 0, TAU); g.strokeStyle = rgba(col, 0.85); g.lineWidth = h.w * TS; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = h.w * TS * 0.3; g.stroke();
        break;
      }
      case 'closing': {
        const k = warning ? 0 : clamp((now - h.we) / (h.ae - h.we), 0, 1), r = (h.r + (h.r1 - h.r) * k) * TS, R = 40 * TS;
        g.beginPath(); g.rect(x - R, y - R, R * 2, R * 2); g.arc(x, y, r, 0, TAU, true); g.fillStyle = rgba(col, warning ? 0.04 + 0.1 * p : 0.32 * flick); g.fill('evenodd');
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = rgba(col, 0.9); g.lineWidth = 4; g.setLineDash(warning ? [12, 8] : []); g.stroke();
        break;
      }
      default: break;
    }
  }
  g.restore();
}
