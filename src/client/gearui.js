// THE GEAR SCREENS: a paper doll with the seven slots (weapon, helmet, chestplate, leggings, boots, ring, charm) around a live preview of your
// character in what they wear, and a bag that is filtered by slot, sorted by "best first", and tells you at a glance which spare pieces beat
// what you have on. Pure rendering: every action is a message to the server.
import { ITEMS, qualityStatMult, fits, FIT_BONUS, HP_SCALE, gradeOf, CLASSES } from '../data.js';
import { SLOTS, SLOT_NAMES } from '../gearsets.js';
import { upMult, upLevel, upColor } from '../upgrade.js';
import { lookOf } from '../look.js';
import { gearName } from '../rules.js';
import { h } from '../ui-lib.js';
import * as I from './icons.js';
import { personSprite } from './sprites.js';
import { statChips } from './browse.js';
import { G } from './state.js';

const send = (m) => G.net.send(m);
let bagSlot = 'all', bagSort = 'best', bagQ = '', pickSlot = null;
const worn = (me) => new Set(Object.values(me.equip ?? {}).filter((x) => x != null));
// how good a piece is for this character: the same weighting "Equip best" uses on the server
export function gearScore(g, me) {
  const it = ITEMS[g.id]; if (!it) return 0; const q = qualityStatMult(g.q), m = q * upMult(g.up) * (fits(g.id, me.classId) ? 1 + FIT_BONUS : 1);
  return (it.atk ?? 0) * m + (it.def ?? 0) * m * 1.2 + (it.hp ?? 0) * m * 0.2 + (it.mp ?? 0) * q * m * 0.2 + (it.crit ?? 0) * 100 + (it.spd ?? 0) * 2 + ((g.fx?.length ?? 0) + (g.ench?.length ?? 0)) * 3;
}
const wornIn = (me, slot) => me.gear.find((x) => x.uid === me.equip?.[slot]) ?? null;
export const isBetter = (g, me) => { const slot = ITEMS[g.id]?.slot, cur = wornIn(me, slot); return !worn(me).has(g.uid) && (!cur || gearScore(g, me) > gearScore(cur, me) + 1e-6); };
export const betterCount = (me) => (me?.gear ?? []).filter((g) => isBetter(g, me)).length;

const statLine = (g) => h('span', { class: 'gstats' }, ...statChips(g.id, g.q));
const gradeColor = (g) => gradeOf(g.q).color;
function slotBox(me, slot, doll) {
  const g = wornIn(me, slot), sel = pickSlot === slot, spare = me.gear.filter((x) => ITEMS[x.id]?.slot === slot && !worn(me).has(x.uid)), better = spare.some((x) => isBetter(x, me));
  return h('button', { class: `dslot ${g ? '' : 'empty'} ${sel ? 'sel' : ''}`, title: g ? gearName(g) : `${SLOT_NAMES[slot]}: empty${spare.length ? ` (${spare.length} in your bag)` : ''}`, style: g ? { borderColor: upLevel(g) > 0 ? upColor(upLevel(g)) : gradeColor(g) } : null,
    onclick: () => { pickSlot = sel ? null : slot; if (!g) bagSlot = slot; doll.render(); } },
  h('span', { class: 'dslot-name' }, SLOT_NAMES[slot]), g ? I.item(g.id, 40) : h('span', { class: 'dslot-empty' }, '+'),
  g ? h('span', { class: 'dslot-n', style: { color: gradeColor(g) } }, upLevel(g) > 0 ? `+${upLevel(g)}` : '') : h('span', { class: 'dslot-n dim' }, spare.length ? `${spare.length} spare` : '—'), better ? h('i', { class: 'dslot-up', title: 'A spare piece here is better than what you wear' }, '▲') : null);
}
function preview(me) {
  const c = CLASSES[me.classId]; const seed = (me.name.length + me.name.charCodeAt(0)) | 0, spr = personSprite(me.classId, 'd', 0, seed, c.color, { look: lookOf(me) });
  const img = document.createElement('img'); img.src = spr.toDataURL(); img.className = 'doll-me'; img.alt = ''; img.draggable = false; return img;
}
// ── the paper doll ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function paperDoll(me, { gearLabel, gearStatText, onChange }) {
  const wrap = h('div', { class: 'doll-wrap' });
  const doll = { render() {
    const left = ['head', 'chest', 'legs', 'feet'], right = ['weapon', 'ring', 'charm'], u = me.unit;
    const g = pickSlot ? wornIn(me, pickSlot) : null;
    wrap.replaceChildren(
      h('div', { class: 'doll' }, h('div', { class: 'doll-col' }, ...left.map((s) => slotBox(me, s, doll))), h('div', { class: 'doll-mid' }, preview(me), h('div', { class: 'doll-totals' }, h('span', { class: 'tag g' }, `HP ${u.maxHp.toLocaleString('en-US')}`), h('span', { class: 'tag' }, `ATK ${Math.round(u.atk)}`), h('span', { class: 'tag' }, `DEF ${Math.round(u.def)}`), h('span', { class: 'tag' }, `MP ${u.maxMp}`))), h('div', { class: 'doll-col' }, ...right.map((s) => slotBox(me, s, doll)))),
      g ? h('div', { class: 'card doll-detail' }, h('div', { class: 'row sb' }, h('div', {}, gearLabel(g)), h('span', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn small ghost', onclick: () => G.openUpgrade?.(g.uid) }, 'Upgrade'), h('button', { class: 'btn small', onclick: () => { send({ t: 'inv.unequip', slot: pickSlot }); pickSlot = null; onChange?.(); } }, 'Unequip'))), h('div', { class: 'dim', style: { fontSize: '11px' } }, gearStatText(g))) : pickSlot ? h('div', { class: 'dim', style: { fontSize: '12px', margin: '6px 2px' } }, `${SLOT_NAMES[pickSlot]} slot is empty - the pieces you own for it are listed below.`) : h('div', { class: 'dim', style: { fontSize: '11px', margin: '6px 2px' } }, 'Click a slot to inspect it or to see the pieces that fit it.'));
  } };
  doll.render(); doll.el = wrap; return doll;
}

// ── the bag ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function bagPanel(me, { gearLabel, gearStatText, cmpRow, refresh }) {
  const wrap = h('div', { class: 'bag2' }), list = h('div', { class: 'bag-list' });
  const spare = () => me.gear.filter((g) => !worn(me).has(g.uid));
  const count = (s) => spare().filter((g) => s === 'all' || ITEMS[g.id]?.slot === s).length;
  const bar = h('div', { class: 'bagbar' });
  function paintList() {
    const q = bagQ.trim().toLowerCase();
    let items = spare().filter((g) => (bagSlot === 'all' || ITEMS[g.id]?.slot === bagSlot) && (!q || gearName(g).toLowerCase().includes(q)));
    items.sort((a, b) => bagSort === 'name' ? gearName(a).localeCompare(gearName(b)) : bagSort === 'slot' ? SLOTS.indexOf(ITEMS[a.id].slot) - SLOTS.indexOf(ITEMS[b.id].slot) || gearScore(b, me) - gearScore(a, me) : (isBetter(b, me) - isBetter(a, me)) || gearScore(b, me) - gearScore(a, me));
    list.replaceChildren(...(items.length ? items.map((g) => {
      const better = isBetter(g, me), slot = ITEMS[g.id]?.slot;
      return h('div', { class: `bcard2 ${better ? 'better' : ''}` }, I.item(g.id, 36),
        h('div', { class: 'bc-main' }, h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, gearLabel(g), h('span', { class: 'tag' }, SLOT_NAMES[slot] ?? slot), better ? h('span', { class: 'tag g' }, '▲ better than worn') : null), h('div', { class: 'dim', style: { fontSize: '11px' } }, gearStatText(g)), cmpRow(g, me)),
        h('span', { class: 'bc-btns' }, h('button', { class: 'btn small ghost', title: 'Upgrade this piece (+1 to +99)', onclick: () => G.openUpgrade?.(g.uid) }, 'Upgrade'), h('button', { class: `btn small ${better ? 'gold' : ''}`, onclick: () => { send({ t: 'inv.equip', uid: g.uid }); pickSlot = slot; } }, 'Equip')));
    }) : [h('p', { class: 'dim', style: { padding: '8px' } }, bagSlot === 'all' ? 'No spare gear. Smiths forge it; the Exchange sells it.' : `No spare ${SLOT_NAMES[bagSlot].toLowerCase()} pieces. Smiths forge them; the Exchange sells them.`)]));
  }
  function paintBar() {
    const chip = (s, label) => h('button', { class: `chip ${bagSlot === s ? 'on' : ''}`, onclick: () => { bagSlot = s; paintBar(); paintList(); } }, `${label} ${count(s)}`);
    bar.replaceChildren(h('div', { class: 'chips' }, chip('all', 'All'), ...SLOTS.map((s) => chip(s, SLOT_NAMES[s]))),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginTop: '4px' } }, h('input', { class: 'bsearch', type: 'search', placeholder: 'Search your gear…', value: bagQ, oninput: (e) => { bagQ = e.target.value; paintList(); } }),
        h('select', { class: 'bsort', onchange: (e) => { bagSort = e.target.value; paintList(); } }, [['best', 'Sort: best first'], ['slot', 'Sort: by slot'], ['name', 'Sort: name']].map(([v, l]) => h('option', { value: v, selected: bagSort === v }, l))),
        h('button', { class: 'btn small gold', title: 'Wear the strongest piece in every slot', onclick: () => send({ t: 'inv.best' }) }, `Equip best${betterCount(me) ? ` (${betterCount(me)} ▲)` : ''}`)));
  }
  paintBar(); paintList(); wrap.append(bar, list); void refresh; return wrap;
}
export const resetGearUi = () => { bagSlot = 'all'; pickSlot = null; };
