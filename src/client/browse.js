// A shared item browser for the crafting window and the request tab: search, category and metal filters, "craftable now" / "suits my class"
// toggles, sorting, icons, headline stats and ingredients on every card. Filtering happens in place, so typing in the search box never
// loses focus. Filter state is remembered per `key` (so it survives a window refresh).
import { ITEMS, CLASSES, fitsOf, qualityStatMult, HP_SCALE, TIERS } from '../data.js';
import { EXP_TIERS } from '../expansion.js';
import { h } from '../ui-lib.js';
import * as I from './icons.js';

const STATE = {};
const CATS = { blacksmith: [['all', 'All'], ['weapon', 'Weapons'], ['armor', 'Armour'], ['charm', 'Charms'], ['refine', 'Ingots'], ['other', 'Keys']], alchemist: [['all', 'All'], ['potion', 'Potions']] };
const catOf = (r) => (r.smelt ? 'refine' : ITEMS[r.out]?.slot ?? (ITEMS[r.out]?.k === 'cons' ? 'potion' : 'other'));
const metalOf = (id) => ITEMS[id]?.k === 'gear' ? (ITEMS[id].n ?? '').split(' ')[0] : null;
const METAL_ORDER = TIERS.map((t) => t.name);
const METAL_COL = { Iron: '#a8b0bc', Steel: '#d8e4f0', Shadowsteel: '#a984ff', Sunsteel: '#ffd36a', Moonsilver: '#bfe8ff', Cinderforged: '#ff9a4a', Aetherium: '#7dffd8', ...Object.fromEntries(EXP_TIERS.map((t) => [t.name, t.metal[1]])) };
export const headlineStats = (id, q = 1) => { const it = ITEMS[id]; if (!it) return []; const m = qualityStatMult(q), out = []; if (it.atk) out.push(['ATK', (it.atk * m).toFixed(0), '#ff9a6a']); if (it.def) out.push(['DEF', (it.def * m).toFixed(0), '#7fb8ff']); if (it.hp) out.push(['HP', Math.round(it.hp * m * HP_SCALE), '#ff7a7a']); if (it.mp) out.push(['MP', Math.round(it.mp * m), '#8ad8ff']); if (it.spd) out.push(['SPD', Math.floor(it.spd * m), '#7dffa0']); return out; };
export const statChips = (id, q = 1) => headlineStats(id, q).map(([k, v, c]) => h('span', { class: 'sc', style: { color: c } }, `${k} ${v}`));
export const fitIcons = (id, me, max = 4) => { const fl = fitsOf(id); if (!fl.length) return null; return h('span', { class: 'fits', title: `Made for: ${fl.map((c) => CLASSES[c]?.name ?? c).join(', ')}` }, ...fl.slice(0, max).map((c) => h('span', { class: me && c === me.classId ? 'fit mine' : 'fit' }, I.cls(c, 16))), fl.length > max ? h('span', { class: 'dim', style: { fontSize: '11px' } }, `+${fl.length - max}`) : null); };
export const ingredientRow = (r, have) => h('div', { class: 'ing' }, Object.entries(r.in).map(([id, n]) => h('span', { class: `ingi ${have ? (have(id) >= n ? '' : 'short') : ''}`, title: `${ITEMS[id]?.n ?? id}${have ? ` (have ${have(id)})` : ''}` }, I.item(id, 18), h('b', {}, `${n}`), have && have(id) < n ? h('span', { class: 'red', style: { fontSize: '10px' } }, `/${have(id)}`) : null)));

// opts: { key, family, recipes, me, have(id) → number, card(r, ctx) → node, onSelect?, selected?(r) → bool, canMake?(r) → bool, extraToolbar? }
export function browser(opts) {
  const { key, family, recipes, me } = opts, st = (STATE[key] ??= { q: '', cat: 'all', metal: 'all', can: false, mine: false, sort: 'lvl' });
  const cats = (CATS[family] ?? [['all', 'All']]).filter(([c]) => c === 'all' || recipes.some((r) => catOf(r) === c));
  const grid = h('div', { class: opts.cols === 2 ? 'bgrid b2' : 'bgrid' }), info = h('span', { class: 'dim', style: { fontSize: '12px' } }), chipsRow = h('div', { class: 'chips' }), metalRow = h('div', { class: 'chips' });
  const search = h('input', { class: 'bsearch', type: 'search', placeholder: 'Search items…', value: st.q, oninput: (e) => { st.q = e.target.value; render(); } });
  const chip = (label, on, fn, color) => h('button', { class: `chip ${on ? 'on' : ''}`, style: color && on ? { borderColor: color, color } : null, onclick: fn }, label);
  const sort = h('select', { class: 'bsort', onchange: (e) => { st.sort = e.target.value; render(); } }, [['lvl', 'Sort: level'], ['name', 'Sort: name'], ['value', 'Sort: value'], ['atk', 'Sort: power']].map(([v, l]) => h('option', { value: v, selected: st.sort === v }, l)));
  const toggles = h('div', { class: 'chips' });
  function paintBar() {
    chipsRow.replaceChildren(...cats.map(([c, l]) => chip(`${l}${c === 'all' ? '' : ` ${recipes.filter((r) => catOf(r) === c).length}`}`, st.cat === c, () => { st.cat = c; render(); })));
    const metals = family === 'blacksmith' && (st.cat === 'all' || ['weapon', 'armor', 'charm'].includes(st.cat)) ? METAL_ORDER.filter((m) => recipes.some((r) => metalOf(r.out) === m)) : [];
    metalRow.replaceChildren(...(metals.length ? [chip('Any metal', st.metal === 'all', () => { st.metal = 'all'; render(); }), ...metals.map((m) => chip(m, st.metal === m, () => { st.metal = st.metal === m ? 'all' : m; render(); }, METAL_COL[m]))] : []));
    toggles.replaceChildren(...[opts.canMake ? chip('Craftable now', st.can, () => { st.can = !st.can; render(); }) : null, me && recipes.some((r) => fitsOf(r.out).includes(me.classId)) ? chip(`Suits my class`, st.mine, () => { st.mine = !st.mine; render(); }) : null].filter(Boolean));
  }
  const score = (r) => { const it = ITEMS[r.out] ?? {}; return (it.atk ?? 0) + (it.def ?? 0) * 1.2 + (it.hp ?? 0) * 0.2 + (it.mp ?? 0) * 0.2; };
  function render() {
    paintBar(); const q = st.q.trim().toLowerCase(); let list = recipes.filter((r) => {
      const it = ITEMS[r.out]; if (!it) return false;
      if (st.cat !== 'all' && catOf(r) !== st.cat) return false; if (st.metal !== 'all' && metalOf(r.out) !== st.metal) return false;
      if (st.can && opts.canMake && !opts.canMake(r)) return false; if (st.mine && me && !fitsOf(r.out).includes(me.classId)) return false;
      if (q) { const hay = `${it.n} ${it.slot ?? ''} ${it.wtype ?? ''} ${it.desc ?? r.desc ?? ''} ${fitsOf(r.out).map((c) => CLASSES[c]?.name ?? c).join(' ')} ${Object.keys(r.in).map((i) => ITEMS[i]?.n ?? i).join(' ')}`.toLowerCase(); if (!q.split(/\s+/).every((w) => hay.includes(w))) return false; }
      return true;
    });
    list = list.slice().sort((a, b) => st.sort === 'name' ? ITEMS[a.out].n.localeCompare(ITEMS[b.out].n) : st.sort === 'value' ? (ITEMS[b.out].v ?? 0) - (ITEMS[a.out].v ?? 0) : st.sort === 'atk' ? score(b) - score(a) : a.lvl - b.lvl || ITEMS[a.out].n.localeCompare(ITEMS[b.out].n));
    info.textContent = `${list.length} of ${recipes.length} items`;
    grid.replaceChildren(...(list.length ? list.map((r) => opts.card(r, { ok: opts.canMake?.(r) ?? true })) : [h('p', { class: 'dim', style: { gridColumn: '1 / -1', padding: '12px' } }, 'Nothing matches. Clear the search or a filter.')]));
  }
  const el = h('div', { class: 'browse' }, h('div', { class: 'bbar' }, search, sort, info), h('div', { class: 'bfilters' }, chipsRow, metalRow, toggles), grid);
  render(); return { el, refresh: render };
}

// A compact selectable card for the request picker.
export function pickCard(r, { selected, me, have, crafterLvl, onPick }) {
  const it = ITEMS[r.out], tooHigh = crafterLvl != null && r.lvl > crafterLvl;
  return h('button', { class: `icard ${selected ? 'sel' : ''} ${tooHigh ? 'dimmed' : ''}`, onclick: () => onPick(r), title: tooHigh ? `Needs craft level ${r.lvl}` : '' },
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } }, I.item(r.out, 32), h('div', { style: { minWidth: 0, textAlign: 'left' } }, h('b', { class: 'iname' }, it.n), h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } }, h('span', { class: `tag ${tooHigh ? 'r' : ''}` }, `Lv ${r.lvl}`), ...statChips(r.out)))),
    h('div', { class: 'row sb', style: { marginTop: '4px' } }, ingredientRow(r, have), fitIcons(r.out, me, 3)));
}
