// THE WORLD MAP (N) and ROUTE TRACKING.
// A map of every region as a graph, with fog of war (a region appears once you have been next to it), the level each region expects,
// what it offers, and a "Track" button: the chosen destination puts an arrow on the screen edge pointing at the exit you should take next.
import { G } from './state.js';
import { ZONES, ENEMIES } from '../data.js';
import { WORLD_POS, worldGraph, routeTo, regionFeatures, getMap, regionOf } from '../world.js';
import { h } from '../ui-lib.js';
import { openWindow, closeWindow } from './panels.js';

const TRACK_KEY = 'emberfall.track';
const THEME = { main: '#4f8a3e', desert: '#c4a65a', snow: '#c9dae8', volcano: '#8a4a38', swamp: '#4a7a62', cave: '#6a5f86', hollow: '#5a3a8a' };
export { regionOf };
export function getTrack() { if (G.track === undefined) { try { G.track = localStorage.getItem(TRACK_KEY) || null; } catch { G.track = null; } } return G.track; }
export function setTrack(id) { G.track = id || null; try { id ? localStorage.setItem(TRACK_KEY, id) : localStorage.removeItem(TRACK_KEY); } catch { /* private mode */ } G.nav = null; }
const lvlOf = (id) => ZONES[id]?.lvl ?? 0;
// The next region to walk to, and the exit portal of the current map that leads there.
export function navTarget() {
  const tr = getTrack(); if (!tr) return null; const here = regionOf(G.map); if (!here) return null;
  const key = `${G.map}|${tr}|${G.me?.level ?? 1}`; if (G.nav?.key === key) return G.nav.val;
  const L = G.me?.level ?? 1, path = routeTo(here, tr, (id) => 1 + Math.max(0, lvlOf(id) - L - 4) / 6);
  let val = null;
  if (path && path.length > 1) { const next = path[1], m = getMap(G.map), p = m.portals.find((q) => q.to.map === next) ?? (G.map !== here ? m.portals.find((q) => q.to.map === here || regionOf(q.to.map) === here) : null); val = p ? { next, portal: p, path } : { next, portal: null, path }; }
  else if (path && path.length === 1) val = { arrived: true, path };
  G.nav = { key, val }; return val;
}
const seenSet = () => new Set(Object.keys(G.me?.seen ?? {}));
function knownRegions() {
  const seen = seenSet(), g = worldGraph(), known = new Set(), fog = new Set();
  for (const id of Object.keys(WORLD_POS)) if (seen.has(id)) known.add(id);
  known.add('town'); const here = regionOf(G.map); if (here) known.add(here);
  for (const id of known) for (const n of g[id] ?? []) if (!known.has(n)) fog.add(n);
  return { known, fog };
}
const nm = (id) => getMap(id)?.name ?? id;

export function openWorldMap() {
  let sel = regionOf(G.map) ?? 'town', canvas;
  const W = 760, H = 540, GAP = 10, PAD = 16;
  // the map zooms to what you have discovered: few regions = big boxes
  function layout() {
    const { known, fog } = knownRegions(), ids = Object.keys(WORLD_POS).filter((id) => known.has(id) || fog.has(id)), xs = ids.map((id) => WORLD_POS[id][0]), ys = ids.map((id) => WORLD_POS[id][1]);
    const minx = Math.min(...xs), miny = Math.min(...ys), nc = Math.max(...xs) - minx + 1, nr = Math.max(...ys) - miny + 1;
    const cw = Math.max(56, Math.min(120, (W - PAD * 2 - GAP * (nc - 1)) / nc)), ch = Math.max(36, Math.min(66, (H - PAD * 2 - GAP * (nr - 1)) / nr));
    const ox = (W - (nc * cw + (nc - 1) * GAP)) / 2, oy = (H - (nr * ch + (nr - 1) * GAP)) / 2;
    return { known, fog, ids, cw, ch, boxOf: (id) => ({ x: ox + (WORLD_POS[id][0] - minx) * (cw + GAP), y: oy + (WORLD_POS[id][1] - miny) * (ch + GAP) }) };
  }
  const detail = h('div', { class: 'wm-detail' });
  function paintDetail() {
    const id = sel, { known, fog } = knownRegions(), z = ZONES[id], f = regionFeatures(id), L = G.me?.level ?? 1;
    if (!known.has(id)) { detail.replaceChildren(h('h3', {}, 'Unexplored'), h('p', { class: 'dim' }, 'You have not been here yet. Walk to an exit of a neighbouring region to discover it.'), fog.has(id) ? h('p', {}, `Expected level: about ${z?.lvl ?? '?'}.`) : null, fog.has(id) ? h('div', { class: 'row' }, h('button', { class: 'btn small gold', onclick: () => { setTrack(id); draw(); paintDetail(); } }, 'Track route here')) : null); return; }
    const foes = [...new Set((z?.enemies ?? []).map((k) => ENEMIES[k]?.name).filter(Boolean))].slice(0, 4), boss = z?.boss ? ENEMIES[z.boss]?.name : null, tracked = getTrack() === id, here = regionOf(G.map) === id;
    const danger = z?.lvl ? (z.lvl > L + 6 ? 'r' : z.lvl > L + 2 ? '' : 'g') : 'g';
    detail.replaceChildren(
      h('h3', {}, nm(id)), h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } }, h('span', { class: `tag ${danger}` }, z?.lvl ? `Lv ${z.lvl}-${z.lvl + 2}` : 'Safe hub'), here ? h('span', { class: 'tag g' }, 'you are here') : null, tracked ? h('span', { class: 'tag v' }, 'tracked') : null),
      foes.length ? h('p', { style: { fontSize: '12px' } }, h('b', {}, 'Monsters: '), foes.join(', ')) : null, boss ? h('p', { style: { fontSize: '12px' } }, h('b', {}, 'Lair boss: '), boss) : null,
      h('p', { style: { fontSize: '12px' } }, h('b', {}, 'Here: '), [f.village ? 'village (shop + inn)' : null, ...f.dungeons.map((d) => `dungeon: ${d}`), f.camps ? `${f.camps} camp${f.camps > 1 ? 's' : ''}` : null, f.ruins ? `${f.ruins} ruin${f.ruins > 1 ? 's' : ''}` : null, f.shrines ? 'a shrine' : null, f.waystones ? 'a waystone' : null].filter(Boolean).join(' · ') || 'roads and wilderness'),
      h('div', { class: 'row', style: { marginTop: '8px' } }, tracked ? h('button', { class: 'btn small ghost', onclick: () => { setTrack(null); draw(); paintDetail(); } }, 'Stop tracking') : h('button', { class: 'btn small gold', onclick: () => { setTrack(id); draw(); paintDetail(); } }, 'Track route here')),
      h('p', { class: 'dim', style: { fontSize: '11px', marginTop: '8px' } }, 'A gold arrow at the edge of your screen then points to the next exit. Routes avoid regions far above your level when there is a safer road.'));
  }
  function draw() {
    const g = canvas.getContext('2d'), lay = layout(), { known, fog, ids, cw, ch, boxOf } = lay, here = regionOf(G.map), tr = getTrack(), graph = worldGraph(), L = G.me?.level ?? 1, shown = new Set(ids);
    g.imageSmoothingEnabled = false; g.fillStyle = '#0d0a16'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(80,110,170,.10)'; for (let i = 0; i < 200; i++) g.fillRect((i * 97) % W, (i * 53) % H, 6, 1);
    g.lineWidth = 5; for (const a of ids) for (const b of graph[a] ?? []) if (a < b && shown.has(b)) { const A = boxOf(a), B = boxOf(b); g.strokeStyle = known.has(a) && known.has(b) ? '#c9a24a' : '#5a4a2a'; g.beginPath(); g.moveTo(A.x + cw / 2, A.y + ch / 2); g.lineTo(B.x + cw / 2, B.y + ch / 2); g.stroke(); }
    const path = tr && here ? routeTo(here, tr, (id) => 1 + Math.max(0, lvlOf(id) - L - 4) / 6) : null;
    if (path && path.length > 1) { g.strokeStyle = '#7fe0ff'; g.lineWidth = 3; g.setLineDash([7, 5]); g.beginPath(); let pen = false; for (const id of path) { if (!shown.has(id)) { pen = false; continue; } const B = boxOf(id); pen ? g.lineTo(B.x + cw / 2, B.y + ch / 2) : g.moveTo(B.x + cw / 2, B.y + ch / 2); pen = true; } g.stroke(); g.setLineDash([]); }
    const fs = Math.max(9, Math.min(13, Math.round(cw / 8.5))), per = Math.floor((cw - 8) / (fs * 0.66));
    for (const id of ids) {
      const b = boxOf(id), k = known.has(id), z = ZONES[id], f = k ? regionFeatures(id) : null, theme = f?.theme ?? 'main';
      g.fillStyle = k ? THEME[theme] ?? '#4f8a3e' : '#2a2438'; g.fillRect(b.x, b.y, cw, ch); g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(b.x, b.y + ch - fs - 6, cw, fs + 6);
      g.lineWidth = id === sel ? 3 : 1.5; g.strokeStyle = id === sel ? '#ffffff' : id === tr ? '#7fe0ff' : '#e0b24a'; g.strokeRect(b.x + 0.5, b.y + 0.5, cw - 1, ch - 1);
      g.font = `${fs}px Pixel, monospace`; g.textBaseline = 'top'; g.fillStyle = '#fff';
      if (k) { const words = nm(id).toUpperCase().split(' '), lines = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length <= per) cur = (cur + ' ' + w).trim(); else { if (cur) lines.push(cur); cur = w; } } if (cur) lines.push(cur); lines.slice(0, 2).forEach((t, i) => g.fillText(t.slice(0, per), b.x + 4, b.y + 4 + i * (fs + 2))); }
      else { g.fillStyle = '#8a7ab0'; g.fillText('???', b.x + 4, b.y + 4); }
      const lv = z?.lvl ? `Lv ${z.lvl}` : k ? 'HUB' : '', danger = z?.lvl > L + 6 ? '#ff7a7a' : z?.lvl > L + 2 ? '#ffd36a' : '#9aff9a'; g.fillStyle = danger; g.fillText(lv, b.x + 4, b.y + ch - fs - 3);
      if (k) { let ix = b.x + cw - 10; const iy = b.y + ch - fs - 2; if (f.village) { g.fillStyle = '#ffbe3c'; g.fillRect(ix, iy, 7, 7); ix -= 10; } if (f.dungeons.length) { g.fillStyle = '#ff5a5a'; g.fillRect(ix, iy, 7, 7); ix -= 10; } if (f.waystones) { g.fillStyle = '#fff'; g.fillRect(ix, iy, 6, 6); } }
      if (id === here) { const pulse = 3 + Math.floor(performance.now() / 300) % 2; g.strokeStyle = '#ffe36b'; g.lineWidth = 2; g.strokeRect(b.x - pulse, b.y - pulse, cw + pulse * 2, ch + pulse * 2); g.fillStyle = '#ffe36b'; g.fillText('YOU', b.x + cw - fs * 2.6, b.y + 4); }
    }
  }
  const legend = h('div', { class: 'dim', style: { fontSize: '11px', marginTop: '4px' } }, 'Level colours: green = fine, yellow = a stretch, red = dangerous. Squares: orange = village, red = dungeon, white = waystone. Dashed blue line = tracked route. The map grows as you explore.');
  canvas = h('canvas', { width: W, height: H, class: 'wm-canvas', style: { imageRendering: 'pixelated', cursor: 'pointer' } });
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height, { ids, cw, ch, boxOf } = layout();
    for (const id of ids) { const b = boxOf(id); if (px >= b.x && px <= b.x + cw && py >= b.y && py <= b.y + ch) { sel = id; draw(); paintDetail(); return; } }
  });
  let timer = 0;
  const w = openWindow('worldmap', 'World Map', () => h('div', { class: 'wm' }, h('div', { class: 'wm-main' }, canvas, legend), detail), { wide: true, icon: 'star', onClose: () => clearInterval(timer) });
  draw(); paintDetail(); timer = setInterval(() => { if (document.body.contains(canvas)) draw(); else clearInterval(timer); }, 400); return w;
}
export const closeWorldMap = () => closeWindow('worldmap');
