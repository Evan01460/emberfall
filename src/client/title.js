// The title screen backdrop: a pixel-art night landscape — dithered sky, stars, moon, mountains, a lantern-lit town, drifting clouds, fireflies and embers.
const W = 320, H = 180;
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const SKY = ['#0a0620', '#120a34', '#1c0f48', '#2a1458', '#3d1a64', '#5a2470', '#7a3274', '#a24476', '#d0646a', '#f0925a'];
function ridge(seed, base, amp, scale, x) { return base + Math.sin(x / scale + seed) * amp + Math.sin(x / (scale * 0.37) + seed * 2.1) * amp * 0.5 + (hash(Math.floor(x / 3), 0, seed) - 0.5) * 2; }

export function startTitleScene() {
  const old = document.getElementById('title-scene'); old?.remove();
  const cv = document.createElement('canvas'); cv.id = 'title-scene'; cv.width = W; cv.height = H; document.body.prepend(cv);
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  const sky = document.createElement('canvas'); sky.width = W; sky.height = H; const sg = sky.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = (y / (H * 0.82)) * (SKY.length - 1), i = Math.min(SKY.length - 2, Math.floor(t)), f = t - i; sg.fillStyle = SKY[f * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? i + 1 : i]; sg.fillRect(x, y, 1, 1); }
  // static far scenery
  const far = document.createElement('canvas'); far.width = W; far.height = H; const fg = far.getContext('2d');
  for (let x = 0; x < W; x++) { const y1 = ridge(1.3, 118, 14, 38, x), y2 = ridge(4.1, 132, 9, 24, x); fg.fillStyle = '#2a1850'; fg.fillRect(x, Math.round(y1), 1, H); fg.fillStyle = '#1c1038'; fg.fillRect(x, Math.round(y2), 1, H); if (hash(x, 1) < 0.04) { fg.fillStyle = '#fff'; fg.fillRect(x, Math.round(y1) - 1, 1, 1); } }
  // the town on the hill
  const town = document.createElement('canvas'); town.width = W; town.height = H; const tg = town.getContext('2d');
  tg.fillStyle = '#120a28'; for (let x = 0; x < W; x++) tg.fillRect(x, Math.round(ridge(7.7, 146, 5, 30, x)), 1, H);
  const house = (x, y, w, h, roof) => { tg.fillStyle = '#0c0620'; tg.fillRect(x, y, w, h); tg.fillStyle = '#1a0e38'; for (let i = 0; i < roof; i++) tg.fillRect(x - i + roof, y - i - 1, w - (roof - i) * 2 + 0, 1); tg.fillRect(x - 1, y - roof, w + 2, 1); };
  const windows = []; const bld = [[40, 138, 20, 16, 5], [66, 132, 16, 22, 4], [90, 140, 24, 14, 6], [220, 136, 22, 18, 5], [248, 130, 18, 24, 5], [272, 140, 20, 14, 4]];
  for (const [x, y, w, h, r] of bld) { house(x, y, w, h, r); for (let i = 0; i < 2; i++) windows.push([x + 4 + i * 8, y + 4]); }
  tg.fillStyle = '#0c0620'; tg.fillRect(150, 92, 20, 62); tg.fillRect(146, 88, 28, 6); for (let i = 0; i < 5; i++) tg.fillRect(146 + i * 6, 83, 4, 6); tg.fillRect(158, 70, 4, 14); tg.fillStyle = '#7a1a2a'; tg.fillRect(162, 70, 10, 5);
  windows.push([156, 104], [156, 120], [164, 112], [158, 98]);
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: Math.floor(hash(i, 3) * W), y: Math.floor(hash(i, 4) * 90), p: hash(i, 5) * 6 }));
  const flies = Array.from({ length: 16 }, (_, i) => ({ x: hash(i, 8) * W, y: 130 + hash(i, 9) * 40, p: hash(i, 10) * 6 }));
  const embers = Array.from({ length: 30 }, (_, i) => ({ x: hash(i, 11) * W, y: hash(i, 12) * H, s: 0.2 + hash(i, 13) * 0.5 }));
  const clouds = [[30, 30, 34], [150, 48, 26], [240, 24, 40]];
  let alive = true, last = 0;
  const frame = (now) => {
    if (!alive || !document.body.contains(cv)) return; requestAnimationFrame(frame); if (now - last < 70) return; last = now;
    g.drawImage(sky, 0, 0);
    for (const s of stars) if (Math.sin(now / 500 + s.p) > -0.4) { g.fillStyle = Math.sin(now / 800 + s.p) > 0.8 ? '#ffffff' : '#c8c0ff'; g.fillRect(s.x, s.y, 1, 1); }
    g.fillStyle = '#fff4d0'; for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 72) g.fillRect(250 + x, 40 + y, 1, 1); g.fillStyle = '#e0d0a8'; for (const [x, y] of [[-3, -2], [2, 1], [-1, 4], [4, -4]]) g.fillRect(250 + x, 40 + y, 2, 2);
    for (const [cx, cy, cw] of clouds) { const x = ((cx + now / 1200 * (cw / 30)) % (W + 80)) - 40; g.fillStyle = 'rgba(90,50,110,.55)'; for (let i = 0; i < cw; i += 4) g.fillRect(Math.round(x + i), cy + Math.round(Math.sin(i / 5) * 2), 5, 3); g.fillStyle = 'rgba(160,100,150,.35)'; g.fillRect(Math.round(x + 3), cy - 1, cw - 8, 1); }
    g.drawImage(far, 0, 0); g.drawImage(town, 0, 0);
    for (const [x, y] of windows) { const on = Math.sin(now / 1400 + x * 1.7 + y) > -0.8; if (on) { g.fillStyle = '#ffd36a'; g.fillRect(x, y, 3, 4); g.fillStyle = '#ff9a2e'; g.fillRect(x, y + 3, 3, 1); } }
    // lanterns along the road
    for (let i = 0; i < 6; i++) { const x = 24 + i * 52, y = 150; g.fillStyle = '#0c0620'; g.fillRect(x, y, 1, 10); g.fillStyle = Math.sin(now / 160 + i) > -0.6 ? '#ffe36b' : '#ffb84a'; g.fillRect(x - 1, y - 2, 3, 3); g.fillStyle = 'rgba(255,200,90,.14)'; g.fillRect(x - 5, y - 6, 11, 11); }
    // foreground: dark pines
    g.fillStyle = '#080416'; for (let x = 0; x < W; x += 3) { const hgt = 8 + Math.floor(hash(x, 2) * 12); if (x % 12 < 3 || x > 200 && x % 9 < 3) for (let j = 0; j < hgt; j++) g.fillRect(x - Math.floor(j / 4), H - hgt - 4 + j, 1 + Math.floor(j / 2), 1); }
    g.fillRect(0, H - 6, W, 6);
    for (const f of flies) { const x = f.x + Math.sin(now / 900 + f.p) * 8, y = f.y + Math.cos(now / 1100 + f.p) * 5; if (Math.sin(now / 300 + f.p * 3) > -0.2) { g.fillStyle = '#d8ff7a'; g.fillRect(Math.round(x), Math.round(y), 1, 1); g.fillStyle = 'rgba(216,255,122,.3)'; g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); } }
    for (const e of embers) { e.y -= e.s * 0.6; if (e.y < 0) { e.y = H; e.x = Math.random() * W; } g.fillStyle = e.s > 0.45 ? '#ffd36a' : '#ff8a3a'; g.fillRect(Math.round(e.x + Math.sin(now / 700 + e.s * 9) * 2), Math.round(e.y), 1, 1); }
  };
  requestAnimationFrame(frame);
  return () => { alive = false; cv.remove(); };
}
