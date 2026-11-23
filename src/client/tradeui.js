// The Trading tab (Character window): direct requests to Blacksmiths/Alchemists with price negotiation, a directory of crafters,
// and the players standing near you. All real work is a message to the server (src/server/requests.js).
import { G } from './state.js';
import { ITEMS, CLASSES, RECIPES, gradeOf } from '../data.js';
import { craftFamily } from '../rules.js';
import { h, fmt } from '../ui-lib.js';
import * as I from './icons.js';
import { refreshWindow, gearLabel } from './panels.js';
import { gearFxLines } from './customui.js';
import { whisperTo } from './ui.js';
import { browser, pickCard, statChips, fitIcons, ingredientRow } from './browse.js';
import { upgCard, upgDraftView } from './upgradereq.js';

const send = (m) => G.net.send(m), netSend = send;
const FAM = { blacksmith: 'Blacksmith', alchemist: 'Alchemist' };
let sub = 'requests', draft = null, lastLoad = 0; const picked = new Map();   // request id -> uids the crafter chose to hand over
const priceTag = (id) => Math.max(10, Math.round((ITEMS[id]?.v ?? 20) * 1.4));
const itemRow = (id, qty) => h('span', { class: 'row', style: { gap: '6px' } }, I.item(id, 22), h('b', {}, `${qty && qty > 1 ? qty + '× ' : ''}${ITEMS[id]?.n ?? id}`));
const reload = () => { send({ t: 'req.list' }); send({ t: 'upg.list' }); send({ t: 'req.crafters' }); };
export const openRequestTo = (name, fam) => { draft = { to: name, fam, itemId: null, qty: 1, minQ: 0, price: 0 }; sub = 'find'; G.openTrading?.(); };
export const pendingForMe = () => (G.reqs ?? []).filter((r) => (r.mine === 'to' && r.status === 'pending') || (r.mine === 'from' && r.ready)).length + (G.upgs ?? []).filter((j) => j.mine === 'to' && (j.status === 'pending' || j.status === 'accepted')).length;
G.openUpgradeReq = (uid) => { draft = { kind: 'upgrade', to: null, uid, price: null }; G.upInfo = null; sub = 'find'; G.openTrading?.(); };

export function tradingTab(me) {
  if (performance.now() - lastLoad > 6000) { lastLoad = performance.now(); reload(); }   // what you hold changes while you craft: re-check regularly
  const nav = h('div', { class: 'row', style: { marginBottom: '8px' } }, [['requests', `Requests${(G.reqs ?? []).length ? ` (${G.reqs.length})` : ''}`], ['find', 'Find a crafter'], ['nearby', 'Players nearby']].map(([id, l]) => h('button', { class: `btn small ${sub === id ? 'gold' : ''}`, onclick: () => { sub = id; refreshWindow('character'); } }, l)));
  const note = h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Blacksmiths and Alchemists may only sell what has been REQUESTED of them (here, or on the Exchange commission board). Everything else they make can only be sold through Merchants.');
  return h('div', {}, nav, note, sub === 'requests' ? requestsView(me) : sub === 'find' ? findView(me) : nearbyView(me));
}

// ── my requests ──────────────────────────────────────────────────────────────
let filter = 'all';
function requestsView(me) {
  const items = G.reqs ?? [], jobs = G.upgs ?? [];
  if (!items.length && !jobs.length) return h('div', { class: 'card' }, h('p', { class: 'dim' }, 'Nothing open. Ask a Blacksmith or Alchemist for an item, or ask a Blacksmith to upgrade your gear (+1 to +99). Everything you hand over is held safely until the work is done.'), h('div', { class: 'row' }, h('button', { class: 'btn small gold', onclick: () => { sub = 'find'; refreshWindow('character'); } }, 'Find a crafter'), h('button', { class: 'btn small', onclick: () => G.openUpgradeReq() }, 'Upgrade my gear')));
  const waiting = items.filter((r) => r.mine === 'to' && r.status === 'pending').length + jobs.filter((j) => j.mine === 'to' && j.status === 'pending').length, ready = items.filter((r) => r.mine === 'from' && r.ready).length + jobs.filter((j) => j.mine === 'from' && j.status === 'done').length, work = jobs.filter((j) => j.mine === 'to' && j.status === 'accepted').length;
  const chips = [['all', 'All'], ['items', 'Items'], ['upgrades', 'Upgrades'], ['in', 'Asked of me'], ['out', 'My requests']].map(([id, l]) => h('button', { class: `chip ${filter === id ? 'on' : ''}`, onclick: () => { filter = id; refreshWindow('character'); } }, l));
  const show = (mine, kind) => (filter === 'all' || (filter === 'items' && kind === 'item') || (filter === 'upgrades' && kind === 'upg') || (filter === 'in' && mine === 'to') || (filter === 'out' && mine === 'from'));
  const cards = [...jobs.filter((j) => show(j.mine, 'upg')).map((j) => upgCard(j, me)), ...items.filter((r) => show(r.mine, 'item')).map((r) => reqCard(r, me))];
  return h('div', {}, h('div', { class: 'reqhead' }, h('div', { class: 'reqstat' }, h('b', {}, waiting), h('span', {}, 'waiting for you')), h('div', { class: 'reqstat' }, h('b', {}, work), h('span', {}, 'to forge')), h('div', { class: 'reqstat' }, h('b', {}, ready), h('span', {}, 'ready / done')), h('div', { style: { flex: 1 } }), h('button', { class: 'btn small gold', onclick: () => G.openUpgradeReq() }, 'Upgrade my gear')),
    h('div', { class: 'chips', style: { margin: '6px 0' } }, chips), cards.length ? cards : h('p', { class: 'dim' }, 'Nothing in this filter.'));
}
function reqCard(r, me) {
  const it = ITEMS[r.itemId], mineReq = r.mine === 'from', hrs = Math.ceil(r.left / 3600000);
  const gear = it?.k === 'gear', tags = [h('span', { class: `tag ${r.status === 'accepted' ? 'g' : ''}` }, r.status === 'accepted' ? (r.ready ? 'ready' : 'accepted') : 'waiting'), gear && r.minQ > 0 ? h('span', { class: 'tag', style: { color: gradeOf(r.minQ).color } }, `${Math.round(r.minQ * 100)}%+`) : null, h('span', { class: 'tag' }, `${hrs}h left`)];
  const price = h('input', { type: 'number', min: 1, placeholder: 'new price', style: { width: '90px' } });
  const head = mineReq ? `You asked ${r.other}` : `${r.other} asks you`;
  const offer = r.offer ? (r.offer.byMe
    ? h('div', { class: 'tag v', style: { margin: '6px 0' } }, `You proposed ${fmt(r.offer.price)}g — waiting for ${r.other}`)
    : h('div', { class: 'card hl', style: { margin: '6px 0', padding: '6px 10px' } }, h('span', { class: 'gold' }, `${r.other} proposes ${fmt(r.offer.price)}g `), h('button', { class: 'btn small gold', onclick: () => send({ t: 'req.answer', id: r.id, accept: true }) }, 'Accept'), ' ', h('button', { class: 'btn small ghost', onclick: () => send({ t: 'req.answer', id: r.id, accept: false }) }, 'Decline'))) : null;
  const common = [h('button', { class: 'btn small', title: 'Private chat', onclick: () => { whisperTo(r.other); } }, 'Message'), price, h('button', { class: 'btn small', onclick: () => { if (+price.value > 0) send({ t: 'req.offer', id: r.id, price: +price.value }); } }, 'Propose price')];
  let actions;
  if (mineReq) actions = [h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Cancel this request? Your payment comes back.')) send({ t: 'req.cancel', id: r.id }); } }, 'Cancel request'), ...common];
  else if (r.status === 'pending') actions = [
    h('button', { class: 'btn small primary', disabled: !r.canMake, title: r.canMake ? '' : `Needs craft level ${r.needLvl}${r.secret ? ' and a secret recipe' : ''}`, onclick: () => send({ t: 'req.accept', id: r.id }) }, 'Accept'),
    h('button', { class: 'btn small ghost', onclick: () => send({ t: 'req.reject', id: r.id }) }, 'Reject'), ...common];
  else actions = [h('button', { class: 'btn small', disabled: r.have < r.qty, title: r.have < r.qty ? 'Make it first' : 'Tell them it is ready', onclick: () => send({ t: 'req.ready', id: r.id }) }, r.ready ? 'Tell again: ready' : 'It is ready'),
    h('button', { class: 'btn small primary', disabled: r.have < r.qty, onclick: () => { const uids = r.stock ? (picked.get(r.id)?.length === r.qty ? picked.get(r.id) : r.stock.slice(0, r.qty).map((g) => g.uid)) : undefined; send({ t: 'req.deliver', id: r.id, uids }); picked.delete(r.id); } }, `Deliver for ${fmt(r.price)}g`), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'req.reject', id: r.id }) }, 'Call off'), ...common];
  return h('div', { class: 'card', style: { marginBottom: '8px' } },
    h('div', { class: 'row sb' }, h('div', {}, h('div', { class: 'dim', style: { fontSize: '12px' } }, head), itemRow(r.itemId, r.qty), h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginTop: '3px' } }, ...statChips(r.itemId, r.minQ > 0 ? r.minQ : 1), fitIcons(r.itemId, me, 3))), h('div', { style: { textAlign: 'right' } }, h('b', { class: 'gold' }, `${fmt(r.price)}g`), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '3px' } }, tags))),
    !mineReq && r.status === 'pending' && !r.canMake ? h('p', { class: 'red', style: { fontSize: '12px', margin: '6px 0' } }, `You cannot make this yet (needs craft level ${r.needLvl}${r.secret ? ' and a secret recipe' : ''}). You can only reject.`) : null,
    !mineReq && r.status === 'accepted' ? h('div', {}, h('p', { class: 'dim', style: { fontSize: '12px', margin: '6px 0' } }, `You hold ${r.have} fitting ${it?.n ?? 'item'}${r.have === 1 ? '' : 's'}${r.minQ > 0 ? ` (quality ${Math.round(r.minQ * 100)}%+; customised, enchanted or special-effect pieces all count)` : ' (customised, enchanted or special-effect pieces all count)'}. ${r.have >= r.qty ? 'Pick which to hand over, then Deliver — or press Ready to tell them first.' : 'Forge or brew it at your station, then come back.'}`),
      r.stock?.length ? r.stock.map((g, i) => { const sel = picked.get(r.id) ?? r.stock.slice(0, r.qty).map((x) => x.uid), on = sel.includes(g.uid); return h('label', { class: 'row', style: { margin: '3px 0', alignItems: 'flex-start', cursor: 'pointer' } }, h('input', { type: r.qty > 1 ? 'checkbox' : 'radio', name: `pick${r.id}`, checked: on, onchange: () => { const cur = new Set(picked.get(r.id) ?? r.stock.slice(0, r.qty).map((x) => x.uid)); if (r.qty === 1) { cur.clear(); cur.add(g.uid); } else if (cur.has(g.uid)) cur.delete(g.uid); else cur.add(g.uid); picked.set(r.id, [...cur]); } }), h('span', {}, gearLabel(g), gearFxLines(g).length ? h('div', { class: 'dim', style: { fontSize: '11px' } }, gearFxLines(g).join(' · ')) : null)); }) : null,
      r.below?.length ? h('p', { class: 'red', style: { fontSize: '12px', margin: '6px 0' } }, `Below the asked quality: ${r.below.map((g) => `${Math.round(g.q * 100)}%${g.cname ? ` “${g.cname}”` : ''}`).join(', ')} — propose a lower quality, or forge a better one.`) : null,
      r.worn ? h('p', { class: 'dim', style: { fontSize: '12px', margin: '6px 0' } }, `${r.worn} fitting piece${r.worn === 1 ? ' is' : 's are'} equipped — unequip to hand over.`) : null) : null,
    mineReq && r.status === 'accepted' ? h('p', { class: r.ready ? 'gold' : 'dim', style: { fontSize: '12px', margin: '6px 0' } }, r.ready ? `${r.other} says it is READY. They will hand it over; your ${fmt(r.price)}g is paid on delivery.` : `${r.other} accepted. You will be told when it is ready.`) : null,
    offer, h('div', { class: 'row', style: { marginTop: '6px', flexWrap: 'wrap' } }, actions));
}

// ── find a crafter / write a request ─────────────────────────────────────────
function findView(me) {
  if (draft?.kind === 'upgrade') return upgDraftView(me, draft, (to) => { draft = null; sub = to; refreshWindow('character'); });
  if (draft) return draftView(me);
  const list = G.crafters ?? [], name = h('input', { placeholder: 'or type a crafter\'s name', style: { width: '190px' } });
  return h('div', {}, h('div', { class: 'row', style: { margin: '6px 0' } }, name, h('button', { class: 'btn small', onclick: () => { const n = name.value.trim(); const c = list.find((x) => x.n.toLowerCase() === n.toLowerCase()); if (!n) return; draft = { to: c?.n ?? n, fam: c?.fam ?? 'blacksmith', cl: c?.l, itemId: null, qty: 1, minQ: 0, price: 0 }; refreshWindow('character'); } }, 'Request from…'), h('button', { class: 'btn small ghost', onclick: reload }, 'Refresh')),
    list.length ? h('table', {}, h('tr', {}, ['Crafter', 'Craft', 'Lv', ''].map((x) => h('th', {}, x))), ...list.map((c) => h('tr', {}, h('td', {}, h('span', { class: 'row' }, I.cls(c.c, 20), h('b', {}, c.n), c.on ? h('span', { class: 'tag g' }, 'online') : h('span', { class: 'dim', style: { fontSize: '11px' } }, 'offline'))), h('td', {}, FAM[c.fam]), h('td', {}, c.l),
      h('td', {}, h('span', { class: 'row' }, h('button', { class: 'btn small primary', onclick: () => { draft = { to: c.n, fam: c.fam, cl: c.l, itemId: null, qty: 1, minQ: 0, price: 0 }; refreshWindow('character'); } }, 'Request an item'), c.fam === 'blacksmith' ? h('button', { class: 'btn small gold', onclick: () => { draft = { kind: 'upgrade', to: c.n, cl: c.l, uid: null, price: null }; G.upInfo = null; refreshWindow('character'); } }, 'Upgrade gear') : null, h('button', { class: 'btn small ghost', onclick: () => whisperTo(c.n) }, 'Message')))))) : h('p', { class: 'dim' }, 'No crafters known yet. Ask around in chat — "who" lists everyone online.'));
}
function draftView(me) {
  const d = draft, fam = d.fam, opts = RECIPES.filter((r) => r.craft === fam && !r.smelt && ITEMS[r.out] && ITEMS[r.out].k !== 'quest');
  if (!d.itemId || !opts.some((r) => r.out === d.itemId)) { d.itemId = opts[0]?.out; d.price = priceTag(d.itemId); }
  const recOf = () => opts.find((r) => r.out === d.itemId), detail = h('div', { class: 'card hl pickdetail' });
  const qty = h('input', { type: 'number', min: 1, max: 5, value: d.qty, style: { width: '56px' }, oninput: (e) => { d.qty = Math.max(1, Math.min(5, Math.round(+e.target.value) || 1)); } });
  const mq = h('input', { type: 'number', min: 0, max: 99, value: Math.round(d.minQ * 100), style: { width: '60px' }, oninput: (e) => { d.minQ = Math.max(0, Math.min(99, +e.target.value || 0)) / 100; } });
  const send = h('button', { class: 'btn primary' }, ''), upd = () => { send.textContent = `Send request (${fmt(d.price)}g in escrow)`; send.disabled = me.gilt < d.price; };
  const pr = h('input', { type: 'number', min: 1, value: d.price, style: { width: '96px' }, oninput: (e) => { d.price = Math.max(1, Math.round(+e.target.value) || 1); upd(); } });   // no re-render here: it would swallow the click on the button
  const qRow = h('div', { class: 'row', style: { margin: '6px 0', flexWrap: 'wrap' } });
  const paintDetail = () => {
    const rec = recOf(), it = ITEMS[d.itemId], gear = it?.k === 'gear', tooHigh = d.cl != null && rec && rec.lvl > d.cl; if (!rec) return;
    mq.disabled = !gear; qRow.replaceChildren('Qty', qty, gear ? ['Min quality %', mq] : null, 'Payment', pr, 'g', h('button', { class: 'btn small ghost', title: 'Suggested price', onclick: () => { d.price = priceTag(d.itemId); pr.value = d.price; upd(); } }, `Suggest ${fmt(priceTag(d.itemId))}g`));
    detail.replaceChildren(h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start' } }, I.item(d.itemId, 48), h('div', { style: { flex: 1 } }, h('div', { class: 'row sb' }, h('h3', { style: { margin: 0 } }, it.n), h('span', { class: 'tag' }, `craft Lv ${rec.lvl}${rec.secret ? ' · secret recipe' : ''}`)),
      h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', margin: '4px 0' } }, ...statChips(d.itemId), fitIcons(d.itemId, me, 6)), it.desc ? h('div', { class: 'dim', style: { fontSize: '12px' } }, it.desc) : null,
      h('div', { class: 'dim', style: { fontSize: '12px', marginTop: '4px' } }, 'Materials the crafter needs: ', ingredientRow(rec, null)), tooHigh ? h('p', { class: 'red', style: { fontSize: '12px', margin: '6px 0 0' } }, `${d.to} is level ${d.cl}; this needs craft level ${rec.lvl}. They would only be able to reject it.`) : null)));
  };
  const br = browser({ key: `req-${fam}`, family: fam, recipes: opts, me, cols: 2, card: (r) => pickCard(r, { selected: r.out === d.itemId, me, crafterLvl: d.cl, onPick: (rr) => { d.itemId = rr.out; d.price = priceTag(rr.out); pr.value = d.price; upd(); paintDetail(); br.refresh(); } }) });
  paintDetail(); upd();
  return h('div', {}, h('div', { class: 'row sb', style: { margin: '0 0 6px' } }, h('h3', { style: { margin: 0 } }, `Request from ${d.to} (${FAM[fam]}${d.cl != null ? `, level ${d.cl}` : ''})`), h('button', { class: 'btn small ghost', onclick: () => { draft = null; refreshWindow('character'); } }, 'Back')),
    h('div', { class: 'dim', style: { fontSize: '12px', margin: '4px 0' } }, 'Your request'), detail, qRow,
    h('div', { class: 'row', style: { margin: '6px 0' } }, (send.onclick = () => { netSend({ t: 'req.new', to: d.to, itemId: d.itemId, qty: d.qty, minQ: d.minQ, price: d.price }); draft = null; sub = 'requests'; refreshWindow('character'); }, send), h('span', { class: 'dim', style: { fontSize: '12px' } }, `The payment is held in escrow until delivery (refunded if they reject or you cancel). You can haggle in private chat afterwards. You have ${fmt(me.gilt)}g.`)),
    h('div', { class: 'card', style: { padding: '8px', marginTop: '8px' } }, h('div', { class: 'dim', style: { fontSize: '12px', margin: '0 0 6px' } }, 'Pick a different item — search, filter by type or metal, or sort'), br.el));
}

// ── players nearby ───────────────────────────────────────────────────────────
function nearbyView(me) {
  const near = [...G.players.values()].filter((p) => p.id !== G.id && Math.hypot(p.x - G.pos.x, p.y - G.pos.y) < 14 && !p.dd).sort((a, b) => Math.hypot(a.x - G.pos.x, a.y - G.pos.y) - Math.hypot(b.x - G.pos.x, b.y - G.pos.y));
  if (!near.length) return h('div', { class: 'card' }, h('p', { class: 'dim' }, 'Nobody is near you. Stand close to another player to trade with them, or right-click them in the world.'));
  return h('div', {}, near.map((p) => { const fam = craftFamily({ classId: p.c }); return h('div', { class: 'card row sb', style: { marginBottom: '6px' } }, h('span', { class: 'row' }, I.cls(p.c, 22), h('b', {}, p.n), h('span', { class: 'dim' }, ` Lv${p.l} ${CLASSES[p.c]?.name ?? ''}`)),
    h('span', { class: 'row' }, h('button', { class: 'btn small primary', onclick: () => send({ t: 'trade.request', to: p.n }) }, 'Trade'), fam ? h('button', { class: 'btn small gold', onclick: () => { draft = { to: p.n, fam, cl: p.l, itemId: null, qty: 1, minQ: 0, price: 0 }; sub = 'find'; refreshWindow('character'); } }, 'Request an item') : null, h('button', { class: 'btn small ghost', onclick: () => whisperTo(p.n) }, 'Message'))); }),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'A trade lets two players swap items and gilt safely — both confirm. Blacksmiths and Alchemists can only hand their own creations to Merchants this way.'));
}
