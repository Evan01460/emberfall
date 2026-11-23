// The Trading tab (Character window): direct requests to Blacksmiths/Alchemists with price negotiation, a directory of crafters,
// and the players standing near you. All real work is a message to the server (src/server/requests.js).
import { G } from './state.js';
import { ITEMS, CLASSES, RECIPES, gradeOf } from '../data.js';
import { craftFamily } from '../rules.js';
import { h, fmt } from '../ui-lib.js';
import * as I from './icons.js';
import { refreshWindow } from './panels.js';
import { whisperTo } from './ui.js';

const send = (m) => G.net.send(m), netSend = send;
const FAM = { blacksmith: 'Blacksmith', alchemist: 'Alchemist' };
let sub = 'requests', draft = null, loaded = false;
const priceTag = (id) => Math.max(10, Math.round((ITEMS[id]?.v ?? 20) * 1.4));
const itemRow = (id, qty) => h('span', { class: 'row', style: { gap: '6px' } }, I.item(id, 22), h('b', {}, `${qty && qty > 1 ? qty + '× ' : ''}${ITEMS[id]?.n ?? id}`));
const reload = () => { send({ t: 'req.list' }); send({ t: 'req.crafters' }); };
export const openRequestTo = (name, fam) => { draft = { to: name, fam, itemId: null, qty: 1, minQ: 0, price: 0 }; sub = 'find'; G.openTrading?.(); };
export const pendingForMe = () => (G.reqs ?? []).filter((r) => (r.mine === 'to' && r.status === 'pending') || (r.mine === 'from' && r.ready)).length;

export function tradingTab(me) {
  if (!loaded) { loaded = true; reload(); }
  const nav = h('div', { class: 'row', style: { marginBottom: '8px' } }, [['requests', `Requests${(G.reqs ?? []).length ? ` (${G.reqs.length})` : ''}`], ['find', 'Find a crafter'], ['nearby', 'Players nearby']].map(([id, l]) => h('button', { class: `btn small ${sub === id ? 'gold' : ''}`, onclick: () => { sub = id; refreshWindow('character'); } }, l)));
  const note = h('p', { class: 'dim', style: { fontSize: '12px' } }, 'Blacksmiths and Alchemists may only sell what has been REQUESTED of them (here, or on the Exchange commission board). Everything else they make can only be sold through Merchants.');
  return h('div', {}, nav, note, sub === 'requests' ? requestsView(me) : sub === 'find' ? findView(me) : nearbyView(me));
}

// ── my requests ──────────────────────────────────────────────────────────────
function requestsView(me) {
  const list = G.reqs ?? [];
  if (!list.length) return h('div', { class: 'card' }, h('p', { class: 'dim' }, 'No open requests. Find a Blacksmith or Alchemist, tell them what you need and what you will pay. You can haggle with them in private chat before they accept.'), h('button', { class: 'btn small gold', onclick: () => { sub = 'find'; refreshWindow('character'); } }, 'Find a crafter'));
  return h('div', {}, list.map((r) => reqCard(r, me)));
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
    h('button', { class: 'btn small primary', disabled: r.have < r.qty, onclick: () => send({ t: 'req.deliver', id: r.id }) }, `Deliver for ${fmt(r.price)}g`), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'req.reject', id: r.id }) }, 'Call off'), ...common];
  return h('div', { class: 'card', style: { marginBottom: '8px' } },
    h('div', { class: 'row sb' }, h('div', {}, h('div', { class: 'dim', style: { fontSize: '12px' } }, head), itemRow(r.itemId, r.qty)), h('div', { style: { textAlign: 'right' } }, h('b', { class: 'gold' }, `${fmt(r.price)}g`), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '3px' } }, tags))),
    !mineReq && r.status === 'pending' && !r.canMake ? h('p', { class: 'red', style: { fontSize: '12px', margin: '6px 0' } }, `You cannot make this yet (needs craft level ${r.needLvl}${r.secret ? ' and a secret recipe' : ''}). You can only reject.`) : null,
    !mineReq && r.status === 'accepted' ? h('p', { class: 'dim', style: { fontSize: '12px', margin: '6px 0' } }, `You hold ${r.have} fitting ${it?.n ?? 'item'}${r.have === 1 ? '' : 's'}. ${r.have >= r.qty ? 'Deliver it, or press Ready to tell them first.' : 'Forge or brew it at your station, then come back.'}`) : null,
    mineReq && r.status === 'accepted' ? h('p', { class: r.ready ? 'gold' : 'dim', style: { fontSize: '12px', margin: '6px 0' } }, r.ready ? `${r.other} says it is READY. They will hand it over; your ${fmt(r.price)}g is paid on delivery.` : `${r.other} accepted. You will be told when it is ready.`) : null,
    offer, h('div', { class: 'row', style: { marginTop: '6px', flexWrap: 'wrap' } }, actions));
}

// ── find a crafter / write a request ─────────────────────────────────────────
function findView(me) {
  if (draft) return draftView(me);
  const list = G.crafters ?? [], name = h('input', { placeholder: 'or type a crafter\'s name', style: { width: '190px' } });
  return h('div', {}, h('div', { class: 'row', style: { margin: '6px 0' } }, name, h('button', { class: 'btn small', onclick: () => { const n = name.value.trim(); const c = list.find((x) => x.n.toLowerCase() === n.toLowerCase()); if (!n) return; draft = { to: c?.n ?? n, fam: c?.fam ?? 'blacksmith', cl: c?.l, itemId: null, qty: 1, minQ: 0, price: 0 }; refreshWindow('character'); } }, 'Request from…'), h('button', { class: 'btn small ghost', onclick: reload }, 'Refresh')),
    list.length ? h('table', {}, h('tr', {}, ['Crafter', 'Craft', 'Lv', ''].map((x) => h('th', {}, x))), ...list.map((c) => h('tr', {}, h('td', {}, h('span', { class: 'row' }, I.cls(c.c, 20), h('b', {}, c.n), c.on ? h('span', { class: 'tag g' }, 'online') : h('span', { class: 'dim', style: { fontSize: '11px' } }, 'offline'))), h('td', {}, FAM[c.fam]), h('td', {}, c.l),
      h('td', {}, h('span', { class: 'row' }, h('button', { class: 'btn small primary', onclick: () => { draft = { to: c.n, fam: c.fam, cl: c.l, itemId: null, qty: 1, minQ: 0, price: 0 }; refreshWindow('character'); } }, 'Request an item'), h('button', { class: 'btn small ghost', onclick: () => whisperTo(c.n) }, 'Message')))))) : h('p', { class: 'dim' }, 'No crafters known yet. Ask around in chat — "who" lists everyone online.'));
}
function draftView(me) {
  const d = draft, fam = d.fam, opts = RECIPES.filter((r) => r.craft === fam && !r.smelt && ITEMS[r.out] && ITEMS[r.out].k !== 'quest');
  if (!d.itemId || !opts.some((r) => r.out === d.itemId)) { d.itemId = opts[0]?.out; d.price = priceTag(d.itemId); }
  const rec = opts.find((r) => r.out === d.itemId), tooHigh = d.cl != null && rec && rec.lvl > d.cl, gear = ITEMS[d.itemId]?.k === 'gear';
  const sel = h('select', { onchange: (e) => { d.itemId = e.target.value; d.price = priceTag(d.itemId); refreshWindow('character'); } }, opts.map((r) => h('option', { value: r.out, selected: r.out === d.itemId }, `${ITEMS[r.out].n}  (craft Lv ${r.lvl}${r.secret ? ', secret' : ''})`)));
  const qty = h('input', { type: 'number', min: 1, max: 5, value: d.qty, style: { width: '56px' }, oninput: (e) => { d.qty = Math.max(1, Math.min(5, Math.round(+e.target.value) || 1)); } });
  const mq = h('input', { type: 'number', min: 0, max: 99, value: Math.round(d.minQ * 100), style: { width: '60px' }, disabled: !gear, oninput: (e) => { d.minQ = Math.max(0, Math.min(99, +e.target.value || 0)) / 100; } });
  const send = h('button', { class: 'btn primary' }, ''), upd = () => { send.textContent = `Send request (${fmt(d.price)}g in escrow)`; send.disabled = me.gilt < d.price; };
  const pr = h('input', { type: 'number', min: 1, value: d.price, style: { width: '96px' }, oninput: (e) => { d.price = Math.max(1, Math.round(+e.target.value) || 1); upd(); } });   // no re-render here: it would swallow the click on the button
  return h('div', { class: 'card' }, h('h3', {}, `Request from ${d.to} (${FAM[fam]}${d.cl != null ? `, level ${d.cl}` : ''})`),
    h('div', { class: 'row', style: { margin: '6px 0' } }, 'Item', sel), h('div', { class: 'row', style: { margin: '6px 0' } }, 'Qty', qty, gear ? ['Min quality %', mq] : null, 'Payment', pr, 'g'),
    tooHigh ? h('p', { class: 'red', style: { fontSize: '12px' } }, `${d.to} is level ${d.cl}; this needs craft level ${rec.lvl}. They would only be able to reject it.`) : null,
    h('p', { class: 'dim', style: { fontSize: '12px' } }, `The payment is held in escrow until it is delivered, or returned if they reject it or you cancel. You can haggle in private chat and propose a new price afterwards. You have ${fmt(me.gilt)}g.`),
    h('div', { class: 'row' }, (upd(), send.onclick = () => { netSend({ t: 'req.new', to: d.to, itemId: d.itemId, qty: d.qty, minQ: d.minQ, price: d.price }); draft = null; sub = 'requests'; refreshWindow('character'); }, send), h('button', { class: 'btn ghost', onclick: () => { draft = null; refreshWindow('character'); } }, 'Back')));
}

// ── players nearby ───────────────────────────────────────────────────────────
function nearbyView(me) {
  const near = [...G.players.values()].filter((p) => p.id !== G.id && Math.hypot(p.x - G.pos.x, p.y - G.pos.y) < 14 && !p.dd).sort((a, b) => Math.hypot(a.x - G.pos.x, a.y - G.pos.y) - Math.hypot(b.x - G.pos.x, b.y - G.pos.y));
  if (!near.length) return h('div', { class: 'card' }, h('p', { class: 'dim' }, 'Nobody is near you. Stand close to another player to trade with them, or right-click them in the world.'));
  return h('div', {}, near.map((p) => { const fam = craftFamily({ classId: p.c }); return h('div', { class: 'card row sb', style: { marginBottom: '6px' } }, h('span', { class: 'row' }, I.cls(p.c, 22), h('b', {}, p.n), h('span', { class: 'dim' }, ` Lv${p.l} ${CLASSES[p.c]?.name ?? ''}`)),
    h('span', { class: 'row' }, h('button', { class: 'btn small primary', onclick: () => send({ t: 'trade.request', to: p.n }) }, 'Trade'), fam ? h('button', { class: 'btn small gold', onclick: () => { draft = { to: p.n, fam, cl: p.l, itemId: null, qty: 1, minQ: 0, price: 0 }; sub = 'find'; refreshWindow('character'); } }, 'Request an item') : null, h('button', { class: 'btn small ghost', onclick: () => whisperTo(p.n) }, 'Message'))); }),
    h('p', { class: 'dim', style: { fontSize: '12px' } }, 'A trade lets two players swap items and gilt safely — both confirm. Blacksmiths and Alchemists can only hand their own creations to Merchants this way.'));
}
