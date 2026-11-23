// Asking a Blacksmith to upgrade a piece: the request form and the job cards (Character → Trading → Requests).
import { G } from './state.js';
import { ITEMS } from '../data.js';
import { h, fmt } from '../ui-lib.js';
import * as I from './icons.js';
import { refreshWindow } from './panels.js';
import { whisperTo } from './ui.js';
import { gearName } from '../rules.js';
import { upLevel, upColor, MAX_UP } from '../upgrade.js';
import { gearStats, upName, upBadge, matRow, chanceBar } from './upgradeui.js';

const send = (m) => G.net.send(m);
const hrs = (ms) => (ms > 3600000 ? `${Math.ceil(ms / 3600000)}h left` : `${Math.max(1, Math.ceil(ms / 60000))}m left`);
const STEPS = ['Sent', 'Accepted', 'Forged'];
const timeline = (status) => { const at = status === 'done' ? 3 : status === 'accepted' ? 2 : 1; return h('div', { class: 'uptl' }, STEPS.map((s, i) => h('span', { class: `uptl-s ${i < at ? 'on' : ''} ${i === at - 1 && status !== 'done' ? 'now' : ''}` }, h('i', {}), s))); };

// ── a job card ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function upgCard(j, me) {
  const mineReq = j.mine === 'from', g = { ...j.gear }, L = j.L, nxt = { ...g, up: L + 1 }, price = h('input', { type: 'number', min: 1, placeholder: 'new fee', style: { width: '90px' } });
  const offer = j.offer ? (j.offer.byMe ? h('div', { class: 'tag v', style: { margin: '6px 0' } }, `You proposed ${fmt(j.offer.price)}g — waiting for ${j.other}`) : h('div', { class: 'card hl', style: { margin: '6px 0', padding: '6px 10px' } }, h('span', { class: 'gold' }, `${j.other} proposes a fee of ${fmt(j.offer.price)}g `), h('button', { class: 'btn small gold', onclick: () => send({ t: 'upg.answer', id: j.id, accept: true }) }, 'Accept'), ' ', h('button', { class: 'btn small ghost', onclick: () => send({ t: 'upg.answer', id: j.id, accept: false }) }, 'Decline'))) : null;
  const common = j.status === 'done' ? [] : [h('button', { class: 'btn small', onclick: () => whisperTo(j.other) }, 'Message'), ...(j.status === 'pending' ? [price, h('button', { class: 'btn small', onclick: () => { if (+price.value > 0) send({ t: 'upg.offer', id: j.id, price: +price.value }); } }, 'Propose fee')] : [])];
  let actions;
  if (j.status === 'done') actions = [];
  else if (mineReq) actions = [h('button', { class: 'btn small ghost', onclick: () => { if (confirm('Cancel this job? The piece, the materials and your fee come back.')) send({ t: 'upg.cancel', id: j.id }); } }, 'Cancel job'), ...common];
  else if (j.status === 'pending') actions = [h('button', { class: 'btn small primary', disabled: !j.canDo, title: j.canDo ? '' : `Needs smith level ${j.needLvl}`, onclick: () => send({ t: 'upg.accept', id: j.id }) }, 'Accept'), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'upg.reject', id: j.id }) }, 'Reject'), ...common];
  else actions = [h('button', { class: 'btn small primary', onclick: () => send({ t: 'upg.forge', id: j.id }) }, 'Start forging (at a forge)'), h('button', { class: 'btn small', title: 'No minigame — lower odds', onclick: () => send({ t: 'upg.forge', id: j.id, quick: true }) }, 'Quick forge'), h('button', { class: 'btn small ghost', onclick: () => send({ t: 'upg.reject', id: j.id }) }, 'Give up'), ...common];
  const res = j.result;
  return h('div', { class: `card upjob ${j.status}`, style: { marginBottom: '8px' } },
    h('div', { class: 'row sb', style: { alignItems: 'flex-start' } },
      h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } }, h('div', { class: 'upicon sm', style: { boxShadow: `0 0 12px ${upColor(L)}` } }, I.item(g.id, 40)),
        h('div', {}, h('div', { class: 'dim', style: { fontSize: '12px' } }, mineReq ? `You asked ${j.other} to temper` : `${j.other} asks you to temper`), h('div', { style: { fontWeight: 700 } }, upName(g)), h('div', { class: 'row', style: { gap: '6px', margin: '2px 0' } }, h('span', { class: 'tag' }, `+${L} → +${L + 1}`), h('span', { class: 'tag' }, hrs(j.left)), !mineReq ? h('span', { class: `tag ${j.canDo ? 'g' : 'r'}` }, `smith lv ${j.needLvl}`) : null))),
      h('div', { style: { textAlign: 'right' } }, h('b', { class: 'gold', style: { fontSize: '16px' } }, `${fmt(j.price)}g`), h('div', { class: 'dim', style: { fontSize: '11px' } }, mineReq ? 'fee in escrow' : 'fee on completion'))),
    timeline(j.status),
    h('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap', margin: '6px 0' } }, h('div', { class: 'upstats' }, gearStats(g).map(([k, v, c], i) => h('div', { class: 'upstat' }, h('span', { style: { color: c } }, k), h('b', {}, fmt(v)), h('span', { class: 'ups-arrow' }, '→'), h('b', { style: { color: '#8cffa0' } }, fmt(gearStats(nxt)[i][1]))))), h('div', {}, h('div', { class: 'dim', style: { fontSize: '11px' } }, mineReq ? 'Materials you provided' : 'Materials provided'), matRow(j.mats))),
    j.status !== 'done' ? chanceBar(j.chance, j.bonus ?? 0, L) : null,
    j.status === 'done' && res ? h('p', { class: res.ok ? 'gold' : 'red', style: { margin: '6px 0' } }, res.ok ? `Success! The piece is now +${res.to}.` : `The attempt failed${res.dropped ? ` and the piece fell to +${res.to}` : ''}. It is back in the owner's bag.`) : null,
    !mineReq && j.status === 'pending' && !j.canDo ? h('p', { class: 'red', style: { fontSize: '12px', margin: '6px 0' } }, `This needs smith level ${j.needLvl}. You can only reject.`) : null,
    mineReq && j.status === 'accepted' ? h('p', { class: 'dim', style: { fontSize: '12px', margin: '6px 0' } }, `${j.other} accepted and will work on it at a forge. You will be told the result.`) : null,
    offer, actions.length ? h('div', { class: 'row', style: { marginTop: '6px', flexWrap: 'wrap' } }, actions) : null);
}

// ── the request form ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function upgDraftView(me, d, back) {
  const smiths = (G.crafters ?? []).filter((c) => c.fam === 'blacksmith'), gear = [...me.gear].filter((g) => upLevel(g) < MAX_UP).sort((a, b) => upLevel(b) - upLevel(a));
  if (d.uid != null && !gear.some((g) => g.uid === d.uid)) d.uid = null;
  const g = gear.find((x) => x.uid === d.uid), info = G.upInfo && G.upInfo.uid === d.uid ? G.upInfo : null;
  if (g && !info) send({ t: 'upgrade.info', uid: g.uid });
  const nameIn = h('input', { value: d.to ?? '', placeholder: 'Blacksmith\'s name', list: 'smithlist', style: { width: '180px' }, oninput: (e) => { d.to = e.target.value.trim(); const c = smiths.find((x) => x.n.toLowerCase() === d.to.toLowerCase()); d.cl = c?.l; } });
  const dl = h('datalist', { id: 'smithlist' }, smiths.map((c) => h('option', { value: c.n }, `Lv ${c.l}${c.on ? ' · online' : ''}`)));
  const fee = h('input', { type: 'number', min: 1, value: d.price ?? '', style: { width: '110px' }, oninput: (e) => { d.price = Math.max(1, Math.round(+e.target.value) || 1); upd(); } });
  const sendBtn = h('button', { class: 'btn primary' }, 'Send job'), upd = () => { const short = info?.mats.some((m) => m.have < m.n); sendBtn.disabled = !g || !d.to || !(d.price > 0) || me.gilt < d.price || !!short; sendBtn.textContent = `Send job (${fmt(d.price ?? 0)}g in escrow)`; };
  if (info && d.price == null) { d.price = info.fee; fee.value = d.price; }
  sendBtn.onclick = () => { send({ t: 'upg.new', to: d.to, uid: d.uid, price: d.price }); d.uid = null; back('requests'); };
  const cards = gear.map((x) => h('button', { class: `upcard ${x.uid === d.uid ? 'sel' : ''}`, onclick: () => { d.uid = x.uid; d.price = null; G.upInfo = null; refreshWindow('character'); } }, I.item(x.id, 34), h('div', { style: { minWidth: 0, textAlign: 'left' } }, h('div', { class: 'iname' }, upName(x)), h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } }, upBadge(upLevel(x)), Object.values(me.equip).includes(x.uid) ? h('span', { class: 'tag g' }, 'worn') : null, ...gearStats(x).map(([k, v, c]) => h('span', { class: 'sc', style: { color: c } }, `${k} ${fmt(v)}`))))));
  upd();
  const right = !g ? h('div', { class: 'dim', style: { padding: '24px 8px', textAlign: 'center' } }, 'Pick the piece you want tempered.') : !info ? h('p', { class: 'dim' }, 'Reading the metal…') : h('div', {},
    h('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, h('div', { class: 'upicon', style: { boxShadow: `0 0 18px ${upColor(info.up)}` } }, I.item(g.id, 56)), h('div', {}, h('h3', { style: { margin: 0 } }, upName(g)), h('div', { style: { fontSize: '13px' } }, `Step +${info.up} → +${info.up + 1}`), h('div', { class: 'dim', style: { fontSize: '12px' } }, `The smith needs level ${info.needLvl}`))),
    h('div', { class: 'upstats', style: { margin: '8px 0' } }, gearStats(g).map(([k, v, c], i) => h('div', { class: 'upstat' }, h('span', { style: { color: c } }, k), h('b', {}, fmt(v)), h('span', { class: 'ups-arrow' }, '→'), h('b', { style: { color: '#8cffa0' } }, fmt(gearStats({ ...g, up: info.up + 1 })[i][1]))))),
    h('div', { class: 'dim', style: { fontSize: '12px' } }, 'You provide these materials (taken from your bag, held until the work is done):'), matRow(info.mats), chanceBar(info.chance, 0.05, info.up),
    h('div', { class: 'row', style: { margin: '8px 0', flexWrap: 'wrap' } }, 'Fee', fee, 'g', h('button', { class: 'btn small ghost', onclick: () => { d.price = info.fee; fee.value = d.price; upd(); } }, `Suggest ${fmt(info.fee)}g`)),
    info.mats.some((m) => m.have < m.n) ? h('p', { class: 'red', style: { fontSize: '12px', margin: '4px 0' } }, 'You are missing materials. Mine, brew or buy them first.') : null,
    Object.values(me.equip).includes(g.uid) ? h('p', { class: 'dim', style: { fontSize: '12px', margin: '4px 0' } }, 'This piece is worn: it will be taken off and held.') : null,
    h('div', { class: 'row', style: { margin: '6px 0' } }, sendBtn), h('p', { class: 'dim', style: { fontSize: '12px' } }, 'The piece, the materials and the fee are all held. If the smith rejects, you cancel, or 72 hours pass, everything comes back. On a failed attempt the materials are used up and the piece may lose a level, but it always returns to you.'));
  return h('div', {}, h('div', { class: 'row sb', style: { margin: '0 0 6px' } }, h('h3', { style: { margin: 0 } }, 'Ask a Blacksmith to upgrade your gear'), h('button', { class: 'btn small ghost', onclick: () => back('find') }, 'Back')),
    h('div', { class: 'row', style: { margin: '4px 0' } }, 'Blacksmith', nameIn, dl, d.cl != null ? h('span', { class: 'tag' }, `level ${d.cl}`) : null),
    h('div', { class: 'upgrid' }, h('div', { class: 'uplist' }, h('div', { class: 'upcards' }, cards.length ? cards : h('p', { class: 'dim' }, 'You have no gear that can be upgraded.'))), h('div', { class: 'updetail' }, right)));
}
void gearName;
