// ─────────────────────────────────────────────────────────────────────────────
// DIRECT REQUESTS — a player asks a Blacksmith or Alchemist for one specific item at an agreed price.
//
//   1. The requester picks a crafter, an item (from that craft's recipes), a minimum quality and an offered payment.
//      The payment is held in escrow, so the crafter knows it is real.
//   2. The two haggle in private chat (/w) and with formal counter-offers (req.offer → req.answer). Raising or lowering the price
//      moves the escrow accordingly. Nothing is final until the crafter ACCEPTS.
//   3. The crafter accepts or rejects. A request for something the crafter cannot make yet (level, secret recipe) can only be
//      rejected. Rejecting (or the requester cancelling) simply refunds the escrow — nothing else happens.
//   4. After accepting, the crafter either already owns a fitting item or forges/brews one, then presses "Ready" — the requester
//      is told — and finally "Deliver": the item moves to the requester and the escrow pays the crafter.
//
// This is the ONLY way a Blacksmith/Alchemist may hand their own creations straight to a non-merchant player.
// Everything else they make goes through Merchants (wholesale orders / trades to a Merchant) or open commissions.
// ─────────────────────────────────────────────────────────────────────────────
import { RECIPES, ITEMS } from '../data.js';
import * as R from '../rules.js';

export const REQ = { expireMs: 72 * 3600000, maxOut: 6, maxIn: 30, maxQty: 5 };
const clampInt = (v, a, b) => Math.max(a, Math.min(b, Math.floor(+v) || a));

// Which recipe (if any) makes this item for this craft family?
export const recipeFor = (family, itemId) => RECIPES.find((r) => r.craft === family && r.out === itemId && !r.smelt && ITEMS[r.out] && ITEMS[r.out].k !== 'quest') ?? null;
// Can this crafter make it at their current advancement (family, level, secret recipe)? Ingredients are not required to ACCEPT.
export const canMakeKind = (P, r) => !!r && R.craftFamily(P) === r.craft && P.level >= r.lvl && (!r.secret || !!P.flags?.[r.secret]);
export const requestable = (family) => RECIPES.filter((r) => r.craft === family && !r.smelt && ITEMS[r.out] && ITEMS[r.out].k !== 'quest').map((r) => ({ id: r.out, lvl: r.lvl, secret: !!r.secret }));

export const requestMethods = {
  initRequests(state) { this.reqs = Array.isArray(state?.reqs) ? state.reqs : []; this.nextReq = state?.nextReq ?? 1 + this.reqs.reduce((n, r) => Math.max(n, r.id), 0); },

  // items in a crafter's possession that satisfy a request (gear by quality; stacks by count)
  reqStock(P, r) {
    const it = ITEMS[r.itemId]; if (!it) return [];
    if (it.k === 'gear') return P.gear.filter((g) => g.id === r.itemId && g.q >= r.minQ && !R.isEquipped(P, g.uid)).sort((a, b) => a.q - b.q);
    return Array.from({ length: R.count(P, r.itemId) }, (_, i) => i);
  },
  reqView(r, P) {
    const mine = r.from === P.id ? 'from' : 'to', cr = this.players.get(r.to), rec = recipeFor(cr ? R.craftFamily(cr) : null, r.itemId);
    const v = { id: r.id, mine, other: mine === 'from' ? r.toName : r.fromName, itemId: r.itemId, qty: r.qty, minQ: r.minQ, price: r.price, status: r.status, ready: !!r.ready, left: Math.max(0, r.expires - this.now()), offer: r.offer ? { price: r.offer.price, byMe: r.offer.by === mine } : null };
    if (mine === 'to') { v.canMake = canMakeKind(P, rec); v.needLvl = rec?.lvl ?? 0; v.secret = !!rec?.secret; v.have = this.reqStock(P, r).length; }
    return v;
  },
  pushReqs(S) { if (S) S.conn.send({ t: 'reqs', list: this.reqs.filter((r) => (r.from === S.id || r.to === S.id) && (r.status === 'pending' || r.status === 'accepted')).map((r) => this.reqView(r, S.P)) }); },
  pushReqsFor(r) { for (const id of [r.from, r.to]) this.pushReqs(this.sessions.get(id)); },
  say(id, text, kind = '') { const S = this.sessions.get(id); if (S) { S.conn.send({ t: 'toast', msg: text, kind }); S.conn.send({ t: 'chat', ch: 'system', from: '', text, ts: this.now() }); } else { const P = this.players.get(id); if (P) (P.mail ??= []).push(text); } },

  on_req_list(S) { this.pushReqs(S); },
  // the directory of crafters a player can send a request to (online ones first)
  on_req_crafters(S) {
    const list = [...this.players.values()].filter((p) => p.id !== S.id && R.craftFamily(p)).map((p) => ({ n: p.name, c: p.classId, l: p.level, fam: R.craftFamily(p), on: this.sessions.has(p.id) }))
      .sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0) || b.l - a.l).slice(0, 60);
    S.conn.send({ t: 'crafters', list });
  },

  on_req_new(S, m) {
    const P = S.P, id = this.byName.get(String(m.to ?? '').trim().toLowerCase()), C = id ? this.players.get(id) : null;
    if (!C || C.id === P.id) return this.toast(S, 'Pick another player to ask.', 'bad');
    const fam = R.craftFamily(C); if (!fam) return this.toast(S, `${C.name} is not a Blacksmith or an Alchemist.`, 'bad');
    const rec = recipeFor(fam, String(m.itemId)); if (!rec) return this.toast(S, `${C.name} cannot be asked for that.`, 'bad');
    const qty = clampInt(m.qty ?? 1, 1, REQ.maxQty), price = Math.round(+m.price), minQ = ITEMS[rec.out].k === 'gear' ? Math.max(0, Math.min(0.99, +m.minQ || 0)) : 0;
    if (!(price >= 1 && price <= 1e7)) return this.toast(S, 'Offer a sensible payment.', 'bad');
    if (this.reqs.filter((r) => r.from === P.id && (r.status === 'pending' || r.status === 'accepted')).length >= REQ.maxOut) return this.toast(S, `You can have at most ${REQ.maxOut} open requests.`, 'bad');
    if (this.reqs.filter((r) => r.to === C.id && (r.status === 'pending' || r.status === 'accepted')).length >= REQ.maxIn) return this.toast(S, `${C.name} has too many open requests.`, 'bad');
    if (P.gilt < price) return this.toast(S, `You need ${price}g to put the payment in escrow.`, 'bad');
    P.gilt -= price;
    const r = { id: this.nextReq++, from: P.id, fromName: P.name, to: C.id, toName: C.name, itemId: rec.out, qty, minQ, price, escrow: price, status: 'pending', ready: false, offer: null, created: this.now(), expires: this.now() + REQ.expireMs };
    this.reqs.push(r); this.touch(S);
    this.toast(S, `Request sent to ${C.name}: ${qty}× ${ITEMS[rec.out].n} for ${price}g (held in escrow). Talk it over with /w ${C.name}.`, 'good');
    this.say(C.id, `${P.name} requests ${qty}× ${ITEMS[rec.out].n}${minQ ? ` (quality ${Math.round(minQ * 100)}%+)` : ''} for ${price}g. Open Character → Requests, or reply with /w ${P.name}.`, 'secret');
    this.pushReqsFor(r);
  },
  reqOf(S, m) { const r = this.reqs.find((x) => x.id === +m.id); return r && (r.from === S.id || r.to === S.id) && (r.status === 'pending' || r.status === 'accepted') ? r : null; },
  refund(r, why) {
    const P = this.players.get(r.from); if (P && r.escrow > 0) { P.gilt += r.escrow; this.touch(this.sessions.get(r.from) ?? { dirtyMe: true }); }
    r.escrow = 0; r.status = why; r.offer = null;
  },
  // the crafter says yes (only if they can actually make it)
  on_req_accept(S, m) {
    const r = this.reqOf(S, m); if (!r || r.to !== S.id || r.status !== 'pending') return;
    const rec = recipeFor(R.craftFamily(S.P), r.itemId);
    if (!canMakeKind(S.P, rec)) return this.toast(S, rec?.secret && !S.P.flags?.[rec.secret] ? 'You do not know that recipe yet. You can only reject.' : `That needs craft level ${rec?.lvl ?? '?'} — you can only reject.`, 'bad');
    r.status = 'accepted'; r.offer = null;
    this.toast(S, 'Accepted. Deliver one you already have, or make it, then press Ready.', 'good'); this.say(r.from, `${r.toName} accepted your request for ${ITEMS[r.itemId].n} at ${r.price}g. They will message you when it is ready.`, 'good'); this.pushReqsFor(r);
  },
  // the crafter says no; the requester cancels — either way: nothing happens and the escrow comes back
  on_req_reject(S, m) {
    const r = this.reqOf(S, m); if (!r || r.to !== S.id) return;
    this.refund(r, 'rejected'); this.say(r.from, `${r.toName} turned down your request for ${ITEMS[r.itemId].n}. Your ${r.price}g is back.`, 'bad'); this.toast(S, 'Request rejected.'); this.pushReqsFor(r);
  },
  on_req_cancel(S, m) {
    const r = this.reqOf(S, m); if (!r || r.from !== S.id) return;
    this.refund(r, 'cancelled'); this.say(r.to, `${r.fromName} cancelled their request for ${ITEMS[r.itemId].n}.`); this.toast(S, 'Request cancelled; your payment is back.', 'good'); this.touch(S); this.pushReqsFor(r);
  },
  // price negotiation: one pending proposal at a time; the other side answers it
  on_req_offer(S, m) {
    const r = this.reqOf(S, m); if (!r) return; const price = Math.round(+m.price), mine = r.from === S.id ? 'from' : 'to';
    if (!(price >= 1 && price <= 1e7) || price === r.price) return this.toast(S, 'Propose a different, sensible price.', 'bad');
    if (mine === 'from' && price > r.price && S.P.gilt < price - r.price) return this.toast(S, `You would need ${price - r.price}g more in your purse.`, 'bad');
    r.offer = { by: mine, price }; this.toast(S, `Counter-offer of ${price}g sent.`);
    this.say(mine === 'from' ? r.to : r.from, `${S.P.name} proposes ${price}g for ${ITEMS[r.itemId].n} (was ${r.price}g). Answer in Character → Requests.`, 'secret'); this.pushReqsFor(r);
  },
  on_req_answer(S, m) {
    const r = this.reqOf(S, m); if (!r || !r.offer) return; const mine = r.from === S.id ? 'from' : 'to';
    if (r.offer.by === mine) return this.toast(S, 'Wait for the other side to answer your offer.', 'bad');
    const other = mine === 'from' ? r.to : r.from;
    if (!m.accept) { r.offer = null; this.say(other, `${S.P.name} declined your price proposal.`); return this.pushReqsFor(r); }
    const payer = this.players.get(r.from), diff = r.offer.price - r.price;
    if (diff > 0 && payer.gilt < diff) { r.offer = null; this.say(r.from, `You cannot cover the extra ${diff}g — the new price was dropped.`, 'bad'); this.say(r.to, `${r.fromName} cannot cover the new price.`, 'bad'); return this.pushReqsFor(r); }
    payer.gilt -= diff; r.escrow += diff; r.price = r.offer.price; r.offer = null; this.touch(this.sessions.get(r.from) ?? { dirtyMe: true });
    this.say(r.from, `Price agreed: ${r.price}g for ${ITEMS[r.itemId].n}.`, 'good'); this.say(r.to, `Price agreed: ${r.price}g for ${ITEMS[r.itemId].n}.`, 'good'); this.pushReqsFor(r);
  },
  // "your item is ready" — only if the crafter really holds one that fits
  on_req_ready(S, m) {
    const r = this.reqOf(S, m); if (!r || r.to !== S.id || r.status !== 'accepted') return;
    if (this.reqStock(S.P, r).length < r.qty) return this.toast(S, `You do not hold ${r.qty}× ${ITEMS[r.itemId].n}${r.minQ ? ` of quality ${Math.round(r.minQ * 100)}%+` : ''} yet. Forge/brew it first.`, 'bad');
    r.ready = true; this.say(r.from, `${r.toName}: your ${ITEMS[r.itemId].n} is ready! They will hand it over for ${r.price}g.`, 'secret'); this.toast(S, 'The requester has been told it is ready.', 'good'); this.pushReqsFor(r);
  },
  on_req_deliver(S, m) {
    const r = this.reqOf(S, m); if (!r || r.to !== S.id || r.status !== 'accepted') return;
    const P = S.P, to = this.players.get(r.from), stock = this.reqStock(P, r); if (!to) return;
    if (stock.length < r.qty) return this.toast(S, `You do not hold ${r.qty}× ${ITEMS[r.itemId].n}${r.minQ ? ` of quality ${Math.round(r.minQ * 100)}%+` : ''}. Forge/brew it first.`, 'bad');
    const it = ITEMS[r.itemId];
    if (it.k === 'gear') for (const g of stock.slice(0, r.qty)) { P.gear.splice(P.gear.indexOf(g), 1); R.addGear(to, { id: g.id, q: g.q, affix: g.affix, fx: g.fx, ench: g.ench, cname: g.cname, by: g.by ?? P.name }); }
    else { const c = Math.min(r.qty, R.lockedStack(P, r.itemId)); if (c && P.crafted) P.crafted[r.itemId] -= c; R.removeItem(P, r.itemId, r.qty); R.addItem(to, r.itemId, r.qty); }
    P.gilt += r.escrow; P.stats.profit = (P.stats.profit ?? 0) + r.escrow; P.stats.requests = (P.stats.requests ?? 0) + 1; to.stats.requestsBought = (to.stats.requestsBought ?? 0) + 1;
    const paid = r.escrow; r.escrow = 0; r.status = 'done'; r.ready = false;
    this.say(r.from, `${P.name} delivered ${r.qty}× ${it.n}. You paid ${paid}g.`, 'good'); this.toast(S, `Delivered. You earned ${paid}g.`, 'good');
    this.touch(S); const rs = this.sessions.get(r.from); if (rs) this.afterChange(rs); this.afterChange(S); this.pushReqsFor(r);
  },
  tickRequests(nw) {
    if (!this.reqs.length) return;
    for (const r of this.reqs) if ((r.status === 'pending' || r.status === 'accepted') && nw >= r.expires) { this.refund(r, 'expired'); this.say(r.from, `Your request for ${ITEMS[r.itemId].n} expired. ${r.price}g is back.`); this.say(r.to, `The request from ${r.fromName} expired.`); this.pushReqsFor(r); }
    if (this.reqs.length > 400) this.reqs = this.reqs.filter((r) => r.status === 'pending' || r.status === 'accepted' || nw - (r.expires - REQ.expireMs) < 7 * 24 * 3600000);
  },
};
