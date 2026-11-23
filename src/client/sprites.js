// All world art, drawn as pixel sprites. 1 art pixel = 2 world px; a tile is 16×16 art px.
// Nothing here uses smooth shapes, gradients, glow or emoji — only pixels, on one shared grid.
import { shrink, sprite, flashed, flipped, hash, shade, tint } from './px.js';
import { T } from '../world.js';
import { CLASSES } from '../data.js';
import { EXP_TIERS } from '../expansion.js';

const cache = new Map();
const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };

// ── palettes: [base, alt, dark, light, extra] ───────────────────────────────
export const PAL = {
  main: { grass: ['#3d7a3a', '#47873f', '#2f6a30', '#5fa352'], path: ['#a8845a', '#977450', '#7c5e3e', '#c29c6c'], sand: ['#c9b078', '#bba26a', '#a38c58', '#e0c98e'], water: ['#2f6fb0', '#3b82c8', '#255d98', '#a6d8f4'], cobble: ['#8d8984', '#7c7873', '#55514c', '#aaa69f'], floor: ['#8f633a', '#80562f', '#4d301a', '#a67546'], stone: ['#6c6e77', '#60626b', '#383a42', '#80828b'], rug: ['#8c2f40', '#772735', '#5a1a28', '#e0b24a'], wall: ['#7e7068', '#6c5e56', '#3e342e', '#96887e'], leaf: ['#2d6b34', '#3a8040', '#1f4f28', '#55a252'], trunk: ['#6a4528', '#52341c'], rock: ['#85817e', '#6d6966', '#4a4745', '#a8a4a0'], hollow: ['#3d7a3a', '#47873f', '#2f6a30', '#5fa352'], void: ['#2a4a2e', '#223c26', '#16281a', '#3e6a44'], chasm: ['#101010', '#181818', '#080808', '#242424'] },
  hollow: { grass: ['#2c2448', '#352b58', '#221b3a', '#4a3d78'], path: ['#52436f', '#47395f', '#352a48', '#6c5a90'], sand: ['#3b3058', '#31284a', '#261e38', '#4c4072'], water: ['#1d2a68', '#27378a', '#141d4c', '#7a8cf0'], cobble: ['#4b4568', '#3f3a5a', '#2a2640', '#625b88'], floor: ['#463c66', '#3b3258', '#2a2340', '#5a4e82'], stone: ['#3d375a', '#342f4c', '#25213a', '#504a74'], rug: ['#5a2a7a', '#4a2266', '#341648', '#d8a0ff'], wall: ['#4b4070', '#3e345e', '#261f40', '#645890'], leaf: ['#4a3a80', '#5d4a9a', '#33285c', '#8a72d0'], trunk: ['#3a3048', '#2a2236'], rock: ['#554c78', '#463f66', '#2e2948', '#6e6496'], hollow: ['#2f2650', '#382d60', '#221b3c', '#4a3c78'], void: ['#1b1330', '#150f26', '#0e0a1c', '#2c1f48'], chasm: ['#07050f', '#0c0818', '#030208', '#17102a'] },
};

// Biome palettes for the wider world: derived from 'main', recoloured.
const mkPal = (o) => ({ ...PAL.main, ...o });
PAL.desert = mkPal({ grass: ['#d4b672', '#caac66', '#b4944e', '#ead08c'], path: ['#b08a58', '#a07c4e', '#80623a', '#cfa874'], sand: ['#e0c88a', '#d4bc7c', '#b8a066', '#f0dca0'], water: ['#2a9ab0', '#38b0c4', '#1c7a8e', '#a8ecf4'], cobble: ['#c8b890', '#b8a880', '#8c7c58', '#dccca0'], floor: ['#b8905a', '#a88050', '#6a4e2a', '#cca470'], stone: ['#b8a47c', '#a89468', '#7a6a48', '#ccb890'], wall: ['#c0a470', '#aa8e5c', '#6e5a38', '#d8c090'], leaf: ['#4a8a3a', '#5a9e46', '#2e5a26', '#7ac062'], trunk: ['#7a6a3a', '#5a4a2a'], rock: ['#b08a5a', '#9a7848', '#6e5430', '#cca470'] });
PAL.snow = mkPal({ grass: ['#e4eef8', '#d8e6f4', '#bccee0', '#ffffff'], path: ['#a8b4c4', '#9aa6b8', '#7a8698', '#c8d4e4'], sand: ['#b8d4ec', '#a8c6e2', '#86a8c8', '#d8ecfa'], water: ['#3a78b8', '#4a8ccc', '#2a5e98', '#bcdcf8'], cobble: ['#9a9ca8', '#8a8c98', '#5a5c68', '#b8bac6'], floor: ['#7a5a3a', '#6a4c30', '#3e2a18', '#92704a'], stone: ['#7c8294', '#6c7284', '#3e4454', '#98a0b4'], wall: ['#8a92a6', '#767e92', '#444a5c', '#a8b0c6'], leaf: ['#2a5a3a', '#366e46', '#1a3e28', '#e8f4ff'], trunk: ['#5a4030', '#443022'], rock: ['#8a92a0', '#767e8c', '#505864', '#aab4c4'] });
PAL.swamp = mkPal({ grass: ['#3f5a2f', '#486634', '#2f4624', '#5f7f42'], path: ['#6a5a3a', '#5c4e32', '#403622', '#85734c'], sand: ['#5a4a32', '#4e4028', '#382c1c', '#6e5c3e'], water: ['#3a5a40', '#486a4c', '#2c4630', '#7aa070'], cobble: ['#6a6a58', '#5c5c4a', '#3c3c30', '#848470'], leaf: ['#4a6a30', '#5a7e3a', '#2e4620', '#8aa850'], trunk: ['#3a2e22', '#2a2018'], rock: ['#6a705c', '#5a604c', '#3a4030', '#838a74'] });
PAL.volcano = mkPal({ grass: ['#4a4440', '#433d39', '#322e2b', '#615b55'], path: ['#6a4a3a', '#5c4032', '#3e2a20', '#8a6450'], sand: ['#3a3230', '#322a28', '#221c1a', '#524846'], water: ['#d8501e', '#f07a2a', '#a83410', '#ffd070'], cobble: ['#585050', '#4a4242', '#2e2828', '#706868'], leaf: ['#2a2220', '#362c28', '#16100e', '#5a4a40'], trunk: ['#1a1412', '#100c0a'], rock: ['#38303a', '#2e2830', '#1a161c', '#524a58'], wall: ['#4a4046', '#3c343a', '#221c20', '#625860'] });
PAL.cave = mkPal({ grass: ['#4a4650', '#423e48', '#32303a', '#5e5a68'], path: ['#6a6470', '#5e5864', '#403c48', '#86808e'], sand: ['#56525c', '#4a4650', '#34323c', '#6e6a78'], water: ['#1f3f66', '#2a5084', '#162c4a', '#6a9ad0'], cobble: ['#5a5662', '#4c4854', '#322e3a', '#726e7e'], leaf: ['#2a6a6a', '#3a8a8a', '#1a4a4a', '#6ad0d0'], trunk: ['#3a3040', '#2a2230'], rock: ['#5a5666', '#4a4656', '#2c2838', '#7a7688'], wall: ['#5a5666', '#4a4656', '#2c2838', '#7a7688'] });

// ── ground tiles (16×16, no outline) ────────────────────────────────────────
function fillNoise(pen, pal, v, seed, dark = 0.16, light = 0.1) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = hash(x, y, seed * 31 + v); pen.p(x, y, r < dark ? pal[2] : r > 1 - light ? pal[3] : r < 0.55 ? pal[0] : pal[1]); }
}
const theme0 = (P) => P.grass[0] === '#3d7a3a' || P.grass[0] === '#47873f';      // only the lush 'main' grass grows flowers
export function groundTile(type, v, theme, stone = false, frame = 0) {
  return memo(`g${type}:${v}:${theme}:${stone}:${frame}`, () => sprite(16, 16, (pen) => {
    const P = PAL[theme];
    switch (type) {
      case T.GRASS: case T.TREE: fillNoise(pen, P.grass, v, 1, 0.14, 0.08); for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(hash(i, v, 7) * 13), y = 2 + Math.floor(hash(i, v, 8) * 12); pen.p(x, y, P.grass[3]); pen.p(x, y - 1, P.grass[3]); pen.p(x + 1, y - 1, P.grass[3]); } if (theme0(P) && hash(v, 31, 99) < 0.16) { const fx = 2 + Math.floor(hash(v, 32, 7) * 11), fy = 3 + Math.floor(hash(v, 33, 8) * 10), fc = ['#ffffff', '#f4d0ff', '#ffe36b', '#ff9ad5'][Math.floor(hash(v, 34, 9) * 4)]; pen.p(fx, fy, fc); pen.p(fx + 1, fy, fc); pen.p(fx, fy + 1, '#3f9a3a'); } break;
      case T.PATH: fillNoise(pen, P.path, v, 2, 0.18, 0.1); for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(hash(i, v, 5) * 12), y = 1 + Math.floor(hash(i, v, 6) * 13); pen.r(x, y, 2, 1, P.path[3]); pen.r(x, y + 1, 2, 1, P.path[2]); } break;
      case T.SAND: case T.ROCK: fillNoise(pen, P.sand, v, 3, 0.15, 0.1); for (let i = 0; i < 4; i++) pen.p(Math.floor(hash(i, v, 9) * 16), Math.floor(hash(i, v, 4) * 16), P.sand[2]); break;
      case T.HOLLOW: case T.CRYSTAL: fillNoise(pen, P.hollow, v, 4, 0.14, 0.06); for (let i = 0; i < 3; i++) pen.p(Math.floor(hash(i, v, 2) * 16), Math.floor(hash(i, v, 3) * 16), theme === 'hollow' ? '#9a7ae0' : P.hollow[3]); break;
      case T.VOID: fillNoise(pen, P.void, v, 5, 0.2, 0.04); for (let i = 0; i < 2; i++) pen.p(Math.floor(hash(i, v, 12) * 16), Math.floor(hash(i, v, 13) * 16), '#a98af0'); break;
      case T.CHASM: fillNoise(pen, P.chasm, v, 6, 0.3, 0.03); pen.r(0, 0, 16, 1, P.chasm[3]); break;
      case T.WATER: {
        pen.r(0, 0, 16, 16, P.water[0]);
        for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) { const w = Math.sin((x + y * 1.7 + frame * 4 + v * 3) * 0.55); if (w > 0.55) pen.p(x, y + 1, P.water[1]); if (w > 0.92) pen.p(x, y + 1, P.water[3]); }
        for (let i = 0; i < 6; i++) pen.p(Math.floor(hash(i, v, 21) * 16), Math.floor(hash(i, v, 22) * 16), P.water[2]); break;
      }
      case T.COBBLE: {
        pen.r(0, 0, 16, 16, P.cobble[2]);
        const rows = [[0, 5], [5, 5], [10, 6]];
        rows.forEach(([y0, h], ri) => { let x = ((ri + v) % 2) * 3 - 3; while (x < 16) { const w = 6 + Math.floor(hash(x, ri, v) * 3); for (let yy = y0 + 1; yy < y0 + h; yy++) for (let xx = Math.max(0, x + 1); xx < Math.min(16, x + w); xx++) pen.p(xx, yy, hash(xx, yy, v) < 0.2 ? P.cobble[1] : P.cobble[0]); if (x + 1 >= 0 && x + 1 < 16) pen.p(x + 1, y0 + 1, P.cobble[3]); pen.r(Math.max(0, x + 1), y0 + 1, Math.min(w - 1, 15 - Math.max(0, x + 1)), 1, P.cobble[3]); x += w; } });
        break;
      }
      case T.FLOOR: case T.DOOR: case T.SHELF: case T.WALL: {
        if (stone) { pen.r(0, 0, 16, 16, P.stone[2]); for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { pen.r(i * 8 + 1, j * 8 + 1, 7, 7, P.stone[hash(i, j, v) < 0.3 ? 1 : 0]); pen.r(i * 8 + 1, j * 8 + 1, 7, 1, P.stone[3]); } for (let i = 0; i < 4; i++) pen.p(Math.floor(hash(i, v, 31) * 16), Math.floor(hash(i, v, 32) * 16), P.stone[3]); }
        else { for (let j = 0; j < 4; j++) { const c = P.floor[hash(j, v, 3) < 0.4 ? 1 : 0]; pen.r(0, j * 4, 16, 3, c); pen.r(0, j * 4 + 3, 16, 1, P.floor[2]); pen.r(0, j * 4, 16, 1, P.floor[3]); const nx = ((j + v) % 2) * 8 + 2; pen.p(nx, j * 4 + 1, P.floor[2]); pen.p(nx + 8 > 15 ? 14 : nx + 8, j * 4 + 1, P.floor[2]); } }
        break;
      }
      case T.RUG: pen.r(0, 0, 16, 16, P.rug[0]); pen.r(1, 1, 14, 14, P.rug[3]); pen.r(2, 2, 12, 12, P.rug[1]); for (let i = 0; i < 4; i++) pen.p(7 - i + 2, 4 + i, P.rug[2]); for (let i = 0; i < 4; i++) { pen.p(8 + i, 4 + i, P.rug[2]); pen.p(7 - i + 0, 11 - i, P.rug[2]); pen.p(8 + i, 11 - i, P.rug[2]); } pen.r(7, 7, 2, 2, P.rug[3]); break;
      case T.BRIDGE: for (let i = 0; i < 4; i++) { pen.r(i * 4, 0, 3, 16, P.floor[0]); pen.r(i * 4 + 3, 0, 1, 16, P.floor[2]); pen.r(i * 4, 0, 1, 16, P.floor[3]); } break;
      default: fillNoise(pen, P.grass, v, 1);
    }
  }, { outline: null }));
}

// ── tall wall / door / shelf (16 wide × 20 tall; bottom aligned to the tile) ─
export function wallSprite(theme, capped, v = 0) {
  return memo(`w${theme}:${capped}:${v}`, () => sprite(16, 20, (pen) => {
    const P = PAL[theme].wall;
    pen.r(0, 4, 16, 16, P[0]);
    for (let j = 0; j < 4; j++) { const y = 4 + j * 4; pen.r(0, y + 3, 16, 1, P[2]); for (let i = 0; i < 2; i++) { const x = ((j + v) % 2) * 4 + i * 8; pen.r(x, y, 1, 3, P[2]); pen.r(x + 1, y, 6, 1, P[3]); if (hash(i, j, v) < 0.3) pen.r(x + 2, y + 1, 4, 2, P[1]); } }
    if (capped) { pen.r(0, 0, 16, 4, P[3]); pen.r(0, 3, 16, 1, P[1]); pen.r(0, 0, 16, 1, tint('#ffffff', P[3], 0.5)); for (let i = 0; i < 4; i++) pen.p(2 + i * 4, 1, P[0]); }
    else pen.r(0, 0, 16, 4, P[0]);
    pen.r(0, 19, 16, 1, P[2]);
  }, { outline: null }));
}
export function doorSprite(theme, open, stoneInterior = false) {   // open: 0..3
  return memo(`d${theme}:${open}:${stoneInterior}`, () => sprite(16, 20, (pen) => {
    const P = PAL[theme].wall, W = PAL[theme].floor, k = open / 3;
    pen.r(0, 4, 16, 16, P[0]); pen.r(0, 0, 16, 4, P[3]); pen.r(0, 3, 16, 1, P[1]);
    pen.r(2, 4, 12, 16, P[2]);                                                      // stone arch frame
    pen.r(3, 5, 10, 15, '#17101a');                                                  // doorway (dark interior)
    if (k > 0) pen.r(3, 17, 10, 3, W[1]);                                            // floor glimpse
    const leaf = Math.round(10 * (1 - k * 0.78));                                    // leaf swings away on its left hinge
    if (leaf > 0) { pen.r(3, 5, leaf, 15, W[0]); for (let j = 0; j < 5; j++) pen.r(3, 5 + j * 3, leaf, 1, W[2]); pen.r(3, 8, leaf, 1, '#5a5a66'); pen.r(3, 15, leaf, 1, '#5a5a66'); pen.r(3 + leaf - 1, 5, 1, 15, W[2]); if (leaf > 4) pen.r(3 + leaf - 3, 12, 1, 2, '#e0b24a'); }
    pen.r(3, 5, 1, 15, '#3a3a44');
  }, { outline: null }));
}

// ── tall natural props (outlined, anchored at bottom-centre) ────────────────
export function treeSprite(theme, v, t = 0) {
  return memo(`t${theme}:${v}:${t}`, () => sprite(22, 28, (pen) => {
    const P = PAL[theme], L = P.leaf, tr = P.trunk, sway = t ? 1 : 0;
    if (theme === 'desert') {                                    // saguaro cactus
      const h = 16 + (v % 3) * 3; pen.r(9, 28 - h, 4, h, L[0]); pen.r(9, 28 - h, 1, h, L[3]); pen.r(12, 28 - h, 1, h, L[2]); pen.r(5, 28 - h + 6, 4, 3, L[0]); pen.r(5, 28 - h + 3, 3, 4, L[0]); pen.r(13, 28 - h + 9, 4, 3, L[0]); pen.r(15, 28 - h + 5, 3, 5, L[0]);
      for (let y = 28 - h + 1; y < 27; y += 3) pen.p(10, y, L[2]); pen.p(5, 28 - h + 3, L[3]); pen.p(16, 28 - h + 5, L[3]); pen.r(8, 26, 6, 2, '#a88050'); return;
    }
    if (theme === 'snow') {                                      // snowy pine
      pen.r(10, 22, 3, 6, tr[0]); for (let i = 0; i < 4; i++) { const y = 4 + i * 5, w = 6 + i * 3; pen.r(11 - Math.floor(w / 2), y, w, 5, L[0]); pen.r(11 - Math.floor(w / 2), y, w, 1, L[3]); pen.r(12 - Math.floor(w / 2) + 1, y + 1, Math.max(1, w - 4), 1, L[3]); pen.r(11 - Math.floor(w / 2), y + 4, w, 1, L[2]); } pen.p(11, 2, L[0]); pen.p(11, 3, L[3]); pen.r(10, 25, 3, 1, '#ffffff'); return;
    }
    if (theme === 'cave') {                                      // giant glowing mushroom
      pen.r(10, 14, 3, 14, '#c8b8a8'); pen.r(10, 14, 1, 14, '#e8dcd0'); pen.ell(11, 10, 9, 6, L[2]); pen.ell(11, 9, 8, 5, L[0]); pen.ell(9, 7, 4, 2, L[1]); for (const [x, y] of [[6, 9], [11, 6], [15, 10], [9, 11]]) pen.p(x, y, L[3]); pen.r(3, 15, 16, 1, L[2]); return;
    }
    if (theme === 'hollow' || theme === 'swamp' || theme === 'volcano') {                                   // gnarled tree
      pen.r(9, 14, 4, 14, tr[0]); pen.r(11, 14, 2, 14, tr[1]); pen.line(10, 18, 4, 11, tr[0]); pen.line(11, 17, 18, 9, tr[0]); pen.line(10, 22, 3, 18, tr[1]);
      for (const [x, y, r] of [[5, 9, 4], [11, 5, 5], [17, 8, 4], [11, 11, 3]]) { pen.disc(x + sway, y, r, L[0]); pen.disc(x + sway - 1, y - 1, r - 1.5, L[1]); }
      for (let i = 0; i < 5; i++) pen.p(4 + Math.floor(hash(i, v, 1) * 14) + sway, 3 + Math.floor(hash(i, v, 2) * 10), L[3]);
      return;
    }
    pen.r(9, 17, 4, 11, tr[0]); pen.r(9, 17, 1, 11, tr[1]); pen.r(8, 26, 6, 2, tr[0]); pen.p(7, 27, tr[1]); pen.p(14, 27, tr[1]);
    const blobs = v % 3 === 0 ? [[6, 12, 6], [16, 12, 6], [11, 7, 7], [11, 14, 5]] : v % 3 === 1 ? [[11, 9, 8], [5, 14, 5], [17, 14, 5]] : [[7, 10, 6], [15, 9, 6], [11, 14, 6], [11, 5, 5]];
    for (const [x, y, r] of blobs) pen.disc(x + sway * (y < 10 ? 1 : 0), y, r, L[0]);
    for (const [x, y, r] of blobs) pen.disc(x - 1 + sway * (y < 10 ? 1 : 0), y - 1, r - 2, L[1]);
    for (const [x, y, r] of blobs) pen.disc(x - 2, y - 2, Math.max(1, r - 4.2), L[3]);
    for (let i = 0; i < 7; i++) { const x = 3 + Math.floor(hash(i, v, 3) * 16), y = 3 + Math.floor(hash(i, v, 4) * 14); pen.p(x, y, L[2]); }
  }));
}
export function rockSprite(theme, v) {
  return memo(`r${theme}:${v}`, () => sprite(18, 16, (pen) => {
    const P = PAL[theme].rock, w = 11 + (v % 3), h = 8 + (v % 2) * 2;
    pen.ell(9, 11 - h / 4, w / 2, h / 2 + 1, P[1]); pen.ell(8, 10 - h / 4, w / 2 - 1, h / 2 - 1, P[0]); pen.ell(6, 8 - h / 4, 2.5, 1.6, P[3]);
    pen.r(3, 13, 12, 1, P[2]); for (let i = 0; i < 3; i++) pen.p(4 + Math.floor(hash(i, v, 5) * 9), 8 + Math.floor(hash(i, v, 6) * 4), P[2]);
    if (v % 4 === 1) { pen.r(5, 7, 4, 1, '#4a8a3c'); pen.r(6, 6, 2, 1, '#5fa352'); }
  }));
}
export function crystalSprite(frame) {
  return memo(`c${frame}`, () => sprite(18, 24, (pen) => {
    const A = ['#5a3ab0', '#7a56d8', '#a984ff', '#e0d0ff'];
    const shard = (cx, base, h, w, c) => { for (let y = 0; y < h; y++) { const ww = Math.max(1, Math.round(w * (1 - y / h * 0.9))); pen.r(cx - Math.floor(ww / 2), base - y, ww, 1, c[1]); pen.p(cx - Math.floor(ww / 2), base - y, c[0]); pen.p(cx + Math.floor(ww / 2) - (ww % 2 ? 0 : 1), base - y, c[2]); } pen.p(cx - 1, base - Math.floor(h * 0.6), c[3]); };
    shard(5, 22, 14, 6, A); shard(12, 22, 18, 7, A); shard(9, 22, 11, 5, [A[1], A[2], A[3], A[3]]);
    if (frame) { pen.p(12, 8, '#ffffff'); pen.p(5, 12, '#ffffff'); pen.p(9, 14, '#ffffff'); }
    pen.r(2, 22, 14, 1, '#2a1f48');
  }));
}
export function shelfSprite(v) {
  return memo(`s${v}`, () => sprite(16, 22, (pen) => {
    pen.r(0, 2, 16, 20, '#4d301a'); pen.r(1, 3, 14, 18, '#2a1a0e');
    for (let r = 0; r < 3; r++) { const y = 4 + r * 6; let x = 1; while (x < 15) { const w = 1 + Math.floor(hash(x, r, v) * 2), h = 4 + Math.floor(hash(r, x, v + 3) * 2); const c = ['#8c2f40', '#2e5a8c', '#6a8a2e', '#7a4ab0', '#b0782e', '#3a8a7a'][Math.floor(hash(x, r, v + 7) * 6)]; pen.r(x, y + 5 - h, w, h, c); pen.p(x, y + 5 - h, tint(c, '#ffffff', 0.35)); x += w; } pen.r(1, y + 5, 14, 1, '#6a4528'); }
    pen.r(0, 0, 16, 3, '#6a4528'); pen.r(0, 0, 16, 1, '#8f633a');
  }));
}

// ── furniture & stations ─────────────────────────────────────────────────────
const wood = ['#8f633a', '#a67546', '#6a4528', '#4d301a'];
const iron = ['#9aa3ad', '#c8d0d8', '#6f7882', '#4a525c'];
export const PROPS = {
  waystone: (f = 0) => sprite(16, 30, (p) => { p.r(3, 24, 10, 6, '#55515a'); p.r(3, 24, 10, 1, '#7a7682'); p.r(4, 6, 8, 19, '#6c6e77'); p.r(4, 6, 8, 1, '#98a0aa'); p.r(4, 6, 1, 19, '#8a8c96'); p.r(11, 6, 1, 19, '#44454d'); p.r(5, 3, 6, 4, '#6c6e77'); p.r(6, 1, 4, 3, '#6c6e77');
    const g = f ? '#9ad8ff' : '#5aa0e0'; p.r(7, 10, 2, 5, g); p.r(6, 12, 4, 1, g); p.r(7, 17, 2, 2, g); p.p(6, 20, g); p.p(9, 20, g); p.p(7, 4, g); p.p(8, 4, g); if (f) { p.p(2, 12, '#e0f4ff'); p.p(13, 18, '#e0f4ff'); } }),
  tent: () => sprite(26, 20, (p) => { for (let y = 0; y < 14; y++) { const w = 3 + y, x0 = 13 - Math.floor(w / 2); p.r(x0, 4 + y, w, 1, y < 2 ? '#e8dcc0' : y % 4 < 2 ? '#a8423a' : '#c8584a'); } p.r(11, 12, 4, 6, '#2a1a20'); p.r(12, 14, 2, 4, '#17101a'); p.r(2, 18, 22, 2, '#6a4528'); p.p(13, 3, '#6a4528'); p.r(13, 0, 1, 4, '#6a4528'); p.r(14, 0, 3, 2, '#e0b24a'); }),
  haystack: () => sprite(18, 16, (p) => { p.ell(9, 9, 8, 6, '#c8a84a'); p.ell(8, 7, 6, 3.5, '#e0c868'); for (let i = 0; i < 7; i++) p.line(2 + i * 2, 13, 3 + i * 2, 8 + (i % 3), '#a8883a'); p.r(2, 14, 14, 1, '#7a6228'); }),
  boat: () => sprite(26, 14, (p) => { p.ell(13, 8, 12, 5, '#6a4528'); p.ell(13, 6, 11, 3.5, '#8f633a'); p.r(3, 5, 20, 1, '#a67546'); p.r(13, 0, 1, 7, '#4d301a'); p.r(14, 1, 7, 5, '#e8e0c8'); p.r(14, 1, 7, 1, '#fff6e0'); for (let i = 0; i < 4; i++) p.r(4 + i * 5, 7, 1, 3, '#4d301a'); }),
  coffin: () => sprite(12, 22, (p) => { p.r(2, 2, 8, 20, '#8f633a'); p.r(1, 6, 10, 12, '#a67546'); p.r(2, 2, 8, 1, '#c08a5a'); p.r(5, 6, 2, 8, '#e0b24a'); p.r(3, 9, 6, 2, '#e0b24a'); p.r(2, 20, 8, 2, '#4d301a'); }),
  banner: () => sprite(12, 26, (p) => { p.r(0, 0, 12, 2, '#6a4528'); p.r(1, 2, 10, 18, '#6a2a8a'); p.r(1, 2, 10, 1, '#9a4ac0'); p.r(2, 18, 3, 4, '#6a2a8a'); p.r(7, 18, 3, 4, '#6a2a8a'); p.r(5, 6, 2, 8, '#e0b24a'); p.r(3, 9, 6, 2, '#e0b24a'); }),
  bookshelf: () => shelfSprite(1),
  anvil: () => sprite(16, 16, (p) => { p.r(4, 12, 8, 4, wood[2]); p.r(4, 12, 8, 1, wood[0]); p.r(2, 5, 12, 3, iron[0]); p.r(2, 5, 12, 1, iron[1]); p.r(0, 6, 3, 2, iron[0]); p.r(0, 6, 2, 1, iron[1]); p.r(5, 8, 6, 4, iron[2]); p.r(4, 11, 8, 1, iron[3]); p.p(11, 6, iron[1]); p.p(12, 5, iron[1]); }),
  furnace: (f = 0) => sprite(16, 22, (p) => {
    p.r(9, 0, 4, 6, '#6c5e56'); p.r(9, 0, 4, 1, '#96887e'); p.r(1, 5, 14, 17, '#7e7068'); p.r(1, 5, 14, 2, '#96887e');
    for (let j = 0; j < 4; j++) { p.r(1, 8 + j * 4, 14, 1, '#3e342e'); p.r(((j % 2) * 4) + 3, 9 + j * 4, 1, 3, '#3e342e'); p.r(((j % 2) * 4) + 10, 9 + j * 4, 1, 3, '#3e342e'); }
    p.r(3, 11, 10, 11, '#1a1010'); p.r(3, 11, 10, 1, '#4a3a30');
    const fl = [[[5, 4], [7, 6], [9, 4], [11, 5]], [[5, 5], [7, 4], [9, 6], [11, 4]], [[5, 4], [7, 5], [9, 5], [11, 6]]][f % 3];
    for (const [x, h] of fl) { p.r(x, 21 - h, 2, h, '#e0561e'); p.r(x, 21 - h + 1, 2, h - 2, '#ff9a2e'); p.p(x, 20 - h + 2, '#ffe36b'); }
    p.r(3, 20, 10, 2, '#ffcf4a');
  }),
  cauldron: (f = 0) => sprite(16, 18, (p) => {
    p.r(2, 15, 2, 3, '#3a2a20'); p.r(12, 15, 2, 3, '#3a2a20'); p.r(5, 16, 6, 2, '#e0561e'); p.p(7, 15, '#ffcf4a');
    p.ell(8, 10, 7, 5.5, '#2a2a34'); p.ell(8, 9, 6, 4.5, '#3c3c4a'); p.r(2, 5, 12, 2, '#555566'); p.r(2, 5, 12, 1, '#7a7a8a');
    p.ell(8, 5.5, 5, 1.6, '#5fd06a'); p.ell(7, 5, 3, 1, '#9af58a');
    const b = [[6, 3], [9, 2], [11, 3]]; b.forEach(([x, y], i) => { const yy = y - ((f + i) % 3); p.p(x, yy, '#c8ffc0'); if ((f + i) % 3 === 2) p.p(x, yy - 1, '#ffffff'); });
  }),
  board: () => sprite(16, 22, (p) => { p.r(1, 8, 2, 14, wood[2]); p.r(13, 8, 2, 14, wood[2]); p.r(0, 1, 16, 3, wood[2]); p.r(0, 1, 16, 1, wood[1]); p.r(1, 4, 14, 11, wood[0]); p.r(1, 4, 14, 1, wood[1]); p.r(1, 14, 14, 1, wood[3]);
    p.r(2, 5, 4, 5, '#e8e0c8'); p.r(7, 6, 3, 4, '#d8d0b0'); p.r(11, 5, 3, 6, '#e8e0c8'); p.r(3, 11, 4, 3, '#d8d0b0'); p.r(9, 11, 5, 3, '#e8e0c8'); p.p(3, 6, '#555'); p.p(4, 7, '#555'); p.p(12, 6, '#555'); p.r(5, 9, 1, 1, '#c33'); p.ell(8, 8, 1.5, 1.5, '#e0b24a'); }),
  counter: (v = 0) => sprite(16, 16, (p) => { p.r(0, 5, 16, 3, wood[1]); p.r(0, 5, 16, 1, '#c08a52'); p.r(0, 8, 16, 8, wood[0]); for (let i = 0; i < 4; i++) p.r(i * 4, 8, 1, 8, wood[2]); p.r(0, 15, 16, 1, wood[3]); if (v) { p.r(3, 3, 3, 2, '#e0b24a'); p.r(4, 2, 2, 1, '#ffe36b'); } }),
  barrel: () => sprite(14, 16, (p) => { p.ell(7, 8, 6.5, 7.5, wood[0]); p.ell(6, 7, 4, 5.5, wood[1]); p.r(0, 3, 14, 1, '#5a5a66'); p.r(0, 11, 14, 1, '#5a5a66'); p.r(2, 0, 10, 2, wood[2]); p.r(3, 14, 8, 2, wood[3]); }),
  crates: () => sprite(16, 18, (p) => { p.r(1, 8, 14, 10, wood[0]); p.r(1, 8, 14, 1, wood[1]); p.r(1, 8, 1, 10, wood[2]); p.r(14, 8, 1, 10, wood[2]); p.line(2, 9, 13, 17, wood[2]); p.line(13, 9, 2, 17, wood[2]); p.r(3, 0, 10, 8, wood[1]); p.r(3, 0, 10, 1, '#c08a52'); p.r(3, 7, 10, 1, wood[2]); p.line(4, 1, 11, 6, wood[0]); }),
  table: () => sprite(16, 16, (p) => { p.r(0, 4, 16, 4, wood[1]); p.r(0, 4, 16, 1, '#c08a52'); p.r(0, 7, 16, 1, wood[2]); p.r(1, 8, 2, 8, wood[2]); p.r(13, 8, 2, 8, wood[2]); p.r(10, 1, 3, 3, '#c8c8d0'); p.p(13, 2, '#c8c8d0'); p.r(3, 3, 4, 1, '#e8e0c8'); }),
  bench: () => sprite(16, 14, (p) => { p.r(0, 4, 16, 3, wood[1]); p.r(0, 4, 16, 1, '#c08a52'); p.r(1, 7, 2, 7, wood[2]); p.r(13, 7, 2, 7, wood[2]); p.r(0, 0, 16, 3, wood[0]); p.r(0, 0, 16, 1, wood[1]); }),
  stool: () => sprite(8, 10, (p) => { p.r(0, 2, 8, 3, wood[1]); p.r(0, 2, 8, 1, '#c08a52'); p.r(1, 5, 1, 5, wood[2]); p.r(6, 5, 1, 5, wood[2]); }),
  plant: () => sprite(14, 20, (p) => { p.r(3, 13, 8, 7, '#8a4a30'); p.r(3, 13, 8, 1, '#b0643e'); p.r(4, 19, 6, 1, '#5a2e1e'); for (const [x, y] of [[7, 4], [4, 7], [10, 7], [7, 9], [3, 11], [11, 11]]) { p.ell(x, y, 3, 2, '#2d6b34'); p.p(x - 1, y - 1, '#55a252'); } p.line(7, 13, 7, 5, '#1f4f28'); }),
  lamp: (f = 0) => sprite(10, 28, (p) => { p.r(4, 8, 2, 20, '#3a3a44'); p.r(2, 26, 6, 2, '#2a2a34'); p.r(1, 2, 8, 7, '#2a2a34'); p.r(2, 3, 6, 5, f ? '#ffe36b' : '#ffcf4a'); p.r(3, 4, 4, 3, '#fff6c0'); p.r(0, 1, 10, 2, '#3a3a44'); p.p(4, 0, '#3a3a44'); p.p(5, 0, '#3a3a44'); }),
  fireplace: (f = 0) => sprite(16, 22, (p) => { p.r(0, 2, 16, 20, '#7e7068'); p.r(0, 2, 16, 2, '#96887e'); for (let j = 0; j < 4; j++) p.r(0, 6 + j * 4, 16, 1, '#3e342e'); p.r(3, 8, 10, 14, '#1a1010'); p.r(2, 7, 12, 1, '#4a3a30'); [[5, 5], [8, 7], [11, 5]].forEach(([x, h], i) => { const hh = h + ((f + i) % 2); p.r(x - 1, 21 - hh, 3, hh, '#e0561e'); p.r(x, 21 - hh + 1, 1, hh - 1, '#ffcf4a'); }); p.r(3, 21, 10, 1, '#ff9a2e'); }),
  rack: () => sprite(16, 20, (p) => { p.r(0, 2, 16, 18, wood[2]); p.r(0, 2, 16, 1, wood[1]); p.r(0, 10, 16, 2, wood[0]); for (const [x, c] of [[2, iron[0]], [6, iron[1]], [10, iron[0]], [13, iron[2]]]) { p.r(x, 4, 2, 11, c); p.r(x - 1, 12, 4, 1, wood[0]); p.r(x, 15, 2, 3, '#5a3a20'); p.p(x, 4, '#ffffff'); } }),
  grindstone: () => sprite(16, 16, (p) => { p.r(1, 8, 2, 8, wood[2]); p.r(13, 8, 2, 8, wood[2]); p.ell(8, 8, 6, 6, '#8d8984'); p.ell(8, 8, 4, 4, '#aaa69f'); p.ell(8, 8, 1.5, 1.5, '#4a4745'); p.line(8, 8, 12, 5, '#6a4528'); p.p(5, 5, '#d8d4cc'); }),
  coalbin: () => sprite(16, 14, (p) => { p.r(0, 6, 16, 8, wood[2]); p.r(0, 6, 16, 1, wood[1]); for (let i = 0; i < 9; i++) { const x = 1 + (i * 5) % 13, y = 2 + (i * 3) % 4; p.r(x, y, 3, 3, '#1c1c22'); p.p(x, y, '#44444e'); } }),
  potions: () => sprite(16, 22, (p) => { p.r(0, 2, 16, 20, '#4d301a'); p.r(1, 3, 14, 18, '#2a1a0e'); for (let r = 0; r < 3; r++) { const y = 4 + r * 6; p.r(1, y + 5, 14, 1, '#6a4528'); [['#e0344a', 2], ['#3a8ae0', 5], ['#5fd06a', 8], ['#c070f0', 11]].forEach(([c, x], i) => { const h = 3 + ((i + r) % 2); p.r(x, y + 5 - h, 2, h, c); p.p(x, y + 5 - h, '#ffffff'); p.p(x, y + 5 - h - 1, '#8a6a4a'); }); } p.r(0, 0, 16, 3, '#6a4528'); p.r(0, 0, 16, 1, '#8f633a'); }),
  herbs: () => sprite(16, 12, (p) => { for (const x of [3, 8, 12]) { p.line(x, 0, x, 3, '#6a4528'); p.r(x - 1, 3, 3, 6, '#3a8a40'); p.p(x, 9, '#55a252'); p.p(x - 1, 5, '#8fd06a'); p.p(x + 1, 7, '#8fd06a'); } }),
  scale: () => sprite(12, 12, (p) => { p.r(5, 3, 2, 8, '#b0782e'); p.r(2, 10, 8, 2, '#8a5a1e'); p.r(0, 3, 12, 1, '#e0b24a'); p.r(0, 4, 4, 1, '#e0b24a'); p.r(8, 4, 4, 1, '#e0b24a'); p.r(0, 5, 4, 1, '#c89a3a'); p.r(8, 5, 4, 1, '#c89a3a'); p.p(5, 2, '#ffe36b'); }),
  window: (f = 0) => sprite(10, 10, (p) => { p.r(0, 0, 10, 10, '#3a2a20'); p.r(1, 1, 8, 8, f ? '#ffe36b' : '#ffcf4a'); p.r(1, 1, 8, 2, '#fff2a0'); p.r(4, 1, 2, 8, '#3a2a20'); p.r(1, 4, 8, 2, '#3a2a20'); p.r(0, 9, 10, 1, '#6a4528'); }, { outline: null }),
  stall: () => sprite(32, 26, (p) => { p.r(1, 10, 2, 16, wood[2]); p.r(29, 10, 2, 16, wood[2]); for (let i = 0; i < 8; i++) { const c = i % 2 ? '#e8e0d0' : '#c0392b'; p.r(i * 4, 0, 4, 9, c); p.r(i * 4, 8, 4, 2, shade(c, 0.8)); } p.r(0, 0, 32, 1, '#ffffff'); p.r(0, 14, 32, 12, wood[0]); p.r(0, 14, 32, 2, '#c08a52'); for (let i = 0; i < 8; i++) p.r(i * 4, 16, 1, 10, wood[2]);
    [['#c0392b', 4], ['#e0b24a', 10], ['#5fd06a', 17], ['#3a8ae0', 24]].forEach(([c, x]) => { p.r(x, 10, 4, 4, c); p.r(x, 10, 4, 1, tint(c, '#ffffff', 0.4)); }); }),
  well: () => sprite(16, 22, (p) => { p.r(0, 12, 16, 10, '#8d8984'); p.r(0, 12, 16, 2, '#aaa69f'); for (let i = 0; i < 4; i++) p.r(i * 4, 15 + (i % 2) * 3, 3, 2, '#7c7873'); p.ell(8, 12, 6, 2, '#255d98'); p.r(1, 2, 2, 12, wood[2]); p.r(13, 2, 2, 12, wood[2]); p.r(0, 0, 16, 3, '#8a4a30'); p.r(0, 0, 16, 1, '#b0643e'); p.r(2, 3, 12, 1, '#4a2a1a'); p.line(8, 3, 8, 9, '#c8c8c8'); p.r(7, 9, 3, 2, wood[1]); }),
  fountain: (f = 0) => sprite(32, 32, (p) => { p.ell(16, 22, 15, 9, '#8d8984'); p.ell(16, 21, 13, 7.5, '#aaa69f'); p.ell(16, 21, 11.5, 6.2, '#2f6fb0'); for (let i = 0; i < 9; i++) { const x = 8 + ((i * 5 + f * 3) % 17), y = 18 + ((i * 3 + f) % 7); p.p(x, y, '#a6d8f4'); }
    p.r(14, 10, 4, 12, '#8d8984'); p.r(14, 10, 1, 12, '#aaa69f'); p.ell(16, 9, 5, 2, '#aaa69f'); for (let i = 0; i < 4; i++) { p.p(16 + (f ? 1 : -1) * (i % 2), 3 + i * 1.5, '#a6d8f4'); } p.r(15, 2, 2, 3, '#cfeeff'); [[10, 14, 1], [22, 14, 1], [9, 17, 1], [23, 17, 1]].forEach(([x, y]) => { p.p(x + (f ? 0 : 1), y + (f ? 1 : 0), '#a6d8f4'); }); }),
  flowers: () => sprite(16, 8, (p) => { for (const [x, y, c] of [[2, 5, '#e0344a'], [6, 3, '#f0d04a'], [10, 5, '#e070d0'], [13, 3, '#ffffff']]) { p.p(x, y + 2, '#3a8a40'); p.p(x, y + 1, '#3a8a40'); p.r(x - 1, y, 3, 1, c); p.p(x, y - 1, c); p.p(x, y, '#ffe36b'); } }, { outline: null }),
  cart: () => sprite(18, 16, (p) => { p.r(1, 4, 16, 8, wood[0]); p.r(1, 4, 16, 1, wood[1]); p.r(1, 11, 16, 1, wood[2]); for (let i = 0; i < 4; i++) p.r(2 + i * 4, 4, 1, 8, wood[2]); p.ell(4, 13, 3, 3, '#3a3a44'); p.ell(14, 13, 3, 3, '#3a3a44'); p.ell(4, 13, 1.2, 1.2, '#8a8a9a'); p.ell(14, 13, 1.2, 1.2, '#8a8a9a'); for (const [x, y] of [[4, 2], [8, 1], [12, 2]]) p.r(x, y, 3, 3, '#6d6966'); p.p(8, 1, '#c29c6c'); }),
  bones: () => sprite(14, 8, (p) => { p.r(1, 5, 9, 1, '#e0d8c0'); p.p(1, 4, '#e0d8c0'); p.p(1, 6, '#e0d8c0'); p.p(10, 4, '#e0d8c0'); p.p(10, 6, '#e0d8c0'); p.ell(11, 3, 2.5, 2, '#e8e0c8'); p.p(10, 3, '#222'); p.p(12, 3, '#222'); p.line(3, 1, 7, 3, '#e0d8c0'); }, { outline: null }),
  stump: () => sprite(14, 14, (p) => { p.ell(7, 9, 6, 4, '#6a4528'); p.ell(7, 6, 6, 3.5, '#a67546'); p.ell(7, 6, 4, 2, '#8f633a'); p.ell(7, 6, 1.5, 0.8, '#6a4528'); p.r(2, 10, 3, 3, '#52341c'); p.r(10, 10, 3, 3, '#52341c'); }),
  mushrooms: () => sprite(14, 10, (p) => { for (const [x, y, c] of [[3, 6, '#d04a3a'], [8, 4, '#e0a050'], [11, 7, '#d04a3a']]) { p.r(x, y, 1, 3, '#e8e0c8'); p.ell(x, y, 2.5, 1.5, c); p.p(x - 1, y - 1, '#ffffff'); } }, { outline: null }),
  grave: () => sprite(14, 18, (p) => { p.r(2, 2, 10, 15, '#8d8984'); p.r(3, 1, 8, 1, '#8d8984'); p.r(4, 0, 6, 1, '#8d8984'); p.r(2, 2, 10, 1, '#aaa69f'); p.r(6, 4, 2, 7, '#55514c'); p.r(4, 6, 6, 2, '#55514c'); p.r(0, 16, 14, 2, '#3a6a30'); p.p(3, 15, '#5fa352'); }),
  pillar: () => sprite(14, 28, (p) => { p.r(1, 22, 12, 6, '#6c6e77'); p.r(3, 4, 8, 19, '#80828b'); p.r(3, 4, 2, 19, '#9a9ca4'); p.r(9, 4, 2, 19, '#5d5f68'); p.r(0, 0, 14, 4, '#6c6e77'); p.r(0, 0, 14, 1, '#9a9ca4'); for (let i = 0; i < 3; i++) p.p(6, 8 + i * 5, '#383a42'); }),
  obelisk: (f = 0) => sprite(12, 30, (p) => { p.r(2, 24, 8, 6, '#463c66'); for (let y = 0; y < 24; y++) { const w = 8 - Math.floor(y / 8); p.r(6 - Math.floor(w / 2), 24 - y, w, 1, y % 2 ? '#554c78' : '#5d5384'); p.p(6 - Math.floor(w / 2), 24 - y, '#7a6aa8'); } p.r(5, 0, 2, 3, '#a984ff'); p.r(4, 1, 4, 1, '#e0d0ff'); for (let i = 0; i < 3; i++) p.p(5 + (i % 2), 8 + i * 5, f ? '#e0d0ff' : '#a984ff'); }),
  chest: (open = 0) => sprite(16, 14, (p) => { p.r(0, 6, 16, 8, wood[0]); p.r(0, 6, 16, 1, wood[1]); p.r(0, 13, 16, 1, wood[3]); p.r(0, 6, 2, 8, '#5a5a66'); p.r(14, 6, 2, 8, '#5a5a66'); p.r(0, 9, 16, 1, '#5a5a66');
    if (!open) { p.r(1, 1, 14, 5, wood[1]); p.r(1, 1, 14, 1, '#c08a52'); p.r(0, 3, 2, 3, '#5a5a66'); p.r(14, 3, 2, 3, '#5a5a66'); p.r(7, 5, 2, 3, '#e0b24a'); p.p(8, 6, '#6a4a1e'); }
    else { p.r(1, 0, 14, 2, wood[2]); p.r(2, 6, 12, 1, '#1a1010'); for (const [x, y, c] of [[3, 5, '#ffe36b'], [6, 4, '#e0b24a'], [9, 5, '#ffe36b'], [11, 4, '#e0b24a'], [8, 3, '#c0392b']]) p.r(x, y, 2, 2, c); p.p(4, 3, '#ffffff'); p.p(10, 2, '#ffffff'); } }),
  campfire: (f = 0) => sprite(16, 18, (p) => { for (let i = 0; i < 6; i++) p.p(2 + i * 2, 15 + (i % 2), '#6d6966'); p.r(2, 14, 12, 2, '#6d6966'); p.line(3, 14, 12, 12, wood[2]); p.line(12, 14, 4, 12, wood[0]); [[5, 6], [8, 9], [11, 6]].forEach(([x, h], i) => { const hh = h + ((f + i) % 3); p.r(x - 1, 13 - hh, 3, hh, '#e0561e'); p.r(x, 13 - hh + 1, 1, hh - 1, '#ffcf4a'); p.p(x, 12 - hh, '#ffe36b'); }); }),
  gate: (open = 0) => sprite(32, 34, (p) => { p.r(0, 4, 5, 30, '#5d5f68'); p.r(27, 4, 5, 30, '#5d5f68'); p.r(0, 4, 5, 2, '#80828b'); p.r(27, 4, 5, 2, '#80828b'); p.r(0, 0, 32, 6, '#6c6e77'); p.r(0, 0, 32, 1, '#9a9ca4'); for (let i = 0; i < 4; i++) p.p(4 + i * 8, 2, '#383a42');
    p.r(5, 6, 22, 28, open ? '#0e0a1c' : '#1a1624'); if (open) { for (let i = 0; i < 12; i++) p.p(7 + (i * 7) % 18, 9 + (i * 5) % 22, '#a984ff'); p.r(6, 31, 20, 3, '#2a2340'); }
    else { for (let i = 0; i < 6; i++) { p.r(7 + i * 3 + (i > 2 ? 1 : 0), 6, 1, 28, '#6f7882'); p.p(7 + i * 3 + (i > 2 ? 1 : 0), 6, '#c8d0d8'); } p.r(5, 14, 22, 1, '#6f7882'); p.r(5, 26, 22, 1, '#6f7882'); p.r(13, 18, 6, 6, '#e0b24a'); p.r(14, 19, 4, 4, '#a07a1e'); p.r(15, 20, 2, 3, '#1a1010'); } }),
  lectern: () => sprite(16, 24, (p) => { p.r(3, 14, 10, 10, '#6c6e77'); p.r(3, 14, 10, 1, '#9a9ca4'); p.line(6, 15, 9, 20, '#383a42'); p.line(9, 20, 7, 23, '#383a42'); p.r(1, 6, 14, 8, '#80828b'); p.r(1, 6, 14, 1, '#aab0b8'); p.r(2, 4, 12, 3, '#e8e0c8'); p.r(2, 4, 6, 1, '#fff'); p.r(8, 3, 6, 2, '#d8d0b0'); p.p(8, 2, '#a984ff'); p.p(5, 5, '#8c2f40'); }),
  coldforge: () => sprite(16, 22, (p) => { p.r(1, 5, 14, 17, '#6a7a9a'); p.r(1, 5, 14, 2, '#9ab0d8'); for (let j = 0; j < 4; j++) p.r(1, 8 + j * 4, 14, 1, '#3a4660'); p.r(3, 11, 10, 11, '#0c1226'); for (const [x, h] of [[5, 5], [7, 7], [9, 4], [11, 6]]) { p.r(x, 21 - h, 2, h, '#4a8ae0'); p.r(x, 21 - h + 1, 1, h - 2, '#a0e0ff'); } p.r(9, 0, 4, 6, '#4a5a7a'); p.p(10, 0, '#e0f4ff'); p.p(0, 4, '#a0e0ff'); p.p(15, 6, '#a0e0ff'); }),
  starfall: (f = 0) => sprite(16, 16, (p) => { p.r(2, 14, 12, 2, '#3a4a6a'); p.r(7, 2, 2, 12, '#e0d0ff'); p.r(6, 5, 4, 6, '#a0b8ff'); p.r(4, 8, 8, 2, '#c8d4ff'); p.r(5, 7, 6, 4, '#7a90f0'); p.p(7, 3, '#ffffff'); p.p(8, 8, '#ffffff'); if (f) { p.p(2, 4, '#ffffff'); p.p(13, 7, '#ffffff'); p.p(8, 0, '#ffffff'); } }),
  sign: () => sprite(16, 24, (p) => { p.r(7, 6, 2, 18, wood[2]); p.r(1, 2, 14, 8, wood[0]); p.r(1, 2, 14, 1, wood[1]); p.r(1, 9, 14, 1, wood[3]); p.r(3, 4, 8, 1, '#e8e0c8'); p.r(3, 6, 6, 1, '#e8e0c8'); p.r(11, 4, 3, 4, '#e0b24a'); }),
  customer: () => null,
};
export const prop = (name, a = 0) => memo(`p:${name}:${a}`, () => PROPS[name](a));

// ── resource nodes (walk-over pickups): [normal, depleted] ──────────────────
const NODE = {
  moonsilver: (d) => sprite(16, 16, (p) => { p.ell(8, 10, 7, 5, d ? '#4a5a6a' : '#7a90a8'); p.ell(7, 9, 5, 3.5, d ? '#3a4a5a' : '#b8d0e8'); if (!d) for (const [x, y] of [[4, 8], [9, 6], [11, 10], [6, 11]]) { p.r(x, y, 2, 2, '#e8f6ff'); p.p(x, y, '#ffffff'); } }),
  cinder: (d) => sprite(16, 16, (p) => { p.ell(8, 10, 7, 5, d ? '#3a2a22' : '#5a3a2a'); p.ell(7, 9, 5, 3.5, d ? '#2a1c18' : '#8a4a30'); if (!d) for (const [x, y] of [[4, 8], [9, 6], [11, 10], [6, 11]]) { p.r(x, y, 2, 2, '#ff8a2e'); p.p(x, y, '#ffd08a'); } }),
  aether: (d) => sprite(16, 16, (p) => { p.ell(8, 10, 7, 5, d ? '#1a4a44' : '#2a6a60'); p.ell(7, 9, 5, 3.5, d ? '#143a36' : '#4ab8a0'); if (!d) for (const [x, y] of [[4, 8], [9, 6], [11, 10], [6, 11]]) { p.r(x, y, 2, 2, '#8affe8'); p.p(x, y, '#ffffff'); } }),
  sunsteel: (d) => sprite(16, 16, (p) => { p.ell(8, 10, 7, 5, d ? '#6a5a3a' : '#9a8250'); p.ell(7, 9, 5, 3.5, d ? '#5a4a30' : '#c0a468'); if (!d) for (const [x, y] of [[4, 8], [9, 6], [11, 10], [6, 11]]) { p.r(x, y, 2, 2, '#ffd04a'); p.p(x, y, '#fff6c0'); } }),
  frostbloom: (d) => sprite(16, 16, (p) => { if (d) { p.r(7, 11, 2, 3, '#7a98b0'); return; } p.r(7, 7, 2, 8, '#5a8aa0'); p.ell(4, 12, 3, 1.5, '#7ab0c8'); p.ell(12, 11, 3, 1.5, '#7ab0c8'); for (const [x, y, r] of [[8, 5, 3.6]]) { p.disc(x, y, r, '#a8d8ff'); p.disc(x, y, r - 1.4, '#e8f8ff'); p.disc(x, y, 1, '#ffffff'); } for (const [x, y] of [[3, 3], [13, 4], [10, 1]]) p.p(x, y, '#ffffff'); }),
  echo: (d) => sprite(16, 18, (p) => { if (d) { p.ell(8, 14, 4, 2, '#3a3060'); return; } const A = ['#3a5ab0', '#5a8ae0', '#9ad0ff', '#e8f8ff']; const shard = (cx, base, h, w) => { for (let y = 0; y < h; y++) { const ww = Math.max(1, Math.round(w * (1 - y / h * 0.9))); p.r(cx - Math.floor(ww / 2), base - y, ww, 1, A[1]); p.p(cx - Math.floor(ww / 2), base - y, A[0]); p.p(cx + Math.floor(ww / 2) - (ww % 2 ? 0 : 1), base - y, A[2]); } }; shard(5, 16, 10, 5); shard(11, 16, 13, 6); shard(8, 16, 8, 4); p.p(9, 5, '#ffffff'); p.p(5, 9, '#ffffff'); }),
  ore: (d) => sprite(16, 14, (p) => { p.ell(8, 9, 7, 5, d ? '#5a5654' : '#85817e'); p.ell(7, 8, 5, 3.5, d ? '#4a4644' : '#a8a4a0'); if (!d) for (const [x, y] of [[4, 6], [9, 5], [11, 9], [6, 10]]) { p.r(x, y, 2, 2, '#e0a060'); p.p(x, y, '#ffe0a0'); } else p.p(8, 8, '#2a2624'); }),
  coal: (d) => sprite(16, 14, (p) => { for (const [x, y, r] of [[5, 9, 4], [11, 9, 4], [8, 6, 4]]) p.disc(x, y, r, d ? '#2a2a30' : '#1c1c22'); if (!d) for (const [x, y] of [[4, 8], [10, 7], [8, 4]]) { p.p(x, y, '#5a5a66'); p.p(x + 1, y + 1, '#44444e'); } }),
  herb: (d) => sprite(16, 14, (p) => { if (d) { p.r(5, 10, 6, 2, '#5a4a30'); p.p(7, 8, '#7a6a40'); p.p(9, 7, '#7a6a40'); return; } for (const [x, h] of [[4, 6], [7, 9], [10, 7], [12, 5]]) { p.r(x, 12 - h, 1, h, '#2d6b34'); p.ell(x - 1, 12 - h, 2, 1.4, '#55a252'); p.ell(x + 2, 12 - h + 2, 2, 1.2, '#3a8040'); } for (const [x, y] of [[3, 3], [8, 2], [11, 4]]) { p.p(x, y, '#ffffff'); p.p(x - 1, y, '#f0d0ff'); p.p(x + 1, y, '#f0d0ff'); } }),
  hide: (d) => sprite(16, 12, (p) => { p.ell(8, 7, 7, 4, d ? '#4a3a2a' : '#8a5a38'); if (!d) { p.ell(7, 6, 5, 2.5, '#a8704a'); p.r(1, 9, 2, 2, '#8a5a38'); p.r(13, 9, 2, 2, '#8a5a38'); p.p(6, 5, '#5a3a22'); p.p(10, 7, '#5a3a22'); } }),
  shelf: (d) => sprite(16, 14, (p) => { if (d) { p.r(3, 10, 10, 2, '#4a3a2a'); return; } for (let i = 0; i < 3; i++) { p.r(2, 9 - i * 3, 12, 3, ['#8c2f40', '#2e5a8c', '#b0782e'][i]); p.r(2, 9 - i * 3, 12, 1, '#e8e0c8'); } p.r(10, 3, 5, 1, '#e8e0c8'); p.p(12, 2, '#e8e0c8'); }),
  hollow_ore: (d) => sprite(16, 16, (p) => { if (d) { p.ell(8, 11, 5, 3, '#2e2948'); return; } p.ell(8, 12, 7, 3, '#2e2948'); for (const [x, b, h, w] of [[5, 12, 9, 4], [10, 12, 11, 5], [8, 13, 6, 3]]) { for (let y = 0; y < h; y++) p.r(x - Math.floor(w / 2) + (y > h - 3 ? 0 : 1), b - y, Math.max(1, w - Math.floor(y / 3)), 1, y % 3 ? '#7a56d8' : '#a984ff'); } p.p(10, 3, '#ffffff'); p.p(5, 5, '#e0d0ff'); }),
  ghostbloom: (d) => sprite(16, 16, (p) => { if (d) { p.r(7, 11, 2, 3, '#3a3060'); return; } p.r(7, 8, 2, 7, '#5a8a9a'); p.ell(4, 11, 3, 1.5, '#7ab0c0'); p.ell(12, 10, 3, 1.5, '#7ab0c0'); for (const [x, y, r] of [[8, 5, 4]]) { p.disc(x, y, r, '#c8b0ff'); p.disc(x, y, r - 1.5, '#f0e8ff'); p.disc(x, y, 1, '#a984ff'); } for (const [x, y] of [[3, 3], [13, 4], [11, 1]]) p.p(x, y, '#e0d0ff'); }),
};
for (const t of EXP_TIERS) NODE[t.id] = (d) => sprite(16, 16, (p) => { p.ell(8, 10, 7, 5, d ? shade(t.ore3[0], 0.7) : t.ore3[0]); p.ell(7, 9, 5, 3.5, d ? shade(t.ore3[1], 0.6) : t.ore3[1]); if (!d) for (const [x, y] of [[4, 8], [9, 6], [11, 10], [6, 11]]) { p.r(x, y, 2, 2, t.ore3[2]); p.p(x, y, '#ffffff'); } });
export const nodeSprite = (type, depleted) => memo(`n:${type}:${depleted}`, () => NODE[type](depleted));

// ── people (16 × 26): class gear, 4 directions, 4 walk frames ───────────────
const SKIN = ['#f0c8a0', '#e0b088', '#c89068', '#9a6a48'], HAIR = ['#2b1d12', '#6b3d1c', '#d6b25a', '#9a9aa6', '#a33030', '#1c1c2a', '#e8e0d0'];
export const PERSON_W = 13, PERSON_H = 21;       // people are drawn at ~80% of the 16×26 master art
function person(cls, dir, frame, seed, color, opts = {}) {
  return memo(`P:${cls}:${dir}:${frame}:${seed}:${color}:${opts.glow ?? ''}:${opts.noGear ?? ''}`, () => {
    if (dir === 'l') return flipped(person(cls, 'r', frame, seed, color, opts));
    return shrink(sprite(16, 26, (p) => {
      const skin = SKIN[seed % 4], hair = HAIR[(seed >> 2) % HAIR.length], main = color, dk = shade(color, 0.62), lt = tint(color, '#ffffff', 0.3);
      const side = dir === 'r', back = dir === 'u', oy = 2 + (frame === 1 || frame === 3 ? -1 : 0), step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
      const pants = '#3a3550', boot = '#251c2c', trim = '#e0b24a';
      // legs + boots
      const leg = (x, y0, len) => { p.r(x, y0, 3, len, pants); p.r(x, y0 + len, 3, 2, boot); p.p(x, y0 + len, '#4a3a58'); };
      if (side) { leg(6 - step, 17 + 2, 5 - Math.abs(step)); leg(7 + step, 17 + 2, 5 - Math.abs(step)); } else { leg(5, 19 - (step > 0 ? 1 : 0), 4 + (step > 0 ? 1 : 0)); leg(8, 19 - (step < 0 ? 1 : 0), 4 + (step < 0 ? 1 : 0)); }
      // torso
      const tx = side ? 5 : 4, tw = side ? 6 : 8;
      p.r(tx, oy + 8, tw, 9, main); p.r(tx, oy + 8, tw, 1, lt); p.r(tx, oy + 15, tw, 1, dk); p.r(tx, oy + 16, tw, 1, '#3a2a20'); p.p(tx + (side ? 3 : 4), oy + 16, trim);
      if (!side) p.r(tx + 3, oy + 8, 2, 7, shade(color, 0.85));
      // arms
      const arm = (x) => { p.r(x, oy + 9, 2, 6, main); p.r(x, oy + 9, 2, 1, lt); p.r(x, oy + 15, 2, 2, skin); };
      if (side) arm(7 + (step ? step : 0) * 0); else { arm(2); arm(12); }
      // head
      const hx = side ? 5 : 4;
      p.r(hx, oy, 8, 8, skin); p.r(hx, oy + 7, 8, 1, shade(skin, 0.88));
      if (back) { p.r(hx, oy - 1, 8, 8, hair); p.r(hx + 1, oy + 7, 6, 1, hair); }
      else if (side) { p.r(hx, oy - 1, 8, 4, hair); p.r(hx, oy + 2, 3, 5, hair); p.p(hx + 6, oy + 4, '#1c1224'); p.p(hx + 7, oy + 5, shade(skin, 0.8)); }
      else { p.r(hx, oy - 1, 8, 3, hair); p.r(hx, oy + 2, 1, 3, hair); p.r(hx + 7, oy + 2, 1, 3, hair); p.p(hx + 1, oy - 1, tint(hair, '#ffffff', 0.25)); p.p(hx + 2, oy + 4, '#1c1224'); p.p(hx + 5, oy + 4, '#1c1224'); p.p(hx + 3, oy + 6, shade(skin, 0.75)); p.p(hx + 4, oy + 6, shade(skin, 0.75)); }
      if (opts.noGear) return;
      gear(p, cls, dir, oy, hx, skin, main, lt, trim, opts);
    }, { outline: null }), PERSON_W, PERSON_H);
  });
}
function gear(p, cls, dir, oy, hx, skin, main, lt, trim, opts) {
  const side = dir === 'r', back = dir === 'u', wx = side ? 11 : 13;     // weapon hand x
  const sword = (len, c = '#c8d0d8') => { p.r(wx, oy + 14 - len, 1, len, c); p.p(wx, oy + 14 - len, '#ffffff'); p.r(wx - 1, oy + 13, 3, 1, '#b0782e'); p.r(wx, oy + 14, 1, 2, '#6a4528'); };
  const staff = (c) => { p.r(wx, oy + 2, 1, 17, '#6a4528'); p.disc(wx, oy + 1, 2, c); p.p(wx - 1, oy, '#ffffff'); };
  switch (cls) {
    case 'warrior': p.r(hx, oy - 2, 8, 4, '#aab0bc'); p.r(hx, oy - 2, 8, 1, '#e0e4ea'); p.r(hx + 3, oy - 4, 2, 2, '#c0392b'); p.r(hx, oy + 2, 1, 2, '#8a909c'); p.r(hx + 7, oy + 2, 1, 2, '#8a909c'); p.r(1, oy + 8, 3, 2, '#8a909c'); p.r(12, oy + 8, 3, 2, '#8a909c'); sword(12); break;
    case 'mage': p.r(hx - 2, oy - 1, 12, 2, '#3d4aa8'); p.r(hx, oy - 3, 8, 2, '#4a5ac0'); p.r(hx + 2, oy - 6, 4, 3, '#4a5ac0'); p.r(hx + 3, oy - 8, 2, 2, '#4a5ac0'); p.p(hx + 4, oy - 2, trim); staff('#8ad8ff'); break;
    case 'archer': p.r(hx - 1, oy - 2, 10, 4, '#2f6a3a'); p.r(hx, oy - 3, 8, 1, '#3f8a4a'); p.r(hx + 6, oy - 4, 1, 3, '#e8e0d0'); p.r(1, oy + 10, 1, 8, '#6a4528'); p.p(2, oy + 9, '#6a4528'); p.p(2, oy + 18, '#6a4528'); p.r(2, oy + 9, 1, 10, '#e8e0d0'); p.r(10, oy + 6, 2, 8, '#6a4528'); break;
    case 'blacksmith': case 'soulsmith': p.r(hx, oy - 1, 8, 2, '#c0392b'); p.r(4, oy + 10, 8, 6, '#6a4528'); p.r(4, oy + 10, 8, 1, '#8f633a'); p.r(wx, oy + 6, 1, 9, '#6a4528'); p.r(wx - 2, oy + 4, 5, 3, '#8a909c'); p.r(wx - 2, oy + 4, 5, 1, '#c8d0d8'); if (cls === 'soulsmith') { p.p(wx - 1, oy + 3, '#ff9f6b'); p.p(wx + 1, oy + 3, '#ffcf8a'); p.p(wx, oy + 2, '#ff9f6b'); } break;
    case 'alchemist': case 'transmuter': p.r(hx, oy + 2, 8, 1, '#6a3f8a'); p.disc(hx + 2, oy + 1, 1.2, '#e0b24a'); p.disc(hx + 5, oy + 1, 1.2, '#e0b24a'); p.p(hx + 2, oy + 1, cls === 'transmuter' ? '#d0a0ff' : '#aef0ff'); p.p(hx + 5, oy + 1, cls === 'transmuter' ? '#d0a0ff' : '#aef0ff'); p.r(wx - 1, oy + 11, 4, 4, '#cfeeff'); p.r(wx, oy + 12, 2, 3, cls === 'transmuter' ? '#c070f0' : '#5fd06a'); p.r(wx, oy + 9, 2, 2, '#cfeeff'); p.p(wx, oy + 8, '#8a6a4a'); break;
    case 'merchant': p.r(hx - 1, oy - 2, 10, 3, '#7a2e3a'); p.r(hx + 1, oy - 4, 6, 2, '#8c3646'); p.r(hx + 6, oy - 5, 1, 3, '#e8e0d0'); p.r(wx - 1, oy + 12, 4, 4, '#b0782e'); p.r(wx, oy + 12, 2, 1, '#e0b24a'); p.p(wx, oy + 14, '#e0b24a'); if (!side && !back) p.r(7, oy + 9, 2, 5, '#e0b24a'); break;
    case 'broker': p.r(hx, oy + 4, 8, 4, '#e8e8ff'); p.r(hx - 1, oy - 2, 10, 3, '#9a9ac8'); p.r(wx, oy + 11, 2, 5, '#e8e8ff'); p.p(wx, oy + 11, '#ffffff'); break;
    case 'desperado': p.r(hx - 3, oy - 1, 14, 2, '#1c1c2a'); p.r(hx, oy - 4, 8, 3, '#1c1c2a'); p.r(hx, oy - 2, 8, 1, '#b04080'); p.r(hx, oy + 6, 8, 2, '#b04080'); p.r(wx, oy + 12, 3, 2, '#3a3a44'); p.p(wx + 2, oy + 11, '#c8d0d8'); break;
    case 'apostle': p.r(hx - 1, oy - 2, 10, 2, '#2d6b34'); for (const x of [hx, hx + 3, hx + 6]) { p.r(x, oy - 4, 2, 3, '#55a252'); p.p(x, oy - 5, '#9af0b0'); } p.r(wx, oy + 1, 1, 17, '#6a4528'); p.disc(wx, oy, 2.2, '#55a252'); p.p(wx - 1, oy - 1, '#c8ffc0'); break;
    case 'void_sovereign': p.r(hx - 1, oy - 3, 10, 2, '#3a2a6a'); for (const x of [hx, hx + 2, hx + 4, hx + 6]) p.r(x, oy - 5, 1, 3, '#a984ff'); p.r(1, oy + 8, 3, 3, '#7a5aff'); p.r(12, oy + 8, 3, 3, '#7a5aff'); p.r(wx, oy + 4, 1, 12, '#7a5aff'); p.disc(wx, oy + 3, 1.6, '#e0d0ff'); break;
    case 'titan_forgemaster': p.r(hx, oy - 2, 8, 3, '#ff8a2a'); p.r(hx + 3, oy - 4, 2, 2, '#ffe36b'); p.r(1, oy + 8, 4, 3, '#4a525c'); p.r(11, oy + 8, 4, 3, '#4a525c'); p.r(wx, oy + 4, 1, 12, '#6a4528'); p.r(wx - 3, oy + 1, 7, 4, '#8a909c'); p.r(wx - 3, oy + 1, 7, 1, '#ff9a4a'); break;
    case 'philosopher': p.r(hx - 2, oy - 1, 12, 2, '#6a3f8a'); p.r(hx, oy - 5, 8, 4, '#7a4aa0'); p.p(hx + 3, oy - 3, '#ffe36b'); p.p(hx + 4, oy - 3, '#ffe36b'); p.r(wx - 1, oy + 10, 4, 5, '#ffe36b'); p.r(wx, oy + 8, 2, 2, '#cfeeff'); break;
    case 'gilded': p.r(hx, oy - 3, 8, 3, '#ffe36b'); for (const x of [hx, hx + 3, hx + 6]) p.r(x, oy - 5, 2, 2, '#ffe36b'); p.r(1, oy + 8, 14, 1, '#ffe36b'); p.r(wx - 1, oy + 10, 4, 5, '#e0b24a'); p.p(wx, oy + 11, '#c0392b'); break;
    case 'archivist': p.r(hx + 1, oy + 3, 3, 2, '#3a3a44'); p.r(hx + 4, oy + 3, 3, 2, '#3a3a44'); p.r(hx + 2, oy + 4, 1, 1, '#aef0ff'); p.r(hx + 5, oy + 4, 1, 1, '#aef0ff'); p.r(wx - 1, oy + 10, 5, 6, '#2f8a8a'); p.r(wx, oy + 11, 3, 4, '#e8f6f0'); break;
    default: break;
  }
}
export const personSprite = (cls, dir, frame, seed, color, opts) => person(cls, dir, frame, seed, color, opts);
export const classColor = (cls) => CLASSES[cls]?.color ?? '#888888';

// ── monsters ────────────────────────────────────────────────────────────────
// Each returns a sprite facing RIGHT; the renderer flips for left. `f` = animation frame (0/1).
const eye = (p, x, y, c = '#ffd04a') => { p.p(x, y, c); p.p(x + 1, y, c); p.p(x, y + 1, shade(c, 0.6)); };
const MON = {
  hound: (c, f) => sprite(26, 18, (p) => { const b = c, d = shade(c, 0.6), l = tint(c, '#ffffff', 0.25);
    const leg = (x, up) => { p.r(x, 12 - (up ? 1 : 0), 2, 5 + (up ? 1 : 0), d); p.r(x, 16, 3, 1, '#2a2024'); };
    leg(4, f); leg(8, !f); leg(15, !f); leg(19, f);
    p.ell(12, 10, 9, 5, b); p.ell(11, 8, 7, 3, l); p.r(5, 12, 14, 1, d); p.r(1, 6, 4, 2, d); p.r(0, 5, 2, 2, d);
    p.ell(21, 8, 4, 3.5, b); p.r(22, 9, 4, 3, d); p.r(23, 11, 3, 1, '#e8e0d0'); p.p(24, 10, '#e8e0d0'); p.r(19, 3, 2, 3, d); p.r(22, 3, 2, 3, d); eye(p, 21, 7, '#ff4a3a'); p.r(13, 4, 5, 1, d); }),
  imp: (c, f) => sprite(20, 22, (p) => { const b = c, d = shade(c, 0.6), l = tint(c, '#ffffff', 0.3);
    const w = f ? 3 : 0; p.r(1, 5 + w, 5, 2, '#3a1a20'); p.r(0, 3 + w, 4, 3, '#4a2028'); p.r(2, 7 + w, 4, 5, '#3a1a20'); p.r(14, 5 + w, 5, 2, '#3a1a20'); p.r(16, 3 + w, 4, 3, '#4a2028'); p.r(14, 7 + w, 4, 5, '#3a1a20');
    p.disc(10, 12, 5.5, b); p.disc(9, 11, 3.5, l); p.r(7, 16, 2, 4, d); p.r(11, 16, 2, 4, d); p.r(6, 19, 3, 1, '#2a2024'); p.r(11, 19, 3, 1, '#2a2024');
    p.r(6, 5, 2, 4, '#e8e0d0'); p.r(12, 5, 2, 4, '#e8e0d0'); p.p(6, 4, '#e8e0d0'); p.p(13, 4, '#e8e0d0'); eye(p, 7, 10); eye(p, 11, 10); p.r(8, 14, 4, 1, '#fff'); p.p(8, 15, '#fff'); p.p(11, 15, '#fff');
    p.line(15, 16, 18, 18, d); p.line(18, 18, 17, 20, d); p.p(17, 20, '#ff4a3a'); }),
  brute: (c, f) => sprite(28, 30, (p) => { const b = c, d = shade(c, 0.58), l = tint(c, '#ffffff', 0.22);
    p.r(7, 22, 6, 7 + (f ? 0 : 1), d); p.r(15, 22, 6, 7 + (f ? 1 : 0), d); p.r(6, 28, 8, 2, '#2a2024'); p.r(14, 28, 8, 2, '#2a2024');
    p.r(5, 9, 18, 15, b); p.r(5, 9, 18, 2, l); p.r(5, 20, 18, 4, d); for (const [x, y] of [[8, 12], [15, 14], [11, 17]]) { p.r(x, y, 4, 3, shade(c, 0.78)); p.p(x, y, l); }
    p.r(0, 11, 6, 13, b); p.r(22, 11, 6, 13, b); p.r(0, 11, 6, 2, l); p.r(-0, 22, 7, 6, d); p.r(21, 22, 7, 6, d); p.r(1, 26, 5, 2, shade(c, 0.4)); p.r(22, 26, 5, 2, shade(c, 0.4));
    p.r(9, 1, 10, 9, b); p.r(9, 1, 10, 1, l); p.r(8, 4, 1, 4, d); p.r(19, 4, 1, 4, d); eye(p, 11, 5, '#ff7a2e'); eye(p, 15, 5, '#ff7a2e'); p.r(11, 8, 6, 1, d); for (let i = 0; i < 3; i++) p.p(12 + i * 2, 9, '#e8e0d0'); p.r(7, 12, 14, 1, '#ff7a2e'); p.p(10, 15, '#ff7a2e'); p.p(17, 13, '#ff7a2e'); }),
  stag: (c, f) => sprite(30, 28, (p) => { const b = c, d = shade(c, 0.6), l = tint(c, '#ffffff', 0.25);
    const leg = (x, up) => { p.r(x, 15 - (up ? 1 : 0), 2, 9 + (up ? 1 : 0), d); p.r(x - 1, 23, 4, 2, '#2a2024'); };
    leg(6, f); leg(10, !f); leg(19, !f); leg(23, f);
    p.ell(15, 14, 11, 6, b); p.ell(14, 12, 8, 3.5, l); p.r(2, 10, 5, 3, d); p.r(24, 6, 4, 9, b); p.ell(27, 6, 3.5, 3, b); p.r(28, 7, 3, 3, d); eye(p, 27, 4, '#ffe36b'); p.r(26, 2, 2, 3, d);
    for (const x of [24, 27]) { p.line(x, 2, x - 1, -1, '#e8e0c8'); } p.line(23, 0, 20, -2, '#e8e0c8'); p.line(26, 0, 29, -3, '#e8e0c8'); p.r(12, 8, 6, 1, d); for (let i = 0; i < 4; i++) p.p(9 + i * 3, 12 + (i % 2), '#e8e0c8'); }),
  wisp: (c, f) => sprite(18, 24, (p) => { const b = c, l = tint(c, '#ffffff', 0.55), w = tint(c, '#ffffff', 0.9);
    p.disc(9, 9, 6.5, shade(c, 0.7)); p.disc(9, 9, 5, b); p.disc(8, 8, 3.2, l); p.disc(8, 7, 1.3, w);
    const tail = f ? [[9, 15, 3], [10, 18, 2], [9, 21, 1]] : [[9, 15, 3], [8, 18, 2], [9, 21, 1]]; for (const [x, y, r] of tail) p.disc(x, y, r, shade(c, 0.8)); p.p(9, 22, l);
    p.p(6, 9, '#1a1030'); p.p(11, 9, '#1a1030'); p.p(6, 10, '#1a1030'); p.p(11, 10, '#1a1030'); for (const [x, y] of [[2, 4], [15, 7], [14, 1], [3, 13]]) p.p(x + (f ? 1 : 0), y, l); }),
  wraith: (c, f) => sprite(20, 28, (p) => { const b = c, d = shade(c, 0.55), l = tint(c, '#ffffff', 0.25);
    p.r(4, 8, 12, 14, b); p.r(4, 8, 12, 1, l); p.r(3, 10, 2, 8, d); p.r(15, 10, 2, 8, d); for (let i = 0; i < 6; i++) { const y = 22 + ((i + f) % 2) * 2 + (i % 3 === 0 ? 1 : 0); p.r(4 + i * 2, 22, 2, y - 21, b); p.p(4 + i * 2, y, d); }
    p.disc(10, 7, 5.5, d); p.disc(10, 7, 4.2, '#15101e'); eye(p, 7, 6, '#ffffff'); eye(p, 11, 6, '#ffffff'); p.r(5, 2, 10, 2, b); p.r(0, 11, 4, 5, b); p.r(16, 11, 4, 5, b); p.r(0, 15, 3, 3, l); p.r(17, 15, 3, 3, l); p.r(9, 12, 2, 6, d); }),
  worm: (c, f) => sprite(34, 20, (p) => { const b = c, d = shade(c, 0.6), l = tint(c, '#ffffff', 0.3);
    for (let i = 0; i < 7; i++) { const x = 4 + i * 4, y = 12 - Math.round(Math.sin(i * 0.9 + f * 1.6) * 3) - (i > 4 ? 4 : 0); p.disc(x, y, 5 - i * 0.2, i % 2 ? b : d); p.p(x - 1, y - 2, l); }
    p.disc(30, 9, 6, '#8a3a30'); p.disc(30, 9, 4.5, '#5a1a18'); for (let i = 0; i < 8; i++) { const a = i * 0.8; p.p(30 + Math.round(Math.cos(a) * 4), 9 + Math.round(Math.sin(a) * 4), '#fff'); } eye(p, 27, 4, '#ffe36b'); eye(p, 31, 4, '#ffe36b'); }),
  warden: (c, f) => sprite(34, 46, (p) => { const b = c, d = shade(c, 0.58), l = tint(c, '#ffffff', 0.25);
    p.r(8, 32, 7, 13 + (f ? 0 : 1), d); p.r(19, 32, 7, 13 + (f ? 1 : 0), d); p.r(7, 44, 9, 2, '#2a2024'); p.r(18, 44, 9, 2, '#2a2024');
    p.r(5, 14, 24, 20, b); p.r(5, 14, 24, 2, l); p.r(5, 28, 24, 3, d); p.r(5, 14, 3, 20, d); p.r(26, 14, 3, 20, d); p.r(15, 16, 4, 14, '#c0b060'); p.r(14, 20, 6, 2, '#c0b060');
    p.r(0, 16, 6, 16, b); p.r(28, 16, 6, 16, b); p.r(-0, 30, 6, 4, '#e8dcc0'); p.r(28, 30, 6, 4, '#e8dcc0');
    p.r(1, 22, 12, 14, '#e8e0c0'); p.r(1, 22, 2, 14, '#6a3a2a'); p.r(4, 26, 7, 1, '#6a4a3a'); p.r(4, 29, 6, 1, '#6a4a3a'); p.r(4, 32, 7, 1, '#6a4a3a');
    p.r(10, 3, 14, 12, b); p.r(10, 3, 14, 1, l); p.r(8, 0, 18, 4, '#2a2030'); p.r(12, -1 + 1, 10, 1, '#4a4058'); eye(p, 13, 8, '#ff5a4a'); eye(p, 19, 8, '#ff5a4a'); p.r(13, 12, 8, 1, d); p.line(30, 4, 30, 38, '#8a7a3a'); p.r(27, 0, 7, 4, '#c0b060'); p.r(28, 0, 5, 1, '#ffe36b'); }),
  husk: (c, f) => sprite(22, 30, (p) => { const b = c, d = shade(c, 0.55), l = tint(c, '#ffffff', 0.22);
    p.r(6, 20, 4, 9 + (f ? 0 : 1), d); p.r(12, 20, 4, 9 + (f ? 1 : 0), d); p.r(5, 28, 6, 2, '#1c1620'); p.r(11, 28, 6, 2, '#1c1620');
    p.r(4, 9, 14, 13, b); p.r(4, 9, 14, 1, l); p.r(2, 11, 3, 12, b); p.r(17, 11, 3, 12, b); p.r(0, 21, 4, 5, d); p.r(18, 21, 4, 5, d); p.r(3, 8, 16, 3, d);
    p.disc(11, 6, 4.5, '#7a6a8a'); p.r(8, 4, 2, 2, '#a984ff'); p.r(12, 4, 2, 2, '#a984ff'); p.r(9, 8, 4, 1, '#2a2030'); p.line(7, 12, 11, 17, '#c8a0ff'); p.line(11, 17, 9, 21, '#c8a0ff'); p.line(14, 11, 13, 16, '#c8a0ff'); p.p(6, 14, '#e0d0ff'); }),
  witch: (c, f) => sprite(18, 34, (p) => { const b = c, d = shade(c, 0.55), l = tint(c, '#ffffff', 0.25);
    p.r(4, 14, 10, 17, b); p.r(2, 28, 14, 3, d); p.r(4, 14, 10, 1, l); for (let i = 0; i < 5; i++) p.r(2 + i * 3, 30 + (i + f) % 2, 3, 2, d); p.r(1, 16, 3, 8, b); p.r(14, 16, 3, 8, b); p.r(1, 23, 3, 2, '#c8b098'); p.r(14, 23, 3, 2, '#c8b098');
    p.disc(9, 10, 4.5, '#c8b098'); p.r(7, 9, 1, 2, '#1a1030'); p.r(11, 9, 1, 2, '#1a1030'); p.r(8, 13, 3, 1, '#8a4a50'); p.r(0, 6, 18, 2, '#2a1a30'); p.r(4, 2, 10, 4, '#3a2040'); p.r(6, -1 + 1, 6, 2, '#3a2040'); p.r(8, 0, 3, 1, '#3a2040'); p.r(4, 5, 10, 1, '#c0392b');
    p.r(16, 12, 1, 20, '#6a4528'); p.disc(16, 11, 2, '#ffe36b'); p.p(15, 10, '#fff'); }),
  boar: (c, f) => sprite(24, 16, (p) => { const b = c, d = shade(c, 0.6), l = tint(c, '#ffffff', 0.25);
    const leg = (x, up) => { p.r(x, 10 - (up ? 1 : 0), 2, 5 + (up ? 1 : 0), d); p.r(x, 14, 3, 1, '#2a2024'); };
    leg(5, f); leg(9, !f); leg(14, !f); leg(18, f);
    p.ell(11, 8, 8, 5, b); p.ell(10, 6, 6, 2.5, l); for (let i = 0; i < 5; i++) p.r(5 + i * 3, 3 + (i % 2), 2, 2, d);
    p.ell(19, 8, 4, 4, b); p.r(21, 9, 3, 3, d); p.p(22, 10, '#1a1014'); p.r(22, 12, 2, 2, '#e8e0d0'); p.p(20, 6, '#1a1014'); p.r(17, 3, 2, 3, d); p.r(1, 6, 3, 2, d); }),
  scorpion: (c, f) => sprite(26, 18, (p) => { const b = c, d = shade(c, 0.6), l = tint(c, '#ffffff', 0.3);
    for (const x of [8, 11, 14, 17]) { p.r(x, 12, 1, 4 - (f && x % 2 ? 1 : 0), d); p.p(x + (x % 2 ? 1 : -1), 15, d); }
    p.ell(12, 9, 8, 4.5, b); p.ell(11, 7, 6, 2.2, l); p.r(5, 9, 14, 1, d); p.ell(19, 8, 3.5, 3, b); p.p(20, 7, '#ff4a3a'); p.p(21, 9, '#ff4a3a');
    p.r(21, 12, 3, 2, b); p.r(23, 10, 2, 3, b); p.p(24, 9, l); p.r(22, 13, 1, 2, d);
    for (const [x, y] of [[4, 6], [3, 4], [2, 2], [3, 1], [5, 1], [6, 2]]) p.r(x, y, 2, 2, b); p.p(6, 2, '#ff4a3a'); }),
  skeleton: (c, f) => sprite(16, 26, (p) => { const b = c, d = shade(c, 0.65), st = f ? 1 : 0;
    p.r(5, 18, 2, 6 - st, d); p.r(9, 18, 2, 5 + st, d); p.r(4, 23 - st, 3, 2, '#3a3a44'); p.r(9, 22 + st, 3, 2, '#3a3a44');
    p.r(4, 8, 8, 10, '#241c2c'); for (let y = 9; y < 17; y += 2) { p.r(4, y, 8, 1, b); p.p(7, y, d); } p.r(7, 8, 2, 10, b);
    p.r(2, 9, 2, 8, b); p.r(12, 9, 2, 8, b); p.r(12, 14, 1, 8, '#b0b8c0'); p.r(11, 13, 3, 1, '#8a6a3a'); p.r(5, 1, 6, 7, b); p.r(5, 1, 6, 1, tint(c, '#ffffff', 0.4)); p.r(6, 8, 4, 1, d);
    p.r(6, 3, 2, 2, '#14101c'); p.r(9, 3, 2, 2, '#14101c'); p.p(6, 3, '#ff7a3a'); p.p(9, 3, '#ff7a3a'); p.r(7, 6, 3, 1, '#14101c'); }),
  golem: (c, f) => sprite(28, 28, (p) => { const b = c, d = shade(c, 0.58), l = tint(c, '#ffffff', 0.3);
    p.r(6, 20, 6, 8 - (f ? 1 : 0), d); p.r(16, 20, 6, 7 + (f ? 1 : 0), d); p.r(5, 27, 8, 1, '#1a161c'); p.r(15, 27, 8, 1, '#1a161c');
    p.r(4, 8, 20, 14, b); p.r(4, 8, 20, 2, l); p.r(4, 20, 20, 2, d); for (const [x, y, w, h] of [[7, 11, 5, 4], [15, 12, 6, 5], [10, 17, 6, 3]]) { p.r(x, y, w, h, shade(c, 0.78)); p.r(x, y, w, 1, l); }
    p.r(0, 10, 5, 12, b); p.r(23, 10, 5, 12, b); p.r(0, 10, 5, 2, l); p.r(-0, 20, 6, 5, d); p.r(22, 20, 6, 5, d);
    p.r(9, 1, 10, 8, b); p.r(9, 1, 10, 2, l); p.r(10, 4, 3, 2, '#ffd04a'); p.r(15, 4, 3, 2, '#ffd04a'); p.r(11, 7, 6, 1, d); p.r(13, 12, 2, 4, '#ffb84a'); }),
  spider: (c, f) => sprite(24, 16, (p) => { const b = c, d = shade(c, 0.55), l = tint(c, '#ffffff', 0.3);
    for (let i = 0; i < 4; i++) { const y = 4 + i * 2; p.line(8, y + 2, 2 - (f && i % 2), y - 2 + (f ? i % 2 : 0), d); p.line(15, y + 2, 21 + (f && i % 2), y - 2 + (f ? i % 2 : 0), d); p.p(1 - (f && i % 2), y - 3, d); p.p(22 + (f && i % 2), y - 3, d); }
    p.ell(12, 9, 4.5, 3.5, b); p.ell(18, 8, 3.5, 3, shade(c, 0.8)); p.ell(11, 8, 3, 1.6, l); for (const [x, y] of [[17, 6], [19, 6], [18, 8], [20, 8]]) p.p(x, y, '#ff4a6a'); p.r(20, 10, 2, 2, d); }),
  bandit: (c, f) => person('archer', 'r', f ? 1 : 0, 5, c, {}),
  mirror: null,
  unwritten: (c, f) => sprite(56, 56, (p) => { const b = c, d = shade(c, 0.5), l = tint(c, '#ffffff', 0.5);
    for (let i = 0; i < 8; i++) { const a = i * 0.8 + f * 0.25; let x = 28, y = 30; for (let k = 0; k < 14; k++) { x += Math.cos(a + k * 0.12) * 2.1; y += Math.sin(a * 1.2 + k * 0.1) * 1.7 + 1.1; p.r(Math.round(x), Math.round(y), 2 + (k < 4 ? 1 : 0), 2, k % 3 ? d : '#241c3a'); } }
    p.ell(28, 24, 20, 16, d); p.ell(28, 23, 19, 15, b); p.ell(26, 19, 13, 8, l); p.ell(28, 24, 11, 12, '#140a22'); p.ell(28, 24, 8, 9, '#2a1a48'); p.disc(28 + (f ? 2 : -2), 24, 5, '#c8a0ff'); p.disc(28 + (f ? 2 : -2), 24, 2, '#140a22'); p.p(26, 21, '#ffffff'); for (const [x, y] of [[8, 8], [48, 10], [6, 34], [50, 36]]) p.r(x + (f ? 1 : 0), y, 2, 2, '#e0d0ff'); }),
};
export function monsterSprite(shape, color, frame, flash = false) {
  const key = `m:${shape}:${color}:${frame}:${flash}`;
  return memo(key, () => { const base = memo(`m:${shape}:${color}:${frame}`, () => (MON[shape] ?? MON.hound)(color, frame)); return flash ? flashed(base) : base; });
}
export function shadowSprite(w) {
  return memo(`sh:${w}`, () => sprite(w, 4, (p) => { p.ell(w / 2, 2, w / 2, 1.6, 'rgba(0,0,0,.38)'); p.ell(w / 2, 2, w / 2 - 2, 0.9, 'rgba(0,0,0,.2)'); }, { outline: null }));
}
