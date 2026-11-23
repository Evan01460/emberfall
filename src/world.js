// ─────────────────────────────────────────────────────────────────────────────
// WORLD GEOMETRY — deterministic tile maps shared by server and client.
// Coordinates are in tile units (floats). A tile (tx,ty) spans [tx,tx+1) × [ty,ty+1).
// Two realms: "main" (Lanternfall and its wilds) and "hollow" (the mirror realm).
// ─────────────────────────────────────────────────────────────────────────────
import { Rng } from './rng.js';

export const TS = 32;
export const T = { GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, WALL: 5, FLOOR: 6, SAND: 7, HOLLOW: 8, CRYSTAL: 9, DOOR: 10, COBBLE: 11, BRIDGE: 12, SHELF: 13, RUG: 14, VOID: 15, CHASM: 16 };
const BLOCK = new Set([T.WATER, T.TREE, T.ROCK, T.WALL, T.CRYSTAL, T.SHELF, T.CHASM]);
export const PLAYER_R = 0.28;
export const PLAYER_SPEED = 4.4;      // tiles / second

// ── Builder helpers ─────────────────────────────────────────────────────────
function mk(id, name, w, h, fill, theme) {
  return { id, name, w, h, theme, tiles: new Uint8Array(w * h).fill(fill), solid: new Uint8Array(w * h), decor: [], portals: [], points: [], mobSpawns: [], safe: [], spawn: { x: 2, y: 2 } };
}
const inb = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const set = (m, x, y, t) => { if (inb(m, x, y)) m.tiles[y * m.w + x] = t; };
export const tileAt = (m, x, y) => (inb(m, x, y) ? m.tiles[y * m.w + x] : T.WALL);
export const isBlockedTile = (m, tx, ty) => BLOCK.has(tileAt(m, tx, ty)) || (inb(m, tx, ty) && m.solid[ty * m.w + tx] === 1);
function rect(m, x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(m, i, j, t); }
function box(m, x, y, w, h, doorX) {
  rect(m, x, y, w, h, T.WALL); rect(m, x + 1, y + 1, w - 2, h - 2, T.FLOOR);
  const dx = doorX ?? x + Math.floor(w / 2); set(m, dx, y + h - 1, T.DOOR);
  return { x, y, w, h, door: { x: dx, y: y + h - 1 } };
}
function line(m, x1, y1, x2, y2, t, wd = 2, only = null) {
  let x = x1, y = y1;
  const step = () => { const x0 = Math.round(x - (wd - 1) / 2), y0 = Math.round(y - (wd - 1) / 2); if (only === null) rect(m, x0, y0, wd, wd, t); else for (let j = y0; j < y0 + wd; j++) for (let i = x0; i < x0 + wd; i++) if (tileAt(m, i, j) === only) set(m, i, j, t); };
  step();
  while (Math.round(x) !== x2 || Math.round(y) !== y2) {
    if (Math.round(x) !== x2 && (Math.abs(x2 - x) >= Math.abs(y2 - y) || Math.round(y) === y2)) x += Math.sign(x2 - x);
    else y += Math.sign(y2 - y);
    step();
  }
}
function polyline(m, pts, t, wd, only = null) { for (let i = 0; i < pts.length - 1; i++) line(m, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], t, wd, only); }
function scatter(m, t, density, rng, ok = () => true, only = null) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if ((only === null || m.tiles[y * m.w + x] === only) && ok(x, y) && rng.chance(density)) set(m, x, y, t);
  }
}
function blob(m, cx, cy, r, t, rng) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r * (0.7 + rng.next() * 0.5)) set(m, cx + x, cy + y, t);
}
function ring(m, t) { for (let i = 0; i < m.w; i++) { set(m, i, 0, t); set(m, i, m.h - 1, t); } for (let j = 0; j < m.h; j++) { set(m, 0, j, t); set(m, m.w - 1, j, t); } }
const near = (x, y, cx, cy, r) => Math.abs(x - cx) <= r && Math.abs(y - cy) <= r;
// Things you cannot walk through: stations, NPCs, chests, big props. Hidden/secret points stay walkable (they may not exist for you).
const SOLID_KINDS = new Set(['forge', 'cauldron', 'exchange', 'camp', 'bazaar', 'gate', 'chest', 'npc', 'waystone', 'sign', 'board']);
const solidAt = (m, x, y, w = 1, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inb(m, x + i, y + j)) m.solid[(y + j) * m.w + x + i] = 1; };
const pt = (m, kind, id, x, y, extra = {}) => { m.points.push({ id: `${m.id}.${id}`, kind, x: x + 0.5, y: y + 0.5, ...extra }); if (SOLID_KINDS.has(kind) && !extra.hidden && !extra.secret) solidAt(m, x, y); };
// Decoration: purely visual unless solid. kind selects the sprite; (x,y) is the top-left tile, w×h tiles.
const deco = (m, kind, x, y, { solid = true, w = 1, h = 1 } = {}) => { m.decor.push({ kind, x, y, w, h, solid }); if (solid) solidAt(m, x, y, w, h); };
// A solid prop is only kept if every station, node, portal and spawn is still reachable afterwards.
function everythingReachable(m) {
  const seen = reach(m, Math.floor(m.spawn.x), Math.floor(m.spawn.y));
  const ok = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy; return inb(m, tx, ty) && seen[ty * m.w + tx]; });
  return m.points.every((p) => p.hidden || ok(p.x, p.y)) && m.portals.every((p) => ok(p.x, p.y)) && m.mobSpawns.every((s) => ok(s.x, s.y)) && (!m.bossSpawn || ok(m.bossSpawn.x, m.bossSpawn.y));
}
function chests(m, rng, n, opts, name) {
  for (const [x, y] of place(m, rng, n, opts)) {
    pt(m, 'chest', `chest${x}_${y}`, x, y, { name });
    if (!everythingReachable(m)) { m.points.pop(); m.solid[y * m.w + x] = 0; }
  }
}
const decoScatter = (m, rng, kind, n, opts = {}, placeOpts = {}) => {
  for (const [x, y] of place(m, rng, n, { gap: 4, ...placeOpts })) {
    deco(m, kind, x, y, opts);
    if (opts.solid !== false && !everythingReachable(m)) { m.decor.pop(); m.solid[y * m.w + x] = 0; }
  }
};
const portal = (m, x, y, w, h, to, label, extra = {}) => { m.portals.push({ x, y, w, h, to, label, ...extra }); };

function reach(m, sx, sy) {
  const seen = new Uint8Array(m.w * m.h), q = [[sx, sy]]; seen[sy * m.w + sx] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (inb(m, nx, ny) && !seen[ny * m.w + nx] && !isBlockedTile(m, nx, ny)) { seen[ny * m.w + nx] = 1; q.push([nx, ny]); }
    }
  }
  return seen;
}
export const reachableFrom = reach;

// Place `n` items on free, reachable tiles (away from entrance + each other).
function place(m, rng, n, { minX = 0, maxX = m.w - 1, minY = 0, maxY = m.h - 1, gap = 3, avoid = [], onlyOn = null } = {}) {
  const base = reach(m, Math.floor(m.spawn.x), Math.floor(m.spawn.y)), out = [];
  let tries = 0;
  while (out.length < n && tries++ < 4000) {
    const x = rng.int(minX, maxX), y = rng.int(minY, maxY);
    if (!base[y * m.w + x] || isBlockedTile(m, x, y)) continue;
    if (onlyOn && !onlyOn.includes(tileAt(m, x, y))) continue;
    if (avoid.some(([ax, ay, ar]) => near(x, y, ax, ay, ar))) continue;
    if (out.some(([ox, oy]) => Math.abs(ox - x) + Math.abs(oy - y) < gap)) continue;
    if (m.points.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 2)) continue;
    out.push([x, y]);
  }
  return out;
}
function carve(m, x, y, r, t) { rect(m, x - r, y - r, r * 2 + 1, r * 2 + 1, t); }

// ── Maps ────────────────────────────────────────────────────────────────────
function buildTown() {
  const m = mk('town', 'Lanternfall', 52, 36, T.GRASS, 'main'), rng = new Rng(101);
  m.safe.push({ x: 0, y: 0, w: m.w, h: m.h });
  m.spawn = { x: 26, y: 19 };
  rect(m, 15, 10, 22, 15, T.COBBLE);                                    // plaza
  polyline(m, [[37, 18], [51, 18]], T.PATH, 3, T.GRASS); polyline(m, [[0, 18], [15, 18]], T.PATH, 3, T.GRASS); polyline(m, [[26, 25], [26, 35]], T.PATH, 3, T.GRASS);
  polyline(m, [[10, 24], [10, 18]], T.PATH, 2, T.GRASS);
  // buildings (doors face the plaza/roads)
  const bs = [box(m, 5, 4, 11, 7, 10), box(m, 36, 4, 10, 7, 41), box(m, 20, 3, 12, 8, 26), box(m, 4, 22, 12, 9, 10)];
  polyline(m, [[10, 11], [10, 18]], T.PATH, 2, T.GRASS); polyline(m, [[41, 11], [41, 18]], T.PATH, 2, T.GRASS);   // door paths: only over grass, never across the plaza
  // trees only on untouched grass, away from buildings, plaza and exits
  const keep = (x, y) => !bs.some((b) => x >= b.x - 2 && x < b.x + b.w + 2 && y >= b.y - 2 && y < b.y + b.h + 2) && !(x >= 13 && x < 39 && y >= 8 && y < 27) && !(y >= 15 && y <= 21 && (x < 6 || x > 45)) && !(x >= 22 && x <= 30 && y > 25);
  scatter(m, T.TREE, 0.2, rng, keep, T.GRASS);
  rect(m, 25, 17, 2, 2, T.COBBLE);
  deco(m, 'fountain', 25, 17, { w: 2, h: 2 });
  furnishTown(m);
  pt(m, 'forge', 'forge', 8, 7, { name: 'Forge & Anvil', icon: '' });
  pt(m, 'cauldron', 'cauldron', 39, 7, { name: 'Alchemist\'s Cauldron', icon: '' });
  pt(m, 'exchange', 'board', 24, 6, { name: 'Exchange Board', icon: '' });
  pt(m, 'npc', 'vendor', 22, 14, { name: 'Pell the Vendor', icon: '', role: 'vendor', lines: ['Raw goods at honest prices! Ore, coal, hide, herbs, ink, parchment — I sell high and buy low, so check the Exchange first.'] });
  pt(m, 'npc', 'warden', 29, 21, { name: 'Warden Hale', icon: '', role: 'lore', lines: ['Welcome to Lanternfall. Fighters bring back what the wilds hide; smiths and brewers turn it into gear; merchants move it. Nobody here thrives alone.', 'East: the Whispering Quarry. West: Gloomwood. South: the Drowned Archive — and rumour says it sits on a sealed gate to somewhere else.'] });
  pt(m, 'npc', 'innkeeper', 9, 26, { name: 'Marta the Innkeeper', icon: '', role: 'tavern' });
  pt(m, 'npc', 'broker_figure', 29, 6, { name: 'The Veiled Broker', icon: '', role: 'hidden', hidden: 'broker' });
  pt(m, 'npc', 'brewmaster', 43, 7, { name: 'Old Brewmaster', icon: '', role: 'hidden', hidden: 'transmuter' });
  pt(m, 'npc', 'stranger', 13, 28, { name: 'Corner-Table Stranger', icon: '', role: 'hidden', hidden: 'desperado' });
  pt(m, 'npc', 'sign_gloom', 6, 16, { name: 'Signpost', icon: '', role: 'lore', lines: ['GLOOMWOOD < (Lv 3+). Thorn stags, wisps, witches. Bring herbs back for the Alchemists.'] });
  pt(m, 'npc', 'sign_quarry', 46, 16, { name: 'Signpost', icon: '', role: 'lore', lines: ['> QUARRY (Lv 1+)  Hounds, imps, brutes. Ore, coal and hides. Start here.'] });
  pt(m, 'npc', 'sign_arch', 28, 31, { name: 'Signpost', icon: '', role: 'lore', lines: ['DROWNED ARCHIVE (south) (Lv 5+). Mind the wet pages. Mind the dry ones more.'] });
  portal(m, 51, 16, 1, 5, { map: 'quarry', x: 2.5, y: 20.5 }, 'To Whispering Quarry >');
  portal(m, 0, 16, 1, 5, { map: 'gloomwood', x: 61.5, y: 20.5 }, '< To Gloomwood');
  portal(m, 24, 35, 5, 1, { map: 'archive', x: 28.5, y: 2.5 }, 'To Drowned Archive');
  return m;
}

function furnishTown(m) {
  // Smithy (interior x6..14, y5..9, door at x=10)
  deco(m, 'furnace', 7, 5); deco(m, 'rack', 12, 5); deco(m, 'barrel', 14, 5); deco(m, 'crates', 14, 8); deco(m, 'grindstone', 12, 8); deco(m, 'coalbin', 6, 8);
  // Alchemy hut (interior x37..44, y5..9, door at x=41)
  deco(m, 'potions', 38, 5); deco(m, 'potions', 40, 5); deco(m, 'bookshelf', 37, 8); deco(m, 'table', 43, 5); deco(m, 'barrel', 44, 9); deco(m, 'herbs', 42, 5, { solid: false });
  // Exchange hall (interior x21..30, y4..9, door at x=26)
  deco(m, 'counter', 27, 5, { w: 3 }); deco(m, 'bench', 22, 9); deco(m, 'bench', 30, 9); deco(m, 'plant', 21, 4); deco(m, 'plant', 30, 4); deco(m, 'scale', 28, 5, { solid: false });
  // Tavern (interior x5..14, y23..29, door at x=10)
  deco(m, 'counter', 6, 26, { w: 3 }); deco(m, 'table', 6, 28); deco(m, 'table', 12, 25); deco(m, 'stool', 7, 28, { solid: false }); deco(m, 'stool', 11, 25, { solid: false }); deco(m, 'barrel', 5, 23); deco(m, 'barrel', 14, 23); deco(m, 'fireplace', 14, 26);
  // Windows glow in the front walls
  for (const [x, y] of [[7, 4], [13, 4], [38, 4], [43, 4], [22, 3], [29, 3], [6, 22], [13, 22]]) deco(m, 'window', x, y, { solid: false });
  // Plaza
  deco(m, 'stall', 21, 13, { w: 2 }); deco(m, 'crates', 24, 13); deco(m, 'bench', 19, 19); deco(m, 'bench', 33, 19); deco(m, 'well', 33, 14);
  for (const [x, y] of [[16, 11], [35, 11], [16, 23], [35, 23], [25, 15], [27, 15]]) deco(m, 'lamp', x, y);
  for (const [x, y] of [[18, 16], [34, 17], [20, 22], [31, 12], [17, 14]]) deco(m, 'flowers', x, y, { solid: false });
  for (const [x, y] of [[3, 17], [48, 17], [24, 28], [28, 28]]) deco(m, 'lamp', x, y);
}

function buildQuarry() {
  const m = mk('quarry', 'Whispering Quarry', 64, 40, T.SAND, 'main'), rng = new Rng(202);
  m.spawn = { x: 3, y: 20 };
  scatter(m, T.GRASS, 0.35, rng, () => true, T.SAND);
  for (let i = 0; i < 38; i++) blob(m, rng.int(6, 62), rng.int(2, 38), rng.int(1, 3), T.ROCK, rng);
  ring(m, T.ROCK);
  polyline(m, [[0, 20], [14, 20], [22, 14], [34, 18], [46, 12], [58, 8]], T.PATH, 3);
  polyline(m, [[22, 14], [24, 28], [38, 32], [50, 28]], T.PATH, 3);
  rect(m, 0, 18, 6, 5, T.PATH);
  portal(m, 0, 18, 1, 5, { map: 'town', x: 49.5, y: 18.5 }, '< To Lanternfall');
  // cold-forge nook in the NE corner
  carve(m, 58, 6, 2, T.PATH); rect(m, 54, 5, 3, 3, T.PATH);
  for (const [x, y] of [[56, 3], [57, 3], [58, 3], [59, 3], [60, 3], [56, 9], [57, 9], [58, 9], [59, 9], [60, 9], [61, 4], [61, 5], [61, 6], [61, 7], [61, 8]]) set(m, x, y, T.ROCK);
  pt(m, 'secret', 'coldforge', 58, 6, { name: 'Cold Forge', icon: '', secret: 'coldforge' });
  pt(m, 'secret', 'starfall', 59, 8, { name: 'Fallen Starmetal', icon: '', secret: 'starfall' });
  for (const [x, y] of place(m, rng, 9, { minX: 8, gap: 5, avoid: [[58, 6, 6]] })) pt(m, 'node', `ore${x}_${y}`, x, y, { node: 'ore' });
  for (const [x, y] of place(m, rng, 6, { minX: 8, gap: 5, avoid: [[58, 6, 6]] })) pt(m, 'node', `coal${x}_${y}`, x, y, { node: 'coal' });
  for (const [x, y] of place(m, rng, 12, { minX: 14, gap: 6, avoid: [[58, 6, 5]] })) m.mobSpawns.push({ x, y });
  chests(m, rng, 2, { minX: 16, gap: 14, avoid: [[58, 6, 5]] }, 'Old Chest');
  decoScatter(m, rng, 'cart', 3, {}, { minX: 8 }); decoScatter(m, rng, 'bones', 6, { solid: false }, { minX: 6 });
  return m;
}

function buildGloomwood() {
  const m = mk('gloomwood', 'Gloomwood', 64, 40, T.GRASS, 'main'), rng = new Rng(303);
  m.spawn = { x: 61, y: 20 };
  scatter(m, T.TREE, 0.3, rng);
  for (let i = 0; i < 6; i++) blob(m, rng.int(6, 58), rng.int(4, 36), rng.int(2, 3), T.WATER, rng);
  ring(m, T.TREE);
  polyline(m, [[63, 20], [50, 20], [42, 12], [30, 14], [20, 24], [10, 22], [4, 10]], T.PATH, 3);
  polyline(m, [[42, 12], [44, 30], [30, 34]], T.PATH, 3); polyline(m, [[20, 24], [26, 34]], T.PATH, 3);
  rect(m, 58, 18, 6, 5, T.PATH);
  for (const [x, y] of [[40, 8], [18, 12], [34, 30], [8, 28]]) carve(m, x, y, 3, T.GRASS);
  portal(m, 63, 18, 1, 5, { map: 'town', x: 2.5, y: 18.5 }, 'To Lanternfall >');
  for (const [x, y] of place(m, rng, 11, { maxX: 55, gap: 5 })) pt(m, 'node', `herb${x}_${y}`, x, y, { node: 'herb' });
  for (const [x, y] of place(m, rng, 4, { maxX: 55, gap: 8 })) pt(m, 'node', `hide${x}_${y}`, x, y, { node: 'hide' });
  for (const [x, y] of place(m, rng, 12, { maxX: 52, gap: 6 })) m.mobSpawns.push({ x, y });
  chests(m, rng, 2, { maxX: 52, gap: 14 }, 'Mossy Chest');
  decoScatter(m, rng, 'stump', 5, {}, { maxX: 55 }); decoScatter(m, rng, 'mushrooms', 8, { solid: false }, { maxX: 55 }); decoScatter(m, rng, 'grave', 3, {}, { maxX: 50 });
  return m;
}

function buildArchive() {
  const m = mk('archive', 'Drowned Archive', 56, 40, T.FLOOR, 'main'), rng = new Rng(404);
  m.spawn = { x: 28, y: 2 };
  ring(m, T.WALL);
  for (let i = 0; i < 9; i++) blob(m, rng.int(4, 52), rng.int(5, 36), rng.int(2, 4), T.WATER, rng);
  for (let row = 8; row < 34; row += 5) for (let x = 6; x < 50; x++) if (x % 9 !== 0 && x % 9 !== 1) set(m, x, row, T.SHELF);
  carve(m, 28, 2, 2, T.FLOOR); polyline(m, [[28, 1], [28, 38]], T.FLOOR, 3);
  for (let row = 5; row < 36; row += 5) { polyline(m, [[8, row], [48, row]], T.FLOOR, 1); }
  rect(m, 26, 19, 5, 5, T.RUG);
  rect(m, 23, 33, 11, 6, T.FLOOR); rect(m, 25, 35, 7, 3, T.RUG);
  rect(m, 26, 1, 5, 2, T.FLOOR);
  portal(m, 26, 0, 5, 1, { map: 'town', x: 26.5, y: 33.5 }, 'To Lanternfall');
  pt(m, 'secret', 'lectern', 28, 36, { name: 'Cracked Lectern', icon: '', hidden: 'archivist', secret: 'lectern' });
  pt(m, 'gate', 'gate', 28, 38, { name: 'The Sealed Gate', icon: '' });
  for (const [x, y] of place(m, rng, 9, { minY: 6, maxY: 31, gap: 4 })) pt(m, 'node', `shelf${x}_${y}`, x, y, { node: 'shelf' });
  for (const [x, y] of place(m, rng, 9, { minY: 8, maxY: 31, gap: 6, avoid: [[28, 21, 4]] })) m.mobSpawns.push({ x, y });
  m.bossSpawn = { x: 28, y: 21 };
  chests(m, rng, 2, { minY: 6, maxY: 32, gap: 14, avoid: [[28, 21, 5]] }, 'Sealed Chest');
  decoScatter(m, rng, 'table', 3, {}, { minY: 6, maxY: 32, avoid: [[28, 21, 5]] }); decoScatter(m, rng, 'pillar', 4, {}, { minY: 6, maxY: 32, avoid: [[28, 21, 5]] });
  return m;
}

function buildShadowReach() {
  const m = mk('hollow_reach', 'Shadow Reach', 64, 44, T.HOLLOW, 'hollow'), rng = new Rng(505);
  m.spawn = { x: 32, y: 40 };
  scatter(m, T.VOID, 0.2, rng, () => true, T.HOLLOW);
  for (let i = 0; i < 30; i++) blob(m, rng.int(4, 60), rng.int(4, 34), rng.int(1, 3), T.CRYSTAL, rng);
  for (let i = 0; i < 5; i++) blob(m, rng.int(6, 58), rng.int(6, 30), rng.int(2, 4), T.CHASM, rng);
  ring(m, T.CRYSTAL);
  polyline(m, [[32, 42], [32, 30], [18, 24], [30, 14], [44, 22], [32, 6], [32, 1]], T.PATH, 3);
  polyline(m, [[18, 24], [8, 12]], T.PATH, 3); polyline(m, [[44, 22], [56, 12]], T.PATH, 3);
  carve(m, 32, 40, 4, T.HOLLOW); rect(m, 29, 38, 7, 5, T.RUG);
  m.safe.push({ x: 27, y: 36, w: 11, h: 8 });
  portal(m, 29, 43, 7, 1, { map: 'archive', x: 28.5, y: 36.5 }, 'To The Sealed Gate');
  portal(m, 30, 0, 5, 1, { map: 'hollow_depths', x: 24.5, y: 33.5 }, 'To The Depths');
  pt(m, 'camp', 'camp', 31, 40, { name: 'Camp Fire', icon: '' });
  pt(m, 'bazaar', 'bazaar', 34, 40, { name: 'Shadow Bazaar', icon: '' });
  pt(m, 'npc', 'keeper', 33, 38, { name: 'The Ledger Keeper', icon: '', role: 'lore', lines: ['Everything here is a reflection. Prices too — mundane goods fetch a fortune; Shadow goods go cheap. A clever merchant would carry both ways.', 'Rest at the fire to wash off Dread. Stay too long outside and your Sanity frays. Dice-minded Archivists are the only ones the Shadowfell cannot nibble.'] });
  for (const [x, y] of place(m, rng, 9, { maxY: 33, gap: 5, avoid: [[32, 40, 6]] })) pt(m, 'node', `hore${x}_${y}`, x, y, { node: 'hollow_ore' });
  for (const [x, y] of place(m, rng, 9, { maxY: 33, gap: 5, avoid: [[32, 40, 6]] })) pt(m, 'node', `gb${x}_${y}`, x, y, { node: 'ghostbloom' });
  for (const [x, y] of place(m, rng, 14, { maxY: 33, gap: 5, avoid: [[32, 40, 7]] })) m.mobSpawns.push({ x, y });
  chests(m, rng, 2, { maxY: 33, gap: 14, avoid: [[32, 40, 8]] }, 'Shadow Chest');
  decoScatter(m, rng, 'obelisk', 4, {}, { maxY: 33, avoid: [[32, 40, 7]] }); decoScatter(m, rng, 'bones', 8, { solid: false }, { maxY: 33 });
  return m;
}

function buildShadowDepths() {
  const m = mk('hollow_depths', 'The Depths', 48, 36, T.HOLLOW, 'hollow'), rng = new Rng(606);
  m.spawn = { x: 24, y: 33 };
  scatter(m, T.VOID, 0.25, rng, () => true, T.HOLLOW);
  for (let i = 0; i < 16; i++) blob(m, rng.int(3, 45), rng.int(3, 28), rng.int(1, 3), T.CRYSTAL, rng);
  ring(m, T.CRYSTAL);
  polyline(m, [[24, 35], [24, 12]], T.PATH, 3); polyline(m, [[8, 26], [40, 26]], T.PATH, 3);
  carve(m, 24, 10, 5, T.RUG);
  portal(m, 22, 35, 5, 1, { map: 'hollow_reach', x: 32.5, y: 2.5 }, 'To Shadow Reach');
  for (const [x, y] of place(m, rng, 5, { minY: 14, maxY: 30, gap: 5 })) pt(m, 'node', `hore${x}_${y}`, x, y, { node: 'hollow_ore' });
  for (const [x, y] of place(m, rng, 5, { minY: 14, maxY: 30, gap: 5 })) pt(m, 'node', `gb${x}_${y}`, x, y, { node: 'ghostbloom' });
  for (const [x, y] of place(m, rng, 8, { minY: 14, maxY: 30, gap: 5, avoid: [[24, 33, 5]] })) m.mobSpawns.push({ x, y });
  m.bossSpawn = { x: 24, y: 10 };
  chests(m, rng, 1, { minY: 14, maxY: 30, gap: 10, avoid: [[24, 33, 5]] }, 'Shadow Chest');
  decoScatter(m, rng, 'obelisk', 3, {}, { minY: 14, maxY: 30, avoid: [[24, 12, 6]] });
  return m;
}


// ── Day / night: a full cycle every 8 minutes of server time ────────────────────────
export const CYCLE_MS = 8 * 60000;
export const dayPhase = (now) => ((now % CYCLE_MS) + CYCLE_MS) % CYCLE_MS / CYCLE_MS;        // 0 dawn · .25 noon · .5 dusk · .75 midnight
export const isNight = (now) => { const p = dayPhase(now); return p >= 0.5 && p < 0.95; };


// ═════════════════════════════════════════════════════════════════════════════════════════════════════
// PROCEDURAL OVERWORLD — large, deterministic biome zones (same on server and client).
// Terrain from value-noise, roads that wind between landmarks, bridges over water, villages, camps, ruins…
// ═════════════════════════════════════════════════════════════════════════════════════════════════════
const hh = (x, y, sd) => { let v = (x * 374761393 + y * 668265263 + sd * 2147483647) | 0; v = (v ^ (v >>> 13)) * 1274126177 | 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
function noiseField(w, h, seed, scale, oct = 3) {
  const out = new Float32Array(w * h); let amp = 1, tot = 0, sc = scale;
  for (let o = 0; o < oct; o++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = hh(ix, iy, seed + o), b = hh(ix + 1, iy, seed + o), c = hh(ix, iy + 1, seed + o), d = hh(ix + 1, iy + 1, seed + o), top = a + (b - a) * sx;
      out[y * w + x] += amp * (top + (c + (d - c) * sx - top) * sy);
    }
    tot += amp; amp *= 0.5; sc = Math.max(2, sc / 2);
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
const SOLIDISH = new Set([T.WALL, T.FLOOR, T.DOOR, T.COBBLE, T.RUG, T.SHELF]);
// A winding road: random control points, carved as PATH (BRIDGE across water). Never overwrites buildings.
function road(m, rng, a, b, wd = 3) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, pts = [[a.x, a.y]];
  const bends = Math.max(1, Math.floor(len / 22));
  for (let i = 1; i <= bends; i++) { const t = i / (bends + 1), off = rng.range(-1, 1) * Math.min(10, len * 0.18); pts.push([Math.round(clamp(a.x + dx * t + nx * off, 3, m.w - 4)), Math.round(clamp(a.y + dy * t + ny * off, 3, m.h - 4))]); }
  pts.push([b.x, b.y]);
  for (let k = 0; k < pts.length - 1; k++) {
    let [x, y] = pts[k]; const [x2, y2] = pts[k + 1];
    for (let guard = 0; guard < 2000 && (x !== x2 || y !== y2); guard++) {
      if (x !== x2 && (Math.abs(x2 - x) >= Math.abs(y2 - y) || y === y2)) x += Math.sign(x2 - x); else y += Math.sign(y2 - y);
      for (let j = 0; j < wd; j++) for (let i = 0; i < wd; i++) { const tx = x - 1 + i, ty = y - 1 + j, c = tileAt(m, tx, ty); if (inb(m, tx, ty) && !SOLIDISH.has(c)) set(m, tx, ty, c === T.WATER ? T.BRIDGE : T.PATH); }
    }
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── landmarks: each returns its approach node {x,y}, a walkable tile roads should reach ──────────────────
const LM = {
  village(m, rng, x, y, L) {
    const W = 30, H = 20, x0 = x - 15, y0 = y - 8;
    rect(m, x0 - 1, y0 - 3, W + 2, H + 4, T.GRASS); rect(m, x0 + 2, y0 + 7, W - 4, 8, T.COBBLE);
    polyline(m, [[x, y0 + 7], [x, y0 + 17]], T.PATH, 3);
    const hs = [box(m, x0 + 1, y0, 8, 6, x0 + 4), box(m, x0 + 11, y0, 9, 6, x0 + 15), box(m, x0 + 21, y0, 8, 6, x0 + 24)];
    for (const b of hs) { set(m, b.door.x, b.door.y + 1, T.PATH); rect(m, b.door.x - 1, b.door.y + 1, 3, 1, T.PATH); }
    for (const [dx, dy] of [[-8, 12], [8, 12]]) deco(m, 'lamp', x + dx, y0 + dy);
    deco(m, 'well', x - 2, y0 + 9, { w: 1, h: 1 }); deco(m, 'bench', x + 4, y0 + 9); deco(m, 'bench', x - 9, y0 + 9); deco(m, 'flowers', x + 7, y0 + 13, { solid: false }); deco(m, 'flowers', x - 7, y0 + 13, { solid: false });
    pt(m, 'waystone', 'waystone', x + 1, y0 + 12, { name: 'Waystone' });
    pt(m, 'npc', 'vendor', x - 5, y0 + 11, { name: L.vendor ?? 'Village Vendor', role: 'vendor', lines: ['Fair prices. Fairer than the city, some say.'] });
    pt(m, 'npc', 'inn', x + 6, y0 + 11, { name: L.inn ?? 'Innkeeper', role: 'tavern' });
    pt(m, 'npc', 'elder', x + 11, y0 + 11, { name: L.elder ?? 'Village Elder', role: 'lore', lines: L.lines ?? ['Travellers are always welcome. The roads are getting worse.'] });
    for (const b of hs) pt(m, 'chest', `hchest${b.x}`, b.x + 2, b.y + 2, { name: 'Cupboard' });
    m.safe.push({ x: x0 - 1, y: y0 - 3, w: W + 2, h: H + 4 });
    return { x, y: y0 + 11, village: { x: x0, y: y0, w: W, h: H } };
  },
  camp(m, rng, x, y, L) {
    blob(m, x, y, 6, T.SAND, rng); rect(m, x - 1, y - 1, 3, 3, T.PATH);
    deco(m, 'campfire', x, y, { solid: false }); deco(m, 'tent', x - 4, y - 3); deco(m, 'tent', x + 3, y - 3); deco(m, 'crates', x + 4, y + 2); deco(m, 'barrel', x - 4, y + 2); deco(m, 'bones', x + 1, y + 3, { solid: false });
    pt(m, 'chest', `campchest${x}`, x - 1, y + 4, { name: L.chest ?? 'Camp Chest' });
    for (const [dx, dy] of [[-3, 0], [3, 1], [0, -4], [0, 4]]) m.mobSpawns.push({ x: x + dx, y: y + dy });
    if (L.elite !== false) m.eliteSpawns.push({ x: x + 1, y: y - 1 });
    return { x, y: y + 2 };
  },
  ruin(m, rng, x, y, L) {
    const w = L.w ?? 15, h = L.h ?? 10, x0 = x - Math.floor(w / 2), y0 = y - Math.floor(h / 2);
    rect(m, x0, y0, w, h, T.WALL); rect(m, x0 + 1, y0 + 1, w - 2, h - 2, T.FLOOR);
    for (const [gx, gy] of [[x0 + Math.floor(w / 2), y0 + h - 1], [x0, y0 + 4], [x0 + w - 1, y0 + 5], [x0 + 4, y0], [x0 + w - 4, y0]]) { set(m, gx, gy, T.FLOOR); }
    for (let i = 0; i < 6; i++) set(m, x0 + 1 + rng.int(0, w - 3), y0 + (rng.chance(0.5) ? 0 : h - 1), T.FLOOR);   // crumbled sections
    rect(m, x0 + Math.floor(w / 2) - 1, y0 + h, 3, 2, T.PATH);
    deco(m, 'pillar', x0 + 3, y0 + 3); deco(m, 'pillar', x0 + w - 4, y0 + 3); deco(m, 'table', x0 + Math.floor(w / 2), y0 + 2); deco(m, 'bones', x0 + 2, y0 + h - 3, { solid: false });
    pt(m, 'chest', `ruinchest${x}a`, x0 + 2, y0 + 2, { name: L.chest ?? 'Ruin Chest' }); pt(m, 'chest', `ruinchest${x}b`, x0 + w - 3, y0 + h - 3, { name: L.chest ?? 'Ruin Chest' });
    for (const [dx, dy] of [[2, 3], [w - 3, 2], [Math.floor(w / 2), h - 3]]) m.mobSpawns.push({ x: x0 + dx, y: y0 + dy });
    if (L.elite !== false) m.eliteSpawns.push({ x: x0 + Math.floor(w / 2), y: y0 + Math.floor(h / 2) });
    return { x, y: y0 + h + 2 };
  },
  tower(m, rng, x, y, L) {
    const b = box(m, x - 4, y - 4, 9, 8, x); rect(m, x - 1, y + 4, 3, 2, T.PATH);
    pt(m, 'chest', `towerchest${x}`, x - 2, y - 2, { name: L.chest ?? 'Watchtower Chest' }); pt(m, 'sign', `towersign${x}`, x + 2, y - 2, { name: L.name ?? 'A Scrawled Note', lines: L.lines ?? ['Whoever finds this: do not trust the quiet. It is never quiet for long.'] });
    m.eliteSpawns.push({ x: x + 1, y }); m.mobSpawns.push({ x: x - 2, y: y + 1 });
    return { x, y: y + 5 };
  },
  shrine(m, rng, x, y, L) {
    blob(m, x, y, 5, T.PATH, rng); for (const [dx, dy] of [[-3, -2], [3, -2], [-3, 2], [3, 2], [0, -4], [0, 4]]) { set(m, x + dx, y + dy, T.ROCK); }
    pt(m, 'sign', `shrine${x}_${y}`, x, y, { name: L.name ?? 'Weathered Shrine', lines: L.lines ?? ['A weathered shrine. Offerings of coin and wheat lie at its feet, fresher than they should be.'] });
    pt(m, 'chest', `shrinechest${x}`, x + 2, y + 1, { name: 'Offering Box' });
    return { x, y: y + 3 };
  },
  lair(m, rng, x, y, L) {
    blob(m, x, y, 8, T.PATH, rng); for (let a = 0; a < 14; a++) { const t = (a / 14) * Math.PI * 2; set(m, Math.round(x + Math.cos(t) * 9), Math.round(y + Math.sin(t) * 9), T.ROCK); }
    set(m, x, y + 9, T.PATH); set(m, x + 1, y + 9, T.PATH);
    pt(m, 'chest', `lairchest${x}`, x, y - 6, { name: L.chest ?? 'Hoard' });
    m.bossSpawn = { x, y }; for (const [dx, dy] of [[-5, 3], [5, 3], [0, 6]]) m.mobSpawns.push({ x: x + dx, y: y + dy });
    return { x, y: y + 8 };
  },
  oasis(m, rng, x, y, L) {
    blob(m, x, y, 8, T.SAND, rng); blob(m, x, y, 5, T.WATER, rng); for (const [dx, dy] of [[-7, -2], [7, 3], [-2, 7], [4, -7]]) set(m, x + dx, y + dy, T.TREE);
    pt(m, 'waystone', 'waystone', x - 9, y + 2, { name: 'Waystone' });
    return { x: x - 9, y: y + 4 };
  },
  pier(m, rng, x, y, L) {
    rect(m, x, y, 3, 14, T.BRIDGE); rect(m, x - 4, y + 10, 11, 3, T.BRIDGE); deco(m, 'boat', x + 5, y + 11, { w: 1, h: 1 }); deco(m, 'barrel', x - 3, y + 11); deco(m, 'crates', x + 2, y + 6, {});
    pt(m, 'chest', `pierchest${x}`, x - 3, y + 12, { name: 'Smuggler\'s Crate' });
    return { x: x + 1, y: y - 1 };
  },
  dungeon(m, rng, x, y, L) {                                   // a cave mouth that leads down into a dungeon
    blob(m, x, y, 5, T.PATH, rng); for (let i = -3; i <= 3; i++) { set(m, x + i, y - 3, T.ROCK); } for (const [dx, dy] of [[-4, -2], [4, -2], [-4, -1], [4, -1], [-3, -3], [3, -3]]) set(m, x + dx, y + dy, T.ROCK);
    rect(m, x - 2, y - 2, 5, 2, T.ROCK); rect(m, x - 1, y - 2, 3, 2, T.PATH);
    portal(m, x - 1, y - 2, 3, 1, { map: L.to, x: 0, y: 0 }, L.label, { toKey: 'spawn' });
    pt(m, 'sign', `dungeonsign${x}`, x + 3, y + 1, { name: L.signName ?? 'Warning Sign', lines: L.lines ?? ['DANGER. Turn back. (Someone has added: "Or bring friends. The loot is good.")'] });
    return { x, y: y + 2 };
  },
  pyramid(m, rng, x, y, L) {
    const w = 21, h = 15, x0 = x - 10, y0 = y - 7;
    rect(m, x0, y0, w, h, T.WALL); rect(m, x0 + 1, y0 + 1, w - 2, h - 2, T.FLOOR); rect(m, x0 + 7, y0 + 5, 7, 5, T.RUG);
    set(m, x, y0 + h - 1, T.FLOOR); rect(m, x - 1, y0 + h, 3, 2, T.PATH); for (const [dx, dy] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) deco(m, 'pillar', x0 + dx, y0 + dy);
    deco(m, 'coffin', x - 1, y0 + 6); pt(m, 'chest', `pyr${x}a`, x0 + 2, y0 + 7, { name: 'Sealed Sarcophagus' }); pt(m, 'chest', `pyr${x}b`, x0 + w - 3, y0 + 7, { name: 'Sealed Sarcophagus' });
    m.bossSpawn = { x, y }; for (const [dx, dy] of [[4, 3], [w - 5, 3], [4, h - 4], [w - 5, h - 4]]) m.mobSpawns.push({ x: x0 + dx, y: y0 + dy });
    return { x, y: y0 + h + 2 };
  },
  citadel(m, rng, x, y, L) {                                   // courtyard + keep with a lord inside
    const w = 28, h = 20, x0 = x - 14, y0 = y - 10;
    rect(m, x0, y0, w, h, T.WALL); rect(m, x0 + 1, y0 + 1, w - 2, h - 2, T.COBBLE); rect(m, x0 + 9, y0 + 1, 10, 8, T.WALL); rect(m, x0 + 10, y0 + 2, 8, 6, T.FLOOR); rect(m, x0 + 12, y0 + 3, 4, 3, T.RUG);
    set(m, x0 + 13, y0 + 8, T.FLOOR); set(m, x0 + 14, y0 + 8, T.FLOOR); rect(m, x0 + 13, y0 + h - 1, 2, 1, T.FLOOR); rect(m, x0 + 12, y0 + h, 4, 2, T.PATH);
    for (const [dx, dy] of [[4, 4], [4, 14], [23, 4], [23, 14], [8, 10], [19, 10]]) deco(m, 'pillar', x0 + dx, y0 + dy);
    deco(m, 'banner', x0 + 11, y0 + 2, { solid: false }); deco(m, 'banner', x0 + 16, y0 + 2, { solid: false });
    pt(m, 'chest', `cit${x}a`, x0 + 11, y0 + 6, { name: 'Lord\'s Chest' }); pt(m, 'chest', `cit${x}b`, x0 + 5, y0 + 17, { name: 'Armoury' });
    m.bossSpawn = { x: x0 + 14, y: y0 + 5 }; for (const [dx, dy] of [[5, 9], [22, 9], [8, 15], [20, 15], [14, 12]]) m.mobSpawns.push({ x: x0 + dx, y: y0 + dy });
    return { x, y: y0 + h + 2 };
  },
};

// Spec → outdoor zone.
function genOutdoor(S) {
  const { id, name, w, h, theme, seed } = S, m = mk(id, name, w, h, S.ground, theme), rng = new Rng(seed);
  m.eliteSpawns = [];
  const f1 = noiseField(w, h, seed + 1, S.fs ?? 18), f2 = noiseField(w, h, seed + 7, S.ws ?? 24), f3 = noiseField(w, h, seed + 13, 10);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let t = S.ground;
    if (S.patch && f3[i] > S.patch[0]) t = S.patch[1];
    if (S.rocks != null && f3[i] > S.rocks) t = T.ROCK;
    if (S.trees != null && f1[i] > S.trees && !(S.rocks != null && f3[i] > S.rocks)) t = rng.chance(S.thin ?? 0.12) ? S.ground : T.TREE;
    if (S.water != null && f2[i] > S.water) t = T.WATER;
    m.tiles[i] = t;
  }
  for (let k = 0; k < 3; k++) for (let i = 0; i < w; i++) { set(m, i, k, S.edge ?? T.TREE); set(m, i, h - 1 - k, S.edge ?? T.TREE); } for (let k = 0; k < 3; k++) for (let j = 0; j < h; j++) { set(m, k, j, S.edge ?? T.TREE); set(m, w - 1 - k, j, S.edge ?? T.TREE); }
  const nodes = [];
  const at = (f, n) => Math.round(f * (n - 1));
  for (const p of S.portals) {                                         // edge exits
    const along = p.at ?? 0.5; let rx, ry, rw, rh, ax, ay;
    if (p.side === 's') { rx = at(along, w) - 2; ry = h - 1; rw = 5; rh = 1; ax = rx + 2; ay = h - 6; } else if (p.side === 'n') { rx = at(along, w) - 2; ry = 0; rw = 5; rh = 1; ax = rx + 2; ay = 5; }
    else if (p.side === 'w') { rx = 0; ry = at(along, h) - 2; rw = 1; rh = 5; ax = 5; ay = ry + 2; } else { rx = w - 1; ry = at(along, h) - 2; rw = 1; rh = 5; ax = w - 6; ay = ry + 2; }
    rect(m, Math.min(rx, ax) - (rw > 1 ? 0 : 0), Math.min(ry, ay), Math.abs(ax - rx) + rw, Math.abs(ay - ry) + rh, T.PATH); rect(m, ax - 3, ay - 3, 7, 7, S.clear ?? T.PATH);
    portal(m, rx, ry, rw, rh, p.to, p.label); nodes.push({ x: ax, y: ay, hub: true });
  }
  m.spawn = { x: nodes[0].x + 0.5, y: nodes[0].y + 0.5 };
  for (const L of S.landmarks) {
    const x = clamp(Math.round(L.at[0] * w), 12, w - 13), y = clamp(Math.round(L.at[1] * h), 10, h - 14), n = LM[L.t](m, rng, x, y, L); if (n) nodes.push(n);
  }
  // Prim: connect every node to the nearest already-connected one, so everything is reachable.
  const conn = [nodes[0]], rest = nodes.slice(1);
  while (rest.length) {
    let bi = 0, bj = 0, bd = 1e9;
    rest.forEach((r, i) => conn.forEach((c, j) => { const d = Math.hypot(r.x - c.x, r.y - c.y); if (d < bd) { bd = d; bi = i; bj = j; } }));
    road(m, rng, conn[bj], rest[bi], 3); conn.push(rest.splice(bi, 1)[0]);
  }
  // after roads: put the village/safe-zone and landmark interiors back in order (roads never overwrite them)
  m.spawn = { x: nodes[0].x + 0.5, y: nodes[0].y + 0.5 };
  const vill = nodes.find((n) => n.village)?.village;
  const keep = [[m.spawn.x, m.spawn.y, 6]]; if (vill) keep.push([vill.x + 15, vill.y + 8, 22]);
  const resNodes = S.nodes ?? {};
  for (const [type, n] of Object.entries(resNodes)) for (const [x, y] of place(m, rng, n, { gap: 6, avoid: keep })) pt(m, 'node', `${type}${x}_${y}`, x, y, { node: type });
  const mobAvoid = [...keep, ...(vill ? [[vill.x + 15, vill.y + 8, 24]] : [])];
  m.mobSpawns = m.mobSpawns.filter((s) => !(vill && s.x > vill.x - 3 && s.x < vill.x + 33 && s.y > vill.y - 5 && s.y < vill.y + 22));
  for (const [x, y] of place(m, rng, S.mobs ?? 30, { gap: 6, avoid: mobAvoid })) m.mobSpawns.push({ x, y });
  chests(m, rng, S.chests ?? 6, { gap: 16, avoid: mobAvoid }, S.chestName ?? 'Chest');
  for (const [kind, n, opts] of S.deco ?? []) decoScatter(m, rng, kind, n, opts ?? {}, { gap: 3, avoid: mobAvoid });
  for (const [x, y] of place(m, rng, S.waystones ?? 0, { gap: 30, avoid: mobAvoid })) pt(m, 'waystone', `waystone${x}`, x, y, { name: 'Waystone' });
  return m;
}

// Spec → cave / dungeon zone (cellular automata).
function genCave(S) {
  const { id, name, w, h, theme, seed } = S, m = mk(id, name, w, h, T.ROCK, theme), rng = new Rng(seed);
  m.eliteSpawns = [];
  let cells = new Uint8Array(w * h); for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) cells[y * w + x] = rng.chance(S.fill ?? 0.5) ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const n = new Uint8Array(w * h);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) { let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += cells[(y + dy) * w + x + dx]; n[y * w + x] = c >= 5 ? 1 : 0; }
    cells = n;
  }
  // keep the biggest cave
  const lab = new Int32Array(w * h).fill(-1), sizes = []; let id2 = 0;
  for (let i = 0; i < w * h; i++) if (cells[i] && lab[i] < 0) { let n = 0; const st = [i]; lab[i] = id2; while (st.length) { const c = st.pop(); n++; const x = c % w, y = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && cells[ny * w + nx] && lab[ny * w + nx] < 0) { lab[ny * w + nx] = id2; st.push(ny * w + nx); } } } sizes.push(n); id2++; }
  const main = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) m.tiles[i] = lab[i] === main ? S.ground : T.ROCK;
  const f2 = noiseField(w, h, seed + 5, 12);
  for (let i = 0; i < w * h; i++) if (m.tiles[i] === S.ground && f2[i] > (S.pool ?? 0.7)) m.tiles[i] = T.WATER;
  for (let i = 0; i < w * h; i++) if (m.tiles[i] === T.ROCK && rng.chance(S.crystal ?? 0.03)) m.tiles[i] = T.CRYSTAL;
  const nodes = [];
  for (const p of S.portals) {
    const tx = p.side === 'w' ? 5 : p.side === 'e' ? w - 6 : Math.round((p.at ?? 0.5) * (w - 1)), ty = p.side === 'n' ? 5 : p.side === 's' ? h - 6 : Math.round((p.at ?? 0.5) * (h - 1));
    // tunnel from the edge toward the nearest cave floor
    const okTile = nodes.length ? reach(m, Math.floor(nodes[0].x), Math.floor(nodes[0].y)) : null;
    let best = null, bd = 1e9; for (let i = 0; i < w * h; i++) if (lab[i] === main && m.tiles[i] === S.ground && (!okTile || okTile[i])) { const x = i % w, y = (i / w) | 0, d = Math.abs(x - tx) + Math.abs(y - ty); if (d < bd) { bd = d; best = { x, y }; } }
    rect(m, tx - 2, ty - 2, 5, 5, S.ground); road(m, rng, { x: tx, y: ty }, best, 3); for (const [dx, dy] of [[0, 0]]) set(m, tx, ty, S.ground);
    const rx = p.side === 'w' ? 0 : p.side === 'e' ? w - 1 : tx - 2, ry = p.side === 'n' ? 0 : p.side === 's' ? h - 1 : ty - 2, rw = p.side === 'w' || p.side === 'e' ? 1 : 5, rh = p.side === 'w' || p.side === 'e' ? 5 : 1;
    rect(m, Math.min(rx, tx - 2), Math.min(ry, ty - 2), Math.abs(rx - (tx - 2)) + 5, Math.abs(ry - (ty - 2)) + 5, S.ground); portal(m, rx, ry, rw, rh, p.to, p.label); nodes.push({ x: tx, y: ty });
  }
  m.spawn = { x: nodes[0].x + 0.5, y: nodes[0].y + 0.5 };
  const keep = [[m.spawn.x, m.spawn.y, 7]];
  for (const [type, n] of Object.entries(S.nodes ?? {})) for (const [x, y] of place(m, rng, n, { gap: 5, avoid: keep })) pt(m, 'node', `${type}${x}_${y}`, x, y, { node: type });
  for (const [x, y] of place(m, rng, S.mobs ?? 36, { gap: 5, avoid: keep })) m.mobSpawns.push({ x, y });
  for (const [x, y] of place(m, rng, S.elites ?? 4, { gap: 22, avoid: keep })) m.eliteSpawns.push({ x, y });
  const far = place(m, rng, 1, { gap: 2, avoid: [[nodes[0].x, nodes[0].y, Math.round(Math.min(w, h) * 0.45)]] })[0]; if (far) { m.bossSpawn = { x: far[0], y: far[1] }; blob(m, far[0], far[1], 3, S.ground, rng); }
  chests(m, rng, S.chests ?? 6, { gap: 14, avoid: keep }, S.chestName ?? 'Chest');
  for (const [kind, n, opts] of S.deco ?? []) decoScatter(m, rng, kind, n, opts ?? {}, { gap: 3, avoid: keep });
  for (const [x, y] of place(m, rng, S.waystones ?? 1, { gap: 30, avoid: [[far?.[0] ?? 0, far?.[1] ?? 0, 18]] })) pt(m, 'waystone', `waystone${x}`, x, y, { name: 'Waystone' });
  return m;
}


// ── DUNGEONS: rooms joined by corridors, dark, with a stairwell down and (on the last floor) a boss ──────────────
function genDungeon(S) {
  const { id, name, w, h, theme, seed } = S, m = mk(id, name, w, h, T.WALL, theme), rng = new Rng(seed); m.dark = true; m.dungeon = true; m.eliteSpawns = [];
  const rooms = [];
  for (let tries = 0; tries < 400 && rooms.length < (S.rooms ?? 9); tries++) {
    const rw = rng.int(8, 14), rh = rng.int(7, 11), rx = rng.int(3, w - rw - 4), ry = rng.int(3, h - rh - 4);
    if (rooms.some((r) => rx < r.x + r.w + 3 && rx + rw + 3 > r.x && ry < r.y + r.h + 3 && ry + rh + 3 > r.y)) continue;
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
  }
  rooms.sort((a, b) => a.cx - b.cx);
  for (const r of rooms) { rect(m, r.x, r.y, r.w, r.h, T.FLOOR); }
  const corridor = (a, b) => { rect(m, Math.min(a.cx, b.cx), a.cy, Math.abs(a.cx - b.cx) + 2, 2, T.FLOOR); rect(m, b.cx, Math.min(a.cy, b.cy), 2, Math.abs(a.cy - b.cy) + 2, T.FLOOR); };
  for (let i = 0; i < rooms.length - 1; i++) corridor(rooms[i], rooms[i + 1]);
  for (let i = 0; i < 3; i++) { const a = rooms[rng.int(0, rooms.length - 1)], b = rooms[rng.int(0, rooms.length - 1)]; if (a !== b) corridor(a, b); }
  const entry = rooms[0], far = rooms.slice(1).sort((a, b) => Math.hypot(b.cx - entry.cx, b.cy - entry.cy) - Math.hypot(a.cx - entry.cx, a.cy - entry.cy))[0];
  m.spawn = { x: entry.cx + 0.5, y: entry.cy + 1.5 };
  const upTo = S.up.to;
  portal(m, entry.cx - 1, entry.y, 3, 1, upTo, S.up.label, S.up.toKey ? { toKey: S.up.toKey } : {});
  if (S.down) { portal(m, far.cx - 1, far.y, 3, 1, S.down.to, S.down.label, { toKey: 'spawn' }); m.stairs = { x: far.cx + 0.5, y: far.y + 1.8 }; }
  if (S.exitKey) m.exit = { x: entry.cx + 0.5, y: entry.y + 1.8 };
  pt(m, 'waystone', 'waystone', entry.x + 2, entry.y + 2, { name: 'Waystone' });
  for (const r of rooms) { deco(m, 'lamp', r.x + 1, r.y + 1); deco(m, 'lamp', r.x + r.w - 2, r.y + 1); if (r.w > 10) { deco(m, 'pillar', r.x + 2, r.y + r.h - 3); deco(m, 'pillar', r.x + r.w - 3, r.y + r.h - 3); } }
  const avoid = [[entry.cx, entry.cy, 6], [far.cx, far.y + 2, 3]];
  for (const [kind, n, o] of S.deco ?? []) decoScatter(m, rng, kind, n, o ?? {}, { gap: 3, avoid });
  for (const r of rooms) if (r !== entry) for (let k = 0; k < rng.int(2, 4); k++) { const x = rng.int(r.x + 2, r.x + r.w - 3), y = rng.int(r.y + 2, r.y + r.h - 3); if (!isBlockedTile(m, x, y) && !m.points.some((q) => Math.abs(q.x - x) + Math.abs(q.y - y) < 2)) m.mobSpawns.push({ x, y }); }
  if (S.boss) { const bx = far.cx, by = far.cy; m.bossSpawn = { x: bx, y: by }; m.mobSpawns = m.mobSpawns.filter((q) => !(q.x > far.x - 1 && q.x < far.x + far.w + 1 && q.y > far.y - 1 && q.y < far.y + far.h + 1 && Math.hypot(q.x - bx, q.y - by) < 3)); pt(m, 'chest', 'bosschest', far.x + 1, far.y + far.h - 2, { name: S.bossChest ?? 'Boss Hoard' }); pt(m, 'chest', 'bosschest2', far.x + far.w - 2, far.y + far.h - 2, { name: S.bossChest ?? 'Boss Hoard' }); }
  const mids = rooms.filter((r) => r !== entry && r !== far); for (let i = 0; i < (S.elites ?? 2) && mids.length; i++) { const r = mids.splice(rng.int(0, mids.length - 1), 1)[0]; m.eliteSpawns.push({ x: r.cx, y: r.cy }); }
  chests(m, rng, S.chests ?? 4, { gap: 10, avoid }, S.chestName ?? 'Dungeon Chest');
  return m;
}
const DUN = {};
const dungeon = (key, name, theme, seed, lvlNote, extra) => { DUN[key] = { kind: 'dun', id: key, name, w: 84, h: 60, theme, seed, ...extra }; };
// entrances live in the overworld as 'dungeon' landmarks; each dungeon has 2 floors
dungeon('goblin_warrens_1', 'Goblin Warrens — Upper', 'swamp', 3101, 0, { rooms: 9, elites: 2, deco: [['barrel', 8], ['crates', 8], ['bones', 12, { solid: false }]], chestName: 'Goblin Stash', up: { label: 'Out to Greenmeadow', to: { map: 'greenmeadow', x: 0, y: 0 } }, exitKey: 1, down: { label: 'Down into the Warrens', to: { map: 'goblin_warrens_2' } } });
dungeon('goblin_warrens_2', 'Goblin Warrens — Throne', 'swamp', 3102, 0, { rooms: 8, elites: 2, boss: true, bossChest: 'Goblin King\'s Hoard', deco: [['barrel', 6], ['bones', 10, { solid: false }]], up: { label: 'Up the stairs', to: { map: 'goblin_warrens_1' }, toKey: 'stairs' } });
dungeon('sunken_crypt_1', 'Sunken Crypt — Nave', 'cave', 3201, 0, { rooms: 10, elites: 2, deco: [['coffin', 6], ['bones', 12, { solid: false }], ['pillar', 6]], chestName: 'Burial Chest', up: { label: 'Out to Mistfen', to: { map: 'mistfen', x: 0, y: 0 } }, down: { label: 'Down to the Ossuary', to: { map: 'sunken_crypt_2' } } });
dungeon('sunken_crypt_2', 'Sunken Crypt — Ossuary', 'cave', 3202, 0, { rooms: 9, elites: 2, boss: true, bossChest: 'Crypt Lord\'s Tomb', deco: [['coffin', 8], ['bones', 14, { solid: false }]], up: { label: 'Up the stairs', to: { map: 'sunken_crypt_1' }, toKey: 'stairs' } });
dungeon('frozen_catacombs_1', 'Frozen Catacombs — Halls', 'snow', 3301, 0, { rooms: 10, elites: 2, deco: [['coffin', 5], ['bones', 10, { solid: false }], ['pillar', 8]], chestName: 'Frostbitten Chest', up: { label: 'Out to Frostpeak', to: { map: 'frostpeak', x: 0, y: 0 } }, down: { label: 'Down to the Ice Throne', to: { map: 'frozen_catacombs_2' } } });
dungeon('frozen_catacombs_2', 'Frozen Catacombs — Ice Throne', 'snow', 3302, 0, { rooms: 9, elites: 3, boss: true, bossChest: 'Lich King\'s Phylactery', deco: [['coffin', 6], ['pillar', 8]], up: { label: 'Up the stairs', to: { map: 'frozen_catacombs_1' }, toKey: 'stairs' } });
dungeon('magma_depths_1', 'Magma Depths — Forges', 'volcano', 3401, 0, { rooms: 10, elites: 3, deco: [['crates', 8], ['bones', 10, { solid: false }], ['pillar', 6]], chestName: 'Slag Chest', up: { label: 'Out to the Emberwaste', to: { map: 'emberwaste', x: 0, y: 0 } }, down: { label: 'Down to the Furnace', to: { map: 'magma_depths_2' } } });
dungeon('magma_depths_2', 'Magma Depths — Furnace', 'volcano', 3402, 0, { rooms: 9, elites: 3, boss: true, bossChest: 'Infernal Cache', deco: [['pillar', 8], ['bones', 8, { solid: false }]], up: { label: 'Up the stairs', to: { map: 'magma_depths_1' }, toKey: 'stairs' } });

// ── The wider world: zone specs and how they connect ───────────────────────────────────────────────────
const Z = {
  greenmeadow: { kind: 'out', id: 'greenmeadow', name: 'Greenmeadow', w: 144, h: 104, theme: 'main', seed: 1101, ground: T.GRASS, trees: 0.6, thin: 0.3, water: 0.7, rocks: 0.78, fs: 16, portals: [],
    landmarks: [{ t: 'village', at: [0.5, 0.78], vendor: 'Hob the Peddler', inn: 'Wren the Innkeeper', elder: 'Elder Maren', lines: ['Hollowbrook has stood since before the Quarry opened. Bandits have been bold lately. The camps to the north-west and north-east are the worst.', 'Boar King\'s lair is up north, in the oak ring. Bring friends, or bring a lot of potions.'] },
      { t: 'dungeon', at: [0.12, 0.55], to: 'goblin_warrens_1', label: 'Goblin Warrens (Lv 3-6)', signName: 'Goblin Warrens', lines: ['THE WARRENS. Goblins, spiders, and a king who stole a throne from a better race. (Lv 3-6)'] },
      { t: 'camp', at: [0.22, 0.3], chest: 'Bandit Stash' }, { t: 'camp', at: [0.78, 0.28] }, { t: 'ruin', at: [0.64, 0.55], chest: 'Watchtower Ruin' }, { t: 'tower', at: [0.3, 0.6] }, { t: 'tower', at: [0.86, 0.62], name: 'Old Beacon', lines: ['The beacon has not been lit in years. Someone has scratched: "THE LEFT HAND KNOWS WHAT THE RIGHT HAND OWES."'] },
      { t: 'shrine', at: [0.84, 0.82] }, { t: 'shrine', at: [0.12, 0.84], name: 'Moss-Covered Stone', lines: ['A stone older than the town. Faint carvings suggest the Shadowfell was once reached from this side of the world.'] }, { t: 'lair', at: [0.5, 0.14] }],
    nodes: { herb: 16, hide: 10, ore: 8, coal: 6 }, mobs: 44, chests: 8, deco: [['flowers', 60, { solid: false }], ['stump', 14], ['haystack', 8], ['mushrooms', 12, { solid: false }]], waystones: 1 },
  saltmere: { kind: 'out', id: 'saltmere', name: 'Saltmere Coast', w: 112, h: 88, theme: 'main', seed: 1202, ground: T.SAND, patch: [0.62, T.GRASS], trees: 0.66, thin: 0.3, water: 0.64, rocks: 0.76, fs: 14, ws: 30, edge: T.WATER, portals: [],
    landmarks: [{ t: 'village', at: [0.55, 0.45], vendor: 'Brine the Chandler', inn: 'Old Pearl', elder: 'Harbourmaster Quill', lines: ['Saltmere Harbor takes in what the sea gives and gives back what it can spare. Drowned sailors have been walking the shore. Do not ask where they were sailing.', 'Smugglers hold the western cove. Captain does not like visitors.'] },
      { t: 'pier', at: [0.2, 0.55] }, { t: 'ruin', at: [0.28, 0.2], chest: 'Shipwreck Hold' }, { t: 'camp', at: [0.8, 0.8], chest: 'Smuggler Cache' }, { t: 'tower', at: [0.82, 0.22], name: 'Lighthouse Log', lines: ['The lamp went out on the night the fog came in. It has been dark since. Something sings from the water.'] }, { t: 'shrine', at: [0.35, 0.82] }, { t: 'lair', at: [0.12, 0.2] }],
    nodes: { herb: 10, hide: 6, ore: 6 }, mobs: 34, chests: 7, deco: [['barrel', 10], ['crates', 8], ['bones', 14, { solid: false }], ['boat', 3]], waystones: 1 },
  mistfen: { kind: 'out', id: 'mistfen', name: 'Mistfen Marsh', w: 128, h: 96, theme: 'swamp', seed: 1303, ground: T.GRASS, trees: 0.62, thin: 0.35, water: 0.6, rocks: 0.82, fs: 12, ws: 12, portals: [],
    landmarks: [{ t: 'dungeon', at: [0.88, 0.5], to: 'sunken_crypt_1', label: 'Sunken Crypt (Lv 8-12)', signName: 'Sunken Crypt', lines: ['THE SUNKEN CRYPT. The dead here are not at rest and have not been for a long time. (Lv 8-12)'] },
    { t: 'camp', at: [0.3, 0.3], chest: 'Hunter\'s Stash' }, { t: 'camp', at: [0.7, 0.7] }, { t: 'ruin', at: [0.5, 0.45], chest: 'Sunken Chapel' }, { t: 'tower', at: [0.2, 0.72], name: 'Hermit\'s Note', lines: ['The mist lies. Follow the croaking. It lies less.'] }, { t: 'shrine', at: [0.78, 0.25], name: 'Bog Idol', lines: ['A crude idol of reeds, wearing a necklace of teeth. Somebody refreshes the teeth.'] }, { t: 'lair', at: [0.2, 0.2] }],
    nodes: { herb: 24, hide: 10, ghostbloom: 4 }, mobs: 42, chests: 7, deco: [['stump', 12], ['mushrooms', 24, { solid: false }], ['bones', 12, { solid: false }]], waystones: 1 },
  sunscorch: { kind: 'out', id: 'sunscorch', name: 'Sunscorch Dunes', w: 144, h: 104, theme: 'desert', seed: 1404, ground: T.GRASS, patch: [0.6, T.SAND], trees: 0.72, thin: 0.7, water: 0.78, rocks: 0.74, fs: 18, portals: [], edge: T.ROCK,
    landmarks: [{ t: 'oasis', at: [0.5, 0.35] }, { t: 'pyramid', at: [0.72, 0.62] }, { t: 'camp', at: [0.25, 0.25], chest: 'Caravan Wreck' }, { t: 'camp', at: [0.2, 0.75] }, { t: 'ruin', at: [0.42, 0.78], chest: 'Buried Temple' }, { t: 'tower', at: [0.85, 0.2], name: 'Sun Dial', lines: ['The shadow points to a door that is not there. At the right hour, it is.'] }, { t: 'shrine', at: [0.12, 0.5] }, { t: 'lair', at: [0.58, 0.9] }],
    nodes: { sunsteel: 14, herb: 5, ore: 6, coal: 4 }, mobs: 50, chests: 8, deco: [['bones', 20, { solid: false }], ['rock', 0]], waystones: 1 },
  frostpeak: { kind: 'out', id: 'frostpeak', name: 'Frostpeak Highlands', w: 144, h: 104, theme: 'snow', seed: 1505, ground: T.GRASS, trees: 0.6, thin: 0.3, water: 0.78, rocks: 0.7, fs: 16, portals: [], edge: T.ROCK,
    landmarks: [{ t: 'village', at: [0.45, 0.8], vendor: 'Ulf the Trader', inn: 'Frida the Innkeeper', elder: 'Warden Skade', lines: ['Highfrost Hold lives on stubbornness and soup. The giant in the north comes down every winter. We are overdue.', 'There are tunnels under the mountain that join the old mines. Few come back through them in the right order.'] },
      { t: 'dungeon', at: [0.88, 0.2], to: 'frozen_catacombs_1', label: 'Frozen Catacombs (Lv 13-17)', signName: 'Frozen Catacombs', lines: ['THE FROZEN CATACOMBS. A king who refused to die and a court that refused to leave. (Lv 13-17)'] },
      { t: 'camp', at: [0.2, 0.4], chest: 'Frozen Camp' }, { t: 'camp', at: [0.78, 0.4] }, { t: 'ruin', at: [0.6, 0.6], chest: 'Frost Temple' }, { t: 'tower', at: [0.3, 0.68], name: 'Watch Cairn', lines: ['Names of those who went north, cut into the stone. The newest is only a week old.'] }, { t: 'shrine', at: [0.85, 0.75] }, { t: 'lair', at: [0.5, 0.12] }],
    nodes: { frostbloom: 16, ore: 8, hide: 8, coal: 6 }, mobs: 52, chests: 8, deco: [['bones', 14, { solid: false }], ['stump', 8]], waystones: 1 },
  emberwaste: { kind: 'out', id: 'emberwaste', name: 'The Emberwaste', w: 144, h: 104, theme: 'volcano', seed: 1606, ground: T.GRASS, patch: [0.62, T.SAND], trees: 0.74, thin: 0.6, water: 0.7, rocks: 0.72, fs: 16, ws: 14, portals: [], edge: T.ROCK,
    landmarks: [{ t: 'dungeon', at: [0.2, 0.55], to: 'magma_depths_1', label: 'Magma Depths (Lv 17-21)', signName: 'Magma Depths', lines: ['THE MAGMA DEPTHS. The old forges run on something that is still burning. (Lv 17-21)'] },
      { t: 'camp', at: [0.3, 0.7], chest: 'Scorched Camp' }, { t: 'ruin', at: [0.5, 0.45], chest: 'Fallen Forge' }, { t: 'ruin', at: [0.75, 0.7], chest: 'Cinderhold Gatehouse' }, { t: 'tower', at: [0.2, 0.3], name: 'Slag Tablet', lines: ['The forge below is not dead. It is waiting for someone with a hammer large enough.'] }, { t: 'shrine', at: [0.82, 0.25] }, { t: 'lair', at: [0.5, 0.12] }],
    nodes: { sunsteel: 14, coal: 14, ore: 10 }, mobs: 52, chests: 8, deco: [['bones', 12, { solid: false }]], waystones: 1 },
  ruined_citadel: { kind: 'out', id: 'ruined_citadel', name: 'The Ruined Citadel', w: 128, h: 96, theme: 'main', seed: 1707, ground: T.SAND, patch: [0.55, T.COBBLE], trees: 0.78, thin: 0.5, water: 0.8, rocks: 0.66, fs: 14, portals: [], edge: T.ROCK, clear: T.COBBLE,
    landmarks: [{ t: 'citadel', at: [0.5, 0.3] }, { t: 'ruin', at: [0.22, 0.6], chest: 'Collapsed Chapel' }, { t: 'ruin', at: [0.78, 0.6], chest: 'Collapsed Barracks' }, { t: 'camp', at: [0.2, 0.25], chest: 'Knight\'s Last Stand' }, { t: 'camp', at: [0.8, 0.25] }, { t: 'tower', at: [0.5, 0.78], name: 'Broken Herald', lines: ['"THE LORD STILL SITS. THE LORD STILL WAITS. THE LORD DOES NOT KNOW THE KING IS DEAD."'] }, { t: 'shrine', at: [0.12, 0.82] }],
    nodes: { ore: 10, coal: 8, sunsteel: 6 }, mobs: 46, chests: 8, deco: [['pillar', 14], ['bones', 12, { solid: false }], ['banner', 6, { solid: false }]], waystones: 1 },
  ironhold: { kind: 'cave', id: 'ironhold', name: 'Ironhold Mines', w: 112, h: 96, theme: 'cave', seed: 1808, ground: T.GRASS, fill: 0.5, pool: 0.74, crystal: 0.02, portals: [],
    nodes: { ore: 22, coal: 16 }, mobs: 44, elites: 4, chests: 7, deco: [['crates', 10], ['barrel', 8], ['bones', 10, { solid: false }]], waystones: 1 },
  crystal_caverns: { kind: 'cave', id: 'crystal_caverns', name: 'Crystal Caverns', w: 112, h: 96, theme: 'cave', seed: 1909, ground: T.GRASS, fill: 0.54, pool: 0.72, crystal: 0.06, portals: [],
    nodes: { echo: 18, ore: 8 }, mobs: 46, elites: 4, chests: 7, deco: [['bones', 8, { solid: false }]], waystones: 1 },
};
// ── Endgame regions (see src/content2.js) ──────────────────────────────────────────────────────────────────────────────────────
Z.moonspire = { kind: 'out', id: 'moonspire', name: 'Moonspire Heights', w: 144, h: 104, theme: 'snow', seed: 2101, ground: T.GRASS, trees: 0.5, thin: 0.25, water: 0.8, rocks: 0.66, fs: 16, portals: [], edge: T.ROCK,
  landmarks: [{ t: 'village', at: [0.5, 0.78], vendor: 'Silvia the Moonwright', inn: 'Old Bram of the Spire', elder: 'Warden Illyra', lines: ['Silverhold keeps a lamp lit for every traveller who went up the Spire and a second one for those who came down changed.', 'The Moon Queen was a mortal once. She asked the Barrow for a longer night. The Barrow was generous.'] },
    { t: 'dungeon', at: [0.82, 0.3], to: 'moonlit_barrow_1', label: 'Moonlit Barrow (Lv 23-27)', signName: 'Moonlit Barrow', lines: ['THE MOONLIT BARROW. A king buried with his whole court and all their silver. (Lv 23-27)'] },
    { t: 'camp', at: [0.18, 0.4], chest: 'Frozen Pilgrims' }, { t: 'camp', at: [0.7, 0.55], chest: 'Silverwatch Post' }, { t: 'ruin', at: [0.3, 0.65], chest: 'Fallen Observatory' }, { t: 'tower', at: [0.35, 0.3], name: 'Moon Dial', lines: ['Cut into the stone: THE SILVER IS NOT A METAL. IT IS A PROMISE THE MOON MADE AND DID NOT KEEP.'] }, { t: 'shrine', at: [0.12, 0.8] }, { t: 'lair', at: [0.5, 0.12] }],
  nodes: { moonsilver: 18, frostbloom: 10, ore: 6, coal: 4 }, mobs: 54, chests: 9, deco: [['bones', 12, { solid: false }], ['stump', 6]], waystones: 1 };
Z.cinder_foundry = { kind: 'out', id: 'cinder_foundry', name: 'The Cinder Foundry', w: 144, h: 104, theme: 'volcano', seed: 2202, ground: T.GRASS, patch: [0.55, T.SAND], trees: 0.78, thin: 0.55, water: 0.72, rocks: 0.64, fs: 16, ws: 16, portals: [], edge: T.ROCK,
  landmarks: [{ t: 'village', at: [0.28, 0.78], vendor: 'Brannoch the Slagwright', inn: 'Matron Ash', elder: 'Foreman Dessa', lines: ['The Foundry never stopped. It only lost the people who ran it. Something else runs it now.', 'Cinderforged steel takes a heat that melts lesser smiths. Bring a good hammer — and a better apprentice.'] },
    { t: 'camp', at: [0.7, 0.7], chest: 'Smelters\' Camp' }, { t: 'camp', at: [0.25, 0.3], chest: 'Collapsed Barracks' }, { t: 'ruin', at: [0.5, 0.45], chest: 'The Great Crucible' }, { t: 'ruin', at: [0.8, 0.25], chest: 'Overseer\'s Office' }, { t: 'tower', at: [0.6, 0.85], name: 'Slag Ledger', lines: ['Tallies of ingots poured, in a hand that grows more careless every page. The last entry: ONE MORE POUR.'] }, { t: 'shrine', at: [0.15, 0.55] }, { t: 'lair', at: [0.5, 0.1] }],
  nodes: { cinder: 18, coal: 14, ore: 8 }, mobs: 56, chests: 9, deco: [['bones', 10, { solid: false }], ['crates', 6]], waystones: 1 };
Z.aether_reach = { kind: 'out', id: 'aether_reach', name: 'Aether Reach', w: 144, h: 104, theme: 'main', seed: 2303, ground: T.SAND, patch: [0.5, T.COBBLE], trees: 0.84, thin: 0.45, water: 0.7, rocks: 0.6, fs: 14, portals: [], edge: T.ROCK, clear: T.COBBLE,
  landmarks: [{ t: 'village', at: [0.5, 0.8], vendor: 'Veyra the Star-Broker', inn: 'Quiet Orrin', elder: 'Archon Teliss', lines: ['Aether Reach is where the sky wears thin. Things fall through. Most are only stones.', 'The Sovereign is not hungry. It is curious. That is worse.'] },
    { t: 'dungeon', at: [0.2, 0.3], to: 'aether_vault_1', label: 'Aether Vault (Lv 29-33)', signName: 'Aether Vault', lines: ['THE AETHER VAULT. Something was locked away here before the sky had a name. (Lv 29-33)'] },
    { t: 'camp', at: [0.78, 0.7], chest: 'Starfall Camp' }, { t: 'ruin', at: [0.3, 0.6], chest: 'Broken Orrery' }, { t: 'ruin', at: [0.75, 0.3], chest: 'Sunken Observatory' }, { t: 'tower', at: [0.52, 0.45], name: 'Star Plinth', lines: ['The inscription is a map of a sky nobody here has seen. One star is circled. It has not yet risen.'] }, { t: 'shrine', at: [0.88, 0.8] }, { t: 'lair', at: [0.5, 0.12] }],
  nodes: { aether: 16, echo: 10, ore: 6 }, mobs: 56, chests: 9, deco: [['pillar', 14], ['bones', 10, { solid: false }], ['banner', 6, { solid: false }]], waystones: 1 };
dungeon('moonlit_barrow_1', 'Moonlit Barrow — Cairn', 'snow', 3501, 0, { rooms: 10, elites: 3, deco: [['coffin', 6], ['bones', 12, { solid: false }], ['pillar', 8]], chestName: 'Silver Cairn Chest', up: { label: 'Out to Moonspire Heights', to: { map: 'moonspire', x: 0, y: 0 } }, down: { label: 'Down to the Crown Vault', to: { map: 'moonlit_barrow_2' } } });
dungeon('moonlit_barrow_2', 'Moonlit Barrow — Crown Vault', 'snow', 3502, 0, { rooms: 9, elites: 3, boss: true, bossChest: 'The Barrow King\'s Silver Crown', deco: [['coffin', 8], ['pillar', 8]], up: { label: 'Up the stairs', to: { map: 'moonlit_barrow_1' }, toKey: 'stairs' } });
dungeon('aether_vault_1', 'Aether Vault — Antechamber', 'cave', 3601, 0, { rooms: 10, elites: 3, deco: [['pillar', 10], ['bones', 8, { solid: false }]], chestName: 'Sealed Reliquary', up: { label: 'Out to Aether Reach', to: { map: 'aether_reach', x: 0, y: 0 } }, down: { label: 'Down to the Heart', to: { map: 'aether_vault_2' } } });
dungeon('aether_vault_2', 'Aether Vault — Heart', 'cave', 3602, 0, { rooms: 9, elites: 4, boss: true, bossChest: 'The Warden\'s Aether Cache', deco: [['pillar', 10]], up: { label: 'Up the stairs', to: { map: 'aether_vault_1' }, toKey: 'stairs' } });

// Return coordinates for dungeon entrances: just below the cave mouth that leads in.
for (const dkey of Object.keys(DUN)) { const S = DUN[dkey]; if (S.up.to.x === 0) { const zone = Z[S.up.to.map], L = zone.landmarks.find((l) => l.to === dkey); S.up.to = { map: S.up.to.map, x: Math.max(12, Math.min(zone.w - 13, Math.round(L.at[0] * zone.w))) + 0.5, y: Math.max(10, Math.min(zone.h - 14, Math.round(L.at[1] * zone.h))) + 2.5 }; } }
const approach = (id, side, at) => { const S = Z[id], a = at ?? 0.5; return side === 's' ? { x: Math.round(a * (S.w - 1)) + 0.5, y: S.h - 5.5 } : side === 'n' ? { x: Math.round(a * (S.w - 1)) + 0.5, y: 5.5 } : side === 'w' ? { x: 5.5, y: Math.round(a * (S.h - 1)) + 0.5 } : { x: S.w - 5.5, y: Math.round(a * (S.h - 1)) + 0.5 }; };
const link = (a, sa, aa, b, sb, ab, la, lb) => { Z[a].portals.push({ side: sa, at: aa, label: la, to: { map: b, ...approach(b, sb, ab) } }); Z[b].portals.push({ side: sb, at: ab, label: lb, to: { map: a, ...approach(a, sa, aa) } }); };
// The first portal of each zone is its spawn ("arrival") point.
Z.greenmeadow.portals.push({ side: 's', at: 0.5, label: 'To Lanternfall v', to: { map: 'town', x: 17.5, y: 4.5 } });
Z.ironhold.portals.push({ side: 'w', at: 0.5, label: '< To the Quarry', to: { map: 'quarry', x: 61.5, y: 28.5 } });
Z.mistfen.portals.push({ side: 'e', at: 0.5, label: 'To Gloomwood >', to: { map: 'gloomwood', x: 2.5, y: 10.5 } });
link('greenmeadow', 'n', 0.5, 'frostpeak', 's', 0.5, 'To Frostpeak ^', 'To Greenmeadow v');
link('greenmeadow', 'e', 0.45, 'sunscorch', 'w', 0.5, 'To Sunscorch Dunes >', '< To Greenmeadow');
link('greenmeadow', 'w', 0.55, 'saltmere', 'e', 0.5, '< To Saltmere Coast', 'To Greenmeadow >');
link('sunscorch', 'e', 0.5, 'emberwaste', 'w', 0.5, 'To the Emberwaste >', '< To Sunscorch Dunes');
link('emberwaste', 'n', 0.5, 'ruined_citadel', 's', 0.5, 'To the Ruined Citadel ^', 'To the Emberwaste v');
link('frostpeak', 'n', 0.5, 'crystal_caverns', 's', 0.5, 'To the Crystal Caverns ^', 'To Frostpeak v');
link('frostpeak', 'w', 0.7, 'ironhold', 'e', 0.45, '< To Ironhold Mines', 'To Frostpeak >');
link('crystal_caverns', 'n', 0.5, 'moonspire', 's', 0.5, 'To Moonspire Heights ^', 'To the Crystal Caverns v');
link('emberwaste', 'e', 0.5, 'cinder_foundry', 'w', 0.5, 'To the Cinder Foundry >', '< To the Emberwaste');
link('ruined_citadel', 'n', 0.5, 'aether_reach', 's', 0.5, 'To Aether Reach ^', 'To the Ruined Citadel v');
// Existing hand-made maps get their new exits here.
function openNewExits(m) {
  if (m.id === 'town') { rect(m, 16, 0, 4, 10, T.PATH); portal(m, 16, 0, 4, 1, { map: 'greenmeadow', ...approach('greenmeadow', 's', 0.5) }, 'To Greenmeadow ^'); }
  if (m.id === 'quarry') { rect(m, 50, 26, 14, 5, T.PATH); portal(m, 63, 26, 1, 5, { map: 'ironhold', ...approach('ironhold', 'w', 0.5) }, 'To Ironhold Mines >'); }
  if (m.id === 'gloomwood') { rect(m, 0, 8, 8, 5, T.PATH); portal(m, 0, 8, 1, 5, { map: 'mistfen', ...approach('mistfen', 'e', 0.5) }, '< To Mistfen Marsh'); }
}

// ── HIDDEN PLACES ────────────────────────────────────────────────────────────────────
// Search spots (kind 'search') are invisible: press E where nothing is shown and, if you stand on one, something may happen.
const search = (m, id, x, y, extra = {}) => { m.points.push({ id: `${m.id}.${id}`, kind: 'search', x: x + 0.5, y: y + 0.5, hidden: true, ...extra }); };

function buildRootCellar() {
  const m = mk('root_cellar', 'The Root Cellar', 40, 32, T.ROCK, 'main'), rng = new Rng(707);
  m.spawn = { x: 20.5, y: 29.5 };
  rect(m, 6, 8, 28, 19, T.FLOOR); rect(m, 18, 26, 5, 5, T.FLOOR); polyline(m, [[20, 31], [20, 26]], T.PATH, 3);
  rect(m, 13, 1, 14, 6, T.FLOOR); rect(m, 17, 6, 6, 2, T.WALL);                                    // inner chamber, walled off
  for (const [x, y, w, h] of [[16, 14, 8, 1], [16, 20, 8, 1], [16, 15, 1, 5], [23, 15, 1, 5]]) rect(m, x, y, w, h, T.ROCK);   // central root-knot
  rect(m, 19, 14, 2, 1, T.FLOOR);
  for (const [x, y] of [[9, 11], [9, 23], [31, 11], [31, 23], [12, 18], [28, 18]]) set(m, x, y, T.ROCK);
  portal(m, 19, 31, 3, 1, { map: 'town', x: 33.5, y: 16.5 }, 'Up to Lanternfall');
  pt(m, 'secret', 'inscription', 20, 24, { name: 'Root-Carved Inscription', secret: 'q', q: 'apostle', qs: 'inscription' });
  pt(m, 'secret', 'stone_e', 30, 17, { name: 'Root-Stone', secret: 'q', q: 'apostle', qs: 'stone', dir: 'e' });
  pt(m, 'secret', 'stone_s', 20, 22, { name: 'Root-Stone', secret: 'q', q: 'apostle', qs: 'stone', dir: 's' });
  pt(m, 'secret', 'stone_w', 10, 17, { name: 'Root-Stone', secret: 'q', q: 'apostle', qs: 'stone', dir: 'w' });
  pt(m, 'secret', 'stone_n', 20, 10, { name: 'Root-Stone', secret: 'q', q: 'apostle', qs: 'stone', dir: 'n' });
  pt(m, 'secret', 'inner_gate', 20, 7, { name: 'The Living Gate', secret: 'q', q: 'apostle', qs: 'gate' });
  for (const [x, y] of place(m, rng, 8, { minY: 9, maxY: 25, gap: 5, avoid: [[20, 28, 4], [20, 17, 4]] })) m.mobSpawns.push({ x, y });
  m.bossSpawn = { x: 20, y: 3 }; m.sealedBoss = true;       // reached only through the Living Gate (a teleport)
  decoScatter(m, rng, 'pillar', 4, {}, { minY: 9, maxY: 25, avoid: [[20, 17, 5], [20, 28, 4]] });
  return m;
}

function buildWorldTree() {
  const m = mk('world_tree', "Yggdrasil's Crown", 44, 36, T.GRASS, 'main'), rng = new Rng(808);
  m.spawn = { x: 22.5, y: 32.5 };
  scatter(m, T.TREE, 0.18, rng); ring(m, T.TREE);
  rect(m, 14, 2, 16, 33, T.GRASS); blob(m, 22, 18, 5, T.ROCK, rng); blob(m, 22, 18, 3, T.WATER, rng);
  polyline(m, [[22, 34], [22, 24]], T.PATH, 3); rect(m, 17, 4, 10, 9, T.PATH);
  portal(m, 20, 35, 5, 1, { map: 'gloomwood', x: 8.5, y: 13.5 }, 'Down to Gloomwood');
  pt(m, 'secret', 'altar', 22, 3, { name: 'The Heartwood Altar', secret: 'q', q: 'apostle', qs: 'altar' });
  for (const [x, y] of place(m, rng, 10, { minY: 14, maxY: 30, gap: 5, avoid: [[22, 32, 4]] })) m.mobSpawns.push({ x, y });
  m.bossSpawn = { x: 22, y: 9 };
  return m;
}

function buildSunkenVault() {
  const m = mk('sunken_vault', 'The Sunken Vault', 30, 24, T.ROCK, 'main'), rng = new Rng(909);
  m.spawn = { x: 15.5, y: 21.5 };
  rect(m, 4, 8, 22, 9, T.FLOOR); rect(m, 12, 16, 6, 7, T.FLOOR); rect(m, 11, 2, 8, 6, T.FLOOR); rect(m, 14, 7, 2, 2, T.FLOOR);
  for (const [x, y] of [[7, 10], [22, 10], [7, 15], [22, 15]]) set(m, x, y, T.ROCK);
  blob(m, 15, 13, 1, T.WATER, rng);
  portal(m, 13, 23, 4, 1, { map: 'quarry', x: 12.5, y: 33.5 }, 'Up to the Quarry');
  pt(m, 'secret', 'inscription', 15, 19, { name: 'Weathered Inscription', secret: 'q', q: 'vault', qs: 'inscription' });
  pt(m, 'secret', 'plate1', 8, 12, { name: 'Pressure Plate (I)', secret: 'q', q: 'vault', qs: 'plate', n: 1 });
  pt(m, 'secret', 'plate2', 15, 15, { name: 'Pressure Plate (II)', secret: 'q', q: 'vault', qs: 'plate', n: 2 });
  pt(m, 'secret', 'plate3', 21, 12, { name: 'Pressure Plate (III)', secret: 'q', q: 'vault', qs: 'plate', n: 3 });
  pt(m, 'secret', 'treasure', 15, 4, { name: 'The Vault Chest', secret: 'q', q: 'vault', qs: 'treasure' });
  return m;
}

function buildVoidRift() {
  const m = mk('void_rift', 'The Void Rift', 48, 36, T.CHASM, 'hollow'), rng = new Rng(1010);
  m.spawn = { x: 24.5, y: 32.5 };
  rect(m, 19, 28, 11, 7, T.HOLLOW); rect(m, 8, 16, 12, 8, T.HOLLOW); rect(m, 28, 14, 12, 8, T.HOLLOW); rect(m, 15, 2, 18, 9, T.HOLLOW);
  polyline(m, [[24, 29], [18, 22], [20, 14], [24, 10]], T.PATH, 3); polyline(m, [[24, 29], [32, 22], [30, 14], [26, 10]], T.PATH, 3);
  for (const [x, y] of [[12, 19], [34, 17], [18, 5], [30, 5]]) set(m, x, y, T.CRYSTAL);
  portal(m, 21, 35, 7, 1, { map: 'hollow_depths', x: 24.5, y: 28.5 }, 'Back to the Depths');
  pt(m, 'secret', 'throne', 24, 3, { name: 'The Empty Throne', secret: 'q', q: 'void', qs: 'throne' });
  for (const [x, y] of place(m, rng, 8, { minY: 12, maxY: 30, gap: 5, avoid: [[24, 32, 5]] })) m.mobSpawns.push({ x, y });
  m.bossSpawn = { x: 24, y: 7 };
  return m;
}


function buildRaid() {
  const m = mk('raid_bastion', 'Cinderhold Bastion', 60, 46, T.COBBLE, 'volcano'), rng = new Rng(2020);
  m.spawn = { x: 30.5, y: 42.5 }; ring(m, T.WALL);
  rect(m, 2, 2, 56, 42, T.COBBLE); ring(m, T.WALL); rect(m, 26, 44, 9, 2, T.FLOOR);
  rect(m, 24, 36, 13, 7, T.FLOOR); rect(m, 22, 5, 17, 24, T.RUG); rect(m, 25, 28, 11, 8, T.COBBLE);
  for (const [x, y, w, h] of [[4, 6, 7, 9], [49, 6, 7, 9], [4, 24, 7, 9], [49, 24, 7, 9]]) rect(m, x, y, w, h, T.WATER);          // lava pools
  for (const [x, y] of [[16, 10], [44, 10], [16, 20], [44, 20], [16, 30], [44, 30], [24, 14], [36, 14]]) deco(m, 'pillar', x, y);
  portal(m, 26, 45, 9, 1, { map: 'emberwaste', ...approach('emberwaste', 'w', 0.5) }, 'Leave the Bastion');
  m.bossSpawn = { x: 30, y: 12 }; return m;
}

function buildGuildRaid() {
  const m = mk('guild_raid', "The Titan's Crucible", 64, 50, T.COBBLE, 'volcano');
  m.spawn = { x: 32.5, y: 46.5 }; ring(m, T.WALL); rect(m, 2, 2, 60, 46, T.COBBLE); ring(m, T.WALL); rect(m, 28, 48, 9, 2, T.FLOOR); rect(m, 20, 8, 25, 26, T.RUG);
  for (const [x, y, w, h] of [[4, 5, 8, 10], [52, 5, 8, 10], [4, 26, 8, 10], [52, 26, 8, 10], [26, 38, 12, 3]]) rect(m, x, y, w, h, T.WATER);
  for (const [x, y] of [[16, 10], [47, 10], [16, 22], [47, 22], [16, 32], [47, 32], [26, 16], [37, 16], [26, 28], [37, 28]]) deco(m, 'pillar', x, y);
  portal(m, 28, 49, 9, 1, { map: 'town', x: 27.5, y: 24.5 }, 'Leave the Crucible'); m.bossSpawn = { x: 32, y: 14 }; return m;
}

// Add the quest points that live inside existing maps (invisible search spots + the doors they open).
function addHiddenSpots(m) {
  const way = (x, y) => pt(m, 'waystone', 'waystone', x, y, { name: 'Waystone' });
  if (m.id === 'town') { way(31, 21); pt(m, 'board', 'bounties', 21, 21, { name: 'Bounty Board' }); pt(m, 'npc', 'guildmaster', 29, 23, { name: 'Guildmaster Orren', role: 'graid', lines: ['Guilds that fight together, rise together.'] }); } if (m.id === 'quarry') way(6, 17); if (m.id === 'gloomwood') way(58, 16); if (m.id === 'archive') way(31, 3);
  if (m.id === 'emberwaste') { const sx = Math.floor(m.spawn.x), sy = Math.floor(m.spawn.y); for (const [dx, dy] of [[2, -2], [-2, -2], [2, 2], [-2, 2], [3, 0]]) { const x = sx + dx, y = sy + dy; if (!isBlockedTile(m, x, y) && !isBlockedTile(m, x + 1, y)) { pt(m, 'npc', 'raidwarden', x, y, { name: 'Cinderhold Gatekeeper', role: 'raid', lines: ['The Bastion is open to those who dare.'] }); break; } } }
  if (m.id === 'hollow_reach') way(35, 38);
  if (m.id === 'town') {
    search(m, 'search_well', 33, 15, { q: 'apostle', qs: 'well' });
    search(m, 'search_vault', 46, 7, { q: 'gilded', qs: 'vault' });
    search(m, 'search_altar', 41, 9, { q: 'philosopher', qs: 'altar' });
    pt(m, 'secret', 'rootwell_door', 33, 16, { name: 'The Well Shaft', secret: 'q', q: 'apostle', qs: 'door' });
  }
  if (m.id === 'quarry') {
    search(m, 'search_wall', 7, 34, { q: 'vault', qs: 'wall' });
    pt(m, 'secret', 'vault_door', 8, 34, { name: 'Cracked Wall', secret: 'q', q: 'vault', qs: 'door' });
  }
  if (m.id === 'gloomwood') {
    search(m, 'search_graves', 52, 33, { q: 'bell', qs: 'grave' });
    search(m, 'search_seed', 8, 12, { q: 'apostle', qs: 'plant' });
    pt(m, 'secret', 'tree_portal', 9, 13, { name: 'The Sapling', secret: 'q', q: 'apostle', qs: 'treeportal' });
  }
  if (m.id === 'archive') {
    search(m, 'search_bell', 8, 34, { q: 'bell', qs: 'bell' });
    pt(m, 'secret', 'silent_bell', 9, 34, { name: 'The Silent Bell', secret: 'q', q: 'bell', qs: 'ring' });
  }
  if (m.id === 'hollow_depths') {
    search(m, 'search_obelisk', 24, 6, { q: 'void', qs: 'obelisk' });
    pt(m, 'secret', 'rift_gate', 24, 8, { name: 'A Wound In The Air', secret: 'q', q: 'void', qs: 'gate' });
  }
}

const BUILDERS = { town: buildTown, quarry: buildQuarry, gloomwood: buildGloomwood, archive: buildArchive, hollow_reach: buildShadowReach, hollow_depths: buildShadowDepths, ...Object.fromEntries(Object.entries(DUN).map(([id, S]) => [id, () => genDungeon(S)])), raid_bastion: buildRaid, guild_raid: buildGuildRaid, root_cellar: buildRootCellar, world_tree: buildWorldTree, sunken_vault: buildSunkenVault, void_rift: buildVoidRift, ...Object.fromEntries(Object.entries(Z).map(([id, S]) => [id, () => (S.kind === 'cave' ? genCave(S) : genOutdoor(S))])) };
const cache = {};
export function getMap(id) { if (!cache[id]) { cache[id] = BUILDERS[id](); openNewExits(cache[id]); addHiddenSpots(cache[id]); } return cache[id]; }
export const MAP_IDS = Object.keys(BUILDERS);
export const realmOf = (mapId) => (getMap(mapId).theme === 'hollow' ? 'hollow' : 'main');

// ── Collision & helpers ─────────────────────────────────────────────────────
export function blockedAt(m, x, y, r = PLAYER_R) {
  return isBlockedTile(m, Math.floor(x - r), Math.floor(y - r)) || isBlockedTile(m, Math.floor(x + r), Math.floor(y - r)) ||
    isBlockedTile(m, Math.floor(x - r), Math.floor(y + r)) || isBlockedTile(m, Math.floor(x + r), Math.floor(y + r));
}
export function stepMove(m, x, y, dx, dy, r = PLAYER_R) {
  if (!blockedAt(m, x + dx, y, r)) x += dx;
  if (!blockedAt(m, x, y + dy, r)) y += dy;
  return { x, y };
}
export const inSafeZone = (m, x, y) => m.safe.some((s) => x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h);
// Where a portal leads — most are fixed, some resolve to the far map's spawn point or its stairwell.
export const portalDest = (p) => (p.toKey ? getMap(p.to.map)[p.toKey] ?? getMap(p.to.map).spawn : p.to);
export function portalAt(m, x, y) {
  return m.portals.find((p) => x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h) ?? null;
}
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
