// Custom crafting windows: effect pickers for the forge and the cauldron, plus the enchanting bench.
import { G } from './state.js';
import { ITEMS, RECIPES } from '../data.js';
import { scaledText } from '../gearscale.js';
import { GEAR_FX, DRAUGHT_FX, FLASK_FX, FORMS, FX_BY_FORM, craftSlots, craftTier, enchantSlots, effectUnlocked, canCustomise } from '../custom.js';
import { gearName, REAGENTS } from '../rules.js';
import { h } from '../ui-lib.js';
import * as I from './icons.js';
import { openWindow, closeWindow, refreshWindow } from './panels.js';

const send = (m) => G.net.send(m);
const count = (id) => G.me?.items?.[id] ?? 0;
const TIER = ['', 'Novice', 'Journeyman', 'Expert', 'Master'];
const costText = (cost) => Object.entries(cost).map(([id, n]) => `${n} ${ITEMS[id]?.n ?? id}`).join(', ');
const haveAll = (cost, base = {}) => Object.entries(cost).every(([id, n]) => count(id) >= n + (base[id] ?? 0));

// A picker used by both windows. table = effect table, filter = predicate on an effect, state = {picked:Set, max}
function picker(table, filter, state, base, refresh) {
  const tier = craftTier(G.me);
  return h('div', {}, [1, 2, 3, 4].map((t) => {
    const ids = Object.keys(table).filter((id) => table[id].tier === t && filter(table[id]));
    if (!ids.length) return null;
    const locked = t > tier;
    return h('div', { style: { marginBottom: '8px', opacity: locked ? 0.45 : 1 } }, h('div', { class: 'row' }, h('b', { class: locked ? 'dim' : 'gold' }, `${TIER[t]} effects`), locked ? h('span', { class: 'tag' }, t === 4 ? 'needs a Mastery (or mythic) · Lv 20' : `crafter tier ${t} needed`) : null),
      h('div', { class: 'grid g2', style: { gap: '6px' } }, ids.map((id) => {
        const fx = table[id], on = state.picked.has(id), afford = haveAll(fx.cost, base);
        return h('button', { class: 'card', disabled: locked, style: { textAlign: 'left', cursor: locked ? 'not-allowed' : 'pointer', boxShadow: on ? 'inset 0 0 0 2px var(--gold)' : undefined, opacity: afford || on ? 1 : 0.6 }, onclick: () => { if (on) state.picked.delete(id); else if (state.picked.size < state.max) state.picked.add(id); refresh(); } },
          h('b', {}, fx.name), h('div', { class: 'dim', style: { fontSize: '12px' } }, fx.text), h('div', { style: { fontSize: '11px', color: afford ? '#6fc08b' : '#e0645a' } }, costText(fx.cost)));
      })));
  }));
}

// ── Blacksmith: custom forge ────────────────────────────────────────────────
export function openCustomForge(r) {
  const me = G.me, it = ITEMS[r.out], state = { picked: new Set(), max: craftSlots(me), name: '' };
  const win = openWindow('customforge', `Custom forge: ${it.n}`, () => {
    const need = {}, cost = {}; for (const [id, n] of Object.entries(r.in)) need[id] = n;
    for (const id of state.picked) for (const [item, n] of Object.entries(GEAR_FX[id].cost)) cost[item] = (cost[item] ?? 0) + n;
    const ok = canCustomise(me) && Object.entries(r.in).every(([id, n]) => count(id) >= n) && haveAll(cost, need);
    return h('div', {},
      h('p', { class: 'dim' }, `Attach up to ${state.max} effect${state.max === 1 ? '' : 's'} to this ${it.n}. Each costs materials, and the more you add, the harder the forging. Good work makes the effects stronger; sloppy work can lose them. Your level and mastery decide how many and how powerful.`),
      h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'tag g' }, `Level ${me.level}`), h('span', { class: 'tag' }, `${TIER[craftTier(me)] || 'Apprentice'} smith`), h('span', { class: 'tag v' }, `${state.picked.size} / ${state.max} effects`)),
      picker(GEAR_FX, (fx) => fx.slots.includes(it.slot), state, need, () => win.render()),
      h('div', { class: 'card hl', style: { marginTop: '8px', position: 'sticky', bottom: '-14px', zIndex: 2, background: '#241a38' } }, h('div', { class: 'dim', style: { fontSize: '12px' } }, `Base: ${costText(r.in)}${Object.keys(cost).length ? ` · Effects: ${costText(cost)}` : ''}`),
        h('div', { class: 'row', style: { marginTop: '6px' } }, h('input', { placeholder: 'Name your creation (optional)', maxlength: 24, value: state.name, style: { flex: 1 }, oninput: (e) => { state.name = e.target.value; } }),
          h('button', { class: 'btn primary', disabled: !ok, onclick: () => { send({ t: 'craft.start', recipe: r.id, custom: { effects: [...state.picked], name: state.name } }); closeWindow('customforge'); } }, 'Forge it'))));
  }, { wide: true, icon: 'forge' });
}

// ── Alchemist: custom brew ──────────────────────────────────────────────────
let form = 'draught';
export function openCustomBrew() {
  const me = G.me, state = { picked: new Set(), max: craftSlots(me), name: '' };
  const win = openWindow('custombrew', 'Custom brew', () => {
    const table = FX_BY_FORM[form], max = form === 'essence' ? Math.max(1, Math.ceil(craftSlots(me) / 2)) : craftSlots(me); state.max = max;
    for (const id of [...state.picked]) if (!table[id]) state.picked.delete(id);
    const cost = {}; for (const id of state.picked) for (const [item, n] of Object.entries(table[id].cost)) cost[item] = (cost[item] ?? 0) + n;
    const ok = canCustomise(me) && count('herb') >= 2 && state.picked.size > 0 && haveAll(cost, { herb: 2 });
    return h('div', {},
      h('p', { class: 'dim' }, 'Combine effects into something nobody has brewed before. The base is 2 Marrow Herbs. More effects make the brew more volatile; clean stirring makes it stronger. Higher level and mastery unlock more effects and better ones.'),
      h('div', { class: 'row', style: { marginBottom: '8px' } }, Object.entries(FORMS).map(([id, f]) => h('button', { class: `btn small ${form === id ? 'gold' : ''}`, title: f.note, onclick: () => { form = id; state.picked.clear(); win.render(); } }, f.name)), h('span', { class: 'dim', style: { fontSize: '12px' } }, FORMS[form].note)),
      h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'tag g' }, `Level ${me.level}`), h('span', { class: 'tag' }, `${TIER[craftTier(me)] || 'Apprentice'} alchemist`), h('span', { class: 'tag v' }, `${state.picked.size} / ${max} effects`)),
      picker(table, () => true, state, { herb: 2 }, () => win.render()),
      h('div', { class: 'card hl', style: { marginTop: '8px', position: 'sticky', bottom: '-14px', zIndex: 2, background: '#241a38' } }, h('div', { class: 'dim', style: { fontSize: '12px' } }, `Base: 2 Marrow Herb${Object.keys(cost).length ? ` · Effects: ${costText(cost)}` : ''}`),
        h('div', { class: 'row', style: { marginTop: '6px' } }, h('input', { placeholder: 'Name it (optional)', maxlength: 24, value: state.name, style: { flex: 1 }, oninput: (e) => { state.name = e.target.value; } }),
          h('button', { class: 'btn primary', disabled: !ok, onclick: () => { send({ t: 'craft.custom', form, effects: [...state.picked], name: state.name, extras: [] }); closeWindow('custombrew'); } }, 'Start brewing'))));
  }, { wide: true, icon: 'cauldron' });
}

// ── Blacksmith: enchant at the forge using an Alchemist's essence ────────────
let selGear = null, selFlask = null;
export function enchantPanel(me) {
  const gear = me.gear, ess = (me.flasks ?? []).filter((f) => f.form === 'essence'), slots = enchantSlots(me);
  const g = gear.find((x) => x.uid === selGear), fl = ess.find((x) => x.uid === selFlask);
  return h('div', { class: 'card', style: { marginTop: '10px' } }, h('h3', {}, 'Enchanting'),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, `Pour an Alchemist's Essence into a weapon, armour or charm. You can hold ${slots} enchantment${slots === 1 ? '' : 's'} on a piece (level and mastery). Essences come only from Alchemists — find one and trade for it. A failed pour burns the essence but never harms the gear.`),
    ess.length ? h('div', { class: 'grid g2' },
      h('div', {}, h('b', {}, 'Gear'), gear.map((x) => h('label', { class: 'row', style: { margin: '2px 0' } }, h('input', { type: 'radio', name: 'engear', checked: selGear === x.uid, onchange: () => { selGear = x.uid; refreshWindow('craft'); } }), I.item(x.id, 20), h('span', {}, gearName(x)), h('span', { class: 'dim' }, ` ${(x.ench ?? []).length}/${slots}`)))),
      h('div', {}, h('b', {}, 'Essence'), ess.map((f) => h('label', { class: 'row', style: { margin: '2px 0' } }, h('input', { type: 'radio', name: 'enfl', checked: selFlask === f.uid, onchange: () => { selFlask = f.uid; refreshWindow('craft'); } }), I.ui('star', 20), h('span', {}, `${f.n}× ${f.name}`), h('span', { class: 'dim', style: { fontSize: '11px' } }, ` ${f.fx.map((e) => GEAR_FX[e.id]?.text).join(', ')}`)))))
      : h('p', { class: 'clue' }, 'You have no essences. Ask an Alchemist to brew one for you (Custom brew → Essence).'),
    ess.length ? h('button', { class: 'btn primary', disabled: !g || !fl, style: { marginTop: '8px' }, onclick: () => send({ t: 'enchant', gear: selGear, flask: selFlask }) }, 'Pour the essence') : null);
}

// Effect lines for a piece of gear (used by the bag and tooltips).
export function gearFxLines(g) {
  const out = []; if (g.by) out.push(`Forged by ${g.by}`);
  for (const e of g.fx ?? []) out.push(`${GEAR_FX[e.id]?.name ?? e.id}: ${scaledText(GEAR_FX[e.id]?.text ?? '', g.id)}`);
  for (const e of g.ench ?? []) out.push(`Enchanted · ${GEAR_FX[e.id]?.name ?? e.id}: ${scaledText(GEAR_FX[e.id]?.text ?? '', g.id)}`);
  return out;
}
export function flaskText(f) { const t = FX_BY_FORM[f.form === 'essence' ? 'essence' : f.form]; return f.fx.map((e) => `${t[e.id]?.name ?? e.id} (${t[e.id]?.text ?? ''})`).join('; '); }
