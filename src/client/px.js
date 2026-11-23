// Pixel-art toolkit. ONE art pixel = 2 world pixels = (zoom × 2) screen pixels, everywhere:
// tiles are 16×16 art pixels, characters 16×24, icons 16×16, text uses a 3×5 bitmap font.
export const C = 2;                                   // world px per art pixel
export const q = (v) => Math.round(v / C) * C;        // snap a world coordinate to the art grid

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const shade = (h, k) => { const c = hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * k)))); return rgb(c); };
export const tint = (h, to, t) => rgb(mixc(hex(h), hex(to), t));
export const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ── pen: draw in ART pixels onto a small canvas ─────────────────────────────
export class Pen {
  constructor(g) { this.g = g; }
  p(x, y, c) { this.g.fillStyle = c; this.g.fillRect(x | 0, y | 0, 1, 1); return this; }
  r(x, y, w, h, c) { this.g.fillStyle = c; this.g.fillRect(x | 0, y | 0, w | 0, h | 0); return this; }
  disc(cx, cy, rad, c) { this.g.fillStyle = c; for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad + 0.3) this.g.fillRect(x, y, 1, 1); return this; }
  ell(cx, cy, rx, ry, c) { this.g.fillStyle = c; for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.05) this.g.fillRect(x, y, 1, 1); return this; }
  line(x0, y0, x1, y1, c) { let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy; this.g.fillStyle = c; for (;;) { this.g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return this; }
  rows(x, y, rows, pal) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ' && pal[ch]) this.p(x + i, y + j, pal[ch]); })); return this; }
}

// Build a sprite. fn(pen, g, w, h) draws in art pixels. `outline` adds a 1px dark edge (the classic pixel-art look).
export function sprite(w, h, fn, { outline = '#14101c' } = {}) {
  const pad = outline ? 1 : 0, c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.translate(pad, pad); fn(new Pen(g), g, w, h); g.setTransform(1, 0, 0, 1, 0, 0);
  return outline ? outlined(c, outline, pad) : c;
}
// Add the 1px dark edge to a canvas that has empty room around it (pad px).
export function outlined(c, outline = '#14101c', pad = 1) {
  const g = c.getContext('2d'), src = g.getImageData(0, 0, c.width, c.height), out = g.createImageData(c.width, c.height), oc = hex(outline);
  const A = (x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : src.data[(y * c.width + x) * 4 + 3]);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (src.data[i + 3] > 0) { out.data.set(src.data.subarray(i, i + 4), i); continue; }
    if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) out.data.set([oc[0], oc[1], oc[2], 255], i);
  }
  g.putImageData(out, 0, 0); c.pad = pad; return c;
}
// Re-sample an UN-outlined sprite to a smaller grid (area average, hard alpha) so characters can be a size
// between the 16×26 master drawing and a full redraw — every pixel of the result is still one art pixel.
export function shrink(spr, nw, nh, pad = 1, outline = '#14101c') {
  const sg = spr.getContext('2d'), sd = sg.getImageData(0, 0, spr.width, spr.height).data, c = document.createElement('canvas'); c.width = nw + pad * 2; c.height = nh + pad * 2;
  const g = c.getContext('2d'), out = g.createImageData(c.width, c.height), kx = spr.width / nw, ky = spr.height / nh;
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    let r = 0, gg = 0, b = 0, a = 0, n = 0, wsum = 0;
    for (let yy = Math.floor(y * ky); yy < Math.min(spr.height, Math.ceil((y + 1) * ky)); yy++) for (let xx = Math.floor(x * kx); xx < Math.min(spr.width, Math.ceil((x + 1) * kx)); xx++) {
      const i = (yy * spr.width + xx) * 4, al = sd[i + 3] / 255; n++; a += al; if (al) { r += sd[i] * al; gg += sd[i + 1] * al; b += sd[i + 2] * al; wsum += al; }
    }
    if (a / n >= 0.45 && wsum) out.data.set([Math.round(r / wsum), Math.round(gg / wsum), Math.round(b / wsum), 255], ((y + pad) * c.width + x + pad) * 4);
  }
  g.putImageData(out, 0, 0); return outlined(c, outline, pad);
}
export function flashed(spr, color = '#ffffff') {
  const c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height; const g = c.getContext('2d');
  g.drawImage(spr, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); c.pad = spr.pad; return c;
}
export function flipped(spr) { const c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height; const g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(spr, 0, 0); c.pad = spr.pad; return c; }

// Draw a sprite in world space: (x, y) = bottom-centre anchor (feet). Everything lands on the art grid.
export function blit(g, spr, x, y, { ax = 0.5, ay = 1 } = {}) {
  const w = spr.width * C, h = spr.height * C;
  g.drawImage(spr, q(x - w * ax), q(y - h * ay), w, h);
}

// ── 3×5 bitmap font (uppercase only) ────────────────────────────────────────
const ROWS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['.##', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.##', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'], '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'], '-': ['...', '...', '###', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'], '$': ['.##', '##.', '.#.', '.##', '##.'], "'": ['.#.', '.#.', '...', '...', '...'], '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '*': ['#.#', '.#.', '###', '.#.', '#.#'], '#': ['#.#', '###', '#.#', '###', '#.#'], '=': ['...', '###', '...', '###', '...'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'], '_': ['...', '...', '...', '...', '###'], '·': ['...', '...', '.#.', '...', '...'], '[': ['##.', '#..', '#..', '#..', '##.'], ']': ['.##', '..#', '..#', '..#', '.##'],
};
const F = Object.fromEntries(Object.entries(ROWS).map(([k, r]) => [k, r.join('')]));
// Glyph strings above are 15 chars: rows of 3 columns, top to bottom.
export const FONT = F;
export const textWidth = (s, scale = 1) => [...String(s)].length * 4 * scale * C - scale * C;
export function drawText(g, text, x, y, color = '#fff', { scale = 1, outline = '#0c0814', align = 'left', shadow = false } = {}) {
  text = String(text).toUpperCase().replace(/×/g, 'X').replace(/[–—]/g, '-').replace(/[•]/g, '·');
  const s = C * scale; let cx = align === 'center' ? x - textWidth(text, scale) / 2 : align === 'right' ? x - textWidth(text, scale) : x;
  cx = q(cx); const cy = q(y);
  const put = (ox, oy, col) => { g.fillStyle = col; let px = cx; for (const ch of text) { const gl = F[ch]; if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '#') g.fillRect(px + (i % 3) * s + ox, cy + ((i / 3) | 0) * s + oy, s, s); px += 4 * s; } };
  if (outline) { put(-s, 0, outline); put(s, 0, outline); put(0, -s, outline); put(0, s, outline); }
  else if (shadow) put(0, s, '#0c0814');
  put(0, 0, color);
}
// Label with a solid plate (used for names above heads)
export function drawTag(g, text, x, yBottom, color = '#fff', { scale = 1, bg = '#1a1424', border = '#4a3a5a', align = 'center', padX = 2, padY = 2 } = {}) {
  const w = textWidth(text, scale) + 2 * padX * C, h = 5 * scale * C + 2 * padY * C, X = q(align === 'center' ? x - w / 2 : x), Y = q(yBottom - h);
  g.fillStyle = border; g.fillRect(X - C, Y - C, w + 2 * C, h + 2 * C); g.fillStyle = bg; g.fillRect(X, Y, w, h);
  drawText(g, text, X + padX * C, Y + padY * C, color, { scale, outline: null });
}

// ── pixel-grid effect primitives (all in world px, snapped to the art grid) ──
export function cellAt(g, x, y, col, s = 1) { g.fillStyle = col; g.fillRect(q(x), q(y), C * s, C * s); }
export function pdisc(g, cx, cy, r, col, dither = 0) {
  g.fillStyle = col; const x0 = q(cx - r), x1 = q(cx + r), y0 = q(cy - r), y1 = q(cy + r);
  for (let y = y0; y <= y1; y += C) for (let x = x0; x <= x1; x += C) { if (dither && (((x / C) + (y / C)) & 1)) continue; if ((x + 1 - cx) ** 2 + (y + 1 - cy) ** 2 <= r * r) g.fillRect(x, y, C, C); }
}
export function pring(g, cx, cy, r, thick, col) {
  g.fillStyle = col; const x0 = q(cx - r), x1 = q(cx + r), y0 = q(cy - r), y1 = q(cy + r), r2 = r * r, i2 = (r - thick) ** 2;
  for (let y = y0; y <= y1; y += C) for (let x = x0; x <= x1; x += C) { const d = (x + 1 - cx) ** 2 + (y + 1 - cy) ** 2; if (d <= r2 && d >= i2) g.fillRect(x, y, C, C); }
}
const angd = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
export function psector(g, cx, cy, R, a, half, col, { dither = 0, inner = 0, ring = 0 } = {}) {
  g.fillStyle = col; const x0 = q(cx - R), x1 = q(cx + R), y0 = q(cy - R), y1 = q(cy + R), R2 = R * R, I2 = inner * inner, E2 = (R - (ring || 0)) ** 2;
  for (let y = y0; y <= y1; y += C) for (let x = x0; x <= x1; x += C) {
    const dx = x + 1 - cx, dy = y + 1 - cy, d = dx * dx + dy * dy; if (d > R2 || d < I2) continue;
    if (d > 16 && angd(Math.atan2(dy, dx), a) > half) continue;
    if (ring && d < E2) continue; if (dither && (((x / C) + (y / C)) & 1)) continue; g.fillRect(x, y, C, C);
  }
}
export function parc(g, cx, cy, R, a0, a1, thick, col) {
  g.fillStyle = col; const step = (C * 0.7) / R, seen = new Set();
  for (let a = a0; a <= a1; a += step) for (let t = 0; t < thick; t += C) { const x = q(cx + Math.cos(a) * (R - t)), y = q(cy + Math.sin(a) * (R - t)), k = x * 7919 + y; if (!seen.has(k)) { seen.add(k); g.fillRect(x, y, C, C); } }
}
export function pline(g, x0, y0, x1, y1, col, s = 1) {
  g.fillStyle = col; let ax = Math.round(x0 / C), ay = Math.round(y0 / C); const bx = Math.round(x1 / C), by = Math.round(y1 / C), dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1; let e = dx + dy;
  for (let n = 0; n < 400; n++) { g.fillRect(ax * C, ay * C, C * s, C * s); if (ax === bx && ay === by) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; ax += sx; } if (e2 <= dx) { e += dx; ay += sy; } }
}
export function prect(g, x, y, w, h, col, dither = 0) {
  g.fillStyle = col; const x0 = q(x), y0 = q(y);
  for (let j = 0; j < h; j += C) for (let i = 0; i < w; i += C) { if (dither && (((i / C) + (j / C)) & 1)) continue; g.fillRect(x0 + i, y0 + j, C, C); }
}
// Dithered screen-edge vignette, pre-rendered at low res and scaled up with hard pixels.
const vig = {};
export function vignette(g, W, H, color, strength, key) {
  const cell = 8, w = Math.ceil(W / cell), h = Math.ceil(H / cell), k = `${key}:${w}x${h}`;
  if (!vig[k]) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext('2d'), img = cg.createImageData(w, h), col = hex(color), B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const band = { main: 5, hollow: 9, red: 11 }[key] ?? 6;                 // width of the dithered border, in 8px cells
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const edge = Math.min(x, w - 1 - x, y, h - 1 - y), t = Math.min(1, Math.max(0, 1 - edge / band)); if (t > (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16) img.data.set([col[0], col[1], col[2], 255], (y * w + x) * 4); }
    cg.putImageData(img, 0, 0); vig[k] = c;
  }
  g.save(); g.globalAlpha = strength; g.imageSmoothingEnabled = false; g.drawImage(vig[k], 0, 0, w * cell, h * cell); g.restore();
}
