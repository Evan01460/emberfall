// The Adventure Log (L): every region you have found, its goals and how far you are; and the small on-screen tracker for the region you are in.
import { G } from './state.js';
import { h, fmt } from '../ui-lib.js';
import { openWindow, refreshWindow, isOpen } from './panels.js';
import { setTrack, getTrack } from './worldmap.js';

const send = (m) => G.net.send(m);
let filter = 'here', collapsed = false;
try { collapsed = localStorage.getItem('emberfall.advtrack') === '0'; } catch { /* private mode */ }

const bar = (have, need, done) => h('span', { class: 'meter advbar', style: { width: '120px' } }, h('i', { style: { width: `${Math.min(100, Math.round((have / need) * 100))}%`, background: done ? '#3d9a4e' : '' } }));
function regionCard(r, here) {
  const tracked = getTrack() === r.id, doneN = r.goals.filter((g) => g.done).length;
  return h('div', { class: `card advregion ${r.mastered ? 'mastered' : ''}`, style: { marginBottom: '8px' } },
    h('div', { class: 'row sb' }, h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, h('h3', { style: { margin: 0 } }, r.name), h('span', { class: 'tag' }, `Lv ${r.lvl}`), here ? h('span', { class: 'tag g' }, 'you are here') : null, r.mastered ? h('span', { class: 'tag', style: { color: '#ffd36a' } }, 'MASTERED') : h('span', { class: 'dim', style: { fontSize: '12px' } }, `${doneN}/${r.goals.length} goals`)),
      h('button', { class: `btn small ${tracked ? 'ghost' : 'gold'}`, onclick: () => { setTrack(tracked ? null : r.id); refreshWindow('adventure'); } }, tracked ? 'Stop tracking' : 'Track route')),
    r.goals.map((g) => h('div', { class: 'row sb advgoal', style: { margin: '3px 0', opacity: g.done ? 0.7 : 1 } }, h('span', { style: { flex: 1, minWidth: 0 } }, h('span', { style: { color: g.done ? '#8cffa0' : '#e8e0f0' } }, g.done ? '✓ ' : '• '), g.text), bar(g.have, g.need, g.done), h('b', { style: { width: '52px', textAlign: 'right' } }, `${g.have}/${g.need}`), h('span', { class: 'dim', style: { fontSize: '11px', width: '120px', textAlign: 'right' } }, `${fmt(g.gilt)}g · ${fmt(g.xp)} xp`))),
    h('div', { class: 'dim', style: { fontSize: '11px', marginTop: '4px' } }, r.mastered ? 'Region mastered.' : `Master it for ${fmt(r.mastery.gilt)}g, ${fmt(r.mastery.xp)} XP and a chance at a Skill Tome.`));
}
export function openAdventure() {
  send({ t: 'adv.open' });
  openWindow('adventure', 'Adventure Log', () => {
    const list = G.advList ?? [], here = G.advCur?.id, shown = list.filter((r) => filter === 'all' || (filter === 'here' && r.id === here) || (filter === 'open' && !r.mastered && r.goals.some((g) => g.have > 0)) || (filter === 'done' && r.mastered));
    const chips = [['here', 'This region'], ['open', 'In progress'], ['done', 'Mastered'], ['all', 'All found']].map(([id, l]) => h('button', { class: `chip ${filter === id ? 'on' : ''}`, onclick: () => { filter = id; refreshWindow('adventure'); } }, l));
    return h('div', {}, h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Every region has goals. Each pays gilt and XP the moment it is done; finish them all to master the region. Places of interest are found just by walking past them. Press L any time.'),
      h('div', { class: 'row sb' }, h('div', { class: 'chips' }, chips), h('span', { class: 'tag' }, `${G.advMastered ?? 0} regions mastered`)), h('div', { style: { height: '6px' } }),
      shown.length ? shown.map((r) => regionCard(r, r.id === here)) : h('p', { class: 'dim' }, list.length ? 'Nothing here — try another filter.' : 'Explore to fill the log.'));
  }, { wide: true, icon: 'book' });
}
export function onAdvList(m) { G.advList = m.list ?? []; G.advMastered = m.mastered ?? 0; if (isOpen('adventure')) refreshWindow('adventure'); }
export function onAdvCur(m) { G.advCur = m.cur; paintTracker(); if (isOpen('adventure')) refreshWindow('adventure'); }

let el = null;
export function paintTracker() {
  const hud = document.getElementById('hud'); if (!hud) return; if (!el) { el = h('div', { class: 'adv-tracker' }); hud.append(el); }
  const c = G.advCur; if (!c) { el.style.display = 'none'; return; } el.style.display = '';
  const open = c.goals.filter((g) => !g.done), doneN = c.goals.length - open.length;
  el.replaceChildren(h('div', { class: 'adv-h', onclick: () => { collapsed = !collapsed; try { localStorage.setItem('emberfall.advtrack', collapsed ? '0' : '1'); } catch { /* private mode */ } paintTracker(); } }, h('b', {}, c.mastered ? `${c.name} — mastered` : c.name), h('span', { class: 'dim' }, `${doneN}/${c.goals.length} ${collapsed ? '+' : '–'}`)),
    ...(collapsed ? [] : (open.length ? open : c.goals.slice(0, 1)).slice(0, 6).map((g) => h('div', { class: 'adv-g' }, h('span', {}, g.text.length > 34 ? g.text.slice(0, 33) + '.' : g.text), h('b', {}, `${g.have}/${g.need}`)))));
}

// ── recall bar ──
let recallEl = null, recallT = 0;
export function onRecall(m) {
  clearTimeout(recallT); recallEl?.remove(); recallEl = null; if (m.state !== 'start') return;
  recallEl = h('div', { class: 'recall-bar' }, h('div', {}, 'Recalling to Lanternfall — stand still'), h('div', { class: 'meter' }, h('i', { style: { width: '0%' } }))); document.body.append(recallEl);
  const t0 = performance.now(), fill = recallEl.querySelector('i'), step = () => { if (!recallEl) return; const k = Math.min(1, (performance.now() - t0) / m.ms); fill.style.width = `${k * 100}%`; if (k < 1) recallT = setTimeout(step, 60); }; step();
}
