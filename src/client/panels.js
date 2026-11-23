// Windows opened by interacting with the world. Every action goes to the server;
// panels simply render the latest state the server sent. All icons are pixel sprites.
import { G, blockInput } from './state.js';
import { ITEMS, CLASSES, SKILLS, BASICS, RECIPES, HINTS, gradeOf, AFFIXES, qualityStatMult, TYPE_ICON, fitsOf, classGear, FIT_BONUS, HP_SCALE } from '../data.js';
import { scaledText } from '../gearscale.js';
import { upMult } from '../upgrade.js';
import { vendorBuyPrice, vendorSellPrice, TRADE_ITEMS } from '../economy.js';
import { heatStart, heatStep, heatBand, markerPos, strikeScore, isCrafter, lockedStack, freeStack, QUENCH, REAGENTS } from '../rules.js';
import { h, sleep, spark, fmt, toast } from '../ui-lib.js';
import * as I from './icons.js';
import { sfx } from './sfx.js';
import { prop } from './sprites.js';
import { skillsTab, ascendTab, deedsLog } from './skillsui.js';
import { createForgeStage } from './forgecanvas.js';
import { tradingTab, pendingForMe } from './tradeui.js';
import { browser, statChips, fitIcons } from './browse.js';
import { startTutorial } from './tutorial.js';
import { ACTIONS, keyOf, keyLabel, setKey, resetKeys, RESERVED } from './keys.js';
import { openCustomForge, openCustomBrew, enchantPanel, gearFxLines, flaskText } from './customui.js';
import { canCustomise } from '../custom.js';
import { gearName } from '../rules.js';
import * as L from '../loadout.js';

const send = (m) => G.net.send(m);
const count = (id) => G.me?.items?.[id] ?? 0;
const bigSprite = (canvas, px) => I.iconEl(canvas, px);

// ── window manager ──────────────────────────────────────────────────────────
const open = {};
export function openWindow(name, title, build, { wide = false, onClose = null, icon = null } = {}) {
  closeWindow(name);
  const body = h('div', { class: 'win-body' });
  const el = h('div', { class: `win ${wide ? 'wide' : ''}` }, h('div', { class: 'win-head' }, h('b', { class: 'row' }, icon ? I.ui(icon, 20) : null, title), h('button', { class: 'btn small ghost', onclick: () => closeWindow(name) }, 'X')), body);
  const back = h('div', { class: 'win-back' }, el);
  back.addEventListener('mousedown', (e) => { if (e.target === back) closeWindow(name); });
  document.body.append(back); blockInput(1);
  const w = { el: back, body, onClose, build }; w.render = () => { body.replaceChildren(build(w)); };
  open[name] = w; w.render(); return w;
}
export function closeWindow(name) { const w = open[name]; if (!w) return; delete open[name]; w.el.remove(); blockInput(-1); w.onClose?.(); }
export const isOpen = (n) => !!open[n];
export const closeAll = () => Object.keys(open).forEach(closeWindow);
export const refreshWindow = (n) => open[n]?.render();
export const topWindow = () => Object.keys(open).at(-1);

const itemLabel = (id, n) => h('span', { class: 'item' }, I.item(id, 22), n != null ? `${n}x ` : '', ITEMS[id].n);
export const gearLabel = (g) => { const gr = gradeOf(g.q), af = g.affix && AFFIXES.find((a) => a.id === g.affix); return h('span', { class: 'item' }, I.item(g.id, 22), h('span', { class: 'grade', style: { color: gr.color } }, gearName(g)), h('span', { class: 'dim' }, `(${gr.name} ${Math.round(g.q * 100)}%)`), g.by ? h('span', { class: 'tag g', title: g.crafted ? 'Your own creation: it can only be sold to a Merchant or used to fill an order.' : `Forged by ${g.by}` }, `forged by ${g.by}`) : null, (g.fx?.length || g.ench?.length) ? h('span', { class: 'tag v' }, `${(g.fx?.length ?? 0) + (g.ench?.length ?? 0)} effect${(g.fx?.length ?? 0) + (g.ench?.length ?? 0) === 1 ? '' : 's'}`) : null); };
// "What should I wear?" — derived from the same table that decides the +10% class-fit bonus.
function gearAdvice(me) {
  const g = classGear(me.classId), list = (a) => a.length ? a.join(', ') : '—';
  return h('div', { class: 'card', style: { margin: '8px 0', padding: '8px 12px' } }, h('b', {}, `Gear made for a ${CLASSES[me.classId].name}`), h('div', { style: { fontSize: '13px', marginTop: '3px' } }, `Weapons: ${list(g.weapon)}  ·  Armour: ${list(g.armor)}  ·  Charms: ${list(g.charm)}`),
    h('div', { class: 'dim', style: { fontSize: '12px' } }, `Gear made for your class gives +${Math.round(FIT_BONUS * 100)}% to its stats. Anything can be equipped — the bonus is the only difference. Metal tiers rise: Iron → Steel → Shadowsteel → Sunsteel → Moonsilver → Cinderforged → Aetherium.`));
}
let recAll = false;
// "better or worse than what I am wearing": the stat difference against the equipped piece in the same slot
function cmpRow(g, me) {
  const slot = ITEMS[g.id]?.slot, cur = me.gear.find((x) => x.uid === me.equip[slot]); if (!cur || cur.uid === g.uid) return null;
  const st = (x) => { const it = ITEMS[x.id], m = qualityStatMult(x.q) * upMult(x.up) * (fitsOf(x.id).includes(me.classId) ? 1 + FIT_BONUS : 1); return { ATK: (it.atk ?? 0) * m, DEF: (it.def ?? 0) * m, HP: (it.hp ?? 0) * m * HP_SCALE, MP: (it.mp ?? 0) * m }; };
  const a = st(g), b = st(cur), chips = Object.keys(a).filter((k) => Math.round(a[k]) !== Math.round(b[k])).map((k) => { const d = Math.round(a[k] - b[k]); return h('span', { style: { color: d > 0 ? '#8cffa0' : '#ff8a7a', marginRight: '6px', fontSize: '11px' } }, `${k} ${d > 0 ? '+' : ''}${d.toLocaleString('en-US')}`); });
  return chips.length ? h('div', { style: { marginTop: '1px' } }, h('span', { class: 'dim', style: { fontSize: '11px' } }, 'vs worn: '), ...chips) : null;
}
export function gearStatText(g) {
  const it = ITEMS[g.id], m = qualityStatMult(g.q) * upMult(g.up), out = [];
  if (g.up > 0) out.push(`Tempered +${g.up} (stats x${upMult(g.up).toFixed(2)})`);
  if (it.atk) out.push(`ATK +${(it.atk * m).toFixed(1)}`); if (it.def) out.push(`DEF +${(it.def * m).toFixed(1)}`); if (it.hp) out.push(`HP +${Math.round(it.hp * m * HP_SCALE)}`);
  if (it.mp) out.push(`MP +${Math.round(it.mp * m)}`); if (it.spd) out.push(`Speed +${Math.floor(it.spd * m)}`); if (it.wtype) out.push(`${it.wtype} (+10% dmg)`);
  const af = g.affix && AFFIXES.find((a) => a.id === g.affix); if (af) out.push(`${af.name}: ${scaledText(af.text, g.id)}`);
  out.push(...gearFxLines(g));
  const fl = fitsOf(g.id); if (fl.length) out.push(`Made for: ${fl.map((c) => CLASSES[c]?.name ?? c).join(', ')}${G.me && fl.includes(G.me.classId) ? ` — SUITS YOUR CLASS (+${Math.round(FIT_BONUS * 100)}% stats)` : ''}`);
  return out.join(' / ');
}

// ── character ───────────────────────────────────────────────────────────────
let charTab = 'overview';
export function openCharacter(tab) {
  if (tab) charTab = tab;
  openWindow('character', 'Character', () => {
    const me = G.me, cls = CLASSES[me.classId], u = me.unit;
    const tabs = h('div', { class: 'row', style: { marginBottom: '10px' } }, [['overview', 'Overview'], ['bag', 'Bag & Gear'], ['skills', 'Skills'], ['ascend', cls.mythic ? 'Mythic' : 'Ascension'], ['trading', pendingForMe() ? `Trading (${pendingForMe()} new)` : 'Trading'], ['guild', 'Guild'], ['journal', 'Journal']].map(([id, l]) => h('button', { class: `btn small ${charTab === id ? 'gold' : ''}`, onclick: () => { charTab = id; refreshWindow('character'); } }, l)));
    let body;
    if (charTab === 'overview') {
      body = h('div', {}, h('div', { class: 'row sb' }, h('h2', { class: 'row' }, I.cls(me.classId, 32), `${me.name} - ${cls.name}${cls.hidden ? ' (hidden)' : ''}`), h('span', { class: 'tag g' }, `Level ${me.level}`)),
        h('div', { class: 'bar xp', style: { margin: '4px 0 10px' } }, h('i', { style: { width: `${me.xpNeed ? (me.xp / me.xpNeed) * 100 : 100}%` } })),
        h('div', { class: 'row' }, h('span', { class: 'tag g' }, `HP ${u.maxHp}`), h('span', { class: 'tag' }, `MP ${u.maxMp}`), h('span', { class: 'tag' }, `ATK ${Math.round(u.atk)}`), h('span', { class: 'tag' }, `DEF ${Math.round(u.def)}`), h('span', { class: 'tag' }, `Speed x${u.move.toFixed(2)}`), h('span', { class: 'tag' }, `Damage x${u.dmgMult.toFixed(2)}`)),
        h('p', { class: 'dim' }, cls.desc), gearAdvice(me), cls.role ? h('p', {}, h('b', {}, 'Your place in the economy: '), cls.role) : null,
        isCrafter(me) ? h('p', { class: 'gold', style: { fontSize: '13px' } }, 'Crafter rule: you cannot list your creations on the Exchange or sell them to the vendor. Sell them to a Merchant, or fill a commission (Orders tab).') : null,
        cls.group === 'trade' && !isCrafter(me) ? h('p', { class: 'gold', style: { fontSize: '13px' } }, 'Merchant rule: post wholesale buy orders for crafters\' goods at the price you choose, then resell on the Exchange at any price.') : null,
        !cls.hidden ? h('p', { class: 'dim' }, 'Hidden classes exist. Nobody will tell you how to find them.') : null,
        h('div', { class: 'grid g2', style: { marginTop: '10px' } }, ...['weapon', 'armor', 'charm'].map((slot) => { const g = me.gear.find((x) => x.uid === me.equip[slot]); return h('div', { class: 'card' }, h('span', { class: 'tag' }, slot), ' ', g ? gearLabel(g) : h('span', { class: 'dim' }, 'empty'), g ? h('div', { class: 'dim', style: { fontSize: '11px' } }, gearStatText(g)) : null, g ? h('div', {}, h('button', { class: 'btn small ghost', onclick: () => send({ t: 'inv.unequip', slot }) }, 'Unequip')) : null); })));
    } else if (charTab === 'bag') {
      const bag = me.gear.filter((g) => !Object.values(me.equip).includes(g.uid));
      body = h('div', {}, h('div', { class: 'row sb' }, h('h3', {}, 'Gear'), h('button', { class: 'btn small gold', title: 'Wear the strongest piece in every slot', onclick: () => send({ t: 'inv.best' }) }, 'Equip best')), bag.length ? bag.map((g) => h('div', { class: 'row sb', style: { margin: '4px 0' } }, h('div', {}, gearLabel(g), h('div', { class: 'dim', style: { fontSize: '11px' } }, gearStatText(g)), cmpRow(g, me)), h('span', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn small ghost', title: 'Upgrade this piece (+1 to +99)', onclick: () => G.openUpgrade?.(g.uid) }, 'Upgrade'), h('button', { class: 'btn small', onclick: () => send({ t: 'inv.equip', uid: g.uid }) }, 'Equip')))) : h('p', { class: 'dim' }, 'No spare gear. Smiths forge it; the Exchange sells it.'),
        (me.flasks ?? []).length ? h('div', {}, h('h3', { style: { marginTop: '12px' } }, 'Custom potions'), me.flasks.map((f) => h('div', { class: 'row sb', style: { margin: '4px 0' } }, h('div', { class: 'row' }, I.iconEl(I.flaskIcon(f.form), 26), h('div', {}, h('b', {}, `${f.n}× ${f.name}`), ' ', h('span', { class: `tag ${f.form === 'essence' ? 'v' : 'g'}` }, f.form), f.by ? h('span', { class: 'tag g', title: `Brewed by ${f.by}` }, `brewed by ${f.by}`) : null, h('div', { class: 'dim', style: { fontSize: '11px' } }, flaskText(f)))), f.form === 'essence' ? h('span', { class: 'dim', style: { fontSize: '12px' } }, 'take to a Blacksmith') : h('span', { class: 'row' }, h('button', { class: 'btn small', onclick: () => send({ t: 'flask.use', uid: f.uid, a: 0 }) }, f.form === 'draught' ? 'Drink' : 'Throw'), h('button', { class: `btn small ${me.quickFlask === f.uid ? 'gold' : 'ghost'}`, title: 'Bind to hotkey 7', onclick: () => send({ t: 'flask.quick', uid: f.uid }) }, 'Key 7'))))) : null,
        h('h3', { style: { marginTop: '12px' } }, 'Satchel'), h('div', { class: 'row' }, Object.entries(me.items).map(([id, n]) => h('span', { class: 'tag item', title: ITEMS[id].desc ?? '' }, I.item(id, 18), ` ${ITEMS[id].n} x${n}`, ITEMS[id].skill ? h('button', { class: 'btn small gold', style: { marginLeft: '6px' }, onclick: () => send({ t: 'tome.read', id }) }, 'Read') : null, lockedStack(me, id) ? h('span', { class: 'gold' }, ` (${lockedStack(me, id)} yours)`) : null))));
    } else if (charTab === 'skills') {
      body = skillsTab(me);
    } else if (charTab === 'ascend') {
      body = ascendTab(me);
    } else if (charTab === 'trading') {
      body = tradingTab(me);
    } else if (charTab === 'guild') {
      if (!G.guildLoaded) { G.guildLoaded = true; send({ t: 'guild.info' }); }
      body = guildTab(me);
    } else {
      const found = HINTS.filter((x) => me.journal.includes(x.id)), st = me.stats, stat = (l, v) => h('tr', {}, h('td', { class: 'dim' }, l), h('td', {}, v));
      body = h('div', { class: 'grid g2' }, h('div', {}, h('h3', {}, 'Whispers & clues'), found.length ? found.map((x) => h('p', { class: 'clue' }, x.text)) : h('p', { class: 'dim' }, 'Nothing yet. Pay attention to what you do - and to what happens when you do too much of it.')),
        h('div', {}, h('h3', {}, 'Ledger'), h('table', {}, stat('Battles won', `${st.wins}/${st.battles}`), stat('Enemies felled', st.kills), stat('Kills at <25% HP', st.lowSpWins), stat('Gathered', st.gathered), stat('Crafted', st.crafted), stat('Masterwork+', st.masterworks), stat('Market takings', `${fmt(st.profit)}g`), stat('Haggles won', st.haggleWins), stat('Shadowfell visits', st.hollowVisits), stat('Duels won/lost', `${st.duelWins}/${st.duelLosses}`), stat('Distance walked', `${fmt(st.distance)} tiles`))));
    }
    if (charTab === 'journal') body.append(deedsLog(me));
    return h('div', {}, tabs, body);
  }, { wide: true, icon: 'bag' });
}

// ── dialogs ─────────────────────────────────────────────────────────────────
export function showDialog({ name, lines, actions = [] }) {
  let i = 0;
  openWindow('dialog', name, (w) => h('div', {}, h('p', { class: 'speech' }, lines[i]), h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
    i < lines.length - 1 ? h('button', { class: 'btn gold', onclick: () => { i++; w.render(); } }, 'Next') : [...actions.map((a) => h('button', { class: 'btn primary', onclick: () => { send(a.msg); closeWindow('dialog'); } }, a.label)), h('button', { class: 'btn gold', onclick: () => closeWindow('dialog') }, 'Goodbye')])), { icon: 'book' });
}
export function showSecret(m) {
  openWindow('secret', m.title, () => h('div', { class: 'secret-body' }, h('p', {}, m.text), h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } },
    h('button', { class: 'btn gold', onclick: () => { send({ t: 'hidden.unlock', id: m.id }); closeWindow('secret'); } }, m.label), h('button', { class: 'btn ghost', onclick: () => closeWindow('secret') }, 'Not yet'))), { icon: 'sparkle' });
}
export function showSecretDone(m) {
  openWindow('secretdone', `A hidden class awakens: ${m.name}`, () => h('div', { class: 'secret-body' }, h('p', {}, m.msg), h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn gold', onclick: () => closeWindow('secretdone') }, 'Continue'))), { icon: 'sparkle' });
}

// ── vendor & tavern ─────────────────────────────────────────────────────────
export function openVendor() {
  openWindow('vendor', 'Pell the Vendor', () => {
    const buy = TRADE_ITEMS.filter((id) => vendorSellPrice(id)), me = G.me;
    const sell = Object.entries(me.items).filter(([id]) => ITEMS[id].k !== 'quest' && freeStack(me, id) > 0);
    return h('div', { class: 'grid g2' },
      h('div', {}, h('h3', {}, 'Buy (steep prices - check the Exchange first)'), buy.map((id) => h('div', { class: 'row sb', style: { margin: '3px 0' } }, itemLabel(id), h('span', { class: 'row' }, h('span', { class: 'dim' }, `${vendorSellPrice(id)}g`), [1, 5, 10].map((n) => h('button', { class: 'btn small', onclick: () => send({ t: 'vendor.buy', itemId: id, qty: n }) }, `x${n}`)))))),
      h('div', {}, h('h3', {}, 'Sell (low prices)'), isCrafter(me) ? h('p', { class: 'dim', style: { fontSize: '12px' } }, 'The vendor will not buy guild-made goods from crafters. Sell those to a Merchant.') : null,
        sell.length ? sell.map(([id, n]) => h('div', { class: 'row sb', style: { margin: '3px 0' } }, itemLabel(id, freeStack(me, id)), h('span', { class: 'row' }, h('span', { class: 'dim' }, `${vendorBuyPrice(id)}g ea`), h('button', { class: 'btn small', onclick: () => send({ t: 'vendor.sell', itemId: id, qty: 1 }) }, 'x1'), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'vendor.sell', itemId: id, qty: freeStack(me, id) }) }, 'All')))) : h('p', { class: 'dim' }, 'Nothing to sell.'),
        me.gear.filter((g) => !Object.values(me.equip).includes(g.uid) && !(isCrafter(me) && g.crafted)).map((g) => h('div', { class: 'row sb', style: { margin: '3px 0' } }, gearLabel(g), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'vendor.sell', itemId: g.id, uid: g.uid }) }, `Sell ${vendorBuyPrice(g.id, g.q)}g`)))));
  }, { wide: true, icon: 'coin' });
}
export function openTavern() {
  openWindow('tavern', 'The Gilded Tankard', () => h('div', {}, h('p', { class: 'dim' }, 'Smoke, low talk, a fire that never quite warms the room. Rumours are the only honest currency here.'), h('button', { class: 'btn', onclick: () => send({ t: 'tavern.rumor' }) }, 'Buy a round & listen (15g)')), { icon: 'coin' });
}

// ── crafting stations ───────────────────────────────────────────────────────
let extras = new Set();
export function openCraft(family) {
  openWindow('craft', family === 'blacksmith' ? 'Forge & Anvil' : 'Alchemist\'s Cauldron', () => {
    const me = G.me, recs = RECIPES.filter((r) => r.craft === family && (!r.secret || me.flags?.[r.secret]) && (recAll || r.lvl <= me.level + 4 || r.smelt)).sort((a, b) => a.lvl - b.lvl || a.out.localeCompare(b.out));
    const canMake = (r) => me.level >= r.lvl && Object.entries(r.in).every(([id, n]) => count(id) >= n);
    const bw = browser({ key: `craft-${family}`, family, recipes: recs, me, have: count, canMake, card: (r) => {
      const it = ITEMS[r.out], locked = me.level < r.lvl, ok = canMake(r), fake = it.k === 'gear' ? { id: r.out, q: 0.5 } : null;
      return h('div', { class: 'card cc', style: { opacity: locked ? 0.5 : 1 } },
        h('div', { class: 'row sb' }, h('b', { class: 'row' }, I.item(r.out, 28), it.n), h('span', { class: 'tag' }, locked ? `Lv${r.lvl}` : r.smelt ? 'refine' : it.k === 'gear' ? 'gear' : it.k === 'key' ? 'key' : 'potion')),
        h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', margin: '4px 0' } }, ...statChips(r.out), fitIcons(r.out, me)),
        h('div', { style: { margin: '6px 0' } }, Object.entries(r.in).map(([id, n]) => h('div', { class: count(id) >= n ? '' : 'red' }, itemLabel(id, n), h('span', { class: 'dim' }, ` (have ${count(id)})`)))),
        fake ? h('div', { class: 'dim', style: { fontSize: '11px' } }, gearStatText(fake) + ' @50%') : (it.desc ?? r.desc) ? h('div', { class: 'dim', style: { fontSize: '11px' } }, it.desc ?? r.desc) : null,
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn primary', disabled: !ok, onclick: () => send({ t: 'craft.start', recipe: r.id, extras: [...extras] }) }, family === 'blacksmith' ? 'Forge' : 'Brew'), family === 'blacksmith' ? h('button', { class: 'btn small ghost', disabled: !ok, title: 'Skip the minigame (poor quality)', onclick: () => send({ t: 'craft.auto', recipe: r.id }) }, 'Auto') : null, family === 'blacksmith' && it.k === 'gear' ? h('button', { class: 'btn small gold', disabled: !ok || !canCustomise(me), title: canCustomise(me) ? 'Attach custom effects' : 'Custom work needs level 5', onclick: () => openCustomForge(r) }, 'Customize') : null));
    } });
    return h('div', {}, h('div', { class: 'row' }, bigSprite(prop(family === 'blacksmith' ? 'anvil' : 'cauldron', 0), 64), h('p', { class: 'dim' }, family === 'blacksmith' ? 'Stop the marker inside the glowing sweet spot. Quality sets the stats and the price of everything you forge. Remember: your creations can only be sold to Merchants or to players who order them.' : 'Add catalyst for more bottles - every addition raises the risk of a burst. Your brews can only be sold to Merchants or to players who order them.')),
      family === 'blacksmith' ? h('div', { class: 'card hl', style: { margin: '8px 0' } }, h('div', { class: 'row sb' }, h('div', {}, h('b', {}, 'Upgrade gear (+1 to +99)'), h('div', { class: 'dim', style: { fontSize: '12px' } }, 'Temper a piece again and again: heat, fold, engrave a rune, quench, polish. Each step is harder than the last.')), h('button', { class: 'btn gold', onclick: () => G.openUpgrade?.() }, 'Open the anvil'))) : null,
      family === 'alchemist' ? h('div', { class: 'card hl', style: { margin: '8px 0' } }, h('div', { class: 'row sb' }, h('div', {}, h('b', {}, 'Custom brewing'), h('div', { class: 'dim', style: { fontSize: '12px' } }, 'Draughts, thrown flasks and enchanting essences with effects you choose.')), h('button', { class: 'btn gold', disabled: !canCustomise(me), title: canCustomise(me) ? '' : 'Custom brewing needs level 5', onclick: () => openCustomBrew() }, 'Custom brew'))) : null,
      family === 'alchemist' ? h('div', { class: 'card', style: { margin: '8px 0' } }, h('b', {}, 'Reagents (optional, up to 2, consumed): '), h('span', { class: 'row', style: { display: 'inline-flex', marginLeft: '8px' } }, Object.entries(REAGENTS).map(([id, rg]) => h('button', { class: `btn small ${extras.has(id) ? 'gold' : 'ghost'}`, disabled: count(id) < 1, title: rg.note, onclick: () => { if (extras.has(id)) extras.delete(id); else if (extras.size < 2) extras.add(id); refreshWindow('craft'); } }, `${rg.name} x${count(id)}`)))) : null,
      h('div', { class: 'row', style: { margin: '4px 0' } }, h('button', { class: `btn small ${recAll ? 'gold' : 'ghost'}`, onclick: () => { recAll = !recAll; refreshWindow('craft'); } }, recAll ? 'Showing every recipe' : 'Showing recipes up to your level + 4 (click for all)')),
      bw.el, family === 'blacksmith' ? enchantPanel(me) : null);
  }, { wide: true, icon: family === 'blacksmith' ? 'forge' : 'cauldron' });
}

// ── forge: heat → hammer → quench ───────────────────────────────────────────
export function startForge(m) {
  const r = RECIPES.find((x) => x.id === m.recipe), spec = m.spec, hs = spec.heat;
  closeWindow('craft');
  const stageCv = createForgeStage();
  let phase = 'heat', raf = 0, t0 = performance.now(), locked = false;
  const times = []; let medium = null, quenchMs = 0;
  const stage = h('div', { class: 'fb-msg dim', style: { fontWeight: 700, minHeight: '28px', margin: '2px 0' } }), msg = h('div', { class: 'fb-msg dim', style: { minHeight: '40px', margin: '4px 0' } }), body = h('div', {});
  const zone = h('div', { class: 'fzone' }), mark = h('div', { class: 'fmark' }), fbar = h('div', { class: 'fbar', style: { display: 'none' } }, zone, mark);
  const hits = h('div', { class: 'row', style: { justifyContent: 'center' } });
  const act = h('button', { class: 'btn primary', style: { fontSize: '16px', padding: '10px 28px', touchAction: 'none' } }, '');
  const timeBar = h('div', { class: 'meter', style: { margin: '6px 0' } }, h('i', { style: { width: '0%' } }));
  // the thermometer (heat phase): a tall gauge with the perfect zone in the middle
  const tzone = h('div', { class: 'tzone' }), tmark = h('div', { class: 'tmark' }), thermo = h('div', { class: 'thermo' }, tzone, tmark, h('span', { class: 'tlbl t1' }, 'HOT'), h('span', { class: 'tlbl t2' }, 'COLD'));
  const row = h('div', { class: 'forge-row' }, stageCv.el, thermo);
  const close = () => { cancelAnimationFrame(raf); stageCv.destroy(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); removeEventListener('blur', release); };
  const root = h('div', {}, stage, row, fbar, timeBar, msg, body, hits, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, act));
  openWindow('forge', `${r.smelt ? 'Smelting' : 'Forging'}: ${ITEMS[r.out].n}`, () => root, { onClose: close, icon: 'forge' });
  const place = (c, half) => { zone.style.left = `${(c - half) * 100}%`; zone.style.width = `${half * 200}%`; };
  let holding = false, holdStart = 0, spaceDown = false, heatGo = false; const holds = [];   // heatGo: the heat clock only starts on the player's first Space press
  // A Space press made for the previous stage must never count for the next one: after every stage change inputs are ignored for a
  // moment, and if Space is still physically down it has to be released and pressed again.
  const gate = { until: 0, needUp: false }; const arm = (ms = 550) => { gate.until = performance.now() + ms; gate.needUp = spaceDown; };
  const press = () => {
    if (locked) return; const now = performance.now();
    if (phase === 'heat') { if (!heatGo) { heatGo = true; t0 = now; act.textContent = 'HOLD TO HEAT'; msg.textContent = 'HOLD Space to push the heat up, let go to let it sink. Keep the marker in the middle of the gold zone.'; } if (!holding) { holding = true; holdStart = Math.round(now - t0); sfx('step', 60); } return; }
    if (now < gate.until || gate.needUp) return;
    if (phase === 'hammer') strike(); else if (phase === 'quench') dunk();
  };
  const release = () => { if (phase === 'heat' && holding) { holding = false; holds.push([holdStart, Math.round(performance.now() - t0)]); } };
  const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { spaceDown = true; press(); } } };
  const ku = (e) => { if (e.code === 'Space') { e.preventDefault(); spaceDown = false; gate.needUp = false; release(); } };
  document.addEventListener('keydown', kd); document.addEventListener('keyup', ku); addEventListener('blur', () => { spaceDown = false; release(); });
  act.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); }); act.addEventListener('pointerup', release); act.addEventListener('pointerleave', release);

  // 1 · HEAT ─ gravity cools the billet; HOLD Space to push it up. Start in the middle of the perfect zone and keep it there.
  function startHeat() {
    phase = 'heat'; t0 = performance.now(); thermo.style.display = ''; tzone.style.bottom = `${(hs.center - hs.half) * 100}%`; tzone.style.height = `${hs.half * 200}%`;
    stage.textContent = '1 / 3 · HEAT THE BILLET'; stage.style.color = '#ffb84a'; msg.textContent = 'Get ready — take your time. The heat starts the moment you first press Space. Then HOLD Space to push it up, let go to let it sink, and keep the marker in the middle of the gold zone.'; act.textContent = 'PRESS SPACE TO BEGIN'; fbar.style.display = 'none';
    const st = heatStart(hs); let stepT = 0;
    const loop = (now) => {
      const el = heatGo ? now - t0 : 0;
      while (stepT < el && stepT < hs.dur) { heatStep(hs, st, holding, stepT); stepT += 20; }
      const pos = st.pos, d = Math.abs(pos - hs.center), band = heatBand(hs, pos);
      tmark.style.bottom = `${pos * 100}%`; tmark.style.opacity = heatGo ? 1 : 0.5 + 0.5 * Math.sin(now / 220); tmark.style.background = band === 1 ? '#fff2b0' : band >= 0.75 ? '#ffd36a' : pos < hs.center ? '#6a9aff' : '#ff4a3a';
      stageCv.setHeat(0.25 + 0.75 * Math.max(0, 1 - d / (hs.half * 3))); stageCv.setFire(holding ? 1 : 0.35);
      timeBar.firstChild.style.width = `${Math.min(100, Math.round((el / hs.dur) * 25) * 4)}%`;
      if (heatGo && el >= hs.dur) { release(); cancelAnimationFrame(raf); thermo.style.display = 'none'; tmark.style.opacity = 1; startHammer(); return; } raf = requestAnimationFrame(loop);
    }; raf = requestAnimationFrame(loop);
  }
  // 2 · HAMMER ─ strike when the marker crosses the zone; the smith swings for real
  let n = 0, center = spec.centers[0], lastStrike = -999;
  function startHammer() {
    phase = 'hammer'; t0 = performance.now(); arm(600); stage.textContent = '2 / 3 · HAMMER'; stage.style.color = '#d8cdbd'; msg.textContent = 'Strike when the marker crosses the zone! (Space / click)'; msg.style.color = ''; act.textContent = 'STRIKE!'; fbar.style.display = ''; place(center, spec.half); mark.style.background = '#fff'; timeBar.firstChild.style.width = '0%';
    const loop = (now) => { mark.style.left = `${Math.round(markerPos(spec, now - t0) * 50) * 2}%`; raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  }
  function strike() {
    const t = performance.now() - t0; if (t - lastStrike < 320) return; lastStrike = t;
    const pos = markerPos(spec, t), sc = strikeScore(pos, center, spec.half); times.push(Math.round(t)); n++;
    stageCv.strike(sc); setTimeout(() => sfx('anvil', 60), 125);
    for (let i = 0; i < 10; i++) { const sp = h('div', { class: 'spark', style: { left: `${pos * 100}%`, top: '50%', '--dx': `${Math.round((rnd() - 0.5) * 30) * 4}px`, '--dy': `${Math.round((rnd() - 0.7) * 18) * 4}px` } }); fbar.append(sp); setTimeout(() => sp.remove(), 650); }
    const label = sc >= 1 ? ['PERFECT!', '#ffd36a'] : sc > 0.6 ? ['Good', '#6fc08b'] : sc > 0.2 ? ['Weak', '#d8cdbd'] : ['Miss...', '#e0645a'];
    msg.textContent = label[0]; msg.style.color = label[1]; hits.append(h('span', { class: 'tag', style: { color: label[1] } }, `${Math.round(sc * 100)}%`));
    if (n >= spec.strikes) { cancelAnimationFrame(raf); phase = 'wait'; setTimeout(startQuench, 700); return; }
    center = spec.centers[n]; place(center, spec.half);
  }
  // 3 · QUENCH ─ choose the bath (it decides the temper), then dunk it at the right moment
  function startQuench() {
    phase = 'choose'; stage.textContent = '3 / 3 · QUENCH'; stage.style.color = '#7fd8ff'; msg.textContent = 'Choose the bath. It decides what the metal becomes.'; msg.style.color = ''; act.style.display = 'none'; fbar.style.display = 'none'; timeBar.style.display = 'none'; hits.replaceChildren();
    body.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'center', alignItems: 'stretch' } }, Object.entries(QUENCH).map(([id, q]) => h('button', { class: 'card', style: { textAlign: 'left', width: '170px', cursor: 'pointer' }, onclick: () => pick(id) }, h('b', {}, q.name), h('div', { class: 'dim', style: { fontSize: '12px', marginTop: '4px' } }, q.note)))));
  }
  function pick(id) {
    medium = id; phase = 'quench'; arm(500); body.replaceChildren(); fbar.style.display = ''; act.style.display = ''; act.textContent = 'DUNK!'; t0 = performance.now(); place(spec.quench.center, spec.quench.half * QUENCH[id].half); mark.style.background = '#7fd8ff'; msg.textContent = `Dunk it in the ${QUENCH[id].name.toLowerCase()} when the marker is in the zone!`;
    const loop = (now) => { mark.style.left = `${Math.round(markerPos(spec.quench, now - t0) * 50) * 2}%`; raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  }
  function dunk() {
    sfx('hiss', 100); const t = performance.now() - t0; quenchMs = Math.round(t); cancelAnimationFrame(raf); phase = 'done'; act.disabled = true;
    const sc = strikeScore(markerPos(spec.quench, t), spec.quench.center, spec.quench.half * QUENCH[medium].half); stageCv.quench(sc > 0.4); msg.textContent = sc >= 0.9 ? 'Hiss! A perfect quench.' : sc > 0.4 ? 'It holds.' : 'Cracked… it may have lost something.'; msg.style.color = sc > 0.4 ? '#7fd8ff' : '#e0645a';
    setTimeout(() => send({ t: 'craft.finish', times, heat: holds, quench: quenchMs, medium }), 700);
  }
  startHeat();
}
const rnd = Math.random;

// ── cauldron: press Space to begin → 3-2-1 → stir on the bells → catalysts → bottle ──────────────────────────────────────────────────
export function startBrew(m) {
  const custom = m.custom ?? null, r = RECIPES.find((x) => x.id === m.recipe) ?? { out: 'heal_potion' }; closeWindow('craft');
  const ST = m.stir ?? { beats: 6, interval: 850, window: 260 }, total = (ST.beats + 1) * ST.interval, beatAt = (i) => (i + 1) * ST.interval;
  let b = m.b, done = false, frame = 0, phase = b.stirred ? 'cat' : 'ready', raf = 0, t0 = 0, combo = 0, bestCombo = 0, spaceDown = false; const taps = [], res = Array(ST.beats).fill(null), bellEls = [], resEls = [];   // res[i] = { s: score 0..1, kind, d: ms offset }
  const caul = h('div', { class: 'cauldron' }), pot = h('div', { class: 'row', style: { justifyContent: 'center' } }), fill = h('i'), msg = h('div', { class: 'fb-msg dim', style: { minHeight: '22px' } }), stage = h('div', { class: 'fb-msg dim', style: { fontWeight: 700 } });
  const paintCaul = () => caul.replaceChildren(bigSprite(prop('cauldron', frame % 3), 112));
  // the rhythm track: six numbered bells, a smooth marker, a result under every bell and a tick wherever you stirred
  const track = h('div', { class: 'btrack' }), mark = h('div', { class: 'bmark' }), cd = h('div', { class: 'bcount' });
  for (let i = 0; i < ST.beats; i++) { const x = `${((i + 1) / (ST.beats + 1)) * 100}%`, wid = `${(ST.window / total) * 200}%`; const zone = h('div', { class: 'bzone', style: { left: x, width: wid } }), bell = h('div', { class: 'bbell', style: { left: x } }, h('span', {}, `${i + 1}`)), rs = h('div', { class: 'bres', style: { left: x } }, ''); bellEls.push(bell); resEls.push(rs); track.append(zone, bell, rs); }
  track.append(mark, cd);
  const comboEl = h('div', { class: 'bcombo' }, ''), purEl = h('span', { class: 'tag v' }, 'Purity 0%'), bellN = h('span', { class: 'tag' }, `Bell 0 / ${ST.beats}`), pops = h('div', { class: 'bpops' });
  const stirBtn = h('button', { class: 'btn primary', style: { fontSize: '16px', padding: '10px 28px', touchAction: 'none' } }, 'PRESS SPACE TO BEGIN');
  const guide = h('div', { class: 'card bguide' }, h('div', {}, h('b', { class: 'gold' }, 'How to stir'), ' — it is a rhythm game:'), h('ol', {}, h('li', {}, 'Press ', h('b', {}, 'SPACE'), ' (or the button) to begin. A 3-2-1 countdown follows.'), h('li', {}, 'A glowing marker sweeps across ', h('b', {}, '6 purple bells'), '. Press SPACE just as it is over a bell.'), h('li', {}, 'Each bell is scored on its own — the closer, the better. ', h('b', { class: 'gold' }, 'Purity'), ' sets how strong and stable the potion is.')));
  const add = h('button', { class: 'btn primary', onclick: () => { add.disabled = true; send({ t: 'brew.add' }); } }, 'Add catalyst'), stop = h('button', { class: 'btn gold', onclick: () => { add.disabled = stop.disabled = true; send({ t: 'brew.bottle' }); } }, 'Bottle it');
  const tags = h('div', { class: 'row', style: { justifyContent: 'center', margin: '4px 0' } }), riskEl = h('div', { class: 'brisk' });
  const meter = h('div', {}, h('div', { class: 'row sb dim', style: { fontSize: '12px' } }, h('span', {}, 'Stability'), h('span', {}, 'About to burst')), h('div', { class: 'meter' }, fill));
  const riskNow = () => { const lvl = G.me?.level ?? 1, step = Math.min(0.13, Math.max(0.07, 0.13 - lvl * 0.004)); return b.instab <= 0 ? 0 : Math.min(0.95, b.instab + step); };
  const paint = () => {
    pot.replaceChildren(...Array.from({ length: Math.min(5, b.potency) }, () => (custom ? I.iconEl(I.flaskIcon(custom.form), 32) : I.item(r.out, 32)))); fill.style.width = `${Math.min(100, Math.round(b.instab * 25) * 4)}%`; add.disabled = done || b.potency >= 5;
    const risk = Math.round(riskNow() * 100); riskEl.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'center', gap: '18px' } }, h('span', {}, 'Bottles ', h('b', { class: 'gold', style: { fontSize: '18px' } }, `${b.potency}`), h('span', { class: 'dim' }, ' / 5')), h('span', {}, 'Burst risk for the next catalyst ', h('b', { style: { fontSize: '18px', color: risk < 20 ? '#6fc08b' : risk < 40 ? '#ffd36a' : '#e0645a' } }, `${risk}%`))));
    add.textContent = b.potency >= 5 ? 'Cauldron is full' : `Add catalyst (+1 bottle, ${risk}% burst)`; stop.textContent = `Bottle it (keep ${b.potency})`;
    tags.replaceChildren(...[...(b.extras ?? []).map((id) => h('span', { class: 'tag g' }, `+ ${ITEMS[id].n}`)), b.stirred ? h('span', { class: 'tag v' }, `Purity ${Math.round((b.purity ?? 0) * 100)}%`) : null].filter(Boolean));
  };
  const body = h('div', {});
  const setPhase = () => {
    if (phase === 'ready') { stage.textContent = '1 / 2 · STIR IN RHYTHM'; stage.style.color = '#a98ad8'; msg.textContent = 'Take your time — nothing starts until you press SPACE.'; body.replaceChildren(guide, track, h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px', margin: '6px 0' } }, bellN, purEl, comboEl), pops, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '8px' } }, stirBtn)); }
    else if (phase === 'cat') { stage.textContent = '2 / 2 · CATALYSTS (press your luck)'; stage.style.color = '#6fc08b'; msg.style.color = ''; msg.textContent = 'Each catalyst adds a bottle but risks the whole batch bursting. Bottle it whenever you are happy.'; body.replaceChildren(h('div', { class: 'card bguide' }, 'Stirring is done. Now decide how greedy to be: every catalyst you add gives ', h('b', { class: 'gold' }, '+1 bottle'), ' (up to 5) but raises the chance the cauldron ', h('b', { class: 'red' }, 'bursts and ruins everything'), '. ', h('b', {}, 'Bottle it'), ' to keep what you have.'), riskEl, meter, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, add, stop)); paint(); }
  };
  const key = (e) => { if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && !spaceDown) { spaceDown = true; press(); } } }, keyUp = (e) => { if (e.code === 'Space') spaceDown = false; };
  document.addEventListener('keydown', key); document.addEventListener('keyup', keyUp); stirBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
  const anim = setInterval(() => { frame++; paintCaul(); }, 300);
  openWindow('brew', `Brewing ${custom ? custom.name : ITEMS[r.out].n}`, () => h('div', {}, stage, caul, pot, tags, msg, body), { onClose: () => { clearInterval(anim); cancelAnimationFrame(raf); document.removeEventListener('keydown', key); document.removeEventListener('keyup', keyUp); }, icon: 'cauldron' });
  setPhase(); paint(); paintCaul();
  const pop = (text, color, big) => { const p = h('div', { class: `bpop${big ? ' big' : ''}`, style: { color } }, text); pops.append(p); setTimeout(() => p.remove(), 900); if (pops.children.length > 4) pops.firstChild.remove(); };
  const liveScore = () => res.reduce((a, x) => a + (x ? x.s : 0), 0) / ST.beats;
  const paintLive = () => { const hit = res.filter((x) => x && x.s > 0).length, passed = res.filter((x, i) => x || performance.now() - t0 > beatAt(i) + ST.window).length; purEl.textContent = `Purity ${Math.round(liveScore() * 100)}%`; bellN.textContent = `Bell ${Math.min(ST.beats, passed)} / ${ST.beats} · ${hit} hit`; comboEl.textContent = combo >= 2 ? `COMBO x${combo}` : ''; comboEl.className = `bcombo${combo >= 2 ? ' on' : ''}`; };
  const setBell = (i, v) => { res[i] = v; const rs = resEls[i], be = bellEls[i]; be.className = `bbell ${v.kind}`; rs.className = `bres ${v.kind}`; rs.textContent = v.kind === 'miss' ? 'MISS' : v.kind === 'perfect' ? 'PERFECT' : v.d < 0 ? 'EARLY' : 'LATE'; };
  function press() {
    if (phase === 'ready') { phase = 'count'; stirBtn.disabled = true; stirBtn.textContent = 'GET READY…'; msg.textContent = 'Watch the marker — stir when it is over a bell.'; msg.style.color = ''; let n = 3; const tick = () => { cd.textContent = n > 0 ? `${n}` : 'STIR!'; cd.className = 'bcount on'; sfx('bubble', 90); if (n === 0) { setTimeout(() => { cd.className = 'bcount'; }, 450); go(); return; } n--; setTimeout(tick, 560); }; tick(); return; }
    if (phase === 'stir') tap();
  }
  function go() {
    phase = 'stir'; stirBtn.disabled = false; stirBtn.textContent = 'STIR!'; t0 = performance.now();
    const loop = (now) => { const t = now - t0, k = Math.min(1, t / total); mark.style.left = `${(k * 100).toFixed(3)}%`;
      for (let i = 0; i < ST.beats; i++) { if (!res[i] && t > beatAt(i) + ST.window) { setBell(i, { s: 0, kind: 'miss', d: 0 }); combo = 0; pop('Missed bell ' + (i + 1), '#e0645a'); } const near = Math.abs(t - beatAt(i)) < ST.window; bellEls[i].classList.toggle('near', near && !res[i]); }
      paintLive(); if (k >= 1) { finishStir(); return; } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  }
  function tap() {
    if (phase !== 'stir') return; const t = performance.now() - t0; if (taps.length && t - taps.at(-1) < 150) return; taps.push(Math.round(t)); frame++; paintCaul(); caul.classList.remove('burst');
    let bi = 0; for (let i = 1; i < ST.beats; i++) if (Math.abs(t - beatAt(i)) < Math.abs(t - beatAt(bi))) bi = i; const d = t - beatAt(bi), ad = Math.abs(d), s = ad <= ST.window ? 1 - ad / ST.window : 0;
    const tick = h('div', { class: 'btick', style: { left: `${Math.min(100, (t / total) * 100).toFixed(2)}%`, background: s === 0 ? '#e0645a' : ad < ST.window * 0.35 ? '#ffd36a' : '#6fc08b' } }); track.append(tick); setTimeout(() => tick.remove(), 1400);
    if (s === 0) { sfx('step', 70); combo = 0; pop('Off the beat…', '#e0645a'); return; }
    const kind = ad < ST.window * 0.35 ? 'perfect' : 'good', prev = res[bi]; if (!prev || s > prev.s) setBell(bi, { s, kind, d });
    if (kind === 'perfect') { combo++; bestCombo = Math.max(bestCombo, combo); sfx('pickup', 70); pop(combo >= 2 ? `PERFECT x${combo}!` : 'PERFECT!', '#ffd36a', true); } else { combo = 0; sfx('bubble', 80); pop(`Good — ${d < 0 ? 'a little early' : 'a little late'}`, '#6fc08b'); }
    bellEls[bi].classList.remove('hit'); void bellEls[bi].offsetWidth; bellEls[bi].classList.add('hit'); paintLive();
  }
  function finishStir() { if (phase !== 'stir') return; phase = 'wait'; cancelAnimationFrame(raf); stirBtn.disabled = true; stirBtn.textContent = 'Done!'; msg.style.color = '#a98ad8'; msg.textContent = `Stirring finished — purity ${Math.round(liveScore() * 100)}%${bestCombo >= 2 ? `, best combo x${bestCombo}` : ''}.`; send({ t: 'brew.stir', taps }); }
  return { state(nb) { b = nb; if (phase !== 'cat') { phase = 'cat'; setPhase(); } else { msg.textContent = b.potency >= 5 ? 'The cauldron brims. Bottle it!' : 'It holds… add another or bottle it.'; msg.style.color = '#6fc08b'; } paint(); }, burst() { caul.classList.add('burst'); msg.textContent = 'BOOM!'; msg.style.color = '#e0645a'; } };
}
export function showCraftResult(m, brewCtl) {
  const finish = () => {
    closeWindow('forge'); closeWindow('brew');
    const body = m.kind === 'forge'
      ? h('div', {}, h('h2', { class: 'row' }, m.gear ? I.item(m.gear.id, 32) : null, m.gear ? `${ITEMS[m.gear.id].n}` : m.items[0]), h('div', { class: 'grade-big', style: { color: m.grade.color } }, m.grade.name.toUpperCase()), m.fxApplied?.length ? h('p', { class: 'gold', style: { textAlign: 'center' } }, `Effects: ${m.fxApplied.join(', ')}`) : null, m.fxLost?.length ? h('p', { class: 'red', style: { textAlign: 'center' } }, `Lost in the forging: ${m.fxLost.join(', ')}`) : null, m.scores?.medium ? h('p', { class: 'dim', style: { textAlign: 'center' } }, `Heat ${Math.round(m.scores.heat * 100)}% · Quench ${Math.round(m.scores.quench * 100)}% · ${QUENCH[m.scores.medium].name} bath`) : null, h('p', { class: 'dim', style: { textAlign: 'center' } }, `Quality ${Math.round(m.q * 100)}%${m.gear?.affix ? ' - Resonance: ' + AFFIXES.find((a) => a.id === m.gear.affix)?.name : ''}${m.levelUps.length ? ` - Level ${m.levelUps.at(-1)}!` : ''}`), m.gear ? h('p', { class: 'dim', style: { textAlign: 'center', fontSize: '12px' } }, gearStatText(m.gear)) : null, h('p', { class: 'gold', style: { textAlign: 'center', fontSize: '12px' } }, 'This is your creation: sell it to a Merchant or fill an order with it.'))
      : h('div', {}, h('h2', {}, m.burst ? 'Ruined batch' : 'Bottled!'), h('p', { style: { textAlign: 'center', fontSize: '20px' } }, m.burst ? 'Nothing salvageable.' : m.items[0]), !m.burst && m.potency ? h('p', { class: 'dim', style: { textAlign: 'center' } }, `Purity ${Math.round((m.purity ?? 0) * 100)}% · potion strength ×${m.potency.toFixed(2)}`) : null, m.levelUps.length ? h('p', { class: 'gold', style: { textAlign: 'center' } }, `Level ${m.levelUps.at(-1)}!`) : null);
    openWindow('craftresult', 'Result', () => h('div', {}, body, h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn gold', onclick: () => closeWindow('craftresult') }, 'Done'))));
  };
  if (m.burst && brewCtl) { brewCtl.burst(); setTimeout(finish, 1000); } else finish();
}

// ── haggling ────────────────────────────────────────────────────────────────
export function startHaggle(m) {
  closeWindow('dialog');
  let H = m;
  const offerEl = h('div', { class: 'offer' }), mood = h('div', { class: 'dim', style: { textAlign: 'center', minHeight: '20px' } });
  const dp = h('div', { class: 'die' }, h('span', {}, '?')), dc = h('div', { class: 'die' }, h('span', {}, '?'));
  const bC = h('button', { class: 'btn', onclick: () => go('charm') }, 'Charm (1d6) - safe'), bP = h('button', { class: 'btn', onclick: () => go('press') }, 'Press (2d6) - risky'), bA = h('button', { class: 'btn gold', onclick: () => send({ t: 'haggle.accept' }) }, 'Accept offer');
  const paint = () => { offerEl.textContent = `${Math.round(H.base * H.mult)}g`; mood.textContent = `Round ${Math.min(H.round + 1, H.maxRounds)}/${H.maxRounds} - fair value ${Math.round(H.base)}g${H.ceil ? ` - ceiling ~${Math.round(H.base * H.ceil)}g` : ''}`; };
  openWindow('haggle', `${m.name} wants ${m.label}`, () => h('div', {}, h('p', { class: 'dim' }, 'Both sides roll. Win to push the price up; lose and it slips. Press doubles the stakes. Merchants add their level to every roll.'), offerEl, h('div', { class: 'dice-big' }, h('div', { style: { textAlign: 'center' } }, h('div', { class: 'dim' }, 'You'), dp), h('b', { class: 'gold' }, 'VS'), h('div', { style: { textAlign: 'center' } }, h('div', { class: 'dim' }, m.name), dc)), mood, h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, bC, bP, bA)), { icon: 'coin' });
  paint();
  async function tumble(el, v) { el.classList.remove('win', 'lose'); el.classList.add('rolling'); const t = performance.now(); while (performance.now() - t < 550) { el.firstChild.textContent = 1 + Math.floor(Math.random() * 12); await sleep(50); } el.classList.remove('rolling'); el.firstChild.textContent = v; }
  function go(stance) { [bC, bP, bA].forEach((b) => (b.disabled = true)); send({ t: 'haggle.round', stance }); }
  return {
    async round(msg) {
      await Promise.all([tumble(dp, msg.r.pr), tumble(dc, msg.r.cr)]);
      (msg.r.win > 0 ? dp : msg.r.win < 0 ? dc : null)?.classList.add('win'); (msg.r.win > 0 ? dc : msg.r.win < 0 ? dp : null)?.classList.add('lose');
      H = { ...H, ...msg.h }; paint(); mood.textContent = msg.r.win > 0 ? `You win the exchange! (+${Math.round(msg.r.step * 100)}%)` : msg.r.win < 0 ? `They hold firm. (${Math.round(msg.r.step * 100)}%)` : 'Stalemate.';
      if (!msg.h.over) [bC, bP, bA].forEach((b) => (b.disabled = false));
    },
    done(msg) { setTimeout(() => { closeWindow('haggle'); toast(msg.msg, msg.ok ? 'good' : 'bad'); }, 700); },
  };
}

// ── exchange: market, my listings, orders board ─────────────────────────────
G.seen = { main: null, hollow: null };
let exSel = 'iron_ore', exFilter = 'all', exView = 'market';
let draft = { itemId: 'iron_sword', qty: 1, price: 0, minQ: 40, target: '' };
const trendArrow = (t) => (t > 0.04 ? I.ui('arrow_up', 14) : t < -0.04 ? I.ui('arrow_down', 14) : h('span', { class: 'dim' }, '-'));
export function openExchange(view) {
  G.market = view; G.seen[view.id] = { fair: view.fair, day: view.day };
  openWindow('exchange', view.id === 'main' ? 'Lanternfall Exchange' : 'Shadow Bazaar', () => buildExchange(), { wide: true, onClose: () => { G.market = null; }, icon: 'scales' });
}
export function updateExchange(view) { G.market = view; G.seen[view.id] = { fair: view.fair, day: view.day }; if (isOpen('exchange') && !document.activeElement?.closest?.('.win-body input, .win-body select')) refreshWindow('exchange'); }
function buildExchange() {
  const v = G.market, me = G.me, other = v.id === 'main' ? 'hollow' : 'main', myOrders = v.orders.filter((o) => o.mine).length;
  const nav = h('div', { class: 'row', style: { marginBottom: '8px' } }, [['market', 'Market'], ['orders', `Orders (${v.orders.length})`], ['mine', `My listings (${v.listings.filter((l) => l.mine).length})`]].map(([id, l]) => h('button', { class: `btn small ${exView === id ? 'gold' : ''}`, onclick: () => { exView = id; refreshWindow('exchange'); } }, l)),
    h('span', { style: { flex: 1 } }), h('span', { class: 'dim', style: { fontSize: '12px' } }, `Fee ${(v.fee * 100).toFixed(1)}% - Day ${v.day}${myOrders ? ` - ${myOrders} open order(s)` : ''}`));
  const head = h('div', { class: 'card', style: { marginBottom: '8px', padding: '8px 12px' } }, h('div', { class: 'row sb' }, h('div', {}, h('b', {}, 'News: '), v.news.join(' ')), h('div', { class: 'row' }, v.events.map((e) => h('span', { class: 'tag v', title: e.text }, `${e.bump > 0 ? 'UP' : 'DOWN'} ${e.id} (${e.days}d)`)))),
    v.id === 'hollow' ? h('div', { class: 'dim', style: { fontSize: '12px' } }, 'Everything is reflected here: mundane goods fetch a fortune, Shadowfell goods go cheap. Carry goods through the gate to profit.') : null);
  return h('div', {}, head, nav, exView === 'mine' ? exMine(v) : exView === 'orders' ? exOrders(v, me) : exMarket(v, other, me));
}
function exMarket(v, other, me) {
  const filters = [['all', 'All'], ['mat', 'Materials'], ['inter', 'Refined'], ['gear', 'Gear'], ['cons', 'Potions'], ['key', 'Keys']];
  const ids = TRADE_ITEMS.filter((id) => exFilter === 'all' || ITEMS[id].k === exFilter);
  if (!ids.includes(exSel)) exSel = ids[0];
  const supply = (id) => v.listings.filter((l) => l.itemId === id).reduce((n, l) => n + l.qty, 0), seenOther = G.seen[other];
  const rows = ids.map((id) => {
    const ls = v.listings.filter((l) => l.itemId === id).sort((a, b) => a.price - b.price), best = ls[0], ratio = best ? best.price / best.val : null, o = seenOther?.fair?.[id], gap = o ? o / v.fair[id] : null;
    return h('tr', { class: `clk ${exSel === id ? 'sel' : ''}`, onclick: () => { exSel = id; refreshWindow('exchange'); } }, h('td', {}, itemLabel(id)), h('td', { class: 'row' }, `${Math.round(v.fair[id])}g`, trendArrow(v.trend[id])), h('td', {}, spark(v.history[id] ?? [v.fair[id]], 60, 16)), h('td', { class: 'dim' }, supply(id)),
      h('td', {}, best ? h('span', { class: ratio < 0.9 ? 'green' : '' }, `${best.price}g`) : h('span', { class: 'dim' }, '-')),
      h('td', { class: 'dim', title: `Last seen in the ${other === 'main' ? 'Exchange' : 'Shadow Bazaar'} (day ${seenOther?.day ?? '?'})` }, o ? h('span', { class: gap > 1.5 ? 'green' : gap < 0.67 ? 'red' : '' }, `${Math.round(o)}g`) : '-'),
      v.hint ? h('td', {}, v.hint[id] > 0 ? I.ui('arrow_up', 14) : v.hint[id] < 0 ? I.ui('arrow_down', 14) : h('span', { class: 'dim' }, '-')) : null);
  });
  const it = ITEMS[exSel], ls = v.listings.filter((l) => l.itemId === exSel).sort((a, b) => a.price - b.price);
  const detail = h('div', { class: 'card' }, h('h2', { class: 'row' }, I.item(exSel, 32), it.n),
    h('div', { class: 'dim', style: { fontSize: '12px' } }, `Fair ${Math.round(v.fair[exSel])}g${it.k === 'gear' ? ' (50% quality)' : ''} - NPC vendor buys ${vendorBuyPrice(exSel)}g${vendorSellPrice(exSel) ? ` - sells ${vendorSellPrice(exSel)}g` : ''}`),
    h('h3', { style: { marginTop: '8px' } }, 'Listings'),
    ls.length ? h('table', {}, h('tr', {}, ['Seller', it.k === 'gear' ? 'Quality' : 'Qty', 'Price', 'vs fair', ''].map((x) => h('th', {}, x))), ...ls.slice(0, 9).map((l) => {
      const r = l.price / l.val, gr = l.q != null ? gradeOf(l.q) : null;
      return h('tr', {}, h('td', { class: l.mine ? 'gold' : l.bot ? '' : 'green' }, l.mine ? 'You' : l.seller + (l.bot ? '' : ' *')), h('td', {}, gr ? h('span', { style: { color: gr.color }, title: [l.x?.by ? `Forged by ${l.x.by}` : '', ...gearFxLines({ ...l.x })].filter(Boolean).join('\n') }, `${gr.name} ${Math.round(l.q * 100)}%`, l.x?.by ? h('span', { class: 'tag g', style: { marginLeft: '4px' } }, `by ${l.x.by}`) : null, (l.x?.fx?.length || l.x?.ench?.length) ? h('span', { class: 'tag v', style: { marginLeft: '4px' } }, 'fx') : null) : l.qty), h('td', {}, `${l.price}g`), h('td', { class: r < 0.9 ? 'green' : r > 1.15 ? 'red' : 'dim' }, `${r < 1 ? '' : '+'}${Math.round((r - 1) * 100)}%`),
        h('td', {}, l.mine ? null : h('span', { class: 'row' }, h('button', { class: 'btn small', onclick: () => send({ t: 'market.buy', id: l.id, qty: 1 }) }, 'Buy'), l.qty > 1 ? h('button', { class: 'btn small ghost', onclick: () => send({ t: 'market.buy', id: l.id, qty: l.qty }) }, `All ${l.qty}`) : null)));
    })) : h('div', { class: 'dim' }, 'No listings. Be the first.'),
    h('div', { class: 'dim', style: { fontSize: '11px', marginTop: '4px' } }, '* = listed by another player'),
    h('h3', { style: { marginTop: '10px' } }, 'Your stock'), sellPanel(v, exSel));
  return h('div', { class: 'grid exgrid' },
    h('div', {}, h('div', { class: 'row', style: { marginBottom: '6px' } }, filters.map(([f, l]) => h('button', { class: `btn small ${exFilter === f ? 'gold' : 'ghost'}`, onclick: () => { exFilter = f; refreshWindow('exchange'); } }, l))),
      h('div', { class: 'card', style: { padding: '4px 8px', maxHeight: '52vh', overflow: 'auto' } }, h('table', {}, h('tr', {}, ['Item', 'Fair', 'Trend', 'Supply', 'Cheapest', other === 'main' ? 'Town' : 'Shadow', v.hint ? 'Tmrw' : null].filter(Boolean).map((x) => h('th', {}, x))), ...rows))), detail);
}
function sellPanel(v, id) {
  const it = ITEMS[id], me = G.me;
  if (it.k === 'quest') return h('div', { class: 'dim' }, 'Quest items cannot be traded.');
  const lockedNote = isCrafter(me) && (lockedStack(me, id) || me.gear.some((g) => g.id === id && g.crafted)) ? h('div', { class: 'gold', style: { fontSize: '12px', margin: '4px 0' } }, 'Your own creations cannot be listed here. Sell them to a Merchant, or deliver them to an order (Orders tab).') : null;
  if (it.k === 'gear') {
    const mine = me.gear.filter((g) => g.id === id); if (!mine.length) return h('div', { class: 'dim' }, 'You have none.');
    return h('div', {}, lockedNote, mine.map((g) => { const eq = Object.values(me.equip).includes(g.uid), lock = isCrafter(me) && g.crafted, val = Math.round(v.fair[id] * (0.7 + 0.9 * g.q) / (0.7 + 0.45)), price = h('input', { type: 'number', value: val, min: 1, style: { width: '84px' } }); return h('div', { class: 'row', style: { margin: '4px 0' } }, gearLabel(g), eq ? h('span', { class: 'tag g' }, 'equipped') : lock ? null : [price, h('button', { class: 'btn small', onclick: () => send({ t: 'market.list', itemId: id, uid: g.uid, price: +price.value }) }, 'List')]); }));
  }
  const have = freeStack(me, id); if (!count(id)) return h('div', { class: 'dim' }, 'You have none.');
  if (!have) return h('div', {}, lockedNote);
  const qty = h('input', { type: 'number', value: have, min: 1, max: have, style: { width: '64px' } }), price = h('input', { type: 'number', value: Math.round(v.fair[id]), min: 1, style: { width: '84px' } });
  return h('div', {}, lockedNote, h('div', { class: 'dim' }, `You can list ${have}.`), h('div', { class: 'row', style: { marginTop: '4px' } }, 'Qty', qty, 'Price each', price, h('button', { class: 'btn small', onclick: () => send({ t: 'market.list', itemId: id, qty: Math.min(have, Math.max(1, +qty.value)), price: +price.value }) }, 'List for sale')),
    me.classId === 'merchant' || me.classId === 'broker' ? h('div', { class: 'dim', style: { fontSize: '11px' } }, 'As a Merchant you set the resale price - any price you like.') : null);
}
function exMine(v) {
  const mine = v.listings.filter((l) => l.mine);
  return h('div', { class: 'card' }, h('h2', {}, 'Your listings'), mine.length ? h('table', {}, h('tr', {}, ['Item', 'Qty', 'Price', 'vs fair', 'Age', ''].map((x) => h('th', {}, x))), ...mine.map((l) => { const r = l.price / l.val; return h('tr', {}, h('td', {}, l.q != null ? gearLabel({ id: l.itemId, q: l.q, affix: l.affix }) : itemLabel(l.itemId)), h('td', {}, l.qty), h('td', {}, `${l.price}g`), h('td', { class: r < 0.9 ? 'green' : r > 1.2 ? 'red' : 'dim' }, `${r < 1 ? '' : '+'}${Math.round((r - 1) * 100)}%`), h('td', { class: 'dim' }, `${l.age}d`), h('td', {}, h('button', { class: 'btn small', onclick: () => send({ t: 'market.cancel', id: l.id }) }, 'Cancel'))); }))
    : h('p', { class: 'dim' }, 'Nothing listed. Pick an item and list it - real players browse this board too. Price too high and nobody bites; too low and sharp-eyed traders snap it up.'));
}

// The Orders board: how crafters' creations reach other players.
function exOrders(v, me) {
  const crafter = isCrafter(me), merchant = me.classId === 'merchant' || me.classId === 'broker';
  const have = (o) => { const it = ITEMS[o.itemId]; return it.k === 'gear' ? me.gear.filter((g) => g.id === o.itemId && g.q >= o.minQ && !Object.values(me.equip).includes(g.uid)).length : count(o.itemId); };
  const rules = crafter ? 'You are a crafter: your creations cannot be listed on the Exchange or sold to the vendor. Deliver them to a Merchant\'s WHOLESALE order, or to a COMMISSION a player requested from you.' : merchant ? 'You are a Merchant: post WHOLESALE orders at the price YOU choose to buy crafters\' goods, then list them on the Exchange at any resale price.' : 'Post a COMMISSION to request something from a crafter (name them to commission one specific crafter). Your gilt is held in escrow until it is delivered.';
  const open = v.orders.slice().sort((a, b) => (b.forMe ? 1 : 0) - (a.forMe ? 1 : 0) || a.itemId.localeCompare(b.itemId));
  const table = open.length ? h('table', {}, h('tr', {}, ['From', 'Type', 'Wants', 'Qty', 'Pays each', ''].map((x) => h('th', {}, x))), ...open.map((o) => {
    const it = ITEMS[o.itemId], n = have(o), blocked = o.target && !o.forMe && !o.mine;
    return h('tr', { class: o.forMe ? 'sel' : '' }, h('td', { class: o.mine ? 'gold' : '' }, o.mine ? 'You' : o.by), h('td', {}, h('span', { class: `tag ${o.kind === 'wholesale' ? 'g' : o.kind === 'bot' ? '' : 'v'}` }, o.kind === 'bot' ? 'merchant' : o.kind), o.target ? h('div', { class: 'dim', style: { fontSize: '10px' } }, o.forMe ? 'for YOU' : `for ${o.target}`) : null),
      h('td', {}, itemLabel(o.itemId), it.k === 'gear' && o.minQ > 0 ? h('span', { class: 'dim' }, ` ${Math.round(o.minQ * 100)}%+`) : null), h('td', {}, `${o.left}/${o.qty}`), h('td', {}, o.scaled ? h('span', { title: 'Bot merchants pay by quality' }, `~${o.price}g`) : `${o.price}g`),
      h('td', {}, o.mine ? h('button', { class: 'btn small', onclick: () => send({ t: 'order.cancel', id: o.id }) }, 'Cancel') : blocked ? h('span', { class: 'dim' }, 'private') : h('span', { class: 'row' }, h('button', { class: 'btn small primary', disabled: !n, title: n ? '' : 'You have nothing that fits', onclick: () => send({ t: 'order.fill', id: o.id, qty: 1 }) }, 'Deliver'), n > 1 ? h('button', { class: 'btn small', onclick: () => send({ t: 'order.fill', id: o.id, qty: Math.min(n, o.left) }) }, `x${Math.min(n, o.left)}`) : null)));
  })) : h('p', { class: 'dim' }, 'No open orders.');
  // post form
  if (!draft.price) draft.price = Math.round(v.fair[draft.itemId] ?? 50);
  const isGear = ITEMS[draft.itemId]?.k === 'gear';
  let postBtn = null; const updPost = () => { if (!postBtn) return; const t = draft.qty * draft.price; postBtn.textContent = `Post order (${fmt(t)}g escrow)`; postBtn.disabled = me.gilt < t; };
  const sel = h('select', { id: 'ord-item', onchange: (e) => { draft.itemId = e.target.value; draft.price = Math.round(v.fair[draft.itemId] ?? 50); refreshWindow('exchange'); } }, TRADE_ITEMS.map((id) => h('option', { value: id, selected: id === draft.itemId }, ITEMS[id].n)));
  const qty = h('input', { id: 'ord-qty', type: 'number', min: 1, max: 50, value: draft.qty, style: { width: '58px' }, oninput: (e) => { draft.qty = Math.max(1, Math.min(50, Math.round(+e.target.value) || 1)); updPost(); } });
  const price = h('input', { id: 'ord-price', type: 'number', min: 1, value: draft.price, style: { width: '84px' }, oninput: (e) => { draft.price = Math.max(1, Math.round(+e.target.value) || 1); updPost(); } });
  const minq = h('input', { id: 'ord-minq', type: 'number', min: 0, max: 99, value: draft.minQ, style: { width: '58px' }, disabled: !isGear, oninput: (e) => { draft.minQ = Math.max(0, Math.min(99, +e.target.value || 0)); } });
  const tgt = h('input', { id: 'ord-target', placeholder: 'any crafter', value: draft.target, style: { width: '110px' }, disabled: merchant, oninput: (e) => { draft.target = e.target.value; } });
  const total = draft.qty * draft.price;
  const form = h('div', { class: 'card' }, h('h3', {}, merchant ? 'Post a wholesale order' : 'Post a commission'), h('div', { class: 'row' }, sel, 'Qty', qty, 'Pay each', price, isGear ? ['Min quality %', minq] : null, merchant ? null : ['Crafter', tgt]),
    h('div', { class: 'row', style: { marginTop: '8px' } }, (postBtn = h('button', { class: 'btn primary', disabled: me.gilt < total, onclick: () => send({ t: 'order.post', itemId: draft.itemId, qty: draft.qty, price: draft.price, minQ: draft.minQ / 100, target: draft.target }) }, `Post order (${fmt(total)}g escrow)`)), h('span', { class: 'dim', style: { fontSize: '12px' } }, `Fair value ${Math.round(v.fair[draft.itemId] ?? 0)}g. ${merchant ? 'Bots pay crafters about 60% of fair value; beat that to win their goods.' : 'Offer a fair price - crafters choose which orders to fill.'}`)));
  return h('div', {}, h('p', { class: crafter || merchant ? 'gold' : 'dim', style: { fontSize: '13px' } }, rules), h('div', { class: 'grid exgrid' }, h('div', { class: 'card', style: { maxHeight: '48vh', overflow: 'auto' } }, h('h2', {}, 'Open orders'), table), form));
}

// ── help ────────────────────────────────────────────────────────────────────
// ── keybinds: click an action, press the key you want ──────────────────────────────────────────────
export function openKeybinds() {
  let waiting = null, note = '';
  const win = openWindow('keys', 'Keybinds', () => h('div', {},
    h('p', { class: 'dim' }, 'Click an action, then press the key you want for it. If that key already belongs to another action, the two swap. Movement (WASD / arrows) and the window keys (I J H M P K, Enter, Esc) are fixed. Left-click always attacks.'),
    h('div', { class: 'grid g2' }, ACTIONS.map((a) => h('div', { class: 'card row sb', style: { padding: '8px 10px' } }, h('span', {}, a.label),
      h('button', { class: `btn small ${waiting === a.id ? 'gold' : ''}`, style: { minWidth: '84px' }, onclick: () => { waiting = a.id; note = 'Press a key… (Esc to cancel)'; win.render(); } }, waiting === a.id ? '…' : keyLabel(keyOf(a.id)))))),
    note ? h('p', { class: 'gold', style: { marginTop: '8px' } }, note) : null,
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn small ghost', onclick: () => { resetKeys(); note = 'Back to the defaults.'; waiting = null; win.render(); } }, 'Reset to defaults'), h('button', { class: 'btn small', onclick: () => closeWindow('keys') }, 'Done'))), { icon: 'help', onClose: () => document.removeEventListener('keydown', cap, true) });
  function cap(e) {
    if (!waiting) return; e.preventDefault(); e.stopPropagation(); const k = e.key.toLowerCase();
    if (k === 'escape') { waiting = null; note = ''; return win.render(); }
    if (['shift', 'control', 'alt', 'meta'].includes(k) && k !== 'shift') return;
    const r = setKey(waiting, k); note = r.ok ? (r.swapped ? `Bound. It swapped with "${r.swapped}".` : 'Bound.') : r.why; if (r.ok) waiting = null; win.render();
  }
  document.addEventListener('keydown', cap, true);
}
export function openHelp() {
  openWindow('help', 'How to play', () => h('div', {},
    h('div', { class: 'grid g2' },
      h('div', {}, h('h3', {}, 'Controls'), h('p', {}, h('kbd', {}, 'WASD'), ' move  /  ', h('b', {}, 'mouse'), ' aim  /  ', h('kbd', {}, 'Left-click'), ' (hold) attack'), h('p', {}, h('kbd', {}, '1'), '-', h('kbd', {}, '4'), ' skills at your cursor  /  ', h('kbd', {}, 'Space'), ' dodge roll (brief invulnerability)  /  ', h('button', { class: 'btn small', onclick: () => openKeybinds() }, 'Change keybinds (K)'), ' ', h('button', { class: 'btn small', onclick: () => { closeWindow('help'); startTutorial(G.me, true); } }, 'Replay the tutorial')),
        h('p', {}, h('kbd', {}, '5'), ' health potion  /  ', h('kbd', {}, '6'), ' mana potion  /  ', h('kbd', {}, 'E'), ' interact (doors open by themselves)'), h('p', {}, h('kbd', {}, 'Enter'), ' chat  /  ', h('kbd', {}, 'I'), ' character  /  ', h('kbd', {}, 'J'), ' journal  /  right-click a player for trade, party, duel'),
        h('h3', {}, 'Getting around'), h('p', { class: 'dim' }, h('kbd', {}, 'N'), ' world map (fog of war; "Track route" puts a gold arrow at the edge of your screen pointing to the next exit)  /  ', h('kbd', {}, 'L'), ' adventure log: every region has goals that pay gilt and XP  /  ', h('kbd', {}, 'B'), ' recall to Lanternfall (5 s standing still, 10 min cooldown).'),
        h('h3', {}, 'Upgrading gear'), h('p', { class: 'dim' }, 'A Blacksmith can temper any piece from +0 to +99 at a forge (Bag > Upgrade): heat, fold, engrave a rune, quench, polish. Others ask a Blacksmith: Character > Trading > Upgrade my gear. Each step is harder than the last; the piece, materials and fee are held safely until the work is done.'),
        h('h3', {}, 'PvP and guild wars'), h('p', { class: 'dim' }, 'Press P to flag yourself for PvP (level 5+): other flagged players within 10 levels can fight you outside safe zones, and a PvP death costs no gilt. You cannot stand down for 15 s after a fight. A guild leader can declare WAR on another guild: enemy members are fair game anywhere outside safe zones, first to 25 kills or the most kills in 30 minutes wins, and the winner takes 10% of the loser\'s guild bank.'), h('h3', {}, 'Combat'), h('p', { class: 'dim' }, 'Real-time. Enemies chase you and telegraph every attack with a red shape on the ground - step out or roll through it. Skills cost mana and have cooldowns.')),
      h('div', {}, h('h3', {}, 'The economy'), h('p', { class: 'dim' }, 'Fighters bring back ore, hides, herbs and ink. Blacksmiths and Alchemists make goods but may NOT sell them on the open Exchange: they sell to Merchants, or fill commissions other players post. Merchants buy wholesale at prices they choose and resell at any price.'),
        h('h3', {}, 'The Shadowfell'), h('p', { class: 'dim' }, 'A shadow world behind a sealed gate. It has its own monsters, materials and market, and it drains your mana. Someone will have to forge the key...')))), { wide: true, icon: 'help' });
}

export function showLegends(list) {
  openWindow('legends', 'Hall of Legends', () => h('div', {}, h('p', { class: 'dim' }, 'Some powers can be held by one person only, ever. Their names are carved here once they are claimed.'),
    list.map((m) => h('div', { class: 'card', style: { margin: '6px 0', borderColor: m.color } }, h('div', { class: 'row sb' }, h('b', { style: { color: m.color } }, m.name), m.holder ? h('span', { class: 'tag g' }, `held by ${m.holder}`) : h('span', { class: 'tag' }, 'unclaimed'))))), { icon: 'sparkle' });
}

export function openWaystone(m) {
  openWindow('waystone', 'Waystone', () => h('div', {}, h('p', { class: 'dim' }, `The stones remember every stone you have touched. A crossing costs ${m.cost}g. Not in combat.`),
    m.list.length ? m.list.map((w) => h('div', { class: 'row sb card', style: { margin: '4px 0' } }, h('div', { class: 'row' }, I.ui('star', 20), h('b', {}, w.name), w.lvl ? h('span', { class: 'tag' }, `Lv ${w.lvl}+`) : null), w.id === m.here ? h('span', { class: 'tag g' }, 'you are here') : h('button', { class: 'btn small gold', onclick: () => { send({ t: 'waystone.go', id: w.id }); closeWindow('waystone'); } }, 'Travel'))) : h('p', { class: 'dim' }, 'Only this one so far.'),
    h('p', { class: 'clue', style: { fontSize: '12px' } }, 'Find more waystones as you explore. Each is attuned the first time you touch it.')), { icon: 'star' });
}

// ── raid gate, bounty board, guild, leaderboards ────────────────────────────
export function openRaid(m) {
  const st = m.status;
  openWindow('raid', m.name, () => h('div', {}, h('p', { class: 'speech' }, 'Beyond this gate the Ember Tyrant waits in the heart of Cinderhold Bastion. It does not fight alone, and it does not fight fair.'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'tag g' }, `Level ${st.minLevel}+`), h('span', { class: 'tag' }, st.solo ? 'solo world: 1 player is enough' : 'needs a party of 2+ standing together'), h('span', { class: 'tag v' }, 'three phases')),
      h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Phase 1: the Tyrant alone. Phase 2 (66%): it calls its brood. Phase 3 (33%): it burns itself down — faster, angrier. Every raider who survives is rewarded with gilt, XP, a Tyrant-forged piece of gear with a tier-3 effect, and a chance at a Skill Tome and starmetal. A wipe resets the fight.'),
      st.busy ? h('p', { class: 'red' }, `The Bastion is occupied by ${st.by}'s raid.`) : null),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, h('button', { class: 'btn primary', disabled: st.busy, onclick: () => { send({ t: 'raid.enter' }); closeWindow('raid'); } }, 'Enter the Bastion'), h('button', { class: 'btn ghost', onclick: () => closeWindow('raid') }, 'Not yet'))), { icon: 'forge' });
}
export function openRaid2(m) {
  const st = m.status;
  openWindow('raid2', m.name, () => h('div', {}, h('p', { class: 'speech' }, st.blurb),
    h('div', { class: 'card' }, h('div', { class: 'row', style: { flexWrap: 'wrap' } }, h('span', { class: 'tag g' }, `Level ${st.minLevel}+`), h('span', { class: 'tag' }, st.solo ? 'solo world: 1 player is enough' : `a party of 2-${st.size} standing together`), h('span', { class: 'tag v' }, `${st.wings.length} wings`), h('span', { class: 'tag' }, `title: ${st.title}`)),
      ...st.wings.map((w, i) => h('div', { class: 'row sb', style: { margin: '6px 0', alignItems: 'flex-start' } }, h('div', {}, h('b', { style: { color: st.color } }, `Wing ${i + 1} — ${w.name}`), h('div', { class: 'dim', style: { fontSize: '12px' } }, w.bosses.join(' & ') + (w.link ? ' (linked: kill them close together)' : ''))), h('span', { class: 'tag' }, `Lv ${w.lvl}`))),
      h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Every wing is a separate fight with phases: servants, falling stars, enrages and shields. Each cleared wing rewards gilt, XP and a chance at raid-forged gear with a powerful effect, tomes and starmetal; the last boss drops the best. If everyone falls, the raid resets.'),
      st.busy ? h('p', { class: 'red' }, `Occupied by ${st.by}'s raid (wing ${st.wing}).`) : null),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, h('button', { class: 'btn primary', disabled: st.busy, onclick: () => { send({ t: 'raid2.enter', raid: st.id }); closeWindow('raid2'); } }, 'Enter the raid'), h('button', { class: 'btn ghost', onclick: () => closeWindow('raid2') }, 'Not yet'))), { icon: 'forge' });
}
export function openBounty(m) {
  openWindow('bounty', 'Bounty Board', () => {
    const mine = m.list.filter((b) => b.accepted && !b.claimed), offers = m.list.filter((b) => !b.accepted && !b.claimed);
    const card = (b) => h('div', { class: 'card', style: { margin: '6px 0' } }, h('div', { class: 'row sb' }, h('div', {}, h('b', {}, b.text), h('div', { class: 'dim', style: { fontSize: '12px' } }, `${b.accepted ? `${b.got} / ${b.need} · ` : ''}reward ${fmt(b.gilt)}g + ${fmt(b.xp)} XP`)),
      b.accepted ? h('span', { class: 'row' }, h('button', { class: 'btn small gold', disabled: b.got < b.need, onclick: () => send({ t: 'bounty.claim', id: b.id }) }, 'Claim'), h('button', { class: 'btn small ghost', title: 'Give this one up', onclick: () => { if (confirm('Abandon this bounty and its progress?')) send({ t: 'bounty.abandon', id: b.id }); } }, 'Abandon'))
        : h('button', { class: 'btn small primary', onclick: () => send({ t: 'bounty.accept', id: b.id }) }, 'Accept')),
      b.accepted ? h('div', { class: 'bar xp', style: { height: '6px', marginTop: '6px' } }, h('i', { style: { width: `${Math.min(100, (b.got / b.need) * 100)}%` } })) : null);
    return h('div', {},
      h('p', { class: 'dim' }, `Accept a bounty to start it — accepted bounties and promised customer orders never expire. The board offers a fresh set in about ${Math.max(1, Math.round(m.resetIn / 3600000))}h; offers you have not accepted are replaced.`),
      h('h3', {}, `Your bounties (${mine.length}/6)`), mine.length ? mine.map(card) : h('p', { class: 'dim' }, 'None yet — accept one below. Progress counts wherever you are.'),
      (m.promises ?? []).length ? [h('h3', { style: { marginTop: '10px' } }, 'Promised customer orders'), (m.promises ?? []).map((q) => h('div', { class: 'card', style: { margin: '6px 0' } }, h('div', { class: 'row sb' }, h('div', {}, h('b', {}, `${q.who} wants ${ITEMS[q.itemId]?.n ?? q.itemId}${q.minQ ? ` (${Math.round(q.minQ * 100)}%+)` : ''}`), h('div', { class: 'dim', style: { fontSize: '12px' } }, `pays ${fmt(q.pay)}g · kept ${Math.max(1, Math.round((q.until - Date.now()) / 3600000)) > 72 ? 72 : Math.max(1, Math.round((q.until - Date.now()) / 3600000))}h (approx.)`)),
        h('span', { class: 'row' }, h('button', { class: 'btn small gold', disabled: !q.have, title: q.have ? '' : 'You do not have one that fits', onclick: () => send({ t: 'promise.deliver', id: q.id }) }, 'Deliver'), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'promise.cancel', id: q.id }) }, 'Drop')))))] : null,
      h('h3', { style: { marginTop: '10px' } }, 'Today\'s offers'), offers.length ? offers.map(card) : h('p', { class: 'dim' }, 'Nothing new right now.'));
  }, { icon: 'book' });
}
// Guild war panel: the live score, or (for a leader) a picker to declare war on another guild.
function warCard(g, lead) {
  const w = g.war, rec = h('span', { class: 'dim', style: { fontSize: '12px' } }, `War record: ${g.wins ?? 0} won · ${g.losses ?? 0} lost`);
  if (w) return h('div', { class: 'card war-card' }, h('div', { class: 'row sb' }, h('b', { class: 'red' }, `AT WAR with ${w.foe}`), h('span', { class: 'tag' }, `${Math.ceil(w.left / 60000)} min left`)),
    h('div', { class: 'row', style: { justifyContent: 'center', fontSize: '22px', margin: '6px 0' } }, h('b', { class: 'gold' }, w.mine), h('span', { class: 'dim' }, ' : '), h('b', { class: 'red' }, w.theirs), h('span', { class: 'dim', style: { fontSize: '12px' } }, ` first to ${w.goal} kills`)),
    h('div', { class: 'dim', style: { fontSize: '12px' } }, `Win and your guild takes ${fmt(w.prize)}g (10% of ${w.foe}'s bank). Lose and ${fmt(w.risk)}g (10% of yours) goes to them. Enemy members can be fought anywhere outside safe zones; kills of the same player within 2 minutes do not count.`),
    lead ? h('div', { style: { marginTop: '6px' } }, h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Surrender? The other guild takes 10% of your bank.')) send({ t: 'war.surrender' }); } }, 'Surrender')) : null);
  const free = (g.others ?? []).filter((o) => !o.atWar), sel = h('select', {}, free.map((o) => h('option', { value: o.name }, `${o.name}  (Lv${o.level}, ${o.n} members)`)));
  return h('div', { class: 'card war-card' }, h('div', { class: 'row sb' }, h('b', {}, 'Guild war'), rec),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Two guilds fight for 30 minutes (or first to 25 kills). The winner takes 10% of the loser\'s guild bank. The other guild\'s leader must be online to accept.'),
    lead ? (free.length ? h('div', { class: 'row' }, sel, h('button', { class: 'btn small gold', onclick: () => send({ t: 'war.declare', guild: sel.value }) }, 'Declare war')) : h('p', { class: 'dim' }, 'No other guild is free to fight.')) : h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Only your guild leader can declare war.'));
}
let lbSel = 'power';
export function showLeaderboard(boards) {
  const win = openWindow('leaderboard', 'Leaderboards', () => {
    const groups = [...new Set(boards.map((b) => b.group))], cur = boards.find((b) => b.id === lbSel) ?? boards[0], me = G.me?.name;
    return h('div', {}, groups.map((gr) => h('div', { class: 'row', style: { margin: '4px 0', flexWrap: 'wrap' } }, h('b', { class: 'dim', style: { width: '64px', fontSize: '12px' } }, gr), boards.filter((b) => b.group === gr).map((b) => h('button', { class: `btn small ${b.id === cur.id ? 'gold' : 'ghost'}`, onclick: () => { lbSel = b.id; win.render(); } }, b.title)))),
      h('div', { class: 'card', style: { marginTop: '8px' } }, h('h3', {}, cur.group === 'Classes' ? `Best ${cur.title}s` : cur.title), cur.rows.length ? cur.rows.map((r, i) => h('div', { class: 'row sb', style: { margin: '4px 0', fontSize: '14px', padding: '2px 4px', background: r.n === me ? 'rgba(227,181,82,.12)' : '' } },
        h('span', { class: 'row' }, h('b', { class: i < 3 ? 'gold' : 'dim', style: { width: '22px' } }, `${i + 1}.`), r.c ? I.cls(r.c, 20) : null, h('b', {}, r.n), r.x ? h('span', { class: 'dim', style: { fontSize: '12px' } }, ` ${r.x}`) : null),
        h('b', { class: 'gold' }, `${fmt(r.v)}${cur.unit === 'g' ? 'g' : ''}`))) : h('p', { class: 'dim' }, 'Nobody yet.'),
        cur.id === 'power' ? h('p', { class: 'dim', style: { fontSize: '11px', marginTop: '8px' } }, 'Combat power combines attack, defence, health, mana and damage bonuses from your level, class, path and gear.') : null,
        cur.group === 'Classes' ? h('p', { class: 'dim', style: { fontSize: '11px', marginTop: '8px' } }, 'Only the six main classes are ranked. Hidden and mythic classes keep their own counsel.') : null));
  }, { wide: true, icon: 'star' });
}
export function guildTab(me) {
  const g = G.guild;
  if (!g) { const inp = h('input', { placeholder: 'Guild name (3–16 letters)', maxlength: 16 }); return h('div', {}, h('p', { class: 'dim' }, 'Guilds give you a name tag, a private chat channel and a roster. A charter costs 300g. Join one by invitation from its leader (right-click a player).'), h('div', { class: 'row' }, inp, h('button', { class: 'btn gold', onclick: () => send({ t: 'guild.create', name: inp.value }) }, 'Found a guild (300g)'))); }
  const lead = g.leader === me.name, inv = h('input', { placeholder: 'Invite player (nearby)', style: { width: '170px' } }), motd = h('input', { value: g.motd, style: { flex: 1 }, maxlength: 120 });
  const dep = h('input', { type: 'number', min: 1, placeholder: 'gilt', style: { width: '90px' } });
  return h('div', {}, h('h2', {}, `<${g.name}>`), h('p', { class: 'dim' }, `Led by ${g.leader} · ${g.members.length} members`),
    h('div', { class: 'card' }, h('div', { class: 'row sb' }, h('b', {}, `Guild level ${g.level}`), h('span', { class: 'tag g' }, `+${Math.round(g.perk * 100)}% XP for every member`)), h('div', { class: 'bar xp', style: { height: '8px', margin: '4px 0' } }, h('i', { style: { width: `${Math.min(100, (g.xp / g.xpNeed) * 100)}%` } })), h('div', { class: 'dim', style: { fontSize: '12px' } }, `${g.xp} / ${g.xpNeed} guild XP — earned by kills, bounties, deposits and raids`),
      h('div', { class: 'row', style: { marginTop: '6px' } }, h('b', { class: 'gold' }, `Bank: ${fmt(g.bank)}g`), dep, h('button', { class: 'btn small', onclick: () => send({ t: 'guild.deposit', gilt: +dep.value }) }, 'Deposit'), lead ? h('button', { class: 'btn small ghost', onclick: () => send({ t: 'guild.withdraw', gilt: +dep.value }) }, 'Withdraw') : null),
      h('div', { class: 'dim', style: { fontSize: '12px' } }, g.raidIn > 0 ? `Guild raid available again in ~${Math.ceil(g.raidIn / 3600000)}h` : 'Guild raid available — find Guildmaster Orren in Lanternfall')),
    h('div', { class: 'card' }, h('b', {}, 'Message of the day: '), lead ? h('div', { class: 'row' }, motd, h('button', { class: 'btn small', onclick: () => send({ t: 'guild.motd', text: motd.value }) }, 'Set')) : g.motd),
    warCard(g, lead),
    h('div', { style: { margin: '8px 0' } }, g.members.map((mb) => h('div', { class: 'row sb', style: { margin: '3px 0' } }, h('div', { class: 'row' }, I.cls(mb.c, 20), h('b', {}, mb.n), h('span', { class: 'dim' }, ` Lv${mb.l}`), mb.on ? h('span', { class: 'tag g' }, 'online') : null), lead && mb.n !== me.name ? h('button', { class: 'btn small ghost', onclick: () => send({ t: 'guild.kick', name: mb.n }) }, 'Remove') : null))),
    lead ? h('div', { class: 'row' }, inv, h('button', { class: 'btn small', onclick: () => send({ t: 'guild.invite', to: inv.value }) }, 'Invite')) : null,
    h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Leave the guild?')) send({ t: 'guild.leave' }); } }, 'Leave guild')));
}

// What the chest gave you, with icons.
export function showLoot(m) {
  sfx('open', 100);
  openWindow('loot', m.name ?? 'Chest', () => h('div', {}, h('p', { class: 'dim' }, 'You found:'),
    (m.rows ?? []).map((r) => h('div', { class: 'card row', style: { margin: '5px 0', gap: '10px' } },
      r.k === 'gilt' ? [I.ui('coin', 28), h('b', { class: 'gold' }, `${r.n} gilt`)] : r.k === 'gear' ? [I.item(r.id, 28), h('b', {}, ITEMS[r.id].n), h('span', { class: 'tag', style: { color: gradeOf(r.q).color } }, `${gradeOf(r.q).name} ${Math.round(r.q * 100)}%`)] : [I.item(r.id, 28), h('b', {}, `${r.n}× ${ITEMS[r.id]?.n ?? r.id}`), ITEMS[r.id]?.skill ? h('span', { class: 'tag v' }, 'skill tome') : null])),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } }, h('button', { class: 'btn gold', onclick: () => closeWindow('loot') }, 'Take it all'))), { icon: 'bag' });
}

export function openGraid(m) {
  const st = m.status, hours = Math.ceil(st.locked / 3600000);
  openWindow('graid', m.name, () => h('div', {}, h('p', { class: 'speech' }, 'The Titan\'s Crucible is no place for strangers. Bring your guild: the Obsidian Titan answers to no one else.'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'tag g' }, `Level ${st.minLevel}+`), h('span', { class: 'tag' }, st.need === 1 ? 'solo world: 1 member is enough' : `${st.need}+ guild members together`), h('span', { class: 'tag v' }, 'four phases · meteors')),
      h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Phase 2 brings molten servants; phase 3 rains meteors on whoever stands still (watch the red rings and move!); phase 4 is everything at once. Victory pays every raider gilt, XP, Titan-forged gear carrying a tier-4 effect, and fills the guild bank and guild level. One clear per guild every 20 hours.'),
      !st.guild ? h('p', { class: 'red' }, 'You are not in a guild.') : null, st.locked ? h('p', { class: 'red' }, `Your guild may return in about ${hours}h.`) : null, st.busy ? h('p', { class: 'red' }, `Occupied by ${st.by}.`) : null),
    h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, h('button', { class: 'btn primary', disabled: !st.guild || st.locked > 0 || st.busy, onclick: () => { send({ t: 'graid.enter' }); closeWindow('graid'); } }, 'Enter the Crucible'), h('button', { class: 'btn ghost', onclick: () => closeWindow('graid') }, 'Not yet'))), { icon: 'forge' });
}
